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
grid-template-columns: repeat(4, 1fr) 88px;   /* 4 equal cells + the tall column */
grid-template-rows:    repeat(2, 46px);       /* two lines, fixed height          */
```

- **Species** — the eight sheet species (White Oak · Red Oak · Hickory · Maple /
  Cherry · Walnut · Beech · Q/R White Oak) fill the 4 × 2 block, every chip the
  same width and height regardless of name length. **Live Sawn White Oak** sits
  in the 5th column, `grid-row: 1 / -1`, so it is exactly as tall as the two
  rows beside it. Its label is set horizontally, stacked "Live Sawn / White Oak"
  over its sell price; the column is 88px wide to hold that, and the four
  regular columns give up the difference — chips are tighter both ways (46px
  rows, 11px label) than the wrapping version they replace.
- **Width** — same 4-and-4 stack on the same module (widths keep to columns 1–4
  so a width chip is exactly a species chip), and the **Multi** chip stays an
  ordinary in-flow chip right after the last width, in its dashed-green
  "not a width, a mode" treatment. Ticking it flips the width cells to
  checkboxes exactly as today; the split panel still drops in underneath.

Standing Live Sawn on its own edge is not only about the long name: it is its
own price run — one grade, 5¼"–11¼" — so it reads as a separate choice rather
than a ninth name in the same list.

## Desktop only

The grid is the ≥768px rail. The phone sheet keeps the wrapping chips (a fixed
4-wide grid at 390px would make each cell ~70px, too narrow for
"Q/R White Oak" plus a price).

## Shots

| | |
|---|---|
| `A1-proposed-white-oak.png` | proposed grid, default build |
| `A2-proposed-live-sawn.png` | Live Sawn selected — grade collapses to one, widths become its own run |
| `A3-proposed-multi.png` | Multi on — width cells become checkboxes, the Multi chip goes solid green |
| `A4-current-shipping.png` | what ships today: free wrap, Live Sawn on its own line |
| `A5-current-multi.png` | today's Multi chip, wherever the wrap leaves it |

The toolbar toggle in `mockup.html` switches Proposed / Current live; prices are
computed from the real `src/sheoga.js` tables at the shop's 40% flooring markup.

## If this gets built

Touches `FloorRail` / `StockedRail` in `src/SheogaConfigurator.jsx` only —
`Chips` and `WidthRow` grow a grid variant behind the existing `useIsWide`
switch. No engine, pricing, or data change; `sheoga.js` is untouched.

Two things to eyeball before it ships: the **Stocked prefinished** tab has 4
species and 4–5 widths, so the same grid reads differently there; and the width
block now ends one column short of the species block (nothing occupies the tall
column under Width) — deliberate, so the two blocks share one chip size, but
it's a visible ragged edge.
