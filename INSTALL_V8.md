# Standalone News — Reader V8 mobile repair

This update is based directly on the working **V7** frontend. The screenshot from an iPhone showed a cramped, overlapping TradingView ticker tape and awkward mobile reading layout. V8 replaces the fragile tape **on phones only** with a horizontal row of market quote shortcuts. The full TradingView market widgets in the Markets section and the desktop ticker are left unchanged.

## Upload only these files to GitHub repository root

1. Back up the currently working `index.html`, `newsroom.css`, and `newsroom.js` or note the GitHub commit SHA for easy rollback.
2. Replace the root `index.html`, `newsroom.css`, and `newsroom.js` with the three files from the ZIP.
3. Commit. Wait for the normal Cloudflare Pages deployment; no GitHub news workflow run is needed.
4. Refresh the page on iPhone. Check at least the main page, Markets tab, Sign In, and Saved.

**Do not replace or delete** `markets-fix.js`, `account-config.js`, `accounts.js`, `data/`, `.github/workflows/`, your feed-publishing scripts, `saved_articles.sql`, or the article pages.

## What changed

- Under 761px screen width, hides the narrow embedded TradingView ticker **in the top strip**, where third-party branding and prices were overlapping in the screenshot.
- Adds accessible, horizontally scrollable SPY / QQQ / NVDA / TSLA quote shortcuts to TradingView and a `Full quotes` shortcut to the existing Markets section. **These shortcuts intentionally do not display numbers**, to avoid invented or stale prices. The Markets tab retains its embedded quotes, and the desktop ticker continues as in V7.
- Constrains mobile page containers to the viewport so the design does not extend horizontally in common phone sizes.
- Slightly reduces mobile hero headline and photo height for readability.
- Removes RSS summaries that only repeat the headline; preserves real story descriptions.
- Changes **no** Supabase, account, bookmarking, news-fetching, priority-ranking, image licensing or publishing logic.

## Verification and limitations

- Tested JavaScript syntax with `node --check`.
- Static mobile rendering tested locally at 320, 375, 390, 430, and 760 CSS pixels and 1280px desktop. No page-level horizontal overflow observed in those tests.
- Images, live TradingView feeds, Cloudflare deployment, Safari/iPhone-specific pinch zoom behavior and Supabase sign-in cannot be verified from offline simulation. If the site appears narrower than the device after this update, test in a fresh tab and reset browser zoom. Send a screenshot if it continues.

## Rollback

Restore the previous GitHub versions of just `index.html`, `newsroom.css`, and `newsroom.js` (V7). Other files are unaffected.
