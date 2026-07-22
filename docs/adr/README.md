# Architecture Decision Records

System-wide ADRs. Area-scoped ADRs live under `docs/<area>/adr/`.

| # | Title | Status | Date |
|---|---|---|---|
| [0001](0001-archived-as-ungated-column.md) | `archived` is a top-level column, deliberately outside the owner guard | Superseded by 0004 | 2026-06-22 |
| [0002](0002-shared-grout-mortar-catalog.md) | Shared grout/mortar catalog: one shared store, linked by unique name | Accepted | 2026-06-23 |
| [0003](0003-stock-price-book-snapshot.md) | Stock price book: shared `stock_items` table, SKU fills by snapshot, re-imports never rewrite estimates | Superseded by 0027 | 2026-07-03 |
| [0004](0004-all-customers-team-shared.md) | All customers are team-shared; visibility and archive removed | Accepted | 2026-07-05 |
| [0005](0005-builder-customer-project-hierarchy.md) | Builder ▸ Customer ▸ Project hierarchy; today's "customer" becomes a Project | Accepted | 2026-07-07 |
| [0006](0006-catalog-sku-link-and-grout-base-companion.md) | Catalog products carry a price-book SKU; grout products carry a "base unit" companion | Accepted | 2026-07-08 |
| [0007](0007-grout-colors-from-book-family.md) | Grout colors and per-color SKUs come from a linked price-book family; color pick snapshots the SKU onto the Selection | Accepted | 2026-07-08 |
| [0008](0008-salesperson-snapshot-on-project.md) | The salesperson is snapshotted onto the Project at creation | Accepted | 2026-07-12 |
| [0009](0009-price-book-library.md) | Price book library: kind-aware book registry, cost + markup for special order, versions with keepers | Accepted | 2026-07-12 |
| [0010](0010-pdf-price-list-import.md) | Import product data from text-based vendor PDFs, header-driven, feeding the existing mapped-import wizard | Accepted | 2026-07-13 |
| [0011](0011-margin-visibility-ephemeral.md) | On-screen materials margin is ephemeral, default-hidden, never printed | Accepted | 2026-07-13 |
| [0012](0012-mannington-cartons-import.md) | Mannington Cartons Detail: a fixed-grid PDF parser that also imports color-matched trims as their own products | Accepted | 2026-07-14 |
| [0013](0013-unit-combo-pricing-semantics.md) | Unit-combo pricing: piece prices scale by PC/CT; unknown combos warn at import | Accepted | 2026-07-14 |
| [0014](0014-mosaic-sheet-size-derived-coverage.md) | A mosaic's SHEET dimension gives coverage, never the tile size | Accepted | 2026-07-15 |
| [0015](0015-penny-round-size-and-grout-uplift.md) | Penny rounds: one "Penny" shape, with a corner-fill grout uplift | Accepted | 2026-07-15 |
| [0016](0016-custom-material-categories.md) | Custom material categories: present-only unification over three locked built-ins | Accepted | 2026-07-15 |
| [0017](0017-flag-review-verdicts.md) | Flag-review verdicts: per-item, per-code confirm/ignore that survives re-import | Accepted | 2026-07-16 |
| [0018](0018-price-tiers-display-lens.md) | Price tiers are a display lens; retail stays the stored price | Accepted | 2026-07-16 |
| [0019](0019-vendor-sheet-fetch-relay.md) | Vendor sheet fetch: bookmarklet discovers portal links, a Netlify Function relays the bytes | Accepted | 2026-07-17 |
| [0020](0020-vendor-sheet-groups.md) | Vendor sheets: remembered sheets organized into sign-in groups, on a Price-book tab | Accepted | 2026-07-17 |
| [0021](0021-vendor-sheets-board-selection.md) | Vendor sheets: board columns, batch selection, always-live downloads; menu move replaces drag | Accepted | 2026-07-17 |
| [0022](0022-quick-price-draft-lifecycle.md) | Quick Price: a customer-less draft Project (`quick` flag, no SQL), lands in search, promotes via `linkProject`, self-clears in 30 days | Accepted | 2026-07-18 |
| [0023](0023-apps-hub-label-generator.md) | Apps hub Label Generator: labels in a new shared table, size presets in shared settings, structured savable presets over a free-drag designer | Accepted | 2026-07-19 |
| [0024](0024-pricebook-one-library.md) | One price-book library: sign-in board absorbs the vendor-sheets tab and sidebar list; fetches park in a review-when-ready pool instead of opening review immediately | Accepted | 2026-07-19 |
| [0025](0025-import-source-provenance.md) | A book declares the files it is made of; imports are completeness-checked before review, and gaps are filled or consciously dropped | Accepted | 2026-07-19 |
| [0026](0026-two-stage-boot-and-loading-policy.md) | Two-stage boot; unbounded data is never eagerly loaded; new surfaces ship as lazy chunks | Accepted | 2026-07-20 |
| [0027](0027-catalog-stock-book-links.md) | Catalog products link to ERP stock-book rows; grout families are rule-projected book slices | Accepted | 2026-07-21 |
| [0028](0028-open-layer-restore-and-one-press-escape.md) | Refresh restores the open overlay (`ft-open-layer`); Escape closes a layer in one press from inside a text field | Accepted | 2026-07-22 |
