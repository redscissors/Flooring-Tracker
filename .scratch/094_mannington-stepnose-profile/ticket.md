---
issue_type: Bug
summary: Mannington laminate's two stepnose trim columns import with identical
  labels — the Overlap/Flush profile word was being stripped, so the picker
  can't tell the pieces apart.
status: done
labels: [ready-for-human]
---

# Mannington laminate: overlap vs flush stepnose read the same

Reported 2026-08-19: "Mannington laminate, cant tell the difference between the
overlap stepnose and flush stepnose."

## Cause

`trimLabel` in `src/manningtonbook.js` cleaned the stacked trim-column headers
by stripping a word list that included `Overlap`, `Flush`, and the sheet's
`O-lap` shorthand — treating them as annotations with "no product meaning".
On the laminate pages the two stepnose columns differ ONLY by that profile
word ("Stepnose Cn O-lap" vs "Stepnose Flush"), so both trims imported as just
"Stepnose" and the picker showed two identically-named pieces at different
prices.

## Fix

The profile word survives the cleanup: `O-lap`/`Olap` normalizes to
"Overlap", `Flush` is kept, and only the genuinely meaningless tokens (`Cn`,
`Piece`, sizes, quotes) are still stripped. The two columns now import as
"Stepnose Overlap" and "Stepnose Flush". Regression test in
`manningtonbook.test.js` pins both labels and their per-column prices.

## Follow-up for the team

Already-imported Mannington books still hold the merged labels — re-drop the
Cartons Detail PDF once this deploys and the diff will retitle the stepnose
trims.
