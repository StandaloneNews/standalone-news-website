# Standalone News — V7 focused repair

V6 accidentally stopped TradingView from loading by replacing the working embed with a sandboxed iframe. This ZIP restores the earlier embed method and removes all text over photographs while keeping photographer and license attribution below story content.

## Install — GitHub root only

1. Back up your current website files or make a GitHub commit you can revert.
2. Replace `index.html`, `newsroom.js`, and `newsroom.css` with the files from this ZIP.
3. Replace or add `markets-fix.js` in the root as supplied (the working direct TradingView integration).
4. Add `shadow-test.html` to the root for troubleshooting; it is not indexed and does not use TradingView scripts.
5. Commit. Wait for Cloudflare to deploy. Hard refresh desktop and mobile.

No changes to `accounts.js`, `account-config.js`, `data/`, scripts, GitHub Actions, or Supabase. Do not upload the old V6 `market-isolator.js` or `market-embed.html` again; they can remain unused in the repository.

## Debug the unresolved black shadow

We could not reproduce the shadow in local rendering. We cannot truthfully claim V7 fixes it.

1. Open the ordinary homepage using an Incognito Chrome window with extensions disabled.
2. Open `https://standalonenews.com/shadow-test.html` in that same window. It uses the same page but **does not load any TradingView widgets**.
3. If the ordinary page has the black band and the shadow-test page does not, an embed or script integration is implicated. If both have it, investigate an extension, GPU/browser rendering, stale files/CSS, or another overlay (F12 element inspection).
4. Send screenshots of both and the active page address bar. Do not deploy another full redesign until the actual cause is established.

## Checks

- Market tape should use direct TradingView embed again; stock panels should populate when the Markets tab opens. If script requests are blocked by privacy extensions or network policy, use the external market link.
- No overlay text on images.
- Creator/license information is linked beneath the associated story, when available.
- Supabase sign-in and saved bookmarks should be unchanged.
- GitHub publishing workflows are unchanged. No workflow runs required for this frontend fix.

Note: automatic Wikimedia/Pexels license heuristics cannot fully verify all third-party image restrictions or event relevance. Continue to review any particularly sensitive event images before publication.
