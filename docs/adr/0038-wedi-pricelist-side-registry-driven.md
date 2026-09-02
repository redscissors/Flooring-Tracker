# ADR 0038 — wedi's pricelist side is registry-driven, not transcribed

- **Status:** Accepted
- **Date:** 2026-09-02
- **Scope:** `src/wedibook.js` (new), `src/wediadapter.js` (`adaptSoRow`/
  `adaptSoRows`, new), `src/usewedicatalog.js` (`pickWediSoBooks`, `useHalf`,
  `installSources`, `caption`), `src/wedi.js` (`SO_SRC || WEDI_SO`,
  `setSoSource`/`clearSoSource`/`soSourceIs`, `missingRequiredParts`, `kitFor`'s
  `no-panel`/`no-cover` hints — nothing else in the file moves),
  `src/WediConfigurator.jsx` (the Browse caption naming which half is on a
  transcribed table).
- **Related:** ADR 0037, which this ADR completes — 0037 moved wedi's stock
  half and left the pricelist half (`WEDI_SO`) transcribed as its own project
  (8b); reuses ADR 0009 (price book registry), ADR 0025/0027 (re-import, diff,
  drift, versions); ADR 0032 (the Schluter precedent this whole migration
  follows). Issue 080 (the re-transcription chore this ends) and issue 066
  (the transcribed engine). Full derivation, the measured figures, and the
  owner's answered questions live in
  `docs/superpowers/specs/2026-09-02-wedi-pricelist-book-design.md` (spec 8b),
  which this ADR summarizes rather than repeats.

## Context

ADR 0037 moved wedi's stock half onto a registry book and deliberately left
the pricelist half transcribed: `WEDI_SO`, a hand-transcribed 229-row table
(223 priced rows + 6 `kitNote` rows) feeding `makeEntry(stockRow, soRow)`'s
second argument — the pricelist's own product name, size wording, details,
retail, distributor net, and **section**, load-bearing for `BROWSE_SECTIONS`
and `sectionHit`. The pricelist is not a clean table: five sheets,
section-title rows interleaved with product rows, note rows, and column
layouts that change *within* a sheet ("wedi S-Dry" carries one header at row
4 and a different one at row 8). A column mapping cannot read it; reaching it
needs a dedicated parser, which was out of scope for 0037 and became its own
project (8b).

The owner has since supplied the current distribution pricelist. Measured
against the committed snapshot: the "wedi Fundo" sheet alone reproduces all
223 priced `WEDI_SO` rows with zero drift on `name`, `retail` and `net`
(2-dp), once the two footnote-asterisk part numbers are stripped. The
acceptance suite built on that measurement (`src/wediequivalence.test.js`)
surfaced three refinements the spec's text did not fully anticipate — folded
into decisions 5 and 6 below.

## Decision

1. **wedi's pricelist half is registry-driven as of this change.** An
   order-kind registry book named "wedi", created by the owner by dropping
   the distribution pricelist on the wizard, is parsed by `src/wedibook.js`
   (the sanctioned dedicated-parser exception, ADR 0009 §4) and mapped by
   `adaptSoRows` in `src/wediadapter.js`. Scope is the "wedi Fundo" and "wedi
   S-Dry" sheets; Builder Choice, Wellness and Spa, and New Product Data are
   skipped by name and named in a warning, each pending its own owner
   decision (retail rule; part-number identity; no prices).
2. **`WEDI_SO` remains as the no-book fallback, as `WEDI_STOCK` does; both
   are removable together in a later PR once the team has run on both books
   (owner, 2026-09-02).** Amends ADR 0037 decision 2's "until 8b lands": 8b
   landed and kept them, deliberately.
3. **The gate is per half** (ADR 0037 decision 4's three-way rule, applied
   twice), and the popup opens only when both halves are ready. The Browse
   caption names which half is on a transcribed table.
4. **The plausibility floor.** A book-fed half that would leave any `SKU.*`
   constant unresolvable is refused — the pricelist first, then the stock —
   and falls back to its table with the missing parts named
   (`missingRequiredParts`). `kitFor`'s panel and cover sites are also
   null-guarded with hints (`no-panel`/`no-cover`) rather than dereferencing a
   missing item.
5. **`discount` is not carried: nothing reads it.** `details` is read by
   caption, not the transcription's column position; the ten rows where that
   differs are pinned in `wediequivalence.test.js`, two of which
   (`US5000019`, `US5000044`) move only `sizeText`, because they carry no
   dimensions and the size line falls back to `details`; no `unit` moves.
   Measured beyond the spec's text: the pinned-`details` set is not
   stock-side-free — nine of the ten rows are stock entries whose `details`
   (and, for the two seats, `sizeText`) now read the pricelist's caption too,
   since both halves share `makeEntry`'s display layer.
6. **Thirty-four stock entries gain a pricelist twin they never had** (the
   two SS27/SS43 frames and 32 stocked S-Dry parts) and take the pricelist's
   display name, as every twinned row already does. Pinned; the owner saw the
   rename in the preview. Measured beyond the spec's text: 13 of the 34 also
   gained `w`/`d`/`t` where the ERP description carried none, parsed from the
   pricelist's size cell (the rule every Fundo twin already follows) — pinned
   null→populated only, in a `GEOMETRY_GAINS` map. Two of those are
   display-only mis-parses of prose the owner is meant to see and correct on
   the item in the book UI, not a parser bug: `US5076011` (S-DRY SEAL) reads
   "2 x 16 oz. bags" as 2×16, and the eight S-DRY drain covers
   `US1076001`–`08` carry wedi's own typo `3/3/4"` in the sheet, read as 1.
   Separately, `US3076003` (S-DRY Extension 24x48) swaps w/d because the ERP
   prints "24x48" and the pricelist "48 in. x 24 in."; nothing normalizes
   order for sdry-group entries and the solver never reads them (they are
   excluded from `pans()`/`solve()`), so it is display-only — pinned as
   `GEOMETRY_TRANSPOSED`. No price or quantity moved anywhere: the pinned
   `kitFor`/`solve` trees are identical with both books installed.

## Consequences

- **Re-import machinery comes free for the pricelist**, the same as it did
  for the stock half under ADR 0037 — drift chips, whole-book diff, the
  still-good stamp, per-item disable, flag review.
- **The catalog grows from 269 to 273** — four S-Dry parts the shop does not
  stock, priced and searchable for the first time.
- **The re-transcription chore (issue 080) ends**, for both halves now.
- **The residual risk of the shared module-level source is unchanged and now
  has four installers behind one hook** — `setStockSource`/`clearStockSource`
  and `setSoSource`/`clearSoSource` all set state at module scope in
  `wedi.js`, read by every consumer of `catalog()` including
  `comparekit.js`; `usewedicatalog.js` remains the sole permitted caller of
  all four. There is still no structural fix short of threading the catalog
  explicitly; the guard is still a comment.
- **A future sheet re-format fails to zero rows with a warning, rather than
  to garbage** — `wedibook.js` skips unrecognized sheets by name rather than
  guessing at a column layout, and `missingRequiredParts` catches a book that
  silently dropped a hardcoded part.
- **No price or quantity moved.** The three measured refinements above
  (decisions 5–6) are display-layer only — pinned `kitFor`/`solve` trees are
  identical whether the engine reads the tables or both books, and the two
  named geometry oddities (`US5076011`, `US1076001`–`08`) are prose the owner
  can correct on the item, not a defect in the parse rule.
