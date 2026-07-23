# Floor trims as lines — design

**Date:** 2026-07-22 · **Status:** prototype on `claude/price-book-trims-ui-890mju`

## Problem

Picking a floor from a price book is one search-and-click, but the trims that
go with it (reducer, T-mold, stairnose, end cap, quarter round…) are each a
separate search today. The books already know the relation: trim items carry
`fits` — the floor SKUs they belong to (ADR 0012 amendment) — and
`trimsForFloor` (orderbook.js) answers the reverse direction exactly. Nothing
in the selection grid uses it yet.

The owner's ask (2026-07-22, voice): a button on the floor row — living in the
materials drawer, "the depth you open up where you find underlayments and
mortars" — that pops up everything associated with that floor, lets you pick
what and how many, and lands them **as product rows directly below the floor**,
not as aggregated extras at the bottom. Quantities stay adjustable on the rows,
and reopening the popup should adjust rather than blindly append ("it would
probably just add new lines versus adjusting the quantity … which is a little
bit weird").

## Approaches considered

1. **Add-on material category** (ADR 0016 style): trims as a checked material
   on the floor row, aggregated into the materials estimate. Rejected — trims
   are real SKU'd order lines with their own per-piece prices, carton
   rounding, drift chips, and order-entry copy. They belong in the grid, and
   the owner explicitly wants rows.
2. **Popup + rows below the floor, idempotent** *(chosen)*: a Trims row in the
   materials drawer opens a popup listing `trimsForFloor` with a quantity per
   trim; Apply inserts rows right below the floor. The popup **seeds from rows
   already on the area** (matched by `bookId`+`sku`), so reopening adjusts
   quantities in place instead of duplicating — the popup mirrors the floor's
   trim lines. Clearing a seeded quantity to 0 removes that line.
3. **Inline suggestion strip** under the floor row (no popup). Rejected — no
   room for per-trim quantities, and it clutters every book row whether or not
   trims are wanted.

## Design

### Data flow

- **Fetch:** `useTrims` (new hook, `src/usetrims.js`) queries
  `price_book_items` for the row's book with `data->fits` containing the
  floor's SKU (`filter cs`), then filters exactly with `trimsForFloor`
  (hidden/retired rows stay out) and prices each hit with the book's markups
  (`pricedItem`) — the same normalize/price path the order search uses. One
  registry serves both order and stock books, so one query covers both.
  Results cache per `bookId`+`sku` for the session; an applied import clears
  the book's entries (same spot the row-drift cache is cleared).
- **Prefetch:** opening a row's materials drawer calls `ensureTrims` for a
  `bookId`+`sku` row. The drawer's Trims row renders only once trims are known
  to exist, with a count — no dead button on floors with none, and the popup
  never opens onto a spinner.
- **Rows are snapshots:** picked trims go through the sanctioned
  `patchFor` (orderPatch/stockPatch) exactly like a search pick — count lines
  (`type:"misc"`, `qtyType:"count"`), per-piece price, `cartonPc` rounding,
  `bookId`+`sku` provenance so drift chips work. Nothing reprices later
  (ADR 0003 doctrine).

### Apply semantics (pure, `src/trims.js`)

- `seedTrimPlan(products, floor, trims)` — per trim: the existing row's id and
  quantity (first row in the area matching `bookId`+`sku`, floor excluded), or
  qty 0.
- `applyTrimPlan(products, floorId, entries)` — one pass:
  - seeded row, qty > 0 → update `qty` only (hand-edited prices/notes stay);
  - seeded row, qty 0 → remove the line;
  - new pick, qty > 0 → prebuilt row inserted directly below the floor, after
    any of its existing trim rows so the block stays grouped.
  - floor row untouched; floor missing → no-op.

### UI

- **Drawer row** (below the add-on categories): `＋ Trims — N for this floor`,
  with an `· k on job` note when lines exist. Click closes the drawer and
  opens the popup. Only on rows with `sku` + `bookId` whose book lists trims
  for that SKU.
- **Popup** (`src/TrimsPopup.jsx`, `Modal`): one line per trim — name (the
  "· fits …" note stripped, as on the order panel), size, SKU, sell price
  `/ea`, carton note when sold in cartons — with a quantity box. Seeded lines
  show an "on job" badge; clearing one to 0 shows "removes its line". Footer
  totals the picked pieces/dollars and the button reads **Add to job** (or
  **Update lines** when anything was seeded).

### Amendment 2026-07-23 — ERP stock floors & the stock-over-order preference

The ERP stock exports carry no `fits` column, but they share the vendor's SKU
space (the mergeSearch doctrine: exact SKU equality across the stock and order
spaces is the same product — "also on {book}"). So:

- The trims fetch is keyed by the **floor's SKU** and spans **every active
  registry book**, not just the floor's own — a floor picked from an ERP stock
  export finds the vendor order book's `fits` relation under the same SKU.
- At render, `preferStockTrims` swaps in an exact-SKU **live stock item**
  (shelf retail, "stock" badge) over its special-order twin; the vendor item
  stays only when the shop doesn't stock that trim ("special order" badge).
  Retired/disabled/discontinued stock never swaps in. Applied at render, not
  at fetch, so the swap works whenever the background stock cache lands
  (`bookStockReady`).
- Seeding matches existing lines by SKU (not bookId+SKU), so a line added as
  one space's item seeds when the popup later lists the other's.
- Cache invalidation on import clears the whole trims cache (entries span
  books).

If the ERP's SKUs turn out not to be the vendor's own for some supplier,
exact matching finds nothing for that book's floors — a mapping would need
sample sheets (see the issue thread).

### Amendment 2026-07-23 (2) — the ERP's codes are the shop's own

Owner clarification: the ERP product codes are internal ("RSKU…"); the
manufacturer's code rides in the ERP **description**, generally at the very
end ("… NOBLE OAK ACORN REDUCER 384421"). So exact same-SKU pairing never
fires between spaces. The bridge stays exact anyway:

- `vendorCodeCandidates(description)` (trims.js) takes the last few
  code-shaped tokens of an ERP description (has a digit, not a size, 3–16
  chars, punctuation shed). A wrong candidate is harmless — every use is an
  exact-membership test against codes the vendor books actually state, never
  a fuzzy match.
- **Lookup:** a floor row resolves to a key set — its own SKU plus, for a
  stock floor, its ERP item's extracted codes (waiting on `bookStockReady`).
  `useTrims` runs one exact `fits`-containment query per key (≤4) and merges.
- **Stock preference:** `preferStockTrims` indexes stock items under their
  own SKU *and* their extracted codes, so the vendor-book trim "384421" finds
  the shop's "RSKU…" shelf item. A swapped item keeps the vendor code as
  `orderSku`, and seeding matches lines added under either code.

### Amendment 2026-07-23 (3) — the code columns are the bridge (real MANMI sheet)

The owner's real MANMI export settled it: the manufacturer's code is a
**column** — Supplier Prod Code and Mfg Product Code, filled on every row —
while the description is *not* a safe source (position: absent 180 / middle
54 / tail 3 of 237; and one real floor's description carried a sibling
color's code — Noble Oak Bark said `MPB820` (= Dry Leaf) while the column
correctly said `MPB823`). So:

- The ERP import now captures both columns as `vendorSkus` on the item
  (normalized like `fits`; the recognizer maps them, `guessBookField` knows
  them — ahead of the sku rule, since "Mfg Product Code" contains
  "product code" — and the wizard offers them).
- `vendorKeys(item)` is the one key-set builder: SKU + `vendorSkus` when
  present (**exclusively** — no description guessing once columns exist),
  description-tail extraction only for items imported before the columns were
  captured. A shop-suffixed numeric code expands to its base
  ("589571E" ↔ "589571" — the team marks internal variants that way).
- Both the floor→trims lookup and the stock-twin swap key on `vendorKeys`.
- **Requires a one-time re-drop of each ERP stock export** so existing items
  pick up `vendorSkus`; until then the tail fallback applies.

Verified against the real sheet: 236/236 items carry codes; the Bark floor
resolves `MPB823`; order trim `589579` pairs with shop item `1518224`.

### Amendment 2026-07-23 (4) — the color-name stock tier + OneNose MDF fill

OneNose is Mannington's stairnose for the newer colors and must surface even
when the vendor book's `fits` doesn't list it. So the popup's list
(`mergeTrimOptions`) now has three parts:

1. the `fits`-derived trims, stock twins swapped in (as before);
2. **the stock color-name tier** (`stockTrimOptions`): untyped, trim-worded
   rows of the floor's own stock book whose " - " color phrase (≥2 words,
   trailing codes shed — "OneNose - Noble Oak Bark") appears whole in the
   floor item's description. Name resolution over one vendor's own book — the
   mortar convention — so the shelf shows regardless of the vendor sheet;
3. **the OneNose MDF fill companion**: when a OneNose is on the list, the
   shelf's "OneNose MDF Fill" item (matched by name, never a hardcoded SKU)
   joins it, chipped "installs with OneNose".

All three dedupe on `vendorKeys`. Verified on the real MANMI export with no
vendor book at all: 24/55 floors get shelf trims (20 with a OneNose), and the
Bark floor lists endcap + T-mold + multi-reducer + OneNose + MDF fill.

### Out of scope (this prototype)

- The mobile row sheet (`MobileRowSheet`) — same popup can mount there later.
- Auto-adding a default trim set on floor pick.
- Books whose sheets carry no `fits` relation (nothing to list — the button
  simply never shows). Backfilling `fits` for more vendors is an import-side
  task.

## Testing

`src/trims.test.js` (node --test): seeding from empty and existing areas,
insert-below placement, grouping after existing trim rows, qty-only updates
preserving hand-edited prices, remove-on-zero, floor-missing no-op.
UI proof: prototype screenshots (drawer row → popup → rows below the floor)
attached to the PR per the no-preview-no-merge rule.
