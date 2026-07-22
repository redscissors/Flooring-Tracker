# Customer browser — ERP-style directory grid (2026-07-22)

Status: done

Request: "I would like the customer folder to open [an ERP-style order-screen
grid] instead of the expanding folder system we have now. It needs to be
compact to show lots of customers at once. 1. sorted by salesman 2. sort by
date created (newest first) / last modified / alphabetical 3. searchable by
name/phone/address 4. open to more ideas."

## What changed

- **`CustomerBrowser.jsx`** (lazy chunk, ADR 0026) — a near-fullscreen overlay
  modeled on the team's ERP order screen: a dense grid (one ~26px row per
  customer: name, builder, phone, address, email, job count, created,
  modified) over a bottom "project lines" panel for the selected customer,
  exactly like the ERP's Order Lines pane.
- **Grouped by salesman** — band rows per salesperson (A–Z, "No salesperson"
  last). A customer's salesman is the salesperson snapshot (ADR 0008) of
  their most recently touched project.
- **Salesperson box + "Me"** (2026-07-22 follow-up, replacing the earlier
  "By salesman" toggle): type a salesman's name to see only their
  customers/projects; the "Me" button to its right fills the signed-in
  profile's name (Settings → General), then swaps to an × to clear. Matches
  ANY of a customer's projects — a shared customer shows for both salesmen.
- **Sorts**: Created (newest first, the default) / Modified / A–Z — as the
  segmented control or by clicking the Customer/Created/Modified column
  headers.
- **Search** spans customer name, phone, address, email, builder, and project
  names. Arrow keys walk the visible rows from the search box; Enter opens
  the highlighted customer. Double-clicking a row also opens the customer;
  single click selects it and shows its project lines (click one to jump
  straight into the estimate).
- **Sidebar**: the "Customers" folder row now opens the browser (the age
  buckets — This month / Last 3 months / This year / Older — are retired).
  Pinned recents and the flat small-list/search views stay.
- **Light rows carry the salesman**: `LIST_SELECT` now projects
  `data->salesperson->>name` (`sales` on the light row) so the browser groups
  without fetching any full blobs — opening it costs zero round trips.
- Pure logic (rows/filter/sort/group) lives in `custbrowser.js` with
  `custbrowser.test.js` coverage; quick-price drafts never count against a
  customer.

## Preview

- `browser-desktop.png` — grouped grid + project-lines panel (Chris Beauchamp
  selected), empty Salesperson box with its Me button
- `browser-me-filter.png` — Me pressed: only Marcus Mast's 6 customers
- `browser-sales-typed.png` — "gina" typed: 13 of 26, incl. shared customers
  whose older projects are Gina's
- `browser-search.png` — "mast" narrowing to 5 of 26 across three salesmen
- `browser-mobile.png` — 390px with the Me filter on; grid scrolls horizontally

Harness: `preview.html` / `src/preview.jsx` (real component, fake directory).
