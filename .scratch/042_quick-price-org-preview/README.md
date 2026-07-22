# Quick prices — auto-names + folded into the Customers folder (2026-07-22)

Status: done

Request: "Right now quick price sheets are [hard] to find the one you were
working on. Could we have it rename something like Q-'first line item'-'date'?
Also maybe fold them into the customer folder but hide them behind a show
quick price button."

## What changed

- **Auto-naming** (`model.js` `quickAutoName`/`isQuickAutoName`, hooked in
  `usedirectory.js` `updateProject`): a quick draft renames itself on every
  content save to `Q-<first line item>-<M/D>` — the first non-blank row's
  brand/color (falling back to its SKU, then its type label) plus the day the
  quote was started. It only does this while the current name still looks
  auto-generated (the seeded "Quick price" or a previous `Q-…-M/D`), so a
  hand-typed rename in the header is never overwritten. The name lives in the
  data blob's `name` (already projected into the light rows), so the sidebar,
  search, browser, and printed estimate all pick it up with no schema change.
  Sheoga's "New quick price" path names its draft the same way at creation.
- **Folded into the Customers folder** (`CustomerBrowser.jsx` + `custbrowser.js`
  `quickRows`): the browser header gains a **⚡ Quick prices (n)** toggle
  (hidden when there are no drafts). Toggled on, a strip above the grid lists
  the customer-less drafts newest-edit-first — name, salesperson, created ·
  modified — narrowed by the same search box; clicking one opens the draft.
  The strip carries the 30-day-sweep note that used to sit in the sidebar.
- **Sidebar** (`App.jsx`): the Quick Prices section leaves the "Estimates &
  drafts" folder — that folder now holds only unassigned jobs. Matching quick
  drafts still appear there while a search is active, so the sidebar search
  can always land on a draft. The Customers folder row also shows when only
  quick drafts exist (no people yet), so the browser stays reachable.

Nothing about the ADR 0022 lifecycle changed: same `quick` flag, same 30-day
sweep, same promote flow, no SQL.

## Preview

- `preview-browser.png` — the REAL `CustomerBrowser` component rendered with
  fake data (it's pure props): toggle on, strip showing `Q-Daltile / Arctic
  White-7/22`-style names.
- `preview-sidebar.png` — before/after mock of the sidebar arrangement.
- Harness: `entry.jsx` (bundled with esbuild + the project's tailwind build)
  → `browser.html`/`sidebar.html`, shot with `shot.mjs` (Playwright).
