---
issue_type: Task
summary: Tile rows model size only as L×W, so an imported non-rectangular size
  (hex "2\" Hex", single-dimension) has no cell to land in and falls back into
  the product/color name. Give tiles a free-text size fallback (shown when L/W
  are empty) so hex/odd sizes display in the size column like every other size,
  matching the Virginia Tile import behavior.
status: needs-triage
labels: [needs-triage]
---

# Tile rows need a free-text size fallback for non-L×W (hex) sizes

## Problem / Why

Follow-up to the Glazzio PDF-import work (PRs #81, #82). PR #82 made imported
tile sizes fill the L/W size cells with a clean product name — but only when the
size is a rectangle (`L×W`). A tile row models its size **only** as `L`, `W`,
and `thickness`; there is no size cell for a non-rectangular size.

So a genuine single-dimension size — the hex tiles in the Glazzio books, e.g.
Colonial Collection printed as `2" Hex`, or a bare `6"` — has nowhere to go. The
pick path (`stock.js` `stockPatch`) can't parse an `L×W`, so it prepends the raw
size to `brandColor`, and the size shows up in the **product / color name**
field instead of the size column:

```
CLNL270  size "2\" Hex"
  L="" W=""  →  brandColor = "Colonial Collection 2\" Hex Presidential Grey 2\" Hex"
```

This is the exact "size in the color field, not the size field" complaint that
#82 fixed for rectangular sizes — it just can't be fixed for hex sizes without a
place to put them.

## Scope of the miss (measured, both supplied Glazzio books)

- Rectangular / trailing-word sizes (`4" x 4" Nominal`, `8"x9" Hex`, `3x12`):
  **fixed in #82** — fill L/W, clean name. (~248 tiles.)
- Genuine single-dimension hex (`2" Hex`) with no L/W: **still in the name.**
  Small count (e.g. Colonial Collection, book150) but visibly wrong.
- Out of scope here: a handful of mosaic / LVT plank rows land in the `misc`
  pricing branch for an unrelated reason (per-sheet combined unit → no `psf`);
  track separately if it matters.

## Proposed solution (needs sign-off — touches the product row UI)

Add a free-text size fallback for tiles, used only when `L`/`W` are empty:

1. **Fill path** (`stock.js` `stockPatch`, tile branch): when `parseTileSize`
   returns null but the item has a `size`, set `patch.sizeText = item.size`
   instead of prepending it to `brandColor`.
2. **Display** (`App.jsx`): today a tile's size is rendered purely from `L`/`W`
   (summary line ~346, print ~1992) and the size input cell is L/W-only for
   tiles. Show `sizeText` as the tile's size when `L`/`W` are blank — on the
   estimate line, the print layout (both), and as an editable cell.
3. Keep `sizeText` out of the material math (grout/mortar scale off `L`/`W`); a
   hex with no L/W simply computes no grout/mortar until the user types dims —
   same as today, just with the size now visible in the right column.

## Evidence / references

- Fill mechanism: `src/stock.js` `parseTileSize` + `stockPatch` (tile branch,
  the `brandColor` prepend on non-L×W sizes).
- Registry pick: `src/orderbook.js` `orderPatch` → `stockPatch`.
- Display touch-points: `src/App.jsx` size rendering (summary line, print
  layout, size input cell).
- Reproduce: import `GlazzioTilesPriceList_150.pdf`, search `CLNL270` /
  "Colonial", observe the size in the name.

## Non-negotiable to respect

This changes what renders on the product row and the printed estimate, so it
needs **preview proof** (screenshot of the row + both print layouts) before
merge, per the change-control rules.
