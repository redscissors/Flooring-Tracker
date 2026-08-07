# wedi & Sheoga buttons in the customer column (2026-08-07)

Status: done

Request: "I would like to add wedi and sheoga buttons to the customer column.
Below customers have wedi and sheoga buttons beside each other. Also leave
buttons in the apps area as well."

## What changed

- **Sidebar** (`App.jsx`): a new row in the rail's footer, directly below the
  customer list — **wedi | Sheoga** side by side, above the Apps row. Each
  opens the Apps hub straight onto its configurator via `openAppsTo(k)`
  (sets `appsStart`, then the existing `openApps`, so labels still load and
  the mobile drawer still closes). The plain Apps button routes through
  `openAppsTo(null)` so it keeps landing on the default app.
- **Apps hub** (`AppsWorkspace.jsx`): new optional `initialApp` prop seeds the
  `app` state (validated against `APP_NAME`, falls back to "labels"). The
  hub's own rail entries are untouched — wedi and Sheoga stay listed there.

No data-shape, lifecycle, or SQL changes. 909 tests pass; production build OK.

## Preview

- `preview-sidebar.png` — the rail with the new wedi | Sheoga row below the
  customers, above Apps.
- `preview-hub-wedi.png` / `preview-hub-sheoga.png` — the REAL `AppsWorkspace`
  opened with `initialApp="wedi"` / `"sheoga"`: lands on the configurator,
  rail entry highlighted, Label Generator still first in the list.
- Harness: `entry.jsx` (esbuild-bundled with the project's built CSS; the
  sidebar is a verbatim-classes mock since the rail lives inline in App.jsx,
  the hub shots render the real component) → `page.html#sidebar|wedi|sheoga`,
  shot with `shot.mjs` (Playwright) — same rig as
  `.scratch/044_drafts-into-browser-preview`.
