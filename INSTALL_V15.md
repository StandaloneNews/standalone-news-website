# V15 — Dedicated Personalized Reading Desk

Upload these six files to the **root** of the existing GitHub repository, replacing only the matching files:

- `index.html` (homepage sections reordered; Reading Desk removed)
- `newsroom.css` (unchanged baseline, included to avoid version confusion)
- `newsroom.js` (unchanged baseline; still supports home brief and publisher follow controls)
- `personalize.html` (new dedicated page)
- `personalize.css` (new)
- `personalize.js` (new)

The homepage order is Featured → What matters → Latest Wire → Markets → Markets & economy / Politics → Context desk / explainers → Five-story brief → Newsletter. The site's existing other content is retained.

The separate page at `/personalize.html` reads and writes the **same device-local preference keys** as the existing site. Readers can follow topics and publishers and read the matching latest source-linked headlines. This is not cloud synchronization; saved article syncing and account JS are unaffected. The personalization page does not independently expose saved articles.

Do not replace `accounts.js`, `account-config.js`, `markets-fix.js`, `newsletter.js`, any backend Worker, or publishing workflow. Allow Cloudflare deployment and check the For You link and mobile navigation.
