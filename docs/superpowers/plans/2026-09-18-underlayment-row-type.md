# Underlayment Row Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A sheet- or roll-sold membrane / underlayment row (Ditra Heat sheet 23031, Kerdi roll 1509781) lands from the price book as a square-foot row that orders whole sheets or rolls, can link its Materials-tab entry for install mortar, and existing count-line rows get a one-click switch.

**Architecture:** One new value in the `Product.type` enum, `"underlayment"`, flows through the existing table-driven type constants (`TYPES`/`TLBL`/`TYPE_ACCENT`), the existing carton path in `stockPatch`, and the existing carton math. The only new logic: the import word rule that types the row, a no-waste rule, a "not floor area" rule in job totals, `getUnderlay` returning null on the type (the row IS the underlayment), a pure switch-chip patch builder, and a drawer variant that lets the row name its catalog entry for install materials.

**Tech Stack:** React 18 + Vite 5, node:test (`npm test` = `node --test src/*.test.js`), eslint (`npm run lint`), Playwright + Chromium at `/opt/pw-browsers/chromium` for preview proof.

**Spec:** `docs/superpowers/specs/2026-09-18-underlayment-row-type-design.md`

## Global Constraints

- Type key is `"underlayment"`, label `"Underlayment"`, accent token `--ft-type-underlayment` (spec: Type picker, colours, print).
- No waste on the type: sheets = `ceil(sq ft ÷ cartonSf)` (spec: Quantity math).
- An underlayment row's sq ft never joins `totalSqft` / `orderedSqft`; its money joins `flooringPrice` (spec: Quantity math).
- `getUnderlay` returns null for the type; `getUnderlayInstall` unchanged (spec: Install materials).
- Import word list: `membrane`, `underlayment`, `uncoupling`, `backer`, `backerboard`; runs only where `floorTypeFromDescription` runs today plus the Schluter EFT exception gated on bundled unit + coverage + a membrane word (spec: Import).
- Nothing converts an existing row silently; the switch chip is a click (spec: Existing rows).
- Never touch live Supabase; every change lands by PR; UI change needs preview screenshots before merge (CLAUDE.md non-negotiables).
- Commit messages carry no model identifiers. Every commit ends with the two attribution lines given in the session reminder.
- Comments only for non-obvious business rules (CLAUDE.md "Code Comments").
- Branch: `claude/upbeat-shannon-t20cij`. Run `npm test` and `npm run lint` before each commit.

---

### Task 1: The type exists — constants, palette, normalizer, Settings type chips

**Files:**
- Modify: `src/uiconst.js:13-24`
- Modify: `src/index.css:57-69`, `src/index.css:364-366`, `src/index.css:388-390`, `src/index.css:418-420`
- Modify: `src/SettingsWorkspace.jsx:389`
- Modify: `src/catalog.js:25` (import only, see step 5)
- Test: `src/model.test.js`

**Interfaces:**
- Produces: `TYPES` includes `"underlayment"` (after `"carpet"`, before `"misc"`); `TLBL.underlayment === "Underlayment"`; `TYPE_ACCENT.underlayment === "var(--ft-type-underlayment)"`. `normP({ type: "underlayment" }).type === "underlayment"`.

- [ ] **Step 1: Write the failing test** — append to `src/model.test.js`:

```js
test("normP keeps the underlayment type (spec 2026-09-18)", () => {
  const p = normP({ id: "u", type: "underlayment", qtyType: "sqft", qty: "42", cartonSf: "8.4", cartonUnit: "SH" });
  assert.equal(p.type, "underlayment");
  assert.equal(p.qtyType, "sqft");
  assert.equal(p.cartonSf, "8.4");
  assert.equal(p.cartonUnit, "SH");
});
```

- [ ] **Step 2: Run it, expect failure**

Run: `node --test src/model.test.js`
Expected: FAIL — `p.type` is `"tile"` (unknown types fall back to tile).

- [ ] **Step 3: Add the type to `src/uiconst.js`** — replace lines 13-14 and the `TYPE_ACCENT` line 24:

```js
export const TYPES = ["tile", "hardwood", "vinyl", "laminate", "carpet", "underlayment", "misc"];
export const TLBL = { tile: "Tile", hardwood: "Hardwood", vinyl: "Vinyl", laminate: "Laminate", carpet: "Carpet", underlayment: "Underlayment", misc: "Miscellaneous" };
```

```js
export const TYPE_ACCENT = { tile: "var(--ft-type-tile)", hardwood: "var(--ft-type-hardwood)", vinyl: "var(--ft-type-vinyl)", laminate: "var(--ft-type-laminate)", carpet: "var(--ft-type-carpet)", underlayment: "var(--ft-type-underlayment)", misc: "var(--ft-type-misc)" };
```

Add one comment line above `TYPES`:

```js
// "underlayment" (spec 2026-09-18): a sheet/roll membrane or backer row that
// orders like carton flooring — sqft math, no grout/mortar, no waste.
```

- [ ] **Step 4: Add the palette step in `src/index.css`** — in each of the four `--ned-data-*` blocks (lines 57-58, 364-365, 388-389, 418-419) append a seventh step, and add the type token once in the product-type block (after line 68):

Light blocks (lines 57-58 and 418-419) become:
```css
  --ned-data-1:#2A3A1B; --ned-data-2:#40542A; --ned-data-3:#57703A;
  --ned-data-4:#6E8A4C; --ned-data-5:#87A363; --ned-data-6:#A4BC84; --ned-data-7:#8C9F72;
```
Dark blocks (lines 364-365 and 388-389) become:
```css
  --ned-data-1:#6B8A44; --ned-data-2:#7FA055; --ned-data-3:#93B56A;
  --ned-data-4:#A7C980; --ned-data-5:#BCDC98; --ned-data-6:#D2EEB2; --ned-data-7:#B5C89A;
```
Type token, after `--ft-type-misc` (line 68):
```css
  --ft-type-underlayment:var(--ned-data-7); /* moss 350, greyed — sits between laminate and misc */
```

- [ ] **Step 5: Keep the type out of the "applies to flooring types" chips** — `src/SettingsWorkspace.jsx:389`:

```js
  const floorTypeList = types.filter((t) => t !== "misc" && t !== "underlayment");
```

`FLOOR_TYPES` in `src/catalog.js:25` already excludes it (list is literal); no change there.

- [ ] **Step 6: Run tests + lint**

Run: `npm test && npm run lint`
Expected: all pass (the new test included).

- [ ] **Step 7: Commit**

```bash
git add src/uiconst.js src/index.css src/SettingsWorkspace.jsx src/model.test.js
git commit -m "Add the underlayment product type: constants, palette step, normalizer"
```

---

### Task 2: Quantity rules — no waste, the row is its own underlayment, warnings

**Files:**
- Modify: `src/catalog.js:97` (`wasteFor`), `src/catalog.js:250-257` (`getUnderlay`), `src/catalog.js:299-314` (`materialWarnings`)
- Test: `src/catalog.test.js`

**Interfaces:**
- Produces: `wasteFor({ type: "underlayment" }, s) === 1`; `getUnderlay(p, s) === null` when `p.type === "underlayment"`; `getUnderlayInstall` unchanged — it runs when `p.underlay.checked && p.underlay.install && p.underlay.product` and `p.qtyType === "sqft"` with `num(p.qty) > 0`; `materialWarnings` on an underlayment row never pushes `"underlay"`, and pushes `"install"` when install is on and nothing computes.

- [ ] **Step 1: Write the failing tests** — append to `src/catalog.test.js`:

```js
// --- underlayment rows (spec 2026-09-18) --------------------------------------
const membrane = (over = {}) => ({
  type: "underlayment", qtyType: "sqft", qty: "42", cartonSf: "8.4", cartonUnit: "SH", cartonManual: "", priceSqft: "1.81",
  grout: { checked: false }, mortar: { checked: false },
  underlay: { checked: false, product: "", manual: "", install: false, installMortars: {}, installSkip: {} },
  ...over,
});

test("an underlayment row takes no waste: sheets = ceil(sq ft ÷ coverage)", () => {
  const s = normalizeSettings({ waste: { tile: 10, floor: 20 } });
  assert.equal(wasteFor({ type: "underlayment" }, s), 1);
  const exact = getCarton(membrane(), s);
  assert.equal(exact.order, 5);
  assert.equal(exact.exact, 5);
  assert.equal(exact.unit, "sh");
  assert.equal(getCarton(membrane({ qty: "43" }), s).order, 6);
});

test("an underlayment row is never billed as its own underlayment", () => {
  const s = normalizeSettings({ catalog: { companies: [{ name: "Schluter", enabled: true, grouts: [], mortars: [{ name: "Schluter All Set", coverage: 60, tier1: 60, tier2: 60, tier3: 60, unit: "bags", price: 30 }], underlayments: [
    { name: "Ditra Underlayment Uncoupling Membrane", coverage: 54, unit: "rolls", price: 0, types: ["tile"], install: [{ id: "m1", kind: "mortar", product: "Schluter All Set", coverage: 50 }] },
  ] }] } });
  const p = membrane({ underlay: { checked: true, product: "Ditra Underlayment Uncoupling Membrane", manual: "", install: true, installMortars: {}, installSkip: {} } });
  assert.equal(getUnderlay(p, s), null);
  const IN = getUnderlayInstall(p, s);
  assert.equal(IN.length, 1);
  assert.equal(IN[0].kind, "mortar");
  assert.equal(IN[0].exact, 42 / 50);          // the row's own sq ft, no waste
  assert.equal(IN[0].order, 1);
  assert.deepEqual(materialWarnings(p, s), []);
});

test("an underlayment row warns on install materials that can't compute, never on itself", () => {
  const s = normalizeSettings({ catalog: { companies: [{ name: "Schluter", enabled: true, grouts: [], mortars: [], underlayments: [
    { name: "Bare entry", coverage: 54, unit: "rolls", price: 0, types: [], install: [{ id: "x1", kind: "custom", name: "Tape", coverage: 0, unit: "rolls", price: 5 }] },
  ] }] } });
  const p = membrane({ underlay: { checked: true, product: "Bare entry", manual: "", install: true, installMortars: {}, installSkip: {} } });
  assert.deepEqual(materialWarnings(p, s), ["install"]);
  assert.deepEqual(materialWarnings(membrane({ underlay: { checked: true, product: "", manual: "", install: false, installMortars: {}, installSkip: {} } }), s), []);
});
```

- [ ] **Step 2: Run them, expect failure**

Run: `node --test src/catalog.test.js`
Expected: FAIL — waste is 1.2, `getUnderlay` returns an object, warnings include `"underlay"`.

- [ ] **Step 3: Implement in `src/catalog.js`**

Replace line 97:
```js
// An underlayment row (spec 2026-09-18) orders exactly what the floor measures —
// the sheet or roll count is already the rounding, so no waste on top.
export const wasteFor = (p, s) => p?.type === "underlayment" ? 1 : 1 + num(p?.type === "tile" ? s?.waste?.tile : s?.waste?.floor) / 100;
```

In `getUnderlay` (line 250-253) change the guard:
```js
export function getUnderlay(p, s) {
  // Misc lines are flat-priced extras — no underlayment, even if a checked
  // state survives a type switch. An underlayment row IS the underlayment: its
  // catalog link only brings the install materials (getUnderlayInstall).
  if (p.type === "misc" || p.type === "underlayment" || !p.underlay?.checked) return null;
```

In `materialWarnings` (lines 305-310) replace the two underlay lines:
```js
  const U = getUnderlay(p, s);
  const ownUnderlay = p.type === "underlayment";
  if (!ownUnderlay && p.underlay?.checked && (!U || !U.product)) out.push("underlay");
  if ((ownUnderlay ? p.underlay?.checked && p.underlay?.product : U && U.product) && p.underlay?.install) {
    const defs = (s.underlayments?.[p.underlay.product]?.install || []).filter((d) => !p.underlay.installSkip?.[d.id]);
    if (defs.length && !getUnderlayInstall(p, s)) out.push("install");
  }
```

- [ ] **Step 4: Run tests + lint**

Run: `npm test && npm run lint`
Expected: all pass. The existing test "wasteFor picks tile rate for tile, floor rate for every other type" (line 118) still passes: it enumerates the four flooring types only.

- [ ] **Step 5: Commit**

```bash
git add src/catalog.js src/catalog.test.js
git commit -m "Underlayment rows: no waste, never their own underlayment, install-only warnings"
```

---

### Task 3: Import types membranes as underlayment (stock export + Schluter EFT)

**Files:**
- Modify: `src/pricebook.js:708-711` (`floorTypeFromDescription`), `src/pricebook.js:806-808` (`mappedItem` typing)
- Test: `src/pricebook.test.js:1033-1034`, `src/pricebook.test.js:1101-1115`, `src/pricebook.test.js:555-575`

**Interfaces:**
- Consumes: `COVERAGE_SOLD_RE`, `sfPerUnit`, `schluter` (all already in `mappedItem`).
- Produces: `floorTypeFromDescription("… Membrane …", size) === "underlayment"`; stock-export rows 23031 / 1509781 / 1509785 carry `type: "underlayment"`; EFT rows SLRDITRA30M, SLRDH512M, SLRDH5MA carry `type: "underlayment"`; the EFT cable SLRDHEHK12011 stays `type: null` with "10 SF" in its name.

- [ ] **Step 1: Update the existing assertions and add the new ones** in `src/pricebook.test.js`:

Line 1033-1034 becomes:
```js
  // A sheet-sold membrane has real coverage and is no FLOOR — it is underlayment
  // (spec 2026-09-18), ordered in whole sheets like a carton.
  assert.equal(floorTypeFromDescription("Schluter Ditra Heat - Membrane Sheet", '3"'), "underlayment");
  assert.equal(floorTypeFromDescription("Kerdi Membrane - KERDI200", "3'3\"x98'"), "underlayment");
  assert.equal(floorTypeFromDescription("HardieBacker 1/4 Backer Board 3x5", "36x60"), "underlayment");
```

Line 1108 (`assert.equal(roll.type, null); // a membrane is no floor`) becomes:
```js
  assert.equal(roll.type, "underlayment");      // a membrane is underlayment, not no floor
  assert.equal(by("1509785").type, "underlayment");
```
After line 1114 (`assert.equal(ditra.sfPerUnit, 8.4);`) add:
```js
  assert.equal(ditra.type, "underlayment");
```

In the EFT test after `assert.deepEqual(rowAdvisories(sheet), []);` (line ~569) add:
```js
  // Schluter EFT membranes type as underlayment too — the one typing the EFT
  // does (ADR 0041 never types profiles or accessories).
  assert.equal(sheet.type, "underlayment");
  assert.equal(heat.type, "underlayment");
  assert.equal(by("SLRDITRA30M").type, "underlayment");
```
After the cable assertions (`assert.match(cable.description, /10 SF/i);`) add:
```js
  assert.equal(cable.type, null);
```

In the test at line 1062, rename it `"a roll-sold floor types and carries its coverage; a roll of membrane types as underlayment"` and replace lines 1071-1074 with:
```js
  // A membrane has real coverage and is no FLOOR — it types as underlayment
  // (spec 2026-09-18) now that RL is a coverage-bundling unit.
  assert.equal(by("23031").type, "underlayment");
  assert.equal(by("23031").sfPerUnit, 134.5);
```
The Kerdi-Band strip (23015, no coverage) keeps `type: null` — the gate on `sfPerUnit > 0` holds.

- [ ] **Step 2: Run, expect failure**

Run: `node --test src/pricebook.test.js`
Expected: FAIL on the `"underlayment"` expectations (they read `null`).

- [ ] **Step 3: Implement the word rule** — `src/pricebook.js:708-711`, replace the membrane guard:

```js
const TYPE_UNDERLAY_RE = /\b(membranes?|underlayments?|uncoupling|backer|backerboards?)\b/i;
export function floorTypeFromDescription(text, size) {
  const t = str(text);
  // A sheet- or roll-sold membrane/backer has real coverage but is no floor:
  // it is underlayment (spec 2026-09-18), ordered whole like a carton, no
  // grout/mortar. Checked first — "Membrane Sheet" + a bare width would
  // otherwise fall to the hardwood guess.
  if (TYPE_UNDERLAY_RE.test(t)) return "underlayment";
```
(the `if (/\bmembranes?\b/i.test(t)) return null;` line is removed).

- [ ] **Step 4: Implement the EFT exception** — `src/pricebook.js:806-808` becomes:

```js
  if (!type && mapping.typeFromDescription && sfPerUnit > 0 && COVERAGE_SOLD_RE.test(str(raw.unit))) {
    type = floorTypeFromDescription(descText, size);
  }
  // The Schluter EFT never types its rows (ADR 0041) — except a coverage-
  // bearing membrane sold by the sheet or roll, which is underlayment
  // (spec 2026-09-18) from either book.
  if (!type && schluter && sfPerUnit > 0 && COVERAGE_SOLD_RE.test(str(raw.unit)) && TYPE_UNDERLAY_RE.test(descText)) type = "underlayment";
```

- [ ] **Step 5: Run the full suite + lint**

Run: `npm test && npm run lint`
Expected: all pass. If `orderbook.test.js` or `pricebooklib`-related tests assert `type: null` for a membrane row, update them the same way (`"underlayment"`) — grep `membrane` across `src/*.test.js` first.

- [ ] **Step 6: Commit**

```bash
git add src/pricebook.js src/pricebook.test.js
git commit -m "Import: sheet/roll membranes and backers type as underlayment"
```

---

### Task 4: Landing — the pick fills a sq ft row; catalog auto-link by SKU

**Files:**
- Modify: `src/catalog.js` (new export `underlaymentForSku`, after `offeredUnderlayments` at line 604)
- Test: `src/pricebook.test.js` (landing through the real pick path), `src/catalog.test.js`

**Interfaces:**
- Consumes: `parseMapped`, `detectVendorSkuAnalysis`, `KERDI_WORKBOOK` (test file), `pricedItem` (orderbook.js), `stockPatch` (stock.js).
- Produces: `underlaymentForSku(catalog, sku) → string | ""` — the name of the first enabled catalog underlayment whose `sku` equals the given SKU (case-insensitive, trimmed), else `""`. `stockPatch` needs no change.

- [ ] **Step 1: Write the landing test** — append to `src/pricebook.test.js` (imports `pricedItem` from `./orderbook.js` and `stockPatch` from `./stock.js`; add to the file's import lines if absent):

```js
test("a membrane pick lands a sq ft row ordering whole sheets/rolls (spec 2026-09-18)", () => {
  const m = detectVendorSkuAnalysis(KERDI_WORKBOOK);
  const { items } = parseMapped(KERDI_WORKBOOK[0].rows, m);
  const land = (sku) => stockPatch(pricedItem(items.find((i) => i.sku === sku), { default: 50 }), {});
  const sheet = land("23031");
  assert.equal(sheet.type, "underlayment");
  assert.equal(sheet.qtyType, "sqft");
  assert.equal(sheet.cartonSf, "8.4");
  assert.equal(sheet.cartonUnit, "SH");
  assert.equal(sheet.priceSqft, "2.56");         // retail $21.49 per sheet ÷ 8.4 sf (stockPriceSqft → round2)
  assert.equal(sheet.sizeText, "3'3\"x2'7\"");
  const roll = land("1509781");
  assert.equal(roll.type, "underlayment");
  assert.equal(roll.cartonSf, "323");
  assert.equal(roll.cartonUnit, "RL");
  // $528.10 per roll ÷ 323 sf, rounded to the cent — assert the invariant, not
  // a hand-rounded literal (1.635 sits on a rounding edge in binary).
  assert.ok(Math.abs(+roll.priceSqft * 323 - 528.1) < 323 * 0.005, roll.priceSqft);
});
```

`pricedItem` leaves a stock-export item as is (it already carries `price`, the retail column) and only stamps `markupPct`; `stockPatch` then prices the row through `stockPriceSqft` = `price ÷ sfPerUnit`.

- [ ] **Step 2: Run, expect it to pass**

Run: `node --test src/pricebook.test.js`
Expected: PASS — the type from Task 3 is all `fillsFlooring` needed; this test pins the landing. If it fails, the failure is in Task 3's typing, never a reason to touch `stockPatch`.

- [ ] **Step 3: Write the auto-link test** — append to `src/catalog.test.js`:

```js
test("underlaymentForSku finds the catalog entry carrying the picked SKU", () => {
  const s = normalizeSettings({ catalog: { companies: [
    { name: "Schluter", enabled: true, grouts: [], mortars: [], underlayments: [{ name: "Ditra Heat Membrane Sheet", coverage: 8.4, unit: "sheets", price: 0, sku: "23031", types: [] }] },
    { name: "Off", enabled: false, grouts: [], mortars: [], underlayments: [{ name: "Hidden", coverage: 1, unit: "sheets", price: 0, sku: "99999", types: [] }] },
  ] } });
  assert.equal(underlaymentForSku(s.catalog, "23031"), "Ditra Heat Membrane Sheet");
  assert.equal(underlaymentForSku(s.catalog, " 23031 "), "Ditra Heat Membrane Sheet");
  assert.equal(underlaymentForSku(s.catalog, "99999"), "");
  assert.equal(underlaymentForSku(s.catalog, ""), "");
});
```
Add `underlaymentForSku` to the import list on line 3 of `src/catalog.test.js`.

- [ ] **Step 4: Run, expect failure**

Run: `node --test src/catalog.test.js`
Expected: FAIL — `underlaymentForSku` is not exported.

- [ ] **Step 5: Implement** — `src/catalog.js`, after `offeredUnderlayments` (line 608):

```js
// The catalog underlayment a picked SKU IS (spec 2026-09-18): an underlayment
// row links its Materials-tab entry for the install materials, and a matching
// `sku` links it at pick time. Disabled companies/products never match.
export const underlaymentForSku = (catalog, sku) => {
  const k = String(sku ?? "").trim().toUpperCase();
  if (!k) return "";
  for (const co of (catalog?.companies || [])) for (const p of (co.underlayments || [])) if (isOffered(co, p) && String(p.sku ?? "").trim().toUpperCase() === k) return p.name;
  return "";
};
```

- [ ] **Step 6: Run tests + lint**

Run: `npm test && npm run lint`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/catalog.js src/catalog.test.js src/pricebook.test.js
git commit -m "Underlayment pick lands a sq ft row; catalog entry links by SKU"
```

---

### Task 5: Totals and print — money in, floor area out

**Files:**
- Modify: `src/jobtotals.js:14`
- Test: `src/jobtotals.test.js`, `src/print.test.js`

**Interfaces:**
- Consumes: `getCarton` (Task 2 waste rule), `printProduct`, `lineTotal`.
- Produces: `jobTotals(...)` — an underlayment row adds `C.order × C.sf × priceSqft` to `flooringPrice` and nothing to `totalSqft` / `orderedSqft`.

- [ ] **Step 1: Write the failing totals test** — append to `src/jobtotals.test.js`:

```js
test("an underlayment row adds money, never floor area (spec 2026-09-18)", () => {
  const membrane = { type: "underlayment", brandColor: "Schluter Ditra Heat - Membrane Sheet", qtyType: "sqft", qty: "100", priceSqft: "2.56", cartonSf: "8.4", cartonUnit: "SH", grout: { checked: false }, mortar: { checked: false }, underlay: { checked: false } };
  const cats = normC({ id: "j2", name: "J", categories: [{ name: "Bath", option: "", products: [tile(100), membrane] }] }).categories;
  const t = totals(cats);
  assert.equal(t.totalSqft, 100);                       // the tile's floor, measured once
  assert.equal(t.orderedSqft, 100);                     // tile has no carton → its own sq ft
  assert.equal(t.flooringPrice, 100 * 2 + 12 * 8.4 * 2.56);   // ceil(100 ÷ 8.4) = 12 sheets
});
```

- [ ] **Step 2: Run, expect failure**

Run: `node --test src/jobtotals.test.js`
Expected: FAIL — `totalSqft` is 200.

- [ ] **Step 3: Implement** — `src/jobtotals.js:14`, inside the `else if (p.qtyType === "sqft")` branch, replace:

```js
const sf = num(p.qty); totalSqft += sf; const C = getCarton(p, tSet); orderedSqft += C ? C.order * C.sf : sf; flooringPrice += (C ? C.order * C.sf : sf) * num(p.priceSqft);
```
with:
```js
const sf = num(p.qty); const C = getCarton(p, tSet); const own = C ? C.order * C.sf : sf; if (p.type !== "underlayment") { totalSqft += sf; orderedSqft += own; } flooringPrice += own * num(p.priceSqft);
```
Add above the `forEach` (line 13) one comment:
```js
// An underlayment row covers the floor the flooring row above it already
// measured (spec 2026-09-18): its sheets bill, its sq ft never re-count.
```

- [ ] **Step 4: Write the print test** — append to `src/print.test.js`:

```js
test("an underlayment row prints whole sheets at $/sf with its coverage tag (spec 2026-09-18)", () => {
  const p = { ...newProduct(), type: "underlayment", sku: "23031", brandColor: "Schluter Ditra Heat - Membrane Sheet", sizeText: "3'3\"x2'7\"", qty: "42", priceSqft: "2.56", cartonSf: "8.4", cartonUnit: "SH" };
  const c = printProduct(p, s);
  assert.equal(c.C.order, 5);                         // no waste: 42 ÷ 8.4 exactly
  assert.equal(c.C.exact, 5);
  assert.equal(c.qtyText, "5 sh");
  assert.equal(c.priceText, "$2.56/sf");
  assert.equal(c.line, 5 * 8.4 * 2.56);
  assert.equal(c.orderedSf, 42);
  assert.equal(c.size, "3'3\"x2'7\"");
  const row = orderEntryRow(p, s, "Bath", 0, new Set());   // same call shape as the test at line 115
  assert.match(JSON.stringify(row), /8\.4 SF\/SH/);
});
```
`qtyText` is `"5 sh"` because `getCarton` lower-cases the bundle unit (`catalog.js:212`) and `printProduct` prints `C.unit` as is.

- [ ] **Step 5: Run, expect pass**

Run: `node --test src/print.test.js`
Expected: PASS (the print path is unchanged; this pins the behaviour).

- [ ] **Step 6: Run full suite + lint, commit**

```bash
npm test && npm run lint
git add src/jobtotals.js src/jobtotals.test.js src/print.test.js
git commit -m "Underlayment rows bill their sheets and never re-count the floor's sq ft"
```

---

### Task 6: The switch chip — pure patch builder + grid chip

**Files:**
- Modify: `src/stock.js` (new export `switchToSqftPatch`, after `stockDrift` at line 414)
- Modify: `src/App.jsx:1914` (driftBlock condition) and `src/App.jsx:1934` (chip render, before `{drift && …}`)
- Test: `src/stock.test.js`

**Interfaces:**
- Consumes: `patchFor(it, p)` (App.jsx:808), `stockItem` / `oItem` (App.jsx:1864-1866), `updProduct(aid, pid, patch)`.
- Produces: `switchToSqftPatch(product, patch) → patch | null`. Given the current count-line row and the pick patch the book item would land now, returns the full patch to apply, or null when the book item still lands a count line (`patch.type === "misc"`) or the row is not a count line. Also `switchChipText(patch) → "Book sells this by the SH — 8.4 sf"`.

- [ ] **Step 1: Write the failing tests** — append to `src/stock.test.js` (add `switchToSqftPatch, switchChipText` to the import on line 3):

```js
// --- count line → sq ft switch (spec 2026-09-18) --------------------------------
test("switchToSqftPatch converts a saved count line by count × coverage and clears count fields", () => {
  const row = { type: "misc", qtyType: "count", qty: "5", sellUnit: "SH", cartonPc: "", cartonManual: "2", priceSqft: "21.49", brandColor: "Schluter Ditra Heat - Membrane Sheet", note: "bath floor", freight: "off", kitId: "" };
  const landed = { sku: "23031", type: "underlayment", qtyType: "sqft", priceSqft: "2.56", cartonSf: "8.4", cartonUnit: "SH", sizeText: "3'3\"x2'7\"", brandColor: "Schluter Ditra Heat - Membrane Sheet" };
  const patch = switchToSqftPatch(row, landed);
  assert.equal(patch.type, "underlayment");
  assert.equal(patch.qtyType, "sqft");
  assert.equal(patch.qty, "42");                 // 5 sheets × 8.4
  assert.equal(patch.cartonSf, "8.4");
  assert.equal(patch.sellUnit, "");
  assert.equal(patch.cartonPc, "");
  assert.equal(patch.cartonManual, "");
  assert.equal("note" in patch, false);          // the row's own fields are untouched
  assert.equal("freight" in patch, false);
  assert.equal(switchChipText(landed), "Book sells this by the SH — 8.4 sf");
});

test("switchToSqftPatch: blank count stays blank; a row that is already sq ft or a book item still counted returns null", () => {
  const landed = { type: "underlayment", qtyType: "sqft", cartonSf: "323", cartonUnit: "RL" };
  assert.equal(switchToSqftPatch({ type: "misc", qtyType: "count", qty: "" }, landed).qty, "");
  assert.equal(switchToSqftPatch({ type: "underlayment", qtyType: "sqft", qty: "40" }, landed), null);
  assert.equal(switchToSqftPatch({ type: "misc", qtyType: "count", qty: "3" }, { type: "misc" }), null);
  assert.equal(switchToSqftPatch({ type: "misc", qtyType: "count", qty: "3" }, null), null);
});
```

- [ ] **Step 2: Run, expect failure**

Run: `node --test src/stock.test.js`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement** — `src/stock.js`, after `stockDrift`:

```js
// A row saved as a count line whose book item now lands a sq ft row (an
// underlayment sheet/roll, spec 2026-09-18) switches over on a click, never on
// its own (ADR 0003). The typed count becomes count × coverage so the order
// stays what it was until the real footage is typed; the count-line fields go.
export function switchToSqftPatch(product, patch) {
  if (!patch || !product || product.type !== "misc" || !patch.type || patch.type === "misc" || patch.qtyType !== "sqft") return null;
  const count = parseFloat(product.qty), per = parseFloat(patch.cartonSf);
  const qty = Number.isFinite(count) && count > 0 && per > 0 ? String(round2(count * per)) : "";
  return { ...patch, qtyType: "sqft", qty, sellUnit: "", cartonPc: "", cartonManual: "" };
}
export const switchChipText = (patch) => `Book sells this by the ${bundleUnit(patch?.cartonUnit).toUpperCase()} — ${parseFloat(patch?.cartonSf) || 0} sf`;
```
`round2` and `bundleUnit` are already imported/defined in stock.js (check the top of the file; `bundleUnit` comes from `./units.js`, `round2` is local — if `round2` is missing, add `const round2 = (n) => Math.round(n * 100) / 100;` near the other helpers).

- [ ] **Step 4: Run tests**

Run: `node --test src/stock.test.js`
Expected: PASS.

- [ ] **Step 5: Wire the chip in `src/App.jsx`** — right after the `drift` line (1865) add:

```js
                        // Count line whose book item now lands a sq ft row (an underlayment
                        // sheet/roll): offer the switch, never do it silently (spec 2026-09-18).
                        const bookItem = orderRow ? oItem : stockItem;
                        const switchPatch = bookItem && p.type === "misc" ? switchToSqftPatch(p, patchFor(bookItem, p)) : null;
```
Add `switchPatch` to the `driftBlock` condition on line 1914:
```js
                        const driftBlock = (drift || oDrift || cDrift || switchPatch || p.freightFlag || stockRetired || baseAlt || p.sheoga?.cfg || wediCfg || schluterCfg) ? (
```
Render it directly before `{drift && (<>` (line 1934):
```jsx
                            {switchPatch && (<>
                              <span className="text-amber-600">{switchChipText(switchPatch)}</span>
                              <button tabIndex={-1} onClick={() => updProduct(a.id, p.id, switchPatch)} className="rounded-full border border-amber-300 text-amber-700 px-2 py-0.5 hover:bg-amber-50 font-medium">Switch to sq ft</button>
                            </>)}
```
Add `switchToSqftPatch, switchChipText` to the `./stock.js` import on line 7.

`patchFor` is declared at line 808 inside the same component scope as the row render, so it is in scope. Confirm with `grep -n "const patchFor" src/App.jsx`.

- [ ] **Step 6: Lint + full test, commit**

```bash
npm run lint && npm test
git add src/stock.js src/stock.test.js src/App.jsx
git commit -m "Count line → sq ft switch chip for rows the book now sells by coverage"
```

---

### Task 7: The drawer — Install materials on an underlayment row; auto-link at pick

**Files:**
- Modify: `src/App.jsx:808-823` (`addStockProducts`), `src/App.jsx:1822-1826` (drawer vars), `src/App.jsx:1841-1851` (`hasMats`/`addables`), `src/App.jsx:2225-2246` (drawer section)
- Modify: `src/mobile.jsx:295-299`, `src/mobile.jsx:529-545`
- Modify: `src/uiconst.js:17-18` (`underlayLabel`)

**Interfaces:**
- Consumes: `underlaymentForSku(settings.catalog, sku)` (Task 4), `offeredUnderlayments`, `getUnderlayInstall`, `KSHORT`.
- Produces: on an underlayment row the drawer section is titled "Install materials", offers every enabled catalog underlayment, has no quantity box for the underlayment itself, and the install toggle/list renders exactly as today.

- [ ] **Step 1: Label** — `src/uiconst.js:17-18`:

```js
export const UNDERLAY_LABEL = { tile: "Tile Backer", underlayment: "Install materials" };
```
`underlayLabel("underlayment")` now reads "Install materials". `KSHORT` (`src/print.js:91`) maps material labels to chip text and is what App.jsx's `addables` list reads through `KSHORT[underlayLabel(p.type)]`; add the new label so the chip never reads `undefined`:

```js
export const KSHORT = { Grout: "Grout", "Grout base": "Base", Caulk: "Caulk", Mortar: "Mortar", "Tile Backer": "Backer", Underlayment: "Underlay", "Install materials": "Install", Install: "Install" };
```

- [ ] **Step 2: Offer every entry on an underlayment row** — `src/catalog.js` `offeredUnderlayments` (line 604):

```js
export const offeredUnderlayments = (catalog, type) => {
  const names = [];
  // An underlayment row picks its own identity, so no flooring-type filter.
  for (const co of (catalog?.companies || [])) for (const p of (co.underlayments || [])) if (isOffered(co, p) && (type === "underlayment" || !(p.types || []).length || p.types.includes(type))) names.push(p.name);
  return names;
};
```
Add to `src/catalog.test.js`:
```js
test("offeredUnderlayments: an underlayment row is offered every enabled entry", () => {
  const s = normalizeSettings({ catalog: { companies: [{ name: "X", enabled: true, grouts: [], mortars: [], underlayments: [
    { name: "Tile only", coverage: 1, unit: "rolls", price: 0, types: ["tile"] },
    { name: "Any", coverage: 1, unit: "rolls", price: 0, types: [] },
  ] }] } });
  assert.deepEqual(offeredUnderlayments(s.catalog, "vinyl"), ["Any"]);
  assert.deepEqual(offeredUnderlayments(s.catalog, "underlayment"), ["Tile only", "Any"]);
});
```
Run `node --test src/catalog.test.js` — expect PASS after the change.

- [ ] **Step 3: Drawer on desktop** — `src/App.jsx`:

(a) `toggleUnderlay` (line 1826): on an underlayment row, checking also turns install on, since the entry's only job here is its install materials:
```js
                        const ownUnderlay = p.type === "underlayment";
                        const toggleUnderlay = () => updProduct(a.id, p.id, { underlay: { ...p.underlay, checked: !p.underlay.checked, install: ownUnderlay ? !p.underlay.checked : p.underlay.install, product: p.underlay.checked ? p.underlay.product : (p.underlay.product || underlayDefault) } });
```
(b) In the drawer section (line 2225-2241): the select stays; the quantity span and `QtyDriftNote` hide on an underlayment row. Wrap the `<span className="ml-auto …">…</span>` and `{uDrift && …}` pair:
```jsx
                                      {!ownUnderlay && (<>
                                      <span className="ml-auto flex items-center gap-1 text-sm shrink-0" style={{ color: accent }}>…unchanged…</span>
                                      {uDrift && <QtyDriftNote d={uDrift} unit={underlayUnit} onUse={() => updProduct(a.id, p.id, { underlay: { ...p.underlay, manual: "" } })} />}
                                      </>)}
```
(c) The "No … products for {TLBL[p.type]} yet" message reads oddly on the type; on an underlayment row use: `No catalog underlayments yet — add them in Settings.`:
```jsx
                                          <span className="text-amber-500 text-xs">{ownUnderlay ? "No catalog underlayments yet — add them in Settings." : `No ${underlayLabel(p.type).toLowerCase()} products for ${TLBL[p.type]} yet — add them in Settings.`}</span>
```
(d) `WLBL.underlay` (line 1832) on an underlayment row is never pushed (Task 2); no change.

- [ ] **Step 4: Auto-link at pick** — `src/App.jsx:817-820` inside `addStockProducts`:

```js
    // An underlayment pick links its Materials-tab entry by SKU so the install
    // mortar comes along (spec 2026-09-18); no match leaves the drawer unchecked.
    const link = (p, patch) => {
      if (patch.type !== "underlayment") return patch;
      const name = underlaymentForSku(settings.catalog, patch.sku);
      return name ? { ...patch, underlay: { ...p.underlay, checked: true, product: name, install: true } } : patch;
    };
    const products = a.products.flatMap((p) => p.id !== pid ? [p] : [
      { ...p, ...link(p, patchFor(expanded[0], p)) },
      ...expanded.slice(1).map((it) => { const np = newProduct(); return { ...np, ...link(np, patchFor(it, np)) }; }),
    ]);
```
Add `underlaymentForSku` to the `./catalog.js` import in App.jsx. Apply the same `link` to the switch chip in Task 6: change its click to `updProduct(a.id, p.id, link(p, switchPatch))` — move `link` above the row render (declare it next to `patchFor` at line 808 so both sites share it).

- [ ] **Step 5: Mobile** — `src/mobile.jsx`:

Line 299 `toggleUnderlay`:
```js
  const ownUnderlay = p.type === "underlayment";
  const toggleUnderlay = () => onPatch({ underlay: { ...p.underlay, checked: !p.underlay.checked, install: ownUnderlay ? !p.underlay.checked : p.underlay.install, product: p.underlay.checked ? p.underlay.product : (p.underlay.product || underlayDefault) } });
```
Lines 537-541: hide the quantity override on an underlayment row and use the catalog wording:
```jsx
                      <span className="text-amber-500 text-xs">{ownUnderlay ? "No catalog underlayments yet — add them in Settings." : `No ${underlayLabel(p.type).toLowerCase()} products for ${TLBL[p.type]} yet — add them in Settings.`}</span>
…
                    {!ownUnderlay && qtyOverride(uEx, U ? String(U.order) : "", underlayUnit, (v) => onPatch({ underlay: { ...p.underlay, manual: v } }))}
```
Mobile's row sheet is fed `onPickStock` from App (`addStockProducts`), so the auto-link applies there too. Mobile shows no drift chips today; the switch chip stays desktop-only (spec: "beside the price-book drift chip").

- [ ] **Step 6: Lint + tests**

Run: `npm run lint && npm test`
Expected: pass. Then `npm run build` — expected: builds with no error (App.jsx has no unit tests; the build catches JSX mistakes).

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx src/mobile.jsx src/uiconst.js src/print.js src/catalog.js src/catalog.test.js
git commit -m "Underlayment rows: Install materials drawer, catalog auto-link at pick"
```

---

### Task 8: Preview proof (non-negotiable 3)

**Files:**
- Create: `.scratch/144_underlayment-row-type/proof.html`, `.scratch/144_underlayment-row-type/proof-entry.jsx`, `.scratch/144_underlayment-row-type/proof-vite.config.mjs`, `.scratch/144_underlayment-row-type/shot.mjs`
- Output (committed): `.scratch/144_underlayment-row-type/01-grid.png`, `02-switch-after.png`, `03-drawer.png`, `04-print.png`
- Never commit: `.scratch/144_underlayment-row-type/proof-dist/`

**Interfaces:**
- Consumes: the real `printProduct`, `getCarton`, `switchToSqftPatch`, `UnitPick`, `MobileRowSheet`, `EstimatePaper` (`src/EstimatePrint.jsx`) — no copied markup where a real component can render.

- [ ] **Step 1: Copy the 138 harness as a base**

```bash
mkdir -p .scratch/144_underlayment-row-type
cp .scratch/138_coverage-unit-picker/proof.html .scratch/138_coverage-unit-picker/proof-vite.config.mjs .scratch/138_coverage-unit-picker/shot.mjs .scratch/144_underlayment-row-type/
sed -i 's#138_coverage-unit-picker#144_underlayment-row-type#g' .scratch/144_underlayment-row-type/proof-vite.config.mjs .scratch/144_underlayment-row-type/shot.mjs
```

- [ ] **Step 2: Write `proof-entry.jsx`** — four cards, each `data-testid`:

```jsx
// Preview proof (2026-09-18): the underlayment row type. Real components over
// fixed rows; Playwright clicks the switch chip. Built by proof-vite.config.mjs,
// never shipped with the app.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { UnitPick } from "../../src/grid.jsx";
import { MobileRowSheet } from "../../src/mobile.jsx";
import { EstimatePaper } from "../../src/EstimatePrint.jsx";
import { normalizeSettings, getCarton, getUnderlayInstall, num, withProjWaste } from "../../src/catalog.js";
import { switchToSqftPatch, switchChipText } from "../../src/stock.js";
import { printProduct } from "../../src/print.js";
import { jobTotals } from "../../src/jobtotals.js";
import { tierView } from "../../src/pricing.js";
import { newProduct, newProject, newArea, normC } from "../../src/model.js";
import { bundleUnit, BUNDLE_UNITS } from "../../src/units.js";
import "../../src/index.css";

const settings = normalizeSettings({ catalog: { companies: [{ name: "Schluter", enabled: true, grouts: [], mortars: [{ name: "Schluter All Set", coverage: 60, tier1: 60, tier2: 60, tier3: 60, unit: "bags", price: 32.5 }], underlayments: [
  { name: "Ditra Heat Membrane Sheet", coverage: 8.4, unit: "sheets", price: 0, sku: "23031", types: [], install: [{ id: "m1", kind: "mortar", product: "Schluter All Set", coverage: 50 }] },
] }] } });
const row = (over) => ({ ...newProduct(), ...over });
const SHEET = row({ type: "underlayment", sku: "23031", brandColor: "Schluter Ditra Heat - Membrane Sheet", sizeText: "3'3\"x2'7\"", qty: "42", priceSqft: "2.56", cartonSf: "8.4", cartonUnit: "SH",
  underlay: { checked: true, product: "Ditra Heat Membrane Sheet", manual: "", install: true, installMortars: {}, installSkip: {} } });
const OLD = row({ type: "misc", qtyType: "count", sku: "23031", brandColor: "Schluter Ditra Heat - Membrane Sheet", qty: "5", sellUnit: "SH", priceSqft: "21.49" });
const LANDED = { sku: "23031", type: "underlayment", qtyType: "sqft", priceSqft: "2.56", cartonSf: "8.4", cartonUnit: "SH", sizeText: "3'3\"x2'7\"", brandColor: "Schluter Ditra Heat - Membrane Sheet" };
const TILE = row({ type: "tile", brandColor: "Daltile Arctic White 12x24", L: "12", W: "24", qty: "42", priceSqft: "4.79", cartonSf: "15.5" });

function GridCard({ init, testid, label }) {
  const [p, setP] = useState(init);
  const upd = (patch) => setP((c) => ({ ...c, ...patch }));
  const C = getCarton(p, settings);
  const sw = p.type === "misc" ? switchToSqftPatch(p, LANDED) : null;
  return (
    <div className="card" data-testid={testid}>
      <div className="cap">{label}</div>
      <div className="rowframe" style={{ display: "grid", gridTemplateColumns: "3fr 0.9fr 0.9fr 1.1fr", fontSize: 11, fontWeight: 600 }}>
        <div className="gc">{p.brandColor}</div>
        <div className="gc ft-mono" style={{ fontSize: 9.5 }}>
          {p.qtyType === "sqft" ? (<><input type="number" value={p.cartonSf} onChange={(e) => upd({ cartonSf: e.target.value })} data-c="cov" className="ft-cell text-right" style={{ flex: 1, minWidth: 0 }} />{num(p.cartonSf) > 0 && <UnitPick prefix="SF/" value={bundleUnit(p.cartonUnit)} options={BUNDLE_UNITS} onChange={(v) => upd({ cartonUnit: v })} />}</>) : <span style={{ color: "var(--ft-faint)" }}>—</span>}
        </div>
        <div className="gc"><input type="number" value={p.qty} onChange={(e) => upd({ qty: e.target.value })} data-c="sf" className="ft-cell text-right" /><span style={{ fontSize: 9 }}>{p.qtyType === "sqft" ? "sf" : p.sellUnit.toLowerCase()}</span></div>
        <div className="gc r b" data-c="order">{C ? `${C.order} ${C.unit.toUpperCase()} (${C.exact.toFixed(2)})` : `${p.qty} ${p.sellUnit}`}</div>
      </div>
      {sw && <div className="ft-noprint flex items-center gap-2 text-xs" style={{ padding: "4px 2px" }}><span className="text-amber-600">{switchChipText(sw)}</span><button data-c="switch" onClick={() => upd(sw)} className="rounded-full border border-amber-300 text-amber-700 px-2 py-0.5 font-medium">Switch to sq ft</button></div>}
      <div className="stored">stored: <code>type: "{p.type}"</code> <code>qtyType: "{p.qtyType}"</code> <code>qty: "{p.qty}"</code> <code>cartonSf: "{p.cartonSf}"</code> · prints as <code>{printProduct(p, settings).qtyText}</code> · <code>{printProduct(p, settings).priceText}</code></div>
    </div>
  );
}

function DrawerCard() {
  const IN = getUnderlayInstall(SHEET, settings) || [];
  return (
    <div className="card" data-testid="drawer">
      <div className="cap">Install materials on the underlayment row (real getUnderlayInstall)</div>
      <div className="note">Entry: Ditra Heat Membrane Sheet (SKU 23031, auto-linked) · install: Schluter All Set @ 50 sf/bag off the row's 42 sf</div>
      {IN.map((m) => <div key={m.defId} className="text-xs" style={{ color: "#3B3934" }}>{m.name} — {m.order} {m.unit} (exact {m.exact.toFixed(2)})</div>)}
    </div>
  );
}

function PrintCard() {
  const proj = normC({ ...newProject(), id: "p1", name: "Q-Ditra Heat proof", categories: [{ ...newArea(), name: "Bath", products: [TILE, SHEET] }] });
  const wSet = withProjWaste(settings, proj);
  const tv = tierView(proj, settings);
  const T = jobTotals(tv.proj, proj, wSet, wSet, settings, []);
  return (
    <div className="card" data-testid="print" style={{ background: "#fff" }}>
      <EstimatePaper sel={proj} people={[]} profile={{ name: "Proof", phone: "", email: "" }} tv={tv} jobWaste={{}} pMats={T.pMats} tSet={wSet} materialsCost={T.materialsCost} freightCost={0} flooringPrice={T.flooringPrice} miscCost={T.miscCost} totalSqft={T.totalSqft} orderedSqft={T.orderedSqft} grandTotal={T.grandTotal} />
    </div>
  );
}

const url = new URL(location.href);
createRoot(document.getElementById("desktop")).render(url.searchParams.has("print") ? <PrintCard /> : (<>
  <GridCard init={SHEET} testid="grid" label="Picked today: Ditra Heat sheet, 42 sf typed → 5 SH" />
  <GridCard init={OLD} testid="old" label="Saved before: the count line Marcus flagged — the switch chip" />
  <DrawerCard />
</>));
```
If `tierView` / `jobTotals` / `EstimatePaper` need a prop this snippet does not pass, read their signatures (`src/pricing.js`, `src/jobtotals.js:8-14`, `src/EstimatePrint.jsx:13`) and pass what App.jsx passes at line 1283. Edit `proof.html`'s `<h1>`/`<p class="sub">` to describe this proof and drop the `#mobile` column.

- [ ] **Step 3: Write `shot.mjs`** — replace the body after the `page.goto(base)` line:

```js
console.log("grid order:", await page.locator('[data-testid="grid"] [data-c="order"]').textContent());
console.log("old  order:", await page.locator('[data-testid="old"] [data-c="order"]').textContent());
await page.screenshot({ path: `${dir}01-grid.png`, fullPage: true });
await page.locator('[data-testid="old"] [data-c="switch"]').click(); await page.waitForTimeout(200);
console.log("old after:", await page.locator('[data-testid="old"] [data-c="order"]').textContent());
const stored = await page.$$eval(".stored", (els) => els.map((e) => e.textContent.trim())); stored.forEach((s) => console.log("  ", s));
await page.screenshot({ path: `${dir}02-switch-after.png`, fullPage: true });
await page.locator('[data-testid="drawer"]').screenshot({ path: `${dir}03-drawer.png` });
await page.goto(base + "?print"); await page.waitForTimeout(800); await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `${dir}04-print.png`, fullPage: true });
await browser.close();
```

- [ ] **Step 4: Build, serve, shoot**

```bash
npx vite build --config .scratch/144_underlayment-row-type/proof-vite.config.mjs
(python3 -m http.server 8392 -d .scratch/144_underlayment-row-type/proof-dist >/dev/null 2>&1 &) ; sleep 1
node .scratch/144_underlayment-row-type/shot.mjs
```
Expected console: `grid order: 5 SH (5.00)`, `old order: 5 SH` → after click `5 SH (5.00)` with `qty: "42"`, `qtyType: "sqft"`. Open each PNG with the Read tool and check: the coverage cell reads `8.4 SF/SH`, the chip reads "Book sells this by the SH — 8.4 sf", the drawer lists "Schluter All Set — 1 bags (exact 0.84)", the print shows the membrane line as "5 SH" beside "$2.56/sf" and "42 SF measured" once. Fix and re-shoot until every check holds; a screenshot that shows the wrong thing is a bug, not proof.

- [ ] **Step 5: Commit the harness and the PNGs (not proof-dist)**

```bash
echo "proof-dist/" > .scratch/144_underlayment-row-type/.gitignore
git add .scratch/144_underlayment-row-type
git commit -m "Preview proof: underlayment row, switch chip, install drawer, printed line"
```

---

### Task 9: Records — ADR 0043, ADR 0029 note, data-model skill, file map, issue ticket

**Files:**
- Create: `docs/adr/0043-underlayment-product-type.md`
- Modify: `docs/adr/README.md` (append a row), `docs/adr/0029-erp-stock-sell-basis-from-uom.md` (Consequences), `.claude/skills/floortrack-data-model/SKILL.md:119`, `:140`, `:193`, `src/CLAUDE.md:28`, `:134`, `:415`, `:425`, `:486`
- Create: `.scratch/144_underlayment-row-type/ticket.md`

- [ ] **Step 1: Write the ADR** — `docs/adr/0043-underlayment-product-type.md`:

```markdown
# ADR 0043 — Underlayment is a product type: sheet/roll membranes order like carton flooring

- **Status:** Accepted
- **Date:** 2026-09-18
- **Scope:** system-wide (`Product.type` enum; import typing in `src/pricebook.js`; carton math in `src/catalog.js`; totals in `src/jobtotals.js`)
- **Related:** amends ADR 0029 ("a membrane is no floor" → a membrane is underlayment); ADR 0013 (carton semantics the row inherits); ADR 0003 (the switch chip never heals silently); ADR 0041 (the Schluter EFT typing exception).
- **Spec:** `docs/superpowers/specs/2026-09-18-underlayment-row-type-design.md`

## Context

Marcus flagged the Ditra Heat membrane sheet (23031) on a 9/18 Quick Price:
the book reads 8.4 sf per sheet out of the description, but a membrane was
deliberately untyped at import, a typeless row fails `fillsFlooring`, and the
pick landed a per-piece count line with the coverage dropped. The owner
added the Kerdi roll (1509781, 323 sf/RL) and asked for carton behaviour —
"input how much sf I want and it figures the amount needed" — that also
"works together with Underlayments in the materials tab".

## Decision

1. **`"underlayment"` is a product type** beside the five flooring types and
   Misc. A sheet- or roll-sold row with real coverage whose description names
   a membrane, underlayment, uncoupling mat or backer imports with it — from
   the ERP stock export (ADR 0029's `typeFromDescription` gate) and, as the
   one typing exception, from the Schluter EFT. EA accessories (the heat
   cable) stay untyped count lines.
2. **It lands and orders like carton flooring:** `qtyType: "sqft"`,
   `priceSqft` = per-unit price ÷ coverage, `cartonSf`/`cartonUnit` from the
   book, whole SH/RL out. Nothing new is stored.
3. **No waste** on the type (`wasteFor` = 1). The sheet count is already the
   rounding; the owner chose this over the floor rate.
4. **Not floor area:** `jobTotals` adds the row's money to `flooringPrice`
   and never its sq ft to `totalSqft`/`orderedSqft` — the floor was measured
   by the flooring row above it.
5. **The row is its own underlayment.** `getUnderlay` returns null on the
   type; the drawer's section reads "Install materials", the row names its
   Materials-tab entry (auto-linked by SKU at pick), and that entry's install
   items compute off the row's own sq ft through the unchanged
   `getUnderlayInstall`. Grout/mortar stay tile-only; add-on categories
   filter on `FLOOR_TYPES`, which excludes it.
6. **Existing count lines switch on a click**, never on their own: a chip
   reads "Book sells this by the SH — 8.4 sf · Switch to sq ft" and re-lands
   the row from the book, converting count × coverage to sq ft so the order
   holds until the real footage is typed.

## Alternatives rejected

- A sq ft mode on a Misc line — ten files of "misc means counted" gates to
  re-teach, and the print would still say Miscellaneous.
- Attaching the membrane as the tile row's underlayment — needs a catalog
  entry per product and is not the "search it in, type sq ft" flow.

## Consequences

- Already-imported books keep `type: null` on these rows until re-dropped
  (the normal refresh); saved rows keep their snapshot until switched.
- The keyword list is a heuristic like ADR 0029's; an unlisted wording lands
  a count line — visible, never mispriced.
- Trowels and other per-order tools are a follow-up (a fixed-quantity
  install item kind).
```

Append to `docs/adr/README.md`:
```markdown
| [0043](0043-underlayment-product-type.md) | Underlayment is a product type: sheet/roll membranes and backers import typed, land like carton flooring (no waste, never floor area), link their Materials-tab entry for install materials; saved count lines switch on a click | Accepted | 2026-09-18 |
```

Append to ADR 0029's Consequences:
```markdown
- **Amended 2026-09-18 (ADR 0043):** "a membrane is no floor" now types the
  row as `underlayment` rather than leaving it untyped — the same gate
  (bundled unit + coverage), a different landing.
```

- [ ] **Step 2: Data-model skill** — `.claude/skills/floortrack-data-model/SKILL.md`:

Line 119: `Product  { id, type:"tile|hardwood|vinyl|laminate|carpet|underlayment|misc",`
After line 140 (`underlay:{checked,product,manual,install},`) add the comment block:
```
           // On an `underlayment` row (ADR 0043) `underlay.product` names the
           // row's OWN Materials-tab entry (auto-linked by SKU at pick) and
           // only its install items compute (getUnderlayInstall); getUnderlay
           // is null there — the row is the underlayment, never billed twice.
```
Line 193's `cartonSf` comment: change "(any type but misc;" to "(any type but misc — an underlayment row takes it with no waste, ADR 0043;".

- [ ] **Step 3: File map** — `src/CLAUDE.md`: add to the `uiconst.js` entry (line 28) "…TYPES/TLBL (incl. `underlayment`, ADR 0043)…"; to `jobtotals.js` (134) "an underlayment row bills its sheets, never re-counts floor sq ft (ADR 0043)"; to `catalog.js` (415) "`wasteFor` = 1 on underlayment rows; `getUnderlay` null there, `underlaymentForSku` links the row's own entry (ADR 0043)"; to `pricebook.js` (425) "membrane/backer rows with bundled coverage type `underlayment` on both the stock export and the Schluter EFT (ADR 0043)"; to `stock.js` (486) "`switchToSqftPatch`/`switchChipText` — the count-line → sq ft chip (ADR 0043)".

- [ ] **Step 4: Issue ticket** — `.scratch/144_underlayment-row-type/ticket.md`:

```markdown
---
issue_type: Feature
summary: Sheet/roll membranes (Ditra Heat sheet 23031, Kerdi roll 1509781)
  land as an Underlayment row that orders whole sheets/rolls from typed sq ft,
  links its Materials-tab entry for install mortar, and saved count lines
  switch over on a click.
status: done
labels: [ready-for-human]
---

# Underlayment row type

Marcus, 9/18/2026, on "Q-120V Ditra Heat Cable 42.7 sf-9/18 · Area 1 ·
Schluter Ditra Heat - Membrane Sheet": "it would nice if this showed
coverage." Owner: "1509781 same for this sku"; then "can this be done like a
carton of tile where I can input how much sf I want and it figures the
amount needed"; label Underlayment so it "can work together with
Underlayments in the materials tab … figure mortar and trowels"; no waste;
trowels later; switch chip converts count × coverage.

Spec: `docs/superpowers/specs/2026-09-18-underlayment-row-type-design.md`.
ADR: `docs/adr/0043-underlayment-product-type.md`.

## Proof

`01-grid.png` — the picked sheet row: `8.4 SF/SH`, 42 sf typed, `5 SH (5.00)`.
`02-switch-after.png` — the saved count line after "Switch to sq ft":
`qty: "42"`, `qtyType: "sqft"`, order unchanged at 5 SH.
`03-drawer.png` — Install materials off the row's own sq ft.
`04-print.png` — the printed line "5 SH · $2.56/sf", floor sq ft measured once.

Rebuild: `npx vite build --config .scratch/144_underlayment-row-type/proof-vite.config.mjs`,
serve `proof-dist` on :8392, `node .scratch/144_underlayment-row-type/shot.mjs`.

## Follow-ups

- Trowels / per-order tools: a fixed-quantity install item kind (Settings).
- Mobile has no drift chips, so the switch chip is desktop-only.
```

- [ ] **Step 5: Commit, push, open the PR**

```bash
git add docs/adr .claude/skills/floortrack-data-model/SKILL.md src/CLAUDE.md .scratch/144_underlayment-row-type/ticket.md
git commit -m "Record ADR 0043 (underlayment product type), data model, file map, issue 144"
git push -u origin claude/upbeat-shannon-t20cij
```
Then open the PR with the GitHub MCP tools (title "Underlayment row type: sheet/roll membranes order like carton flooring"), body: the spec summary, the four PNGs referenced by path, the test commands run, the ADR link, and the session attribution lines. Subscribe to PR activity.
