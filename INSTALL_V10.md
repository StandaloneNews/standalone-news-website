# Standalone News — V10 mobile TradingView clipping repair

Based directly on the V9 website you already installed. **Only one file changed:** `newsroom.css`.

## Installation

1. Back up your existing root `newsroom.css` file from GitHub.
2. Replace **only** `newsroom.css` in the repository root with the included file.
3. Commit the replacement and let Cloudflare Pages deploy.
4. Open the site on your phone in a new private browser tab or clear the site's cache. Test both the stock-price row and the Markets section.

**Don't replace or delete** `index.html`, `newsroom.js`, `markets-fix.js`, `accounts.js`, `account-config.js`, workflows, or news data. **Do not rerun** either news workflow. This fix doesn't touch quotes, accounts, publishing or pictures.

## The cause

V8 had a mobile `.market-strip .strip-inner` CSS rule with `max-height: 54px !important` and `overflow:hidden`. V9 changed its `height` to `auto` without removing the `max-height`, causing the live quote widget (about 124 px total including its header) to be cut off. V10 removes that cap only for mobile. Desktop remains unchanged. This also keeps the market strip's outer clipping/isolation protection, so the old site-wide TradingView shadow fix isn't undone.

## Verification

The local 414px test shows the mobile market strip expanding from 55px (broken) to 125px (complete), with the inner quote viewport still set to 82px. No change is expected above 760px. Live TradingView content and its up/down colors depend on the vendor loading successfully on your phone, so verify on the deployed site.
