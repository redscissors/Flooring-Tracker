---
issue_type: Bug + Feature
summary: Selection sheet print — close the material-column grid (it left every
  area's boxes open at the bottom and right), lighten the material columns, and
  line the job order list up under the product block's Qty/Price/Total.
status: needs-triage
labels: [needs-triage]
---

# Selection sheet — grid fix + lighter material columns + aligned job list

Owner, 2026-10-01: the black grid on the right is inconsistent (sometimes a
horizontal line, sometimes not); try the material columns lighter than the
products; line the install-materials list's total up with the product Total,
stretching full width only once that gets too narrow.

## Cause of the grid bug
Each product row draws a rule ABOVE itself and each material cell its own left
rule. Nothing draws the rule below an area's last row or the right edge, so
every area's boxes are closed on top and open at the bottom (visible under the
wedi panel, VT Quartz and Sheoga rows). The 6px column gap also lets the row
rules run through where the verticals stop.

## Mockups (throwaway — EstimateColumnsVariants.jsx, not product code)
`npx vite --config .scratch/163_selection-sheet-grid-options/vite.config.mjs`
then `PW=/opt/node22/lib/node_modules/playwright node .scratch/163_selection-sheet-grid-options/shot.mjs`

All three: grid closed (material columns as one butted strip, bottom + right
edge drawn), job list Order/Each/Total under Qty/Price/Total, Need beside it,
totals + special-order note moved under the material columns. One page.

- `A.pdf` — lighter weight, still 100% black ink
- `B.pdf` — gray ink on the material columns (halftones on a laser — issue 085)
- `C.pdf` — open columns: no horizontal rules on the right, verticals only
- `A-totals-below.pdf` — A with the totals left at the bottom: two pages for N259
- `compare-columns.png` — Today vs A/B/C close-up
