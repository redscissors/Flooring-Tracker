---
issue_type: Bug
summary: Glazzio mosaics import with the SHEET dimension in the tile-size cell
  (grout runs off a ~12" tile), lose their per-sheet coverage, and the Eos-style
  sub-table mosaics drop out of the import entirely. A mosaic needs the chip size
  for grout and the sheet for coverage — the PDF importer conflates them.
status: done
labels: [ready-for-agent]
---

# Glazzio mosaics: chip size vs. sheet size in the PDF import

## Problem / Why (found 2026-07-15)

Reported: Glazzio mosaics price wrong — the app shows a mosaic as a "12x12 sheet"
tile when the actual chip is 2x2. Traced through the app's own PDF importer
(`src/pdfbook.js` → `src/pricebook.js`) against the two real Glazzio digital
price lists. Three distinct failures, one per page layout:

### 1. `Sheet Size` column lands in the tile-size cell (Antiquities, p16)

```
Item #  Color Name       Description  Sheet Size          SQF/Sheet  $/SQF   $/Sheet
ANQ52   Egyptian Ivory   Hexagon      11 3/4" x 11 7/8"   0.97       $16.20  $15.71
ANQ53   Mayan Vanilla    Diamond      11" x 11 3/4"       0.9        $16.20  $14.58
```

`headerFieldFor("Sheet Size")` matches on the word "size" and returns the tile
`size` field, so `11 3/4 x 11 7/8` fills L×W and grout runs off a ~12" tile.
Coverage (`SQF/Sheet`) and both prices already read correctly here — only the
size is wrong. **This is the reported "12x12" symptom.**

### 2. Coverage + chip live in prose, not columns (Aragon Hills p18, Academia p12, Alloway p13)

```
Aragon Hills Collection
Item #    Color Name    Rows per Sheet   $ Per SQF   $ Per Sheet
AGH5411   Qassle Blu    12               $15.30      $14.43
SHEET SIZE: 11 1/2" x 11 13/16" = .943 SQF        <- prose line, not a column
```

- The sheet size + coverage (`= .943 SQF`) are a prose line the table parser
  skips, so the row imports with no coverage → can't order in whole sheets.
- `Rows per Sheet` is currently mis-mapped to `pcPerUnit` ("pieces per box") and
  then ignored — but it's exactly what's needed to derive the chip:
  `chip ≈ sheet_dim ÷ rows`. Validated across three collections:
  Academia 11.69"/6 = 1.95" (2" chip), Alloway 12.2"/8 = 1.53" (1.5"),
  Aragon 11.5"/12 = 0.96" (~1" hex). Lands within a fraction every time.

### 3. Eos-style mosaic sub-tables drop out (p5–7)

The 24x48 collection pages stack a mosaic mini-table under the main tile with
its own header (`Item#, Color Name, Variation, Thickness, PEI, Finish`). The
longer `-M` item code (`LRGSTB10-M`) kerns right up against the color name with
no pixel gutter, so `detectColumns` merges them into one cell
(`"LRGSTB10-M Stream Bone 2x2 Mosaic"`). That cell has spaces, fails the SKU
pattern gate, and **the row is silently dropped** — 7 of 8 mosaics on these
pages never enter the price book. The chip size (`2x2`) is in the color name and
the coverage is prose (`MOSAIC COVERAGE: 12 x 12" = 1 SQF`).

## The rule

Not every mosaic page carries the same signals, so the importer resolves the
chip through a **cascade**, degrading to a manual prompt when the vendor simply
didn't print a chip size (Antiquities' "Diamond"/"Zig Zag" have no chip at all):

1. **Chip in the name** (`2x2 Mosaic`, `Hexagon 2"`) → use it. (already works)
2. **Rows per Sheet + sheet dims** → derive `chip ≈ sheet_dim ÷ rows`.
3. **Neither** → leave L×W blank; ADR-0014's "＋ add size for grout" box prompts
   the salesperson once, pre-labeled with the shape word.

And underneath all three: **the Sheet Size never becomes the chip** — it goes to
coverage (where it already belongs), the sheet stays visible, grout keys off the
chip. Coverage + price + whole-sheet ordering come through automatically on every
mosaic page; grout is the only thing that ever needs a human nudge, and only on
pages where the book prints no chip size.

## Scope

- `src/pdfbook.js` — split `Rows per Sheet` and `Sheet Size` off their current
  fields; read the prose `SHEET SIZE:` / `MOSAIC COVERAGE:` line per section for
  coverage + sheet dims; derive the chip from rows; un-merge a swallowed SKU
  token so sub-table rows stop dropping. Emit a `Sheet Size` canonical column.
- `src/pricebook.js` — `mappedItem` reads an explicitly-mapped `sheetSize`
  column (today it only comes from `splitSizeFromDescription`). Everything
  downstream (`stockPatch` sheet display + blank-L×W prompt, coverage derive) is
  ADR 0014 and already in place.
- Extends ADR 0014 (records the cascade as an amendment).

## Out of scope / follow-ups

- Detecting the hex/diamond/zig-zag shape for a rows-derived chip — we emit a
  square chip that stands in for grout volume; shape labeling can come later.
