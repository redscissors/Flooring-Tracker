---
issue_type: Bug
summary: "wedi/Schluter Reconfigure reopened on the recipe's quantities, ignoring
  a qty typed on the placed row; and a wedi pricelist search hit whose stocked
  twin the typed words missed filed as a special order all the way into order
  entry. Reconfigure now reads the kit's placed rows (kitRows + sessionFromRows,
  both engines); mergeSearch resolves order hits against the WHOLE stock cache."
status: done
labels: [ready-for-human]
---

# wedi price book + configurator: Reconfigure ignores the sheet · stocked panel files as special order (owner 2026-09-02)

## Root causes

1. **Reconfigure.** The anchor marker is `{ mode, cfg }`; the popup's stepped
   quantities (`qtyOv`) and hand-added extras were session state that never
   rode the cfg (buildFromMarker said so), and a qty typed on a placed row
   lived only on that row. `seedState` read the marker alone, so Reconfigure
   reopened on the recipe's figures and Update this kit re-landed them.
2. **Search.** `mergeSearch` resolved an order hit's stocked twin only among
   the stock rows that had *also matched the typed words*. The ERP export reads
   "Wedi Building Panel - US8000017" (size 3'x5' in its own column, thickness
   not in the searchable text); the pricelist reads "wedi® Building Panel
   36"x60"x1/2"". "wedi panel 1/2" or "wedi 36"x60"" hit only the pricelist row,
   which stood alone with the pricelist's bookId → `isSpecialOrder` tier 1 →
   special order at order entry. Reproduced offline over the committed fixtures
   before any change.

## What changed

- `model.js kitRows` — the anchor + exactly the companions `kitCompanionIds`
  gives it (the landing/delete set). Answers the owner's question: a second
  shower carries its own kitId, a searched-in line has no marker/kitId, so
  neither folds into the first shower.
- `wedi.js` / `schluter.js`: `lineItems` stamps each line's catalog key
  (anchor `key`, companion `part: <key>`; legacy `part: true` still resolves by
  shop number / US lead); `sessionFromRows` diffs the kit's rows against the
  marker rebuilt with the default session → qtyOv (differs / missing → 0) +
  manual extras (rows the build doesn't produce). Blank qty = "not said"; an
  unresolvable row set = empty session.
- Both popups take `editRows` (App: `kitRows` of the anchor) and seed
  qtyOv/manual once on mount (Schluter once its catalog is up).
- `orderbook.js mergeSearch(stock, order, stockAll)`: a live twin found in the
  whole cache is surfaced into the stock list in the order row's place
  (`matchedAs` so rankMerged ranks it as that hit); the order row's own
  `vendorSkus` key too (the wedi pricelist states the shop number).
  `search.jsx useMergedResults` passes the cache.
- Docs: ADR 0035 + ADR 0009 amendments, design.md §6, data-model skill, src/CLAUDE.md.
- Harness: `wedipreview.jsx` / `schluterpreview.jsx` grow a job-sheet strip
  (qty box per placed row + Reconfigure) and wedi a `?search=1` strip over the
  real `useMergedResults` + `Hit`.

## Preview shots (real popups over the real engines, driven end to end)

`shot-wedi.mjs` / `shot-schluter.mjs` against `npx vite --port 5199`; every
step asserts before it shoots.

| shot | what it proves |
|---|---|
| `*-1-kit-landed.png` | a kit landed; the harness sheet lists its rows |
| `*-2-sheet-qty-edited.png` | a companion row's qty typed 1 → 3 on the sheet |
| `*-3-reconfigure-shows-sheet-qty.png` | Reconfigure reopens with that line hand-set to 3 (recipe's 1 on hover) |
| `*-4-updated-keeps-qty.png` | Update this kit re-lands the line at 3, same row count |
| `wedi-5-search-panel-half.png` | "wedi panel 1/2": 47700 3'x5' shows as STOCK ("also on wedi pricelist"), no US8000017 special-order row |
| `wedi-6-search-36x60.png` | "wedi 36"x60"": the only hit is the stocked 47700 |

## Verification

- `npm test`: 1343 pass, 0 fail (new: kitRows ×2, wedi rowItemKey/sessionFromRows ×3 + lineItems key, Schluter sessionFromRows, mergeSearch wide index ×2)
- `vite build` exit 0; lint unchanged at the pre-existing 7 errors (none on this change's lines)
