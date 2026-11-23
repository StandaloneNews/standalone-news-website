# Standalone News — Accessibility QA record

Baseline run: **November 23, 2026 (UTC)**

## Verified in automated tests

- **93 publicly served HTML pages**, including 71 published explainers, scanned at 390 CSS pixels with axe-core using WCAG 2.2 Level A and AA rule tags.
- **16 important destinations**, including news, markets, sports, community, research, legal and data desks, scanned at 1440 CSS pixels.
- No automated violations after remediation. No horizontal overflow in the 390-pixel scan.
- Reading Edition checked at **320, 390, 768, 1280, and 1600 CSS pixels** for responsive layout and source-order navigation, a single top-level heading, keyboard-operated Daily Brief, terminal positioning, and working section jump links.
- The audit fixed undersized Community footer link targets, an ARIA label on an undefined market ticker container, and a prohibited ARIA attribute on a TradingView custom element. The Reading Edition's centered column is intentional for readability.

## Limits — no claim of ADA certification

Automated axe tests are **not proof of full WCAG 2.2 AA or ADA conformance**. The audit disables remote third-party resources, so it cannot test embedded charts, calendars or X content once their code runs. New dynamic states, animations, form errors, assistive technology interpretation, text resizing, and external linked publisher websites require human evaluation.

## Manual release checklist (outstanding)

- [ ] Complete reading and navigation tests with NVDA + Chrome on Windows and VoiceOver + Safari on iOS/macOS
- [ ] Review heading order, landmark names, button announcements, dialog open/close focus restoration, and live-region announcement frequency
- [ ] Navigate every primary workflow using only Tab, Shift+Tab, Enter, Space and Escape
- [ ] Reflow and check text clipping at 200% and 400% browser zoom, including search, community forms and newsletter signup
- [ ] Review contrast on normal, hover, focus, visited, validation-error and disabled states
- [ ] Audit real third-party TradingView/X widgets as loaded in production and provide accessible alternatives when needed
- [ ] Test screen reader labels for live market changes and sports scores, including auto-refresh without focus loss
- [ ] Invite a small number of people who use assistive technologies to exercise the site

## Ongoing automation

The GitHub Actions workflow `.github/workflows/edition-accessibility.yml` runs on relevant code changes and weekly on Mondays. It uploads a JSON scan report as a workflow artifact and fails on serious or critical axe findings, rendering errors or horizontal clipping.

References: [WCAG 2.2](https://www.w3.org/TR/WCAG22/) · [W3C evaluation guidance](https://www.w3.org/WAI/test-evaluate/) · [ADA.gov website accessibility guidance](https://www.ada.gov/resources/web-guidance/).
