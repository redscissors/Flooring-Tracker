# ADR 0036 — wedi's stock side is registry-driven, not transcribed

- **Status:** Accepted
- **Date:** 2026-09-01
- **Scope:** `src/wediadapter.js` (new), `src/usewedicatalog.js` (new),
  `src/wedi.js` (`setStockSource`/`clearStockSource`/`stockSourceIsBook`,
  `buildCatalog`'s `STOCK_SRC || WEDI_STOCK` read — nothing else in the file
  moves), `src/WediConfigurator.jsx` (renders nothing while `!catReady`, the
  Browse caption's "· transcribed table" suffix).
- **Related:** the same move ADR 0032 made for Schluter, applied to half of
  wedi — builds on ADR 0009 (price book registry) and reuses ADR 0025/0027's
  re-import/diff/drift machinery rather than re-implementing it; ADR 0003
  (rows are snapshots — a stocked wedi line saved before this change never
  gains a `bookId`); issue 066 (the transcribed engine), issue 080 (the
  re-transcription chore this halves). Amends ADR 0032 consequence 3, which
  recorded that wedi "keeps its transcribed-table design" — see that ADR's own
  amendment note. Full derivation, the acceptance-test detail, and the two
  answered owner questions live in
  `docs/superpowers/specs/2026-09-01-wedi-stock-book-design.md` (spec 8a),
  which this ADR summarizes rather than repeats.

## Context

`wedi.js` (issue 066) is a heavy, table-transcribed engine: two vendor
workbooks are baked into generated `WEDI_STOCK` (151 rows) and `WEDI_SO` (229
rows) arrays that ship with the module and get re-transcribed by hand
whenever the vendor's pricing changes (issue 080). ADR 0032 chose the
opposite design for Schluter — no embedded catalog, live registry rows read
at solve time — and at the time recorded that wedi keeps its own
transcribed-table design: wedi predates the registry-book pattern, publishes
its own retail with no shop markup to track, and porting it was out of scope
for that decision.

The owner has since asked to move wedi the same way, supplying both source
workbooks. The two tables are not equally movable, though:

- **The stock export is a clean table.** `WEDI_1.xlsx` is one sheet, 152 rows,
  seven columns, exactly the shape `detectVendorSkuAnalysis`
  (`src/pricebook.js`) already recognizes. No import code changes; the file
  drops onto a stock-kind registry book like any ERP export.
- **The pricelist is not.** The distribution pricelist is a formatted vendor
  sheet — five sheets, section-title rows interleaved with product rows,
  column layouts that change within a sheet — whose `section` is load-bearing
  for `BROWSE_SECTIONS`/`sectionHit`. Reaching it needs a dedicated parser,
  not a column mapping; that is its own project (8b).

So this decision moves the stock half only. Verified against the real
export: cost and retail match `WEDI_STOCK` to the cent on all 151 rows (zero
drift), and the adapter's `us` derivation rule reproduces all 151
hand-transcribed `us` values with no fixup table.

## Decision

1. **wedi's stock half is registry-driven as of this change.** A stock-kind
   registry book holds wedi's stocked range, created and imported by the
   owner by hand (non-negotiable 1). `src/wediadapter.js` maps live book rows
   into `makeEntry`'s `stockRow` shape (`usOf`, `descOf`, `adaptRow`,
   `adaptBookRows`), mirroring `schluteradapter.js` one for one and importing
   `inch` from `wedi.js` the same way `schluteradapter.js` imports `classify`
   from `schluter.js`. It is the only file that sees a raw book row.
2. **`WEDI_STOCK` remains as the no-book fallback, and stays load-bearing
   until 8b lands.** Unlike Schluter — which embeds no catalog at all and
   goes inert without a book — wedi has a working transcribed table, and
   discarding it on day one would convert a pricing improvement into an
   outage risk. `WEDI_STOCK` is only removable once the pricelist half (8b)
   also moves and the fallback has no remaining job; deleting it now is
   explicitly out of scope.
3. **The pricelist half stays transcribed.** `WEDI_SO` and `makeEntry`'s
   `soRow` merge are untouched. This is a genuine, deliberate split, not a
   phase boundary that happened to land here: the stock export is a clean
   mapped-import shape today, the pricelist is not, and 8b is its own spec.
4. **The fallback is gated and visible, not implicit.** `wedi.js` gains three
   exports — `setStockSource`, `clearStockSource`, `stockSourceIsBook` — and
   `buildCatalog` reads `STOCK_SRC || WEDI_STOCK`. The gate itself
   (`usewedicatalog.js`'s `gateOf`) is a three-way distinction the spec
   originally collapsed to two: no book falls back immediately (`catReady:
   true`, `onBook: false`); a book that exists but hasn't loaded (or whose
   fetch failed) blocks (`catReady: false`) rather than substituting the
   table, because a present-but-unloaded book silently quoting stale prices
   or resurrecting a discontinued item is worse than a wait; a book with
   rows installs them (`onBook: true`). A book whose rows all fail to adapt
   collapses to the empty-book case (fallback, `onBook: false`). The
   configurator renders nothing while `!catReady`, and the Browse caption
   appends " · transcribed table" whenever `onBook` is false, so a salesman
   reading prices off the fallback can see that they are.
5. **The module-level source is shared engine-wide, so `useWediCatalog` is
   the only permitted installer.** `setStockSource`/`clearStockSource` set
   state at module scope in `wedi.js`, read by every consumer of `catalog()`
   — including `comparekit.js`, which the Schluter popup's Compare tab
   reaches. `src/usewedicatalog.js` (`pickWediBooks`, `foldBookLists`,
   `gateOf`, `useWediCatalog`) is the sole caller of those two functions; the
   comment at its top is the only guard against a future lazy entry point
   reading wedi's catalog without going through the hook first and getting
   whichever source was last installed.

## Consequences

- **Stocked wedi lines gain a `bookId`.** They file as stock at order entry
  through tier 1 of `isSpecialOrder` (book provenance) rather than tier 2
  (the configurator's verdict). Both give the same answer today, but tier 2
  stops being load-bearing for new wedi rows, and stays necessary for every
  row saved before this change, which never gains a `bookId` (ADR 0003).
- **Re-import machinery comes free.** Drift chips, the whole-book diff, the
  still-good stamp, per-item disable, flag review — all of ADR 0025/0027
  applies to wedi's stock range the day the book exists, the same as it does
  for Schluter.
- **The book does not extend the catalog.** `classify` (`wedi.js:4042-4072`)
  is a hardcoded grammar of `US…` codes. A new wedi part number the grammar
  doesn't know is priced and searchable but files as `misc`, so the solver
  won't build with it and it lands in no browse section. This decision ends
  *price* re-transcription for the stock half, not *catalog* re-transcription
  — a new product line still needs its code added to `wedi.js` by hand. The
  equivalence suite's misc assertion (`wediequivalence.test.js`) is how a
  gap here surfaces, loudly, instead of shipping an unbuildable item.
- **Two sources of truth during the transition, by design.** The book and
  `WEDI_STOCK` can disagree once a new sheet is imported; the book wins and
  the table is only the empty-book fallback. The gate exists precisely so the
  fallback is never read once the book has rows, and the empty-book path is
  covered explicitly rather than assumed.
- **The pricelist re-transcription chore survives, halved** (issue 080). 8b
  ends it for the other half.
- **Residual risk: the shared module-level source.** Because the installed
  source is global rather than threaded as a parameter (spec decision 4
  forbids threading `cat` through), any future lazy entry point that reads
  wedi's catalog without calling `useWediCatalog` first will read whichever
  source the last popup happened to install. There is no structural fix
  short of threading the catalog explicitly; the guard is a comment today.
