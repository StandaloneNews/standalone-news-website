# Standalone News — TradingView ticker cleanup + SPY / QQQ

**Install these 4 files to the main/root directory of your GitHub repo** `StandaloneNews/standalone-news-website`: `index.html`, `newsroom.css`, `newsroom.js`, and `markets-fix.js`. All are based on the most recent TradingView loading fix.

## What changed
- Added **SPY** (`AMEX:SPY`) and **QQQ** (`NASDAQ:QQQ`) to the top scrolling tape, right-side market snapshot, and dashboard watchlists.
- Removed direct **CME, CBOT and COMEX futures** symbols from embedded widgets where quote entitlements can be restricted. Their actual contract pages remain available as clearly labeled external links.
- Filled the freed spaces with widely followed, exchange-traded instruments: **DIA, IWM, GLD, SLV, USO**, and bond ETFs.
- Kept **indicative index, gold, and oil reference quotes**, plus **Treasury yields**, where possible. Availability can still vary by widget and license.
- **No ETF is presented as a future or as the dollar price per barrel/ounce**: Futures and Treasury tabs now explain the distinction.
- Preserved the responsive newsroom, headline feed, AI explainer feed and 24-hour UTC clocks.

## Caveats
There was no list of which exact TradingView symbols showed `denied` in your browser. This patch removes the most likely exchange-controlled contract embeds, but it cannot guarantee every remaining quote is permitted. TradingView says some exchange symbols are *only available on TradingView* and cannot be shown in third-party widgets; a premium subscription does not bypass that.

If a particular widget *still* says `denied`, send a screenshot with its exact symbol and we can remove/replace it specifically.

## Deploy
Upload the **files**, not the ZIP or containing folder: GitHub → repository main page → Add file → Upload files → Commit changes. Wait for Cloudflare to deploy and hard-refresh (`Ctrl+Shift+R`). No need to change any workflow, Gemini secrets or data JSON.

Documentation: https://www.tradingview.com/widget-docs/faq/data/
