# Prototype outcome — associated-materials open & add

**Date:** 2026-07-10
**Branch:** rebrand/kiln

## Question
How should the materials drawer (grout/caulk/mortar/underlayment) open and how
do you add a material, without the `└ + Grout / Mortar / Pad` addables row
under every line? Plus: should clicking outside an expanded drawer collapse it?

## Variants tried (throwaway `public/_proto-mats-open.html`, deleted)
- 0 — baseline (addables row, for contrast)
- A — `+` button beside the chevron opening a popover menu
- B — ghost pill / ghost chips → refined to: **ghost pill opens everything**
- C — hover-reveal `+` at the row's right end

## Answer: **B (refined) + click-outside collapse + inset type box**
1. **Addables row is gone entirely.**
2. **Ghost pill** — a row with no materials shows a faint dashed pill
   (`＋ Grout · Mortar · Underlayment…`) in the summary-pill slot; clicking it
   opens the drawer with **every applicable material shown as a card** —
   checked ones with full controls, unchecked ones as slim dashed cards
   (empty checkbox + label + default-product hint). Check/uncheck in place;
   unchecking never closes the drawer.
3. **Click-outside collapses** any open drawer back to its summary pill
   (or ghost pill if nothing checked). Elements marked `data-mats-keep`
   (drawer, pills, chevron, note row, actions cell) don't trigger it.
4. **Inset type box** — the colored type box (T/H/V…) is inset 6px top/bottom
   instead of a full-bleed spine, reading as a small tile tacked on the left.

## Where it landed (src/App.jsx)
- TypeSelect compact button: `margin: "6px 0"`.
- Drawer wrapper condition `matExpanded && p.type !== "misc"`; slim unchecked
  cards added per material; chevron shows when `hasMats || matExpanded`.
- Ghost pill after the summary-pill block; `addables` reduced to label list.
- Document-level click listener beside `matOpen` state; `data-mats-keep`
  opt-outs.
- Build ✓, 114/114 tests ✓. Screen-only (whole editing view is print:hidden).
