Status: done

Print estimate: drop the material-type label on product lines + tighten card
density (owner, 2026-08-17, off a Tile Shower printout): "it shows the type of
material it is, whether it's tile or miscellaneous or vinyl. I don't want that
to show on the print page. ... the padding I feel like is still a little bit
high ... Let's try just maybe tightening up the padding a little bit first."
The pain case is a component-heavy area (wedi shower waterproofing) where every
one-piece line reads "— miscellaneous" and costs a full card of vertical space.

## Changes (src/EstimatePrint.jsx, cards layout only)

- The "— miscellaneous" suffix after the product name is gone. The other type
  labels STAY (owner follow-up, same day: "everything but the miscellaneous as
  far as the labels can stay" — a real type reads as information, misc reads
  as unimportant). `TLBL[p.type]` still prints as the name when a row has no
  brandColor, so an unnamed row doesn't go blank.
- Card vertical padding 4px → 2.5px; chip row margin 4 → 3; note margin 3 → 2;
  area block margin 7 → 5.
- Explicit `lineHeight: 1.3` on the spec line, note, and every right-rail line
  (qty · unit price · line total). These inherited Tailwind's root 1.5, so each
  10px line was billing 15px; type sizes are unchanged.

The classic table layout is untouched (it's the retired fallback behind
`ESTIMATE_PRINT_LAYOUT`).

## Proof

Harness: `preview.html`/`preview.jsx` — the REAL EstimatePaper over the 090
fixture (8 areas / 20 lines) plus an appended 9-line wedi "Shower
waterproofing" area mirroring the owner's screenshot; `measure.mjs` is 090's
rig pointed here. `npx vite --port 5199`, then `node measure.mjs before|after`.

| | before | after |
|---|---|---|
| whole sheet | 1830px (1.93 pages) | 1634px (1.72 pages) |
| waterproofing area (9 misc lines) | 422px | 355px (−16%) |

`shot-before.png` / `shot-after.png`, `sheet-*.pdf` for true page counts.

## Follow-up: footer pinned to the last page's bottom (owner, same day)

"Could that line actually move to the bottom of that print page ... if you have
a page and a half of stuff I'd want it to drop down to the bottom of the second
page." CSS can't address "the last page" in paged media, so `usePinFooter`
(EstimatePrint.jsx) does it at print time: on `beforeprint` the hidden print
wrapper is laid out offscreen in page-height CSS COLUMNS — column
fragmentation applies the same break-inside/break-after rules as printing, so
a card that jumps a page turn jumps a column the same way (plain flow-height
arithmetic missed those orphan gaps and overshot onto a blank third page — the
first attempt did exactly that). The footer's landing spot in its last column
is its landing spot on the last page; the leftover below it becomes footer
margin-top, and `afterprint` resets it. Only the print-view EstimatePaper gets
`printSheet` (App.jsx); the preview tab is untouched. Ctrl+P and the Print
buttons both pass through beforeprint. The 24px slack under the footer covers
the wrapper's trailing 8px padding + print-stylesheet borders + rounding, so
the push can't create a blank extra page; non-Letter paper (A4 is taller)
just leaves the footer a bit higher.

Proof (Chromium fires beforeprint inside page.pdf, so the harness PDFs
exercise the real path; `--pin` also dispatches it explicitly, `--short`
prints the one-area job): `sheet-pin-short.pdf` — 1 page, content ends y370pt,
footer at y730pt (printable bottom 752pt); `sheet-pin-full.pdf` — 2 pages,
footer y735pt at the bottom of page 2, no blank page 3. Page counts verified
with pdfjs (`pdfpages.mjs`; the old `/Type /Page` regex miscounts on
compressed PDFs — `measure.mjs`'s "PDF pages" line is only indicative).
`pdftext.mjs` dumps per-page text runs with y-positions.
