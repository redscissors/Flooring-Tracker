# ADR 0016 — Custom material categories: present-only unification over three locked built-ins

- **Status:** Accepted
- **Date:** 2026-07-15
- **Scope:** system-wide (Settings catalog, price-book import sync; job wiring lands in PR 3)
- **Related:** builds on the [ADR 0002](0002-shared-grout-mortar-catalog.md) catalog and the
  [ADR 0006](0006-catalog-sku-link-and-grout-base-companion.md) SKU link; spec at
  `docs/superpowers/specs/2026-07-15-materials-add-ons-design.md`.

## Context

The catalog knew exactly three material kinds — grout, mortar, underlayment —
each hard-coded through Settings, the product-row chips, the math, and the
print. The team wants to attach other materials to a job's flooring lines
(trim, transitions, sealer, thresholds, …) without a code change per category.
The three built-ins carry proven, materially different math (volumetric /
tiered / flat coverage + install kits) that real quotes depend on.

## Decision

1. **The catalog holds a list of material categories, but only custom ones are
   data.** `catalog.categories` stores the team's add-on categories
   (`{ id, name, floorTypes, math: "coverage"|"manual", default, enabled }`).
   Grout, Mortar, and Underlayment are *presented* as the first three
   categories in the same Settings library UI, but stay first-class code:
   their math, shapes, and job resolution are untouched, and they cannot be
   deleted, renamed as categories, re-scoped, or have their math changed —
   **present-only unification**. Only their per-product content and chip
   default are editable, as before.
2. **Custom-category products live per company in one flat `attached` array**
   (`{ id, categoryId, name, enabled, sku, unit, price, coverage }`),
   `categoryId` tying each to its category — not one array per category, so
   companies don't grow a dynamic set of keys. They get full price-book
   parity: search-first entry, optional SKU, and exact-SKU price refresh on
   import (`syncCatalogPrices`).
3. **Two quantity models only.** `"coverage"` (flat sq ft per unit, scaled off
   the row's area × waste, manual override — underlayment's model) or
   `"manual"` (typed per-row quantity). No custom category gets volumetric or
   tiered math; anything needing that belongs in a built-in.
4. **Everything is jsonb inside the shared settings record** — no SQL, no
   schema change, written only through `setSettings({ catalog })`.
5. **Jobs will resolve add-on products by name at calc time** (the
   mortar/underlayment convention, no snapshot), so renames/deletes have the
   same saved-job consequence as today, covered by the materialWarnings chip.
   Deleting a category prunes its products from every company; names are
   unique per category; category names may not shadow a built-in's.

## Consequences

- New material kinds are a Settings action, not a deploy.
- Old records normalize with `categories: []` / `attached: []` — nothing
  re-shapes existing data, and pre-0016 clients simply ignore the new keys.
- PR 2 ships this Settings-only (inert on jobs); PR 3 wires `Product.attached`
  chips, `getAttached` math, totals, print, and warnings per the spec.
- The category `default` lives on the category row itself, not in
  `catalog.defaults` (that map stays exactly `{ grout, mortar, underlay }`).

## Alternatives considered

- **Fully generic categories (built-ins become data):** rejected — zero
  appetite for re-expressing proven volumetric/tiered math as config, and the
  migration risk lands on live quotes.
- **Per-category product arrays keyed on the company** (`co[categoryId]`):
  rejected — dynamic keys complicate normalization and the generic
  add/rename/remove helpers; one flat `attached` array keeps kind `"attached"`
  a fourth ordinary kind.
