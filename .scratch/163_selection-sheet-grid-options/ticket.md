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
edge drawn; area bands sit flush on the grid above — owner 2026-10-01), job list Order/Each/Total under Qty/Price/Total, Need beside it,
totals + special-order note moved under the material columns. One page.

- `A.pdf` — lighter weight, still 100% black ink
- `B.pdf` — gray ink on the material columns (halftones on a laser — issue 085)
- `C.pdf` — open columns: no horizontal rules on the right, verticals only
- `A-totals-below.pdf` — A with the totals left at the bottom: two pages for N259
- `compare-columns.png` — Today vs A/B/C close-up
- `A-rule.pdf` / `B-rule.pdf` / `C-rule.pdf` (`&band=rule`) — no black band:
  the area name on white with a 2px black rule under it (owner 2026-10-01);
  one page
- `compare-rule.png` — the three rule versions side by side

Owner, 2026-10-01: rule-under-the-name headers rejected — keep the black area
band (flush on the grid above, square right corners). The `-rule` files stay
only as a record.
Owner picks, 2026-10-01: look A (lighter type, 100% black) and the ORIGINAL
full-width job order list with the totals below — no aligned list. Proposed
final: `final.pdf` / `final.png` (`?look=weight&list=full`), one page.

Owner, 2026-10-01: grout/mortar cells read busy; mortar's amount drops to a
second line; maybe drop the unit word. Cell layouts (`&cell=`), all on look A
with the full-width list, columns rebalanced to grout 102 · mortar 74 ·
underlay 94 (same 270 total) so names stop wrapping:
- `cell-split` — name left, amount right on line 1 (no unit); grout's color ·
  joint on line 2
- `cell-lead` — amount first in a narrow gutter, name beside (no unit)
- `cell-leadunit` — as lead, the unit tiny under the number
- `compare-cells.png` — today vs the three, real Manrope (the harness now
  loads .scratch/126's manrope.woff2 — earlier shots used a wider fallback)

Owner picks, 2026-10-01: cell layout 3 (`cell-leadunit` — amount first, unit
tiny under it). The area band's "flooring $" total now ends at the TOTAL
column's right edge (it covers the product rows only, not the materials); the
band still runs full width. Proposed final: `cell-leadunit.pdf`/`.png`.
Owner, 2026-10-01: tighten Qty/Price/Total — Qty 38→34px, Price 60→50px
(Total stays 58, it has to hold $13,729.17); the product column takes the
14px. `money-closeup.png`.
Owner, 2026-10-01: the band's total reads "Area total $X" and prints only on
an area with more than one item; a quote with ONE printed area that was never
named prints no area header at all (option prints keep theirs). The harness
now aliases its own copy of the fake client (`fakesupabase.js`, + `?single=1`
— the shower as the job's only, unnamed area). `single-leadunit.pdf`/`.png`.
