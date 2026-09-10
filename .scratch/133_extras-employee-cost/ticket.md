---
issue_type: Feature
summary: Extras (grout, base, caulk, mortar, underlayment, install materials,
  add-ons) never repriced under the Employee tier — the catalog stored a price
  and no cost. Add a cost to every extra, filled from the linked book row, so
  Employee prices them at cost × 1.06 like flooring lines.
status: done
labels: [ready-for-human]
---

# Extras cost: Employee pricing covers the extras

Owner, 2026-09-10: "the extras dont seem to price at the different price
levels like employee pricing" → confirmed by design (ADR 0018 item 4: Employee
reprices only rows with a snapshotted vendor cost; the material maps carried a
`price` only). Then: "add a cost field to the extras so employee pricing works,
This should work now because all extras are now linked to books or sheets that
have cost."

## Decisions (owner, 2026-09-10)

- Cost source: the book fills it (pick + re-import sync), a Cost box beside
  each $/unit box overrides / covers unlinked extras.
- An extra with no cost under Employee stays retail and is flagged on the
  extras strip ("· Retail"), the rule flooring lines already follow.
- Builder / Sale / Custom unchanged (retail × percent, cost ignored).

## What shipped

- `catalog.js`: `cost` on grout / mortar / underlayment / custom install /
  add-on / base companion field sets (default 0); the getters expose
  `unitCost`. `model.js`: `grout.caulkCost` beside `caulkPrice`.
- `booklink.js`: `syncLinkedCatalog` refreshes cost with price (silent, no
  `changes` entry); family caulk rows carry cost. `stock.js`:
  `groutSnapshotPatch` stamps `caulkCost`; `stockBaseCompanion` carries cost.
- `pricing.js`: the Employee branch of `tierView` maps every costed material
  entry and the row caulk snapshot to `round2(cost × 1.06)`; identity when
  nothing carries a cost.
- `print.js`: each `printProduct` mat carries `noCost`; `App.jsx` shows
  "· Retail" on the extras strip under Employee.
- `SettingsWorkspace.jsx`: Cost box on every extras editor and add form; every
  book pick writes cost.
- ADR 0018 amendment; data-model skill; src/CLAUDE.md.

## Proof

`1-employee-extras.png` — an Employee job: costed grout + backer repriced,
uncosted mortar + caulk marked Retail. `2-settings-cost.png` — the grout
editor's Cost box. Harness: `npx vite --config .scratch/133_extras-employee-cost/vite.config.mjs`
then `node .scratch/133_extras-employee-cost/shot.mjs`.
