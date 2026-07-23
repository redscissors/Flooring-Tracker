# Sheoga herringbone — scrape & stain options + Copy floor (2026-07-23)

Status: done

Request: "Sheoga Configurator, I would like to have the same ability for the
herringbone as I do for the vents that I can copy the choices onto the
herringbone. The herringbone also needs to be able to choose scrape and stain
color / prefinished like the custom tab."

The herringbone tab priced species × construction × width × slat length ×
chevron only — there was no way to order a scraped or prefinished herringbone
floor from the popup, and (unlike vents) no "Copy floor" to match it to the
job's floor.

## What changed

- **Scrape + finishing on herringbone** — the tab gains the same Texture/scrape
  and Finishing dropdowns as the Unfinished & custom tab (`TEXTURES` /
  `FINISHES`), the prefinished stain-color + sheen block, and the color-match
  sample line. Pricing is the **same as normal unfinished/custom Sheoga
  flooring** (per the owner): the scrape and finish add their usual $/sf
  (e.g. Saw Cut +$1.50/sf cost, Established stain +$1.95/$2.85/sf, T-1/2/3
  +$3.05/$3.65/$3.85/sf), sheen is free, and the small-order / $750 sample
  fees import as their own at-cost lines. `calcHerringbone(h, sf)` now takes the
  job size (for the small-order fee) and folds these adders in.
- **Copy floor** — a button at the top of the herringbone rail (mirroring the
  vent tab) maps the last-open Unfinished & custom / Stocked tab's config onto
  the herringbone: species (Live Sawn → plain White Oak; a species with no
  herringbone twin is left alone), scrape, and prefinished finish + stain +
  sheen. `hbFromFloor` in `sheoga.js` is the pure mapper; the popup snaps the
  width into the new species' herringbone run.

Backward compatible: a herringbone config saved before this (no `tex`/`finish`
fields) reads as unfinished + smooth, so it prices and describes exactly as
before — the existing `sheoga.test.js` herringbone assertions pass unchanged.

## Tests

`src/sheoga.test.js` — new cases: `calcHerringbone` scrape/prefinished $/sf +
fee lines, a legacy config unchanged, and `hbFromFloor` from floor/stocked/hb.
Full `node --test src/*.test.js` green (717 tests).

## Preview

The real `SheogaConfigurator` rendered over local state (root `preview.html`
harness temporarily repurposed — `shoot.mjs`), seeded with a Maple · Saw Cut ·
Established Cattail floor:

- `preview-1-floor-seed.png` — the seeded Unfinished & custom tab (source).
- `preview-2-hb-before-copy.png` — Herringbone tab with the new Copy-floor
  banner and Texture/scrape + Finishing dropdowns (unfinished).
- `preview-3-after-copy.png` — after **⤺ Copy floor**: species Maple, Saw Cut,
  Prefinished — Established Cattail / 20-sheen; build card prices base $7.00/sf
  + Saw Cut +$1.50/sf + Established stain +$2.85/sf → cost $11.35/sf, with the
  $300 small-order fee (300 sf < 500) importing as its own line.
