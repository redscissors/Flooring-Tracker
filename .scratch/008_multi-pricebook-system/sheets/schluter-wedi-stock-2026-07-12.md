# Test sheet analysis: Schluter + Wedi shop stock sheets

Two shop-maintained *stock* sheets provided 2026-07-12 (`Schluter_stock_3.xlsx`,
`NEW_Wedi_Price_Sheet_316_2.xlsx`). Raw files not committed (shop pricing).
These are the Q4 scenario ("possibly more stock workbooks") arriving on day
one — and they are a different animal from the VTC vendor sheet: same layout
family as the main stock workbook, shop SKUs, retail prices.

## Shape

Both use the main workbook's own table idiom — section-title rows, then a
header row `SKU | Description | Mfg SKU | U/M | Retail Price | Notes`, then
item rows with 5-7 digit shop SKUs (the existing `/^\d{4,8}$/` matches all of
them; zero overlap between the two files' SKUs).

- **Schluter**: 1 data sheet ("Retail"), 107 items (Kerdi trays, linear
  drains, boards, bands…). U/M: EA, BX, TB, RL, BG, SH.
- **Wedi**: 4 sheets — "Retail" (109 items) + "Wedi S-Dry Retail" (33), each
  shadowed by a **"Contractor" twin with the same SKUs at 0.82 × retail**
  (exact ratio on all 109 main items; S-Dry ranges 0.82-1.00, a few items
  price the same in both tiers). The 0.82 multiplier literally sits in a cell
  on each contractor sheet. Wedi data starts one column right of Schluter's.

## Measured: the CURRENT app parser already eats these

Ran `parsePriceBook` (the real `src/pricebook.js`, unmodified) over both
workbooks' arrays:

| File | Items parsed | Warnings | Prices |
|---|---|---|---|
| Schluter | **107 of 107** | none | **all null** |
| Wedi | **142** (109 + 33; contractor twins deduped away) | none | **all null** |

Sections, SKUs, descriptions, and units all come through correctly. Prices are
null for one reason only: the header says **"Retail Price"**, which collapses
to `retailprice` — not in `HEADER_FIELDS` (which has `retail` and `price`).
**A one-line alias (`retailprice: "price"`) makes both files import fully.**
Secondary polish: a `mfgsku` header mapping would keep the manufacturer SKU
("KST965/1525", "US9100001") as a searchable field instead of letting it fold
into the description via the extra-text rule.

Caveat once prices parse: Wedi's Retail and Contractor sheets carry identical
SKUs with different prices, so the dedupe rule would keep the first-priced
occurrence (Retail — correct) but emit ~109 "listed twice with different
prices" warnings. The contractor sheets must be excluded from what gets
imported (don't paste them / skip them in mapping).

## Recommendation for these two files

**Bridge (available almost immediately, before the registry exists):** add the
`retailprice` header alias (+ optionally `mfgsku`), and the team pastes the
*Retail* pages into the main stock workbook as new pages. The existing import
then consumes them end-to-end — search, snapshot, drift, catalog sync all just
work. No schema, no new UI.

**Destination (once the §2 registry ships):** each file becomes its own
`kind='stock'` registry book with its own saved mapping, versions, and
staleness chip — matching how the shop actually maintains them (separate
files, separate update cadence; Schluter's says "updated 4.30.2024").

Cross-stock-book SKU collisions (same shop SKU in two stock books) should be
an import-preview warning; shop SKUs are one namespace, so a collision is a
data error to surface, not a ranking problem.

## New design question raised — price tiers

The Wedi file proves the shop maintains **two selling tiers: retail and
contractor (0.82 × retail, with per-item exceptions).** FloorTrack has one
price per item and no job-level pricing concept. Logged as **Q5** in
`design.md`: capture tier prices at import (cheap, the data is right there) —
but whether/how a *job* selects a tier (flat multiplier vs per-item tier
prices, likely tied to the ADR-0005 Builder hierarchy, since builders are
contractors) is its own decision, not something to sneak into the price book
work.
