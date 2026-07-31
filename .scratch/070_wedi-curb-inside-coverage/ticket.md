# 070 — wedi configurator: "overall max" curb-inside sizing + wedi-coverage hatch

Status: done
Shipped: 2026-07-30 — engine (curbWidth/curbInsets/applyCurbInset +
benchWallShadowSf, kitFor panDims compose + cfg.maxIn), UI (the "Sizes are"
toggle, inset-aware solve, curb drawn inside in both views, iso coverage
green + 45° hatch).
Opened: 2026-07-30 (owner, spoken + screenshot)
Area: wedi configurator (issue 066)

## The asks (owner, transcribed)

1. **Curb inside the stated size (custom solver).** A 60×36 custom shower
   places a 36"-deep pan and the curb ADDS onto the front (~2" lean, ~4–4.5"
   full foam). For kits that reads right — pan + curb is the honest maximum.
   But the custom solver needs a switch: "36 is the MAX depth" — pull the
   curb into that 36" and re-fit everything, remembering the curb overlaps
   ½" onto the pan.
2. **Coverage legibility.** Hard to tell which surfaces carry wedi vs bare
   framing, especially on the transparent front walls (screenshot: framed
   bench against the clear wall). Rule: wedi runs down the wall until it
   hits an installer-FRAMED bench (the bench's own ½" wrap takes over), but
   runs all the way down BEHIND a 2" build-up or premade bench. Owner
   follow-up: covered wall faces read the same light green as the pans and
   benches, bare framing stays the dark tone, and a fine hatch rides the
   covered faces so the clear walls stay legible.

## Implementation notes

- Curb cross-sections (`curbWidth`): lean → 2", everything else → 4.5",
  `CURB_LAP` ½" onto the pan. TRANSCRIBED FROM THE OWNER'S WORDS — verify
  against the wedi price list when convenient.
- `curbInsets(dims, walls, curbKey)`: every FULLY open edge insets
  (width − lap); partially walled edges keep the curb in the ring (v1).
  `applyCurbInset` re-bases the reduced-room solve into the full footprint
  (pieces/drain offset past left/back insets, room = full dims, `inset`
  rides along). Walls, curb runs, and bench footprints keep figuring on the
  full room; kitFor subtracts the inset from the space benches/pan share
  (panDims) and carries `cfg.maxIn` for Reconfigure.
- UI: "Sizes are — Pan size | Max — curb inside" beside the size inputs
  (owner-picked placement). Wall toggles and the curb swap re-fit the
  option cards live without wiping the build; kit seeds reset to Pan size.
  Drawings draw an inset edge's curb INSIDE the room line at its real
  width, lapping the pan by the ½".
- Coverage: the face the viewer reads as "the wall" paints its covered
  region pan-green + fine 45° hatch (`#wedi-hatch` defs); the framed
  bench's framing shadow stays dark/clear. Same rule enters the math:
  `benchWallShadowSf` leaves kitFor's panelSf (sheets in wallSf mode,
  screws/sealant always). Not in v1: the panel-fit course layout still lays
  full walls (its sheet count ignores the shadow); plan-view wall bands
  keep the dark tone (coverage is the isometric's story).
