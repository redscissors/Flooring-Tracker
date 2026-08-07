# 0031 — Quote options are area tags over a shared base

Date: 2026-08-06 · Status: accepted · Owner-approved spec:
docs/superpowers/specs/2026-08-06-quote-options-design.md

## Decision

A project's options (customer comparing 2–3 products or installs) are **tags on
areas**, not copies of the job. `Area.option` is `""` (shared — the area is part
of the job in every option) or a fixed slot `"A" | "B" | "C"`. Untagged jobs are
exactly the pre-options app. Display names live in `project.optionNames`
(`{A?,B?,C?}`); unnamed slots read "Option A".

An option's headline number is a **whole-job** figure, additive on paper:
`grandTotal(shared bucket) + grandTotal(option bucket)`, each bucket
consolidating its own materials. Order entry consolidates over the **union**
(shared + chosen slot) instead, so real orders — and order-scoped vendor
freight minimums (ADR 0030) — stay exact; the estimate may overstate by one
rounding unit per shared material, which "quantities are estimates" already
covers.

## Rejected

- Every-area-picks-an-option: an option's subtotal is one bathroom, not a
  signable number.
- Whole-job copies per option: duplicates every shared area and every edit.
- Cross-alternate consolidation: double-counts materials between alternatives.

## Consequences

- Option tags ride version snapshots (`Area[]`) for free; `optionNames` lives on
  the project and survives restores. No SQL migration.
- Area notes (`Area.note`) were removed in the same change — normA drops the
  field, so old notes disappear on a job's next save (owner call, 2026-08-06).
