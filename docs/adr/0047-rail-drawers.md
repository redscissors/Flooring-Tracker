# ADR 0047 — Apps and Settings open in the work area from rail drawers

- **Status:** Accepted
- **Date:** 2026-09-24
- **Scope:** system-wide (navigation shell)
- **Related:** amends [ADR 0028](0028-open-layer-restore-and-one-press-escape.md) §3;
  spec `docs/superpowers/specs/2026-09-24-rail-drawers-design.md`

## Context

The Apps hub and Settings were full-window pop-ups with their own left menus.
Apps always mounted the Label Generator first; Settings always landed on
Materials & add-ons; both hid the project, and closing the hub discarded any
staged configurator build.

## Decision

1. The Apps button slides an Apps tray up out of the rail's bottom bar; the
   gear slides a Settings drawer down from under the logo. One drawer at a
   time; one ~1.3 s height slide per panel, content pinned to the panel edge
   it emerges from; no per-row animation.
2. Nothing loads until an item is picked. The pick fills the work area over
   the still-mounted project (X / back link / Esc return to it).
3. Configurators stay mounted after their first pick. Returning to one that is
   in progress after a *break* — the Apps tray closing (its button or opening
   Settings) or the open project changing — asks **Continue build / Start
   new**. Hopping between apps with the tray open never asks.
4. The rail's wedi / Sheoga shortcuts stay and open the tray as well.

Options weighed (prototype, owner 2026-09-24): tray + app fills the work area
(chosen); tray + app as a pop-up over the dimmed project (narrower, squeezes
Sheoga's grid); a start-menu pop-out (switching apps costs two clicks).

## Consequences

- Navigation state lives in `src/railnav.js` (pure, tested); `ft-open-layer`
  stores `{ kind: "apps", app }` / `{ kind: "settings", section }` or the
  bare open drawer, and still reads the older shapes.
- A build is never tied to a project: Add lands it on whichever project is
  open, so starting a build and then opening the right customer is how a build
  changes customer.
- Slide speed is one constant (`RAIL_SLIDE_MS`) to tune after use.
- Configurators kept mounted in the pane only listen for Escape while on
  screen (`escActive`, default true for the row-opened pop-ups); while one
  shows, its own Escape chain — inner menus first, then close — replaces the
  pane's, so the project → customer → home Escape ladder is untouched.
- Sheoga's docked price grid now needs the pane to hold it beside the 205px
  rail, so it docks from about 1790px instead of the ~1626px the old hub
  reached by folding its own app list (owner decision 2026-09-04). The owner
  accepted this trade-off (2026-09-24) over folding the main rail on Sheoga,
  which would fight the tray staying open; revisit if the grid is missed on
  1680–1728px screens.

## Amendment 2026-09-24 — Customers joins the work area; pages carry their own back caret

Owner, same day: the Customers browser stops being a near-fullscreen pop-up and
opens in the work area like Apps and Settings (`openCustomers` in
`railnav.js`; a pane of kind `customers`, persisted as the old
`{ kind: "browser" }` layer so a refresh still reopens it). It replaces
whatever app or setting was showing and counts as leaving a configurator, so
the Continue / Start new rule is unchanged. The rail's Customers button stays
highlighted while it shows.

The breadcrumb bar ("← project › Apps › Sheoga" + X) is gone from every page
but the Label Generator, which keeps it until its own redesign. Instead each
page's own title row carries a back caret to the left of its icon or title
and the X at the row's right end (`PaneBack` / `PaneClose` in
`raildrawer.jsx`): Customers, Sheoga, wedi (and its catalog gate), Schluter,
the resume prompt, and every Settings section — Materials & add-ons, which had
no title, gets a slim one. Both return to the project; the configurators show
them only when embedded, so the row-opened pop-ups are unchanged. The
browser's header also drops its customer and project counts and its New customer
button (the rail's New Customer does the same thing).
