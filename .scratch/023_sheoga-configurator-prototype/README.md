# Sheoga vendor configurator — prototypes

**Status:** prototype for review · 2026-07-17
**Open:** `prototype.html` in a browser (fully standalone, no build).

Sheoga Hardwood sells **by description, not SKU** — species × grade × width ×
solid/engineered, plus texture/scrape, length runs, edge, sap and finishing
options, and a separate wood-vent & damper program. This folder prototypes a
popup configurator that builds that description, prices it live from the
vendor sheets, and drops the result onto a job as a product line.

## The two prototypes (both live in `prototype.html`)

| | Shape | For |
|---|---|---|
| **A — Option board** (recommended) | IKEA-configurator pattern: every option group on one card, live build + price on the right, no steps | The desk. Width/species chips carry their own live sell price, so flipping a customer between 5¼" and 6¼" or White Oak and Hickory is one click. |
| **B — Guided flow** | Nike-By-You pattern: one decision per screen, big targets, price pinned to the bottom bar | Phone at the counter / on site. Flooring line only (demos the interaction model). |

Shared by both: one data module + pricing engine; **the generated description
is the SKU** (it's what you read to Sheoga and what snapshots onto the job
line); **Saved options** tray for side-by-side comparison while a customer
goes back and forth (cheapest gets the ring, deltas vs the current build);
**Recently configured** auto-history; **Add to product line** preview showing
the exact Product-row payload.

Prototype A covers all five programs: unfinished & custom flooring, stocked
prefinished colors, herringbone/chevron, wood vents, loose dampers.

## Data — transcribed from the three sheets

- `Sheoga Pricing (Distributors) 2.1.25` — unfinished solid/engineered grid
  (9 species × Clear/Character × 2¼"–8¼", Live Sawn to 11¼"), texture adders
  (Old Mill +2.50, CW/VC/Sawcut/Bandsawn +1.50, Aged Brush +1.00), length runs
  (+5% … +30%), edge options, no-sap (Cherry +1.00 / Walnut +2.00), stocked
  prefinished grid, herringbone grids, custom-finishing sheet (+1.65 natural,
  +1.95/+2.85 established stain, T-1/2/3, small-order fees).
- `Stock_Vent_Pricing` (Feb 2022, scanned) — both species price groups
  (A: Cherry/Hickory/Beech/Red Oak · B: Hard Maple/White Oak/QR WO/Walnut),
  self-rim/flush standard sizes, flush-with-frame, cold-air returns, 3-D,
  cubed +10, prefinished +28.25, textured +8, frames $0.40/lineal inch.
- `DAMPER_COST` + damper tier sheet (1/9/23) — stocking (our cost, as a
  Keim stocking dealer), builder, retail tiers; +$5 attach on a vent.

All prices in the engine are **distributor cost**; the markup control
(default 40%) produces the sell price.

### Assumptions to confirm before production
1. Length upcharges (%) apply to the unfinished base incl. no-sap, before flat
   $/sf adders (sheet just says "Add 15%").
2. Small-order fees apply whenever a finish is selected; amortized into $/sf
   at the entered job size.
3. Cubed vents = same-size vent + $10 (allowed on standard + cold-air here).
4. Vent frame lineal inches = L + 2W per the sheet note.
5. Custom color match ($750) and non-stock prefinished colors are flagged
   "call Sheoga", not priced.

## Production path (proposed)

- `src/sheoga.js` — the data module + pure pricing engine (exactly the tables
  in the prototype's `<script>`), unit-testable. Sheet updates are a
  re-transcription of this one file (the vent sheet is a scan, so a mapped
  import à la ADR 0010 isn't available).
- `SheogaConfigurator` popup in App.jsx, opened from a product row (a
  "Configure" affordance next to the SKU box, like the grout-color popup) and
  from the Settings price-book area.
- **Snapshot rule (ADR 0003):** Add-to-line writes `type:'hardwood'` (vents:
  `qtyType:'count'`), description → `brandColor`, sell → `priceSqft`, and
  keeps the raw configuration on the row (e.g. `product.sheoga`) so
  "Reconfigure" reopens the popup pre-filled. Nothing reprices later.
- **Saved options** belong on the customer record (they're part of the
  back-and-forth on a job); **recents** are per-user (`app_data`).
- Markup default lives with the other pricing knobs (Settings → Price book);
  rows store retail per ADR 0018 — tiers stay a display lens.

## Files

- `prototype.html` — both prototypes, live engine
- `A1…A7-*.png` — option board: flooring default, configured + saved compare,
  full price grid, add-to-line, vents, herringbone, stocked prefinished
- `B1/B2-*.png` — guided phone flow: width step, review
- Mobbin pattern references: [IKEA product options](https://mobbin.com/screens/dd4caa6b-78d8-4792-91f9-c44232e9bf67),
  [Nike By You](https://mobbin.com/screens/1fbdc9b2-66d7-45c7-b42c-6e30d13e8be5)
