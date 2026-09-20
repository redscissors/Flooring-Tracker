# ADR 0044 — ERP 1 order stamps live on the project, per line, gating copies on numbered jobs

- **Status:** Accepted
- **Date:** 2026-09-19
- **Scope:** system-wide (`Project.erpOrders` / `Project.erpKeyed`; `src/erporders.js`; the order-entry panel; boot light rows; customer browser)
- **Related:** ADR 0005 (customer ▸ project hierarchy — the number sits on the project); ADR 0026 (light rows carry only what the first screen draws — the numbers ride the jsonb projection, no new table); the samples spec 2026-08-28 (whose "snapshot + live ids" shape was considered and not used here).
- **Spec:** `docs/superpowers/specs/2026-09-19-erp-order-numbers-design.md`

## Context

Keying a NED project into ERP 1 left no trace in NED: the panel's copied
checks were session state, the customer browser couldn't find a job by its
ERP order number, and a job split across two orders had nowhere to say
which lines went on which. The owner wanted the number entered first, the
copies greyed until then, the stamps remembered, and the number searchable.

## Decision

1. **On the project, not a table.** `erpOrders` (the numbers) and `erpKeyed`
   (one stamp per line, keyed by the line's stable id) are jsonb fields on
   the project, normalized by `src/erporders.js` and written only through
   `updateProject` with ONE patch per action. No SQL, no new boot load: the
   light-row select projects `erpOrders` so the browser column and search
   cost nothing. A separate table (the samples shape) was rejected: it needs
   an owner-run migration and another boot load for what is one job's
   bookkeeping.
2. **Per line.** A split order is common enough that "which lines went on
   which order" has to be answerable; the stamp carries `no`, `at`, `by`. A
   merged panel line stamps its sources; it reads keyed only when every
   source is. A material line's id is `mat|<kind>|<product>` (the special
   side's rule, now the stock side's too) — a rename orphans the stamp,
   which then just reads unkeyed.
3. **The gate applies to numbered projects only.** No N-number means no
   customer and no real name — a quick price — and the desk keys those
   without an ERP order, so there the number is optional and nothing is
   gated. A quick price's Deliver to is empty: its auto-name is not a
   deliver-to.
4. **Copy remaining replaces Copy all.** With stamps, "all" would re-key
   what's already in; remaining is what the split needs.
5. **No silent clear.** A persisted stamp clears only through the keyed
   line's popover (Copy again / Clear / Keep).

## Consequences

- Versions don't snapshot stamps; a restored version keeps the stamps that
  still match its line ids.
- Print doesn't show the number (its own ask). Server-side search doesn't
  match it (the browser searches the light rows client-side).
- The panel's top is a header bar (Deliver to · ERP 1 order · Project +
  View) in the project header's idiom; the title row and the body's Deliver
  to section are gone.
