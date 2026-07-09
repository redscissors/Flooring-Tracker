# Prototype outcome — PC-first Settings workspace + price-book-driven grout (2026-07-08)

**Question:** the Settings modal (max-w-xl, one scrolling column) is too small for
the catalog it now manages, and grout colors are a hand-kept code list
(`GROUT_COLORS` in App.jsx) with no SKUs — so grout/caulk lines print without
SKUs and there is no way for a user to manage colors. What should a larger,
PC-first Settings screen look like, and where should grout colors/SKUs come
from?

**Method:** three full-screen variants in a throwaway `src/SettingsPrototype.jsx`
(now deleted), mounted dev-only before the auth gate behind
`?proto=settings&variant=A|B|C` (no Supabase needed), with mock catalog + mock
price-book grout families shaped exactly like `parseGroutMatrix()` output.
Mobbin (Squarespace/Ghost settings, Shopify variant editor) used for layout
inspiration. Screenshotted at 1440×900; refined live with the owner over two
rounds.

- **A — Sections workspace (picked):** left nav rail (General · Price book ·
  Grout & colors · Mortar & underlayment · Backup), master→detail panes:
  product list by company → wide detail with spec fields, color/SKU grid,
  base part, install materials, and an order-summary preview.
- **B — Catalog ledger:** one flat spreadsheet-like table of every product,
  grout rows expanding inline into the color↔SKU matrix.
- **C — Price-book link desk:** book-first two-pane "Offer this →" flow with a
  live job preview.

**Answer (Variant A), including owner refinements:**

1. **Grout colors + SKUs come from the price book, not hand entry.** The
   import already yields one stock item per family × color with SKU and price
   (`parseGroutMatrix`). A catalog grout links to a book *family* (the stock
   `product` name); the job's color dropdown lists that family's colors; the
   pick snapshots the color's SKU onto the row (ADR 0003 doctrine — nothing
   reads stock at calc time). Coverage stays hand-kept ("trade knowledge").
   Unlinked grouts fall back to the standard color list and print without SKU.
2. **Two-part grouts get a base part**: one more book SKU linked on the grout
   (SpectraLOCK liquids, CEG-Lite A+B), ordered by a ratio (default 1 per
   color unit), printing as its own indented line.
3. **Everything SKU-bearing is book-search-first, manual fallback.** Install
   materials (screws, tape…) on an underlayment are added by searching the
   imported book (word-match like the SKU box); the dropdown's last row is
   always "Not in the book — add manually (no SKU prints)".
4. **Spec fields as one aligned row** — right-aligned coverage with the unit
   suffix inside the field, $-prefixed price locked + book icon when the price
   follows the book.
5. **Order summary carries SKUs, no color swatches** — the estimate prints
   black & white; color is text, the SKU column identifies the item.

**Rejected:** B (great density, poor room for the color grid + base + install
editors), C (strong for initial linking, weak as the everyday settings home).

**Scope / safety:** prototype was presentation-only, no data-model change, no
Supabase writes. The real build (started same day) touches: catalog fields
(`book`, `base`, `sku` on products/install items) + normalizers, grout-base
math in catalog.js, stock.js family helpers, selection `grout.sku`/`caulkSku`
snapshot, summary/print SKU rendering, and the Settings workspace UI — see
`.scratch/007_settings-pricebook-grout/` and the ADR recorded for it.
