# ADR 0011 — On-screen materials margin is ephemeral, default-hidden, never printed

- **Status:** Accepted
- **Date:** 2026-07-13
- **Scope:** system-wide (estimate screen state + estimate print)
- **Related:** implements [ADR 0009](0009-price-book-library.md) §8.1 (the
  internal margin line) and closes the door §8.4 left open; depends on
  ADR 0009 §2.3's `cost`/`markupPct` selection snapshot; [ADR 0004](0004-all-customers-team-shared.md)
  is what makes a *persisted* per-user answer expensive.

## Context

Phase 5a adds the internal materials-margin line ADR 0009 §8.1 proposed: over
the special-order Selection rows (which snapshot `cost` + `markupPct`, §2.3),
show sell − cost so the salesperson can see job margin. The design is explicit
that this figure is **internal-only and must never appear on the customer-facing
print** (§8.1, §2.3). §8.4 deferred "per-user cost visibility" because a
*persisted, per-user* answer would need a visibility model the shared data model
(ADR 0004) deliberately does not have — no per-user rows, one shared settings
record, team-wide RLS.

But "the margin line needs a way to be hidden" and "per-user persisted
visibility" are not the same requirement. The estimate screen is sometimes
customer-facing (a salesperson turning the laptop around), so the margin needs a
hide control — without reopening ADR 0004.

## Decision

1. **Margin visibility is ephemeral React state on the estimate screen**, not a
   persisted setting. It lives in component state, resets on reload, and is
   **never written to Supabase** — no column, no `settings` field, no per-user
   row. ADR 0004's shared model is untouched because nothing is stored.
2. **Default hidden.** The margin renders masked (`•••`) until the salesperson
   clicks to reveal, because the estimate screen is the one that faces the
   customer. This is the opposite default from the Settings price-book
   "Hide costs" toggle (which defaults shown, on a back-office screen).
3. **Never printed, either path.** The margin line lives only in the on-screen
   "Order summary" panel — not in `renderEstimatePaper()`, which is the single
   source both print paths use (the `@media print` layout and the on-screen
   Print preview tab). It also carries `ft-noprint` as belt-and-suspenders.
4. **Special-order lines only.** Margin covers rows that snapshot a `cost`
   (special order). Stock/catalog rows carry no cost, so the line is labeled
   "special-order margin" and excludes them — no invented stock costs
   (ADR 0009 §8.1 scope caveat). The math is the pure, tested
   `specialOrderMargin` in `src/orderbook.js`.

## Why

- **Ephemeral sidesteps the ADR 0004 conflict entirely.** The only reason §8.4
  called per-user cost visibility ADR-worthy was *persistence* in a shared
  model. Don't persist, and there is no conflict to resolve — a screen-local
  view toggle is not a data-model decision.
- **Default hidden is the safe default for a customer-facing screen.** The cost
  of a wrong default is a customer seeing the shop's margin; one click is the
  cost of the safe default being wrong.
- **One print source stays the guarantee.** Because both print paths render the
  same `renderEstimatePaper()`, keeping the margin out of that function is what
  makes "never printed" structural rather than a rule to remember.

## Consequences

- The toggle does not remember its state across reloads or across projects
  within a reload beyond the estimate screen's lifetime — acceptable for a view
  preference; making it sticky would reopen the persistence question.
- No `normP`/`normC`/`mergeSettings` change — nothing new is stored, so no
  old-record migration.
- If a future need arises for a *remembered* per-user margin preference, that is
  a new decision that must confront ADR 0004 (the deferred §8.4 item), and this
  ADR does not grant it.
