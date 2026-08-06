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

## Round 2 (same day)

- Curbs: the second line is just the SKU — `sizeText` blanked, the length
  already leads the name.
- Building panels read by the foot — `4'x5'x1/2" Building Panel` — derived
  from the parsed dims in `makeEntry` (an off-foot side stays inches:
  `32"x4'…`; Vapor 85 keeps its line name; the US4000 panel kits are
  untouched). The SKU and the inch dimensions stay on the second line in the
  build column and both popovers. Because both treatments live in the
  display layer (SKU-keyed map / dims-derived), a pricelist re-transcription
  keeps them with no extra work.

## Round 3 (same day) — bases, drain covers, niches

- **Bases** read size-first: `36"x60" Shower Base` (family word keeps
  Curbless / Linear / S-Dry), `— Offset Drain` named on the name since two
  same-size bases can differ only there. Second line: SKU + full inches with
  thickness. The Kits tab's name-mismatch tag retired (names now differ by
  size alone — the drain tag stays); the option-card titles and build-column
  header stopped appending the size a name now carries; the kit's pan line
  note no longer repeats the size.
- **Drain covers** drop the vendor finish codes: `4"x4" Drain Cover —
  Stainless`, `43" Linear Drain Cover — Matte Black` (`FIN_SHORT`); the full
  finish description ("Stainless, brushed natural") stays on the second line
  and the kit line's duplicated finish note is gone. Cover FRAMES untouched.
- **Niches** lead with the EXTERIOR — the wall opening — and spell the
  interior out beneath: `16"x12" Shower Niche` / `interior 12" x 8"` · SKU.
  Interior parses off the vendor name, falling back to the 4" flange rule
  (every wedi niche is interior + 4"); the ERP-only 16"x8" and the
  `12"x26"CAT` (Cathedral) rows normalize with the rest.
- Browse rows with size-led names show the name alone (the old size · name
  lead would have doubled it) and move the fuller size text to the sub line.

All derived in `makeEntry` — a pricelist re-transcription keeps everything.
`shoot2.mjs` / `shoot3-browse.mjs` → shots 4–9.

## Proof

`shoot.mjs` → `shots/` (real configurator over the dev server):
`1-build-column.png` (kit's curb line reads "60" Lean Curb"),
`2-curb-swap-order.png` (popover: full foam 60/96 → lean 60/96 → full AT →
lean AT → caps), `3-after-drain-change.png` (linear-drain re-solve keeps the
plain name). `wedi.test.js` pins the eight names and the order.
