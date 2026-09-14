---
issue_type: Feature
summary: "Copy for order entry" merges lines that share a SKU and sorts both
  lists by vendor group, behind a Merged & sorted / Sheet order switch —
  ERP One keeps duplicate pasted SKUs as separate lines.
status: done
labels: [ready-for-human]
---

# Order entry: merge same-SKU lines, sort by vendor group

Owner, 2026-09-14: "Right now when there is multiple of the same sku, order
entry does not merge the items together … It would also be nice if it could
organize the skus as well, like wedi pans together, curbs, building panels."
ERP One keeps two pasted lines with one SKU as two lines (owner's answer), so
the desk was combining them by hand.

Decisions (owner, same day): inline with a toggle rather than a before/after
popup; special-order lines merge only when everything matches; the proposed
sort order with wedi **building panels moved to right after curbs**; the
Sheet order view keeps faint area bands; reordering groups by hand is a later
piece ("we will work on a system to change the line order later" — a
team-shared group order in Settings was the recommendation).

## What changed

- `src/orderlines.js` (+ tests): `mergeOrderLines` — same SKU in any skuKeys
  spelling + same sell unit merge on the stock side; the special side also
  needs per-unit cost and sell to agree to the cent. A group that disagrees
  stays apart with `kept: "unit" | "price"` on every line. An assumed 1
  (orderQty) is absorbed by real quantities, never added; an all-assumed
  merge stays an assumed 1. No-SKU lines (Sheoga, freight) never merge.
  `lineGroup` / `groupOrderLines` — wedi by catalog group (pans, drains,
  curbs, building panels, extensions, niches, benches, sealant, fasteners,
  tapes, tools, collars, kits, S-Dry), Schluter by family off the marker's
  manufacturer code, Sheoga, book brands A–Z, Other items (hand-typed),
  Materials (print-sheet kind order), Freight; SKU breaks ties.
  `sheetBands` — the as-entered list banded by consecutive area.
- `src/orderentry.jsx`: the Merged & sorted / Sheet order segmented switch
  under the project name (opens Merged); group / area bands inside both
  lists; a moss `×N areas` pill on merged lines that opens the per-area
  breakdown; a quiet `same SKU · unit/price differs` note on kept-apart
  lines; footer counts ("N lines combined into M", "K kept apart"). Copies
  follow the visible view. Selection resets on a view switch.
- `src/print.js`: `orderEntryRow` carries the row's `wedi` / `schluter`
  marker; `matOrderRow` carries `kind`. `App.jsx`: materials rows carry
  `unitCode`; the panel is now a `React.lazy` chunk (orderlines.js pulls the
  wedi + Schluter catalogs for its grouping — ADR 0026 keeps them off boot).
- `src/copybtn.jsx`: `CopyBtn` moved out of orderentry.jsx so samples.jsx
  doesn't drag the lazy panel (and the catalogs) into the boot chunk.

## Preview proof

`order-entry-preview.html` over the new three-area fixture — `merged.png`
(opens on Merged & sorted) and `sheet.png` (the toggle flipped), taken by
`shot.mjs`.
