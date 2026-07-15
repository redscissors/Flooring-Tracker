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
