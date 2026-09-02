# wedi Pricelist Book Implementation Plan (8b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make wedi's pricelist half come from a live order-kind registry price book instead of the hand-transcribed `WEDI_SO` table, the way 8a (ADR 0037) moved the stock half — keeping both tables as visible, never-silent fallbacks until a later PR retires them.

**Architecture:** A new `src/wedibook.js` is a section-table parser (the `parseSundries` shape in `ovfbook.js`) that flattens the two in-scope sheets of wedi's formatted distribution pricelist into the canonical `{ name, rows, mapping, warnings }` the import wizard already consumes, so the book is an ordinary order-kind registry book and every ADR 0025/0027 re-import affordance comes free. `src/wediadapter.js` gains `adaptSoRows`, mapping a live book row back to the `soRow` contract `makeEntry(stockRow, soRow)` has always taken. `src/wedi.js` gains `setSoSource`/`clearSoSource`, twins of the 8a installers, and `buildCatalog` reads `SO_SRC || WEDI_SO`. `src/usewedicatalog.js` runs 8a's three-way gate once per half, applies the SKU floor, and installs both. Two unguarded `item(SKU.*)` sites in `kitFor` get null-guards.

**Tech Stack:** ES modules, React 18, `node:test` + `node:assert/strict`. No new dependencies. SheetJS (`xlsx`) is used only by the offline dump tool.

**Spec:** `docs/superpowers/specs/2026-09-02-wedi-pricelist-book-design.md` — read it first; every task below cites the decision it implements.

---

## Global Constraints

- **Scope is the "wedi Fundo" and "wedi S-Dry" sheets only.** Builder Choice, Wellness and Spa, and New Product Data are skipped by name with a warning. (Spec, owner decision 1.)
- **`WEDI_STOCK` and `WEDI_SO` stay in `wedi.js`.** Do not delete or shrink either. (Spec, owner decision 2.)
- **The engine's public surface does not change.** `catalog()`, `item(key)`, `group(g)`, `pans(opts)`, `kitFor`, `solve`, `lineItems` keep their signatures. `classify`, the geometry, the Builder × 0.82 rule — untouched. (Spec decision 7.)
- **The pinned tests in `src/wedi.test.js` must not move.** With nothing installed the catalog is byte-for-byte what it was: 151 stock, 269 total, 0 in `misc`.
- **Baseline to preserve:** `node --test src/*.test.js` → **1302 pass, 0 fail** on this branch at `87270be`. `npm run build` exit 0. `npm run lint` no worse than `main`'s 7 pre-existing errors.
- **`src/pricebook.js` and `src/orderbook.js` are read-only.** The parser feeds `parseMapped` the way every other vendor parser does; nothing in the mapped importer changes.
- **Only `usewedicatalog.js` calls the four installers** (`setStockSource`, `clearStockSource`, `setSoSource`, `clearSoSource`). Tests may call them directly and must clear both before returning. (ADR 0037 decision 5.)
- **An agent never touches the live Supabase project.** Ship code and instructions.
- **No UI change merges without preview proof** (Task 8).
- **Book match rules:** stock half — `kind === "stock"`, active, `/\bwedi\b/i` on `name` or `data.brandLabel` (unchanged from 8a). Pricelist half — `kind === "order"`, same active and word test. The owner names the pricelist book **"wedi"**; kind is the discriminator. (Spec decision 4.)
- **Run one test file with** `node --test src/<name>.test.js`. `npm test` cannot take a file argument.
- **Commit messages:** conventional prefixes (`feat:`, `fix:`, `test:`, `docs:`), imperative, one line of summary plus a body that says *why* when the diff alone would look wrong.

### Measured facts this plan relies on (all from `.scratch/120_wedi-pricelist-book/tools/`)

Reproduce any of them with `node .scratch/120_wedi-pricelist-book/tools/measure-vs-so.mjs` and `node .scratch/120_wedi-pricelist-book/tools/proto-roundtrip.mjs` (throwaway measurement walks, NOT the parser).

- `WEDI_SO` holds **229** rows: **223** priced + **6** `kitNote` rows that `buildCatalog` filters out and nothing else reads.
- The "wedi Fundo" sheet holds **225** part numbers: the 223 above (two carry a trailing `*` in the sheet: `US3000042*`, `US3000043*`) plus `676800061` / `676800064`, the SS27/SS43 linear cover frames, which are already `WEDI_STOCK` entries and in `classify`'s `LEGACY` table.
- "wedi S-Dry" holds **37** part numbers: 36 new to the engine + `US5076012`, also on Fundo at a different retail ($21.05 Fundo / $22.00 S-Dry, same net). Fundo wins. Every S-Dry code matches `classify`'s existing `/^US\d\d76\d{3}$/` rule.
- Parser output: **261** rows (225 + 36), every one with a non-empty `section`, a numeric retail and a numeric net.
- Through the real `parseMapped` → `bookItemData` → `normBookItem` round trip, the 223 transcribed rows match `WEDI_SO` **exactly** on `name` (`description`), `retail` (`price`), `net` (`cost`), `section`, `erp` (`vendorSkus[0]`) and, with the size rule below, `size`. `smartCase` leaves wedi's mixed-case names alone; no `thickness`/`sfPerUnit`/`type` is ever set (size is mapped, so `splitSizeFromDescription` does not run).
- **`discount` is the section caption's "(less N%)"**, reproduced 223/223 from the caption and NOT from the prices (building panels are 39% off by arithmetic, caption says 50, `WEDI_SO` says 50). Nothing in the engine reads `discount`; the adapter emits `null` and the book does not carry it.
- **`size`** = the column captioned "Size"/"Dimensions"/"Product Information", else the cell two to the right of the part number (one section, "wedi® Preparation and Installation Pro-Systems", captions no size column). One cell carries a doubled unit ("… x 3 1/8 in. in.") the transcription fixed by hand.
- **`details`** = the column captioned "Additional Details"/"Drain Location" when that cell is non-empty, else the cell right of the size column. This reproduces 213/223 and differs on exactly **10** rows, all pinned in Task 5: 8 where the caption column carries text the transcription's fixed column 4 never saw (`US5000085` "1 Kit"; `US5000013`/`US5000088` "12 per case, full cases only"; `US5000010`/`US5000083` "20 per case, full cases only"; `US5000019` "1 per box"; `US5000020` "sold in increments of 10 pcs."; `US5000044` "25 pcs/case, full cases only") and 2 hand edits (`US3000001`/`US3000002`: transcription "Suspended Corner Seat", sheet "Suspended Seat").
- Of those 10, exactly **one moves a derived field**: `unitOf` reads `/\/box|per box/` → `US5000019` (sausage gun) goes from `EA` to `BX`. Pinned in Task 5 and shown in Task 8's preview.
- `parseMapped` raises one benign warning on this sheet: "28 rows still showing a size in the product name" — wedi's names carry the size by design ("Building Panel 24\"x48\"x1/8\""). Expected; the wizard shows it.
- `kitFor` dereferences `panel.sf` at `wedi.js:5117` before the (already null-safe) `push`, and `item(SKU.coverSS)` at `:5148` feeds a null-safe `push` and a null-safe `coverFrameFor`. Only the panel site can throw today; both get a hint.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/wedipricelistfixture.js` | **Create.** The raw 5-sheet grid, exactly `readXlsxSheets`'s output, as a module (`PRICELIST_SHEETS`). Parser INPUT, not output — so the parser tests are not circular. Generated; never imported by app code. |
| `.scratch/120_wedi-pricelist-book/tools/dump-pricelist.mjs` | **Modify.** Also writes the fixture module, so one command regenerates both artifacts from a new workbook. |
| `src/wedibook.js` | **Create.** `isWediPricelist`, `parseWediSheet`, `parseWediPricelist`, `WEDI_PRICELIST_MAPPING`, `WEDI_PRICELIST_SHEETS`. The only file that understands the sheet's layout. |
| `src/wedibook.test.js` | **Create.** Parser tests over the fixture. |
| `src/dropimport.js` | **Modify.** `fileFormat` gains the `"wedi-pricelist"` tag; `FORMAT_NAMES` names it. |
| `src/dropimport.test.js` | **Modify.** Tag + kind tests. |
| `src/pricebooklib.jsx` | **Modify.** The xlsx ingest branch tries `parseWediPricelist` after `parseEmser`. |
| `src/wedi.js` | **Modify.** `SO_SRC`, `setSoSource`/`clearSoSource`/`soSourceIsBook`, `stockSourceIs`/`soSourceIs`, `missingRequiredParts`; `buildCatalog` reads `SO_SRC \|\| WEDI_SO`; two guards in `kitFor`. Nothing else. |
| `src/wediadapter.js` | **Modify.** `adaptSoRow`, `adaptSoRows`. |
| `src/wediadapter.test.js` | **Modify.** Adapter tests. |
| `src/wediequivalence.test.js` | **Modify.** The pricelist-half acceptance tests. |
| `src/usewedicatalog.js` | **Modify.** `pickWediSoBooks`, `useHalf`, `installSources`, `fallbackCaption`; the hook runs two halves. |
| `src/usewedicatalog.test.js` | **Modify.** Picker, floor, caption, combined-gate tests. |
| `src/WediConfigurator.jsx` | **Modify.** Browse caption from the hook; two new hint lines. |
| `docs/adr/0038-wedi-pricelist-side-registry-driven.md` | **Create.** Records the move. |
| `docs/adr/README.md` | **Modify.** Index row. |
| `docs/superpowers/specs/2026-09-02-wedi-pricelist-book-design.md` | **Modify.** Three measured refinements (Task 9). |
| `src/CLAUDE.md` | **Modify.** Entries for the new files; update the wedi.js/wediadapter/usewedicatalog notes. |
| `.scratch/120_wedi-pricelist-book/HANDOFF.md` | **Modify.** Status. |

---

## Task 1: The fixture module and its generator

The committed JSON snapshot is parser INPUT. Tests import it as a module so the suite needs no filesystem reads, no Supabase and no workbook. (Spec, Verification 1.)

**Files:**
- Create: `src/wedipricelistfixture.js` (generated)
- Modify: `.scratch/120_wedi-pricelist-book/tools/dump-pricelist.mjs`
- Test: `src/wedibook.test.js` (first test only; the file grows in Task 2)

**Interfaces:**
- Produces: `export const PRICELIST_SHEETS` — `Array<{ name: string, rows: Array<Array<string|number|null>> }>`, 5 sheets, the exact `readXlsxSheets` shape minus blank rows.

- [ ] **Step 1: Write the failing test**

Create `src/wedibook.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { PRICELIST_SHEETS } from "./wedipricelistfixture.js";

test("fixture: the five-sheet snapshot, blank rows dropped, nothing interpreted", () => {
  assert.deepEqual(PRICELIST_SHEETS.map((s) => s.name),
    ["wedi Fundo", "wedi S-Dry", "wedi Builder Choice", "Wellness and Spa", "New Product Data"]);
  assert.deepEqual(PRICELIST_SHEETS.map((s) => s.rows.length), [301, 79, 48, 99, 75]);
  // A raw grid: the title line is still there, uninterpreted.
  assert.match(String(PRICELIST_SHEETS[0].rows[0][1]), /^wedi Distribution Pricelist 2026/);
  // Numbers stayed numbers (the parser reads prices by type, not by parsing text).
  assert.equal(typeof PRICELIST_SHEETS[0].rows[5][6], "number");
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test src/wedibook.test.js`
Expected: FAIL — `Cannot find module './wedipricelistfixture.js'`

- [ ] **Step 3: Teach the dump tool to write the module, and generate it from the committed JSON**

In `.scratch/120_wedi-pricelist-book/tools/dump-pricelist.mjs`, replace the final three lines (from `const out = path.resolve(...)` to the end) with:

```js
const out = path.resolve(import.meta.dirname, "../pricelist-sheets.json");
fs.writeFileSync(out, JSON.stringify(sheets, null, 1));
writeFixture(sheets);
console.error(`sheets: ${sheets.length}`);
sheets.forEach((s) => console.error(`   ${JSON.stringify(s.name)} rows: ${s.rows.length}`));
console.error(`wrote ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB) and src/wedipricelistfixture.js`);

// The same grid as a module, one sheet row per line so a re-dump diffs by row.
// Parser INPUT, never output — that is what keeps wedibook.test.js honest.
export function writeFixture(sheets) {
  const body = sheets.map((s) =>
    ` { name: ${JSON.stringify(s.name)}, rows: [\n` + s.rows.map((r) => "  " + JSON.stringify(r)).join(",\n") + "\n ] }").join(",\n");
  const header = `// test fixture — the ${new Date().toISOString().slice(0, 10)} wedi distribution pricelist,\n`
    + "// as the raw sheet grid readXlsxSheets hands the import wizard (blank rows\n"
    + "// dropped, nothing interpreted). Parser INPUT for wedibook.test.js — a fixture\n"
    + "// of parser OUTPUT would make the parser's tests circular. Production never\n"
    + "// reads this file. GENERATED — regenerate with\n"
    + "// .scratch/120_wedi-pricelist-book/tools/dump-pricelist.mjs over the owner's workbook.\n\n"
    + "export const PRICELIST_SHEETS = [\n";
  fs.writeFileSync(path.resolve(import.meta.dirname, "../../../src/wedipricelistfixture.js"), header + body + "\n];\n");
}
```

Then move the `const file = process.argv[2]; if (!file) …` guard and everything that reads the workbook under a `if (process.argv[2]) { … }` block is NOT what we want — keep the tool simple: wrap the workbook read in a function and add a second entry point. Concretely, restructure the top of the file so the CLI reads:

```js
const file = process.argv[2];
if (!file) { console.error("usage: dump-pricelist.mjs <workbook.xlsx>   |   dump-pricelist.mjs --from-json"); process.exit(1); }
let sheets;
if (file === "--from-json") {
  // No workbook in this environment (a cloud container): rebuild the module from the committed snapshot.
  sheets = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../pricelist-sheets.json"), "utf8"));
  writeFixture(sheets);
  console.error("wrote src/wedipricelistfixture.js from pricelist-sheets.json");
  process.exit(0);
}
const wb = XLSX.read(fs.readFileSync(file), { type: "buffer" });
sheets = wb.SheetNames.map((name) => ({
  name,
  rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null, blankrows: false }),
}));
```

(`writeFixture` is a hoisted function declaration, so calling it above its definition is fine.)

Generate: `node .scratch/120_wedi-pricelist-book/tools/dump-pricelist.mjs --from-json`

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test src/wedibook.test.js`
Expected: PASS (1 test). Also `node --test src/*.test.js` → 1303 pass.

- [ ] **Step 5: Commit**

```bash
git add src/wedipricelistfixture.js src/wedibook.test.js .scratch/120_wedi-pricelist-book/tools/dump-pricelist.mjs
git commit -m "test: commit the wedi pricelist sheet grid as a fixture module (8b Task 1)"
```

---

## Task 2: `src/wedibook.js` — the parser

Spec decision 1. A section-table state machine: header/section rows set the column map and the current section; product rows emit `WEDI_SO`'s contract. Every regex below was verified against the fixture by the measurement walk; copy them exactly.

**Files:**
- Create: `src/wedibook.js`
- Test: `src/wedibook.test.js` (append)

**Interfaces:**
- Produces:
  - `isWediPricelist(sheets) → boolean`
  - `parseWediSheet(rows, sheetName) → { items: SoRow[], warnings: string[] }` where `SoRow = { us, name, size, details, retail, net, section, discount, erp }` (`retail`/`net` numbers or null, `discount` integer or null, everything else string)
  - `parseWediPricelist(sheets, name?) → { name, rows, mapping, warnings, meta: { items } } | null`
  - `WEDI_PRICELIST_MAPPING` — `{ columns: { 0:"sku", 1:"description", 2:"size", 3:"note", 4:"price", 5:"cost", 6:"section", 7:"vendorSku" }, headerRow: 0, skuPattern: "^(US\\d{7,9}|\\d{9})$", defaultType: "", groupBy: "section" }`
  - `WEDI_PRICELIST_SHEETS` — `["wedi Fundo", "wedi S-Dry"]`
- Consumes: `PRICELIST_SHEETS` (Task 1), in tests only.

- [ ] **Step 1: Write the failing tests**

Append to `src/wedibook.test.js` (add the import line at the top of the file):

```js
import { isWediPricelist, parseWediSheet, parseWediPricelist, WEDI_PRICELIST_MAPPING, WEDI_PRICELIST_SHEETS } from "./wedibook.js";
import { FIXTURE_ROWS } from "./wedifixture.js";

const sheet = (name) => PRICELIST_SHEETS.find((s) => s.name === name);

test("isWediPricelist: the workbook is recognised by its Fundo title line, and nothing else is", () => {
  assert.equal(isWediPricelist(PRICELIST_SHEETS), true);
  // The 8a stock export (a Vendor SKU Analysis sheet) is NOT a pricelist.
  assert.equal(isWediPricelist([{ name: "Vendor SKU Analysis", rows: [["Product Code", "Full Description"], ["47832", "Wedi Washer"]] }]), false);
  // A renamed Fundo sheet is not recognised either — by design (spec decision 1: a re-format fails loudly).
  assert.equal(isWediPricelist(PRICELIST_SHEETS.map((s) => ({ ...s, name: s.name === "wedi Fundo" ? "Fundo" : s.name }))), false);
  assert.equal(isWediPricelist([]), false);
  assert.equal(isWediPricelist(null), false);
});

test("parseWediSheet: Fundo yields 225 sectioned, priced rows; S-Dry 37", () => {
  const f = parseWediSheet(sheet("wedi Fundo").rows, "wedi Fundo");
  assert.equal(f.items.length, 225);
  assert.deepEqual(f.warnings, []);
  assert.equal(f.items.filter((r) => !r.section).length, 0, "every row carries a section");
  assert.equal(f.items.filter((r) => !(r.retail > 0) || !(r.net > 0)).length, 0, "every row is priced");
  const s = parseWediSheet(sheet("wedi S-Dry").rows, "wedi S-Dry");
  assert.equal(s.items.length, 37);
  assert.equal(s.items.filter((r) => !r.section).length, 0);
});

test("parseWediSheet: one row, field by field, against the transcribed contract", () => {
  const f = parseWediSheet(sheet("wedi Fundo").rows, "wedi Fundo");
  const panel = f.items.find((r) => r.us === "US8000006");
  assert.deepEqual(panel, {
    us: "US8000006",
    name: 'wedi® Building Panel 24"x48"x1/8"',
    size: "Waterproof Tile Backer Board",
    details: "10 sheets/box",
    retail: 35.0069383125,          // raw sheet number — parseMapped rounds to 2 dp downstream
    net: 21.21632625,
    section: "WEDI BUILDING PANELS",
    discount: 50,                   // the caption's "(less 50%)" — NOT round(1 - net/retail) = 39
    erp: "29952",                   // Fundo's "Stock SkUS" column
  });
});

test("parseWediSheet: the footnote asterisk is stripped from a part number", () => {
  const f = parseWediSheet(sheet("wedi Fundo").rows, "wedi Fundo");
  assert.ok(f.items.some((r) => r.us === "US3000042"), "US3000042* parses as US3000042");
  assert.ok(f.items.some((r) => r.us === "US3000043"));
  assert.equal(f.items.filter((r) => /\*/.test(r.us)).length, 0);
});

test("parseWediSheet: size and details follow the section's captions, with the measured fallbacks", () => {
  const f = parseWediSheet(sheet("wedi Fundo").rows, "wedi Fundo");
  const by = Object.fromEntries(f.items.map((r) => [r.us, r]));
  // "Product Information" is the size column in the accessories block.
  assert.match(by.US1000057.size, /^Drain cover and frame made from stainless steel/);
  // No size caption at all (Pro-Systems): the cell two right of the part number.
  assert.equal(by.US5076012.size, "25 lbs. Bag - 100 bags per pallet - Full Pallets Only");
  // The captioned "Additional Details" column wins when it has text…
  assert.equal(by.US5000085.details, "1 Kit");
  // …and the cell right of the size column stands in when it is empty (joint sealant block).
  assert.equal(by.US5000070.details, "*count determined by weight, actual count may vary");
  // The one doubled unit in the sheet is collapsed.
  assert.equal(by.US3000000.size, "47 1/4 in. x 15 in. x 3 1/8 in.");
});

test("parseWediSheet: kit-note and terms rows are skipped, section titles are not rows", () => {
  const f = parseWediSheet(sheet("wedi Fundo").rows, "wedi Fundo");
  assert.equal(f.items.filter((r) => /^\*Contains/.test(r.name)).length, 0);
  assert.equal(f.items.filter((r) => /Payment terms|Minimum Advertised/.test(r.name)).length, 0);
  assert.equal(new Set(f.items.map((r) => r.section)).size, 29, "29 distinct Fundo sections, as WEDI_SO has");
});

test("parseWediPricelist: the canonical sheet — 261 rows, Fundo wins the one cross-sheet duplicate", () => {
  const out = parseWediPricelist(PRICELIST_SHEETS, "wedi pricelist");
  assert.ok(out, "recognised");
  assert.equal(out.name, "wedi pricelist");
  assert.deepEqual(out.mapping, WEDI_PRICELIST_MAPPING);
  assert.equal(out.meta.items, 261);
  assert.equal(out.rows.length, 262, "header + 261");
  assert.deepEqual(out.rows[0], ["Part Number", "Product", "Size", "Details", "Retail", "Distributor net", "Section", "Stock SKU", "Discount %"]);
  const skus = out.rows.slice(1).map((r) => r[0]);
  assert.equal(new Set(skus).size, 261, "no duplicate part numbers");
  assert.equal(skus.filter((k) => k === "US5076012").length, 1);
  const adhesive = out.rows.find((r) => r[0] === "US5076012");
  assert.equal(adhesive[4], 21.054, "Fundo's retail, not S-Dry's 22");
  assert.ok(out.warnings.some((w) => /US5076012 is priced on both/.test(w)), "the disagreement is named");
  assert.ok(out.warnings.some((w) => /Skipped sheets not in scope: wedi Builder Choice, Wellness and Spa, New Product Data/.test(w)));
});

test("parseWediPricelist: a workbook that is not a wedi pricelist returns null; a renamed in-scope sheet yields a warning, not garbage", () => {
  assert.equal(parseWediPricelist([{ name: "Vendor SKU Analysis", rows: [["Product Code"], ["47832"]] }]), null);
  const renamed = PRICELIST_SHEETS.map((s) => (s.name === "wedi S-Dry" ? { ...s, name: "S-Dry 2026" } : s));
  const out = parseWediPricelist(renamed);
  assert.equal(out.meta.items, 225, "Fundo only");
  assert.ok(out.warnings.some((w) => /Sheet "wedi S-Dry" not found/.test(w)));
});

test("WEDI_PRICELIST_SHEETS names exactly the two in-scope sheets", () => {
  assert.deepEqual(WEDI_PRICELIST_SHEETS, ["wedi Fundo", "wedi S-Dry"]);
});

test("the 8a stock fixture is not mistaken for a pricelist row source", () => {
  // Guard against a future detector loosening: 8a's rows are price_book_items, not sheets.
  assert.equal(isWediPricelist(FIXTURE_ROWS), false);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test src/wedibook.test.js`
Expected: FAIL — `Cannot find module './wedibook.js'`

- [ ] **Step 3: Write the parser**

Create `src/wedibook.js`:

```js
// wedi distribution pricelist parser (spec 2026-09-02, 8b; ADR 0038).
//
// The pricelist is a formatted vendor workbook, not a table: section-title
// rows interleaved with product rows, note rows, and column layouts that
// change WITHIN a sheet ("wedi Fundo" prints one header at row 3 and a
// different caption row for every section after it). A column mapping cannot
// read it. This is the sanctioned dedicated-parser exception (ADR 0009 §4),
// the same shape as ovfbook.js's parseSundries: walk the rows, let each
// header/section row re-map the columns, emit product rows, and flatten the
// result to the canonical { name, rows, mapping, warnings } the import wizard
// already consumes — so the book is an ordinary order-kind registry book and
// nothing downstream knows a parser was involved.
//
// Only two sheets are in scope (owner, 2026-09-02): Builder Choice publishes
// no retail, Wellness reuses one part number across sizes, New Product Data
// has no prices. They are skipped BY NAME and named in a warning, so a
// renamed or re-formatted sheet yields zero rows and says so, never
// plausible garbage.

const str = (v) => (v == null ? "" : String(v)).replace(/\s+/g, " ").trim();

export const WEDI_PRICELIST_SHEETS = ["wedi Fundo", "wedi S-Dry"];

// A wedi part number: a US code, or a nine-digit article number (the linear
// cover frames, the ramp). A trailing asterisk is a footnote marker on the
// sheet (US3000042*), not part of the code.
const PART_RE = /^(US\d{7,9}|\d{9})\*?$/;
const RETAIL_CAP = /^retail (unit )?price/i;
const NET_CAP = /distributor net/i;
const SIZE_CAP = /^(size|dimensions|product information)/i;
const DETAILS_CAP = /^(additional details|drain location)/i;
const PART_CAP = /^part number$/i;
const ERP_CAP = /^stock skus$/i;
// Every caption word a section-title row can carry beside its title. A row
// whose non-title cells are ALL captions is a section row even when it
// captions no price column (the building-panel blocks: "Sheets/Package",
// "ft2", "Sheet" under a "Part Number" header that already mapped the
// columns).
const CAPTION_RE = /^(size|dimensions|drain location|product information|additional details|retail|distributor net|contractor|dealer|sheets\/package|ft2|sheet|product|part number|stock skus|volume|price)/i;

/** The Fundo sheet's title line, on the sheet named "wedi Fundo". */
export function isWediPricelist(sheets) {
  if (!Array.isArray(sheets)) return false;
  const s = sheets.find((x) => str(x?.name) === "wedi Fundo");
  if (!s) return false;
  return (s.rows || []).slice(0, 3).some((r) => (r || []).some((c) => /wedi distribution pricelist/i.test(str(c))));
}

/**
 * One sheet → WEDI_SO-shaped rows. `cols` is the current column map; a
 * header row ("Part Number" …) or any row that captions a price column
 * rewrites it, and the title cell of a non-header caption row becomes the
 * section. Product rows before any header are skipped with a warning.
 */
export function parseWediSheet(rows, sheetName) {
  const items = [], warnings = [];
  let section = "", cols = null;
  for (const raw of rows || []) {
    const row = raw || [];
    const cells = row.map(str);
    const pi = cells.findIndex((c) => PART_RE.test(c));
    if (pi >= 0) {
      if (!cols) { warnings.push(`${sheetName}: ${cells[pi]} appears before any header row and was skipped`); continue; }
      const num = (i) => (i >= 0 && typeof row[i] === "number" ? row[i] : null);
      // Size: the captioned column, else two right of the part number (the
      // Pro-Systems block captions no size column). Details: the captioned
      // column when it has text, else the cell right of the size — the joint
      // sealant block captions "Additional Details" at a column that is empty
      // on rows whose real note sits one cell left. Both rules measured
      // against all 223 transcribed rows (plan, "Measured facts").
      const sizeI = cols.size >= 0 ? cols.size : pi + 2;
      const size = (cells[sizeI] || "").replace(/\bin\.\s+in\.$/, "in.");
      const details = (cols.details >= 0 && cells[cols.details]) || cells[sizeI + 1] || "";
      const pct = /less\s*(\d+)\s*%/i.exec(cols.netCaption);
      items.push({
        us: cells[pi].replace(/\*$/, ""),
        name: cells[pi + 1] || "",
        size, details,
        retail: num(cols.retail),
        net: num(cols.net),
        section,
        discount: pct ? +pct[1] : null,
        erp: cols.erp >= 0 ? cells[cols.erp] : "",
      });
      continue;
    }
    const filled = cells.map((c, i) => [c, i]).filter(([c]) => c);
    if (!filled.length) continue;
    const [first] = filled[0];
    const rest = filled.slice(1);
    const isHeader = cells.some((c) => PART_CAP.test(c));
    const pricesCaptioned = rest.some(([c]) => RETAIL_CAP.test(c) || NET_CAP.test(c));
    if (isHeader || pricesCaptioned) {
      let net = -1, netCaption = "";
      // The RIGHTMOST distributor-net column: S-Dry prints a six-column
      // discount ladder and net is the last of it.
      cells.forEach((c, i) => { if (NET_CAP.test(c)) { net = i; netCaption = c; } });
      const erpI = cells.findIndex((c) => ERP_CAP.test(c));
      cols = {
        retail: cells.findIndex((c) => RETAIL_CAP.test(c)),
        net, netCaption,
        size: cells.findIndex((c) => SIZE_CAP.test(c)),
        details: cells.findIndex((c) => DETAILS_CAP.test(c)),
        // Only the sheet's one true header names the ERP column; it carries
        // forward through every section row after it.
        erp: erpI >= 0 ? erpI : (cols ? cols.erp : -1),
      };
      if (!(PART_CAP.test(first) || ERP_CAP.test(first))) section = first;
      continue;
    }
    if (rest.length && rest.every(([c]) => CAPTION_RE.test(c))) section = first;
    // Anything else — title lines, "Full Pallet/Box Quantities Only", the
    // "*Contains …" kit notes, Terms of Sale — is not a row.
  }
  return { items, warnings };
}

// Passthrough mapping: every column is already what parseMapped wants. `size`
// is mapped, so splitSizeFromDescription never runs on wedi's names (they
// carry their size by design). `price` is wedi's published retail — pricedItem
// passes an item with its own price straight through, so row search shows it
// unchanged. `section` is the markup-group axis, as OVF sundries does.
// "Discount %" (column 8) is deliberately unmapped: nothing in the engine
// reads it (spec decision 2); it is on the canonical sheet only so the
// wizard's preview shows it.
export const WEDI_PRICELIST_MAPPING = {
  columns: { 0: "sku", 1: "description", 2: "size", 3: "note", 4: "price", 5: "cost", 6: "section", 7: "vendorSku" },
  headerRow: 0,
  skuPattern: "^(US\\d{7,9}|\\d{9})$",
  defaultType: "",
  groupBy: "section",
};

/**
 * The one entry the import flow calls. Null when the workbook is not a wedi
 * pricelist (the caller falls through to the generic mapped path, exactly as
 * parseOvf's null does). Sheets are walked in WEDI_PRICELIST_SHEETS order and
 * the FIRST sheet to price a part number wins — Fundo over S-Dry — with the
 * disagreement named in a warning so it shows in the wizard.
 */
export function parseWediPricelist(sheets, name = "wedi pricelist") {
  if (!isWediPricelist(sheets)) return null;
  const warnings = [], seen = new Map(), items = [];
  for (const sheetName of WEDI_PRICELIST_SHEETS) {
    const s = sheets.find((x) => str(x?.name) === sheetName);
    if (!s) { warnings.push(`Sheet "${sheetName}" not found — its rows were not imported`); continue; }
    const r = parseWediSheet(s.rows, sheetName);
    warnings.push(...r.warnings);
    if (!r.items.length) warnings.push(`Sheet "${sheetName}" yielded no rows — has its layout changed?`);
    for (const it of r.items) {
      const prev = seen.get(it.us);
      if (prev) {
        if (prev.retail !== it.retail || prev.net !== it.net) {
          warnings.push(`${it.us} is priced on both "${prev.sheet}" ($${prev.retail} / $${prev.net}) and "${sheetName}" ($${it.retail} / $${it.net}) — kept "${prev.sheet}"`);
        }
        continue;
      }
      seen.set(it.us, { ...it, sheet: sheetName });
      items.push(it);
    }
  }
  const skipped = sheets.map((x) => str(x?.name)).filter((n) => n && !WEDI_PRICELIST_SHEETS.includes(n));
  if (skipped.length) warnings.push(`Skipped sheets not in scope: ${skipped.join(", ")}`);
  const CANON = ["Part Number", "Product", "Size", "Details", "Retail", "Distributor net", "Section", "Stock SKU", "Discount %"];
  const rows = [CANON, ...items.map((it) => [it.us, it.name, it.size, it.details, it.retail, it.net, it.section, it.erp, it.discount])];
  return { name, rows, mapping: { ...WEDI_PRICELIST_MAPPING }, warnings, meta: { items: items.length } };
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test src/wedibook.test.js`
Expected: PASS (11 tests). If the "29 distinct Fundo sections" assertion fails, print `new Set(f.items.map(r => r.section))` and compare against `WEDI_SO`'s 29 section strings (`grep -o '"section": "[^"]*"' src/wedi.js | sort -u`) — a mismatch is a whitespace or regex bug in the parser, never a reason to change the number.

- [ ] **Step 5: Commit**

```bash
git add src/wedibook.js src/wedibook.test.js
git commit -m "feat: parse the wedi distribution pricelist into the canonical import sheet (8b Task 2)"
```

---

## Task 3: Wire the parser into the wizard

Spec decision 1 (detector, tag, name) and decision 2 (order-kind book). The wizard's xlsx ingest already forks to `parseOvf` and `parseEmser`; this adds the third fork. `bookKindFor` needs no change — every non-`vendor-sku` format is an order book.

**Files:**
- Modify: `src/dropimport.js:10-40` (import, `fileFormat`), `:114` (`FORMAT_NAMES`)
- Modify: `src/pricebooklib.jsx:16` (import), `:1862-1872` (ingest branch)
- Test: `src/dropimport.test.js`

**Interfaces:**
- Consumes: `isWediPricelist`, `parseWediPricelist` (Task 2).
- Produces: the format tag `"wedi-pricelist"`; `FORMAT_NAMES["wedi-pricelist"] === "wedi pricelist"`.

- [ ] **Step 1: Write the failing tests**

Append to `src/dropimport.test.js` (add `import { PRICELIST_SHEETS } from "./wedipricelistfixture.js";` beside the other imports):

```js
test("fileFormat: the wedi distribution pricelist gets its own tag, and it makes an ORDER book", () => {
  assert.equal(fileFormat({ sheets: PRICELIST_SHEETS }), "wedi-pricelist");
  assert.equal(bookKindFor("wedi-pricelist"), "order");
  // The 8a stock export is still the ERP stock list — the two wedi books never share a tag.
  assert.equal(fileFormat({ sheets: [{ name: "Vendor SKU Analysis", rows: [["Product Code", "Full Description", "Base Price", "Retail Price", "Unit of Stock"], ["47832", "Wedi Washer", 93.42, 154.14, "BX"]] }] }), "vendor-sku");
});

test("routeFile: a pricelist drop names itself when no book matches, and routes to a book stamped with its tag", () => {
  const fp = computeFingerprint({ sheets: PRICELIST_SHEETS, name: "wedi pricelist 2026.xlsx" });
  assert.equal(fp.format, "wedi-pricelist");
  const none = routeFile({ ...fp, sheets: PRICELIST_SHEETS }, []);
  assert.equal(none.target, null);
  assert.equal(none.reason, "wedi pricelist — pick which book");
  const books = [{ id: "so", kind: "order", name: "wedi", data: { importFingerprint: { format: "wedi-pricelist" } } },
    { id: "st", kind: "stock", name: "wedi", data: { importFingerprint: { format: "vendor-sku" } } }];
  const hit = routeFile({ ...fp, sheets: PRICELIST_SHEETS }, books);
  assert.equal(hit.target, "so", "the stock book named wedi is not a candidate — format, not name, routes");
  assert.equal(hit.reason, "wedi pricelist → wedi");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test src/dropimport.test.js`
Expected: FAIL — `fileFormat` returns `"generic"`; `reason` reads "Unrecognized layout — pick a book".

- [ ] **Step 3: Add the tag**

In `src/dropimport.js`, after the `isInterfacePriceList` import (line 12) add:

```js
import { isWediPricelist } from "./wedibook.js";
```

In `fileFormat`, between the Mirage line and the `detectVendorSkuAnalysis` line, add:

```js
  // wedi's distribution pricelist (8b, ADR 0038): a formatted multi-sheet
  // workbook with its own parser, tested before the ERP export like every
  // vendor tag.
  if (isWediPricelist(sheets || [])) return "wedi-pricelist";
```

In `FORMAT_NAMES` (line 114) add the entry `"wedi-pricelist": "wedi pricelist"` before `"vendor-sku"`.

- [ ] **Step 4: Run to verify they pass**

Run: `node --test src/dropimport.test.js`
Expected: PASS.

- [ ] **Step 5: Add the ingest fork**

In `src/pricebooklib.jsx`, after `import { parseMirage } from "./miragebook.js";` add:

```jsx
import { parseWediPricelist } from "./wedibook.js";
```

In `ingest`, directly after the `emser` block (the `if (emser) { … return; }` that ends at line ~1872) and before `setSheets(parsed);`, add:

```jsx
      // wedi's distribution pricelist (8b, src/wedibook.js): five formatted
      // sheets whose column layouts change mid-sheet. Its parser flattens the
      // two in-scope sheets to one canonical sheet, like the OVF and Emser
      // forks above.
      const wedi = parseWediPricelist(parsed, (file?.name || book.name || "book").replace(/\.xlsx?$/i, ""));
      if (wedi) {
        setSheets([{ name: wedi.name, rows: wedi.rows }]);
        setSrcWarn(wedi.warnings || []);
        applyDetected({ sheet: wedi.name, ...wedi.mapping });
        setReading(false);
        return;
      }
```

(`setSrcWarn` is the same setter the Mirage fork uses at line ~1821 to surface parser warnings in the wizard; the OVF/Emser forks don't set it, wedi does because its "kept Fundo's price" and "skipped sheets" warnings are the point.)

- [ ] **Step 6: Build and run the whole suite**

Run: `npm run build` → exit 0. Run: `node --test src/*.test.js` → 1316 pass, 0 fail (1302 + 1 + 11 + 2).

- [ ] **Step 7: Commit**

```bash
git add src/dropimport.js src/dropimport.test.js src/pricebooklib.jsx
git commit -m "feat: the import wizard recognises the wedi pricelist and routes it to an order book (8b Task 3)"
```

---

## Task 4: The `wedi.js` seam and the adapter

Spec decisions 3 and 4. `buildCatalog` reads `SO_SRC || WEDI_SO`; four new exports twin the 8a installers; `wediadapter.js` maps a live order-item row back to the `soRow` contract. Nothing else in `wedi.js` moves.

**Files:**
- Modify: `src/wedi.js:4084` (state), `:4314` (`buildCatalog`), `:4367-4369` (after `stockSourceIsBook`)
- Modify: `src/wediadapter.js` (append)
- Test: `src/wediadapter.test.js` (append)

**Interfaces:**
- Produces (`wedi.js`): `setSoSource(rows)`, `clearSoSource()`, `soSourceIsBook() → boolean`, `stockSourceIs(rows) → boolean`, `soSourceIs(rows) → boolean`, `missingRequiredParts() → string[]` (the `SKU.*` values `item()` cannot resolve on the currently installed sources).
- Produces (`wediadapter.js`): `adaptSoRow(row) → SoRow | null`, `adaptSoRows(rows) → SoRow[]` where `SoRow = { us, name, size, details, retail, net, section, discount: null, erp }`.
- Consumes: `parseWediPricelist`, `WEDI_PRICELIST_MAPPING` (Task 2), `PRICELIST_SHEETS` (Task 1) — tests only.

- [ ] **Step 1: Write the failing adapter tests**

Append to `src/wediadapter.test.js` (extend the existing import lines: add `adaptSoRow, adaptSoRows` to the `./wediadapter.js` import; add `import { parseMapped } from "./pricebook.js";`, `import { bookItemData } from "./orderbook.js";`, `import { PRICELIST_SHEETS } from "./wedipricelistfixture.js";`, `import { parseWediPricelist } from "./wedibook.js";`):

```js
// The pricelist half, through the REAL pipeline: parser → parseMapped →
// the jsonb payload → normBookItem. No fixture of parser output exists on
// purpose (the parser is under test elsewhere); this is what the hook sees.
const liveSo = () => {
  const p = parseWediPricelist(PRICELIST_SHEETS);
  const { items } = parseMapped(p.rows, p.mapping);
  return items.map((it) => normBookItem({ sku: it.sku, active: true, data: bookItemData(it) }, "bk_wedi_so"));
};

test("adaptSoRow: one live order-item row to the transcribed soRow contract", () => {
  const rows = liveSo();
  assert.equal(rows.length, 261, "guard: the whole pricelist came through the pipeline");
  const panel = adaptSoRow(rows.find((r) => r.sku === "US8000006"));
  assert.deepEqual(panel, {
    us: "US8000006",
    name: 'wedi® Building Panel 24"x48"x1/8"',
    size: "Waterproof Tile Backer Board",
    details: "10 sheets/box",
    retail: 35.01,                 // normOrderItem rounded the sheet's 35.0069… to 2 dp, as WEDI_SO has it
    net: 21.22,
    section: "WEDI BUILDING PANELS",
    discount: null,                // nothing reads it (spec decision 2)
    erp: "29952",
  });
});

test("adaptSoRow: a row with no wedi part number drops; erp is empty when the sheet printed none", () => {
  assert.equal(adaptSoRow({ sku: "29WEDIT", description: "Wedi", price: 0, cost: 0, vendorSkus: [] }), null);
  assert.equal(adaptSoRow(null), null);
  const frame = adaptSoRow(liveSo().find((r) => r.sku === "676800061"));
  assert.equal(frame.us, "676800061", "a nine-digit article number is a part number");
  const sdry = adaptSoRow(liveSo().find((r) => r.sku === "US9176001"));
  assert.equal(sdry.erp, "", "S-Dry prints no Stock SKUs column");
  assert.equal(sdry.section, "wedi® S-DRY™ Shower Bases");
});

test("adaptSoRows: 261 in, 261 out — every pricelist row carries a part number", () => {
  const out = adaptSoRows(liveSo());
  assert.equal(out.length, 261);
  assert.equal(new Set(out.map((r) => r.us)).size, 261);
  assert.deepEqual(adaptSoRows(null), []);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test src/wediadapter.test.js`
Expected: FAIL — `adaptSoRow` is not exported.

- [ ] **Step 3: Write the adapter**

Append to `src/wediadapter.js`:

```js
// --- the pricelist half (spec 2026-09-02, 8b) --------------------------------
//
// Much simpler than the stock half above: wedibook.js wrote `size` and
// `description` as separate columns, so nothing was split and nothing needs
// putting back. The one thing to know is what is NOT here — `discount`. The
// transcribed table carried the section caption's "(less N%)", and nothing
// in the engine ever read it (makeEntry does not copy it); the book does not
// carry it and the adapter emits null.

const SO_PART = /^(US\d{7,9}|\d{9})$/;

/** One live order-item row → makeEntry's soRow shape, or null without a wedi part number. */
export function adaptSoRow(row) {
  if (!row || !SO_PART.test(String(row.sku || ""))) return null;
  return {
    us: String(row.sku),
    name: String(row.description || ""),
    size: String(row.size || ""),
    details: String(row.note || ""),
    retail: +row.price || 0,
    net: +row.cost || 0,
    section: String(row.section || ""),
    discount: null,
    erp: (row.vendorSkus || [])[0] || "",
  };
}

export function adaptSoRows(rows) {
  return (rows || []).map(adaptSoRow).filter(Boolean);
}
```

- [ ] **Step 4: Run to verify they pass**

Run: `node --test src/wediadapter.test.js`
Expected: PASS.

- [ ] **Step 5: Write the failing seam tests**

Append to `src/wediadapter.test.js` (add `setSoSource, clearSoSource, soSourceIsBook, stockSourceIs, soSourceIs, missingRequiredParts, catalog, item, setStockSource, clearStockSource, SKU` to the `./wedi.js` import):

```js
test("seam: with nothing installed the catalog is the transcribed one — 269 entries, 151 stock", () => {
  clearStockSource(); clearSoSource();
  assert.equal(soSourceIsBook(), false);
  assert.equal(catalog().length, 269);
  assert.equal(catalog().filter((e) => e.stock).length, 151);
});

test("seam: setSoSource swaps the pricelist half and clears the memo; clearSoSource restores it", () => {
  clearStockSource(); clearSoSource();
  const before = catalog();
  const rows = adaptSoRows(liveSo());
  setSoSource(rows);
  assert.equal(soSourceIsBook(), true);
  assert.equal(soSourceIs(rows), true, "identity, not a boolean");
  assert.equal(soSourceIs(rows.slice()), false, "a copy is a different source");
  assert.notEqual(catalog(), before, "the memo was cleared");
  assert.equal(catalog().length, 273, "151 stock + 122 special-order (118 + the 4 S-Dry parts the shop does not stock)");
  assert.ok(item("US8076001"), "an S-Dry board the engine never priced is now an entry");
  clearSoSource();
  assert.equal(soSourceIsBook(), false);
  assert.equal(catalog().length, 269);
  assert.equal(stockSourceIs(null), true, "nothing installed on the stock side either");
});

test("seam: an empty pricelist source collapses to the fallback, exactly as the stock installer does", () => {
  clearStockSource(); clearSoSource();
  setSoSource([]);
  assert.equal(soSourceIsBook(), false);
  assert.equal(catalog().length, 269);
  clearSoSource();
});

test("missingRequiredParts: every SKU.* constant resolves on the tables, on the book, and on the mix", () => {
  clearStockSource(); clearSoSource();
  assert.deepEqual(missingRequiredParts(), []);
  setSoSource(adaptSoRows(liveSo()));
  assert.deepEqual(missingRequiredParts(), [], "the pricelist carries all 24 — S-Dry brought sdrySeal and sdrySealTrowel");
  setStockSource(adaptBookRows(live()));
  assert.deepEqual(missingRequiredParts(), []);
  // The one constant the stock table does NOT carry is the 620 sealant tube;
  // thin the pricelist of it and the floor names it.
  setSoSource(adaptSoRows(liveSo()).filter((r) => r.us !== SKU.sealant620Tube));
  assert.deepEqual(missingRequiredParts(), [SKU.sealant620Tube]);
  clearStockSource(); clearSoSource();
});
```

- [ ] **Step 6: Run to verify they fail**

Run: `node --test src/wediadapter.test.js`
Expected: FAIL — `setSoSource` is not exported.

- [ ] **Step 7: Cut the seam**

In `src/wedi.js`, directly after `let STOCK_SRC = null;` (line 4084) add:

```js
// The live order-kind book's rows for the pricelist half (spec 2026-09-02,
// 8b), installed by the same hook under the same rule: null means no book and
// buildCatalog falls back to the transcribed WEDI_SO table.
let SO_SRC = null;
```

In `buildCatalog`, change

```js
  const soRows = WEDI_SO.filter((r) => !r.kitNote);
```
to
```js
  const soRows = (SO_SRC || WEDI_SO).filter((r) => !r.kitNote);
```

After `stockSourceIsBook` (line ~4369) add:

```js
export function setSoSource(rows) {
  SO_SRC = rows && rows.length ? rows : null;
  CAT = null; INDEX = null;
}
export function clearSoSource() {
  SO_SRC = null;
  CAT = null; INDEX = null;
}
export function soSourceIsBook() {
  return SO_SRC !== null;
}
// Identity, not a boolean: the hook's re-assert effect has to tell book A's
// rows from book B's, which stockSourceIsBook() cannot.
export function stockSourceIs(rows) {
  return STOCK_SRC === (rows && rows.length ? rows : null);
}
export function soSourceIs(rows) {
  return SO_SRC === (rows && rows.length ? rows : null);
}
// The plausibility floor (spec decision 6): the hardcoded parts the kit
// builder dereferences, checked against what the INSTALLED sources actually
// resolve — whichever mix of book and table each half is on.
export function missingRequiredParts() {
  catalog();
  return Object.values(SKU).filter((k) => !INDEX[k]);
}
```

- [ ] **Step 8: Run to verify they pass, and that nothing pinned moved**

Run: `node --test src/wediadapter.test.js` → PASS. Run: `node --test src/wedi.test.js` → all 43 PASS (nothing installed, nothing changed). Run `node --test src/*.test.js` → 0 fail.

- [ ] **Step 9: Commit**

```bash
git add src/wedi.js src/wediadapter.js src/wediadapter.test.js
git commit -m "feat: wedi.js reads an installable pricelist source, WEDI_SO as fallback (8b Task 4)"
```

---

## Task 5: The acceptance tests — zero drift, and the pinned differences

Spec Verification 2 and decisions 8–9. This is the task that proves the parser and adapter reproduce the transcription, and that names every place they deliberately do not.

**Files:**
- Test: `src/wediequivalence.test.js` (append)

**Interfaces:**
- Consumes: everything from Tasks 1–4.

- [ ] **Step 1: Write the tests**

Append to `src/wediequivalence.test.js` (extend the imports: add `setSoSource, clearSoSource, missingRequiredParts, item` to the `./wedi.js` import; add `adaptSoRows` to the `./wediadapter.js` import; add `import { parseMapped } from "./pricebook.js";`, `import { bookItemData } from "./orderbook.js";`, `import { PRICELIST_SHEETS } from "./wedipricelistfixture.js";`, `import { parseWediPricelist } from "./wedibook.js";`):

```js
// ---- the pricelist half (spec 2026-09-02, 8b) --------------------------------

const liveSo = () => {
  const p = parseWediPricelist(PRICELIST_SHEETS);
  const { items } = parseMapped(p.rows, p.mapping);
  return items.map((it) => normBookItem({ sku: it.sku, active: true, data: bookItemData(it) }, "bk_wedi_so"));
};
const liveStock = () => FIXTURE_ROWS.map((r) => normBookItem(r, "bk_wedi"));
const clearBoth = () => { clearStockSource(); clearSoSource(); };
const byKey = (list) => Object.fromEntries(list.map((e) => [e.key, e]));

// The stock half compares DERIVED (desc excluded, see above). The pricelist
// half adds the four fields that come straight off a soRow and ARE
// byte-reproducible — the measurement walk found zero drift on them.
const SO_DERIVED = [...DERIVED, "section", "size", "soRetail", "soNet"];
const pickSo = (e) => Object.fromEntries(SO_DERIVED.map((k) => [k, e[k]]));

// Spec decision 9: where the parser deliberately differs from the
// transcription, measured row by row. `details` on ten rows — eight where
// the sheet's captioned "Additional Details" column carries text the
// transcription's fixed column 4 never saw, two where the transcription
// hand-edited the sheet's wording. One of the eight moves a derived field:
// unitOf() reads "per box", so the sausage gun becomes BX. Anything not in
// this table that differs is a parser bug.
const PINNED_DETAILS = {
  US5000085: "1 Kit",
  US5000013: "12 per case, full cases only",
  US5000088: "12 per case, full cases only",
  US5000010: "20 per case, full cases only",
  US5000083: "20 per case, full cases only",
  US5000019: "1 per box",
  US5000020: "sold in increments of 10 pcs.",
  US5000044: "25 pcs/case, full cases only",
  US3000001: "Suspended Seat",
  US3000002: "Suspended Seat",
};
const PINNED_UNIT = { US5000019: "BX" };

// The S-Dry parts the engine never priced from a pricelist. 32 of the 36 are
// stocked (they twin a WEDI_STOCK entry — see the twinning test below); these
// four are the only new special-order entries.
const NEW_SO_ONLY = ["US8076001", "US9476013", "US9476014", "US9476015"];

test("pricelist half: the book-fed special-order entries equal the transcribed ones, entry for entry", () => {
  clearBoth();
  const fromTable = catalog().filter((e) => !e.stock);
  assert.equal(fromTable.length, 118, "118 special-order-only entries from the table");

  setSoSource(adaptSoRows(liveSo()));
  const fromBook = byKey(catalog().filter((e) => !e.stock));
  clearBoth();

  assert.deepEqual(Object.keys(fromBook).filter((k) => !fromTable.some((e) => e.key === k)).sort(), NEW_SO_ONLY.slice().sort(),
    "the only additions are the four S-Dry parts the shop does not stock");

  const expected = fromTable.map((e) => {
    const x = pickSo(e);
    if (PINNED_UNIT[e.key]) x.unit = PINNED_UNIT[e.key];
    return x;
  });
  const actual = fromTable.map((e) => pickSo(fromBook[e.key]));
  assert.deepEqual(actual, expected);

  // details, separately, against the allow-list
  for (const e of fromTable) {
    const want = e.key in PINNED_DETAILS ? PINNED_DETAILS[e.key] : e.details;
    assert.equal(fromBook[e.key].details, want, `details on ${e.key}`);
  }
});

test("pricelist half: every entry classifies with both books installed — nothing falls into misc", () => {
  clearBoth();
  setStockSource(adaptBookRows(liveStock()));
  setSoSource(adaptSoRows(liveSo()));
  const all = catalog();
  assert.equal(all.length, 273, "151 stock + 122 special order");
  assert.deepEqual(all.filter((e) => e.group === "misc").map((e) => e.us + " " + e.name), []);
  // The S-Dry line files under its own section by classify's existing rule.
  const sdry = all.filter((e) => /^US\d\d76\d{3}$/.test(e.us));
  assert.ok(sdry.length >= 36, "guard: the S-Dry codes are in the catalog");
  assert.equal(sdry.every((e) => e.group === "sdry" || (e.group === "pan" && e.sub === "sdry")), true);
  clearBoth();
});

// Spec decision 8, measured: 34 stock entries — the two SS27/SS43 linear
// cover frames and 32 S-Dry parts the shop stocks — gain a pricelist twin
// they never had, and makeEntry names a twinned entry from the pricelist.
// Every OTHER stock entry is identical to the table on every derived field.
// The twinned 34 may differ ONLY in the fields a soRow feeds. A difference in
// any other field (w, d, t, drain, channel, cost, retail…) is a finding to
// report to the owner, never a key to add to this list.
const NEW_TWINS = ["676800061", "676800064",
  "US5076009", "US5076008", "US9176001", "US9176002", "US9176003", "US9176004",
  "US2076001", "US2076002", "US3076003", "US3076001", "US3076002",
  "US1076002", "US1076006", "US1076001", "US1076003", "US1076005", "US1076007", "US1076004", "US1076008",
  "US9476016", "US9476011", "US9476012", "US9476006",
  "US5076011", "US5076010", "US5076007", "US5076002", "US5076001", "US5076005", "US5076004", "US5076003", "US5076006"];
const TWIN_MAY_DIFFER = new Set(["name", "section", "size", "details", "soRetail", "soNet", "sizeText"]);

test("stock half: with both books installed, only the 34 newly twinned entries change, and only where a soRow feeds them", () => {
  clearBoth();
  setStockSource(adaptBookRows(liveStock()));
  const stockOnly = byKey(catalog().filter((e) => e.stock));
  setSoSource(adaptSoRows(liveSo()));
  const both = byKey(catalog().filter((e) => e.stock));
  clearBoth();

  assert.deepEqual(Object.keys(both).sort(), Object.keys(stockOnly).sort(), "the stock half has the same keys");
  const FIELDS = [...SO_DERIVED, "details"];
  const changed = [];
  for (const k of Object.keys(stockOnly)) {
    const diff = FIELDS.filter((f) => JSON.stringify(stockOnly[k][f]) !== JSON.stringify(both[k][f]));
    if (diff.length) changed.push([k, diff]);
  }
  assert.deepEqual(changed.map(([k]) => k).sort(), NEW_TWINS.slice().sort(), "exactly the pinned keys changed");
  for (const [k, diff] of changed) {
    const outside = diff.filter((f) => !TWIN_MAY_DIFFER.has(f));
    assert.deepEqual(outside, [], `${k} changed outside the soRow-fed fields: ${outside.join(", ")} — report this, do not allow-list it`);
  }
});

test("the pinned engine totals do not move with BOTH books feeding the catalog", () => {
  const INPUT = { w: 36, d: 60, curb: "curbed", drain: "any" };
  const stripDesc = (v) => {
    if (Array.isArray(v)) return v.map(stripDesc);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v).filter(([k]) => k !== "desc").map(([k, x]) => [k, stripDesc(x)]));
    }
    return v;
  };
  clearBoth();
  const beforeKit = stripDesc(kitFor("US9100004")), beforeSol = stripDesc(solve(INPUT));
  assert.ok(beforeKit && beforeKit.lines.length, "guard: a kit was built");
  setStockSource(adaptBookRows(liveStock()));
  setSoSource(adaptSoRows(liveSo()));
  const afterKit = stripDesc(kitFor("US9100004")), afterSol = stripDesc(solve(INPUT));
  clearBoth();
  assert.deepEqual(afterKit, beforeKit, "kitFor is unchanged");
  assert.deepEqual(afterSol, beforeSol, "solve is unchanged");
});
```

- [ ] **Step 2: Run them**

Run: `node --test src/wediequivalence.test.js`
Expected: PASS. Three failure modes are anticipated, and each is a finding, not a test to loosen:

1. *The first test fails on a field other than `details`/`unit`.* The assertion names the key and field. Diagnose in the parser/adapter (Task 2/4); the measurement walk (`proto-roundtrip.mjs`) reproduced these rows exactly, so a mismatch is code drift from the plan's regexes.
2. *The twinning test reports a key outside `NEW_TWINS`, or a field outside `TWIN_MAY_DIFFER`.* Do not extend either list. Record the exact output in the ledger and stop for the owner: it means a pan's geometry or a price moved when its pricelist twin arrived, which decision 8 does not cover.
3. *`sizeText` differs on a twinned entry in a way that reads worse* (a bare "50x25" where the table read "50\" × 25'"). Allowed by the list; note the examples for the Task 8 preview so the owner sees them.

- [ ] **Step 3: Commit**

```bash
git add src/wediequivalence.test.js
git commit -m "test: the pricelist half's zero-drift baseline and its pinned differences (8b Task 5)"
```

---

## Task 6: The two `kitFor` guards

Spec decision 6, second half. `push()` is already null-safe, and so is `coverFrameFor`; the one live dereference is `panel.sf` inside `push`'s argument list at `wedi.js:5117`. Both sites get a hint so a partial import degrades with a message instead of a missing line nobody notices.

**Files:**
- Modify: `src/wedi.js:5115-5117`, `:5148-5150`
- Modify: `src/WediConfigurator.jsx:2001-2008` (hint lines)
- Test: `src/wediequivalence.test.js` (append)

**Interfaces:**
- Produces: two new `hints` codes on a `kitFor` result — `"no-panel"`, `"no-cover"`.

- [ ] **Step 1: Write the failing test**

Append to `src/wediequivalence.test.js`:

```js
// The guards (spec decision 6). The hook's floor refuses a book missing a
// SKU.* constant, so this cannot happen through the popup — but the installers
// are module-level and a future caller might not go through the hook. Force
// both sources in without the parts and the kit must degrade, not throw.
test("kitFor degrades with a hint, never a TypeError, when the building panel or the cover is in no source", () => {
  clearBoth();
  const noPanel = (rows) => rows.filter((r) => r.us !== SKU.panelDefault);
  setStockSource(noPanel(adaptBookRows(liveStock())));
  setSoSource(noPanel(adaptSoRows(liveSo())));
  assert.equal(item(SKU.panelDefault), null, "guard: the panel is really gone from both sources");
  let kit;
  assert.doesNotThrow(() => { kit = kitFor("US9100004"); });
  assert.ok(kit && kit.lines.length, "the kit still builds");
  assert.equal(kit.lines.every((l) => l.item), true, "no line carries a null item");
  assert.equal(kit.lines.some((l) => l.group === "walls"), false, "no wall sheets were priced off nothing");
  assert.ok(kit.hints.includes("no-panel"));
  clearBoth();

  const noCover = (rows) => rows.filter((r) => r.us !== SKU.coverSS);
  setStockSource(noCover(adaptBookRows(liveStock())));
  setSoSource(noCover(adaptSoRows(liveSo())));
  assert.equal(item(SKU.coverSS), null);
  assert.doesNotThrow(() => { kit = kitFor("US9100004"); });
  assert.equal(kit.lines.every((l) => l.item), true);
  assert.ok(kit.hints.includes("no-cover"));
  clearBoth();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node --test src/wediequivalence.test.js`
Expected: FAIL — `TypeError: Cannot read properties of null (reading 'sf')` on the panel case.

- [ ] **Step 3: Guard both sites**

In `src/wedi.js`, replace lines 5115-5117

```js
  const sheets = panel && panel.sf ? Math.ceil(panelSf / panel.sf) : 0;
  push(lines, panel, sheets, "walls",
    round2(panelSf) + " sf of wall — " + (panel.sf || 0) + " sf/sheet", true);
```
with
```js
  const sheets = panel && panel.sf ? Math.ceil(panelSf / panel.sf) : 0;
  // A live book can drop the default panel; the floor in usewedicatalog.js
  // refuses such a book, and this is the belt to that brace.
  if (panel) push(lines, panel, sheets, "walls",
    round2(panelSf) + " sf of wall — " + (panel.sf || 0) + " sf/sheet", true);
  else hints.push("no-panel");
```

and replace lines 5148-5150

```js
  } else cover = item(SKU.coverSS);
  push(lines, cover, 1, "drain", "", true);
  const frame = opts.coverFrame ? coverFrameFor(cover, opts.coverFrame === true ? null : opts.coverFrame) : null;
```
with
```js
  } else cover = item(SKU.coverSS);
  if (cover) push(lines, cover, 1, "drain", "", true);
  else hints.push("no-cover");
  const frame = cover && opts.coverFrame ? coverFrameFor(cover, opts.coverFrame === true ? null : opts.coverFrame) : null;
```

Confirm `hints` is the array declared at line 5040 (`const lines = [], hints = [];`) — both sites are inside `kitFor`, so it is in scope.

In `src/WediConfigurator.jsx`, after the `small-order` hint block (ends line ~2008) add:

```jsx
          {build.hints.includes("no-panel") && (
            <div className="whint">No wedi building panel in the price book — wall sheets were not priced. Re-import the book, or pick a panel by hand.</div>
          )}
          {build.hints.includes("no-cover") && (
            <div className="whint">No drain cover in the price book — the drain line was left off. Re-import the book, or pick a cover by hand.</div>
          )}
```

- [ ] **Step 4: Run to verify it passes**

Run: `node --test src/wediequivalence.test.js` → PASS. Run `node --test src/wedi.test.js` → PASS (the pinned kits carry panels and covers, so no hint appears).

- [ ] **Step 5: Commit**

```bash
git add src/wedi.js src/WediConfigurator.jsx src/wediequivalence.test.js
git commit -m "fix: kitFor degrades with a hint when the panel or cover is in no source (8b Task 6)"
```

---

## Task 7: `usewedicatalog.js` — two halves, one gate, the floor

Spec decisions 5 and 6. The hook fetches both id-sets, runs the existing pure `gateOf` once per half, installs what the gates decided through `installSources` (which applies the floor), and re-asserts by identity.

**Files:**
- Modify: `src/usewedicatalog.js`
- Test: `src/usewedicatalog.test.js` (append)

**Interfaces:**
- Consumes: `adaptSoRows` (Task 4); `setSoSource`, `clearSoSource`, `stockSourceIs`, `soSourceIs`, `missingRequiredParts` (Task 4).
- Produces:
  - `pickWediSoBooks(books) → string[]`
  - `installSources({ stock, so }) → { stock, so, onBook: { stock: boolean, so: boolean }, missing: { stock: string[], so: string[] } }` — installs, applies the floor, returns the decision
  - `fallbackCaption(onBook, missing) → string` — `""`, `" · transcribed stock table"`, `" · transcribed pricelist"`, `" · transcribed tables"`, each optionally followed by ` (book is missing N required parts: …)`
  - `useWediCatalog(...)` now returns `{ cat, catReady, onBook: { stock, so }, caption, bookError, retryBook }` — **`onBook` is an object now**; Task 8 updates the one consumer.

- [ ] **Step 1: Write the failing tests**

Append to `src/usewedicatalog.test.js` (extend the import: add `pickWediSoBooks, installSources, fallbackCaption`; add `import { normBookItem, bookItemData } from "./orderbook.js";`, `import { parseMapped } from "./pricebook.js";`, `import { FIXTURE_ROWS } from "./wedifixture.js";`, `import { PRICELIST_SHEETS } from "./wedipricelistfixture.js";`, `import { parseWediPricelist } from "./wedibook.js";`, `import { adaptBookRows, adaptSoRows } from "./wediadapter.js";`, `import { catalog, clearStockSource, clearSoSource, stockSourceIsBook, soSourceIsBook, SKU } from "./wedi.js";`):

```js
test("pickWediSoBooks: ORDER-kind, active, word-matching wedi — the stock book named wedi is never a candidate", () => {
  const books = [
    { id: "a", kind: "stock", name: "wedi", active: true },
    { id: "b", kind: "order", name: "wedi", active: true },
    { id: "c", kind: "order", name: "wedi pricelist", active: true },
    { id: "d", kind: "order", name: "retired wedi", active: false },
    { id: "e", kind: "order", name: "", data: { brandLabel: "WEDI" }, active: true },
    { id: "f", kind: "order", name: "Swedish oak" },
    { id: "g", kind: "order", name: "Schluter" },
  ];
  assert.deepEqual(pickWediSoBooks(books), ["b", "c", "e"]);
  assert.deepEqual(pickWediBooks(books), ["a"], "and the stock picker still sees only the stock book");
  assert.deepEqual(pickWediSoBooks([]), []);
  assert.deepEqual(pickWediSoBooks(null), []);
});

const liveStock = () => adaptBookRows(FIXTURE_ROWS.map((r) => normBookItem(r, "bk_wedi")));
const liveSo = () => {
  const p = parseWediPricelist(PRICELIST_SHEETS);
  const { items } = parseMapped(p.rows, p.mapping);
  return adaptSoRows(items.map((it) => normBookItem({ sku: it.sku, active: true, data: bookItemData(it) }, "bk_wedi_so")));
};
const clearBoth = () => { clearStockSource(); clearSoSource(); };

test("installSources: both books with rows install both; the floor is satisfied", () => {
  clearBoth();
  const stock = liveStock(), so = liveSo();
  const plan = installSources({ stock, so });
  assert.deepEqual(plan.onBook, { stock: true, so: true });
  assert.deepEqual(plan.missing, { stock: [], so: [] });
  assert.equal(plan.stock, stock, "the decision carries the installed rows by identity");
  assert.equal(plan.so, so);
  assert.equal(stockSourceIsBook(), true);
  assert.equal(soSourceIsBook(), true);
  assert.equal(catalog().length, 273);
  clearBoth();
});

test("installSources: a pricelist book missing a required part is REFUSED — visibly — and the pricelist falls back to the table", () => {
  clearBoth();
  const stock = liveStock();
  const thin = liveSo().filter((r) => r.us !== SKU.sealant620Tube);   // the one SKU.* the stock table lacks
  const plan = installSources({ stock, so: thin });
  assert.deepEqual(plan.onBook, { stock: true, so: false });
  assert.deepEqual(plan.missing, { stock: [], so: [SKU.sealant620Tube] });
  assert.equal(plan.so, null);
  assert.equal(soSourceIsBook(), false, "WEDI_SO is back in");
  assert.equal(stockSourceIsBook(), true, "the stock book stays");
  assert.equal(catalog().length, 269);
  clearBoth();
});

test("installSources: no books at all — both tables, nothing missing; empty rows count as no book", () => {
  clearBoth();
  assert.deepEqual(installSources({ stock: null, so: null }).onBook, { stock: false, so: false });
  assert.deepEqual(installSources({ stock: [], so: [] }).onBook, { stock: false, so: false });
  assert.equal(catalog().length, 269);
  clearBoth();
});

test("fallbackCaption: the four states, and the floor's message", () => {
  assert.equal(fallbackCaption({ stock: true, so: true }, { stock: [], so: [] }), "");
  assert.equal(fallbackCaption({ stock: true, so: false }, { stock: [], so: [] }), " · transcribed pricelist");
  assert.equal(fallbackCaption({ stock: false, so: true }, { stock: [], so: [] }), " · transcribed stock table");
  assert.equal(fallbackCaption({ stock: false, so: false }, { stock: [], so: [] }), " · transcribed tables");
  assert.equal(fallbackCaption({ stock: true, so: false }, { stock: [], so: ["US5000088"] }),
    " · transcribed pricelist (book is missing 1 required part: US5000088)");
  assert.equal(fallbackCaption({ stock: false, so: false }, { stock: ["US8000017"], so: ["US8000017", "US5000088"] }),
    " · transcribed tables (book is missing 2 required parts: US8000017, US5000088)");
  assert.equal(fallbackCaption(null, null), " · transcribed tables");
});

test("two halves: catReady is the AND of the two gates — either half waiting holds the popup", () => {
  const ready = (o) => gateOf({ bookStockReady: true, ...o });
  const stockOn = ready({ targetIds: "s", loadedIds: "s", rows: [{}], adapted: [{}] });
  const soWaiting = ready({ targetIds: "o", loadedIds: "o", rows: null, adapted: null });
  const soNone = ready({ targetIds: "", loadedIds: "", rows: [], adapted: null });
  assert.equal(stockOn.catReady && soWaiting.catReady, false, "a present-but-unloaded pricelist book blocks");
  assert.equal(stockOn.catReady && soNone.catReady, true, "no pricelist book at all falls back");
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test src/usewedicatalog.test.js`
Expected: FAIL — `pickWediSoBooks` is not exported.

- [ ] **Step 3: Rewrite the hook**

Replace the import block at the top of `src/usewedicatalog.js` with:

```js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adaptBookRows, adaptSoRows } from "./wediadapter.js";
import {
  catalog, setStockSource, clearStockSource, setSoSource, clearSoSource,
  stockSourceIs, soSourceIs, missingRequiredParts,
} from "./wedi.js";
```

Update the file's header comment: the second paragraph ("This is the ONLY place allowed to call setStockSource/clearStockSource…") now names all four installers — `setStockSource/clearStockSource/setSoSource/clearSoSource` — and the first line reads "The wedi catalog: live registry rows for BOTH halves through wediadapter.js, with the transcribed WEDI_STOCK and WEDI_SO tables as VISIBLE fallbacks (specs 2026-09-01 and 2026-09-02)."

After `pickWediBooks` add:

```js
/** Ids of the active ORDER-kind books that say wedi — the pricelist book (8b). */
export function pickWediSoBooks(books) {
  return (books || [])
    .filter((b) => b.kind === "order" && b.active !== false
      && /\bwedi\b/i.test((b.name || "") + " " + ((b.data && b.data.brandLabel) || "")))
    .map((b) => b.id);
}
```

After `bookErrorOf` add:

```js
/**
 * Install what the two gates decided, then apply the plausibility floor
 * (spec 2026-09-02, decision 6): if any SKU.* constant resolves on NEITHER
 * installed source, refuse the pricelist book first — it is the book the
 * floor exists for — then the stock book, until every part resolves. What
 * is refused falls back to its transcribed table, and the caption says so
 * with the part numbers. Returns the decision: the re-assert effect replays
 * it, the caption reads it.
 */
export function installSources({ stock, so }) {
  const apply = (s, o) => {
    if (s) setStockSource(s); else clearStockSource();
    if (o) setSoSource(o); else clearSoSource();
    return missingRequiredParts();
  };
  const missing = { stock: [], so: [] };
  let stockRows = stock && stock.length ? stock : null;
  let soRows = so && so.length ? so : null;
  let gone = apply(stockRows, soRows);
  if (gone.length && soRows) { missing.so = gone; soRows = null; gone = apply(stockRows, soRows); }
  if (gone.length && stockRows) { missing.stock = gone; stockRows = null; gone = apply(stockRows, soRows); }
  return { stock: stockRows, so: soRows, onBook: { stock: !!stockRows, so: !!soRows }, missing };
}

/** The Browse caption's suffix: which half is on its transcribed table, and why. */
export function fallbackCaption(onBook, missing) {
  const off = [];
  if (!onBook || !onBook.stock) off.push("stock table");
  if (!onBook || !onBook.so) off.push("pricelist");
  if (!off.length) return "";
  const parts = [...new Set([...((missing && missing.stock) || []), ...((missing && missing.so) || [])])];
  return " · transcribed " + (off.length === 2 ? "tables" : off[0])
    + (parts.length ? ` (book is missing ${parts.length} required part${parts.length === 1 ? "" : "s"}: ${parts.join(", ")})` : "");
}

// One half's fetch state: the rows AND the id-set they were fetched for
// travel together, which is what makes a stale result detectable at render
// time (see gateOf). Both halves run this; the loader ref and nonce are shared.
function useHalf({ enabled, targetIds, loaderRef, hasLoader, nonce }) {
  const [loaded, setLoaded] = useState({ ids: null, rows: null, err: false });
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const ids = targetIds ? targetIds.split("|") : [];
    if (!ids.length) { setLoaded({ ids: targetIds, rows: [], err: false }); return; }
    const load = loaderRef.current;
    if (!load) { setLoaded({ ids: targetIds, rows: null, err: false }); return; }  // book, no loader — WAIT
    Promise.all(ids.map((id) => load(id).catch(() => null)))
      // A failed fetch is null, NOT []: one failure among several nulls the
      // whole half — a partial catalog quotes wrong without looking wrong.
      .then((lists) => {
        if (!alive) return;
        const rows = foldBookLists(lists);
        setLoaded({ ids: targetIds, rows, err: rows === null });
      })
      .catch(() => { if (alive) setLoaded({ ids: targetIds, rows: null, err: true }); });
    return () => { alive = false; };
  }, [enabled, targetIds, hasLoader, nonce]);
  return [loaded, setLoaded];
}
```

Replace the whole `useWediCatalog` function (keep its JSDoc, adding `@returns onBook {stock, so}` and `caption`) with:

```js
export function useWediCatalog({ bookStockReady, books, loadBookItems, enabled = true }) {
  // Held in a ref, keyed on whether a loader EXISTS — see the 8a note: the
  // loader is re-created every render and as a dependency re-fired a full
  // fetch (and a rebuild of the catalog) on every keystroke behind the popup.
  const loaderRef = useRef(loadBookItems);
  useEffect(() => { loaderRef.current = loadBookItems; });
  const hasLoader = !!loadBookItems;
  const [nonce, setNonce] = useState(0);

  const stockIds = pickWediBooks(books).join("|");
  const soIds = pickWediSoBooks(books).join("|");
  const [stockLoaded, setStockLoaded] = useHalf({ enabled, targetIds: stockIds, loaderRef, hasLoader, nonce });
  const [soLoaded, setSoLoaded] = useHalf({ enabled, targetIds: soIds, loaderRef, hasLoader, nonce });

  const stockAdapted = useMemo(() => (stockLoaded.rows ? adaptBookRows(stockLoaded.rows) : null), [stockLoaded.rows]);
  const soAdapted = useMemo(() => (soLoaded.rows ? adaptSoRows(soLoaded.rows) : null), [soLoaded.rows]);
  const stockGate = gateOf({ targetIds: stockIds, bookStockReady, loadedIds: stockLoaded.ids, rows: stockLoaded.rows, adapted: stockAdapted });
  const soGate = gateOf({ targetIds: soIds, bookStockReady, loadedIds: soLoaded.ids, rows: soLoaded.rows, adapted: soAdapted });
  const catReady = enabled && stockGate.catReady && soGate.catReady;

  // The install happens inside a useMemo so the catalog() below reads the
  // sources THIS render decided on (8a's reasoning); the effect after it puts
  // the decision back if React abandoned the render that made it.
  const plan = useMemo(
    () => (catReady ? installSources({ stock: stockGate.onBook ? stockAdapted : null, so: soGate.onBook ? soAdapted : null }) : null),
    [catReady, stockGate.onBook, soGate.onBook, stockAdapted, soAdapted]);
  const cat = useMemo(() => (plan ? catalog() : []), [plan]);
  useEffect(() => {
    if (!plan) return;
    if (!stockSourceIs(plan.stock) || !soSourceIs(plan.so)) installSources(plan);
  }, [plan]);

  const bookError = enabled && (
    bookErrorOf({ targetIds: stockIds, loadedIds: stockLoaded.ids, err: stockLoaded.err })
    || bookErrorOf({ targetIds: soIds, loadedIds: soLoaded.ids, err: soLoaded.err }));
  const retryBook = useCallback(() => {
    setStockLoaded({ ids: null, rows: null, err: false });
    setSoLoaded({ ids: null, rows: null, err: false });
    setNonce((n) => n + 1);
  }, []);

  const onBook = plan ? plan.onBook : { stock: false, so: false };
  const caption = plan ? fallbackCaption(plan.onBook, plan.missing) : "";
  return { cat, catReady, onBook, caption, bookError, retryBook };
}
```

Delete the old single-half `loaded` state, its effect, the old `adapted`/`gate`/`cat` memos and the old re-assert effect — `useHalf` and `installSources` replace them. The file should no longer reference `stockSourceIsBook` (kept exported from `wedi.js` for the tests).

- [ ] **Step 4: Run to verify they pass**

Run: `node --test src/usewedicatalog.test.js` → PASS. Run `node --test src/*.test.js` → 0 fail. Run `npm run build` → exit 0 (the popup still compiles; it reads `onBook` as a boolean until Task 8, which only affects the caption text).

- [ ] **Step 5: Commit**

```bash
git add src/usewedicatalog.js src/usewedicatalog.test.js
git commit -m "feat: useWediCatalog gates both wedi books and applies the SKU floor (8b Task 7)"
```

---

## Task 8: The popup reads the caption, and the preview proof

Spec decision 5 (caption) and Verification 5 (non-negotiable 3). The only UI text that changes is the Browse tab's caption; the two hint lines landed in Task 6. The proof runs the REAL popup and the REAL wizard over fixture data, with no Supabase — the same harness pattern as `src/wedipreview.jsx` and `.scratch/119_address-maps-paste/shot.mjs`.

**Files:**
- Modify: `src/WediConfigurator.jsx:616-636` (wrapper → body props), `:2483` (caption)
- Modify: `src/wedipreview.jsx` (a `?mode=` switch for the wedi books)
- Create: `.scratch/120_wedi-pricelist-book/wizard-preview.jsx`, `.scratch/120_wedi-pricelist-book/wizard-preview.html`, `.scratch/120_wedi-pricelist-book/shot.mjs`
- Output: `.scratch/120_wedi-pricelist-book/*.png`

**Interfaces:**
- Consumes: `useWediCatalog`'s `caption` (Task 7).

- [ ] **Step 1: Wire the caption**

In `src/WediConfigurator.jsx`, the wrapper (line ~616):

```jsx
  const { cat, catReady, caption, bookError, retryBook } = useWediCatalog(props);
```
and its last line:
```jsx
  return <WediConfiguratorBody {...props} cat={cat} caption={caption} />;
```
In `WediConfiguratorBody`'s parameter list replace `cat, onBook,` with `cat, caption,`. At the caption (line ~2483) replace

```jsx
      + (onBook ? "" : " · transcribed table")],
```
with
```jsx
      + caption],
```

Grep to confirm no other `onBook` reference remains in the file: `grep -n onBook src/WediConfigurator.jsx` → nothing. `CompareTab.jsx` reads only `catReady` and needs no change.

- [ ] **Step 2: Build and run the suite**

`npm run build` → exit 0. `node --test src/*.test.js` → 0 fail.

- [ ] **Step 3: Extend the popup harness with the wedi book states**

In `src/wedipreview.jsx`, after the `eftRows` definition add:

```jsx
import { FIXTURE_ROWS as WEDI_STOCK_ROWS } from "./wedifixture.js";
import { PRICELIST_SHEETS } from "./wedipricelistfixture.js";
import { parseWediPricelist } from "./wedibook.js";
import { parseMapped } from "./pricebook.js";
import { bookItemData, normBookItem } from "./orderbook.js";

// ?mode=none|stock|so|both|floor — which wedi books exist, for the Browse
// caption's five states (spec 2026-09-02 decision 5/6). `floor` is a
// pricelist book missing the one SKU.* the stock table lacks, so the hook
// refuses it and names it.
const MODE = new URLSearchParams(location.search).get("mode") || "both";
const wediStockRows = WEDI_STOCK_ROWS.map((r) => normBookItem(r, "bk_wedi"));
const wediSoRows = (() => {
  const p = parseWediPricelist(PRICELIST_SHEETS);
  const { items } = parseMapped(p.rows, p.mapping);
  const rows = items.map((it) => normBookItem({ sku: it.sku, active: true, data: bookItemData(it) }, "bk_wedi_so"));
  return MODE === "floor" ? rows.filter((r) => r.sku !== "US5000088") : rows;
})();
const wediBooks = [
  ...(MODE === "stock" || MODE === "both" || MODE === "floor" ? [{ id: "bk_wedi", kind: "stock", active: true, name: "wedi" }] : []),
  ...(MODE === "so" || MODE === "both" || MODE === "floor" ? [{ id: "bk_wedi_so", kind: "order", active: true, name: "wedi" }] : []),
];
```

(Move these imports up beside the others — imports must be top-level.) Then change the two props:

```jsx
      books={[{ id: "bk_eft", kind: "order", active: true, name: "Schluter EFT" }, ...wediBooks]}
      loadBookItems={async (id) => (id === "bk_wedi" ? wediStockRows : id === "bk_wedi_so" ? wediSoRows : eftRows)}
```

- [ ] **Step 4: A wizard harness over the fixture**

Create `.scratch/120_wedi-pricelist-book/wizard-preview.html` (copy `.scratch/119_address-maps-paste/preview.html`, change the title to "wedi pricelist — import wizard" and the script src to `/.scratch/120_wedi-pricelist-book/wizard-preview.jsx`).

Create `.scratch/120_wedi-pricelist-book/wizard-preview.jsx`:

```jsx
// Preview harness: the REAL BookImportWizard fed the committed pricelist
// snapshot as a pre-parsed drop, so the recognition, the parser warnings and
// the diff preview can be shot with no Supabase and no workbook. Dev-only.
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { BookImportWizard } from "../../src/pricebooklib.jsx";
import { PRICELIST_SHEETS } from "../../src/wedipricelistfixture.js";

const inp = "ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm";
const lbl = "ft-eyebrow text-[10px] mb-1 block";
const book = { id: "bk_wedi_so", kind: "order", name: "wedi", active: true, data: {} };

createRoot(document.getElementById("preview")).render(
  <div className="p-4" style={{ background: "var(--ft-bg)", minHeight: "100vh" }}>
    <BookImportWizard book={book} existingItems={[]} preParsed={{ sheets: PRICELIST_SHEETS, format: "wedi-pricelist" }}
      onClose={() => {}} onApply={(items) => console.log("apply", items.length)} saveMapping={() => {}}
      types={["tile", "floor"]} typeLabels={{ tile: "Tile", floor: "Floor" }} inp={inp} lbl={lbl} hideCosts={false}
      addClaudeIssue={() => {}} />
  </div>,
);
```

If `BookImportWizard` needs a prop this harness does not pass (a render error in the console names it), add it with an inert value — never change the component to suit the harness.

- [ ] **Step 5: The shot script**

Create `.scratch/120_wedi-pricelist-book/shot.mjs`:

```js
// Screenshot run for the 8b preview proof. `npx vite --port 5199` first.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_LIB || "playwright-core");

const OUT = "/home/user/Flooring-Tracker/.scratch/120_wedi-pricelist-book";
const browser = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 860 } });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
page.on("console", (m) => m.type() === "error" && console.log("[console]", m.text()));

// The popup's Browse caption in its five states.
for (const mode of ["none", "stock", "so", "both", "floor"]) {
  await page.goto(`http://localhost:5199/wedi-preview.html?mode=${mode}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  await page.getByRole("button", { name: /^Browse/ }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/popup-${mode}.png` });
}
// The two renamed frames and an S-Dry twin, in Browse with both books on.
await page.goto("http://localhost:5199/wedi-preview.html?mode=both", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^Browse/ }).click();
await page.getByPlaceholder(/search/i).fill("SS27");
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/browse-frame-ss27.png` });
await page.getByPlaceholder(/search/i).fill("S-DRY SEAL");
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/browse-sdry-seal.png` });

// The wizard recognising the workbook: warnings + the diff preview.
await page.goto("http://localhost:5199/.scratch/120_wedi-pricelist-book/wizard-preview.html", { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.screenshot({ path: `${OUT}/wizard-recognised.png`, fullPage: true });

await browser.close();
console.log("done");
```

If the Browse tab's button or the search box are located differently (check the JSX for the tab button and the search input's placeholder), fix the locator in the script — not the app.

- [ ] **Step 6: Run it**

```bash
npx vite --port 5199 &   # dev server over the harness pages only — it opens NO Supabase session; the harness imports no supabase client
node .scratch/120_wedi-pricelist-book/shot.mjs
```

Look at every PNG. Expected: `popup-none` caption ends "· transcribed tables"; `popup-stock` "· transcribed pricelist"; `popup-so` "· transcribed stock table"; `popup-both` no suffix; `popup-floor` "· transcribed pricelist (book is missing 1 required part: US5000088)". `browse-frame-ss27` shows "wedi Fundo® Linear Drain Cover Frame SS27"; `browse-sdry-seal` shows the S-Dry seal under its pricelist name. `wizard-recognised` shows the parser warnings (the kept-Fundo-price line, the skipped-sheets line) and 261 rows in the preview. If a caption is wrong, that is a hook bug (Task 7), not a screenshot problem.

- [ ] **Step 7: Commit the proof**

```bash
git add src/WediConfigurator.jsx src/wedipreview.jsx .scratch/120_wedi-pricelist-book/wizard-preview.jsx .scratch/120_wedi-pricelist-book/wizard-preview.html .scratch/120_wedi-pricelist-book/shot.mjs .scratch/120_wedi-pricelist-book/*.png
git commit -m "feat: the wedi popup's Browse caption names which half is on a transcribed table; preview proof (8b Task 8)"
```

Then attach the PNGs to PR #355 (a comment listing them by state) so the owner sees the rename of decision 8 before merge.

---

## Task 9: Record the decision — ADR 0038, the index, the spec, `src/CLAUDE.md`, the handoff

**Files:**
- Create: `docs/adr/0038-wedi-pricelist-side-registry-driven.md`
- Modify: `docs/adr/README.md` (append a row after 0037)
- Modify: `docs/adr/0037-wedi-stock-side-registry-driven.md` (an amendment note under decision 2 and 3)
- Modify: `docs/superpowers/specs/2026-09-02-wedi-pricelist-book-design.md` (status line; nothing else — the measured refinements were folded in before the plan was written)
- Modify: `src/CLAUDE.md` (entries)
- Modify: `.scratch/120_wedi-pricelist-book/HANDOFF.md` (`status: done` once #355 merges — until then leave `ready-for-agent` and add a "Progress" line naming the plan)

- [ ] **Step 1: Write the ADR**

`docs/adr/0038-wedi-pricelist-side-registry-driven.md`, following 0037's shape exactly (Status/Date/Scope/Related, Context, Decision, Consequences). The Decision numbered list, verbatim in substance:

1. wedi's pricelist half is registry-driven as of this change: an order-kind registry book named "wedi", created by the owner by dropping the distribution pricelist on the wizard, parsed by `src/wedibook.js` (the sanctioned dedicated-parser exception, ADR 0009 §4), mapped by `adaptSoRows` in `src/wediadapter.js`. Scope is the "wedi Fundo" and "wedi S-Dry" sheets; Builder Choice, Wellness and Spa, and New Product Data are skipped by name and named in a warning, each pending its own owner decision (retail rule; part-number identity; no prices).
2. `WEDI_SO` remains as the no-book fallback, as `WEDI_STOCK` does; both are removable together in a later PR once the team has run on both books (owner, 2026-09-02). Amends ADR 0037 decision 2's "until 8b lands": 8b landed and kept them, deliberately.
3. The gate is per half (ADR 0037 decision 4's three-way rule, applied twice), and the popup opens only when both halves are ready. The Browse caption names which half is on a transcribed table.
4. The plausibility floor: a book-fed half that would leave any `SKU.*` constant unresolvable is refused — the pricelist first, then the stock — and falls back to its table with the missing parts named. `kitFor`'s panel and cover sites are also null-guarded with hints.
5. `discount` is not carried: nothing reads it. `details` is read by caption, not the transcription's column position; the ten rows where that differs are pinned in `wediequivalence.test.js`, one of which (`US5000019`, "1 per box") changes its unit to BX.
6. Thirty-four stock entries gain a pricelist twin they never had (the two SS27/SS43 frames and 32 stocked S-Dry parts) and take the pricelist's display name, as every twinned row already does. Pinned; the owner saw the rename in the preview.

Consequences: re-import machinery comes free for the pricelist; the catalog grows from 269 to 273 (four S-Dry parts the shop does not stock); the re-transcription chore (issue 080) ends; the residual risk of the shared module-level source is unchanged and now has four installers behind one hook; a future sheet re-format fails to zero rows with a warning rather than to garbage.

Index row for `docs/adr/README.md`:

```
| [0038](0038-wedi-pricelist-side-registry-driven.md) | wedi's pricelist side is registry-driven: a dedicated parser feeds an order-kind book; `WEDI_SO` stays as a gated, visible fallback; a book missing a required part is refused, visibly | Accepted | 2026-09-02 |
```

In ADR 0037, under decision 2 add: *Amended 2026-09-02 (ADR 0038): 8b landed and kept both tables as fallbacks; their removal is a later PR.* Under decision 3 add: *Superseded 2026-09-02 by ADR 0038.*

- [ ] **Step 2: `src/CLAUDE.md`**

Add, in the alphabetical position after `wedi.js`'s block and before `wedifixture.js`:

```
  wedibook.js       # wedi distribution pricelist parser (ADR 0038, 8b): a
                    # section-table state machine (ovfbook.js's parseSundries
                    # shape) that flattens the "wedi Fundo" and "wedi S-Dry"
                    # sheets to the canonical { name, rows, mapping, warnings }
                    # the wizard consumes. Section-title rows re-map the
                    # columns (layouts change mid-sheet); product rows match
                    # /^(US\d{7,9}|\d{9})\*?$/ (the asterisk is a footnote
                    # mark); size/details follow the section's captions with
                    # the two measured positional fallbacks; discount is the
                    # caption's "(less N%)" and is NOT mapped onto the item
                    # (nothing reads it). Other sheets are skipped BY NAME
                    # with a warning so a re-format fails loudly. Fundo wins a
                    # part priced on two sheets (US5076012). Detector
                    # isWediPricelist → fileFormat tag "wedi-pricelist" →
                    # an order-kind book (wedibook.test.js)
```

Append to `wedifixture.js`'s block a sibling entry:

```
  wedipricelistfixture.js  # the 2026-09-02 wedi distribution pricelist as the
                    # RAW sheet grid readXlsxSheets hands the wizard — parser
                    # INPUT, not output, so wedibook.test.js is not circular.
                    # 5 sheets / 602 rows; production never reads it.
                    # GENERATED — `.scratch/120_wedi-pricelist-book/tools/
                    # dump-pricelist.mjs` (over the workbook, or --from-json
                    # over the committed snapshot)
```

In `wedi.js`'s block, after the sentence ending "swap it, clearing BOTH memos", add: "The PRICELIST half followed in 8b (ADR 0038): `buildCatalog` reads `SO_SRC || WEDI_SO`, `setSoSource`/`clearSoSource` twin the stock installers, `stockSourceIs`/`soSourceIs` are identity getters for the hook's re-assert, and `missingRequiredParts()` is the plausibility floor. `kitFor` no longer dereferences a missing panel or cover — it hints `no-panel`/`no-cover`." Replace "A PRICELIST update is still a re-transcription of this one file; a stock-price update is now an import" with "Both halves are now imports; the tables are fallbacks only, removable together in a later PR."

In `wediadapter.js`'s block, add at the end: "The pricelist half (8b): `adaptSoRow`/`adaptSoRows` map an order-item row straight back to makeEntry's soRow — sku/description/size/note/price/cost/section/vendorSkus[0] — with `discount: null`."

In `usewedicatalog.js`'s block: it now runs two halves (`pickWediSoBooks`, `useHalf`), installs through `installSources` (which applies the floor and refuses the pricelist first), and returns `onBook: {stock, so}` plus `caption` (`fallbackCaption`).

- [ ] **Step 3: Spec status line**

In the spec's header, change the Status line to: `**Status:** Implemented on PR #355 (plan docs/superpowers/plans/2026-09-02-wedi-pricelist-book.md); ADR 0038.`

- [ ] **Step 4: Verify docs are consistent, then commit**

`grep -rn "0038" docs/adr/README.md docs/adr/0037-*.md docs/adr/0038-*.md src/CLAUDE.md | wc -l` → at least 5. `node --test src/*.test.js` → 0 fail (docs only, but run it anyway before the final commit).

```bash
git add docs/adr/0038-wedi-pricelist-side-registry-driven.md docs/adr/README.md docs/adr/0037-wedi-stock-side-registry-driven.md docs/superpowers/specs/2026-09-02-wedi-pricelist-book-design.md src/CLAUDE.md .scratch/120_wedi-pricelist-book/HANDOFF.md
git commit -m "docs: ADR 0038 — wedi's pricelist side is registry-driven; map the new files"
```

---

## What the owner does, after this ships

1. In the price-book library, drop the wedi distribution pricelist workbook. The router says "wedi pricelist — pick which book"; choose *new book* and name it **wedi**. (The stock book is also named wedi; the library shows one stock and one order book. Nothing keys on the name.)
2. Read the wizard's warnings: expect the kept-Fundo-price line for `US5076012` and the skipped-sheets line naming Builder Choice, Wellness and Spa, New Product Data. Anything else is news.
3. Apply. Open the wedi configurator: the Browse caption should carry no "transcribed" suffix. If it reads "book is missing N required parts", the import lost a hardcoded part — flag it, the popup is on the table for that half and says so.
4. Nothing else changes. Order entry, saved lines, the Builder × 0.82 rule, print — untouched.

## Self-Review

**Spec coverage.** Decision 1 (parser, detector, tag, mapping, size/details/discount rules, duplicate rule, kit notes, skipped sheets) → Tasks 2–3. Decision 2 (order book, field map, `price` as retail, discount not carried) → Tasks 2, 4. Decision 3 (adapter) → Task 4. Decision 4 (seam, name check, both memos clear) → Task 4 + Global Constraints. Decision 5 (two halves, caption) → Tasks 7–8. Decision 6 (floor, guards) → Tasks 4 (`missingRequiredParts`), 6, 7. Decision 7 (nothing else moves) → Global Constraints + the pinned `wedi.test.js`. Decisions 8–9 (pinned differences) → Task 5. Verification 1–6 → Tasks 2, 5, 6–7, 7, 8, and every task's build/suite step. Owner decisions 1–5 → Global Constraints. "What the owner does" → above.

**Placeholder scan.** No TBD/TODO. Every code step shows the code. Task 5's twinning test is the one place the plan cannot pre-state a per-key field list; it asserts a closed key set and a closed field set and instructs the executor to *report*, not extend, anything outside them — a real assertion with a measured escape hatch, not a placeholder.

**Type consistency.** `SoRow` field names are identical in Task 2 (`parseWediSheet` output), Task 4 (`adaptSoRow` output) and `WEDI_SO` (`us, name, size, details, retail, net, section, discount, erp`). `installSources` returns `{ stock, so, onBook, missing }` in Task 7 and is consumed with those names in Tasks 7–8. `fallbackCaption(onBook, missing)` matches between definition and both call sites. The `wedi.js` exports named in Task 4's Interfaces are the ones Tasks 5–7 import. `PRICELIST_SHEETS` (Task 1) is the name used in Tasks 2, 3, 4, 5, 7, 8. Format tag `"wedi-pricelist"` is spelled identically in Tasks 3 and 8.

**One correction made during self-review:** the spec's decision 8 said two frames; measurement during planning found 34 newly twinned stock entries (the S-Dry line is stocked). The spec is amended in the same commit as this plan, and Task 5 pins the 34.
