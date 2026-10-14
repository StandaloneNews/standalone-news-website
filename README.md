# Standalone News — TradingView quote display fix

Upload these **four files to the GitHub repository ROOT** (not a folder):

- `index.html`
- `newsroom.css`
- `newsroom.js` (unchanged from the previous editorial redesign)
- `markets-fix.js` (new)

Do not edit scripts/auto_publish.py, data/news.json, data/articles.json, GitHub Actions or Cloudflare.

Changes:
1. TradingView legacy iframe widgets replace the new web components.
2. The large Markets dashboard loads each tab only after it becomes visible (avoids invisible-tab sizing failures).
3. Adds links to TradingView and a **Retry widget** button if the external script is blocked.
4. Restores the top stock-market tape, market snapshot, and stock/futures/commodities/Treasury/bond ETF sections.
5. Keeps current 24-hour UTC timestamp formatting, news, article publishing and existing layout.

**Limitations:** TradingView is a third-party service. A browser extension, restricted network, tracking protection or Content-Security-Policy may still block it. Delays and instruments vary by exchange. This fix cannot guarantee real-time market data.

If still not loading: open the site in an Incognito/InPrivate window with extensions off, hard refresh (Ctrl+Shift+R), then use F12 → Console/Network to inspect blocked TradingView requests. Report the exact error.
