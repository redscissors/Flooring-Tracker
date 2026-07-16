# Materials & add-ons — extensible material categories — design

**Date:** 2026-07-15 · **Status:** approved by owner (this conversation)

## Problem

The catalog knows exactly three material kinds — grout, mortar, underlayment —
each hard-coded through Settings, the product-row material chips, the math,
and the print. The team wants to attach other materials to a job's flooring
lines (trim, transitions, sealer, thresholds, …) without a code change per
category, and wants the Settings catalog reorganized around that idea.

## Decisions (owner)

- **Category model.** The catalog moves from three hard-coded kinds to a list
  of *material categories*. Grout, Mortar, and Underlayment become the first
  three categories (built-in); the team can add unlimited custom "add-on"
  categories.
- **Present-only unification for built-ins.** Built-ins appear as categories
  and share the category editor UI, but keep their exact current math
  (volumetric / tiered / flat-coverage + install kits) and **cannot be
  deleted, renamed as categories, re-scoped, or have their math changed**.
  Only their per-product content and their chip default are editable, as
  today. Zero change to the proven math or to how saved jobs resolve.
- **Custom categories** carry:
  - `name` — e.g. "Trim", "Sealer" (renameable; deletable with a warning).
  - `floorTypes` — which product-row types offer the chip (`[]` = all;
    same convention as underlayment's `types`).
  - `math` — `"coverage"` (flat sq ft per unit, scaled off the row's area ×
    waste, manual override — identical to underlayment) or `"manual"`
    (typed per-row quantity, defaulting to 1 when toggled on; no area calc).
  - `default` — the product pre-selected when the chip is toggled on a job
    (same semantics as the grout/mortar chip defaults,
    `resolveMaterialDefault`).
- **Underlayment gains a chip default** too (it never had one); the
  `catalog.defaults` map grows an `underlay` key resolved the same way.
- **Products in a custom category** are **company-grouped with full
  price-book parity**: price-book-search-first entry, optional SKU, unit,
  price, coverage (when the category's math is coverage), enable/disable,
  rename/delete — the same machinery as grout/mortar/underlayment products,
  including exact-SKU price refresh on import.
- **Settings layout: the Price-book library pattern.** One fixed left-nav
  entry, **"Materials & add-ons"**, replaces the current "Grout & colors" and
  "Mortar & underlayment" sections. Opening it shows an inner list column
  (like the Price book tab's book list): a **Materials** group (the three
  locked built-ins) and an **Add-ons** group (custom categories), with a
  **New category** button at the bottom. Selecting a category opens its
  editor in the detail pane: a category-settings header (applies-to, quantity
  model, default — locked fields shown disabled for built-ins) above the
  company-grouped product list. "New category" opens a modal
  (name · applies-to · quantity model), mirroring "New book"; the created
  category lands in Add-ons and opens. The outer nav never grows.
  *(A sliding drill-down/hover-peek nav was prototyped and parked as a
  possible later refinement — not in scope here.)*
- **Job behavior.** On a product row, each enabled category whose
  `floorTypes` include the row's type shows an add chip beside
  Grout/Mortar/Underlayment. Toggling it on pre-fills the category default;
  the material line joins the materials box, the order summary, the estimate
  breakdown and totals, the printed estimate, and the order sheet like any
  other material. Jobs resolve add-on products **by name at calc time**
  (mortar/underlayment convention — no snapshot; renames/deletes have the
  same saved-job consequence, and the materialWarnings chip covers the
  no-longer-resolves case).

## Data model (all jsonb — no SQL, no schema change)

```
catalog.categories: [{ id, name, floorTypes: [], math: "coverage"|"manual",
                       default: "<product name>", enabled }]
                    // custom categories only; built-ins stay first-class

catalog.defaults  : { grout, mortar, underlay }        // + underlay

company.attached  : [{ id, categoryId, name, enabled,
                       sku, unit, price, coverage }]   // one flat array per
                                                       // company, categoryId
                                                       // ties to its category

Product.attached  : { [categoryId]: { checked, product, manual } }  // job side
```

`normalizeCatalog` / `resolveCatalog` / `normP` / `mergeSettings` /
`materialWarnings` and the print builder extend to the new fields so old
records stay valid (CLAUDE.md convention). New pure math in catalog.js:
`getAttached(p, s, category)` returning the same `{ exact, order, unit,
price, product }` shape as `getUnderlay`, plus an aggregate the summary/print
share so they can never disagree (the `groutBaseList` precedent).

## Delivery — three PRs, each independently deployable

1. **Settings reorg (UI only).** Merge the two catalog sections into the
   "Materials & add-ons" library layout with the three built-ins as locked
   categories; add the underlayment chip default. No new data shapes beyond
   `defaults.underlay`; no job-side change. Preview screenshots (light +
   dark) before merge.
2. **Custom-category catalog.** `catalog.categories` + `company.attached` +
   New-category modal + the custom-category editor with price-book search and
   SKU import refresh. Settings-only — shippable but inert on jobs.
3. **Job wiring.** `Product.attached`, the per-category chips (floor-scoped),
   `getAttached` math, materials box / order summary / estimate totals /
   print / order-sheet integration, materialWarnings coverage. Preview
   screenshots incl. print before merge.

An ADR recording the category model (and the present-only-unification
boundary) accompanies PR 2 per docs/skills-reference/decide.

## Verification

- `node --test` units in src/catalog.test.js: category normalization
  round-trips (old records unchanged), `getAttached` coverage + manual paths,
  waste handling, default resolution, name-resolution failure → warning.
- Non-negotiables hold: no Supabase writes outside the sanctioned paths (all
  new state rides `setSettings` / `updateCust`), every PR lands via branch +
  preview proof, nothing touches supabase/*.sql.

## Out of scope

- Changing built-in math or making built-ins fully generic categories.
- The sliding drill-down / hover-peek nav prototype (future refinement).
- Caulk, grout bases, install kits — unchanged special cases.
- Order-sheet grouping changes beyond adding the new lines.
