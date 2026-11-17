"""Apply site-wide keyboard navigation and legal links to published HTML."""
import re

LEGAL_LINKS = (
    ("/terms.html", "Terms of use"),
    ("/privacy.html", "Privacy policy"),
    ("/newsletter-privacy.html", "Newsletter privacy"),
    ("/accessibility.html", "Accessibility"),
    ("/contact.html", "Contact"),
)
CHROME_CSS = '<link rel="stylesheet" href="/site-accessibility.css?v=1">'
MAIN_TAG = re.compile(r"<main\b[^>]*>", re.I)
ID_ATTRIBUTE = re.compile(r'''\bid=["']([^"']+)["']''', re.I)
FOOTER = re.compile(r"<footer\b[^>]*>[\s\S]*?</footer>", re.I)


def with_site_chrome(page: str) -> str:
    """Return a public page with working skip navigation and legal footer links."""
    main = MAIN_TAG.search(page)
    if main is None:
        return page
    tag = main.group(0)
    main_id = ID_ATTRIBUTE.search(tag)
    target = main_id[1] if main_id else "main-content"
    if main_id is None:
        tag = tag[:-1] + f' id="{target}">'
    if "tabindex=" not in tag:
        tag = tag[:-1] + ' tabindex="-1">'
    page = page[:main.start()] + tag + page[main.end():]
    if CHROME_CSS not in page:
        page = page.replace("</head>", CHROME_CSS + "\n</head>", 1)

    has_skip = any(
        re.search(r'''\bclass=["'][^"']*\b(?:skip-link|skip|site-skip-link)\b''', anchor)
        and re.search(r'''href=["']#''' + re.escape(target) + r'''["']''', anchor)
        for anchor in re.findall(r"<a\b[^>]*>", page)
    )
    if not has_skip:
        skip = f'<a class="site-skip-link" href="#{target}">Skip to main content</a>'
        page = re.sub(r"<body\b[^>]*>", lambda match: match[0] + skip, page, count=1)

    footer = FOOTER.search(page)
    existing = footer[0] if footer else '<footer class="site-policy-footer"></footer>'
    missing = [
        (href, label) for href, label in LEGAL_LINKS
        if not re.search(r'''href=["'](?:\.\.?/|/)?''' + re.escape(href.lstrip("/")) + r'''["']''', existing)
    ]
    if missing:
        links = "".join(f'<a href="{href}">{label}</a>' for href, label in missing)
        nav = f'<nav class="site-legal-links" aria-label="Legal and accessibility">{links}</nav>'
        updated = existing[:-len("</footer>")] + nav + "</footer>"
        page = (page[:footer.start()] + updated + page[footer.end():]) if footer else (
            page.replace("</body>", updated + "\n</body>", 1)
        )
    return page
