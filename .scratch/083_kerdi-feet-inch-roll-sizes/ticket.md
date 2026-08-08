Status: done

Claude issue bucket — Virginia Tile stock book (parked by Marcus, 8/7/2026):
seven Schluter SKUs importing with the wrong size — "3\"x98' Kerdi Membrane"
with a 3" size on a roll that is really 3'3" wide (1509781–1509786, 23031).

Root cause — the ERP export writes roll widths in FEET-AND-INCHES ("3'3\"x98'",
sometimes dotted: "3'.3\"" = 3 ft 3 in), and every size regex in the import
pipeline thought in inches:

- `LEAD_WIDTH_RE` (the stock export's leadWidthSize) treated the foot mark of
  the leading `3'` as an inch mark → size `3"`, name left reading
  `3"x98' Kerdi Membrane…` — which is exactly the "name?" flag Marcus saw.
- `SIZE_RE` did the mid-string equivalent (`5" x 33'` → 5x33 "inches";
  the Aquabar `3'x167'` → a 3x167-inch tile size).
- `parseTileSize` would happily read `3"x98` back out of a feet string, so a
  mis-typed row could run grout/mortar math on a membrane.

Fix (src/pricebook.js, src/stock.js):

- New `FT_DIM`/`ROLL_SIZE_RE`: an L×W with a foot mark on either side is
  roll/linear goods — the whole spelling lands in the size field as free text
  (`3'3"x98'`, `5"x33'`), stripped from the name, dotted spelling normalized
  (`3'.3"` → `3'3"`). Runs before the penny/lead-width/SIZE_RE chain.
- `LEAD_FT_RE`: a leading feet width (`12' Prestige Sheet Vinyl`) keeps its
  foot mark instead of becoming `12"`.
- `floorTypeFromDescription`: a foot-marked size never falls through as a
  bare plank width (no more accidental "hardwood").
- `parseTileSize`: refuses foot-marked strings — no L×W cells, no grout math,
  the book table shows the size as text (`sizeText` path, count line).

Per-SKU outcome once the stock sheet is re-imported (the parse output changed,
so `applyBookImport` upserts these rows and carries the bucket marks):

- 1509781–1509785: size `3'3"x66/33/23'` … `3'3"x16'5"`, clean names — the
  "name?" flag re-derives clean and disappears.
- 1509786: size `6'7"x49'` (6'7" × 49' ≈ 323 sf, matching its coverage).
- 23031 (Ditra Heat sheet): size `3'3"x2'7"` — which is 8.4 sf, so the stored
  SF/SH was never wrong. Its "sf/sh?" flag is the documented false positive
  ("a genuine oversized sheet good trips it once and gets review-muted",
  orderbook.js) — confirm/ignore it in the flag review UI; the verdict is
  carried across re-imports.

Tests: pricebook.test.js (KERDI_WORKBOOK end-to-end, roll-workbook sizes,
foot-guard in floorTypeFromDescription, Aquabar size), stock.test.js
(parseTileSize refusals), orderbook.test.js (bookRowPreview count line with
size-as-text). 918 pass.

No UI/print change; no SQL — the data corrects itself on the next re-import
of the Virginia Tile / Schluter stock export.

---

## Part 2 — Schluter EFT deep dive (owner-supplied SLR_EFT_25_10_01_2.xls)

The owner uploaded the real Virginia Tile Schluter EFT (7,033 rows) and asked
for sizes/types on most items, names that don't double information, and rows
that fit the project-line layout. Findings and fixes:

- **Every row typed "tile."** The EFT template's `defaultType: "tile"` is right
  for the tile brands but wrong for Schluter, which sells no flooring at all.
  `detectVtcEft` now reads the brand-title line above the header (the same
  cell the drop router fingerprints) — a Schluter book gets no type default
  (count lines) and `sfFromDescription`.
- **Membrane rolls priced per SQFT, sold per ROLL, quoting $1.74/roll.** The
  sheet prices DITRA/KERDI membranes per sqft (SF / RL) with the coverage in
  the description ("= 323 SF"); the count-line pick path assumed the price was
  per sell unit. New `unitPrice`/`unitCost` (stock.js) land price × coverage —
  the $1.74/sf, 134.5-sf roll now quotes $234.03/RL. Truth-table rows added
  (unitcombos.test.js: SF·RL, SF·SH, SH·SH oversized). orderDrift and
  rowCostSqft mirror it. An SF-priced roll with NO findable coverage gets a
  dedicated `roll-no-coverage` hazard instead of "unfamiliar unit".
- **Coverage extraction is unit-gated.** A bare "N SF" is only coverage when a
  unit bundles it (RL/SH/CT…) — a DITRA-HEAT cable's "101.9 SF" is its kit
  size and stays in the name. Suffixed forms ("sf/rl") pull anywhere. An
  SF-priced roll/sheet with no stated sf derives it from the feet L×W
  (feetArea; DUO-PS 3'3"×33' ≈ 107.25 sf).
- **Every Schluter size spelling now parses**: word feet ("3 FT 3 IN X 98 FT
  5 IN", "3 FT 3 X 98 FT 5", tight "82FTX3-1/8INX5/16IN" with the third dim
  as thickness), quote-less feet-inches ("3'3 X 41'1"), trailing stick/coil
  lengths ("JOLLY … 10'", "DILEX-FIS INLAY … 100'"), three-inch-dim boards
  ("5/8IN X 48IN X 120IN" → 48x120, 5/8" thick — the sub-inch dim is the
  thickness), tight mixed fractions ("471/4IN" = 47-1/4), packaging counts
  ("(100/BOX)" → pcPerUnit when the PC/CT column is empty), "=" and trailing
  vendor periods cleaned from names. The sheet-coverage advisory is
  geometry-confirmed: a sheet whose feet-size area matches its claimed sf
  (Ditra-Heat 8.4) no longer trips — which also clears ERP bucket SKU 23031's
  sf/sh? flag on re-import. PK is a known unit (pack, carton class).

Old-vs-new diff gate (sheetimport checklist §6), whole real sheet, both
parsers + the landed pick at markup 0:
- 7,033 type changes — every one `tile → null` (single shape), intended.
- 642 sizes landed (630 were empty before; the 12 non-empty ones were
  mis-splits: "3x98" → "3'3\"x98'5\"" KERDI 200, "0.75x24.5" → "24.5x96"
  KERDI-BOARD, "7/8\"" → "3/4\"" — the old thickness had been read out of a
  mixed fraction's tail).
- 660 descriptions cleaned (sizes/coverage/packaging out, no doubled info).
- 26 coverages, 2 pcPerUnit, 23 landed-pick prices (all membranes, the
  $1.74-per-roll class) — zero unexplained changes.
- Wizard warnings after: 79 no-price (the sheet's own "N/A" rows), 1 PA
  pallet row, 8 KERDI-BOARD PK rows with no per-pack count — all honest
  hazards, zero mis-parse advisories (was 16 name-litter + 20 unfamiliar-RL).

Cross-checked against Schluter's published specs (the official price-list PDF
is egress-blocked in the session; the metric lineup corroborates every spot
check: 1m rolls = 3'3", 30m = 98'5", 2.5m profiles = 8'2-1/2", 1.5m TREP-B =
4'11", KERDI-BOARD 48×96 in 1/2-3/4").
