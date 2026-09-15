---
issue_type: Feature
summary: The phone's add bar gets a wide Price book button beside + Product
  that opens the new row straight into the full-screen search; + Product
  becomes a compact outlined button and opens the manual editor as before.
status: done
labels: [ready-for-human]
---

# Price book search button in the mobile add bar

Owner, 2026-09-15: "Right now when you click + Product it opens the manual
input and then you can hit price book to search. What if we added a price
book search button to the right of the product button. Make it take up a
larger portion of the bar space since it will be the main pressed button."

Board: `.scratch/mockups/mobile-add-bar-2026-09-15.html` — the bar at 344 CSS
px (Z Fold 5 cover). Owner picked the area label on the Price book button
(over dropping it or leaving it on Product); the single-line label then
measured ~40 px at 344 px and read "· Ma…", so the owner picked the stacked
version from three drafts (stacked / lean Area + Product without + icons /
ship as is).

## What changed

- `src/App.jsx` — the add bar is `+ Area` · `+ Product` (both outlined,
  fixed width) · `Price book` (ink, takes the rest, the target-area name in
  9px under its label). Both Product and Price book target the area in view
  (`activeAreaId`); `mobileAddProduct(search)` reuses the area's trailing
  blank row or adds one and opens its sheet, with `rowSheet.search` telling
  the sheet to open in search. Without anything searchable
  (`skuSearchable`) the bar falls back to the two-button layout.
- `src/mobile.jsx` — `MobileRowSheet` takes `initialSearch`, seeding its
  existing `searching` state so the full-screen `MobileSearchSheet` is the
  first thing up. A pick fills the row as before; X drops into the manual
  editor. No write-path changes.

## Proof

`bar-now.png`, `bar-new.png`, `bar-new-long-area.png` (chosen layout; a long
area name truncates on the stacked line, the bar holds at 342 px),
`bar-passed-single-line.png`, `bar-passed-lean.png` (the two passed drafts),
`board.png` (the whole board, Chromium 2×, local Manrope). Widths at 344 px:
Area 72, Product 93, Price book 145. The App.jsx bar has no Supabase-free
harness; the board is its prototype proof, as for issue 139.
