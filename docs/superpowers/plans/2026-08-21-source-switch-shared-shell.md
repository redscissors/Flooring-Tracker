# Stock only / Full catalog — the shared source switch (Phase 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Stock only / Full catalog switch becomes a shared shell
control both configurators carry — wedi inherits it (solve pools, Kits,
Browse, swap lists honor it), and the Schluter engine's stock-only behavior
becomes uniform across every role via one `pickFrom` helper (no role can
silently drop under Stock only).

**Architecture:** Three layers. (1) `pickFrom(cat, pred, {source})` in
`schluter.js` replaces every single-pick `cat.find(...)` in `buildKit`:
under `"stock"` a stocked match wins, and when none exists the special-order
match still lands (flagged `so` by the existing line shape) — the build is
never silently wrong; under `"all"` behavior is unchanged (first match), so
the pinned truth-table totals cannot move. (2) `wedi.js` learns
`input.source` on `solve` (the pan pool, linearOption's pool, and
modulePair's module pool skip non-stocked rows) — extension/corner pieces a
chosen option needs stay as picked and render with their existing SO
markers, per the P2 doctrine ("a line with no stocked substitute stays,
flagged"). (3) A shared `SourceSwitch` component (widgets.jsx — tiny,
boot-safe, no data) renders the header seg both popups mount;
WediConfigurator gains `source` state wired into solve, the Kits-tab
gray-out, the Browse hard filter, and the swap/chip choice lists.

**Reference:** prototype P2 (`.scratch/097_schluter-configurator/`
`prototype.html` + README): "Full catalog (default): the solver ranks
freely; a line the shop doesn't stock wears the rust special order tag …
Stock only: non-stocked parts leave the candidate pool entirely — kits gray
out, option cards re-rank … A line with no stocked substitute stays,
flagged, so the build is never silently wrong. It's a shell feature … wedi's
Browse tab already ranks stock first; this makes it a hard constraint when
you want one."

**Tech Stack:** plain ES modules + `node --test` for both engines; React
for the two popups; the schluter/wedi preview harnesses for proof.

## Global Constraints

- One PR off this session's designated branch; never push to `main`; no
  Supabase access. Preview proof must show BOTH configurators under the
  switch (the roadmap's phase-4 gate).
- No persisted-shape change: wedi's `product.wedi` marker is untouched
  (its cfg is a stored contract; the wedi switch is session state).
  Schluter's marker already carries `source` (phase 3) — unchanged.
- `widgets.jsx` is boot-side: `SourceSwitch` must import nothing from
  either engine.
- Engine behavior under `source: "all"` (or absent) must be bit-identical
  to today — pinned totals in schluter.test.js and wedi.test.js prove it.
- Every commit: `npm test` green.

## File Structure

- `src/schluter.js` (modify) — `pickFrom` + buildKit call sites.
- `src/schluter.test.js` (modify) — stock-only no-silent-drop tests.
- `src/wedi.js` (modify) — `input.source` through solve's pools.
- `src/wedi.test.js` (modify) — pool-filter tests + unchanged-default pins.
- `src/widgets.jsx` (modify) — `SourceSwitch`.
- `src/SchluterConfigurator.jsx` (modify) — adopt SourceSwitch.
- `src/WediConfigurator.jsx` (modify) — source state + wiring + CSS.
- `src/wedipreview.jsx` / `src/schluterpreview.jsx` — unchanged (the
  switch is in the popups); proof shots ride
  `.scratch/097_schluter-configurator/phase4-proof/`.
- `src/CLAUDE.md` (modify) — entries for the changed files.

---

### Task 1: `pickFrom` — uniform stock-only picks in the Schluter engine

**Files:** modify `src/schluter.js`, `src/schluter.test.js`

**Interfaces:**
- Produces: `export function pickFrom(cat, pred, { source } = {})` —
  returns the first STOCKED entry matching `pred` when `source==="stock"`,
  else the first matching entry at all (so a role with no stocked option
  still lands, flagged by the line's existing `so` marker); under `"all"`
  it is exactly `cat.find(pred)`.
- `buildKit` call sites replaced: linear channel (the
  `chans.find(...) || chans[chans.length-1]` fallback must fall back to a
  special-order channel when Stock only leaves the stocked pool empty —
  today the line silently disappears), linear flange, point flange, grate
  (`grates[0]` of a stock-filtered list — same silent drop today), wall
  panel, fasteners, band, corners, seals, curb fallback, ramp, ALL-SET,
  KERDI-FIX. Pool-based rankings (trays, rolls) keep their richer logic.

Steps: failing tests — a catalog whose only grate/channel/flange is
special-order still yields those lines under `{source:"stock"}` (flagged
`so: true`), and a catalog with both prefers the stocked one under
`"stock"` while `"all"` keeps first-match order; the pinned 60×38 total
($759.75) unchanged → red → implement → green → `npm test` → commit.

---

### Task 2: wedi solve pools honor `input.source`

**Files:** modify `src/wedi.js`, `src/wedi.test.js`

**Interfaces:**
- `solve(input)` reads `input.source` (`"all"` default): the pan `list`,
  `linearOption`'s pan pool, and `modulePair`'s module pool drop
  non-stocked entries when `"stock"`. Options that survive keep their
  extension/corner picks even when those are SO (flagged in the UI).
- `kitFor` needs no source parameter: its picks are fixed stocked-line
  SKUs or explicit user choices; SO lines it emits already render flagged.

Steps: failing tests — `solve({...room, source:"stock"})` returns no
option whose PAN is non-stocked while the same room under `"all"` does
(pick a room whose best pan is a non-stocked one from the catalog);
`solve` with no source is deepEqual to today's output for two pinned rooms
→ red → implement (thread `source` into the pools) → green → `npm test` →
commit.

---

### Task 3: shared `SourceSwitch` + Schluter popup adopts it

**Files:** modify `src/widgets.jsx`, `src/SchluterConfigurator.jsx`

**Interfaces:**
- `export function SourceSwitch({ source, onChange, title })` in
  widgets.jsx: the two-button seg (`Stock only` / `Full catalog`), class
  `srcseg`, `data-source-stock`/`data-source-all` attrs, active class
  `on`. Styling stays each popup's own `.srcseg` CSS.
- SchluterConfigurator replaces its inline seg with `<SourceSwitch
  source={source} onChange={(s) => { setSource(s); setPick(null); }} />`,
  keeping the existing `data-schluter-src-*` behavior via the shared
  attrs (update the shot rig selectors).

Steps: swap in, run the schluter harness scenarios (the P2 stock-only
re-rank shot must reproduce) → `npm test` + build → commit.

---

### Task 4: wedi inherits the switch

**Files:** modify `src/WediConfigurator.jsx`

- `source` state (default `"all"`); `<SourceSwitch>` in the pop-head
  before the tier bar; `.srcseg` CSS block added to the wedi CSS.
- Every `solve({...})` call passes `source`; changing the source re-solves
  the current custom room (the same path a room edit takes) and clears a
  picked option that no longer exists.
- Kits tab: a non-stocked pan/module row disables (grays) under Stock
  only — the schluter kitrow `dis` treatment.
- Browse: `source==="stock"` hard-filters the list (today's
  stock-first sort stays for `"all"`).
- `swapChoices`/`chipChoices`/bench premades: choice lists filter to
  stocked under Stock only; a line already SO in the build stays flagged
  (never removed).

Steps: wire, then drive `wedi-preview.html` with the shot rig: (a) Kits
under Stock only with SO pans grayed; (b) a custom room whose option list
re-ranks when the switch flips; (c) Browse hard-filtered. `npm test` +
build → commit.

---

### Task 5: proof, docs, PR

- `.scratch/097_schluter-configurator/phase4-proof/`: wedi shots (a)–(c)
  above + schluter's stock-only re-rank under the SHARED switch, with a
  README table. Both configurators shown = the roadmap gate.
- `src/CLAUDE.md`: SourceSwitch entry under widgets.jsx; wedi.js /
  WediConfigurator.jsx / schluter.js / SchluterConfigurator.jsx entries
  amended (source semantics, pickFrom).
- `npm test` + `npm run build` green; push; PR with the proof table;
  subscribe.

## Self-Review

- P2 coverage: switch in both headers (T3/T4), hard constraint on pools +
  Browse (T2/T4), kits gray (T4), never-silently-wrong (T1's flagged
  fallbacks; wedi keeps SO lines flagged rather than dropped).
- Default-behavior pins: T1 ($759.75 unchanged), T2 (solve deepEqual with
  no source).
- The ride-along list's "wedi inherits the switch" and "shared pickFrom"
  are exactly T4 and T1.
