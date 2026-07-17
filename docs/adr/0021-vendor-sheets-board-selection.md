# ADR 0021 — Vendor sheets: board layout, batch selection, and always-live downloads

- **Status:** Accepted
- **Date:** 2026-07-17
- **Scope:** UI-only (`VendorFetchPage` / `VendorGroupCard` / `VendorSheetRow` in
  `src/App.jsx`). No settings-shape change, no new write path — selection is
  component state, and the stored `settings.ops.vendorGroups` from ADR 0020 is
  untouched.
- **Related:** ADR 0020 (sign-in groups — amends its layout and interaction
  decisions), ADR 0019 (fetch relay — the sesid mechanic is unchanged)

## Context

ADR 0020 shipped the Vendor sheets tab as full-width sign-in cards stacked down
the page, with per-sheet rows carrying text chips and a drag handle. With a few
portals and a dozen sheets, seeing everything meant scrolling, and the only
batch action was a group's "Re-download all" — there was no way to pick an
arbitrary set of sheets (across sign-ins or within one) and pull them in one go.
Download buttons were also pre-locked: a sheet whose portal had no live session
showed a disabled button and a "needs a fresh sign-in link" status, which read
as broken rather than instructive.

The owner asked for: a single-download trigger per sheet, pick-what-you-want
batch download, a compacted near-mobile layout with columns side by side so
more sheets fit at a glance, row actions behind a ⋯ menu with the move list
collapsed until wanted, and to "just trust the user to know to sign in".

## Decision

**Board layout.** Each sign-in renders as a slim column card
(`repeat(auto-fill, minmax(240px, 1fr))` — side by side on desktop, stacking to
one column on phones). Sheet rows are single-line: checkbox · filename ·
icon-only warn chips (mismatch / stale book, tooltips carry the words) ·
re-download · ⋯ menu. Group headers compact to name · download-all icon · ⋯
menu (rename / sign-in link / delete), with the login link and sheet count on a
sub-line.

**Batch selection is ephemeral UI state.** Checking rows raises a floating
"N selected · Download selected" bar; the set spans sign-ins and lives only in
component state (keyed by `recordKey`), cleared per-sheet as fetches succeed.
Nothing about selection persists or syncs — it is a picking gesture, not data.

**Always-live downloads ("trust the user").** No download button is ever
pre-locked. `run()` takes plain sheet records and resolves each one's live
session itself; a sheet whose portal has no fresh link fails *on its own row*
with a note saying exactly how to unlock ("sign in on this portal and click
the bookmark (or paste a fresh link), then retry"). The ADR 0019 mechanic is
unchanged — a fetch still requires a sesid from a live link matching the
sheet's own `{host,user}`; what changed is *when the user learns that*: at the
moment they act, in words, instead of a greyed-out control. Consequently a
group's "download all" now attempts every sheet (locked ones error per-row)
instead of silently skipping them.

**Menu move replaces pointer-drag.** The board's dense rows drop ADR 0020's
drag handle; moving a sheet between sign-ins happens from its ⋯ menu, where
"Move to another sign-in" is a collapsed line that expands in place to the
destination list (keeps the menu to four quiet lines). "Forget this sheet"
moves from an always-visible ✕ into the same menu, behind one more click —
appropriate for a destructive-ish action. Free movement stays safe for the
ADR 0020 reason: `portal` is nominal and never authorizes a fetch.

## Consequences

- More sheets visible per screenful; the phone layout is the desktop layout
  (columns collapse to one), so there is no second code path.
- A user who ignores sign-in entirely gets N red rows with the same
  instruction, not a mystery of disabled buttons — and a stale `sesid` already
  failed at fetch time before, so error-on-act is the consistent behavior.
- Pointer-drag between groups is gone. If muscle memory misses it, it can come
  back on top of the board without touching data — but the menu list is the
  touch-safe path ADR 0020 already named as the fallback.
- Status text ("ready to fetch", "→ book") left the row for density; the book
  link now lives in the filename tooltip and the ⋯ menu header.
