# Standalone News — Separate Cloudflare newsletter Worker

**IMPORTANT: This is a Worker setup supplement to V12, NOT a replacement for the news website.**

Your current live site runs as the existing Cloudflare Worker `standalone-news-website`.
The newsletter backend must be deployed as a **second Worker** named `standalone-news-newsletter-api` with the **Custom Domain** `api.standalonenews.com`.

## STEP 1: Verify the custom domain

Open Cloudflare > Workers & Pages > `standalone-news-newsletter-api` > Settings > Domains & Routes.
Verify `api.standalonenews.com` appears as a **Custom Domain** attached to THIS newsletter Worker. If absent, use **Add > Custom Domain** on that page. Do not re-onboard `api.standalonenews.com` as a separate Cloudflare website or modify the existing website's domain.

## STEP 2: Install Worker code

Open the new Worker > **Edit code**. Select its default Hello World source (usually `src/index.js`), paste the entire content of `worker.js`, and click **Deploy**.

NEVER put the Worker code into your public `index.html`, `newsroom.js`, `account-config.js`, or GitHub front-end files; it reads privileged server-side keys.

Worker secret names:
- SUPABASE_URL (text)
- SUPABASE_SERVICE_ROLE_KEY (SECRET)
- RESEND_API_KEY (SECRET)
- NEWSLETTER_FROM_EMAIL (text)
- NEWSLETTER_SIGNING_SECRET (SECRET)
- NEWSLETTER_POSTAL_ADDRESS (text)
- NEWSLETTER_BASE_URL (text, https://standalonenews.com)

## STEP 3: Test the status endpoint

Visit https://api.standalonenews.com/api/newsletter/status. After the Worker code and all six required secrets are configured it should return `{"enabled":true}`. This checks settings presence, NOT domain verification, database access, or email delivery.

## STEP 4: Website JavaScript patch (separate, after Worker success)

Replace only `newsletter.js` in the existing website repository with the included `newsletter.js`. It changes two fetch URLs to the API subdomain. Your V12 frontend must already be installed. Do not edit accounts.js, account-config.js, markets-fix.js, index.html, newsroom.css, newsroom.js.

The Worker restricts cross-origin signup requests to https://standalonenews.com, and the client performs an OPTIONS preflight request. A CORS error usually means the Worker code or attached custom domain is incorrect.

## STEP 5: GitHub email sender change (when enabling the delivery workflow)

Replace `scripts/notify_readers.py` with the included version. It makes unsubscribe links point to https://api.standalonenews.com rather than the main website, and leaves the rest of the V12 script intact. Without this change the link in digest emails would be broken on your current Worker deployment.

Before enabling the existing `.github/workflows/newsletter-delivery.yml`, add the same six production secrets to GitHub Actions > Repository secrets, keep the signing secret exactly identical, and test with only your own confirmed subscriber address.

## Security / cautions

- Resend must show the sending domain as VERIFIED before a live test.
- The existing `newsletter_subscribers.sql` must have been run in your existing Supabase project.
- Limit newsletter signup abuse with Cloudflare WAF / rate limiting. The Worker includes a honeypot and 24-hour per-address resend throttle but not IP-based rate limiting.
- Do not make email sending automatic until confirmation and unsubscribe tests pass.
- The `functions/` folder in GitHub is legacy Pages-style code; it does NOT power this standalone Worker, and can be left in place for now.
- If your website has a www subdomain or preview domain, the cross-origin allowlist may need deliberate adjustment; this setup allows only https://standalonenews.com.
- The email helper and Worker don't call paid LLM APIs.

Tested: JS syntax, CORS preflight, public status response, forbidden origin, and 404 locally. Live Supabase/Resend were not tested.
