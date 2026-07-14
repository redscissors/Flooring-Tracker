---
issue_type: Bug
summary: The import's size parser doesn't understand mixed-fraction dimensions
  ("1-1/2X1-1/2"), so the L×W regex grabs "2X1" out of the middle and leaves
  mangled fraction fragments in the product name — the Moroccan Concrete hex
  mosaic reads "Moroccan Conc Off White Hex Mos 1-1/ -1/2" with size 2x1.
  Teach the parser fractions, and land an equal-dimension size that carries a
  shape word as a hex size ("1-1/2\" Hex") per ticket 009's display model.
status: done
labels: [ready-for-agent]
---

# Import mangles fraction sizes; square hex chips should read as a hex size

## Problem / Why (found 2026-07-14)

Reported: the Moroccan Concrete hexagons "show a little awkward in the product
line." Traced to the MRZ book (Mediterranea, Virginia Tile EFT format —
`MRZ_EFT_25_09_08.xls`), which prints the hex-mosaic chip size as a **mixed
fraction**:

```
MRZMC50MOSHEX   MOROCCAN CONC OFF WHITE HEX MOS 1-1/2X1-1/2
```

`splitSizeFromDescription` (src/pricebook.js) has no notion of fractions, so
`SIZE_RE` matches the middle of `1-1/2X1-1/2` and yields (verified against the
real code):

- size **`2x1`** (wrong — the chip is 1-1/2" × 1-1/2")
- name **"Moroccan Conc Off White Hex Mos 1-1/ -1/2"** — the awkward line.

Every fraction-dimension row in these books breaks the same way:
`ARTEZEN ... HEX MOS 1-1/2X1-1/2 (12X10/SH)` → `2x1`,
`ATTITUDE ... HEX 8-1/2X10` (VTC book) → `2x10`.

Related, same family: a single-dim shape size hiding behind a packaging token —
`GEOMETAL ... 3" HEX MOS (11X12/SH)` — takes the **sheet** dims (11x13-style)
as its size because `SIZE_RE` finds the parenthesized `11X12` and the shape
branch never runs.

The 8" hex floor tile (`MOROCCAN CONC OFF WHITE 8" HEX TILE`) parses fine
today via ticket 009's shape branch — no change needed there.

## Decision (owner, 2026-07-14)

Show the **vendor's printed size**, e.g. `1-1/2" Hex` — not the marketing
"2\" hex". Accurate for every product, and the derived square L×W (1.5) feeds
grout/mortar per ticket 009's model.

## Fix

All in `src/pricebook.js` + `src/stock.js`; no data-model change (`sizeText`
and the Variant-A size cell from ticket 009 already display shape sizes).

1. **Fraction-aware dimension pattern.** A dimension is
   `\d+(\.\d+)?(-\d+/\d+)?` or a bare `\d+/\d+`; value via a small `fracVal`
   ("1-1/2" → 1.5). Use it in `SIZE_RE`, `SHAPE_SIZE_RE`, and
   `deriveSquareDim`'s number pick (stock.js).
2. **Packaging parens stripped first.** `(12X10/SH)`-style groups (dims +
   `/unit`) are packaging info, never the size — remove before size matching
   so the chip/shape size wins and the name doesn't keep "( /Sh)" litter.
3. **Equal dims + shape word → shape size.** When the L×W match has equal
   values and the description carries a shape word (hex|hexagon|penny|round|
   octagon), emit the vendor-spelled shape size (`1-1/2" Hex`) instead of
   `1.5x1.5`, stripping the dims token and that one shape word from the name.
   Unequal dims (`8-1/2X10 HEX`, `2X3 LINEAR HEX`) stay a plain L×W with the
   shape word left in the name — status quo.
4. **Rectangle sizes emit decimal dims** (`8.5x10`) so `parseTileSize` fills
   L/W unchanged.

Re-import the affected books (MRZ at least) after deploy — stored items were
parsed at import time.

## Deliberately out of scope

- `deriveSquareDim`'s mosaic carve-out still blocks items whose text says
  "mosaic" even when the shape size is a genuine per-chip dim ("ART REFLECT
  3\" HEXAGON MOSAIC" shows the size but derives no L×W, while Moroccan's
  "HEX MOS" abbreviation derives). Ticket 009 recorded that conservative rule;
  relaxing it (a shape size is per-chip by construction) is a separate,
  surfaced follow-up — not silently overridden here.
- Mosaic sheet dims without a chip size (`HEX MOSAIC 11X13 (CROSS CUT)`) still
  land as L×W — pre-existing, ticket 009 §"scope of the miss".

## Tests

`src/pricebook.test.js` — splitSizeFromDescription:
- `"MOROCCAN CONC OFF WHITE HEX MOS 1-1/2X1-1/2"` → size `1-1/2" Hex`, name
  "Moroccan Conc Off White Mos".
- `"ARTEZEN ELEGANT WHITE HEX MOS 1-1/2X1-1/2 (12X10/SH)"` → size `1-1/2" Hex`,
  packaging parens gone from the name.
- `"GEOMETAL CHAMPAGNE GOLD 3\" HEX MOS (11X12/SH)"` → size `3" Hex`.
- `"ATTITUDE SIMPLY GREY HEX 8-1/2X10"` → size `8.5x10`, "Hex" stays in name.
- Regressions: `8" HEX TILE` → `8" Hex`; `12X24 RECT` → `12x24`; the existing
  test suite (`'8"x9" Hex Grey'` → `8x9`, Ovo double-token, etc.) unchanged.

`src/stock.test.js`:
- `deriveSquareDim` on size `1-1/2" Hex` → 1.5.
- `stockPatch` tile with size `1-1/2" Hex` → `sizeText` set, L=W="1.5".

## Evidence

- Vendor rows: `MRZ_EFT_25_09_08.xls` MFG Data rows 725–756 (Moroccan
  Concrete), 50–75 (Artezen), 428+ (Geometal); `VTC EFT 25 07 28.xls` row 2805
  (Attitude).
- Parser: src/pricebook.js `SIZE_RE` / `SHAPE_SIZE_RE` /
  `splitSizeFromDescription` (~572–620), consumed by `mappedItem` (~677).
- Fill: src/stock.js `parseTileSize` (77), `deriveSquareDim` (127),
  `stockPatch` tile branch (160).
