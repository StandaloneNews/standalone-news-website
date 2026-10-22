"""Focused static accessibility regression checks for Standalone News.

Not a full WCAG/ADA certification: manual keyboard, screen reader, zoom, and
rendered contrast audits are still required before claiming conformance.
"""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(filename):
    return (ROOT / filename).read_text(encoding="utf-8")


def luminance(value):
    rgb = [int(value[i:i+2], 16) / 255 for i in (1, 3, 5)]
    linear = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return sum(a * b for a, b in zip((0.2126, 0.7152, 0.0722), linear))


def contrast(foreground, background):
    values = sorted((luminance(foreground), luminance(background)))
    return (values[1] + 0.05) / (values[0] + 0.05)


class StaticAccessibilityRegressionTests(unittest.TestCase):
    def test_small_type_on_paper_exceeds_aa_with_margin(self):
        for background in ("#f9f8f3", "#fffefa", "#ffffff"):
            with self.subTest(background=background):
                self.assertGreaterEqual(contrast("#435864", background), 4.5)
                self.assertGreaterEqual(contrast("#a62e48", background), 4.5)
        self.assertGreaterEqual(contrast("#ffffff", "#122c3d"), 4.5)
        self.assertLess(contrast("#637680", "#f9f8f3"), 4.5)

    def test_reported_edition_note_selector_is_remediated(self):
        css = read("broadsheet.css")
        self.assertIn("body.theme-broadsheet .edition-note > span", css)
        self.assertRegex(css, r"body\.theme-broadsheet \.edition-note > span\s*\{[^}]*color:\s*#435864\s*!important")
        self.assertIn("--bs-muted: #435864;", css)

    def test_market_and_utility_regions_have_landmarks(self):
        html = read("index.html")
        self.assertIn('class="utility" role="region" aria-label="Edition information and social links"', html)
        self.assertIn('aria-label="Market prices" role="region" class="market-strip"', html)
        for path in ("markets.html", "research.html", "discuss.html", "personalize.html"):
            with self.subTest(page=path):
                self.assertIn('<div class="utility" role="region" aria-label="Edition information">', read(path))

    def test_visible_brand_and_account_labels_are_not_overridden(self):
        for path in ("index.html", "markets.html", "personalize.html", "about.html", "accessibility.html"):
            with self.subTest(page=path):
                html = read(path)
                self.assertNotRegex(html, r'<a\b[^>]*aria-label="Standalone News(?:, home| home)"')
        html = read("index.html")
        self.assertIn('class="account-pill" hidden="" id="account-button"', html)
        self.assertNotIn('aria-label="Reader account"', html)
        self.assertIn('aria-describedby="lead-title" class="bookmark-btn"', html)
        self.assertNotRegex(html, r'id="mobile-saved"[^>]*aria-label=')
        self.assertIn('class="brand" href="./index.html"', html)

    def test_dynamic_save_follow_names_start_with_visible_words(self):
        js = read("newsroom.js")
        self.assertIn("(followed?'Following ✓ · ':'+ Follow source · ')+name", js)
        self.assertIn("(saved?'♥ Saved · ':'♡ Save · ')+item.title", js)
        self.assertIn("b.setAttribute('aria-pressed',String(followed))", js)
        self.assertIn("b.setAttribute('aria-pressed',String(saved))", js)

    def test_focus_and_reduced_motion_remain_supported(self):
        css = read("broadsheet.css")
        self.assertIn(":focus-visible", css)
        self.assertIn("prefers-reduced-motion:reduce", css)
        mobile = read("mobile-six.css")
        self.assertIn("min-height:54px", mobile)


if __name__ == "__main__":
    unittest.main()
