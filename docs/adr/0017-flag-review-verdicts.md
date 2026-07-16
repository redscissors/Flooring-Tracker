# ADR 0017 — Flag-review verdicts: per-item, per-code confirm/ignore that survives re-import

- **Status:** Accepted
- **Date:** 2026-07-16
- **Scope:** price book library (book table, import wizard, item jsonb)
- **Related:** amends [ADR 0013](0013-unit-combo-pricing-semantics.md)'s
  import-time warnings and the PR #128 flag chips; extends the
  disabled-column persistence rule from ADR 0009's importer-upgrades
  amendment (`supabase/pricebook-disabled.sql`).

## Context

The import hazard/advisory classifiers (`itemProblems` / `rowAdvisories`) are
derive-at-render and derive-at-import: every render of the book table re-flags
the same rows, and every re-import of the same vendor file re-warns about the
same problems. That is correct for an *unreviewed* problem — but once a human
has looked at a row and decided "this is actually fine" (a trim whose odd
coverage is real, a deliberate $0 sample line), the flag becomes a permanent
nag. There was no way to record that decision, so the warning list never
shrinks and real new problems drown in reviewed ones.

## Decision

1. **A review verdict is per item, per flag code.** `flagReview:
   { [code]: { state: "confirmed" | "ignored", by, at } }` lives inside the
   item's `data` jsonb (no schema change). Keying by code means a reviewed
   row still flags when a *different* problem appears later; the same problem
   stays quiet.
2. **Two states, one effect, different intent.** "Confirmed" = a human
   verified or corrected the row; "ignored" = the flag is noise here. Both
   silence that code's chip in the book table and its aggregate line in the
   import wizard's warnings. They differ in bookkeeping: the book-level
   **Reset confirmed flags** button clears only confirmations (a bulk
   "re-check my fixes" action); ignores are undone per row.
3. **Verdicts survive re-import like the `disabled` column.**
   `applyBookImport` copies the previous item's `flagReview` onto a changed
   row's fresh data before the upsert; unchanged and missing rows never lose
   theirs. This is the ADR 0003 doctrine applied to review state: an import
   refreshes vendor data, never team decisions.
4. **A review is not a hand-edit.** `reviewBookItemFlags` rewrites the row's
   data jsonb *without* stamping `editedBy`/`editedAt`, so a reviewed row
   neither shows the "edited" chip nor triggers the wizard's "will be
   overwritten" warning.
5. **The wizard mutes reviewed codes at the source.** `parseMapped` takes the
   book's `sku → flagReview` map (`flagReviewBySku`) and filters
   `unitComboWarnings` / `importSanityWarnings` per row-and-code; the
   problem-rows review section skips fully-reviewed rows and reports how many
   stayed quiet, mirroring the existing previously-disabled note.

## Consequences

- A stale verdict is harmless: if the underlying data changes so the code no
  longer derives, the entry just never matches again (Reset clears it).
- Verdicts ride along into `pricebook_versions` snapshots and rollbacks, like
  every other data field.
- The stock workbook's items don't render flags today, so review applies to
  registry books only; if stock rows ever get chips, the same field works
  there unchanged.
