# Standalone News — New Edition (October 2026)

This is a design-layer update based on the website archive uploaded on October 17, 2026. It is **not installed on the live site**.

## What changed

- A clear, editorial homepage with simplified navigation, a more prominent lead story, and more readable, separated content chapters.
- The main reading journey now goes: lead story → featured reporting → news wire → explainers → daily brief → markets → economy and policy → community → newsletter.
- Consistent type, spacing, surfaces, cards, and keyboard focus across Markets, Discuss, For You, article archive, official-source explainers, and secondary informational pages.
- The generated article template was updated to retain the new interior design on subsequent automatic publications.
- The GitHub-side newsletter unsubscribe fix is preserved in the **full backup**. The design overlay **does not replace** the live newsletter script, credentials or workflows.

## Safe deployment — use the PATCH archive

The PATCH archive contains changed **presentation files only**, plus the article template `scripts/auto_publish.py`. Copy these files over the same paths in the **current GitHub main branch**, review the diff, then commit. Do not wipe the repository and do not replace the `data/` folder or the GitHub Actions workflows.

Before merging, especially check whether production `index.html`, interior pages, and `scripts/auto_publish.py` received new changes after the Oct 16 backup. If so, merge those changes rather than blindly overwriting them. This is an overlay based on the supplied archive, not a synchronized copy of the live branch.

### Verify after deployment

1. Desktop (large and small), iPhone-sized and Android-sized screens: navigation, no horizontal overlap, legible market rows.
2. News wire searching/topic filters; lead story, top stories and save/unsave buttons.
3. Supabase account login, bookmark syncing and community chat/threads.
4. Newsletter signup/confirmation and generated unsubscribe URLs (do not send bulk test emails).
5. Markets TradingView widgets and source links; note some quotes may be delayed or blocked by third-party content restrictions.
6. Check a newly generated explainer to ensure `refresh-interior.css` loads and AI/source disclosures remain visible.
7. Review WCAG contrast, keyboard-only navigation and responsive content in the real hosting environment.

## Local previews

The PNG previews use source-attributed headlines from the uploaded archive and **do not represent current live reporting**. Their market ticker widgets are static placeholders. Preview rendering was done from inlined CSS because the available test browser blocks local/remote navigation.

## QA performed

- HTML parsed and essential homepage hook IDs retained.
- `refresh-2026.css` and `refresh-interior.css` parsed without top-level errors.
- 390px and 1440px layout previews had no horizontal document overflow.
- Python newsletter/auto-publisher code compiled.
- Existing Node newsletter unit tests passed (3/3).
- Existing Python tests ran 18 tests; 1 unrelated `test_rss_publisher_metadata` failed on the unchanged original feed parsing code. A full live integration test was not possible.

No paid UI assets or designs were copied from Refero. It is used as inspiration for visual hierarchy, clean cards, editorial typography and responsive navigation.
