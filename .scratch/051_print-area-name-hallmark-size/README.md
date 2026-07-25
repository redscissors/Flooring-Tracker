# Print: area names, no area count · Hallmark plank size (2026-07-25)

Status: done

Request (Marcus, 7/24):
1. "If area is named it should not show area 01 in print"
2. "Also does not need to show ammount of areas in print header"
3. "Hallmark not showing size"

## What changed

1. **A named area prints its name alone** (`print.js` `areaPrintLabel`, used by
   both `EstimatePrint.jsx` layouts). The heading was `Area 01 · Master Bath`;
   it is now `Master Bath`. An area with no name keeps `Area 01` so the sheet
   still tells unnamed areas apart. One helper behind both the cards layout and
   the classic sheet, so they can't drift.

2. **The area count is gone from the print header** — the Project column read
   `3 areas  ·  10% waste factor`; it now reads the waste factor only. Both
   layouts. The areas are listed right below it; counting them for the customer
   said nothing.

3. **Hallmark floors import their plank size** (`ovfbook.js`). Hallmark states a
   block's size in a prose line, not a column — `5/8" x 7 1/2" x RL- 74 3/4"
   Handcrafted Bevel` — and the parser was reading only the `SF/CT` figure off
   those lines, so the whole book imported sizeless and every Hallmark row
   printed with no size. `hmSize` now reads the dimension clause: it takes the
   leading run of size-ish words and stops at the first descriptive one, so it
   doesn't have to enumerate the dozen spellings the sheet uses (fractions and
   decimals, a width *list* — `5/8"x5, 6, 7 1/2"` — a metric thickness —
   `5.5mm x 9" x 59"` — lengths in feet or inches, random-length `RL`). A
   trailing dangling `RL`/separator is dropped, and a result that doesn't name
   two dimensions with a unit mark is rejected, which keeps the construction
   prose that also opens with a number ("4 mm Sawn Face Wear Layer",
   "22.6 SF/CT ~ 52 CT/PA") out. Size and coverage can share a line
   (American Traditional's per-grade sub-blocks), so both are read before the
   line is consumed, and a new collection banner clears the size.

   The parser's emitted column 4 was labeled "Size" but carried the old-item-#
   note; the note moved to its own column 12 and column 4 is now the real size,
   with `HALLMARK_MAPPING` following.

   **171 of the 187 floors in the shop's actual Hallmark list now import a
   size.** The other 16 are the True Collection, whose prose states no plank
   size at all — an empty Size column is the honest answer there, not a number
   scraped out of the finish line.

## To pick this up on the live site

Re-drop the OVF Hallmark sheet into the Price book library. Sizes are read at
import, so the book's existing items keep their blank size until it is
re-imported. Product rows already saved on jobs keep their snapshot either way
(ADR 0003) — re-picking the item is what moves a saved row to the new size.

## Proof

`proof-print-and-sizes.png` — section 1 is the **real `EstimatePaper`** (cards
layout, the one that prints) with two named areas and one unnamed, so all three
fixes are visible at once; its Hallmark rows are carried end to end through the
**live** import (the OVF sheet fixture → `parseHallmark` → `parseMapped` →
`orderPatch` → the product row), so the size on the paper is the size the sheet
states. Section 2 is the **live `parseHallmark` output** for every collection in
the real list, beside the prose line each size was read from.

Rebuild: `npx vite build --config .scratch/051_print-area-name-hallmark-size/proof-vite.config.mjs`,
serve `proof-dist`, screenshot. `proof-dist` is never committed.

Tests: `node --test src/*.test.js` — 741 pass, up from 734 (new: `areaPrintLabel`, and six
Hallmark size cases covering the width list, the metric thickness, the dangling
`RL`, the per-block size+coverage line, the sizeless collection, and the
collection reset). Production build clean. The import's warning set on the real
sheet is byte-identical before and after, so no new review noise.
