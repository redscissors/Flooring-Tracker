# Handoff — shower configurators, ticket 158: Phase 2 onward (2026-09-27)

Start here in a new session. The standing ledger is
`.scratch/158_shower-config-roadmap/ticket.md`, which holds the phase list,
owner answers and the "Carry into Phase 2+" list. The earlier handoffs
(`shower-config-phase1a-2026-09-26.md`, `shower-config-phase1c-2026-09-27.md`,
`shower-config-phase1d-2026-09-27.md`) are history now.

## Where things stand

| Piece | State | Where |
|---|---|---|
| Phase 0 (P0-1…P0-6) | merged | [redscissors/Flooring-Tracker#436](https://github.com/redscissors/Flooring-Tracker/pull/436) |
| **1a** drain slot | merged | [redscissors/Flooring-Tracker#437](https://github.com/redscissors/Flooring-Tracker/pull/437) |
| **1b** ⇄ on every line | merged 2026-09-27 | [redscissors/Flooring-Tracker#438](https://github.com/redscissors/Flooring-Tracker/pull/438) |
| 1b owner calls + the 1c handoff | merged 2026-09-27 | [redscissors/Flooring-Tracker#439](https://github.com/redscissors/Flooring-Tracker/pull/439) |
| **1c** "+" on every group, add another line | merged 2026-09-27 | [redscissors/Flooring-Tracker#441](https://github.com/redscissors/Flooring-Tracker/pull/441) |
| **1d** shared group names, Compare alignment, the mirror | **PR pending** | branch `claude/shower-config-phase-1d-eafhd0` |
| **Phase 2** Board vs Membrane, both brands | **not designed** | this handoff |
| **Phase 3** 4-way compare | not designed; needs 1 + 2 | ticket |

Phase 1 is complete once the 1d PR merges. Check that it has before starting
Phase 2 work on top of it.

Records to read before designing anything:
- **ADR 0049** (`docs/adr/0049-configurator-swaps-remember-the-choice.md`,
  amended for 1b, 1c and 1d).
  - Swaps remember the *choice*, never the part. The engine resolves the
    choice on every build. Old markers translate on read.
  - `src/slots.js` is the one line vocabulary.
  - 1c: added lines are parts + a hand-set qty, never choices. One list per
    brand in the marker (`cfg.manual`).
  - 1d: the display group derives from the slot (`GROUPS`, `groupOf`); the
    engines' own groups stay internal keys. Compare's other column holds
    session state (mirrored added lines).
- **ADR 0034** (`docs/adr/0034-cross-vendor-compare.md`). Its "Open" section
  has the unmade KERDI-BOARD toggle on Compare, which Phase 2 has to settle.
- **Specs**, each with an "Amendments during planning and build" section that
  records what actually shipped:
  - `docs/superpowers/specs/2026-09-26-drain-slot-design.md` (1a)
  - `docs/superpowers/specs/2026-09-26-swap-every-line-design.md` (1b)
  - `docs/superpowers/specs/2026-09-27-add-another-design.md` (1c)
  - `docs/superpowers/specs/2026-09-27-shared-groups-compare-design.md` (1d)
- **Plans** (house style for the next one):
  - `docs/superpowers/plans/2026-09-27-add-another.md`
  - `docs/superpowers/plans/2026-09-27-shared-groups-compare.md`
- `src/CLAUDE.md` entries for `slots.js`, `swappop.jsx`, `schluter.js`,
  `wedi.js`, `showersf.js`, both popups, `comparekit.js`, `comparemirror.js`,
  `CompareTab.jsx`, `wedimarkergolden.js` and `addedgolden.js`.

## What 1d left in place for Phase 2

- **One group list on both bills, both prints and Compare.** `GROUPS` in
  `src/slots.js`: Base · Drain · Curb · Walls · Seams · Niches · Bench ·
  Setting · Extras. A line draws under `groupOf(line.slot)`. Walls holds two
  slots, `wallBoard` and `wallMembrane`, so a Board build and a Membrane
  build already fill different rows of the same band.
- **Engine groups are internal keys.** Schluter `l.g` and wedi buckets are
  still what qty-override keys and added rows store. Don't rename them and
  don't write a shared group key into a marker.
- **"+" tables are keyed by shared group.** Each part stores its engine group
  and only offers parts that land back in its group (`ADD_PARTS`,
  `WEDI_ADD_PARTS`). A new part type needs a slot that lands in the right
  group, or the "+" drops it.
- **Compare is slot-aligned.** One row per slot either column fills; added
  lines sit in their slot row. Every hand-added line is mirrored onto the
  other brand (comparekit `mirrorPlan`, `src/comparemirror.js` for sizes).
  Wall board and wall membrane are sized slots (thickness then sf; sf).
- **Today's wall systems.**
  - Schluter has the fork: `cfg.wallSys` `"board"` (KERDI-BOARD) or
    `"membrane"`, labelled "KERDI over backer" in the popup
    (`SchluterConfigurator.jsx`).
  - wedi has no fork: walls are always Building Panel. Its Subliner and
    S-DRY catalog groups map to slot `seam` (`WEDI_SLOT` in `wedi.js`), so
    a membrane roll added today draws under Seams, not Walls.
  - Compare's Schluter side is always membrane walls (`schluterBuildFor`,
    `wallSys: "membrane"`); the walls difference is carried by words (the
    help tip and the delta line).
- **Both goldens must stay green, untouched:** `src/wedimarkergolden.test.js`
  (1b) and `src/addedgolden.test.js` (1c). 1d added no golden: it moved no
  saved bill.

## Next: Phase 2 — Board vs Membrane on both brands

From the ticket:
- Schluter: KERDI-BOARD | KERDI (both exist).
- wedi: Building Panel | **Subliner Dry or S-DRY** — the owner picks.
- Rename "overbacker" to **Membrane** everywhere.

From the ticket's findings: wedi has two membrane systems, both stocked.
Subliner Dry (53 / 323 sf rolls, sealing tape, corners, seals) is installed
with Sealant 620. S-DRY (Mar 2026: 104 sf and 106 sf XL rolls, S-DRY tape,
corners, collars, S-DRY SEAL) has its own bases, curbs and kits. The
configurator builds no S-DRY today, so S-DRY SEAL was left to Phase 2 (P0-5).

**Questions to take into brainstorming.** Ask them one at a time; the
approval gate applies.
- Which wedi system is "Membrane": Subliner Dry, S-DRY, or both as a choice?
- If S-DRY: does the membrane choice also pull S-DRY pans, curbs and kits and
  S-DRY SEAL, or only change the walls?
- Where does the Board / Membrane fork live on wedi — the room tab, the kit
  card, or a Walls-group control like Schluter's?
- Which slot does a wedi wall membrane roll fill: `wallMembrane` (under
  Walls) while its tape stays `seam`? That changes where today's Subliner /
  S-DRY lines draw.
- The rename: which labels change ("KERDI over backer" → "Membrane" on both
  Schluter buttons, the Compare help tip, the diff notes), and does any
  saved value change? `cfg.wallSys` already stores `"membrane"`, so probably
  not.
- Compare: does it gain a Board / Membrane toggle so both sides can be built
  the same way (ADR 0034 open item), or does that wait for Phase 3's 4-way
  grid?
- How does a Membrane build figure setting material and sealant on wedi (the
  Schluter side has "Figure thin-set & KERDI")?

## Deferred from 1d

One line each; the full list is in
`.superpowers/sdd/2026-09-27-shared-groups-compare/progress.md` (session
ledger, not committed).
- `groupOf`'s Extras fallback is positional (`GROUPS[last]`); key it on
  `"extras"`.
- The "+ lands back in its group" tests are near-circular (`plusPart` bakes
  the check into `hit`); add offered-part asserts (e.g. wedi Base recess).
- A mirror pick's qty isn't validated (0 / undefined gives a row the engine
  drops); the picker's stepper floors at 1.
- `compareLayout` drops a row whose slot isn't in `SLOTS`, while
  `compareTotals` counts it.
- `mirrorParts` rescans the catalog per host added line (and the tab re-runs
  it per render).
- A mirror entry that vanishes while the picker is open leaves its Esc layer
  pushed with nothing on screen.
- A pick whose part left the book reads "Nothing comparable…", not a
  lost-pick note.
- A 250 mm Schluter band reads 9.75″ against its 10″ label.

## Deferred from 1c (still open)

- **Group vs slot.** The Schluter Base "+" offers Tray · Membrane, though both
  fill the `tray` slot — the Part row follows parts, not slots.
- **Row order.** An added line's ⇄ moves the replaced row to the end of its
  group. Compare aligns by slot, not position, so this is cosmetic now.
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

## How 1a–1d were run (repeat it)

- **Process.** Owner-approved and binding (root `CLAUDE.md`, owner
  interaction rule):
  1. `brainstorming`: classify, one question at a time via
     AskUserQuestion, 2–3 approaches, a sectioned design with approval
     after each section, a spec file, and owner review of the spec.
  2. `writing-plans`: a plan with full code, prototyped in a scratch copy of
     `src` before it is written. The plan records its prototyping rulings
     for the records task.
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
  - chips or pickers deciding availability with their own rule instead of
    asking the resolver (1c: a drain Length chip lit at a length that
    stepped down; 1d: the mirror picker cut its list at 60 with no search);
  - a stale saved pick falling back silently, or seeding a draft;
  - a lookup keyed on part alone, so a same-part line in another group
    hijacked it — key on group + part;
  - a Browse-only or manual build reaching code that assumes a kit build;
  - a stepper or reset touching the other kind of line (kit vs added);
  - reading a size or key off a live product name (1d: board thickness —
    read the SKU code / classified field first);
  - proof that doesn't show what it claims (1d: print shots rendered screen
    media and were byte-identical to the bill shots).

## Environment gotchas (cloud sessions)

- **Build:** `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build`.
  Without the env var the HTML placeholder fails, the same as on `main`. The
  build prints a pre-existing CSS minify warning.
- **Tests / lint:** `npm test` (1779 passing on the 1d branch),
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
  - **Print proof needs `emulateMedia({ media: "print" })`.** Both popups'
    print sheets are styled only under `@media print`, so a plain screenshot
    shows the bill again. Switch to print media inside the sheet's 2.5 s
    mount window, take a `fullPage` shot, then switch back to screen media
    before clicking anything (`p1d/shoot-bills.mjs` `printShot`).
  - `fullPage` can't reach inside the popup's own scroll area; scroll the
    element or shoot the viewport.
  - House-style scripts: `.scratch/158_shower-config-roadmap/p1a/`, `p1b/`,
    `p1c/` (`shoot-schluter.mjs`, `shoot-wedi.mjs`) and `p1d/`
    (`shoot-bills.mjs`, `shoot-compare.mjs`). The p1c and p1d scripts end
    `— all checks passed`.
  - Popover DOM hooks: `data-drain-chip="<Row>:<key>"`, `data-drain-use`,
    `data-so-dot`; 1c adds `data-add-pop`, `data-add-qty`, `data-add-row`,
    `data-add-search`, `data-added-tag`, `data-added-swapb`;
    `data-add-group` carries the group label since 1d ("Niches"). Compare
    (1d): `data-cmp-group`, `data-cmp-slot`, `data-mirror-line`,
    `data-mirror-swap`, `data-mirror-drop`, `data-mirror-plus`,
    `data-mirror-add`, `data-mirror-row`, `data-mirror-more`; the picker
    reuses `data-add-pop` and `data-add-search`.
  - The wedi harness's job-sheet overlay covers the popup's tab strip; click
    tabs with `dispatchEvent("click")`.
  - Re-run the p1a–p1d scripts after any popup change. Restore any PNG that
    re-renders with no real change.
- **Price files:** the owner's uploaded price files are not in the repo. The
  fixtures are `src/schluterfixture.js`, `src/wedifixture.js` and
  `src/keimwedifixture.js`. The wedi fixture book has no Extras "Other"
  parts, so the wedi bill draws eight group headers there.
- **Workflow rules:**
  - Never push to `main`; every change goes through a PR.
  - Never touch the live Supabase project.
  - Every UI change needs preview screenshots in the PR.
  - The brainstorming approval gate applies in cloud sessions too.
