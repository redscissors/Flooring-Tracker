---
issue_type: Bug
summary: The order-entry header bar folded to two rows in a half-screen
  window — its fold was keyed to the viewport `lg` breakpoint while the panel
  is full width below `lg`.
status: done
labels: [ready-for-human]
---

# Order-entry header folds at half screen

Owner, 2026-09-21: with the browser at half screen the Deliver to column
took the whole first row and ERP 1 order / the project + view column dropped
under it. It shouldn't — the panel is ~960px wide there, far wider than the
560px panel the bar fits on one row at `lg`.

## Root cause

`OrderEntryPanel`'s bar was `flex-wrap lg:flex-nowrap` and the Deliver to
column `basis-full lg:basis-auto lg:flex-1` (spec 2026-09-19: "below `lg`,
the phone's full-screen panel, the columns wrap"). But the panel is
`w-full lg:w-[560px]`: below `lg` it is as wide as the viewport, so a 960px
half-screen window folded like a phone even though the bar had 400px to
spare.

## Fix

The fold is keyed to `sm` (640px) instead: below `lg` the panel is full
width, so at any viewport ≥ 640px the bar has at least the 560px it fits at
`lg`; the phone fold below 640px is unchanged. Spec note updated.

Files: `src/orderentry.jsx`, the spec.

## Preview proof

`shot.mjs` over `order-entry-preview.html` (Vite on :5199), measuring the
bar's distinct child tops: `half-960-before.png` / `half-800-before.png`
(2 rows) → `half-960-after.png` / `half-800-after.png` (1 row);
`fold-420-before.png` / `fold-420-after.png` (2 rows both — the phone fold
kept).
