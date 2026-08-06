# 080 — wedi configurator: plain curb names, full foam → lean → AT order

Status: done (2026-08-06)
Opened: 2026-08-06 (owner)
Area: wedi configurator (issue 066)

## The ask (owner)

> A lot of the descriptions are confusing, but especially for the curbs. The
> 60" curb — Fundo Shower Curb 60, SKU 47730 — should read "60 inch full foam
> curb". None of the curbs need to say Fundo Shower. The lean curb can just say
> "60 inch lean curb", the AT curbs "60 inch lean AT curb" / "60 inch full foam
> AT curb". Full foam, then lean, then AT curbs, in that order. And when you
> swap/change a drain from the build column, it should show the same way.

## What changed

1. **`src/wedi.js`** — `CURB_NAMES`: a display-name override per curb SKU,
   applied in `makeEntry`'s curb branch, so every surface that renders a curb
   (build column, swap popover, Browse, print layout, copy list, product rows)
   shows `<length>" <profile> Curb` instead of the pricelist's
   "wedi Fundo® Shower Curb Lean AT 60"" strings. The transcribed pricelist
   rows themselves are untouched — this is a display layer, and the erp/US
   SKUs still show and search.

   | SKU | was | now |
   |---|---|---|
   | 47730 / US3000039 | wedi Fundo® Shower Curb 60" | 60" Full Foam Curb |
   | 29541 / US3000041 | wedi Fundo® Shower Curb 96" | 96" Full Foam Curb |
   | 29118 / US3000038 | wedi Fundo® Shower Curb Lean 60" | 60" Lean Curb |
   | 28795 / US3000040 | wedi Fundo® Shower Curb Lean 96" | 96" Lean Curb |
   | 28776 / US3000048 | wedi Fundo® Shower Curb AT 60" | 60" Full Foam AT Curb |
   | 28777 / US3000049 | wedi Fundo® Shower Curb Lean AT 60" | 60" Lean AT Curb |
   | 47729 / US3000008 | wedi Fundo® Shower Curb Cap 60" | 60" Curb Cap |
   | US3000010 | wedi Fundo® Shower Curb Cap 96" | 96" Curb Cap |

2. **`src/wedi.js`** — `curbs()`: the curb list in profile order — full foam
   (60, 96), lean (60, 96), AT (full before lean), caps last.

3. **`src/WediConfigurator.jsx`** — the build column's Curb swap popover lists
   `curbs()` instead of raw catalog order.

Because the rename lives on the catalog entry, a drain change (re-solve) or
any swap re-emits the curb line with the same name — nothing shows the old
string anywhere.

## Proof

`shoot.mjs` → `shots/` (real configurator over the dev server):
`1-build-column.png` (kit's curb line reads "60" Lean Curb"),
`2-curb-swap-order.png` (popover: full foam 60/96 → lean 60/96 → full AT →
lean AT → caps), `3-after-drain-change.png` (linear-drain re-solve keeps the
plain name). `wedi.test.js` pins the eight names and the order.
