---
issue_type: Feature
summary: Selection sheet — material-column rules only beside a material, columns
  sized to keep each material to two lines, "Mortar" → "Adhesive", tighter cell padding.
status: needs-triage
labels: [ready-for-human]
---

# Selection sheet — dynamic material columns

Owner, 2026-10-01 (on a printed N259 "Test" breakdown):
- a material column shows a horizontal rule only if there's a product above or below it
- columns size themselves so each material tries to stay to two lines
- "Mortar" column reads "Adhesive" (it's glue for hardwood and vinyl too)
- less padding in the columns

Owner answers: Adhesive in BOTH the column heading and the job-order list group;
cap the column widths (an outlier may take a 3rd line) rather than squeeze products;
"show both" line options.

## Mockups (throwaway — EstimateColumnsVariants.jsx, not product code)
`npx vite --config .scratch/164_selection-sheet-dynamic-columns/vite.config.mjs`
then `PW=/opt/node22/lib/node_modules/playwright node .scratch/164_selection-sheet-dynamic-columns/shot.mjs`

Seed's short catalog names are swapped for the live books' longer names in the
variant only. Widths: measured with canvas (Manrope 7.6px), name in ≤2 lines or
name + grout sub one line each; clamp 56–150px per column, 330px total.
- `before.pdf` — today
- `A-material-lines.pdf` (`?lines=mat`) — product rows keep every rule; material
  cells rule only beside a material
- `B-both-sides.pdf` (`?lines=both`) — product rows drop their rule too unless a
  material sits beside it
- `compare.png` — today / A / B close-up

Awaiting owner pick (recommended: A).
