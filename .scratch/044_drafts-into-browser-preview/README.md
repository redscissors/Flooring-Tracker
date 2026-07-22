# Estimates & drafts into the browser + Customers button up top (2026-07-22)

Status: done

Request: "The estimates and drafts folder should also go into the quick price
search area under the customer folder. Lets also move the customer folder to
the top under new customer as a button. When selecting a salesperson to sort
in the customer popup, the quick price and estimates should also filter by
salesperson."

## What changed

- **Estimates & drafts join the browser strip** (`custbrowser.js`
  `draftRows` + `CustomerBrowser.jsx`): the header toggle is now
  **🕐 Estimates & drafts (n)** — n counts every customer-less project. The
  strip shows two sections, **⚡ Quick prices** (unchanged, keeps the 30-day
  sweep note) and **📄 Unassigned jobs** (the sidebar folder's contents),
  both newest-edit-first, both narrowed by the browser's search box.
- **Salesperson filter reaches the strip** (`quickRows`/`draftRows` grew a
  `sales` param): typing a name in the Salesperson box (or hitting "Me") now
  narrows the quick prices and unassigned estimates the same way it bands the
  customer grid — each section header shows "x of y" while filtered.
- **Sidebar** (`App.jsx`): the Customers entry moved to the top of the rail —
  a bordered button directly under **New Customer** that opens the browser.
  The in-list Customers folder row and the always-visible "Estimates &
  drafts" folder are gone; unassigned jobs (like quick prices before them)
  surface in the sidebar only while a search is active, so the sidebar search
  can still land on one. The now-unused `openDrafts` state and `folderRow`
  helper were removed.

No data-shape, lifecycle, or SQL changes: same `quick` flag, same 30-day
sweep, same promote flow. `custbrowser.test.js` covers the new `draftRows`
and the stacked search + salesperson filters (683 tests pass).

## Preview

- `preview-browser.png` — the REAL `CustomerBrowser` with fake data: toggle
  on, strip showing both sections (3 quick prices, 3 unassigned jobs).
- `preview-browser-sales.png` — same page with "Marcus" in the Salesperson
  box: grid bands to Marcus Mast, strip narrows to "2 of 3" / "1 of 3".
- `preview-sidebar.png` — before/after mock of the rail: Customers button up
  top under New Customer, folders gone from the list.
- Harness: `entry.jsx` (bundled with esbuild + the project's tailwind build)
  → `browser.html`/`sidebar.html`, shot with `shot.mjs` (Playwright) — same
  rig as `.scratch/042_quick-price-org-preview`.
