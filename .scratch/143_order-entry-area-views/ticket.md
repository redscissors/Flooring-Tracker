---
issue_type: Feature
summary: "Copy for order entry" opens on an Area + vendor view (areas kept
  together, tile before trims, configurator wedi/Schluter lines grouped below)
  beside a Compact view (everything merged) and Sheet order — replacing the
  vendor-first Merged & sorted view.
status: done
labels: [ready-for-human]
---

# Order entry: Area + vendor / Compact / Sheet order views

Owner, 2026-09-17, after asking why a Schluter Jolly (23189) sat above its
Glazzio tile (1518929) in Merged & sorted: both rows fell into "Other items"
(no book brand label, no configurator flag) and the numeric SKU compare put
the smaller number first. Row type never entered the sort.

Decisions (owner, same day):

- Three views, **Area + vendor** the default: areas in sheet order, tile and
  flooring before trims and misc inside each, a SKU combining only within its
  own area; **only configurator-built wedi and Schluter lines** leave their
  area for the vendor bands beneath (a Jolly picked from a price book stays
  with its tile), combined across areas; then Materials and Freight.
- **Compact**: every same-SKU line combined across the whole job into one
  run, tile and flooring by SKU then trims by SKU, then Materials, Freight.
- **Sheet order** unchanged.
- The 2026-09-14 vendor-first "Merged & sorted" view is replaced — Compact
  and Area + vendor cover its two jobs between them. A "by area, tile then
  trims" view without the vendor pull-out was dropped as a near-duplicate of
  Sheet order.

## What changed

- `src/orderlines.js` (+ tests): `compactBands`, `areaVendorBands`; a
  `typeRank` (misc after everything else) ahead of the SKU compare;
  `mergeOrderLines(rows, scope)` salts the merged id so the same SKU merged in
  two areas of one list yields two distinct lines. `groupOrderLines` stays
  (the vendor/materials/freight bands under the areas).
- `src/orderentry.jsx`: the three-way switch, `area` default; bands carry
  their own `area` flag for the quiet area styling; copies follow the view.

## Preview proof

`shot.mjs` over the order-entry preview harness: `area.png` (default),
`compact.png`, `sheet.png`.
