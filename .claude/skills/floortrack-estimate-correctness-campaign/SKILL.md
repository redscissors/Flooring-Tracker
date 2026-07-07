---
name: floortrack-estimate-correctness-campaign
description: The standing, decision-gated campaign plan for FloorTrack's two interlocking hardest problems - estimate correctness (the numbers on a printed quote must never be wrong) and src/App.jsx decomposition (~2,100 untested lines holding all UI, all Supabase write paths, the normalizers, and the totals assembly). Load this when starting or resuming any work described as "refactor App.jsx", "split up App.jsx", "add tests for the totals / estimate / summary", "make the estimate math safe", "characterization tests", "extract the print layout / modals / data layer", or when a session proposes moving code out of App.jsx for any reason. It defines the phase order, per-phase gates, golden worked examples, and the fenced-off wrong paths. Not for one-off bug hunts (floortrack-debugging-playbook), general evidence standards (floortrack-validation-and-qa), or measurement scripts (floortrack-diagnostics-and-tooling).
---

# FloorTrack estimate correctness campaign

A campaign, not a task: a sequence of small, independently-merged PRs that (A) put the
estimate's numbers under automated proof and (B) shrink `src/App.jsx` until every piece of
logic that can be wrong lives in a small, tested module. The two goals interlock — the
correctness harness (A) is what makes the refactor (B) safe to attempt, and the refactor is
what makes correctness testable at all. **Success is measured (test counts, line counts,
golden diffs), never judged by eye.**

Definitions used throughout:

| Term | Meaning here |
|---|---|
| **Characterization test** | A test that pins down what the code does TODAY, right or wrong, written BEFORE moving the code. It detects accidental behavior change; it does not assert the behavior is correct. |
| **Golden test** | A characterization test whose expected values were hand-computed from the domain formulas (arithmetic shown), so it proves correctness, not just stability. |
| **Extraction** | Moving code out of `src/App.jsx` into an importable module or component file with zero behavior change. |
| **Gate** | A condition that must hold before the phase's PR may be opened. Failing a gate means stop, fix, or revert — never "note it and continue". |

## 1. Mission and non-negotiable frame

- Every phase lands as its **own small PR** through the rules in **floortrack-change-control**:
  PR-only (never push to `main` — `main` auto-deploys to the live site), tests + build green,
  and **preview proof** that the UI is pixel-identical for any PR that touches rendered output
  (screen, estimate print, order-sheet print).
- **Refactor PRs change zero behavior.** If during extraction you find a real bug or an
  improvement, do NOT fold it in: file an issue under `.scratch/`, finish the extraction that
  preserves the odd behavior, and fix the bug in a separate PR with its own evidence.
- Phases are ordered by what makes the next phase safe. Do not reorder: Phase 1 (pure-logic
  extraction + goldens) comes before Phase 2 (component decomposition) because the goldens are
  the tripwire that catches a decomposition mistake.
- Any step marked **candidate** is not yet decided. Adopting it requires `/decide` (an ADR),
  not enthusiasm.

## 2. Phase 0 — Baseline gate (run first, every session)

Record the baseline before touching anything. All commands run from the repo root and work in
both PowerShell and Git Bash unless marked.

```
npm test
```
Expected (verified 2026-07-06): final summary lines report `tests 77`, `pass 77`, `fail 0`
(53 in `src/catalog.test.js`, 8 in `src/pricebook.test.js`, 16 in `src/stock.test.js`;
`npm test` runs `node --test src/*.test.js`, so new `src/*.test.js` files are picked up
automatically).

```
npm run build
```
Expected (verified 2026-07-06): ends with `✓ built in ~2.5s` after emitting
`dist/index.html` (~0.76 kB), one CSS asset (~27.5 kB), a lazy `xlsx` chunk (~429 kB), and the
main JS chunk (~518 kB). A yellow "Some chunks are larger than 500 kB" warning is **normal and
not a failure** — do not chase it as part of this campaign.

Line count of the file under siege:

```
wc -l src/App.jsx                  # Git Bash → 2108 src/App.jsx (as of 2026-07-06)
(Get-Content src/App.jsx).Count    # PowerShell → 2108
```
Do NOT use PowerShell's `Measure-Object -Line` for this — it skips blank lines and reports
2037, which will corrupt your metrics table.

**Gate:** if tests are not green before you start → STOP. Fix the tests or report the
breakage; you have no baseline, so any extraction result is uninterpretable.

## 3. Phase 1 — Characterization harness (the correctness payoff)

`src/catalog.js` (409 lines), `src/pricebook.js`, and `src/stock.js` are already pure and
tested. The following logic is equally pure but **trapped inside `src/App.jsx`**, where no
test can import it. Extract it, in this order, one PR each.

Line numbers below are as of 2026-07-06 (App.jsx @ 2,108 lines, commit `ab51a12`). They WILL
drift — re-anchor before executing with:
`grep -n "const normP\|function printProduct\|function printMatList\|const exportCSV\|let totalSqft" src/App.jsx`

### Target 1 — Normalizers and row factories → `src/model.js` (or similar)

- **What moves:** `newProduct`/`newArea`/`newCustomer` (App.jsx 257–259), `normP`/`normA`/
  `normC` (264–266) including the load-bearing comment above them (261–263: thickness/joint
  use `||` not `??` because artifact-era rows hold `""`/`0`), `normProfile` (281), `lightRow`
  (271–277) + `LIST_SELECT` (270), `vMeta` (280), and the constants they need (`TYPES`,
  `uid`).
- **What stays:** everything touching React state or Supabase.
- **Why first:** smallest move, biggest bug-class payoff. The legacy-grout bug (rows migrated
  from the artifact showed "—" and vanished from the summary, fixed in commit `33982cf`) was
  a normalizer bug. It was found by a human eye on a real quote. A test file would have
  caught it.
- **Proof obligation (write these tests BEFORE moving the code):**
  - `normP({})` fills every field of a fresh row (compare against `newProduct()` shape minus id).
  - Legacy row `{ thickness: "", grout: { checked: true, joint: 0 } }` → thickness `"0.375"`,
    joint `0.125` (the 33982cf class).
  - Legacy field migration: `{ size: "5in plank" }` → `sizeText`; `{ brand: "Shaw",
    color: "Oak" }` → `brandColor: "Shaw / Oak"`.
  - `qtyType: "anything-else"` coerces to `"sqft"`; unknown `type` coerces to `"tile"`.
  - `normA({})` yields one normalized product; `normC({})` yields empty categories/versions/
    attachments arrays.

### Target 2 — Totals and print-data assembly → `src/estimate.js` (or similar)

The single most correctness-critical extraction. Two clumps:

- **What moves (a): the per-product print/line assembly** — `money`/`sf1` (App.jsx 197–198),
  `wasteNote` (201–203), `miscQty` (204–207), `printProduct` (212–236), `printAreaFloor`
  (239), `PRINT_KINDS`/`KSHORT`/`u1` (240–242), `printMatList` (246–253), plus the constants
  they read: `JOINTS` (19), `THICK` (20), `TLBL` (10), `underlayLabel` (13–14). These are
  already pure functions of `(product|customer, settings)` — the move is mechanical.
- **What moves (b): the on-screen totals assembly** — the inline aggregation loop in the
  component body (App.jsx 941–948: `totalSqft, orderedSqft, flooringPrice, groutCost,
  mortarCost, underlayCost, miscCost`, the `gAgg/mAgg/uAgg/cAgg` maps, `gList/mList/uList/
  cList`, `hasMat`, `grandTotal`). Wrap it as a pure function, e.g.
  `summarizeCustomer(customer, settings) → { totalSqft, orderedSqft, flooringPrice, groutCost,
  mortarCost, underlayCost, miscCost, grandTotal, gList, mList, uList, cList, hasMat }`, and
  have App.jsx destructure the result. Zero logic edits — copy the loop body verbatim.
- **What stays:** all JSX that renders these numbers (screen Order summary 1428–1473, print
  block 1480–1638) — that is Phase 2 material.
- **Proof obligation:** all 77 existing tests green, plus a golden full-estimate test with
  hand-computed numbers. Use this one (every number below verified by executing
  `src/catalog.js` directly on 2026-07-06):

  **Golden case "12×24 bathroom":** settings = tile waste 10%, PermaColor Select
  {coverage 110, unit bags, price $18}, ProLite {tier1 90, tier2 63, tier3 45, unit bags,
  price $25}. One tile product: 12"×24"×3/8", 1/8" joint, 120 sqft, $4.50/sqft, grout +
  mortar checked, no carton, no underlayment.

  ```
  REF      = ((12+12)/(12×12)) × 0.375 × 0.125 = (24/144) × 0.046875 = 0.0078125
  vol      = ((12+24)/(12×24)) × 0.375 × 0.125 = (36/288) × 0.046875 = 0.005859375
  coverage = 110 × (0.0078125 / 0.005859375) = 110 × 4/3 = 146.666…  sf/bag
  grout    exact = 120 × 1.10 / 146.666… = 132 / 146.666… = 0.90 → order ceil(0.9) = 1 bag → $18.00
  mortar   max(12,24) = 24 > 15 → tier3 = 45 sf/bag; exact = 132/45 = 2.9333… → 3 bags → $75.00
  line     = 120 sf × $4.50 = $540.00      (totalSqft 120, orderedSqft 120)
  grand    = 540 + 18 + 75 = $633.00
  ```

  Carton variant (same row with `cartonSf: "22"`): exact = 132/22 = 6 → order 6 CT;
  line = 6 × 22 × $4.50 = **$594.00**. (This also pins the float-noise guard in
  `getCarton`, src/catalog.js 107–109.)

  Also pin at least: one `pending` case (grout checked but thickness missing after
  normalization is bypassed → summary row with `pending: true` and no order), one misc line
  (`miscCost = priceSqft × miscQty`), and one two-line same-grout case that captures the
  **known asymmetry**: `groutCost` sums per-line `order × price` (line 942) while the summary
  list quantity is `ceil` of the aggregated exact (line 943) — e.g. two lines of 0.5 bags each
  show "1 bags" in the summary but cost 2 × price. `printMatList`'s comment (243–245) records
  the print-side counterpart deliberately. **Characterize it exactly as-is.**

### Target 3 — CSV export rows → same module or `src/export.js`

- **What moves:** the row-building inside `exportCSV` (App.jsx 888–893): the header array and
  the per-product row mapping, as a pure `csvRows(customer, settings) → string[][]`. The
  `Blob`/download plumbing (`dl`, 887) stays in App.jsx.
- **Proof obligation:** one characterization test feeding the golden customer through and
  asserting the header and the tile row's cells (grout exact `"0.90"`, order `1`, line `540`).

### Phase 1 gates (every extraction PR)

- New characterization tests committed and passing **against the code in its old location
  first** (write test → import from App region is impossible, so: copy the function into the
  new module, point the test at it, then delete the App.jsx copy and import — the test never
  changes in between).
- After the move: `npm test` green with a **strictly higher** test count; `npm run build`
  green; goldens byte-identical before/after.
- **If a golden differs after extraction → you changed behavior.** Diff the math, fix or
  revert the move. Do NOT update the golden to match the new output.
- Preview proof that one real customer's screen totals, estimate print, and order-sheet print
  render identically (see floortrack-run-and-operate for how to drive the preview).

## 4. Phase 2 — Decomposition menu, ranked by risk (lowest first)

Only start after Phase 1 Targets 1–2 are merged — the goldens are your tripwire. Each item is
one PR. Estimates are from measured region sizes in the 2,108-line file; treat as ±20%.

| # | Extract | Region (2026-07-06) | Est. lines out | Risk | Obligation before the PR |
|---|---|---|---|---|---|
| a | Print components: `<EstimatePrint>` + `<OrderSheetPrint>`, props-only | print block 1480–1638 (order sheet 1481–1522, estimate 1523–1637) | ~160 | Low — presentational, fed by Phase 1's `summarizeCustomer` + `printMatList` | Print-preview screenshots of BOTH layouts, before vs after, same customer |
| b | Already-separate in-file components to own files: `Modal` (1761–1773), `TeamTodos` (1775–1877), `CatalogSettings` (1879–2108) | bottom of file | ~350 | Low — they are already props-only; this is a file move | Tests + build green; open Settings and Issues modals in preview |
| c | Modal bodies wired to App state: Settings body (1641–1667), profile (1677–1686), import preview (1688–~1748) | modal region 1640–1756 | ~100 | Medium — prop threading (`settings`, `setSettings`, `stock`, `importPreview` state) | List the props each body needs BEFORE moving; no new state |
| d | Sidebar / customer list | `<aside>` 1003–1060 + list prep 950–986 | ~90 | Medium — touches `search`, `sortBy`, `allOpen`, `selId`, `sidebarOpen` | Same listing/search/sort behavior in preview (recent list, age buckets, A–Z) |
| e | **LAST, highest risk:** data layer — every Supabase write path into one hook/module (e.g. `useFloorTrackData`) | ~40 `supabase.from/storage/auth` call sites; functions `loadSharedSettings` 475, `applyImport` 522, `migrateLegacyCustomers` 542, `setSettings` 605, `saveProfile` 610, `updateCust` 621, `addCustomer` 628, `delCustomer` 636, versions 767–800, todos 843–880, backup 894–939 | net ~150–250 (moved, not deleted) | High — optimistic-update ordering, `dataRef`/`baselineRef` closures, auto-version-on-deselect | A **written inventory** of every call site and every piece of state each one reads/writes, committed to the PR description, BEFORE moving anything |

Count the call sites yourself when you get there (verified 40 on 2026-07-06):
`grep -c "supabase\.\(from\|storage\|auth\)" src/App.jsx` (Git Bash) or
`(Select-String -Path src/App.jsx -Pattern "supabase\.(from|storage|auth)" -AllMatches).Matches.Count` (PowerShell).

**Every Phase 2 item:** gate = tests ≥ previous count and green, build green, preview proof
(screen + both print modes for anything near rendering), and the write-path conventions in
CLAUDE.md intact (`updateCust` stays the single customer-content write path — moving it is
fine, forking it is not). **Rollback = revert the PR.** Nothing else in the campaign depends
on any single Phase 2 item landing, by design.

Realistic end-state: 2,108 − (~95 Phase 1) − (~850 Phase 2 a–e) ≈ **App.jsx under 1,300
lines**, holding only component wiring, state, and layout. Do not chase a smaller number by
extracting things that aren't logic — a 1,200-line file of pure JSX wiring is acceptable; an
untested 40-line totals loop is not.

## 5. Fenced-off wrong paths (do not do these)

| Wrong path | Why it is fenced off |
|---|---|
| Adding a router, state manager, or component-test framework (React Testing Library, Vitest, Playwright…) | Dependency/architecture changes are ADR-level decisions (see floortrack-change-control), not campaign steps. The campaign is designed to need only `node --test`, which is already there. Propose via `/decide` if you believe otherwise. |
| TypeScript conversion mid-campaign | Doubles the diff of every extraction, destroys the "goldens identical" signal, and is its own ADR. |
| Touching `migrateLegacyCustomers` (App.jsx 542–562) or anything in `supabase/*.sql` | Live-data migration paths; owner-run only. Never contact the live Supabase project (owner non-negotiable). |
| UI pixel changes inside refactor PRs | The gate is "pixel-identical preview proof". A refactor PR that also 'improves' spacing is unreviewable and unrevertable in parts. |
| One giant PR | Each phase item must be independently revertable. A 900-line PR that fails one golden reverts everything. |
| "Fixing" odd-looking math during extraction | Characterize first. The exact-vs-order display, per-line-cost vs aggregate-ceil asymmetry (App.jsx 942–945), manual-override semantics (`manual`/`cartonManual` bypass ceil), and the carton float-noise round (catalog.js 107–109) are business rules or deliberate quirks — see flooring-domain-reference. If one is a genuine bug, file an issue in `.scratch/` and fix it in a separate PR with its own worked example. |
| Updating a golden to make a red extraction pass | The golden is the instrument. If it disagrees with the code after a move, the move is wrong. |

## 6. Validation and promotion protocol

Per-PR checklist (paste into the PR body):

- [ ] `npm test` green; test count ≥ previous (state both numbers)
- [ ] `npm run build` green
- [ ] Preview proof attached (screen; estimate print + order-sheet print if anything near rendering moved)
- [ ] `src/App.jsx` line-count delta reported (before → after, via `wc -l` / `(Get-Content src/App.jsx).Count`)
- [ ] No behavior change intended; goldens unchanged (or: this is a behavior PR with its own worked example)
- [ ] Write-path conventions intact (CLAUDE.md "Conventions" section)

Campaign metrics table — keep a copy updated in each campaign PR description (baseline row is
real, verified):

| Date | App.jsx lines | Tests passing | Modules extracted |
|---|---|---|---|
| 2026-07-06 | 2,108 | 77 | catalog / pricebook / stock (pre-campaign) |
| … | … | … | … |

**Definition of done for the campaign:**

1. Normalizers (`normP`/`normA`/`normC`) and the totals assembly are importable modules
   covered by golden tests, including the $633.00 case above.
2. `src/App.jsx` is under ~1,300 lines (justified in §4; revise only with a stated
   re-measurement, not ambition).
3. Every Supabase write path lives in one module/hook with a written call-site inventory.
4. Test count strictly above 77, all green, and no gate was ever waived.

## 7. Correctness beyond refactoring — solution menu (ranked; ALL are candidates until an ADR accepts them)

1. **Property-based invariant tests** (candidate; cheapest, no new deps — plain `node --test`
   loops over generated inputs): for random valid tile rows assert `order >= exact`,
   `order === Math.ceil(exact)` when no manual override, exact is monotonically nondecreasing
   in `qty` and in waste %, `grandTotal === flooringPrice + groutCost + mortarCost +
   underlayCost + miscCost`, and carton `order × sf ≥ sqft × (1 + waste)` up to the
   documented 1e-6 rounding guard.
2. **Print-vs-screen consistency test** (candidate; needs Phase 1 Target 2): assert
   `printMatList` totals reconcile with `summarizeCustomer`'s `grandTotal` for the golden
   customer — the two code paths that produce the number a customer sees and the number they
   are quoted must never drift apart.
3. **CI via GitHub Actions** (candidate — the repo has **no CI today**: no `.github/`
   directory; `main` deploys on push). A workflow running `npm test` + `npm run build` on PRs
   would turn every gate above from discipline into enforcement. Needs owner sign-off and
   change control; do not add workflow files without it.

## 8. When NOT to use this skill

- **A specific number is wrong on a real quote right now** → floortrack-debugging-playbook
  (symptom-to-cause triage), then a separate bug-fix PR. This campaign is not a bug hunt.
- **"What evidence does this change need?"** in general → floortrack-validation-and-qa. This
  skill only defines the campaign's own gates.
- **Measuring scripts and tooling** (line counters, dead-code sweeps, dependency graphs) →
  floortrack-diagnostics-and-tooling.
- **What the domain terms and formulas mean** → flooring-domain-reference.
- **Whether a change may merge at all / needs an ADR** → floortrack-change-control and
  `/decide`.

## Provenance and maintenance

All volatile facts verified against the working tree on **2026-07-06**, branch
`claude/compact-product-fields`, App.jsx-touching commit `ab51a12`. Re-verify before
executing a phase:

| Fact | Source | Re-verify with |
|---|---|---|
| 77 tests / 0 fail (53+8+16) | `npm test` run 2026-07-06 | `npm test` (last 8 lines carry the counts) |
| Build green, ~518 kB main chunk + size warning | `npm run build` run 2026-07-06 | `npm run build` |
| App.jsx = 2,108 lines | `wc -l src/App.jsx` | `wc -l src/App.jsx` or `(Get-Content src/App.jsx).Count` — NOT `Measure-Object -Line` |
| All App.jsx line anchors (normP 264, printProduct 212, totals loop 941–948, print block 1480–1638, updateCust 621, migrateLegacyCustomers 542, Modal/TeamTodos/CatalogSettings 1761/1775/1879…) | direct read 2026-07-06 | `grep -n "const normP\|function printProduct\|let totalSqft\|const updateCust\|function TeamTodos\|function CatalogSettings" src/App.jsx` |
| 40 Supabase call sites in App.jsx | grep 2026-07-06 | `grep -c "supabase\.\(from\|storage\|auth\)" src/App.jsx` |
| Golden numbers ($633.00 / $594.00, grout 0.9→1, mortar 2.9333→3) | computed by hand from the formulas AND executed against `src/catalog.js` (`getGrout`/`getMortar`/`getCarton`) 2026-07-06 | rerun a scratch script importing `src/catalog.js` with the §3 inputs |
| `npm test` = `node --test src/*.test.js` | `package.json` scripts | `grep -A5 '"scripts"' package.json` |
| No CI exists | absence of `.github/` 2026-07-06 | `ls .github` (expect not found) |
| Legacy-grout bug fixed in `33982cf` | git history | `git show --stat 33982cf` |
