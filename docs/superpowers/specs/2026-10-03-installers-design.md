# Installers — design

Date: 2026-10-03 · Status: Approved by owner (build and merge) · Mockup:
`.scratch/mockups/installers-2026-10-03.html` (throwaway) · Proof:
`.scratch/172_installers/`

## Goal

Keep a team directory of installers (company, contact, phone, email, the
trades they install, a 1–10 priority), suggest the right ones for a job from a
hammer icon in the project header, show the job's installers beside the areas,
and print them at the bottom of the selection sheet. General settings get a
category list along the way.

## Owner decisions (2026-10-03)

1. **General settings becomes a category list** (Waste · Shop address · Styles
   · Installers), the Materials column's shape: pick on the left, options on
   the right. Styles holds the project-header picker and Appearance.
2. **Installers settings use list + detail.** The list is two lines per
   installer (company + priority, then trades · contact). The detail is one
   520px form: Company | Contact, Phone | Email, the three trade boxes, the
   1–10 priority scale. Everything lines up on one grid; tight spacing.
3. **Trades are Tile, Hard Surface and Carpet.** Hard Surface covers hardwood,
   vinyl and laminate lines. Underlayment and misc lines never ask for an
   installer of their own.
4. **The hammer picker** lists installers who can do the whole job first
   (green, by priority), then those who can do part of it (more of the job
   first, then priority), then a hidden "don't do anything on this job" group.
   **A click adds or removes at once** — no Done button.
5. **The box sits right of the areas, its top level with the first area**, on
   screens wide enough for it. **Narrower screens hide it** (owner pick C);
   the hammer's badge count is the cue.
6. **Print: a table at the very bottom** — Trade · Company · Contact · Phone ·
   Email, one row per installer, the trades they cover on this job stacked one
   per line. Priority never prints.

## Data

- `settings.installers: Installer[]` on the shared settings record (ADR 0002)
  — `{ id, company, contact, phone, email, trades: ("tile"|"hard"|"carpet")[],
  priority: 1–10 }`. Normalized by `installers.js` `normInstallers` inside
  `normalizeSettings`/`serializeSettings`; an empty list isn't written. No SQL.
- `project.installers: Entry[]` — contact **snapshots** taken when the
  installer is added: `{ id, company, contact, phone, email, trades, addedAt,
  addedBy }` (`installerEntry`), normalized by `normProjInstallers` in `normC`.
  Editing or removing an installer in Settings never changes a job that has
  them (ADR 0057). Remove and re-add on the job to pick up new details.
- A job's trades are derived, never stored: `jobTrades(categories, rowBlank)`.

## Surfaces

- **Settings → General** (`SettingsWorkspace.jsx`): the categories column and
  four panes; Installers is `InstallersSettings` (`installersui.jsx`). Text
  fields commit on blur; trades and priority save on click; a new installer
  saves on **Add installer** (company required). Remove asks once.
- **Header** (`projectheader.jsx`): `InstallerButton` in all three desktop
  layouts — an icon in Clean, a labeled 19px button in One-bar, an icon tile
  in Classic. The picker (`InstallerPicker`) is a `SearchPop`; its footer
  links to Settings → General → Installers.
- **Box** (`InstallerBox`, mounted by App.jsx in the areas wrapper): shown when
  `<main>` is at least 896 + 12 + 240 + 32 px wide and the shell isn't zoomed;
  the column and box are then centered together. Sticky under the pinned
  Clean compact band. Lists each entry (×, contact, phone, trades on this
  job) and warns about job trades nobody covers.
- **Print** (`EstimateColumns.jsx`): the Installers table after the totals,
  only when the job has installers. Trades print via `entryTradesOnJob` — the
  job's trades they cover, or all of theirs when none overlap.

## Out of scope

- The phone layout has no hammer yet; installers added on desktop still print.
- No scheduling, pricing or availability for installers.
