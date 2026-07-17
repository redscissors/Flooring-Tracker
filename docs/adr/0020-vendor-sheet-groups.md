# ADR 0020 — Vendor sheets: remembered sheets organized into sign-in groups, on a Price-book tab

- **Status:** Accepted
- **Date:** 2026-07-17
- **Scope:** system-wide (UI + settings shape). `src/vendorfetch.js` (group helpers + one-way migration), `src/catalog.js` `normOps` (normalization seam), a new `VendorFetchPage` tab in the Price book library (`src/App.jsx`). No schema change, no new Supabase write path — the shared `settings` jsonb migrates itself on first load.
- **Related:** ADR 0019 (vendor sheet fetch relay — the fetch mechanic this builds on), ADR 0009 (price book library)

## Context

ADR 0019 shipped vendor fetch as a **modal** launched from the Price-book
library sidebar, and remembered fetched sheets as a single **flat list**
(`settings.ops.vendorSheets` = `[{vendor,host,uid,user,filename}]`) with no
names, no organization, and a one-shot fetch showing only "fetching…/done".

As the shop accumulated sheets across several distributor portals, the flat
list stopped scaling: there was no way to see which sign-in a sheet belonged to,
re-download just one portal's sheets, add a link to a chosen place, or clean up.
The owner asked for a real **page** (a tab like the price books), sheets grouped
by **sign-in** (one vendor portal / dealer account), per-group re-download,
progress bars with completion checks, add-a-link, and drag between groups — and
it had to work on mobile.

## Decision

**One nested store, migrated one-way.** Replace flat `vendorSheets` with
`settings.ops.vendorGroups = [{ id, name, loginUrl, portal:{host,user}|null,
sheets:[sheetRecord…] }]`. Membership *is* the grouping (no parallel index →
no drift; one `setSettings` write per mutation). `normOps` (`src/catalog.js`)
calls `normVendorGroups`, which takes `vendorGroups` if present or else migrates
a legacy flat `vendorSheets` array (`migrateVendorSheets`, one group per distinct
`{host,user}`). Migration is one-way on read; saves only ever write
`vendorGroups`. All group logic is pure and lives in `src/vendorfetch.js`.

**`portal` is nominal, never authorization.** Drag is free (the owner chose
"free drag, warn on mismatch"), so a group may hold a sheet from another account.
`portal` only drives auto-naming and the amber "other portal" chip
(`sheetMatchesGroup`). The `sesid` that fetches a sheet always comes from a live
link matching **that sheet's own `{host,user}`** — dragging never changes how a
sheet is fetched. This keeps ADR 0019's session mechanic intact: one fresh
pasted link (or bookmarklet click) unlocks every remembered sheet sharing its
account, now surfaced as a group's "Re-download all".

**Placement + interaction.** A "Vendor sheets" entry in the Price-book library
sidebar fills the right panel (`sel === "vendor"`); a bookmarklet hand-off
auto-selects it instead of opening a modal. The fetch engine (`runFetch`) is
factored out of the component and reads the response as a stream
(`res.body.getReader()`), reporting a determinate fraction when the portal sends
a Content-Length and an indeterminate animated bar otherwise (on-demand sheets
are often chunked with none). Drag reuses the app's pointer-drag pattern (mouse
+ touch), with a per-row "Move to" menu as the keyboard/touch fallback.

## Consequences

- Old installs' flat `vendorSheets` migrate silently on first load; no SQL, no
  data touch. `serializeSettings` round-trips through `normVendorGroups`, so the
  flat key never reappears.
- Session tokens still never persist (only stable params live in `sheets`); the
  live pool of `sesid`s is component state, lost on unmount — expected, since
  portal sessions expire.
- A group's `portal` mislabels nothing important if wrong: it is advisory. The
  worst case of a cross-portal drop is a sheet that "Re-download all" skips until
  its own account is unlocked, flagged by the chip.
