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
curb and its tile land *outside* them, so nothing is being held back. In both
of those cases the field renders dimmed with a tooltip saying why.

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

## Proof

`node .scratch/078_wedi-tile-thickness-fit/shoot.mjs before|after` and
`shoot-tile.mjs`, over the real `wedi-preview.html` harness; `measure.mjs`
prints the numbers in the tables above. Shots in `shots/`:

- `before|after-<viewport>-1-full.png` — the whole popup
- `before|after-<viewport>-2-form.png` — the room form
- `before|after-<viewport>-3-rail.png` — the drawings rail
- `tile-1…4` — 60 × 36 max, no tile vs ⅜" tile, full + rail
- `tile-5-form-live.png` — the field live (max mode, un-dimmed)

## Files

`src/wedi.js` (curbInsets + cfg), `src/WediConfigurator.jsx` (parseIn, the
field, curbBands, railSplit, CSS), `src/wedi.test.js` (+1 test, 890 pass),
`src/CLAUDE.md`.
