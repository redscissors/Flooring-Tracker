# Sheoga configurator — shopping basket + multi-width floors

**Status:** approved design (2026-07-18) · pre-implementation
**Area:** `src/SheogaConfigurator.jsx`, `src/sheoga.js`, customer normalization in `src/catalog.js`
**Clickable mockup:** `.scratch/024_sheoga-cart-multiwidth/mockup.html` (all states verified in the dev harness)
**Inspiration:** Mobbin cart-drawer pattern (Hers/Instacart) for the basket; Shopify per-variant rows + Booking.com editable-% table for the multi-width split.

---

## 1. Problem & goals

The Sheoga configurator currently prices **one** build at a time and commits it straight to the
active product row. Two gaps:

1. **No staging.** A salesperson pricing a job with several Sheoga products has to add each one,
   one at a time, with no way to gather and review them together before committing.
2. **No multi-width floors.** A mixed-width ("3-4-5") random-width floor is a single design that
   uses several plank widths in set proportions. Today each width would be a separate build with
   its **own** custom-color charge and its **own** small-order fee — which overcharges the customer,
   because those charges apply once to the job, not once per width.

Goals:

- A **persistent shopping basket** on the job: save configured builds, review them together,
  selectively move them onto the product line.
- A **multi-width mode**: pick several widths, split the job size across them (proportional to
  plank width by default, salesperson-overridable), with **one** custom-color charge and a
  **single** small-order fee based on the **total** job size.
- Small UI cleanups: a slightly wider option rail that doesn't reflow when a scrollbar appears,
  and removal of the "this description is the order" helper line.

Non-goals (YAGNI): fee-pooling across *unrelated* basket items (only a multi-width bundle pools);
multi-width on the stocked / herringbone / vent tabs (floor tab only for v1); editing a basket
entry in place (remove + rebuild instead).

---

## 2. Decisions locked with the user

| Decision | Choice |
|---|---|
| Multi-width split default | **Proportional to plank width** (wider plank → bigger share), matching the 3-4-5 repeating look. |
| Split adjustability | Salesperson can override any width's share; **changing the set of widths re-derives all shares** to the proportional default. Manual edits persist until the width set changes. |
| Basket lifespan | **Persists with the job** (survives closing/reopening the configurator). |
| Basket storage | On the customer record's existing jsonb (`data.sheogaBasket`) — **no Supabase schema change**. |
| Custom-color charge (multi-width) | **Charged once** per bundle, not per width. |
| Small-order fee (multi-width) | **Charged once**, computed on the bundle's **total** sq ft. |
| Multi-width entry point | A **"Multi" chip in the Width row** of the floor tab. |
| Commit actions | Both remain: **Add to basket** *and* **Add to product line** (direct). The basket is additive, not the only path. |
| Basket panel placement | **Slide-out drawer from the right** on desktop; **bottom sheet** on mobile (reuses the existing `MobileBuildSheet` gesture infra). |
| Move target | The **Area the configurator was opened from** (shown on the Move button, e.g. "Move 2 → Kitchen"). |
| Bundle atomicity | A multi-width bundle is **one basket row that moves as a unit** — its pooled charges stay intact. |

---

## 3. Data model

The basket lives in the existing `customers.data` jsonb (like `attachments` / `categories`), so no
new table or column is required, and it is written through the existing `updateCust(id, patch)`
path — never ad hoc.

```
Customer.sheogaBasket : BasketEntry[]        // NEW; defaults to [] (normC)

BasketEntry =
  | { id, kind:"single", addedAt, markupPct, snap:{mode,cfg}, sf }
  | { id, kind:"bundle", addedAt, markupPct,
      base:{ mode:"floor", cfg },            // shared species/grade/texture/finish/color/sheen
      widths:[ { w, share } ],               // chosen widths + relative share weights
      sf }                                    // TOTAL job size for the bundle
```

- `share` is a **relative weight**, not a hard percentage. The sq-ft split for width *i* is
  `sf * share_i / Σ share`. Defaults are set so they read as clean percentages summing to 100,
  but manual edits never need to re-sum — normalization handles it.
- Snapshots are self-contained configs. Prices are (re)computed from the code-constant Sheoga
  sheets at display and at move time — consistent with how the configurator already prices, and
  re-importing/retranscribing a sheet is the only thing that could change them.

`normC` gains a `sheogaBasket` default and a `normBasketEntry` normalizer (mirrors
`normA`/`normP`) so old customer records stay valid.

---

## 4. Pricing engine (`src/sheoga.js`)

New pure functions; all existing single-build math is unchanged.

- `redistributeShares(widths) → { [w]: share }` — proportional-to-width default; wider plank gets
  the larger share; result reads as whole percentages summing to 100.
- `multiWidthBuild(base, widths, sf) → { lines, fees, cost, sell, total, ... }` where:
  - `lines` = one per width; each is a floor build at that width for `sf_i = round(sf * share_i / Σ share)`
    (rounding reconciled on the largest line so the parts sum to `sf`), **without** per-line fees.
  - `fees` (pooled, each imports as its own at-cost misc line, matching current fee behavior):
    - **Custom-color sample** — `SAMPLE_FEE` once, if `base.finish` is a custom color (T-1/T-2/T-3).
    - **Small-order fee** — computed once on **total** `sf` (`<250 → 600`, `<500 → 300`, else `0`).
  - `total` = Σ line totals (sell × sf_i) + Σ pooled fees.
- `multiWidthLineItems(base, widths, sf, markupPct) → LinePayload[]` — the row payloads the caller
  hands back: N product rows (one per width, each carrying its own `sf`/`priceSqft`/`costSqft`/
  `sizeText`) + the pooled fee lines as `misc` rows. Shape matches today's `lineItems` output so
  `addSheogaLines` consumes them unchanged.

The existing per-build `calcFloor` fee logic is factored so single builds keep their current
per-build fees and only bundles pool — no behavior change for non-multi builds.

---

## 5. UI (`src/SheogaConfigurator.jsx`)

### 5.1 Option rail width
- Rail `max-w-[468px]` → **`500px`**, add **`scrollbar-gutter: stable`**, and bump the popup
  `max-w-5xl` a touch so the build pane isn't cramped. Reserving the gutter means the species
  chips never reflow when the multi-width panel makes the rail scroll — Live Sawn White Oak stays
  on the second row. (Verified in the mockup.)

### 5.2 Remove helper copy
- Delete the `↑ this description is the order — it snapshots onto the job line.` line under the
  build-card description.

### 5.3 Multi-width mode (floor tab only)
- A dashed moss-green **"◨ Multi" chip** at the end of the Width row.
- Toggling it on:
  - Width chips become **multi-select** (checkboxes); a **"How many widths?" − / + stepper** appears
    (min 2). Adding/removing a width (chip or stepper) calls `redistributeShares`.
  - The right pane switches to the **multi-width card**: a header, one **row per width** showing an
    editable **% field** (weight), the derived **sq ft**, the per-width **sell $/sf**, and the
    **line total**; then the **pooled fee lines** (custom-color once, small-order once on total);
    then the **bundle total**; then **Add bundle to basket** / **Add N lines to product line**.
  - Editing a % updates that width's `share` and live-recomputes sq ft, line totals, pooled fees,
    and the bundle total.
- Shared options (species/grade/texture/finish/stain/sheen/lengths/edge) apply to every width —
  it's one floor in mixed widths.

### 5.4 Basket
- **Basket button with count badge** in the header (near close).
- Desktop: opens a **drawer sliding in from the right** over the build pane, with a scrim.
  Mobile: opens a **bottom sheet** (reuse `MobileBuildSheet`).
- Contents: each entry as a row with a **checkbox**, title, meta, and price. A **bundle** row shows
  its per-width sub-lines and pooled fees inline and is not individually splittable. Each row has a
  **remove** (✕).
- Footer: **"Move N → [Area]"** primary + **"Move all"**, a selected-count line, and a
  **Select all / Clear** toggle.
- **Add to basket** appears on the build card (desktop) and the mobile build sheet footer,
  alongside the existing **Add to product line**.

### 5.5 Wiring / props
- The configurator receives the customer's `sheogaBasket` and a persist callback (writes via
  `updateCust`), plus the **active Area** (id + name) it was opened from.
- **Add to basket** appends a normalized entry and persists.
- **Move** converts each selected entry via `lineItems` / `multiWidthLineItems`, hands the payloads
  to the existing add-to-line path (`onAdd` / `addSheogaLines`) for the active area, then removes
  the moved entries from the basket and persists. A bundle moves all its lines + pooled fees at once.
- No-customer contexts (the dev harness) fall back to in-memory basket state so the harness still
  works.

---

## 6. Suggested build phases (for the plan)

1. **Cleanups** — rail width + `scrollbar-gutter`, remove the helper line. (Low risk; independently
   shippable.)
2. **Pricing engine** — `redistributeShares`, `multiWidthBuild`, `multiWidthLineItems`, fee-pooling
   refactor; unit tests in `src/sheoga.test.js` (share math, rounding reconciliation, pooled-fee
   thresholds, line-payload shape).
3. **Multi-width UI** — Multi chip, multi-select widths + stepper, multi-width card with live split.
4. **Basket** — `sheogaBasket` normalization, drawer/sheet UI, add/remove/move, persistence via
   `updateCust`, area targeting.

Each phase is independently previewable; per the project non-negotiables, no UI/print change merges
without preview proof, changes land via PR, and no live Supabase mutation is performed by an agent.

---

## 7. Testing

- **Unit (`src/sheoga.test.js`):** `redistributeShares` (proportional, sums to 100, wider > narrower);
  bundle sq-ft split reconciles to the exact total; small-order fee flips at 250/500 on **total** sf;
  custom-color sample charged once; `multiWidthLineItems` returns N product rows + pooled misc lines
  in the existing payload shape.
- **Normalization:** `normC` yields `sheogaBasket: []` for legacy records; `normBasketEntry` coerces
  bad fields and drops junk.
- **Preview proof:** production-harness screenshots of single-build, multi-width (with dynamic
  redistribution), basket drawer (desktop), and basket sheet (mobile).

---

## 8. Open follow-ups (not in this scope)

- Fee pooling across separate (non-bundle) basket items destined for one job.
- Multi-width on the stocked-prefinished tab.
- Editing a basket entry in place.
