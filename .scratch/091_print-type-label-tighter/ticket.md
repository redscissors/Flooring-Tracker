Status: done

Print estimate: drop the material-type label on product lines + tighten card
density (owner, 2026-08-17, off a Tile Shower printout): "it shows the type of
material it is, whether it's tile or miscellaneous or vinyl. I don't want that
to show on the print page. ... the padding I feel like is still a little bit
high ... Let's try just maybe tightening up the padding a little bit first."
The pain case is a component-heavy area (wedi shower waterproofing) where every
one-piece line reads "— miscellaneous" and costs a full card of vertical space.

## Changes (src/EstimatePrint.jsx, cards layout only)

- The "— tile / — miscellaneous / — vinyl" suffix after the product name is
  gone. `TLBL[p.type]` still prints as the name when a row has no brandColor,
  so an unnamed row doesn't go blank.
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
