---
name: floortrack-research-frontier
description: The open research frontier for FloorTrack — candidate capabilities that would push the app past off-the-shelf small-shop tooling (AI note-scan to draft estimate, conflict detection beyond last-write-wins, property-based testing of the estimate math, price-book import resilience, CI as a merge gate), each with why the naive approach fails, the repo asset that makes it tractable, the first three concrete in-repo steps, and a falsifiable result milestone. Load this when someone asks "what should we build next", "can we add the AI scan-notes feature", "should we detect edit conflicts / add optimistic locking", "are the math tests enough", "can we make the price-book import survive a reorganized workbook", "should we set up CI / GitHub Actions", or any long-horizon roadmap/what-if discussion. NOT for executing an approved change (floortrack-change-control), running today's correctness work (floortrack-estimate-correctness-campaign), or how to run an experiment properly (floortrack-research-methodology).
---

# FloorTrack research frontier

**NOTHING IN THIS FILE IS DECIDED.** Every item below is an open candidate —
researched enough to be worth writing down, not approved for code. Before any
item produces a commit:

1. Gather the evidence its "Why NOT yet" section asks for.
2. Run it through `/decide` (and `/design-review` for anything data-model or
   workflow shaped) so the decision is recorded as an ADR, checked against the
   existing ADRs. Note: `CLAUDE.md` points `/decide` at `docs/project-charter.md`,
   which does not exist in the repo as of 2026-07-06 — check against
   `docs/adr/` and `docs/CONTEXT.md`, and flag the charter gap rather than
   inventing charter content.
3. Follow **floortrack-change-control** for the implementation (PR-only, no
   pushes to `main`, preview proof for UI, never touch live Supabase).
4. Check **floortrack-failure-archaeology** first — several nearby ideas
   (private customers, archive flags, id-based product links, live price
   links) were already tried or rejected; don't re-fight settled battles.

The frontier is aimed at the owner's stated north star (interview,
2026-07-06): **agent-proof reliability + domain-smart tooling + AI-native
workflow**. The owner is a flooring salesman and beginner coder; work here is
done almost entirely by Claude agents, so every candidate is judged on whether
it makes the system *safer to change by agents*, not just more featureful.

Jargon used below, once:
- **LWW** — last-write-wins: whichever save lands last silently replaces the
  other; the losing edit is gone with no error.
- **OCC** — optimistic concurrency control: save normally, but detect at save
  time that someone else wrote first, and ask instead of clobbering.
- **Eval set** — a fixed collection of real inputs with hand-labeled correct
  outputs, used to score an AI feature the same way every run.
- **Property-based testing** — instead of hand-picked examples, assert rules
  ("order is never below exact") over hundreds of randomly generated inputs.

## Frontier map

| # | Candidate | One-line pitch | Biggest unproven assumption |
|---|-----------|----------------|------------------------------|
| 1 | AI note-scan → draft estimate | Photo of handwritten measure notes becomes a draft Area/Selection tree a human reviews | Extraction can hit near-zero invented SKUs/prices on real notes |
| 2 | Beyond LWW (un-shelve OCC) | Detect save conflicts on customers instead of silently losing edits | Conflicts actually happen often enough to matter |
| 3 | Property-based math testing | Random-input invariant checks on the pure estimate math | The invariants can be stated precisely enough to automate |
| 4 | Price-book import resilience | A reorganized workbook degrades loudly, never silently wrong | Header-detection can generalize past today's nine sheets |
| 5 | CI as a merge gate | `npm test` + `npm run build` block a bad PR automatically | The gate stays readable/fixable for a beginner-coder owner |

---

## 1. AI "scan handwritten notes" → draft estimate

The one deferred feature both docs of record name: `README.md` ("Not yet
wired up") and `CLAUDE.md` ("Not yet implemented"). The original artifact
called Anthropic's API straight from the browser.

**Why the naive approach fails.** Two independent killers:
- A browser-side API key is unshippable — anyone can read it from the bundle
  and spend on it. Already documented in `README.md`, which prescribes the
  fix: key lives in a serverless function (Netlify Function or Supabase Edge
  Function), the app calls that.
- On a *quote*, a hallucinated number or invented SKU is the worst possible
  failure — strictly worse than no automation, because it looks done and
  gets handed to a customer. Free-form "extract this note" prompting produces
  exactly that failure mode.

**FloorTrack's specific asset.** The target is not free text — it is a strict,
already-normalized schema with a closed vocabulary:
- `normP` / `normA` (`src/App.jsx` lines 264–265, as of 2026-07-06) define the
  exact Product/Area shape every value must land in, including defaults.
- `stock_items` (ADR 0003, `supabase/stock.sql`) is a closed SKU vocabulary;
  `findStock` in `src/stock.js` gives exact-SKU membership and `searchStock`
  gives fuzzy candidates. An extractor can be *forbidden* from emitting any
  SKU not in the book.
- Catalog grout/mortar/underlayment names (`resolveCatalog` in
  `src/catalog.js`) are a second closed vocabulary for material picks.
- Accounts are admin-created sign-in-only (`src/Auth.jsx`), satisfying
  `CLAUDE.md`'s "restrict who can trigger it"; the same doc requires a spend
  cap.
- Snapshot doctrine (ADR 0003) already says what to do with a matched SKU:
  run the same fill as a human pick, never invent field values.

**First three steps in this repo.**
1. Define the extraction JSON schema *from* `normP`/`normA` (fields, types,
   closed enums for `type`/`qtyType`, an explicit `uncertain: true` marker per
   field) and write a pure validator module (`src/scan-schema.js` or similar)
   with `node --test` tests — rejects unknown SKUs given a SKU list, rejects
   any price not copied from the book, forces unparseable fields to
   `uncertain` rather than a guess. Pure JS, no network, testable today.
2. Collect the eval set: 20+ real handwritten measure-note photos with
   hand-labeled expected JSON (owner task — only the owner can label ground
   truth). Store them **outside the repo entirely**, or at a path first
   verified gitignored with `git check-ignore <path>`. **Not `.scratch/`** — it
   is git-tracked (`git ls-files .scratch` returns files; `.gitignore` has no
   `.scratch` entry), so putting photos there commits customer PII into the
   repo's history, the exact harm to avoid.
3. Scaffold the serverless function (key server-side, spend cap, response
   must pass the step-1 validator before the browser ever sees it) — behind
   `/decide` first, because it adds a deploy surface and a paid dependency.

**You have a result when…** on ≥20 held-out real notes, field-level accuracy
meets a bar set *before* the run (candidate: ≥90%) with **zero invented SKUs
and zero invented prices**, and every field the model was unsure of arrives
flagged `uncertain` for human review instead of guessed. Any invented
SKU/price = fail, regardless of accuracy.

**Why NOT yet.** No eval set exists — until the owner labels real notes,
every accuracy claim is vibes. Also unproven: whether real shop handwriting
is legible enough for any model, and what the per-scan cost is. Evidence that
promotes it: a labeled eval set plus one offline scoring run (no app wiring)
showing the milestone is within reach.

---

## 2. Beyond last-write-wins (un-shelving deferred OCC)

**Why the current approach eventually fails.** Everything shared saves whole
chunks with LWW — `updateCust` (`src/App.jsx` line ~621) does a bare
`update({ data }).eq("id", id)` with no freshness check. Two people editing
the same customer = the slower save silently erases the faster one. Fine at
today's team size and habits; as usage grows it becomes silent lost quotes,
the kind of failure nobody notices until a customer calls.

**FloorTrack's specific asset.** This upgrade was *designed and deliberately
shelved*, not rejected. ADR 0002 (`docs/adr/0002-shared-grout-mortar-catalog.md`,
Consequences): "Optimistic conflict detection (check-on-save, prompt to
overwrite/refresh) was designed and **deliberately deferred** as the future
upgrade if this ever bites — it is not missed, it is shelved." And the
plumbing is already there: `customers` has an `updated_at` column kept fresh
by a trigger (`supabase/schema.sql`), the app already loads it per row
(`LIST_SELECT`, `src/App.jsx` line ~270), and all writes funnel through the
single `updateCust` seam — check-on-save is one comparison at one choke point.

**First three steps in this repo.**
1. **Measure before solving.** Instrument detection-only: on save, compare
   the row's known `updated_at` against the server's current one and count
   (locally/console or a log row) how often a save would have overwritten a
   newer write. No behavior change, no prompt — just data on whether the
   problem exists.
2. Prototype check-on-save behind the `updateCust` seam (compare-then-write;
   on mismatch, don't write) on a branch — the seam means zero other call
   sites change.
3. Design the refresh/overwrite prompt UX with the house prototype method
   (`/prototype`, variants behind a query param — the same way the print
   layout was rebuilt).

**You have a result when…** a staged two-editor test (two browsers, same
customer) reliably shows a detected conflict, **and** a week of normal
single-editor use logs zero false alarms. False alarms would make the team
click through the prompt blindly, which is worse than LWW.

**Why NOT yet.** Nobody has shown a real lost update has ever happened —
ADR 0002's judgment ("edits are rare and done by few people") may still hold.
Un-shelving without evidence contradicts the recorded decision's own terms
("if this ever bites"). Evidence that promotes it: step-1 instrumentation
catching a real would-be clobber, or the team growing past the trust-a-few
size. Note **floortrack-failure-archaeology** lists optimistic locking among
previously-shelved ideas — cite the new evidence when reopening it in
`/decide`.

---

## 3. Property-based / invariant testing for estimate math

**Why example-based tests alone fail.** The math inputs combine L × W ×
thickness × joint × waste × qtyType × manual overrides × carton coverage —
the edge combinations vastly outnumber what anyone hand-writes. The 77
existing tests (passing in ~70 ms as of 2026-07-06) pin known-good examples;
they cannot say "no combination of inputs ever orders less than exact."
Quote numbers are the owner's #1 stated fear, so coverage of the *space*
matters, not just the points.

**FloorTrack's specific asset.** The math is already pure, import-free
functions in `src/catalog.js` — `groutExact`/`getGrout`,
`mortarExact`/`getMortar`, `cartonExact`/`getCarton`,
`underlayExact`/`getUnderlay`, `getUnderlayInstall`, `wasteFor` — built
exactly so `node --test` can hit them with no React, no Supabase, no mocks.
Random-input testing costs nothing but the generator.

**First three steps in this repo.**
1. Write down the invariants — and **check each against the code before
   asserting it**, because at least one naive statement is already false:
   - "order = ceil(exact), so order ≥ exact" — *almost*: `getCarton` rounds
     away float noise before ceiling (`Math.ceil(Math.round(ex * 1e6) / 1e6)`,
     `src/catalog.js` line ~109), so order can sit a hair *below* a
     float-noisy exact. State it as `order ≥ exact − 1e-6`. Also manual
     overrides set `order = exact = manual` with no ceil, by design.
   - grout `exact` is monotone increasing in thickness and joint (volume
     `vol = ((L+W)/(L×W)) × T × J` scales linearly in both).
   - `exact` for grout/mortar/carton/underlay is monotone increasing in sqft
     and in the waste percentage.
   - a non-empty `manual` (or `cartonManual`) always wins over the computed
     value.
   - mortar tier boundaries: coverage steps down (never up) as
     `max(L, W)` crosses 8 and 15.
2. Implement a tiny dependency-free harness inside a new
   `src/*.test.js` file: `node:test` + a seeded pseudo-random generator
   (e.g. mulberry32, ~4 lines) so failures replay from a printed seed. **No
   new npm packages** — adding a dependency (fast-check etc.) is a
   change-control decision, and the current stack is deliberately
   dependency-light (`package.json` has zero test deps).
3. Run each invariant against `getGrout`/`getMortar`/`getCarton` (then
   underlay) with ~1,000 seeded random inputs per invariant, printing the
   failing input + seed on any counterexample.

**You have a result when…** 1,000 random cases per invariant pass, **or** a
real counterexample is found and triaged: either it's a bug (file it under
`.scratch/`, fix via change control) or the invariant was mis-stated (fix the
invariant and record why). Both outcomes are wins; only "the harness never
ran" is a loss.

**Why NOT yet.** The invariant list above is a candidate, not verified
end-to-end — the `getCarton` float nuance shows how easily a "true" invariant
is false at the boundary, and manual-override and zero/empty-input paths
(`""` vs `0`) need the same scrutiny before 1,000 random cases produce noise
instead of signal. Evidence that promotes it: the step-1 invariant list
reviewed against the code line-by-line. This is near-zero-risk (test-only,
no app code) — the cheapest item on this page.

---

## 4. Price-book import resilience / semi-automatic sheet mapping

**Why the current approach fails.** The parser is coupled to the workbook's
exact sheet names and header vocabulary — ADR 0003's own Consequences say so.
`parsePriceBook` (`src/pricebook.js` line ~77) dispatches on literal names
(`"Mann Aduramax"`, `"Grout & Caulk"`, `"Tile Seats, Curbs, Trims"`); generic
sheets need a header row containing a cell spelled `SKU` and headers matching
the `HEADER_FIELDS` map. A renamed special sheet loses its dedicated adapter;
a reworded header silently drops that column. The shop hand-maintains this
workbook — reorganization is a *when*, not an *if*.

**FloorTrack's specific asset.** Degradation is already designed to be
visible, not silent: rows are only consumed when the SKU cell matches
`/^\d{4,8}$/`, so a mangled sheet produces *missing items*, never garbage
rows; the import diff preview (`diffStock` in `src/stock.js`:
added/changed/missing/unchanged) puts every missing SKU in front of a human
before anything is written; and imports mark-inactive, never delete. The
per-sheet adapters are isolated in `src/pricebook.js`, which deliberately
takes plain arrays-of-arrays so it tests without the xlsx dependency.

What warnings exist **today** (verified 2026-07-06 — do not overclaim):
a per-sheet "no items recognized — was its layout changed?" fires only when a
generic-table sheet yields *zero* SKUs (`src/pricebook.js` line ~148), plus
duplicate-SKU-price warnings from `dedupe`. There is **no** expected-count or
count-drop warning — a sheet that half-parses (200 of 400 SKUs) currently
warns nothing at parse time; only the diff's "missing" list reveals it.

**First three steps in this repo.**
1. Characterize the current adapters against a full fixture workbook in
   tests. `src/pricebook.test.js` already fakes sheets as
   `{ name, rows }` arrays — extend that into one fixture covering all nine
   sheet layouts, then assert exact item counts per sheet. This is the
   regression net everything else hangs on.
2. Add per-sheet parsed-count reporting to the parse result (sheet → items
   found) and warn on a large drop versus the counts currently in the stock
   table — turning "half the sheet vanished" from diff-archaeology into a
   headline warning. Test-first off the step-1 fixture.
3. Prototype a header-detection fallback: when a sheet name matches no
   adapter, scan for a plausible header row (a cell matching known
   `HEADER_FIELDS` keys + a column of SKU-shaped cells) and parse it as a
   generic table, labeling every such item as "guessed mapping" in the
   preview so a human confirms before apply.

**You have a result when…** a deliberately reshuffled copy of the real
workbook (renamed sheets, reworded headers, moved columns) imports with a
pre-set share of SKUs (candidate: ≥95%) either found or *explicitly reported
missing by sheet* — and **zero silently-wrong rows** (no item whose price or
type came from a misread column). Silent wrongness fails the run even at 100%
found.

**Why NOT yet.** Unproven that reorganization actually happens often enough
to earn the complexity — the workbook may stay stable for years, and the
diff preview may be protection enough (ADR 0003 accepted exactly that
trade-off). Header-guessing also risks the failure it's meant to prevent:
a wrong guess creates silently-wrong rows, which is worse than missing
items. Evidence that promotes it: one real re-issued workbook that degraded
in practice, or the step-1 fixture revealing the current adapters are more
brittle than believed.

---

## 5. CI as a merge gate (candidate infrastructure)

**Why the current approach fails.** There is no `.github/` directory in the
repo (verified 2026-07-06) — no workflow runs tests, ever, automatically.
`npm test` runs only when someone remembers, and `main` auto-deploys to the
live production site on every push (`netlify.toml`). The only gate between a
red test suite and production is discipline — and the workforce here is
agents, whose discipline is exactly what the north star says not to rely on.

**FloorTrack's specific asset.** The suite is ideal CI material: 77 tests,
~70 ms, plain `node --test src/*.test.js`, zero test dependencies, plus a
`vite build` that catches import/syntax breakage in `src/App.jsx` (2,108
lines, zero automated tests — the build step is its only mechanical check).
A workflow needs Node and `npm ci`; nothing else.

**First three steps in this repo.**
1. Propose via `/decide` first — this changes the *team's* workflow (PRs can
   now be blocked), so it is a recorded decision, not a drive-by YAML drop.
2. Add `.github/workflows/ci.yml` running `npm ci`, `npm test`, and
   `npm run build` on pull requests. Keep it to those three commands; every
   added step is another thing that can fail confusingly.
3. Branch protection on `main` requiring the check — an owner action in
   GitHub settings (repo `redscissors/Flooring-Tracker`), not a file in the
   repo. Until the owner flips it, CI is advisory, which is still better
   than nothing.

**You have a result when…** a deliberately broken PR (one failing test) is
visibly blocked from merging, and a green PR merges with no extra friction.

**Why NOT yet — and the honest trade-off.** The owner is a beginner coder: a
red ✗ with an opaque log is a wall, not a guardrail. If CI goes in, failure
output must stay readable (node's test reporter names the failing test; keep
the workflow to the same `npm test` the owner can run locally so "CI failed"
always reproduces on the machine). Also unresolved: most work lands via
Claude-driven PRs where the agent already runs `npm test` — the gate's
marginal value is catching the sessions that *forget*, which is real but
unmeasured. Evidence that promotes it: any merged PR found red after the
fact, or the first time a broken `main` deploys to the live site.

---

## When NOT to use this skill

| You actually want to… | Use instead |
|---|---|
| Execute today's estimate-math hardening / refactor work | **floortrack-estimate-correctness-campaign** |
| Run one of these experiments with proper discipline (hypotheses, baselines, stop rules) | **floortrack-research-methodology** |
| Turn a candidate into a recorded decision | `/decide` (then `/design-review` for big ones) |
| Classify/gate the implementation change | **floortrack-change-control** |
| Check whether an idea near these was already tried and killed | **floortrack-failure-archaeology** |
| Understand what must not break while building any of this | **floortrack-architecture-contract** |
| Know what proof a finished change needs | **floortrack-validation-and-qa** |

If a conversation drifts from "should we / what's out there" into "make the
change now," leave this skill and pick from the table.

## Provenance and maintenance

All volatile facts verified against the repo on **2026-07-06**, branch
`claude/compact-product-fields`. North-star framing and "hardest problems"
(estimate correctness, App.jsx sprawl) are from an owner interview of the
same date — no repo doc records them; re-confirm with the owner if quoting.

| Fact | Source | Re-verify with |
|---|---|---|
| 77 tests, ~70 ms, no test deps | `npm test`, `package.json` | `npm test` (last lines show counts) |
| No CI | absence of `.github/` | `ls .github` (should error) |
| App.jsx 2,108 lines, untested | line count | `wc -l src/App.jsx` (Git Bash) |
| Scan-notes deferred + serverless/spend-cap requirements | `README.md` "Not yet wired up"; `CLAUDE.md` "Not yet implemented" | `grep -n "Not yet" README.md CLAUDE.md` |
| OCC "designed and deliberately deferred" quote | `docs/adr/0002-shared-grout-mortar-catalog.md` Consequences | `grep -n "deliberately deferred" docs/adr/0002*.md` |
| `updateCust` bare update, no freshness check | `src/App.jsx` ~line 621 | `grep -n "updateCust" src/App.jsx` |
| `customers.updated_at` + trigger | `supabase/schema.sql` | `grep -n updated_at supabase/schema.sql` |
| `normP`/`normA` at App.jsx 264–265 | `src/App.jsx` | `grep -n "const normP" src/App.jsx` |
| Math function names, `getCarton` float-noise ceil | `src/catalog.js` | `grep -n "Math.ceil" src/catalog.js` |
| Parser sheet-name dispatch, SKU regex, zero-item warning only | `src/pricebook.js` lines ~24, ~77–88, ~148 | `grep -n "no items recognized" src/pricebook.js` |
| Diff categories added/changed/missing/unchanged | `diffStock`, `src/stock.js` | `grep -n "diffStock" src/stock.js` |
| Tests fake sheets as `{ name, rows }` arrays | `src/pricebook.test.js` | `head -10 src/pricebook.test.js` (Git Bash) |
| ADR parser-coupling consequence | `docs/adr/0003-stock-price-book-snapshot.md` | `grep -n "coupled" docs/adr/0003*.md` |
| Missing charter/agents docs referenced by CLAUDE.md | files absent | `ls docs/project-charter.md docs/agents` (should error) |

Line numbers drift — treat every "~line N" as a grep hint, not gospel. If a
frontier item gets decided (ADR recorded) or killed, move it out of this file:
decided items belong to their ADR + implementing skill; killed items belong in
**floortrack-failure-archaeology** with the evidence that killed them.
