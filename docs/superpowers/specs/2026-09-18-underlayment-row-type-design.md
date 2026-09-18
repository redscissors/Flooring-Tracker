# Underlayment row type — design

**Date:** 2026-09-18 · **Status:** approved by owner in chat

## Problem

Marcus flagged the Schluter Ditra Heat membrane sheet on a Quick Price job
(9/18): "it would be nice if this showed coverage." The owner added SKU
1509781, the Kerdi membrane roll. Both books carry the coverage — the ERP
stock export reads `8.4sf/sh` and `323sf/rl` out of the description — but a
membrane is deliberately given no flooring type at import ("a membrane is no
floor", ADR 0029), a row with no type fails `fillsFlooring`, and the pick
lands it as a per-piece count line: coverage dropped, price per sheet, the
salesperson working out sheets by hand.

The owner's ask goes past showing the number: "like a carton of tile, where I
can input how much sf I want and it figures the amount needed", and it should
"work together with Underlayments in the materials tab" so the install mortar
comes along.

## Decision

A seventh product type, **`underlayment`** (label "Underlayment"), beside
tile / hardwood / vinyl / laminate / carpet / misc. A sheet- or roll-sold
membrane, underlayment or backer row with real coverage imports with this
type, so a pick lands it exactly like a carton of flooring: square feet in,
whole sheets or rolls out, price per sq ft derived from the sheet or roll
price, the print and order panel showing the coverage tag they already know
how to draw. The row can name its Materials-tab underlayment entry so that
entry's install materials (backer mortar, screws) compute off the row's own
square footage.

Nothing new is stored: `type` gains one allowed value; `cartonSf`,
`cartonUnit`, `qtyType: "sqft"` and `underlay.{product, install}` all exist
and keep their meaning.

### Import (`src/pricebook.js`)

- `floorTypeFromDescription` returns `"underlayment"` when the description
  names a membrane, underlayment, uncoupling mat or backer (word list:
  `membrane`, `underlayment`, `uncoupling`, `backer`, `backerboard`), checked
  before the vinyl/laminate/tile/wood words. It still runs only where it runs
  today: a coverage-bundling unit (SH/RL/CT…) with real `sfPerUnit`. An EA
  accessory (the Ditra Heat cable, "42.7 sf" in its name) is untouched.
- The Schluter EFT mapping never types its rows (ADR 0041). A Schluter EFT
  row whose unit bundles coverage and whose description names a membrane
  takes the same `"underlayment"` type — the one exception, gated on the same
  three facts, so KERDI/DITRA rolls and sheets land the same way from either
  book.
- Re-import: a changed type is an ordinary field diff. Rows already saved on
  jobs keep their snapshot (ADR 0003); see *Existing rows* below.

### Landing (`src/stock.js` `stockPatch`)

No change in code: with a type, `fillsFlooring` is true and the existing
carton path runs — `qtyType: "sqft"`, `priceSqft = price ÷ sfPerUnit`
(a $15.22 sheet at 8.4 sf lands $1.81/sf; the print shows the per-sheet price
beside it as it does for cartons), `cartonSf` = coverage per sell unit,
`cartonUnit` = the vendor's word through `bundleUnit` (SH, RL), `sizeText` =
the vendor size. Configurator kits (wedi, Schluter) build their lines as
`type: "misc"` directly and never pass through `stockPatch`, so a shower
kit's Kerdi lines stay count lines with the kit's own quantities.

### Quantity math

- **No waste** (owner): `wasteFor` returns 1 for an underlayment row, so
  sheets = `ceil(sq ft ÷ cartonSf)`. The exact figure shows beside the
  rounded count and `cartonManual` overrides, as on every carton row.
- **Not floor area**: `jobtotals` adds the row's money to `flooringPrice` but
  skips it in `totalSqft` / `orderedSqft` — the membrane covers the floor the
  tile above it already measured, so "180 SF measured, 194 ordered" on the
  print stays the floor's number. `printProduct.orderedSf` is per row and
  unchanged.
- Grout and mortar drawers stay tile-only. Add-on categories (ADR 0016)
  filter on `FLOOR_TYPES`, which does not include the new type, so their
  chips never show on an underlayment row.

### Install materials (the Materials-tab link)

On an underlayment row the drawer's Underlayment section becomes
**Install materials**: a select over every catalog underlayment (no
flooring-type filter — this is the row's identity, not compatibility) and the
existing install toggle. Choosing one sets `underlay.{checked: true, product,
install: true}`; `getUnderlayInstall` then runs unchanged off the row's own
square feet, merging a mortar line into the job's mortar totals and custom
items (screws, tape) into the underlayment column, exactly as under a tile
row. `getUnderlay` returns null for an underlayment row — the row *is* the
underlayment, so the catalog entry is never billed a second time.

Auto-link at pick: when a catalog underlayment carries the picked SKU in its
`sku` field, the pick fills `underlay.product` and turns install on. No match
leaves the section unchecked; the select is one click away.

`materialWarnings`: an underlayment row with a product chosen and install on
whose entry has no computable install items warns "install materials have no
coverage set", the same wording rule as today's warnings.

Trowels and other per-order tools are a follow-up (owner): they need a
fixed-quantity install item kind, which is its own Settings change.

### Existing rows — the switch chip

A row already saved as a count line (the two flagged rows and any like them)
gets a chip beside the price-book drift chip when its book item now lands as
an underlayment row: **"Book sells this by the SH — 8.4 sf · Switch to sq
ft"**. Clicking re-lands the row from the book through the normal pick patch
(`patchFor`), then:

- `qty` = typed count × coverage (5 sheets × 8.4 = 42 sq ft) so the order
  count is unchanged until the real footage is typed; blank count → blank.
- `sellUnit`, `cartonPc`, `cartonManual` cleared (count-line fields).
- The row's own name, note, freight opt-out and kit id are kept.

The chip reads the book item the row already fetches for drift (stock lookup
or the on-demand order item), so it costs no new request. It shows only while
`p.type === "misc"` and the book item's patch would land a non-misc type.
Nothing converts on its own (ADR 0003: snapshots never heal silently).

### Type picker, colours, print

- `TYPES`/`TLBL`/`TYPE_ACCENT` gain the entry; the picker's letter shortcut
  is "U". A new `--ft-type-underlayment` maps to a seventh moss ramp step
  (`--ned-data-7`) in each of the four theme blocks.
- The estimate prints "· Underlayment" beside the name and "N SH" / "N RL"
  in the quantity column, both through the existing type-label and carton
  paths. Order entry, order lines, freight and the Compare tab treat it as a
  square-foot carton row — no branch names the type.
- Quick auto-name falls back to "Underlayment" when a row has no name, via
  the existing `TLBL` fallback.

### Records

- ADR 0043 — underlayment is a product type: why a type rather than a
  sq-ft mode on Misc or a tile-row attachment, the no-waste and not-floor-area
  rules, the install-materials link, and the ADR 0029 amendment ("a membrane
  is underlayment, not no floor"). Indexed in `docs/adr/README.md`.
- `floortrack-data-model` skill: `Product.type` enum, the `underlay.*` fields'
  meaning on an underlayment row, the import rule.
- `src/CLAUDE.md` file map notes on uiconst / pricebook / stock / catalog.
- Issue `.scratch/144_underlayment-row-type/ticket.md` (Marcus's flag + the
  owner's 1509781), status done on merge.

## Testing

Node tests (`npm test`) at every layer, red first:

- `pricebook.test.js`: the stock export types 23031 (SH, 8.4 sf) and 1509781
  (RL, 323 sf) as underlayment; the EFT DITRA-HEAT roll and sheet likewise;
  the DITRA-HEAT cable (EA) stays untyped with "42.7 sf" in its name; a
  "membrane" row with no coverage stays untyped.
- `stock.test.js` / `interfacebook.test.js`: `stockPatch` on the sheet lands
  `type: "underlayment"`, `qtyType: "sqft"`, `priceSqft: "1.81"`,
  `cartonSf: "8.4"`, `cartonUnit: "SH"`.
- `catalog.test.js`: no waste; `getCarton` on 42 sq ft → 5 SH exact 5.00, on
  43 → 6 SH; `getUnderlay` null on the type; `getUnderlayInstall` computes
  the linked entry's mortar off the row's sq ft; `materialWarnings` case.
- `jobtotals.test.js`: money in, square feet out.
- `print.test.js`: `qtyText` "5 SH", `priceText` "$1.81/sf", coverage tag on
  the order row.
- A switch-chip helper (pure: count line + book item → patch) tested for the
  count × coverage conversion and the cleared fields.
- `model.test.js`: `normP` keeps the type.

UI proof before merge (non-negotiable 3): preview screenshots of the grid row
(coverage cell "8.4 SF/SH", sq ft in, "5 SH" out), the switch chip on a count
line, the Install materials drawer, and the printed estimate line.

## Out of scope

Trowels / fixed-quantity install items; a waste setting for the type; typing
EA-sold kits (heat cable) by their stated area; the wedi/Schluter
configurators' own membrane lines.
