# ADR 0005 — Builder ▸ Customer ▸ Project hierarchy

- **Status:** Accepted
- **Date:** 2026-07-07
- **Scope:** system-wide (customers data model + RLS + sidebar/search + migration)

## Context

Until now a "Customer" *was* a single job: one `customers` row held the contact
fields **and** the areas/selections directly, and the glossary even said
"Customer (a.k.a. Job)". The team needs a real person/account that can hold
**more than one job** over time (a repeat homeowner, or a turnover unit that
comes back), and needs to group those people under the **builder** they came
from (a GC / production builder who sends many buyers). Free-text builder names
were unacceptable because "P&L" and "P & L" would silently split one builder
into two groups.

## Decision

Introduce three levels where there was one:

```
Builder  ▸  Customer (person/account)  ▸  Project (a job/estimate)  ▸  Area  ▸  Selection
```

- **Project** is what a "Customer" is today — the job that holds areas,
  selections, versions, and attachments. The existing `customers` table is
  **renamed to `projects`** and keeps its shape; it gains a nullable
  `customer_id`. Because the row ids do not change, the `versions` foreign key
  and the `attachments/<id>/<file>` storage paths keep working untouched — **no
  estimate, version, or attachment data moves.**
- **Customer** becomes a new first-class record (its own table) holding the
  person's contact info **once**, and owning many Projects. This is "Option 3":
  Customer is first-class; Builder is kept light.
- **Builder** is a new canonical name-list table you **link to by id**, with
  type-ahead autofill and near-duplicate detection on create. It carries only a
  name for now (a `data` jsonb reserves room to promote it to a full account —
  contact, notes, its own page — later without another migration).
- **Duplicate/near-duplicate customer names prompt "use existing?"** instead of
  silently creating a second record — the new Project attaches to the existing
  Customer. The same near-duplicate guard applies when adding a new Builder.
- **Search spans all three levels** (builder name, customer name/contact,
  project name), extending today's client filter and the debounced server-side
  `ilike` search.
- **The area-by-area estimate screen and all material math are unchanged.** This
  ADR only adds the grouping layer *above* the existing per-job screen.
- New tables follow **ADR 0004**: any authenticated user can read/write; RLS is
  `using (true)`; `owner_id` is a nullable "created by" record only.

Existing installs run a one-time `supabase/migrate-hierarchy.sql` (owner-run, by
hand) that renames the table, creates `customers` + `builders`, and **backfills
one Customer per distinct existing project name**, linking each project to it.

## Considered options

- **Option 1 — grouping fields only, no new tables.** Rejected: "use existing
  customer" would be a *copy* of contact fields, not a link, and editing a
  person's phone would mean touching every one of their projects. It also
  wouldn't give builders a canonical identity, so the P&L/P & L split would
  persist.
- **Option 2 — Customer *and* Builder both full first-class records with their
  own pages/contact.** Deferred, not rejected: it's strictly more than needed
  today and doubles the new surface. Builder is kept as a name-list now, with a
  reserved `data` jsonb so it can become Option 2 later without a second
  migration.
- **Name-linked builders (consistent with ADR 0002).** Rejected *for builders*:
  ADR 0002 links jobs to catalog products by name because every old job is a
  frozen blob holding only a name — migrating to ids would rewrite every job.
  Builders are the opposite situation: new structure, built fresh, whose whole
  purpose is exact grouping. An id link makes "P&L" vs "P & L" impossible to
  mis-group; a name link would reintroduce exactly the bug being fixed. This is
  a deliberate, scoped divergence from 0002, not a reversal — product↔name links
  are unchanged.

## Consequences

- **Deploy is coordinated, not rolling.** Renaming the live table is a breaking
  change: old code queries `customers` for jobs, new code queries `projects`.
  The owner runs the SQL and ships the matching deploy in one short window
  (both are already owner-controlled — same model as every other
  `supabase/*.sql`). Pick a moment nobody is mid-estimate.
- **New normalizers required.** Per the standing rule (arch invariant 2), the
  new Customer/Builder/Project shapes each get a normalizer with legacy-safe
  defaults; `normC`/`normA`/`normP` extend for the project's new `customer_id`.
- **`versions` and `attachments` are unaffected** — same ids, same paths. The
  `versions.customer_id` column keeps its name (it now holds a project id);
  renaming it is optional cleanup, not required.
- **Backfill is one Customer per distinct project name.** Two old jobs that were
  really the same person but spelled differently stay separate until merged by
  hand — acceptable; the near-duplicate guard prevents *new* splits.
- **Builder uniqueness is app-enforced, not DB-enforced** (the near-dup UI
  guard), leaving room for two genuinely distinct builders with similar names.
