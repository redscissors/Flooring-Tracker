---
issue_type: Task
summary: Tile rows model size only as L×W, so an imported non-rectangular size
  (hex "2\" Hex", single-dimension) has no cell to land in and falls back into
  the product/color name. Give tiles a free-text size that DISPLAYS the vendor
  string ("2\" Hex") while deriving a square L×W in the background so grout and
  mortar still compute — gated hard (shape word + small dimension + tile, not
  trim) so a 94" trim stick never becomes a coverage item, and with mosaics
  carved out (their sheet size badly undercounts grout).
status: open
labels: [ready-for-agent]
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
  hexagon works out to almost the same ratio (area ≈ 3.46 in², half-perimeter ≈
  3.46 in → ≈ 1.0). So 2×2 grout for a 2" hex is close.
- Mortar tiers off `max(L, W)` (`catalog.js` `mortarExact`), so 2×2 lands a 2"
  hex in the correct `<8"` tier.
- Direction of error: a hexagon needs *slightly more* grout than the square
  proxy, so the estimate leans a hair low, never high — safe for a reviewed
  quote. A real hex geometry factor could refine this later; not needed now.

Generalize: a single parsed dimension `N` → `L = W = N` for the background math.

## Proposed solution (needs sign-off — touches the product row UI)

### 1. Parsing — pull a single-dimension shape size out of the description

`pricebook.js` today has `SIZE_RE` (line 572) matching only `L×W`, used by
`splitSizeFromDescription` (line 588) and applied inside `mappedItem` (lines
665–671). Add a second, narrower pattern that fires **only when `SIZE_RE` did
not match**, recognizing `<number>["']? <shapeword>`:

```js
// pricebook.js — alongside SIZE_RE
const SHAPE_WORDS = "hex|hexagon|penny|round|octagon";
const SHAPE_SIZE_RE = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*["']?\\s*(${SHAPE_WORDS})\\b`, "i");
```

In `splitSizeFromDescription`, after the `SIZE_RE` branch, when no `L×W` size
was found, try `SHAPE_SIZE_RE`; on a hit set `size` to the vendor spelling
(e.g. `2" Hex`, preserving the number + shape word) and strip that token from
the name the same way the `L×W` token is stripped. This keeps `2" Hex` out of
the product name (Colonial's size is in the description column, not a size
cell) and gives the fill path a `size` string to read. A bare `6"` (no shape
word) is intentionally **not** matched — it stays in the name, no coverage.

### 2. Fill path — `stock.js` `stockPatch`, tile branch (lines 133–138)

Today the tile branch does:

```js
const lw = parseTileSize(item.size);
if (lw) { patch.L = lw[0]; patch.W = lw[1]; }
else if (item.size) patch.brandColor = `${item.size} ${patch.brandColor}`;   // <-- the bug
```

Change the `else` so a non-`L×W` size lands in `patch.sizeText` (the vendor
string) instead of the color name, and — **only when the coverage guard below
passes** — also derive the square L×W:

```js
const lw = parseTileSize(item.size);
if (lw) { patch.L = lw[0]; patch.W = lw[1]; }
else if (item.size) {
  patch.sizeText = item.size;                 // display the vendor string, e.g. "2\" Hex"
  const n = deriveSquareDim(item);            // null unless the guard passes
  if (n != null) { patch.L = String(n); patch.W = String(n); }
}
```

Snapshot `sizeText` (and, when derived, `L`/`W`) onto the row like every other
pick. `parseThickness` on `item.thickness` is unchanged.

### 3. The coverage guard — `deriveSquareDim(item)`

Return the single dimension **only when ALL hold**, else `null` (free-text
size, no coverage). This is the 94"-trim-stick firewall, belt-and-suspenders:

```js
// stock.js
const SHAPE_WORD_RE  = /\b(hex|hexagon|penny|round|octagon)\b/i;
const TRIMISH_RE     = /reducer|t-mold|bullnose|stairnos|threshold|transition|\btrim\b/i;
const MOSAIC_RE      = /mosaic/i;
const LINEAR_UNIT_RE = /^(lf|lft|lnft|ln|pc|pcs|piece|ea|each)$/i;

function deriveSquareDim(item) {
  if (item.type !== "tile") return null;                               // (1) tiles only
  const text = `${item.size} ${item.description} ${item.product}`;
  if (!SHAPE_WORD_RE.test(item.size || "")) return null;               // (2) shape word in the SIZE
  if (MOSAIC_RE.test(text)) return null;                               // mosaic carve-out (see below)
  if (TRIMISH_RE.test(text)) return null;                              // (4a) not a trim profile
  if (LINEAR_UNIT_RE.test(orderUnitOf(item)) ||
      LINEAR_UNIT_RE.test(priceUnitOf(item))) return null;            // (4b) not sold by the linear ft / piece
  const m = String(item.size).match(/(\d+(?:\.\d+)?)/);                // first number in the size
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!(n > 0) || n > 24) return null;                                 // (3) small — a hex tile, not a 94" stick
  return n;
}
```

Guard conditions, restated:

1. `type === "tile"` — trim/misc never derive.
2. The **size string** carries a shape word (`hex | hexagon | penny | round |
   octagon`) — reads the vendor's own token; also what makes it generalize to
   other sheets.
3. The single dimension is **small** — cap 24" (a hex tile is small; a trim
   stick is 94").
4. Not trim-ish — no `reducer | t-mold | bullnose | stairnose | threshold |
   transition | trim` anywhere in the item text, and **not** sold by a linear /
   piece unit (`LF/LNFT/PC/EA`), checked against both `orderUnitOf` and
   `priceUnitOf` (`stock.js` lines 104–105).

A bare `94"` reducer fails 2 (no shape word), 3 (too big), and 4 (trim word +
linear unit) → free-text `sizeText`, **no** coverage.

### 4. Mosaics — carve out of auto-coverage (folded into the guard above)

"Hex/hexagon mosaic" is the trap when checking other sheets. A mosaic is many
tiny chips on a ~12×12 sheet. Deriving `12×12` from the SHEET size makes grout
come out **wildly low** (a mosaic has far more joint per sqft than a 12×12
tile) — worse than showing nothing, because it looks precise and is off by a
lot. The chip size (what grout depends on) is usually not printed per row
(Harmonic's "Hex Mosaic" had no dimension at all).

Rule: **only derive coverage from a per-chip dimension, never from a mosaic
sheet size.** The `MOSAIC_RE` check rejects any item whose text says "mosaic".
If all we have is "Hex Mosaic," it shows the size, grout stays uncomputed (no
fake coverage) until the user types dims. Note the deliberate tension with the
`penny`/`round` shape words: those profiles are usually mosaics — the mosaic
carve-out is what keeps a "Penny Round Mosaic" sheet from deriving `12×12`,
while a genuine per-chip `1" Penny Round` (no "mosaic" word) still derives 1×1.

### 5. Display — `App.jsx`

L/W are populated for math, but the tile's size **label** must show `sizeText`
when present. Verified touch-points (line numbers current as of 2026-07-13):

- **Order-summary size** (line 346): tile size builds purely from `L`/`W`/
  `thickness`. Show `sizeText` as the size label when set, keeping the
  thickness suffix.
- **Print size cell** (line 1992): same — render `sizeText` when present, else
  the `L×W` fallback / `PRINT_DASH`.
- **CSV export** (line 1860): tile size is `${p.L}x${p.W}x${p.thickness}` — use
  `sizeText` when present so the export matches what prints.
- **Size input cell** (lines 2544–2550): tiles render `GridSizeInput` (the L/W
  editor, `App.jsx` line 586); non-tiles render the `sizeText` input (line
  2549). A tile now needs to surface `sizeText` in this cell too. Keep L/W
  editable/overridable so a user can correct the grout-relevant dimension when
  the vendor's "nominal" isn't it.

  **Presentation — SIGNED OFF: Variant A ("vendor-first").** When a tile carries
  a `sizeText`, `GridSizeInput` renders that vendor string as the primary text
  field (the same control non-tiles use), with the derived square dimension
  shown beneath as a small moss chip — e.g. `▦ computes as 2×2` — that expands
  on click to the L/W micro-inputs for correction. When a tile has no `sizeText`
  (an ordinary `12×24`), the cell is the existing L×W editor unchanged. The
  vendor string is what reads on the row; the derived proxy stays a quiet,
  correctable footnote, never presented as the truth. Rejected: Variant B
  (always-visible split cell — costs a row-line on every hex tile) and Variant C
  (L×W primary with the vendor string demoted to a badge). Preview of all three:
  `.scratch/009_tile-freeform-size/` handoff / artifact (2026-07-13).

`normP` (line 417) already normalizes `sizeText` for every type, and
`rowBlank`/`newProduct` already include it — no data-model migration needed;
tiles simply start carrying a `sizeText` they previously never set.

## Guards — what must NEVER become a coverage item (summary)

The 94" trim-stick problem: derive the background L×W **only** when all four
conditions in §3 hold, so a linear/trim piece can never turn into a fake area
item. A bare `94"` (no shape word, huge, usually trim) fails 2, 3, and often 1
& 4 → it becomes free-text `sizeText` with **no** coverage. Belt-and-suspenders
on purpose.

## Golden numbers (for the tests below)

At the app defaults — grout `PermaColor Select` (coverage 110), joint `1/8"`,
thickness `3/8"`, waste 10%, `qty = 100 sqft`:

- **2×2 hex proxy**: `vol = ((2+2)/(2·2))·0.375·0.125 = 0.046875`;
  `cov = 110·(REF/vol) = 110·(0.0078125/0.046875) = 18.333`;
  `exact = 100·1.10 / 18.333 = 6.00 → order 6 bags`.
- **12×12 comparison** (same inputs): `cov = 110·1 = 110`;
  `exact = 100·1.10/110 = 1.00 → order 1 bag`. The 6× jump is the extra joint a
  2" tile carries — the number is meant to be much larger, and it is.
- **Mortar**, both: `longest = max(2,2) = 2 < 8` → `tier1` (correct `<8"` tier).

## Tests to add

`src/stock.test.js` (parse + fill + guard) and `src/catalog.test.js` /
`src/pricebook.test.js` as fits:

- `splitSizeFromDescription("Colonial Collection 2\" Hex Presidential Grey")`
  → `size = "2\" Hex"`, name has neither the size nor a doubled token.
- `stockPatch` on a `type:"tile"` item with `size:"2\" Hex"` → `sizeText =
  "2\" Hex"`, `L = W = "2"`; grout `exact ≈ 6.00` / order 6, mortar in `tier1`
  (golden numbers above).
- `94"` reducer (`type:"tile"`, `size:"94\""`, `description` has "Reducer",
  linear unit) → `sizeText` set, `L`/`W` empty, `deriveSquareDim` returns null,
  **no** coverage.
- `Hex Mosaic` (shape word but "mosaic" in text, no per-chip dim) → size shown,
  `deriveSquareDim` null, no derived L/W, no fake grout.
- Guard edge: `30" Hex` (shape word but > 24" cap) → no coverage.
- Regression: an ordinary `12x24` tile is unchanged (`parseTileSize` path).
- `parseTileSize('2" Hex')` stays `null` (unchanged — `sizeText`, not L/W, is
  what carries the display; the square dims come from `deriveSquareDim`).

## Non-negotiable to respect

This changes what renders on the product row and the printed estimate, so it
needs **preview proof** (screenshot of the row + both print layouts) before
merge, per the change-control rules. The `GridSizeInput` presentation direction
(§5) is now settled — Variant A — so the PR's preview proof documents the built
implementation of that direction rather than choosing between options.

## Evidence / references (verified 2026-07-13)

- Fill mechanism: `src/stock.js` `parseTileSize` (line 77) + `stockPatch` tile
  branch (the `brandColor` prepend at line 136); unit helpers `orderUnitOf` /
  `priceUnitOf` (lines 104–105).
- Size parsing: `src/pricebook.js` `SIZE_RE` (line 572), `splitSizeFromDescription`
  (line 588), applied in `mappedItem` (lines 665–671).
- Registry pick: `src/orderbook.js` `orderPatch` → `stockPatch`.
- Display touch-points: `src/App.jsx` order-summary size (line 346), print size
  (line 1992), CSV export (line 1860), size input cell (lines 2544–2550),
  `GridSizeInput` (line 586), `normP` (line 417).
- Grout/mortar math: `src/catalog.js` `groutExact` (line 77, scales off `L`/`W`),
  `mortarExact` (line 60, tiers off `max(L, W)`), `REF` (line 25).
- Reproduce: import `GlazzioTilesPriceList_150.pdf`, search `CLNL270` /
  "Colonial", observe the size in the name.

## Refinement notes (2026-07-13)

Triaged `needs-triage` → refined spec → `ready-for-agent`. All code references
in the original ticket were verified against the current tree and found
accurate; line numbers and function names above are confirmed. Added: the
`SHAPE_SIZE_RE` parsing pattern, the `deriveSquareDim` guard as a single
predicate (folding the mosaic carve-out and the linear-unit check into it), the
CSV-export touch-point (was missing), golden grout/mortar numbers, and explicit
guard-edge tests.

The one UI decision that gated this — how the tile size cell surfaces a
`sizeText` while L/W stay live for the math — was previewed as three variants
(A vendor-first, B split cell, C math-first badge) and **signed off as Variant
A** on 2026-07-13. §5 now specifies A concretely, so an implementing agent has
no open design question; it still owes the standard preview proof (row + both
print layouts) at PR time per the change-control non-negotiable.
