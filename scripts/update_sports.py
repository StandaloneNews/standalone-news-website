#!/usr/bin/env python3
"""Standalone News Sports Desk: source-linked scores, schedules and MMA cards.

ESPN's publicly reachable, undocumented scoreboard API can change without notice.
Stories are fetched from publisher RSS or sport-specific news endpoints. No sample
fixtures, team logos or invented results are ever generated.
"""
from __future__ import annotations
import concurrent.futures
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
import html
import json
from pathlib import Path
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'data' / 'sports.json'
BASE = 'https://site.api.espn.com/apis/site/v2/sports/'
USER_AGENT = 'StandaloneNewsSports/1.0 (+https://standalonenews.com; editorial scoreboard aggregator)'
LEAGUES = (
    ('ufc', 'UFC', 'mma/ufc'),
    ('nfl', 'NFL', 'football/nfl'),
    ('nba', 'NBA', 'basketball/nba'),
    ('mlb', 'MLB', 'baseball/mlb'),
    ('nhl', 'NHL', 'hockey/nhl'),
    ('ncaaf', 'College Football', 'football/college-football'),
    ('ncaab', 'College Basketball', 'basketball/mens-college-basketball'),
    ('epl', 'Premier League', 'soccer/eng.1'),
    ('mls', 'MLS', 'soccer/usa.1'),
)
NEWS_FEEDS = (
    ('BBC Sport', 'https://feeds.bbci.co.uk/sport/rss.xml'),
    ('The Guardian Sport', 'https://www.theguardian.com/uk/sport/rss'),
)


def clean(value: object, limit: int = 230) -> str:
    return html.unescape(re.sub(r'\s+', ' ', re.sub(r'<[^>]*>', ' ', str(value or '')))).strip()[:limit]


def safe_url(value: object) -> str:
    value = str(value or '')
    try:
        url = urllib.parse.urlsplit(value)
    except ValueError:
        return ''
    return value if url.scheme == 'https' and url.netloc and not url.username else ''


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept':'application/json, application/xml, application/rss+xml'})
    with urllib.request.urlopen(req, timeout=15) as response:
        data = response.read(2_500_001)
    if len(data) > 2_500_000:
        raise ValueError('Oversized sports response')
    return data


def moment(value: object) -> datetime | None:
    if not value:return None
    try:
        d=datetime.fromisoformat(str(value).replace('Z','+00:00'))
        if d.tzinfo is None:d=d.replace(tzinfo=timezone.utc)
        return d.astimezone(timezone.utc)
    except (ValueError, TypeError, OverflowError):return None


def participant(row: dict) -> dict:
    team = row.get('team') or row.get('athlete') or {}
    if not isinstance(team, dict):team={}
    name=clean(team.get('displayName') or team.get('fullName') or row.get('displayName'),90)
    score=row.get('score')
    if isinstance(score,dict):score=score.get('displayValue') or score.get('value')
    result={'name':name, 'score':clean(score,15) if score is not None else ''}
    if row.get('winner') is True:result['winner']=True
    return result


def competition_parts(comp: dict) -> list[dict]:
    return [part for item in comp.get('competitors', []) if isinstance(item,dict)
            if (part:=participant(item)).get('name')][:2]


def parse_event(raw: dict, league: str, now: datetime) -> dict | None:
    date=moment(raw.get('date'))
    if not date or date < now-timedelta(days=8) or date > now+timedelta(days=65):return None
    competitions=[c for c in (raw.get('competitions') or []) if isinstance(c,dict)]
    first=competitions[0] if competitions else {}
    status=first.get('status') or raw.get('status') or {}
    if not isinstance(status,dict):status={}
    typ=status.get('type') or {}
    if not isinstance(typ,dict):typ={}
    state=clean(typ.get('state') or 'pre',12).lower()
    if state not in ('pre','in','post'):state='pre'
    state='final' if state=='post' else 'live' if state=='in' else 'upcoming'
    title=clean(raw.get('shortName') or raw.get('name'),125)
    parts=competition_parts(first)
    if league=='ufc':
        # A UFC event contains many bout competitions, each with two athletes.
        fights=[]
        for comp in competitions[:15]:
            members=competition_parts(comp)
            if len(members)<2:continue
            st=(comp.get('status') or {}).get('type') or {}
            cstate=st.get('state') or 'pre'
            fights.append({'fighters':members,'state':'final' if cstate=='post' else 'live' if cstate=='in' else 'upcoming',
                           'detail':clean(st.get('shortDetail') or st.get('detail'),75)})
        bouts=fights[:10]
        if not title: title=clean(raw.get('name') or 'UFC event')
    else:
        bouts=[]
        if not title and len(parts)==2:title=f"{parts[0]['name']} vs {parts[1]['name']}"
    if not title:return None
    links=raw.get('links') or []
    url=next((safe_url(x.get('href')) for x in links if isinstance(x,dict) and safe_url(x.get('href'))), '')
    result={'id':clean(str(raw.get('id') or f"{league}-{date.isoformat()}-{title}"),100),
            'league':league, 'name':title, 'date':date.isoformat(timespec='seconds').replace('+00:00','Z'),
            'state':state, 'status':clean(typ.get('shortDetail') or typ.get('detail') or status.get('displayClock') or '',80),
            'participants':parts, 'url':url}
    if league=='ufc':result['fights']=bouts
    return result


def month_keys(now: datetime) -> list[str]:
    def shift(offset: int) -> str:
        value=(now.year*12+now.month-1)+offset
        return f'{value//12:04d}{value%12+1:02d}'
    return [shift(-1),shift(0),shift(1)]


def requests_for_league(league: tuple[str,str,str], now: datetime) -> list[tuple[str,str]]:
    slug,_,route=league
    root=BASE+route+'/scoreboard'
    if slug=='ufc':
        return [(slug,root+f'?dates={year}&limit=120') for year in (now.year,now.year+1)]+[(slug,root)]
    return [(slug,root+f'?dates={m}&limit=500') for m in month_keys(now)]+[(slug,root)]


def get_scoreboard(job: tuple[str,str], now: datetime) -> tuple[str,list[dict],str]:
    slug,url=job
    try:
        parsed=json.loads(fetch_bytes(url).decode('utf-8'))
        if not isinstance(parsed,dict) or not isinstance(parsed.get('events'),list):
            return slug,[],'Unexpected provider response'
        events=[x for raw in parsed['events'] if isinstance(raw,dict) if (x:=parse_event(raw,slug,now))]
        return slug,events,''
    except (ValueError,KeyError,urllib.error.URLError,TimeoutError,OSError) as e:
        return slug,[],type(e).__name__


def rss_text(node: ET.Element, *keys: str) -> str:
    for element in node:
        tag=element.tag.rsplit('}',1)[-1].lower()
        if tag in keys and element.text:return element.text.strip()
    return ''


def parse_sports_rss(xml: bytes, publisher: str, now: datetime) -> list[dict]:
    if b'<!DOCTYPE' in xml.upper() or b'<!ENTITY' in xml.upper():return []
    root=ET.fromstring(xml)
    out=[]
    for node in root.iter():
        if node.tag.rsplit('}',1)[-1].lower() not in ('item','entry'):continue
        title=clean(rss_text(node,'title'),185)
        url=safe_url(rss_text(node,'link'))
        raw_date=rss_text(node,'pubdate','published','updated')
        date=None
        if raw_date:
            try:date=parsedate_to_datetime(raw_date).astimezone(timezone.utc)
            except (ValueError, TypeError, OverflowError):date=moment(raw_date)
        if not title or not url or not date or not now-timedelta(days=5)<=date<=now+timedelta(hours=1):continue
        out.append({'title':title,'source':publisher,'url':url,'date':date.isoformat(timespec='seconds').replace('+00:00','Z'),
                    'league':'ufc' if re.search(r'\b(ufc|mma|octagon|jon jones)\b',title,re.I) else 'all'})
        if len(out)>=24:break
    return out


def fetch_sports_news(now:datetime) -> list[dict]:
    stories=[]
    for source,url in NEWS_FEEDS:
        try:stories+=parse_sports_rss(fetch_bytes(url),source,now)
        except (ValueError,ET.ParseError,urllib.error.URLError,TimeoutError,OSError):continue
    # UFC / MMA headlines from the same sports data provider.
    try:
        data=json.loads(fetch_bytes(BASE+'mma/ufc/news?limit=12').decode('utf-8'))
        for item in data.get('articles',[])[:20]:
            if not isinstance(item,dict):continue
            date=moment(item.get('published') or item.get('lastModified'))
            links=item.get('links') or {}
            if not isinstance(links,dict):links={}
            web=links.get('web') or {}
            url=safe_url(web.get('href') if isinstance(web,dict) else '')
            title=clean(item.get('headline'),185)
            if title and date and url and now-timedelta(days=5)<=date<=now+timedelta(hours=1):
                stories.append({'title':title,'source':'ESPN MMA','url':url,
                                'date':date.isoformat(timespec='seconds').replace('+00:00','Z'),'league':'ufc'})
    except (ValueError,urllib.error.URLError,TimeoutError,OSError):pass
    seen=set();result=[]
    for s in sorted(stories,key=lambda x:x['date'],reverse=True):
        if s['url'] in seen:continue
        seen.add(s['url']);result.append(s)
    return result[:45]


def build(now: datetime) -> dict | None:
    jobs=[j for league in LEAGUES for j in requests_for_league(league,now)]
    successes=0;groups={slug:{} for slug,_,_ in LEAGUES};errors=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for slug,rows,error in pool.map(lambda task:get_scoreboard(task,now),jobs):
            if not error:successes+=1
            else:errors.append(slug)
            for item in rows:
                old=groups[slug].get(item['id'])
                if not old or (len(item.get('fights',[]))>len(old.get('fights',[]))):groups[slug][item['id']]=item
    if not successes:
        print('No sports providers answered: preserving the last successful feed.',file=sys.stderr)
        return None
    events=[]
    for slug,_,_ in LEAGUES:
        rows=list(groups[slug].values())
        recent=sorted((x for x in rows if x['state']=='final'),key=lambda x:x['date'],reverse=True)[:18]
        upcoming=sorted((x for x in rows if x['state']!='final'),key=lambda x:x['date'])[:24]
        events.extend(recent+upcoming)
    return {'updated_at':now.isoformat(timespec='seconds').replace('+00:00','Z'),
            'source':'ESPN public scoreboards and attributed sport publishers',
            'provider_note':'Scoreboard data can be delayed; public provider endpoints can change. Times are event start times.',
            'sources_ok':successes,'sources_attempted':len(jobs),
            'leagues':[{'id':slug,'name':name,'events':len(groups[slug])} for slug,name,_ in LEAGUES],
            'events':events,'stories':fetch_sports_news(now)}


def main() -> int:
    payload=build(datetime.now(timezone.utc))
    if payload is None:return 1
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print('Updated Sports: '+str(len(payload['events']))+' events and '+str(len(payload['stories']))+
          ' attributed stories, '+str(payload['sources_ok'])+'/'+str(payload['sources_attempted'])+' successful scoreboard checks')
    return 0

if __name__=='__main__':raise SystemExit(main())
