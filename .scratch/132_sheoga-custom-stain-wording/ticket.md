---
issue_type: Bug
summary: A Sheoga custom-color line read "Sheoga — Hickory Character Solid
  Custom color T-1 “S-46297 Dark Chacolate” 30 sheen". Marcus wants it to read
  "Sheoga Hickory Character Solid Custom Stain S-46297 Dark Chocolate 30sheen".
status: done
labels: [ready-for-human]
---

# Sheoga job line: "Custom Stain <name> 30sheen", plain "Sheoga " lead

Flagged by Marcus 2026-09-09 from job Q-Sheoga — Hickory Character Sol-9/9,
Area 1 (Claude issue bucket): "I would like this to read as. Sheoga Hickory
Character Solid Custom Stain S-46297 Dark Chocolate 30sheen".

## Decisions (owner, 2026-09-09)

- Custom colors describe as `Custom Stain <typed name>` — no T-1/2/3 tier, no
  curly quotes. The tier still shows in the configurator's cost rows
  ("Finishing — Custom color T-1"). Established stains are unchanged
  ("Prefinished Nutmeg stain").
- Sheen prints as `30sheen` (Marcus's form) in every Sheoga description — floor,
  stocked, herringbone. The order-entry abbreviation stays `30sh`.
- The row-name lead is `Sheoga ` on every Sheoga row (floors, stocked, vents,
  dampers, fee lines), not `Sheoga — `. The job sheet's "Sheoga — reconfigure"
  chip is a button label, not a row name, and keeps its dash.

## Not a code fix

"Chacolate" is the stain name Marcus typed into the configurator. It is stored
data, and agents never write to the live project — Marcus reopens the line
(Sheoga — reconfigure) and corrects the spelling. Existing lines keep the text
they were written with (snapshot rule, ADR 0003); a reconfigure rewrites them
in the new form.

## What shipped

- `src/sheoga.js` — `finishName` custom branch; the `sheen` suffix in
  `calcFloor` / `calcStocked` / `calcHerringbone` and in `floorParts` /
  `stockedParts` (the order-entry `full` strings, which must equal `rest`);
  `shortFinish` abbreviates a custom stain as `Cust <name>`; the five payload
  builders write `Sheoga ${…}`.
- `src/orderentry.js` comment, `src/vendorbookpreview.jsx` fixtures.
- Tests: `src/sheoga.test.js`, `src/orderentry.test.js` updated to the new
  wording plus the "no tier, no quotes" and `Cust` abbreviation cases.

## Proof (real App over a fake Supabase client — `shot.mjs`)

`npx vite --config .scratch/132_sheoga-custom-stain-wording/vite.config.mjs`
then `node .scratch/132_sheoga-custom-stain-wording/shot.mjs`. The seed
rebuilds Marcus's line through `lineItems()` from the same configuration
(Hickory character solid 4¼", T-1, "S-46297 Dark Chocolate", 30, 1474 sf) and
lands at his $9.31/sf and 22 sf/ct.

- `1-job-line.png` — the job sheet: "Sheoga Hickory Character Solid Custom
  Stain S-46297 Dark Chocolate 30sheen"; the fee line "Sheoga Custom
  color-match sample — approval bundle shipped".
- `2-configurator-desc.png` — reopened via the reconfigure chip: '4¼" Hickory
  Character Solid Custom Stain S-46297 Dark Chocolate 30sheen', tier still in
  the cost rows.

Tests: `npm test` — 1377 pass.
