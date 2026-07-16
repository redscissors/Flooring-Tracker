# ADR 0013 — Unit-combo pricing: piece prices scale by PC/CT; unknown combos warn at import

- **Status:** Accepted
- **Date:** 2026-07-14
- **Scope:** system-wide (pick snapshot, order-book pricing, mapped import)
- **Related:** amends [ADR 0009](0009-price-book-library.md) §2/§3 (two-U/M
  split, cost basis) and the sheet-coverage amendment shipped in PR #105;
  builds on [ADR 0003](0003-stock-price-book-snapshot.md)'s snapshot doctrine.

## Context

The 2026-07-14 audit of the real VTC EFT book (6,792 rows) found the two-U/M
model (Price U/M = cost basis, No Broken U/M = sell unit) was only ever taught
the SF-priced combos. Piece-priced rows broke two ways:

1. **~1,216 rows underpriced 1–20×.** `costSqft` divided the cost by SF/CT —
   a per-CARTON area — regardless of the cost's own unit. A $27.99/pc bullnose
   in an 8-pc, 5.38-sf carton priced at $5.20/sqft instead of $41.62
   (`CTIEPLIBN336R`). Every PC/EA/SH-priced row with SF/CT was wrong; the same
   error hid in mosaics "cheaper per sqft than their field tile."
2. **~640 rows landed as silent $0 sqft lines.** A typed, piece-priced,
   carton-sold row with no SF/CT (`CDSTABABN240R`) took the flooring branch on
   the strength of its `CT` order unit alone, with no price at all.

Nothing systemic guarded this: the unit tests asserted hand-picked combos, and
an import could carry a combination the code had never priced without anyone
knowing.

## Decision

1. **A piece-ish price (PC/EA/SH/ST) scales by PC/CT before any SF/CT math.**
   In a book that carries `pcPerUnit`, SF/CT is per carton while the price is
   per piece, so $/sqft = price × pcPerUnit ÷ sfPerUnit (`perCartonFactor` in
   stock.js, used by both `costSqft` and `stockPriceSqft`). Books without
   `pcPerUnit` (the stock workbook's per-sheet mosaics) keep the old per-unit
   read — the factor is 1.
2. **A typed item with no derivable $/sqft and no coverage is a count line,
   not a flooring line** (`fillsFlooring` gate). When its sell unit is a
   carton (`No Broken = CT`), the count line prices per CARTON — piece price ×
   PC/CT (`sellUnitFactor`) — with "carton of N" in the description, so the
   quantity entered is what the vendor actually sells. Cost snapshots
   (`rowCostSqft`) and drift (`orderDrift`) follow the same factor, keeping
   the margin honest.
3. **The truth table owns the combos.** `src/unitcombos.test.js` holds one row
   per {Price U/M × No Broken × has-SF/CT × has-PC/CT} shape a real sheet has
   produced, with golden values from real VTC rows. Teaching the code a new
   combo starts by adding its row there.
4. **Imports warn on combos outside the rules.** `unitComboWarnings`
   (orderbook.js, called by `parseMapped`) tallies rows the pricing code can't
   handle honestly — no price, $0 price, piece-priced/carton-sold with no
   PC/CT mapped, unfamiliar sell units — and names them (with sample SKUs) in
   the import wizard before anything applies. Rule-based, not a whitelist, so
   single-U/M books stay quiet.

## Consequences

- Saved estimates keep their snapshotted (wrong) prices by design (ADR 0003);
  the drift chip now reports the corrected book price on re-open, and applying
  it is the salesperson's deliberate act.
- On the 25-07-28 VTC file: 6,737 of 6,792 rows price correctly end-to-end;
  the 55 rows the vendor lists at $0 are named by the wizard instead of
  landing silently free.
- A future book with genuinely new unit semantics will announce itself as a
  wizard warning instead of mispricing quietly.

## Amendment (2026-07-15): the quote frame follows the product kind, not the units

The 25-07-28 file exposed the rule this ADR missed: **units tell you how to
convert; they cannot tell you which frame to quote in.** A bullnose and a field
tile can carry identical unit signatures (priced PC, No Broken CT, real SF/CT
and PC/CT), yet a salesperson counts trim in pieces and measures tile in square
feet. Worse, vendors stamp *notional* coverage on trims — `ADXNEBLBASE12EDS`, a
12" base-board end cap, carries SF/CT 121.1 (45 pcs × 1 m² each), which the
fillsFlooring gate read as real coverage and priced at $13.32/sqft against a
$23.89/pc cost — below its own cost, on a quote.

Decision, amending §Decision:

1. **A piece-priced trim is a count line even when SF/CT is present.** The
   salesperson enters *pieces needed*; a carton-only sell unit (No Broken = CT)
   rounds that count up to whole cartons of PC/CT (the piece-count twin of
   `cartonSf`), and the line totals pieces-bought × piece price. SF/CT on a
   trim row is ignored for pricing. Mathematically identical totals to the
   $/sqft frame when the coverage was honest — the change is which unit the
   human types, plus immunity to fabricated coverage.
2. **Trim detection is a layered classifier at import time** (mappedItem),
   first match wins: (a) mosaic/sheet guard — mosaic words, a sheet unit, or a
   `(NxN/SH)` token mean genuine sqft product, never reclassified (the 2026-07
   geometry audit found mosaics are the dominant false-positive source, 263 of
   374 high-ratio rows); (b) a bilingual trim lexicon — English plus the
   Italian vendors actually write (gradino, angolo/angolare, scalino,
   battiscopa, fascia, torello), which alone sees the ~280 honest-coverage
   stair/step pieces no numeric test can catch; (c) cost-inversion — derived
   $/sqft cost below the per-piece cost (227 rows, language-independent);
   (d) notional metric SF/CT (≈ 1 / 0.5 / 2 m²) combined with a geometry
   mismatch against the parsed size. Rows nothing fires on keep today's
   behavior, and every reclassified row is listed for review in the import
   wizard before apply.
3. **A geometry ratio is NOT the classifier.** Tested on all 6,792 rows:
   stated-vs-computed coverage fails both directions (mosaics explode the high
   side because the description names the chip size; honest-footprint trims
   sit at ratio ≈ 1.0). It survives only as a low-tail signal inside (d).
4. **Reclassified items set `trim: true`** (the ADR 0012 Mannington flag), so
   the book's trim markup applies to them and the pick lands on the existing
   count-line path — no new pricing machinery.
5. **Drift guards the frame change:** a saved row snapshotted as $/sqft whose
   item now sells per piece must say so instead of comparing prices across
   frames.

Shipped ahead of the classifier: the `area-below-piece-cost` import advisory
(rowAdvisories), the language-independent tripwire that flags any piece-priced
row whose derived $/sqft cost lands below its own piece cost — under water at
any markup — with the same mosaic/sheet exemption as (a).
