# ADR 0018 — Price tiers are a display lens; retail stays the stored price

- **Status:** Accepted
- **Date:** 2026-07-16
- **Scope:** project pricing (App.jsx totals/print/order entry), `src/pricing.js`,
  settings (`pricing` key), project jsonb (`priceTier` / `customPct` /
  `printPricing`)
- **Related:** builds on [ADR 0003](0003-stock-price-book-snapshot.md)'s
  snapshot rule and [ADR 0011](0011-margin-visibility-ephemeral.md)'s honest
  per-row cost (`costSqft`); spec at
  `docs/superpowers/specs/2026-07-16-pricing-tiers-print-options-design.md`.

## Context

The team quotes the same selections at different price points: retail
customers, builders (a standing discount), employees (cost-plus), promotional
sales, and one-off negotiated discounts. Separately, some printed estimates
should not show money at all (scope documents), or should show unit prices but
no totals. Both needs are per project, and a reopened job must print the way it
was quoted.

The obvious implementation — rewriting each row's `priceSqft` when a tier is
chosen — would break the system's core invariant: the row's snapshotted retail
price is what drift chips compare against, what versions capture, and what
hand-edits target. Repricing rows also can't express Employee (cost + 6%),
which needs the row's cost, not a percentage.

## Decision

1. **Retail stays the stored truth; a tier is a render-time lens.**
   `tierView(project, settings)` (src/pricing.js) maps the raw pair to a
   tier-priced pair; the existing math (totals loop, `printProduct`,
   `printMatList`, `attachedList`) consumes the lens output unchanged. Nothing
   writes tier prices back to saved rows; the lens is identity for Retail (and
   for a 0% custom discount).
2. **Tiers:** Retail · Builder (default 8% off) · Sale (default 10% off) ·
   Custom (per-project typed %) · Employee (cost × 1.06). Builder/Sale
   percentages are team-wide settings (`settings.pricing`, edited in
   Settings → Price book); the custom percent lives on the project.
3. **Discount tiers scale every priced line** — flooring, misc, and the
   material maps (grout + base units, caulk snapshot, mortar, underlayment +
   install, add-ons) — `round2` on the unit price first, then extended, so a
   printed unit price × qty reproduces its line total.
4. **Employee reprices only rows that snapshot a vendor cost** (ADR 0011's
   `costSqft`, i.e. special-order picks). Everything else — stock-book lines,
   catalog materials, hand-typed rows — stays retail and is flagged
   "no cost — retail" on screen. No pseudo-costs are invented.
5. **Order entry shows retail on every tier except Employee**, which carries
   through; builder/sale/custom discounts are keyed into the vendor order by
   hand. The internal order sheet (quantities/SKUs, no prices) is unaffected
   by tiers entirely — quantities are price-independent.
6. **The printed estimate self-identifies**: a tier tag ("Builder pricing —
   8% off retail", "Employee pricing") prints under the date whenever any
   price prints at a non-retail tier. Cost never prints.
7. **Print pricing is an independent per-project switch**: `full` (everything),
   `unit` (unit prices, no line/job totals), `none` (no money; quantities,
   SKUs and coverage keep the sheet a selection document). The tag is
   suppressed on `none`.
8. **Persistence:** `priceTier`/`customPct`/`printPricing` normalize through
   `normC` with retail/full defaults, so all pre-existing projects are
   unaffected; `settings.pricing` normalizes through `normPricing`
   (catalog.js). No schema change — both ride existing jsonb.

## Consequences

- Two prints of one job can differ; the tier tag is the reconciliation.
  Restoring a version never flips the tier (snapshots hold `categories` only).
- The edit grid's price input keeps showing retail; the tier's unit price
  appears as a per-line chip and in the line/area/grand totals, with a tier
  badge beside the grand total.
- Employee pricing excludes freight (cost snapshots don't carry it) and only
  covers costed lines — adding a cost column to the shop stock book would
  widen its coverage (future work, as is a per-builder discount override and
  preferring a vendor's published contractor `tierPrice`).

## Amendment (2026-09-10): Employee reprices costed extras

Decision item 4 left the extras — grout, base unit, caulk, mortar,
underlayment, install materials, add-ons — at retail under Employee because
the catalog's material maps carried a `price` and nothing else. Every linked
material now points at an ERP stock-book row that carries "Base Price (Cost)",
so the cost exists; it was simply never stored beside the price. Owner
request 2026-09-10: "add a cost field to the extras so employee pricing works".

- **Every extra carries a `cost`** beside its `price`: grout, mortar,
  underlayment, custom install item, add-on, and the grout base companion
  (`catalog.js` field sets, default 0 — no migration, old records stay valid).
  A job row's caulk snapshot gains `grout.caulkCost` beside `caulkPrice`
  (`normP`, blank when absent).
- **The book fills it.** Every Settings pick that writes `price` from a book
  row writes `cost` from the same row; the re-import sync
  (`booklink.js` `syncLinkedCatalog`) refreshes cost with price on linked
  products and base companions — silently, never a `changes` entry, since cost
  is the lens's input and not a number the team quotes. A book row without a
  cost leaves the catalog's own cost standing. A **Cost** box beside each
  $/unit box takes a hand-typed value for anything unlinked. The color-pick
  snapshot (`groutSnapshotPatch`) stamps `caulkCost` from the family's caulk
  row.
- **The Employee lens reprices them** (`pricing.js` `tierView`): a priced entry
  with a cost becomes `round2(cost × 1.06)` — the same rule as a costed
  flooring row — across the material maps and the row caulk snapshot. An
  uncosted entry stays retail, and the extras strip marks it **Retail** the
  way the price cell marks an uncosted line. When no extra carries a cost the
  settings object passes through by identity, so a pre-amendment catalog reads
  exactly as before.
- Item 3 is unchanged: Builder/Sale/Custom scale the retail price and ignore
  cost. Item 5 (order entry), item 6 (the tag) and freight are unchanged.
