# 8a execution record

The subagent-driven-development artifacts for
`docs/superpowers/plans/2026-09-01-wedi-stock-book.md`, copied out of the
git-ignored `.superpowers/sdd/` workspace so they survive the session.

- `ledger.md` — the controller's ledger: the pre-flight conflict scan, every
  ruling made on the owner's behalf (with what each costs if wrong), the
  deferred minors, and the per-task progress trail.
- `task-N-report.md` — each implementer's report, including TDD evidence and
  the fix rounds appended after review.
- `final-fix-report.md` — the wave answering the whole-branch review.

The review packages (`review-*.diff`) were not copied — they are regenerable
from git and were large.

**Read the ledger's `Ruling:` lines first if you are picking this up.** They are
the decisions taken without the owner, and the residual minors at the end are
the known-open items.
