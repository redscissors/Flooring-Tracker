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

- Curb cross-sections (`curbWidth`): every curb notches ½" over the pan
  (`CURB_LAP`), so it ADDS width − ½. Standard/full-foam/AT: 4½" across —
  adds 4" (price list agrees, 5⅛ × 4½ H×W). Lean: 2" across — adds 1½"
  (36" shower → 34½" pan, drain 17¼" off the back). RESOLVED 2026-07-31:
  owner measured a physical lean curb at 2" across the top, matching the
  price list's 3½ × 2 H×W; `curbWidth` corrected from the earlier 2½".
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
