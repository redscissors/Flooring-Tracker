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
