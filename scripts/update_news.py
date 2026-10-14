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

SOURCES = [
    {"id":"us", "name":"U.S. headlines", "category":"US News", "kind":"Discovery", "url":google('("United States" OR "US politics" OR "Washington") (breaking OR latest OR policy) when:2d')},
    {"id":"world", "name":"World headlines", "category":"World", "kind":"Discovery", "url":google('(world news OR geopolitics OR international OR diplomatic) when:2d')},
    {"id":"markets", "name":"Market headlines", "category":"Markets", "kind":"Discovery", "url":google('(Nasdaq OR "S&P 500" OR Wall Street OR stock market) when:2d')},
    {"id":"economy", "name":"U.S. economy", "category":"Economy", "kind":"Discovery", "url":google('(CPI OR inflation OR jobs report OR GDP OR Federal Reserve) when:2d')},
    {"id":"washington", "name":"Washington", "category":"Washington", "kind":"Discovery", "url":google('(White House OR Supreme Court OR Congress OR tariffs) when:2d')},
    {"id":"bloomberg", "name":"Bloomberg discovery", "category":"Markets", "kind":"Discovery", "url":google('site:bloomberg.com (markets OR US economy OR stocks) when:2d')},
    {"id":"reuters", "name":"Reuters discovery", "category":"World", "kind":"Discovery", "url":google('site:reuters.com (world OR US OR politics) when:2d')},
    {"id":"ap", "name":"AP discovery", "category":"US News", "kind":"Discovery", "url":google('site:apnews.com (US OR world OR breaking) when:2d')},
    {"id":"fed", "name":"Federal Reserve", "category":"Fed", "kind":"Official direct", "url":"https://www.federalreserve.gov/feeds/press_all.xml"},
    {"id":"bls", "name":"Bureau of Labor Statistics", "category":"Economy", "kind":"Official direct", "url":"https://www.bls.gov/feed/bls_latest.rss"},
    {"id":"dea", "name":"Federal Register · DEA", "category":"DEA", "kind":"Official register", "url":"https://www.federalregister.gov/api/v1/documents.rss?conditions%5Bagencies%5D%5B%5D=drug-enforcement-administration"},
    {"id":"dea_news", "name":"DEA newsroom discovery", "category":"DEA", "kind":"Discovery", "url":google('site:dea.gov (drug scheduling OR announces OR enforcement OR press release) when:7d')},
    {"id":"doj", "name":"Department of Justice", "category":"Government", "kind":"Official direct", "url":"https://www.justice.gov/news/rss?type=press_release&m=1"},
    {"id":"fda", "name":"Food and Drug Administration", "category":"FDA", "kind":"Official direct", "url":"https://www.fda.gov/about-fda/contact-fda/stay-informed/rss-feeds/press-releases/rss.xml"},
    {"id":"sec", "name":"Securities and Exchange Commission", "category":"SEC", "kind":"Official direct", "url":"https://www.sec.gov/news/pressreleases.rss"},
    {"id":"treasury", "name":"Treasury & sanctions", "category":"Treasury", "kind":"Discovery", "url":google('site:home.treasury.gov/news/press-releases (OFAC OR sanctions OR Treasury) when:7d')},
    {"id":"whitehouse", "name":"White House", "category":"Washington", "kind":"Discovery", "url":google('site:whitehouse.gov (executive order OR announcement OR presidential action) when:7d')},
    {"id":"state", "name":"State Department", "category":"World", "kind":"Discovery", "url":google('site:state.gov (sanctions OR statement OR diplomacy) when:7d')},
    {"id":"cftc", "name":"CFTC", "category":"Government", "kind":"Discovery", "url":google('site:cftc.gov/PressRoom (crypto OR regulation OR enforcement) when:7d')},
    {"id":"ftc", "name":"FTC", "category":"Government", "kind":"Discovery", "url":google('site:ftc.gov/news-events/news/press-releases when:7d')},
    {"id":"dhs", "name":"DHS", "category":"Government", "kind":"Discovery", "url":google('site:dhs.gov/news (security OR border OR cyber) when:7d')},
    {"id":"npr", "name":"NPR top stories", "category":"US News", "kind":"Publisher RSS", "url":"https://feeds.npr.org/1001/rss.xml"},
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
                    break
        if not title or not valid_url(link):continue
        source=feed['name']
        if feed['kind']=='Discovery':
            # Google News supplies an actual publisher label in the source child.
            hint=plain(child_text(node,'source'),60)
            if hint: source=hint
            elif ' - ' in title: title,source=title.rsplit(' - ',1)
        published=parse_date(child_text(node,'pubDate') or child_text(node,'published') or child_text(node,'updated'),now)
        if published>now+dt.timedelta(days=1) or published<now-dt.timedelta(days=7):continue
        excerpt=plain(child_text(node,'description') or child_text(node,'summary'),180) if feed['kind'].startswith('Official') else ''
        out.append({
            'title':title,'url':link,'source':source,'category':feed['category'],
            'source_type':feed['kind'],'summary':excerpt,
            'published_at':published.isoformat(timespec='seconds').replace('+00:00','Z'),
            'id':__import__('hashlib').sha256(link.encode('utf-8')).hexdigest()[:20]
        })
        if len(out)>=12:break
    return out


def fetch(feed: dict, now: dt.datetime):
    request=urllib.request.Request(feed['url'],headers={'User-Agent':'StandaloneNewsFeed/1.0 (public RSS news linking; contact website owner)','Accept':'application/rss+xml, application/atom+xml, application/xml, text/xml'})
    with urllib.request.urlopen(request,timeout=16) as resp:
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
    seen_urls=set();seen_titles=set();category_counts={};selected=[]
    for story in stories:
        norm=re.sub(r'\W+',' ',story['title'].lower()).strip()
        if story['url'] in seen_urls or norm in seen_titles:continue
        if category_counts.get(story['category'],0)>=22:continue
        selected.append(story);seen_urls.add(story['url']);seen_titles.add(norm)
        category_counts[story['category']]=category_counts.get(story['category'],0)+1
        if len(selected)>=120: break
    payload={'site':'Standalone News','updated_at':now.isoformat(timespec='seconds').replace('+00:00','Z'), 'items':selected}
    TARGET.write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n',encoding='utf8')
    build_feed(selected,now)
    print(f'Updated {TARGET.name}: {len(selected)} headlines, {success}/{len(SOURCES)} sources reachable.')
    return 0

if __name__=='__main__': sys.exit(main())
