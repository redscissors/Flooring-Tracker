# ADR 0001 — `archived` is a top-level column, deliberately outside the owner guard

- **Status:** Accepted
- **Date:** 2026-06-22
- **Scope:** system-wide (customers data model + RLS)
- **Related:** `.scratch/001_customer-scale-and-archive/ticket.md`

## Context

Finished jobs need an **Archive** state: shared at the job level (when anyone
archives a Public job it is archived for everyone), flippable by **anyone who can
edit** the job (not just the owner), readable by the "light" customer list so it
can hide archived jobs without loading each job's heavy detail, and never
destructive.

`customers` already stores each job as one row: top-level columns (`id`,
`owner_id`, `visibility`, `created_at`) plus a single heavy `data` jsonb blob
holding areas/products/versions/attachments. Two existing gates govern writes:

- the **RLS update policy** — may you write this row at all / edit its contents?
  Passes for the owner, or anyone if the row is `public`.
- the **`customers_guard` trigger** — may you change the *protected* columns
  `owner_id`/`visibility`? Passes for the **owner only**.

`visibility` is a job-level column protected by *both* gates (owner-only). The
obvious move — "model `archived` exactly like `visibility`" — would copy it into
the guard too.

## Decision

1. `archived` is a new **top-level column** on `customers`
   (`boolean not null default false`), a sibling of `visibility`.
2. It is **NOT added to the `customers_guard` trigger.** Only the RLS update
   policy gates it — so the owner *or* any editor of a Public job can flip it.
3. Archive is flipped through a **narrow write** (`setArchived(id, value)`
   sending only `{ archived }`), never through the whole-`data`-blob `updateCust`.

## Why

- **Column, not inside `data`:** the light list reads `archived` cheaply as a
  column (no heavy blob fetch), and new jobs default to active.
- **Outside the guard (the surprising part):** the guard exists to make
  `visibility`/`owner_id` owner-only. Archiving is intentionally *not* owner-only,
  so guarding `archived` would wrongly throw when a non-owner archives a Public
  job — breaking the ticket's "anyone who can edit can archive" rule. Leaving it
  out lets the broader update policy govern it, which is exactly the desired
  permission.
- **Narrow write:** on shared Public jobs, a whole-blob write from a stale
  in-memory copy silently overwrites a concurrent editor's changes
  (last-write-wins / lost update). A single-column write touches only `archived`,
  so archiving cannot clobber someone else's edits to the same job.

## Consequences

- `archived` looks like `visibility` in *shape* but has the *opposite*
  permission. A future reader who assumes "all job-level columns are
  owner-guarded" will be wrong; this ADR is the record of why.
- The narrow-write rule must be honored by any new archive UI — routing archive
  through `updateCust` would reintroduce the clobber.
- Concurrency is only *shrunk*, not solved: simultaneous edits to `data` still
  last-write-wins, unchanged and out of scope for this ticket.

## Alternatives considered

- **`archived` inside the `data` jsonb.** Rejected: forces a whole-blob write to
  flip it (clobber risk) and is more awkward for the light list to read.
- **Add `archived` to the guard, like `visibility`.** Rejected: makes archiving
  owner-only, contradicting the ticket.
