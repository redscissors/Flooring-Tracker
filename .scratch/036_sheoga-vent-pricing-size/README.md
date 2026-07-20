# Sheoga wood vents — pricing not carried, size not in the size field

Reported 2026-07-20: a wood vent added from the Sheoga configurator landed on
the job with no pricing carried through and its size buried in the description
instead of the row's size field.

## Root causes

1. **Size** — `lineItems()` (sheoga.js) built per-each lines (vents, dampers)
   with `sizeText: ""` and the size embedded in `brandColor`. Fixed by giving
   `calcVent`/`calcDamper` the same `size` + `rest` split the herringbone build
   already had; the payload now snapshots `sizeText: '4×12"'` and the
   description drops the leading size. The ERP order description is unchanged —
   `orderDescription` already joins `sizePlain` before the name.
2. **Pricing** — every line-total site in App.jsx priced non-misc rows as
   `sqft × priceSqft` with `sqft = 0` for a count-quantity row, so a vent
   (type `hardwood`, `qtyType "count"`) totaled $0 in the grid, mobile cards,
   estimate totals, print, order-entry cost/sell, and the special-order margin.
   Fixed with one shared `lineTotal(p, C, PC, unit)` helper: misc = pieces ×
   each, carton-sold = whole-carton footage, otherwise the entered qty — which
   on a count row is the count itself. Applies to any row toggled to EA, not
   just Sheoga lines.

## Preview

`preview.png` — the repurposed root harness (`preview.html` + `src/preview.jsx`)
rendering real `lineItems()` payloads: the grid-row strip (size column filled,
line totals billing qty × each) and the real `OrderEntryPanel` (size in the
item line, per-PC cost/sell, fitted description keeps the size).
