# ADR 0023 — Apps hub Label Generator: split storage, structured savable presets

- **Status:** Accepted
- **Date:** 2026-07-19
- **Scope:** new feature — `src/labels.js`, `src/AppsWorkspace.jsx`, `supabase/labels.sql`,
  `src/catalog.js` (`settings.apps.labels.presets`), `src/App.jsx` wiring.
- **Related:** builds on the [ADR 0002](0002-shared-grout-mortar-catalog.md) shared-settings
  pattern and the todos-table sharing model (issue 006); spec at
  `docs/superpowers/specs/2026-07-18-label-generator-apps-hub-design.md`; plan at
  `docs/superpowers/plans/2026-07-18-label-generator-apps-hub.md`.

## Context

The shop used a standalone HTML tool to print small dark "Keim" sample tags for
the showroom shelf — one hardcoded size, one browser's localStorage, no link to
the stock price book. This ADR covers porting it into FloorTrack as the first
entry in a new **Apps hub** (a home for shop utilities, built on the
`SettingsWorkspace` shell pattern), and records two decisions made building it:
where the data lives, and how much customization the label designer offers.

## Decision

### 1. Split storage: saved labels in a new shared table, size presets in shared settings

A **saved label** (a printed tag — its filled-in fields, snapshot layout, and
provenance SKU) lives in a new `labels` table, one row per label, mirroring the
`todos` table: `{ id, position, data: Label, created_at, updated_at }`, shared
team-wide, any signed-in user can select/insert/update/delete
(`supabase/labels.sql`, run once by hand per the project's non-negotiable that
agents never mutate the live Supabase project).

A **size preset** (a reusable size + which lines show + font sizes, e.g.
"Sample Tag" 1.5×2.5″) is small configuration, not job data — there are only a
handful, edited rarely, and every label references one by id. Presets ride
inside the existing shared `settings` record at `settings.apps.labels.presets`,
normalized in `mergeSettings`/`withDerived` (`src/catalog.js`) alongside
`waste`/`catalog`/`pricing`/`ops`, the same way ADR 0002's grout/mortar catalog
already lives there. Two built-ins (**Sample Tag**, **Spec Card**) are
code-defined and always seeded; only custom presets serialize
(`customLabelPresets`), matching the built-in/custom split every other catalog
kind in this file already uses.

This split follows the shape of the data, not a blanket rule: labels are
**volume** (grows without bound, wants its own rows, deletes independently) and
presets are **configuration** (small, bounded, edited as a set) — exactly the
todos-vs-settings split the app already draws elsewhere.

### 2. Structured, savable size presets — not a free-drag label designer

The label card is a small stack of text lines (name, SKU, size, price,
Floor/Wall pill, grout, brand, thickness, note), each with a show/hide toggle,
1-D reorder, and a font-size stepper. A preset snapshots that structure: size
in inches, a header string, and an ordered `lines: [{ key, show, size }]`. A
saved label snapshots its own full copy of the layout it was created with
(`newDraftFromPreset`) — editing or deleting a preset later never changes an
existing label, the same snapshot convention used for grout SKUs (ADR 0007)
and stock price fills (ADR 0003).

A free 2D drag-and-drop designer (arbitrary x/y element placement) was
considered and rejected for v1: it requires saved coordinates, collision
handling, and screen-vs-print scaling for a card that is, in practice, always
a vertical stack of labelled lines. Structured presets deliver everything the
shop actually wants — resize, reorder, toggle lines, save as a reusable size —
at a fraction of the build and testing surface, and the data model (`lines` as
an ordered array, not fixed slots) leaves room to grow.

## Consequences

- Two write paths, two lifecycles: labels are cheap and disposable (delete
  only, no undo — "new cards are cheap"), consistent with `todos`; presets are
  a small, deliberately-edited set, consistent with the catalog.
- `settings.apps` is now part of what `serializeSettings`/`mergeSettings`
  persist — old records without it normalize to the two built-ins via
  `normApps`, no migration needed.
- Cut-apart printing (plain letter sheet, cut by hand) is the only print mode
  for v1. Avery-style peel-and-stick sheet alignment is an explicit phase 2;
  because presets are already structured data rather than free-form pixels, a
  future print-mode field can slot onto the existing `Preset` shape without
  reworking saved presets or labels.
- Labels are a standalone showroom/shelf utility, deliberately not attached to
  any customer or job — pulling a job's selected products in as labels is a
  possible later phase, not precluded by this shape.

## Alternatives considered

- **Presets in their own table, like labels:** rejected — presets are a
  handful of rows edited rarely by the team as a set, not volume that needs
  independent row-level writes; the existing shared-settings jsonb pattern
  (ADR 0002) already normalizes exactly this shape of data with no new SQL.
- **Labels folded into `settings.apps.labels`, no new table:** rejected — an
  unbounded, per-label-growing list inside one shared settings blob means
  every label add/edit/delete rewrites the whole record team-wide (lost-update
  risk, unlike the `todos` table's one-row-per-item writes) and the set has no
  natural place to end up in the low hundreds the way presets do.
- **Free-drag label designer:** rejected — see Decision 2; large fragile build
  for marginal gain over structured show/hide/reorder/resize.
