# 078 — wedi configurator: tile thickness, tighter room form, drawings that fit

Status: done (2026-08-03)
Opened: 2026-08-03 (owner)
Area: wedi configurator (issue 066)

## The ask (owner)

> In the wedi Configurater. We should also add a tile thickness that moves the
> curb in that depth to make sure the tile that goes on this fits inside the
> shower depth. I am thinking a small Tile Thickness In the Custom shower size
> and curb box. Also Lets tighten up the padding and extra space in those cards
> so they fit better beside each other. Also the drawing wan to scroll and not
> show everything at once. With out the colum changing can we make so they
> always try to fit on the screen at large size screens

Three things, all on the Custom shower tab.

## 1 — Tile thickness

Follow-on to 070 ("Max — curb inside"). That mode reads the typed numbers as
the overall footprint: every fully open edge pulls its curb inside the line and
the pan gives up the curb's width minus the ½" lap. What it did not account for
is the **finish on the curb's outer face**. A 36"-deep alcove with a lean curb
ran a 34½" pan and a curb whose tiled face then stood ⅜" proud of the 36" line.

`curbInsets(dims, walls, curbKey, tile)` now takes the thickness and adds it to
every edge it insets, and carries it out as `inset.tile` so the drawings hold
the curb off the line by the same amount (`curbBands`). The pan gives up curb
width **plus** tile:

| 60 × 36 max, lean curb, three walls | pan |
|---|---|
| no tile | 60 × 34 ½" |
| ⅜" tile | 60 × 34 ⅛" |

**Where it applies.** Only edges that actually carry a curb pay for it — a
fully walled edge insets nothing, as before, and a curbless build insets
nothing at all. And only in max mode: with the numbers read as the pan, the
curb and its tile land *outside* them, so nothing is being held back.

Owner confirmed that rule, so the field is **disabled** wherever it can't bite,
not merely dimmed — a box that takes a number and does nothing with it is worse
than no box. Its tooltip names the switch that turns it on. A thickness already
typed is kept, greyed, and applies again the moment Max + Curbed comes back
(`shoot-gate.mjs`):

| state | field |
|---|---|
| Pan size + Curbed | disabled, placeholder `—` |
| Max + Curbed | live, placeholder `0 or 3/8` |
| Max + Curbless | disabled, value kept |
| back to Pan size | disabled, value kept |

**Input.** Tile arrives off a tape measure, so `parseIn` reads `3/8`, `1/4`,
`1 1/16` and `0.375` alike; the box shows the decimal it read back, so a
mistyped fraction is visible before it moves the curb.

**Round-trip.** `cfg.tileT` (a plain number, 0 when unset) rides the wedi
marker like `maxIn` does, so "wedi — reconfigure" re-lands it. Additive
optional field — an older saved row reads as 0 and behaves exactly as it did.

Not covered: tile on the WALLS. The stated width is the wedi wall face and the
pan runs to it, so wall tile takes clear space but no pan space. Say so if that
turns out to matter.

## 2 — The room-form cards

The grid was three equal `minmax(248px,1fr)` tracks, which at every real width
gave two columns — so Walls dropped to a second row with a **dead cell beside
it**, roughly a quarter of the form, while Size & curb (the group with the most
fields) was starved into stacking them and Drain sat half empty.

Now a flex row: Walls spans the row it starts (`.rfgrp.span`), and the two
field groups split what is left in proportion to what they hold
(`.rfgrp.wide` on Size & curb). Padding, gaps and control padding come down a
notch throughout — `.roomform` 8→5, `.rfgrp` 5/8/7→4/7/5, `.rfflow` gap
7/10→5/9, `.rseg button` 4/10→3/8.

Form height, measured, **with the new field already in it**:

| viewport | before | after |
|---|---|---|
| 1920 × 1080 | 293px | 219px |
| 1680 × 980 | 293px | 219px |
| 1440 × 900 | 319px | 281px |

1440 still stacks to one column — two cards can't both hold their widest
control (the four-way Drain preference segment) in the 453px the solver column
has there. Unchanged from before, not a regression.

## 3 — Drawings that fit the rail

The two SVGs were fixed at 328 × 268 and 328 × 306 and rendered `width:100%`,
so on a wide monitor they grew *taller* than the column and the isometric fell
off the bottom — a scroll to see the drawing you just changed.

`railSplit` measures the rail (ResizeObserver on `.diagcol`) and hands each
drawing a height. The key detail: it gives back **drawing units, not pixels**.
The 328-wide viewBox still stretches to the full column, so a callout set at
8.5 units reads exactly as large as it did before; handing over measured pixels
instead pinned the type at 8.5px and shrank every label on the widest monitors
(tried it — the drawings fit and stopped being readable). Only the height
gives, split 268:306, down to floors of 210/240 units below which the rail
scrolls as it always did — a short laptop viewport shouldn't shrink a shower to
a postage stamp to avoid a scrollbar.

The column width never moves: the three columns keep their `flex:1 1 0` equal
share whatever the drawings do. `.diagcol` gets `scrollbar-gutter:stable` so
the gutter can't appear and disappear as the fit flips.

| viewport | rail before | rail after |
|---|---|---|
| 1920 × 1080 | 971px in an 842px column — **scrolls** | 843 / 842 — fits |
| 1680 × 980 | 943px in an 842px column — **scrolls** | 843 / 842 — fits |
| 1440 × 900 | fits | fits |

## 4 — Hips aim at the UNCUT pan's corners

Owner, follow-up: *"the pan lines should not always go to the corners. If a pan
is cut down the lines should point to where the corners would be if the pan was
not cut. The pan planes do not change."*

`slopeMarks` drew the four hips from the pieces' CURRENT corners to the drain
cover. On a cut-down base that re-pitches the planes, which is the one thing
cutting a pan cannot do — the folds are moulded at the factory and a site cut
just removes material from under them.

The hips now start at the **uncut** rectangle's corners (`pan.cut` gives the
full size; a cut comes off the +y edge and the +x edge, or −x when the layout is
mirrored) and are clipped back to the material that is actually there, so a line
points off the cut edge instead of hanging past it. Repro: 24 × 33 with the drain
pinned at 6″ × 16″ → a 36 × 36 base deep-cut on both axes
(`shoot-hips.mjs`, `hips-before|after-*`). The two hips that used to converge on
the fabricated cut corner now leave through the cut edges at the moulded angle.

A pan that isn't cut has `cut === null`, so the uncut rectangle IS the piece and
nothing moves — the three `after-*-3-rail.png` shots re-shot byte-identical.

Fall arrows are untouched (their length and spacing were set by owner asks in
071/075); this is the fold lines only.

## 5 — Wall ends: only reach into a corner a wall actually fills

Owner, follow-up: *"sometimes it changed the added wall go all the way to the
end vs just against the side wall."*

The plan drew every band 4″ past its corner unconditionally — always at the
left/back end, and at the far end too once the run reached full length — with no
check for whether a perpendicular wall was there. Two symptoms, one cause:

- with side walls on, an added (MOSS) wall's end ran through the grey side wall
  to its outside face instead of butting it;
- with side walls off, that same end — and both ends of the back wall — hung 4″
  out over open air.

The **isometric** already gets this right (`owns`/`butt` in `geomOf`), so the
plan now draws to the same rule: the back and entry runs carry THROUGH their
corners, the side walls butt into their faces, and a run only reaches into a
corner some perpendicular wall actually fills. A side wall starts at the back,
so it fills a back corner as soon as it exists; it only reaches an entry corner
by running the full depth. The thumbnail path (`on.back/left/right`, all
full-length) takes the same rule.

Visible knock-on in the standard 3-wall drawing: the two 4″ side-wall stubs
that used to poke out below the curb are gone — walls stop at the entry line
and the curb runs the opening. Nothing else moved; the isometric is untouched.

`shoot-wall.mjs` → `walls-before-*` vs `wall-*` (the same added entry wall, with
and without the side walls it returns from).

## 6 — A half wall on either end, or both

Owner, follow-up: *"The half wall should be able to go on either side and also
have the option for a wall on both sides."*

A wall was only ever a LENGTH on an edge — the engine assumed every run started
at that edge's low end (x = 0 on the back/entry, the back on a side wall), so an
added front wall could only return from the left. A wall is now a **run with an
end**: `at: "lo" | "hi"`.

- `wallSpans(dims, walls)` (new, exported) turns the wall list into merged
  covered intervals per side. `openEdges` returns those `spans` alongside the
  `cov` totals it always did, and its `edges` are now the open complement — so a
  side can carry several open runs, which is exactly what two returns leave.
- `curbRuns`/`openCorners` ask *which end* rather than *how much*: `spanAtLo`/
  `spanAtHi` replace the `cov > 0.5` / `cov >= max − 0.5` tests, the corner-cut
  legs read the open run touching each corner, and a far-end corner cut only
  applies to the run that actually reaches it.
- **Both sides is just two walls**, one at each end — no new mode. They can carry
  different lengths, heights and wedi faces, and the walk-in is whatever is left
  between them. 60 × 36 with a 24″ return on each end leaves one 12″ curb run.

Every wall anchored "lo" spans `[0, len]` exactly as before, so this is a pure
generalization — the 890 existing tests pass untouched, and `cfg.walls[].at` is
only written when it is `"hi"`.

UI: which HALF of the edge you click picks the end, so a right-hand return is
one click. The wall's row in the build column names its end (`Front right`) and
clicking the name flips it; its right-click menu has an **End** toggle plus a
**Both ends** button that adds the mirror. Drawings offset every band, slab,
seam tick and exposed-end marker by the run's start.

`shoot-halfwall.mjs` → `std3`, `halfwall-right`, `halfwall-left`,
`halfwall-both` (rail, plan and iso each).

## Proof

`node .scratch/078_wedi-tile-thickness-fit/shoot.mjs before|after` and
`shoot-tile.mjs`, over the real `wedi-preview.html` harness; `measure.mjs`
prints the numbers in the tables above. Shots in `shots/`:

- `before|after-<viewport>-1-full.png` — the whole popup
- `before|after-<viewport>-2-form.png` — the room form
- `before|after-<viewport>-3-rail.png` — the drawings rail
- `tile-1…4` — 60 × 36 max, no tile vs ⅜" tile, full + rail
- `tile-5-form-live.png` — the field live (max mode, un-dimmed)
- `gate-1…4` — the field through all four gate states
- `hips-before|after-{1-rail,2-plan,3-iso}` — the 24 × 33 deep-cut repro
- `walls-before-*` vs `wall-*` — an added entry wall, side walls on and off
- `std3-*`, `halfwall-{right,left,both}-*` — the front half wall on each end

## Files

`src/wedi.js` (curbInsets + cfg), `src/WediConfigurator.jsx` (parseIn, the
field, curbBands, railSplit, slopeMarks, CSS), `src/wedi.test.js` (+1 test,
890 pass), `src/CLAUDE.md`.

## Still open

The owner also asked that "the side wall should look like the one i modified in
the attached photo" — a marked-up isometric with the left wall's end face inked
in solid black. Not acted on: several readings fit the mark and it is a purely
cosmetic change to every drawing. Question back to them.
