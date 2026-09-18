---
issue_type: Feature
summary: Sheet/roll membranes (Ditra Heat sheet 23031, Kerdi roll 1509781)
  land as an Underlayment row that orders whole sheets/rolls from typed sq ft,
  links its Materials-tab entry for install mortar, and saved count lines
  switch over on a click.
status: done
labels: [ready-for-human]
---

# Underlayment row type

Marcus, 9/18/2026, on "Q-120V Ditra Heat Cable 42.7 sf-9/18 · Area 1 ·
Schluter Ditra Heat - Membrane Sheet": "it would nice if this showed
coverage." Owner: "1509781 same for this sku"; then "can this be done like a
carton of tile where I can input how much sf I want and it figures the
amount needed"; label Underlayment so it "can work together with
Underlayments in the materials tab … figure mortar and trowels"; no waste;
trowels later; switch chip converts count × coverage.

Spec: `docs/superpowers/specs/2026-09-18-underlayment-row-type-design.md`.
ADR: `docs/adr/0043-underlayment-product-type.md`.

## Proof

`01-grid.png` — the picked sheet row: coverage `8.4 SF/SH`, 42 sf typed,
order `5 SH (5.00)`; the saved count line below it with the chip "Book
sells this by the SH — 8.4 sf · Switch to sq ft"; the Install materials
card off the row's own 42 sf (Schluter All Set, exact 0.84 → 1 bag).
`02-switch-after.png` — the saved count line after "Switch to sq ft":
stored `type: "underlayment"`, `qty: "42"`, `qtyType: "sqft"`, order
unchanged at `5 SH (5.00)`, chip gone.
`03-drawer.png` — the Install materials card cropped.
`04-print.png` — the real EstimatePaper: the membrane line "Schluter Ditra
Heat - Membrane Sheet — underlayment · 3'3"x2'7" · 8.4 SF/sh · SKU 23031 ·
42 SF ordered · 5 sheets · $2.56/sf · $21.50/sh · $107.52", Schluter All
Set 1 bag in Extras, and the harness readout `totalSqft: 42 ·
orderedSqft: 46.5` (the tile's floor measured once; the membrane's 42 sf
never re-counts).

Rebuild: `npx vite build --config .scratch/144_underlayment-row-type/proof-vite.config.mjs`,
serve `proof-dist` on :8392, `node .scratch/144_underlayment-row-type/shot.mjs`.

## Follow-ups

- Trowels / per-order tools: a fixed-quantity install item kind (Settings).
- Mobile has no drift chips, so the switch chip is desktop-only.
- The import word list carries a bare `backer`; a future accessory named
  e.g. 'backer rod' with coverage on a bundled unit would type as
  underlayment.
- Trowels: a fixed-quantity install item kind.
