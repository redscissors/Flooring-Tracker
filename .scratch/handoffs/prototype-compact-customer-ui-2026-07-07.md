# Prototype outcome — compact Customer UI (2026-07-07)

**Question:** the Customer view and the Project header each opened with a tall,
always-expanded contact block that pushed the real work (the Projects list / the
Areas & Selections) down past the fold. What compact layout puts the work first?

**Method:** three directions were mocked (A command bar, B two-line header, C
details drawer), compared on header height and "areas above the fold." B was
picked. A throwaway `src/CompactUiPrototype.jsx` (now deleted) then rendered the
chosen B layout for both levels on the live app behind `?proto=compact` (dev-only,
mounted before the auth gate so it needed no Supabase), previewed with mock data
and screenshotted at 1280×860.

**Answer (Direction B, folded into `App.jsx` the same day):**
- **Shared `MetaChip`** component: a contact/meta value shown as a pill that
  highlights and expands its editor inline when clicked (one open at a time).
- **Customer view:** serif name kept; the two-column form (phone, email, address,
  builder, notes) collapses to a `MetaChip` row; a "N projects" count sits
  top-right; Delete moved to an icon button. Project rows gained a **last-updated**
  timestamp (`fmtAgo(p.updatedAt)`) — no dollar value (the list holds metadata
  only; a rolled-up total was deliberately out of scope).
- **Project header:** two-line header (serif title + estimate on top); breadcrumb
  folded into a clickable eyebrow (`builder · customer · Tile & Flooring`, customer
  links to the person view); address / phone / notes / files became `MetaChip`s
  that expand inline; secondary toolbar actions (history, CSV, order sheet, delete)
  became icon buttons, Print stays labeled. Version-naming inline flow preserved.

**Rejected:** A (command bar — too aggressive, hides contact behind a popover),
C (details drawer — most screen but contact editing becomes a mode-switch).

**Scope / safety:** presentation-only. No data-model change (`updatedAt` already
existed), no Supabase writes, no SQL, no new deps. Verified by `npm run build`
(passes) and `npm test` (85/85). Preview proof: prototype screenshots (markup is
identical to the folded-in JSX). Landed on branch `claude/compact-customer-ui-lgk733`
(PR #30).
