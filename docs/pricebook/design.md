# Design: the price book library

The design of record for growing FloorTrack's single stock price book into a
managed library of 10-30 books — stock and special-order — without breaking
any of the promises the current system makes. Written and owner-reviewed
2026-07-12; the settled decisions are recorded in **ADR 0009**
(`../adr/0009-price-book-library.md`), which wins if the two ever disagree.
All questions Q1-Q5 are resolved inline below. Working ticket and real-sheet
analyses: `.scratch/008_multi-pricebook-system/`.

---

## 1. What must not change (the inherited contract)

Every part of this design is shaped by four standing rules that already govern
the stock book (ADR 0002/0003, architecture contract):

1. **Snapshot, don't live-link.** Picking an item copies its values onto the
   selection; nothing reads a price table at calculation time. A re-import —
   or, new here, a **markup change** — must never rewrite a saved estimate.
   Freshness is surfaced as a drift chip; applying it is a human act.
2. **Hide, never delete.** Items that drop out of a book go `active = false`.
   Books themselves, once imported, can be retired but not erased while any
   selection references them.
3. **Sanctioned write paths only.** Book/item writes happen through one import
   flow and (new) one item-edit flow — no ad-hoc writes.
4. **The team is the trust boundary** (ADR 0004). Any signed-in user can see
   and edit any book, including vendor costs and markups. Costs and margins
   are *internal*: they must never appear on the customer-facing print.

---

## 2. Data model — PROPOSED

### 2.1 Keep `stock_items` exactly as it is

The shop's stock workbook stays in `stock_items`, untouched. It is genuinely
special: it feeds the catalog price sync, the grout color families (ADR 0007),
and the Laticrete base-unit pairing (ADR 0006) — none of which apply to vendor
sheets. Leaving it alone means zero migration, ADR 0003 stays true as written,
and "stock outranks special order" is structural rather than a ranking rule.

The "stock space" in the UI is this book. Its ~9 internal sheets already carry
`sheet`/`section` on every item, so the browse UI can present them as separate
sheets without any schema change — **new pages added to the workbook flow in
automatically** (the generic table parser handles any sheet with a "SKU"
header; a new sheet that is a flooring-type sheet additionally needs its one
line in `SHEET_TYPE`, otherwise its items land as accessory/misc lines).

**RESOLVED (Q4, 2026-07-12):** there is one stock workbook today, but more
pages will be added and more stock workbooks are real — two arrived the same
day (Schluter + Wedi shop sheets, `../../.scratch/008_multi-pricebook-system/sheets/schluter-wedi-stock-2026-07-12.md`).
They use the main workbook's own table idiom and shop SKUs; the current parser
already consumes them fully except for one missing header alias
(`"Retail Price"` → price), so there is a **bridge available before the
registry exists**: add the alias and paste their Retail pages into the main
workbook. Long-term they become `kind='stock'` registry books. So the new
book registry carries a `kind` (`stock` | `order`) from day one instead of
being special-order-only: a future second stock workbook becomes a
`price_books` row with `kind = 'stock'`, its items in `price_book_items`, and
it participates in stock-first search ranking by kind (§6). The existing
`stock_items` table still stays untouched as the *first* stock book (reserved
id `'stock'`) — no migration, ADR 0003 intact.

### 2.2 New tables: the book registry

```sql
price_books (
  id          text primary key,          -- client uid(), like customers
  kind        text not null,             -- 'stock' | 'order'
  name        text,                      -- "Shaw 2026 Q3", "Daltile SO list"
  active      boolean default true,      -- retired books hide from search/UI
  data        jsonb,                     -- { vendor, note, mapping, markups,
                                         --   freight, skuPattern,
                                         --   lastImport{at,by,count} }
  created_at / updated_at timestamptz
)

price_book_items (
  book_id     text references price_books,
  sku         text,
  active      boolean default true,
  data        jsonb,                     -- same item shape as stock + { cost }
  updated_at  timestamptz,
  primary key (book_id, sku)             -- vendor SKU spaces overlap; the pair
                                         -- is the identity, never sku alone
)

pricebook_versions (
  id          text primary key,
  book_id     text,                      -- a price_books id, or 'stock' for
                                         -- the stock book (reserved id)
  label       text,                      -- "Import 2026-07-12" or hand-named
  pinned      boolean default false,     -- keeper: excluded from newest-3 pruning
  imported_at timestamptz,
  imported_by text,
  item_count  int,
  snapshot    jsonb                      -- the parsed items exactly as applied
)
```

RLS mirrors `stock_items`: select/insert/update for any authenticated user, **no
delete policy** on `price_book_items` (invariant: items are never deleted).
`pricebook_versions` gets insert/select/delete (the app prunes old versions,
same trust model as the existing `versions` table). All three ship as one
`supabase/pricebooks.sql` the owner runs by hand — an agent never executes it.

Why one shared `price_book_items` table instead of a table per book: 30 books
would mean 30 owner-run SQL files and unqueryable sprawl; `(book_id, sku)` rows
keep imports incremental and cheap exactly like `stock_items` rows do today.

Stock-kind books in the registry differ from order books only in what the
`data` jsonb uses: no `markups`/`freight` (their prices are already retail),
and their items store `price`/`priceSqft` like `stock_items` rows rather than
`cost`.

Sizing check — revised against the first real vendor sheet (the VTC EFT list,
see `../../.scratch/008_multi-pricebook-system/sheets/vtc-eft-2025-07-28.md`): **6,792 items in one book**, ~10× the
stock book, so 30 books ≈ 200k rows. Still trivial for Postgres, but eager
client-side loading of all books is off the table, not a hedge: registry-book
items load **lazily** (a book's items when opened in Settings) and the
selection-row search over them is a **server-side query** from Phase 1 (§6).
Item shape gains fields this sheet proved necessary: `mfg` (the markup group
key), `leadTime` (READY SHIP / IMPORT / MADE TO ORDER — a salesperson must see
this at pick time), `msrp` (the vendor's consumer-level price, reference
only), and `freightFlag` (per-item freight marker).

### 2.3 What lands on a Selection

A selection that picks a special-order item snapshots, exactly like stock
picks do today, plus three new fields:

```
sku        (exists today)               — the vendor SKU
bookId     (new)                        — which book it came from; "" = stock
cost       (new, internal)              — vendor cost/sqft (or /unit) at pick time
markupPct  (new, internal)              — the markup that produced priceSqft
tierPrice  (new)                        — book-defined contractor price, when
                                          the item has one (Q5); snapshotted
                                          at pick regardless of the project's
                                          contractor toggle
```

`priceSqft` (and `cartonSf` etc.) keep their existing meaning — the *selling*
price — so every downstream consumer (line math, totals, CSV, print) works
unchanged with zero conditionals. `cost`/`markupPct` are along for the ride so
the estimate can later show internal margin (§8) and so drift can be computed
against both the vendor's new cost and the book's current markup.

Per invariant 2 of the architecture contract, all three fields get legacy-safe
defaults in `normP` (`bookId: ""`, `cost: ""`, `markupPct: ""`) in the same
commit that introduces them.

---

## 3. Costs and markups — PROPOSED

The heart of the special-order feature. Rules:

**RESOLVED (Q1, 2026-07-12):** pricing is **percent over cost**, plus
sometimes **extra shipping charges that are per manufacturer**. The percent
model below stands as designed; freight gets its own rule (point 6).

1. **Items store cost, never sell price.** The vendor sheet's number is the
   cost; it is imported verbatim and is the thing the vendor re-issues.
2. **Markups live on the book**, in `price_books.data.markups`:

   ```
   markups: {
     groupBy: "mfg",                     // which item field keys the overrides —
                                         // chosen at mapping time (mfg, section,
                                         // productLine…)
     default: 45,                        // percent over cost
     byGroup: { "CER": 60, "FLO": 40 }
   }
   ```

   The group axis is **a column designated during import mapping**, not
   hardwired to the parser's section field — the VTC sheet proved why: it has
   no sections, and its natural axes are manufacturer (14 values, editable by
   hand) vs product line (150 values, not). The markup editor lists the values
   actually present in the imported items, each with an optional override,
   plus the book default. No free-form matcher language: the groups you can
   price are the groups the sheet actually has. A value that appears in a
   future re-import with no override quietly uses the default — and the import
   preview says so ("2 new manufacturers, using default markup").
3. **Sell price is computed at display/pick time**, not import time:
   `sell = round2(cost × (1 + pct/100))`. Baking sell prices into items at
   import would make a markup change either silently wrong or require
   re-import; computing at pick time means a markup edit affects **future
   picks only** — saved estimates keep their snapshot, exactly like a price
   book re-import today. This is the snapshot doctrine applied to markups, and
   it is the single most important decision in this design.
4. **Drift generalizes.** The existing chip says "price book now $X". For a
   special-order row it compares the row's `priceSqft` against
   `today's cost × today's markup` and shows both movements ("cost now $2.10,
   markup now 40% → $2.94"). One click applies, as today.
5. Markup changes are settings-grade edits: rare, whole-record (`price_books`
   row) upserts, last-write-wins — consistent with ADR 0002's accepted
   concurrency posture.
6. **Freight (per-manufacturer shipping), two modes**, configured per book in
   `price_books.data.freight: { mode: 'none' | 'perSqft' | 'perJob', amount }`:

   **RESOLVED interim (2026-07-12): highlight only, no charges yet.** The
   real-world charge for freight-flagged items isn't known yet, so for now
   freight ships as **visibility only**: flagged items get an "extra freight"
   chip in search results, on the selection row, and in the book's item table
   — and no freight amount is ever added to any price or total. The two
   charge modes below stay designed (the `freight` config slot is reserved)
   but are **not built** until the owner has real numbers; when that day
   comes it's a Phase-2-sized addition, not a redesign.

   - **`perSqft`** — a $/sqft (or $/unit) adder treated as part of cost:
     `sell = (cost + freight) × (1 + pct/100)`. Freight is a real cost, so the
     markup applies on top of it — margin stays margin. Folded in at pick
     time, snapshotted with everything else; a freight change later shows as
     drift like any price movement. *(If some vendors' freight should NOT be
     marked up, that's a one-boolean addition — confirm before Phase 2.)*
   - **`perJob`** — a flat charge per manufacturer per job. Doctrine-clean
     mechanism, reusing the existing companion-auto-add pattern (the Laticrete
     pigment → base-unit precedent): **picking the first item from that book
     on a job auto-adds a "Freight — {book name}" misc line** with the
     snapshotted amount. It is a visible, editable, deletable line like any
     other; a second pick from the same book does not add another (guard on an
     existing freight line carrying that `bookId`). No hidden totals logic, no
     live read at totals time, and the salesperson can waive it by deleting
     the line.

   A book can use both (rare, but a vendor with a fuel surcharge per order
   *and* freight-in cost exists); `amount` becomes `{ perSqft, perJob }` if
   that materializes — start with one mode per book until a real sheet
   demands otherwise. Freight, like markup, can be overridden per group
   (`byGroup`) since "per manufacturer" charges live inside one distributor
   book (VTC carries 14 manufacturers).

   **Per-item freight flags (from the VTC sheet):** some vendors mark
   individual items as carrying additional freight (VTC's `*` flag — 312
   oversized-slab items). Flagged items store `freightFlag: true`; picking one
   shows a "freight applies" chip and offers the per-job freight line even
   when the book's default mode is `none`. The flag never silently changes a
   price — it surfaces, the human decides.

**RESOLVED (Q2, 2026-07-12):** team-wide cost visibility is fine — no
permission change, ADR 0004 stands. Add a **"hide costs" screen-privacy
toggle** for when a customer is looking at the screen: one eye-icon toggle
that masks every cost/margin figure (book items' cost columns, markup
percents, drift-chip cost lines, the §8 margin line if it ships) behind "•••".
It is presentation only, session-local (component state, not saved settings),
and never affects what is stored or printed — a curtain, not a lock. Selling
prices stay visible; those are what the customer is being shown anyway.

**RESOLVED (Q5, 2026-07-12):** contractor pricing gets a **per-project
switch**, discount confirmed at **flat 8% off retail** as the fallback,
applied to **every line** (flooring, trim, misc, and setting materials —
grout, mortar, underlayment, caulk, base units). Mechanism:

- **Project** gains `contractorPricing: boolean` (default false, `normC`),
  toggled from the project header; the estimate and both print layouts carry
  a visible "Contractor pricing" label whenever it is on.
- **Tier prices are snapshotted at pick time regardless of the toggle**:
  when a picked book item carries a book-defined contractor price
  (`data.tierPrices.contractor` — e.g. Wedi's 0.82 × retail with per-item
  exceptions), it lands on the selection as `tierPrice`. Snapshotting always
  (not only when the toggle is on) means flipping the switch later needs no
  re-picking.
- **Effective sell at calc time**:
  `contractorPricing ? (tierPrice ?? round2(price × (1 − pct/100))) : price`
  — a book's real tier always outranks the flat fallback. Carton lines
  discount the $/sqft before the order × sf × psf billing formula, so all
  four carton call sites stay in agreement (invariant 7).
- **The fallback rate lives in Settings** (`contractorPct`, default 8,
  normalized in `mergeSettings`) and is read live at calc time — the same
  live-by-design behavior as the waste rates, and the same accepted
  consequence: changing the shop rate re-flows open contractor jobs. The
  per-line `tierPrice` stays a snapshot; only the shop-level rate is live.
- **Doctrine note:** this does not breach snapshot-don't-live-link. That rule
  guards estimates against *external* changes (re-imports, markup edits)
  silently rewriting them. The contractor switch is the salesperson
  deliberately repricing *their own project* — the same class of act as
  editing a price by hand — and it is instant, whole-estimate, reversible,
  and labeled on the print.
- Print/CSV show the discounted prices (with the label); the retail delta is
  not itemized. Costs and margins remain internal-only as ever.

---

## 4. Import pipeline — PROPOSED

The stock workbook keeps its hand-built adapters (`src/pricebook.js`) — they
encode years of that document's quirks and should not be generalized away.

Special-order sheets get a **generic mapped import** instead of per-vendor
code:

1. Upload the .xlsx/.csv into the book (SheetJS, lazy-loaded, browser-side —
   same as today).
2. The generic table detector (the `parseTables` machinery already handles
   header rows, sections, carried colors) proposes a column mapping:
   which column is SKU, description, cost, unit, size, coverage… It must scan
   for the header row rather than assume the top (VTC's header sits at row 14
   under a title/legend block), and it must let the user label **headerless
   columns** — VTC's description and status-flag columns have no header text,
   so a header-name-only mapper would lose both.
3. The user confirms/fixes the mapping in a preview grid showing the first
   rows parsed both ways. The mapping includes: which sheet holds the data
   (vendors ship helper/index/legend sheets alongside — VTC has four, one
   real), the **markup group column** (§3), and a **flag legend** for status
   columns (VTC: `xx` → discontinued, `*` → freight flag, `•` → made-to-order,
   `◪` → transitioning). **The mapping is saved on the book**
   (`data.mapping`), so every re-import of that vendor's sheet is one click.
4. Diff preview → apply, byte-for-byte the same flow as the stock import:
   added / changed / retired counts, chunked upserts, `active=false` for
   missing SKUs, never a delete. The apply also writes a `pricebook_versions`
   row (§5).

Per-vendor **SKU patterns**: the stock book's `/^\d{4,8}$/` rule is what makes
a rearranged sheet degrade to visible missing-counts instead of garbage rows.
Vendor SKUs won't all be 4-8 digits (VTC item codes are 9-16 alphanumeric
chars, zero of which the stock regex would accept), so each book carries its
own pattern (`data.skuPattern`, default "1-20 alphanumeric chars, at least one
digit"), inferred at first mapping and editable. The degradation rule itself —
*a row is only consumed if its SKU cell matches the pattern* — is kept, it's
the parser's honesty guarantee.

Why mapped-import beats per-vendor adapters at this scale: 10-30 vendors means
10-30 adapters to write, test, and re-fix every time a vendor reformats. A
saved mapping is data, editable by the team in the UI, no deploy. The stock
book keeps adapters because its layouts (grout matrices, Aduramax trim rows)
are beyond what a column mapping can express — if a vendor sheet turns out to
be that gnarly, that one vendor gets an adapter, as the exception.

---

## 5. Versions and rollback — PROPOSED

`pricebook_versions` keeps the **last 3 imports per book** (stock included,
under the reserved book id `'stock'`) **plus any pinned keepers**. On apply:
insert a version row holding the parsed items exactly as applied, then prune
unpinned rows to the newest 3 — the same keep-newest-N pattern as
auto-versions (`AUTO_KEEP`), with pinned playing the role named versions play
there.

**Rollback is a re-import, not a restore.** "Fall back" loads the old
version's snapshot and pushes it through the normal diff preview → apply flow:
the user *sees* what rolling back will change before anything is written, the
rollback itself becomes the newest version (so it can be rolled back), and
there is exactly one write path into item tables. No blind flip.

Sizing: ~700 items ≈ 200-300 KB of jsonb per version; 31 books × 3 versions is
well under 30 MB total. Fine. Snapshots store **cost**, not sell — a rollback
never resurrects an old markup (markups aren't versioned; they're settings).

**RESOLVED (Q3, 2026-07-12):** 3 rolling versions per book, **plus pin-as-
keeper**: any version can be pinned (`pinned` boolean on the row), pinned
versions are excluded from pruning, and the newest-3 rule applies to unpinned
rows only — the exact named-vs-auto split the project versions table already
uses. Nothing beyond that for now (no unlimited named versions, no labels UI
past a pin button). Pinning is in scope for Phase 4, not later.

---

## 6. Search and stock priority — PROPOSED

The SKU box on a selection row today searches the in-memory stock list. With
order books it becomes a two-tier search:

1. **Stock first, always — by kind, not by table.** Matches from every
   stock-kind book (the `stock_items` book plus any future `kind='stock'`
   registry books) render first, exactly as today.
2. **Special-order matches follow**, each badged with its book name
   ("Shaw 2026 — special order"), showing the *sell* price (cost × markup,
   computed live for display; snapshot happens only at pick).
3. **Exact-SKU collision resolves to stock.** If the same SKU string exists in
   both spaces, the search shows the stock item and a small "also on
   Shaw 2026" note — it never silently offers the special-order twin. There is
   no reliable cross-vendor "same product" detection beyond SKU equality
   (descriptions differ per vendor); anything fuzzier would guess, and a wrong
   guess prices a job off the wrong list. Honest and simple beats clever here.
4. The result cap lesson from issue 005 carries over: always show
   "Showing 30 of N", never truncate silently.

Mechanics: registry-book items are not eagerly loaded at sign-in (§2.2), and
the VTC sheet settled the earlier hedge — at ~6.8k items per book,
load-everything-on-first-search dies around book three. Search over registry
books is a **Supabase server-side query** (`ilike` over a generated
search-text column on `price_book_items`, indexed with `pg_trgm`), debounced
from the SKU box; stock results stay instant from the in-memory list, order
results stream in behind them. Search results show the item's lead time
("IMPORT" vs "READY SHIP") next to the sell price — a salesperson quoting a
made-to-order slab needs to know before picking, not after.

---

## 7. Settings UI — PROPOSED

The Settings workspace's "Price book" section grows into the library:

```
Price book
├── Stock
│   ├── Shop workbook        ← the stock_items book, per-sheet browse
│   │   ├── [Import updated workbook]   (existing flow, unchanged)
│   │   ├── sheet list → searchable item table
│   │   └── Versions (last 3, rollback via preview)
│   └── [+ New stock book]   ← future kind='stock' registry books (Q4);
│                              mapped import, no markups — otherwise
│                              identical to an order book's detail view
└── Special order
    ├── [+ New book]
    └── per book:
        ├── header: name, vendor, active toggle
        ├── Items: searchable table (search box = searchStock), inline edit
        ├── Markups: default % + per-section overrides · Freight mode
        ├── Import: upload → mapping → diff preview → apply
        └── Versions (last 3 + pinned keepers, rollback via preview)

[👁 Hide costs]  ← one toggle masking every cost/margin figure ("•••") while
                   a customer can see the screen; session-local, resolved Q2
```

Master→detail like the catalog sections that already exist in
`SettingsWorkspace`; reuse its list/detail idioms and the existing import
preview components rather than inventing new ones.

**Item fine-tuning.** Any item field (cost, description, size, coverage,
discontinued) is editable inline; the edit is a single-row upsert (a new
sanctioned write path, `updateBookItem`) and stamps `data.editedBy/editedAt`.
The next import's diff preview **calls out hand-edited items explicitly**
("3 items you edited by hand will be overwritten") so a re-import never
silently eats a correction. Same affordance for stock items — today the only
way to fix a stock typo is to fix the workbook and re-import, which is
correct-by-doctrine but slow; inline edit with the same import-overwrite
warning keeps the workbook the source of truth while allowing spot fixes.

Every UI slice above merges only with preview proof (screenshots), per the
non-negotiables. The mapping/preview grid is a strong candidate for the house
throwaway-prototype method before building it for real.

---

## 8. Improvement opportunities the owner didn't ask for (opinions)

1. **Margin visibility (recommended, cheap).** Because special-order lines
   snapshot `cost` and `markupPct`, the estimate can show an *internal-only*
   margin line ("materials margin ≈ $X / Y%") on screen — never on print.
   No competitor tool at this scale shows live job margin; the data is free
   once §2.3 lands. Needs stock items to optionally carry cost too (the stock
   workbook has no cost column today — margin would cover special-order lines
   only until it does).
2. **"Also stocked" nudges at pick time.** §6's collision rule is per-SKU;
   a softer, still-honest nudge: when a special-order pick's description
   words all match some stock item, show "similar stock item exists — $X"
   without auto-switching. Worth prototyping only after real vendor data
   proves the false-positive rate is tolerable.
3. **Book-level staleness chip.** *(Built — Phase 5b, 2026-07-13.)* Each book
   shows "last imported N days ago by whom" (already stored); a book past a
   configurable age (`settings.ops.staleDays`, default `DEFAULT_STALE_DAYS` =
   120 in `orderbook.js`) gets an amber chip in the library list and its detail
   header. A never-imported book has no age and is not flagged. Vendors re-issue
   quarterly; a 200-day-old cost list quietly mispricing jobs is the most likely
   real-world failure of this whole system. Pure predicate `bookStaleness`
   (orderbook.js) is unit-tested.
4. **Deferred, deliberately:** per-user cost visibility (breaks ADR 0004 —
   needs its own ADR), fuzzy cross-book product matching (guessing wrong
   prices jobs wrong), and
   markup versioning (markups are settings; the drift chip already surfaces
   the consequence). Automatic vendor-sheet fetching, once deferred as "no
   server today," landed as ADR 0019 (bookmarklet + Netlify relay); only the
   fully-headless cron variant stays deferred (it would store portal
   credentials).

**RESOLVED (Q4, 2026-07-12):** one stock workbook today; more pages likely,
more stock workbooks possible. Handled in §2.1/§2.2: the registry carries
`kind` from day one, `stock_items` stays the untouched first stock book, and
future stock workbooks join as `kind='stock'` registry books with no schema
change. New pages in the existing workbook already flow through the generic
table parser (a new flooring-type sheet needs one `SHEET_TYPE` line).

---

## 9. Phasing

Each phase is independently shippable, PR-gated, and leaves the app fully
working. No SQL runs until the owner runs `supabase/pricebooks.sql` by hand.

| Phase | Delivers | Depends on |
|---|---|---|
| Bridge (anytime) | `retailprice`/`mfgsku` header aliases in `src/pricebook.js` (+ tests); team pastes the Schluter/Wedi *Retail* pages into the main workbook — both sheets then import through the existing flow | nothing — independent of the registry |
| 0 | ADR (via `/decide`) recording §2/§3/§5 decisions + `supabase/pricebooks.sql` + this design folded into `docs/pricebook/` | none — all questions Q1-Q5 resolved |
| Contractor switch (independent) | Project `contractorPricing` toggle + `contractorPct` setting (default 8) + every-line effective sell at calc time (line calc, totals, CSV, both prints — all four carton sites stay in agreement) + "Contractor pricing" label on estimate/print + `normC`/`mergeSettings` defaults. `tierPrice` override activates automatically once Phase 2 snapshots exist | nothing — flat-fallback version works against today's app; UI/print slices need preview proof |
| 1 | Book registry (kind-aware) + generic mapped import + browse/search per book (costs visible, flat default markup only) + hide-costs toggle | Phase 0, first test vendor sheet |
| 2 | Markup editor (default + per-group), sell-price display, pick snapshot with `bookId/cost/markupPct`, drift chip generalization, `normP` defaults, **freight-flag highlighting only** (chips in search/row/book table — no freight charges until real numbers exist) | Phase 1 |
| 3 | Cross-space SKU search on selection rows with stock priority + collision rule | Phase 2 |
| 4 | `pricebook_versions` writes on apply (stock book included) + pin-as-keeper + rollback-via-preview + inline item edit with overwrite warnings | Phase 1 (can parallel 2-3) |
| 5 | Opinions from §8 that survive owner review — **5b staleness chips built (2026-07-13)**; 5a margin line pending | 2-4 |

Phase 1 is deliberately useless-for-quoting on its own (no markup → no sell
price on rows) so the first vendor test sheets can be imported, browsed, and
mapping-tuned against real data *before* any of them can touch an estimate.

## Test surface

All new logic lands in pure modules per the architecture contract:
`src/orderbook.js` (markup resolution, sell-price calc, drift, collision
rules, mapping application) and extensions to `src/pricebook.js` (generic
mapped parse) — every one reachable by `node --test` with plain arrays, no
Supabase, no SheetJS. Golden cases: markup override vs default, freight
fold-in ((cost + freight) × markup) and the perJob single-add guard, markup change
not moving a saved estimate (snapshot), rollback diff correctness, SKU
collision → stock, hand-edit overwritten only with warning.
