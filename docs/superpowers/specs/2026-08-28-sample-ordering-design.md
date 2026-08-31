# Sample ordering — design

**Date:** 2026-08-28
**Status:** Approved by owner (brainstorming session; supersedes the v1 built earlier on this branch)
**Area:** Sample requests on project lines, the project Samples panel, rep emails, and the customer browser's samples column/filter.

## Context

The owner asked for a way to make ordering samples for a project's items easier.
The brainstorming answers that shaped this design:

- **All three stages hurt:** building the list of what to order, placing the
  orders, and tracking what's been ordered.
- **Both views:** samples visible on the project, AND one place to see samples
  across all jobs — which the owner wants **integrated into the customer
  browser** (its own column + a filter), not a separate screen, "so there's
  only one place to gather information about a job."
- **Orders are placed by emailing each vendor's rep.**
- **Samples ship direct to the customer** — the email carries the customer's
  name and the project's address.
- **Two statuses only:** *To order* and *Ordered* (who/when). No
  arrived/verdict tracking.
- **Architecture:** requests live in their own shared table (approach A),
  claude-issues style — snapshot + live ids, one write path, every surface
  reads the same rows. No field on product rows (v1's `product.sample` comes
  back out of `normP`).

## Non-goals

- Nothing on printed estimates or order sheets.
- No arrived/received tracking and no customer verdicts.
- No auto-clearing of old ordered rows (manual remove only).
- No in-app mail sending — the app opens the user's mail client (`mailto:`)
  or copies the body; a person always sends.
- No cross-project per-vendor batching surface in v1 — the browser filter
  shows which jobs have samples to order; ordering happens on the project.
  (Possible follow-up if the shop wants one email spanning several jobs.)

## Design

### 1. Data model — `sample_requests` (supabase/samples.sql)

One row per request, modeled on `claude_issues` (same trust model: every
signed-in user can add, edit, delete):

```
sample_requests row: { id text pk, data jsonb, created_at, updated_at }
data: {
  status: "need" | "ordered",
  createdBy, createdAt,
  orderedBy, orderedAt,            // stamped when status flips to ordered
  custId,                          // live project id (customers table row)
  custName, areaName, productId,   // custName = snapshot for display
  bookId, bookName,                // vendor grouping (brandLabel over name)
  item: { name, sku, size, type }  // snapshot at request time
}
```

> Amendment (2026-08-29, owner): the project-id field ships named `projectId`
> (not `custId`) — renamed before any data existed, so "customer" can't be
> misread as the person.

- **Snapshot + live ids** (the claude-issues doctrine): the row stays readable
  in the browser column and panel even if the product line is later edited or
  deleted; live ids let surfaces match rows and open the project.
- **Single source of truth:** product rows carry nothing. The grid's row icon,
  the panel, the header badge, and the browser column all derive from the
  loaded requests. No dual write, nothing to drift.
- `supabase/samples.sql` ships in the PR; the owner runs it once by hand
  (non-negotiable #1). Until it's run, writes fail with the todos-style ping
  ("run supabase/samples.sql?") and the surfaces render their empty states.

### 2. Loading & write paths

- Requests are a **bounded** list (like todos): loaded in the background after
  first paint (ADR 0026 stage-2), hydrated into App state, refreshed when the
  project Samples panel or the customer browser opens.
- `usesamples.js` — the one write-path hook, shaped like `useTodos`:
  `addSampleRequest(project, area, product)` (builds the snapshot),
  `setSampleStatus(id, ordered)` (stamps orderedBy/orderedAt from the
  profile), `delSampleRequest(id)`, plus a bulk
  `markVendorOrdered(custId, bookKey)` that flips a vendor group in one
  upsert. Optimistic state + Supabase write, todos error idiom.
- CLAUDE.md's conventions section records the write path.

### 3. Project surfaces

Unchanged from v1 in shape, re-plumbed to the table:

- **Marking:** "Request sample" in the line's ⋯ menu (and right-click);
  the same toggle button on the mobile row sheet. Marking creates a request;
  toggling off removes it.
- **Row icon:** a small layers icon on marked rows in the action cell —
  amber = to order, moss = ordered; click opens the panel.
- **Header:** a thin **Samples** button in both header layouts; badge counts
  this project's *To order* requests.
- **Panel:** right-dock (order-entry shell), this project's requests grouped
  by vendor. Each line: To order / Ordered chips (with "ordered 8/28 · Danny"
  detail), the item (size · name — SKU · area), remove ×. Each vendor group:
  **Email the rep** and **Mark all ordered**.

### 4. The rep email

- Each price book gains an optional **rep contact** — `data.rep = { name,
  email }` — edited on the book page beside the brand box (both stock and
  order books). Not snapshotted into requests; read live at email time.
- **Email the rep** opens the user's mail client via `mailto:`:
  - Subject: `Sample request — <customer name>`
  - Body: greeting (rep's first name when known), the item list
    (`size · name — SKU`, one per line), and a **Ship to** block — customer
    name + the project's address and phone, read live from the project.
  - **No salesperson info** in the body (owner call 2026-08-28).
- No rep email on file → the button copies the same body to the clipboard and
  says where to add the address (the book page). Copy is always available as
  a fallback beside the mailto.

### 5. Customer browser integration (the shop-wide view)

The browser (issue 040) is the one place to gather information about a job,
so samples join it rather than getting their own screen:

- **A `samples` column** joins `BROWSER_COLS` (draggable/orderable like the
  rest): per customer, a compact roll-up of their projects' requests —
  amber `N to order` and/or moss `N ordered`; blank when none. The bottom
  project-lines panel shows the same per-project counts on each line.
- **A Samples filter button** beside the salesperson box narrows the grid to
  customers (and the Estimates & drafts strips to projects) with any open
  request — one press answers "what still needs ordering."
- Roll-ups compute from the loaded requests keyed by `custId` against the
  boot's light rows; opening the browser refreshes the requests like opening
  the todos modal does.
- Ordering actions stay on the project: click through (the browser already
  opens projects) and use the panel there.

### 6. What happens to the v1 code on this branch

| v1 piece | Fate |
|---|---|
| `product.sample` in `normP` + duplicate-clears + model tests | **Removed** (table is the only source) |
| `samples.js` grouping/copy/labels | Reworked: rows come from the table; email-body builder added; statuses shrink to need/ordered |
| `samples.jsx` panel | Reworked to the table + Email the rep |
| Line menu / mobile / header / row-icon wiring | Kept, re-plumbed |
| `samples-preview.html` harness | Reworked; browser-column preview added to the header/browser harness story |
| Data-model skill Product field note | Replaced by a `sample_requests` table section |

### 7. Testing & preview proof

- `node --test`: request normalization + snapshot builder, vendor grouping,
  email subject/body builder (mailto encoding included), browser roll-up +
  samples filter over light rows, status flip stamps.
- Preview screenshots before merge (non-negotiable #3): the reworked panel
  (with the email button), the browser's samples column + filter, the row
  icon, both header buttons — via the existing dev-only harnesses.
- Nothing here touches the live Supabase project; the SQL file is delivered,
  never executed, by the agent.
