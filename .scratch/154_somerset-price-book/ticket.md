---
issue_type: Feature
summary: Somerset Hardwood Flooring price sheet (Palmer Donavin R35, 10/20/2025)
  imports through its own PDF parser — floors with merged price cells, and the
  molding pages as trims fitted to their floors.
status: done
labels: [ready-for-human]
---

# Somerset price sheet import

Owner, 2026-09-24: "This is a new price sheet for a new company Somerset
Flooring. Be careful and make sure we get everything to parse correctly."

## Why a dedicated parser

The sheet is a matrix, not a list. Each collection prints a carton table (SF/ctn
keyed by construction, species, or width), a Solid/Engineered band, a width
header, then color rows carrying only SKUs. A price is a MERGED cell printed once
at the vertical middle of the rows it covers ($4.35 beside six Color Strip
colors, $4.78 beside Natural White Oak alone); grey cells mark widths a color
isn't made in. The generic reader (pdfbook.js) finds no code-first rows, so this
follows the Mannington/TrueTouch dedicated-parser pattern (ADR 0009 §4).

## What landed

- `src/somersetbook.js` — `isSomersetPriceList` (carton header + warranty line;
  the Somerset/Palmer Donavin names are logos, not text) and
  `parseSomersetPages`. A price column's rows are split into runs, one per
  printed price, each price at its run's middle (`priceRuns`); a split that
  doesn't fit imports the SKUs with no cost and warns — never a guess.
- Floors: $/SF cost, Price U/M SF, the table's SF/ctn, width as size,
  "Collection Species Color Construction" names (species dropped when the color
  already says it), finish/edge/warranty/grade in the note, Euro Wide Plank's
  printed 9/16" thickness. Brand Somerset, markup grouped by collection.
- Moldings: per-piece (EA) trims, fitted by collection + color, Solid/Engineered
  stair nose/reducer/threshold only to floors of that construction. The sheet's
  "Homestlye"/"Tru Oak" still link (a transposition matches by letters).
- Wired into the wizard's PDF dispatch (pricebooklib.jsx) and the drop router's
  format tag `somerset` (dropimport.js).
- `orderbook.js rowAdvisories`: the trim parsers' "· fits …" search note no
  longer trips the "leftover punctuation" advisory (it fired on every molding
  line here, and on every Mannington/TrueTouch/OVF trim).

## Owner decisions

- Five White Oak molding SKUs printed at two prices (MQR06, MTM3406, MRD3406,
  MSN81207CP, MTH81207CP — Wide Plank's table is the higher tier): **higher price
  wins**, with a wizard warning per SKU.
- EP512HSELG printed for both Character Ember and Saddle (Ember's is presumably
  EP512HEELG): **import as printed + warn** — it stays Saddle (its sibling codes
  match); Ember 5" Engineered is left out until Palmer Donavin confirms.
- Names without an em dash: "Character Hickory Driftwood Engineered".

## Verified

474 items: 177 floors + 297 moldings, every one priced; every floor carries
carton coverage; EP-prefixed codes are exactly the engineered ones. Every price
and SF/ctn checked against the printed sheet collection by collection. The
wizard shows exactly six warnings (the two decisions above). Preview:
`import-preview.html?somerset` — screenshots in `preview/`.

Not done by the agent: creating the Somerset book and running the import in the
live app (owner action — no live Supabase writes from an agent).

## Regenerating the fixture

`node .scratch/154_somerset-price-book/tools/dump-pages.mjs <sheet.pdf>`
rewrites `src/somersetfixture.js` from a new edition of the sheet.
