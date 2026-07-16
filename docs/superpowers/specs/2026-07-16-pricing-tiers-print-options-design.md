# Pricing tiers & print pricing options — design

Date: 2026-07-16
Status: awaiting owner review
Branch: `claude/pricing-tiers-print-options-1p8b0d`

## Summary

Two per-project controls, both saved on the project so a reopened job prints the
way it was quoted:

1. **Price tier** — how every price in the project is presented:
   `Retail · Builder · Employee · Sale · Custom %`.
2. **Print pricing** — how much pricing the printed estimate shows:
   `All prices · Unit prices only · No prices`.

Retail stays the stored truth: product rows keep their snapshotted retail
`priceSqft` untouched. Tiers are a **display lens** applied at render time
(on-screen totals, per-line chips, printed estimate, order entry panel).
Nothing reprices saved rows, so price-drift chips, versions, and hand-edited
prices keep working exactly as today.

## Decisions (owner Q&A, 2026-07-16)

- Employee lines without a snapshotted cost **stay at retail with a visible
  "no cost — retail" flag** — no pseudo-costs. (Stock book may gain a cost
  column later; out of scope here.)
- Order entry always shows **retail** cost/sell, **except** on the Employee
  tier, which carries into order entry. Builder/Sale/Custom never do — the
  salesperson keys those discounts into the vendor order by hand.
- Builder % is a **global setting** in Settings → Price book (default 8%).
  No per-builder override for now (recorded as a future idea).
- Sale % sits beside it (default 10%), also editable.
- Custom tier: a blank % field on the tier bar itself, typed per project.
- Freight nuance on Employee cost is accepted for now (tackle later).
- Files box collapses to a **paperclip button to the right of the builder
  field** (top of column 1); the builder label stays where it is; the two
  slide-button bars sit below.

## Tier math

Let `retail` = the row's snapshotted `priceSqft` (per-SF for flooring lines,
per-piece for misc/count lines).

| Tier | Unit price | Notes |
|---|---|---|
| Retail | `retail` | today's behavior, default |
| Builder | `round2(retail × (1 − builderPct/100))` | `builderPct` default 8, Settings → Price book |
| Sale | `round2(retail × (1 − salePct/100))` | `salePct` default 10, Settings → Price book |
| Custom | `round2(retail × (1 − customPct/100))` | `customPct` typed on the tier bar, saved on the project |
| Employee | `round2(costSqft × 1.06)` where the row snapshotted a cost (special-order picks, ADR 0011); otherwise `retail` + a "no cost — retail" flag | 6% above cost |

- Discount tiers (Builder/Sale/Custom) apply to **every priced line**:
  flooring, misc, and the estimated materials (grout, base units, caulk,
  mortar, underlayment, add-ons) — the whole estimate moves together.
- Employee applies only where a cost exists; materials and catalog items have
  no cost, so they stay retail and are flagged.
- Rounding: `round2` on the unit price first, then extend (order qty × unit)
  exactly as today, so a printed unit price × qty always reproduces the line
  total.
- Implementation shape: a new pure module `src/pricing.js` —
  `tierPct(tier, settings, proj)`, `tierUnitPrice(product, tier, pct)`, and a
  lens that produces the tier-priced `{ project, settings }` pair the existing
  math (`getGrout`, `printProduct`, the totals loop…) consumes unchanged. The
  edit grid's price inputs keep reading the raw project, so they always show
  and edit retail. Unit tests live in `src/pricing.test.js`.

## Data model

```
Project  + priceTier:   "retail" | "builder" | "employee" | "sale" | "custom"   (default "retail")
         + customPct:   number (default 0; only meaningful when priceTier = "custom")
         + printPricing: "full" | "unit" | "none"                               (default "full")

Settings + pricing: { builderPct: 8, salePct: 10 }
```

- `normC` defaults the three project fields so every old record stays valid;
  `mergeSettings` (catalog.js) grows `pricing` the same way.
- Writes ride the existing paths: `updateProject` for the project fields,
  `setSettings` for the percentages. No schema/SQL change — both live inside
  existing jsonb blobs. No Supabase migration.
- Version snapshots hold `categories` only, so restoring a version never flips
  the tier; auto-version change detection is likewise unaffected.

## Header layout (edit view, second row of the header card)

Column 1 (was the Files box):

```
BUILDER NAME ………………………………… [📎 3]     ← eyebrow label stays; paperclip button
[ Retail | Builder | Emp | Sale | __% ]   ← price tier bar, h-30px
[ All prices | Unit only | No prices ]    ← print pricing bar, h-30px
```

- Both bars are single-choice segmented controls sized to mirror the action
  buttons (30px tall, 12.5px semibold), active segment filled like the
  Order entry/Print buttons.
- The Custom segment is a ~44px inline `%` input; focusing/typing it selects
  the Custom tier.
- The paperclip button carries a count badge and opens a popover with the
  existing file chips (open / delete / Add) — same functionality, relocated.
- Column 1 grows slightly (~78px for the three rows); the notes textarea and
  the actions column stretch to match so the row stays flush.

## On-screen behavior (edit view)

- The header grand total and each area header's `$` follow the selected tier.
- When the tier ≠ Retail, each priced product line shows a small read-only
  chip beside its price field with the tier unit price — e.g. `bldr $4.59/sf`,
  `emp $3.71/sf` — the same number the print uses. On Employee, cost-less
  lines show `no cost — retail` instead.
- A tier ≠ Retail also shows a small tier indicator near the grand total so a
  discounted screen is never mistaken for retail.

## Printed estimate (and Print preview — one shared renderer)

- Prices (unit Price column, line totals, area totals, materials subtotal,
  Estimated total) are computed at the selected tier.
- A tier tag prints under the date when tier ≠ Retail:
  "Builder pricing — 8% off retail" / "Sale pricing — 10% off retail" /
  "Custom pricing — N% off retail" / "Employee pricing". Cost itself never
  prints.
- `printPricing` modes:
  - **full** — today's sheet, at tier prices.
  - **unit** — keeps the unit Price column and the sundries' per-unit prices;
    drops the line Total column, area `$` totals, the materials subtotal, and
    the Estimated total row (the footer keeps SF measured/ordered).
  - **none** — additionally drops the Price column and every other `$`;
    quantities, SF, coverage, SKUs all stay, so the sheet still works as a
    selection/scope document.
- The **order sheet** (`printMode "order"`) is internal and unaffected by both
  controls — it stays retail and fully priced.

## Order entry panel

- Retail on every tier except **Employee**: there, each special-order line's
  Sell column shows `per-unit cost × 1.06` (cost-less lines keep retail).
  Stock lines copy as `SKU⇥qty` and are unaffected.

## Settings → Price book

- A small "Pricing tiers" card with two number fields: **Builder % off**
  (default 8) and **Sale % off** (default 10). Persisted via `setSettings`.

## Out of scope / future ideas (recorded, not built)

- Per-builder discount override (builders are already entities; natural next step).
- Preferring a vendor-published contractor `tierPrice` over the flat Builder %.
- Cost column in the shop stock-book import (would make Employee cover stock lines).
- Freight-aware employee cost.

## Testing & rollout

- Unit tests for `src/pricing.js` (tier math, flags, defaults) plus `normC` /
  `mergeSettings` default tests alongside the existing suites.
- UI/print change ⇒ preview screenshots in the PR (house rule 3); lands via PR
  (rule 2); no live-data writes (rule 1). An ADR recording "tiers are a display
  lens; retail stays the stored price" accompanies the implementation PR.
