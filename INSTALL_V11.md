# Standalone News V11 — Remove the mobile ticker gap

This is a **CSS-only** update based on the V10 file you last installed.

## Install

1. Back up the current root `newsroom.css` in GitHub.
2. Replace **only** root `newsroom.css` with the included file.
3. Commit and wait for Cloudflare Pages to finish deploying.
4. Reload the site on the iPhone (use a private tab or clear cached website data if needed).

Do not change `index.html`, `newsroom.js`, `markets-fix.js`, Supabase files, or GitHub Actions workflows. No publishing workflow runs are required.

## Why this works

V10 correctly removed the old 54px cap around the entire market strip. But the actual horizontally scrollable quote window was still **82px tall**, even though TradingView's visible price/change text sits at the top. That makes a large empty strip under the quotes.

V11 reduces **only the visible mobile quote window** to **50px**, retaining the existing **82px inner TradingView frame** so its layout is not recalculated. The outer mobile market strip still expands naturally. Quote colors, live data and horizontal swiping remain managed by TradingView. Desktop market embeds are untouched.

## Caveat

TradingView is a third-party widget and its layout can change. If its pricing row becomes taller in the future, the 50px visible window might need adjusting. Inspect the live mobile rendering after deployment; the repair has been validated locally in the browser with a simulated quote line, not against live TradingView on your iPhone.
