# Standalone News — Reader-first homepage redesign

## What it changes

This is a **frontend-only homepage redesign** based on the current editorial News Desk version.

It updates desktop and mobile layout, cuts the lead story to a readable height, organizes homepage headlines by priority and outlet variety, adds an offline-friendly market-ticker fallback (symbol labels, **not prices**), and keeps the 5-Story Brief, saved stories, AI explainers, and market panels.

## Installation

1. Back up the current GitHub repository main-branch versions of `index.html`, `newsroom.css`, `newsroom.js`, and `markets-fix.js` (or note a commit hash to revert).
2. In the repository https://github.com/StandaloneNews/standalone-news-website, place the four files from this package in the repository **root directory**, replacing files of the same names.
3. Commit to `main` and wait for Cloudflare to redeploy if the GitHub integration is connected.
4. Hard-refresh https://standalonenews.com/ and inspect the mobile layout, source links, and TradingView quote embeds.
5. To revert the design, restore the four files from the prior GitHub commit.

## Do not replace

Keep your existing `data/news.json`, `data/articles.json`, `articles/` pages, `scripts/update_news.py`, `scripts/auto_publish.py`, `.github/workflows/`, and `assets/` files unchanged.

## Source and claims policy

- The homepage uses the **existing** live JSON feeds. It does not generate new news claims.
- All outside stories link to the originating publisher; any excerpts must come from that feed.
- The feed's automatic scoring is a heuristic, not a human editorial judgment or verification.
- AI-written explainers are separately labeled and not human-reviewed.
- Market quotes are TradingView embeds; actual prices may be delayed or blocked. The fallback strip shows ticker names only, with **no fabricated prices**.
- Official quotes/yields and futures contracts are not represented by ETF proxy prices; market panel disclosures remain intact.
- All displayed times use 24-hour UTC.

## Testing

I ran isolated Chromium tests against demonstration data at 390px, 768px and 1440px widths, including source-feed rendering, navigation, save/read-list controls, briefing topic preferences, filtering/search, and market-panel tabs. No JavaScript page errors or page-level horizontal overflow were detected. TradingView live quotes were intentionally not loaded in these browser tests, and live GitHub/Cloudflare deployment remains unverified.

## Files

- `index.html`
- `newsroom.css`
- `newsroom.js`
- `markets-fix.js`
