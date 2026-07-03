---
issue_type: Task
summary: Integrate the shop's stock price book workbook — a shared stock_items table imported from the .xlsx with a diff preview, a SKU typeahead on product rows that snapshots item values onto the row, price-drift chips against the current book, and catalog price sync for grout/mortar/underlayment.
status: done
labels: [ready-for-human]
---

# Stock price book: SKU fills the row, re-imports never rewrite estimates

## Problem / Why

The shop maintains a stock price book as an Excel workbook (~700 SKUs across
nine hand-formatted sheets: hardwood, tile, vinyl, Mannington Aduramax + trim
SKUs, accessories, mortars/membranes, a grout color × product matrix, Schluter
trim matrices). Building a selection today means retyping description, size and
price from that workbook — and the workbook's prices/items change often, so
anything copied in goes stale invisibly.

Two requirements pull against each other:

1. **Entering a SKU should populate the rest of the product row.**
2. **The stock list changes often** — but a quoted estimate must not change
   because the book did.

## Decision (ADR 0003)

- **`stock_items` table** (one row per SKU, shared team-wide like
  shared_settings; `supabase/stock.sql`). Rows are only ever upserted; items
  that drop out of the book are marked `active = false`, never deleted.
- **Snapshot + drift, not live link.** Picking a SKU copies the item's values
  onto the product row; nothing reads the stock table at calculation time. The
  row keeps its `sku`, and a chip flags "price book now $X — this row has $Y"
  with a one-click apply. Same philosophy as jobs linking catalog products by
  name (ADR 0002): old estimates stay resolvable and unchanged.
- **Browser-side re-import with a mandatory diff preview.** The team keeps
  maintaining the exact workbook they already maintain; importing it in
  Settings parses per-sheet (`src/pricebook.js`, SheetJS lazy-loaded) and shows
  new / changed / missing counts plus price deltas before anything is written.
  A restructured sheet degrades to visible "missing" counts, not garbage rows.
- **Catalog price sync.** Grout/mortar/underlayment items in the book update
  the ADR-0002 catalog's prices, matched by name, only when all matches agree
  on one price (ambiguous names like "ProLite" are skipped).

## Slices

- 01 `src/pricebook.js` — workbook → flat stock items (+ unit tests; verified
  against the real workbook: 697 items, all sheets).
- 02 `src/stock.js` — search/fill/drift/diff/catalog-sync helpers (+ tests).
- 03 `supabase/stock.sql` — table + RLS (all signed-in read/write, no delete).
- 04 App: SKU typeahead on every product row (hidden until stock exists),
  snapshot fill, drift/retired chips, SKU on print + CSV.
- 05 Settings: import with diff preview → chunked upserts, missing → inactive,
  catalog price updates through `setSettings`.
