# Projects · Customers · Builders — the browser rebuilt around jobs — design

**Date:** 2026-09-27 · **Status:** parked (owner, 2026-09-27)

> **Parked.** The owner chose a smaller fix for now: the customer browser
> dropped its salesman bands and stays one flat list in the chosen sort
> (`.scratch/040`, 2026-09-27 note). This design is kept for when the
> Projects/Builders direction is picked back up. ADR 0050 and the glossary
> changes it describes were withdrawn with the parking (their text is in
> commit `b0d1bc0`); rewrite them from this spec if the design is resumed.

Prototypes the owner worked through:
- Round 1 (list options, builder data options): https://claude.ai/artifact/A4aVWadX6XkoYnFjMkW7yn
- Round 2 (Customers/Builders layouts, v2 with customer-first rows): https://claude.ai/artifact/2RMCMwqdt7GcTLtoVC9Wgu

Related: ADR 0005 (Builder ▸ Customer ▸ Project), ADR 0008 (salesperson on the
project), ADR 0026 (boot policy), ADR 0047 (browser is a work-area pane),
ADR 0050 (builders are customers — drafted, then withdrawn when this spec was parked).

## Problem

The customer browser has one row per **customer**, but the salesman lives on
each **project** (ADR 0008). To band a customer under a salesman,
`browserRows` picks whoever's job was touched most recently. With the
Salesperson box set to "Marcus", `filterBySales` keeps any customer where
*any* job is Marcus's, but a customer he shares with Josiah is banded under
**Josiah** if Josiah edited last. The bands sort A–Z, so a "Josiah Yoder · 3"
band sits on top of Marcus's own 40. Each of those three customers has two
jobs, and one of the two is Marcus's.

Separately, a builder is only a name on a list (`builders` table). It has no
phone or email and can't own a job. A builder that buys directly (a spec
house, their office) is entered as an ordinary customer with no link to the
builder list, so the same company exists twice.

## Decisions (owner, 2026-09-27)

1. The browser gets three tabs: **Projects · Customers · Builders**
   (round 1, options A + B).
2. **Projects** is one row per job. Every row leads with the **customer's
   name**, then the job name, because job names are usually throwaway ("Main
   floor", "Kitchen") and the customer is how people look a job up. Search
   matches the customer's name first.
3. **Customers** and **Builders** are side by side on a computer: the list on
   the left, the selected person's jobs on the right. On a phone, tapping
   opens their page with a back button.
4. **Mine vs. everyone:** with the search box empty, every tab shows your
   work. Typing searches everyone.
5. A builder's page is one flat list of jobs. Each row leads with the
   homeowner's name, or "Their own" for the builder's own jobs. There is no
   separate "For" column and no own/homeowners switch.
6. Builders also appear in the Customers tab, with a **Builder** tag.
7. **A builder is a customer with a "This is a builder" tick** (round 1,
   option 1). There is one contact list. See ADR 0050 and the migration below.

## The browser

The pane stays where ADR 0047 put it: the rail's Customers entry opens it in
the work area. The entry is renamed **Projects**. The tab strip sits at the
top of the pane, and the last-used tab is remembered per user
(`ui.browserTab` through `saveUiPref`, like `browserCols`).

### Shared toolbar

- **Search box.** Its placeholder names what the tab searches.
- **Salesman picker.** The existing roster (`salesRoster`), with "Me" as the
  default when your name appears on any job (`defaultSalesFilter`, unchanged),
  "Everyone", and each named salesman. Matching is **exact per job**. There
  is no more substring match, so "Mar" no longer catches two people.
- **Scope line** under the toolbar. It states what the list is showing:
  "Showing your jobs · 41. Type a name to search everyone." or "Searching
  everyone's customers · 6 found". This is state, so it stays inline
  (ADR 0045).
- **The rule:** with the search box empty, the Salesman picker filters the
  list. Once there is text, the list searches **everyone**, whatever the
  picker says. Clearing the box brings the picker's filter back. An explicit
  pick of another salesman or "Everyone" works as it does today.

### Projects tab

- **Rows:** one per project that has a customer and isn't a quick-price
  draft. The **Estimates & drafts** strip (`quickRows`/`draftRows`) stays as
  it is, above the grid.
- **Pinned lead column, "Customer · job":** the customer's name in bold,
  then the job name in muted text. A builder's own job shows the builder's
  name with the Builder tag.
- **Draggable columns** (saved per user, as today): Project #, Builder,
  Salesman, ERP order, Address, Phone, Email, Created, Modified, Samples.
  - Address is the job's own address, falling back to the customer's.
  - Phone and Email are the job's, falling back to the customer's.
  - Builder is the customer's builder. For a builder's own job it is blank,
    because the tag already says it.
  - The Jobs count column moves to the Customers list, where it means
    something. `normColOrder` drops unknown keys and appends new ones, so
    saved orders stay valid.
- **Search** matches, case-insensitively:
  - the customer's name, the builder's name and the job name;
  - N# ("N214" or "214", `projNoHit`);
  - ERP numbers;
  - phone, email and address, now **including the job's own**, which today
    are searched only in the sidebar.
- **Ranking:** rows whose customer name matches come first, then builder-name
  matches, then everything else. Within each group, the chosen sort applies.
- **Group by:** None (the default) · Salesman · Builder. Salesman bands put
  **your band first**, then the rest A–Z, with "No salesperson" last. Band
  keys are case-folded, so "marcus" and "Marcus" form one band. Customer
  grouping from the round-1 prototype is dropped, because the Customers tab
  covers it.
- **Sort:** Created (the default), Modified, or A–Z by customer name. These
  are unchanged, but they now apply per job.
- **Keyboard:** arrow keys walk the rows. Enter opens the project.
- Clicking a customer or builder name switches to that tab with that person
  selected. This replaces round 1's filter chip.

### Customers tab and Builders tab (side by side)

**Left: the list.** It holds customers (the Builders tab holds only customers
marked as builders), sorted by last activity, newest first. Each row shows:
- the name, with the Builder tag on builders in the Customers tab;
- a sub-line: "via Hilltop Homes · Sugarcreek" for a customer, or
  "9 homeowners · Millersburg" for a builder;
- the job count and the last-activity date;
- a small "Josiah's" marker when none of their jobs are yours (the salesman
  with the most of their jobs).

What "Mine" means here: a customer is yours when **any** of their jobs is
yours. A builder is yours when any of their own or their homeowners' jobs is
yours. Search matches the name, phone, email, address and city, the builder
name (for customers), and the homeowners' names (for builders).

**Right: the selected person.** This replaces today's bottom "project lines"
panel and its resize handle. `ui.browserPanels.linesH` is ignored from now
on; the key stays readable, so old blobs are fine.
- **Header:** the name, the Builder tag, phone · email · address, and their
  builder (a link that selects the builder in the Builders tab). The buttons
  are **New project** and **Open customer**, as today.
- **Tools:** **All N · Just mine N**, a segmented toggle that defaults to All,
  and a find-in-jobs box when there are more than 6 jobs.
- **Job rows:** N#, the lead text, salesman (with a green dot on yours),
  edited date, samples chip, and ERP chips.
  - On a customer's page the lead text is the job name.
  - On a builder's page it is the homeowner's name followed by the job name,
    or "Their own" followed by the job name.
  - Other salesmen's jobs are shown in muted text, not hidden. When Hilltop
    calls, you should see that Josiah quoted their model home.
- The first row of the list is selected when the tab opens. Selection
  survives typing in the search box as long as the person is still in the
  results.

**Phone:** below the `md` breakpoint, the pane shows only the list. Tapping
a row replaces it with the person's page, headed by "‹ Customers" or
"‹ Builders". Back returns to the list with the search text kept. Esc and
the phone back gesture follow the ADR 0028 one-press-escape stack.

## Builders are customers (ADR 0050)

### Data

- `customers` gains **`is_builder boolean not null default false`**. It is
  projected as `isBuilder` in `PERSON_SELECT`/`personRow`, and `newPerson`
  defaults it to `false`.
- `customers.builder_id` now points at **`customers(id)`** (a self-reference,
  `on delete set null`) instead of `builders(id)`.
- The `builders` table is **retired, not dropped**, like `stock_items`: the
  data is kept and no code reads or writes it.
- `builderNameOf(id)` resolves through `people`. `data.builders` goes away
  from state and becomes a derived `people.filter(isBuilder)`.

### Migration — `supabase/builders-as-customers.sql` (owner runs it by hand)

1. **Preview (read-only).** A `select` that lists each builder beside any
   existing customer whose name matches after normalizing (lowercased, letters
   and digits only). The owner reads the output before running step 2.
2. `alter table customers add column if not exists is_builder …`.
3. **Exact-name matches:** mark the existing customer as a builder and point
   every homeowner that linked to the old builder id at that customer. This
   is the "Barrs is both" case, and it merges automatically only on an exact
   normalized match.
4. **Every other builder:** insert a customer row **with the same id**, the
   builder's name in `data.name`, merged with anything in `builders.data`,
   `is_builder = true`, and the same `owner_id`/`created_at`. Because the id
   is kept, homeowners' `builder_id` values stay valid without being
   rewritten.
5. Drop the old FK and add `builder_id → customers(id) on delete set null`.
6. Idempotent throughout: `if not exists`, `on conflict (id) do nothing`, and
   the FK swap guarded by name.

Near-duplicates that aren't exact ("Barrs GC" vs "Barrs General
Construction") are **not** auto-merged. They stay two records, which is the
same stance ADR 0005 took on its backfill. A merge tool is out of scope; see
Follow-ups.

### Code before and after the SQL

The deploy is **not** coordinated. The code ships first and falls back:
- If `is_builder` isn't selectable, `loadPeople` retries without it. The app
  then runs in **legacy builder mode**: builders come from the old `builders`
  table as name-only pseudo-entries, the Builders tab lists them with their
  homeowners' jobs, and the "This is a builder" tick is hidden.
- Adding a builder in legacy mode behaves as it does today (a
  `builders` insert).
- Once the SQL has run, the next load picks up the new model. Nothing needs
  a reload window.

### Editing

- **Customer details** (the sidebar's customer view and the new-customer
  flow) gain a **"This is a builder"** checkbox, saved through `updatePerson`
  as `{ isBuilder }` → the `is_builder` column.
- A customer marked as a builder has **no Builder box**. A builder has no
  builder, and one level is enough.
- **Unticking** a builder that homeowners still point at is blocked with
  "12 customers list Hilltop Homes as their builder. Change them first."
- **BuilderCombo** lists customers where `isBuilder` is true. "Add builder"
  runs the near-duplicate guard (`names.js`) against **all** customers:
  - a near match that is already a builder offers "Use Hilltop Homes";
  - a near match that isn't offers "Mark Barrs General Construction as a
    builder and use it";
  - otherwise it creates a new customer with `is_builder = true`, then links
    it. This is still insert-then-update, so the FK is always satisfied (same
    order as `addBuilderFor` today).
- **Deleting** a builder customer follows today's `delPerson`: their own
  projects fall to Unassigned, and homeowners' `builder_id` is nulled by the
  FK. The confirm dialog names both counts.
- **Backup and restore:** new backups carry `isBuilder` on people and no
  `builders` array. Restoring an older backup that has a `builders` array
  turns each one into a builder customer, reusing the remap that exists today
  (`App.jsx` restore, `bMap`).

## Pure logic (`custbrowser.js`) — what changes

- `projectRows({ people, projects })` builds one row per job with the customer
  and builder resolved (it replaces `browserRows` for the Projects tab).
- `personRows({ people, projects, builders: false | true })` builds the
  Customers/Builders list rows: job count, last activity, `mine` flag, and
  top salesman.
- `jobsOfPerson(person, people, projects)` returns a customer's jobs, or a
  builder's own jobs plus their homeowners' jobs.
- `searchProjects(rows, q)` filters **and ranks** as described above.
  `searchPeople(rows, q)` is the list search.
- `groupProjects(rows, by, myName)` does the salesman or builder bands, with
  your band first and keys case-folded. It replaces `groupBySales`.
- `filterBySales` becomes an exact per-job match, and applies only while the
  search box is empty.
- All of these are pure and get unit tests in `custbrowser.test.js`, which
  runs with `node --test`.

## Boot and loading

No new fetches. Light project rows, people and (legacy) builders already load
in stage 1 (ADR 0026). `is_builder` is one more projected column on the
people query. The pane is already a `React.lazy` chunk.

## Testing and proof

- **Unit tests (`custbrowser.test.js`):**
  - The Marcus/Josiah shared-customer case lands one row under each salesman,
    with Marcus's band first.
  - Customer-name hits rank above address hits.
  - Typing overrides "Me".
  - A builder's jobs include their homeowners' jobs.
  - A builder with no jobs of yours is hidden at rest and found by search.
  - Band keys are case-folded.
  - Legacy builder mode resolves names from the old table.
- **`bootload.test.js`:** `personRow` maps `is_builder`, and the fallback
  select works without it.
- **Preview proof** (non-negotiable 3): a `browserpreview.jsx` page in the
  existing `*preview.jsx` pattern that renders all three tabs against fixture
  data, including a builder with 16+ jobs. Screenshots at desktop and phone
  widths go in the PR.
- The SQL file is **shipped, never run by an agent** (non-negotiable 1). The
  PR description carries the owner's run order: preview select, then the
  migration.

## Docs to update

- `docs/CONTEXT.md`: Builder redefined as a customer marked as a builder;
  add a Salesman entry. ADR 0050 plus its index row, and ADR 0005's status
  note. (All drafted in `b0d1bc0`, withdrawn when parked.)
- `CLAUDE.md` source layout: add `supabase/builders-as-customers.sql`.
- The `floortrack-data-model` skill: the people row gains `is_builder`, and
  `builder_id` is a self-reference.
- `src/CLAUDE.md`: update the CustomerBrowser and custbrowser entries.

## Out of scope and follow-ups

- **Merging two customer records** (the non-exact duplicates the migration
  leaves). This needs its own design: moving projects, repointing
  homeowners, and handling the delete.
- **A builder's default price tier** (new projects under a builder starting
  on Builder pricing). It sounds right, but it's a pricing decision
  (ADR 0018), not a list decision.
- **The builder on the job instead of the customer** (a homeowner whose
  second job came direct). This was round 1's open question 2 and was not
  decided. The builder stays on the customer.
- **The estimate's contact block when a builder is the customer.** Round 1's
  open question 3. It prints the customer as today.
