# Pricing Tiers & Print Pricing Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-project price tiers (Retail / Builder / Employee / Sale / Custom %) and a three-way print-pricing switch, per `docs/superpowers/specs/2026-07-16-pricing-tiers-print-options-design.md`.

**Architecture:** A pure lens module (`src/pricing.js`) maps the raw `{project, settings}` pair to a tier-priced pair; App.jsx feeds the lens output to the existing totals loop, estimate renderer, and (Employee only) the order-entry rows. Stored data never changes — retail stays the row's `priceSqft`. Two segmented bars replace the Files box in header column 1; Files collapses to a paperclip popover.

**Tech Stack:** React 18 hooks, `node --test` for pure modules, vite dev server + Chromium/Playwright for preview screenshots.

## Global Constraints

- Never touch the live Supabase project (rule 1). No schema change is needed — all new fields live in existing jsonb blobs.
- Never push to `main` (rule 2) — all work on `claude/pricing-tiers-print-options-1p8b0d`.
- UI/print changes need preview screenshots before merge (rule 3) — Task 8.
- Retail is the stored truth: no task may mutate a saved row's `priceSqft`, `costSqft`, or material prices.
- Order sheet (`printMode "order"`) stays retail/unpriced; order entry stays retail except Employee.
- Extend `normC`/`mergeSettings` for every new field so old records stay valid (repo convention).
- Rounding: `round2` on the unit price, then extend by quantity (a printed unit price × qty must reproduce the line total).

---

### Task 1: `src/pricing.js` — tier math + lens (pure, tested)

**Files:**
- Create: `src/pricing.js`
- Test: `src/pricing.test.js`

**Interfaces (produces):**
- `TIER_IDS = ["retail","builder","employee","sale","custom"]`
- `tierPct(proj, settings) -> number` — discount % for the project's tier (0 for retail/employee)
- `tierUnitPrice(product, tier, pct) -> number|null` — tier unit price for a product row, `null` when unchanged
- `employeeNoCost(product) -> boolean` — priced row lacking a snapshotted cost
- `tierView(proj, settings) -> { proj, settings, tier, pct }` — tier-priced pair, identity for retail
- `tierTag(tier, pct) -> string` — e.g. `"Builder pricing — 8% off retail"`, `""` for retail

Key behavior (test each):
- builder/sale pct from `settings.pricing` (defaults 8/10), custom from `proj.customPct`, clamped 0–100.
- Discount tiers scale: product `priceSqft` (when > 0), `grout.caulkPrice`; settings `grouts[*].price` + `grouts[*].base.price`, `mortars[*].price`, `underlayments[*].price` + `underlayments[*].install[*].price`, `attached[catId][name].price`. All `round2`.
- Employee: rows with `num(costSqft) > 0` get `priceSqft = round2(cost × 1.06)`; settings untouched; other rows untouched.
- `tierView` is structure-preserving (same array shapes/ids) and never mutates its inputs.

Steps: write failing tests → implement → `npm test` green → commit.

### Task 2: Persistence defaults

**Files:**
- Modify: `src/App.jsx` — `newProject` (~line 521), `normC` (~line 535)
- Modify: `src/catalog.js` — settings normalization (`normalizeSettings`/`mergeSettings`/serialize path)
- Test: `src/catalog.test.js` (pricing defaults), `src/pricing.test.js` (project defaults via a small `normTierFields` helper if cleaner)

Project fields: `priceTier: "retail"`, `customPct: ""`, `printPricing: "full"` (invalid stored values fall back to defaults). Settings: `pricing: { builderPct: 8, salePct: 10 }`, surviving merge/serialize round-trips. Commit.

### Task 3: Wire the lens into App.jsx math

**Files:**
- Modify: `src/App.jsx`

- Compute once, above the totals loop (~line 2195): `const tv = tierView(sel && sel._full ? sel : { categories: [] }, settings);`
- Totals loop + `gList/mList/uList/cList/bList/aList/attachedList` read `tv.proj` / `tv.settings` (quantities are price-independent, so order sheet + order entry material rows — which show no prices — are unaffected).
- `pMats = printMatList(tv.proj, tv.settings)` (estimate breakdown).
- `renderEstimatePaper` iterates `tv.proj.categories` with `tv.settings` (`printProduct`, `printAreaFloor`, per-line `p.priceSqft`).
- Edit view area headers (~line 2666): `printAreaFloor(tv.proj.categories[ai], tv.settings)`.
- Order entry (~line 3435): `const src = tv.tier === "employee" ? tv : { proj: sel, settings };` and build rows from `src`.
- Order sheet block (~line 3389) keeps using raw `sel`/`settings`.
- `npm test` + `npm run build` green → commit.

### Task 4: Header column 1 — segmented bars + paperclip files popover

**Files:**
- Modify: `src/App.jsx` — header card second row (~lines 2610–2624), new small components `SegBar` and `FilesPop` near other header components.

- `SegBar({ value, onChange, options })`: 30px tall, `rounded-md border border-slate-200`, one filled (indigo-600) active segment, 11–12px semibold labels; last tier option renders an inline `%` number input (selects Custom on focus/typing, writes `customPct`).
- Column 1: eyebrow row = builder name (as today) + paperclip button (count badge) that opens the existing chip list + Add input in an absolutely-positioned popover (pattern: `SalespersonPop`); then tier bar (`Retail / Bldr / Emp / Sale / %`), then print bar (`All $ / Unit $ / No $`).
- Row height grows (~78px); notes textarea and actions column stretch to match.
- Writes ride `updateProject(sel.id, { priceTier | customPct | printPricing })`.
- Build green → commit.

### Task 5: Per-line tier chips + on-screen tier indicator

**Files:**
- Modify: `src/App.jsx` — the price-chip row next to the drift chips (~lines 3030–3060), grand-total corner (~line 2597).

- When `tv.tier !== "retail"`: each priced line shows `emp $3.71/sf` / `bldr $4.59/sf` (from `tierUnitPrice`), or `no cost — retail` (amber) when `employeeNoCost(p)`.
- Near the header grand total: small tier label ("Builder −8%", "Employee", …) so a discounted screen is never mistaken for retail.
- Commit.

### Task 6: Print — tier tag + printPricing gating

**Files:**
- Modify: `src/App.jsx` — `renderEstimatePaper` (~lines 2241–2360), `PRINT_COLS` usage.

- `const mode = sel.printPricing || "full"; const showUnit = mode !== "none"; const showTotals = mode === "full";`
- Grid template drops the Total column when `!showTotals` and the Price column too when `!showUnit` (helper returning the column string; header cells and row cells render conditionally).
- `showTotals` gates: line Total, area header `$`, materials subtotal, Estimated total, footer "Flooring … · Materials …" money, sundries extended `m.cost` (falls back to `$X/unit`).
- `showUnit` gates: unit Price column, sundries per-unit prices, inline material money (if any).
- Tier tag under the date when `tv.tier !== "retail"`: `tierTag(tv.tier, tv.pct)`.
- Commit.

### Task 7: Settings → Price book — "Pricing tiers" card

**Files:**
- Modify: `src/App.jsx` — Price book section header area (~line 4068).

Two number fields (Builder % off, default 8 · Sale % off, default 10) writing `setSettings({ pricing: { ...settings.pricing, builderPct|salePct } })`. Commit.

### Task 8: Preview harness + screenshots (rule 3)

**Files:**
- Create: `.scratch/019_pricing-tiers-preview/preview.html`, `preview.jsx`, `*.png`

House pattern (cf. `.scratch/018_sku-carton-conversion-preview/`): a vite-served harness that mounts the real `SegBar`s, header column 1, and the estimate paper rendered through the real `tierView` at Retail/Builder/Employee and the three print modes with fixture rows (one costed special-order line, one stock line, one misc, grout+mortar materials). Screenshot with the pre-installed Chromium; commit PNGs.

### Task 9: ADR + docs + PR

**Files:**
- Create: `docs/adr/NNNN-pricing-tiers-display-lens.md` (next free number; index in `docs/adr/README.md`)
- Modify: `CLAUDE.md` data-model note (Project pricing fields, Settings.pricing)

ADR records: tiers are a display lens over stored retail; Employee = cost + 6% only where cost exists (flagged otherwise); order entry retail except Employee; order sheet unaffected. Full `npm test` + `npm run build`, push, open PR with screenshots.
