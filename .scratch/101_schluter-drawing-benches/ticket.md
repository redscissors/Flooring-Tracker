Status: done

# Schluter wedi-parity round 3 — benches on the drawing, wall menus, add-on pickers

Owner feedback (2026-08-22, voice): the Schluter add-ons should work like the
wedi configurator — chips that open pickers, "instead of it just being a giant
thing"; "Framed bench + ½″ wrap … shouldn't that just be something that is
selected out of the drawing?"; the drawing can't edit wall dimensions like
wedi's; "it's missing the entire bench function."

## What landed

- **Benches moved onto the drawing** (the wedi issue-069 idiom, via the shared
  showerdraw zone machinery the Schluter popup had never wired): hover the
  tray along a wall or into a corner → zone preview; click → the bench menu —
  2″ KERDI-BOARD build-up, framed + ½″ wrap (wall zones), or the premade SB
  benches read live off the registry (corner zones list the TA triangles, wall
  zones the RA rectangles — dims derived from the KBSB SKU code). An existing
  bench's menu edits size/build and Removes. The two bench chips left the
  Add-ons group.
- **Engine benches** (`cfg.benches`, schluter.js): normBench/benchTrayRoom/
  cfgBenches — decision 4's bill per bench (framed → ½″ wrap board; site → 2×
  2″ board; premade → its own line). A FRAMED bench shrinks the room
  trayCandidates fits (Schluter's analog of wedi's smaller-pan fork: trays
  CUT, so the ranking re-runs for the clear space), the drain pin shifts with
  the reduced region, the tray line + cut list say "stops at the framed bench
  face", and the curb butts a framed bench that reaches the entry
  (schluterCurb spans). Legacy `cfg.bench` markers reopen as one back-wall
  bench — old rows keep their bill.
- **Wall menu on the drawing**: right-click a wall band (plan or isometric) —
  size × height writes into the same walls/xwalls rows the Custom tab edits;
  added walls get the End seg + "Both ends" mirror + Remove; base walls get
  Turn off. No faces seg — the membrane/board fork is whole-shower.
- **Add-on chips open pickers**: the niches collapse to ONE "+ Niche" chip
  whose picker lists every SN/SNLT variant (stock-tinted, stock-only narrowed
  unless nothing is stocked); single-variant extras stay direct chips.

## Proof

shoot.mjs (this dir): p1 niche picker · p2 bench menu on a back-wall zone ·
p3 framed bench — offset tray piece, wrap line, re-rank note · p4 bench edit
menu · p5 corner premade (KBSB410TA) · p6 wall menu. Tests: schluter.test.js
+ schluterdraw.test.js bench suites; 1095 pass.
