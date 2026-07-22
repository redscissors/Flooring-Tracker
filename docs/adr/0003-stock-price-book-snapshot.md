# ADR 0003 — Stock price book: shared `stock_items` table, SKU fills by snapshot, re-imports never rewrite estimates

- **Status:** Superseded by ADR 0027 (2026-07-22) — the hand-kept shop
  workbook was retired in favor of ERP "Vendor SKU Analysis" stock-kind
  registry books, and the workbook's code paths (parser, import, `useStock`
  cache, library panel) were removed. The `stock_items` table and its data are
  KEPT (nothing is ever deleted); no code reads or writes it anymore. The
  snapshot doctrine decided here lives on unchanged in the registry books.
- **Date:** 2026-07-03
- **Scope:** system-wide (new stock_items table + product row data model + import pipeline)
- **Related:** `.scratch/004_stock-price-book/ticket.md`, ADR 0002, ADR 0027

## Context

The shop's stock list is an Excel price book (~700 SKUs across nine
hand-formatted sheets), maintained by hand and re-issued whenever prices or
items change. The team wants a SKU typed on a product row to populate the rest
of the row. Estimates, however, are quotes: a saved selection must keep the
price it was quoted at even after the book moves on.

## Decision

1. **Stock items live in their own shared table** (`stock_items`: `sku` text
   PK, `active` boolean, `data` jsonb, `updated_at`), readable and writable by
   every signed-in user — the same trust model as `shared_settings` and Public
   customers. Not in the Settings blob (600+ rows, row-level updates), not a
   build-time JSON (a price change must not require a deploy).
2. **SKU fill is a SNAPSHOT, not a live link.** Picking a SKU copies the
   item's values (type, size, brand/description, price) onto the product row;
   the material math and totals never read the stock table. The row stores
   `sku` purely as a back-reference: the UI compares the row's price to the
   current book and offers a one-click "use new price" when they differ.
   Applying a new price is always a deliberate human act.
3. **Imports upsert; nothing is ever deleted.** Re-importing the workbook
   shows a diff preview (new / changed / no-longer-listed / unchanged) before
   writing. SKUs missing from the new book are marked `active = false` — they
   stop appearing in the typeahead but rows that hold them keep resolving,
   and a later book can re-activate them.
4. **The workbook stays the source document.** The importer
   (`src/pricebook.js`) parses the team's existing .xlsx in the browser with
   per-sheet adapters keyed on "a row counts only if its SKU cell looks like a
   SKU" — a restructured sheet degrades to visible missing-counts in the
   preview, never to garbage rows. No parallel CSV to maintain, no server.
5. **The book feeds the ADR-0002 catalog's prices, conservatively.** Catalog
   grout/mortar/underlayment products match stock items by name (the same
   name-link jobs use, space-insensitive); a price updates only when every
   matching item agrees on one price. Ambiguity ("ProLite" vs "ProLite Rapid
   Set") means no update.

## Why

- **Snapshot over live link:** a live link silently rewrites every old
  estimate when the book changes — precisely the failure the team asked to
  avoid. Snapshot + drift-chip gives freshness *visibility* without silent
  mutation, and matches ADR 0002's existing philosophy (jobs keep working when
  the catalog changes underneath them).
- **Own table over Settings blob:** the Settings store is saved whole with
  last-write-wins; 700 items would make every price tweak a full-blob write
  and a collision window. Per-SKU rows make imports incremental and cheap.
- **Mark-inactive over delete:** old estimates and versions hold SKUs forever;
  deleting a stock row would orphan them. `active = false` mirrors ADR 0002's
  "hide, never delete".
- **All-users write over admin-only:** consistent with the existing trust
  model (settings and Public customers are already team-writable); accounts
  are admin-created, so the team is the trust boundary.

## Consequences

- `Product` gains a `sku` field (normalized in `normP`; shown on print/CSV).
- New client modules: `src/pricebook.js` (workbook → items) and `src/stock.js`
  (search / fill / drift / diff / catalog sync); SheetJS is lazy-loaded only
  when an import runs.
- `supabase/stock.sql` must be run once per install; until then the app hides
  every stock affordance (empty stock list).
- The parser is coupled to the workbook's sheet names and header vocabulary.
  Adding columns or rows is safe; renaming sheets or removing the "SKU" header
  will surface as missing items in the preview and a sheet-level warning.
