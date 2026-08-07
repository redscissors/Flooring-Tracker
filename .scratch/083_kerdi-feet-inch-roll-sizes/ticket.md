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
