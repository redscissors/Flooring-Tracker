# Four fixes — grout chip, print joint, ERP noise words, plain SKU field (2026-07-22)

Status: done

Request (Marcus, 7/21–7/22):
1. "small color chip in the grout area does not show the correct color, needs to
   just be removed"
2. "move the grout joint width in the print screen from the bottom extras to the
   puck with the grout it was chosen with"
3. "Nominal and new package dont need to show in descriptions"
4. "sku field should not be searchable"

## What changed

1. **Grout color chip removed** — the little round swatch next to the grout
   color dropdown (and on the "matching caulk" line and the collapsed materials
   strip) was a hardcoded tan (`#C9B79D`) whatever color was picked; it never
   reflected the real grout color. All four instances are gone (desktop
   `App.jsx` ×3, `mobile.jsx` ×1). The color name text stays.

2. **Joint width on the grout puck** (`EstimatePrint.jsx`, cards layout) — the
   grout chip under a product now reads
   `Grout 2 · PermaColor Select — Silverado · 1/8" joint`, and the bottom
   Extras block's grout row no longer repeats the joint (its detail line kept
   only the SKU). This is also more correct: two tiles with different joints
   aggregate into one Extras row, which could only show one of the joints —
   the per-product puck shows each tile's own. The classic layout and the
   on-screen order summary already showed the joint with the grout line and
   are unchanged.

3. **ERP noise words dropped from descriptions** (`orderbook.js`
   `normOrderItem`) — `NOMINAL` and `NEW PACKAGE`/`NEW PACKAGING` are stock-
   keeping words from the ERP exports that mean nothing on a selection. They
   are stripped from the item description at the one point both the import
   parse and the DB-row load pass through, so search hits, row snapshots, and
   labels all read clean — including items already in the database, with no
   re-import and no data migration (the DB rows are untouched; rows clean up
   in memory on load). Word-boundary matched, so "Phenominally Blue"
   survives; a parenthesized `(Nominal)` goes whole. Already-saved product
   rows keep their snapshotted `brandColor` text, as always (ADR 0003).

4. **SKU field is a plain field** — the grid row's SKU cell was a full search
   picker (typing popped a results panel); it is now a plain typeable input.
   Searching lives where it already was: the empty-row omni search and the
   Product/color cell (desktop). The mobile row sheet's SKU field likewise
   becomes a plain input; the "Search the price book" button on a blank row
   stays the mobile search entry. The now-unused `SkuPicker` component was
   deleted.

## Proof

`proof-estimate-and-descriptions.png` — the **real `EstimatePaper`** rendered
with a sample job (built via `proof-vite.config.mjs` + `proof-entry.jsx`,
screenshotted headless): the tile's grout puck carries the joint, Extras
doesn't; plus a live `normOrderItem` before→after description table.

Tests: `node --test src/*.test.js` — 681 pass (new: normOrderItem noise-word
cases). Production build clean.
