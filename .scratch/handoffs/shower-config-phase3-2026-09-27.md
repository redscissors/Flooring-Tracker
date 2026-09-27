# Handoff — shower configurators, ticket 158: Phase 3 onward (2026-09-27)

Start here in a new session. The standing ledger is
`.scratch/158_shower-config-roadmap/ticket.md`, which holds the phase list,
owner answers and the carry-forward list. The earlier handoffs
(`shower-config-phase1a-2026-09-26.md`, `shower-config-phase1c-2026-09-27.md`,
`shower-config-phase1d-2026-09-27.md`, `shower-config-phase2-2026-09-27.md`)
are history now.

## Where things stand

| Piece | State | Where |
|---|---|---|
| Phase 0 (P0-1…P0-6) | merged | [redscissors/Flooring-Tracker#436](https://github.com/redscissors/Flooring-Tracker/pull/436) |
| **1a** drain slot | merged | [redscissors/Flooring-Tracker#437](https://github.com/redscissors/Flooring-Tracker/pull/437) |
| **1b** ⇄ on every line | merged | [redscissors/Flooring-Tracker#438](https://github.com/redscissors/Flooring-Tracker/pull/438) |
| **1c** "+" on every group, add another line | merged | [redscissors/Flooring-Tracker#441](https://github.com/redscissors/Flooring-Tracker/pull/441) |
| **1d** shared group names, Compare alignment, the mirror | merged | [redscissors/Flooring-Tracker#444](https://github.com/redscissors/Flooring-Tracker/pull/444) |
| **Phase 2** Board vs Membrane, wedi S-DRY | built, PR pending | this branch (`claude/shower-config-phase-1d-eafhd0`) |
| **Phase 3** 4-way compare | **not designed** | this handoff |

Phase 2's PR is open (or about to be) against `main` from this same branch.
Check it has merged before starting Phase 3 work on top of it — Phase 3 needs
both wall-system forks in place on both brands.

Records to read before designing anything:
- **ADR 0051** (`docs/adr/0051-wedi-membrane-is-s-dry.md`, new this phase).
  - wedi's Membrane is the S-DRY system: an S-DRY base (+ extensions), curb,
    drain and cover when the room fits one; S-DRY membrane walls off wedi's
    published rates either way.
  - `cfg.wallSys`/`cfg.sdryBase` are ADR-0049 choices, not parts — `kitFor`
    resolves them fresh on every build; absent/unknown reads as Building
    Panel / S-DRY.
  - No fit → the owner picks (wedi pan + S-DRY walls / nearest S-DRY base /
    Building Panel), never a silent drop.
- **ADR 0049** (`docs/adr/0049-configurator-swaps-remember-the-choice.md`,
  amended for 1b, 1c, 1d and now Phase 2's wall-system choices).
- **ADR 0034** (`docs/adr/0034-cross-vendor-compare.md`). Its "Open" section's
  KERDI-BOARD toggle item is now closed by ADR 0051 — the other column
  follows the host's wall system.
- **Specs**, each with an "Amendments during planning and build" section
  recording what actually shipped:
  - `docs/superpowers/specs/2026-09-27-shared-groups-compare-design.md` (1d)
  - `docs/superpowers/specs/2026-09-28-board-vs-membrane-design.md` (Phase 2
    — read **Sourced rates** before touching any S-DRY rate)
- **Plans** (house style for the next one):
  - `docs/superpowers/plans/2026-09-27-shared-groups-compare.md`
  - `docs/superpowers/plans/2026-09-28-board-vs-membrane.md`
- `src/CLAUDE.md` entries for `sdry.js` (new), `wallsysgolden.js` (new),
  `wedi.js`, `WediConfigurator.jsx`, `comparekit.js`, `CompareTab.jsx`,
  `SchluterConfigurator.jsx`.
- `.claude/skills/floortrack-data-model/SKILL.md` — the wedi marker's
  `wallSys`/`sdryBase` fields.

## What Phase 2 left in place for Phase 3

- **Both brands carry the same wall-system fork**, on the Kits tab and the
  Custom tab: Schluter "Membrane | KERDI-BOARD", wedi "Building Panel |
  Membrane (S-DRY)". Both save an ADR-0049 choice (`cfg.wallSys`), never a
  resolved part.
- **wedi's S-DRY system lives in `src/sdry.js`, pure and engine-free.**
  `sdryFit`/`sdryNearest` (the floor), `sdryCurb`, `sdryWalls`, `sdryProSet`,
  `sdryRole`/`sdrySlot`. wedi.js imports it; it never imports wedi.js.
- **Compare builds either brand on either wall system** and the other column
  follows the host's choice, without a prompt — `wediBuildFor`/
  `schluterBuildFor` both take `wallSys` (`wediBuildFor` also `sdryBase`).
  Column headers name each side's system.
- **No fit → the owner picks, never a silent drop.** The wedi popup's inline
  prompt (`data-wedi-sdryask`) offers a wedi pan + S-DRY walls, the nearest
  S-DRY base (with a shortfall warning), or back to Building Panel; a
  non-fit answer wears a reopenable bill chip (`data-wedi-sdrychip`).
- **Old kits don't move.** `src/wallsysgolden.js`/`wallsysgolden.test.js`
  (new this phase) pin every Building Panel wedi build and both Schluter
  wall systems as they billed before Phase 2, alongside the 1b/1c goldens.
  One display-only move: the curbless Fundo kit's "S-DRY Seal — field seal"
  line now draws under Setting (was Seams).
- **Both goldens from Phase 1 stay green, untouched:**
  `src/wedimarkergolden.test.js` (1b) and `src/addedgolden.test.js` (1c).

## Next: Phase 3 — 4-way compare

From the ticket: the same room through wedi Board, wedi Membrane, Schluter
Board, Schluter Membrane, without opening any of them — a 2×2 grid or a slim
always-on bar of four live totals. Each cell: total, difference from the
current build, and a flag when something didn't map cleanly (no matching pan
size, cut or mortar-bed fallback, no drain match, an "inquire" price). Click
a cell to open that build; click a flag to jump to the line; check several
and send them to the space as quote options A–D (ADR 0031/0034 machinery,
the same "land as quote options" `comparekit.js` already does for two).

This needs both Phase 1 (the shared slot/group model) and Phase 2 (both
brands buildable on either wall system) — both are now in place.

**Questions to take into brainstorming** (one at a time; the approval gate
applies):
- Grid or bar? The ticket names both; the owner's "checkboxes idea" (send
  several combinations to the space as options) fits a grid better than a
  bar of four numbers.
- Which four builds derive fresh vs which reuse the host's own build? Today
  Compare's host column is the live popup build and the other column is a
  derived house kit (ADR 0034 decision 3). A 4-way grid needs to decide
  whether the host's own two cells (its brand, both wall systems) still show
  the live build on its current system and a derived kit on the other, or
  whether all four cells are always derived house kits for symmetry.
- How does a flagged cell ("no drain match", "inquire price") read across
  four cells instead of two — does the existing $0 `noteOnly` row pattern
  scale, or does a cell need its own short flag string?
- Does the grid replace today's two-column Compare tab, or sit alongside it
  (e.g. a summary bar above the two-column detail, which expands to the
  detail view on click)?
- `comparemirror.js` mirrors one host's hand-added lines onto ONE other
  brand today. Does a 4-way grid mirror hand-added lines onto all three
  other cells, and if so does the picker's cost grow (three picks per added
  line instead of one)?

## Carry forward

- **The pricelist's bare "S-DRY™ XL"-style names in the bill.** `sdryWalls`
  reads roll coverage from the name ("104sf") first, falling back to the
  published `ROLL_SF` constant — the distribution pricelist's "S-DRY™ XL" row
  has no sf in its name, so this fallback is load-bearing, not a one-off. A
  future pricelist re-transcription should keep naming coverage in the row
  where it can.
- **S-DRY curb height/width in the drawings.** `showerdraw.js`'s
  `curbHeight`/`curbWidthOf` return fixed Lean/Standard constants off a
  `/lean/i` regex on the item name — never `NaN`, never blank (Task 7
  verified this structurally) — but they aren't wired to the S-DRY curb's
  own published dimensions. Fine today (S-DRY curb draws the same box as any
  other lean/standard curb); worth a real number if the drawing ever needs
  to distinguish them.
- **Extensions stacked two deep, and an extension on the curbless entry
  side.** Both out of scope for Phase 2 (spec); still out of scope.
- **The drain height kit.** Out of scope for Phase 2; still open.
- **The wedi `extensionSf` over-count.** `extensionSf` (wedi.js) sums every
  extension piece's own w×d, but the solver's edge-strip pieces can overlap
  at the corners the way `floorSfOf`'s bounding-box fix already accounts for
  on the joint-sealant path — `extensionSf` doesn't have that fix, so it can
  over-count the build-up-sheet quantity on a 2″-deep pan with extensions
  (seen in review as 96.67 sf summed against an 83.33 sf room). Pre-existing,
  not introduced by Phase 2, and out of scope for it; give it the same
  bounding-box treatment `floorSfOf` got if it's worth fixing.
- **The wall-system flip confirm's wording.** Flipping a loaded S-DRY kit
  back to Building Panel (when hand work exists) reuses `KitOverwriteConfirm`
  with its kit-card copy ("Start the Building Panel kit?"), because that's
  the existing three-way confirm (Overwrite / Keep what I added / New
  shower) and reusing it kept one component instead of a second one-off
  modal. The copy doesn't quite fit a wall-system flip rather than a new kit
  card. Owner call on better wording — functionally correct either way.
- The full list of smaller deferred findings (test gaps, cosmetic proof-shot
  issues, an untested backer-note-row branch, and so on) is in
  `.superpowers/sdd/2026-09-28-board-vs-membrane/progress.md` (session
  ledger, not committed) under each task's "minor (deferred)" lines.

## How Phase 2 was run (repeat it)

Same process as 1a–1d (see the Phase 2 handoff for the full write-up):
brainstorming → a design spec, section by section, with owner approval →
writing-plans (a plan with full code, prototyped in a scratch copy of `src`
first, its prototyping rulings recorded) → subagent-driven-development (a
task ledger, a review after every task, fix rounds, a final whole-branch
review, one fix wave, then the PR). Models: Opus for engine changes that can
move saved bills and for the stateful popup, and for every review; Sonnet for
mechanical tasks where the plan holds the full code.

**What reviews caught this time** (on top of 1a–1d's list — check these up
front on Phase 3):
- a bill line that a preview shot doesn't actually prove (Task 7 caught two:
  the badge reading the wrong cut source, and the wedi-pan-under-S-DRY-walls
  joint sealant billing nothing);
- a destructive UI action (flip to Building Panel) wiping hand work with no
  confirm, on one of its two tabs but not the other;
- a saved pick that keeps applying somewhere it shouldn't once its host
  build changes underneath it (the S-DRY cover carried onto a wedi pan) —
  the fix is a guard mirrored on both branches, not a special case on one;
- a rate recipe skipped for one build shape only (Membrane on a curbless
  pan) doubling a line the non-curbless path already billed once.

## Environment gotchas (cloud sessions)

- **Build:** `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build`.
  Without the env var the HTML placeholder fails, the same as on `main`. The
  build prints a pre-existing CSS minify warning.
- **Tests / lint:** `npm test` (1822 passing at the end of Phase 2),
  `npm run lint`.
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
  - House-style scripts: `p1a/`–`p1d/` and now `p2/` (`shoot-wedi.mjs`,
    `shoot-compare.mjs`, both ending "all checks passed"). Re-run the earlier
    scripts after any popup change; restore any PNG that re-renders with no
    real change (`git checkout` it back).
  - Popover DOM hooks carried into Phase 2: `data-wedi-wallsys`,
    `data-wedi-wallsys-board`, `data-wedi-wallsys-membrane`,
    `data-wedi-sdryask`, `data-wedi-sdrychip`, `data-cmp-sys` (Compare's
    column-system header).
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
