# Standalone News — V9 headline actions + mobile price colors

Built from the working V8 homepage. This is a **frontend-only** update.

## What is fixed

1. **Cut-off buttons on desktop:** The lead story formerly had a fixed `height: 435px` with `overflow: hidden`. A sufficiently long headline pushed the Save and Read coverage buttons past the bottom of the card. V9 uses a content-sized lead card while retaining the desktop split photo layout.
2. **Mobile market colors:** V8 replaced the small-screen ticker with static links (SPY ↗, QQQ ↗, etc.). Those arrows weren't price movements. V9 restores a real TradingView ticker for mobile, explicitly using **regular layout** in a contained horizontal market row. TradingView controls the price, daily change and up/down colors; V9 does not invent quote data. Swipe the quote strip to browse; use Full markets to open the existing detailed TradingView tab.
3. **No page-wide overflow:** The mobile market iframe is constrained to its own horizontally scrollable viewport.

## Installation

Back up the current root files first. Upload and replace **only these three** files in your existing GitHub website repository:

- `index.html`
- `newsroom.css`
- `newsroom.js`

Commit, wait for Cloudflare Pages to deploy, and reload the site on desktop and mobile (hard refresh / private window to avoid cached HTML).

**Do NOT replace or remove** `markets-fix.js`, `accounts.js`, `account-config.js`, `saved_articles.sql`, any `data/*.json` feeds, `.github/workflows/*` or article files. The ZIP intentionally contains no credentials or live feed data.

No GitHub news workflow rerun is needed for this CSS/JS fix.

## After deployment, verify

1. Desktop lead: a long headline should not hide either Save or Read coverage.
2. Mobile: scrolling market prices have current quote changes (green when positive, red when negative) **if TradingView loads and provides data**. Prices can be delayed, unavailable when blocked, or unchanged when markets are closed.
3. Top markets row is swipeable; tapping Full markets shows your existing market widgets.
4. Sign In, Saved and article links still work.
5. No reappearance of the former dark shadow. If it reappears, temporarily revert these three frontend files and send a screenshot.

## Testing limits

Tested locally in headless Chromium at 320, 375, 390, 430, 761, 950, 1180, 1440 and 1650 px with a deliberately long headline. No horizontal page overflow, and lead action buttons remained inside their story card at every tested width. JavaScript syntax passed. **A live TradingView feed could not be tested in the restricted browser environment**, so verify the actual price colors after deployment.
