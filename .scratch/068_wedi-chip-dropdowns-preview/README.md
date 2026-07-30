# wedi build column reworks — preview (2026-07-30)

Owner asks: (1) drop the "wedi's boxed kit for this size" compare; (2) an
add-on chip with more than one possible part opens a dropdown instead of
auto-adding a default; (3) the curbless recess kit moves to the add-on chips
(not auto-added to the house kit); (4) the Fastener Kit line shows only its
contents, not the per-ft² planning note.

- `preview.html` / `preview.jsx` — the REAL AppsWorkspace harness (as 067),
  `npx vite --port 5199`; `shot.mjs` drives the shots.
- `preview-1-build-no-boxcompare.png` — fundo kit: no boxed-kit compare,
  Fastener Kit reads "28960 · 100 ct 1 5/8\" Screws & 100 ct. Washers with
  Tabs" (no per-ft² note), no Recess chip on a curbed build
- `preview-2-niche-picker.png` — "+ Niche" opens the picker (8 niches,
  stock first, price on every row)
- `preview-3-niche-added.png` — pick lands, chip flips ✓
- `preview-4-curbless-recess-chip.png` — curbless kit: 12 lines, no recess
  kit auto-added, "+ Recess kit" chip in the add-ons row
- `preview-5-recess-picker.png` — the chip's "Curbless entry" picker:
  bracket kit $508.00 / shower ramp $251.84
- `preview-6-recess-added.png` — the bracket kit lands as an install line
  with its swap arrow (kit / ramp / none still swappable there)
