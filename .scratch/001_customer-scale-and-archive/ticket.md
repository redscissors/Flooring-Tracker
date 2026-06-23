---
issue_type: Task
summary: Keep the customer list fast and uncluttered as the customer count grows — load the list "light" and load a customer's full detail only when opened, plus an archive for finished jobs.
status: done
labels: [ready-for-human]
---

# Keep customers fast and tidy as the list grows

## Problem / Why

Today, opening FloorTrack downloads the **complete record** of every customer the
signed-in person can see — their own customers **plus every customer marked
Public** — and holds them all in memory at once. Each record carries everything:
all areas, every product line, every saved version snapshot, and the attachment
list. The list on the left shows all of them and search/sort happen instantly
because everything is already loaded.

The team marks **most customers Public**, so *every* person re-downloads *every*
job each time they open the app. Saved versions in particular accumulate invisibly
inside each job over time, so the per-job payload only ever grows.

**There is no pain today** (dozens of customers; expected to reach low hundreds
within a year), and at that size the current approach is fine. This ticket is
**planning ahead**: make two low-risk changes that keep startup speed roughly flat
as jobs and their history pile up, and keep the everyday list short as the count
climbs — without rebuilding storage prematurely.

## Goals

1. **Startup stays fast as history accumulates.** Opening the app and showing the
   customer list should not get slower just because individual jobs gain more
   areas, products, or saved versions over time.
2. **The everyday list stays short.** Finished jobs can be moved out of the active
   list so the team isn't scrolling past completed work to find current jobs.
3. **Nothing is lost or hidden permanently.** Archived jobs remain fully
   searchable and restorable.

## Non-goals

- Not re-architecting how customer data is stored at the database level beyond
  what these two changes require. No sharding, no pagination infrastructure, no
  new storage backend — the data volume doesn't warrant it.
- Not changing the existing Private/Public sharing model.
- Not touching the material math, pricing, versions, attachments, or export/print
  behavior.

## Who uses this & how

A small team of flooring/tile contractors, all signed in, mostly working from a
shared (Public) pool of jobs. When they open the app to find a customer they
**both search by name and scan the list**, depending on whether they remember the
name. So both paths — search and browse — must stay quick and must reach the right
jobs.

## Requirements

### A. Load the customer list "light"

- The customer list should load using only what it needs to display each row:
  the customer's **name, address, and sharing/archive status**, plus the fields
  search and sort already rely on (**phone, email, created date**).
- **The per-row area count is being dropped.** (Decided.) The row used to show
  "N areas", but the count is the *only* list field that requires reaching into a
  customer's heavy detail (`categories`, which carries every product). The product
  owner confirmed the count is "noise I won't miss" when scanning the list, so it
  is removed rather than engineered around. With it gone, **every remaining list
  field is a top-level scalar** — no summary/detail split is needed inside the row.
- A customer's **full detail** (areas, products, saved versions, attachments)
  should load **only when that customer is opened**.
- Net effect: how long the list takes to appear should depend on *how many*
  customers there are, not on *how much history* has built up inside each one.
- Search and sort over the list must keep working across all loaded list rows.

### B. Archive for finished jobs

- A job can be marked **Archived** ("done / put away") and later **restored** to
  active.
- Archived jobs **leave the everyday active list** but are **never deleted** and
  lose no data.
- **Archiving is a property of the job itself, shared by everyone.** When anyone
  archives a Public job, it moves to the archive **for all users** — it reflects
  the real-world fact that the job is finished. (Decided.)
- **Anyone who can edit a job can archive or restore it.** This matches today's
  rule that anyone can edit a Public job; the owner is not specially required.
  (Decided.)
- **Search always finds archived jobs.** Everyday search looks through both active
  and archived customers, with archived results **clearly marked** as archived so
  no one mistakes a finished job for a live one. Nothing is ever truly out of
  reach. (Decided.)
- There must be a clear way to view/browse archived jobs on their own (not only
  via search), since the team also browses rather than always searching.

## Scope edges & rules

- **Opening an archived job:** restored to view in full, same as any active job;
  editing it is allowed for anyone who could edit it (it does not have to be
  un-archived first). Restoring to the active list is a separate, explicit action.
- **Deleting vs archiving** stay distinct: existing delete rules are unchanged
  (owner anytime; anyone once a Public job is 30+ days old). Archive is the
  non-destructive "put away"; delete is removal.
- **Newly created jobs** start active, not archived.
- **Light-load + archive interaction:** an archived job's full detail still loads
  only on open, same as an active one.

## Open business questions

_None — all questions raised during the interview were resolved above._

## Out of scope / future

- Per-person "hide from my list" (archiving that affects only one user) was
  considered and **rejected** in favor of shared, job-level archiving.
- Database-level scaling work (pagination, lazy infinite-scroll, server-side
  search) is unnecessary at the projected size and is explicitly deferred. Revisit
  only if the active customer count climbs into the **many hundreds / thousands**
  and the light-load list itself starts to feel slow.

## Notes for engineering

- **[Resolved in design review]** The "light" list and the per-customer full
  record are the same row's `data` jsonb. Because the area count was dropped (see
  Requirement A), every list field is now a top-level scalar, so **no schema split
  is needed**. Approach: the list query projects only the scalar fields out of the
  jsonb server-side (e.g. PostgREST `data->name, data->address, …` rather than
  `data`), keeping `categories`/products/versions/attachments on the server; the
  full `data` is fetched in a **second, on-open request** keyed by customer id.
  Single table, no migration — consistent with the storage non-goals.
- **[Resolved in design review]** `archived` is a new top-level **column** on
  `customers` (`boolean not null default false`), a sibling of `visibility` — so
  the light list reads it cheaply and new jobs start active. It is **deliberately
  NOT added to the `customers_guard` trigger**: the guard makes `visibility`/
  `owner_id` owner-only, but archiving must be open to *anyone who can edit a
  Public job*, so leaving `archived` out of the guard lets the existing update
  policy ("owner, or anyone if public") govern it — exactly the ticket rule. See
  ADR [`docs/adr/0001-archived-as-ungated-column.md`](../../docs/adr/0001-archived-as-ungated-column.md).
- **[Resolved in design review]** Flipping archive uses a **narrow write path**
  (a `setArchived(id, value)` sending only `{ archived }`, mirroring
  `setVisibility`) — **not** `updateCust`, which rewrites the whole `data` blob.
  On shared Public jobs a whole-blob write from a stale in-memory copy would
  silently overwrite a concurrent editor's changes; a single-column write cannot.
- The light list filters the active view to `archived = false`; the archive
  browse view shows `archived = true`; search spans both (archived results
  marked). In memory each customer carries `archived` alongside `ownerId`/
  `visibility`, stripped by `custData()` before writing the `data` jsonb.
