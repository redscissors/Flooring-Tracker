---
issue_type: Feature
summary: The printed selection sheet shows install materials in Grout · Mortar ·
  Underlay columns beside each product (exact amounts), one priced job order
  list below, special-order marks, and charges materials by the rounded job
  order (ADR 0053).
status: done
labels: [ready-for-human]
---

# Selection sheet — material columns (G3c)

Owner, 2026-09-30: the Extras box read as a second charge, didn't explain grout
color kit vs. base, and nothing marked special orders. Owner pick "G3c" after
five rounds of mockups (`.scratch/mockups/print-sheet-options-2026-09-30.html`,
`.scratch/mockups/selection-sheet-g3c-2026-09-30.html`).

- Spec: `docs/superpowers/specs/2026-09-30-selection-sheet-material-columns-design.md`
- Decision: `docs/adr/0053-materials-charge-the-rounded-job-order.md`
- Plan: `docs/superpowers/plans/2026-09-30-selection-sheet-material-columns.md`

Preview proof: the REAL App over a fake Supabase (N259-shaped job, a stock book
so only the Sheoga floor and the unstocked WOW tile are special orders) —
`npx vite --config .scratch/162_selection-sheet-columns/vite.config.mjs`, then
`node .scratch/162_selection-sheet-columns/shot.mjs`.

- `full.png` / `full.pdf` — full pricing; the print is one letter page
- `unit.png` / `unit.pdf` — unit prices only (no qty/totals, list shows Each)
- `none.png` / `none.pdf` — no prices (qty kept, list names items only)
- `options.png` / `options.pdf` — quote options A/B (shared list, per-option
  lists, option totals, comparison); two pages
