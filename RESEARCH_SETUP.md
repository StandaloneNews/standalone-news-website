# Standalone News — Company Research Desk

The new public page is **/research.html**. It is separate from /markets.html and keeps the
TradingView chart available. It does not replace your news/feed/community software.

## What's available immediately

- Responsive Company Research interface with a TradingView advanced stock chart
- Popular tickers and ticker/company search
- Official SEC EDGAR links for any entered ticker, and official companyfacts where the CIK is known
- Current source-linked company news from `data/news.json` and `data/desk.json`
- Links to House and Senate financial disclosures, plus earnings resources
- Transparent warnings when a given SEC dataset isn't populated

## Activate fresh SEC filing data (required, one-time)

SEC fair access asks automated requesters to identify themselves with a monitored email.
In GitHub: **Settings > Secrets and variables > Actions > New repository secret**.

- **Name:** `SEC_USER_AGENT`
- **Value:** `Standalone News Research Desk you@your-domain.com`
  Replace `you@your-domain.com` with **an actual email you monitor**. Do not use
  someone else's address or a nonexistent inbox.

Then go to **Actions > Refresh SEC company research > Run workflow**.
The workflow also checks periodically (every 6 hours) thereafter.

The collector performs all SEC requests in GitHub Actions, **not in visitors' browsers**,
with controlled request rates. The script writes:
- `data/research-companies.json`: SEC ticker/name/CIK associations for site search
- `data/research-snapshots.json`: original-form URLs for selected popular issuers

The popular company coverage is deliberately bounded. For all other tickers, the page
still provides an interactive TradingView chart, headlines, and original SEC search links.
No fake company filings, transactions, financial figures or dates are generated.

## Important interpretation

- A Form 4 is **not necessarily a buy**; it can report awards, sales, exercises, tax withholding or transfers. The page links to the original document instead of guessing transaction codes.
- A Form 13F from a particular filer does not list *all institutions holding the issuer*; company-wide institutional ownership requires a separate, licensed or fully reconciled 13F dataset.
- House and Senate STOCK Act disclosures are linked to their official portals, not displayed as verified ticker-specific trades.
- Financial statements can be read from 10-K, 10-Q, and the SEC's public companyfacts JSON. The page intentionally does not display unverified numbers.
- Data from TradingView is separately attributed and subject to exchange delays.

## Verification

You can run `python scripts/update_research.py --self-test` locally (no network needed).
If the SEC User-Agent secret is missing, the scheduled collector safely exits with a warning
and leaves the last data unchanged. If SEC API fetching fails, existing valid records are retained.

## Architecture

No extra data vendor or Supabase tables. Static site files under GitHub with
Cloudflare hosting; Python stdlib-only GitHub Actions for official SEC ingestion.

## Planned enhancements

Transaction-level XML parsing for P/S Form 4 codes, issuer-cross-referenced
institutional holdings, real financial metric tables, congressional filing
normalization, and saved company alerts should be implemented only after
source/coverage checks and additional testing.
