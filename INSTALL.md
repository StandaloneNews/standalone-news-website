# Standalone News — V5 image coverage and shadow guard

This ZIP **replaces V4** and builds on the V3 desktop-bot website integration. It improves automatic licensed-photo coverage, always searches DESK PICKS first, retains previously matched images, adds an optional high-coverage Pexels image search, and tightens the appearance of cards.

## Deploy

1. Back up your current GitHub repository or save copies of `index.html`, `newsroom.js`, and `newsroom.css`.
2. Upload the files in this ZIP **to their matching repository paths**, replacing the older versions:
   - `index.html`, `newsroom.js`, `newsroom.css`
   - `scripts/publish_desk.py`, `scripts/desk_feeds.json`
   - `.github/workflows/publish-desk.yml`
   - `tests/test_publish_desk.py` (optional, recommended)
3. Commit on `main`. Keep all other files untouched.
4. Open **GitHub Actions → Standalone News desk feed → Run workflow**, and check it succeeded.
5. Wait for Cloudflare to deploy, then hard refresh the site (Ctrl+Shift+R).
6. Check the top stories, desktop and mobile layout, Sign In, Saved, Markets and Gemini explainers.

## Photos and licensing

The default image search uses Wikimedia Commons. It accepts Commons items whose metadata indicates CC0, public domain, CC BY, or CC BY-SA, and rejects NC, ND, fair-use, and reserved-rights images. Some sources may block requests, be unavailable or return irrelevant matches. Those stories intentionally show category illustrations instead of copying publisher images. There is NO guarantee Commons metadata is accurate; check licensing for important featured images before reuse.

**Highly recommended for better photographic coverage:** register at https://www.pexels.com/api/ to get a free Pexels API key. In GitHub, go to repository Settings → Secrets and variables → Actions → New repository secret, name **`PEXELS_API_KEY`**, and paste your key. The secret stays in GitHub Actions and is **not sent to browsers**. Run the workflow again. Pexels offers photos under its Pexels License, which allows commercial reuse but has restrictions, especially on implying endorsement or depicting identifiable people misleadingly.

This system uses automatic keyword/entity relevance matching rather than fact verification. Matched images are clearly labeled **Illustrative photo**, not actual coverage of events. Credit and license information are displayed for credited photographs. It is not appropriate to automatically depict alleged perpetrators, victims, or exact breaking events without human verification. For such stories use illustrations.

## Why some images may still be missing

- V4 only tried the first 36 chronological stories. V5 starts with ranked DESK PICKS and retains already found matches.
- Wikimedia Commons photo results are spotty and can be rate-limited. Providing `PEXELS_API_KEY` improves coverage, but will not guarantee every headline has an appropriate image.
- If a licensed match fails, the original category artwork is used, so there are no broken images.

## About the gray/black shadow

The screenshot has a broad rectangular dark gradient. It doesn't match a CSS shadow defined for the main page in this package. V5 adds defensive CSS to prevent accidental body overlays and forces modals to stay hidden unless opened. If you still see the shadow after refreshing, try a private/incognito window without extensions. If it appears there too, open Developer Tools to inspect whether an injected third-party widget or another script is drawing the overlay. This package cannot establish that root cause from a screenshot alone.

## Tests

Run `python -m unittest discover -s tests -v` from the repository root for offline tests. Running `python scripts/publish_desk.py` makes external requests and needs internet access.
