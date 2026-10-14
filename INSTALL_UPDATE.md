# Deploying the Standalone News accessibility redesign

This is a **front-end update** for your existing GitHub repository `StandaloneNews/standalone-news-website`.

### Upload these files to the repository root

- `index.html`
- `about.html`
- `accessibility.html` (new)
- `styles.css`
- `app.js`

Replace the existing files of the same name, commit to the `main` branch, and check that your Cloudflare Worker automatically redeploys. You do **not** need to change your domain's GoDaddy nameservers or Cloudflare Worker custom domain settings.

**Do not delete or overwrite** your live `data/news.json`, `data/editorial.json`, `.github/workflows/refresh-headlines.yml`, `scripts/`, `assets/` or Cloudflare configuration. This update deliberately does not contain those files.

### After deploying

1. Confirm the newest Cloudflare deployment shows **Ready**.
2. Check https://standalonenews.com on desktop and mobile; verify headlines load and search/categories work.
3. Test the optional examples at https://standalonenews.com/?demo=1 — these show an explicit preview warning and are not real breaking news.
4. Run Lighthouse, axe/WAVE, keyboard-only navigation, screen readers (NVDA/VoiceOver), and zoom/reflow tests on the **live domain** before claiming legal or WCAG conformance.

**Accessibility target:** WCAG 2.2 AA. This is not a certification of ADA compliance. Content on third-party websites is outside our control.
