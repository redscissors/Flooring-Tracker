# Handoff — ticket 158 Phase 2 (Board vs Membrane): build it (2026-09-28)

Start here in a new session. The design and the plan are done and committed
on branch `claude/shower-config-phase-1d-eafhd0`. What's left is executing the
plan, then the PR.

## Read first

1. **The plan:** `docs/superpowers/plans/2026-09-28-board-vs-membrane.md`.
   - It has 8 tasks. Every code step carries the full code or diff.
   - Every diff was prototyped off `864c51f` and re-applied in order on a
     fresh checkout; the suite was green after every task (1814 tests at the
     end).
   - It lists 18 prototype rulings that Task 8 records.
2. **The spec:** `docs/superpowers/specs/2026-09-28-board-vs-membrane-design.md`.
   Its **Sourced rates** section gives every S-DRY / PRO-SET number and its
   wedi source (owner-supplied TDS screenshots). Don't change a rate without
   a new wedi source.
3. **The ticket:** `.scratch/158_shower-config-roadmap/ticket.md` (Phase 2).
4. **Records:** ADR 0049 (choices, not parts; amended 1b–1d) and ADR 0034
   (Compare).

## How to run it

- **Skill:** subagent-driven-development (vendored in `.claude/skills/`). The
  ledger goes in `.superpowers/sdd/2026-09-28-board-vs-membrane/progress.md`.
- **Models:**
  - Opus for Tasks 2, 3 and 5 (bill math, the engine, the stateful popup) and
    for every review, including the final whole-branch review;
  - Sonnet for Tasks 1, 4, 6, 7 and 8.
- **Task 1 first, on unchanged code.** It captures the golden
  (`src/wallsysgolden.js`) and the before screenshots. Both must come from
  today's code.
- **Branch:** `claude/shower-config-phase-1d-eafhd0`. It holds the spec and
  plan commits; PR #444 (Phase 1d) is merged.
  - Push with `git push -u origin claude/shower-config-phase-1d-eafhd0`.
  - Never push to `main`. Never touch the live Supabase project.
- **Preview proof:**
  - `npx vite --port 5199` (background).
  - Playwright through
    `createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core")`
    with `executablePath: "/opt/pw-browsers/chromium"`.
  - Print shots need `emulateMedia({ media: "print" })`.
  - Build check:
    `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build`.
- **Owner rule (CLAUDE.md):** ask via AskUserQuestion when a skill's gate or a
  real design fork comes up. Don't silently pick a side. The plan's rulings
  are prototype calls; the owner sees them in the PR's "Needs your call".

## Done means

- All 8 tasks committed, with a review per task and a final whole-branch
  review; findings fixed or recorded as spec amendments.
- The checks pass:
  - `npm test` → `# fail 0`;
  - lint clean;
  - the build succeeds;
  - both p2 proof scripts print "all checks passed";
  - the 1a–1d scripts still pass, with their PNGs restored.
- A PR from `claude/shower-config-phase-1d-eafhd0` into `main`, in the 1d
  PR's shape (What it does / Old saved kits / Needs your call / Verification /
  Preview proof, with before and after images at the head commit's raw URLs).
  Subscribe to its activity.
- **Not merged** until the owner says so.
