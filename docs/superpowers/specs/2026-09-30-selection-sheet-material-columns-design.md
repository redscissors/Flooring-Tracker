# Selection sheet — material columns + job order list (G3c) — design

**Date:** 2026-09-30 · **Status:** draft for owner review
· **Mockup (owner pick "G3c"):** `.scratch/mockups/selection-sheet-g3c-2026-09-30.html`
and its PDF `.scratch/mockups/selection-sheet-g3c-2026-09-30.pdf` (the N259 test job,
salesperson swapped for a placeholder). Earlier rounds: `.scratch/mockups/print-sheet-options-2026-09-30.html`.
· **Decision record:** ADR 0053 (install materials charge the rounded job order)
· **Builds on:** ADR 0006 (grout base companion, `ceil(kits / per)` across the job),
ADR 0016 (add-on material categories), ADR 0031 (quote options), ADR 0043
(underlayment product type), ADR 0018 (price tiers)

## Problem

On today's printed selection sheet (`EstimatePaper`, cards layout):

- Each product carries chips ("Grout 1 · SpectraLOCK PRO — Bright White") and the
  same materials appear again, priced, in the **Extras** box — a customer reads
  them as two charges.
- Nothing explains how a grout color kit relates to a grout base.
- Nothing says which items are special orders (and so can't be returned).
- The Extras box shows one quantity but charges for another: the quantity is
  the job's exact need rounded up once (7 bags), the price is every product's own
  rounded amount added up (8 bags). On N259 that is $179.82 charged for material
  that is never ordered (Prolite, Ditra, Antique White grout).

## Owner decisions (2026-09-30)

1. **Layout G3c, portrait.** Products on the left; one column per install material
   on the right, each cell sitting beside the product it goes with.
2. **Material columns: Grout · Mortar · Underlay.** Each cell names the actual item
   for that product (so two tiles in one area can use different grouts, mortars or
   underlayments). Caulk is **not** a column — it prints only in the list below; the
   grout cell is the reference.
3. Material cells show the **exact** amount the product needs (e.g. `1.6 kits`), **no
   price**. Cells are sized so the item fits in three lines: name · color · joint +
   amount.
4. A **job order list** below the products prints each material once — Needed
   (exact, added up) · Order (rounded up once) · Each · Total — with the job totals.
5. **Charge the rounded job order** (ADR 0053): a material's charge is its job order ×
   unit price, everywhere the job total is computed — not the sum of each product's
   own rounded amount.
6. Products: sizes tightened (`12"×24"`, no spaces around ×), tile **thickness
   dropped**, **SF/ct kept**; price shows **$/sf and $/ct**.
7. Lines with no install materials (trim, wedi parts, accessories) print on **one
   line** across the empty material columns.
8. Special order: a **◆** beside special-order items and one line —
   "◆ Special order — special-order items can't be returned." No confirm-color text,
   no initials or signature.
9. The **estimated total** prints the same size as the other totals (bold, rule above).
10. The grout base line in the list does not say what it's for.

## Layout

Header (masthead + people row) is unchanged from the current cards layout.

### Product grid

One CSS grid per row, columns left → right:

| Column | Width | Content |
|---|---|---|
| ◆ gutter | 10px | `◆` when the line is a special order |
| Product | flexible | name `— type` (bold); spec line; note line (italic) when the row has a note |
| Qty | 38px | carton/sheet/piece count; ordered SF under it (area lines) |
| Price | 60px | `$10.92/sf` over `$127.00/ct` (area lines); `$22.50/ea` (count lines) |
| Total | 58px | line total, bold |
| Grout | 88px | material cell (below) |
| Mortar | 82px | material cell |
| Underlay | 100px | material cell |
| Other | 90px | add-on categories (ADR 0016) — only when the job uses one |

- **A material column prints only if some line on the sheet uses it** (N252 shows only
  Grout; an LVP-only job shows only Underlay; a job with no install materials shows
  none, and the product column takes the width).
- Header labels: `Grout`, `Mortar`, `Underlay` (the app's own short label — "Underlayment"
  doesn't fit the column; it covers Tile Backer and Underlayment kinds alike), `Other`.

**Spec line** (new helper `printSpec(p, c)` in `print.js`):
`{size} · {coverage} · SKU {sku}` where
- size: tile → `L"×W"` (or `sizeText` with spaces around `×`/`x` removed); **no
  thickness**. Other types → `sizeText`, same tightening (`48"×60"×1/2"`).
- coverage: `13.6 SF/ct` (carton), `0.9 SF/sh` (sheet), `20 PC/CT` (piece carton) —
  from `printProduct`'s `C` / `PC`, unit code lower-cased after `SF/`.
- Joint width is **not** on the spec line — it lives in the grout cell.

**Qty / Price** reuse `printProduct`: `C.order` + `C.unit` (`ct`, `sh`), `orderedSf`;
price `priceSqft` per `priceUnit` plus the bundle price `C.sf × priceSqft` per `C.unit`;
count lines use the existing `priceText` / `qtyText`.

**One-line rows (decision 7).** A line with nothing in any printed material column
renders as: name (bold) + spec (muted) inline in the Product cell, Qty/Price/Total on one
line, and one empty tinted cell spanning the material columns. A note still gets its own
line under it.

**Area band:** area label (`areaPrintLabel`) left, `flooring $X` right (full pricing only).
Bands stick to their first row (`break-after: avoid`); rows never split (`break-inside: avoid`).

### Material cell

One cell per (line, column). Each item in it:

```
SpectraLOCK PRO          ← product name, bold (may wrap)
Bright White             ← color (grout only)
1/8"          1.6 kits   ← joint (grout only) · exact amount, right-aligned, bold
```

Mortar / Underlay / Other: name (≤ 2 lines) then the amount right-aligned.

- **Grout** — the row's grout (`p.grout`, from `printProduct` mats kind `Grout`): product,
  color, joint, exact kits. Caulk is not shown here (decision 2).
- **Mortar** — the row's mortar plus any mortar that is an underlayment install material
  (`IN` kind `mortar`), each as its own item.
- **Underlay** — the row's underlayment/backer (kind `Tile Backer` / `Underlayment`).
  Non-mortar install materials (tape, fasteners — kind `Install`) print only in the list.
- **Other** — each add-on category item: small category label, name, amount.
- **Amount** = the mat's `exact`, shown with one decimal and the unit word
  (`1.6 kits`, `0.8 rolls`, `2.7 bags`). A manual override prints its fixed quantity.
  When the amount can't be computed yet (no footage / thickness) the cell names the item
  and prints `—` for the amount (today's print shows the chip with a blank count).
- **◆** before the name when the item is a special-order material (`isSpecialMat`, e.g. a
  grout color from an order-book source).

Text: cells 7.6px, names bold; product name 10px; spec 8.4px.

### Job order list

Replaces the Extras box. Full-width table under the products:

| Kind | Item · SKU | Needed | Order | Each | Total |
|---|---|---|---|---|---|

- Groups, in this order, kind label printed on each group's first row only:
  **Grout color**, **Grout base**, **Caulk**, **Mortar**, **Underlay**, **Install**
  (underlayment install items), each add-on category by name, **Freight**.
- **Needed** = the job's exact amount (sum of the lines' `exact`), one decimal. Blank
  for grout bases (they derive from kit counts, ADR 0006), freight, and caulk (a count).
- **Order** = `ceilQty(needed)` (today's `printMatList` / `gList` order). Bases keep
  `ceil(kits / per)`.
- **Total** = Order × Each (ADR 0053). Subtotal row: "Install materials subtotal".
- Grout base item text: its name only (decision 10).
- The list may break across a page between rows; a group's label row stays with its
  next row.

### Totals and footer

Right-aligned, all the same size:

```
Flooring & trim        $19,463.85
Install materials       $1,529.28
Freight                    $79.00   ← only when the job has vendor freight
Estimated total        $20,993.13   ← bold, 1.5px rule above
Includes material waste (tile 10%, other flooring 5%)
```

Left of the totals, only when some ◆ printed:
`◆ Special order — special-order items can't be returned.`

## Special order

Uses the existing classifiers, no new data:
- product lines: `isSpecialOrder(p, stockBookIds, stockSkus)` (orderentry.js);
- material lines: `isSpecialMat(m, stockBookIds)`.

`EstimatePaper` gains two props, `stockBookIds` and `stockSkus`, passed from App.jsx
(both already built there for order entry). Until the stock cache is ready
(`stockSkus` null) the hand-entered-SKU rule is skipped, as it is in order entry.

## Pricing modes (`sel.printPricing`)

| Mode | Product grid | Material cells | Job list | Totals |
|---|---|---|---|---|
| full | Qty · Price · Total | item + exact amount | Needed · Order · Each · Total | shown |
| unit | Price only | item, no amount | Each only | hidden |
| none | no money columns; Qty stays | item, no amount | Item · SKU only | hidden |

The area band's `flooring $X` prints in full mode only. The tier tag stays in the
masthead as today (ADR 0018).

## Quote options (ADR 0031)

- Shared areas render in the grid as above; the job list under them is the **shared**
  bucket's list ("Install materials — shared areas").
- Each option keeps its colored header band; its lines use the same grid; the option's
  own materials print as a compact job list inside the option box (replacing
  "Materials for this option"); the option total row and the bottom option comparison
  stay as today.
- Rounding happens once **per bucket** (shared, each option) — the same buckets the
  totals already use.

## Rounding change (ADR 0053)

- `jobtotals.js`: `groutCost`, `mortarCost`, `underlayCost` become the sums of the
  aggregated lists' costs (`gList`/`mList`/`uList`, each `order × price`, where order =
  `ceilQty(sum of exact)`), instead of accumulating each row's `G.order × G.price`.
  Caulk (manual counts), grout base (`bList`) and add-ons (`attachedList`) already
  aggregate this way; freight is unchanged.
- `printMatList`: each row's `cost` = `order × price` (not the sum of per-line costs).
- Everything reading these totals moves with them — the screen totals, the print, quote
  option buckets. Order entry already keys the job order, so it doesn't change.
- Quote totals **drop** on jobs where two or more lines share a material (N259:
  −$179.82). Saved versions keep the totals they were saved with.
- The plan must check the special-order margin and any other consumer of
  per-line material cost for assumptions about the old sum.

## Rollout

- New renderer `renderEstimatePaperColumns` in `EstimatePrint.jsx`, selected by
  `ESTIMATE_PRINT_LAYOUT = "columns"` (new default). The cards renderer stays intact
  behind the flag as the fallback, like `classic` today.
- The on-screen Print preview tab renders the same component, so preview and print
  can't drift.
- No persisted shape changes, no SQL.

## Out of scope

- The duplicate caulk SKU in the catalog (SpectraLOCK PRO and PermaColor Select
  Bright White caulk both `1519070`) — a Settings data fix for the owner.
- Landscape layout, phone print, the Compare print, CSV export.
- New lead-time or stock data (special order uses existing classifiers only).

## Testing

- **Unit** (`print.test.js`): `printSpec` (tile thickness dropped, `×` spacing, SF/ct /
  SF/sh / PC/CT); column assignment (grout / mortar incl. install mortar / underlay /
  other; caulk excluded); hidden empty columns; one-line rule; job-list needed = sum of
  exact, order = `ceilQty`, total = order × each; pricing-mode column sets.
- **Unit** (`jobtotals.test.js`): two rows sharing a mortar with exacts 2.6 + 0.4 → cost
  `3 × price` (was `4 × price`); caulk, base, add-ons unchanged; existing goldens
  updated only where two rows share a material.
- **Preview proof** (non-negotiable 3): the real App over the fake Supabase harness
  (pattern of `.scratch/161_grout-base-options/`) with an N259-shaped fixture —
  screenshots of the Print preview in full, unit and none modes, an options job, and a
  Chromium print-to-PDF page count.
