#!/usr/bin/env python3
"""Export only ALREADY POSTED editorial drafts from the private local bot DB.

No secrets, private drafts, approval queue, analytics, or credentials are exported.
Usage: python scripts/export_bot_posts.py --db "C:/.../standalonenews.db"
"""
import argparse
import datetime as dt
import json
import re
import sqlite3
from pathlib import Path
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[1]


def build(dbpath):
    con=sqlite3.connect(f'file:{dbpath}?mode=ro',uri=True)
    con.row_factory=sqlite3.Row
    try:
        rows=con.execute("SELECT * FROM articles WHERE status='posted' ORDER BY published_at DESC LIMIT 100").fetchall()
    finally:con.close()
    out=[]
    for row in rows:
        story=dict(row)
        url=(story.get('url') or '').strip()
        parsed=urlsplit(url)
        if parsed.scheme not in ('https','http') or not parsed.hostname:continue
        title=re.sub(r'\s+',' ',(story.get('draft') or story.get('title') or '').strip())
        if not title:continue
        out.append({'id':story.get('id'),'title':title[:250],'url':url,'source':story.get('source') or 'Original publisher',
                    'source_type':'Editorial / previously posted on X','category':story.get('category') or 'US News',
                    'summary':'','published_at':story.get('published_at') or dt.datetime.now(dt.timezone.utc).isoformat()})
    return out


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--db',required=True,help='Path to the local Standalone News bot SQLite database')
    ap.add_argument('--output',default=str(ROOT/'data/editorial.json'))
    args=ap.parse_args()
    entries=build(args.db)
    Path(args.output).write_text(json.dumps({'site':'Standalone News','items':entries},indent=2,ensure_ascii=False)+'\n',encoding='utf8')
    print('Exported',len(entries),'posted stories. No unposted drafts or secrets were exported.')

if __name__=='__main__':main()
