# Sheoga vents — scrape & stain options + Copy floor (2026-07-21)

Status: done

Request: "sheoga vents need scrap and stain color options, maybe have a copy
floor option."

Wood vents are almost always ordered to match the floor, but the vent tab's
Prefinished (+$28.25) and Textured (+$8.00) toggles were bare booleans — the
order description couldn't say *which* stain or *which* scrape, so the desk had
to remember to add it by hand.

## What changed

- **Scrape picker** — the Textured toggle now reveals a "Scrape / texture"
  dropdown (the flooring TEXTURES list minus Smooth). The vent sheet's texture
  charge is flat regardless of scrape, so the pick is order text only: the
  description reads `· Saw Cut` instead of `· Textured` (unspecified stays
  `· Textured`), matching how floor descriptions name their texture.
- **Stain color picker** — the Prefinished toggle reveals a stain dropdown
  (the program's standard colors + Custom… free text, same pattern as the
  floor tab). Also description-only: `· Prefinished Cattail stain`
  (`· Prefinished Natural` for the clear finish — Natural isn't a stain).
- **Copy floor** — a button at the top of the vent rail maps the last-open
  floor tab's configuration onto the vent: species (Maple → Hard Maple,
  Live Sawn → White Oak; a species with no vent twin leaves it alone),
  texture → scrape, and finish → prefinished + stain. Works from the
  unfinished/custom tab, the stocked tab (always prefinished; a
  "Cattail · Sawcut" color splits into stain + scrape), and herringbone
  (species only). `ventFromFloor` in sheoga.js is the pure mapper.

Old saved vent configs (no `scrape`/`stain` fields) price and describe exactly
as before; the existing desc assertions in sheoga.test.js still pass unchanged.

## Preview

Repurposed root harness (`preview.html` + `src/preview.jsx`) rendering the real
`SheogaConfigurator`, seeded with a scraped, stained Maple floor:

- `preview-1-floor-seed.png` — the seeded floor tab (Maple · Saw Cut ·
  Established Cattail).
- `preview-3-after-copy.png` / `preview-3-after-copy-options.png` — Wood vents
  after one click of **⤺ Copy floor**: species Hard Maple (re-priced to group
  B), stain Cattail, scrape Saw Cut; desc
  `4×12" Flush vent · Hard Maple · Prefinished Cattail stain · Saw Cut`.
- `preview-4-repicked.png` — pickers re-driven to Buckeye / Old Mill.
- `preview-5-custom-stain.png` — Custom… stain path
  (`· Prefinished Driftwood Gray stain · Old Mill`).
