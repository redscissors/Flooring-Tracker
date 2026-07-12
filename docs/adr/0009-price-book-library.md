# ADR 0009 — Price book library: kind-aware book registry, cost + markup for special order, versions with keepers

- **Status:** Accepted
- **Date:** 2026-07-12
- **Scope:** system-wide (new price_books / price_book_items / pricebook_versions tables + selection data model + import pipeline + Settings UI)
- **Related:** `docs/pricebook/design.md` (full design), `.scratch/008_multi-pricebook-system/ticket.md`, ADR 0002, ADR 0003, ADR 0005

## Context

The shop is growing from one stock price book (ADR 0003) to 10-30 sheets:
more shop *stock* sheets (Schluter, Wedi — retail-priced, shop SKUs) and
*special-order* vendor lists that carry a dealer **cost** needing a markup to
become a selling price (first real example: the Virginia Tile EFT list, 6,792
items, 14 manufacturers, per-item freight flags). Estimates must stay quotes:
nothing that changes in a book or a markup may rewrite a saved selection.
Three real sheets were analyzed before deciding; their findings drove every
choice below (`.scratch/008_multi-pricebook-system/sheets/`).

## Decision

1. **A book registry, kind-aware from day one.** New tables (one owner-run
   `supabase/pricebooks.sql`): `price_books` (id, `kind` = `stock` | `order`,
   name, active, data jsonb) and `price_book_items` (**PK (book_id, sku)** —
   vendor SKU spaces overlap), same trust model and no-delete rule as
   `stock_items`. The existing `stock_items` table is untouched: it is the
   *first* stock book, reserved id `'stock'`. Each book carries its own SKU
   pattern (VTC codes are 9-16 alphanumeric; the stock regex matches none).
2. **Special-order items store cost, never sell.** Markups live on the book:
   `{ groupBy, default, byGroup }`, where `groupBy` is a column designated at
   import mapping (VTC: manufacturer — 14 values; its 150 product lines are
   unusable as an editing surface). Sell = `round2(cost × (1 + pct/100))`,
   computed at **pick time** and snapshotted onto the selection
   (`priceSqft` = sell, plus `bookId`/`cost`/`markupPct`), so a markup edit
   affects future picks only — the snapshot doctrine of ADR 0003 extended to
   markups. Drift chips generalize (cost moved, markup moved, or both).
3. **Freight: highlight only, for now.** Items flagged by the vendor
   (`freightFlag`) show an "extra freight" chip in search, on the row, and in
   the book table; **no freight amount is added anywhere** until the owner
   has real charge numbers. Config slots for the two designed charge modes
   (per-sqft fold-in before markup; flat per-job auto-added misc line via the
   companion-add pattern) are reserved, not built.
4. **Mapped import, not per-vendor parsers.** Registry books import via a
   generic column-mapping flow (header row scanned for, headerless columns
   labelable, status-flag legend, data-sheet selection), with the mapping
   saved on the book so re-imports are one click. Same diff-preview → chunked
   upsert flow as ADR 0003; missing SKUs go `active = false`; nothing is ever
   deleted. The main stock workbook keeps its hand-built adapters.
5. **Versions: last 3 + pinned keepers, rollback is a re-import.** Every
   apply writes a `pricebook_versions` row (stock book included); unpinned
   rows prune to the newest 3, pinned rows never prune. Rollback loads a
   snapshot through the normal diff preview — visible, single write path,
   itself versioned. Snapshots store cost, never sell; markups are settings
   and are not versioned.
6. **Search: stock outranks special order, by kind.** Stock-kind matches
   render first; order matches follow, badged with their book and showing
   computed sell price and lead time. An exact-SKU collision resolves to the
   stock item. Registry items are not eagerly loaded; their search is a
   server-side query.
7. **Costs stay team-visible; a screen-privacy toggle hides them.** ADR 0004
   stands. One session-local toggle masks every cost/margin figure on screen
   ("•••") for over-the-shoulder moments; presentation only, never stored,
   never printed (print never shows cost regardless).
8. **Contractor pricing is a per-project switch.** A Project gains
   `contractorPricing` (toggle in the project header; "Contractor pricing"
   label on the estimate and both prints). Sheets with a contractor tier
   (Wedi: 0.82 × retail with per-item exceptions) import it into
   `data.tierPrices`, and picking such an item snapshots `tierPrice` onto the
   selection **regardless of the toggle** so flipping it later needs no
   re-picking. Effective sell at calc time, applied to **every line**
   (flooring, trim, misc, and setting materials):
   `contractorPricing ? (tierPrice ?? round2(price × (1 − pct/100))) : price`,
   with the fallback rate a Settings field (`contractorPct`, default **8**)
   read live like the waste rates. This is not a breach of
   snapshot-don't-live-link: that doctrine guards against *external* changes
   rewriting quotes, while this switch is the salesperson deliberately
   repricing their own project — instant, reversible, and labeled.

## Why

- **Snapshot-at-pick for markups** for the same reason ADR 0003 chose it for
  prices: a live link (or import-time baking) silently rewrites or staleness-
  locks quotes; compute-at-pick + drift gives freshness visibility with zero
  silent mutation.
- **`stock_items` untouched** because it feeds catalog sync, grout families
  (ADR 0007), and base-unit pairing (ADR 0006) — none of which vendor books
  need — and because leaving it alone means zero migration and ADR 0003 stays
  true as written.
- **One shared items table over per-book tables:** 30 books would mean 30
  owner-run SQL files; `(book_id, sku)` rows keep imports incremental exactly
  like `stock_items` rows.
- **Mapped import over per-vendor code:** 10-30 vendors of adapter code is a
  maintenance treadmill; a saved mapping is team-editable data. The exception
  path (a truly gnarly vendor gets an adapter) stays open.
- **Server-side search** because the first vendor book alone is ~10× the
  stock book; eager loading dies around book three.

## Consequences

- `Selection` gains `bookId`, `cost`, `markupPct`, `freightFlag`, `tierPrice`;
  `Project` gains `contractorPricing`; Settings gains `contractorPct`
  (default 8) — all with legacy-safe defaults in `normP`/`normC`/
  `mergeSettings` in the same commits that introduce them (architecture
  invariant 2). Changing `contractorPct` re-flows open contractor jobs — the
  same live-by-design behavior as the waste rates, accepted with eyes open.
- New pure module `src/orderbook.js` (markup resolution, sell calc, drift,
  collision, mapping application) + extensions to `src/pricebook.js`; all
  estimate-number logic stays in the tested pure trio.
- `supabase/pricebooks.sql` must be run once by the owner before Phase 1
  ships; until then the app hides every registry affordance (empty registry),
  mirroring how stock affordances hide today.
- `pricebook_versions` allows row UPDATE (unlike the immutable `versions`
  table) solely so the pin flag can toggle; the client never rewrites a
  snapshot.
- Implementation is phased (bridge already merged in PR #57; phases 1-5 in
  `docs/pricebook/design.md` §9); every UI slice still requires preview proof.
