---
issue_type: Task
summary: Make the product-row SKU typeahead a real dropdown (all matches with a count footer, keyboard navigation, shift-click multi-select that auto-adds product rows), add a "transition" search synonym for the book's trim labels, and let the Settings catalog add-product form pre-fill from a price book search.
status: done
labels: [ready-for-human]
---

# SKU search: real dropdown, multi-select add, transition synonym, catalog pre-fill

## Problem / Why

Field feedback on the issue-004 SKU typeahead:

- The results list was silently capped at 8 with no hint more existed, so a
  search like "stairnose" (34 matches in the current book) looked like it only
  had a handful — the user read it as "only 4 stairnose colors exist".
- Searching "transition" found nothing: the price book labels transition
  pieces by profile (Reducer, T-Mold, End Cap, Stairnosing), never by the
  trade word.
- Building a selection often means picking a floor plus several of its trim
  SKUs — one pick per row was tedious.
- The Settings catalog (ADR 0002) had no bridge from the price book; adding a
  grout/mortar/underlayment product meant retyping its name and price.

## What changed

- `searchStock` returns **every** match; display code slices to 30 and shows
  "Showing 30 of N matches — keep typing to narrow". A query word
  `transition`/`transitions` matches items whose text contains any trim
  profile label (reducer, t-mold, end cap, stairnos-, threshold).
- `SkuPicker`: wider panel, arrow-key navigation + Enter, and multi-select —
  shift-click (or each row's checkbox) marks items across searches; "Add N
  products" fills the anchor row with the first item and appends a new product
  row per further item (snapshot semantics per ADR 0003 unchanged).
- Settings catalog add-product form gets an optional price book search that
  pre-fills the draft's name, price, and coverage (when the book has one —
  mortars never pre-fill coverage; three tiers can't come from one number).

Verified against the shop's new workbook (697 items; 155 Mannington Aduramax
trims parse with the existing fixed-column layout — the "missing transitions"
were a display cap + missing synonym, not a parser gap; a re-import of the new
book brings them in).

## Follow-up round (user feedback)

- The dropdown panel was clipped to the row's height: the product-row field
  bar (and the settings modal) use `overflow-hidden`, which clips absolutely
  positioned children. Both dropdowns now render through a portal on `<body>`
  with fixed coordinates anchored to the input (tracked on scroll/resize).
- Settings catalog products can now be **deleted**, not just disabled, behind
  an inline confirm that warns saved jobs will stop calculating. Empty
  companies get a delete button too. Deleting a starter underlayment
  tombstones its name in `catalog.removedSeeds` — otherwise the seed backfill
  in `normalizeCatalog` would silently resurrect it on the next load.
