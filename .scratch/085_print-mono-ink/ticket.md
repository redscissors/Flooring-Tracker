Status: done

The estimate printed "kinda light and uneven" on non-color printers — where
most of these sheets actually land (owner, 2026-08-10). Issue 033 had already
darkened the paper text tokens, but the sheet still carried mid-tones a
grayscale laser can only halftone: moss-green section labels (~70% gray after
conversion), the #EDE9DE band/box tints (sparse speckle), 10–40%-alpha
hairlines (dithered into dotted lines), and the option bands' colored fills
under white knockout text. Solid black text next to dithered gray labels is
exactly the "light and uneven" feel.

The fix — print media is now ink-only (`@media print` in src/index.css,
scoped to `.ft-light`):

- Every text token (`--ft-paper-ink/muted/faint`, `--ft-brand`,
  `--ft-brand-deep`, `--ft-logo`) prints 100% black; hierarchy is carried by
  the size/weight scale the sheet already uses.
- Rules (`--ft-paper-rule/footer`, `--ft-border`) print solid black instead
  of alpha grays.
- Tinted fills flip to white boxes with a 1px rule: the Extras /
  materials-for-option boxes (`.ft-pbox`), the grout/mortar chips
  (`.ft-pchip`, outlined pill), and the Rough Estimate badge (`.ft-pbadge`).
- The area bands and option band headers invert to white-on-ink
  (`.ft-pband`) — solid black prints crisp and gives the sheet its weight
  back; options stay told apart by their A/B/C labels.
- Option box borders and labels print black (`.ft-popt`/`.ft-pink`).

The on-screen Print preview keeps the color design — the rules bite only in
print media — and a color printer now gets the same crisp black sheet.
EstimatePrint.jsx only gained the hook classes; both layouts (cards +
classic) and the order sheet (same `.ft-light` wrapper) pick the remap up.

Preview proof — `preview.html`/`preview.jsx` render the REAL `EstimatePaper`
over fixture jobs built through the real math (jobTotals/bucketCats),
mirroring App.jsx's paperProps/optionPrint construction; `shot.mjs` shoots it
off `npx vite --port 5199` in screen media, print media, and print media
through a grayscale filter (how a mono laser sees it).

- `before-plain-print-gray.png` / `before-options-print-gray.png` — the old
  sheet in grayscale: gray labels, speckle-prone band tints, mid-gray option
  bands.
- `after-plain-print.png` / `after-options-print.png` — the ink-only print:
  solid black bands, outlined chips/boxes, black rules and labels.
- `after-plain-screen.png` / `after-options-screen.png` — the on-screen
  preview, unchanged (moss labels, colored option bands).

Tests pass (`npm test`, 0 fail). `npm run lint` and `npm run build` failures
are pre-existing (unused wedi/prototype symbols; `%VITE_SUPABASE_URL%`
placeholder with no env in the container) — verified identical with the
change stashed.
