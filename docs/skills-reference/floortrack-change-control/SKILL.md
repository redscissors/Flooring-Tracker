---
name: floortrack-change-control
description: How changes to FloorTrack are classified, gated, and reviewed — the non-negotiable rules (never touch live Supabase, PR-only merges, preview proof for UI) with the reasoning behind each, a change-classification table, sanctioned write paths, decision/ADR gating, and the pre-PR checklist. Load this before making ANY change to the repo, when deciding whether a change needs a PR / preview screenshot / ADR / SQL handoff, when asked "can I push this", "is this safe to merge", "do I need a migration", or when planning work that touches data-model fields, supabase/*.sql, or dependencies. Not for debugging or reading code (see floortrack-debugging-playbook) or for what counts as test evidence (see floortrack-validation-and-qa).
---

# FloorTrack change control

Rules for changing this repo safely. Read the stakes first — every gate below
exists because of them.

## Why the stakes are unusual

- **`main` IS production.** Netlify auto-builds and publishes **every push to
  `main`** (`netlify.toml` build config; PROJECT_STATUS.md: "Hosting | Netlify —
  auto-deploys `main` on every push"). The live site
  (https://flooringkeeper.netlify.app) is the tool a real sales team quotes
  real customers from, daily.
- **There is no CI gate.** No `.github/` directory, no workflows, no test
  runner between a push and the live site. Discipline — the rules in this
  file — is the only gate.
- **Estimate correctness is the top live risk.** Quote numbers a customer sees
  must never be wrong. `src/App.jsx` (~2,100 lines as of 2026-07-06) holds all
  UI **and** all Supabase write paths and has **zero automated tests**; only
  the pure-logic modules (`src/catalog.js`, `src/pricebook.js`, `src/stock.js`)
  are tested (`npm test` → `node --test src/*.test.js`, 77 passing as of
  2026-07-06).

## The three non-negotiables

Owner-confirmed, 2026-07-06. These are absolute. Never advise routing around
them; if a task seems to require breaking one, stop and surface it.

| # | Rule | Why |
|---|---|---|
| 1 | **Never touch the live Supabase project.** No SQL against it, no data or storage mutations, no dashboard actions on the agent's initiative. | The database holds the team's real customers and estimates. There is one shared project (`mzftplcyfotlzolqeapl`, see PROJECT_STATUS.md) — no staging copy. The owner runs SQL files by hand in the dashboard SQL editor; agents only *write* the `.sql` files (see the classification table). |
| 2 | **Never push straight to `main`. Everything via PR.** | `main` auto-deploys (netlify.toml + PROJECT_STATUS.md). A direct push is a deploy. The PR is the only review point that exists — there is no CI to catch anything after. |
| 3 | **No UI change merges without preview proof.** A visual/print change must be shown working (preview screenshot or equivalent observed run) before merge. | App.jsx has no tests; "it compiles" proves nothing about layout, print output, or interactions. House precedent: the print-layout redesign was done by rendering throwaway prototype variants behind `?pv=` and having the owner pick the blend before it was built in — see `.scratch/handoffs/prototype-print-layouts-2026-07-03.md`. Showing before merging is how UI work is done here. |

## Change classification and gates

Classify every change before starting. A change spanning classes takes the
union of the gates.

| Class | Examples | Gate before PR merge |
|---|---|---|
| **Docs-only** | `docs/`, `README.md`, `CLAUDE.md`, `.scratch/` tickets, skills | PR only. Follow `floortrack-docs-and-writing` for style. No build/test needed unless code snippets are asserted as working. |
| **Pure logic** | `src/catalog.js`, `src/pricebook.js`, `src/stock.js` | PR + **extend the tests** (`src/catalog.test.js`, `src/pricebook.test.js`, `src/stock.test.js`) to cover the change; `npm test` all green. These modules are the tested core of estimate math — a logic change without a test is not done. |
| **UI** | `src/App.jsx`, `src/Auth.jsx`, `src/Root.jsx`, `src/index.css` | PR + **preview proof** (non-negotiable #3): run `npm run dev`, exercise the change, capture a screenshot. Print changes: prove the print layout specifically. Reuse existing Tailwind/`--ft-*` classes — don't invent colors (CLAUDE.md). |
| **Data-model field** (new/changed field on Customer/Area/Product/Settings/catalog) | adding a field to a product row; a new settings knob | PR + **MUST extend the normalizers so old records stay valid**: `normP`/`normA`/`normC` in `src/App.jsx` (lines 264–266 as of 2026-07-06) and `mergeSettings`/`normalizeCatalog` in `src/catalog.js`. This is a stated CLAUDE.md convention. Records saved last month must load and calculate identically after your change. Plus the pure-logic gate if math changes, plus UI gate if visible. |
| **New/changed SQL** (`supabase/*.sql`) | new table, RLS change, one-time migration | PR ships the `.sql` file **plus run instructions** (where it fits in the run order; one-time vs re-runnable). **Never execute it** — the owner runs it by hand in the Supabase dashboard (non-negotiable #1). Precedent: `supabase/migrate-shared-only.sql` shipped as a file for pre-ADR-0004 installs to run once. Code that depends on the SQL must degrade sanely (or the PR must say plainly "broken until SQL runs"). |
| **Dependency change** | adding/upgrading an npm package | PR + `npm run build` proof + a stated reason in the PR body. The stack is deliberately small (React, Vite, Tailwind, lucide-react, Supabase client, lazy-loaded `xlsx`); every addition is bundle weight the sales team downloads and a surface agents must not break. Prefer no new dependency. |

## Write-path discipline

All Supabase mutations go through the sanctioned functions in `src/App.jsx`
(verified present as of 2026-07-06). **No ad-hoc `supabase.from(...)` writes**
— add to or extend these paths instead (CLAUDE.md Conventions):

| Domain | Functions (App.jsx) |
|---|---|
| Customers | `updateCust(id, patch)` (optimistic setData + single-row UPDATE), `addCustomer`, `delCustomer` |
| Versions | `insertVersion`, `delVersion`, `loadVersion` (own table, never the blob) |
| Settings | `setSettings` |
| Profile | `saveProfile` (whole-blob upsert of the per-user `app_data` row) — note CLAUDE.md's Conventions list omits this one; it is still a sanctioned path |
| To-dos | `addTodo`, `updateTodo`, `delTodo`, `reorderTodos`, `clearDoneTodos` |
| Stock | import flow only: `importPriceBook` → preview → `applyImport` (upserts + `active=false` marks — **no deletes**) |

Why: these paths carry the invariants — optimistic UI + last-write-wins
(accepted deliberately, ADR 0002), hide-never-delete (ADR 0002/0003), and
snapshot-don't-live-link (ADR 0003: SKU fill copies values onto the row;
nothing reads `stock_items` at calc time). A stray write path silently breaks
one of these and corrupts real estimates.

## Decision gating (ADRs)

- A decision that is **hard to reverse, surprising, or trade-off-bearing** gets
  an ADR under `docs/adr/` (indexed in `docs/adr/README.md`). Record it the
  moment it lands using the existing `/decide` skill; use `/design-review` for
  a full pre-implementation grilling.
- **Conflicts must be surfaced, not silently overridden** (CLAUDE.md): before
  contradicting a recorded ADR, the glossary (`docs/CONTEXT.md`), or the
  charter, say so out loud and get a ruling.
- Decisions are revisited via **new ADRs, not silent edits**: ADR 0001 (archive
  as an ungated column) was built, then superseded ~2 weeks later by ADR 0004
  (archive and visibility removed entirely). 0001 still exists, marked
  "Superseded by 0004" in the index. Follow that pattern — supersede, don't
  rewrite history.
- Note: CLAUDE.md references `docs/project-charter.md` and `docs/agents/*.md`;
  as of 2026-07-06 those files **do not exist in the repo**. Don't cite them;
  the ADRs + `docs/CONTEXT.md` + CLAUDE.md are the decision record that exists.

## Pre-PR checklist

Run from the repo root. Every box, every PR:

- [ ] `npm test` — all pass, zero fail (77 passing as of 2026-07-06). If you
      touched `catalog.js`/`pricebook.js`/`stock.js`, the count went **up**.
- [ ] `npm run build` — completes clean (this is exactly what Netlify runs).
- [ ] UI change? Preview proof captured (screenshot from `npm run dev`, print
      preview for print changes) and attached/linked in the PR.
- [ ] Data-model field? `normP`/`normA`/`normC` and/or
      `mergeSettings`/`normalizeCatalog` extended; an old-shaped record still
      normalizes (add a test in the pure-logic modules where possible).
- [ ] New `supabase/*.sql`? File + run instructions in the PR; **not executed**.
- [ ] Docs updated where behavior changed (`CLAUDE.md` data model/conventions,
      `docs/<area>/`, ADR if a real decision landed) — style per
      `floortrack-docs-and-writing`.
- [ ] Closing an issue? Update its ticket's `Status:` field to `done` in
      `.scratch/NNN_<slug>/` before committing (CLAUDE.md rule).
- [ ] Branch is not `main`; merge happens via PR.

## Commit and PR conventions (observed in `git log`)

- **Imperative subject lines**: "Add shared team Issues/to-do list", "Fix grout
  showing '—' and missing from summary on legacy rows".
- **Conventional prefixes appear in earlier history and are fine but not
  required**: `feat(stock): …`, `feat(versions): …`, `docs(issues): …`,
  `chore: …`. Recent commits use plain imperative subjects.
- **Reference the issue/ADR in the subject or body when one applies**:
  e.g. "feat(stock): stock price book — SKU fill by snapshot… (issue 004,
  ADR 0003)".
- Merges happen as GitHub PR merges ("Merge pull request #NN from
  redscissors/<branch>"); working branches are typically `claude/<slug>` or a
  short topic name.

## When NOT to use this skill

- **Reading, exploring, or debugging** without changing anything — use
  `floortrack-debugging-playbook`. Change control only bites when you write.
- **Deciding what counts as evidence** that a change works (test design, what
  to screenshot, how to prove math) — `floortrack-validation-and-qa`.
- **Understanding the architecture or data model** you're about to change —
  `floortrack-architecture-contract` (and CLAUDE.md).
- **Recording a decision** — this skill tells you *when* an ADR is required;
  the `/decide` skill does the recording.
- **Build/env problems** (`npm install`, Vite, ports) —
  `floortrack-build-and-env`.

## Provenance and maintenance

Volatile facts and how to re-verify each (run from repo root; commands work in
PowerShell and bash unless noted):

| Fact | Source | Re-verify |
|---|---|---|
| main auto-deploys via Netlify | `netlify.toml`, PROJECT_STATUS.md | `git grep -n "auto-deploys" PROJECT_STATUS.md` |
| No CI | no `.github/` in repo | `git ls-files .github` (empty = still true) |
| 77 tests passing (2026-07-06) | `npm test` run | `npm test 2>&1 \| tail -5` (bash) / `npm test 2>&1 \| Select-Object -Last 5` (PowerShell) |
| Test scope = 3 pure modules | `package.json` `"test"` script | `git grep -n "\"test\"" package.json; ls src/*.test.js` |
| Sanctioned write-path function names | `src/App.jsx` | `git grep -nE "const (updateCust|addCustomer|delCustomer|insertVersion|delVersion|loadVersion|setSettings|addTodo|updateTodo|delTodo|reorderTodos|clearDoneTodos|importPriceBook|applyImport) " src/App.jsx` |
| normP/normA/normC at App.jsx 264–266; App.jsx ~2,100 lines | `src/App.jsx` | `git grep -n "const normP" src/App.jsx` |
| mergeSettings / normalizeCatalog | `src/catalog.js` | `git grep -nE "mergeSettings|normalizeCatalog" src/catalog.js` |
| ADR 0001 superseded by 0004 | `docs/adr/README.md` | `git grep -n "Superseded" docs/adr/README.md` |
| Print-prototype precedent | `.scratch/handoffs/prototype-print-layouts-2026-07-03.md` | `ls .scratch/handoffs/` |
| SQL files + hand-run policy | `supabase/*.sql`, CLAUDE.md source layout ("run once") | `ls supabase/` |
| Commit conventions | git history | `git log --oneline -25` |
| Missing charter/agents docs | CLAUDE.md references vs repo contents | `git ls-files docs/project-charter.md docs/agents` (empty = still missing) |
| Three non-negotiables | owner interview, 2026-07-06 — **not stated in any repo doc**; re-confirm with the owner before relaxing any of them | — |
