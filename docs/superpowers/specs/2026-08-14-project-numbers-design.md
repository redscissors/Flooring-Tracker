# Project numbers (N100) — design

**Date:** 2026-08-14 · **Status:** approved, implemented on claude/project-numbering-prototype-rjp1am
**Prototype:** `.scratch/mockups/project-numbers-2026-08-14.html` (picks recorded in its Decisions table)

## What

Every real project gets a permanent tracking number — N100, N101, N102… — shown
quietly in the project header on screen and in the printed sheet's top-right
corner. The same change restyles that corner: the title **Selection Sheet**
becomes **Flooring & Tile** stacked over **Selections** (one size up from
today's title), with the number and date beneath, and the salesperson column's
phone and email move onto their own lines.

## Rules of the number

- **Format:** `N` + integer, starting at 100. No padding, no year prefix; rolls
  to four digits at N1000 and keeps counting.
- **Identity, not status:** once assigned it never changes, is never reused, and
  is never renumbered. Deleting a project retires its number forever.
- **Assignment trigger:** a project claims its number the first time it carries
  a *real* name — one a person typed. Blank, the `New Project` default, and
  quick-price auto-names (`isQuickAutoName`: "Quick price" / Q-…-M/D patterns,
  plus the line-item auto-rename) do **not** claim. A quick draft that someone
  hand-renames becomes real at that moment and claims then.
- **Uniqueness across the team** is guaranteed by the database, not the app —
  two salespeople naming projects in the same second get different numbers.

## Storage & claim (decision A — Postgres sequence)

New owner-run file **`supabase/project-numbers.sql`** (shipped, never executed
by an agent, per house rules):

1. `alter table projects add column project_no integer unique` — a **column**,
   not part of the `data` jsonb, so the database can enforce uniqueness and the
   directory can sort/search on it later.
2. **Backfill:** number every existing project whose stored name passes the
   same "real name" test, in `created_at` order, oldest = N100. Unnamed drafts
   and auto-named quick prices stay unnumbered until someone names them.
3. A sequence set to continue after the backfill, and a tiny RPC
   `claim_project_no(project_id)`: atomically
   `set project_no = nextval(…) where id = $1 and project_no is null`,
   returning the row's number either way. Idempotent — double-calls and races
   return the already-claimed number, so the per-keystroke name field can't
   double-claim.

**App side:** the name write path (`updateProject` in `usedirectory.js`)
watches for the empty→real name transition on a row with no number, calls the
RPC once (in-flight guard), and patches `projectNo` into state on return.
`projectNo` rides the in-memory project object the way `customerId` does — a
column mirror, stripped by `custData` before data-blob writes, never inside
`normC`, never in version snapshots.

**Graceful degradation:** until the SQL file is run, the RPC 404s — the claim
swallows the error, nothing renders (no number anywhere), the app is otherwise
unaffected. Same fallback pattern as `pricebook-search.sql`. A transient claim
failure just retries on a later save; the number simply arrives late.

**Backup/restore** (amended at plan time): restore adds copies under fresh ids
— "nothing existing is overwritten" — so old numbers cannot ride along without
colliding with the still-live originals. Restored real-named projects claim
fresh numbers; the export carries no numbers.

## On screen (pick 2A — quiet corner label)

In the Project box of the header, the eyebrow row becomes a flex row:
`PROJECT` left, `N214` right — same size and letterform family as the eyebrow,
`--ft-faint`, right-aligned, zero added height. Unnumbered projects show
nothing in the corner. Both header layouts get it:

- `ProjectHeaderBar` (`projectheader.jsx` ~line 193): the `Project` eyebrow div
  gains the right-aligned label inside the existing idbox.
- `ProjectHeaderClassic` (~line 298): beside the centered `Project` eyebrow.

This label style is the number's uniform everywhere it appears later
(customer browser column, versions list — future, not this change).

## In print (pick 3A stacked, one size up)

`EstimatePrint.jsx`, all three sheets (cards layout, classic layout, order
sheet). The top-right corner becomes:

```
FLOORING & TILE      ← 12px, weight 800, letterspacing .14em (today: 10px/.24em "Selection Sheet")
    SELECTIONS
          N214       ← 13px, weight 800; line absent when unnumbered
     8/14/2026       ← unchanged date line
```

- The stacked title is *the* title — **Selection Sheet goes away** on both
  print layouts. The tier tag line (Builder/Employee…) stays below the date,
  unchanged.
- The corner is four lines but still shorter than the Rough-Estimate badge, so
  the header row's height does not move. Print stays ink-only (issue 085
  remaps untouched).
- **Salesperson column** in the identity grid: phone and email each on their
  own line (today: one line joined with `·`). Name / phone / email, the way
  you'd copy it into a phone. Same sub-line type size; the grid row deepens
  one line only when both exist.
- An unnumbered project prints title + date exactly like today (minus the
  rename).

## Not in this change

- No number search/filter, no directory column (future follow-up).
- No re-numbering tools, no per-year reset, no formatting options.
- No number on quick prices while they wear auto-names.
- Screen-side print preview keeps its moss accents; only wording/layout shift.

## Files touched

| File | Change |
|---|---|
| `supabase/project-numbers.sql` | new — column, backfill, sequence, claim RPC |
| `src/usedirectory.js` | claim call on empty→real name transition; `projectNo` state patch; strip in `custData`; backup/restore carry |
| `src/model.js` | "real name" helper beside `isQuickAutoName` (blank / New Project / quick auto-names) |
| `src/projectheader.jsx` | 2A corner label, bar + classic |
| `src/EstimatePrint.jsx` | stacked title rename, number+date corner, stacked salesperson lines — cards, classic, order sheet |

Non-negotiables apply: SQL is shipped not run; lands via PR; UI/print change
needs preview proof before merge (the prototype page + a real-app preview
screenshot at PR time).
