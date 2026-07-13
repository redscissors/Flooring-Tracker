# Phase 5a — internal materials-margin line: preview proof

**Date:** 2026-07-13 · **Branch:** `claude/pricebook-phase5a-margin`

Screenshot capture times out in this environment (known intermittent issue), so
proof is the sanctioned observed-run fallback: `read_page` accessibility tree
against the **real** `MarginLine` component (the exact JSX that ships), rendered
in the Order-summary totals context via a throwaway `?p5a=1` harness (deleted
before commit). Tablet viewport, light mode.

## Computed margin (from the tested `specialOrderMargin`)

Two special-order lines — 100 sf tile @ cost 8/sf × 25% markup → $1000 sell, and
a $500 misc line @ 40% markup:

```
{ sell: 1500, cost: 1157.14, margin: 342.86, pct: 22.9, lines: 2 }
```

`pct` is gross margin (margin ÷ sell = 22.9%), not the markup — deliberately, per
the flooring-domain reading of "margin."

## Observed states

| State | Rendered |
|---|---|
| Default (`show=false`) | `Special-order margin` · `•••` (masked) |
| After clicking the row | `Special-order margin` · `$342.86 · 22.9%` |
| Forced revealed | `Special-order margin` · `$342.86 · 22.9%` |
| No special-order lines (`margin.sell === 0`) | **nothing** — component returns null, only Flooring/Total show |

Toggle is live: one click flipped the masked `•••` to `$342.86 · 22.9%` and back.

## Print-absence (ADR 0011 / 0009 §8.1 — the load-bearing rule)

Structural, and airtight:

- `grep MarginLine src/App.jsx` → defined once, **rendered exactly once** (the
  edit-tab "Order summary" panel), and `margin.margin/pct/sell` are referenced
  **only inside the `MarginLine` component**.
- Both print paths — the `@media print` layout and the on-screen Print preview
  tab — render `renderEstimatePaper()`, which contains **no** `MarginLine` /
  `margin.*` reference. The order-sheet print block likewise.
- `MarginLine` also carries `ft-noprint` as belt-and-suspenders.

So the margin can only appear in the on-screen edit summary; it cannot reach
either printed document.

## Tests

`npm test` 170 → 175 (5 `specialOrderMargin` cases: single line, blended
multi-line, 0% markup, empty/zero-sell, string inputs). `npm run build` clean.
