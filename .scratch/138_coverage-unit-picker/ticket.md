---
issue_type: Feature
summary: The SF/CT, PC/CT and EA tags on a product row are pickers, so a
  hand-typed tile sold by the sheet (or roll, box, bundle, pack) no longer
  quotes and orders in cartons.
status: done
labels: [ready-for-human]
---

# Unit of measure on a hand-typed row

Owner, 2026-09-14: "I would like to be able to [set] the unit of measure of
the coverage. If I manually enter a tile sold by the sheet, there is no way to
have it not show as by carton."

The row already stored `cartonUnit` (default CT) and `sellUnit` (blank = EA),
and a price-book pick filled them with the vendor's word (stock.js
`stockPatch`). A hand-typed row had no control, so its coverage tag read
SF/CT forever and the estimate said "50 cartons" for a mosaic bought by the
sheet.

Decision (owner, same day): coverage unit AND count unit both become
pickers, on the desktop grid and the mobile sheet.

## What changed

- `src/units.js` — `BUNDLE_UNITS` (CT SH BX BD RL PK) and `COUNT_UNITS`
  (EA PC SH RL BX CT BD PK BG GL): the codes the pickers offer, all from the
  table so a pick reads like a book's snapshot (units.test.js).
- `src/grid.jsx` — `UnitPick`: the muted chip the tags were, as a native
  `<select>` (dotted underline says it opens; tabIndex -1 so the tab flow
  through a row is unchanged). A value outside the list (a vendor's own code
  on a picked row) is injected as an option so the select never re-labels a
  snapshot by itself.
- `src/App.jsx` — the SF/… tag on a sq-ft row and the PC/… tag on a misc row
  write `cartonUnit`; the count-unit tag beside the qty writes `sellUnit`
  (EA → blank, the default the row already had).
- `src/mobile.jsx` — the same three, on the row sheet's Coverage field and
  the Quantity label.

No data-model change: both fields exist and `normP` already normalizes them.
`getCarton` / `getPieceCarton` / `printProduct` / `orderEntryRow` already
read the fields, so the Order column, the printed estimate and order entry
follow the pick with no further change.

## Proof

`01-before.png` / `02-after.png` — three hand-typed rows (mosaic 1.06 SF,
trim 6 PC, a Kerdi-Band count line) before and after Playwright picks SH /
PK / RL: the Order column reads 50 sheets · 18 pcs (3 packs) · 3 rolls, and
`printProduct` reads `50 sh` / `18 pcs (3 pk)` / `3 rl · $42.00/rl`.
`03-phone-before.png` / `04-phone-after.png` — the real MobileRowSheet, its
Coverage tag flipped to SF/SH and the Order stepper reading `sh`.

Rebuild: `npx vite build --config .scratch/138_coverage-unit-picker/proof-vite.config.mjs`,
serve `proof-dist` on :8392, then `node .scratch/138_coverage-unit-picker/shot.mjs`.
`proof-dist` is never committed.
