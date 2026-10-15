#!/usr/bin/env python3
"""Standalone News — hosted breaking-news collector, modeled on the desktop bot.

Public RSS only. Automatic importance scores are NOT verification or editorial approval.
Produces data/desk.json without editing existing site feeds, articles, or reader accounts.
Runs on GitHub Actions even when the local Standalone desktop bot is offline.
"""
from __future__ import annotations
import concurrent.futures
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime
import hashlib
import html
import json
import os
from pathlib import Path
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
FEEDS = json.loads((ROOT / 'scripts' / 'desk_feeds.json').read_text(encoding='utf-8'))
OUTPUT = ROOT / 'data' / 'desk.json'
MAX_BYTES = 2_000_000
MAX_ITEMS = 18
MAX_AGE_HOURS = 72
USER_AGENT = 'StandaloneNewsDesk/1.0 (+https://standalonenews.com)'

# Same baseline, phrases and bonuses as the desktop bot's engine.py.
BASE = {'Fed':48,'Markets':37,'Economy':38,'Washington':31,'World':29,'SEC':32,
        'US News':24,'Government':31,'DEA':31,'FDA':30,'Treasury':34,'Technology':26}
IMPACT = [(r'\b(fomc|rate cut|rate hike|interest rates|fed chair|powell)\b',34),
          (r'\b(cpi|inflation|payrolls|unemployment|jobs report|gdp|ppi|pce)\b',28),
          (r'\b(tariffs?|sanctions?|war|ceasefire|nuclear|supreme court)\b',22),
          (r'\b(earnings|profit warning|merger|acquisition|bankruptcy|guidance)\b',18),
          (r'\b(nasdaq|s&p 500|dow jones|bitcoin|oil prices|treasury yields)\b',16),
          (r'\b(breaking|urgent|just in)\b',3)]


def editorial_priority(title: str, category: str, source_type: str) -> int:
    value = BASE.get(category, 20) + (10 if source_type == 'Official direct' else 0)
    return min(100, value + sum(points for pattern, points in IMPACT if re.search(pattern, title, re.I)))


def similar_title(a: str, b: str) -> bool:
    toks = lambda s: re.findall(r'[a-z0-9]+', s.lower())
    x, y = set(toks(a)), set(toks(b))
    if len(x) < 5 or len(y) < 5: return False
    if x.symmetric_difference(y) and any(re.search(r'\d', s) for s in x.symmetric_difference(y)):
        return False
    return len(x & y) / max(len(x), len(y)) >= .90


def clean(s: str) -> str:
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s or ''))).strip()


def local_tag(tag: str) -> str:
    return tag.rsplit('}', 1)[-1].lower()


def child(node, name: str) -> str:
    for e in node:
        if local_tag(e.tag) == name.lower():
            if name.lower() == 'link' and e.attrib.get('href'):
                return e.attrib['href'].strip()
            return ''.join(e.itertext()).strip()
    return ''


def parsed_time(raw: str) -> str | None:
    if not raw: return None
    try:
        try: dt = parsedate_to_datetime(raw)
        except (ValueError, TypeError, IndexError): dt = datetime.fromisoformat(raw.replace('Z','+00:00'))
        if dt.tzinfo is None: dt=dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat(timespec='seconds')
    except (ValueError, TypeError, OverflowError):
        return None


def parse(xml: bytes, feed: dict) -> list[dict]:
    if b'<!DOCTYPE' in xml.upper() or b'<!ENTITY' in xml.upper():
        raise ValueError('XML entity declaration not allowed')
    root=ET.fromstring(xml)
    entries=[node for node in root.iter() if local_tag(node.tag) in ('item','entry')]
    found=[]
    for node in entries[:MAX_ITEMS]:
        title=clean(child(node,'title'))[:350]
        summary=clean(child(node,'description') or child(node,'summary') or child(node,'content'))[:850]
        url=child(node,'link')
        if not url:
            for e in node:
                if local_tag(e.tag)=='link' and e.attrib.get('rel','alternate')=='alternate':
                    url=e.attrib.get('href','').strip();break
        if not url.startswith(('https://','http://')) or not title:continue
        source=feed['name']
        if feed['type']=='Google News':
            hinted=child(node,'source')
            if hinted: source=clean(hinted)[:90]
            elif ' - ' in title: title,source=title.rsplit(' - ',1)
        else: source=feed['name'].split(' · ')[0]
        pub=parsed_time(child(node,'pubDate') or child(node,'published') or child(node,'updated') or child(node,'date'))
        if not pub: continue # Do not label undated headlines as breaking news.
        found.append({'id':hashlib.sha256(url.encode('utf-8')).hexdigest()[:24],
                      'title':title,'summary':summary,'url':url,'source':source,
                      'feed_id':feed['id'],'category':feed['category'],
                      'source_type':feed['type'],'published_at':pub,
                      'desk_priority':editorial_priority(title,feed['category'],feed['type']),
                      'selection_type':'automatic'})
    return found


def fetch(feed: dict) -> tuple[dict,list[dict],str]:
    req=urllib.request.Request(feed['url'],headers={'User-Agent':USER_AGENT,
                                                    'Accept':'application/rss+xml,application/atom+xml,application/xml,text/xml,*/*'})
    try:
        with urllib.request.urlopen(req,timeout=15) as response:
            data=response.read(MAX_BYTES+1)
        if len(data)>MAX_BYTES: raise ValueError('Feed exceeds 2 MB')
        return feed,parse(data,feed),''
    except Exception as ex:
        return feed,[],str(ex)[:150]


def normalize_old(row: dict) -> dict | None:
    if not isinstance(row,dict) or not row.get('url') or not row.get('title') or not row.get('published_at'):return None
    try:
        dt=datetime.fromisoformat(row['published_at'].replace('Z','+00:00'))
        if dt.tzinfo is None: dt=dt.replace(tzinfo=timezone.utc)
    except (ValueError,TypeError):return None
    if datetime.now(timezone.utc)-dt>timedelta(hours=MAX_AGE_HOURS):return None
    return row


def select(results: list[dict], previous: list[dict], now: datetime) -> tuple[list[dict],list[dict]]:
    # Prefer fresh records and better source kinds when identical URL is encountered.
    cutoff=now-timedelta(hours=MAX_AGE_HOURS)
    unique={}
    for row in [*results,*previous]:
        if not isinstance(row,dict): continue
        try:
            stamp=datetime.fromisoformat(str(row.get('published_at','')).replace('Z','+00:00'))
            if stamp.tzinfo is None: stamp=stamp.replace(tzinfo=timezone.utc)
        except (ValueError,TypeError):continue
        if not cutoff<=stamp<=now+timedelta(hours=2):continue
        if not str(row.get('url','')).startswith(('http://','https://')):continue
        key=row['url']
        if key not in unique or (row.get('source_type')=='Official direct' and unique[key].get('source_type')!='Official direct'):
            unique[key]=row
    chronological=sorted(unique.values(),key=lambda x:x['published_at'],reverse=True)
    # Duplicate grouping follows the desktop bot: preserve originals in the wire,
    # but do not select near-identical headlines for multiple featured positions.
    chosen=[];sources={};cats={}
    def score(x):
        try: hours=max(0,(now-datetime.fromisoformat(x['published_at'].replace('Z','+00:00'))).total_seconds()/3600)
        except (ValueError,TypeError):hours=99
        return (int(x.get('desk_priority',0)) + max(-30, 20-.6*hours))
    ranked=sorted(chronological,key=lambda x:(score(x),x['published_at']),reverse=True)
    for row in ranked:
        if len(chosen)>=24: break
        if sources.get(row.get('source'),0)>=2 or cats.get(row.get('category'),0)>=7:continue
        if any(similar_title(row['title'],z['title']) for z in chosen):continue
        chosen.append(row)
        sources[row.get('source')]=sources.get(row.get('source'),0)+1
        cats[row.get('category')]=cats.get(row.get('category'),0)+1
    return chronological[:300], chosen


def main() -> int:
    previous=[]
    if OUTPUT.exists():
        try: previous=json.loads(OUTPUT.read_text(encoding='utf-8')).get('items',[])
        except (ValueError,OSError):pass
    results=[];health=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for feed,items,error in pool.map(fetch,FEEDS):
            health.append({'id':feed['id'],'ok':not bool(error),'items':len(items)})
            results.extend(items)
    ok=sum(a['ok'] for a in health)
    print(f'Collected {len(results)} raw headlines from {ok}/{len(FEEDS)} configured sources')
    if not ok or not results:
        print('No readable fresh headlines; keeping prior desk.json unchanged',file=sys.stderr)
        return 0 if OUTPUT.exists() else 1
    now=datetime.now(timezone.utc)
    items,featured=select(results,previous,now)
    if not items:
        print('All headlines were too old; keeping previous file',file=sys.stderr)
        return 0 if OUTPUT.exists() else 1
    payload={'updated_at':now.isoformat(timespec='seconds'),
             'method':'Automated desktop-bot rule-based importance scoring; not verified or manually approved',
             'sources_checked':len(FEEDS),'sources_ok':ok,
             'featured_ids':[i['id'] for i in featured],
             'items':items}
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Wrote {len(items)} recent headlines and {len(featured)} featured story IDs to {OUTPUT}')
    return 0

if __name__=='__main__': raise SystemExit(main())
