#!/usr/bin/env python3
"""Opt-in source-linked digest and bounded major-story alert delivery.

No LLM used and no publisher article content copied. Requires GitHub secrets.
Emails send only to double-opted-in readers who have not unsubscribed.
"""
from __future__ import annotations
import argparse
import hashlib
import hmac
import html
import json
import os
from pathlib import Path
from datetime import datetime, timezone, timedelta
import urllib.parse
import urllib.request
import urllib.error

ROOT=Path(__file__).resolve().parents[1]
NEEDED=['SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','RESEND_API_KEY','NEWSLETTER_FROM_EMAIL','NEWSLETTER_SIGNING_SECRET','NEWSLETTER_POSTAL_ADDRESS']
SITE=os.environ.get('NEWSLETTER_BASE_URL','https://standalonenews.com').rstrip('/')
API_BASE='https://api.standalonenews.com'


def configured()->bool:
    return all(os.environ.get(k) for k in NEEDED)


def api(path:str,method='GET',data=None,headers=None):
    base=os.environ['SUPABASE_URL'].rstrip('/')
    from urllib.parse import urlsplit
    parsed=urlsplit(base)
    if parsed.scheme!='https' or not (parsed.hostname or '').endswith('.supabase.co') or parsed.path not in ('','/'):
        raise ValueError('Invalid Supabase URL')
    key=os.environ['SUPABASE_SERVICE_ROLE_KEY']
    url=base+'/rest/v1/'+path
    encoded=json.dumps(data).encode() if data is not None else None
    req=urllib.request.Request(url,data=encoded,method=method,headers={
        'apikey':key,**({'Authorization':'Bearer '+key} if key.startswith('eyJ') and key.count('.')==2 else {}),
        'Content-Type':'application/json','Prefer':'return=representation',**(headers or {})})
    with urllib.request.urlopen(req,timeout=20) as response:
        raw=response.read()
        return json.loads(raw) if raw else []


def post_email(email,subject,body,key):
    data=json.dumps({'from':os.environ['NEWSLETTER_FROM_EMAIL'],'to':[email],'subject':subject,'html':body}).encode()
    req=urllib.request.Request('https://api.resend.com/emails',data=data,method='POST',headers={
        'Authorization':'Bearer '+os.environ['RESEND_API_KEY'],'Content-Type':'application/json',
        'Idempotency-Key':key})
    with urllib.request.urlopen(req,timeout=20) as response:
        return json.loads(response.read())


def unsubscribe_link(subscriber):
    sid=subscriber['id']
    secret=os.environ['NEWSLETTER_SIGNING_SECRET'].encode()
    sig=hmac.new(secret,sid.encode(),'sha256').hexdigest()
    return API_BASE+'/api/newsletter/unsubscribe?token='+urllib.parse.quote(sid+'.'+sig)


def load_stories(mode, now=None):
    now=now or datetime.now(timezone.utc)
    file=ROOT/'data'/'desk.json'
    if not file.is_file():
        print('No desk.json; no emails to send');return []
    data=json.loads(file.read_text(encoding='utf-8'))
    rows=data.get('items',[])
    featured=set(data.get('featured_ids',[]))
    valid=[];seen=set()
    for row in sorted(rows,key=lambda r:int(r.get('desk_priority',0)),reverse=True):
        try:dt=datetime.fromisoformat(row['published_at'].replace('Z','+00:00'))
        except (KeyError,ValueError,AttributeError):continue
        if dt.tzinfo is None:dt=dt.replace(tzinfo=timezone.utc)
        if now-dt>timedelta(hours=(3 if mode=='alert' else 30)) or dt>now+timedelta(minutes=30):continue
        if mode=='alert' and (int(row.get('desk_priority') or 0)<92 or row.get('id') not in featured):continue
        url=row.get('url','')
        if not url.startswith('https://') or not row.get('title') or not row.get('source') or url in seen:continue
        # A high priority score is not fact verification; subjects come from the publisher.
        seen.add(url);valid.append(row)
        if len(valid)>=(1 if mode=='alert' else 5):break
    return valid


def make_email(stories,subscriber,mode):
    unsubscribe=html.escape(unsubscribe_link(subscriber),quote=True)
    postal=html.escape(os.environ['NEWSLETTER_POSTAL_ADDRESS'])
    date=datetime.now(timezone.utc).strftime('%B %d, %Y')
    parts=[]
    for i,st in enumerate(stories,1):
        title=html.escape(str(st['title']));link=html.escape(st['url'],quote=True)
        source=html.escape(st['source']);cat=html.escape(st.get('category','News'))
        parts.append(f'<li style="padding:12px 0;border-bottom:1px solid #ddd"><strong>{cat} · {source}</strong><br><a href="{link}" style="color:#092e54;font-weight:700">{title}</a></li>')
    heading='Significant story alert' if mode=='alert' else 'Your five-story briefing'
    return f'''<!doctype html><html><body style="margin:0;padding:24px;font:16px/1.55 Arial,sans-serif;color:#142b42">
<div style="max-width:600px;margin:auto"><h1 style="color:#123553">Standalone News</h1><p>{heading} · {date} UTC</p>
<p style="font-size:13px;color:#617389">Automated selection from attributed publishers. Priority scores are not fact verification. Read the linked publisher reporting for full context.</p>
<ol style="padding-left:24px">{''.join(parts)}</ol><p><a href="{SITE}/">Visit Standalone News</a></p>
<hr><p style="font-size:12px;color:#617389">You subscribed to Standalone News email briefings. <a href="{unsubscribe}">Unsubscribe</a> from all future messages. Address: {postal}.</p></div></body></html>'''


def eligible_subscribers(mode):
    # Fixed daily cap to make mail costs predictable; extend with pagination when scaled.
    sel='id,email,alerts,confirmed_at,unsubscribed_at'
    rows=api('newsletter_subscribers?select='+sel+'&confirmed_at=not.is.null&unsubscribed_at=is.null&order=created_at.asc&limit=500')
    return [r for r in rows if mode=='digest' or r.get('alerts') is True]


def should_send(subscriber,mode,story):
    if mode!='alert':return True
    # At most one significant-story email per UTC day per reader.
    today=datetime.now(timezone.utc).date().isoformat()
    previous=api('newsletter_deliveries?select=id&subscriber_id=eq.'+subscriber['id']+'&campaign_key=like.alert-'+today+'*&limit=1')
    return not previous


def run(mode,dry_run=False):
    if not configured():
        print('Mail secrets missing: newsletter job skipped; no emails sent')
        return 0
    stories=load_stories(mode)
    if not stories:
        print('No qualifying source-linked stories, no emails sent')
        return 0
    now=datetime.now(timezone.utc)
    campaign='digest-'+now.date().isoformat() if mode=='digest' else 'alert-'+now.date().isoformat()+'-'+hashlib.sha256(stories[0]['url'].encode()).hexdigest()[:12]
    subscribers=eligible_subscribers(mode)
    print(f'{mode}: {len(subscribers)} eligible confirmed readers; {len(stories)} news items')
    sent=0;failed=0
    for reader in subscribers:
        if mode=='alert' and not should_send(reader,mode,stories[0]):continue
        if dry_run:continue
        sid=reader['id'];record={'subscriber_id':sid,'campaign_key':campaign,'status':'queued'}
        # Insert once; a repeated workflow run does not double-send.
        rows=api('newsletter_deliveries?on_conflict=subscriber_id,campaign_key',method='POST',data=record,headers={'Prefer':'resolution=ignore-duplicates,return=representation'})
        if not rows:continue
        try:
            subject=('Standalone News: Significant story · ' if mode=='alert' else 'Standalone News: Your daily five-story brief · ')+now.strftime('%b %d')
            post_email(reader['email'],subject,make_email(stories,reader,mode),campaign+'-'+sid)
            api('newsletter_deliveries?id=eq.'+rows[0]['id'],method='PATCH',data={'status':'sent','sent_at':now.isoformat()});sent+=1
        except (urllib.error.HTTPError,urllib.error.URLError,ValueError) as exc:
            failed+=1;print('Delivery failed for subscriber id',sid,'type:',type(exc).__name__)
            api('newsletter_deliveries?id=eq.'+rows[0]['id'],method='PATCH',data={'status':'failed'})
    print(f'Sent: {sent}; failed: {failed}; skipped: {len(subscribers)-sent-failed}')
    return 1 if failed else 0

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--mode',choices=['digest','alert'],required=True);parser.add_argument('--dry-run',action='store_true')
    args=parser.parse_args();raise SystemExit(run(args.mode,args.dry_run))
