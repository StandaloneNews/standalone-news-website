# Standalone News V14 — Privacy + Latest Wire + Reading Desk

This is a targeted update built on V13. It does NOT include or replace Supabase credentials, `accounts.js`, `account-config.js`, `markets-fix.js`, newsletter Worker code, RSS feed scripts, or news GitHub Actions workflows.

## Install in the root of your existing GitHub website repository

1. Back up the six existing files listed below.
2. Upload and replace **only** these files, keeping them in the repository root:
   - `index.html`
   - `newsroom.css`
   - `newsroom.js`
   - `privacy.html`
   - `newsletter-privacy.html`
   - `legal.css`
3. Commit. Wait for the existing Cloudflare GitHub deploy and hard-refresh the site.
4. Check the wire cards, topic/source/date filters, Follow/Save/Read buttons, Reading Desk preference modal, five-story brief near the bottom, mobile navigation, footer Privacy link, and TradingView ticker.

## Changes

- V13's Latest News Wire is restyled as accessible editorial cards with image/category thumbnails, clearer publisher/time metadata, and explicit read/save/follow actions. Search continues using previously available headline/explainer metadata (not full-article text).
- The Reading Desk is now visible even with no followed topics. Its CTA opens the existing preferences modal. It appears immediately after the Latest Wire.
- The five-story brief is near the bottom of the homepage, immediately before the site's editorial-approach panel. Top navigation, quick jump links, and mobile bottom menu now put Brief last.
- Privacy Policy now discloses only known implementation behavior and clearly separates first-party local/browser, Supabase/Resend records, and what other providers may do. We deliberately avoid unverified absolute claims about third-party data retention or tracking.
- The newsletter-specific privacy page is clarified in case that optional backend isn't yet active.

## Data/privacy disclaimer

This policy is written against the reviewed supplied frontend, existing Supabase `saved_articles.sql` and `newsletter_subscribers.sql`, and the separate optional newsletter Worker. It is NOT an audit of account-specific Cloudflare analytics, cookies, installed tag managers or independent vendor databases. The operator should confirm those details and consult counsel for the website's relevant privacy laws before treating the legal policy as final.

## Rollback

Restore the backed-up six files and redeploy. Database tables, third-party keys, email subscriptions and reader accounts are untouched by this frontend change.
