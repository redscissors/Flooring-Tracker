# ADR 0002 — Shared grout/mortar catalog: one shared store, linked by unique name

- **Status:** Accepted
- **Date:** 2026-06-23
- **Scope:** system-wide (Settings storage + grout/mortar catalog + job→product link)
- **Related:** `.scratch/002_manage-grout-mortar-options/ticket.md`, ADR 0001

## Context

The team needs to manage which grout/mortar products appear in a job's
dropdowns, themselves, without a developer editing code. Today the grout/mortar
products are a fixed list baked into the app, and their numbers (grout coverage;
mortar coverage tiers + price) live in **per-user** Settings (`app_data`, one row
per user, RLS-locked to that user). Jobs are shared (the Public pool), and a job
references its grout/mortar **by name** — the material math looks up
`grouts["PermaColor Select"]` by that exact text at calculation time.

## Decision

1. **One shared Settings store.** The whole Settings object — the waste factor
   *and* the new grout/mortar **catalog** — moves into a single store that every
   signed-in user can read and write (mirroring how a Public customer is shared).
   The former per-user `app_data` settings store is retired.
2. **Catalog shape: Company → Product, saved as one chunk.** The catalog is a
   nested structure — companies, each holding grout or mortar products — where a
   company and each product carry an **enabled** (show/hide) flag, and each
   product carries its numbers. It is saved whole, not field-by-field.
3. **Jobs still link by name; product names must be unique.** A job keeps storing
   only the product *name* (no company, no id). To keep that name an unambiguous
   key, **product names are unique within grout and within mortar.** The math
   resolves a product by name regardless of its enabled state, so a job using a
   now-hidden product still calculates.
4. **Seed from today's built-ins.** The catalog starts pre-filled with the
   current built-in products under the *same names*, so every existing job keeps
   resolving; the team assigns them to companies and extends from there.
5. ~~**Colors stay out.** The grout color list remains the single shared list it is
   today, unmanaged by this feature.~~ **Superseded (2026-06-24):** the single
   shared color list was the Laticrete palette, so every grout — including ones
   added later like TEC Power Grout — showed Laticrete's colors. Colors are now
   **per grout product**: each catalog grout carries its own `colors: string[]`,
   editable in the catalog editor; the job's Color dropdown is filtered to the
   selected grout's list. The built-in Laticrete grouts seed with the former
   global list, and catalogs saved before colors existed are backfilled by name
   so they keep it; an explicitly emptied list is respected. A job still stores
   its chosen color as a frozen string, unchanged.

## Why

- **One shared store, not per-user:** the catalog feeds shared jobs, so it must
  itself be shared — data lives where the work that uses it lives. Keeping the
  waste factor shared too means a single settings home (shop-wide config), not
  two stores.
- **Link by name + unique-name rule, not company-qualified keys or ids:** every
  existing job is a frozen snapshot holding only the product name. Requiring a
  company or a stable id to resolve a grout would force rewriting *every* old job
  to stamp the new key onto it. Forbidding duplicate names instead keeps the
  name-only link working untouched for all existing jobs, for the price of a
  small naming constraint (product names are unique in practice anyway).
- **Hide, never delete:** disabling a product removes it from *future* dropdown
  picks but leaves it (and its numbers) in the catalog, so old jobs that used it
  still resolve and display. A no-longer-offered selection is re-injected into the
  dropdown so it still shows (the app already does this for tile thickness).

## Consequences

- **Concurrency is accepted as last-write-wins, deliberately.** The catalog saves
  as one chunk, so two people editing Settings at the same time will clobber each
  other (the lost-update problem, same as job `data` per ADR 0001). Settings edits
  are rare and done by few people, so this is judged acceptable for now. Optimistic
  conflict detection (check-on-save, prompt to overwrite/refresh) was designed and
  **deliberately deferred** as the future upgrade if this ever bites — it is not
  missed, it is shelved.
- The unique-name rule is a real constraint: you cannot have the same product name
  under two different companies (call one "Premium" and the other "Premium HD" if
  ever needed).
- Editing a product's coverage number re-flows into *all* jobs using it, because
  the number is looked up live by name (unlike a color, which is a frozen label on
  the saved job). This is existing behavior, surfaced more visibly now.

## Alternatives considered

- **Company-qualified or id-based job→product link.** Rejected: would require
  migrating every existing job to carry the new key. The unique-name rule achieves
  unambiguous resolution with zero changes to saved jobs.
- **Optimistic concurrency control now.** Deferred (see Consequences): correct, but
  not worth the build for how rarely two people edit the catalog at once.
- **Per-user Settings / per-user catalog.** Rejected: the jobs the catalog feeds
  are shared, so a per-user list reproduces the "teammate never saw that product"
  mismatch.
