# Handoff — shower configurators, ticket 158: 1c onward (2026-09-27)

Start here in a new session. The standing ledger is
`.scratch/158_shower-config-roadmap/ticket.md`, which holds the phase list,
owner answers and the "Carry into 1c+" list. The previous handoff
(`shower-config-phase1a-2026-09-26.md`) is history now.

## Where things stand

| Piece | State | Where |
|---|---|---|
| Phase 0 (P0-1…P0-6) | merged | [redscissors/Flooring-Tracker#436](https://github.com/redscissors/Flooring-Tracker/pull/436) |
| **1a** drain slot | merged | [redscissors/Flooring-Tracker#437](https://github.com/redscissors/Flooring-Tracker/pull/437) |
| **1b** ⇄ on every line | merged 2026-09-27 | [redscissors/Flooring-Tracker#438](https://github.com/redscissors/Flooring-Tracker/pull/438) |
| **1c** "+" per group, several niches in wedi | **not designed** | this handoff |
| **1d** shared group names, Compare row alignment | not designed | this handoff |
| **Phase 2** Board vs Membrane, both brands | not designed | ticket |
| **Phase 3** 4-way compare | not designed; needs 1 + 2 | ticket |

Records to read before designing anything:
- **ADR 0049** (`docs/adr/0049-configurator-swaps-remember-the-choice.md`,
  amended for 1b). Swaps remember the *choice*, never the part. The engine
  resolves the choice on every build. Old markers translate on read.
  `src/slots.js` is the one line vocabulary.
- **Specs**, each with an "Amendments during planning and build" section that
  records what actually shipped:
  - `docs/superpowers/specs/2026-09-26-drain-slot-design.md` (1a)
  - `docs/superpowers/specs/2026-09-26-swap-every-line-design.md` (1b)
- **Plans** (house style for the next one):
  - `docs/superpowers/plans/2026-09-26-drain-slot.md`
  - `docs/superpowers/plans/2026-09-27-swap-every-line.md`
- `src/CLAUDE.md` entries for `slots.js`, `swappop.jsx`, `schluter.js`,
  `wedi.js`, `showersf.js`, both popups and `wedimarkergolden.js`.

## Owner calls after 1b

- **Stale wedi `curbKey`: DONE (2026-09-27).** The owner confirmed R2: it
  bills the recipe default curb, and `markerCurbKey` now falls through to
  the same curb, so tile sf agrees.
- **Trendline finish names: DONE (2026-09-27).** `FINISH_LABEL` in
  `src/schluter.js` uses Schluter's names. The fix also corrected EP (Chrome,
  not polished stainless) and MBW (Matte white, not black).
- **Default KERDI-BAND width: still OPEN.**
  - `resolveBand(null)` searches every width, so under Full catalog the
    landed width can depend on registry row order.
  - Research (2026-09-27):
    - 5″ (`KEBA100/125`) is Schluter's standard; it's the band in the
      KERDI-SHOWER-KIT.
    - 7¼″ (`KEBA100/185`) is for wider coverage in one strip.
  - Proposed: no choice = the 5″ (narrowest width carried), stock-first.
  - This changes default bills, so ask the owner if the PR thread hasn't
    answered.

## Next: 1c — "+" on each group header

The ticket asks for this (Phase 1 section):
- **"+" on each group header** (Walls, Niches, Drains, …) opens an inline
  picker filtered to that slot, so you can grab a different panel without
  leaving for Browse.
- **"Swap" and "add another" are separate actions.** Owner, 2026-09-26: "add
  another" (e.g. a second KERDI-BAND width) lands in 1c with the "+", built
  once for every slot.
- **Niches allow several lines of different sizes** (wedi).

**Questions to take into brainstorming.** Ask them one at a time; the
approval gate applies.
- **Which groups get a "+"**, and whether every slot or only the ones with a
  sensible "another" (bands, niches, panels, fasteners?).
- **How an added line is saved.**
  - Schluter already has `manual` extras (`cfg`'s manual list,
    `g:"Extras"`); wedi has `manual` rows (`auto:false`, `applySession`).
  - Does "+" write into those, or into a new per-slot "extra lines" record
    that follows ADR 0049 (a choice, re-fitting to the room)?
  - That is the big design fork. Present options with trade-offs.
- **Does an added line get its own ⇄?**
  - 1b deliberately gives Browse-added manual lines **no** opts-backed ⇄ in
    a wedi kit build, because those swaps write the kit's own pick.
  - 1c must decide how an added line swaps, most likely by its own record,
    not the kit's.
- **Picker UI.** Reuse `SwapPop` (`src/swappop.jsx`) rows, or a list?
  Stock-first and the SO dot apply either way.
- **Several wedi niches.** Today niches are `addons` keys. Several sizes
  means several entries, and the drawing and bill must handle them.

**Known 1b behaviours 1c will touch:**
- A Browse-added line with the same key as a kit line merges into the kit
  line (`applySession`) and keeps that line's ⇄.
- The curb drawing draws any curb line, including a Browse-added one on a
  curbless kit.
- Bench lines sharing a board SKU share one hand-set quantity
  (`ovKey` = `g|sku`). Pre-existing, but it matters once "+" adds boards.

## Then: 1d — shared names, Compare alignment

- Both bills read the same group names, from `SLOT_LABEL` in `src/slots.js`.
  Every engine line and Compare row already carries `slot`, stamped by 1a/1b.
- Compare lines up row for row by slot.
- 1b's decision 4 declined a shared `picks` map. 1d aligns on the line
  `slot` tags, not on the saved marker shape.

## Phases 2 and 3 (from the ticket; not designed)

- **Phase 2:** Board vs Membrane on both brands.
  - Schluter: KERDI-BOARD | KERDI (exists).
  - wedi: Building Panel | **Subliner Dry or S-DRY**. The owner picks which.
  - Rename "overbacker" to **Membrane** everywhere.
- **Phase 3:** 4-way compare.
  - The same room through wedi Board / wedi Membrane / Schluter Board /
    Schluter Membrane, shown as a 2×2 grid or a slim bar of four live
    totals.
  - Each cell shows the total, the Δ against the current build, and flags
    for anything that didn't map (no pan size, a cut or mortar-bed fallback,
    no drain match, an "inquire" price).
  - Click a cell to open that build. Several cells can be sent to the space
    as quote options A–D (ADR 0031/0034).

## How 1a and 1b were run (repeat it)

- **Process.** Owner-approved and binding (root `CLAUDE.md`, owner
  interaction rule):
  1. `brainstorming`: classify, one question at a time via
     AskUserQuestion, 2–3 approaches, a sectioned design with approval
     after each section, a spec file, and owner review of the spec.
  2. `writing-plans`: a plan with full code, prototyped in a scratch copy of
     `src` before it is written.
  3. `subagent-driven-development`: a ledger in `.superpowers/sdd/<plan>/`,
     a task review after every task, fix rounds, a final whole-branch
     review, one fix wave, then the PR.
- **Models** (owner, 2026-09-27):
  - Opus for risky tasks (engine changes that can move saved bills, popup UI)
    and for **every** review.
  - Sonnet for mechanical tasks where the plan holds the full code.
- **Rulings.** Plan-vs-spec conflicts are ruled by the controller (the spec
  wins), ledgered, and recorded in the spec's Amendments section by the
  records task. Owner-facing ones go in the PR's "Needs your call".
- **Golden test pattern.** When a change can move old saved markers:
  1. As the first task, before touching the engine, capture a golden of
     today's bills (`.scratch/158_shower-config-roadmap/tools/gen-wedi-marker-golden.mjs`
     → `src/wedimarkergolden.js`).
  2. Later tasks must keep it green, untouched.
- **What reviews kept catching** (check these up front next time):
  - chips deciding availability with their own rule instead of asking the
    resolver;
  - a stale saved pick falling back silently;
  - a swap lookup keyed on SKU alone, so a same-SKU line on another row
    hijacked it;
  - a Browse-only or manual build reaching code that assumes a kit build.

## Environment gotchas (cloud sessions)

- **Build:** `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build`.
  Without the env var the HTML placeholder fails, the same as on `main`. The
  build prints a pre-existing CSS minify warning.
- **Tests / lint:** `npm test` (1721 passing at #438), `npm run lint`.
- **Preview proof:**
  - Run `npx vite --port 5199 --strictPort` in the background.
  - Harnesses: `schluter-preview.html`, `wedi-preview.html` (which takes
    `?seed=<json>` to open a saved marker), and `import-preview.html`.
  - Load Playwright with
    `createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core")`
    and `executablePath: "/opt/pw-browsers/chromium"`.
  - The harness opens on Stock only. `[data-source-toggle]` switches to Full
    catalog.
  - House-style scripts: `.scratch/158_shower-config-roadmap/p1a/` and
    `p1b/` (`shoot-schluter.mjs`, `shoot-wedi.mjs`).
  - Popover DOM hooks: `data-drain-chip="<Row>:<key>"`, `data-drain-use`,
    `data-so-dot`.
  - Re-run the p1a and p1b scripts after any popup change. Restore any PNG
    that re-renders with no real change.
- **Price files:** the owner's uploaded price files are not in the repo. The
  fixtures are `src/schluterfixture.js`, `src/wedifixture.js` and
  `src/keimwedifixture.js`.
- **Workflow rules:**
  - Never push to `main`; every change goes through a PR.
  - Never touch the live Supabase project.
  - Every UI change needs preview screenshots in the PR.
  - The brainstorming approval gate applies in cloud sessions too.
