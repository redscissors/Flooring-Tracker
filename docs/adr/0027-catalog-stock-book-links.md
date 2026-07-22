# ADR 0027 — Catalog products link to ERP stock-book rows; grout families are rule-projected book slices

- **Status:** Accepted
- **Date:** 2026-07-21
- **Scope:** system-wide (catalog data model + import sync + grout family resolution)
- **Related:** supersedes the data source of ADR 0006 (grout base companion) and
  ADR 0007 (grout colors from book family) — their mechanics are reused
  verbatim; extends ADR 0009/0025's stock-kind registry books (PR #219);
  design doc `docs/superpowers/specs/2026-07-21-catalog-erp-book-links-design.md`.

## Context

The hand-maintained "NEW Stock Flooring Price Book.xlsx" is being retired in
favor of per-supplier ERP "Vendor SKU Analysis" exports (DOIT, GLATI, GUNDL,
MANMI, OHIVA, SHEOG, Sheet1) dropped into OneDrive as their own stock-kind
registry books (whole-book diff on re-drop, retired SKUs go inactive, explicit
retail persisted). Four things still depended on the old workbook: catalog
price refresh (`syncCatalogPrices`, name/SKU text match), grout color families
(`parseGroutMatrix` on the Grout & Caulk sheet), color-matched caulk snapshot,
and the Laticrete pigment→base auto-add — all ADR 0006/0007 mechanics reading
one hand-kept sheet that is going away.

## Decision

1. **`link: { bookId, sku }` replaces text-matched refresh for a catalog
   product** (grout/mortar/underlayment/attached). Links are IDs, never text
   matches, and live only in the catalog — an import rewrites book contents
   but never catalog structure. Name, unit, cost, and retail fill from the row
   at pick time; sync runs only immediately after `applyBookImport` upserts
   that book's items, and only refreshes price/unit/SKU. The product's **name
   is never auto-renamed** — jobs resolve materials by name at calc time (ADR
   0002/0016), so a rename from an import would silently stop saved jobs
   calculating. A linked SKU dropped from the file is **keep-and-warn**: the
   product stays selectable at its last known price with a warning chip
   (relink / keep / disable), never silently removed.

2. **`catalog.bookFamilies` stores a grout family as a matching rule**, not a
   row list: `{ bookId, rule, baseSkus, caulk: { bookId, rule }, cache }`.
   Colors are rule-based (prefix/suffix over the book's descriptions) so a new
   color in a re-drop joins the dropdown automatically; bases are two explicit
   SKU picks (ADR 0006 pairing) with keep-and-warn on loss; caulk matches by
   parsed color number with a name fallback, no match → no snapshot, same as
   an empty matrix cell in the old workbook. A family's members are **projected
   into stock-shaped items** (`projectFamilies`) so the ADR 0006/0007 resolver
   mechanics (`groutFamilies`/`groutColorItem`/`groutCaulkItem`, the color
   dropdown, the base auto-add, the caulk snapshot) run unchanged against
   `[...stock, ...projected]`. If a re-drop rewrites every description and the
   rule matches nothing, the family serves its last-resolved `cache`, flagged,
   until the rule is re-confirmed — no color dropdown ever goes blank from a
   bad re-drop.

3. **Legacy workbook paths stay dormant, not deleted.** `parseGroutMatrix`,
   `syncCatalogPrices`, and `detectStockWorkbook` keep working for any
   still-unlinked product or family; removal is a later cleanup once every
   grout family is set up and every SKU-bearing product is linked or
   consciously left unlinked.

   *Amendment 2026-07-22 — the cleanup happened.* With every stock item in the
   ERP books and the migration done, the shop workbook was removed end to end:
   the hand-built parsers and `detectStockWorkbook` (pricebook.js), the drop
   router's "stock" target, `useStock`/`loadStock` and the `stock_items`
   read/write paths, `syncCatalogPrices`, and the library's Shop workbook
   panel. The row search's instant "stock" tier is now the flattened
   stock-kind book cache (`useBookStock`), whose hits badge as stock and pick
   through `orderPatch` (bookId provenance, on-demand drift). A catalog grout
   whose `book` still names a workbook family resolves like an unlinked grout
   until a `bookFamilies` rule is set up. `stock_items` data is retained,
   unread (hide-never-delete); old workbook-sourced rows keep their snapshots
   but no longer show drift/retired chips.

## Why

- **IDs over text match:** `syncCatalogPrices`'s name/SKU text match is
  fragile against supplier description drift and can't target a single
  family's ~40 color rows at once. A stored link/rule is exact and survives
  wording churn.
- **Rule over row list for families:** hand-listing SKUs would need editing on
  every re-drop as new colors appear; a rule re-runs and picks them up on its
  own, which is the whole point of the ERP export replacing a hand-kept sheet.
- **Reuse ADR 0006/0007 mechanics via projection, not a rewrite:** the family
  UX (chip → pick family → color dropdown → snapshot SKU/base/caulk) already
  works and is well understood; projecting book rows into the same shape the
  old workbook parser produced means every downstream resolver, the job grid,
  and print keep working unmodified.
- **Cache fallback over a blank dropdown:** a supplier rewriting every
  description in one export must not break a job mid-estimate; serving the
  last-known colors with a warning is the same keep-and-warn posture as a
  single dropped SKU, just at family scale.
- **Dormant over deleted for the legacy paths:** migration is a one-time
  assisted pass (proposed links for unique-SKU matches, families set up by
  hand once each); products not yet migrated must keep working exactly as
  today until someone chooses to remove the old code.

## Consequences

- The old workbook's Grout & Caulk sheet is no longer required once every
  grout line's family is set up via the picker — the last dependency on that
  one hand-maintained sheet.
- `syncCatalogPrices`'s name-matching is superseded for any product carrying
  a `link`; it remains the path for unlinked products until they're migrated
  or the legacy code is removed.
- `src/booklink.js` carries the rule/token/family/projection/sync/proposal
  logic, pure and React-free like `catalog.js`/`stock.js`, fully covered by
  `node --test`. `src/usebookstock.js` caches stock-kind book items the same
  way the ADR 0003 stock cache works (bounded, background-loaded per ADR
  0026), feeding the family projection and the Settings picker.
- Catalog normalization carries `product.link` and `catalog.bookFamilies`
  forward so old records without either field load and behave exactly as
  before (no link = today's name-resolved behavior; no families = the
  code-list/legacy-workbook grout colors).
- Rollout order matters: a still-deployed `main` client's `normalizeCatalog`
  rebuilds a product from its own fixed field list, dropping any `link` or
  `bookFamilies` it doesn't know about, and settings saves are last-write-wins
  — so this PR must merge and deploy, and every open tab must reload, before
  the migration pass is run or any family is created; until then a settings
  edit from a stale tab silently strips links and families.
