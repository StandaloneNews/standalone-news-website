# Standalone News Discussions — V17 installation

This package adds `https://standalonenews.com/discuss.html` with live chatrooms **and** forum-style discussion threads. It uses your **existing Supabase project and existing magic-link reader accounts**. You do not need a new Supabase project, service-role key, Cloudflare Worker, or paid AI API.

## 1. Back up the website before uploading

Save the current GitHub `index.html` and `privacy.html`. This package's index is based on V16 and changes only navigation links. The privacy page expands the V14 disclosure to explain community storage; review the wording and provider behavior before publishing.

## 2. Create community tables in Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard), select the SAME project you use for saved stories and accounts.
2. Go to **SQL Editor → New query**.
3. Paste the entire `community.sql`, then click **Run**. A successful CREATE/GRANT query generally returns "Success. No rows returned." **This does not mean the website has been deployed.**
4. Under **Table Editor**, confirm `community_rooms`, `community_profiles`, `community_messages`, `community_threads`, `community_replies`, `community_reports`, `community_moderators`, `community_restrictions` exist. Keep RLS **enabled** on every new table.
5. In **Authentication → URL Configuration**, add `https://standalonenews.com/discuss.html` to **Redirect URLs** if it is not already allowed. Keep existing redirect URLs.
6. Ensure the existing project **Data API** is enabled (your saved-article features already use it). Don't enable blanket table grants or turn off RLS to troubleshoot.

**Important:** The SQL is a new feature schema; it does not modify `saved_articles` or newsletter tables. It explicitly grants `anon` read and `authenticated` write access protected by RLS. Server-side triggers enforce identity, posting cooldowns, and hourly quotas. It also enrolls messages, threads and replies in the `supabase_realtime` publication for live updates. If Supabase Realtime is unavailable, the browser refreshes every 30 seconds.

## 3. Upload files to GitHub

Open `StandaloneNews/standalone-news-website` on `main`. Upload the following **root-level files**:

| File | Action |
|---|---|
| `discuss.html` | Add |
| `community.css` | Add |
| `community.js` | Add |
| `index.html` | Replace the current V16 version |
| `privacy.html` | Replace current privacy policy after reviewing |
| `community.sql` | Optional repository copy for your own setup reference; RUN it in Supabase regardless |

You do **not** need to upload `INSTALL_COMMUNITY.md` unless you want it for your own reference.

**Do not delete or replace:** `accounts.js`, `account-config.js`, `saved_articles.sql`, `markets-fix.js`, `newsletter.js`, the Workers newsletter API, or any GitHub news-publishing workflows. Do not paste Supabase service-role/secret keys into your website. `community.js` uses your existing public publishable key with RLS.

Commit and wait for Cloudflare to deploy. Visit `https://standalonenews.com/discuss.html`.

## 4. Enable your moderator account

You must sign in at least once through your existing Standalone News reader account so your email exists in **Supabase Authentication → Users**. Then use Supabase **SQL Editor** to run this command, substituting YOUR actual sign-in email address. Do not put your email in GitHub SQL files:

```sql
INSERT INTO public.community_moderators (user_id)
SELECT id FROM auth.users WHERE email = 'YOUR_READER_ACCOUNT_EMAIL'
ON CONFLICT DO NOTHING;
```

Refresh the Discuss page or sign out/in. You should now see the **Reports** tab. Other readers cannot grant themselves moderator status.

## 5. Test the public experience and security

1. Open Discuss in an **Incognito** window: read General room posts and Discussion Threads without signing in. You should not be able to post.
2. Sign in with the same Supabase reader email. If using a magic link, confirm its redirect returns you to `/discuss.html`.
3. Create a public username. Don't use an email as a username; emails are not publicly displayed.
4. Send a chat message. In another browser, the message should appear via Realtime (or within 30 seconds if Realtime fails).
5. Create a thread, open it, and add a reply. Click **Report** on someone else's content using a second test account; verify the report is visible only to moderators / the reporter.
6. As the moderator, review the report, remove the test message, lock a test thread, mute a test author for 24 hours, and mark a report resolved. Confirm removal for a logged-out visitor.
7. From a logged-out browser, ensure requests to INSERT `community_messages` and `community_threads` fail. From a normal reader account, ensure you cannot update other users' content or create `community_moderators` rows.
8. On iPhone, confirm no horizontal page overflow and all navigation controls work.

## Moderation and limitations

- This is a **public, user-generated community**. Its posts are not editorially fact-checked or endorsed by Standalone News.
- Public read, signed-in post; one public username per account, with reserved-name filtering; messages (600 chars), thread titles (8–150), threads (3,000), replies (1,500).
- Real-time Supabase changes plus 30-second fallback, five rooms: General, Politics, Markets, World, Technology.
- Users can report spam, threats, impersonation, potentially misleading content, or harassment. Reports are stored privately and visible to moderators and their reporters; moderators can hide content, lock threads, and mute authors for 24 hours.
- Posting quotas are checked **inside the database**: messages 6s/50 per hour; threads 40s/8 per hour; replies 8s/45 per hour; reports 8 per hour. They help but do not replace spam screening or human moderation.
- **No AI moderation is active.** You need to check the moderator queue, establish a clear response policy, and consider Cloudflare Turnstile or stronger abuse protections if growth attracts spam.
- Individual user posts are permanently stored until moderation, deletion, or an administrator handles an erasure request. There is no automatic retention/deletion schedule and no user self-delete control in this version.
- Costs can stay within Supabase's free usage limits for a small audience but **$0 is not guaranteed** as realtime fanout, database usage, or bandwidth grows.
- This package was tested locally and statically. **It has not been connected to your live Supabase database or deployed to your live GitHub/Cloudflare site.** Production RLS, network, permissions and moderation must be tested after setup.

## Rollback

If the page causes trouble, restore the prior homepage `index.html` (and `privacy.html` if needed). `community.sql` only adds `community_*` tables/functions and a Realtime publication entry. If you want to shut down posting without removing the database, unpublish `discuss.html` / remove Discuss links and tighten access policies in Supabase; do not disable your main account project.
