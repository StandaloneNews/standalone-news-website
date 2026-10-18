#!/usr/bin/env python3
"""Standalone News — hosted breaking-news collector + image matcher.

Public RSS only. Automatic importance scores and image matches are NOT verification or editorial approval.
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
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
FEEDS = json.loads((ROOT / 'scripts' / 'desk_feeds.json').read_text(encoding='utf-8'))
OUTPUT = ROOT / 'data' / 'desk.json'
MAX_BYTES = 2_000_000
MAX_ITEMS = 18
# More historical headlines for search and Load More; feature selection stays curated.
MAX_STORED_HEADLINES = 420
MAX_AGE_HOURS = 72
USER_AGENT = 'StandaloneNewsDesk/1.1 (+https://standalonenews.com)'
COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
IMAGE_LIMIT = 36
MAX_NEW_LOOKUPS = 24  # bounded source lookups; priority to featured stories
PEXELS_KEY = os.environ.get('PEXELS_API_KEY', '').strip()
PEXELS_API = 'https://api.pexels.com/v1/search'


BASE = {'Fed':48,'Markets':37,'Economy':38,'Washington':31,'World':29,'SEC':32,
        'US News':24,'Government':31,'DEA':31,'FDA':30,'Treasury':34,'Technology':26}
IMPACT = [(r'\b(fomc|rate cut|rate hike|interest rates|fed chair|powell)\b',34),
          (r'\b(cpi|inflation|payrolls|unemployment|jobs report|gdp|ppi|pce)\b',28),
          (r'\b(tariffs?|sanctions?|war|ceasefire|nuclear|supreme court)\b',22),
          (r'\b(earnings|profit warning|merger|acquisition|bankruptcy|guidance)\b',18),
          (r'\b(nasdaq|s&p 500|dow jones|bitcoin|oil prices|treasury yields)\b',16),
          (r'\b(breaking|urgent|just in)\b',3)]

ALLOWED_LICENSES = ('cc0', 'public domain', 'cc by', 'cc-by', 'cc by-sa', 'cc-by-sa')
BLOCKED_LICENSE_TERMS = ('noncommercial', 'nc', 'no derivatives', 'nd', 'fair use', 'all rights reserved')
BLOCKED_IMAGE_WORDS = ('logo','map','locator','seal','flag','icon','diagram','chart','plot','svg','coat of arms','wordmark')
STOPWORDS = {
    'the','a','an','and','or','for','to','of','in','on','with','amid','after','before','over','under','into','from',
    'as','by','at','is','are','be','new','latest','just','breaking','update','updates','report','reports','says','say',
    'announces','announce','announced','faces','face','opens','open','wins','win','move','moves','moving','could','may',
    'will','would','than','this','that','their','his','her','its','our','your','today','tomorrow'
}
ENTITY_MAP = {
    'federal reserve':'Federal Reserve building Washington DC',
    'fed':'Federal Reserve building Washington DC',
    'fomc':'Federal Reserve building Washington DC',
    'cpi':'United States economy shopping grocery store',
    'inflation':'grocery shopping prices United States',
    'powell':'Federal Reserve building Washington DC',
    'white house':'White House Washington DC',
    'supreme court':'Supreme Court of the United States building',
    'congress':'United States Capitol building',
    'senate':'United States Capitol building',
    'house of representatives':'United States Capitol building',
    'treasury':'United States Department of the Treasury building',
    'sec':'Securities and Exchange Commission headquarters',
    'securities and exchange commission':'Securities and Exchange Commission headquarters',
    'dea':'Drug Enforcement Administration building',
    'drug enforcement administration':'Drug Enforcement Administration building',
    'fda':'Food and Drug Administration headquarters',
    'food and drug administration':'Food and Drug Administration headquarters',
    'doj':'United States Department of Justice building',
    'department of justice':'United States Department of Justice building',
    'nvidia':'Nvidia headquarters',
    'apple':'Apple Park Cupertino',
    'tesla':'Tesla factory or Tesla company',
    'microsoft':'Microsoft headquarters Redmond',
    'amazon':'Amazon headquarters Seattle',
    'google':'Google headquarters Mountain View',
    'alphabet':'Google headquarters Mountain View',
    'meta':'Meta Platforms headquarters',
    'openai':'OpenAI office',
    'bitcoin':'Bitcoin illustration',
    'ethereum':'Ethereum illustration',
    'oil':'Oil pumpjack',
    'gold':'Gold bars',
    'ukraine':'Ukraine Kyiv',
    'russia':'Moscow Russia',
    'israel':'Jerusalem Israel',
    'gaza':'Gaza skyline',
    'china':'Beijing China',
    'taiwan':'Taipei Taiwan',
    'japan':'Tokyo Japan',
    'european union':'European Union Brussels',
    'europe':'Brussels Europe',
}
CATEGORY_FALLBACKS = {
    'Markets': ['New York Stock Exchange trading floor', 'Wall Street New York', 'stock market trading screen'],
    'Economy': ['United States economy New York financial district', 'Wall Street New York'],
    'Government': ['United States Capitol building', 'White House Washington DC'],
    'Washington': ['White House Washington DC', 'United States Capitol building'],
    'US News': ['United States Capitol building', 'White House Washington DC'],
    'Technology': ['technology office computers', 'semiconductor close-up'],
    'World': ['world leaders summit', 'United Nations Headquarters'],
    'Fed': ['Federal Reserve building Washington DC'],
    'SEC': ['Securities and Exchange Commission headquarters'],
    'DEA': ['Drug Enforcement Administration building'],
    'FDA': ['Food and Drug Administration headquarters'],
    'Treasury': ['United States Department of the Treasury building'],
}


def editorial_priority(title: str, category: str, source_type: str) -> int:
    value = BASE.get(category, 20) + (10 if source_type == 'Official direct' else 0)
    return min(100, value + sum(points for pattern, points in IMPACT if re.search(pattern, title, re.I)))


def similar_title(a: str, b: str) -> bool:
    toks = lambda s: re.findall(r'[a-z0-9]+', s.lower())
    x, y = set(toks(a)), set(toks(b))
    if len(x) < 5 or len(y) < 5:
        return False
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
    if not raw:
        return None
    try:
        try:
            dt = parsedate_to_datetime(raw)
        except (ValueError, TypeError, IndexError):
            dt = datetime.fromisoformat(raw.replace('Z','+00:00'))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat(timespec='seconds')
    except (ValueError, TypeError, OverflowError):
        return None


def parse(xml: bytes, feed: dict) -> list[dict]:
    if b'<!DOCTYPE' in xml.upper() or b'<!ENTITY' in xml.upper():
        raise ValueError('XML entity declaration not allowed')
    root = ET.fromstring(xml)
    entries = [node for node in root.iter() if local_tag(node.tag) in ('item','entry')]
    found = []
    for node in entries[:MAX_ITEMS]:
        title = clean(child(node,'title'))[:350]
        summary = clean(child(node,'description') or child(node,'summary') or child(node,'content'))[:850]
        url = child(node,'link')
        if not url:
            for e in node:
                if local_tag(e.tag)=='link' and e.attrib.get('rel','alternate')=='alternate':
                    url=e.attrib.get('href','').strip(); break
        if not url.startswith(('https://','http://')) or not title:
            continue
        source = feed['name']
        if feed['type']=='Google News':
            hinted=child(node,'source')
            if hinted:
                source = clean(hinted)[:90]
            elif ' - ' in title:
                title,source = title.rsplit(' - ',1)
        else:
            source = feed['name'].split(' · ')[0]
        pub = parsed_time(child(node,'pubDate') or child(node,'published') or child(node,'updated') or child(node,'date'))
        if not pub:
            continue
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
        if len(data)>MAX_BYTES:
            raise ValueError('Feed exceeds 2 MB')
        return feed,parse(data,feed),''
    except Exception as ex:
        return feed,[],str(ex)[:150]


def select(results: list[dict], previous: list[dict], now: datetime) -> tuple[list[dict],list[dict]]:
    cutoff=now-timedelta(hours=MAX_AGE_HOURS)
    unique={}
    for row in [*results,*previous]:
        if not isinstance(row,dict):
            continue
        # Google News dates may describe discovery or resurfacing, not the
        # original publisher's date. Do not treat them as breaking news.
        # Filter cached items too, so old discoveries cannot linger.
        if row.get('source_type')=='Google News':
            continue
        try:
            stamp=datetime.fromisoformat(str(row.get('published_at','')).replace('Z','+00:00'))
            if stamp.tzinfo is None:
                stamp=stamp.replace(tzinfo=timezone.utc)
        except (ValueError,TypeError):
            continue
        if not cutoff<=stamp<=now+timedelta(hours=2):
            continue
        if not str(row.get('url','')).startswith(('http://','https://')):
            continue
        key=row['url']
        if key not in unique or (row.get('source_type')=='Official direct' and unique[key].get('source_type')!='Official direct'):
            unique[key]=row
    chronological=sorted(unique.values(),key=lambda x:x['published_at'],reverse=True)
    chosen=[];sources={};cats={}
    def score(x):
        try:
            hours=max(0,(now-datetime.fromisoformat(x['published_at'].replace('Z','+00:00'))).total_seconds()/3600)
        except (ValueError,TypeError):
            hours=99
        return (int(x.get('desk_priority',0)) + max(-30, 20-.6*hours))
    ranked=sorted(chronological,key=lambda x:(score(x),x['published_at']),reverse=True)
    for row in ranked:
        if len(chosen)>=24:
            break
        if sources.get(row.get('source'),0)>=2 or cats.get(row.get('category'),0)>=7:
            continue
        if any(similar_title(row['title'],z['title']) for z in chosen):
            continue
        chosen.append(row)
        sources[row.get('source')]=sources.get(row.get('source'),0)+1
        cats[row.get('category')]=cats.get(row.get('category'),0)+1
    return chronological[:MAX_STORED_HEADLINES], chosen


def strip_meta(value: str) -> str:
    return clean(re.sub(r'<[^>]+>', ' ', value or ''))


def license_allowed(name: str) -> bool:
    lowered = (name or '').strip().lower()
    if not lowered:
        return False
    if any(term in lowered for term in BLOCKED_LICENSE_TERMS):
        return False
    return any(term in lowered for term in ALLOWED_LICENSES)


def title_rejected(title: str) -> bool:
    lowered=(title or '').lower()
    return any(word in lowered for word in BLOCKED_IMAGE_WORDS)


def cap_entities(title: str) -> list[str]:
    phrases=[]
    for phrase in re.findall(r'\b(?:[A-Z][a-z]+|[A-Z]{2,})(?:\s+(?:[A-Z][a-z]+|[A-Z]{2,})){0,3}', title):
        p=phrase.strip(' -:;,.')
        if len(p)<3:
            continue
        lp=p.lower()
        if lp in STOPWORDS or lp in {'Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','Monday'}:
            continue
        phrases.append(p)
    seen=[]
    for p in phrases:
        if p not in seen:
            seen.append(p)
    return seen[:5]


def tokens_for_query(text_in: str) -> list[str]:
    toks=[]
    for tok in re.findall(r'[A-Za-z][A-Za-z0-9&.-]+', text_in):
        t=tok.lower()
        if t in STOPWORDS or len(t)<3:
            continue
        toks.append(tok)
    # keep only a small number of meaningful words
    out=[]
    for tok in toks:
        if tok not in out:
            out.append(tok)
    return out[:5]


def build_image_queries(item: dict) -> list[str]:
    title=item.get('title','')
    source=item.get('source','')
    category=item.get('category','')
    lowered=' '.join([title,source,category]).lower()
    queries=[]
    # exact entity maps first
    for key,val in ENTITY_MAP.items():
        if re.search(r'\b'+re.escape(key)+r'\b', lowered):
            queries.append(val)
    # capitalized headline entities next
    for phrase in cap_entities(title):
        lp=phrase.lower()
        if lp in ENTITY_MAP:
            queries.append(ENTITY_MAP[lp])
        else:
            queries.append(phrase)
    # keyword phrase from title
    compact=' '.join(tokens_for_query(title))
    if compact:
        queries.append(compact)
    queries.extend(CATEGORY_FALLBACKS.get(category, []))
    # category + source fallback for official headlines
    if category and source and source.lower() not in lowered:
        queries.append(f'{source} {category}')
    seen=[]
    for q in queries:
        q=clean(q)
        if q and q not in seen:
            seen.append(q)
    return seen[:4]


def commons_request(params: dict) -> dict:
    url = COMMONS_API + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': USER_AGENT, 'Accept':'application/json'})
    with urllib.request.urlopen(req, timeout=9) as response:
        raw = response.read(MAX_BYTES)
    return json.loads(raw.decode('utf-8'))


def score_candidate(page_title: str, mime: str, width: int, query: str) -> int:
    score = 0
    lowered=(page_title or '').lower()
    qwords={w.lower() for w in tokens_for_query(query)}
    pwords=set(re.findall(r'[a-z0-9]+', lowered))
    score += len(qwords & pwords) * 7
    if mime in ('image/jpeg','image/jpg','image/png'):
        score += 6
    if width >= 1000:
        score += 4
    if width >= 1600:
        score += 2
    if title_rejected(page_title):
        score -= 20
    return score


# Carefully selected subjects, not photographs of the events reported in headlines.
# Metadata and license are checked afresh from Wikimedia on each match.
CURATED_COMMONS_FILES = {
    'Federal Reserve building Washington DC': 'File:Marriner S. Eccles Federal Reserve Board Building.jpg',
    'United States Capitol building': 'File:United States Capitol Building, East Front.jpg',
    'White House Washington DC': 'File:White House from North.jpg',
    'Moscow Russia skyline': 'File:Panorama of Moscow Kremlin.jpg',
    'Kyiv Ukraine skyline': 'File:Kyiv panoramic.jpg',
}

def subject_matches(query: str, title: str, description: str = '') -> bool:
    """Reject unrelated matches such as a Nissan Skyline for the Moscow skyline."""
    name=title.lower().replace('_',' ')
    q=query.lower()
    if re.search(r'\b(nissan|sedan|automobile|car|truck|vehicle|race car|motorcycle|storming|riot|protest|demonstration|january 6|jan 6|insurrection|arrest|bombing|explosion|terror attack|firefight|cartoon)\b',name):
        return False
    if 'federal reserve' in q:
        return bool(re.search(r'\b(federal reserve|eccles building|eccles federal reserve)\b',name))
    if 'capitol' in q:
        return 'capitol' in name and bool(re.search(r'\b(building|east|west|front|dome|facade|exterior|view)\b',name))
    if 'white house' in q:
        return 'white house' in name or 'whitehouse' in name
    if 'moscow' in q:
        return 'moscow' in name and bool(re.search(r'\b(kremlin|panorama|skyline|cityscape|city view)\b',name))
    if 'kyiv' in q:
        return ('kyiv' in name or 'kiev' in name) and bool(re.search(r'\b(panoramic|panorama|skyline|cityscape|view|centre)\b',name))
    terms={w.lower() for w in tokens_for_query(query)}
    matched={w.lower() for w in tokens_for_query(name)} & terms
    return len(matched)>=2

def search_curated_commons(query: str) -> list[dict]:
    """Exact-file lookup; always validate live license and file type."""
    filename=CURATED_COMMONS_FILES.get(query)
    if not filename:return []
    try:
        data=commons_request({
            'action':'query','format':'json','titles':filename,
            'prop':'imageinfo','iiprop':'url|mime|size|extmetadata','iiurlwidth':'1280'})
    except Exception:
        return []
    for page in (data.get('query') or {}).get('pages', {}).values():
        if page.get('missing') is not None:continue
        ii=(page.get('imageinfo') or [{}])[0]
        meta=ii.get('extmetadata') or {}
        license_name=strip_meta((meta.get('LicenseShortName') or {}).get('value',''))
        if not license_allowed(license_name) or ii.get('mime') not in ('image/jpeg','image/png','image/webp'):
            continue
        if int(ii.get('width') or 0)<800:continue
        url=ii.get('thumburl') or ii.get('url') or ''
        page_url=ii.get('descriptionurl') or ''
        title=page.get('title','')
        if not str(url).startswith('https://') or not str(page_url).startswith('https://commons.wikimedia.org/'):
            continue
        if not subject_matches(query,title):continue
        return [{'title':title,'thumb_url':url,'page_url':page_url,
                 'source':'Wikimedia Commons','creator':strip_meta((meta.get('Artist') or {}).get('value','')) or 'Unknown',
                 'license':license_name,'description':strip_meta((meta.get('ImageDescription') or {}).get('value','')),
                 'query':query,'score':100}]
    return []

def search_commons(query: str) -> list[dict]:
    curated=search_curated_commons(query)
    if curated:return curated
    params = {
        'action':'query','format':'json','generator':'search','gsrnamespace':'6','gsrlimit':'8',
        'gsrsearch': query,
        'prop':'imageinfo|info',
        'iiprop':'url|mime|size|extmetadata',
        'iiurlwidth':'1280',
        'inprop':'url'
    }
    try:
        data = commons_request(params)
    except Exception:
        return []
    pages = list((data.get('query') or {}).get('pages', {}).values())
    found=[]
    for page in pages:
        ii = ((page.get('imageinfo') or [{}])[0])
        meta = ii.get('extmetadata') or {}
        title = clean(page.get('title','').replace('File:',''))
        license_name = strip_meta((meta.get('LicenseShortName') or {}).get('value',''))
        if not license_allowed(license_name) or title_rejected(title) or not subject_matches(query,title):
            continue
        mime = ii.get('mime','')
        width = int(ii.get('width') or 0)
        if (mime not in ('image/jpeg','image/png','image/webp')) or (width and width < 800):
            continue
        artist = strip_meta((meta.get('Artist') or {}).get('value','')) or 'Unknown'
        credit = strip_meta((meta.get('Credit') or {}).get('value',''))
        description = strip_meta((meta.get('ImageDescription') or {}).get('value',''))
        url = ii.get('thumburl') or ii.get('url') or ''
        if not str(url).startswith(('https://','http://')):
            continue
        description_url = ii.get('descriptionurl') or page.get('fullurl') or ''
        found.append({
            'title': title,
            'thumb_url': url,
            'page_url': description_url,
            'source': 'Wikimedia Commons',
            'creator': artist,
            'credit': credit,
            'license': license_name,
            'description': description,
            'query': query,
            'score': score_candidate(title, mime, width, query)
        })
    return sorted([row for row in found if row['score'] >= 11], key=lambda x: x['score'], reverse=True)




def search_pexels(query: str) -> list[dict]:
    """Optional photo provider. API key stays in GitHub Secrets, never in public JS."""
    if not PEXELS_KEY:
        return []
    endpoint = PEXELS_API + '?' + urllib.parse.urlencode({
        'query': query, 'per_page': 8, 'orientation': 'landscape', 'size': 'medium'
    })
    req = urllib.request.Request(endpoint, headers={
        'Authorization': PEXELS_KEY, 'User-Agent': USER_AGENT, 'Accept': 'application/json'
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            data = json.loads(response.read(MAX_BYTES))
    except Exception:
        return []
    photos=[]
    for photo in data.get('photos', []):
        source=photo.get('src') or {}
        img=source.get('large') or source.get('medium') or source.get('original') or ''
        page=photo.get('url') or ''
        if not (str(img).startswith('https://images.pexels.com/') and str(page).startswith('https://www.pexels.com/')):
            continue
        # Search results are not proof that a photo depicts a named place or person.
        if not subject_matches(query,clean(photo.get('alt') or '')):
            continue
        photos.append({'thumb_url':img,'page_url':page,'source':'Pexels',
                       'creator':clean(photo.get('photographer') or ''),
                       'license':'Pexels License','description':clean(photo.get('alt') or query),
                       'query':query,'score':30})
    return photos


# A photo is only appropriate when a concrete, photographable entity is present
# in the actual headline. Do not turn broad concepts like "markets", "inflation",
# "stocks", "CPI", or a publisher's brand into a random street or store photo.
SPECIFIC_IMAGE_SUBJECTS = {
    'fed': 'Federal Reserve building Washington DC',
    'federal open market committee': 'Federal Reserve building Washington DC',
    'federal reserve': 'Federal Reserve building Washington DC',
    'fed chair': 'Federal Reserve building Washington DC',
    'jerome powell': 'Federal Reserve building Washington DC',
    'powell': 'Federal Reserve building Washington DC',
    'fomc': 'Federal Reserve building Washington DC',
    'white house': 'White House Washington DC',
    'supreme court': 'Supreme Court of the United States building',
    'congress': 'United States Capitol building',
    'senate': 'United States Capitol building',
    'house of representatives': 'United States Capitol building',
    'treasury department': 'United States Treasury building Washington DC',
    'securities and exchange commission': 'United States Securities and Exchange Commission building',
    'fda': 'Food and Drug Administration headquarters',
    'department of justice': 'United States Department of Justice building',
    'nvidia': 'Nvidia headquarters Santa Clara',
    'apple inc': 'Apple Park Cupertino',
    'microsoft': 'Microsoft headquarters Redmond',
    'tesla': 'Tesla factory',
    'amazon': 'Amazon headquarters Seattle',
    'openai': 'OpenAI office',
    'google': 'Google headquarters Mountain View',
    'meta platforms': 'Meta headquarters Menlo Park',
    'ukraine': 'Kyiv Ukraine skyline',
    'russia': 'Moscow Russia skyline',
    'china': 'Beijing China skyline',
    'taiwan': 'Taipei Taiwan skyline',
    'japan': 'Tokyo Japan skyline',
    'gaza': 'Gaza skyline',
    'israel': 'Jerusalem Israel skyline',
    'european union': 'European Union headquarters Brussels',
    'united nations': 'United Nations headquarters New York',
    'oil production': 'Oil pumpjack petroleum field',
}

def candidate_queries(row: dict) -> list[str]:
    title=' '.join(str(row.get('title','')).lower().split())
    # We don't turn "economy", "stock market" or publisher source into image queries.
    result=[]
    for phrase, query in SPECIFIC_IMAGE_SUBJECTS.items():
        if re.search(r'\b'+re.escape(phrase)+r'\b',title):
            if query not in result:
                result.append(query)
    return result[:2]

def image_is_safe(image: dict, allowed_queries: list[str]) -> bool:
    if not isinstance(image,dict) or not image.get('thumb_url') or not image.get('page_url'):
        return False
    if image.get('matched_query') not in allowed_queries:
        return False
    license_name=image.get('license','')
    if image.get('source')=='Wikimedia Commons':
        if not license_allowed(license_name):return False
        name=urllib.parse.unquote(image['page_url']).split('File:')[-1]
        preferred=CURATED_COMMONS_FILES.get(image['matched_query'])
        if preferred and name.replace('_',' ').lower()!=preferred.replace('File:','').lower():return False
        if not subject_matches(image['matched_query'],name,image.get('description','')):return False
    if image.get('source')=='Pexels' and license_name!='Pexels License':
        return False
    if image.get('source') not in ('Wikimedia Commons','Pexels'):
        return False
    return True

def match_image(item: dict, cache: dict, *, max_queries: int = 2) -> dict | None:
    """Use an explicit subject or no image at all; never imply this is an event photo."""
    for query in candidate_queries(item)[:max_queries]:
        if query not in cache:
            images = search_commons(query)
            if not images and PEXELS_KEY:
                images = search_pexels(query)
            cache[query] = images[:8]
        for result in cache.get(query) or []:
            if result and result.get('thumb_url') and result.get('page_url') and (result.get('source')=='Pexels' or subject_matches(query,result.get('title',''))):
                return {'thumb_url':result['thumb_url'],'page_url':result['page_url'],
                        'source':result.get('source','Wikimedia Commons'),
                        'creator':result.get('creator',''),
                        'license':result.get('license',''),
                        'description':result.get('description',''),
                        'label':'Illustrative photo','matched_query':query}
    return None

def attach_images(items: list[dict], featured: list[dict], previous: list[dict] | None = None) -> tuple[list[dict], int]:
    """Validate old images, then match strong entities; never reuse one image across stories."""
    for row in items:row.pop('image',None)
    previous_by_url={row.get('url'):row.get('image') for row in (previous or [])
                     if isinstance(row,dict) and row.get('image')}
    by_id={row.get('id'):row for row in items}
    targets=[];seen=set()
    for row in [*featured,*items]:
        key=row.get('id')
        if key in seen or key not in by_id:continue
        seen.add(key);targets.append(by_id[key])
        if len(targets)>=IMAGE_LIMIT:break
    # Image duplicates must favor the highest-ranked top stories.
    taken=set()
    for row in targets:
        allowed=candidate_queries(row)
        old=previous_by_url.get(row.get('url'))
        if image_is_safe(old,allowed):
            key=old['page_url']
            if key not in taken:
                row['image']=old;taken.add(key)
    needs=[row for row in targets if not row.get('image') and candidate_queries(row)][:MAX_NEW_LOOKUPS]
    # Resolve the independent requests in parallel. Assign results serially for uniqueness.
    cache={}
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        jobs=[(row,pool.submit(match_image,row,{},max_queries=1)) for row in needs]
        for row,future in jobs:
            try:photo=future.result()
            except Exception:photo=None
            if photo and image_is_safe(photo,candidate_queries(row)) and photo['page_url'] not in taken:
                row['image']=photo;taken.add(photo['page_url'])
    # Do not preserve stale mismatched images from prior feed versions.
    return items,sum(bool(row.get('image')) for row in targets)

def main() -> int:
    previous=[]
    if OUTPUT.exists():
        try:
            previous=json.loads(OUTPUT.read_text(encoding='utf-8')).get('items',[])
        except (ValueError,OSError):
            pass
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
    featured_ids={i['id'] for i in featured}
    items,image_count = attach_images(items, featured, previous)
    print('Image provider: Wikimedia Commons'+(' and Pexels' if PEXELS_KEY else ' (Pexels API key not configured)'))
    payload={'updated_at':now.isoformat(timespec='seconds'),
             'method':'Automated importance scoring and subject-specific commercial-license photo matching; not verified or manually approved',
             'sources_checked':len(FEEDS),'sources_ok':ok,
             'featured_ids':[r['id'] for r in featured],
             'image_policy':'Only keyword-specific, license-checked Wikimedia or Pexels illustrative photos with attribution. Otherwise branded art.',
             'items':items}
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(f'Wrote {len(items)} recent headlines, {len(featured)} featured story IDs, and {image_count} matched images to {OUTPUT}')
    return 0

if __name__=='__main__':
    raise SystemExit(main())
