# ADR 0004 — All customers are team-shared; visibility and archive removed

- **Status:** Accepted (supersedes [ADR 0001](0001-archived-as-ungated-column.md))
- **Date:** 2026-07-05
- **Scope:** system-wide (customers data model + RLS + storage)

## Context

Customers used to be `private` (owner only) or `public` (everyone), guarded by an
owner-only trigger, and carried an `archived` flag so finished jobs could be
hidden. In practice the team shares every job, and the sidebar already buckets
older jobs by age ("This month" / "This year" / "Older") behind a collapsed
"All customers" group — archiving duplicated that.

## Decision

Every signed-in user can see, edit, and delete every customer. The
`visibility` and `archived` columns are dropped, along with the
`customers_guard` trigger. `owner_id` remains only as a nullable "created by"
record (`on delete set null` — deleting a user account no longer cascades into
the team's shared customers). Versions and attachment storage follow: any
authenticated user, no per-customer check. Existing installs run
`supabase/migrate-shared-only.sql` once.

## Consequences

- **No private drafts.** Everything a salesperson enters is immediately visible
  to the whole team. Accepted deliberately — accounts are admin-created and the
  team is small and trusted.
- Anyone can delete any customer (already true for public customers since
  PR #14); the delete confirm warns it removes the job for everyone.
- Old jobs are found via the age buckets and search, not an archive list.
- ADR 0001's narrow-write/guard reasoning is obsolete: `setArchived`,
  `setVisibility`, and the guard trigger are gone.
