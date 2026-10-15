# Standalone News — Mobile improvements + optional reader accounts

## Part A. Mobile improvements (can deploy right away)

Upload these files at the GitHub repository ROOT, replacing the current versions:

- `index.html`
- `newsroom.css`
- `newsroom.js`
- `markets-fix.js` (included unchanged for matching compatibility)
- `accounts.js` (new)
- `account-config.js` (new, **intentionally blank**)

They retain existing `data/news.json`, `data/articles.json`, article URLs, TradingView and automated publishing scripts. Only `index.html` and CSS/JS change. Account controls stay hidden until configured. Guest users can still save to their browser.

## Part B. Activate *real* reader accounts and cross-device saving

1. Create a project in https://supabase.com. Keep your dashboard login secure and turn on MFA for project administration.
2. In **SQL Editor**, run `saved_articles.sql` (the complete SQL file). It enables Row Level Security and limits each reader to their own bookmarks.
3. Under **Authentication → Providers → Email**, enable email authentication/magic links (passwordless email).
4. Under **Authentication → URL Configuration**, set **Site URL** to `https://standalonenews.com/` and add `https://standalonenews.com/` as an allowed Redirect URL. If you use `www`, add that exact URL too. Use a proper branded SMTP/email provider for reliable production delivery; default email sending can have limits.
5. Under **Project settings / API Keys**, copy **Project URL** and **Publishable / anon key**. Edit `account-config.js` and paste these two values only. **NEVER** put the service role, secret API key, database password, or SMTP credentials in a public GitHub file.
6. Commit updated `account-config.js` to your GitHub repo and wait for Cloudflare to deploy. The **Sign in** button will now appear. Sign in by email and verify your bookmarks sync across devices.
7. Before public launch of accounts, post an accurate privacy policy describing that reader emails and saved-story URLs are processed by Supabase, arrange a user data export/deletion procedure, and consider abuse protection, email sending limits, and accessibility testing.

### What users can do

- Guest mode: save links on this browser without registering.
- Sign up / sign in: email magic link, no password.
- Signed in: saved article links are private to their account and sync across phone/computer.
- Import: option to import bookmarks saved in the current browser after signing in.
- Sign out: cloud list is hidden and guest bookmarks return.

**Limitations:** No offline full-article downloads, no copied publisher paywalled content, no full newspapers. Account deletion isn't automated in this starter package; it needs a secure admin workflow. The accounts backend won't activate until you create and connect your Supabase project. The client script depends on a CDN being reachable.
