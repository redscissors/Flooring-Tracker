Status: needs-triage
Type: AFK

## What to build

Introduce the **Company → Product catalog** structure into the shared Settings and
render it (read-only) in the Settings screen. Seed it from today's built-in grout
and mortar products, grouped under companies, keeping the **same product names** so
existing jobs keep resolving.

- Catalog data shape inside Shared Settings: companies (name + `enabled`), each
  holding grout or mortar products (name + `enabled` + their numbers — grout:
  coverage; mortar: tiers + price), per ADR 0002 / CONTEXT.md.
- A seed/normalize step that builds the catalog from the current built-ins
  (`GROUTS`/`MORTARS`/`DEFAULTS`) under companies. Extend the existing
  normalization (`mergeSettings`) so older shared records stay valid.
- Replace the current flat grout/mortar rows in the Settings UI with a nested
  **Company → Product** list showing each product's numbers. Read-only here — no
  checkboxes, add, or collapse yet.

## Acceptance criteria

- [ ] Shared Settings carries a catalog of companies-with-products, seeded from the
      built-ins under the same names.
- [ ] The Settings screen shows the catalog as a Company → Product tree with each
      product's numbers.
- [ ] An existing job's grout/mortar still resolves and calculates (names
      preserved by the seed).
- [ ] Loading a shared record saved before this slice still works (normalization
      backfills the catalog).

## Unit testing

The seed/normalize function is pure and the highest-value test target in the
feature: cover (1) it builds the expected companies/products from the built-ins,
(2) every built-in product name survives unchanged (the resolve-by-name
guarantee), (3) it is idempotent and backfills a pre-catalog record without
dropping data. Follow vitest set up in slice 01. No prior art in-app; mirror the
plain-function unit style used in the `.claude/mcp-servers` test suites
(describe/it, direct assertions, no mocking needed for pure functions).

## Blocked by

- 01-shared-settings-store.md
