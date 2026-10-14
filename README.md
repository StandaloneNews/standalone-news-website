# STANDALONE NEWS — PUBLIC WEBSITE

A custom, mobile-first public newsroom for **standalonenews.com**, featuring the approved SN brand identity, featured headline, fast wire, full-text search, U.S./world/markets/government/DEA filters, about/editorial standards page, publisher attribution, and RSS support.

**This website is not yet live on your domain.** The files are ready to deploy. No website backend or paid news API is required for the default static setup.

## The difference between the website and your private bot

- The **public website** contains only public RSS headline data (`data/news.json`) and optional, already-posted items (`data/editorial.json`). It does not expose Ollama, the bot's SQLite database, its editor dashboard, or API endpoints.
- The **private Standalone News bot** remains on your Windows PC behind your private Cloudflare Access login (`desk.standalonenews.com`, if you set that up). The public site is `standalonenews.com`.
- A headline found by an RSS or aggregator is *attributed*, not independently fact-checked. Original reporting remains with the linked publisher.

## Preview on Windows before deploying

1. Download the ZIP and extract it.
2. Install Python if necessary.
3. Open PowerShell inside the website folder.
4. Run `python -m http.server 8080` (or `py -m http.server 8080`).
5. Open `http://localhost:8080/?demo=1` to preview the complete design with clearly labeled **illustrative** stories.
6. Open `http://localhost:8080/` to see the real public mode. It will initially say it is waiting for news. The bundled `data/news.json` is intentionally empty rather than containing fabricated live headlines.

Please do not open the HTML using `file://` for the live feed: the browser needs a local HTTP server to fetch JSON files.

## Launch without paying for hosting: GitHub + Cloudflare Pages

You will need a free GitHub account and a Cloudflare account. Free tier conditions can change.

1. Create a GitHub repository (for example `standalone-news-website`) and upload the **contents** of this website folder to its root. **Do not upload the private bot folder, its `.db` file, tokens, or credentials.**
2. In GitHub repository Settings → Actions → General → Workflow permissions, allow GitHub Actions to read and write repository content if your organization/settings require it. The included action needs `contents: write` to commit updated `news.json` and `feed.xml`.
3. Open GitHub's **Actions** tab and run the workflow **Update public news feed** → **Run workflow** once. It calls `python scripts/update_news.py`, reads public RSS feeds, and commits only public `data/news.json` and `feed.xml`. If feeds are blocked or all unavailable, it keeps the existing data intact.
4. In Cloudflare Dashboard → **Workers & Pages** → **Pages** → **Connect to Git**, connect that GitHub repository and set the build output directory to `/` (the repository root) for a plain static site; no build command is necessary. Cloudflare's dashboard labels may differ.
5. After the Pages preview URL works, go to that Pages project's **Custom domains** and add `standalonenews.com` (and optionally `www.standalonenews.com`). Follow Cloudflare's verification and DNS instructions. If your domain already has DNS records/email/other services, **preserve them** before switching nameservers. Do not point `desk.standalonenews.com` at the public Pages site; keep it isolated behind Cloudflare Access.
6. After enabling a new GitHub Actions scheduled workflow, it runs approximately every 30 minutes, **not instantaneously**. GitHub may delay scheduled jobs or disable schedules on inactive repositories. Free GitHub and Cloudflare quotas may apply. Check Actions history periodically to confirm updates actually happen.

**If GitHub Pages is preferred:** this is also a standard static site. The scheduled workflow updates the repository; you can use Pages for publication. For a registered custom domain, follow GitHub's current custom-domain instructions.

## Free headline data: where it comes from

- Direct official RSS where available: Federal Reserve, Bureau of Labor Statistics, Department of Justice, Food and Drug Administration, SEC, and DEA documents in the Federal Register.
- Public RSS discovery: Google News topic searches and site-restricted searches for publishers like Reuters, Bloomberg and AP. These are **not** direct licensed Bloomberg/Reuters/AP feeds; a search can include delayed or duplicate coverage.
- Public publisher RSS (NPR).
- The public website shows the title, source, and link. It displays feed excerpts only for official sources. There is no automatic republication of full publisher articles or unauthorized scraping of X accounts.
- Google News discovery links may lead through Google News, rather than directly to the original publisher. Double-check sources before writing independent X posts.

`python scripts/update_news.py` refreshes `data/news.json` and `feed.xml` manually. It uses only Python's standard library, no API key. Some external feeds can fail or rate-limit; individual failures do not prevent other feeds from updating.

## Optional: include news you've already posted from your existing bot

Export **only `status='posted'` stories** from your local private bot database, so unapproved news is never published unintentionally:

```
python scripts/export_bot_posts.py --db "C:\\path\\to\\your\\standalonenews.db"
```

That writes `data/editorial.json` in this website folder. Review its contents, then push **only that JSON file** to your public GitHub website repository. Do not put the database or private bot files in the public repo.

The homepage automatically combines published editorial posts and the RSS feed, suppressing exact duplicate article URLs. This exporter is a **manual optional step**, not a background sync. To automate updates from the bot later, use a deliberately authorized and secure export pipeline; do not expose the bot's private admin API.

## Branding and customization

- `assets/sn-brand-logo.png` — approved Standalone News avatar logo.
- `assets/standalone-news-banner.png` — matching X banner asset.
- `styles.css` — palette and layout variables.
- `index.html` — main public site structure.
- `about.html` — sourcing and standards.
- `data/demo.json` — deliberately illustrative mock news for design preview only, **never shown on the public homepage**.
- The @StandaloneNews X links point to the account name supplied during setup. Verify the final X handle before launch.
- The contact link currently points to X (not an unconfigured email mailbox).

## Reality check / next steps

This is a working static news website and publishing pipeline, not a CMS, not a Bloomberg data license, and not an automatically fact-checking newsroom. Scheduled public RSS updates can be late. The site does not publish to X; that still happens through your private bot's separate review workflow. True ad revenue and SEO require original content, established policies, analytics, readers, and potentially additional pages/tools later.

Test: `python -m unittest discover -s tests -v` and `node --check app.js` (Node optional).
