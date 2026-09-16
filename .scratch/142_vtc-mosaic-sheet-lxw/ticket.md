---
issue_type: Bug
summary: "The 9/16 Tuscany flag (Marcus): a VTC hex mosaic whose only printed
  L×W is its backing sheet (\"HEXAGON MOSAIC 10X12\") imported as a 10×12 tile,
  so the job line showed no sheet size and ordered loose area. The import now
  files a mosaic's L×W as the sheet when its area matches the row's per-piece
  coverage (ADR 0014 amendment)."
status: done
labels: [ready-for-human]
---

# VTC Tuscany hex mosaic — "no sheet size" (Marcus, 9/16)

Central Claude issue off the job line: Bathroom Remodel · Area 1 · Tuscany
White Hexagon Mosaic `VTCTUWHMOSHEX`, note "no sheet size". Owner supplied the
current VTC EFT file (`CTNS_EFT_26_01_15_3.xls`, 10,013 rows) so the row could
be read exactly. Preview proof: `preview-book-page.png` / `preview-book-row.png`
(the real `BookDetail` over the real pick path, `preview.html`, `shoot.mjs`).

## What the sheet says

```
v  VTC  TUWH  MOSHEX  VTCTUWHMOSHEX  TUSCANY WHITE HEXAGON MOSAIC 10X12  TUSCANY  READY SHIP  23.44  PC  PC  5  4.09
```

4.09 SF/CT ÷ 5 PC/CT = 0.818 sf per piece ≈ 10 × 12 in² (0.833 sf). The
`10X12` is the backing sheet; the description names no chip at all. Its
siblings: `TUSCANY WHITE HEXAGON 9X11` (a real 9×11 hex floor tile, 10.44 SF/CT
÷ 20 = 0.522 sf ≈ 9×11 hex) and `TUSCANY WHITE 2X2 MOSAIC` (a 2×2 chip on a
~1 sf sheet).

## Why the row had no sheet size

ADR 0014 only files a sheet size from an explicit `(9X11 SHEET)` / `13X13 SHT`
token, and `(12X10/SH)` packaging tokens are stripped. This description has
neither, so `SIZE_RE` took `10X12` as the tile L×W. Driven through the real
import + pick (`parseMapped` → `stockPatch`) the row landed as:

```
size "10x12"  sheetSize ""  →  L 10 · W 12 · no sizeText · no cartonSf (PC → loose exact-area)
```

A 10×12 "tile" for grout/mortar, no "sheet" anywhere, and no whole-sheet
rounding.

## The rule (owner approved 2026-09-16; ADR 0014 amendment)

Position can't decide it — 234 mosaic rows on the same sheet print the CHIP in
that spot (`BOOST GREY MOSAIC 2X2`, `MOS 2X12`). Coverage can: a mosaic's piece
is its sheet, so when the printed L×W's area matches `SF/CT ÷ PC/CT`, the L×W
is the sheet. On the real file the ratio is bimodal — sheets 1.0–1.8×, chips
≤ 0.17×, nothing between — so **≥ 0.5 decides**; no coverage → no change.

`src/pricebook.js` `mappedItem`: after the description split, a MOS/MOSAIC row
with a plain L×W size, no `sheetSize` yet and a known `sfPerUnit` moves the
L×W to `sheetSize` when `L×W/144 ≥ 0.5 × sfPerUnit ÷ (pcPerUnit or 1)`.
Everything downstream is ADR 0014 as already built:

```
size ""  sheetSize "10x12"  →  sizeText "10x12 sheet" · L×W blank (＋ add size for grout)
cartonSf 0.818 · cartonUnit PC (the vendor's own No-Broken unit) · $28.66/sf cost
order entry: 10x12" (hover: 10x12 sheet) · 0.818 SF/PC · 42 sf → 57 PC
```

## Effect on the real file (before/after diff of all 10,013 rows)

Exactly 34 rows change, all backing sheets:

- 7 × VTC Tuscany hex mosaics `HEXAGON MOSAIC 10X12` (4.09/5)
- 18 × ISA Shibusa `INTRECCIO / LOSANGA MOS 12X12` (4.84/5) and
  `BACCHETTE MOS 12X24` (11.63/6)
- 4 × VTC Orleans `INTERLOCK HEX MOS 12X10` (4.56/10 — interlocking, net
  coverage under the outline)
- 5 × CAE Quartz Essence `COMP P MOS 12X15` (5.29/5)

Every other row imports identically. Not touched: the Regina `1" HEX MOS
1-1/2X1-1/2 (12X10/SH)` rows — a real chip beside a packaging token; ADR
0014's "chip wins" stands, and carrying both is a separate decision.

## Takes effect on re-import

Re-drop the VTC EFT file: the wizard diff will show the 34 rows (size moves
to sheet size). Marcus's Bathroom Remodel line keeps its 10×12 snapshot until
`VTCTUWHMOSHEX` is re-picked on the row (ADR 0003 — size never drifts). Then
type the hex chip once in the "＋ add size for grout" box.

## Verification

- `npm test` — 1456/1456 passing. New: the coverage rule across the seven
  spellings above (pricebook.test.js), the Tuscany pick (stock.test.js), the
  order-entry line end-to-end (print.test.js).
- `npx eslint` clean on every touched file.
- Preview: `preview-book-row.png` — `10x12 sheet · Tuscany White Hexagon
  Mosaic · SHEET SIZE 10x12 · 0.818 SF/PC · PC · $41.55/sf`.
