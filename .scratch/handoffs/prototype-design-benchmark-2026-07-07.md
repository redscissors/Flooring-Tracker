# Prototype: Mobbin design-benchmark borrows

**Question:** Of the top borrows from the Mobbin design benchmark (report,
2026-07-07), which should FloorTrack adopt, and in what form? Candidates: a
print-preview surface on the customer detail (Stripe/QuickBooks), the
Square/Wave line-item column anatomy, and settings provenance / counted-apply
labels (Slite/Dovetail).

**Explored:** four variants behind `?proto=1` on a sample-data page (branch
`proto/design-benchmark`, never merged): **A** — Edit / Print-preview tabs with
Qty / Unit price / Line total columns; **A2** — the same tabs with today's
freeform product rows; **B** — Stripe-style split (form left, live paper
right); **C** — sticky bottom total bar + slide-over preview drawer; **D** —
Settings mocks: counted apply button on the price-book import diff
("Apply import — 41 new · 12 changed · 3 retired") and provenance lines
("Last imported Jul 2 by Dave", "Last backup Jun 28 by redscissors").

**Answer: A2 + D.** Tabs win as the home for the print preview, but with the
product rows kept exactly as they are today — the line-item column grid (A) was
rejected. D accepted as shown: counted apply button plus who/when provenance on
import and backup. B (split) and C (drawer) rejected.

Implementation: print-preview tab PR and counted-apply/provenance PR (branches
`feat/print-preview-tab`, `feat/import-provenance`). Prototype code lived only
on `proto/design-benchmark`; branch deleted after this record.
