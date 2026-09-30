# Install materials charge the rounded job order

- **Status:** Accepted
- **Date:** 2026-09-30
- **Scope:** system-wide (job totals, print, quote options)
- **Related:** spec `docs/superpowers/specs/2026-09-30-selection-sheet-material-columns-design.md`;
  extends ADR 0006's `ceil(kits / per)` job rounding to grout, mortar and underlayment.

A material's charge is its job order — the exact amounts every line needs, added up
and rounded up once — times its unit price. Before this, the job total added up each
line's own rounded amount (3 + 1 + 2 + 1 + 1 = 8 bags) while the Extras list and order
entry showed and keyed the job order (7 bags), so the customer paid for material the
desk never ordered (N259: $179.82). The owner chose to charge exactly what is ordered,
so the printed list reads Needed → Order → Each → Total without a gap.

## Considered options

- **Keep charging per line** and make the order match it (order 8). Rejected: it orders
  material the job doesn't need; it only fits when every area is installed separately and
  an opened bag or kit can't carry over.
- **Charge the exact amount** (6.4 bags). Rejected: materials sell in whole units.

## Consequences

- Quote totals drop on any job where two or more lines share a material. Totals are
  never stored — a saved version keeps the job's areas, not its money — so every job and
  every reopened version re-totals under this rule.
- Caulk stays charged per row: its count is typed per row (never computed), so its
  charge is the rows' own tubes × price, and the printed list carries the same figure.
- The rounding cushion per line is gone — any deliberate spare comes from the waste
  factor or a manual quantity override.
- Rounding happens once per totals bucket: the whole job, or on a quote-options job the
  shared areas and each option separately.
