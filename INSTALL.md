# Standalone News — Desktop Bot news-publishing bridge (Reader V3)

This upgrade connects the public website to the **54 public RSS and discovery feed configurations** in the desktop news bot you supplied. It **does not** connect to the private local SQLite database, expose the bot API, or automatically publish posts to X.

## What it changes

- `scripts/desk_feeds.json`: the exact feed definitions from your desktop bot (54 configured sources; some may fail on any given run).
- `scripts/publish_desk.py`: a hosted collector using the same **baseline and impact keyword importance score** and **near-duplicate comparison** from `engine.py`. It collects public headlines and creates `data/desk.json`.
- `.github/workflows/publish-desk.yml`: new GitHub Actions workflow. Runs around **:15 and :45 UTC every hour**, and can also run manually. It is staggered relative to the existing `refresh-headlines.yml` to reduce push conflicts.
- `newsroom.js`: merges ranked bot headlines into the regular website feeds, promotes desk-selected stories, deduplicates identical links, and preserves existing `data/news.json`, `data/editorial.json`, and Gemini `data/articles.json`. Continues to work if the new desk feed isn't ready.
- `index.html` and `newsroom.css`: uses the previously improved reader layout, prevents the overlapping ticker placeholder on phones, and labels the automatic ranking accurately.

## Important: Install carefully

1. Back up the live website's `index.html`, `newsroom.js`, and `newsroom.css` from your repository first.
2. Upload **only these 5 files** to the **root** of `StandaloneNews/standalone-news-website`:
   - `index.html`
   - `newsroom.js`
   - `newsroom.css`
   - `scripts/desk_feeds.json` (keep folder path)
   - `scripts/publish_desk.py` (keep folder path)
3. Upload `.github/workflows/publish-desk.yml` to the **same path** in GitHub. GitHub's web file uploader may not preserve folder paths if files are dropped without the containing folders. Use GitHub's Create new file feature and paste the paths for nested files, or Git to commit the folders.
4. Commit. In GitHub **Actions**, run the new workflow **Standalone News desk feed** manually once to populate `data/desk.json`. Check that the workflow logs say how many sources succeeded. Automatic updates are scheduled afterward.
5. Let Cloudflare deploy. Open the website on iPhone and desktop; refresh the cache.
6. Confirm Sign In, Saved across devices, markets, headline cards, and AI explainers still work. If any fail, immediately revert just the three root frontend files; the feed workflow can remain independently harmless.

**Do not replace** `account-config.js`, `accounts.js`, `saved_articles.sql`, `markets-fix.js`, or your existing `refresh-headlines.yml` and Gemini workflow. This ZIP intentionally does not include any Supabase credentials, database copies, or your private reader data.

## Accuracy & limitations

- Desktop bot: local FastAPI/SQLite RSS newsroom, approval queue, and optional Ollama drafting of *X posts*. It does NOT automatically generate full articles.
- Hosted bridge: **automatically selects source-linked headlines** using the same rule-based editorial **priority calculation**, not human verification. Near-duplicate titles are filtered in the featured selection only; the raw source wire remains available.
- This **does not** synchronize the desktop bot's 15 approved local posts to the public site. Approval states in `standalonenews.db` are private and never uploaded.
- The existing **Gemini official-document explainer publisher is untouched**. Generating more full-length explainers from selected stories requires a separate editorial and verification system. This package does not invent publisher details or republish full articles.
- Feeds are free/public but not guaranteed; providers may block, rate-limit, or change URLs. Some stories link to Google News discovery pages rather than directly to publisher websites, and labels reflect that.
- The source-ranked feed is generated twice an hour on GitHub's best-effort schedule. That is not guaranteed instant breaking-news delivery.
- This package was statically tested with Python syntax and offline feed parsing, and JavaScript syntax. Live production rendering, Supabase, TradingView, and actual network RSS fetches require post-deployment verification.

## Testing the feed builder locally

From repo root:

`python scripts/publish_desk.py`

This makes outbound requests to the feeds and writes `data/desk.json`. No API key is required. There is no direct dependency on the local desktop bot database or Ollama.
