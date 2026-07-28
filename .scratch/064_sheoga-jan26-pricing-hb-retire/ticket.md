---
issue_type: Task
summary: Re-transcribe the Sheoga configurator from the 1/19/26 distributor
  price list and the new damper sheet, and hide the retired herringbone tab
  (custom quotes only — kept for saved rows and later repurposing).
status: done
labels: [ready-for-human]
---

# Sheoga Jan '26 pricing + herringbone tab retired

Requested 2026-07-28: "Attached is updated pricing for the sheoga configurator.
Also the company is retiring the herringbone to custom quotes only. Can we just
hide the herringbone tab for now. I would like to maybe repurpose it later."

Three sheets attached: Distributor Price List (Stocking) eff. 1/19/26,
Distributor Vent Pricing (Feb 2022 — same sheet already transcribed, prices
unchanged), Damper Pricing (undated, single cost column).

## What changed (all in src/sheoga.js, per its re-transcription doctrine)

- **Unfinished grid** — every species repriced (mostly a few cents *down* from
  the Feb '25 list). The 1/19/26 sheet prices every cell: engineered **2¼" is
  now offered**, at a short-plank premium above 3¼" (verified against the
  sheet's column x-positions), and **Beech runs the full 2¼–8¼** width run.
- **Live Sawn White Oak** — run is now **4¼"–11¼"** (4¼ and 10¼ are new);
  engineered stops at 9¼. `WIDTH_LABEL` gained 10¼".
- **Custom prefinishing** — Natural $1.70 (was 1.65), established stain
  $2.05 smooth / $3.15 deep-scrape (was 1.95/2.85), T-1/2/3 $3.35/$4.00/$4.20
  (was 3.05/3.65/3.85). Sample $750 and the $300/$600 small-order fees are
  unchanged.
- **Stocked prefinished** — rebuilt from the sheet's **green (STOCK/FAST TRACK)
  highlights**, extracted from the PDF's cell fills (text alone doesn't carry
  them; white cells are priced but non-stock). Both grades now span 2¼–6¼.
  Maple Frost and Red Oak Nutmeg fell out of stock; the sheet's new colors
  (Drift, Silk, Breeze, Camo, Dawn, Prestige, Mist) have no green cells, so
  they join `STAIN_COLORS` (the established-stain / vent pickers) but not
  `STOCKED`.
- **Dampers** — the new sheet is one distributor cost per size ($21.39–$24.82)
  with no builder/retail columns and **no 8×12**; `DAMPERS` is now a flat map,
  the vent tab's attach option and the damper tab follow.
- **Vents** — byte-identical to the transcribed Feb 2022 sheet; untouched.
  NOTE for the owner: the sheet's 3-D box note reads "Available in same sizes
  Add $13.00" while we charge cubed grilles +$10.00 (issue-023 transcription).
  Left at $10 — confirm which the shop quotes.

## Herringbone retired (`HB_RETIRED` in sheoga.js)

- Tab hidden from the configurator; tables, pricing and tests all kept.
- A saved hb row's **Reconfigure still opens** the tab (it shows only as the
  active tab) with a custom-quote banner.
- SKU search no longer routes "herringbone"/"chevron" to the tab — species
  words seed the floor tab instead.
- To un-retire (or repurpose): flip `HB_RETIRED` to false.

## Preview proof (harness at .scratch/023, updated for the retired workbook API)

- S1 — tab strip without Herringbone, new floor pricing
- S2 — dampers on the new single-cost sheet
- S3 — stocked tab, new lineup/prices
- S4 — full unfinished price grid (10¼" column)
- S5 — legacy hb row Reconfigure: tab + custom-quote banner
- S6 — "chevron red oak" query seeding the floor tab
