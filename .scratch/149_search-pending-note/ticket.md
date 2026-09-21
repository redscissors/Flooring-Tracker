---
issue_type: Bug
summary: The project area's product search flashed "No exact match — showing
  closest spellings" before the special-order query had answered; now the near
  rungs wait for it, and a thin moss bar shows the search is still out.
status: done
labels: [ready-for-human]
---

# Product search claimed "no exact match" before it had finished

Owner, 2026-09-21:

> when searching for products it shows no exact match when its not done
> searching, it should only show it once it has finished. This is in the
> project area

and, mid-fix:

> Maybe there should also be something that indicates that it is searching,
> any ideas?

## Root cause

`useMergedResults` (search.jsx) walked its rungs — exact, then near, then
wider — synchronously, but only the stock tier is in memory. The special-order
tier comes back from `useOrderResults` after a 250 ms debounce plus a server
round trip, and until it landed the hook's order state was either empty or
the PREVIOUS query's hits. So for a query whose exact match lives in a vendor
book (most of them), the exact rung was empty for that window, the walk fell to
the near rung, and `NearMatchNote` painted "No exact match" — then vanished
when the real hits arrived. The same window flashed the omni search's
"No price-book match / Enter by hand" footer, and Enter in it would have
committed a real book SKU to hand entry.

## Fix

- `useOrderResults` stamps its results with the query they answer (`q`);
  while the stamp differs from the current query the search is `pending` and
  the stale hits are not merged.
- The rung walk moved to a pure `mergedRungs` (orderbook.js, unit-tested):
  while pending it stops at the stock exact rung — stock exact hits still
  list instantly; the near rungs, and the note, wait for the order query.
- Indicator (owner picked from four Mobbin-backed options — thin bar, skeleton
  rows, spinner in the field, text only): `SearchingBar`, the kit's existing
  `ft-progress-indeterminate` moss bar at 2 px across the top of the popup
  (desktop cell and omni pickers) and under the phone sheet's header. It stays
  up over stock hits already listed. With nothing listed yet the panel says
  "Searching the order books…" instead of "No price-book match", and Enter
  does not fall through to hand entry until the search has answered.

## Preview proof

`preview.jsx` renders the REAL `GridOmniSearch`, `GridProductBox` and
`MobileSearchSheet` over a stubbed order-book search whose timing the URL
controls; `shoot.mjs` types the query and counts the amber note and the bar:

| shot | state | note | bar |
|---|---|---|---|
| pending.png | order query never answers, stock has only near-misses | 0 | 1 |
| pending-stock.png | same, stock has exact hits (listed under the bar) | 0 | 1 |
| settled.png | order query answers with the Hanoi rows | 0 | 0 |
| near.png | order query answers empty → near-misses + the note | 1 | 0 |
| cell.png | filled-row product cell, pending | 0 | 1 |
| mobile.png | phone sheet, pending | 0 | 1 |
