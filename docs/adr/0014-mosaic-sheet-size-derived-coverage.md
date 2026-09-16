# ADR 0014 — A mosaic's SHEET dimension gives coverage, never the tile size

- **Status:** Accepted
- **Date:** 2026-07-15
- **Scope:** system-wide (mapped import, pick snapshot, tile size cell)
- **Related:** amends [ADR 0009](0009-price-book-library.md) §3 (size-from-
  description) and builds on [ADR 0013](0013-unit-combo-pricing-semantics.md)'s
  `fillsFlooring` count-vs-flooring gate and [ADR 0003](0003-stock-price-book-snapshot.md)'s
  snapshot doctrine. Extends the ticket-009/010 tile-size work.

## Context

The Milestone "Marbles" hex mosaics (`MLSMBOGHEXM/P` and 8 siblings) import from
the VTC EFT sheet with a description like
`MARBLES ONICIATA GREY HEX MOSAIC MATTE (9X11 SHEET)` and **`SF/CT` = N/A**.

Two problems compounded:

1. **No size reached the size cell.** The description carries no chip dimension
   — the only number is the `(9X11 SHEET)` backing sheet — so the earlier
   size-from-description pass either left the size empty or, once it learned to
   read the parens, treated `9x11` as the tile L×W. A hex chip is ~3", not a
   9×11 rectangle, so that L×W would drive grout/mortar off a tile 30× too big.
2. **The row landed as a bare count line.** With no `SF/CT` and a per-piece
   price, `fillsFlooring` (ADR 0013) correctly refused to fake a $/sqft, so the
   item fell to a `misc` count line — and grout/mortar are tile-only, so it got
   no size field and no way to compute joint fill at all. Its sibling mosaics
   that *did* carry `SF/CT` imported as proper tiles with the chip-size grout
   box, so the marble family was inconsistent with them.

The sheet dimension is genuinely useful — a 9×11 sheet covers 0.6875 sf of floor
— but only as **area coverage**, never as the tile's grout geometry.

## Decision

1. **A SHEET/SHT token is parsed to its own `sheetSize` field, never `size`.**
   `splitSizeFromDescription` pulls `(9X11 SHEET)` / `13X13 SHT` out before the
   size regexes so its L×W can never be read as the chip size, and returns it as
   `sheetSize`. It is only carried onto the item when the description named no
   chip size — a real chip size (e.g. `2" Hexagon`) always wins for the tile.
2. **Coverage derives from the sheet area when the book left `SF/CT` blank.**
   In `mappedItem`, a mosaic with a `sheetSize` and no `sfPerUnit`/`coverage`
   gets `sfPerUnit = (sheetW × sheetH ÷ 144) × pcPerUnit` — sf-per-carton, the
   same basis a mapped `SF/CT` uses — so it becomes a real square-foot tile
   ($/sqft via ADR 0013's `perCartonFactor`, ordered in whole sheets) instead of
   a count line. The book's own `SF/CT` still wins when present; nothing is
   overwritten.
3. **The pick shows the sheet as a labeled free-text size with a blank L×W.**
   `stockPatch` renders `sheetSize` as `sizeText` (`"9x11 sheet"`) and leaves
   the tile L×W empty, so the existing `GridSizeInput` "＋ add size for grout"
   box (ticket 009) prompts the salesperson for the chip size that grout/mortar
   compute from. The sheet dimension is shown, but never as the grout geometry.

## Consequences

- Only mosaics whose description carries an explicit SHEET/SHT token and no chip
  size are affected — 10 rows in the real MLS file, 0 in ANA. Every other row,
  including mosaics with a chip size or a mapped `SF/CT`, is unchanged.
- `9x11 sheet` at $29.24/sheet imports as a ~$42.53/sqft tile that orders whole
  sheets; the salesperson types the chip size (e.g. a 3" hex) once to unlock the
  grout/mortar math. The derived coverage is a correctable default, not a claim
  the book made.
- Existing installs re-importing these books will see the 10 rows change (new
  `sheetSize`/`sfPerUnit`, size moved out of the name) in the wizard diff — a
  one-time, expected shift.
- The ticket-010 behavior of keeping a `13X13 SHT` mosaic as a `13x13` rectangle
  size is superseded: it now lands in `sheetSize`, consistent with the rule that
  a sheet dimension is coverage, not tile geometry.

## Amendment 2026-07-15 — the PDF path and the chip cascade (issue 016)

ADR 0014 was written for the VTC **mapped .xlsx** path, where the sheet token
rides inside a description column and `splitSizeFromDescription` pulls it out.
The Glazzio **text-PDF** path (ADR 0010, `src/pdfbook.js`) never hit that code:
it has its own header-driven columns, and three of its mosaic layouts broke
differently (issue 016).

- **Egyptian/Antiquities layout** carries a literal `Sheet Size` column. Its
  header matched on the word "size", so the sheet dimension filled the tile L×W —
  the exact failure this ADR forbids, now on the PDF path. Fix: `headerFieldFor`
  routes a `Sheet Size` header to its own `sheetSize` field (never `size`), and
  `mappedItem` reads an explicitly-mapped `sheetSize` column, not only the
  description split.
- **Aragon/Academia layout** prints the sheet dimension and coverage only as a
  prose line (`SHEET SIZE: 11 1/2" x 11 13/16" = .943 SQF`, or the 24x48 pages'
  `MOSAIC COVERAGE: 12 x 12" = 1 SQF`). `parsePdfPages` now reads that line per
  table section and applies it as the section's sheet size + per-sheet coverage
  when the row's own columns leave them blank — so the row prices per sheet and
  orders in whole sheets, and the printed `$/SQF` reconciles it (the existing
  self-consistency guard).
- **The chip is resolved by a cascade**, because not every page prints one:
  (1) a chip size in the color name wins (unchanged); else (2) the chip is
  derived from `Rows per Sheet ÷ sheet dimension` (a square chip that stands in
  for grout volume — a 1" square ≈ a 1" hex); else (3) L×W is left blank and the
  ticket-009 "＋ add size for grout" box prompts the salesperson, exactly as this
  ADR already specified. `Rows per Sheet` is parsed to its own field and used
  only for this derivation — it is **not** `pcPerUnit` (piece packaging), so it
  never divides the per-sheet coverage.
- **Sub-table SKU un-merge.** On the 24x48 pages the longer `-M` mosaic code
  kerns against the color name with no gutter, so column detection merged them
  and the row (its SKU cell now carrying spaces) was dropped by the pattern gate.
  When a leftmost/SKU cell is a SKU-shaped token followed by more text, the code
  peels the token back off as the SKU and returns the remainder to the name, so
  the mosaic rows survive and their name-borne chip size (`2x2`) parses normally.

The doctrine is unchanged — a sheet dimension is coverage, never grout geometry;
the chip is the grout geometry, filled automatically when the book gives us
enough and by one manual entry when it does not. This amendment only teaches the
PDF path the same rule and adds the rows-per-sheet derivation as a middle rung.

## Amendment 2026-09-16 — a mosaic's bare L×W that covers the whole piece is the sheet (issue 142)

Marcus flagged the VTC Tuscany White Hexagon Mosaic (`VTCTUWHMOSHEX`) job line
as "no sheet size". The EFT sheet prints it as `TUSCANY WHITE HEXAGON MOSAIC
10X12` — no SHEET/SHT word for rule 1 to catch, no packaging token, no chip —
so `SIZE_RE` read the `10X12` as the tile and the row landed as a 10×12
rectangle in L×W: grout/mortar ran on a tile 30× the chip, the size cell never
said "sheet", and the PC No-Broken unit fell to loose exact-area ordering
instead of whole sheets.

Position in the description can't decide it: across the same sheet, 234 mosaic
rows print the CHIP in that spot (`BOOST GREY MOSAIC 2X2`, `MOS 2X12`). The
row's own coverage can. `SF/CT ÷ PC/CT` is the square feet of one piece, and a
mosaic's piece is its sheet — so when the printed L×W's area is that coverage,
the L×W is the sheet. The ratio is bimodal on the real file: every backing sheet
runs 1.0–1.8× the per-piece coverage (interlocking and composition panels
overstate their net coverage, as sheets do), every chip ≤ 0.17×, nothing
between. A chip can never be half its sheet, so **≥ 0.5 decides**.

- **Rule (mappedItem, after the description split):** a row whose description
  carries MOS/MOSAIC, whose split size is a plain L×W, whose `sheetSize` is still
  empty and whose `sfPerUnit` is known moves that L×W to `sheetSize` (and clears
  `size`) when `L×W ÷ 144 ≥ 0.5 × sfPerUnit ÷ (pcPerUnit or 1)`. No coverage →
  nothing to decide → the L×W stays as before. Non-mosaic rows are never
  touched (an ordinary tile's L×W always equals its per-piece coverage).
- **Downstream is rule 3 unchanged:** the pick reads `10x12 sheet` with a blank
  L×W and the "＋ add size for grout" prompt; the sheet's own `SF/CT` still wins
  for coverage (rule 2 only fills a blank); a PC-spelled sheet orders whole
  sheets at `SF/CT ÷ PC/CT` per piece; order entry reads the nominal `10x12"`.
- **Effect on the 2026-01-15 CTNS EFT file:** 34 rows change, all backing
  sheets — the 7 Tuscany hex mosaics (10×12), 18 Shibusa Intreccio/Losanga/
  Bacchette (12×12, 12×24), 4 Orleans interlocking hex (12×10) and 5 Quartz
  Essence composition panels (12×15). Every other row of the 10,013 imports
  identically.
- **Not covered:** a `(12X10/SH)` packaging token beside a chip size (the Regina
  hexes) is still dropped — that row has a real chip, and this ADR's "chip wins"
  rule stands; carrying both onto a row is a separate decision.
