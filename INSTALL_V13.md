# Standalone News — V13 Footer, News Wire & Desk Images

**Built on your V12 reader layout and the mobile/TradingView fixes it inherited.** This package updates the public website only. It **does not** alter your existing Cloudflare Workers code, Supabase keys, saved-articles database, GitHub news workflows, or TradingView integration.

## What changes

1. **Latest news wire above the Five-Story Brief.** The homepage now reads: Lead story → What Matters Today / Desk Picks → Latest news wire → Daily 05 Brief → personalized topics → other sections. The news wire initially shows 6 items, with "Load more" to keep the Daily Brief reachable.
2. **Every Desk Pick gets visual artwork.** Licensed, topic-relevant photos are still used when the existing collector supplies them. Otherwise, 7 original local illustrations are displayed for Markets, Economy, World, U.S., Government, Regulation and Technology. These are generic editorial illustrations, **not actual photographs of breaking events**; their purpose is to avoid missing photos or irrelevant, misleading images. If any external photo fails to load, the card falls back to an original illustration. No new API key is needed.
3. **Footer navigation** grouped as Read / About / Legal, links for Privacy Policy, Terms of Use, Newsletter Privacy, Editorial Standards, Accessibility, Contact & Corrections, and mailing address **12544 Kirkham Ct, Ste 11, Poway, CA 92064, USA**.
4. **New pages:** `privacy.html`, `terms.html`, `contact.html`, and shared `legal.css`. These are tailored drafts based on the known website code. **Review with a qualified legal professional and verify live cookies/analytics/providers and operator identity before representing them as final legal policies.**
5. Existing `standards.html` and `newsletter-privacy.html` receive cross-links to the new legal pages and mailing address.
6. `newsletter.js` uses your separate Worker API at **https://api.standalonenews.com**, rather than the obsolete Pages `/api` path. The form remains disabled until that Worker returns an enabled status. This update **does not install the backend Worker code or its secrets**.

## Install in GitHub (existing standalone-news-website repository)

Back up `index.html`, `newsroom.css`, `newsroom.js`, and `newsletter.js` first.

Replace/upload these files **at the repository root**:
- `index.html`
- `newsroom.js`
- `newsroom.css`
- `newsletter.js`
- `privacy.html` (new)
- `terms.html` (new)
- `contact.html` (new)
- `legal.css` (new)
- `standards.html`
- `newsletter-privacy.html`

Upload these seven SVG files inside the **existing** `assets` folder (or create it) **with their exact paths**:
- `assets/desk-markets.svg`
- `assets/desk-economy.svg`
- `assets/desk-world.svg`
- `assets/desk-us.svg`
- `assets/desk-government.svg`
- `assets/desk-regulation.svg`
- `assets/desk-technology.svg`

**Do not upload the ZIP file itself to the GitHub code repository** expecting it to unpack. Extract the ZIP on your computer first. In GitHub's web interface, go into `assets` before using **Add file → Upload files**, so the SVGs remain inside `assets` and not at the root. You can also create each exact `assets/desk-...svg` path with **Add file → Create new file** and paste the corresponding SVG text.

Keep these unchanged:
- `accounts.js`, `account-config.js`, `markets-fix.js`
- Existing `functions/` folder, your separately deployed newsletter Worker, Supabase SQL
- `.github/workflows/` files and all `scripts/` files
- Existing `data/*.json`, `articles/`, and other assets

Commit, let your Cloudflare Worker website redeploy from GitHub, and hard-refresh your browser. You do not need to rerun the news workflow: the new **local illustration fallback** works with the existing feed immediately. If the photo matcher later supplies valid licensed photos they take precedence.

## Check after deployment

1. The Desk Picks row has images (photos when available, otherwise category illustrations). They should not be blank.
2. **Latest news wire** appears above the dark **Daily 05 Brief** on both desktop and mobile; the "Show more" button works.
3. Footer displays your Poway address and links to the new legal pages.
4. Markets and TradingView quotes, Sign In, Saved, and existing source links still work.
5. Newsletter signup is not promoted until the separate Worker is installed and you have tested opt-in, confirmation, delivery and unsubscribe.

## Testing notes

Checked: Python desk-feed tests (14 passing), `node --check` on website and newsletter scripts, static HTML navigation, all SVGs parse as valid XML, and legal-page link targets exist. **Local interactive browser rendering was unavailable in this session**, so a real iPhone/desktop check after Cloudflare deploy remains essential. No live site or external service was modified by this package.

## Roll back

Restore your previous root `index.html`, `newsroom.css`, `newsroom.js` and `newsletter.js`; the 7 SVGs and legal pages can remain harmlessly in the repository if unused.
