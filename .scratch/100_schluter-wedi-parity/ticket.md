Status: done

Schluter configurator — the wedi-parity round (owner feedback, 2026-08-21):
"Wedi kits tab is sorted by type and you can click through them without it
jumping to the custom tab right away. Also can we do the add ons like we do
the wedi config … there is not a bench option like there is with wedi … no
way to add wall like the wedi config. clicking on the wall or otherwise …
no way to add a drain location like in wedi."

Five gaps between the new Schluter popup and the wedi one it siblings:

## Changes

1. **Kits tab grouped by type, click stays put.** Trays render under family
   headers (Point drain — T / Curbless — TT / Offset — TS / Linear — LTS),
   each sorted smallest side then longest with the small side leading the
   row label (the wedi issue-075 idiom). `pickKit` no longer switches to the
   Custom tab: the clicked row highlights (`.kitrow.on`), the build column
   fills in place, and picking a TT tray sets the entry curbless (the TT
   line is the curbless play). The pick also stamps `pick = sku` so the
   highlighted row is exactly the candidate that built.

2. **Add-ons on the build column (the wedi idiom).** The extras chips
   (niches, premade SB benches, corner kits) and both site-built bench
   forms moved off the Custom tab into an Add-ons group at the build
   column's foot — dashed `addchip`s with ✓/+ leads — so a shelf-kit pick
   gets its niches and benches without leaving the Kits tab. Stock-only
   still disables special-order chips.

3. **Bench option in the kit flow** — covered by (2): framed + ½″ wrap and
   2″ build-up set `cfg.bench` (engine bills them, decision 4), premades
   toggle a manual line.

4. **Add a wall, clicking the drawing or otherwise.** The Walls group grows
   wedi-style extra-wall rows (`cfg.xwalls`: edge + which end it returns
   from, length × height, ×-remove, end-flip on the name button) plus a
   "+ Add wall" chip that arms placing mode — TopDown gets `placing` +
   `onEdge`, and which HALF of the edge you click picks the end (the wedi
   wall-is-a-run rule). Engine: `wallArea` counts xwalls; an entry wall
   narrows the curb to the opening (`entryOpening`) — the bill's curb is
   picked and cut to the opening, a fully-walled entry drops the curb line;
   `schluterWalls`/`schluterCurb` draw the runs and the shortened curb in
   both views.

5. **Drain location like wedi.** The Drain group gets the wedi
   "from left × back" pin inputs (disabled on linear — the channel lives at
   the back wall). The tray's drain is MOULDED, so a pin never moves it on
   the tray: `trayCandidates` splits the total cut between the sides
   (cutL/cutB vs the far edges) to land the moulded drain as close to the
   pin as the tray allows, carries dx/dy/miss, and pinned rooms rank by
   miss before cut size — the owner's meet-an-existing-waste-line case, and
   a bigger tray whose cut reaches the pin now outranks an exact tray that
   can't. Option cards say "lands N″ off the pin", the cut list says which
   sides the saw takes, the drawings put the drain at the achieved spot,
   and an unreachable pin warns instead of silently centring.

The saved `product.schluter` marker cfg carries `xwalls`/`drainX`/`drainY`
(normP passes the marker through opaque; seedState restores them), so
Reconfigure reopens the room walls-and-pin intact. Any of the three flips
the marker mode to "custom".

## Proof

`shoot.mjs` (vite on :5199 + schluter-preview.html):
- `p1-kits-grouped-stay.png` — grouped families, clicked row highlighted,
  build filled, still on Kits
- `p2-buildcol-addons-bench.png` — niche + 2″ build-up toggled from the
  Kits tab, lines under Extras
- `p3-drain-pin.png` — 50×38 pinned at 20″: cards say the cut split lands
  the pin, drawing reads "point drain @ 20″, 19″"
- `p4-add-wall-click.png` — placing click lands an Entry-left wall row,
  both drawings draw it, curb re-picked "cut to the 26″ entry opening"

Tests: schluter.test.js (xwalls sf, entry-opening curb, fully-walled entry,
entryOpening clamp, pin split/clamp/ranking, linear ignores pin) and
schluterdraw.test.js (xwalls dWalls, opening curb segs, pinned drain draw +
warnings). 1075 pass; vite build clean.

## Round 2 (owner screenshot of the wedi form, 2026-08-21)

"We are missing features shown in this attachment" — the wedi custom-shower
form. Closed in the same issue:

- **Any** drain preference: every tray competes; the PICKED tray decides
  what gets billed and drawn (buildKit/schluterDiag key on cand.tray.drain).
  Under a pin, a linear tray scores against its fixed channel run.
- **Sizes are — Tray size | Max — curb inside** + **Tile thickness**
  (fraction-parsing): the entry curb (4½") plus the tile on its outer face
  comes inside the stated depth and the tray gives it up. Curbed-only, the
  wedi rule; marker keeps effective dims + maxIn/tileT, seedState recovers
  the stated depth.
- **Editable wall lengths** (blank = follows the room) + **Default height**
  box seeding every wall's placeholder.
- **⇄ flip**: w↔d, the drain pin follows, typed wall lengths re-auto.
- **✂ Corner cuts**: "Cut open corners" chip + corner clicks on the
  drawing (schluterOpenCorners gates — a corner boxed by two walls can't
  cut; stale cuts behind re-walled corners drop silently). 12″ 45° legs;
  the curb turns a cut front corner diagonally (drawing diags + the bill's
  curb need grows by the diagonal extra). Cut-list lines per corner.
- NOT ported: **Pan against Left/Right** — wedi places a smaller pan +
  extensions, so the anchor matters; a Schluter tray is cut to the whole
  room and the drain pin already decides which sides the saw takes.

Proof: `shoot2.mjs` → `p5-any-max-tile.png` (48×66 stated → 48×61⅛ tray,
Any + 3/8″ tile, wall autos follow), `p6-corner-cuts.png` (both front
corners cut: chamfered tray + diagonal curb in both views, 2× curb "turns
2 cut corners diagonally", cut-list lines), `p7-flip.png` (pin carried
through the flip). Tests: 1082 pass (7 new engine/draw cases); build clean.
