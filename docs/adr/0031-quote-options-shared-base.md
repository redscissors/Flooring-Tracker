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
- The single-option scoped sheet (order entry, the scoped preview/print)
  consolidates over the union, so it can read lower than the compare sheet's
  additive whole-job figure by material rounding units only — freight is
  union-exact on BOTH sheets, since the whole-job's option bucket carries the
  union's increment over the shared bucket rather than a standalone per-bucket
  charge (Fix 2, final-review round).

## Amendment 2026-08-19 — slots extended to A–F

Three slots weren't enough ("need to be able to make more than three options",
Marcus 2026-08-14). `OPTION_SLOTS` is now `A–F` (six); slots stay fixed
positional identities and everything else in this ADR is unchanged. The slot
letters moved to `model.js` (normA/normC gate on them; `options.js` re-exports
the list), and D/E/F got their own compare colors (teal/berry/ochre, still
outside the moss palette). No migration: old records carry only A–C, which
remain valid. One rollout caveat: a client running a pre-amendment build
normalizes an area tagged D–F back to shared on its next save of that job, so
stale tabs should refresh before teams lean on the new slots.
