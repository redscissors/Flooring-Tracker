---
issue_type: Task
summary: Let the team manage which grout and mortar products appear in a job's dropdowns from shared Settings — organized by company, each product show/hide-able, with its coverage numbers — instead of the lists being fixed in code.
status: needs-triage
labels: [needs-triage]
---

# Manage the grout & mortar dropdown options from Settings

## Problem / Why

When someone picks a grout or mortar on a job, they choose from a **fixed list
baked into the app** — today: PermaColor Select / SpectraLOCK 1 / SpectraLOCK PRO
for grout, ProLite / AcrylPro for mortar. Settings only lets the team tweak the
*numbers* behind those products (coverage, price); it does **not** let them change
*which products appear* in the lists.

That list doesn't match what the store actually carries. When the product line
changes, there's no way for the team to fix it themselves — it takes a developer
editing code. The team wants to own their own product lists.

## Goals

1. **The team controls the grout/mortar lists themselves** — add products, and
   turn products on or off — with no developer involvement.
2. **The lists stay tidy** even as products accumulate, so picking a grout/mortar
   on a job doesn't mean scrolling a cluttered dropdown.
3. **Nothing already saved breaks.** Turning a product off must never damage,
   hide, or lose a finished job that already used it.

## Non-goals

- **Colors are out of scope.** The grout color list stays exactly as it works
  today (a single shared list, unchanged). See *Out of scope* for why.
- **No rename of existing products.** (Decided — see *Out of scope*.)
- **Not** changing the material math, pricing model, versions, attachments, or
  the grout/mortar coverage formulas themselves — only *which* products are
  offered and whether their numbers are shown.
- **Not** touching the Private/Public sharing model for jobs.

## Who uses this & how

The same small team of flooring/tile contractors, all signed in, working mostly
from a shared (Public) pool of jobs. Any of them sets up jobs and picks
grout/mortar, and any of them should be able to maintain the shared product
lists — the lists are a shared tool, like the jobs themselves.

## Requirements

### A. The lists are organized by company, two levels deep

- Grout and mortar products are grouped under a **company** (e.g. Laticrete,
  Custom Building Products). The structure is two levels: **Company → Product**.
- Settings shows this as a **collapsible tree**: each company is a row that can be
  **expanded** to reveal its products, and **collapsed** to hide them — so the
  team can keep most of the list tucked away and only open the company they're
  working with. This keeps Settings uncluttered as products pile up.

### B. Show / hide with checkboxes (not delete)

- Every **company** has a checkbox, and every **product** has a checkbox.
- A product appears in a job's grout/mortar dropdown **only if both its company
  and the product itself are checked.** Unchecking a company hides **all** of its
  products from the dropdowns at once.
- Turning a product (or company) off is a **hide, not a delete** — the product and
  its numbers are still stored, just no longer offered for new picks. There is no
  destructive "delete a product" action in this feature.

### C. Each product carries its own numbers, shown only when enabled

- A grout product carries its **coverage rate**; a mortar product carries its
  **three coverage tiers and its price** — the same numbers Settings edits today.
- When a product is **checked (on)**, its numbers are shown beneath it and can be
  edited. When **unchecked (off)**, the numbers are **hidden from view but still
  stored** — so re-enabling the product brings its numbers back unchanged.

### D. Adding products

- The team can **add a new company** and **add a new product** under a company,
  filling in that product's numbers (coverage for grout; tiers + price for mortar).
- The lists start **seeded with today's built-in products** so nothing changes on
  day one; the team then organizes/extends from there.

### E. The lists are shared across the whole team

- These lists are **shared, not per-person.** When anyone changes the lists
  (adds, checks, unchecks, edits a number), the change applies for **everyone**.
- **Anyone signed in can edit the shared lists** — matching today's rule that
  anyone can edit a Public job. (Stated assumption — flag if maintaining the lists
  should instead be restricted to certain people.)

## Scope edges & rules

- **A job that already used a now-hidden product is unaffected.** The job keeps
  the product it recorded; hiding only removes the product from *future* picks.
  The job continues to display and calculate exactly as before.
- **Unchecking a product mid-job:** if a product is turned off while a job that
  uses it is open, the job keeps its selection; the product simply won't be
  offered for *new* selections on that or any job.
- **Newly added products** start in whatever checked/unchecked state they're
  created in (default: on, so a freshly added product is immediately usable).
- A **company with no products** is allowed (you can create the company first,
  then add products under it).

## Open business questions

_None outstanding — all questions raised during the interview were resolved._

## Out of scope / future

- **Renaming an existing product was considered and cut.** Product/company names
  almost never change in practice; on the rare occasion one does, a one-off manual
  fix is acceptable. Building rename — which would have to reach back into every
  old job that used the product — isn't worth it for how rarely it's needed.
- **Colors were considered and left as-is.** Because each saved job stores its own
  copy of the color it chose, changing the master color list never rewrites old
  jobs — so there's no pressing reason to bring colors under this management UI.
  Colors remain the single shared list they are today.
- **Per-person lists were rejected** in favor of shared, team-wide lists (the jobs
  the lists feed are themselves shared).

## Design decisions

_Resolved in design review — full rationale in
[ADR 0002](../../docs/adr/0002-shared-grout-mortar-catalog.md). New domain terms
(Catalog, Company, Grout/Mortar product, Shared Settings, Enabled) are defined in
[docs/CONTEXT.md](../../docs/CONTEXT.md)._

- **[Resolved]** All Settings (the **waste factor** *and* the catalog) move from
  per-user storage into **one shared store** every signed-in user can read and
  write. The former per-user settings store is retired.
- **[Resolved]** The catalog is structured **Company → Product**, each carrying an
  **enabled** flag, saved as one chunk.
- **[Resolved]** Jobs keep linking to a grout/mortar **by name only**; to keep the
  name an unambiguous key, **product names are unique** within grout and within
  mortar. Company-qualified keys / stable ids were rejected because they would
  force rewriting every existing job. The math resolves a product by name
  regardless of its enabled state, so a job using a hidden product still
  calculates.
- **[Resolved]** **Concurrency: last-write-wins is accepted, deliberately.** The
  catalog saves whole, so simultaneous Settings edits clobber (same as job `data`,
  per ADR 0001). Settings edits are rare; optimistic conflict detection (check on
  save, prompt to overwrite/refresh) was designed and **deferred** as a future
  upgrade, not missed.
- **[Resolved]** Catalog is **seeded from today's built-in products under the same
  names** so existing jobs resolve untouched; the team assigns them to companies.

- **Display of a no-longer-offered value:** a job that recorded a product now
  absent from the offered list must still *display* that recorded value. The app
  already does this for tile **thickness** (it injects the stored value back as an
  option when it isn't in the standard list); apply the same pattern here.
- **Note on coverage edits (existing behavior, unchanged):** unlike a color (a
  frozen label on the saved job), a grout/mortar's **coverage number is looked up
  live by product name** during calculation, so editing a product's coverage rate
  re-flows into the estimates of *all* jobs using it. Existing behavior, surfaced
  more visibly by this feature.
