# Standalone News V18 — Join the Discussion below Latest News Wire

## Install — one file only

1. Download and extract `Standalone_News_Homepage_Discussion_V18.zip`.
2. In GitHub, open your Standalone News website repository, then open its root `index.html`.
3. Replace the contents of that `index.html` with the `index.html` from this ZIP. Commit the change to `main`.
4. Wait for Cloudflare Workers' connected GitHub deployment to complete, then reload `https://standalonenews.com/` (force-refresh if necessary).
5. Scroll past the **Latest news wire** headlines. The dark navy **Read the news. Then discuss it.** callout should appear immediately before **Markets, Futures & Bonds**.
6. Test the red **Join the discussion** link. Test the Politics and Markets room chips, which should open the correct room.

## What it changes

- Adds a responsive discussion invitation immediately below the Latest News Wire section.
- Adds direct links to five existing community rooms through `discuss.html?room=...`.
- Uses scoped CSS embedded in the updated `index.html`: **no `newsroom.css` or JavaScript changes needed**.

## What it does not change

- Does not modify Supabase SQL, keys, newsletter APIs, sign-in, article/news-wire JavaScript, markets widgets, or the existing `discuss.html`/`community.js` files.
- It assumes the V17 Discuss page has been installed. If `discuss.html` has not yet been deployed, the links won't work until you upload it.

**Important:** This updated `index.html` is built on the V17 homepage version, which itself includes the V16 Latest Wire updates. If you have separately edited your live homepage since deploying V17, merge just the V18 callout into that file rather than overwriting those newer changes.
