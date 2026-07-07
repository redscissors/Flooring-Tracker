---
name: floortrack-diagnostics-and-tooling
description: The measurement toolbox for FloorTrack — how to get a NUMBER instead of an eyeball for any claim about this repo. Covers running/filtering the node:test suite, using npm run build as a syntax/import linter for the untested App.jsx, the shipped estimate-check.mjs CLI that recomputes grout/mortar/carton quantities with the app's real src/catalog.js math, the shipped shape-check.mjs linter for backup JSON, App.jsx decomposition metrics (line count, test count, Supabase touch-point count), and runtime diagnostics (browser devtools Network/console against Supabase, the preview harness). Load this when asked "run the tests", "run just one test", "how many tests are there", "did the build break", "check this estimate number by hand", "recompute what the app would order", "is this backup JSON valid", "how big is App.jsx now", "how many Supabase write sites are there", or when any change needs before/after evidence. Not for diagnosing WHICH failure you have (floortrack-debugging-playbook), what evidence a merge requires (floortrack-validation-and-qa), or the math theory (flooring-domain-reference).
---

# FloorTrack diagnostics and tooling

Measure, don't eyeball. Every command below was executed on this repo on
2026-07-06 (Node v24.17.0, Windows 11); outputs shown are real. Commands are
copy-pasteable from the repo root in both PowerShell and bash unless marked.

Jargon used once: **node:test** = Node's built-in test runner (`node --test`,
no npm package). **Vite** = the build tool (`npm run build` → `dist/`).
**esbuild / Rollup** = the two engines inside Vite that surface build errors.

## 1. Test tooling anatomy

`npm test` runs `node --test src/*.test.js` (see `package.json`). Only the
three pure modules have tests; **`src/App.jsx` has zero tests** — see section 3
for what covers it instead.

| Command | What it runs |
|---|---|
| `npm test` | all three test files — 77 tests as of 2026-07-06 |
| `node --test src/catalog.test.js` | one file (53 tests: material math + catalog) |
| `node --test src/pricebook.test.js` | one file (8 tests: xlsx → stock items) |
| `node --test src/stock.test.js` | one file (16 tests: search/SKU fill/drift/diff) |
| `node --test --test-name-pattern="carton" src/catalog.test.js` | only tests whose NAME matches the pattern |

The summary block at the end is the scoreboard:

```
ℹ tests 77
ℹ pass 77
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
```

Read it as: `tests` = how many ran, `pass`/`fail` = the verdict. A red run
prints `✖` lines above the summary with the assertion diff. Exit code is
non-zero on any failure, so `npm test` works as a gate in scripts.

`--test-name-pattern` notes (verified on Node v24.17.0):
- The pattern is a JS regex matched against test names, **case-sensitive**
  (`"carton"` matched 4 tests; `"grout"` matched 5 in catalog.test.js).
- Non-matching tests are simply not run — the summary counts only matches
  (`tests 4 / pass 4`), they do not show as skipped.
- Quote the pattern; both shells accept `--test-name-pattern="carton"`.

Tail just the summary (shell-specific):

```powershell
npm test 2>&1 | Select-Object -Last 8        # PowerShell
```
```bash
npm test 2>&1 | tail -8                      # bash
```

## 2. The build as a diagnostic

Nothing tests `App.jsx`, but `npm run build` **parses and bundles it**, so it
catches syntax errors, bad JSX, and broken/missing imports that `npm test`
cannot see. Run it after any App.jsx edit, before claiming the change works.

A passing build ends like this (chunk-size warning about the 518 kB index
chunk is normal for this app, not a failure):

```
dist/assets/index-BqFyPoig.js   518.48 kB │ gzip: 143.70 kB
(!) Some chunks are larger than 500 kB after minification. ...
✓ built in 2.52s
```

Two failure shapes you will actually see (both reproduced and captured):

**Syntax error** — reported by esbuild, with file:line:col and a code frame.
Read the `file:` line first; the caret points at the token esbuild choked on
(often one line AFTER the real mistake, e.g. an unclosed brace above):

```
error during build:
[vite:esbuild] Transform failed with 1 error:
.../src/main.jsx:2:7: ERROR: Expected ":" but found "default"
1  |  const broken = { a: 1,
2  |  export default broken;
   |         ^
```

**Unresolved import** — reported by Rollup, no code frame, just the two paths.
The fix is almost always a typo'd path or a file that was renamed/deleted:

```
error during build:
Could not resolve "./missing.js" from ".../src/main.jsx"
```

`npm run build` writes `dist/` locally; that is fine and gitignored. It never
contacts Supabase — env values are only inlined as strings.

## 3. Estimate cross-check: `scripts/estimate-check.mjs`

Ships with this skill. It imports the **real** functions from `src/catalog.js`
(`mergeSettings`, `groutExact`/`getGrout`, `mortarExact`/`getMortar`,
`cartonExact`/`getCarton`, `wasteFor`) — never a re-implementation — so its
output is exactly what the app computes for the same inputs. Use it to verify
a quote number, reproduce a reported wrong quantity, or produce before/after
evidence for a math change. Dependency-free; run from the repo root.

```
node .claude/skills/floortrack-diagnostics-and-tooling/scripts/estimate-check.mjs --help
```

**Example 1 — tile with grout and mortar** (12×24" tile, 3/8" thick, 1/8"
joint, 120 sqft, default 10% tile waste, default coverages):

```
node .claude/skills/floortrack-diagnostics-and-tooling/scripts/estimate-check.mjs --sqft 120 --L 12 --W 24 --grout "PermaColor Select" --mortar ProLite --grout-price 25.50 --mortar-price 42
```
Real output:
```
inputs   type=tile sqft=120 L=12 W=24 thickness=0.375 joint=0.125 waste=x1.1
grout    PermaColor Select: exact=0.9 order=1 bags @ $25.5 = $25.5
mortar   ProLite: exact=2.9333 order=3 bags @ $42 = $126 (tier by longest side 24")
carton   n/a (no --carton-sf; sold by exact sqft)
```
Hand check: grout coverage scales to 110 × (REF/vol) = 146.67 sqft/bag, so
132 waste-loaded sqft ÷ 146.67 = 0.9 → 1 bag. Mortar: longest side 24" > 15"
→ tier3 (45 sqft/bag), 132 ÷ 45 = 2.9333 → 3 bags. Matches.

**Example 2 — carton-sold flooring** (200 sqft vinyl at 22 sqft/carton,
$3.49/sqft — this is the float-noise case: 200 × 1.1 = 220.00000000000003,
naive `ceil` would order 11 cartons; the app orders 10):

```
node .claude/skills/floortrack-diagnostics-and-tooling/scripts/estimate-check.mjs --sqft 200 --type vinyl --carton-sf 22 --price-sqft 3.49
```
Real output:
```
inputs   type=vinyl sqft=200 L=- W=- thickness=0.375 joint=0.125 waste=x1.1
grout    n/a (not tile)
mortar   n/a (not tile)
carton   exact=10 order=10 ct x 22 sqft
line     10 ct x 22 sqft x $3.49/sqft = $767.8
```

Flags: `--waste` / `--waste-tile` / `--waste-floor` (percent), `--joint`,
`--thickness`, `--grout-coverage` (lets you test a custom grout name),
`--mortar-tiers t1,t2,t3`, `--carton-unit CT|SH`. Grout/mortar compute only
for `--type tile`, same as the app.

Limits: it covers grout/mortar/carton and the plain sqft line total. It does
not cover underlayment (`getUnderlay`/`getUnderlayInstall`) or manual
overrides — extend it there if a case needs it, importing from `src/catalog.js`
the same way.

## 4. Data-shape lint: `scripts/shape-check.mjs`

Checks a backup JSON (the `{ customers, settings, attachments }` file the
Settings modal exports) or a single pasted customer object saved to a file:

```
node .claude/skills/floortrack-diagnostics-and-tooling/scripts/shape-check.mjs <path-to-json>
```

Real output against a deliberately flawed sample:

```
settings ok: waste tile=10% floor=8% | catalog: 9 companies, 5 grouts, 3 mortars, 7 underlayments
customers: 1

2 warning(s):
  - customer "Test Customer" / area "Kitchen": unknown product type "lvp" (normP would coerce to "tile")
  - customer "Test Customer" / area "Kitchen": grout checked but sqft/L/W/thickness incomplete — shows no quantity unless grout.manual is set
```

Exit codes: 0 clean, 2 warnings, 1 usage/parse error.

**What it can and cannot reuse.** Settings go through the app's real
`normalizeSettings` (imported from `src/catalog.js`). Customers do NOT: the
customer normalizers `normC`/`normA`/`normP` are unexported module-level
consts inside `src/App.jsx` (lines 264–266 as of 2026-07-06), and Node cannot
import that file at all — verified:

```
node -e "import('./src/App.jsx').then(()=>console.log('ok'),e=>console.log(e.message))"
→ Unknown file extension ".jsx" for ...\src\App.jsx
```

So the customer checks are a read-only mirror of what normP would do, not the
real thing. Extracting the normalizers into a pure importable module is a
known gap the floortrack-estimate-correctness-campaign skill proposes fixing;
until then, keep shape-check.mjs's mirror in sync with App.jsx when normP
changes.

## 5. Measuring the App.jsx decomposition

Metrics for the "shrink App.jsx" effort (see
floortrack-estimate-correctness-campaign). Baselines as of 2026-07-06:

Baselines: App.jsx **2,108** lines, **77** tests, **40** Supabase touch points.
The canonical library figure is **`wc -l` / `(Get-Content src/App.jsx).Count` =
2,108**, owned by floortrack-estimate-correctness-campaign's Phase 0 baseline —
defer to it. The node one-liner below reports **2109** because `split('\n')`
counts the empty segment after the file's trailing newline as one extra line;
it's the same file, not a disagreement. Use the one-liner when you want a
dependency-free count in a script, but quote 2,108 as the baseline.
Commands (each works in PowerShell and bash):

```
# App.jsx line count (reports 2109 — trailing-newline segment; see note above)
node -e "const fs=require('fs');console.log(fs.readFileSync('src/App.jsx','utf8').split('\n').length)"

# total test count: the summary "tests" line (tail it per section 1)
npm test

# Supabase touch points in App.jsx (.from( calls + storage calls)
git grep -c -E "supabase\.(from\(|storage)" -- src/App.jsx
```

Progress = App.jsx lines down, tests up, touch points constant-or-down (a new
touch point means a new write path — those need change-control review). Table
breakdown of the 40 (via `git grep -n "supabase\.from(" -- src/App.jsx`):
customers 9, versions 8, todos 6, app_data 3, shared_settings 3,
stock_items 2, plus 9 `supabase.storage` calls.

List the sanctioned write-path functions (CLAUDE.md's "keep these write
paths") with their current line numbers:

```
git grep -n -E "const (updateCust|addCustomer|delCustomer|insertVersion|delVersion|loadVersion|setSettings|addTodo|updateTodo|delTodo|reorderTodos|clearDoneTodos|applyImport) = " -- src/App.jsx
```

(Returned 13 definitions, lines 522–875, as of 2026-07-06.) Any
`supabase.from(...).insert/update/delete/upsert` OUTSIDE those functions (and
the backup/migration/load helpers around them) is an ad-hoc write — flag it.

## 6. Runtime diagnostics (running app)

The pure modules are testable; everything else is observed at runtime.
**Observation only — never mutate live Supabase data while diagnosing.**

**Browser devtools (any browser, F12):**
- Console: React render errors and the app's failure toasts ("Save failed —
  export a backup") correspond to a rejected Supabase call — the real error
  is in the Network tab.
- Network tab: filter by `supabase` to isolate API traffic. Data calls hit
  `/rest/v1/<table>` (`customers`, `versions`, `shared_settings`,
  `stock_items`, `todos`, `app_data`) — a save is a `PATCH`/`POST` there;
  file uploads hit `/storage/v1/...` for the `attachments` bucket.
- Status codes: **401** = not signed in / expired session (re-auth); **403** =
  signed in but RLS (row-level security policy) denies the operation; **404 on
  a table** = that table doesn't exist — its `supabase/*.sql` file was never
  run on this Supabase project (e.g. 404 on `stock_items` → `stock.sql` not
  run; owner runs SQL by hand, never you). A "connect Supabase" setup screen
  instead of the app = missing `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`
  in `.env` (`src/lib/supabase.js` renders it deliberately).

**Claude Code sessions:** don't screenshot blind — `.claude/launch.json`
defines `dev` (port 5173, autoPort) and `preview` (4173) configs for the
preview harness, which then gives you console logs, the network request list
with response bodies, DOM snapshots/inspection, and screenshots against the
locally running app. Note the app is behind the sign-in wall; without
credentials you can still verify the shell renders and watch for console/
network errors. UI-change proof requirements live in
floortrack-validation-and-qa.

## 7. When NOT to use this skill

| You actually want | Go to |
|---|---|
| Symptom → likely cause triage ("grout shows a dash", "import says items missing") | floortrack-debugging-playbook |
| Why the math is shaped this way; what grout/thinset/CT/SH mean | flooring-domain-reference |
| Deeper proof work / property-style analysis of the math | floortrack-proof-and-analysis-toolkit |
| What evidence a change needs before merge (screenshots, worked examples) | floortrack-validation-and-qa |
| Whether a change is allowed at all / needs a PR or ADR | floortrack-change-control |
| The decomposition campaign itself (goals, sequencing) | floortrack-estimate-correctness-campaign |

## Provenance and maintenance

All facts verified against this repo on **2026-07-06**, Node v24.17.0,
branch `claude/compact-product-fields`. Re-verify with:

| Fact | Source | Re-check command |
|---|---|---|
| `npm test` = `node --test src/*.test.js` | package.json `scripts` | `node -e "console.log(require('./package.json').scripts.test)"` |
| 77 tests (53/8/16 per file) | observed run | `npm test` — read the summary tail (section 1) |
| `--test-name-pattern` behavior | observed on v24.17.0 | `node --test --test-name-pattern="carton" src/catalog.test.js` |
| Build passes; error formats | observed `npm run build` + scratch repro | `npm run build` |
| estimate-check outputs | ran both examples above | re-run the two commands in section 3 |
| App.jsx = 2,108 lines (`wc -l`; the node one-liner reports 2109 — trailing-newline segment) | observed | `wc -l src/App.jsx` / `(Get-Content src/App.jsx).Count`; campaign Phase 0 owns the baseline |
| 40 Supabase touch points; write-path fn lines 522–875 | observed | greps in section 5 |
| normC/normA/normP at App.jsx 264–266, unexported | read App.jsx | `git grep -n "const normP" -- src/App.jsx` |
| App.jsx not Node-importable | observed error | one-liner in section 4 |
| launch.json dev/preview ports | .claude/launch.json | read that file |
| Table/bucket names | CLAUDE.md + supabase/*.sql | `git grep -n "create table" -- supabase` |

If a re-check disagrees with this file, trust the repo and update the number
here (and the baselines table) in the same PR.
