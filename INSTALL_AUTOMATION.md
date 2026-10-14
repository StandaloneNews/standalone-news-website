# Standalone News — hands-off AI explainers setup

**Read before enabling:** This upgrade adds automatically generated, automatically published **short explainers based only on eligible official government/agency documents**. It does not repost Bloomberg, Reuters or other publishers' article bodies. It is not independent fact-checking; an official press statement can itself contain errors, omissions, or a disputed account. Stories involving elections, criminal allegations, war, deaths, regulatory drug scheduling, sanctions, medical issues, emergencies and other sensitive subjects are excluded from unattended explanatory publishing and remain available as source-linked headlines. **Some days no articles will qualify.** The software cannot guarantee accuracy or compliance with third-party publisher terms, and periodic oversight is still recommended.

## One-time setup (Windows, GitHub, Cloudflare)

1. Download the update ZIP and extract it. This is an **update to your existing website**, not a replacement hosting account. Do **not delete** your existing `wrangler.jsonc`, `.assetsignore`, branding files, or public news feeds.
2. Safest way to preserve folders: install [GitHub Desktop](https://desktop.github.com/), sign in, choose **File → Clone repository** and select `StandaloneNews/standalone-news-website`. Open that local repository folder in File Explorer.
3. **Copy the extracted update files and folders into the cloned repository, merging matching folders** (rather than copying an enclosing folder). This adds or updates `index.html`, `about.html`, `styles.css`, `articles.js`, `.github/workflows/refresh-headlines.yml`, `scripts/auto_publish.py`, `tests/test_autopublish.py`, `articles/index.html`, `articles/feed.xml`, and `data/articles.json`. **Do not overwrite an existing non-empty `data/articles.json`.** Do not overwrite `data/news.json` from an older package. Preserve the `wrangler.jsonc` and `.assetsignore` already working at Cloudflare.
4. In GitHub Desktop, commit with a message such as **Add sourced automatic explainers**, then choose **Push origin**. Cloudflare's Git integration should deploy the website update (make sure the build is Ready).
5. Create your **own Gemini API key** at [Google AI Studio](https://aistudio.google.com/api-keys). The script defaults to the free-tier-capable `gemini-2.5-flash-lite`. Eligibility and free quotas depend on your account, region, and current Google terms. **Don't paste the API key into a public file or this chat.** If you enable billing, costs are yours to monitor.
6. Open GitHub → your repository → **Settings → Secrets and variables → Actions → Secrets → New repository secret**. Name it **`GEMINI_API_KEY`** and paste the key there (only into GitHub's secret field).
7. Under the same **Secrets and variables → Actions → Variables** tab, add a new **repository variable** named **`AUTO_PUBLISH_ENABLED`** with value **`true`**. Until this is enabled, the workflow still collects headlines and generates the article landing page, but does not publish new explainers.
8. Under **Settings → Actions → General → Workflow permissions**, ensure the repo's workflow can write to repository content. The YAML grants `contents: write` and uses GitHub's automatic `GITHUB_TOKEN`. The repository is public; **never upload keys or private bot files**.
9. Open **Actions → Update news and publish official-source explainers → Run workflow**. Open the job log. Look for `Found N eligible primary-source candidates`, `Published: articles/...`, or `No story passed publishing safeguards`. Skipping can be correct. If you see an API 403/429, check your Gemini model access, key, and free quota in Google AI Studio. The workflow runs about every 30 minutes; GitHub schedules can be delayed.
10. Visit [standalonenews.com/articles/](https://standalonenews.com/articles/), and verify that the homepage's **Beyond the headline** section and the sitemap work. If GitHub shows a new article but Cloudflare doesn't, open **Cloudflare → Workers & Pages → standalone-news-website → Deployments** and verify a deployment started from the GitHub action's new commit. If GitHub commits aren't triggering Cloudflare builds, use a Cloudflare Deploy Hook or external CI deployment (requires a separate secret) rather than opening up the site publicly.

## Cost estimate

- **GitHub Actions**: no charge for standard hosted runners in a public repository, subject to GitHub's current policy.
- **Cloudflare Workers static assets**: no charge for static asset requests under Cloudflare's current free offering. Other Cloudflare Worker functionality could be billed.
- **Gemini 2.5 Flash-Lite API**: an eligible free tier is available (limited usage). If you switch to a paid tier, Google's listed standard price is approximately $0.10 per million input tokens and $0.40 per million output tokens as checked on October 14, 2026. A hypothetical 5,000-input/800-output-token article is **around $0.00082 of model usage**, before overhead and taxes. This is an illustration, not a billing commitment. API failures or rate limiting won't publish replacement fabricated content. Google states that free-tier data may be used to improve its products; only supply already-public documents.
- **Domain**: your normal GoDaddy renewal still applies.
- **Computer**: can be off; Ollama is not used by this automatic cloud pipeline.

## Limits and controls

- **Maximum two articles per UTC day**, with a minimum five-hour gap and duplicate-source protection.
- Automatic publishing is **limited to allowed primary-source sites** (Federal Reserve, BLS, SEC, DOJ, FDA, Federal Register), with sufficient page text and a quote-based evidence check for each generated paragraph. An exact supporting excerpt is required by the validation code but never reproduced in the public article.
- Only HTML official source pages pass; blocked/unsupported documents and unsupported claims are skipped.
- The `AUTO_PUBLISH_ENABLED` variable is your **pause switch**. Set it to `false` at any time to stop AI publication without stopping RSS collection. Existing articles remain online.
- Articles contain visible attribution, original-source links, publishing date, a prominent AI disclosure, and machine-readable schema data; the sitemap and articles RSS feed are updated automatically.
- **Not available in this version:** automatic X posting, full independent corroboration of disputed stories, automatic fact-checking, reliable legal analysis, human editorial review, or guarantees of Google News placement/monetization. Do not use the generated articles as legal/medical/financial advice.

## Developer tests

Run locally from the website root:

```sh
python -m unittest discover -s tests -v
node --check app.js
node --check articles.js
python scripts/auto_publish.py
```

`auto_publish.py` is designed to be run repeatedly: with the publication variable missing or false, it generates or updates the empty explainer index and exits without calling any model. With the variable true and a valid secret, it publishes at most one new eligible explainer per workflow run.
