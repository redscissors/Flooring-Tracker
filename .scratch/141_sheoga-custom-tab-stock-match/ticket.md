---
issue_type: Bug
summary: "Sheoga configurator: a stock color built on the Unfinished & custom tab (4¼\" Character Hickory Toasted Acorn, standard sheen) still charged the small-order fee the Stocked tab never charges. Also: prefinishing takes micro bevel as its minimum edge."
status: done
labels: [ready-for-human]
---

# A stock item is stock on either tab; prefinished = micro bevel minimum (owner 2026-09-15)

## What was wrong

Owner: "4¼" character hickory toasted acorn should never have a small order
charge since it is a stock color for Sheoga. If found in the stock tab there
is none, but when done in the unfinished tab with all the same information
there can still be a small order charge."

`calcFloor` charged `smallOrderFee(finish, sf, …)` from the finish alone; it
never asked whether the build was one of the stocked program's own items (a
green STOCK / FAST TRACK cell). The stocked tab, on the same item, charged
nothing. The custom tab also carried the floor tab's default Square edge onto
a prefinished order, which Sheoga does not cut — prefinished flooring is
micro bevel at minimum.

## Rules (owner, 2026-09-15; ADR 0042)

- A custom-tab build that IS the stocked program's item — solid, standard
  lengths, no sap, micro bevel, a sheet color at its standard sheen, on a
  green cell — is that stock item: no small-order fee, "Stocked item — ships
  from Sheoga stock", and the sheet's own $/sf. A multi-width bundle is a
  stock order only when every shipping width is a green cell.
- Anything prefinished takes micro bevel as its minimum edge. Square edge on
  a prefinished build reads and orders as Micro bevel ($0 either way); the
  Edge picker greys Square while a finish is chosen and lifts it to Micro
  bevel when a finish is picked.

## Fix

- `src/sheoga.js`: `floorEdge(f)`, `stockedForFloor(f)`; `calcFloor` waives
  the fee, swaps the warn line and quotes the stocked cell's cost on a stock
  build; `calcHerringbone` uses the same edge minimum; `multiWidthBuild`
  waives the pooled fee when every width ships from stock.
- `src/SheogaConfigurator.jsx`: floor rail Finishing hint reads "stock item —
  no fee" on a match; Edge dropdown greys Square while prefinished, and
  picking a finish lifts Square to Micro bevel.
- `src/sheoga.test.js`: stock-match cases (Toasted Acorn, square-edge, every
  green cell vs `calcStocked`), the micro-bevel minimum on floor + herringbone,
  and the multi-width all-green / mixed rule.

## Preview proof

See the PNGs in this folder (`shoot.mjs` against `PORT=5199 npm run dev`).
