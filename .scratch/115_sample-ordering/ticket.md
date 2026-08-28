---
issue_type: Feature
summary: "Owner 8/28: make ordering samples for a project's items easier.
  Per-line sample request (product.sample — need/ordered/received) marked from
  the line menu, a Samples panel grouping the marks by vendor with status
  chips, Mark all ordered, and a per-vendor copy list; Samples button with an
  open-count badge in both header layouts."
status: done
labels: [ready-for-human]
---

# Sample-ordering workflow (owner, 8/28)

The owner asked for a way to make ordering samples for the items on a project
easier. Today nothing tracks which selections a customer wants to see, whether
the sample's been ordered, or what to ask each vendor for — that list is
assembled by hand.

## What shipped

1. **`product.sample`** (model.js `normSample`, data-model skill updated) —
   `null` or `{ status: "need"|"ordered"|"in", at }`, `at` = when the status
   last moved. Team-shared like the rest of the row; duplicate-line clears it
   so a copy can't silently double-order.
2. **Marking** — the line menu (⋯ / right-click) gains **Request sample**;
   the mobile row sheet gets the same toggle. A marked row shows a small
   status-colored layers icon in its action cell (amber = to order, slate =
   ordered/waiting, moss = received) that opens the panel.
3. **`src/samples.js` + `samples.jsx`** — `sampleGroups` collects the marked
   lines grouped by the vendor the row snapshotted from (book brand label /
   name; Sheoga lines under Sheoga; the rest under Other — that's the unit a
   sample order is placed in), `sampleCounts` feeds the badges,
   `sampleCopyText` the per-vendor copy list. The SamplesPanel (order-entry
   dock shell) steps each request To order → Ordered → Received, offers
   **Mark all ordered** per vendor and **Copy list** for the portal/email.
   All writes land as ONE `updateProject` categories patch (the options.js
   stale-closure rule).
4. **Header** — both layouts get a Samples button with an open-count badge
   (amber while anything is still to order, moss once it's all in flight/
   arrived); open = not yet received.
5. **Previews** — `samples-preview.html` / `src/samplespreview.jsx` (stateful
   harness over the real panel); header + line-menu harnesses pass the new
   props. Screenshots in this folder.

Deliberately not in v1: no print/estimate presence, no option-scope picker
(samples get ordered while options are still being decided, so the panel is
unscoped), no cross-project samples desk.
