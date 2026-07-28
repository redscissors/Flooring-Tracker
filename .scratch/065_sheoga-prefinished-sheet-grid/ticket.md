---
issue_type: Feature
summary: Retire the Stocked prefinished tab; the custom tab grows an inline
  "Price sheet" band — the vendor's prefinished page, white + green — with
  two-way sync to the options, a STOCK badge that suppresses the small-order
  fee, and a Stocked/Rush filter. Mockup only, not yet implemented.
status: open
labels: [needs-info]
---

# Prefinished sheet grid replaces the Stocked tab (mockup)

Owner direction 2026-07-28: "make the grid show just the prefinished grid
that is on the price sheet… the grid fits in at the top and pushes the rest
of the choices down… changes down below also make changes in the grid…
another button that says stocked / rush options."

Groundwork: issue 064 verified the 1/19/26 prefinished page equals unfinished
base + finishing adders on all 276 cells, so one engine can price the whole
sheet. `mockup.html` is fully interactive; the toolbar presets show the five
states (M1–M6 screenshots).

## What the mockup does

- **Price sheet band** under the tabs, full popup width, pushes the rail and
  build card down; collapsible. Rows are the vendor page in sheet order
  (Clear block | Character block, 2¼–6¼), labels carry the off-30 sheen and
  the textured rows' scrape. Green cells = the sheet's STOCK/FAST TRACK
  highlights; legend up top.
- **Two-way sync.** Clicking a cell configures everything below (species,
  grade, width, solid, stain/Natural, texture, micro bevel, standard lengths,
  the row's standard sheen). Editing options below moves the highlight; a
  build the sheet doesn't carry (engineered, unfinished, custom color, 7¼"+,
  off-sheet color/texture) shows an amber "not on the sheet — prices the
  custom way" note instead of a highlight.
- **STOCK badge** on the build card when the config sits on a green cell AND
  nothing walked it off the stock item (micro bevel, standard lengths, no
  sap, standard sheen). Stock ⇒ no small-order fee. The instant an option
  walks off (e.g. hand-pillowed edge), the badge flips to amber "an option
  walked it off the stock item" and the fee line returns — the price barely
  moves, so the badge is the only honest signal (this was the design risk
  flagged in review; the mockup makes it loud).
- **Green cell + changed sheen only** keeps the old stocked-tab rule: flat
  $250 made-to-order line, no small-order fee.
- **Stocked / Rush only** button: white cells collapse to dots, rows with no
  green cells disappear.
- Stock hints ride the rail too: a green ● on species chips with stock
  colors and on width chips that ship from stock at the current color.

## Production notes (when this graduates from mockup)

- Green cells stay **transcribed** vendor numbers (the current `STOCKED`
  table, reshaped to flags+prices); white cells **derive** from
  base + adder. A unit test asserts derived == transcribed per green cell so
  the day a sheet edition decouples the pages again (Feb '25 did, on the
  textured rows) a test fails instead of the grid misquoting.
- `calcStocked` + the stocked mode stay for saved rows (Reconfigure), tab
  hidden exactly like herringbone (`HB_RETIRED` pattern).
- The stock predicate + fee suppression land in sheoga.js as pure functions
  with tests; the badge is presentation over them.
- Sheet band replaces the floor tab's "Price grid" modal (the unfinished
  grid could become a second block or a toggle inside the band — open).

## Open questions for the owner

1. Sheen-change rule on a green cell: today $250 flat and NO small-order fee
   (the old stocked-tab rule). Keep, or should an off-sheen stock color also
   owe the under-500 fees like any custom run?
2. Does a *white* cell ever rush? The button says "Stocked / Rush" — if FAST
   TRACK is a separate thing from STOCK on Sheoga's side we may want two
   shades of green.
3. The unfinished price grid (the old modal): fold into the band as a second
   view, or keep the modal for unfinished?
