# Prototype outcome — product row type-color bleed

**Date:** 2026-07-10
**Branch:** rebrand/kiln

## Question
Should the estimate grid's product rows carry the selected type's accent color —
bleeding from the dark type box across the row to the Total column, never into
the drag/trash actions column? And in what treatment?

## Variants tried (throwaway `public/_proto-row-tint.html`)
- 0 — baseline (no tint)
- A — flat light wash (~7% accent)
- B — gradient fade from the dark box (~17% → ~2%)
- C — stronger flat wash (~13%)
- D — flat light wash (~7%) + Total cell deeper (~17%)

## Answer: **D**
Flat ~7% wash of `TYPE_ACCENT[p.type]` across all cells from the type box
through Total, with the Total cell tinted deeper (~17%) to anchor the money.
Actions (drag/trash) column stays clean card color — the tint stops before it.

## Implementation notes
- Tint mixes the type accent into `--ft-card` (#FFFBF5), the row's base surface.
- Expanded-materials cue (was `#FFF9F2`) folded into the type color: expanded
  rows deepen to ~13% of their own accent instead of the warm amber.
- Actions column masked with `background: var(--ft-card)`.
- Screen-only affordance; the print layout (separate `<table>`) is untouched.
- Delete `public/_proto-row-tint.html` once folded in.
