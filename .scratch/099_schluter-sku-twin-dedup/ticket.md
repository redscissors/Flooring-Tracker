---
issue_type: Bug
summary: The Schluter configurator (and the row search) showed the same part
  twice — once from stock, once special order — because the vendor's EFT sheet
  re-letters the mfg code (SLR prefix added, slashes shed), so exact-SKU
  dedup never collided.
status: done
labels: [ready-for-human]
---

# Schluter config doubles items — vendor re-letters the SKU

Reported 2026-08-21 with a screenshot of the Kits tab: the same 38"×32" tray
as both `KST965/810BF` (stock, $119.32) and `SLRKST965810BF` (special order,
$126.78). The stock export states the manufacturer code with its slash; the
dealer EFT adds its `SLR` reseller prefix and drops the separators. Every
dedup in the app compared raw SKU strings, so the twin survived everywhere.

## Change

One canonical key set per stated code — `skuKeys` in `src/orderbook.js`: the
spelling itself, its separator-free uppercase form (lettered codes only, so
the shop's all-digit internal numbers never gain a fuzzy form), and that form
less a leading `SLR` reseller prefix. Exact-membership over stated codes,
never similarity — the `codeVariants` (trims.js) precedent. Applied at:

- `mergeSearch` — the row search's stock-vs-order collision now keys the
  stock row's `vendorSkus` (the sheet-stated mfg codes) too, in any spelling;
  the EFT twin folds into the stock hit's "also on {book}" note.
- `sameProduct` — two order books carrying the same code in different
  spellings collapse (descriptions still must corroborate).
- `dropStockTwins` (new, `src/schluteradapter.js`) — the Schluter catalog
  assembly (`useSchluterCatalog`) drops adapted special-order entries whose
  code is a stocked entry in another spelling; stock wins.

ADR 0009 gained an amendment recording the key-set doctrine.

## Proof

`shoot-kits.mjs` off the `schluter-preview.html` harness, which now carries
the live EFT twin row permanently (a second 38"×32" Kits row is a regression):

- `before.png` — 18 trays, two 38"×32" rows (stock $119.32 + SO $126.78)
- `after.png` — 17 trays, one 38"×32" row (stock, $119.32)

Tests: `skuKeys` variants + the EFT-twin collision in `orderbook.test.js`,
`dropStockTwins` through the real `normOrderItem`/`adaptRow` path in
`schluteradapter.test.js`. Full suite green (1064 tests).
