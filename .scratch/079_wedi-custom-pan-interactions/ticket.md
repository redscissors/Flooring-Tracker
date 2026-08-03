# 079 — wedi Custom shower: the toggles move the drawing, the cards flow, the walls move in

Status: done (2026-08-03)
Opened: 2026-08-03 (owner)
Area: wedi configurator (issue 066)

## The ask (owner)

> When Selecting a kit in the wedi configurator and moveing to custom. When you
> click pan size or max curb inside I want it to make changes to te drawing and
> not have to choose a pan below or make a change to the shower size first.
>
> Also the custom shower pans could scroll down and be flow accoridign to with
> of the window
>
> ALso this should be in the wall section of the custom shower wab and not in
> the build coulum  *(screenshot of the build column's WALLS block)*
>
> The wall in the top down drawing seems to be a bit short  *(crop of a wall
> band ending beside a curb that runs past it)*

Four things, all on the Custom shower tab.

## 1 — "Sizes are" moves the drawing on the click

A kit clicked on the Kits tab lands as a build with a **pan but no picked
option card** — that is by design (the cards sit unselected so the build column
keeps the kit). Every re-fit path was written `if (option) { … }`, so on the
Custom shower tab the "Pan size | Max — curb inside" toggle re-solved the cards
and then changed nothing you could see. The drawing only moved once you clicked
a card below or retyped the room, which is what the owner hit.

`refit(results)` replaces those three copies of the same three lines. It adopts
the card carrying the pan already on screen (`res.find(x => x.pan.key ===
panKey)`, falling back to the best card), and it works with or without a card
already picked — the pan is the answer either way. It stays a **re-fit**, not a
fresh start: benches, walls, add-ons, overrides and manual lines are all left
standing, exactly as the 078 flip did.

Used by the "Sizes are" toggle and by the max-mode inset watcher, so the tile
thickness, the curb pick and a wall change all move the drawing on the change
too. An empty solve still clears a card that was picked; a kit with no card is
left standing rather than wiped.

| 60 × 36 kit, on Custom shower | before | after |
|---|---|---|
| click **Max — curb inside** | numbers change, drawing frozen | pan cut to 60 × 34 ½", drain 30" × **17 ¼"** |
| click **Pan size** back | frozen | 60 × 36 pan, drain 30" × **18"** |

## 2 — The option cards flow instead of scrolling sideways

`.optrow` was one flex row of 240px cards with `overflow-x:auto`. Past the
second card the rest of the solver's answer was off screen with nothing saying
so — on the one tab whose whole job is comparing the options. It is now
`grid-template-columns: repeat(auto-fill, minmax(196px, 1fr))`: as many cards
per row as the pane is wide enough for, wrapping down into the pane's own
vertical scroll. Two across at the design width, wider monitors get the same
cards laid out to the room they have.

## 3 — The wall editor moved into the Walls group

It lived in the build column's Walls bucket, above the panel **lines**. The rows
are the ROOM, not the bill, so they belong with the size, the curb and the drain;
the build column is left listing what the room costs. Moved: the per-wall
on/off + length × height + sf rows, the added-wall rows with their ×, the ⇄
flip, "+ Add wall" and "✂ Cut open corners" with the corner-cut caption.

Two things changed shape with the move:

- The group's old **"Which get wedi" chips are gone** — each row's name button
  is the same on/off switch, and it carries the length, the height and the sf
  the chip never did. "Height" became **Default height** and rides the chips
  line, since every row now shows its own.
- The rows **flow** like the option cards (`flex: 1 1 190px`), so three walls
  and a pair of returns read as a block: five lines down to three.

**Fit | One size stays in the build column.** It picks between sheet
*plans* — which panel SKUs the bill lists — not room geometry, and it sits in
the header of the lines it changes.

**The Kits tab keeps its geometry entry**: the drawing rail is on every tab, so
an edge click still adds a wall, a corner click still toggles a cut, and a
right-click still opens the wall menu — and any of them still hands the kit off
to the Custom shower tab (owner rule 2026-07-30), which is where the editor now
is. Verified end to end in `shoot-flow.mjs`.

## 4 — The wall bands reach the curb

A curb turns the corner **outside** the room line — it adds (its width − the ½"
lap) of floor past the pan — and it butts into the wall at each end of its run.
The plan's bands stopped dead on the pan line, so the curb ran past the wall
into open air and the wall read short by exactly that overhang. On a 60 × 36
alcove with a lean curb the side bands ended at 171.6 SVG units where the curb's
outer face was at 177.5.

How far each corner carries out is read off the curb's own bands (`curbBands`),
not assumed: a lean curb asks for 1½" where a standard one asks for 4", and an
**"overall max" curb — which sits inside the line — asks for nothing**. It
composes with the corner-ownership rule already there (back wall claims the back
corners, side wall claims the front ones) by taking whichever reach is longer,
so a wall meeting both a perpendicular wall and a curb still draws one slab.

Two notches closed by the same rule: the front corners of any curbed alcove, and
the back corners when the back wall is off and the curb runs that edge instead
(`8-no-back-wall.png`).

## Preview proof

`node .scratch/079_wedi-custom-pan-interactions/shoot.mjs` (needs `npx vite
--port 5199` and `/wedi-preview.html`), plus `shoot-flow.mjs` for the Kits-tab
and drawing-click flows. Shots in `shots/`:

| shot | what |
|---|---|
| `1-kit-on-custom` / `2-max-curb-inside` | a kit's own drawing, then the same click away with Max on |
| `1a` / `2a` / `3a-drawing-*` | the rail alone across the flip and back |
| `4-optcards-flow` | four cards, two rows |
| `5-wall-editor-in-form` | the Walls group with the editor in it |
| `6-build-column` | the build column, editor gone, Fit/One size kept |
| `7-corner-front-left` | the band meeting the curb |
| `8-no-back-wall` | back wall off — the side bands carry past both curbs |
| `9-narrow-1180` | the whole popup at a narrow window |
| `10-kits-tab` … `13-browse-tab` | Kits, the hand-off, an added wall, Browse |

891 unit tests pass. No engine (`wedi.js`) change — all four are
`WediConfigurator.jsx`.

## Follow-up (2026-08-03, owner)

> There are still some drawings that need cleaned up, let me know if you need me
> to explain the photos. also show how changes look

Three ~16px crops — too small to identify the drawing, the corner or the fault,
so the owner was asked to point rather than guessed at.

`contact-sheet.mjs` builds `drawings.html` (regenerate it, it is not committed —
1.2MB of embedded PNG): every wall/curb setup the rail draws, numbered **N**a =
plan, **N**b = isometric, with the SVG lifted live out of the page so it stays
sharp at any zoom, and the three UI changes underneath. 1 curbed alcove · 2
curbless · 3 back wall off · 4 max-curb-inside · 5 right wall off.
`shoot-drawings.mjs` writes the same five as `shots/D-*.png`, whole and
corner-cropped.

**Confirmed by the owner:**

> The walls should always be flush with the curb/ curb and tile thickness. The
> drawings should reflect this

The suspicion was right — the **isometric** never got the corner treatment the
plan did. `curbCornerOut(bands, rw, rd)` is now the one place the rule lives and
BOTH views read it, so they cannot drift apart again. It returns how far the
curb stands past the room line at each corner, taken off the bands that actually
draw:

| | the curb's drawn face | the wall |
|---|---|---|
| ring, lean curb | 1½" past the pan line | out 1½", flush |
| ring, standard curb | 4" past | out 4", flush |
| overall max | ON the stated line | AT the stated line, flush |
| overall max + ⅜" tile | ⅜" inside the line, tile to the line | at the line — flush with the **finished** face |

A run still reaches into a corner square where a perpendicular WALL fills it;
the extension is now the **longer of that and the curb's reach**, so a wall
meeting both still draws one slab. With neither there it stops on the line —
which also drops the isometric's old overhang (`!backAt.bl` → `WALL_THICK` of
slab hanging over open air where no back wall stood), bringing it onto the rule
the plan already used.

`check-flush.mjs` asserts it numerically across six configurations rather than by
eye — every wall that a curb runs into reaches that curb's face, and the one
surplus it reports is exactly the ⅜" tile.

**Left alone, and worth a decision:** the tile thickness only applies in
"overall max" (issue 078's owner rule — in pan-size mode the curb and its tile
land outside the stated numbers, so the field is disabled there). The flush rule
follows the curb's *drawn* face, so in pan-size mode the wall lands on the bare
curb. If the tile should thicken the curb in pan-size mode too, that reverses
078 and wants its own decision.

## Follow-up 2 (2026-08-03, owner) — the curb's outline

> if you look, the curb lines are really thick so it looks like it sticks past
> the walls. Do the walls need to be a bit longer or the curb lines thinner?

**Neither** — the geometry was already flush (`check-flush.mjs` proves it). What
stuck out was the STROKE. SVG centres a stroke on its path, so half of the
curb's 1-unit outline painted *outside* the curb: past the wall it butts into,
past its own outer face, and (with `strokeLinejoin: round`) bulging at the
corner. Lengthening the wall would have made the drawing lie by half a stroke to
hide a paint artefact.

Each band is now **clipped to itself**, so no paint lands outside the part: the
band ends exactly where the curb does, and the visible line halves — the other
half of the same complaint. Width went 1 → 1.6 so the surviving inner half reads
0.8 where the old line read 1.0: no overhang, slightly lighter.

The clip ids are per-instance (`useId`, colons stripped — legal in an id but not
in every `url()` parser) because the rail and the print sheet mount a plan at
the same time; a shot asserts two clipPaths with two distinct ids.

The isometric was left alone: its wall slabs are stroked too, so its curb reads
consistently against them rather than one-sided the way the plan's did.

## Follow-up 3 (2026-08-03, owner) — the bench

> The bench sticks out past as well and when the max curb inside is selected it
> seems to revert

Same defect as the curb, one part later: the bench rect and the corner triangle
carried a 1.2 stroke, centred, so 0.6 of it painted outside the bench — past the
curb it rides out to and past the wall beside it. With the curb's outline
clipped the previous round and the bench's not, the bench was left as the only
thing overhanging, which is what "reverts" looks like at a corner where all
three parts land on the same line.

`clipSelf(points)` is now the shared helper — the curb bands and both bench
shapes go through it. Clipping halves what a stroke shows, so each user sets its
width back to the weight it should read at: the **curb** 1 → 1.6 (0.8 showing, a
shade lighter than before, which the owner asked for), the **bench** 1.2 → 2.4
(1.2 showing, unchanged). The bench needs every bit of that: `#DCE0C8` against
the pan's `#DCE5CD` is two points of difference, so the outline is the only
thing that says *bench*, and clipping it thinner made it vanish into the pan.

**Measured, in both size modes** (SVG units, 60 × 36 alcove, lean curb, a 2"
bench on the left wall):

| | pan | bench | wall | curb |
|---|---|---|---|---|
| Pan size | 171.6 | **177.5** | **177.5** | **177.5** |
| Max — curb inside | 165.7 | **171.6** | **171.6** | **171.6** |

Bench, wall and curb all finish on the same line in both — the bench's oversail
(`CADD` in the ring, nothing in max, where the curb is already inside the line)
already put it there; only the paint was over.

**Ruled out as the "revert"**, each re-run after the fix: the bench survives the
toggle (2" and framed alike, with its build lines); a picked option card
survives it and comes back unchanged on the way out; max applies to the pan and
the drain (60 × 34½ cut, drain 17¼") every time. If something else is reverting,
cases 6 and 7 on the drawings page are the bench in both modes to point at.

## Follow-up 4 (2026-08-03, owner) — the isometric's curb + 2″ bench

> The curb and bench for 2" built bench still is off. see first picture compared
> to second photo

The zoom was of the ISOMETRIC's front-left corner, which had never had the
stroke treatment — it was left alone twice on the reasoning that its wall slabs
are stroked too, so nothing read one-sided. That was wrong where the bench rides
onto the curb: two solids meeting there each overhung the other by half a
stroke, and the shared edge came out as one heavy doubled black line.

`clipPoly` now draws every curb face and every bench face clipped to itself.
In a 3-D view that only trims the SILHOUETTE — two faces of the same solid still
contribute half a stroke each along the fold they share, so interior edges keep
their weight while an outline stops bleeding onto its neighbour. Widths went
.7 → 1 and .8 → 1.2 so the folds read as they did.

**Still open, and NOT changed — it reverses a recorded rule.** The 2″ build-up
bench oversails the curb by `CADD` and its underside steps up onto the curb's
top (`zOut = CBH`, `yStep = y1 − CW`), drawing a small riser at the front. That
is issue 069's rule — "a bench reaching the entry runs on out over the curb
line, riding a run that now carries on beneath it" — and the little step is that
rule drawn honestly. If a 2″ build-up should instead STOP at the curb's inner
face, the oversail and the step both go, and the entry curb runs past the bench
end to end. Owner's call.

## Follow-up 5 (2026-08-03, owner) — the step onto the curb

> the black lines are my drawing to help show you the correct look
> …
> The problem is the curb runs the whole way but the bench pixcels dont properly
> fit around the curb
> …
> well it should sit on top of it. but needs to step up onto it. It is not
> showing it right

First correction: the heavy black line in the photo was the owner's PEN, not a
rendering artefact. The isometric stroke-clip (8d08ff7) was shipped on that
misread — it stands as a small improvement, but it was not the fix asked for.

Second: a detour where the bench was made to BUTT the curb was written and then
reverted unpushed — the owner's rule stands, the bench sits ON the curb and
steps up onto it.

**The isometric's step measures exact.** Bench end face, 60 × 36 alcove with an
AT curb (CW 4½", CBH 5⅛"), projected SVG units read off the DOM:

| point | drawn | expected |
|---|---|---|
| step corner `M(x1, yStep, zOut)` | `111.97, 228.55` | `111.96, 228.55` |
| curb top-inner edge at x=0 | `90.22, 216` | — |
| bench front-face base `M(0, y1, zOut)` | `83.23, 220.03` | = curb outer-face top corner |

`yStep = y1 − CW = 35.5` is the curb's inner face `c0`; `zOut = CBH` is its top;
the riser measures 6.36px = 3.545" = CBH − pan thickness. The step corner lands
ON the curb's top-inner edge to a hundredth of a unit.

**What was actually missing: the PLAN never showed the step at all.** The bench
rectangle simply covered the run — no line, no note — so the one element that
reads straight across the entry died under it. The curb's two edges now carry on
across the bench in the bench's own colour (its inner face dashed, its outer
face solid) with the raised stretch marked **STEPS UP**.
