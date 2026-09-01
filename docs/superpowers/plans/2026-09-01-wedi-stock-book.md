# wedi Stock Book Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make wedi's stocked range come from a live stock-kind registry price book instead of the hand-transcribed `WEDI_STOCK` table, keeping the table as a visible, never-silent fallback.

**Architecture:** A new `src/wediadapter.js` maps normalized registry rows into the six-field `stockRow` shape `makeEntry` already consumes. `src/wedi.js` gains a source installer (`setStockSource`/`clearStockSource`) that swaps the rows `buildCatalog` reads and clears the `CAT`/`INDEX` memo; with nothing installed it builds from `WEDI_STOCK` exactly as today. A new `src/usewedicatalog.js` hook owns fetch, the three-way readiness gate, and the install, mirroring `useschlutercatalog.js`. The pricelist half (`WEDI_SO`) is untouched and keeps feeding `soRow`.

**Tech Stack:** ES modules, React 18, `node:test` + `node:assert/strict`, SheetJS (`xlsx` ^0.18.5) for the offline fixture generator only.

**Spec:** `docs/superpowers/specs/2026-09-01-wedi-stock-book-design.md`

---

## Global Constraints

- **The engine's public surface does not change.** `catalog()`, `item(key)`, `group(g)`, `pans(opts)` keep their current zero-/single-argument signatures. All 29 call sites in `WediConfigurator.jsx` stay as written. (Spec decision 4.)
- **`WEDI_STOCK` stays in the file.** It is the fallback when no wedi book exists. Do not delete it, do not shrink it. (Spec decision 3.)
- **`WEDI_SO` and the pricelist half are out of scope.** `classify`, `kitFor`, `solve`, `panelPlan`, bench and curb geometry, `lineItems` — unchanged. (Spec decision 4; 8b owns the pricelist.)
- **The 43 pinned tests in `src/wedi.test.js` must not move.** No expected number in that file may be edited. It asserts 151 stock entries, 269 total, 0 in `misc`, unique keys, every entry priced.
- **Baseline to preserve:** 1211 tests passing, 0 failing; `npm run build` exit 0; lint unchanged at the 7 pre-existing errors.
- **No import-code changes.** `src/pricebook.js` and `src/orderbook.js` are read-only for this work. The book is created and imported by the owner in the app, by hand.
- **An agent never touches the live project.** Ship code and instructions only.
- **Book match rule:** `/wedi/i` against the book's `name` or `data.brandLabel`, kind `stock`. (Spec, Answered 1.)
- **Run a single test file with** `node --test src/<name>.test.js`. `npm test` globs and cannot take a file argument.

### Corrections to the spec, verified against the real workbook

These three findings were measured against `WEDI 1.xlsx` and the committed `WEDI_STOCK`. Where this plan and the spec disagree, **this plan is correct** and Task 7 amends the spec.

1. **No `FIX` table.** The spec's `const FIX = { US50000005: "US5000005" }` is backwards. `WEDI_STOCK` entry `28954` holds `us: "US50000005"` — the transcription did *not* correct the typo; `wedi.js:4331` carries compensating code that depends on it. Applying `FIX` produces 1 mismatch in 151. Removing it produces **0 mismatches in 151**. The spec's evidence came from `WEDI_SO` (the pricelist table, which does hold `US5000005` at `wedi.js:3637`), not from the stock table under test.
2. **`us` derives from `vendorSkus`, not the raw Supplier/Mfg columns.** `normFits` dedupes and **sorts** `vendorSkus`, so column order does not survive normalization. Verified: sourcing from the sorted array reproduces all 151 `us` values, because the `US`-shaped preference is order-independent and the `codes[0]` fallback never faces a tie (0 rows have 2+ candidates and no `US`-shaped code).
3. **`description` is lossy — the acceptance test cannot be a literal deep-equal.** `splitSizeFromDescription` (`pricebook.js:532`) always runs and reassigns `descText = split.name`, moving leading dimensions into `size`/`thickness`/`sfPerUnit`. 105 of 151 descriptions differ (`5"x82' Wedi Mesh Tape` → `Wedi Mesh Tape`). Disabling `leadWidthSize`/`sfFromDescription` makes it **worse** — 84 differ *and* the dimensions are no longer captured anywhere. Since `makeEntry` parses `w`/`d`/`t` out of `stockRow.desc`, and for stock-only entries it is the sole dimension source, the adapter must **reconstruct** a dimension-bearing `desc`. Acceptance therefore compares every derived field, with `desc` compared structurally (Task 4).

### Measured facts this plan relies on

- `WEDI_STOCK` has **151** entries, six fields each: `{erp, desc, cost, retail, unit, us}`. No optional fields.
- The workbook has **152** data rows; the extra is `29WEDIT` ("Wedi", $0/$0, no vendor codes) — a custom-item placeholder the owner has confirmed is out of scope. It is the only row deriving an empty `us`, so **"drop rows with no derivable `us`" drops exactly it**.
- **Zero cost/retail drift** across all 151 rows. Prices match to the cent.
- `1518104`/`1518105` are **samples** (cost $0, retail $100) — deliberate, not artifacts. The pinned "every entry priced" assertion already exempts them via `/sample/i`.
- 7 rows legitimately carry a non-`US` article number as `us`: `47815`, `28955`, `47733`, `29244`, `28873`, `28874`, `29073`.
- The real import reproduces the spec's numbers exactly: 152 items, 2 warnings.

---

## File Structure

| File | Responsibility |
|---|---|
| `.scratch/119_wedi-stock-book/tools/gen-fixture.mjs` | **Create.** Offline generator: real workbook → real `detectVendorSkuAnalysis`/`parseMapped`/`bookItemData` → the committed fixture. Provenance, not production. |
| `src/wedifixture.js` | **Create.** The frozen snapshot of 152 persisted `price_book_items`-shaped rows. Committed the way `schluterfixture.js` is, so the suite needs no Supabase and no workbook. |
| `src/wediadapter.js` | **Create.** The only file that sees a raw book row. `usOf`, `descOf`, `adaptRow`, `adaptBookRows`. |
| `src/wediadapter.test.js` | **Create.** Unit tests for the derivation and reconstruction rules. |
| `src/wedi.js` | **Modify.** Parameterize `buildCatalog`; add `setStockSource`/`clearStockSource`/`stockSourceIsBook`. Nothing else. |
| `src/usewedicatalog.js` | **Create.** LAZY-CHUNK-ONLY hook: book discovery, row fetch, the three-way gate, the install. |
| `src/WediConfigurator.jsx` | **Modify.** Call the hook; gate on readiness; show the fallback marker. |
| `docs/adr/0036-wedi-stock-side-registry-driven.md` | **Create.** Records the move. |
| `docs/adr/0032-schluter-registry-driven-pricing.md` | **Modify.** Superseded-by note on consequence 3. |
| `docs/superpowers/specs/2026-09-01-wedi-stock-book-design.md` | **Modify.** The three corrections above. |

---

## Task 1: The fixture and its generator

**Files:**
- Create: `.scratch/119_wedi-stock-book/tools/gen-fixture.mjs`
- Create: `src/wedifixture.js`
- Test: `src/wediadapter.test.js` (first two tests only)

**Interfaces:**
- Produces: `FIXTURE_ROWS` — an array of 152 `{ sku, active: true, data }` objects, the persisted `price_book_items` shape. Tests turn them into live rows with `normBookItem(row, "bk_wedi")`.

The generator is committed for provenance (the Schluter fixture's missing generator is a known gap — see `.scratch/097_schluter-configurator/`). It is never imported by `src/`.

- [ ] **Step 1: Write the generator**

Create `.scratch/119_wedi-stock-book/tools/gen-fixture.mjs`:

```js
// Regenerates src/wedifixture.js from the owner's workbook. Run by hand when a
// new export lands; never imported by src/. Mirrors src/fileread.js:8 exactly,
// including defval:null — the recognizer indexes by absolute column number.
//   node .scratch/119_wedi-stock-book/tools/gen-fixture.mjs "<path to WEDI 1.xlsx>"
import { createRequire } from "module";
import fs from "fs";
import path from "path";
const require = createRequire(import.meta.url);
const XLSX = require("xlsx");
const { detectVendorSkuAnalysis, parseMapped } = await import("../../../src/pricebook.js");
const { bookItemData } = await import("../../../src/orderbook.js");

const file = process.argv[2];
if (!file) { console.error("usage: gen-fixture.mjs <workbook.xlsx>"); process.exit(1); }

const wb = XLSX.read(fs.readFileSync(file), { type: "buffer" });
const sheets = wb.SheetNames.map((name) => ({
  name, rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }),
}));
const mapping = detectVendorSkuAnalysis(sheets);
if (!mapping) { console.error("recognizer did not match — is this the Vendor SKU Analysis export?"); process.exit(1); }
const rows = sheets.find((s) => s.name === mapping.sheet).rows;
const { items, warnings } = parseMapped(rows, mapping);
console.error(`sheet: ${mapping.sheet} | items: ${items.length} | warnings: ${warnings.length}`);
warnings.forEach((w) => console.error("  WARN:", w));

const out = items.map((it) => ({ sku: it.sku, active: true, data: bookItemData(it) }));
const body = out.map((r) => " " + JSON.stringify(r)).join(",\n");
const header = `// test fixture — the ${new Date().toISOString().slice(0, 10)} wedi stock-export snapshot,\n`
  + "// as price_book_items rows (sku + active + the jsonb data payload). Production\n"
  + "// reads the live registry book, NEVER this file. Regenerate with\n"
  + "// .scratch/119_wedi-stock-book/tools/gen-fixture.mjs\n\n"
  + "export const FIXTURE_ROWS = [\n";
fs.writeFileSync(path.resolve(import.meta.dirname, "../../../src/wedifixture.js"), header + body + "\n];\n");
console.error("wrote src/wedifixture.js");
```

- [ ] **Step 2: Run it against the owner's workbook**

```bash
node .scratch/119_wedi-stock-book/tools/gen-fixture.mjs "C:/Users/User/OneDrive/TransferOneDrive/WEDI 1.xlsx"
```

Expected on stderr, exactly:

```
sheet: Vendor SKU Analysis | items: 152 | warnings: 2
  WARN: 3 rows with a $0 price on the sheet — landing as $0 lines (29WEDIT, 1518104, 1518105).
  WARN: 6 carton-sold rows carry no sf/ct in the description — they'll quote the carton price per piece (47832, 47833, 47815, …).
```

If the counts differ, STOP — the workbook is not the one this plan was verified against.

- [ ] **Step 3: Write the fixture's own tests**

Append to `src/wediadapter.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normBookItem } from "./orderbook.js";
import { FIXTURE_ROWS } from "./wedifixture.js";

const live = () => FIXTURE_ROWS.map((r) => normBookItem(r, "bk_wedi"));

test("fixture: 152 persisted rows, the whole export including the placeholder", () => {
  assert.equal(FIXTURE_ROWS.length, 152);
  assert.equal(FIXTURE_ROWS.every((r) => r.active === true && r.data), true);
});

test("fixture: normBookItem rehydrates the shape the adapter will see", () => {
  const washer = live().find((r) => r.sku === "47832");
  assert.deepEqual(washer.vendorSkus, ["US5000009"]);
  assert.equal(washer.unit, "BX");
  assert.equal(washer.cost, 93.42);
  assert.equal(washer.price, 154.14);
  assert.equal(washer.bookId, "bk_wedi");
  // vendorSkus is sorted+deduped by normFits — column order does NOT survive
  assert.deepEqual(live().find((r) => r.sku === "29075").vendorSkus, ["075100050", "US9330001"]);
  // the shop's own code can appear in vendorSkus and must be excluded by usOf
  assert.deepEqual(live().find((r) => r.sku === "47815").vendorSkus, ["095225053", "47815"]);
});
```

- [ ] **Step 4: Run them**

Run: `node --test src/wediadapter.test.js`
Expected: 2 pass, 0 fail.

- [ ] **Step 5: Commit**

```bash
git add .scratch/119_wedi-stock-book/tools/gen-fixture.mjs src/wedifixture.js src/wediadapter.test.js
git commit -m "test: commit the wedi stock-export fixture and its generator"
```

---

## Task 2: `src/wediadapter.js` — the row mapping

**Files:**
- Create: `src/wediadapter.js`
- Test: `src/wediadapter.test.js` (append)

**Interfaces:**
- Consumes: `FIXTURE_ROWS` via `normBookItem` (Task 1).
- Produces:
  - `usOf(row) -> string` — the wedi US-SKU, `""` when none derivable.
  - `descOf(row) -> string` — a dimension-bearing description `makeEntry`'s `dims()` can parse.
  - `adaptRow(row) -> {erp, desc, cost, retail, unit, us} | null` — null when `usOf` is empty.
  - `adaptBookRows(rows) -> stockRow[]` — maps and drops nulls.

- [ ] **Step 1: Write the failing tests**

Append to `src/wediadapter.test.js`:

```js
import { usOf, descOf, adaptRow, adaptBookRows } from "./wediadapter.js";

test("usOf: a US-shaped code beats a numeric article number, whatever the sort order", () => {
  // 29075 carries an article number and the real US-SKU; normFits sorted them
  const r = live().find((x) => x.sku === "29075");
  assert.equal(usOf(r), "US9330001");
});

test("usOf: the shop's own Product Code is never the vendor's code", () => {
  // 47815 repeats its own sku in a vendor column; the article number must win
  assert.equal(usOf(live().find((x) => x.sku === "47815")), "095225053");
});

test("usOf: the ten-digit Subliner code is preserved, NOT corrected", () => {
  // WEDI_STOCK holds us:"US50000005" and wedi.js:4331 compensates for it.
  // A fixup table here would silently re-key the entry and break item() lookups.
  assert.equal(usOf(live().find((x) => x.sku === "28954")), "US50000005");
});

test("usOf: the custom-item placeholder derives nothing and is dropped", () => {
  const placeholder = live().find((x) => x.sku === "29WEDIT");
  assert.equal(usOf(placeholder), "");
  assert.equal(adaptRow(placeholder), null);
});

test("adaptRow: one live row to the six-field stockRow shape", () => {
  const e = adaptRow(live().find((x) => x.sku === "47832"));
  assert.deepEqual(Object.keys(e).sort(), ["cost", "desc", "erp", "retail", "unit", "us"]);
  assert.equal(e.erp, "47832");
  assert.equal(e.us, "US5000009");
  assert.equal(e.cost, 93.42);
  assert.equal(e.retail, 154.14);
  assert.equal(e.unit, "BX");
});

test("adaptBookRows: 152 in, 151 out — only the placeholder drops", () => {
  const out = adaptBookRows(live());
  assert.equal(out.length, 151);
  assert.equal(out.some((r) => r.erp === "29WEDIT"), false);
  assert.equal(out.every((r) => r.us), true);
});

test("descOf: the dimensions the importer moved to size/thickness come back inline", () => {
  // 47815: table desc is "5\"x82' Wedi Mesh Tape - …"; the importer left
  // "Wedi Mesh Tape - …" with size "5\"x82'"
  assert.match(descOf(live().find((x) => x.sku === "47815")), /5"x82'/);
  // 47700: a panel — width, depth AND thickness all have to survive
  const panel = descOf(live().find((x) => x.sku === "47700"));
  assert.match(panel, /3'/);
  assert.match(panel, /5'/);
  assert.match(panel, /1\/2"/);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `node --test src/wediadapter.test.js`
Expected: FAIL — `Cannot find module './wediadapter.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/wediadapter.js`:

```js
// Registry→engine adapter for wedi's stock half (spec 2026-09-01, 8a): live
// registry rows are normOrderItem/normBookItem-shaped (`description` with the
// dimensions split out into `size`/`thickness`/`sfPerUnit`, the shop's code in
// `sku`, the vendor's in `vendorSkus`), while wedi.js's makeEntry was built
// against the transcribed table's six-field rows with the dimensions inline in
// `desc`. Everything the engine reads crosses this file; nothing else in the
// popup touches a raw book row.

/**
 * The wedi US-SKU for one live row.
 *
 * The solver keys everything off `us`. The transcribed table had the join
 * baked in by hand; a live row carries the shop's code in `sku` and the
 * vendor's in `vendorSkus`. Three rules, each earned from the real export:
 *
 * 1. The shop's own Product Code is never the vendor's code — two rows repeat
 *    it in a vendor column (47815, 47733), so it is excluded.
 * 2. A `US`-shaped code beats a numeric article code — 29075/29076 carry an
 *    article number AND the real US-SKU. This preference is what makes the
 *    rule independent of order, which matters because normFits SORTS
 *    vendorSkus: column order does not survive normalization.
 * 3. Otherwise take what's left — 7 rows legitimately use a nine-digit article
 *    number as their `us`, exactly as the transcription did.
 *
 * NO fixup table. 28954 reads US50000005 in the export and `us: "US50000005"`
 * in WEDI_STOCK; wedi.js:4331 compensates for it deliberately. "Correcting" it
 * here re-keys the entry and breaks item("US50000005"). Verified: this rule
 * reproduces all 151 transcribed `us` values exactly.
 */
export function usOf(row) {
  if (!row) return "";
  const codes = (row.vendorSkus || []).filter((c) => c && c !== row.sku);
  return codes.find((c) => /^US\d+$/i.test(c)) || codes[0] || "";
}

/**
 * A description with the dimensions inline, the way makeEntry expects them.
 *
 * The mapped importer always runs splitSizeFromDescription (pricebook.js:532)
 * and reassigns the description to the stripped name, moving the leading
 * dimensions into `size`, a fraction into `thickness`, and a coverage figure
 * into `sfPerUnit`. wedi's makeEntry parses w/d/t back out of `desc`, and for a
 * stock-only entry `desc` is the SOLE dimension source — so this puts them
 * back. Order matters: dims() reads left to right, and the transcribed table
 * always led with the size.
 */
export function descOf(row) {
  if (!row) return "";
  const lead = [row.size, row.thickness].filter(Boolean).join("x");
  return [lead, row.description].filter(Boolean).join(" ").replace(/\s{2,}/g, " ").trim();
}

/**
 * One live registry row → makeEntry's stockRow shape, or null when no code on
 * the row is a wedi part number. The only dropped row in the real export is
 * 29WEDIT, a custom-item placeholder with no vendor code (owner, 2026-09-01).
 */
export function adaptRow(row) {
  if (!row) return null;
  const us = usOf(row);
  if (!us) return null;
  return {
    erp: row.sku || "",
    desc: descOf(row),
    cost: +row.cost || 0,
    retail: +row.price || 0,
    unit: row.unit || "",
    us,
  };
}

/** Map a book's rows, dropping everything that carries no wedi part number. */
export function adaptBookRows(rows) {
  return (rows || []).map(adaptRow).filter(Boolean);
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test src/wediadapter.test.js`
Expected: all pass. If `descOf`'s assertions fail, adjust the join in `descOf` only — do not weaken the assertions. Task 4 is the real proof.

- [ ] **Step 5: Commit**

```bash
git add src/wediadapter.js src/wediadapter.test.js
git commit -m "feat: wediadapter maps live book rows into makeEntry's stockRow shape"
```

---

## Task 3: The `wedi.js` seam

**Files:**
- Modify: `src/wedi.js:4078` (the memo declaration), `4306-4334` (`buildCatalog`), `4336` (`catalog`)
- Test: `src/wedi.test.js` (append only — edit no existing assertion)

**Interfaces:**
- Consumes: `adaptBookRows` output (Task 2).
- Produces:
  - `setStockSource(rows)` — install live rows; clears the memo.
  - `clearStockSource()` — revert to `WEDI_STOCK`; clears the memo.
  - `stockSourceIsBook() -> boolean` — for the UI marker (Task 6).

- [ ] **Step 1: Write the failing tests**

Append to `src/wedi.test.js`:

```js
import { setStockSource, clearStockSource, stockSourceIsBook } from "./wedi.js";

test("wedi stock source: nothing installed means the transcribed table, unchanged", () => {
  clearStockSource();
  assert.equal(stockSourceIsBook(), false);
  assert.equal(catalog().filter((e) => e.stock).length, 151);
});

test("wedi stock source: installing rows swaps the source and rebuilds the index", () => {
  clearStockSource();
  const before = item("US5000009");
  assert.ok(before && before.stock);
  setStockSource([{ erp: "99999", desc: "Test Only Widget", cost: 1, retail: 2, unit: "EA", us: "US9999999" }]);
  assert.equal(stockSourceIsBook(), true);
  assert.equal(catalog().filter((e) => e.stock).length, 1);
  assert.ok(item("US9999999"), "the installed row is indexed");
  assert.equal(item("US5000009"), null, "the transcribed row is gone while a book is installed");
  clearStockSource();
  assert.equal(stockSourceIsBook(), false);
  assert.equal(catalog().filter((e) => e.stock).length, 151, "clearing restores the fallback");
  assert.ok(item("US5000009"), "and the index rebuilds with it");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test src/wedi.test.js`
Expected: FAIL — `setStockSource is not exported`.

- [ ] **Step 3: Parameterize the memo**

In `src/wedi.js`, replace line 4078:

```js
let CAT = null, INDEX = null;
```

with:

```js
let CAT = null, INDEX = null;
// The live stock-kind book's rows, installed by useWediCatalog (spec
// 2026-09-01, decision 3). Null means no book — buildCatalog falls back to the
// transcribed WEDI_STOCK table, which is the ONLY situation the fallback is
// legitimate in. The hook never installs while a book exists but has not
// loaded; it waits instead, so a slow fetch can never quote stale prices.
let STOCK_SRC = null;
```

- [ ] **Step 4: Read the source in `buildCatalog`**

In `buildCatalog`, replace the two `WEDI_STOCK.forEach(` at lines 4317 and 4332 with `rows.forEach(`, and add this as the function's first line (after `const soRows = ...` is fine, but before the first use):

```js
  const rows = STOCK_SRC || WEDI_STOCK;
```

Nothing else in `buildCatalog` changes. The SO join by `erp`/`us` is preserved: a book row's `erp` is the shop's Product Code, the same value the transcribed table carries, so `byErp` still hits.

- [ ] **Step 5: Add the installer**

Immediately after `catalog()` (`src/wedi.js:4339`), add:

```js
/**
 * Install the live book's adapted rows as the stock source, or clear back to
 * the transcribed fallback. Clearing both memos is what makes item()/group()/
 * pans() — all ~30 call sites — follow the swap without changing their
 * signatures (spec decision 4).
 *
 * Module-level state, deliberately: it is what lets the whole engine answer
 * "which vintage am I quoting?" with ONE answer. The cost is that every lazy
 * entry point reaching wedi.js must install first — see useWediCatalog, which
 * is the single place allowed to call this.
 */
export function setStockSource(rows) {
  STOCK_SRC = rows && rows.length ? rows : null;
  CAT = null; INDEX = null;
}
export function clearStockSource() {
  STOCK_SRC = null;
  CAT = null; INDEX = null;
}
export function stockSourceIsBook() {
  return STOCK_SRC !== null;
}
```

- [ ] **Step 6: Run the whole suite**

Run: `node --test src/*.test.js`
Expected: 1222 pass, 0 fail (1211 verified baseline + 2 from Task 1 + 7 from Task 2 + 2 new). **Every pre-existing assertion must still pass** — if `wedi.test.js` reports a failure in a pinned test, a prior test leaked installed state; add `clearStockSource()` to the top of the new tests, never edit the pinned ones.

- [ ] **Step 7: Commit**

```bash
git add src/wedi.js src/wedi.test.js
git commit -m "feat: wedi.js catalog reads an installable stock source, WEDI_STOCK as fallback"
```

---

## Task 4: The equivalence acceptance test

This is the task the spec exists for. Built against this workbook, the book-fed catalog must reproduce today's catalog.

**Files:**
- Create: `src/wediequivalence.test.js`

**Interfaces:**
- Consumes: `FIXTURE_ROWS` (Task 1), `adaptBookRows` (Task 2), `setStockSource`/`clearStockSource` (Task 3).

- [ ] **Step 1: Write the test**

Create `src/wediequivalence.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normBookItem } from "./orderbook.js";
import { FIXTURE_ROWS } from "./wedifixture.js";
import { adaptBookRows } from "./wediadapter.js";
import { catalog, setStockSource, clearStockSource, kitFor, solve } from "./wedi.js";

// The zero-drift baseline (spec, "Verification"). Every cost and every retail
// in the export matches the transcribed table to the cent, so any difference
// here is a bug in the adapter, not a repricing — there is no judgement call.
//
// `desc` is compared structurally, not literally: the mapped importer always
// splits the dimensions out of the description (pricebook.js:532), so the
// adapter reconstructs them and the reconstruction is not byte-identical to
// the hand-transcribed string. What must be identical is everything DERIVED
// from it — w/d/t/sf/len, the group, the display name, the size line.
const DERIVED = ["key", "us", "erp", "stock", "name", "group", "sub", "w", "d", "t",
  "sf", "len", "finish", "drain", "channel", "cost", "retail", "unit", "sizeText"];

const pick = (e) => Object.fromEntries(DERIVED.map((k) => [k, e[k]]));
const stockHalf = () => catalog().filter((e) => e.stock).slice().sort((a, b) => (a.key < b.key ? -1 : 1));

test("book-fed catalog is identical to the transcribed catalog, entry for entry", () => {
  clearStockSource();
  const fromTable = stockHalf().map(pick);

  const live = FIXTURE_ROWS.map((r) => normBookItem(r, "bk_wedi"));
  setStockSource(adaptBookRows(live));
  const fromBook = stockHalf().map(pick);
  clearStockSource();

  assert.equal(fromBook.length, 151, "151 stock entries from the book");
  assert.equal(fromTable.length, 151, "151 stock entries from the table");
  // deep-equal the whole half at once so a diff names the offending entry
  assert.deepEqual(fromBook, fromTable);
});

test("every stock entry still classifies — nothing falls into misc", () => {
  const live = FIXTURE_ROWS.map((r) => normBookItem(r, "bk_wedi"));
  setStockSource(adaptBookRows(live));
  const misc = catalog().filter((e) => e.stock && e.group === "misc").map((e) => e.us + " " + e.name);
  clearStockSource();
  // A NEW wedi part number that classify()'s grammar doesn't know lands here.
  // The book gives price drift for free; it does NOT extend the catalog — a new
  // product line still needs its code added to wedi.js by hand. This test is
  // how you find out, loudly, rather than shipping an unbuildable item.
  assert.deepEqual(misc, []);
});

test("the pinned engine totals do not move when the book feeds the catalog", () => {
  clearStockSource();
  const before = kitFor("US3000039", {});
  const beforeSolve = solve({ w: 60, d: 38, drain: "center" });

  const live = FIXTURE_ROWS.map((r) => normBookItem(r, "bk_wedi"));
  setStockSource(adaptBookRows(live));
  const after = kitFor("US3000039", {});
  const afterSolve = solve({ w: 60, d: 38, drain: "center" });
  clearStockSource();

  assert.deepEqual(after, before, "kitFor is unchanged");
  assert.deepEqual(afterSolve, beforeSolve, "solve is unchanged");
});
```

- [ ] **Step 2: Run it**

Run: `node --test src/wediequivalence.test.js`
Expected: initially FAIL on the first test, with a diff naming the mismatched entries.

- [ ] **Step 3: Tune `descOf` until the derived fields match**

This is the real work of the task. Every failure is a `descOf` reconstruction that `dims()` reads differently from the transcribed string. Fix `src/wediadapter.js`'s `descOf` — **never** the expectations, and never `makeEntry`.

Likely adjustments, in order of probability:
- the `size`/`thickness` join (`"3'x5'" + "x" + "1/2\""` vs a space) — panels need the `x` form
- bare `24x48` sizes that need inch marks restored before `dims()` sees them
- `sfPerUnit` needing to be re-appended (`"322 SF/RL"`) for subliner rolls

Re-run after each change. Do not proceed until all three tests pass.

- [ ] **Step 4: Confirm the whole suite**

Run: `node --test src/*.test.js`
Expected: 1225 pass, 0 fail (1222 + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/wediequivalence.test.js src/wediadapter.js
git commit -m "test: the zero-drift baseline — book-fed catalog equals the transcribed one"
```

---

## Task 5: `src/usewedicatalog.js` — the three-way gate

**Files:**
- Create: `src/usewedicatalog.js`
- Test: `src/usewedicatalog.test.js`

**Interfaces:**
- Consumes: `adaptBookRows` (Task 2), `setStockSource`/`clearStockSource` (Task 3).
- Produces: `pickWediBooks(books) -> string[]`, and the hook `useWediCatalog({stockRows, bookStockReady, books, loadBookItems}) -> {cat, catReady, onBook}`.

**The gate.** The spec's decision 3 says fall back when the book "is absent **or** its rows haven't loaded". Those are different situations and this plan splits them, at the owner's instruction (2026-09-01):

| situation | behavior |
|---|---|
| No wedi book exists | fall back to `WEDI_STOCK`, `catReady: true`, `onBook: false` — and the UI says so |
| A wedi book exists, rows not in yet | `catReady: false` — **wait**. Never substitute the table |
| A wedi book exists with rows | install them, `onBook: true` |

The middle row is the point: as the spec was written, a slow or failed fetch produces a normal-looking quote at last year's prices with discontinued items resurrected, and nothing on screen says so.

- [ ] **Step 1: Write the failing test for the pure part**

Create `src/usewedicatalog.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { pickWediBooks } from "./usewedicatalog.js";

test("pickWediBooks: stock-kind, active, matching /wedi/i on name or brandLabel", () => {
  const books = [
    { id: "a", kind: "stock", name: "wedi", active: true },
    { id: "b", kind: "stock", name: "Schluter", active: true },
    { id: "c", kind: "order", name: "wedi pricelist", active: true },
    { id: "d", kind: "stock", name: "retired wedi", active: false },
    { id: "e", kind: "stock", name: "", data: { brandLabel: "WEDI" }, active: true },
  ];
  assert.deepEqual(pickWediBooks(books), ["a", "e"]);
  assert.deepEqual(pickWediBooks([]), []);
  assert.deepEqual(pickWediBooks(null), []);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test src/usewedicatalog.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the hook**

Create `src/usewedicatalog.js`:

```js
// The wedi stock catalog: live registry rows through wediadapter.js, with the
// transcribed WEDI_STOCK table as a VISIBLE fallback (spec 2026-09-01, and the
// owner's tightening of decision 3 on the same date).
//
// LAZY-CHUNK-ONLY — this file imports wediadapter.js and wedi.js, so only a
// React.lazy popup may import it, never anything on the boot path.
//
// This is the ONLY place allowed to call setStockSource/clearStockSource. The
// engine's source is module-level state shared by every wedi.js consumer —
// including comparekit.js, which the SCHLUTER popup's Compare tab reaches. Any
// new lazy entry point that reads wedi's catalog must call this hook first, or
// it will read whichever source the last popup happened to install.
import { useEffect, useMemo, useState } from "react";
import { adaptBookRows } from "./wediadapter.js";
import { catalog, setStockSource, clearStockSource } from "./wedi.js";

/** Ids of the active stock-kind books that say wedi. */
export function pickWediBooks(books) {
  return (books || [])
    .filter((b) => b.kind === "stock" && b.active !== false
      && /wedi/i.test((b.name || "") + " " + ((b.data && b.data.brandLabel) || "")))
    .map((b) => b.id);
}

export function useWediCatalog({ stockRows, bookStockReady, books, loadBookItems }) {
  const [bookRows, setBookRows] = useState(null);
  const targetIds = pickWediBooks(books).join("|");

  // Keyed on the matching book ids, not run-once: an open-layer restore can
  // mount this popup before the books metadata hydrates, and the rows must
  // arrive when it does rather than being dropped for the session.
  useEffect(() => {
    let alive = true;
    const ids = targetIds ? targetIds.split("|") : [];
    if (!ids.length) { setBookRows([]); return; }         // no book — fallback is legitimate
    if (!loadBookItems) { setBookRows(null); return; }     // book exists, no loader — WAIT
    Promise.all(ids.map((id) => loadBookItems(id).catch(() => null)))
      .then((lists) => {
        if (!alive) return;
        // A failed fetch is null, NOT []. Falling back on a failure is exactly
        // the stale-pricing hazard this gate exists to prevent.
        setBookRows(lists.some((l) => l === null) ? null
          : lists.flat().filter((it) => it.active !== false && !it.disabled));
      });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIds]);

  const hasBook = !!targetIds;
  // With a book, wait for its rows AND the boot cache. Without one, ready now.
  const catReady = hasBook ? (!!bookStockReady && bookRows !== null) : true;
  const onBook = hasBook && catReady && !!(bookRows && bookRows.length);

  const cat = useMemo(() => {
    if (!catReady) return [];
    if (onBook) setStockSource(adaptBookRows(bookRows));
    else clearStockSource();
    return catalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catReady, onBook, bookRows, stockRows]);

  return { cat, catReady, onBook };
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test src/usewedicatalog.test.js`
Expected: 1 pass. (`.jsx`-free by design — the node runner cannot load `.jsx`, which is why the pure part lives in a `.js` file and is tested directly.)

- [ ] **Step 5: Commit**

```bash
git add src/usewedicatalog.js src/usewedicatalog.test.js
git commit -m "feat: useWediCatalog gates the book against a never-silent fallback"
```

---

## Task 6: Wire the popup and show the fallback

**Files:**
- Modify: `src/WediConfigurator.jsx:1304-1305` (the catalog seam), `:2408` (the Browse tab caption)

**Interfaces:**
- Consumes: `useWediCatalog` (Task 5). The props it needs — `stockRows`, `bookStockReady`, `books`, `loadBookItems` — are **already** on the component at `:562` and already passed at all four mount sites (`App.jsx:2797`, the Apps-hub bag at `:2696`, and `wedipreview.jsx`). No prop plumbing is needed anywhere.

- [ ] **Step 1: Replace the catalog seam**

At `src/WediConfigurator.jsx:1304-1305`, replace:

```js
  const cat = catalog();
  const nStock = useMemo(() => cat.filter((e) => e.stock).length, [cat]);
```

with:

```js
  const { cat, catReady, onBook } = useWediCatalog({ stockRows, bookStockReady, books, loadBookItems });
  const nStock = useMemo(() => cat.filter((e) => e.stock).length, [cat]);
```

Add the import beside the other lazy-chunk imports:

```js
import { useWediCatalog } from "./usewedicatalog.js";
```

and remove `catalog` from the `./wedi.js` import list at `:18-25` — `item`, `group`, `pans` and the rest all stay, unchanged, and now follow the installed source.

- [ ] **Step 2: Hold the render until the catalog is ready**

Immediately after the hook call, before any use of `cat`:

```js
  // Never render a catalog we aren't sure of: with a wedi book present but its
  // rows not in, quoting from WEDI_STOCK would silently price at the last
  // transcription and resurrect retired items (owner, 2026-09-01).
  if (!catReady) return null;
```

Match the surrounding early-return style; if the component has no other early return, place it after all hooks so hook order stays stable.

- [ ] **Step 3: Make the fallback visible**

At `src/WediConfigurator.jsx:2408`, replace:

```js
    ["browse", "Browse", nStock + " stock · " + (cat.length - nStock) + " SO"],
```

with:

```js
    ["browse", "Browse", nStock + " stock · " + (cat.length - nStock) + " SO"
      + (onBook ? "" : " · transcribed table")],
```

Falling back becomes a state you can see, never one you drift into.

- [ ] **Step 4: Verify in the browser**

Start the dev server and open the wedi configurator. With no wedi book in the project, the Browse tab must read `… · transcribed table` and every price must match today's. Check the console for errors and confirm the popup does not flash empty.

- [ ] **Step 5: Full verification**

```bash
node --test src/*.test.js
```
Expected: 1226 pass, 0 fail (1225 + Task 5's 1; Task 6 adds no tests).

```bash
npm run build
```
Expected: exit 0.

```bash
npm run lint
```
Expected: the 7 pre-existing errors, no new ones.

- [ ] **Step 6: Commit**

```bash
git add src/WediConfigurator.jsx
git commit -m "feat: the wedi popup reads the live book, and says when it doesn't"
```

---

## Task 7: Reconcile the spec and the ADRs

**Files:**
- Modify: `docs/superpowers/specs/2026-09-01-wedi-stock-book-design.md`
- Create: `docs/adr/0036-wedi-stock-side-registry-driven.md`
- Modify: `docs/adr/0032-schluter-registry-driven-pricing.md`

- [ ] **Step 1: Correct the spec's `us` derivation section**

In "The `us` derivation rule", replace the code block with the shipped rule (no `FIX`, sourced from `vendorSkus`) and replace the "One documented fixup" bullet with:

> - **No fixup.** `28954` reads `US50000005` in both vendor columns, and `WEDI_STOCK` records `us: "US50000005"` — the transcription did *not* correct it, and `wedi.js:4331` carries compensating index code that depends on the ten-digit spelling. An earlier draft of this spec prescribed a `FIX` table mapping it to `US5000005`; that was drawn from `WEDI_SO`, the *pricelist* table, which does use the seven-digit form. Applying it to the stock half re-keys the entry and fails this spec's own equality test on exactly one row. Verified 2026-09-01: with no fixup, the rule reproduces all 151 transcribed `us` values.

Add a note that `normFits` sorts `vendorSkus`, so the rule must not depend on column order.

- [ ] **Step 2: Correct the acceptance test's wording**

In "Verification: the zero-drift baseline", after the blockquote, add:

> **Except `desc`.** The mapped importer always runs `splitSizeFromDescription` (`pricebook.js:532`) and reassigns the description to the stripped name, moving leading dimensions into `size`/`thickness`/`sfPerUnit`; 105 of 151 descriptions differ as a result, and disabling `leadWidthSize`/`sfFromDescription` is worse — the dimensions are then captured nowhere. Since `makeEntry` parses `w`/`d`/`t` back out of `desc`, the adapter reconstructs it (`descOf`). Equality is therefore asserted on every *derived* field — `key, us, erp, stock, name, group, sub, w, d, t, sf, len, finish, drain, channel, cost, retail, unit, sizeText` — which is the set a quote actually depends on. Prices remain exactly equal: zero drift across all 151 rows.

- [ ] **Step 3: Tighten decision 3 and close the open questions**

Replace decision 3's fallback sentence with the three-way gate table from Task 5, and record the owner's reasoning: a present-but-unloaded book must never fall back, because that silently quotes stale prices and resurrects discontinued items.

Under "Still open for the owner", resolve question 2:

> 2. **Answered (2026-09-01).** `1518104`/`1518105` are *samples* — "Wedi S-Dry Mini Shower Base Sample" and "Wedi S-Dry Sample" — at $0 cost and $100 retail, in both the export and the transcribed table. The import warning says "$0 price" but flags $0 *cost*. Deliberate, not a sheet artifact; nothing to fix before import. Only `29WEDIT` is genuinely $0/$0, and it is a custom-item placeholder that the adapter drops.

Add a new consequence:

> - **The book does not extend the catalog.** `classify` is a hardcoded grammar of `US…` codes (`wedi.js:4060-4071`). A new wedi part number the grammar doesn't know is priced and searchable but files as `misc`, so the solver won't build with it and it lands in no browse section. The book ends *price* re-transcription, not *catalog* re-transcription; a new product line still needs its code added by hand. The equivalence suite's misc assertion is how this surfaces.

- [ ] **Step 4: Write ADR 0036**

Create `docs/adr/0036-wedi-stock-side-registry-driven.md` following the house format (`# ADR 0036 — …`, Status/Date/Scope/Related, Context, Decision, Consequences). Record: the stock half is registry-driven as of this change; `WEDI_STOCK` remains as the no-book fallback and is only removable once 8b lands; the pricelist half stays transcribed; the fallback is gated and visible; and the module-level source is shared engine-wide, so `useWediCatalog` is the only permitted installer.

- [ ] **Step 5: Amend ADR 0032**

In `docs/adr/0032-schluter-registry-driven-pricing.md`, append to consequence 3 (line 59):

> **Superseded in part by ADR 0036 (2026-09-01):** wedi's *stock* half is now registry-driven too, at the owner's request. The divergence this consequence describes now applies only to wedi's pricelist half, which remains transcribed until 8b.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-09-01-wedi-stock-book-design.md docs/adr/0036-wedi-stock-side-registry-driven.md docs/adr/0032-schluter-registry-driven-pricing.md
git commit -m "docs: correct the 8a spec's us rule and acceptance test, add ADR 0036"
```

---

## What the owner does, after this ships

Unchanged from the spec, and nothing here touches quoting until step 3:

1. Create a stock-kind price book named for wedi.
2. Drop `WEDI_1.xlsx` on it; the wizard recognizes it with no mapping to set.
3. Review the diff as usual and apply.

Until the book has rows, the popup runs on `WEDI_STOCK` and says so in the Browse tab caption.

---

## Self-Review

**Spec coverage.** Decision 1 (owner-created book) — Task 7's instructions, no code. Decision 2 (`wediadapter.js` as the only file seeing a raw row) — Task 2. Decision 3 (fallback) — Task 3 plus Task 5's gate, deliberately tightened. Decision 4 (nothing else moves) — held: `wedi.js` gains 3 exports and 2 changed lines inside `buildCatalog`; all 29 `item`/`group` call sites untouched. The `us` rule — Task 2, corrected. The zero-drift baseline's three numbered requirements — Tasks 1, 4, and 4's third test respectively. Out-of-scope items (8b, deleting `WEDI_STOCK`, pricing changes) are not touched by any task.

**Gaps accepted deliberately.** The spec's literal "identical field for field" is not achievable for `desc`; Task 4 asserts the derived set instead and Task 7 amends the spec to say so. The spec's `FIX` table is contradicted, not implemented, for the reason recorded in Global Constraints.

**Type consistency.** `adaptRow` returns exactly `{erp, desc, cost, retail, unit, us}` — the six fields `makeEntry`/`buildCatalog` read, verified by enumerating every `stockRow.X` access. `usOf`/`descOf`/`adaptRow`/`adaptBookRows` are named identically in Task 2's tests, Task 4's imports, and Task 5's hook. `setStockSource`/`clearStockSource`/`stockSourceIsBook` are named identically in Tasks 3, 5, and 6. `pickWediBooks` matches on `kind === "stock"` (Schluter's hook matches `"order"` — the difference is intentional and load-bearing).

**Residual risk, named.** The module-level source is global. `comparekit.js` imports wedi's `item()` and the Schluter popup's Compare tab reaches it, so a future lazy entry point that reads wedi's catalog without calling `useWediCatalog` will read whichever source was last installed. The comment at the top of `usewedicatalog.js` is the only guard; a structural fix means threading `cat`, which spec decision 4 forbids.
