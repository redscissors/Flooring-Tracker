Status: done

# Schluter round 8 — print layout + Copy for order entry (inventory E10/E11)

The last two "get the build off the screen" gaps from the issue-105 ledger:
wedi prints a layout sheet and copies an order-entry list; Schluter's footer
had one button.

## What landed

- **Print layout** (the wedi sheet, ported): a `.sch-printsheet` portal —
  header (title · project name · date), BOTH drawings rendered a second time
  at print size (TopDown + Iso with the full prop set, so benches, corner
  cuts and the diagonal curbs print exactly as drawn), the cut list + the
  by-others noteOnly lines under "Cuts & install notes", and a Materials
  table (SKU / Description / Size / Qty / tier / Total by group) with the
  lines-and-total footer. PRINT_CSS hides it on screen and makes it the ONLY
  thing that prints; the print effect unmounts on afterprint with the
  2.5s fallback timer (the wedi Safari rule). Button beside Add, disabled
  until a room is drawn.
- **Copy for order entry**: `orderCopyLines` (schluter.js, tested) — stocked
  lines key as the shop's SKU ⇥ qty (erp, falling back to the row's own sku
  for live registry rows), special-order lines go by description
  (sku — brand-led name × qty), noteOnly placeholders never reach the
  clipboard. The button toasts the copy result; a blocked clipboard points
  at the print sheet.

## Proof

`shoot.mjs` (vite on :5199 + schluter-preview.html, clipboard perms):
- `p1-order-entry-copied.png` — the copy toast; the rig echoes the actual
  clipboard: 13 stocked lines as `SKU⇥qty`
- `p2-print-sheet.png` — the print-media render: both drawings with the
  corner-cut diagonal curbs, cuts & notes, the full materials table,
  "13 lines · retail total $1,034.40"

Tests: 1120 pass (orderCopyLines: SKU⇥qty / description / noteOnly-drop /
erp-fallback). `npm run build` clean.
