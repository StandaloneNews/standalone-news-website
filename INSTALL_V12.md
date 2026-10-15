# Standalone News V12 — Newsroom reader experience, image quality, subscriptions

**Prepared from the V11 CSS plus V9 frontend files that were already in use.** The new package is an upgrade, not a replacement for your account credentials, original publisher, market scripts, or news database. **Not deployed to your live site.**

## Improvements that work after the normal frontend deployment

1. Less repetitive editorial presentation: lead-story descriptions are hidden if they add no value. RSS summary boilerplate is filtered. “The latest” displays a real feed-updated time rather than falsely saying the feed is continuously live.
2. “What matters today” has a concise lead + four varied desk picks; the chronological wire remains separate.
3. Personalization: choose topics **and publishers** in your brief settings; a new “Your reading desk” appears if preferences are saved. Follow buttons appear on story cards and in the wire. **Publisher/topic preferences are stored locally on that browser/device**, even if you are signed in. Existing Supabase synced **bookmarks** remain unchanged.
4. “Why it matters · AI-assisted context”: shows only when an already published official-source explainer is a sufficiently related match. Never invents analysis from the headline. Collapses by default on phones.
5. Search across source-linked headlines, original AI-assisted explainers, and saved links. Supports topic, outlet, date, and content-type filters. Search covers the currently published feed metadata, **not full article bodies** or an unlimited historical archive.
6. Newsroom standards and optional newsletter privacy pages provide plain-language transparency about ranking, images, AI, and corrections.
7. Tighter photo selection in `scripts/publish_desk.py`: uses only recognizable subjects in the actual headline; rejects generic market/economy storefront matches and image repeats. No good licensed photo means branded illustration. Credits remain visible below photos, not over them.
8. Cleaner mobile navigation: the redundant horizontal jump menu is hidden in the phone layout because the bottom nav already exists. Existing full TradingView quotes are untouched.

## Quick install: reader site and better images

1. **Back up** the working root `index.html`, `newsroom.css`, `newsroom.js`, and `scripts/publish_desk.py` from GitHub. Test the site on desktop and iPhone afterward.
2. Upload/replace the following exact paths in your repository (which deploys to Cloudflare Pages):
   - `index.html`
   - `newsroom.css`
   - `newsroom.js`
   - `newsletter.js` (new; safely does nothing until configured)
   - `standards.html` (new)
   - `newsletter-status.html` (new)
   - `newsletter-privacy.html` (new)
   - `scripts/publish_desk.py` (updated strict matcher)
   - `tests/test_publish_desk.py` (optional automated tests)
   - `tests/test_newsletter.mjs` (optional test)
3. **Leave the current** `markets-fix.js`, `accounts.js`, `account-config.js`, `saved_articles.sql`, `data/news.json`, `data/articles.json`, `data/editorial.json`, `.github/workflows/refresh-headlines.yml`, Gemini article workflows, and `.github/workflows/publish-desk.yml` **unchanged**.
4. Commit and wait for Cloudflare Pages to deploy. Run the existing **Standalone News desk feed** workflow **once** in GitHub Actions to regenerate `data/desk.json` and remove old mismatched image assignments. Existing scheduled updates continue afterward.
5. Refresh the site on desktop and iPhone. Test source links, saved articles, Sign In, quotes, search filters, and reader preferences. The newsletter panel should say signup is not yet configured.

### Note on photo licensing

Images are attributed and subject-matched, but automated metadata checks cannot guarantee every image is legally safe for every use or that a file accurately depicts an actual event. The site identifies photos as illustrations in documentation and in alternative text. Review photos periodically and be ready to remove a problematic image. The matched photos are **not guaranteed to be event photographs**. Pexels API is optional and is **not required** for this upgrade.

## Optional email setup (required before the newsletter actually sends)

This is real source-linked email delivery scaffolding, **not a live newsletter by itself**. The signup form stays hidden until configured. There are no emails sent during installation and no signup addresses collected by the static site alone.

1. Use the **existing Supabase project** and run `newsletter_subscribers.sql` in Supabase SQL Editor. This creates two **new RLS-protected tables** and does not alter `saved_articles` or authentication.
2. Create an account with an email delivery provider compatible with the **Resend API**, verify your sending domain, and obtain an API key. Domain verification and provider approval are not automated.
3. Configure these **Cloudflare Pages Environment variables/secrets** for the production website (Settings → Environment variables; redeploy afterward):
   - `SUPABASE_URL` — your existing Supabase project URL.
   - `SUPABASE_SERVICE_ROLE_KEY` — privileged **server-only** Supabase service role JWT or server secret key (`sb_secret_…`). **Never** paste it into JS on the public website, GitHub files, or `account-config.js`.
   - `RESEND_API_KEY` — secret email provider API key.
   - `NEWSLETTER_FROM_EMAIL` — verified sender, e.g. `newsletter@your-verified-domain`.
   - `NEWSLETTER_SIGNING_SECRET` — new random long secret (minimum 32 random bytes; remain stable or old unsubscribe links won't work).
   - `NEWSLETTER_POSTAL_ADDRESS` — your legally appropriate physical mailing address for email compliance. **We did not invent one for you.**
   - Optional `NEWSLETTER_BASE_URL` — `https://standalonenews.com`.
4. Create matching **GitHub Actions Secrets** for the same 6 required values. Cloudflare variables do **not** automatically appear in GitHub Actions. None of these should ever be in public source code. For security, enable rate limiting or a bot challenge for `/api/newsletter/subscribe` via Cloudflare WAF before public promotion.
5. Upload the following **optional server files** into matching repository folders, keeping their paths:
   - `functions/_lib/newsletter.mjs`
   - `functions/api/newsletter/status.js`
   - `functions/api/newsletter/subscribe.js`
   - `functions/api/newsletter/confirm.js`
   - `functions/api/newsletter/unsubscribe.js`
   - `scripts/notify_readers.py`
   - `.github/workflows/newsletter-delivery.yml`
   - `newsletter_subscribers.sql` (optional to keep in repository as setup reference; running it in Supabase is what creates tables)
6. Deploy Cloudflare Pages and visit `/api/newsletter/status`: it should return `{"enabled":true}` **only after** the required server variables are configured. Test by subscribing with an email address you control, clicking the confirmation link, and confirming the signup appears as `confirmed_at` in Supabase.
7. In **GitHub Actions → Standalone News opt-in email briefing**, manually run a **digest** only after testing with a controlled subscriber list. Then automated emails may run on the specified daily schedule; alerts run every three hours and are sent only to readers who explicitly opted in, with **maximum one alert per UTC day per reader**. A headline's automatic priority score is **not human fact verification**.
8. Test unsubscribe from the link in the email footer. It should stop deliveries. Do not advertise newsletters until you have verified deliverability, unsubscription, provider billing, and privacy policy with your legal counsel if applicable.

**Costs:** The frontend, rule-based ranking, and matching do not require paid LLM tokens. Gemini explainer publishing remains unchanged and may consume Gemini tokens. The optional mail provider, Supabase, and Cloudflare functions may incur separate usage or billing charges. This mail sender has a **500-subscriber-per-run safety cap** to prevent unbounded use during early testing. Expand that only after reviewing billing and pagination.

## Known scope limitations

- Existing accounts continue syncing saved links only. Topic and publisher follows are currently **device-local**, not cloud-synced.
- The optional “Why it matters” block uses previously published source-based summaries; it does not generate new explanations by itself.
- Search currently indexes only the available news and article JSON metadata, not full article text or all historical content.
- “Breaking news alerts” are **opt-in email alerts**, not iOS/Android native push notifications.
- The existing Gemini publisher's generation rules were left unchanged because its current source workflow was not supplied here. More substantial editorial/verification changes need that workflow and source documentation.
- This package was tested offline. Live Supabase, Resend domain verification, Cloudflare function integration, and TradingView need post-deployment end-to-end testing. No claim that the live website was modified.

## Offline validation

From the repository root, where Python 3.12+ and Node 22+ are installed:

```bash
node --check newsroom.js
node --check newsletter.js
python -m unittest discover -s tests -v
node --test tests/test_newsletter.mjs
```

The feed collector requires outbound RSS and Wikimedia access and existing feed configurations. It is intended to run inside your existing GitHub Actions desktop-news workflow. The email delivery job uses Resend/Supabase secrets but intentionally skips sending when they are absent.

## Rollback

If any reader UI problem appears, restore your backup copies of the three root files (`index.html`, `newsroom.css`, `newsroom.js`) and redeploy. The optional newsletter functions and database schema are separate. To disable newsletter signup, remove the Cloudflare `RESEND_API_KEY` environment variable. To stop automatic newsletter sends, disable `.github/workflows/newsletter-delivery.yml` or remove its Resend secret.
