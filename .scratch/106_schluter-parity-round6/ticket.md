Status: done

# Schluter parity round 6 — the issue-105 inventory verdicts

Owner verdicts on the parity ledger (2026-08-24): "Kits should price the kit
not just the pan … show Kerdi Membrane and Kerdi Board options … Curbless
Ramp should not be auto billed but an add on chip … Wedi's way for inputs …
[the DIFFERENT list] — Add … Still missing all the wall options in the
drawings that wedi offers." Plus mid-round: "the kerdi fix seems like it
should only be used with the tub kit."

## What landed

- **Kits rows price the FULL kit** (the wedi owner rule 2026-07-31):
  `kitTotals` builds each tray's shelf kit through the tier lens — the row's
  one number matches the build column on a click. A **Wall system seg**
  (KERDI over backer | KERDI-BOARD) heads the Kits tab — same `wallSys`
  state as the Custom form, so flipping it reprices every row in place and a
  kit pick carries the chosen system (`pickKit` preserves it). A separate
  membrane/board tab was rejected: it would duplicate the tray list to vary
  one dimension and the two copies would drift. Rows wear stock/SO tags only
  where they break the family pattern (the wedi issue-075 idiom).
- **Curb runs every open edge** — the "Turn into a curb" wedi rule, engine-
  deep: `openRuns` (schluter.js) computes the open perimeter spans (base
  walls anchored lo, xwalls at their end), cut corners adjacent to open runs
  turn ONE diagonal figured at its longest point (leg + CURB_W each way) and
  each touching run gives up the leg. `buildKit` bills `runs.need`;
  `schluterCurb` draws the SAME runs (bench spans subtract per edge), so a
  side wall turned off now bills and draws curb along its edge. The wall
  menu's base-wall action reads **"Turn into a curb"** on curbed builds,
  with a toast. Entry-only rooms are bit-identical to the old contract
  (pinned).
- **Per-wall faces** (the owner's screenshot ask — the wedi wall menu):
  Inside / Both sides / In + end seg in the wall menu, on base AND added
  walls. `faces` rides the walls/xwalls cfg rows into `wallArea` ("both"
  doubles, "in-end" adds the WALL_THICK strip), the Custom-tab rows read
  "· 2-side" / "· +end", and the drawings show the faces via schluterWalls.
  Marker carries faces; seedState restores them.
- **Ramp is an opt-in chip**, never auto-billed: `cfg.ramp` gates the line;
  "+ Ramp" chip on curbless builds (recessing the subfloor needs no part).
  Compare's derived curbless column carries no entry part — matching wedi's
  own no-entry-part house kit (comparekit test re-pinned).
- **KERDI-FIX left the standing recipe** (owner, mid-round): it rides the
  tub kit, not every shower — now a "+ KERDI-FIX" add-on chip. The
  approved-bill pins moved deliberately: 11 lines / $734.09 (was 12 /
  $759.75).
- **wedi inputs**: `NumIn` (commit on blur/Enter) moved to widgets.jsx and
  BOTH configurators mount it — every Schluter number field converted; the
  wall/bench menus now dismiss on outside CLICK (not mousedown) so a
  blur-committed value lands before the menu unmounts (the wedi rule).
  Per-keystroke solving had no real advantage — mid-typed values re-ranked
  candidates ("4" of "48").
- **The DIFFERENT batch**: wall/corner/drawing edits off the Kits tab bump
  to Custom with a toast (leaveKit — bench adds already did); room-size
  commits clear wall lengths that only tracked the kit (retuneWalls);
  Browse figurer gained **Add to build** (top-up over what the build
  already carries, with a toast); refused corner cuts explain themselves;
  Esc cancels placing mode; toast infra (.sch-toast) ports the wedi `say`.

## Proof

`shoot.mjs` (vite on :5199 + schluter-preview.html):
- `p1-kits-fullkit-membrane.png` — rows price the full kit ($734.09 row ==
  build column total), wall-system seg, exception-only tags, KERDI-FIX as a
  chip not a line
- `p2-kits-fullkit-board.png` — seg flipped: every row repriced in place
  ($734.09 → $908.52), the standing build re-billed board + fasteners
- `p3-wall-menu-faces-both.png` — faces seg, "2-SIDE" sf doubled (board
  ×3→×4), "Turn into a curb" in the menu, "Modified kit" toast + Custom move
- `p4-turn-into-curb-left-edge.png` — left wall off: curb bands run the left
  edge + entry in both views, bill re-figured 2× "cut to length end-to-end"
- `p5-curbless-ramp-chip-on.png` — TT kit: "✓ Ramp" chip lands the SO ramp
  line; unchecked builds carry no Curb line at all
- `p6-figurer-add-to-build.png` — figurer Add to build + toast (top-up added
  nothing the build already covered)

Tests: 1112 pass (new: openRuns spans/diags/legs, faces area, ramp opt-in,
re-pinned approved bill + compare curbless). `npm run build` clean.
