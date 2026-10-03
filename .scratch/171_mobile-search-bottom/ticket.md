---
issue_type: Feature
summary: Phone price-book search — field at the bottom, results flowing up
  from it, best match nearest the thumb
status: done
labels: [ready-for-human]
---

# Phone price-book search, thumb-first

Owner, 2026-10-03: "when you open the price book search in mobile, lets have
the search bar at the bottom and have results start at the bottom flowing up."
Design approved in chat the same day:

- The field (with ✕ and Cancel) sits at the bottom and rides the keyboard
  (`useKeyboardInset`, now shared with MobileSheet's footer — no
  `interactive-widget` in the viewport meta, so iOS and Android Chrome both
  overlay the keyboard).
- Results stack up from it, best match right above the field (a
  `flex-col-reverse` list, so it opens scrolled to the bottom).
- Match count + Add N products / Enter by hand: a thin line right above the
  field.
- Vendor configurator rows and messages (hint, loading, no match) sit nearest
  the field.
- Both entries get it (bottom bar Price book, the row sheet's Price book).
  Pick, multi-select and ticket 169's one-tap fix unchanged.

## Proof

`check.mjs` (ticket 170's harness, three Keystones items): `before/` had 7
FAIL; `after/` is 11 PASS, 0 FAIL — `bottom` (field at the bottom, focused,
hint above it), `flow` (rank 0 lowest, each next hit above, status line
between), `pick` (one tap picks), `vendor` (Sheoga row nearest), `kb` (a faked
300px keyboard lifts the field above it). Ticket 170's check (32/32) and
169's repro still pass.
