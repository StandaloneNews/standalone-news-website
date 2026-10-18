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
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
import time
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
    ('laliga', 'Spanish La Liga', 'soccer/esp.1'),
    ('bundesliga', 'German Bundesliga', 'soccer/ger.1'),
    ('seriea', 'Italian Serie A', 'soccer/ita.1'),
    ('ligue1', 'French Ligue 1', 'soccer/fra.1'),
    ('ucl', 'UEFA Champions League', 'soccer/uefa.champions'),
    ('brasileirao', 'Brazilian Série A', 'soccer/bra.1'),
    ('argentina', 'Argentinian Primera División', 'soccer/arg.1'),
    ('ligamx', 'Mexican Liga MX', 'soccer/mex.1'),
    ('j1', 'Japanese J1 League', 'soccer/jpn.1'),
    ('aleague', 'Australian A-League', 'soccer/aus.1'),
    ('primeira', 'Portuguese Primeira Liga', 'soccer/por.1'),
    ('mls', 'MLS', 'soccer/usa.1'),
)
NEWS_FEEDS = (
    ('BBC Sport', 'https://feeds.bbci.co.uk/sport/rss.xml'),
    ('The Guardian Sport', 'https://www.theguardian.com/uk/sport/rss'),
    ('BBC MMA', 'https://feeds.bbci.co.uk/sport/mixed-martial-arts/rss.xml'),
    ('BBC Football', 'https://feeds.bbci.co.uk/sport/football/rss.xml'),
    ('The Guardian Football', 'https://www.theguardian.com/football/rss'),
    ('MMA Fighting', 'https://www.mmafighting.com/rss/index.xml'),
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
        return slug,[],type(e).__name__+': '+str(e)[:140]


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
                    'league':'ufc' if publisher in ('BBC MMA','MMA Fighting') or re.search(r'\b(ufc|mma|octagon|jon jones)\b',title,re.I) else 'soccer' if publisher in ('BBC Football','The Guardian Football') else 'all'})
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



# Documented TheSportsDB v1 free API fallback. Free endpoints return at most one
# next / past event per league. Attribute the source and never extrapolate.
SPORTSDB_BASE = 'https://www.thesportsdb.com/api/v1/json/123/'
SPORTSDB_LEAGUE_IDS = {
    'ufc':'4463', 'nfl':'4391','nba':'4387','mlb':'4424','nhl':'4380',
    'ncaaf':'4479','epl':'4328','laliga':'4335','bundesliga':'4331','seriea':'4332','ligue1':'4334','ucl':'4480','brasileirao':'4351','argentina':'4406','ligamx':'4350','j1':'4633','aleague':'4356','primeira':'4344','mls':'4346'
}

def sportsdb_event(raw: dict, league: str, now: datetime) -> dict | None:
    if not isinstance(raw,dict):return None
    when = moment(raw.get('strTimestamp'))
    if not when:
        date = clean(raw.get('dateEvent'),12)
        clock = clean(raw.get('strTime'),15)
        when = moment(date+'T'+(clock or '00:00:00')+'Z')
    if not when or when<now-timedelta(days=8) or when>now+timedelta(days=65):return None
    home=clean(raw.get('strHomeTeam'),70)
    away=clean(raw.get('strAwayTeam'),70)
    home_score=raw.get('intHomeScore')
    away_score=raw.get('intAwayScore')
    raw_status=clean(raw.get('strStatus') or '',35)
    final_mark=bool(re.search(r'(?i)finished|final|full.?time|ft|after extra time',raw_status))
    live_mark=bool(re.search(r'(?i)live|in progress|half.time|1st half|2nd half',raw_status))
    if final_mark:state='final'
    elif live_mark:state='live'
    elif when<=now-timedelta(hours=5) and home_score is not None and away_score is not None:state='final'
    else:state='upcoming'
    parts=[]
    for name,score in ((home,home_score),(away,away_score)):
        if not name:continue
        p={'name':name,'score':clean(score,12) if score is not None and state!='upcoming' else ''}
        parts.append(p)
    if state=='final' and len(parts)==2 and all(p['score'].isdigit() for p in parts):
        values=[int(p['score']) for p in parts]
        if values[0]!=values[1]:parts[values.index(max(values))]['winner']=True
    title=clean(raw.get('strEvent') or raw.get('strEventAlternate'),110)
    if not title:title=(' vs '.join([p['name'] for p in parts]) or 'Scheduled event')
    return {'id':'sportsdb-'+clean(raw.get('idEvent') or title+'-'+when.isoformat(),130),
            'league':league,'name':title,
            'date':when.isoformat(timespec='seconds').replace('+00:00','Z'),
            'state':state,'status':raw_status or ('Final' if state=='final' else 'Scheduled'),
            'participants':parts,'url':'',
            **({'fights':[{'fighters':parts,'state':state,'detail':raw_status}] if len(parts)==2 else []} if league=='ufc' else {})}

def sportsdb_fallback(now: datetime) -> tuple[list[dict],int]:
    jobs=[(slug,method) for method in ('eventsnextleague.php','eventspastleague.php')
          for slug in SPORTSDB_LEAGUE_IDS]
    def read(job):
        slug,method=job
        url=SPORTSDB_BASE+method+'?id='+SPORTSDB_LEAGUE_IDS[slug]
        try:
            data=json.loads(fetch_bytes(url).decode('utf-8'))
            if not isinstance(data,dict):return slug,[],False
            rows=data.get('events') or data.get('results') or []
            if not isinstance(rows,list):return slug,[],False
            return slug,[x for raw in rows if (x:=sportsdb_event(raw,slug,now))],True
        except (ValueError,urllib.error.URLError,TimeoutError,OSError) as error:
            print('TheSportsDB '+slug+' '+method+': '+type(error).__name__+' '+str(error)[:95],file=sys.stderr)
            return slug,[],False
    results=[];ok=0
    # Limit throughput; free API allows up to 30 requests per minute.
    # Shared free API keys can trip aggregate rate limits; serialize requests.
    for index, job in enumerate(jobs):
        if index:time.sleep(2.1)
        slug,events,success=read(job)
        if success:ok+=1
        results+=events
    return results,ok


MMA_CALENDAR = 'https://www.mmafighting.com/schedule'
class _TextOnly(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True);self.lines=[];self.skip=0
    def handle_starttag(self,t,a):
        if t in ('script','style','noscript'):self.skip+=1
        elif not self.skip and t in ('div','article','section','p','h1','h2','h3','h4','li','a','br'):self.lines.append('\n')
    def handle_endtag(self,t):
        if t in ('script','style','noscript'):self.skip=max(self.skip-1,0)
        elif not self.skip and t in ('div','article','section','p','h1','h2','h3','h4','li','a'):self.lines.append('\n')
    def handle_data(self,t):
        if not self.skip:self.lines.append(t)

def parse_ufc_calendar(raw:bytes,now:datetime)->list[dict]:
    extractor=_TextOnly();extractor.feed(raw.decode('utf-8','replace'))
    lines=[clean(x,190) for x in ''.join(extractor.lines).splitlines()]
    pattern=re.compile(r'^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+20\d{2}$',re.I)
    events=[];date=None;current=None;seen=set();active=False
    for line in lines:
        if line=='Fight Schedule':active=True;continue
        if not active:continue
        if line in ('Pagination','Page 1 of 1'):break
        if pattern.fullmatch(line):
            try:date=datetime.strptime(line,'%B %d, %Y').replace(tzinfo=timezone.utc)
            except ValueError:date=None
            current=None
        elif date and line.startswith('UFC ') and len(line)>9:
            key=(date.date(),line.casefold());current=None
            if key in seen or not now-timedelta(days=1)<=date<=now+timedelta(days=65):continue
            seen.add(key)
            current={'id':'mma-'+date.strftime('%Y%m%d')+'-'+re.sub(r'[^a-z0-9]+','-',line.lower())[:70],
                     'league':'ufc','name':line,'date':date.isoformat(timespec='seconds').replace('+00:00','Z'),
                     'date_only':True,'state':'upcoming','status':'Event date confirmed · Start time TBD',
                     'participants':[],'fights':[],'url':MMA_CALENDAR,'source':'MMA Fighting event schedule'}
            events.append(current)
        elif current and re.search(r'\s+vs\.?\s+',line,re.I) and len(current['fights'])<10:
            names=re.split(r'\s+vs\.?\s+',line,1,flags=re.I)
            if len(names)==2 and all(2<len(name)<75 for name in names):
                current['fights'].append({'fighters':[{'name':clean(name,75),'score':''} for name in names],
                                          'state':'upcoming','detail':'Scheduled'})
    return events[:12]

def backup_ufc_calendar(now:datetime)->list[dict]:
    try:
        req=urllib.request.Request(MMA_CALENDAR,headers={'User-Agent':'Mozilla/5.0 (compatible; StandaloneNews/1.0)','Accept':'text/html'})
        with urllib.request.urlopen(req,timeout=12) as response:raw=response.read(2_500_001)
        if len(raw)>2_500_000:raise ValueError('Oversized MMA calendar')
        events=parse_ufc_calendar(raw,now)
        print('Additional UFC calendar cards: '+str(len(events)))
        return events
    except (ValueError,urllib.error.URLError,TimeoutError,OSError) as error:
        print('UFC calendar source unavailable: '+type(error).__name__+' '+str(error)[:110],file=sys.stderr)
        return []

def build(now: datetime) -> dict | None:
    jobs=[j for league in LEAGUES for j in requests_for_league(league,now)]
    successes=0;groups={slug:{} for slug,_,_ in LEAGUES};errors=[];attempted=len(jobs)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for slug,rows,error in pool.map(lambda task:get_scoreboard(task,now),jobs):
            if not error:successes+=1
            else:errors.append(slug)
            for item in rows:
                old=groups[slug].get(item['id'])
                if not old or (len(item.get('fights',[]))>len(old.get('fights',[]))):groups[slug][item['id']]=item
    provider='ESPN public scoreboards'
    if not successes:
        print('ESPN provider errors (sample): '+repr(errors[:2]),file=sys.stderr)
        alt,ok=sportsdb_fallback(now)
        successes=ok
        attempted=len(SPORTSDB_LEAGUE_IDS)*2
        if alt:
            for row in alt:groups[row['league']][row['id']]=row
        provider='TheSportsDB v1 documented free API'
    if not groups['ufc']:
        for card in backup_ufc_calendar(now):groups['ufc'][card['id']]=card
    if not successes or not any(groups.values()):
        print('No usable sports events returned: preserving previous feed.',file=sys.stderr)
        return None
    events=[]
    for slug,_,_ in LEAGUES:
        rows=list(groups[slug].values())
        recent=sorted((x for x in rows if x['state']=='final'),key=lambda x:x['date'],reverse=True)[:18]
        upcoming=sorted((x for x in rows if x['state']!='final'),key=lambda x:x['date'])[:24]
        events.extend(recent+upcoming)
    return {'updated_at':now.isoformat(timespec='seconds').replace('+00:00','Z'),
            'source':provider+' plus optional sourced UFC fight cards and sport publishers',
            'provider_note':'Scores and fixtures may be delayed or incomplete. TheSportsDB free tier offers limited event coverage. All kickoff times are source-provided start times.',
            'sources_ok':successes,'sources_attempted':attempted,
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
