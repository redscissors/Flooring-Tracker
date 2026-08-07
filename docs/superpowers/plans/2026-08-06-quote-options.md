# Quote Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Areas can be tagged into options A/B/C over a shared base, with per-option whole-job totals on screen, E1 print bundles (itemized per-option materials), an order-entry scope picker, a single-option print switch — and area notes removed entirely.

**Architecture:** One new field on Area (`option`) plus an `optionNames` map on the project; two new pure modules — `src/options.js` (scoping/labels/colors) and `src/jobtotals.js` (the existing App.jsx totals block extracted into a callable function so it can run per scope). UI surfaces (area band, header, summary card, estimate paper, order entry, preview toolbar) all read from those two modules. No SQL, no boot changes; everything rides the customers row's `data` jsonb and version snapshots for free.

**Tech Stack:** React 18 (hooks, no new deps), `node --test` for pure logic, Vite dev server + headless Chromium for preview proof.

**Spec:** `docs/superpowers/specs/2026-08-06-quote-options-design.md` (approved 2026-08-06). Prototypes: `docs/superpowers/specs/2026-08-06-quote-options-prototypes.html`.

## Global Constraints

- Never mutate the live Supabase project; never push to `main`; work lands on branch `claude/multiple-quote-options-dnqloz` (repo non-negotiables 1–2).
- No UI/print change merges without preview proof (screenshots — Task 9).
- Option slots are fixed `"A" | "B" | "C"`; colors: A `#3E5F8A`, B `#9A5B33`, C `#6E4E7E` (light mode), soft washes via `color-mix`.
- Whole-job math is **additive on paper**: `wholeJob(slot) = grandTotal(shared areas) + grandTotal(that slot's areas alone)`. Materials consolidate *within* a bucket, never across alternates. Order entry instead consolidates over the **union** (shared + chosen slot) so the actual order (and vendor freight minimums) are exact.
- `Area.option` is `""` (shared, default) or a slot letter. `project.optionNames` is `{A?,B?,C?}` of trimmed strings.
- Area notes: `normA` **drops** `note`; the input and both print lines are removed. Old notes disappear on a job's next save — intended.
- Tests run with `npm test` (`node --test src/*.test.js`); pure modules must not import `.jsx` or `lib/supabase.js`.
- Follow existing code style: dense single-line JSX where the file does it, comments only for non-obvious rules (repo comment policy).

## File Structure

- Create: `src/options.js`, `src/options.test.js` — slots, colors, labels, scoping, duplicate-into
- Create: `src/jobtotals.js`, `src/jobtotals.test.js` — the extracted totals/aggregation engine
- Create: `docs/adr/0031-quote-options-shared-base.md`
- Modify: `src/model.js` (+`src/model.test.js`) — `normA` option/note, `newArea`, `normC` optionNames
- Modify: `src/App.jsx` — totals call sites, area band chip/outline/menu, summary card groups, preview scope, order-entry/order-sheet picker, note input removal
- Modify: `src/projectheader.jsx` — per-option total chips in both header layouts
- Modify: `src/EstimatePrint.jsx` — option bands + E1 blocks + comparison block (cards layout), area-note line removal (both layouts)
- Modify: `src/CLAUDE.md`, `.claude/skills/floortrack-data-model/SKILL.md` — file map + data-model docs

---

### Task 1: `src/options.js` — slots, scoping, labels

**Files:**
- Create: `src/options.js`
- Test: `src/options.test.js`

**Interfaces:**
- Consumes: `uid` from `./model.js` — wait: `model.js` must not import back. `options.js` imports only `uid` from `./model.js`; `model.js` will NOT import `options.js` (it validates slots with a local list), so no cycle.
- Produces (later tasks rely on these exact names):
  - `OPTION_SLOTS = ["A","B","C"]`
  - `OPTION_COLOR = { A:{main,soft,deep}, B:{...}, C:{...} }` (hex strings; `soft` is a CSS `color-mix` string)
  - `optionsUsed(cats) -> string[]` — slots present on any area, in slot order
  - `hasOptions(cats) -> boolean`
  - `bucketCats(cats, scope) -> Area[]` — `"shared"` → untagged areas; a slot → that slot's areas only
  - `scopedCats(cats, scope) -> Area[]` — `"all"` → everything; `"shared"` → untagged; a slot → untagged + that slot (the union an order ships)
  - `optionTitle(proj, slot) -> string` — custom name or `"Option A"`
  - `optionShort(proj, slot) -> string` — `"A · Marble hex"` or `"Option A"` when unnamed
  - `normOptionNames(v) -> {A?,B?,C?}` — trimmed non-empty strings on valid slots only
  - `duplicateInto(area, slot) -> Area` — deep copy, fresh area+product ids, tagged `slot`

- [ ] **Step 1: Write the failing test**

Create `src/options.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { OPTION_SLOTS, OPTION_COLOR, optionsUsed, hasOptions, bucketCats, scopedCats, optionTitle, optionShort, normOptionNames, duplicateInto } from "./options.js";

const area = (option, id = "x") => ({ id, name: "n" + id, option, products: [{ id: "p" + id, sku: "S" + id }] });

test("slots and colors are fixed", () => {
  assert.deepEqual(OPTION_SLOTS, ["A", "B", "C"]);
  for (const s of OPTION_SLOTS) { assert.ok(OPTION_COLOR[s].main); assert.ok(OPTION_COLOR[s].soft); }
});

test("optionsUsed lists slots present, in slot order", () => {
  const cats = [area(""), area("C", "1"), area("A", "2"), area("C", "3")];
  assert.deepEqual(optionsUsed(cats), ["A", "C"]);
  assert.equal(hasOptions(cats), true);
  assert.equal(hasOptions([area(""), area("")]), false);
  assert.deepEqual(optionsUsed([]), []);
});

test("bucketCats: shared is untagged only, a slot is that slot only", () => {
  const cats = [area("", "s1"), area("A", "a1"), area("B", "b1")];
  assert.deepEqual(bucketCats(cats, "shared").map((a) => a.id), ["s1"]);
  assert.deepEqual(bucketCats(cats, "A").map((a) => a.id), ["a1"]);
});

test("scopedCats: slot scope is the union shared + slot; all is everything", () => {
  const cats = [area("", "s1"), area("A", "a1"), area("B", "b1")];
  assert.deepEqual(scopedCats(cats, "A").map((a) => a.id), ["s1", "a1"]);
  assert.deepEqual(scopedCats(cats, "shared").map((a) => a.id), ["s1"]);
  assert.deepEqual(scopedCats(cats, "all").map((a) => a.id), ["s1", "a1", "b1"]);
});

test("titles: custom name or Option letter; short form leads with the letter", () => {
  const proj = { optionNames: { B: "Marble hex" } };
  assert.equal(optionTitle(proj, "B"), "Marble hex");
  assert.equal(optionTitle(proj, "A"), "Option A");
  assert.equal(optionShort(proj, "B"), "B · Marble hex");
  assert.equal(optionShort(proj, "A"), "Option A");
});

test("normOptionNames keeps trimmed non-empty strings on valid slots", () => {
  assert.deepEqual(normOptionNames({ A: " Porcelain ", B: "", Z: "no", C: 3 }), { A: "Porcelain" });
  assert.deepEqual(normOptionNames(null), {});
});

test("duplicateInto: fresh ids top to bottom, tagged slot, source untouched", () => {
  const src = area("", "orig");
  const copy = duplicateInto(src, "B");
  assert.equal(copy.option, "B");
  assert.notEqual(copy.id, src.id);
  assert.notEqual(copy.products[0].id, src.products[0].id);
  assert.equal(copy.products[0].sku, "Sorig");
  assert.equal(src.option, "");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test 2>&1 | grep -A2 options`
Expected: FAIL — `Cannot find module '.../src/options.js'`

- [ ] **Step 3: Write `src/options.js`**

```js
import { uid } from "./model.js";

// Quote options (ADR 0031): an area's `option` is "" (shared — part of the job
// in every option) or a fixed slot letter. Slots are positional identities, not
// records; custom display names live in project.optionNames.
export const OPTION_SLOTS = ["A", "B", "C"];
// Deliberately outside the moss palette, like the tier colors: options must be
// tellable apart at a glance. `soft` is the wash for bands/cards.
export const OPTION_COLOR = {
  A: { main: "#3E5F8A", deep: "#2E4869", soft: "color-mix(in srgb, #3E5F8A 8%, transparent)" },
  B: { main: "#9A5B33", deep: "#6E401F", soft: "color-mix(in srgb, #9A5B33 8%, transparent)" },
  C: { main: "#6E4E7E", deep: "#503659", soft: "color-mix(in srgb, #6E4E7E 8%, transparent)" },
};

export const optionsUsed = (cats) => OPTION_SLOTS.filter((s) => (cats || []).some((a) => a.option === s));
export const hasOptions = (cats) => optionsUsed(cats).length > 0;

export const bucketCats = (cats, scope) => (cats || []).filter((a) => (scope === "shared" ? !a.option : a.option === scope));
export const scopedCats = (cats, scope) => {
  if (scope === "all") return cats || [];
  return (cats || []).filter((a) => !a.option || a.option === scope);
};

export const normOptionNames = (v) => {
  const out = {};
  if (v && typeof v === "object") for (const s of OPTION_SLOTS) { const n = typeof v[s] === "string" ? v[s].trim() : ""; if (n) out[s] = n; }
  return out;
};
export const optionTitle = (proj, slot) => proj?.optionNames?.[slot] || `Option ${slot}`;
export const optionShort = (proj, slot) => (proj?.optionNames?.[slot] ? `${slot} · ${proj.optionNames[slot]}` : `Option ${slot}`);

export const duplicateInto = (area, slot) => ({ ...area, id: uid(), option: slot, products: (area.products || []).map((p) => ({ ...p, id: uid() })) });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test 2>&1 | tail -5`
Expected: all tests PASS (existing suites included)

- [ ] **Step 5: Write ADR 0031**

Create `docs/adr/0031-quote-options-shared-base.md`:

```markdown
# 0031 — Quote options are area tags over a shared base

Date: 2026-08-06 · Status: accepted · Owner-approved spec:
docs/superpowers/specs/2026-08-06-quote-options-design.md

## Decision

A project's options (customer comparing 2–3 products or installs) are **tags on
areas**, not copies of the job. `Area.option` is `""` (shared — the area is part
of the job in every option) or a fixed slot `"A" | "B" | "C"`. Untagged jobs are
exactly the pre-options app. Display names live in `project.optionNames`
(`{A?,B?,C?}`); unnamed slots read "Option A".

An option's headline number is a **whole-job** figure, additive on paper:
`grandTotal(shared bucket) + grandTotal(option bucket)`, each bucket
consolidating its own materials. Order entry consolidates over the **union**
(shared + chosen slot) instead, so real orders — and order-scoped vendor
freight minimums (ADR 0030) — stay exact; the estimate may overstate by one
rounding unit per shared material, which "quantities are estimates" already
covers.

## Rejected

- Every-area-picks-an-option: an option's subtotal is one bathroom, not a
  signable number.
- Whole-job copies per option: duplicates every shared area and every edit.
- Cross-alternate consolidation: double-counts materials between alternatives.

## Consequences

- Option tags ride version snapshots (`Area[]`) for free; `optionNames` lives on
  the project and survives restores. No SQL migration.
- Area notes (`Area.note`) were removed in the same change — normA drops the
  field, so old notes disappear on a job's next save (owner call, 2026-08-06).
```

Add the row to `docs/adr/README.md`'s index following its existing format.

- [ ] **Step 6: Commit**

```bash
git add src/options.js src/options.test.js docs/adr/0031-quote-options-shared-base.md docs/adr/README.md
git commit -m "options: slots, scoping, labels + ADR 0031 (quote options)"
```

---

### Task 2: Model — `Area.option`, `optionNames`, area notes dropped

**Files:**
- Modify: `src/model.js` (`newArea` line 34, `normP`/`normA` lines 96–100, `newProject` line 84, `normC` line 108)
- Test: `src/model.test.js`

**Interfaces:**
- Consumes: `normOptionNames` — NOT imported (would cycle: options.js imports model.js). `model.js` validates with a local `OPT_RE = /^[ABC]$/`.
- Produces: `normA(a)` returns `{ id, name, option, products }` — **no `note` key**; `newArea()` likewise; `normC(c)` returns `optionNames` normalized `{A?,B?,C?}`.

- [ ] **Step 1: Write the failing tests**

Append to `src/model.test.js`:

```js
test("normA: option keeps valid slots, drops junk, defaults shared; note is gone", () => {
  assert.equal(normA({ option: "B" }).option, "B");
  assert.equal(normA({ option: "Z" }).option, "");
  assert.equal(normA({}).option, "");
  const a = normA({ note: "old note", name: "Bath" });
  assert.equal("note" in a, false);
  assert.equal("note" in newArea(), false);
});

test("normC: optionNames normalize to trimmed strings on valid slots", () => {
  const c = normC({ id: "c1", categories: [], optionNames: { A: " Porcelain ", B: "", X: "no" } });
  assert.deepEqual(c.optionNames, { A: "Porcelain" });
  assert.deepEqual(normC({ id: "c2", categories: [] }).optionNames, {});
});
```

(Ensure the file's import line includes `normA`, `newArea`, `normC` — extend it if missing.)

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | grep -B1 -A3 "normA: option"`
Expected: FAIL (`option` is undefined; `note` still present)

- [ ] **Step 3: Implement in `src/model.js`**

Line 34, replace:

```js
export const newArea = () => ({ id: uid(), name: "", option: "", products: [newProduct()] });
```

Line 100 (`normA`), replace with (note dropped deliberately — owner call 2026-08-06, ADR 0031):

```js
const OPT_RE = /^[ABC]$/;
export const normA = (a) => ({ id: a.id || uid(), name: a.name || "", option: OPT_RE.test(a.option) ? a.option : "", products: (a.products || [{}]).map(normP) });
```

Line 84 (`newProject`): add `optionNames: {},` after `sheogaBasket: []` — i.e. `..., sheogaBasket: [], optionNames: {} });`

Line 108 (`normC`): add to the returned object, after `sheogaBasket: ...`:

```js
optionNames: (() => { const out = {}; const v = c.optionNames; if (v && typeof v === "object") for (const s of ["A", "B", "C"]) { const n = typeof v[s] === "string" ? v[s].trim() : ""; if (n) out[s] = n; } return out; })(),
```

- [ ] **Step 4: Run the whole suite**

Run: `npm test 2>&1 | tail -5`
Expected: PASS. If an existing test asserts `note` on areas, update it to the new shape (that behavior change is the point).

- [ ] **Step 5: Update data-model docs**

In `.claude/skills/floortrack-data-model/SKILL.md`: change the `Area` line to
`Area     { id, name, option: ""|"A"|"B"|"C", products: Product[] }   // option = quote-option slot (ADR 0031); "" = shared base` and add `optionNames: {A?,B?,C?}` to the `Customer` shape with a one-line ADR 0031 note. Remove `note` from the Area shape.

- [ ] **Step 6: Commit**

```bash
git add src/model.js src/model.test.js .claude/skills/floortrack-data-model/SKILL.md
git commit -m "model: Area.option + project optionNames; area notes dropped (ADR 0031)"
```

---

### Task 3: `src/jobtotals.js` — extract the totals engine

**Files:**
- Create: `src/jobtotals.js`
- Modify: `src/App.jsx:991-1047` (the aggregation block) and `src/App.jsx:6-21` imports
- Test: `src/jobtotals.test.js`

**Interfaces:**
- Consumes: `getCarton/getGrout/getMortar/getUnderlay/getUnderlayInstall/getPieceCarton/groutBaseList/attachedList/ceilQty/num` (catalog.js), `miscQty` (model.js), `freightList/freightTotal/freightPrintRows` (freight.js), `printMatList/lineTotal/orderLineCost` (print.js), `specialOrderMargin` (orderbook.js).
- Produces: `jobTotals(proj, rawProj, tSet, wSet, settings, books)` returning exactly:
  `{ totalSqft, orderedSqft, flooringPrice, miscCost, groutCost, caulkCost, mortarCost, underlayCost, baseCost, addonCost, materialsCost, freightCost, grandTotal, gList, mList, uList, cList, bList, aList, fList, aByCat, matAll, matLines, hasMat, margin, pMats }`
  — `proj` is the TIERED project (`tv.proj`-shaped), `rawProj` the raw one (freight reads raw prices, App.jsx:1011). Callers scope by passing `{...proj, categories: <subset>}` / `{...rawProj, categories: <matching subset>}`.

- [ ] **Step 1: Write the failing test**

Create `src/jobtotals.test.js`. Build the fixture through the real normalizers so shapes stay honest, and run math on raw settings (retail view: `proj === rawProj` is fine for tests):

```js
import test from "node:test";
import assert from "node:assert/strict";
import { jobTotals } from "./jobtotals.js";
import { normC } from "./model.js";
import { normalizeSettings, withProjWaste } from "./catalog.js";
import { scopedCats, bucketCats } from "./options.js";

const settings = normalizeSettings({
  grouts: { Frost: { unit: "units", price: 18.95, coverage: 100 } },
  mortars: { Versabond: { unit: "bags", price: 18.95, coverage: 60 } },
});
const tile = (qty, over = {}) => ({ type: "tile", brandColor: "T", L: "12", W: "12", thickness: "0.375", qtyType: "sqft", qty: String(qty), priceSqft: "2.00", grout: { checked: true, product: "Frost", joint: 0.125 }, mortar: { checked: true, product: "Versabond" }, ...over });
const proj = normC({ id: "j1", name: "J", waste: { tile: 10, floor: 5, tileOn: false, floorOn: false }, categories: [
  { name: "Shared", option: "", products: [tile(100)] },
  { name: "Bath A", option: "A", products: [tile(50)] },
  { name: "Bath B", option: "B", products: [tile(50, { priceSqft: "10.00" })] },
] });
const wSet = withProjWaste(settings, proj);
const totals = (cats) => jobTotals({ ...proj, categories: cats }, { ...proj, categories: cats }, wSet, wSet, settings, []);

test("all-scope totals match hand math and consolidate materials", () => {
  const t = totals(proj.categories);
  assert.equal(t.totalSqft, 200);
  assert.equal(t.flooringPrice, 100 * 2 + 50 * 2 + 50 * 10);
  assert.equal(t.gList.length, 1); // one grout product+color across all areas
  assert.equal(t.mList.length, 1);
  assert.ok(t.grandTotal > t.flooringPrice);
});

test("buckets consolidate within themselves; whole-job is additive", () => {
  const shared = totals(bucketCats(proj.categories, "shared"));
  const optA = totals(bucketCats(proj.categories, "A"));
  assert.equal(shared.totalSqft, 100);
  assert.equal(optA.totalSqft, 50);
  const whole = shared.grandTotal + optA.grandTotal;
  assert.ok(whole > 0);
  // union consolidation may save a rounding unit vs the additive figure
  const union = totals(scopedCats(proj.categories, "A"));
  assert.ok(union.grandTotal <= whole);
});

test("empty scope returns zeros, not NaN", () => {
  const t = totals([]);
  assert.equal(t.grandTotal, 0);
  assert.deepEqual(t.matLines, []);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | grep -A2 jobtotals`
Expected: FAIL — `Cannot find module '.../src/jobtotals.js'`

- [ ] **Step 3: Extract the engine**

Create `src/jobtotals.js` with this exact skeleton, then MOVE App.jsx lines 991–1047 (from `let totalSqft = 0, ...` through the `const pMats = ...` line) into the body — a verbatim cut-and-paste with only these mechanical renames: `tv.proj` → `proj` · `sel` → `rawProj` · drop the `sel?._full ? ... : []` guards (callers guard) · keep `settings`/`tSet`/`wSet`/`books` as parameters (`tSet` is what the block calls `tSet` today; the caulk/pending branches that read `tSet.grouts[...]` come along unchanged):

```js
import { num, ceilQty, getCarton, getGrout, getMortar, getUnderlay, getUnderlayInstall, getPieceCarton, groutBaseList, attachedList } from "./catalog.js";
import { miscQty } from "./model.js";
import { freightList, freightTotal, freightPrintRows } from "./freight.js";
import { printMatList, lineTotal, orderLineCost } from "./print.js";
import { specialOrderMargin } from "./orderbook.js";

// The job's money math, extracted from App.jsx so it can run per option scope
// (ADR 0031): callers pass a project whose `categories` are already filtered to
// the scope they want. `proj` is the TIERED view, `rawProj` the raw record —
// freight reads raw prices (ADR 0030). One scope in, one set of numbers out;
// nothing here knows what an option is.
export function jobTotals(proj, rawProj, tSet, wSet, settings, books) {
  /* <<< App.jsx lines 991–1047 land here, ending with: >>> */
  // const pMats = [...printMatList(proj, tSet), ...freightPrintRows(fList)];
  return { totalSqft, orderedSqft, flooringPrice, miscCost, groutCost, caulkCost, mortarCost, underlayCost, baseCost, addonCost, materialsCost, freightCost, grandTotal, gList, mList, uList, cList, bList, aList, fList, aByCat, matAll, matLines, hasMat, margin, pMats };
}
```

In `src/App.jsx`, replace lines 991–1047 with:

```js
const T = useMemo(() => (sel && sel._full ? jobTotals(tv.proj, sel, tSet, wSet, settings, books) : jobTotals({ categories: [] }, { categories: [] }, tSet, wSet, settings, books)), [sel, tv.proj, tSet, wSet, settings, books]);
const { totalSqft, orderedSqft, flooringPrice, miscCost, groutCost, caulkCost, mortarCost, underlayCost, baseCost, addonCost, materialsCost, freightCost, grandTotal, gList, mList, uList, cList, bList, aList, fList, aByCat, matAll, matLines, hasMat, margin, pMats } = T;
```

and add `import { jobTotals } from "./jobtotals.js";` — then delete the now-unused App imports the moved block owned (only remove ones `npm run lint` flags; several are still used elsewhere in App).

- [ ] **Step 4: Run tests + lint**

Run: `npm test 2>&1 | tail -5 && npm run lint`
Expected: tests PASS, lint clean (fix any unused-import fallout).

- [ ] **Step 5: Parity smoke-check in the app**

Run: `npm run dev` — open a seeded project (any dev data) and confirm the order summary, grand total, and estimate preview render identical numbers to `main` for a no-options job (spot-check one job's total against the same job on `main` if dev data exists; otherwise confirm no NaN/zero regressions on a hand-built job).

- [ ] **Step 6: Commit**

```bash
git add src/jobtotals.js src/jobtotals.test.js src/App.jsx
git commit -m "jobtotals: extract App totals block into a per-scope engine (ADR 0031)"
```

---

### Task 4: Per-scope totals wiring + area band (chip, outline, menu, note removal)

**Files:**
- Modify: `src/App.jsx` (area render ~1432–1451; note input at 1445 REMOVED; new state + menu near the other popover state hooks)

**Interfaces:**
- Consumes: `optionsUsed/hasOptions/bucketCats/OPTION_COLOR/optionShort/optionTitle/duplicateInto` (options.js), `jobTotals` (Task 3), `updArea` (existing write path — option changes are plain area patches).
- Produces (used by Tasks 5–8):
  - `optsUsed: string[]` — memoized `optionsUsed(sel?.categories)`
  - `scopeTotals(scope)` — memoized map: for `"shared"` and each used slot, `jobTotals` over `bucketCats`; plus `wholeJob(slot) = scopeTotals("shared").grandTotal + scopeTotals(slot).grandTotal`
  - `areaMenu` state `{ aid, x, y } | null` and `<AreaOptionMenu>` rendered at App root

- [ ] **Step 1: Compute per-scope totals (App.jsx, right after the Task-3 `T` block)**

```js
const optsUsed = useMemo(() => (sel && sel._full ? optionsUsed(sel.categories) : []), [sel]);
// Per-bucket money (ADR 0031): shared + each option's own areas. Additive on
// paper — wholeJob(slot) = shared + slot — while order entry re-runs the union.
const buckets = useMemo(() => {
  if (!sel || !sel._full || optsUsed.length === 0) return null;
  const run = (scope) => jobTotals({ ...tv.proj, categories: bucketCats(tv.proj.categories, scope) }, { ...sel, categories: bucketCats(sel.categories, scope) }, tSet, wSet, settings, books);
  const out = { shared: run("shared") };
  optsUsed.forEach((s) => { out[s] = run(s); });
  return out;
}, [sel, tv.proj, optsUsed, tSet, wSet, settings, books]);
const wholeJob = (slot) => (buckets ? buckets.shared.grandTotal + buckets[slot].grandTotal : grandTotal);
```

Import at top of App.jsx: `import { OPTION_SLOTS, OPTION_COLOR, optionsUsed, hasOptions, bucketCats, scopedCats, optionTitle, optionShort, duplicateInto } from "./options.js";`

- [ ] **Step 2: Area band — outline, chip, right-click; note input removed**

At App.jsx:1441 extend the area card's wrapper style with the option color (keep every existing class):

```js
const oc = a.option ? OPTION_COLOR[a.option] : null;
```

and on the card div add `style={oc ? { borderColor: oc.main, borderWidth: 1.5 } : undefined}`, plus `onContextMenu={(e) => { e.preventDefault(); setAreaMenu({ aid: a.id, x: e.clientX, y: e.clientY }); }}` on the band div (line 1442).

Replace the note input (line 1445) with the option chip (chip = same menu, for phones/discoverability):

```jsx
{(a.option || optsUsed.length > 0) && (
  <button tabIndex={-1} onClick={(e) => { const r = e.currentTarget.getBoundingClientRect(); setAreaMenu({ aid: a.id, x: r.left, y: r.bottom + 4 }); }}
    className="ft-noprint rounded-md px-2 py-0.5 text-[10.5px] font-bold shrink-0"
    style={oc ? { background: `color-mix(in srgb, ${oc.main} 12%, var(--ft-card))`, color: oc.deep, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${oc.main} 45%, transparent)` } : { border: "1px dashed var(--ft-border-strong)", color: "var(--ft-muted)" }}>
    {a.option ? optionShort(sel, a.option).toUpperCase() : "SHARED"}
  </button>
)}
```

(When the job has no options at all, no chip renders — the band looks exactly as today minus the dead note input. The right-click menu is still reachable and is how the FIRST option gets created.)

- [ ] **Step 3: The menu**

Add state next to the other popover state hooks: `const [areaMenu, setAreaMenu] = useState(null);` and `const [renamingOpt, setRenamingOpt] = useState(null);`

Render at App root (beside the other overlays), a fixed-position card using the existing `useEscClose`/backdrop pattern the popovers use:

```jsx
{areaMenu && sel && (() => {
  const a = sel.categories.find((x) => x.id === areaMenu.aid);
  if (!a) return null;
  const setOpt = (slot) => { updArea(a.id, { option: slot }); setAreaMenu(null); };
  const dupInto = (slot) => {
    const copy = duplicateInto(a, slot);
    const cats = [...sel.categories];
    cats.splice(cats.indexOf(a) + 1, 0, copy);
    updateCust(sel.id, { categories: cats });
    if (!a.option) updArea(a.id, { option: optionsUsed(cats).find((s) => s !== slot) || "A" });
    setAreaMenu(null);
  };
  const free = OPTION_SLOTS.filter((s) => !optsUsed.includes(s));
  const item = "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[12.5px] text-left hover:bg-slate-100";
  return (
    <div className="ft-noprint fixed inset-0 z-50" onClick={() => setAreaMenu(null)} onContextMenu={(e) => { e.preventDefault(); setAreaMenu(null); }}>
      <div className="absolute bg-white rounded-lg border border-slate-200 shadow-xl p-1" style={{ left: Math.min(areaMenu.x, window.innerWidth - 250), top: Math.min(areaMenu.y, window.innerHeight - 300), width: 236 }} onClick={(e) => e.stopPropagation()}>
        <div className="uppercase text-[9px] font-bold tracking-widest text-slate-400 px-2.5 pt-1.5 pb-0.5">This area is in</div>
        <button className={item} onClick={() => setOpt("")}><span className="w-2 h-2 rounded-sm" style={{ background: "var(--ft-faint)" }} />Shared — every option{!a.option && <Check size={12} className="ml-auto" />}</button>
        {OPTION_SLOTS.map((s) => (optsUsed.includes(s) || free[0] === s) && (
          <button key={s} className={item} onClick={() => setOpt(s)}>
            <span className="w-2 h-2 rounded-sm" style={{ background: OPTION_COLOR[s].main }} />
            {optsUsed.includes(s) ? optionShort(sel, s) : "New option…"}
            {a.option === s && <Check size={12} className="ml-auto" />}
          </button>
        ))}
        <div className="border-t border-slate-100 my-1" />
        {optsUsed.concat(free.slice(0, 1)).map((s) => (
          <button key={"d" + s} className={item} onClick={() => dupInto(s)}>Duplicate into {optsUsed.includes(s) ? optionShort(sel, s) : "new option"}…</button>
        ))}
        {a.option && <button className={item} onClick={() => { setRenamingOpt(a.option); setAreaMenu(null); }}>Rename {optionTitle(sel, a.option)}…</button>}
        {a.option && <button className={item} onClick={() => { setPreviewScope(a.option); setViewTab("preview"); setAreaMenu(null); }}>Print this option…</button>}
      </div>
    </div>
  );
})()}
{renamingOpt && sel && (
  <Modal onClose={() => setRenamingOpt(null)} title={`Rename ${optionTitle(sel, renamingOpt)}`}>
    <input autoFocus defaultValue={sel.optionNames?.[renamingOpt] || ""} placeholder={`Option ${renamingOpt}`}
      onKeyDown={(e) => { if (e.key === "Enter") { updateCust(sel.id, { optionNames: { ...sel.optionNames, [renamingOpt]: e.target.value.trim() } }); setRenamingOpt(null); } }}
      className="ft-field w-full h-[36px] text-sm rounded-md border border-slate-200 px-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
  </Modal>
)}
```

Adjust `Modal` usage to the component's real props (check `widgets.jsx` signature when implementing — if `Modal` has no `title` prop, render the heading inside). `setPreviewScope` arrives in Task 7 — define the state now (`const [previewScope, setPreviewScope] = useState("all");`) so this compiles.

Note the `dupInto` shared-source rule: duplicating a **shared** area into a slot also tags the source with the first *other* used slot (or A) — a shared original would otherwise appear in the copy's option too, doubling the room. This is the "compare this room" two-click flow from the spec.

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev` — on a test job: right-click an area band → menu opens; "New option…" tags it A and the chip + outline appear; duplicate into new option lands a B copy below with fresh rows; rename sticks and shows in the chip; Escape/click-away closes; mobile width (devtools) can open the menu from the chip. Confirm the note input is gone and nothing else moved on the band.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "areas: option chip + outline + right-click menu; area note input removed"
```

---

### Task 5: Header chips + job-summary option groups

**Files:**
- Modify: `src/projectheader.jsx` (Bar total at :171, Classic total at :269 — both take new props)
- Modify: `src/App.jsx` (header call sites ~1303; mobile strip total ~1345; summary card 2186–2200; pass `optionBadges`)

**Interfaces:**
- Consumes: `buckets`, `wholeJob`, `optsUsed`, `optionShort`, `OPTION_COLOR` from Task 4.
- Produces: `optionBadges: null | Array<{slot, label, color:{main,deep,soft}, total:number}>` prop on `ProjectHeaderBar`/`ProjectHeaderClassic` — null when the job has no options (headers render exactly as today).

- [ ] **Step 1: Build the badges in App.jsx and pass them**

Next to the Task-4 memos:

```js
const optionBadges = optsUsed.length ? optsUsed.map((s) => ({ slot: s, label: optionShort(sel, s), color: OPTION_COLOR[s], total: wholeJob(s) })) : null;
```

Add `optionBadges` to the props object App passes both header components (the shared props literal at ~1303) and to the mobile total spot (~1345).

- [ ] **Step 2: Render in both headers**

In `projectheader.jsx`, add `optionBadges` to both components' destructured props. In `ProjectHeaderBar` replace the single-total div (line ~171) with:

```jsx
{optionBadges ? (
  <div className="flex items-center gap-1.5 flex-wrap justify-end">
    {optionBadges.map((b) => (
      <span key={b.slot} className="ft-mono rounded-md px-2 py-0.5 text-[11px] font-bold whitespace-nowrap" style={{ background: `color-mix(in srgb, ${b.color.main} 12%, var(--ft-card))`, color: b.color.deep, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${b.color.main} 45%, transparent)` }}>
        {b.label} <span className="opacity-75 font-semibold">{money(b.total)}</span>
      </span>
    ))}
  </div>
) : (
  <div className="ft-mono font-bold" style={{ fontSize: 18, lineHeight: 1.15, letterSpacing: "-.02em", color: TIER_COLOR[tv.tier]?.main || "var(--ft-brand-deep)" }}>{money(grandTotal)}</div>
)}
```

Same substitution pattern at Classic's total (line ~269) and App's mobile total (~1345), sized to their surroundings (Classic/mobile: font-size 12px chips).

- [ ] **Step 3: Summary card groups (App.jsx 2186–2200)**

Inside the Order-summary tint card, wrap today's rows: when `buckets` is null render exactly the current content; when set, render the groups (shared first, then per option) — each group reuses the same row markup with that bucket's numbers, and each option group closes with the whole-job line:

```jsx
{buckets ? (
  <div className="space-y-3">
    {["shared", ...optsUsed].map((scope) => {
      const t = buckets[scope];
      const b = scope !== "shared" ? optionBadges.find((x) => x.slot === scope) : null;
      return (
        <div key={scope} className="rounded-md" style={b ? { background: b.color.soft, margin: "0 -6px", padding: "8px 6px" } : undefined}>
          <div className="flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700 }}>
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ background: b ? b.color.main : "var(--ft-faint)" }} />
            {b ? b.label : "Shared areas"}
            <span className="ft-mono ml-auto">{money(t.grandTotal)}</span>
          </div>
          <div className="flex items-center justify-between"><span className="text-slate-500" style={{ fontSize: 11.5 }}>Flooring</span><span className="ft-mono" style={{ fontSize: 11.5 }}>{money(t.flooringPrice + t.miscCost)}</span></div>
          {t.materialsCost > 0 && <div className="flex items-center justify-between"><span className="text-slate-500" style={{ fontSize: 11.5 }}>Materials</span><span className="ft-mono" style={{ fontSize: 11.5 }}>{money(t.materialsCost)}</span></div>}
          {t.freightCost > 0 && <div className="flex items-center justify-between"><span className="text-slate-500" style={{ fontSize: 11.5 }}>Freight</span><span className="ft-mono" style={{ fontSize: 11.5 }}>{money(t.freightCost)}</span></div>}
          {t.matLines.map((m, i) => <div key={i} className="flex items-center justify-between" style={{ paddingLeft: 14 }}><span className="text-slate-400" style={{ fontSize: 10.5 }}>{m.kind} · {m.product} — {m.order}</span><span className="ft-mono text-slate-400" style={{ fontSize: 10.5 }}>{money(m.cost)}</span></div>)}
          {b && <div className="flex justify-between items-baseline" style={{ marginTop: 4, paddingTop: 5, borderTop: "1px solid var(--ft-border)", fontSize: 12, fontWeight: 700 }}><span>With shared areas</span><span className="ft-mono" style={{ color: b.color.deep }}>{money(wholeJob(scope))}</span></div>}
        </div>
      );
    })}
    <MarginLine margin={margin} show={showMargin} onToggle={() => setShowMargin((v) => !v)} />
  </div>
) : ( /* today's rows, unchanged */ )}
```

Keep the existing single-total markup verbatim in the else branch (grand `Total`, per-kind rows, `MarginLine`, waste note).

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev` — tag two areas into A and B on a test job: header shows two colored chips with whole-job numbers; summary card shows Shared/A/B groups whose arithmetic adds (shared + option = chip number); untag everything → header and card return to today's single total pixel-for-pixel.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/projectheader.jsx
git commit -m "options: whole-job chips in both headers + summary card groups"
```

---

### Task 6: EstimatePrint — option bands, E1 materials blocks, comparison block

**Files:**
- Modify: `src/EstimatePrint.jsx` (cards layout `renderEstimatePaperCards` 184–339; classic layout note line 75; cards note line 236)
- Modify: `src/App.jsx` (both `EstimatePaper` call sites — preview :2208 and print :2294 — pass the new `optionPrint` prop)

**Interfaces:**
- Consumes: `buckets`, `optsUsed`, `wholeJob`, `optionTitle/optionShort`, `OPTION_COLOR`.
- Produces: `EstimatePaper` accepts `optionPrint` prop:
  `null` (no options / single-option scope → render exactly as today) or
  `{ sections: [{slot, title, color, cats /* tiered areas of the bucket */, t /* that bucket's jobTotals */, whole }], sharedT /* shared bucket totals */ }`.
  When set, `sel/tv/pMats/...` props describe the SHARED bucket (App passes shared-scoped values), and the paper renders: shared areas → shared extras block (headed "Setting materials & sundries — shared areas", closing with "Shared job subtotal") → option bands → comparison block → signature with "option chosen".

- [ ] **Step 1: Build `optionPrint` in App.jsx**

Next to the other memos:

```js
const optionPrint = buckets ? {
  sharedT: buckets.shared,
  sections: optsUsed.map((s) => ({ slot: s, title: optionTitle(sel, s), color: OPTION_COLOR[s], cats: bucketCats(tv.proj.categories, s), t: buckets[s], whole: wholeJob(s) })),
} : null;
```

At both `EstimatePaper` call sites pass `optionPrint={optionPrint}` — **and when `optionPrint` is set, swap the scoped props**: `pMats={buckets.shared.pMats} materialsCost={buckets.shared.materialsCost} freightCost={buckets.shared.freightCost} flooringPrice={buckets.shared.flooringPrice} miscCost={buckets.shared.miscCost} grandTotal={buckets.shared.grandTotal}` with `totalSqft/orderedSqft` from `buckets.shared` too, while `tv`/`sel` stay whole (the cards loop will filter). Simplest: compute `const paperProps = optionPrint ? { ...sharedScopedProps } : { ...todayProps };` once and spread at both call sites so preview and print can never drift.

- [ ] **Step 2: Render in `renderEstimatePaperCards`**

Inside `EstimatePaper` add `optionPrint` to the destructured props. In the cards layout:

a) The areas `.map` (line 228) iterates `optionPrint ? tv.proj.categories.filter((a) => !a.option) : tv.proj.categories` — shared areas only when options print.

b) The Extras block (283–321) keeps its markup; when `optionPrint` is set, retitle the heading to `Setting materials & sundries — shared areas` and change the subtotal row label to `Shared job subtotal` with `money(optionPrint.sharedT.grandTotal)`.

c) After the Extras block, render the options intro band + sections:

```jsx
{optionPrint && (
  <>
    <div className="flex justify-between items-baseline" style={{ padding: "2px 0 6px" }}>
      <div className="uppercase" style={{ fontSize: 10, fontWeight: 800, letterSpacing: ".26em", color: "var(--ft-brand-deep)" }}>The options</div>
      <div style={{ fontSize: 10, fontStyle: "italic", color: "var(--ft-faint)" }}>choose one option below</div>
    </div>
    {optionPrint.sections.map((S) => (
      <div key={S.slot} className="break-inside-avoid" style={{ border: `1.3px solid ${S.color.main}`, borderRadius: 5, marginBottom: 9, overflow: "hidden" }}>
        <div className="flex items-center uppercase" style={{ gap: 8, background: S.color.main, color: "#fff", padding: "5px 10px", fontSize: 8.5, fontWeight: 800, letterSpacing: ".18em" }}>
          Option {S.slot}{S.title !== `Option ${S.slot}` ? ` · ${S.title}` : ""}
          <span style={{ marginLeft: "auto", textTransform: "none", letterSpacing: 0, fontSize: 9, fontWeight: 700 }}>{S.cats.map((a, i) => areaPrintLabel(a, i)).join(" · ")}</span>
        </div>
        {S.cats.map((a) => a.products.filter((p) => !rowBlank(p)).map((p, pi) => ( /* reuse the EXISTING product-card JSX from the areas map, extracted into a local renderProduct(p, pi) so the two call sites share one implementation */ renderProduct(p, pi) )))}
        {S.t.matLines.length > 0 && (
          <div style={{ margin: "2px 8px 8px", borderRadius: 4, padding: "7px 10px 8px", background: `color-mix(in srgb, ${S.color.main} 7%, #fff)` }}>
            <div className="uppercase" style={{ fontSize: 7, fontWeight: 800, letterSpacing: ".2em", color: S.color.main, marginBottom: 4 }}>Materials for this option</div>
            {S.t.matLines.map((m, i) => (
              <div key={i} className="flex justify-between" style={{ gap: 12, fontSize: 8.8, padding: "1.5px 0" }}>
                <span><b style={{ fontWeight: 800 }}>{m.kind}</b> · {m.product} — {m.order} {u1(m.order, m.unit)}{m.sku ? <span style={{ color: "var(--ft-muted)", fontSize: 8 }}> · SKU {m.sku}</span> : null}</span>
                <span style={{ whiteSpace: "nowrap" }}>{m.order > 1 ? `${m.order} × ${money(m.price)} · ` : ""}{money(m.cost)}</span>
              </div>
            ))}
            <div className="flex justify-between" style={{ borderTop: "1px solid var(--ft-paper-rule)", marginTop: 4, paddingTop: 3, fontSize: 8.5, fontWeight: 800 }}><span>Materials — Option {S.slot}</span><span>{money(S.t.materialsCost + S.t.freightCost)}</span></div>
          </div>
        )}
        <div className="flex justify-between items-baseline" style={{ padding: "6px 10px", borderTop: "1px solid var(--ft-paper-rule)", fontSize: 9, background: "color-mix(in srgb, var(--ft-paper-band) 55%, #fff)" }}>
          <span style={{ color: "var(--ft-paper-muted)" }}>{S.t.matLines.length ? `flooring ${money(S.t.flooringPrice + S.t.miscCost)} + materials ${money(S.t.materialsCost + S.t.freightCost)}` : "no setting materials"}</span>
          <span style={{ fontWeight: 800, fontSize: 10.5 }}>Option {S.slot} {money(S.t.grandTotal)} &nbsp;·&nbsp; <span style={{ color: "var(--ft-brand-deep)" }}>whole job {money(S.whole)}</span></span>
        </div>
      </div>
    ))}
  </>
)}
```

The pricing switch applies inside the bands exactly as it does to the shared cards: `renderProduct` already honors `showUnit/showTotals`; wrap the materials block and the footer money in `showTotals &&` (mode "unit"/"none" prints the bundle's products but no per-option money).

d) The Estimated-total block (323–330): when `optionPrint` is set render the comparison grid instead:

```jsx
{showTotals && optionPrint && (
  <div className="break-inside-avoid" style={{ borderTop: "2px solid var(--ft-text)", marginTop: 12, paddingTop: 10 }}>
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${optionPrint.sections.length}, 1fr)`, gap: 8 }}>
      {optionPrint.sections.map((S) => (
        <div key={S.slot} style={{ border: `1.3px solid ${S.color.main}`, borderRadius: 5, padding: "7px 10px 8px" }}>
          <div className="uppercase" style={{ fontSize: 8, fontWeight: 800, letterSpacing: ".14em", color: S.color.main }}>Option {S.slot}{S.title !== `Option ${S.slot}` ? ` · ${S.title}` : ""}</div>
          <div style={{ fontSize: 15, fontWeight: 800, marginTop: 2 }}>{money(S.whole)}</div>
          <div style={{ fontSize: 7.5, color: "var(--ft-paper-muted)" }}>incl. shared areas {money(optionPrint.sharedT.grandTotal)}</div>
        </div>
      ))}
    </div>
  </div>
)}
{showTotals && !optionPrint && grandTotal > 0 && ( /* today's Estimated total block, unchanged */ )}
```

e) Extract `renderProduct(p, pi)` from the current inline product card (lines 237–277) as a `const` inside `renderEstimatePaperCards` — a pure move so shared areas and option bands render the same card.

- [ ] **Step 3: Remove the area-note lines**

Delete `{a.note && ...}` at line 236 (cards) and line 75 (classic). Classic gets no other change: `ESTIMATE_PRINT_LAYOUT` is `"cards"`; if the team flips back to classic with options in play it prints all areas flat, which is acceptable dormant-path behavior — note this in the commit message.

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev` — build the Hoffman-style job (2 shared areas, 3 one-area options with differing materials). Preview tab must match the approved prototype structurally: shared cards → shared extras with subtotal → 3 color bands each with "Materials for this option" and `Option X $… · whole job $…` footer → comparison grid. Check the numbers add (band whole job = shared subtotal + band option total). Flip printPricing to "unit" and "none" — bands keep products, drop money. Untag all areas → sheet is today's, pixel-identical.

- [ ] **Step 5: Commit**

```bash
git add src/EstimatePrint.jsx src/App.jsx
git commit -m "estimate: option bands with E1 materials bundles + comparison block; area note line removed"
```

---

### Task 7: Preview scope switch + single-option printing

**Files:**
- Modify: `src/App.jsx` (preview tab 2205–2214; `previewScope` state from Task 4; printMode flow)
- Modify: `src/EstimatePrint.jsx` (optional `scopeNote` under the Project column)

**Interfaces:**
- Consumes: `previewScope` state (`"all" | "A" | "B" | "C"`), `scopedCats`, `jobTotals`, `optionShort`.
- Produces: preview + Ctrl-P/print button print exactly what the preview shows; `EstimatePaper` gains optional `scopeNote: string` rendered under the Project meta column (12px italic muted, cards layout).

- [ ] **Step 1: Scope the paper props**

Where Task 6 built `paperProps`, extend: when `optsUsed.length && previewScope !== "all"`, build a union-scoped run and flat props (no bands — a normal single-total sheet):

```js
const scopedT = useMemo(() => {
  if (!sel || !sel._full || previewScope === "all" || !optsUsed.length) return null;
  return jobTotals({ ...tv.proj, categories: scopedCats(tv.proj.categories, previewScope) }, { ...sel, categories: scopedCats(sel.categories, previewScope) }, tSet, wSet, settings, books);
}, [sel, tv.proj, previewScope, optsUsed, tSet, wSet, settings, books]);
const paperProps = scopedT
  ? { sel, people: data.people, profile, tv: { ...tv, proj: { ...tv.proj, categories: scopedCats(tv.proj.categories, previewScope) } }, jobWaste, tSet, optionPrint: null, scopeNote: optionShort(sel, previewScope), pMats: scopedT.pMats, materialsCost: scopedT.materialsCost, freightCost: scopedT.freightCost, flooringPrice: scopedT.flooringPrice, miscCost: scopedT.miscCost, totalSqft: scopedT.totalSqft, orderedSqft: scopedT.orderedSqft, grandTotal: scopedT.grandTotal }
  : /* Task 6's optionPrint-or-today props */;
```

Use `<EstimatePaper {...paperProps} />` at BOTH call sites (preview :2208 and print :2294) — one props object, so print can never drift from preview. Reset the scope when the selected project changes: add `setPreviewScope("all")` to the existing project-switch effect.

- [ ] **Step 2: The toolbar segmented control**

Above the paper in the preview tab (inside the 2206 wrapper, before the paper div), render only when `optsUsed.length > 0`:

```jsx
<div className="ft-noprint flex justify-center mb-4">
  <div className="inline-flex rounded-lg border border-slate-300 bg-white overflow-hidden">
    {["all", ...optsUsed].map((s) => (
      <button key={s} onClick={() => setPreviewScope(s)} className={`px-3.5 py-1.5 text-[12.5px] font-bold border-r border-slate-200 last:border-r-0 ${previewScope === s ? "bg-indigo-50" : "hover:bg-slate-50"}`}>
        {s === "all" ? "Compare all" : <><span className="inline-block w-2 h-2 rounded-sm mr-1.5" style={{ background: OPTION_COLOR[s].main }} />{optionShort(sel, s)}</>}
      </button>
    ))}
  </div>
</div>
```

(`bg-indigo-50` maps to the moss tint via the theme's Tailwind overrides — the SegBar convention.)

- [ ] **Step 3: `scopeNote` in EstimatePrint**

In `renderEstimatePaperCards`, under the Project column's detail (the meta grid, line ~217): render `scopeNote` when present as an extra detail line — add it to the third `[label, name, detail]` tuple: `["Project", printName, [scopeNote, wMeta].filter(Boolean).join(" · ")]` with `scopeNote` styled by the existing detail rendering (no new markup needed).

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev` — with options: preview shows the seg control; "Compare all" = banded sheet; picking B = flat single-total sheet of shared+B with "B · Marble hex" in the Project column; Print button prints the visible scope (check the print dialog preview); "Print this option…" in the area menu jumps to preview with that scope selected. Without options: no control, everything as today.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/EstimatePrint.jsx
git commit -m "preview: per-option scope switch; single-option sheet prints what it shows"
```

---

### Task 8: Order entry + order sheet scope picker

**Files:**
- Modify: `src/App.jsx` (order-entry block 2453–2469; order-sheet trigger points `setPrintMode("order")` at :1416 and in projectheader via prop; order-sheet print block 2243+)

**Interfaces:**
- Consumes: `scopedCats`, `jobTotals`, `optsUsed`, `optionShort`, `wholeJob`, `OPTION_COLOR`.
- Produces: `orderScope` state (`null | "all" | "A" | "B" | "C"`); `askOrderScope(next)` — opens the picker when the job has options, else calls `next("all")` directly; both the order-entry panel and the order-sheet print run over `scopedCats(…, scope)` with materials/freight from a scoped `jobTotals` run (the **union**, so consolidation and freight minimums are exact).

- [ ] **Step 1: Picker state + component**

```js
const [orderScope, setOrderScope] = useState(null);        // active scope for the open flow
const [scopeAsk, setScopeAsk] = useState(null);            // { for: "entry" | "sheet" } | null
const askOrderScope = (kind) => { if (optsUsed.length) setScopeAsk({ for: kind }); else { setOrderScope("all"); (kind === "entry" ? setShowOrderCopy : () => setPrintMode("order"))(true); } };
```

Change the two triggers: the order-entry button(s) call `askOrderScope("entry")` instead of `setShowOrderCopy(true)`, and the order-sheet button(s) call `askOrderScope("sheet")` instead of `setPrintMode("order")` (App.jsx :1416 and the `setShowOrderCopy`/`setPrintMode` props handed to `projectheader.jsx` — pass wrapped versions so the header components need no change).

Render the picker with the existing `Modal`:

```jsx
{scopeAsk && sel && (
  <Modal onClose={() => setScopeAsk(null)}>
    <div className="text-[15px] font-bold">Copy for order entry</div>
    <div className="text-[12.5px] text-slate-500 mb-3">This job has options — which one is being ordered?</div>
    {[...optsUsed.map((s) => ({ scope: s, label: optionShort(sel, s), sub: "shared areas + " + optionTitle(sel, s), dot: OPTION_COLOR[s].main, total: wholeJob(s) })), { scope: "all", label: "Everything", sub: "all areas, all options — ordering more than one", dot: null, total: null }].map((o) => (
      <button key={o.scope} className="w-full flex items-center gap-2.5 rounded-lg border border-slate-200 hover:border-slate-400 px-3 py-2.5 mb-2 text-left"
        onClick={() => { setOrderScope(o.scope); setScopeAsk(null); (scopeAsk.for === "entry" ? setShowOrderCopy(true) : setPrintMode("order")); }}>
        {o.dot && <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: o.dot }} />}
        <span className="min-w-0"><span className="block text-[13.5px] font-bold">{o.label}</span><span className="block text-[11px] text-slate-500">{o.sub}</span></span>
        {o.total != null && <span className="ft-mono ml-auto text-[12px] font-bold whitespace-nowrap">{money(o.total)}</span>}
      </button>
    ))}
  </Modal>
)}
```

(Title copy for the sheet flow: reuse as-is — the question is the same; if desired, `scopeAsk.for === "sheet" ? "Order sheet" : "Copy for order entry"` on the heading.)

- [ ] **Step 2: Scope the order-entry panel (2453–2469)**

Inside the `showOrderCopy` IIFE, scope everything by `orderScope` (default "all") using a UNION-scoped totals run:

```js
const scope = orderScope || "all";
const oeCats = scopedCats((tv.tier === "employee" ? tv.proj : sel).categories, scope);
const oeT = scope === "all" ? T : jobTotals({ ...tv.proj, categories: scopedCats(tv.proj.categories, scope) }, { ...sel, categories: scopedCats(sel.categories, scope) }, tSet, wSet, settings, books);
```

then build `rows` from `oeCats` (same loop), `mats` from `oeT.matAll`, `freightRows` from `oeT.fList`. Pass `name={optsUsed.length && scope !== "all" ? `${sel.name} — ${optionShort(sel, scope)}` : sel.name}` so the panel header names the scope. `OrderEntryPanel` itself is unchanged.

- [ ] **Step 3: Scope the order-sheet print (2243+)**

The order sheet renders `rows`-like lines and `matLines`. Scope identically: compute `const osT = ...` (same pattern) and iterate `scopedCats(sel.categories, scope)` + `osT.matLines` in the sheet's table; add the scope name beside the project name in the sheet header (`{sel.name}{scope !== "all" ? ` — ${optionShort(sel, scope)}` : ""}`). Reset `orderScope` to null when the panel closes and after printing (the existing `printMode` effect at :197 — add `setOrderScope(null)` there and in the panel's `onClose`).

- [ ] **Step 4: Verify in the browser**

Run: `npm run dev` — with options: Order-entry button opens the picker; choosing B yields a panel titled "… — B · Marble hex" whose special/stock lists contain only shared+B rows and B-scope materials; Everything matches today's full list; a job without options skips the picker entirely. Order sheet: same gating, scoped lines, scope in the header. Freight: a book with rows in shared AND the chosen option charges once (union), not twice.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "order entry + order sheet: option scope picker; union-scoped materials and freight"
```

---

### Task 9: Docs, full verification, preview proof

**Files:**
- Modify: `src/CLAUDE.md` (file map), `CLAUDE.md` (data-model pointer already covers it — only touch if the Area shape is quoted there)
- Create: screenshots under `.scratch/` (or attach to the PR when one is opened)

- [ ] **Step 1: File-map docs**

Add to `src/CLAUDE.md`'s map, matching its style:

```
  options.js        # quote options (ADR 0031): fixed slots A/B/C + colors, shared/
                    # option scoping (bucketCats/scopedCats), titles, duplicateInto —
                    # an option is a TAG on an area, never a copy of the job
                    # (options.test.js)
  jobtotals.js      # the job's money math, extracted from App.jsx so it runs per
                    # option scope: one filtered project in, every aggregate out
                    # (totals, gList/mList/…, matAll, pMats, freight, margin).
                    # Whole-job = shared bucket + option bucket (additive on paper);
                    # order entry re-runs the UNION so freight minimums stay exact
                    # (jobtotals.test.js)
```

Also check root `CLAUDE.md` — the "Data model" section names `Area { id, name, note, products }` nowhere, but the `floortrack-data-model` skill was updated in Task 2; confirm no stale `note` mention remains: `grep -rn "area note" CLAUDE.md src/CLAUDE.md docs/CONTEXT.md`.

- [ ] **Step 2: Full test + lint run**

Run: `npm test && npm run lint && npm run build`
Expected: all pass; the build succeeds (EstimatePrint stays statically imported — no new lazy chunks were added on the print path).

- [ ] **Step 3: Preview proof (non-negotiable 3)**

Run `npm run dev`, build the demo job (2 shared areas; Master Bath duplicated into A/B/C with different products/materials; rename B "Marble hex"), and capture with headless Chromium (`/opt/pw-browsers/chromium <url> --headless --screenshot=... --window-size=1280,2400`) or the run skill:

1. Project screen — outlines, chips, header badges, summary groups
2. Area right-click menu open
3. Preview, Compare all — the banded sheet
4. Preview, single option — flat scoped sheet + seg control
5. Order-entry picker + a scoped panel

Save to `.scratch/0XX_quote-options/` (next free number) with a one-line `ticket.md` referencing ADR 0031, or hold for the PR body. **Do not open a PR unless the owner asks.**

- [ ] **Step 4: Final commit + push**

```bash
git add -A && git commit -m "options: docs, file map, preview proof"
git push -u origin claude/multiple-quote-options-dnqloz
```

---

## Self-Review (done at plan time)

- **Spec coverage:** model/tags (T1–T2) · per-option totals + additive whole-job (T3–T4) · chips/outline/menu/duplicate/rename (T4) · header + summary groups (T5) · E1 bundles, shared-extras retitle, comparison block, sheet order (T6) · scope switch + "Print this option…" (T7) · order entry + order sheet picker with union consolidation/freight (T8) · area notes fully removed (T2 model, T4 input, T6 print) · docs/ADR (T1, T2, T9). No gaps found.
- **Placeholder scan:** the one intentional non-verbatim block is Task 3's cut-and-paste extraction and Task 6's `renderProduct` extraction — both are mechanical moves of code that already exists at cited line numbers, with the renames enumerated.
- **Type consistency:** `jobTotals(proj, rawProj, tSet, wSet, settings, books)` and its return keys are used identically in T3 test, T4 `buckets`, T7 `scopedT`, T8 `oeT/osT`. `bucketCats`/`scopedCats`/`optionShort`/`optionTitle`/`OPTION_COLOR`/`duplicateInto` signatures match T1's module across T4–T8.
