# Standalone News — Reader V2 mobile layout refinement

This is a targeted **frontend** update made from the `Standalone_News_Mobile_Reader_Accounts_Upgrade(1).zip` you uploaded. It does **not** change the bot, `saved_articles.sql`, Supabase authentication, news feeds, publishing scripts, or market data provider.

## What changed

- Market ticker has a normal **single-row 48–50px embedded height** on phones rather than an 80–86px frame that can overlap labels and quotes.
- Fallback placeholder labels are hidden once the embedded ticker is loaded.
- Removed duplicate horizontal **top navigation on mobile**: the existing fixed bottom tabs remain; smaller quick-jump chips provide Desk Picks / Brief / Explainers / Latest.
- Reduced headline size, removed mid-word hyphenation, improved card padding, source labels, touch targets, mobile spacing, and section headings.
- Renamed automatically scored headlines to **Desk picks**. These are still automatically scored from the website news feed; they are *not* identical to the desktop bot's approved stories.
- 24-hour UTC time, bookmarks, sign-in elements, saved stories, and all existing news and AI explainer feeds remain in place.

## GitHub deployment

1. **Back up or download your current GitHub files first**, especially if you have edited them after installing the original Reader Accounts ZIP.
2. In the **root** of `StandaloneNews/standalone-news-website`, replace exactly these files:
   - `index.html`
   - `newsroom.css`
   - `newsroom.js` (unchanged logic; only cache-busted version in `index.html`)
3. Commit. Wait for Cloudflare Pages to deploy, then refresh the site on your phone.
4. Verify the headline feed, stock tape, brief, saved stories, and Sign In all work.
5. Do **not** upload this file set if your current deployed page has a different auth or markup implementation than your uploaded ZIP; merge the CSS changes instead.

## Important — protect working account setup

**Do not replace your live `account-config.js` or `accounts.js`.** This ZIP intentionally contains neither. Keep your existing publishable key / correct Supabase project URL in your current live config. Never put a Supabase secret, service-role key, SMTP secret, or password in public GitHub files.

## Desktop news bot integration (not part of this update)

The desktop bot was previously described as having 54 feed configurations, priority scoring, deduplication, an Ollama drafting path, and an approval queue for X posting. This website still uses its *separate* RSS/GitHub automation and Gemini article pipeline. To publish **bot-selected** stories on the website, inspect and adapt the *actual desktop bot code* (especially `engine.py`, its feed configuration, and its database/export format), then add a deliberate, source-linked publishing/export step. Don't infer an approved story from the site's keyword score, and don't copy other publishers' full articles.

## Testing status

JS passed `node --check`; the files were inspected for the expected original DOM IDs. Full browser render against live Cloudflare/Supabase/TradingView has **not** been verified here. Test your live phone and desktop after deployment.
