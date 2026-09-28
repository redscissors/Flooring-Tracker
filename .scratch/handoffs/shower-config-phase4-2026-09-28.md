# Handoff — shower configurators, ticket 158: after Phase 3 (2026-09-28)

Start here in a new session. The standing ledger is
`.scratch/158_shower-config-roadmap/ticket.md`, which holds the phase list,
owner answers and the carry-forward list. The earlier handoffs
(`shower-config-phase1a-2026-09-26.md`, `shower-config-phase1c-2026-09-27.md`,
`shower-config-phase1d-2026-09-27.md`, `shower-config-phase2-2026-09-27.md`,
`shower-config-phase3-2026-09-27.md`) are history now.

## Where things stand

| Piece | State | Where |
|---|---|---|
| Phase 0 (P0-1…P0-6) | merged | [redscissors/Flooring-Tracker#436](https://github.com/redscissors/Flooring-Tracker/pull/436) |
| **1a** drain slot | merged | [redscissors/Flooring-Tracker#437](https://github.com/redscissors/Flooring-Tracker/pull/437) |
| **1b** ⇄ on every line | merged | [redscissors/Flooring-Tracker#438](https://github.com/redscissors/Flooring-Tracker/pull/438) |
| **1c** "+" on every group, add another line | merged | [redscissors/Flooring-Tracker#441](https://github.com/redscissors/Flooring-Tracker/pull/441) |
| **1d** shared group names, Compare alignment, the mirror | merged | [redscissors/Flooring-Tracker#444](https://github.com/redscissors/Flooring-Tracker/pull/444) |
| **Phase 2** Board vs Membrane, wedi S-DRY | built, PR pending | branch `claude/shower-config-phase-1d-eafhd0` |
| **Phase 3** 4-way compare | built, PR pending | branch `claude/shower-config-phase3-4way` (this branch) |

**Check both pending PRs have merged before starting anything new on top of
this branch** — Phase 3 was built on top of Phase 2's own PR branch, not
`main`.

Records to read before touching any of this:
- **ADR 0034** (`docs/adr/0034-cross-vendor-compare.md`), Phase 3 amendment:
  decision 3 is now "host cell live, three derived" per cell instead of per
  column; decision 4 is N options A–D in one patch, not fixed at two; the
  "no feedback after landing options" item is still open.
- **ADR 0051** (`docs/adr/0051-wedi-membrane-is-s-dry.md`), Phase 3
  amendment: a derived wedi-Membrane cell with no S-DRY fit prices a wedi
  pan + S-DRY walls, flagged; the detail offers the nearest base instead.
- **Spec** `docs/superpowers/specs/2026-09-29-four-way-compare-design.md`
  — read "Amendments during planning and build" (rulings 1–14) before
  changing `comparegrid.js`, `CompareTab.jsx`'s grid, or
  `compareOptionsPatch`.
- **Plan** `docs/superpowers/plans/2026-09-28-four-way-compare.md` (house
  style for the next one).
- `src/CLAUDE.md` entries for `comparegrid.js` (new), `comparegridgolden.js`
  (new, beside the other goldens), `comparekit.js`, `CompareTab.jsx`,
  `options.js`.

## What Phase 3 left in place

- **A 2×2 grid** (`comparegrid.js`'s `CELLS`, reading order A–D: wedi Board,
  Schluter Board, wedi Membrane, Schluter Membrane) sits above Compare's
  existing two-column detail and drives which cell the detail shows,
  replacing the fixed host-vs-opposite pairing. The detail is always the
  LIVE cell and the SELECTED cell, sorted into grid order.
- **The live cell is the host popup's own build; the other three are
  derived house kits** for the same room (ADR 0034 decision 3, extended
  from per-column to per-cell). The same brand's other wall system passes
  the host's hand-added lines through as-is (same parts, no mirror); the
  other brand mirrors them per cell — two cells of one brand can each hold
  a different pick, since the mirror state is now keyed per cell
  (`{[cellKey]: state}` in the popup's `mirror` prop).
- **Flag chips** (`comparegrid.js`'s `cellFlags`) name what didn't map
  cleanly in a cell — mortar bed, no drain match, no S-DRY base, channel
  runs short, deep cut, no price, unmatched added line — most severe first,
  the first two shown plus "+N more"; clicking one selects the cell and
  scrolls the detail to the flagged line.
- **The grid's session state (selected cell, checked cells, S-DRY answer)
  rides the popup's existing `mirror`/`onMirror` prop** under a reserved key
  `grid`, stamped with the host cell it was built for — no new prop, no new
  storage. A stale grid (the wall system flipped on another tab) reads as
  absent and falls back to today's defaults.
- **A derived wedi-Membrane cell with no S-DRY fit** prices a wedi pan +
  S-DRY walls, flagged "No S-DRY base fits"; the detail offers the nearest
  S-DRY base as an inline alternative (never "back to Building Panel" —
  that choice only makes sense inside the popup).
- **Sending checked cells lands N fresh sibling option areas A–D in one
  patch.** `compareOptionsPatch(project, hostAreaId, {options: [{lines,
  name}], label})` is the new signature; the old `{wediLines,
  schluterLines}` shape still works, read as the N=2 case, so every
  existing caller and test stays byte-identical.
- **New goldens:** `src/comparegridgolden.js`/`comparegridgolden.test.js`
  pin all four cells' totals and flag ids over a spread of fixture rooms.
  `wallsysgolden.test.js`, `wedimarkergolden.test.js` and
  `addedgolden.test.js` stay green and untouched.
- **Proof shots:** `.scratch/158_shower-config-roadmap/p3/` (g1–g7 +
  `shoot-grid.mjs`) plus the changed p1d/p2 Compare shots the new picker/
  modal wording touched.

## Carry forward

Still open from the Phase 3 handoff (repeated here since it's now history):

- **The pricelist's bare "S-DRY™ XL"-style names in the bill.** `sdryWalls`
  reads roll coverage from the name ("104sf") first, falling back to the
  published `ROLL_SF` constant — the distribution pricelist's "S-DRY™ XL" row
  has no sf in its name, so this fallback is load-bearing, not a one-off. A
  future pricelist re-transcription should keep naming coverage in the row
  where it can.
- **S-DRY curb height/width in the drawings.** `showerdraw.js`'s
  `curbHeight`/`curbWidthOf` return fixed Lean/Standard constants off a
  `/lean/i` regex on the item name — never `NaN`, never blank — but they
  aren't wired to the S-DRY curb's own published dimensions. Fine today;
  worth a real number if the drawing ever needs to distinguish them.
- **Extensions stacked two deep, and an extension on the curbless entry
  side.** Still out of scope.
- **The drain height kit.** Still open.
- **The wedi `extensionSf` over-count.** `extensionSf` (wedi.js) sums every
  extension piece's own w×d, but the solver's edge-strip pieces can overlap
  at the corners the way `floorSfOf`'s bounding-box fix already accounts for
  on the joint-sealant path — `extensionSf` doesn't have that fix, so it can
  over-count the build-up-sheet quantity on a 2″-deep pan with extensions.
  Pre-existing, not introduced by Phase 3; give it the same bounding-box
  treatment `floorSfOf` got if it's worth fixing.

New from Phase 3:

- **The Schluter drain/short chips' note strings are pinned only by
  hand-made rows, not end to end.** `cellFlags`' Schluter branch matches
  `"can't be made here"`/`"runs short"` against a live tray-candidate's own
  note text; nothing in `comparegridgolden.js`'s fixture rooms exercises a
  real "runs short" Vario or a real drain-mismatch note through the
  registry-fed catalog — only comparegrid.test.js's hand-made rows prove the
  string match. A future schluter.js wording change to either note would
  silently stop lighting the chip with nothing failing.
- **ADR 0034's "no feedback after sending options" item is still open** —
  now for two to four options instead of two. The confirm modal closes and
  the new areas appear behind it; whether the popup should close, ping, or
  navigate to the new areas is still a workflow call nobody has made.

## How Phase 3 was run (repeat it)

Same process as 1a–2 (see the Phase 3 handoff for the full write-up):
brainstorming → a design spec, section by section, with owner approval →
writing-plans (a plan with full code, prototyped in a scratch copy of `src`
first, its prototyping rulings recorded) → subagent-driven-development (a
task ledger, a review after every task, fix rounds, a final whole-branch
review, one fix wave, then the PR). Models: Opus for engine-facing changes
(the comparekit helpers touching `wediBuildFor`) and for the stateful
CompareTab grid, and for every review; Sonnet for mechanical tasks where the
plan holds the full code (options.js, the golden, this records task).

## Environment gotchas (cloud sessions)

- **Build:** `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build`.
  Without the env var the HTML placeholder fails, the same as on `main`. The
  build prints a pre-existing CSS minify warning.
- **Tests / lint:** `npm test`, `npm run lint`.
- **The boot-chunk grep** (ADR 0026): `grep -c "comparegrid\|KERDI\|Fundo\|No tray fits" dist/assets/index-*.js`
  must read 0 — `comparegrid.js`/`comparekit.js`/`CompareTab.jsx` stay in the
  compare chunk only.
- **Preview proof:**
  - Run `npx vite --port 5199 --strictPort` in the background.
  - Harnesses: `schluter-preview.html`, `wedi-preview.html` (takes
    `?seed=<json>` to open a saved marker), `import-preview.html`.
  - Load Playwright with
    `createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core")`
    and `executablePath: "/opt/pw-browsers/chromium"`.
  - The harness opens on Stock only. `[data-source-toggle]` switches to Full
    catalog.
  - **Print proof needs `emulateMedia({ media: "print" })`** — both popups'
    print sheets are styled only under `@media print`.
  - `fullPage` can't reach inside the popup's own scroll area; scroll the
    element or shoot the viewport.
  - House-style scripts: `p1a/`–`p1d/`, `p2/` and now `p3/`
    (`shoot-wedi.mjs`, `shoot-compare.mjs`, `shoot-grid.mjs`, all ending "all
    checks passed"). Re-run the earlier scripts after any popup change;
    restore any PNG that re-renders with no real change (`git checkout` it
    back).
  - New Phase 3 DOM hooks: `data-cmp-tile`, `data-cmp-check`, `data-cmp-flag`,
    `data-cmp-sdryask`, `data-cmp-sdry-answer`, `data-cmp-option`.
    Popover DOM hooks carried from Phase 2: `data-wedi-wallsys`,
    `data-wedi-wallsys-board`, `data-wedi-wallsys-membrane`,
    `data-wedi-sdryask`, `data-wedi-sdrychip`, `data-cmp-sys`.
  - The wedi harness's job-sheet overlay covers the popup's tab strip; click
    tabs with `dispatchEvent("click")`.
- **Price files:** the owner's uploaded price files are not in the repo. The
  fixtures are `src/schluterfixture.js`, `src/wedifixture.js` and
  `src/keimwedifixture.js`.
- **Workflow rules:**
  - Never push to `main`; every change goes through a PR.
  - Never touch the live Supabase project.
  - Every UI change needs preview screenshots in the PR.
  - The brainstorming approval gate applies in cloud sessions too.
