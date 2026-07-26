# Cost &amp; common markups, off the price cell (2026-07-26)

Status: prototype — preview proof attached, not merged

Request (Marcus, 7/26): "When we're putting in a manual line — selecting the
material type and manually entering the product — we need more ways to enter
cost, not just the retail price into the price field. Since we already tab past
the price field on a searched item, make it so pressing the price field pops up
a little box that has cost and retail price. And to the right of that, a button
for some of our common markups — put in a cost, hit a markup button, it figures
it out for us. To begin with maybe 30%, 50%, 100%. Just a nice neat popup: put
it all in, close out, keep moving."

## What it does

Clicking (or tabbing into) the grid's price cell opens a small anchored panel:

```
COST & PRICE PER SF                    ×
COST                    PRICE
[    3.40 ]      →      [    5.10 ]
MARKUP  (+30%) (+50%) (+100%) [ 50 %]
Margin $1.70/sf · 33.3%          Enter ↵
```

- The **caret lands in Cost** — the field the grid has no room for. Tab walks
  cost → markup → price. **Enter** (or Esc, or ×) closes and hands the caret
  back to the price cell so Tab carries on down the row.
- A **markup button** prices the row off the cost: `sell = cost × (1 + pct/100)`,
  the same frame the price books mark up in (`orderbook.sellPrice`). The `%`
  box beside them takes anything else, and lights the matching preset.
- With a markup chosen, **typing the cost drives the price live**. Typing a
  **price** instead is the truth and re-derives the markup beneath it — editing
  the sale price moves the margin, never the cost (the `orderLineCost`
  doctrine).
- The footer shows the **unit margin** in dollars and as a % of sell (so 50%
  markup reads 33.3% margin, matching the job's margin line). A price under
  cost reads "Below cost" in red.
- The popup names the row's **own sell unit** — per sf, per ea, per rl — off
  the same `units.js` vocabulary the print and order panel use.
- A price cell that carries a cost gets a thin green rule down its left edge,
  so a costed line is visible without opening anything.

## Why it's more than a data-entry convenience

The three fields it writes — `costSqft`, `markupPct`, `priceSqft` — are exactly
what a price-book pick already snapshots. Everything downstream that was blind
to a hand-typed line now sees it:

- **Employee tier** (cost × 1.06) could never price a manual line; it fell back
  to retail and flagged itself red. Screenshot 05 is that flag turning into a
  real $6.57 the moment a cost is typed.
- **The internal margin line** counted special-order rows only, gated on
  `p.cost > 0` (the raw book unit cost). That gate now also accepts a
  hand-entered `costSqft`, so a manually costed line joins the margin
  (`App.jsx`). Nothing else about the rollup changed.
- **`orderLineCost`** already preferred `costSqft` over deriving cost from the
  markup, so the order sheet's extended cost is honest on these rows with no
  change.

Retail-only rows are untouched: no cost, no margin claim, same numbers as
before. Nothing is repriced from a book at calc time (ADR 0003 stands) — the
popup only ever writes what the user typed or a button computed.

## Files

- `src/costentry.js` (new) + `costentry.test.js` — `MARKUP_PRESETS`,
  `priceFromCost` / `markupFromPrice` / `unitMargin`, and the three patch
  builders `editCost` / `editMarkup` / `editPrice`. Pure, so `node --test`
  covers the arithmetic and the "which field wins" rules.
- `src/grid.jsx` — `PriceCostPop` + `GridPriceCell` now takes `onPatch`
  (was `onRetail`) and a `unit`.
- `src/mobile.jsx` — the phone has room, so the same fields sit **in line** in
  the row sheet under Price / SF rather than as a popup.
- `src/App.jsx` — the call site, and the margin gate above.
- `src/index.css` — `.ft-num`, the existing spinner suppression extended to the
  popup's number fields.

## Open questions for you

1. **Are 30 / 50 / 100 the right three?** They're one array
   (`MARKUP_PRESETS` in `costentry.js`). If the shop wants four, or different
   numbers per material, say so — and if you'd rather tune them yourself
   without a deploy, they can move into Settings → Price book beside the
   Builder/Sale percentages.
2. **Should a markup stick to the row?** Right now picking +50% stores 50 on
   that line only. A "default markup for new manual lines" setting would mean
   typing a cost alone prices the line — say the word if that's wanted.

## Proof

Real components, real state, driven by Playwright — not mockups.

| Shot | What it shows |
|---|---|
| `01-popup-opens.png` | Clicking a manual line's price cell; caret in Cost |
| `02-cost-plus-50.png` | 3.40 typed, +50% hit → 5.10, line $918.00, margin $1.70/sf · 33.3% |
| `03-closed-and-stored.png` | Enter closes, caret back in the cell, the three fields stored |
| `04-count-line-custom-pct.png` | A misc count line: "per ea", custom 65% typed |
| `05-employee-tier-gets-a-cost.png` | The red "Retail" fallback becoming $6.57 as a cost is typed |
| `06-price-book-line.png` | A picked row opens pre-filled from its own snapshot |
| `07-mobile-cost-row.png` | The phone's in-line Cost / SF + markup chips |

Rebuild: `npx vite build --config .scratch/053_price-cost-popup/proof-vite.config.mjs`,
serve `proof-dist` on :8391 (`python3 -m http.server 8391`), then
`node .scratch/053_price-cost-popup/shot.mjs`. `proof-dist` is never committed.

Tests: `node --test src/*.test.js` — 764 pass, up from 754 (the whole of
`costentry.test.js`). Production build clean; lint clean apart from the
pre-existing unused import in `orderbook.test.js`.
