---
issue_type: Feature
summary: The Schluter EFT's non-profile rows (KERDI, KERDI-BOARD, KERDI-LINE,
  drains, DITRA, kits) get the ADR 0041 cleanup too, and the configurator
  popup stops repeating the "Schluter" lead.
status: done
labels: [ready-for-human]
---

# Schluter EFT: the Kerdi rows, and the popup lead

Owner, 2026-09-14: "apply the same cleanup to the Kerdi rows too … yes strip
the lead in the popup and build it." Follows issue 135 / ADR 0041 (amended).

## What changed

- `schluterAccessory` (pricebook.js): spaced inch words and space-spelled
  fractions marked; pack counts out of the name into pcPerUnit and an "N ct"
  size; curb/bench triples and trowel-notch pairs kept as text; a lone
  fraction never a thickness; KERDI-LINE grate length as size; more shorthand.
- Generic splitter fixes: mixed-number tail / width never a thickness, marked
  triple up to 2" is a board, bare roll side is inches, "N FT M ROLL".
- `SchluterConfigurator.jsx`: `shown()` strips the "Schluter" lead on every
  displayed name (build lines, kits list, extras chips, cut list, print
  sheet). Display only.
- `schluterpreview.jsx`: harness rows carry the lead like live rows.

## Diff gate (sheetimport §6), whole real files, against the post-#378 parse

- Schluter EFT, 7,033 rows: 811 descriptions, 588 sizes, 312 thicknesses,
  27 pcPerUnit changed; 3 wizard warnings (the same pre-existing hazards);
  0 advisories.
- ERP stock export, 525 rows: one row, the garbled `2"x2x8' Kerdi Board`
  line, reads `2"x8'` instead of `2x8'`.
- Configurator (adapter + classify over both parses): 331 parts both ways;
  6 real differences, all fixes (1.5"/2" boards 24.5×96 instead of a 0.3 sf
  sliver; fastener boxes count 40/100 instead of 0); 112 display-text-only.

## Preview proof

`popup-no-lead.png` — the real popup over harness rows that lead with
"Schluter": 0 of 8 build-line names carry the lead; the kits list and cut
list strip it too. Shot by `shot.mjs` (vite on :5199).

Tests: pricebook.test.js (accessory workbook of real rows, generic splitter
goldens). 1,413 pass. No SQL. Reaches the live book on the next re-drop.

## Addendum — the CTNS EFT (owner, 2026-09-14)

"Make sure the CTNS EFT 26 01 15 price book also works like this, it also has
Schluter." It is Virginia Tile's multi-brand "Horizon (CTNS) Display" EFT:
10,013 rows across 20+ manufacturer codes, 5,629 of them coded SLR. The brand
line is not Schluter's, so the rules now gate per row on the VTC MFG code
(ADR 0041 amendment). Whole-sheet diff, deployed parser vs this branch:

- 5,583 SLR rows: every one loses the wrong "tile" type (all 5,583 were typed
  tile before), 4,708 sizes and 3,940 thicknesses land, every description
  reads like the Schluter EFT's.
- 4,384 rows of the other brands: byte-identical. Advisory counts identical
  (452 sheet-coverage, 22 trim-as-area, 25 name-litter — all pre-existing on
  the tile brands, none Schluter's).
- The Schluter EFT and the ERP stock export parse identically, apart from 8
  descriptions the sheet's dotted / comma'd shorthand improved ("PVC,",
  "CRN/SEAL", "ST. STEEL").

The configurator only reads order books named with "Schluter", so the CTNS
book's Schluter rows are search-and-order rows, not configurator parts.
