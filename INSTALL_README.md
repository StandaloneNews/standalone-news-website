# Standalone News — Mobile ticker + footer repair (14 October 2026)

## What this fixes
- Mobile TradingView ticker price/change line no longer intentionally crops at a 52px frame height. The market strip is taller, with an 84px mobile iframe and full-width quote area.
- Removes TradingView's denied Treasury yield widgets from the ticker strip, Market Pulse, and Treasuries tab. No `TVC:US02Y`, `TVC:US05Y`, `TVC:US10Y`, `TVC:US30Y`, or `VIX` symbols remain in this package.
- Removes potentially restricted CFD references from the market lists, prioritizing popular ETF/stocks such as SPY, QQQ, DIA, IWM, NVDA, AAPL, GLD, USO and bond ETFs.
- Keeps a clearly labeled bond ETF tab (TLT, IEF, SHY, BND) and includes an official U.S. Treasury yield-table link; these are **not** the same as Treasury bond prices or yields.
- Removes the two RSS links from the site footer. On iPhone, the raw XML that opens from those links is technically normal, but confusing. The RSS feeds and `<link rel=alternate>` discovery metadata remain available for readers and bots.
- Cache-busting query strings updated, so browsers should load the new CSS and JS.

## Install
1. Download the ZIP, extract files.
2. In https://github.com/StandaloneNews/standalone-news-website, upload **index.html**, **newsroom.css**, **newsroom.js**, **markets-fix.js** directly to the repository ROOT (replace existing).
3. Commit to main and wait for Cloudflare's deployment.
4. On mobile, close/reopen the Safari tab or clear website data if the old display is cached. Desktop can use Ctrl+Shift+R.
5. Check the top market tape and the Markets section, then test footer links. RSS is still available at `/feed.xml` and `/articles/feed.xml` for subscribers, but these aren't meant to be browsed directly on iPhone.

## Caveats
- TradingView is a third-party embed: its layout, market access and iframe availability cannot be guaranteed. This patch fixes our site's CSS container sizing and removes the symbols you reported, but must be verified on your live phone.
- No website edits have been made on GitHub or Cloudflare. No change to AI authoring, RSS collection, or X bot.
