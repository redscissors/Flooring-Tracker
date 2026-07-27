# Sheoga configurator — species & width as a fixed grid (desktop)

**Status:** prototype — not implemented in `src/SheogaConfigurator.jsx`
**Open:** `mockup.html` in a browser (standalone, no build, clickable).

## What was asked

> Species all the same size, stacked 4 on top of 4, with the Live Sawn White Oak
> option vertical on the right side, the same height as the two lines beside it.
> PC version only. Same for the width, with Multi on the end.

## The shape

Both blocks become one grid instead of a free-wrapping chip row:

```
grid-template-columns: repeat(4, 1fr) 50px;   /* 4 equal cells + the tall column */
grid-template-rows:    repeat(2, 52px);       /* two lines, fixed height          */
```

- **Species** — the eight sheet species (White Oak · Red Oak · Hickory · Maple /
  Cherry · Walnut · Beech · Q/R White Oak) fill the 4 × 2 block, every chip the
  same width and height regardless of name length. **Live Sawn White Oak** sits
  in the 5th column, `grid-row: 1 / -1`, so it is exactly as tall as the two
  rows beside it, its label set vertically (`writing-mode: vertical-rl` +
  `rotate(180deg)`, an explicit break so it reads "Live Sawn / White Oak"
  bottom-to-top) with its sell price as a second vertical line.
- **Width** — same grid. Widths flow 4 per row (7 for a normal species, 6 for
  Live Sawn, so the tail cells sit empty rather than reflowing the columns), and
  the **Multi-width** chip takes the tall 5th column, keeping its dashed-green
  "not a width, a mode" treatment. Ticking it flips the width cells to
  checkboxes exactly as today; the split panel still drops in underneath.

Standing Live Sawn on its own edge is not only about the long name: it is its
own price run — one grade, 5¼"–11¼" — so it reads as a separate choice rather
than a ninth name in the same list.

## Desktop only

The grid is the ≥768px rail. The phone sheet keeps the wrapping chips (a fixed
4-wide grid at 390px would make each cell ~80px, too narrow for
"Q/R White Oak" plus a price).

## Shots

| | |
|---|---|
| `A1-proposed-white-oak.png` | proposed grid, default build |
| `A2-proposed-live-sawn.png` | Live Sawn selected — grade collapses to one, widths become its own run |
| `A3-proposed-multi.png` | Multi-width on — width cells become checkboxes, tall chip goes solid green |
| `A4-current-shipping.png` | what ships today: free wrap, Live Sawn on its own line |
| `A5-current-multi.png` | today's Multi chip, wherever the wrap leaves it |

The toolbar toggle in `mockup.html` switches Proposed / Current live; prices are
computed from the real `src/sheoga.js` tables at the shop's 40% flooring markup.

## If this gets built

Touches `FloorRail` / `StockedRail` in `src/SheogaConfigurator.jsx` only —
`Chips` and `WidthRow` grow a grid variant behind the existing `useIsWide`
switch. No engine, pricing, or data change; `sheoga.js` is untouched.

Open question for the stocked tab: it has 4–5 widths and 4 species, so the same
4-wide grid leaves a fuller-looking block — worth eyeballing before it ships.
