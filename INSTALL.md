# Standalone News V6 — Dark overlay isolation

This patch addresses the broad gray-to-black rectangle reported on the live website. Offline rendering of the website without external market scripts does **not** reproduce the issue, so the exact live-page cause is not established. The patch isolates TradingView widgets and offers a diagnostic safe mode.

## How to deploy

**Back up your live repository first.** Replace only these root files in your GitHub repository:

- `index.html`
- `newsroom.css`
- `newsroom.js` (unchanged from V5, included for a consistent bundle)

Add these new root files:

- `market-isolator.js`
- `market-embed.html`

**Do not replace** `accounts.js`, `account-config.js`, `saved_articles.sql`, `markets-fix.js`, `.github/workflows/refresh-headlines.yml`, or any Gemini/article workflows. `markets-fix.js` can remain in the repository: V6 does **not load it** because the market quotes are now sandboxed.

Your current `data/desk.json` image matches and all existing image-publishing actions remain unaffected. Do not replace any RSS or image scripts for this bugfix.

After commit and Cloudflare deployment, hard refresh `https://standalonenews.com/` with Ctrl+Shift+R. Open in Incognito with extensions disabled if the shadow persists.

## Isolate the problem in one URL

Open: `https://standalonenews.com/?safe=1`

In this diagnostic mode the home page does not load ANY TradingView widgets; it provides source links instead. If the black band vanishes in safe mode but appears normally, the market embed is strongly implicated. If it remains in both modes, inspect a browser extension or another page element.

## What changes

- The top market ticker now loads from a small, sandboxed `market-embed.html` inside an iframe, preventing market-provider CSS and DOM from affecting the parent page.
- The Markets screen also loads its selected quote panels inside isolated iframes, only when the section is viewed. This should reduce interference and initial page load work.
- The rest of the website, including Supabase login, saved articles, news feed, 24-hour UTC times, and Gemini articles, is unchanged.
- Market quotes still come from TradingView. This is **not** guaranteed live exchange data; delay and access limitations depend on the provider. If sandbox restrictions prevent a quote embed from loading, use the TradingView link.

## Verify

1. Normal page: black shadow should be absent; check ticker and Markets quotes.
2. `/?safe=1`: black shadow should be absent and quotes replaced by links.
3. Sign In, Saved, 5-story brief, image credits, mobile bottom navigation.
4. Cloudflare cache clear/hard refresh if still running old JS/CSS.

## Testing

HTML/CSS and JavaScript syntax were checked offline. Browser rendering was checked with the external market scripts removed; production behavior depends on TradingView, Cloudflare, and the visitor's browser/extensions.
