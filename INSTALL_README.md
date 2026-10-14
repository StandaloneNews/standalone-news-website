# Standalone News — Expanded News Desk

This package expands the public headline feed and adds an **Outlet** selector to the Latest News Wire. It is based on the most recent SPY/QQQ TradingView cleanup layout. The Gemini publisher, its workflow, and your news databases do not need to be replaced.

## Install on GitHub

Repository: https://github.com/StandaloneNews/standalone-news-website

### A. Update RSS script (inside the `scripts` folder)

1. Open `https://github.com/StandaloneNews/standalone-news-website/blob/main/scripts/update_news.py`.
2. Click Edit (pencil icon). Replace its contents with the **`scripts/update_news.py`** included here, then commit to `main`.
3. Do NOT place an extra `update_news.py` in the root directory. It must be `scripts/update_news.py`.

### B. Update homepage files (repository root)

Upload/replace these FOUR files at the repository **root** (not inside `scripts`):
- `index.html`
- `newsroom.js`
- `newsroom.css`
- `markets-fix.js`

The markets file is the unchanged compatible version from the SPY/QQQ update. If you've customized market data since then, keep your newer `markets-fix.js` instead.

You can upload the four files through **Add file → Upload files**, commit to `main`.

### C. Refresh the headlines

Open the repository **Actions** tab and select the scheduled news-update workflow. Click **Run workflow** on branch `main`. Check the step named **Refresh public RSS headlines**. It logs reachable feeds and names of feeds that failed. A few unreachable feeds are normal: feeds can be removed or rate-limited by publishers.

After the job completes and commits its updated `data/news.json`, Cloudflare must deploy the new commit. Refresh `https://standalonenews.com/#wire` with Ctrl+Shift+R.

## What changes

- 49 publisher/agency RSS feeds or Google News discovery queries in total.
- Added a wider mix of publisher sources: BBC News, PBS News, CNBC, The Guardian, NPR, Deutsche Welle, Al Jazeera English, TechCrunch, The Verge, plus Reuters, AP, Bloomberg, CNN, ABC, CBS, NBC, Fox News, POLITICO, Axios, MarketWatch, Yahoo Finance, and The Hill via discovery feeds.
- The feed is capped at 180 headlines, with diversity rules so an individual publisher doesn't take over the page.
- Official Fed/BLS/DOJ/SEC/FDA/DEA sources remain eligible for the separate Gemini explainer publisher.
- The Latest News Wire gains a **news outlet** dropdown, and the header reports how many outlets are present in the current data.
- Existing market widgets, SPY/QQQ, 24-hour UTC timestamps, saved stories, the briefing, and AI explainers stay in place.

## Important

News discovery links from Google News sometimes go through a Google News redirect before opening a publisher. This setup displays headlines and links, not full syndicated articles. Publishers' feed terms vary, and you should review relevant permissions before using third-party feeds in a monetized product. The number of outlets available at any moment depends on how many feeds are reachable and have current headlines. This ZIP was syntax-tested and its feed processing was tested with local sample data; live fetching and Cloudflare deployment must still be verified.
