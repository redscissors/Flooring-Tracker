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
