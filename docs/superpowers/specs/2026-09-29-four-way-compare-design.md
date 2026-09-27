# Four-way compare — wedi/Schluter × Board/Membrane, Phase 3 — design

**Date:** 2026-09-29 · **Status:** approved by owner in chat, section by section
· **Ticket:** `.scratch/158_shower-config-roadmap/ticket.md` (Phase 3)
· **Builds on:** Phase 1 (1a–1d), Phase 2 (`2026-09-28-board-vs-membrane-design.md`),
ADR 0034 (Compare), ADR 0049, ADR 0051

## Problem

- **Compare shows two roads, and there are four.** Since Phase 2 both brands
  build on either wall system. The Compare tab still shows only the host
  build and the other brand on the host's own wall system (ADR 0051 closed
  the like-for-like gap, not the any-vs-any one).
- **Nothing says when a build didn't map cleanly.** A mortar-bed fallback, a
  drain fallback, a $0 row or an unmatched hand-added line reads the same as a
  clean build unless you read every line.
- **Quote options land as exactly two.** `compareOptionsPatch` takes
  `{ wediLines, schluterLines }` and always lands A = wedi, B = Schluter.

## Owner decisions (2026-09-27)

1. **Placement:** a 2×2 grid at the top of the Compare tab. Clicking a cell
   drives today's two-column detail below it. It is not an always-on bar, and
   it does not replace the detail.
2. **Axes:** brands across the top (wedi, Schluter), wall systems down the
   side (Board, Membrane). Letters A–D follow reading order: A = wedi Board,
   B = Schluter Board, C = wedi Membrane, D = Schluter Membrane.
3. **Cells:** the cell matching the host's brand and `cfg.wallSys` is the
   **live build**. The other three are **derived house kits** for the same
   room (ADR 0034 decision 3, extended).
4. **Flags:** short chips, at most two per cell plus "+N more". Clicking a
   chip selects the cell and scrolls the detail to the flagged line.
5. **Hand-added lines** carry into all three derived cells. On the host
   brand's other wall system they pass through as-is (same parts). On the
   other brand they mirror with the auto nearest match. Picks are changed per
   cell, in that cell's detail. Nothing in the grid asks for a pick.
6. **Sending:** the checked cells land as N fresh sibling option areas,
   lettered A–D, in one patch. Today's two-column send becomes the N=2 case
   (ADR 0034 decision 4, extended).
7. **S-DRY no-fit in a derived cell:** price a wedi pan + S-DRY walls, show a
   "No S-DRY base fits" chip, and let the detail switch that cell to the
   nearest S-DRY base. There's never a blank cell and never a silent drop
   (ADR 0051).
8. **Approach A:** a pure per-cell builder and flag module,
   `src/comparegrid.js`. `CompareTab.jsx` draws the grid and the detail.

## 1. The grid

```
                wedi                       Schluter
  Board    [☐ Building Panel  $1,480]  [☐ KERDI-BOARD     $1,390]
  Membrane [☐ S-DRY           $1,612]  [☐ KERDI membrane  $1,275]
```

- **Each cell** shows a checkbox, the system name (the same words as
  `data-cmp-sys`), the total in the current price lens (the existing
  Retail/Builder toggle), the difference from the live build ("+$132",
  "−$205"), and up to two flag chips, then "+N more".
- **The live cell** shows **"Current"** in place of a difference, with a
  subtle outline.
- **A cell that can't be built** (no room typed, books still loading, no
  Schluter rows, nothing solves) shows today's single explanatory line. It
  has no total and its checkbox is disabled.
- **Clicking a cell** selects it, and the detail below becomes **live vs that
  cell**, with today's rows, mirror ⇄/×/+ controls and headers. Clicking the
  live cell does nothing.
- **What opens first:** the detail shows the same pair as today, the live
  build against the other brand on the host's wall system.
- **Clicking a chip** selects its cell, scrolls the detail to the chip's row,
  and briefly highlights it.
- **"Open that build"** (ticket wording) means select-and-show-detail. The
  popup does not switch to the other brand's configurator (ADR 0034
  decision 3 rejected a configurator inside Compare).
- **Sending:** a button under the grid reads **"Add N as quote options"**. It
  is disabled below two checked cells, and it opens today's confirm modal.
  - The modal lists each lettered option, its total and its chips.
  - Flags never block sending.
  - When the tab opens, the live cell and today's opposite cell start
    checked, so the default send matches today's.
  - The detail-level send button is removed, and the grid button replaces it.

## 2. Flags

`cellFlags(brand, build, rows, plan)` → `[{ id, label, rowKey }]`, ordered by
the table below (the first row is the most severe). `rowKey` is the detail row
the chip scrolls to. A flag with no line of its own points at the cell's Base
row.

| id | Chip | Brand | Source |
|---|---|---|---|
| `mortar` | No tray fits — mortar bed | Schluter | `trayCandidates` yields only `{ kind: "mortar" }` |
| `drain` | No drain match | Schluter | `resolveDrain` returns `fallback` |
| `drain` | No drain match | wedi | the solver's "no *X*-drain base fits" or "no base reaches" condition |
| `sdry` | No S-DRY base fits | wedi Membrane | the build fell back to `sdryBase: "wedi"` |
| `short` | Channel runs short | Schluter | the Vario "runs short" line note |
| `deep` | Deep cut | both | Schluter `cand.deep`; wedi's deep-cut condition (more than 6″ off a side) |
| `price` | No price | both | a billed row (not `noteOnly`) priced at $0 in the current lens |
| `unmatched` | Added line unmatched | derived other-brand cells | a mirror entry with no match, or one you dropped |

Rules:
- **Only "didn't map cleanly" signals become chips.** The wedi solver's
  ordinary install notes (seam counts, trims, build-up sheet, "cut to size")
  stay in the detail as they are today.
- **The $0 `noteOnly` rows** (substrate by others, mortar-bed placeholder)
  stay unchanged in the detail and are not flags. The mortar-bed row is what
  the `mortar` chip points at.
- **The live cell gets chips** from the same rules.
- **wedi source of truth:** the plan checks first whether the option carries
  structured facts (drain match, deep cut). Warning-string matching is a last
  resort, pinned by tests on the exact strings.
- **"Inquire" price:** the price books carry no inquire marker, so a $0 billed
  row is the signal. If an inquire marker is ever added to the books, this
  chip should read it.

## 3. State and data flow

Nothing new is saved (ADR 0034 decision 5). All grid state is session state:
it outlives a tab switch but not the popup.

- **Cell keys:** `wedi:board`, `wedi:membrane`, `schluter:board`,
  `schluter:membrane`. The host key comes from the popup's brand and
  `cfg.wallSys`; absent or unknown reads as that brand's default, per
  ADR 0051.
- **`cellBuild(key, ctx)`** in `comparegrid.js` returns
  `{ build, rows, totals, flags, plan }` or an unbuildable reason:
  - **Live cell:** today's `hostBuild` and rows, unchanged.
  - **Same brand, other wall system:** `wediBuildFor`/`schluterBuildFor` on
    the room with that `wallSys`, the same brand-level inputs Compare passes
    today (source, tier, mortar item), and the host's added lines as `manual`.
    No mirror. The host's swaps and solver pick do not carry: it is a house
    kit.
  - **Other brand:** the derived build today's opposite column uses, plus that
    cell's own mirror (`mirrorPlan` over that cell's mirror state).
- **Mirror state:** the popups' `mirror` prop becomes `{ [cellKey]: state }`
  (held where it is held today). `pruneMirror` runs per cell. The old flat
  shape reads as `{}`, which is harmless because it is session-only.
- **New in `CompareTab`:**
  - `selected`: the cell the detail shows.
  - `checked`: a set of cell keys.
  - `sdryPick`: the wedi Membrane derived cell's no-fit answer, `"wedi"`
    (default) or `"nearest"`. It is offered inline in the detail with the
    popup prompt's wording, only when that cell is selected and has no fit.
- **Engine-facing change:** `wediBuildFor` gains `sdryBase: "nearest"`,
  routed through `sdryNearest` exactly as the popup's prompt does. Neither
  engine's own kit logic changes.
- **Sending:** the new signature is
  `compareOptionsPatch(project, hostAreaId, { options: [{ lines, name }], label })`.
  - It keeps inserting fresh sibling areas right after the host area, tags
    them A–D in the order given (reading order, checked cells only, packed),
    and fills empty option-name slots with each cell's name
    ("wedi · Membrane (S-DRY)").
  - It returns one patch, or `null` if any option is empty.
  - The only caller (`App.jsx`) moves in the same change.
- **Cost and boot:** up to four builds (two wedi solves, two Schluter
  `buildKit`s), only while the Compare tab is open. `comparegrid.js` lives in
  the compare chunk only, and ADR 0034 decision 1's import rule extends to it.

## 4. Testing, proof, records

- **`src/comparegrid.test.js`:**
  - `cellBuild` for all four keys over fixture rooms: a 60×38 curbed center
    drain, a curbless linear room, and a room no S-DRY base fits.
  - Live-cell passthrough.
  - Same-brand pass-through of added lines, and other-brand mirroring.
  - `cellFlags`: one case per chip, plus ordering and the "+N more" count.
- **`src/options.test.js`:** the N-option `compareOptionsPatch` for 2, 3 and
  4 options: A–D order, name slots filled only when empty, `null` on an empty
  option, and today's N=2 wedi/Schluter output pinned.
- **`comparekit`:** `wediBuildFor(…, { wallSys: "membrane", sdryBase: "nearest" })`.
- **Goldens:**
  - A new `src/comparegridgolden.test.js` pins all four totals and the flag
    ids for the fixture rooms.
  - These stay green and untouched: `wallsysgolden.test.js`,
    `wedimarkergolden.test.js`, `addedgolden.test.js`.
- **Checks:** `npm test`, `npm run lint`, and a build with the dummy env
  vars. The boot chunk must contain no `comparekit`, `comparegrid`, `KERDI` or
  `Fundo`.
- **Preview proof** (`.scratch/158_shower-config-roadmap/p3/shoot-grid.mjs`,
  ending "all checks passed"):
  - the grid from a wedi host and from a Schluter host;
  - a flagged cell and the chip jumping to its line;
  - the S-DRY no-fit cell and its detail prompt;
  - a per-cell mirror pick;
  - the confirm modal with three options checked.

  Re-run `p1a`–`p2`, and restore any PNG with no real change.
- **Records:**
  - **ADR 0034 amendment:** decision 3 becomes "host cell live, three
    derived"; decision 4 becomes N options A–D in reading order. The "Open"
    item about sending with no feedback stays open.
  - **ADR 0051 note:** grid cells take "wedi pan + S-DRY walls, flagged".
  - **Also:** `src/CLAUDE.md` entries (`comparegrid.js`, `CompareTab.jsx`,
    `options.js`), the ticket's Phase 3 status, and the next handoff.

## Out of scope

- Switching the popup to the other brand from a cell.
- Feedback after sending (ADR 0034 "Open").
- Customizing a derived cell beyond mirror picks and the S-DRY no-fit answer.
- The carry-forward list in the Phase 3 handoff (the `extensionSf` over-count,
  S-DRY curb drawing dimensions, the drain height kit, stacked extensions).

## Amendments during planning and build

_(none yet)_
