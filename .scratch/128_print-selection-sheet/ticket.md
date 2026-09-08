Status: done

Build the selection-sheet print design the owner picked from the .scratch/126
prototypes (2026-09-08) into the production estimate paper.

## What changed (src/EstimatePrint.jsx, cards layout)

- **Masthead.** "FLOORING & TILE" eyebrow, "SELECTION SHEET" as the hero
  title, tagline "Rough pricing and quantities for planning purposes only";
  Keim mark at the right over N-number + date (+ the tier tag when prices
  print). The tan Rough Estimate badge is gone — the tagline is the
  disclaimer now (`.ft-pbadge` print rule dropped from index.css with it).
- **People row.** Customer stack left, project name center (+ the option scope
  note, or "N areas selected" on a plain print), salesperson right-aligned —
  no small-caps run labels (owner: the names speak for themselves).
- **Watermark.** Faint diagonal SELECTIONS (6% black, 86px/-30°) behind the
  body: `.ft-pwm-screen` copies one per 950px stripe on the Preview tab
  (EstimatePrint counts them from the paper's height), one `position:fixed`
  `.ft-pwm-print` copy in print media, which Chromium repeats on every page.
  Rules in index.css; the mono-ink remap leaves the 6% alone.
- **Footer.** "Prepared with [ned]" is gone (owner: the customer doesn't need
  to see that), and with it `usePinFooter` + the `printSheet` prop App.jsx
  passed to the print copy.

## Proof

`preview.html`/`preview.jsx` render the REAL EstimatePaper over the 090
fixture (8 areas, 20 lines); `shot.mjs` shoots screen media (Preview tab),
print media page 1 + 2 at page offsets, and PDFs for the page count.
`shot-options.mjs` runs the 127 options harness (real paper, shared area with
materials) so the option-print masthead is covered too.

- `sheet-print-p1.png` / `sheet-print-p2.png` — print media, watermark on
  both pages, no footer; still **2 pages** (same as before the change).
  Header (top of the first band) 134px vs 108 before.
- `sheet-screen.png` — the on-screen Preview tab (moss eyebrow, 2 stripes).
- `options-with-shared-print.png` / `-screen.png` — quote-options print with
  the new masthead; no area count there (it would count only the shared
  bucket).

`npm test`: 1375 pass, 0 fail. `npm run lint`: 7 errors, all pre-existing
(identical with the change stashed).
