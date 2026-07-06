# Architecture Decision Records

System-wide ADRs. Area-scoped ADRs live under `docs/<area>/adr/`.

| # | Title | Status | Date |
|---|---|---|---|
| [0001](0001-archived-as-ungated-column.md) | `archived` is a top-level column, deliberately outside the owner guard | Superseded by 0004 | 2026-06-22 |
| [0002](0002-shared-grout-mortar-catalog.md) | Shared grout/mortar catalog: one shared store, linked by unique name | Accepted | 2026-06-23 |
| [0003](0003-stock-price-book-snapshot.md) | Stock price book: shared `stock_items` table, SKU fills by snapshot, re-imports never rewrite estimates | Accepted | 2026-07-03 |
| [0004](0004-all-customers-team-shared.md) | All customers are team-shared; visibility and archive removed | Accepted | 2026-07-05 |
