# Prototype outcome — product row color balance & materials box

**Date:** 2026-07-10
**Branch:** rebrand/kiln

## Question
Two-axis color exploration on the estimate grid's product rows:
1. **Wash axis** — how strong should the type-color wash be, and what sits on
   cream vs paper (row vs lower chrome vs materials box)?
2. **Materials axis** — what color scheme should the expanded material cards
   (grout/mortar/underlayment) use instead of the flat terracotta?

Mobbin research (YNAB, Origin, mymind, Quicken) fed four hierarchy schemes
(amber chip, ink hierarchy, terracotta column, dark anchor) — none won, but
the "rows quiet, spend color on one thing" rule shaped the final numbers.

## Variants tried (throwaway `public/_proto-color-balance.html`)
Wash: 0 current · A lighter (4%) · B darker+lighter mats · C inverted chrome ·
D A+C · E amber chip · F ink hierarchy · G terracotta column · H dark anchor ·
I C+deeper rows+aligned box · J I+tinted collapsed pill.
Materials: 1 terracotta · 2 type accent · 3 fired clay · 4 sage · 5 slate ·
6 warm ink · 7 minimal hairline · 8 merged accent box.

## Answer: **wash J + materials 8**
- Row wash deepens to **13%** of `TYPE_ACCENT[p.type]` (19% expanded), Total
  cell **26%**.
- **Inverted chrome**: the product card's lower area (pill zone, note row,
  drift chips) and the actions column sit on cream (`--ft-prod` #FBF5EA); the
  colored line pops against it.
- **Merged accent box** (expanded materials): one fused box, white base,
  outline = type accent @45%, separators @25%; checked lines fill with the
  accent @12%, unchecked lines stay paper (no dashed borders). Checks, joint
  buttons, and order counts follow the type accent instead of terracotta.
- **Collapsed pill** wears the row's exact wash color (13%) with a 25% accent
  border; its bold G/M/U letters take the accent. Empty ghost pill unchanged.
- Pill, ghost pill, and merged box all end **flush with the Total column's
  right edge** (margin-right 44px = actions column).

## Implementation notes
- All in the product-row render in `src/App.jsx`; separator rule `.ft-mats`
  added to `src/index.css` (`--mat-acc` set inline per box).
- Focus borders and the caulk-count input inside the grout card keep the
  terracotta brand color (interactive states were out of scope).
- Screen-only; the print layout is untouched. 114/114 tests pass, build clean.
- `public/_proto-color-balance.html` deleted after fold-in.
