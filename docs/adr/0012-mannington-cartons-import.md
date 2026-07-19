# ADR 0012 — Mannington "Cartons Detail" price list: a fixed-grid PDF parser that also imports color-matched trims as their own products

- **Status:** Accepted
- **Date:** 2026-07-14
- **Scope:** system-wide (new `src/manningtonbook.js` parser + `orderFloorFirst` in `src/orderbook.js` + two small branches in `App.jsx`: parser routing in `onFile`, result re-ordering in `searchOrder`). No schema change; no new write path; no new dependency.
- **Related:** ADR 0010 (text-PDF import, header-driven), ADR 0009 (price book library / mapped-import wizard, §6 search), ADR 0003 (snapshot doctrine)

## Context

Mannington ships a dealer price list as a **45-page text PDF** ("Cartons Detail",
account-specific). It is a real, clean price book — 22 collections, 469 floor
coverings (LVT + laminate), each with a carton price, a $/sq-ft, carton
coverage, and a strip of 6–8 color-matched trim/molding SKUs (reducer, T-mold,
stair-nose, end cap, quarter round…). But the generic header-driven PDF reader
(ADR 0010) imports **zero** of it, for structural reasons the header-driven
approach cannot absorb:

- The orderable code is **not** the first column. Every row leads with Pattern ·
  Width · Color · Color Code, and the code sits fourth/fifth. `findAllHeaders`
  requires the left-most header cell to be the item code, so no table is ever
  recognized.
- The header is **stacked three lines deep** ("Price / Per / Carton"), and every
  row carries **two** prices ($/carton and $/sq-ft) a pixel apart.
- A **trim matrix** hangs off the right edge: one price per trim column (printed
  in the header), one SKU per trim per row.

Unlike the Glazzio case ADR 0010 solved (many per-page header layouts), this
book is the opposite: **one identical grid on all 45 pages.** A header-driven
reader is the wrong tool; a fixed-grid reader is the right one.

Owner decisions (2026-07-14) shaped the data model: floors keyed by **Color
Code**, trims are their own **transition products** keyed by **Catalog #**, and a
trim must **surface when its floor's Color Code is searched, floor first.**

## Decision

1. **A dedicated fixed-grid parser, `src/manningtonbook.js`.** It takes the same
   already-extracted text items (`[{ str, x, y, w }]` per page) as `pdfbook.js`,
   so it is `node --test`-covered without `pdfjs-dist`, and it emits the **same
   `{ name, rows, mapping, warnings }` canonical contract** — so it feeds the
   existing mapped-import wizard (diff preview, snapshot, honesty guarantee)
   unchanged. `isManningtonCartons(pages)` recognizes the layout (a "Pattern" row
   that also names "Color Code" and "Catalog #"); `App.jsx` routes to it, and
   every other text PDF stays on `parsePdfPages`.

2. **Columns are read by fixed x-band, not from the header.** Band boundaries sit
   at the midpoints between the observed data columns (so a value printed a
   sub-pixel off its header lands in its own band). Trim columns are labeled from
   the stacked header text above each section's "Pattern …" row and priced from
   that row's trim-zone `$` cells.

3. **Two kinds of row, one book.**
   - **Floor** — SKU = Color Code (verified unique across the book, never spanning
     two collections), type vinyl/laminate (from the page's LVT/Laminate banner),
     cost = carton price with its SF/carton coverage snapshotted so whole-carton
     ordering works (ADR 0003 carton model). A self-consistency guard drops to the
     per-sq-ft cost when carton ÷ SF-carton doesn't reconcile with the printed
     $/sq-ft (missing beats wrong, per ADR 0010).
   - **Trim** — SKU = Catalog #, deduped across the book (one physical molding
     serves up to six floors), cost = its column's header price per piece (EA),
     **no flooring type** so it lands as a misc/transition line. Its parent Color
     Code(s) ride in the description ("… — Quarter Round · fits APX020 FXR240"),
     which feeds the ADR 0009 §6 `search_text` column — **no SQL change** — so a
     floor-code search surfaces the trim in the picker, and the "fits" note tells
     the salesperson which floors the molding matches.

4. **`orderFloorFirst(results, query)` (pure, in `orderbook.js`) ranks the floor
   above its trims.** A color-code search returns the floor (exact SKU) plus every
   trim that carries the code; the server may rank a trim first, so results are
   stably re-tiered: exact-SKU match → any floor covering → everything else. It is
   applied in `searchOrder`'s two return paths and is a no-op for non-code queries.

## Consequences

- Mannington imports as **2,061 products** (469 floors + 1,592 trims), every one
  priced, through the normal review-before-apply wizard. Nothing new is stored
  and no migration is required.
- Trims are ordinary special-order products: they price by the book's markup,
  snapshot on pick, and drift like any other — no new product kind. Each trim
  row now carries a `trim` marker (the parser's "Kind" canonical column), so the
  book can price trims at a **separate markup** from the floors: `markups.trim`
  (edited in the book's Markup panel, shown only when the book has trims)
  outranks the group override and default in `resolveMarkup`. Left blank it falls
  back to the default, so nothing changes for a book that doesn't set it.
- The book is one vendor with no manufacturer code, so its markup group defaults
  to `productLine` — the collection (ADURA Apex / Max / Rigid / Flex…). That
  lets the owner set a **per-collection markup** through the existing `byGroup`
  overrides. The Markup panel now lets you switch the group axis in place (from
  the columns the book actually fills), so changing how floors are grouped no
  longer needs a re-import.
- A floor's picked name reads **"Mannington {collection} {pattern} {color}"**
  (e.g. "Mannington Adura Max Acacia African Sunset"). Three parser refinements
  feed it: the dealer **brand** ("Mannington") rides its own column so `label()`
  fronts every picked line; the **collection** is cleaned to its tier — the
  trailing format word (Plank / Rectangle / Tile / Hex) dropped and title-cased,
  so "ADURA Max Plank" → "Adura Max" (which also merges Plank/Rectangle variants
  into one markup group); and a **color that wraps to a second print line**
  ("African" / "Sunset") is folded back into the full "African Sunset". A
  re-import restates existing rows (brand/name/group change) through the normal
  diff; saved estimates keep their snapshotted names.
- The parser is **layout-specific by design.** A future Mannington re-format
  breaks it back to "0 rows recognized" (a visible warning), never to garbage —
  the same honesty guarantee every import path carries.
- Putting the parent codes in the description shows a "fits APX020…" note in the
  search picker (owner preference, 2026-07-14) and makes the trim findable by its
  floor's code. The note also rides onto a picked trim line; revisit if it reads
  as clutter on a printed quote.

---

## Amendment (2026-07-19) — the floor→trim link becomes a structured field

**Status:** Accepted · **Scope:** `src/manningtonbook.js`, `src/ovfbook.js`
(Hallmark + Tarkett), `src/pricebook.js`, `src/orderbook.js`. No schema change
(`price_book_items.data` is jsonb), no SQL to run, no new dependency.

The original decision put the parent color codes **only** in the description, on
the reasoning that this "feeds the ADR 0009 §6 `search_text` column — no SQL
change". That worked for the use it was designed for (type a floor code, see its
trims) and should be kept. But it made the relation a *string*, and three costs
surfaced once ADR 0019's OVF parsers (Hallmark, Tarkett) landed alongside it:

- **Truncation lost data.** `ovfbook.js` capped the note at six parents
  (`fits.slice(0, 6)`), so a molding serving a seventh floor was unfindable by
  that floor's code. Mannington had no cap — the two behaved differently for no
  stated reason.
- **Fuzzy search cannot be exact.** `search_price_book_items` matches on
  `word_similarity` at `p_threshold: 0.3`, so searching `APX020` also surfaces
  trims belonging to `APX021`/`APX025`. `orderFloorFirst` cannot separate them,
  having no link to check against.
- **The reverse direction did not exist.** Nothing could answer "what are *this*
  floor's trims", because a substring in prose is not queryable that way. The
  floated Trim-section proposal (`.scratch/025_ovf-vendor-books/ticket.md`)
  assumed the data was already there — "data side is free; this is a UI layer".
  It was not: the parsers computed the relation and discarded it.

**Decision.** Every trim-aware parser emits a twelfth canonical column, `Fits`,
carrying its parent floor SKUs space-separated and **uncapped**; it maps to a
sorted, deduped `fits` array on the order item. `trimsForFloor(items, sku)` reads
it for the reverse direction, by exact SKU containment.

The `· fits …` description note **stays**, now uncapped to match. That is
deliberate duplication: the note is what `search_text` indexes, so keeping it
preserves floor-code search with no SQL for the owner to run by hand. `fits` is
the authoritative relation; the note is its search-index projection.

Consequences:

- `fits` joins `BOOK_FIELDS`, so a changed parent list shows in the import diff.
  Array fields broke the diff's identity comparison (every trim would read as
  changed on every re-import), so field equality now goes through `sameField`.
- **Existing books must be re-imported** to gain `fits` — the stored descriptions
  are a lossy source (six-parent cap), so backfilling from them is not possible.
  Until a book is re-imported its trims have `fits: []`; search is unaffected.
- A later migration could index `fits` directly and retire the description note.
  That needs SQL run by hand, so it is deliberately out of scope here.
