# ADR 0050 — A builder is a customer with a Builder tick

- **Status:** Accepted
- **Date:** 2026-09-27
- **Scope:** system-wide (customers table + builder link + BuilderCombo + migration)
- **Supersedes:** the Builder half of ADR 0005 (the separate `builders` name list)

## Context

ADR 0005 made Builder a canonical name list (`builders` table) that customers
link to by id. It kept builders "light": a name only, with `data` reserved so
a builder could later become a full account (0005's deferred Option 2).

In practice builders also buy directly: spec houses, model homes, their own
office. Such a builder had no phone or email and couldn't own a job, so the
team entered it a second time as an ordinary customer ("Barrs General
Construction"). That left two records for one company, the problem 0005 set
out to prevent.

## Decision

A builder is a **customer** with `is_builder = true`.

- `customers.builder_id` points at `customers(id)` (a self-reference, `on
  delete set null`). The Builder box on a customer lists the customers marked
  as builders.
- A builder has contact info and projects like any customer, and has no
  builder of its own (one level).
- The `builders` table is retired, not dropped. The owner runs
  `supabase/builders-as-customers.sql` once:
  - each builder becomes a customer row **with the same id**, so homeowners'
    links stay valid;
  - a builder whose name exactly matches an existing customer (after
    normalizing) is merged into that customer instead.
- The code ships first and falls back to the old list until the SQL has run,
  so there is no coordinated deploy window.

The owner chose this over 0005's deferred Option 2 (keep `builders`, give it
contact info and let it own projects) on 2026-09-27. Details are in
`docs/superpowers/specs/2026-09-27-projects-customers-builders-design.md`.

## Considered options

- **Promote `builders` to a full account (0005 Option 2).** This needed a
  smaller migration, but the app would have two kinds of "who this job is
  for", and every screen that shows a project's customer would need a builder
  branch. A company that is both builder and buyer could still be entered
  twice.
- **Leave builders as names.** This doesn't address the duplicates or the
  missing contact info.

## Consequences

- One contact list. Near-duplicate guards now compare a new builder name
  against **all** customers, and offer to mark an existing customer as a
  builder.
- The migration only merges exact normalized-name matches. Near-duplicates
  stay separate until a customer-merge tool exists (not built).
- Builder uniqueness stays app-enforced, as in 0005.
- Builders appear in the Customers list (with a tag) and in their own
  Builders tab. A builder's page lists its own jobs plus its homeowners' jobs.
