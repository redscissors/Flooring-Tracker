---
issue_type: Feature
summary: Dock the price grids beside the option rails on big screens — the
  vendor's prefinished sheet (white + green) on the Stocked tab, a live
  options-aware unfinished grid on the custom tab — with two-way sync;
  phones keep the buttons plus a Grid button that opens the sheet as an
  overlay. Mockup v2, not yet implemented.
status: open
labels: [needs-info]
---

# Docked price grids on both Sheoga tabs (mockup v2)

Owner direction 2026-07-28 (superseding the v1 merge idea — v1 is in git
history): keep BOTH tabs and their buttons. On a big screen the grid "adds
onto the window to the left" — buttons and grid drive the same build. On
mobile, buttons only, plus a button that opens the grid. And the unfinished
tab gets its own grid: Solid up top (Clear block left, Character block
right), Engineered below, and the whole grid re-prices live as scrapes/
finishes/lengths are chosen.

The backtrack also dissolves v1's main design risk: stockness stays
structural on the Stocked tab (its buttons never offer edge/length/sap), so
there is no "option silently walks off the stock item" state to police.

## What the v2 mockup does (`mockup.html`, all live)

- **Stocked tab, desktop** — the prefinished sheet docks as a left panel
  (sheet order, Clear|Character blocks, 2¼–6¼): green = STOCK/FAST TRACK,
  white = made-to-order at the same $/sf (fees under 500 sf). Cell click
  sets color/grade/width + that color's standard sheen; the buttons and the
  grid highlight stay in lockstep. The buttons rail now lists every sheet
  color for the species (green ● marks stocked ones) — an interpretation to
  confirm, since the old tab listed only stocked colors. "Stocked / Rush
  only" filter + a Cost/Sell toggle ride the panel header.
- **Unfinished tab, desktop** — a new live grid: ¾" Solid section (Clear |
  Character × 2¼–8¼), Engineered section below, Live Sawn as its own strip
  per section (4¼–11¼ / eng to 9¼). Every cell shows the fully configured
  cost — texture, finish/stain, edge, lengths %, no-sap (Cherry/Walnut rows
  only) baked in — with a header line naming what's included ("every cell
  includes: Saw Cut +$1.50 · Cattail +$3.15"). Change a scrape and the
  whole grid moves; click any cell to jump species/grade/construction/width.
- **Phone** — buttons only, plus a "▦ Grid" button on the pinned price bar
  that opens the same table as a full-screen overlay (scrolls both ways,
  tap a cell to pick and close). A compact STOCK/made-to-order badge sits
  under the tabs on the stocked tab.
- Stocked fee rules unchanged from today: green + standard sheen = STOCK,
  no fee; green + changed sheen = $250 flat; white cell = small-order fees
  under 500/250 sf.

## Production notes

- Green cells stay transcribed (`STOCKED` reshaped to flags + prices);
  white cells derive from base + adder with a unit test asserting derived
  == transcribed per green cell (the Feb '25 sheet edition had decoupled
  the textured rows — the test catches the next decoupling).
- The docked panel replaces the Price grid modal on both tabs at ≥ some
  breakpoint (the popup grows wider than today's 1060px — needs a real
  breakpoint decision, e.g. panel shows ≥1400px, button/modal below).
- `calcStocked` keeps working for saved rows; white-cell picks on the
  stocked tab need either a floor-cfg handoff or a stocked-cfg that prices
  off the derived sheet — decide at implementation.

## Owner decisions (2026-07-29) — ready to build

1. **Grid only for white cells.** The stocked tab's buttons stay stock-only
   (unchanged from today); the docked sheet is the only path to a white
   cell. A white-cell click hands the pick to the Unfinished & custom tab
   pre-filled (solid, grade, width, the color as an established stain /
   Natural, the row's texture, micro bevel) — it prices identically
   (verified cell-for-cell) and files honestly as a made-to-order custom.
2. **Sheen change on a green cell stays** $250 flat, no small-order fee.
3. **One green** for STOCK and FAST TRACK, like the vendor sheet.
4. **Grids default to SELL** (through the job's tier lens, like the rail
   chips); the Cost/Sell toggle stays in the panel header.
5. **Live Sawn is unfinished-only.** Live Sawn White Oak cannot be ordered
   prefinished: the engine stops pricing it with any prefinished finish,
   the finishing dropdown disables those choices on Live Sawn, and the
   grid's Live Sawn strips drop out when a prefinish is selected.

## Preview proof

- V1 stocked tab, docked sheet + buttons, STOCK pick
- V2 stocked tab, white (made-to-order) cell with fees
- V3 unfinished grid, bare base
- V4 unfinished grid re-priced by Saw Cut + Cattail stain (header names it)
- V5 phone, buttons + Grid button on the price bar
- V6 phone, grid overlay open
