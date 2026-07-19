# ADR 0025 — A price book may be fed by several source sheets: items carry their provenance, and an import retires only its own slice

- **Status:** Proposed
- **Date:** 2026-07-19
- **Scope:** system-wide — item shape (`sources` on the order item, jsonb, no schema change), `diffBookItems` retire semantics (`src/orderbook.js`), `applyBookImport` (`src/App.jsx`), the import router's per-book batching, and the wizard's retire preview. No SQL to run; no new dependency.
- **Related:** ADR 0009 (price book library — the import contract this amends), ADR 0024 (one price-book library — the sheet↔book model this amends), ADR 0003 (snapshot doctrine), ADR 0012 + its 2026-07-19 amendment (trims as their own products, `fits`)

## Context

ADR 0009 fixed the import contract as: parse a file, diff it against the book,
upsert what changed, and mark every active SKU **absent from that file**
`active = false` — *"missing SKUs go `active = false`; nothing is ever deleted"*
(0009:46). That rests on an unstated invariant:

> **the file being imported is the complete, authoritative contents of the book.**

True for every book we have shipped. It stops being true the moment a vendor
splits its price list across files.

**Mirage is that vendor.** Ohio Valley Flooring publishes it as four documents,
and no three of them are a book:

| File | Supplies | Alone it is |
|---|---|---|
| `Mirage_Product_Chart.pdf` | floor SKUs at collection × grade × **color** × width | identity, no prices |
| `OVF-Mirage-Hardwood.xls` | prices at collection × grade × width (eff. Jul 13 2026) | prices, no colors |
| `OVF-Mirage-Value-Tower.xls` | same axes for the value tier (eff. Feb 3 2025) | prices, no colors |
| `OVF-Mirage-Trim.xls` | trim SKUs by (collection, color) + trim prices by type × species | self-contained |

Two facts make this more than an inconvenience.

**The chart and the price sheets must be joined, not concatenated.** The chart
gives a SKU and its identity with no price; the flooring sheets give a price
keyed by (collection, grade, width) with no color. Neither is a usable row.
Sequential import cannot do it either, because the write path is a SKU-keyed
upsert (`onConflict: book_id,sku`) — there is no way to express "update every row
matching this (collection, grade, width)".

**The file set varies between updates.** The owner does not expect Value Tower to
always be published, and it is not redundant: it is the **only** source for the
Lakeside collection and the Escape *Traditional* colors (Blue Ridge, Champlain,
Chelan, Madison, Moosehead, Yellowstone). Neither the chart nor the Hardwood sheet
contains them. A quarter where that file is missing must not retire live
inventory.

So bundling alone does not fix this: a bundle of three files still looks like
"the whole book" to `diffBookItems`, and would retire everything the fourth file
contributed.

### There is already a live bug here

The storage layer has always permitted many sheets per book — `bookId` is a plain
field on a sheet record and is deliberately not part of `recordKey`. Nothing
enforced 1:1; only the read path assumed it (fixed in #174).

Which means this is reachable **today**: link two sheets to one book, batch
download, press "Review all". The router forces both files at the same book and
runs them sequentially, one wizard each, reloading the book's items between. Apply
the first, the book holds the first file's SKUs; apply the second, every one of
them is absent from the second file and is retired. **Final state is only the last
sheet's contents active, with no warning.** Nobody has hit it because nothing
linked two sheets to one book until Mirage.

ADR 0024 never argued for 1:1 — it assumed it in the singular ("a book knows and
can refresh its **own feed**", 0024:42-46; *"every book has exactly one home"*,
0024:46-48). Its pending pool is keyed by sheet (`recordKey`) *deliberately*
(0024:52-54), and its review targets are already a **file → bookId map**
(0024:81-84) — i.e. the plumbing always tolerated many files naming one book. Only
the retire semantics did not.

## Decision

**1. An item records which source sheets it came from.**

`normOrderItem` gains `sources: string[]` — sorted, deduped, empty by default.
`bookItemData` already strips only the column-backed fields, so this rides in
`data` jsonb: **no migration, nothing to run in Supabase.**

A source id is stable and human-traceable:

- fetched from a portal → `recordKey(sheet)` (`vendor:host:uid:user`), the same
  key ADR 0024's pending pool already uses;
- dropped by hand → the drop router's format tag plus the sheet/file name.

An item may legitimately carry **several** sources (a SKU printed in both Hardwood
and Value Tower), which is why this is an array and not a scalar.

**2. An import declares the source set it speaks for, and retires only within it.**

```js
// today
const missing = existing.filter((it) => it.active && !seen.has(it.sku));

// proposed
const missing = existing.filter((it) =>
  it.active && !seen.has(it.sku) && ownedBy(it, importSources));
```

`ownedBy(item, set)` is true when the item has sources and **all** of them are in
the declared set. Consequences of that choice, stated plainly:

- A SKU that only Value Tower supplies is untouched by an import that does not
  include Value Tower. This is the Lakeside case.
- A SKU supplied by both Hardwood and Value Tower is retired only when an import
  covering **both** omits it. A single-file import cannot retire a shared row.
- The failure direction is a **stale row surviving**, never a silent deletion.
  Given `active = false` already means "hidden from search but still resolving for
  saved estimates", surviving is the cheaper error.

**3. A whole-book import keeps today's behavior exactly.**

An import that declares **no** sources is an unscoped, whole-book import and
retires globally, as now. Every existing single-file book behaves identically on
its next import; nothing about them changes.

**4. The first scoped import of an unscoped book adopts its items.**

A book whose items predate this ADR has `sources: []`. If a scoped import retired
nothing on those, they would become immortal; if it retired them freely, adding a
second sheet to an existing book would wipe the first sheet's contents — the very
bug being fixed.

So: the first scoped import of a book whose items are all unscoped **stamps those
items with the importing source**. Historically the book *was* fed by exactly that
file, so this records what was already true. The wizard states it ("N existing
items will be attributed to this sheet") rather than doing it silently.

**5. "Review all" batches by book.**

The router groups pending files by target book and hands each book's file **set**
to a single wizard pass, instead of enqueuing them independently. One diff, one
apply, one source set — which is what makes rule 2 correct rather than
theoretical. This is also what fixes the live bug above.

**6. A parser may consume several files.**

`parseMirage(payloads)` follows the existing `parseOvf` / `parsePdfPages`
precedent — collapse N inputs into one canonical sheet plus a mapping — extended
from N sheets/pages to N files. Everything downstream (sheet picker, mapping
controls, diff) is untouched.

## Alternatives considered

**Require the complete file set.** Rejected: the set genuinely varies, and Value
Tower is load-bearing. A hard requirement would block importing Mirage at all in
any quarter a file is not published.

**Split Mirage into several books** (floors / trim). Rejected for the floors: the
chart and the price sheets describe *the same products* and must be joined, so
they cannot be separate books. It would work for the trim sheet alone, but then a
trim's `fits` would point across a book boundary, and `trimsForFloor` filters one
item list. Not worth the split.

**A "merge, don't retire" flag on the import.** Rejected as a footgun: it makes
correctness a per-import human choice, and the wrong choice silently retires
inventory. Provenance derives the same answer from data.

**Scope by the existing `sheet` field.** Rejected — that field belongs to *stock*
items (`pricebook.js` `norm()`), not registry items, and is not in `BOOK_FIELDS`.
Registry items have no such field to scope by.

## Consequences

- **The live sequential-retire bug is fixed** as a side effect of rule 5. That is
  arguably the main win; Mirage is the occasion, not the whole reason.
- `sources` joins `BOOK_FIELDS` so a changed attribution shows in the import diff.
  Being an array, it must compare by value — the same `sameField` the `fits` array
  already needs (ADR 0012 amendment).
- **The wizard must show what will be retired and what is being left alone**, with
  the reason ("12 items from OVF-Mirage-Value-Tower.xls are not in this import and
  are kept"). A scoping rule the user cannot see is a scoping rule they cannot
  trust.
- Re-importing an existing book **does not** need doing for correctness; rule 3
  keeps it identical. Books only gain provenance when they first import a scoped
  source.
- A book can now legitimately show several "last imported" facts. The source strip
  (#174) already renders per-sheet rows; `book.data.lastImport` stays a single
  book-level stamp, so staleness remains one number. Per-source staleness is
  deliberately **not** in scope.
- This amends ADR 0009's import contract (the invariant that one file is the whole
  book) and ADR 0024's implicit 1:1 sheet↔book reading. Neither is contradicted in
  spirit: 0009's "nothing is ever deleted" is strengthened, and 0024's file→book
  map is what made this expressible.
- Risk if rule 4 is wrong: adopting items attributes them to a sheet that did not
  produce all of them (a book previously fed by hand-dropped files from two
  vendors). The wizard's stated count is the guard; a wrong attribution is
  repairable by a full unscoped re-import.
