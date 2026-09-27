# Handoff — shower configurators, ticket 158: 1d onward (2026-09-27)

Start here in a new session. The standing ledger is
`.scratch/158_shower-config-roadmap/ticket.md`, which holds the phase list,
owner answers and the "Carry into 1d+" list. The earlier handoffs
(`shower-config-phase1a-2026-09-26.md`, `shower-config-phase1c-2026-09-27.md`)
are history now.

## Where things stand

| Piece | State | Where |
|---|---|---|
| Phase 0 (P0-1…P0-6) | merged | [redscissors/Flooring-Tracker#436](https://github.com/redscissors/Flooring-Tracker/pull/436) |
| **1a** drain slot | merged | [redscissors/Flooring-Tracker#437](https://github.com/redscissors/Flooring-Tracker/pull/437) |
| **1b** ⇄ on every line | merged 2026-09-27 | [redscissors/Flooring-Tracker#438](https://github.com/redscissors/Flooring-Tracker/pull/438) |
| 1b owner calls + the 1c handoff | merged 2026-09-27 | [redscissors/Flooring-Tracker#439](https://github.com/redscissors/Flooring-Tracker/pull/439) |
| **1c** "+" on every group, add another line | merged 2026-09-27 | [redscissors/Flooring-Tracker#441](https://github.com/redscissors/Flooring-Tracker/pull/441) |
| **1d** shared group names, Compare row alignment | **not designed** | this handoff |
| **Phase 2** Board vs Membrane, both brands | not designed | ticket |
| **Phase 3** 4-way compare | not designed; needs 1 + 2 | ticket |

Records to read before designing anything:
- **ADR 0049** (`docs/adr/0049-configurator-swaps-remember-the-choice.md`,
  amended for 1b and 1c).
  - Swaps remember the *choice*, never the part. The engine resolves the
    choice on every build. Old markers translate on read.
  - `src/slots.js` is the one line vocabulary.
  - 1c: added lines are parts + a hand-set qty, never choices. One list per
    brand in the marker (`cfg.manual`); wedi `addons` retired into it.
- **Specs**, each with an "Amendments during planning and build" section that
  records what actually shipped:
  - `docs/superpowers/specs/2026-09-26-drain-slot-design.md` (1a)
  - `docs/superpowers/specs/2026-09-26-swap-every-line-design.md` (1b)
  - `docs/superpowers/specs/2026-09-27-add-another-design.md` (1c)
- **Plans** (house style for the next one):
  - `docs/superpowers/plans/2026-09-27-swap-every-line.md`
  - `docs/superpowers/plans/2026-09-27-add-another.md`
- `src/CLAUDE.md` entries for `slots.js`, `swappop.jsx`, `schluter.js`,
  `wedi.js`, `showersf.js`, both popups, `wedimarkergolden.js` and
  `addedgolden.js`.

## What 1c left in place for 1d

- **Every line carries `slot`**, kit lines and added lines alike (`slotOf` /
  `wediSlotOf`). An added line's group is stored (`g` / `group`); its slot
  is still derived.
- **Group names differ by brand today.**
  - Schluter bill groups (`BILL_GROUPS`): Base · Drain · Walls · Seams ·
    Curb · Setting · Extras.
  - wedi buckets (`WEDI_BUCKETS`): floor · walls · bench · drain · install ·
    addon.
  - Niches file under Extras (Schluter) / Add-ons (wedi). The 1c spec left a
    Niches group to 1d.
- **Every group header has a "+".** `ADD_PARTS` (schluter.js) and
  `WEDI_ADD_PARTS` (wedi.js) list what each group's "+" offers, keyed by the
  brand's own group names. Renaming or merging groups moves these tables
  and the stored `g` / `group` on saved rows — old markers must still
  translate on read.
- **Both goldens must stay green, untouched:** `src/wedimarkergolden.test.js`
  (1b) and `src/addedgolden.test.js` (1c).

## Next: 1d — shared names, Compare alignment

- Both bills read the same group names, from `SLOT_LABEL` in `src/slots.js`.
- Compare lines up row for row by slot.
- 1b's decision 4 declined a shared `picks` map. 1d aligns on the line
  `slot` tags, not on the saved marker shape.

**Questions to take into brainstorming.** Ask them one at a time; the
approval gate applies.
- Do the on-screen groups become the slots (a Niches group, a Bench group),
  or do slots stay a Compare-only key under today's groups?
- If groups change, what happens to a saved added row's `g` / `group`?
  Translate on read (ADR 0049 rule 4), never rewrite the marker.
- Where does an added line sit in Compare: beside the kit line of its slot,
  or as its own row?

## Deferred from 1c

Things a 1d session may trip over (the full list is in
`.superpowers/sdd/2026-09-27-add-another/progress.md`):
- **Group vs slot.** The Schluter Base "+" offers Tray · Membrane, though both
  fill the `tray` slot — the Part row follows parts, not slots.
- **Row order.** An added line's ⇄ moves the replaced row to the end of its
  group. Matters if Compare aligns by position.
- **Reconfigure nets per part.** `sessionFromRows` (both brands) nets added
  qty per sku/key. A placed added row edited on the sheet, sharing a part
  with a kit line, is read back as the kit line's `qtyOv`. The total is
  right; the attribution isn't.
- **Owner call (open):** Reconfigure where the sheet *lowered* or removed an
  added-only line reopens at the marker's qty; the sheet edit is dropped.
- **Browse-only wedi.** Staging a Browse-only build drops each row's
  `group` (`normKitSession`); unreachable today.
- **Point-drain Grate list** includes KERDI-LINE (linear) grates.
- **wedi sealant gun** is stored in the add-on bucket, but the chip's on
  state and toggle match the gun in any bucket.
- **Bench boards sharing a sku** still share one hand-set qty (pre-existing,
  on the ticket).

## How 1a–1c were run (repeat it)

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
     today's bills (`.scratch/158_shower-config-roadmap/tools/gen-*-golden.mjs`
     → `src/*golden.js`).
  2. Later tasks must keep it green, untouched.
- **What reviews kept catching** (check these up front next time):
  - chips deciding availability with their own rule instead of asking the
    resolver (1c: a drain Length chip lit at a length that stepped down);
  - a stale saved pick falling back silently, or seeding a draft;
  - a lookup keyed on part alone, so a same-part line in another group
    hijacked it — key on group + part;
  - a Browse-only or manual build reaching code that assumes a kit build;
  - a stepper or reset touching the other kind of line (kit vs added).

## Environment gotchas (cloud sessions)

- **Build:** `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build`.
  Without the env var the HTML placeholder fails, the same as on `main`. The
  build prints a pre-existing CSS minify warning.
- **Tests / lint:** `npm test` (1744 passing on the 1c branch),
  `npm run lint`.
- **Preview proof:**
  - Run `npx vite --port 5199 --strictPort` in the background.
  - Harnesses: `schluter-preview.html`, `wedi-preview.html` (which takes
    `?seed=<json>` to open a saved marker), and `import-preview.html`.
  - Load Playwright with
    `createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core")`
    and `executablePath: "/opt/pw-browsers/chromium"`.
  - The harness opens on Stock only. `[data-source-toggle]` switches to Full
    catalog.
  - House-style scripts: `.scratch/158_shower-config-roadmap/p1a/`, `p1b/`
    and `p1c/` (`shoot-schluter.mjs`, `shoot-wedi.mjs`). The p1c scripts
    end `— all checks passed`.
  - Popover DOM hooks: `data-drain-chip="<Row>:<key>"`, `data-drain-use`,
    `data-so-dot`; 1c adds `data-add-group`, `data-add-pop`,
    `data-add-qty`, `data-add-row`, `data-added-tag`, `data-added-swapb`.
  - The wedi harness's job-sheet overlay covers the popup's tab strip; click
    tabs with `dispatchEvent("click")`.
  - Re-run the p1a, p1b and p1c scripts after any popup change. Restore any
    PNG that re-renders with no real change.
- **Price files:** the owner's uploaded price files are not in the repo. The
  fixtures are `src/schluterfixture.js`, `src/wedifixture.js` and
  `src/keimwedifixture.js`.
- **Workflow rules:**
  - Never push to `main`; every change goes through a PR.
  - Never touch the live Supabase project.
  - Every UI change needs preview screenshots in the PR.
  - The brainstorming approval gate applies in cloud sessions too.
