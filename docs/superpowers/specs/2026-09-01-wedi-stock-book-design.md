# wedi's stock side comes from a registry price book (8a)

Date: 2026-09-01 · Status: Draft, awaiting owner review
Scope: a new stock-kind price book for wedi, a new `src/wediadapter.js`, and the
seam in `wedi.js` where `WEDI_STOCK` feeds `makeEntry`.
Related: ADR 0032 (Schluter is registry-driven — this is the same move for wedi's
stock half), ADR 0009 (price book registry), ADR 0025/0027 (re-import, diff, drift),
ADR 0003 (rows are snapshots), issue 066 (the transcribed engine), issue 080 (the
re-transcription chore this ends).

## Context

`wedi.js` is 6,027 lines, of which two generated tables are the bulk: a 151-row
stock export (`WEDI_STOCK`) and 229 rows of the Jan 2026 distribution pricelist.
Both are transcribed by hand and re-transcribed whenever the vendor's pricing
moves. ADR 0032 chose the opposite design for Schluter — the engine embeds no
catalog and reads live registry rows — and recorded that wedi "keeps its
transcribed-table design". The owner has since asked to move wedi the same way
(2026-09-01), having supplied both source workbooks.

Two things force the split this document proposes.

**The stock export is a clean table.** `WEDI_1.xlsx` is one sheet, 152 rows, seven
columns: Product Code · Full Description · Base Price (Cost) · Retail Price · Unit
of Stock · Supplier Prod Code · Mfg Product Code. That is exactly the shape
`detectVendorSkuAnalysis` (`src/pricebook.js`) already recognizes.

**The pricelist is not.** `USA_wedi_Distribution_Pricelist_JAN_1_2026.xlsx` is a
formatted vendor sheet: five sheets at 11–18 columns, section-title rows interleaved
with product rows, note rows ("Minimum Quantity is 75…"), and column layouts that
change *within* a sheet — the "wedi S-Dry" tab carries one header at row 4 and a
different one at row 8. Its `section` is load-bearing: the engine reads it for
`BROWSE_SECTIONS` and `sectionHit`. 338 part numbers are extractable and they cover
117 of the engine's 118 special-order-only entries, so the data is all there — but
reaching it needs a dedicated parser, not a column mapping.

So: the stock half moves now, the pricelist half is its own project (8b, out of
scope here).

## The import question, settled

The first open question was whether the existing wizard could take this workbook or
whether wedi needed a reader of its own. It can, unchanged. Running the real
`detectVendorSkuAnalysis` + `parseMapped` over the real file:

```
recognizer matched: true   sheet: Vendor SKU Analysis   headerRow: 0
columns: {0:sku, 1:description, 2:cost, 3:price, 4:unit, 5:vendorSku, 6:vendorSku2}
imported items: 152   warnings: 2
rows carrying a US-SKU in vendorSkus: 144 / 152
```

Sample row: `{sku:"47832", vendorSkus:["US5000009"], unit:"BX", cost:93.42,
price:154.14, description:"1000ct Wedi Metal Washer w/Tab - US5000009"}`.

**No import code changes.** The book is created as a stock-kind registry book and
the file dropped on it like any ERP export.

Two warnings the import raises, both benign here and both worth knowing:

- *3 rows with a $0 price* — `29WEDIT` (a "Wedi" category placeholder), `1518104`,
  `1518105`. `29WEDIT` is the row the transcription drops; 152 export rows → 151
  catalog entries is exactly this one. The other two are live $0 rows on the sheet
  and land as $0 lines, same as today.
- *6 carton-sold rows carry no sf/ct in the description* — they would quote the
  carton price per piece **if picked through ordinary row search**. The configurator
  is unaffected: it prices per EA/BX off its own catalog, never per sf.

## Decision

1. **A stock-kind registry book holds wedi's stocked range.** Created and imported
   by the owner in the app, by hand (non-negotiable 1 — an agent ships the code and
   the instructions, never touches the live project).

2. **`src/wediadapter.js` maps live book rows into `makeEntry`'s `stockRow`
   shape.** This mirrors `schluteradapter.js` one for one, and is the only file that
   sees a raw book row. `makeEntry(stockRow, soRow)` already takes exactly these two
   sources and merges them, so this is a seam that exists rather than one being cut:
   the pricelist keeps feeding `soRow` from the transcribed table, untouched.

3. **`WEDI_STOCK` stays in the file as the fallback.** The engine must never go
   inert because a book is missing — unlike Schluter, wedi has a working table
   to fall back on, and throwing it away on day one converts a pricing
   improvement into an outage risk. The owner tightened when the fallback
   fires (2026-09-01): "absent" and "present but not yet loaded" are different
   situations, and only the first one is safe to substitute for.

   | situation | behavior |
   |---|---|
   | No wedi book exists | fall back to `WEDI_STOCK`, `catReady: true`, `onBook: false`, Browse caption says "transcribed table" |
   | A book exists, rows not loaded or the fetch failed | `catReady: false` — wait, never substitute the table |
   | A book exists with rows | install them, `onBook: true` |

   A present-but-unloaded book must never fall back, because that silently
   quotes stale prices and resurrects discontinued items — the opposite of the
   safety the fallback exists to provide. A book whose rows all fail to adapt
   counts as an *empty* book — fallback plus `onBook: false` — which is exactly
   this decision's original intent: until the book has rows, the engine runs on
   `WEDI_STOCK` exactly as it does today.

4. **Nothing else in `wedi.js` moves.** `classify`, `kitFor`, `solve`, `panelPlan`,
   the bench and curb geometry, `lineItems` — all unchanged. The pinned engine tests
   stay pinned.

## The `us` derivation rule

The solver keys everything off `us`, the wedi US-SKU. The transcribed table has that
join baked in by hand; a live row carries the shop's code in `sku` and the vendor's
in `vendorSkus`. The adapter must recover it, and the rule below reproduces the
hand-transcribed `us` for **all 151 entries**, verified against the real workbook:

```js
export function usOf(row) {
  if (!row) return "";
  const codes = (row.vendorSkus || []).filter((c) => c && c !== row.sku);
  return codes.find((c) => /^US\d+$/i.test(c)) || codes[0] || "";
}
```

Three things it encodes, each earned from the data rather than assumed:

- **The shop's own Product Code is never the vendor's code.** Two rows repeat the
  Product Code in the Supplier column (`47815`, `47733`); excluding it is what makes
  the Mfg column win there.
- **A `US`-shaped code beats a numeric article code.** `29075`/`29076` carry an
  article number in Supplier (`075100050`) and the real US-SKU in Mfg (`US9330001`).
  Without this preference both would take the article number. This also has to hold
  regardless of which vendor column a code arrived in: `normFits` sorts
  `vendorSkus`, so column order does not survive normalization and the rule must
  never depend on it.
- **No fixup.** `28954` reads `US50000005` in both vendor columns, and
  `WEDI_STOCK` records `us: "US50000005"` — the transcription did *not* correct
  it, and `wedi.js:4339` carries compensating index code that depends on the
  ten-digit spelling. An earlier draft of this spec prescribed a `FIX` table
  mapping it to `US5000005`; that was drawn from `WEDI_SO`, the *pricelist*
  table, which does use the seven-digit form. Applying it to the stock half
  re-keys the entry and fails this spec's own equality test on exactly one row.
  Verified 2026-09-01: with no fixup, the rule reproduces all 151 transcribed
  `us` values.

Note what the rule is *not*: for the seven rows whose vendor code is a nine-digit
article number (`095225053`, `676800061`, …), the transcribed table uses that number
verbatim as `us`. There is no hidden US-SKU to find and no crosswalk to maintain —
the adapter passes through whatever code the row carries, exactly as the
transcription did. The eighth row without a US-SKU is `29WEDIT`, which has no vendor
code at all and is the row that gets dropped.

## Verification: the zero-drift baseline

Every cost and every retail in the export matches the transcribed table to the cent
— **zero drift across all 151 rows**. That makes the acceptance test unusually
strong, and it is the reason to do this now rather than after the next vendor price
change:

> Built against this workbook, the adapter's catalog must be **identical** to
> today's `WEDI_STOCK` catalog — entry for entry, field for field.

**Except `desc`.** The mapped importer always runs `splitSizeFromDescription`
(`pricebook.js:532`) and reassigns the description to the stripped name, moving
leading dimensions into `size`/`thickness`/`sfPerUnit`; 105 of 151 descriptions
differ as a result, and disabling `leadWidthSize`/`sfFromDescription` is worse —
the dimensions are then captured nowhere. Since `makeEntry` parses `w`/`d`/`t`
back out of `desc`, the adapter reconstructs it (`descOf`). Equality is
therefore asserted on every *derived* field — `key, us, erp, stock, name, group,
sub, w, d, t, sf, len, finish, drain, channel, cost, retail, unit, sizeText` —
which is the set a quote actually depends on. Prices remain exactly equal: zero
drift across all 151 rows.

Concretely:

1. A test fixture holding the imported rows (the `normBookItem` output above),
   committed the way `schluterfixture.js` is, so the suite needs no live Supabase.
2. A test that runs `catalog()` both ways and deep-equals the stock half.
3. The existing pinned `kitFor`/`solve`/`lineItems` totals must not move at all.

Any difference is a bug in the adapter, not a repricing — there is no judgement call
to make. Once that passes, a later sheet with real price movement is just data.

## What the owner does

1. Create a stock-kind price book named for wedi.
2. Drop `WEDI_1.xlsx` on it; the wizard recognizes it with no mapping to set.
3. Review the diff as usual and apply.

Nothing before step 3 touches quoting: until the book has rows, the engine runs on
`WEDI_STOCK` exactly as it does today.

## Consequences

- **Stocked wedi lines gain a `bookId`.** They then file as stock at order entry
  through tier 1 of `isSpecialOrder` (book provenance) rather than tier 2 (the
  configurator's verdict). Both give the same answer, so nothing moves — but tier 2
  stops being load-bearing for new wedi rows, and the 2026-09-01 fix stays necessary
  for every row already saved, which will never gain a `bookId` (ADR 0003).
- **Re-import machinery comes free.** Drift chips, the whole-book diff, the
  still-good stamp, per-item disable, flag review — all of ADR 0025/0027 applies to
  wedi's stock range the day the book exists.
- **A retired stocked item becomes visible.** Today a wedi item the shop stopped
  stocking stays "stocked" until someone re-transcribes the file. After this it
  shows up in the import diff like any other retiring row.
- **The pricelist re-transcription chore survives** (issue 080), halved. 8b ends it.
- **Two sources of truth during the transition.** The book and `WEDI_STOCK` can
  disagree once a new sheet is imported. That is intended — the book wins, the table
  is only the empty-book fallback — but it means the fallback must never be read
  when the book has rows, and the tests must cover the empty-book path explicitly.
- **The book does not extend the catalog.** `classify` is a hardcoded grammar of
  `US…` codes (`wedi.js:4042-4072`). A new wedi part number the grammar doesn't
  know is priced and searchable but files as `misc`, so the solver won't build
  with it and it lands in no browse section. The book ends *price*
  re-transcription, not *catalog* re-transcription; a new product line still
  needs its code added by hand. The equivalence suite's misc assertion is how
  this surfaces.

## Out of scope

- **8b, the pricelist book.** Needs a parser for the formatted workbook; its own
  spec.
- **Deleting `WEDI_STOCK`.** Only sensible once 8b lands and the fallback has no
  remaining job.
- **Any change to how wedi prices.** wedi publishes retail and the shop marks
  nothing up; the Builder × 0.82 rule is untouched.

## Answered

1. **Book name — "wedi"** (owner, 2026-09-01). One stock-kind book. The adapter
   therefore matches on `/wedi/i` against the book's name or `brandLabel`, mirroring
   the Schluter pattern.

## Still open for the owner

2. **Answered (2026-09-01).** `1518104`/`1518105` are *samples* — "Wedi S-Dry
   Mini Shower Base Sample" and "Wedi S-Dry Sample" — at $0 cost and $100
   retail, in both the export and the transcribed table. The import warning
   says "$0 price" but flags $0 *cost*. Deliberate, not a sheet artifact;
   nothing to fix before import. Only `29WEDIT` is genuinely $0/$0, and it is a
   custom-item placeholder that the adapter drops.
3. **Fallback lifetime.** Keep `WEDI_STOCK` as the empty-book fallback indefinitely,
   or plan its removal with 8b?
