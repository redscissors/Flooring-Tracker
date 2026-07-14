---
name: floortrack-validation-and-qa
description: What counts as evidence that a FloorTrack change works — the proof required per change type (tests for logic, hand-computed worked examples for math, preview screenshots for UI, both print layouts for print, old-record normalization proof for data-model fields), the repo's node:test conventions, the golden-case test inventory, a copy-pasteable test skeleton, the manual QA checklist for risky releases, and the acceptance thresholds (no red tests, test count never decreases, build passes). Load this when writing or reviewing tests, when asked "how do I prove this works", "is this tested enough", "what should I screenshot", "add a test for X", or before declaring any change done. Not for deciding which gates apply to a change class (see floortrack-change-control) or for measurement scripts and tooling (see floortrack-diagnostics-and-tooling).
---

# FloorTrack validation and QA

How to prove a change works in this repo. The stakes: `main` auto-deploys to
the live site a real sales team quotes customers from, and there is **no CI**
— the evidence you attach to a PR is the only gate. "Looks right" is not
evidence anywhere in this file.

Jargon used once: a **golden case** is an existing test whose expected number
encodes a business rule (change the number, you changed the business).
**Normalizers** are the functions that make old stored records valid on load
(`mergeSettings`/`normalizeCatalog`/`normWaste` in `src/catalog.js`;
`normP`/`normA`/`normC` in `src/App.jsx`, lines 264–266 as of 2026-07-06).

## The evidence bar by change type

`floortrack-change-control` says which gates apply to a change; this table
says what the proof itself must look like. Attach it to the PR.

| Change type | Required evidence |
|---|---|
| **Pure logic** (`src/catalog.js`, `src/pricebook.js`, `src/stock.js`) | New or updated tests that *demonstrate the behavior* (a test that would fail without your change), plus `npm test` fully green. Quote the pass/fail summary in the PR. |
| **Math** (anything feeding an order quantity or dollar total) | Everything above **plus a hand-computed worked example with the numbers shown** — inputs, intermediate values, expected output, and the matching assertion. Never "the numbers look right". See the worked example below. |
| **UI** (App.jsx, Auth.jsx, Root.jsx, index.css) | Preview screenshot(s) of the affected state from `npm run dev`, captured after the change, showing the thing working. One screenshot per distinct affected state (empty state, populated state, error state — whichever your change touches). |
| **Print** | Screenshots of **both** print layouts — the estimate (default print, also Ctrl+P) **and** the Order sheet (`printMode === "order"`, the "Order sheet" button). A print change that only shows one layout is unproven; they render from separate branches in App.jsx (~line 1481). |
| **Data-model field** (new/changed field on Customer/Area/Product/Settings/catalog) | A normalization test proving an **OLD-shaped record still loads and calculates** — build a record *without* your field (or with the legacy spelling) and assert the normalizer fills it. This is the lesson of the legacy-grout "—" bug — an unfilled default silently dropped a checked material from real jobs (full story: floortrack-failure-archaeology entry 4). |

Caveat on the data-model row: normalization that lives in `src/catalog.js`
(`mergeSettings`, `normalizeCatalog`, `normWaste`) is directly testable — do
that. `normP`/`normA`/`normC` live in `src/App.jsx`, which has zero automated
coverage, so a field defaulted there can only be proven manually today
(load a real old customer in preview and show the row calculating). Prefer
putting normalization logic in `catalog.js` where it can be tested; the
sanctioned long-term fix for App.jsx is extraction — see
`floortrack-estimate-correctness-campaign`.

### Worked example (the math-change standard)

A math change PR must show its arithmetic like this, not just assert a value
(the volumetric derivation behind these numbers is in flooring-domain-reference
§3):

> 12×24 tile, 3/8" thick, 1/8" joint, 300 sq ft, 10% tile waste,
> PermaColor Select (base coverage 110):
>
> ```
> coverage = 110 × REF/vol = 110 × 4/3 = 146.667 sq ft/bag
> exact = 300 × 1.10 / 146.667 = 2.25 bags
> order = ceil(2.25) = 3 bags
> ```
>
> Test asserts `getGrout(p, s).order === 3` and `exact === 2.25`.

The un-rounded exact value is part of the product (it displays next to the
order quantity), so assert both.

## Test conventions of this repo

Verified against the three test files, 2026-07-06 (`src/catalog.test.js`
538 lines / 53 tests, `src/pricebook.test.js` 192 lines / 8 tests,
`src/stock.test.js` 201 lines / 16 tests — 77 total).

- **Runner:** Node's built-in test runner, no framework dependency.
  `npm test` runs `node --test src/*.test.js` — any new `src/*.test.js` file
  is picked up automatically by that glob.
- **Imports:** every file opens with
  ```js
  import { test } from "node:test";
  import assert from "node:assert/strict";
  ```
  Always `assert/strict` — `assert.equal` is `===`, `assert.deepEqual` is
  strict deep equality.
- **Test names are descriptive sentences** stating the rule, not the function.
  Real examples:
  - `"getCarton: an exact carton count doesn't over-order from float noise"`
  - `"a disabled product still resolves by name so an existing job keeps calculating"`
  - `"stockDrift compares sheet-priced items against the same derived $/sqft the snapshot filled"`
- **Builder helpers with overrides** sit at the top of each file or section: a
  small arrow function returning a canonical fixture, spread-overridable —
  `tile(over)` (a fully-checked 200 sq ft 12×12×3/8 tile selection),
  `un(over)` (underlayment-checked selection), `hb(over)` (HardieBacker
  install), `item(over)` in stock.test.js (a normalized stock row). New tests
  reuse these; new fixture shapes get their own builder.
- **Pricebook tests fake workbook sheets as plain row arrays** — no real
  .xlsx files, no SheetJS in tests. The fixture is
  `const sheet = (name, rows) => ({ name, rows })` where `rows` is an array
  of row arrays exactly as they'd come out of the parsed workbook, including
  the mess: title rows, blank cells, sidebar "Index" columns, `"DISC"`
  markers, stale duplicate PRICE rows. `parsePriceBook(sheets)` takes that
  directly. When adding a pricebook case, transcribe the real workbook rows
  that broke, mess and all.
- **Assertion style:** exact numbers written as the arithmetic that produces
  them (`assert.equal(cartonExact(p, s), 200 * 1.1 / 23.5)`), so the formula
  is readable in the test. `assert.match` for text containment,
  `assert.doesNotThrow` for degrade-gracefully cases, inline comments only
  where the expected value would otherwise look arbitrary.
- **Section banners** group slices: `// --- Cartons: flooring sold by the carton/sheet ---`.
- No mocks, no setup/teardown, no network, no Supabase — everything under
  test is a pure function.

## Golden-case inventory

These existing tests encode the business rules that make quotes correct. They
are the project's golden set (all names verbatim from the test files,
2026-07-06):

| Rule | Golden cases |
|---|---|
| Grout/mortar math baseline | `groutExact/mortarExact from the catalog match the flat-settings result` |
| Hidden/missing products never break old jobs | `resolve-by-name finds a product regardless of enabled state (hidden product still calculates)`; `a disabled product still resolves by name so an existing job keeps calculating`; `a selection naming a product with no catalog entry degrades gracefully (no crash)` |
| Waste split (tile vs floor rate) | `wasteFor picks tile rate for tile, floor rate for every other type`; `carton/underlay math applies the family-specific waste rate`; `normWaste migrates a legacy single wastePct onto both families`; `serializeSettings persists the waste split, not the legacy scalar` |
| Whole-carton ordering | `cartonExact: waste-adjusted square footage over the carton's coverage`; `getCarton: an exact carton count doesn't over-order from float noise`; `getCarton: a manual total overrides the calculation, same as grout/mortar`; `getCarton never applies to misc lines, count rows, or rows without a carton size` |
| Underlayment + install materials | `underlayExact scales off square footage with the waste factor (no tile volumetrics)`; `getUnderlayInstall scales off sq ft; a mortar row resolves unit and price from the mortar catalog` |
| Old records normalize forward | `mergeSettings is idempotent — re-running on its own output is a no-op`; `backfill merges new starters into a catalog that already has Ditra, without duplicating it`; `a deleted seed underlayment is tombstoned and does not resurrect on normalize`; `a stored pre-link install item (no kind) normalizes to a custom row with its fields intact` |
| SKU snapshot (ADR 0003) | `a tile stock item snapshots type, size, thickness and $/sqft onto the row`; `a mosaic sold by the sheet (only a sheet price) still fills as tile, deriving $/sqft` |
| Price drift | `stockDrift flags a snapshot whose price the book has since changed`; `stockDrift compares sheet-priced items against the same derived $/sqft the snapshot filled` |
| Import diff (hide, never delete) | `diffStock: added / changed / missing / unchanged, and re-activation counts as a change`; `duplicate SKUs collapse to one item, preferring the priced one, warning on conflicts` |
| Catalog price sync | `syncCatalogPrices updates on a unique price, skips ambiguous name matches` |

**The golden rule:** goldens may **gain** cases freely. Changing an existing
golden's *expected number or expected behavior* means the business rule
changed — the PR must explain WHY in plain terms (what the shop now does
differently), and a rule change of that kind almost certainly warrants an ADR
(`/decide`). A test edit that exists only to make a red test green is a bug
in the change, not the test.

**Known golden gap** (candidate to add, 2026-07-06): the mortar tier
boundaries — `longest < 8` → tier1, `8–15` → tier2, `> 15` → tier3
(`src/catalog.js` line 60) — have no dedicated boundary test at 8" and 15".
If you touch `mortarExact`, add one.

## What is testable vs what is not

| Code | Coverage | What to do |
|---|---|---|
| `src/catalog.js` (all material math, settings/catalog normalize) | Tested — 53 cases | Extend `src/catalog.test.js` |
| `src/pricebook.js` (workbook parse) | Tested — 8 cases | Extend `src/pricebook.test.js` with real-row fixtures |
| `src/stock.js` (search, SKU fill, drift, diff, price sync) | Tested — 16 cases | Extend `src/stock.test.js` |
| `src/App.jsx` (2,108 lines: ALL UI, ALL Supabase write paths, `normP`/`normA`/`normC`, totals assembly) | **ZERO automated coverage** | The sanctioned fix is **extraction** — move pure logic out to a testable module (see `floortrack-estimate-correctness-campaign`). Do **NOT** bolt on a component-testing framework (Vitest + Testing Library, Playwright, etc.) ad hoc — adding a test framework is a dependency + process decision that goes through `floortrack-change-control` and probably an ADR. Until then, App.jsx behavior is proven by preview screenshots and the manual QA checklist below. |

## How to add a test

House-style skeleton — copy into the matching `src/*.test.js` (or a new
`src/<module>.test.js`, which the glob auto-runs):

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { getGrout, normalizeSettings } from "./catalog.js";

// Builder with overrides — reuse the file's existing one if present.
const tile = (over = {}) => ({
  type: "tile", qtyType: "sqft", qty: "300", L: "12", W: "24", thickness: "0.375",
  grout: { checked: true, product: "PermaColor Select", color: "", joint: 0.125, manual: "" },
  mortar: { checked: true, product: "ProLite", manual: "" },
  ...over,
});

test("a 12×24 tile at 10% waste orders 3 bags of PermaColor Select for 300 sq ft", () => {
  const s = normalizeSettings(undefined); // seeded defaults: 10% waste, coverage 110
  const G = getGrout(tile(), s);
  assert.equal(G.exact, 300 * 1.1 / (110 * 4 / 3)); // = 2.25 bags exact
  assert.equal(G.order, 3);                          // ceil, whole bags
});
```

Run just that file while iterating, then the full suite before the PR
(both commands work in PowerShell and bash, from repo root):

```
node --test src/catalog.test.js
npm test
```

Name the test as the business sentence it proves. Assert the `exact` value as
visible arithmetic and the `order` as the rounded integer. For a
normalization test, build the OLD shape literally (strip or mis-spell the
field the way a real stored record would have it) and assert the normalizer's
output — see `backfill: a stored catalog without the install field gains the
seed defaults once` in catalog.test.js for the pattern.

## Manual QA checklist for a risky release — OWNER-RUN

For changes near the write paths, totals, print, or import — anything where
"the tests pass" doesn't cover the blast radius. **This checklist is OWNER-run**
(matching run-and-operate's runbook convention): it signs in and writes real
rows, and there is no staging — `npm run dev` talks to the same live Supabase
project as production. An agent may execute it **only on the owner's explicit
per-run instruction**, and the owner must be told up front that step 2 creates
a **test customer visible to the whole sales team in shared live data, which
must be deleted afterward**. The boundary is absolute: never mutate Supabase on
your own initiative and never touch it directly outside the app (owner
non-negotiable). Run against `npm run dev` (port 5173) on the PR branch.

| # | Step | Pass looks like |
|---|---|---|
| 1 | Sign in | App loads, sidebar shows customer buckets |
| 2 | Create a customer | Appears in sidebar immediately (optimistic), survives a reload |
| 3 | Add an Area, then a tile Selection with grout and mortar checked | Row renders; grout/mortar product dropdowns populated |
| 4 | Enter L/W/thickness/joint/sq ft and a price | Line total and order summary appear; **exact value shows next to the rounded order** (e.g. "2.25 → 3 bags") |
| 5 | Pick a SKU with carton coverage (U/M CT or SH) | Order is a whole-carton count; total = cartons × SF/CT × $/sqft |
| 6 | Print (Ctrl+P or Print button) | Estimate layout renders: selections, materials, totals, salesperson block |
| 7 | Order sheet button | Order-sheet layout renders (distinct from estimate) |
| 8 | Open Settings | Modal opens; waste, catalog, price-book sections present |
| 9 | Start a price-book import, reach the diff preview, then **Cancel** | Preview shows added/changed/missing counts; cancel writes nothing (re-open shows same state) |
| 10 | Backup export (bottom of Settings) | JSON file downloads |

Record the run in the PR as the numbered list with pass/fail per step plus
screenshots for any step your change touched.

## Acceptance thresholds

Hard lines, all of them, every merge:

- **No merge with red tests.** `npm test` shows `fail 0`.
- **Test count must not decrease.** 77 as of 2026-07-06. Logic changes push
  it up; a shrinking count means behavior lost its proof — justify or fix.
- **Build must pass.** `npm run build` clean — it's exactly what Netlify runs
  on merge, and there is no CI to catch it after.
- **UI merges without preview proof are blocked** by standing owner rule (see
  `floortrack-change-control`, non-negotiable #3). Print changes need both
  layouts shown.

## When NOT to use this skill

- **Deciding which gates apply to a change class** (does this need a PR /
  ADR / SQL handoff / dependency justification) —
  `floortrack-change-control`. This skill owns what the proof looks like,
  not which proofs are required.
- **Measuring, profiling, or writing analysis scripts** —
  `floortrack-diagnostics-and-tooling`.
- **Diagnosing a failure** you haven't fixed yet —
  `floortrack-debugging-playbook`.
- **The App.jsx extraction program itself** (what to extract, in what order)
  — `floortrack-estimate-correctness-campaign`.
- **Understanding the math you're testing** — `flooring-domain-reference`
  and the Material math section of `CLAUDE.md`.

## Provenance and maintenance

Volatile facts, sources, and one-line re-verification (from repo root; bash
shown, PowerShell equivalent noted where different):

| Fact | Source | Re-verify |
|---|---|---|
| 77 tests, all passing (2026-07-06) | `npm test` run | `npm test 2>&1 \| tail -5` (PS: `npm test 2>&1 \| Select-Object -Last 5`) |
| Per-file counts 53/8/16; line counts 538/192/201 | `node --test` per file; `wc -l` | `node --test src/catalog.test.js 2>&1 \| tail -8` etc. |
| Test glob auto-runs new files | `package.json` `"test": "node --test src/*.test.js"` | `git grep -n "node --test" package.json` |
| App.jsx = 2,108 lines, zero tests | `wc -l src/App.jsx`; no App test file exists | `ls src/*.test.js` |
| normP/normA/normC at App.jsx 264–266 | `src/App.jsx` | `git grep -n "const normA" src/App.jsx` |
| Legacy-grout bug narrative | commit 33982cf message ("Fix grout showing '—' and missing from summary on legacy rows") | `git show --stat 33982cf` |
| Mortar tier boundaries `<8`/`≤15`/`>15`, no boundary test | `src/catalog.js` line 60; absence checked in catalog.test.js | `git grep -n "tier1 : longest" src/catalog.js` |
| Grout worked example (REF, coverage 110, waste 10) | `src/catalog.js` `REF`/`groutExact`, `DEFAULTS.grouts` | `git grep -n "export const REF" src/catalog.js` |
| Print: estimate default + Order sheet via `printMode "order"` | `src/App.jsx` ~lines 314, 1106, 1481 | `git grep -n "printMode" src/App.jsx` |
| Golden test names verbatim | the three `src/*.test.js` files | `git grep -n "over-order from float noise" src` |
| No CI; main auto-deploys | no `.github/`; `netlify.toml` | `git ls-files .github` (empty = still true) |
| UI-preview-proof rule; never touch live Supabase | owner-confirmed standing rules, 2026-07-06 — not stated in any repo doc; re-confirm with the owner before relaxing | — |
