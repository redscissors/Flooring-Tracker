# Architecture Decision Records

System-wide ADRs. Area-scoped ADRs live under `docs/<area>/adr/`.

| # | Title | Status | Date |
|---|---|---|---|
| [0001](0001-archived-as-ungated-column.md) | `archived` is a top-level column, deliberately outside the owner guard | Superseded by 0004 | 2026-06-22 |
| [0002](0002-shared-grout-mortar-catalog.md) | Shared grout/mortar catalog: one shared store, linked by unique name | Accepted | 2026-06-23 |
| [0003](0003-stock-price-book-snapshot.md) | Stock price book: shared `stock_items` table, SKU fills by snapshot, re-imports never rewrite estimates | Accepted | 2026-07-03 |
| [0004](0004-all-customers-team-shared.md) | All customers are team-shared; visibility and archive removed | Accepted | 2026-07-05 |
| [0005](0005-builder-customer-project-hierarchy.md) | Builder ▸ Customer ▸ Project hierarchy; today's "customer" becomes a Project | Accepted | 2026-07-07 |
| [0006](0006-catalog-sku-link-and-grout-base-companion.md) | Catalog products carry a price-book SKU; grout products carry a "base unit" companion | Accepted | 2026-07-08 |
| [0007](0007-grout-colors-from-book-family.md) | Grout colors and per-color SKUs come from a linked price-book family; color pick snapshots the SKU onto the Selection | Accepted | 2026-07-08 |
| [0008](0008-salesperson-snapshot-on-project.md) | The salesperson is snapshotted onto the Project at creation | Accepted | 2026-07-12 |
| [0009](0009-price-book-library.md) | Price book library: kind-aware book registry, cost + markup for special order, versions with keepers | Accepted | 2026-07-12 |
