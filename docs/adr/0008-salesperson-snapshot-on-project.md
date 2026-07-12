# ADR 0008 — The salesperson is snapshotted onto the Project at creation

- **Status:** Accepted
- **Date:** 2026-07-12
- **Scope:** system-wide (Project shape + estimate print + selection header)
- **Related:** applies ADR 0003's snapshot doctrine to the salesperson;
  ADR 0004 (team-shared projects) is what makes the live-read a bug;
  ADR 0005 (Project shape).

## Context

The printed estimate's "Your salesperson" block read the **signed-in user's
profile at render time**. Under ADR 0004 every project is team-shared, so if
Bob opens a job Alice created and prints it, the customer sees Bob's name and
phone — the estimate's contact person silently changes with whoever last
touched Print. There was also no way to see, from the selection screen, whose
job it was.

## Decision

1. **`Project` gains `salesperson: { name, phone, email } | null`**, stamped
   from the creator's Settings profile in `addProject` — never read live
   again. `normC` defaults it to `null`.
2. **The estimate print reads `sel.salesperson || profile`.** Pre-0008
   projects have `null` and fall back to the signed-in profile — exactly what
   they printed before, so no record changes meaning on deploy.
3. **The selection header shows the salesperson as locked** (lock icon), with
   a click-to-open editor: free-form name/phone/email fields plus a
   "Use my details" restamp. Edits go through `updateProject` like every
   other field.

## Why

- **Snapshot, not live-resolve:** the estimate is a document; who sold the job
  is a fact about the job, not about the viewer. Same doctrine as ADR 0003 —
  nothing a saved estimate prints should change because someone else opened it.
- **Free-form editor over a roster:** there is no team-roster table; each
  user's profile is private to their `app_data` row. Typed fields plus
  "Use my details" covers reassign-to-me and type-a-colleague without new
  tables or RLS.
- **Fallback keeps old records valid:** `null` normalizes cleanly and prints
  the old behavior; no migration, no SQL.

## Consequences

- `newProject`/`addProject` stamp the snapshot; versions are unaffected
  (snapshots hold `categories` only, so a restore can't clobber it).
- A user who fills in their Settings profile *after* creating projects will
  find those projects stamped with whatever the profile held at creation
  (possibly empty) — fixable per-project via "Use my details".
- Changing your Settings profile no longer updates existing projects'
  printed salesperson — deliberate.
