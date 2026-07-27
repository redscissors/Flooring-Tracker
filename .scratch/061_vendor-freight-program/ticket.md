---
issue_type: Feature
summary: Glazzio charges freight on special orders and nothing in the app added
  it. A vendor freight program now lives on the book, jobs opt in per row, and
  the charge is figured once per order.
status: done
labels: [ready-for-human]
---

# Vendor freight on special orders (Glazzio, Ohio)

Requested 2026-07-27 with Glazzio's `NEW_CS_Shipping_Program_2026_v3.pdf`:
"Glazzio has freight… We only need to know the freight to Ohio. I would like
that if special order Glazzio is ordered that freight would be added as well.
Maybe a checkmark is added to the extra materials chip below it… Also the
freight costs can change down the road. Should this just act as a price sheet?"

Decisions and design rationale: **ADR 0030**. This file is the vendor sheet
transcription and the preview proof.

## The sheet, read down the Ohio column

Glazzio's 2026 shipping program. Ohio (`OH`) appears in the **$79/pallet** band
of *both* pallet tables — Large Format (excluding Harmonic) and Harmonic 12x24 &
Arvora LVT — so for this destination the two tables collapse into one rate.

| Rule | Ohio |
|---|---|
| Small format | $0.99/sqft, minimum **$14.85/order** |
| Small format, once the charge reaches $149 | flat-rate pallet program, **$149/pallet** |
| Large format (incl. Harmonic 12x24, Arvora LVT) | **$79/pallet** |
| Tile trims — borders, chair rails, mouldings | $0.33/piece, $14.85 minimum |
| Arvora LVT trims | $40/tube (T-mold & reducer max 17 pc/tube; stair nose max 13 pc/tube) |
| Residential — UPS/FedEx | $3.50/box |
| Residential — LTL | $50/delivery |
| Lift gate | $50/delivery |

The break-even between the per-foot rate and the pallet program is ~150.5 sqft
($149 ÷ $0.99).

**Not in the sheet:** how many square feet a pallet holds. The shop supplied
**496 sq ft**; it is an editable field on the freight card, not a constant.

**Left out on purpose** (both additive later): the Arvora LVT trim tube rate —
the shop doesn't price Glazzio LVT — and the residential/lift-gate accessorials,
since everything ships to the shop, a commercial address.

**Confirmed by the owner (7/27), and what the app does:** a **mixed** order pays
each table's minimum — the small-format $14.85 and the trim $14.85 can both
floor on one order — while an order that is *all* small-format tile pays the
minimum **once**. And a small large-format order does pay the **full $79**: one
pallet is the floor.

## What shipped

- **`src/freight.js`** — the whole rule set, pure and unit-tested
  (`freight.test.js`, 14 tests written against the real Ohio numbers):
  `normFreight` (the book's program), `freightBasis` (which table a row ships
  on), `freightTally` (ordered footage + pieces per book, opted-in rows only),
  `freightParts` / `freightList` (the charge), and the render adapters
  `freightPrintRows` / `freightOrderRows`.
- **`src/freightui.jsx`** — the drawer row and the header master switch, split
  out as presentation so the preview harness mounts the real components.
- **Price book → the book page** — a Freight card beside the markup editor, with
  a worked example that moves as you type a rate. Switching a blank program on
  fills in the Ohio rates above (`FREIGHT_SEED`) instead of nine empty boxes; the
  card says they're Glazzio's numbers until one is edited.
- **The job** — freight lands in the materials estimate, the order summary, the
  grand total, the printed estimate's extras band, the printed order sheet, and
  the order-entry panel's Special order section.

## Preview proof

| | |
|---|---|
| `preview-drawer.png` | the Freight card (its own heading, under Estimate shows) + the drawer row on three Glazzio products — one charge, $256.01 |
| `preview-drawer-waived.png` | the mosaic row unchecked: 84 sf leaves the shipment, $256.01 → $172.85 |
| `preview-card.png` | the book's freight program, with the worked example |
| `preview-order-entry.png` | freight filed with the special orders, by description, cost = sell |
| `preview-print.png` | the printed estimate's Freight group and extras subtotal |

Job in the harness: 620 sf of 12×24 (large format → 2 pallets, $158) + 84 sf of
mosaic (small format → $83.16) + 24 chair-rail pieces ($7.92, floored to the
$14.85 minimum) = **$256.01**. Every figure is computed by `freight.js`; the
harness types none of them.

Reproduce: `npm run dev` and open `/preview.html` (`#order` for the panel).
