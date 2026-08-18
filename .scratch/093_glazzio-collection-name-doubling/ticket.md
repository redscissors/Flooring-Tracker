---
issue_type: Bug
summary: Glazzio RYM5532 (and every row whose color name leads with its series)
  reads "Rythmique Collection Rythmique …" — the series twice with "Collection"
  wedged between, eating the product line's space.
status: done
labels: [ready-for-human]
---

# Glazzio: "Rythmique Collection Rythmique …" — the heading's COLLECTION doubles the name

Reported 2026-08-18: "for the glazzio price book RYM5532 is messed up. it shows
Rythmique twice and it says Collection which takes up too much space."

## Cause

Glazzio's PDF prints each section heading as `<NAME> COLLECTION` ("RYTHMIQUE
COLLECTION"). The PDF importer (ADR 0010) stamps that whole heading as the
row's collection/productLine, and `mappedItem` fronts every name with it. The
series-lead dedupe (`seriesLeadWords`, the "Earth Earth Ash Gray" fix) compares
the label's lead words against the WHOLE product line — and the trailing
"Collection" makes that comparison fail, so a color name that itself leads with
the series ("Rythmique Fandango") lands as **"Rythmique Collection Rythmique
Fandango"**. Rows whose color names don't repeat the series still carried the
"… Collection" prefix for nothing.

Bonus find while auditing the rest of the book: the large-format (Eos 24x48)
pages' mosaic sub-tables sit under a bare size label ("24x48-6"), which the
heading scan happily stamped as the collection — those rows led with
"24x48-6 …".

## Fix

- **`src/pdfbook.js` `collectionTitleFor`** — a heading's trailing
  "COLLECTION" is typography, not the name: stripped before stamping
  (`"RYTHMIQUE COLLECTION"` → collection `"Rythmique"`), which also lets the
  existing series-lead dedupe fire. A letterless heading (`"24x48-6"`) is a
  format tag, never a collection — skipped so a real heading above can win.
  Takes effect on the next re-import of the Glazzio PDF (productLine and
  descriptions show in the wizard's changed-row diff).
- **`src/orderbook.js` `cleanDescription`** — the already-stored doubled shape
  (`<series> Collection <series> …`) collapses to `<series> …` at the shared
  parse/load point, so **already-imported rows read right on next load with no
  re-import** (the DESC_NOISE / COEREBE1836R mechanism). Only the exact doubled
  shape matches: "Alta Vista Collection Balboa", "Colonial Collection
  Presidential Grey" and "Heritage 2022 Collection" keep their names, so the
  OVF/VTC books that genuinely name a "… Collection" are untouched.

Note: stored `productLine` values (markup groups, muted detail line) keep the
"… Collection" spelling until the book is re-imported; if the Glazzio book ever
grows per-group markup overrides, re-key them after that re-import.

## Proof

- `preview-book-table.png` — header-preview harness, the mock Glazzio book: a
  stored `"RYTHMIQUE COLLECTION RYTHMIQUE FANDANGO"` row renders
  **"Rythmique Fandango"** (RYM5532, bottom row).
- `src/pdfbook.test.js` — new: the RYM5532 heading/dedupe case and the
  "24x48-6" format-tag skip; updated pins: "Abstract", "Mayan Garden".
- `src/orderbook.test.js` — new: the collapse (single- and multi-word series,
  ALL-CAPS) and the keep-cases. 957/957 tests pass; lint clean on touched
  files (6 pre-existing errors elsewhere).
