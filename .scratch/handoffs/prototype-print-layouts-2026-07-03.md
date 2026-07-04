# Prototype outcome — print layout redesign (2026-07-03)

**Question:** the estimate print view had grown into dense run-on lines; what layout is easier to read at a glance?

**Method:** throwaway `src/PrintPrototype.jsx` (now deleted) rendered 5 variants + the old layout on the live app behind `?pv=`, previewed with real customer data (Marcus Mast, public row fetched anonymously — public customers are anon-readable under the `customer select` RLS policy).

**Answer (user-picked blend, built into App.jsx the same day):**
- Two print buttons replace the single Print: **Print** (estimate) and **Order sheet**. `printMode` state + effect trigger `window.print()`; browser-menu printing gets the estimate.
- **Estimate layout:** header with eyebrow + customer + address left, big estimated total right with "X sq ft measured · Y sq ft ordered"; one black-bar bordered box per area (area subtotal in the bar) containing a spec table (Selection / Size / SKU / Order / Price / Total) with grout/mortar/backer/install as indented sub-rows; totals box is three lines only — "Tile & flooring" (flooring + misc), "Grout, mortar & underlayment", estimated material total.
- **Order sheet layout:** one checkbox pick-list table (Item / SKU / Area / Order) of every product **including misc items (qty 1)** plus the combined grout/mortar/underlayment lines.
- Carton rows show ordered coverage everywhere: `15 ct = 121.1 sf (14.99)` — order × snapshotted `cartonSf`.

**Rejected:** flat spec tables without boxes (A), customer-summary page without per-product math (B), label-over-value cards (C) — pieces of each survived in the blend.
