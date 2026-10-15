# Standalone News — Image matching upgrade (Reader V4)

This upgrade builds on the desktop-bot website integration and adds **automatic image matching** for major headlines.

## What it adds

- Matches headlines to **Wikimedia Commons** images during the GitHub Action feed build.
- Filters for **commercial-use-compatible licenses** such as Public Domain, CC0, CC BY, and CC BY-SA.
- Stores image metadata in `data/desk.json`.
- Displays matched images on the homepage hero, desk-pick cards, category cards, and the latest wire, with attribution.
- Preserves your current **Supabase Sign In**, saved stories, market widgets, and Gemini explainer publisher.

## Important limitations

- These are **illustrative** images, not guaranteed event photos.
- The system tries to understand the headline and find a relevant subject, company, institution, or building.
- Some matches will be broad or generic when a headline is highly specific or breaking.
- Wikimedia Commons licenses vary; this upgrade only uses candidates that appear to allow commercial reuse. Attribution is shown on the site.
- If no acceptable image is found, the site falls back to your existing category art.

## Files to upload

Upload these files to your GitHub repository, keeping the same paths:

- `index.html`
- `newsroom.js`
- `newsroom.css`
- `scripts/desk_feeds.json`
- `scripts/publish_desk.py`
- `.github/workflows/publish-desk.yml`
- `tests/test_publish_desk.py` (optional but recommended)

## After upload

1. Commit the files.
2. Go to **GitHub Actions**.
3. Run **Standalone News desk feed** manually once.
4. Wait for it to complete and commit `data/desk.json`.
5. Let Cloudflare deploy.
6. Hard refresh the website on phone and desktop.

## What to verify

- Homepage hero shows a relevant illustrative image when available.
- Top stories and latest wire cards show images for matched stories.
- Stock ticker no longer overlaps.
- Sign In still works.
- Saved stories still work.
- Explainers still load.

## Local test

From repo root:

```bash
python -m unittest discover -s tests -v
python scripts/publish_desk.py
```

The second command needs internet access because it fetches RSS feeds and Wikimedia Commons search results.
