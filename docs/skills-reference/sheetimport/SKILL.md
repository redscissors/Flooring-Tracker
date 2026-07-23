---
name: sheetimport
description: The process for adding or changing a price-sheet import — a new vendor sheet, a new ERP export shape, a new coverage/size spelling, or a new unit combination. Encodes the accumulated lessons (VTC bullnose audit, .43X12 mis-split, Milestone blank-SF/CT mosaics, Mannington fixed-grid PDF, the .969sf/sh mis-parse) as a checklist: hunt the odd rows in the real file first, truth-table any new unit combo before teaching the pricing code, reuse the description-parsing conventions, land real rows as test goldens, and gate the merge on an old-vs-new diff of the entire real sheet with every wizard warning accounted for. Read this before touching src/pricebook.js, src/pdfbook.js, src/manningtonbook.js, src/dropimport.js, or the import paths of src/orderbook.js / src/stock.js. Not for how imports are reviewed in the UI (pricebooklib.jsx) or for change-control gates (see floortrack-change-control).
---

# FloorTrack sheet imports

How to add or change a price-sheet import without repeating a lesson the code
already paid for. Every rule here traces to a real mis-parse that reached (or
nearly reached) the live book.

## Why this file exists

Import parsing is where vendor reality meets estimate math, and vendors are
endlessly creative. Each of these was a real incident:

| Lesson | What happened | Where the fix lives |
|---|---|---|
| **VTC bullnose audit** (2026-07) | 801 per-piece-priced, carton-sold trims silently underpriced 1–20× because no test owned their unit combo | `unitcombos.test.js` (the truth table), `itemProblems` in orderbook.js, ADR 0013 |
| **`.43X12` mis-split** | VTC writes pencil-trim widths with no leading zero; the size regex read "43x12" and left a lone "." in the name | the `DIM` leading-decimal alternative in pricebook.js, `NAME_LITTER_RE` advisory in orderbook.js |
| **Milestone blank SF/CT** | Sheet-sold marble hexes with an empty coverage column landed as bare count lines | sheet-size token → derived coverage (ADR 0014), `SHEET_TOKEN_RE` |
| **Mannington PDF grid** | "Cartons Detail" list has no header row at all — fixed x-band columns, leftmost is Pattern not the code | `manningtonbook.js` (ADR 0012), trims flagged `trim` for separate markup |
| **`.969sf/sh` mis-parse** (2026-07-23, PR #251) | ERP stock export prints sub-sqft sheet coverage with no leading zero and a `/sh` tail; `SF_DESC_RE` read the bare "969" as 969 sf/sheet ($0.02/sqft), left "./sh" litter, and the un-recognized SH unit kept the row untyped — which also hid it from the $/sqft outlier check | `SF_DESC_RE` + `COVERAGE_SOLD_RE` in pricebook.js; `sheet-coverage` + untyped `psf-outlier` advisories in orderbook.js |
| **EFT brand-title routing** | VTC reuses one workbook template for every brand it distributes, so format tag alone routes a dropped file to the wrong book | `dropimport.js` — the brand-title line above the header is part of the match, a mismatch is a hard "not this book" |
| **MANMI VN-marker codes** (2026-07-23) | The ERP export suffixes vinyl floors' Supplier/Mfg Product Code with an ERP-local "VN"/"VN1" marker (`MPB770VN1`) the Mannington book never writes, so the exact-key trims lookup silently found nothing — an empty trim box that read as "no trims exist". Import parsed fine; the *matching layer* had never seen the spelling | `codeVariants`/`vendorKeys` in trims.js (a marker code expands to its bare base; matching stays exact-membership) |

The common shape: a spelling or unit the parser had never seen, handled
*partially* — which is worse than not at all, because partial output looks
plausible. The defenses below all exist to make a partial parse loud.

## The checklist

Work through these in order. Skipping to code is how the lessons above
happened the first time.

### 1. Start from the real file; hunt the odd rows first

Before writing anything, load the actual sheet (SheetJS
`sheet_to_json({ header: 1 })` — parsers take arrays-of-arrays, never a
workbook, so they stay testable without the xlsx dependency) and scan for:

- every distinct **Unit of Stock / U/M value** and each unit *pair* when the
  sheet has a price-unit/order-unit split;
- every **coverage spelling** (`23.76 sf`, `10.64sf/c`, `.969sf/sh`,
  `500sf/roll`, `22sf/ct (BDL)`, a blank);
- description shapes: leading bare widths (`6"`), mixed fractions
  (`2-1/4"`), leading decimals (`.43X12`), shape words (hex/penny), sheet
  dims (`(9X11 SHEET)`), feet-and-inches (`3'3"x2'7"` — currently unhandled,
  lands in the name-size advisory);
- rows that are *not products*: headers mid-sheet, legend blocks, subtotals;
- every **code-column spelling** when the sheet has Supplier/Mfg Product Code
  columns: ERP-local marker suffixes (`MPB770VN1` for `MPB770`), shop-suffixed
  variants (`589571E`), and disagreements — between the two columns, and with
  the code in the description (a real MANMI row carried the sibling color's
  code in the description; another had it in one column but not the other).
  These columns feed exact-key matching (trims.js `vendorKeys`), where an
  unseen spelling fails silently, not loudly.

The odd rows are the spec. A parser written from the common rows will
half-match the odd ones.

### 2. Recognizer, or saved mapping?

Two paths into `parseMapped` (pricebook.js):

- A **template recognizer** (`detectVtcEft`, `detectVendorSkuAnalysis`) when
  the sheet has a stable signature header and per-column guessing is known to
  lose (VTC's oversized helper sheet, the consumer/dealer column-name clash).
  The recognizer returns the whole mapping in one step.
- The **wizard's guessed mapping** (`guessBookField`/`scanHeader`) for
  everything else — the team maps columns once, the mapping is saved on the
  book. Extend `guessBookField` only with anchored patterns; check its test
  ("without disturbing the EFT guesses") for the collision history.

Either way the **honesty guarantee** is non-negotiable: a row is only consumed
if its SKU cell matches the book's SKU pattern, so a re-arranged sheet
degrades to visible missing counts in the diff preview — never garbage rows.

### 3. New unit combo? Truth table FIRST

`src/unitcombos.test.js` is the authority on every
`{price U/M × order U/M × has-SF/CT × has-PC/CT}` shape the pricing code
handles, asserting end-to-end (`pricedItem` → `stockPatch`) how the pick
lands and at what price. The doctrine from its header, born of the bullnose
audit:

> When a new book surfaces a combo that isn't here, `unitComboWarnings`
> flags it in the import wizard; teaching the code the combo means adding
> its row HERE first.

So: add the combo's row to the table (with a real SKU for traceability and
hand-computed expected numbers), watch it fail or warn, *then* teach
`orderbook.js`/`stock.js`. Never the other order. `itemProblems` must return
`[]` for every combo the table holds — the last test in the file asserts
exactly that.

### 4. Description parsing: reuse the conventions, never invent

All description mining lives in pricebook.js. Before adding a regex, check
whether an existing one already encodes the convention you need:

- **`DIM`** — dimensions, including bare fractions, mixed fractions, and
  leading decimals. Any new number-matching regex that can meet a
  no-leading-zero decimal must use the same `\.\d+` alternative (the
  `.43X12` and `.969sf/sh` lessons are the same bug, five months apart).
- **`SF_DESC_RE`** — coverage riding the description tail, per sell unit,
  with its unit-tail alternatives (`/ct`, `/sh`…). Strip the **whole
  phrase**: a partial match leaves litter, and litter is how a mis-parse was
  first noticed both times.
- **`SIZE_RE` / `SHAPE_SIZE_RE` / `SHEET_TOKEN_RE` / `LEAD_WIDTH_RE`** —
  chip sizes vs sheet sizes vs bare plank widths. A sheet dimension is
  *never* the tile L×W (grout would read it as one giant tile, ADR 0014).
- **`floorTypeFromDescription`** — the word ladder (vinyl before wood,
  because LVP names carry species words; shape words before the
  bare-width-means-wood fallback; membranes never type). Gated by callers on
  a coverage-sold unit + real coverage, so accessories can't be typed.

Two standing principles:

- **Never invent data.** A description without a coverage phrase stays
  uncovered and gets a named warning — it must not get a guessed number.
  A description with no L×W passes through unchanged.
- **Coverage is per SELL unit** (`sfPerUnit`), whatever that unit is —
  carton, bundle, roll, sheet. `COVERAGE_SOLD_RE` names which units make a
  covered row *flooring*; keep it in step with orderbook's unit
  regexes (`SHEET_UNIT_RE`, `isCartonUnit`).

### 5. Land real rows as test goldens

Every parser test workbook (`VSA_WORKBOOK`, the EFT fixtures in
pricebook.test.js) is built from **real rows with their real SKUs kept** for
traceability. When a sheet teaches something new, its actual row goes into
the fixture and the assertions state the hand-checked values (`0.969`,
`18.8029`) — not values read back from the code. Golden rows are what make
the next refactor safe.

### 6. The old-vs-new diff gate (do not skip)

Before the PR: run the **entire real sheet** through the parser at `main`
and at your branch, and diff every field that matters. The recipe:

```js
// scratch script — old parser from git, new from the working tree
const oldM = await import(".../oldsrc/pricebook.js"); // git show main:src/pricebook.js (+ its imports)
const newM = await import("./src/pricebook.js");
const a = oldM.parseMapped(rows, oldM.detectVendorSkuAnalysis(sheets)).items;
const b = newM.parseMapped(rows, newM.detectVendorSkuAnalysis(sheets)).items;
// diff sku-by-sku over sfPerUnit / type / priceSqft / description / size
```

The gate: **every changed field is an intended fix, and every unchanged odd
row is explained.** PR #251's diff read "73 field-level changes across 525
rows, every one a fix, zero regressions" — that sentence, with the numbers,
belongs in the PR body. This step is what caught the hexagon-as-hardwood
and membrane-as-floor side effects *before* they shipped.

### 7. Account for every wizard warning line

Run `parseMapped` on the real file and read the returned `warnings` — the
same lines the import wizard shows. Each line is either **fixed** by your
change or **explained** (a genuinely odd row the team should review-mute via
its flag chip). The `.969sf/sh` sheet imported with 22974 *named in a
warning line* — the lesson is that an unexplained warning is a bug report
you're choosing not to read.

The warning layers, outermost first:

| Layer | Function (orderbook.js) | Blocks? | Catches |
|---|---|---|---|
| Unit hazards | `itemProblems` → `unitComboWarnings` | no, but hazard-toned | combos the pricing code was never taught (the bullnose hole) |
| Parse advisories | `rowAdvisories` → `importSanityWarnings` | no (FYI) | name litter, residual sizes, empty names, trim-as-area, cost inversions, `$/sqft` outliers, implausible sf-per-sheet (> 3 sf) |
| Bare coverage | `parseMapped` itself | no | coverage-sold rows with no coverage phrase in the text |

All three respect `flagReview` — a verdict a human recorded on a row's chip
mutes that code across re-imports (`applyBookImport` carries it), so
advisories stay loud only while unexplained. When your new sheet surfaces a
failure shape none of these would flag, **add the advisory in the same PR**
— that's how `sheet-coverage` came to exist.

## Write-path and re-import discipline

- Book items are written **only** by `applyBookImport` — upserts plus
  `active=false` marks, never deletes; retired SKUs stay for old estimates.
- Re-imports must never change saved jobs: rows **snapshot** book values at
  pick time; nothing reads a book at calc time.
- `data.importFingerprint` is stamped on import so `dropimport.js` routes
  the next drop of the same file shape back to its book; for EFT-template
  files the brand-title line is part of the match.
- An identical re-drop can be forced through whole (`forceDiff`, PR #246)
  when a parser fix needs to rewrite rows the diff would call unchanged.
  **A parser fix only reaches an existing book when its sheet is
  re-imported** — ship the fix, then re-drop the file.

## Where everything lives

| Concern | File |
|---|---|
| Mapped parse, recognizers, description mining | `src/pricebook.js` |
| Item shape, pricing, diff, hazards/advisories, trim classifier | `src/orderbook.js` |
| How a pick lands on a product row | `src/stock.js` (`stockPatch`, `pricedItem`) |
| Multi-file drop routing | `src/dropimport.js` |
| Text-PDF price lists | `src/pdfbook.js` (ADR 0010) |
| Mannington fixed-grid PDF | `src/manningtonbook.js` (ADR 0012) |
| Unit-combo truth table | `src/unitcombos.test.js` |
| Parser goldens | `src/pricebook.test.js`, `src/orderbook.test.js` |
| Import wizard UI | `src/pricebooklib.jsx` (not covered here) |
| Decisions | ADR 0009 (registry books), 0010, 0012, 0013 (+ amendment), 0014, 0017 (flag review), 0027 (ERP stock books), 0029 (leading widths) |
