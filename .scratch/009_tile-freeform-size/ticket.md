---
issue_type: Task
summary: Tile rows model size only as L×W, so an imported non-rectangular size
  (hex "2\" Hex", single-dimension) has no cell to land in and falls back into
  the product/color name. Give tiles a free-text size that DISPLAYS the vendor
  string ("2\" Hex") while deriving a square L×W in the background so grout and
  mortar still compute — gated hard (shape word + small dimension + tile, not
  trim) so a 94" trim stick never becomes a coverage item, and with mosaics
  carved out (their sheet size badly undercounts grout).
status: needs-triage
labels: [needs-triage]
---

# Tile rows need a free-text size + background L×W for non-rectangular (hex) sizes

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
place to put them. AND, unlike #82's rectangles, we want these to still feed the
grout/mortar math, not just display.

## Scope of the miss (measured, both supplied Glazzio books)

- Rectangular / trailing-word sizes (`4" x 4" Nominal`, `8"x9" Hex`, `3x12`):
  **fixed in #82** — fill L/W, clean name. (~248 tiles.)
- Genuine single-dimension hex (`2" Hex`) with no L/W: **still in the name.**
  Small count (e.g. Colonial Collection, book150) but visibly wrong.
- Out of scope here: a handful of mosaic / LVT plank rows land in the `misc`
  pricing branch for an unrelated reason (per-sheet combined unit → no `psf`);
  track separately if it matters.

## Decision: display the vendor size, compute on a derived square L×W

A hex "2\" Hex" should **read** as "2\" Hex" on the row and estimate, but the
grout/mortar math should treat it as **2×2** in the background. This is a sound
approximation, not a fudge:

- The grout formula scales by edge-length-per-area — `((L+W)/(L×W)) × thickness
  × joint`. For a 2×2 square that ratio is `4/4 = 1.0`. A regular 2"-across
  hexagon works out to almost the same ratio (area ≈ 3.46, half-perimeter ≈
  3.46 → ≈ 1.0). So 2×2 grout for a 2" hex is close.
- Mortar tiers off `max(L, W)`, so 2×2 lands a 2" hex in the correct `<8"` tier.
- Direction of error: a hexagon needs *slightly more* grout than the square
  proxy, so the estimate leans a hair low, never high — safe for a reviewed
  quote. A real hex geometry factor could refine this later; not needed now.

Generalize: a single parsed dimension `N` → `L = W = N` for the background math.

## Proposed solution (needs sign-off — touches the product row UI)

1. **Parsing** (`pricebook.js` `splitSizeFromDescription`, feeding the PDF/mapped
   import): recognize a single-dimension shape size (`2" Hex`, `3" Hexagon`) and
   pull it OUT of the description into the size string, the same way `L×W` is
   pulled today — otherwise "2\" Hex" stays stuck in the name (Colonial's is in
   the description column, not a size cell) and there is nothing for the fill
   path to read.
2. **Fill path** (`stock.js` `stockPatch`, tile branch): when `parseTileSize`
   returns null but the item has a `size`, set `patch.sizeText = item.size` (the
   vendor string, e.g. "2\" Hex") instead of prepending it to `brandColor`. When
   the size ALSO qualifies for coverage (see guards), derive and stamp
   `patch.L = patch.W = <single dimension>` so grout/mortar compute. Snapshot
   both onto the row like every other pick.
3. **Display** (`App.jsx`): today a tile's size is rendered purely from `L`/`W`
   (summary line ~346, print ~1992) and the size cell is L/W-only for tiles.
   Show `sizeText` as the tile's size label when present, even though L/W are
   populated for math, and make it an editable cell. Keep L/W editable/
   overridable so a user can correct the grout-relevant dimension if the
   vendor's "nominal" isn't it.

## Guards — what must NEVER become a coverage item

The 94" trim-stick problem: derive the background L×W **only** when ALL hold, so
a linear/trim piece can never turn into a fake area item.

1. `type === "tile"` (trim/misc never derive), AND
2. the size carries a **shape word** — `hex | hexagon | penny | round |
   octagon` (reads the vendor's own string; also what makes it generalize to
   other sheets), AND
3. the single dimension is **small** — cap ~24" (a hex tile is small; a trim
   stick is 94"), AND
4. the item is not trim-ish — no `reducer | t-mold | bullnose | stairnose |
   threshold | transition | trim` in the description, and not sold by a
   linear/piece unit.

A bare `94"` (no shape word, huge, usually trim) fails 2, 3, and often 1 & 4 →
it becomes free-text `sizeText` with **no** coverage. Belt-and-suspenders on
purpose.

## Mosaics — carve out of auto-coverage

"Hex/hexagon mosaic" is the trap when checking other sheets. A mosaic is many
tiny chips on a ~12×12 sheet. Deriving `12×12` from the SHEET size makes grout
come out **wildly low** (a mosaic has far more joint per sqft than a 12×12
tile) — worse than showing nothing, because it looks precise and is off by a
lot. The chip size (what grout depends on) is usually not printed per row
(Harmonic's "Hex Mosaic" had no dimension at all).

Rule: **only derive coverage from a per-chip dimension, never from a mosaic
sheet size.** If all we have is "Hex Mosaic," show the size, leave grout
uncomputed (no fake coverage) until the user types dims.

## Evidence / references

- Fill mechanism: `src/stock.js` `parseTileSize` + `stockPatch` (tile branch,
  the `brandColor` prepend on non-L×W sizes).
- Size parsing: `src/pricebook.js` `splitSizeFromDescription` (`SIZE_RE`).
- Registry pick: `src/orderbook.js` `orderPatch` → `stockPatch`.
- Display touch-points: `src/App.jsx` size rendering (summary line ~346, print
  ~1992, size input cell ~2549).
- Grout/mortar math: `src/catalog.js` (scales off `L`/`W`, mortar tiers off
  `max(L, W)`).
- Reproduce: import `GlazzioTilesPriceList_150.pdf`, search `CLNL270` /
  "Colonial", observe the size in the name.

## Tests to add

- `2" Hex` → `sizeText = "2\" Hex"`, derived `L = W = 2`, grout + mortar compute
  (golden numbers), mortar in the `<8"` tier.
- `94"` reducer (trim) → free-text size, `L`/`W` empty, **no** coverage.
- `Hex Mosaic` (no dimension) → size shown, no derived L/W, no fake grout.
- Regression: an ordinary `12x24` tile is unchanged.

## Non-negotiable to respect

This changes what renders on the product row and the printed estimate, so it
needs **preview proof** (screenshot of the row + both print layouts) before
merge, per the change-control rules.
