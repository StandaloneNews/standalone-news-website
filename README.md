# Standalone News — public headlines and automatic, attributed explainers

This package extends the existing public Standalone News static website, preserving its accessible newsroom design, public RSS headlines, agency filters, and Cloudflare Workers static-asset deployment. It adds a separate **/articles/** section for short source-grounded explainers, AI disclosure on every article, RSS publication, and sitemap updates.

**New deployment instructions:** Read `INSTALL_AUTOMATION.md` first. Don't discard your existing live `wrangler.jsonc`, `.assetsignore`, images, or any current articles. GitHub is already connected to Cloudflare for this project; neither GoDaddy nor your PC needs to remain online for this publisher to run.

### What publishes automatically?

Only documents from approved U.S. official agency websites with enough accessible body text. The cloud AI creates a short explainer and must provide exact evidence quotes for validation. The software rejects missing evidence, unsupported numbers, duplicate source URLs, and many sensitive subjects. A successful publish adds a static HTML page under `/articles/`, updates `data/articles.json` (homepage/archives), updates `articles/feed.xml`, and updates `sitemap.xml`.

The **headline feed** continues to include worldwide news and Reuters/Bloomberg/AP discovery links, with attribution to their source. However these third-party news headlines do not become unattended AI explainer articles in this conservative version, because a headline or RSS snippet alone is not sufficient independent verification or permission to reuse the publisher's complete reporting.

**No version of this code guarantees fact-checking or ADA compliance.** Test automated journalism before relying on it and periodically review published output. Original source pages can change after publication; this package does not automatically revise or retract articles.

### Architecture

- GitHub Actions refreshes the news feed every 30 minutes, then tries to publish a supported AI explainer.
- Source text is fetched only from HTTPS webpages on a strict official-domain allowlist, not from the private bot or social media scraping.
- Google Gemini 2.5 Flash-Lite API performs inference in the cloud using your secret configured in GitHub.
- A completed article is committed to the public GitHub repo; Cloudflare Git integration should automatically deploy the updated static files.
- The homepage and archive link to new explainer pages. Each article visibly discloses that an AI assisted and no individual human reviewed it, and links to the underlying source.

### Main safety controls

A maximum of 2 eligible articles per day and 5-hour spacing; sensitive stories excluded from automated publication; fail-closed on missing source content or model errors; no made-up articles when there is no evidence; basic quote validation. These are **mechanical filters**, not exhaustive editorial verification. Human audits remain advisable.

### How to stop

GitHub Settings → Secrets and variables → Actions → Variables → set `AUTO_PUBLISH_ENABLED` to `false`.

Full instructions, free-tier caveats, hosting details, and activation steps are in `INSTALL_AUTOMATION.md`.
