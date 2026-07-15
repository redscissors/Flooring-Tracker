# Price book importer upgrades — design

**Date:** 2026-07-14 · **Status:** approved by owner (this conversation)

Three features, shipped as three PRs, foundation first:

- **PR A** — a user-controlled per-item **enable/disable switch** that persists
  across reimports, with per-book browsing/bulk tools.
- **PR B** — an **import review** step: every problematic row visible with
  Include/Ignore, plus **N-suffix supersede detection** (old SKU auto-unchecked).
- **PR C** — a **single drop area** on the Price book library that accepts one
  or many files and routes each to the right book (stock workbook included).

They ship in this order because "ignore a problem SKU", "uncheck a collection",
and "retire a superseded SKU" are all the same switch underneath — PR A builds
it, PRs B and C flip it.

## Problem

- Import problems ("orange" rows) are only partly visible: warnings are
  aggregate strings truncated to 4 lines with ≤3 sample SKUs each
  (`parseMapped` → `unitComboWarnings`, src/orderbook.js ~295), and untyped
  rows show an amber "Misc" type cell in the preview (App.jsx ~4104). There is
  no full list, and every problematic row imports anyway.
- There is no user-controlled visibility. Items carry `active`
  (import-controlled: false when a SKU vanishes from a reimport) and
  `discontinued` (vendor status, inside the jsonb), but nothing lets the team
  say "don't offer this SKU/collection" — and reimports overwrite each item's
  whole `data` jsonb (`applyBookImport` → `bookItemData`), so any preference
  stored there would be wiped.
- Vendor lists (VTC convention) supersede a SKU by reissuing it with a trailing
  `N` (e.g. `123456` → `123456N`). Today the two are unrelated items; both show
  in search.
- Importing means opening each book and using its own wizard; multiple updated
  vendor files means multiple round-trips.

## Decisions (owner)

- **Disabled = hidden from search.** Disabled items never appear in
  add-a-product search surfaces. They stay listed (greyed, re-enable checkbox)
  in the book's item table in Settings. Saved estimates that snapshot a
  disabled SKU still resolve — resolve paths never filter on it.
- **Ignore at import = import as disabled.** Ignored rows land in the book
  unchecked, so the next reimport already knows them and never re-asks.
  Default for problem rows is **Include** (today's behavior; nothing changes
  silently).
- **Supersede pairs are shown, not silent.** The preview gets a "Superseded
  SKUs" group, each old→new pair pre-checked to disable the old SKU; unticking
  a pair opts out. Matching runs against **both the imported file and the whole
  existing book** (only currently-enabled old SKUs are flagged).
- **Unmatched dropped files ask.** The routing screen lists each file with its
  detected book; unmatched/ambiguous files get a dropdown to pick a book or
  skip. No "create new book from file" for now.
- **The drop area also accepts the shop stock workbook**, auto-detected by its
  sheet-name signature, routed into the existing stock import flow.
- **Browsing disabled items is a visible filter, not a search keyword**:
  All · Enabled · Disabled status filter next to the book table's search box;
  search composes with it. (A "disc"/"unchecked" keyword was considered and
  rejected — undiscoverable, collides with real description text.)

## PR A — the enable/disable switch

### Data

New **column** `disabled boolean not null default false` on `price_book_items`
**and** `stock_items` (a column, not a jsonb field, because import upserts
rewrite the whole `data` jsonb; upserts that don't mention the column leave it
untouched, which is exactly the persistence wanted). Three flags then coexist:

| flag | meaning | controlled by |
|---|---|---|
| `active` | was in the last import file | import diff |
| `discontinued` | vendor says it's dead | vendor file / hand-edit |
| `disabled` | we don't want to see it | **the team** |

One SQL file `supabase/pricebook-disabled.sql` (owner runs by hand in the
dashboard, per house rule #1): the two `alter table … add column`s plus the
updated `search_price_book_items` function (adds `and not i.disabled`).
Additive and harmless to run before the code deploys — everything defaults to
enabled. **Run order: SQL first, then merge the PR** (the code selects the new
column, so it must exist by deploy time).

### Search surfaces — filter `disabled` (new-pick paths only)

- `searchStock` (src/stock.js ~64) — add `!it.disabled` beside the existing
  `active`/`discontinued` skip.
- `search_price_book_items` RPC (supabase/pricebook-fuzzy.sql ~38).
- ILIKE fallback `base()` (App.jsx ~1607) — `.eq("disabled", false)`.
- Grout family/color/caulk helpers (src/stock.js ~305/320/331).
- `syncCatalogPrices` (src/stock.js ~381) — skip disabled.

**Leave untouched** (snapshot-resolve paths must keep resolving disabled SKUs):
drift-resolve fetch (App.jsx ~1665), `findStock`, `loadBookItems`.

### Normalization & write path

- `normBookItem` / `normStock` map the column with a legacy-safe
  `disabled: false` default (extend norms per CLAUDE.md convention).
- New sanctioned write path `setItemsDisabled(bookId, skus, disabled)` —
  chunked `update` of only the `disabled` column, keyed `(book_id, sku)`
  (stock book: `stock_items` by `sku`). Optimistic local state update. No
  other field touched. Document beside the other write paths in CLAUDE.md.

### UI (BookDetail item table, Settings workspace)

- Checkbox per row (checked = enabled). Disabled rows grey like inactive rows.
- Status filter beside the existing search box: **All · Enabled · Disabled**
  (default All). Search composes with the filter, so "review what's off in
  Cyrus 2.0" = click Disabled, type `cyrus`.
- Bulk: **Disable all shown / Enable all shown** buttons acting on the current
  filtered row set (the existing client-side `q` filter is the collection
  selector) in one chunked write, with a count confirm ("Disable 214 items?").

## PR B — import review: problems + supersede

**Scope (owner decision 2026-07-15):** PR B covers the **registry book import
wizard** only (`BookImportWizard`), where all the real vendor-import pain lives.
The shop stock workbook import (`importPriceBook` modal) is deferred to a later
PR bundled with a stock item table — PR A left the stock workbook with no
browse/re-enable UI, so disabling a stock SKU there would strand it.

### Per-row problems (a derived classifier, not a stored field)

A pure helper **`itemProblems(item)`** in `src/orderbook.js` returns the problem
codes for one item; the wizard maps it over the parsed items to build the
review list. Nothing is stored on the item (avoids any risk of leaking into the
`data` jsonb) and `unitComboWarnings` is refactored to build on the same helper
(one source of truth). Problem kinds are exactly the **pricing/unit hazards**
that misprice a line — the checks that caught the VTC bullnose bug:

- `no-price` — no cost/price on the sheet (lands unpriced)
- `zero-price` — $0 cost/price (lands as a $0 line)
- `no-pc-carton` — per-piece price, sold by the carton, no PC/CT (carton price
  can't be built)
- `pc-sf-mismatch` — per-piece price with SF/CT but no PC/CT (derived $/sqft may
  be off by the carton's piece count)
- `unfamiliar-unit` — sold by a unit the pricing code doesn't handle

**Untyped ("Misc") rows are NOT problems** (owner decision 2026-07-15): being a
Misc count line is legitimate by design (ADR 0013 — hundreds of trims are
correctly Misc). The preview keeps its existing amber "Misc" type cell as the
informational marker; it does not enter the Problems list. Aggregate `warnings`
remain for file-level issues (no SKU column, no rows matched).

### Preview UI (BookImportWizard)

- A **Problems (N)** section: full list (scrollable, not truncated), grouped by
  kind, each row showing SKU · description · what's wrong.
- Per-row **Include / Ignore** toggle; per-group "Ignore all". Default
  Include.
- Apply: **ignored SKUs are disabled** — uniformly, whether the row is new,
  changed, or unchanged. New/changed/missing rows carry an explicit `disabled`
  column in the upsert (added → the ignore toggle; changed/missing → preserve
  the prior value unless newly ignored, keeping every upsert row's column set
  identical for PostgREST batch consistency). Ignored SKUs that fall in no
  upsert bucket (unchanged rows) are disabled via the PR A `setBookItemsDisabled`
  path. Included rows import exactly as today.

### N-suffix supersede detection

- Pure helper **`supersedePairs(existing, parsed)`** in `src/orderbook.js`: for
  each incoming SKU ending in `n`/`N`, if the SKU minus that trailing letter
  exactly equals another SKU present in the incoming file **or** the book's
  existing items, and that base item is currently enabled (`!disabled`), emit a
  pair `{ oldSku, newSku, oldDesc, newDesc }`. One level, exact base match.
- Preview shows a **Superseded SKUs** group: old and new side by side with both
  descriptions for a sanity check, each pair pre-checked "disable old".
- Apply: checked pairs add their `oldSku` to the same ignore/disable set — the
  old SKU is disabled through the identical path (upsert column when it's in the
  `missing` bucket, which superseded SKUs usually are; else `setBookItemsDisabled`).
  The applied pair list + ignored count are recorded in the book's `lastImport`
  note.
- Rollback safety: replaying a version snapshot through `applyBookImport` passes
  no ignore set and preserves each row's live `disabled` from its `prev`, so a
  rollback never wipes the team's disable choices.

## PR C — single drop area

### Placement & input

Drop zone (plus click-to-browse) at the top of the Price book library
(`PriceBookLibrary`), accepting any mix of `.xlsx`/`.xls`/`.pdf`, one or many.

### Routing (per file)

Detection, in confidence order:

1. **Stock workbook** — sheet-name signature of the hand-built adapter.
2. **VTC EFT template** — existing `detectVtcEft` (src/pricebook.js ~871) → the
   registry book whose fingerprint/mapping matches.
3. **Mannington Cartons PDF** — existing `isManningtonCartons` → the book that
   last imported that format.
4. **Saved mapping match** — try each book's saved `data.mapping` against the
   file's headers; a book whose mapped columns all resolve is a candidate.

Every successful import stamps a small **fingerprint** on its book
(`data.importFingerprint`: format tag + header signature), so matching gets
more reliable with use. Exactly one candidate = confident match; zero or
several = the file's row gets a book dropdown (or "skip this file").

### Flow

Routing list → confirm → step through each file's normal preview one at a time
("Reviewing 2 of 3"), each with the PR B problems/supersede review, apply per
book (each apply is the existing per-book write + version snapshot — no new
write semantics). The stock workbook file routes into the existing stock
import preview. Single-file drop behaves exactly like a one-item queue; the
per-book "Import" button inside `BookDetail` stays as-is.

## Error handling

- Unreadable/unparseable file in a multi-drop: that file's row shows the error
  and is skipped; the rest of the queue proceeds.
- Fuzzy RPC absent (SQL not yet run): existing fallback chain already handles
  it; the ILIKE fallback carries the `disabled` filter.
- Bulk disable partial failure (chunked writes): report which chunk failed;
  re-running is idempotent.

## Testing / proof (house rule #3)

Each PR merges with preview proof: PR A — book table showing filter +
checkboxes + a bulk disable, and a search proving the disabled SKU is gone
while an existing estimate line still resolves it. PR B — a real VTC file
preview showing the Problems list and a superseded pair. PR C — a multi-file
drop routing screenshot (VTC xlsx + Mannington PDF + stock workbook in one
drop).

## Out of scope

Scheduled/automatic imports; snapshot/estimate behavior changes; suffix
conventions beyond trailing-N; "create new book" from a dropped file; a
search-keyword shortcut for disabled items.
