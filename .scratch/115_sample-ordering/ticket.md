---
issue_type: Feature
summary: "Owner 8/28: make ordering samples for a project's items easier.
  Reworked design (8/28): a shared sample_requests table (need/ordered) keyed
  off the line at request time, not a field on the product row — so a mark
  survives whatever happens to that line afterward and the whole team sees
  the same status. Marked from the line menu, a Samples panel groups requests
  by vendor with Mark all ordered and a one-click Email-the-rep, a Samples
  button badges both header layouts, and the customer browser gets a samples
  column + filter."
status: done
labels: [ready-for-human]
---

# Sample-ordering workflow (owner, 8/28)

The owner asked for a way to make ordering samples for the items on a project
easier. Today nothing tracks which selections a customer wants to see, whether
the sample's been ordered, or what to ask each vendor for — that list is
assembled by hand.

The first pass (v1, same day) stored the mark as `product.sample` on the job
line. Reworked per the design at
`docs/superpowers/specs/2026-08-28-sample-ordering-design.md` (plan:
`docs/superpowers/plans/2026-08-28-sample-ordering.md`) into its own shared
table before merge, because a mark tied to a job-line field disappears the
moment that line is duplicated, moved, deleted, or its option scope changes —
none of which should un-ask for a sample — and a per-line field has no home
for the vendor rep contact a request also needs.

## What shipped

1. **`sample_requests`** (`supabase/samples.sql`, owner runs by hand — a
   pending write path until then, same as every other `supabase/*.sql` file)
   — one row per request, carrying both a snapshot (customer/area/item name,
   sku, size, type, vendor) and the live ids (`projectId`/`productId`/`bookId`)
   the report/panel need. `status` is `"need"` or `"ordered"` only — v1's
   third "received" state didn't survive the rework (samples.js
   `normSampleRequest`/`requestFrom`, data-model skill updated). Product rows
   carry no sample field at all now.
2. **`src/usesamples.js`** — the one write path, shaped like
   `useClaudeIssues`: `addSampleRequest`/`delSampleRequest`, and
   `setSampleOrdered(ids, ordered)` — an ID list, so "Mark all ordered" for a
   vendor is one upsert, never one write per row. Loaded via
   `loadSampleRequests` (bootload.js), hydrated in App's stage-2 background
   boot block alongside todos/claude issues, with an on-open refresh from the
   header's Samples button and the customer browser's Customers folder.
3. **`src/samples.js` + `samples.jsx`** — `sampleGroups` groups requests by
   the vendor frozen at request time (book brand label/name; Sheoga lines
   under Sheoga; everything else under a trailing "Other"), `sampleCounts`
   feeds the header badge, `projectSampleTally` rolls requests up per project
   for the browser. The `SamplesPanel` (order-entry dock shell) is a two-way
   status toggle per line, per-vendor **Mark all ordered**, and **Email the
   rep** — a mailto built from `repEmail`/`mailtoHref` (item list + the
   customer as ship-to, deliberately no salesperson info — samples ship
   direct to the customer, owner call) — falling back to a Copy-email button
   with a "No rep on file" hint when the vendor has no email saved.
4. **Rep contact** — a Rep tab (`RepCard`, pricebooklib.jsx) on every book
   page, all book kinds, holding `book.data.rep {name, email}` — the contact
   the panel's Email button addresses.
5. **App wiring** — the line menu (⋯ / right-click) and the mobile row sheet
   both gain **Request sample** (`toggleSample`); a marked row shows a
   status-colored layers icon in its action cell that opens the panel; both
   header layouts carry a Samples button badged on any open (need) request.
6. **Customer browser** — a draggable Samples column (amber "N to order" +
   moss "M ordered" chips, shared `sampleChips`) and a Samples filter button
   (open = any need > 0), fed `sampleTally={projectSampleTally(sampleRequests)}`
   from App; chips also show on the unfiled strips and the project-lines
   panel.
7. **Previews** — `samples-preview.html` (`src/samplespreview.jsx`, stateful,
   the real panel) with `?empty=1` for the empty state and `?browser=1`
   mounting the real `CustomerBrowser` over mock requests so the samples
   column/filter show against a sample-less second customer; header +
   line-menu harnesses pass the new props. Screenshots in this folder.

Deliberately not in v1 or the rework: no print/estimate presence, no
option-scope picker (samples get ordered while options are still being
decided, so requests are unscoped across A–L), no cross-project samples desk.
