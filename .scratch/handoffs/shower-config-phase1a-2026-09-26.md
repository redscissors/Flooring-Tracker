# Handoff — shower configurators, ticket 158 (2026-09-26)

Start here in a new session. The standing ledger is
`.scratch/158_shower-config-roadmap/ticket.md`. It holds the Phase 0 rows,
findings and owner answers, plus Phases 1–3.

## Where things stand

**Phase 0 is done and in PR [redscissors/Flooring-Tracker#436](https://github.com/redscissors/Flooring-Tracker/pull/436)**
(branch `claude/charming-wozniak-yrl7w1`). As of this writing the PR is green,
mergeable and has no reviews; it's waiting on the owner.

It carries:

| Item | What landed |
|---|---|
| P0-1 | Linear-tray drain side follows the SKU (KSLT `w` = channel edge) |
| P0-2 | All 524 KERDI-LINE rows classify as `g:"line"`; Browse section |
| P0-3 + P0-4 | Coverage + $/sf; tighter Browse rows in both popups; lead only when IMPORT (red) |
| P0-5 | 1 bag PRO-SET on every wedi pan kit |
| P0-6 | Keim wedi sheet drops onto the wedi stock book as a **price update** (ADR 0025 amendment) |
| fix | Point-drain grate ⇄ no longer offers or bills KERDI-LINE grates |
| fix | **Vario sized to the pan**: shortest channel ≥ pan width, cut to it (owner rule) |
| docs | Phase 1a spec + plan + the drain-swap mockup |

**Phase 1a is designed and planned, not built.**

- **Spec** (owner-approved section by section):
  `docs/superpowers/specs/2026-09-26-drain-slot-design.md`
- **Plan** (9 tasks, TDD, full code):
  `docs/superpowers/plans/2026-09-26-drain-slot.md`
- **Mockup** (owner picked layout **A**, the stepped popover):
  `.scratch/mockups/drain-swap-2026-09-26.html`

## Next step

1. **Check #436.** If it's still open, don't start 1a on top of it unless the
   owner says so. Ask whether to wait or to build 1a on the same branch.
2. **Once #436 is merged,** execute the plan:
   - Start from fresh `main`, on the new session's designated branch.
   - Use superpowers:subagent-driven-development (recommended) or
     superpowers:executing-plans, one task at a time.
   - Run `npm test` after every task.
   - The last task opens a new PR and subscribes to it.
3. **Two naming changes decided during planning.** The plan already uses them;
   Task 9 records them in the spec:
   - The Schluter choice lives in **`cfg.drainPick`**. `cfg.drain` is the drain
     TYPE.
   - The wedi linear cover choice is **`{ finish }`**, because wedi finish codes
     carry the style (`…P` = perforated, `T` = tileable). A point cover is
     `{ key }`.

## Owner decisions to honor (all 2026-09-26)

**Phase 1 overall**
- Order of work: 1a drain slot → 1b ⇄ on every line → 1c "+" per group →
  1d shared names / Compare alignment. Each sub-project gets its own
  spec → plan → PR.

**Phase 1a drain**
- Approach A: **swaps remember the choice, never the part**. Lengths re-fit
  when the room changes.
- The default drain stays Vario. Vario uses the shortest channel ≥ pan width,
  cut to the pan.
- Fixed KERDI-LINE:
  - The bill is **body + grate only**.
  - The length is the **longest length ≤ pan width** where both a body and the
    matching grate exist.
  - Floral, curve and pure top out at 48″, so they step down and the bill says
    so.
- Offset body (`KL1VO60E`) takes **only** the offset frameless grate
  (`KL1DROE`).

**Phase 0 answers**
- Thin-set: **ALL-SET white only**, the in-stock one.
- PRO-SET: a flat 1 bag.
- Keim sheet:
  - It updates the wedi **stock** book.
  - The Contractor tabs land nowhere.
  - The glass-shelf typo gets fixed **on the sheet**. No price hold was built.
- Browse lead time: shown only when it says IMPORT, in red.

## Open items / questions for the owner

- **Trendline finish names.** The finish codes `MGS`, `TSBG`, `TSC`, `TSDA`,
  `TSG`, `TSI`, `TSOB`, `TSSG` have no confirmed names. The plan labels `EB`,
  `EP` and `MBW` and shows the rest as codes. Ask for names if the popover
  should spell them out.
- **Phases 2–3 are not designed.**
  - Phase 2: Board vs Membrane on both brands. wedi's Membrane is **Subliner
    Dry or S-DRY**, and that's the owner's call. Rename "overbacker" to
    Membrane.
  - Phase 3: the 4-way compare.

## Environment gotchas (this repo, cloud sessions)

- **Build:** `npm run build` fails without the env var (the
  `%VITE_SUPABASE_URL%` placeholder). Use
  `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build`.
  `main` behaves the same way.
- **Preview proof:**
  - Run `npx vite --port 5199` as a background task.
  - Harnesses: `schluter-preview.html`, `wedi-preview.html`, and
    `import-preview.html` (`?keim`, `?somerset`).
  - Load Playwright with
    `createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core")`
    and `executablePath: "/opt/pw-browsers/chromium"`.
  - Existing `shoot.mjs` scripts live under
    `.scratch/158_shower-config-roadmap/*/`.
- **Stock only:** the preview opens with Stock only ON. Special-order rows are
  disabled until you click `[data-source-toggle]`.
- **The owner's uploaded price files are not in the repo.** These fixtures are:
  - `src/keimwedifixture.js` (the Keim sheet's Retail tabs)
  - `src/wedifixture.js` (the 2026-09-01 wedi stock export)
  - `src/schluterfixture.js`

  The VTC EFT and Schluter MSRP list were only in the old session's upload
  folder. To pin a new KERDI-LINE fixture you'd need the owner to re-upload
  them.
- **Workflow rules:**
  - Never push to `main`.
  - Never touch the live Supabase project.
  - Every UI change needs preview screenshots in the PR.
  - Brainstorming's approval gate applies in cloud sessions too.

## Bugs found and fixed along the way (so they don't come back)

- **Point-drain grate swap:** it matched on `part:"grate"` alone and would take
  KERDI-LINE grates. It now requires `g:"drain"`.
- **"Add a file…" in the price-book wizard:** it revived retired rows. Only live
  rows are layered now.
- **Price-update mode:** the ERP rounds retail **up** to the cent (`ceilCents`).
  Nearest-cent rounding reads 48 rows as changed.
