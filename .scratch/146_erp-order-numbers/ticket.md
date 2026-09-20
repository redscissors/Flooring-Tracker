---
issue_type: Feature
summary: ERP 1 order numbers on the project — the order-entry panel's header
  bar (Deliver to · ERP 1 order · Project + View), copies gated on numbered
  projects until a number is entered, each copied line stamped with its order
  and remembered across reopen, Copy remaining, the header chip and a
  searchable customer-browser column.
status: done
labels: [ready-for-human]
---

# ERP 1 order numbers

Owner, 2026-09-19. Spec: `docs/superpowers/specs/2026-09-19-erp-order-numbers-design.md`;
mockup `.scratch/mockups/erp-order-2026-09-19.html` (five rounds, 1D-A picked);
ADR 0044.

## Preview proof

`shot.mjs` over `order-entry-preview.html` (Vite on :5199):
`locked.png` (numbered, no order), `one.png` (one order, stamps),
`two.png` (the split, popover open on a keyed line), `quick.png` (ungated,
empty Deliver to), `fold.png` (phone width), `browser.png` (the ERP order
column and search, samples-preview harness).

Widened (controller ruling, Task 10) to also prove the project-header ERP
chip from Task 9: `header.png` (header-preview.html, the one-bar and classic
headers, both carrying the chip) and `mobile-band.png` (the Fold 5 cover-width
band, one order).

## Verification

`npm run lint && npm test && npm run build` — lint: 9 pre-existing errors in
unrelated files (App.jsx `claimProjectNo`, WediConfigurator.jsx, grid.jsx,
prototypes.jsx, wedi.test.js), none new; build: clean (`VITE_SUPABASE_URL`/
`VITE_SUPABASE_ANON_KEY` exported from netlify.toml). Test summary:

```
# tests 1500
# suites 0
# pass 1500
# fail 0
# cancelled 0
# skipped 0
# todo 0
```
