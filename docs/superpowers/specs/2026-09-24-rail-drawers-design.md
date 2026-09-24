# Rail drawers — Apps rise from the bar, Settings drops from the logo — design

**Date:** 2026-09-24 · **Status:** approved design, not yet implemented

Prototype the owner signed off on (v4):
https://claude.ai/artifact/TmLaLgXEmZpntm5CsiR9j4

## Problem

The Apps button (the grid icon in the rail's bottom bar) opens the Apps hub as
a full-window pop-up with its own left-hand app list, and it always mounts the
Label Generator first — even when the salesperson wanted a configurator. The
list sits far from the button that opened it. Settings has the same shape: a
full-window pop-up with its own left menu that always lands on Materials &
add-ons. Both cover the project, so checking a job while in an app means
closing it.

Owner's ask: the apps should slide up from the line above the Apps button, look
like the rail's own rows (Customers, New Customer, wedi, Sheoga), load nothing
until one is picked, and then fill the work area the way a project does, with
the tray staying open so any other app — or anything else in the rail — is one
click away. Settings should open the same way but from the top: its sections
drop out from under the ned / Selection Manager logo, pushing Search and
everything below down, and opening it closes the Apps tray.

## Decision

Chosen from three options prototyped (1A tray in the rail + app fills the work
area; 1B tray + app as a pop-up over the dimmed project; 2 start-menu pop-out):
**1A**, extended with the mirrored Settings drawer.

## What the salesperson sees

### The two drawers

- **Apps tray.** The grid button slides one solid panel up out of the bottom
  bar: an `APPS` eyebrow, then Label Generator, Schluter, wedi, Sheoga (Sheoga
  nearest the button). Rows are pinned to the panel's top edge, so the heading
  shows first and Sheoga clears the bar last. No divider line above the tray.
  The Recent list shrinks to make room; the bottom bar does not move.
- **Settings drawer.** The gear beside the logo drops one solid panel out from
  under the logo block: a `SETTINGS` eyebrow, then Your details, General, Price
  book, Materials & add-ons, Backup & restore. Rows are pinned to the panel's
  bottom edge, so the closing line under the list leads and Backup & restore
  shows first. A line (`--ft-border-strong`) runs under the list. Search, Quick
  Price and everything below slide down with it. Rows carry no count hints
  (they truncated "Materials & add-ons" at the 205px rail width).
- **One drawer at a time.** Opening either closes the other. The button of the
  open drawer shows the pressed (ink-filled) state; the gear also turns 60°.
- **Motion.** A single height animation per panel, ~1.3 s,
  `cubic-bezier(.32,.72,0,1)` — the owner asked to start at the prototype's
  slow-motion speed and speed up later if it drags, so the duration is one
  constant. No per-row fades or staggers (tried in v2/v3 and rejected: the
  owner wants the whole panel to slide). `prefers-reduced-motion` opens and
  closes instantly.
- **wedi / Sheoga shortcuts stay** under New Customer (owner's choice B). A
  shortcut opens that app in the work area AND slides the Apps tray open with
  the app highlighted.

### The work area

- **Nothing loads until picked.** Opening a drawer changes only the rail.
  Picking an app or a Settings section fills the work area (the `<main>` beside
  the rail), the same footprint as a project. Each app's code chunk loads on
  its first pick (the existing lazy imports), never on drawer open.
- **Pane header:** `← <project name> › Apps › Sheoga` (or `› Settings › Price
  book`), close X on the right. With no project open the back link reads
  `← Home`.
- **The project stays mounted underneath**, hidden, not unmounted. The X, the
  back link, or one Escape press returns to it exactly as it was. Closing the
  pane leaves the drawer open. Picking a Recent customer or project while a
  pane is showing closes the pane and opens that record.
- **Picking a different item** in the open drawer swaps the pane content. The
  active item wears the rail's ink fill (`bg-indigo-600 text-white`, which the
  Moss kit maps to ink).
- **Adding a build** ("Current project" / "New quick price" in the configurator
  commit prompt) closes the pane and shows the job with the new lines, as the
  hub's `setShowApps(false)` does today.

### Coming back to a build

Configurators (Sheoga, wedi, Schluter) stay mounted after their first pick, so
a staged build survives a trip to a customer or to Settings. When the
salesperson returns to a configurator that is **in progress** — its basket has
staged entries, or any option changed since it was opened — the pane first
shows a prompt:

> **Pick up your wedi build?** You left one in progress when you clicked away.
> [summary line] — **Continue build** · **Start new**

Continue shows the configurator as left. Start new clears that app's basket and
remounts that one configurator (fresh defaults). A configurator that is not in
progress opens straight away. Switching directly between two apps in the tray
also counts as leaving and returning. The Label Generator never prompts (its
labels are saved rows; the draft form is cheap to redo).

### Unchanged

- **Refresh restore (ADR 0028)** keeps working: a reload reopens the pane that
  was showing, with its drawer open. Old stored `{ kind: "apps" }` entries (no
  app named) reopen the tray with nothing picked; old `{ kind: "settings",
  section }` entries reopen that section.
- **Narrow windows / phone:** below the rail breakpoint the rail is already an
  overlay drawer. Picking an app or section closes the rail overlay so the pane
  gets the screen; the drawer's open state is remembered for the next time the
  rail is shown.
- **Row-opened configurator pop-ups** (`sheogaPop` / `wediPop` /
  `schluterPop`, opened from a product row) are untouched.
- Customer browser, Issues, and every other overlay are untouched.

### Deliberate changes to existing behavior

1. **The gear no longer lands on Materials & add-ons.** It opens the section
   list and waits. ADR 0028 §3 says "Manual opens are unchanged (Settings
   still opens on its default section)" — this amends that line.
2. **Apps and Settings lose their own left menus** and full-window shells; the
   rail's drawers replace them. The Settings menu's footer notes ("Book
   imported …", "Last backup …") move into the Price book and Backup & restore
   sections.

## How it is built

### New: `src/railnav.js` (pure, `node --test`)

The whole navigation state as a small reducer plus helpers, no React:

- State: `{ drawer: null | "apps" | "settings", pane: null | { kind: "app",
  id } | { kind: "settings", id } }`.
- Actions: `toggleDrawer(which)` (exclusive), `pick(kind, id)`,
  `shortcut(appId)` (opens the pane and the Apps tray), `closePane()`,
  `openRecord()` (closes the pane, keeps the drawer).
- `needsResume({ from, to, inProgress })` — true when `to` is a configurator
  that is in progress and the pane is arriving from anything other than that
  same configurator.
- `layerOf(state)` / `stateFromLayer(stored)` — the `ft-open-layer` mapping,
  including the old entry shapes above. Unknown or stale entries yield the
  empty state.

### New: `src/raildrawer.jsx`

- `RailSlide({ open, anchor: "top" | "bottom", children })` — the one sliding
  panel: measures its content (`offsetHeight`, re-measured on content resize
  via `ResizeObserver`), animates `height` 0 ↔ measured, `overflow: hidden`,
  content pinned with `justify-content: flex-start` (tray) or `flex-end`
  (Settings). Duration is one exported constant. Reduced motion → no
  transition.
- `AppsTray` and `SettingsDrawer` — the row lists, reusing App.jsx's `railItem`
  class and lucide icons (Tag, Layers, ShowerHead, TreePine for apps; the
  section icons Settings uses today).
- `PaneHeader` — back link, breadcrumb, close X.

### Changed: `src/App.jsx`

- `showApps` / `appsStart` / `showSettings` / `settingsSection` give way to one
  `railnav` state (`useReducer`).
- The rail mounts `SettingsDrawer` directly under the logo block and
  `AppsTray` directly above the bottom bar; the gear and grid buttons dispatch
  `toggleDrawer`; the wedi / Sheoga shortcuts dispatch `shortcut`.
- `<main>` renders the pane layer (`absolute inset-0` over the project, which
  stays mounted with `hidden`). `AppsWorkspace` mounts on the first app pick
  and stays mounted (hidden) until sign-out; `SettingsWorkspace` mounts while a
  settings pane shows.
- Escape uses the existing `useEscClose` ladder entry: pane open → close pane.
- The `ft-open-layer` write/restore pass goes through `layerOf` /
  `stateFromLayer`.

### Changed: `src/AppsWorkspace.jsx`

- Drops the `fixed inset-0` shell, its `<aside>` app list, the narrow-window
  `‹ Apps` bar and `wideHub` / `railOpen` state.
- Takes `app` (which one to show) instead of `initialApp`; renders only that
  app; keeps each configurator mounted after first render (hidden when not
  current) so builds and baskets survive switching.
- Reports `inProgress(appId)` upward (basket non-empty, or a config change
  seen since mount via the configurators' existing `onConfigChange`); renders
  the resume prompt when `App.jsx` asks for it; Start new clears that basket
  and bumps that configurator's `key`.
- The Sheoga docked-grid breakpoint (`hubQuery`) is recomputed for the 205px
  app rail (`RAIL_W`) instead of the hub's 224px list.
- The commit-destination prompt ("Add to which project?") is unchanged.

### Changed: `src/SettingsWorkspace.jsx`

- Drops the `fixed inset-0` shell and its `<aside>` section menu.
- Takes `section` from `App.jsx` (the `initialSection` / `onSectionChange`
  pair becomes a controlled prop); keeps its zoom-floor behavior inside the
  pane.
- Footer notes move into the Price book and Backup & restore sections.

### Docs

- New ADR (next free number, 0047): apps and settings open in the work area
  from rail drawers; records the options weighed and the resume prompt.
- Amend ADR 0028 §3 (gear no longer opens a default section; stored layer
  shape now names the app).
- `src/CLAUDE.md` entries for `railnav.js`, `raildrawer.jsx`, the new preview
  harness, and the changed `AppsWorkspace.jsx` / `SettingsWorkspace.jsx`
  descriptions.

## Data and safety

- No Supabase change, no SQL, no persisted shape change. The only stored state
  is the device-local `ft-open-layer` key, read backward-compatibly.
- Configurator commits keep their existing write paths (`updateProject` /
  `createQuickWithSheoga` via the hub's `sheoga` / `wedi` / `schluter` bags).

## Testing and preview proof

- `src/railnav.test.js` (`npm test`): drawer exclusivity; shortcut opens pane +
  tray; closing the pane keeps the drawer; opening a record closes the pane;
  `needsResume` truth table (same app, other app, settings → app, not in
  progress, Label Generator); `ft-open-layer` round-trip plus old shapes
  (`{kind:"apps"}`, `{kind:"apps", app}`, `{kind:"settings", section}`,
  unknown kinds, garbage).
- `npm run lint` and `npm run build` clean.
- **Preview proof (non-negotiable 3):** a dev-only harness `rail-preview.html`
  + `src/railpreview.jsx`, like `sheoga-preview.html`: the REAL rail drawers,
  pane header, `AppsWorkspace` and a Settings section over mock state, no
  Supabase. Playwright screenshots, posted on the PR: tray open; Settings open;
  mid-slide frames of each (tray heading-first, Settings line-first); an app
  filling the work area; the resume prompt; a narrow window.
- One PR from `claude/funny-dijkstra-kg5fdf`; not merged until the owner has
  seen the screenshots.

## Out of scope

- Moving the Customer browser, Issues, or any other overlay into the work area.
- Re-ordering or renaming the apps; adding apps.
- Changing the row-opened configurator pop-ups.
- Tuning the slide speed below 1.3 s (a one-constant follow-up once the owner
  has used it).
