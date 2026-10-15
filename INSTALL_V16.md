# Standalone News V16 — Latest News Wire navigation repair

This is a focused front-end patch based on the working V15 Personalization page upgrade.

## Files to replace at GitHub repository root

- `index.html`
- `newsroom.css`
- `newsroom.js`

Nothing else. Do **not** replace `accounts.js`, `account-config.js`, `markets-fix.js`, `newsletter.js`, `personalize.html`, `personalize.css`, `personalize.js`, the newsletter Worker, or GitHub Actions workflows.

## Changes

- Give Latest News Wire a light-blue editorial surface and a distinct dark-navy filter console with contrast-friendly controls.
- Remove text clipping in mobile search and avoid oversized source dropdowns.
- Keep topic pills visible horizontally on mobile; put the more detailed source, content and date selectors behind a working **More filters** button (desktop shows these filters all the time).
- Keep search/filter IDs and the existing JavaScript filtering logic intact.
- Improve spacing and mobile wire-card controls without altering the news feeds or image publisher.
- Add CSS cache-busting query suffix `wire16` for the two updated assets.

## Test after Cloudflare deploy

1. On iPhone, go to **News** / Latest News Wire and check the dark navy search/filter block.
2. Swipe the topic chips, tap **More filters**, choose a publisher, content type, and date; verify search results update.
3. Check that the native dropdown no longer extends beyond the light-blue wire section.
4. Confirm **Read coverage**, **Save**, and **Follow source** actions still respond.
5. Confirm the homepage desktop ticker, Supabase Sign In and separate personalized reading page are unchanged.

No new backend credentials, newsletter config, or news workflows are required. This patch was tested locally for HTML/JS syntax and responsive filter layout; post-deployment checks are still required.
