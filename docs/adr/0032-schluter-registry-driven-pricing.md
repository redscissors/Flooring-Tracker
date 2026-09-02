# ADR 0032 — Schluter configurator pricing is registry-driven, not transcribed

- **Status:** Accepted
- **Date:** 2026-08-21
- **Scope:** `src/schluter.js` (`classify`/`catalogOf`/`tierPrice`/`lineItems`),
  Settings `pricing.schluterBuilderPct`
- **Related:** builds on ADR 0009 (price book library / registry books) and
  ADR 0025/0027's re-import + drift machinery, which this decision reuses
  rather than re-implements; contrasts with `wedi.js`'s transcribed-table
  design (issue 066); price-tier mechanics remain ADR 0018's display lens.
  Prototype findings and owner decisions: `.scratch/097_schluter-configurator/README.md`.

## Context

`wedi.js` (issue 066) is a heavy, table-transcribed engine: two vendor
spreadsheets are baked into generated `WEDI_STOCK`/pricelist arrays that ship
with the module and get re-transcribed by hand whenever the vendor's pricing
changes (issue 080). Building the Schluter configurator the same way would
mean transcribing a second vendor's spreadsheet into a second hand-maintained
table — duplicating data the shop already keeps current somewhere else.

The 2026-08-20 parity review found that Schluter's cost/retail already lives
in a registry-kind price book (ADR 0009): the ERP Vendor SKU Analysis import
carries 226 live Schluter rows with cost and retail, refreshed by the
existing re-import/whole-book-diff/drift pipeline (ADR 0025/0027) every time
the owner drops a new sheet. The same findings pass turned up the shop's
actual pricing rule for that book — retail = 1.5× cost, mean ratio 1.502
across all 226 rows — which is nothing like wedi's own model (wedi publishes
its own suggested retail; the shop buys at distributor net and marks nothing
up).

## Decision

1. **`schluter.js` embeds no catalog of its own.** `classify()`/`catalogOf()`
   take plain item rows as input — live registry-book rows in production,
   `schluterfixture.js`'s pinned 2026-08-20 snapshot in tests — and derive
   every field by parsing the row's own `sku`/`size` text (the SKU grammar,
   tasks 2–5) rather than looking anything up in a shipped table. There is no
   Schluter equivalent of `WEDI_STOCK`. **The fixture and a live row are NOT
   the same shape**, though: `schluterfixture.js` is the prototype-shaped
   snapshot (`name`, a per-item `stock` boolean, `erp`) the 2026-08-20 review
   was approved against; a live row comes back through `normOrderItem`
   (order-book rows) or the ERP stock export's `normBookItem`, which carry
   `description` instead of `name`, a book-level `stockKind` instead of a
   per-item `stock` boolean, and — for the ERP stock export specifically — a
   `sku` that is the shop's own internal/ERP code, with the Schluter
   manufacturer code living in `vendorSkus`/`description` instead. Code
   written against the fixture's fields will silently miss on live rows;
   `classify()`'s SKU-source widening (this decision's amendment, task 3 of
   the final review) is a stopgap for the `sku`-vs-`vendorSkus` half of that
   gap, not a fix for the rest.
2. **A sheet re-import reprices and re-ranges the configurator with no code
   change.** New SKUs, retired rows, and cost/retail drift all flow through
   the registry book's own import/diff/drift machinery; the engine just
   re-runs `catalogOf()` against whatever rows the book holds at solve time.
   This is the reason the registry-book route was chosen over transcription:
   Schluter's own price list already changes independently of this repo, and
   the shop's book already tracks it.
3. **This deliberately diverges from `wedi.js`, which keeps its
   transcribed-table design.** The two vendor configurators are not required
   to share a data-sourcing strategy — wedi predates the registry-book
   pattern, publishes its own retail (no shop markup to track), and porting
   it to registry rows is out of scope here. A reader comparing the two files
   should not read the difference as an oversight.

   **Superseded in part by ADR 0037 (2026-09-01):** wedi's *stock* half is
   now registry-driven too, at the owner's request. The divergence this
   consequence describes now applies only to wedi's pricelist half, which
   remains transcribed until 8b.
4. **Pricing lens (`tierPrice`) hardcodes the shop's observed markup rule**:
   a stocked row's retail is the registry book's own `price`; a non-stock
   (special-order) row — one with no shelf price, such as a factory kit —
   prices at `cost × 1.5`. This is a plain-markup book, unlike wedi's
   publish-retail model, so the two engines' `tierPrice` cannot share a
   constant.
5. **Builder tier gets its own knob**: `pricing.schluterBuilderPct`
   (Settings → Price book, default 8%), independent of `wediBuilderPct` and
   the shared flooring `builderPct`. Same shape, separate stored value — a
   rate change to one vendor's Builder discount never silently moves
   another's.

## Consequences

- `schluter.js` ships with zero generated data; `node --test` covers it
  entirely against `schluterfixture.js`'s fixture, but the module is inert
  without a caller passing real rows — an un-imported or not-yet-dropped
  Schluter book leaves the configurator with an empty catalog rather than a
  stale transcription.
- Cost/retail drift between the stock book and a fresher vendor sheet (the
  parity review found ~6% drift on trays/boards against the 10/01/2025 EFT)
  surfaces through the registry's existing drift chips on the next re-import
  — no separate Schluter-specific reconciliation step, unlike `wedi.js`
  pricelists which need a manual re-transcription pass.
- The `1.5×` markup and the `8%` Builder default are the shop's numbers, not
  derived constants — if the shop's markup practice changes, `tierPrice` and
  the Settings default both need a deliberate update; nothing recomputes them
  from the book.
- Whether Schluter's Builder tier should eventually follow its own vendor
  rule (rather than the app's flat-percent pattern) is still open — the
  prototype shows −8% with an asterisk, per `.scratch/097`'s owner questions;
  this ADR settles only that it is `schluterBuilderPct`, not a shared knob.
- Because the fixture and a live row diverge (see decision 1), phase 3's
  **first deliverable is a registry→engine adapter**, tested against a real
  `normBookItem` row rather than the fixture, mapping: `description` →
  `name`; the book's `stockKind` → the per-item `stock` boolean `classify()`/
  `tierPrice` read; the ERP stock export's internal `sku` plus its
  `vendorSkus`/`description` → the Schluter manufacturer code `classify()`'s
  grammar actually parses; and a Settings `mortars` entry (`{tier1, tier2,
  tier3, unit, price}`, keyed by product name) → the `cfg.mortarItem` shape
  `buildKit` expects (`{name, price, cost, stock, sfPerBagAt15}`), including
  a real `sfPerBagAt15` coverage rate the Settings shape has no field for
  today.
