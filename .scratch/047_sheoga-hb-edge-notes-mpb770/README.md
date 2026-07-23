# Sheoga notes/edge + MPB770 trims (2026-07-23)

Status: done

Three requests from Marcus (2026-07-23), one PR:

1. **"Sheoga configurator does not need to import text into notes."**
   `lineItems`/`multiWidthLineItems` pre-filled every row's note ("Sheoga
   special order — 5-10% overrun, no returns", fee/multi-width variants).
   The payloads no longer carry a `note` key at all — the note stays the
   salesperson's own field, and a note already typed on the row survives an
   Add (the fill no longer overwrites it).

2. **"Edge option for herringbone in the Sheoga configurator."**
   The herringbone tab now has the custom tab's Edge dropdown (Square /
   Micro bevel / Hand pillowed +$1.00 / Custom V-groove +$1.50), priced and
   described the same way (`calcHerringbone`); saved pre-edge configs read
   as Square and price unchanged. "Copy floor" carries the floor tab's edge
   (a stocked source copies as Micro bevel, its program's one edge).

3. **"MPB770 trims dont show in the trim box"** — two compounding defects,
   both visible in the attached MANMI export:
   - The export suffixes vinyl floors' Supplier/Mfg Product Code with an
     ERP "VN"/"VN1" marker (`MPB770VN1`, `APX040VN`) while the Mannington
     book's `fits` state the bare color code — so the floor's exact-key
     trims lookup never matched. `codeVariants` (trims.js) now expands a
     VN-marker code to its base alongside itself.
   - The MPB770 trims' descriptions put the catalog code BEFORE the color
     ("Reducer - 531996 Preservation Fossil") where other colors put it
     last ("Endcap - Noble Oak Bark EDM823"); `trimColorPhrase` only shed
     trailing code tokens, so the stock color-name tier missed them too.
     It now sheds code tokens from either end.

Preview (`preview.html` + `preview.jsx`, served by the vite dev server;
`shoot.mjs` takes the screenshots):

- `preview-1-hb-edge-dropdown.png` — the herringbone tab's Edge dropdown
- `preview-2-hb-edge-pillowed.png` — Hand pillowed picked: build card shows
  the +$1.00/sf edge row, description ends "· Hand pillowed"
- `preview-3-mpb770-trims.png` — the Trims popup over the real
  `mergeTrimOptions` fed rows transcribed from the attached MANMI.xlsx:
  all five Preservation Fossil trims list, sibling Relic stays out
