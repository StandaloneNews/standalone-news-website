#!/usr/bin/env python3
"""Generate the public, attributed news feed for Standalone News.

Free public RSS and Google News discovery sources. This does not copy article bodies,
verify claims, or access the private Standalone News editorial bot.
"""
from __future__ import annotations
import concurrent.futures
import datetime as dt
import email.utils
import html
import json
import re
import sys
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / "data" / "news.json"
RSS_OUT = ROOT / "feed.xml"
UTC = dt.timezone.utc


def google(query: str):
    return "https://news.google.com/rss/search?" + urllib.parse.urlencode({"q":query,"hl":"en-US","gl":"US","ceid":"US:en"})

# Public feeds. Publisher entries are headline/link-only; copyrighted story bodies
# are not copied into Standalone News. Discovery feeds link to the original outlet.
# The feed list can be extended without changing the public JSON schema.
SOURCES = [
    # Broad-topic discovery, providing coverage beyond any fixed outlet list.
    {"id":"us", "name":"U.S. headlines", "category":"US News", "kind":"Discovery", "url":google('(US news OR Washington OR US politics) when:2d')},
    {"id":"world", "name":"World headlines", "category":"World", "kind":"Discovery", "url":google('(international news OR world politics OR global events) when:2d')},
    {"id":"markets", "name":"Market headlines", "category":"Markets", "kind":"Discovery", "url":google('(Nasdaq OR S&P 500 OR Wall Street OR Dow Jones) when:2d')},
    {"id":"economy", "name":"U.S. economy", "category":"Economy", "kind":"Discovery", "url":google('(CPI OR inflation OR jobs report OR GDP OR Federal Reserve) when:2d')},
    {"id":"washington", "name":"Washington", "category":"Washington", "kind":"Discovery", "url":google('(White House OR Supreme Court OR Congress OR tariffs) when:2d')},

    # Direct publisher RSS feeds. Some publishers maintain several topic feeds.
    {"id":"bbc_top", "name":"BBC News", "category":"World", "kind":"Publisher RSS", "url":"https://feeds.bbci.co.uk/news/rss.xml"},
    {"id":"bbc_world", "name":"BBC News", "category":"World", "kind":"Publisher RSS", "url":"https://feeds.bbci.co.uk/news/world/rss.xml"},
    {"id":"bbc_business", "name":"BBC News", "category":"Economy", "kind":"Publisher RSS", "url":"https://feeds.bbci.co.uk/news/business/rss.xml"},
    {"id":"pbs_top", "name":"PBS News", "category":"US News", "kind":"Publisher RSS", "url":"https://www.pbs.org/newshour/feeds/rss/headlines"},
    {"id":"pbs_politics", "name":"PBS News", "category":"Government", "kind":"Publisher RSS", "url":"https://www.pbs.org/newshour/feeds/rss/politics"},
    {"id":"cnbc_top", "name":"CNBC", "category":"Markets", "kind":"Publisher RSS", "url":"https://www.cnbc.com/id/100003114/device/rss/rss.html"},
    {"id":"cnbc_business", "name":"CNBC", "category":"Economy", "kind":"Publisher RSS", "url":"https://www.cnbc.com/id/10001147/device/rss/rss.html"},
    {"id":"guardian_world", "name":"The Guardian", "category":"World", "kind":"Publisher RSS", "url":"https://www.theguardian.com/world/rss"},
    {"id":"guardian_us", "name":"The Guardian", "category":"US News", "kind":"Publisher RSS", "url":"https://www.theguardian.com/us/rss"},
    {"id":"guardian_business", "name":"The Guardian", "category":"Markets", "kind":"Publisher RSS", "url":"https://www.theguardian.com/us/business/rss"},
    {"id":"guardian_tech", "name":"The Guardian", "category":"Technology", "kind":"Publisher RSS", "url":"https://www.theguardian.com/technology/rss"},
    {"id":"aljazeera", "name":"Al Jazeera English", "category":"World", "kind":"Publisher RSS", "url":"https://www.aljazeera.com/xml/rss/all.xml"},
    {"id":"dw_top", "name":"Deutsche Welle", "category":"World", "kind":"Publisher RSS", "url":"https://rss.dw.com/rdf/rss-en-top"},
    {"id":"dw_business", "name":"Deutsche Welle", "category":"Economy", "kind":"Publisher RSS", "url":"https://rss.dw.com/rdf/rss-en-bus"},
    {"id":"npr_top", "name":"NPR", "category":"US News", "kind":"Publisher RSS", "url":"https://feeds.npr.org/1001/rss.xml"},
    {"id":"npr_world", "name":"NPR", "category":"World", "kind":"Publisher RSS", "url":"https://feeds.npr.org/1004/rss.xml"},
    {"id":"techcrunch", "name":"TechCrunch", "category":"Technology", "kind":"Publisher RSS", "url":"https://techcrunch.com/feed/"},
    {"id":"verge", "name":"The Verge", "category":"Technology", "kind":"Publisher RSS", "url":"https://www.theverge.com/rss/index.xml"},

    # Large outlets where their official public RSS is absent or unreliable:
    # Google News discoverability with ORIGINAL publisher attribution and links.
    {"id":"reuters", "name":"Reuters discovery", "category":"World", "kind":"Discovery", "url":google('site:reuters.com (world OR US OR politics OR markets) when:2d')},
    {"id":"ap", "name":"Associated Press discovery", "category":"US News", "kind":"Discovery", "url":google('site:apnews.com (US OR world OR breaking) when:2d')},
    {"id":"bloomberg", "name":"Bloomberg discovery", "category":"Markets", "kind":"Discovery", "url":google('site:bloomberg.com (markets OR business OR economy) when:2d')},
    {"id":"cnn", "name":"CNN discovery", "category":"US News", "kind":"Discovery", "url":google('site:cnn.com (US OR world OR politics) when:2d')},
    {"id":"cbs", "name":"CBS News discovery", "category":"US News", "kind":"Discovery", "url":google('site:cbsnews.com (US OR world OR breaking) when:2d')},
    {"id":"nbc", "name":"NBC News discovery", "category":"US News", "kind":"Discovery", "url":google('site:nbcnews.com (US OR world OR breaking) when:2d')},
    {"id":"abc", "name":"ABC News discovery", "category":"US News", "kind":"Discovery", "url":google('site:abcnews.go.com (US OR world OR breaking) when:2d')},
    {"id":"fox", "name":"Fox News discovery", "category":"US News", "kind":"Discovery", "url":google('site:foxnews.com (US OR world OR politics) when:2d')},
    {"id":"politico", "name":"POLITICO discovery", "category":"Government", "kind":"Discovery", "url":google('site:politico.com (Congress OR politics OR policy) when:2d')},
    {"id":"axios", "name":"Axios discovery", "category":"Government", "kind":"Discovery", "url":google('site:axios.com (politics OR policy OR economy) when:2d')},
    {"id":"thehill", "name":"The Hill discovery", "category":"Government", "kind":"Discovery", "url":google('site:thehill.com (Congress OR government OR policy) when:2d')},
    {"id":"marketwatch", "name":"MarketWatch discovery", "category":"Markets", "kind":"Discovery", "url":google('site:marketwatch.com (stocks OR bonds OR Fed OR markets) when:2d')},
    {"id":"yahoo_finance", "name":"Yahoo Finance discovery", "category":"Markets", "kind":"Discovery", "url":google('site:finance.yahoo.com/news (stocks OR earnings OR markets) when:2d')},

    # Original governmental primary-source updates; retained for the Gemini
    # explainer publisher, which uses source_type to select original documents.
    {"id":"fed", "name":"Federal Reserve", "category":"Fed", "kind":"Official direct", "url":"https://www.federalreserve.gov/feeds/press_all.xml"},
    {"id":"bls", "name":"Bureau of Labor Statistics", "category":"Economy", "kind":"Official direct", "url":"https://www.bls.gov/feed/bls_latest.rss"},
    {"id":"dea", "name":"Federal Register · DEA", "category":"DEA", "kind":"Official register", "url":"https://www.federalregister.gov/api/v1/documents.rss?conditions%5Bagencies%5D%5B%5D=drug-enforcement-administration"},
    {"id":"doj", "name":"Department of Justice", "category":"Government", "kind":"Official direct", "url":"https://www.justice.gov/news/rss?type=press_release&m=1"},
    {"id":"fda", "name":"Food and Drug Administration", "category":"FDA", "kind":"Official direct", "url":"https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml"},
    {"id":"sec", "name":"Securities and Exchange Commission", "category":"SEC", "kind":"Official direct", "url":"https://www.sec.gov/news/pressreleases.rss"},
    {"id":"dea_news", "name":"DEA newsroom discovery", "category":"DEA", "kind":"Discovery", "url":google('site:dea.gov (drug scheduling OR announcement OR enforcement) when:7d')},
    {"id":"treasury", "name":"Treasury discovery", "category":"Treasury", "kind":"Discovery", "url":google('site:home.treasury.gov/news/press-releases (OFAC OR sanctions OR Treasury) when:7d')},
    {"id":"whitehouse", "name":"White House discovery", "category":"Washington", "kind":"Discovery", "url":google('site:whitehouse.gov (executive order OR announcement) when:7d')},
    {"id":"state", "name":"State Department discovery", "category":"World", "kind":"Discovery", "url":google('site:state.gov (sanctions OR statement OR diplomacy) when:7d')},
    {"id":"cftc", "name":"CFTC discovery", "category":"Government", "kind":"Discovery", "url":google('site:cftc.gov/PressRoom (regulation OR enforcement) when:7d')},
    {"id":"ftc", "name":"FTC discovery", "category":"Government", "kind":"Discovery", "url":google('site:ftc.gov/news-events/news/press-releases when:7d')},
    {"id":"dhs", "name":"DHS discovery", "category":"Government", "kind":"Discovery", "url":google('site:dhs.gov/news (security OR border OR cyber) when:7d')},
]



def local(tag: str):
    return tag.rsplit('}', 1)[-1].lower()


def child_text(node, name):
    for item in node:
        if local(item.tag) == name:
            return ''.join(item.itertext()).strip()
    return ''


def plain(value: str, limit: int=240):
    return html.unescape(re.sub(r'\s+', ' ', re.sub('<[^>]*>', ' ', value or ''))).strip()[:limit]


def parse_date(raw: str, fallback: dt.datetime):
    try:
        t = email.utils.parsedate_to_datetime(raw)
    except (TypeError, ValueError):
        try:
            t = dt.datetime.fromisoformat(raw.replace('Z','+00:00'))
        except (ValueError, AttributeError):
            return fallback
    if t.tzinfo is None: t=t.replace(tzinfo=UTC)
    return t.astimezone(UTC)


def valid_url(link: str):
    parts=urllib.parse.urlsplit(link)
    return parts.scheme in ('http','https') and bool(parts.netloc) and not parts.username



# Adapted from the desktop bot's headline-priority rules. This is an automatic
# editorial *sorting heuristic*, not a factual verification or human review.
IMPACT_TERMS = (
    (r'\b(fomc|fed chair|interest rate|rate cut|rate hike|monetary policy)\b', 23),
    (r'\b(inflation|cpi|pce|jobs report|unemployment|payrolls|gdp)\b', 19),
    (r'\b(war|ceasefire|invasion|election|supreme court|sanctions|tariff)\b', 16),
    (r'\b(earnings|merger|acquisition|bankruptcy|profit warning|guidance)\b', 13),
    (r'\b(s&p 500|nasdaq|dow jones|stocks|treasury yields|oil prices)\b', 11),
)
ROUTINE_TERMS = (
    r'minutes of the board.s discount rate meetings',
    r'approval of application by',
    r'\bdecision and order\b',
    r'\bnotice of proposed (rulemaking|collection)\b',
    r'\brequest for comments\b',
    r'\binformation collection\b',
    r'\bcorrection to\b',
)

def desk_priority(title: str, category: str, source_type: str) -> int:
    base = {'Markets':34, 'Fed':32, 'Economy':35, 'World':34,
            'US News':32, 'Technology':30, 'Washington':31,
            'Government':29, 'SEC':28, 'Treasury':29,
            'FDA':27, 'DEA':27}.get(category, 28)
    if source_type == 'Publisher RSS': base += 3
    if source_type.startswith('Official'): base += 2
    for pattern, points in IMPACT_TERMS:
        if re.search(pattern, title, re.I): base += points
    if any(re.search(p, title, re.I) for p in ROUTINE_TERMS): base -= 34
    if len(title) > 150: base -= 8
    return max(1, min(100, base))


def parse_rss(xml: bytes, feed: dict, now: dt.datetime):
    if b'<!DOCTYPE' in xml.upper() or b'<!ENTITY' in xml.upper():
        raise ValueError('Invalid external XML entity')
    root=ET.fromstring(xml)
    out=[]
    for node in root.iter():
        if local(node.tag) not in ('item','entry'): continue
        title=plain(child_text(node,'title'),230)
        link=child_text(node,'link')
        if not link:
            for ch in node:
                if local(ch.tag)=='link' and ch.attrib.get('rel','alternate')=='alternate':
                    link=ch.attrib.get('href','')
                    if link: break
        if not title or not valid_url(link):continue
        source=feed['name']
        if feed['kind']=='Discovery':
            # Google News supplies an actual publisher label in the source child.
            hint=plain(child_text(node,'source'),60)
            if hint: source=hint
            elif ' - ' in title: title,source=title.rsplit(' - ',1)
        published=parse_date(child_text(node,'pubDate') or child_text(node,'published') or child_text(node,'updated'),now)
        if published>now+dt.timedelta(days=1) or published<now-dt.timedelta(days=7):continue
        # Show short attributed excerpts when the original publisher provides them.
        # Google News discovery descriptions can be nested lists of related stories,
        # so do not turn those into an alleged summary of the linked article.
        excerpt = ''
        if feed['kind'] != 'Discovery':
            excerpt = plain(child_text(node,'description') or child_text(node,'summary'), 200)
            if excerpt.casefold() == title.casefold() or len(excerpt) < 35:
                excerpt = ''
        importance = desk_priority(title, feed['category'], feed['kind'])
        out.append({
            'title':title,'url':link,'source':source,'category':feed['category'],
            'source_type':feed['kind'],'summary':excerpt, 'desk_priority': importance,
            'published_at':published.isoformat(timespec='seconds').replace('+00:00','Z'),
            'id':__import__('hashlib').sha256(link.encode('utf-8')).hexdigest()[:20]
        })
        if len(out)>=12:break
    return out


def fetch(feed: dict, now: dt.datetime):
    request=urllib.request.Request(feed['url'],headers={'User-Agent':'Mozilla/5.0 (compatible; StandaloneNewsRSS/1.0; +https://standalonenews.com/)','Accept':'application/rss+xml, application/atom+xml, application/xml, text/xml, */*'})
    with urllib.request.urlopen(request,timeout=12) as resp:
        xml=resp.read(1_500_000)
    return parse_rss(xml,feed,now)


def build_feed(items,updated):
    import xml.sax.saxutils as sx
    u= lambda x:sx.escape(str(x), {'"':'&quot;'})
    lines=['<?xml version="1.0" encoding="utf-8"?>','<rss version="2.0"><channel>',
      '<title>Standalone News — Latest Headlines</title>',
      '<link>https://standalonenews.com/</link>',
      '<description>Attributed news headlines with links to their reporting sources</description>',
      '<language>en-us</language>',
      f'<lastBuildDate>{email.utils.format_datetime(updated)}</lastBuildDate>']
    for a in items[:50]:
        pub=email.utils.format_datetime(dt.datetime.fromisoformat(a['published_at'].replace('Z','+00:00')))
        lines+=['<item>',f'<title>{u(a["title"])}</title>',f'<link>{u(a["url"])}</link>',
           f'<guid isPermaLink="false">{u(a["id"])}</guid>',f'<pubDate>{pub}</pubDate>',
           f'<description>{u("Source: "+a["source"]+" · "+a["category"])}</description>','</item>']
    lines+=['</channel></rss>']
    RSS_OUT.write_text('\n'.join(lines)+'\n',encoding='utf8')


def main():
    now=dt.datetime.now(UTC)
    stories=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        future_to_feed={pool.submit(fetch,feed,now):feed for feed in SOURCES}
        success=0
        for f in concurrent.futures.as_completed(future_to_feed):
            feed=future_to_feed[f]
            try:
                got=f.result();stories.extend(got);success+=1
                print(f'{feed["id"]}: {len(got)} headlines')
            except Exception as e:
                print(f'{feed["id"]}: skipped ({type(e).__name__}: {e})',file=sys.stderr)
    if not stories:
        print('No stories fetched. Keeping previous feed unchanged.',file=sys.stderr)
        return 1
    stories.sort(key=lambda x:x['published_at'],reverse=True)

    # Deduplicate same story across multiple feeds / repeated topic RSS feeds.
    clean=[]; seen_urls=set(); seen_titles=set()
    for story in stories:
        title_key=re.sub(r'\W+', ' ', story['title'].lower()).strip()
        if story['url'] in seen_urls or title_key in seen_titles: continue
        seen_urls.add(story['url']);seen_titles.add(title_key);clean.append(story)

    # Reserve enough original government releases for the independent explainer
    # bot before filling the frontpage with publisher headlines.
    selected=[]; selected_ids=set(); outlet_counts={}; category_counts={}
    def add(story, reserve=False):
        if story['id'] in selected_ids:return False
        src=story['source'].strip().casefold()
        if not reserve and (outlet_counts.get(src,0)>=9 or category_counts.get(story['category'],0)>=55):return False
        selected.append(story);selected_ids.add(story['id'])
        outlet_counts[src]=outlet_counts.get(src,0)+1
        category_counts[story['category']]=category_counts.get(story['category'],0)+1
        return True

    government_seen={}
    for story in clean:
        if story['source_type'] not in ('Official direct','Official register'):continue
        src=story['source'];n=government_seen.get(src,0)
        if n<5 and sum(government_seen.values())<28:
            if add(story,reserve=True): government_seen[src]=n+1

    # First give each available publisher room to appear, even if many recent
    # stories came from the same category. Then fill by freshness up to quotas.
    for story in clean:
        if len(selected)>=180:break
        if outlet_counts.get(story['source'].strip().casefold(),0)<2:
            add(story,reserve=True)

    for story in clean:
        if len(selected)>=180:break
        add(story)
    selected.sort(key=lambda x:x['published_at'],reverse=True)
    payload={'site':'Standalone News','updated_at':now.isoformat(timespec='seconds').replace('+00:00','Z'), 'items':selected}
    TARGET.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    build_feed(selected,now)
    print(f'Updated {TARGET.name}: {len(selected)} headlines from {len(outlet_counts)} named sources; {success}/{len(SOURCES)} feeds reachable; {sum(st["source_type"] in ("Official direct","Official register") for st in selected)} official-source entries.')
    return 0

if __name__=='__main__': sys.exit(main())
