# App.jsx Split — Phase 1 (Mechanical Extraction) + Phase 2 (Domain Hooks) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink `src/App.jsx` from 8,297 lines to ≤ ~3,500 (Phase 1, zero behavior change) and then ≤ ~2,600 (Phase 2, domain hooks), moving the never-opened-while-quoting admin surface (~3,000 lines: Settings workspace, price-book library, vendor board, import wizard) out of the boot chunk per ADR 0026.

**Architecture:** Phase 1 is cut-and-paste file moves guarded by a new ESLint gate (`no-undef` + `react/jsx-no-undef` — the exact error class a missed import in a moved file causes, which `vite build` does NOT catch). Order: lint gate → pure helpers with new node tests → shared widget/search/grid/mobile files → the admin cluster as new files with `SettingsWorkspace` becoming a `React.lazy` chunk (same pattern as `AppsWorkspace`, App.jsx:29). Phase 2 extracts the App component's state into domain hooks (`useStock`, `useBooks`, …) following the existing `useVendorFetch` precedent (App.jsx:6066), each hook exposing a `hydrate*` function so ADR 0026's single two-stage boot effect stays in App, then extracts the estimate print renderers into a **statically imported** component.

**Tech Stack:** React 18 (hooks, no router), Vite 5, Tailwind 3 (slate/indigo theme-overridden in `src/index.css` — reuse, never invent colors), lucide-react, `node --test` for pure logic, ESLint 9 flat config (new, this plan's Task 1).

## Global Constraints

- **Never push to `main`** — every PR lands via a PR; `main` auto-deploys the production site.
- **Never write to live Supabase outside the app's own UI paths.** Local `npm run dev` talks to the LIVE project. Smoke passes are browse-and-screenshot; job edits happen only in a throwaway "ZZ refactor smoke" project created and deleted through the UI; never batch-import, never restore a backup, never run SQL.
- **No UI change merges without preview proof.** Every PR here claims "pixels unchanged" — the proof is before/after screenshots of the touched surfaces in the PR description, plus the smoke checklist (§ Verification) checked off. Agents cannot sign in (accounts are admin-created); the smoke pass is done by a signed-in human before merge.
- **Phase 1 = byte-identical behavior.** Moves only: no renames (except the one lint-mandated rename in Task 1), no signature changes, no reformatting, no comment edits, no "while I'm here" fixes. Moved code keeps its comments verbatim.
- **Every commit passes:** `npm run lint` (0 errors) && `npm test` (all pass) && `npm run build` (success). No commit lands red.
- Imports always name the extension (`./model.js`, `./widgets.jsx`) — repo convention (see `orderentry.js` header note).
- Keep the sanctioned write paths exactly as CLAUDE.md lists them (`updateProject`/`updateCust` lineage, `applyBookImport`, `setBookItemsDisabled`, `reviewBookItemFlags`, …). Phase 2 moves them between files; it never reshapes what they write.
- `EstimatePrint` (Phase 2, Task 21) must be a **static** import — `printMode` fires `window.print()` in an effect one render after it is set (App.jsx:1902); a lazy chunk would race the print dialog and print a blank page.
- One PR at a time, in order; each PR rebases on the previous one's merge. Every PR is revertable on its own.
- Branch names: `claude/split-pr<N>-<slug>` off latest `main`.

## Current-Code Map (verified against `src/App.jsx` @ 8,297 lines, 2026-07-20)

| Region | Lines | Contents |
|---|---|---|
| Imports + lazy chunks + `LazyBoundary` | 1–50 | `SheogaConfigurator`/`AppsWorkspace` lazy pattern to copy |
| Stock msgs, `skuSearchable`, file readers | 52–84 | `readXlsxSheets`, `readPdfPages` (used at 2160, 5358, 7282, 7291) |
| UI constants | 86–121 | `TYPES`, `TLBL`, `underlayLabel`, `TYPE_ACCENT`, `ROW_WASH`, `TOTAL_WASH`, `JOINTS`, `THICK`, `DEFAULT_COLORS`, `GROUT_COLORS`, `colorsFor` |
| `FitSelect` | 125–135 | |
| Search hit components + anchored-panel machinery | 136–276 | `SKU_SHOW`, `SizeChip`, `StockHit`, `OrderHit`, `Hit`, `PANEL_MAX`, `useAnchoredPanel`, `vPos`, `SEARCH_PANEL_MIN`, `searchPanelBox` |
| `DotMenu` | 277–326 | uses `useAnchoredPanel`/`vPos` |
| `SkuPicker`, `StockSearch`, `FamilySearch` | 327–469 | |
| Pure helpers + print math | 470–666 | `ATT_BUCKET`, `uid`, `money`, `sf1`, `wasteNote`, `wasteMeta`, `miscQty`, `printProduct`, `orderLineCost`, `printAreaFloor`, `PRINT_KINDS/COLS*/DASH`, `KSHORT`, `ESTIMATE_PRINT_LAYOUT`, `tierBadgeText`, `TIER_COLOR`, `u1`, `matSku`, `printMatList`, `blobToDataURL`, `dataURLToBlob`, `newProduct`, `newArea`, `areaLabel`, `rowBlank`, `catSig`, `newProject`, `newPerson`, `newBuilder`, `normP`, `normAttachedJob`, `normA`, `normWasteJob`, `normC`, `personData` |
| `BuilderCombo`, `MetaChip`, `SalespersonPop` | 668–754 | |
| `SegBar`, `WasteBar`, `FilesPop` | 755–863 | |
| Mobile suite | 864–1436 | `MobileSheet`, `MobileSearchSheet`, `MobileProductRow`, `MobileRowSheet` |
| Grid suite | 1437–1765 | `TypeSelect`, `GRID_COLS`, `TIER_LONG`, `GridPriceCell`, `GridSizeInput`, `GridProductBox`, `GridOmniSearch` |
| Sweep consts, `ThemeSwitch`, `MarginLine` | 1766–1831 | `AUTO_KEEP`, `QUICK_SWEEP_DAYS`, `BOOK_VERSION_KEEP`, `STOCK_BOOK_ID` |
| **`App` component** | **1832–5100** | see hook map below |
| `Modal` | 5102–5116 | used by App (4869, 4917, 4964, 5001, 5048…) AND the admin cluster |
| `ORDER_UNIT_CODE` + `orderEntryRow` | 5117–5162 | pure; rides on `printProduct`/`orderLineCost` |
| `TeamTodos` | 5163–5286 | |
| `FLAG_SEMANTICS`, `StaleChip` | 5287–5311 | used by admin cluster only |
| `GateGap`, `ImportRouter` | 5312–5558 | |
| `StockItems` | 5559–5726 | |
| Vendor board | 5727–6340 | `VendorBookmarklet`, `SignInPaste`, `VendorBookRow`, `VendorSheetRow`, `VendorGroupCard`, `useVendorFetch` (6066), `VendorFetchPage`, `InHouseColumn`, `PasteSignInPopover` |
| Price-book library | 6341–7633 | `PriceBookLibrary`, `ImportHistory`, `ManualSourcesCard`, `SourceSheetStrip`, `BookDetail`, `BookItemEditModal`, `GROUP_LABEL/AXES`, `MarkupEditor`, `AddFileNotice`, `BookImportWizard` |
| `MATERIAL_CATEGORIES` + `SettingsWorkspace` | 7634–8297 | rendered at App.jsx:4832 behind `showSettings &&`, fully prop-driven |

App-component internals (Phase 2 targets; offsets verified):

| Cluster | Lines | Contents |
|---|---|---|
| State + refs | 1833–1997 | ~90 `useState`/`useRef` declarations |
| Two-stage boot effect | 2027–2109 | ADR 0026 stage 1 + background stage 2 — **stays in App** |
| `loadDetail` | 2110–2151 | |
| Stock import | 2152–2233 | `importStockFile`, `importPriceBook`, `upsertStock`, `applyImport`, `rollbackStock` |
| Book registry | 2234–2429 | `loadBookItems`, `addBook`, `updateBook`, `delBook`, `applyBookImport`, `snapshotBookVersion`, `loadBookVersions`, `loadBookVersionSnapshot`, `pinBookVersion`, `updateBookItem`, `reviewBookItemFlags`, `setBookItemsDisabled`, `setStockItemsDisabled` (2415) |
| `migrateLegacyCustomers` | 2430–2452 | |
| Toast | 2488–2489 | `ping`, `flashSaved` |
| Settings/profile | 2499–2513 | `setSettings`, `saveProfile` |
| Directory CRUD | 2553–2675 | `updateProject`, `addProject`, `pickProject`, `goHome`, `delProject`, `linkProject`, `promoteProject`, `promoteToNewCustomer`, `addPerson`, `updatePerson`, `delPerson`, `addBuilderFor` |
| Row/area edit + drag | 2676–2716, 2819–2979 | `addArea`…`moveProduct`, `startDrag`/`beginDrag`, sheoga adders — **stays in App** (grid render's hands) |
| Order search | 2717–2818 | `fuzzyRpc`, `searchOrder` memo, `orderRowKeys` memo, drift effect (the slice Task 17 lifts out of the middle of the row-edit region) |
| Attachments | 2980–2983 | `attPath`, `addAttachment`, `openAttachment`, `delAttachment` |
| Versions | 2988–3053 | `insertVersion`, `startVersionName`, `confirmVersion`, `loadVersion`, `delVersion`, `autoSnapshot`, sign-out hook |
| Todos | 3054–3105 | |
| Labels / Apps hub | 3106–3146 | |
| Backup | 3148–3260 | `exportBackup`, `importBackup` — **stays in App** (crosses every domain) |
| Estimate print renderers | 3279–3617 | `renderEstimatePaperClassic`, `renderEstimatePaperCards`, `renderEstimatePaper` |
| Render | 3620–5100 | sidebar, selection grid, order summary, modals, `inp`/`lbl` class strings (3618–3619) |

## The Move Protocol (referenced by every mechanical task)

1. Create the new file; **cut** the listed declarations from `App.jsx` (whole declarations, comments included, order preserved).
2. Add `import`/`export` wiring: the new file imports what its code needs (from `react`, `lucide-react`, existing `src/*.js`, and earlier-extracted files); `App.jsx` imports what it still uses from the new file. Export **only** names another file actually imports.
3. `npm run lint` — every leaked identifier appears as `no-undef`/`react/jsx-no-undef` in either file. Fix by adding imports, never by re-declaring.
4. `npm test` && `npm run build` — both green.
5. Grep-assert the move: `grep -c "function <Name>\|const <Name> =" src/App.jsx` returns `0` for each moved name.
6. Commit with the task's message.

---

# Phase 1 — mechanical extraction (4 PRs)

## PR 1 — the safety net (branch `claude/split-pr1-lint`)

### Task 1: ESLint gate that catches missing imports

The whole phase rides on this: a moved component whose helper stayed behind compiles fine in Vite and crashes at **runtime** (`ReferenceError`) — on the live site, since there is no CI. This config was validated against the repo on 2026-07-20: **0 `no-undef` errors** in current code; a probe file with a missing helper and a missing component produced exactly the 2 expected errors; the only true finding is `useExisting` (App.jsx:5071) — a plain callback whose `use*` name trips `rules-of-hooks`.

**Files:**
- Create: `eslint.config.mjs`
- Modify: `package.json` (devDependencies + `lint` script)
- Modify: `src/App.jsx:5071,5077,5084` (rename `useExisting` → `pickExisting` — 3 occurrences, behavior identical; the name falsely claims to be a hook)

**Interfaces:**
- Produces: `npm run lint` — exit 0 on clean tree; used by every later task's Step "lint".

- [ ] **Step 1: Install and wire**

```bash
npm i -D eslint@^9 eslint-plugin-react@^7 eslint-plugin-react-hooks@^5 globals@^15
```

Add to `package.json` scripts: `"lint": "eslint src netlify/functions"`.

- [ ] **Step 2: Write `eslint.config.mjs`** (validated config — copy verbatim)

```js
import globals from "globals";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";

export default [
  {
    files: ["src/**/*.js", "src/**/*.jsx"],
    ignores: ["src/**/*.test.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.browser },
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    // Existing exhaustive-deps disable comments stay as documentation of
    // deliberately-incomplete dep arrays; the rule itself is off.
    linterOptions: { reportUnusedDisableDirectives: "off" },
    plugins: { react, "react-hooks": reactHooks },
    settings: { react: { version: "detect" } },
    rules: {
      "no-undef": "error",
      "react/jsx-no-undef": "error",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "off",
    },
  },
  {
    files: ["src/**/*.test.js", "netlify/functions/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      globals: { ...globals.node },
    },
    rules: { "no-undef": "error" },
  },
];
```

- [ ] **Step 3: Rename the false positive**

In `src/App.jsx`, replace all 3 occurrences of `useExisting` (lines 5071, 5077, 5084) with `pickExisting`. It is a local `const` arrow function inside the New-customer modal; nothing else references it.

- [ ] **Step 4: Verify the gate — clean run**

Run: `npm run lint` → expect exit 0, no output.
Run: `npm test` && `npm run build` → both green (nothing behavioral changed).

- [ ] **Step 5: Verify the gate — it actually detects the failure class**

```bash
printf 'import { useState } from "react";\nexport function Probe() {\n  const [x] = useState(money(1));\n  return <FitSelect display="x" />;\n}\n' > src/__probe.jsx
npx eslint src/__probe.jsx
rm src/__probe.jsx
```

Expected: exactly 2 errors — `'money' is not defined  no-undef` and `'FitSelect' is not defined  react/jsx-no-undef`. If not, STOP — the safety net is broken; do not proceed to any move task.

- [ ] **Step 6: Commit**

```bash
git add eslint.config.mjs package.json package-lock.json src/App.jsx
git commit -m "chore: add ESLint no-undef gate ahead of App.jsx split"
```

## PR 2 — pure helpers out, with their first-ever tests (branch `claude/split-pr2-model`)

### Task 2: `src/uiconst.js` — shared UI constants

**Files:**
- Create: `src/uiconst.js`
- Modify: `src/App.jsx` (remove decls, add import)

**Interfaces:**
- Produces (all `export`ed): `TYPES`, `TLBL`, `UNDERLAY_LABEL`, `underlayLabel`, `TYPE_ACCENT`, `ROW_WASH`, `TOTAL_WASH`, `JOINTS`, `THICK`, `DEFAULT_COLORS`, `GROUT_COLORS`, `colorsFor`, `STOCK_LOADING_MSG`, `STOCK_FAILED_MSG`, `skuSearchable`, `ATT_BUCKET`, `TIER_COLOR`, `TIER_LONG`, `tierBadgeText`, `AUTO_KEEP`, `QUICK_SWEEP_DAYS`, `BOOK_VERSION_KEEP`, `STOCK_BOOK_ID` — names and values unchanged.

- [ ] **Step 1:** Move Protocol with the declarations at App.jsx 54–58 (`STOCK_*_MSG`, `skuSearchable`), 86–121 (`TYPES`…`colorsFor`), 470 (`ATT_BUCKET`), 570–582 (`tierBadgeText`, `TIER_COLOR` — the object's `};` is line 582; cut the whole declaration), 1514 (`TIER_LONG`), 1766–1775 (`AUTO_KEEP`…`STOCK_BOOK_ID`). This file is JSX-free and imports nothing.
- [ ] **Step 2:** Run `npm run lint && npm test && npm run build` → all green.
- [ ] **Step 3:** Commit: `refactor: extract shared UI constants to src/uiconst.js`

### Task 3: `src/model.js` — job-model factories + normalizers, with node tests

These are the data-integrity core (`normC/normA/normP` keep every saved job loadable) and have **zero tests today**. Tests come first.

**Files:**
- Create: `src/model.test.js`, then `src/model.js`
- Modify: `src/App.jsx`

**Interfaces:**
- Produces (all `export`ed, signatures unchanged): `uid`, `money`, `sf1`, `miscQty`, `blobToDataURL`, `dataURLToBlob`, `wasteNote`, `wasteMeta`, `newProduct`, `newArea`, `areaLabel`, `rowBlank`, `catSig`, `newProject`, `newPerson`, `newBuilder`, `normP`, `normAttachedJob`, `normA`, `normWasteJob`, `normC`, `personData`.
- Consumes: `num` from `./catalog.js`, `normTier`/`normPrintPricing` from `./pricing.js`, `normBasketEntry` from `./sheoga.js`, `TYPES` from `./uiconst.js` (Task 2).

- [ ] **Step 1: Write the failing tests** — create `src/model.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normP, normA, normC, rowBlank, newProduct, newProject, areaLabel, money, catSig } from "./model.js";

test("normP fills every field a grid row reads from a bare object", () => {
  const p = normP({ id: "x" });
  assert.equal(p.type, "tile");
  assert.equal(p.thickness, "0.375");
  assert.equal(p.qtyType, "sqft");
  assert.equal(p.grout.joint, 0.125);
  assert.equal(p.grout.checked, false);
  assert.deepEqual(p.attached, {});
  assert.equal(p.underlay.install, false);
});

test("normP keeps a saved row's snapshot values untouched", () => {
  const saved = { id: "r1", type: "vinyl", sku: "ABC-1", priceSqft: "4.25", cartonSf: "23.5", bookId: "b1", costSqft: "2.10" };
  const p = normP(saved);
  assert.equal(p.sku, "ABC-1");
  assert.equal(p.priceSqft, "4.25");
  assert.equal(p.cartonSf, "23.5");
  assert.equal(p.bookId, "b1");
  assert.equal(p.costSqft, "2.10");
});

test("normP maps the legacy brand/color pair into brandColor", () => {
  assert.equal(normP({ brand: "Daltile", color: "Ash" }).brandColor, "Daltile / Ash");
});

test("normC normalizes areas, versions, tier and waste", () => {
  const c = normC({ id: "c1", categories: [{ products: [{}] }] });
  assert.equal(c.priceTier, "retail");
  assert.equal(c.printPricing, "full");
  assert.equal(c.categories[0].products[0].type, "tile");
  assert.deepEqual(c.versions, []);
  assert.equal(c.waste, null);
});

test("rowBlank: a fresh row is blank, a priced row is not", () => {
  assert.equal(rowBlank(newProduct()), true);
  assert.equal(rowBlank({ ...newProduct(), priceSqft: "3" }), false);
});

test("catSig ignores blank adder rows so autosave doesn't fire on no-ops", () => {
  const area = { id: "a", name: "", note: "", products: [newProduct()] };
  const area2 = { ...area, products: [...area.products, newProduct()] };
  assert.equal(catSig([area]), catSig([area2]));
});

test("newProject seeds the ADR 0018 pricing fields and quick-flag", () => {
  const pr = newProject(null, "Job", { quick: true, seedArea: true });
  assert.equal(pr.priceTier, "retail");
  assert.equal(pr.quick, true);
  assert.equal(pr.categories.length, 1);
});

test("areaLabel falls back to a 1-based index", () => {
  assert.equal(areaLabel({ name: " " }, 0), "Area 1");
  assert.equal(areaLabel({ name: "Kitchen" }, 3), "Kitchen");
});

test("money formats to two decimals", () => {
  assert.equal(money(1234.5), "$1,234.50");
  assert.equal(money(), "$0.00");
});
```

- [ ] **Step 2: Run to verify failure** — `npm test` → expect `Cannot find module './model.js'`.
- [ ] **Step 3: Move Protocol** with App.jsx 471–473 (`uid`, `money`, `sf1`), 478–493 (`wasteNote`, `wasteMeta`), 494 (`miscQty`), 611–612 (`blobToDataURL`, `dataURLToBlob`), 614–666 (`newProduct` … `personData`) into `src/model.js`. If a `catSig` assertion surprises you, the bug is in the test's model of the code — read the moved code, fix the test, never the moved code.
- [ ] **Step 4: Run** — `npm test` → all pass (including the 9 new); `npm run lint && npm run build` green.
- [ ] **Step 5: Commit:** `refactor: extract job model helpers to src/model.js with first tests`

### Task 4: `src/fileread.js` + `src/print.js`

**Files:**
- Create: `src/fileread.js` (App.jsx 63–84: `readXlsxSheets`, `readPdfPages` — keep the lazy `import("xlsx")`/`import("pdfjs-dist")` exactly as-is; that laziness is ADR 0026 load-bearing)
- Create: `src/print.test.js`, then `src/print.js` (App.jsx 495–570 `printProduct`, `orderLineCost`, `printAreaFloor`, `PRINT_KINDS`, `PRINT_COLS`, `PRINT_COLS_UNIT`, `PRINT_COLS_NONE`, `KSHORT`, `ESTIMATE_PRINT_LAYOUT`; 583–610 `u1`, `matSku`, `printMatList` — starting AFTER `TIER_COLOR`'s closing brace on 582, which Task 2 already took; 5117–5162 `ORDER_UNIT_CODE`, `orderEntryRow`). `PRINT_DASH` (App.jsx:564) is JSX — it **stays in App.jsx** until Phase 2 Task 21.

**Interfaces:**
- Produces: all names above, exported, signatures unchanged. `printProduct(p, s)` returns `{ size, C, PC, line, mats, qtyText, priceText, orderedSf }`.
- Consumes: `./catalog.js` material getters, `./model.js` (`money`, `miscQty`, `num` via catalog), `./uiconst.js` (`JOINTS`, `THICK`, `underlayLabel`).

- [ ] **Step 1: Write the failing tests** — create `src/print.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSettings } from "./catalog.js";
import { newProduct } from "./model.js";
import { printProduct, orderLineCost } from "./print.js";

const s = normalizeSettings();

test("printProduct: a misc count line bills qty × each-price", () => {
  const p = { ...newProduct(), type: "misc", qtyType: "count", qty: "3", priceSqft: "10" };
  const c = printProduct(p, s);
  assert.equal(c.line, 30);
  assert.equal(c.qtyText, "3");
  assert.equal(c.orderedSf, 0);
});

test("printProduct: a plain sqft line is sqft × price with no materials", () => {
  const p = { ...newProduct(), type: "vinyl", qty: "100", priceSqft: "2.5" };
  const c = printProduct(p, s);
  assert.equal(c.line, 250);
  assert.deepEqual(c.mats, []);
});

test("printProduct: a carton line bills whole cartons (ADR 0013)", () => {
  const p = { ...newProduct(), type: "hardwood", qty: "100", priceSqft: "5", cartonSf: "23" };
  const c = printProduct(p, s);
  assert.equal(c.C.order, Math.ceil((100 * (1 + s.waste.floor / 100)) / 23));
  assert.equal(c.line, c.C.order * 23 * 5);
});

test("orderLineCost: snapshotted costSqft rides the same quantity math as sell", () => {
  const p = { ...newProduct(), type: "vinyl", qty: "100", priceSqft: "4", costSqft: "2" };
  const sell = printProduct(p, s).line;
  assert.equal(orderLineCost(p, s, sell), 200);
});

test("orderLineCost: pre-costSqft rows derive cost from the markup", () => {
  const p = { ...newProduct(), type: "vinyl", qty: "10", priceSqft: "13", markupPct: "30" };
  const sell = printProduct(p, s).line;
  assert.ok(Math.abs(orderLineCost(p, s, sell) - sell / 1.3) < 1e-9);
});
```

- [ ] **Step 2:** `npm test` → fails with `Cannot find module './print.js'`.
- [ ] **Step 3:** Move Protocol for both files. If a carton assertion fails, print the actual `getCarton` result and correct the **test's** expectation from the real waste default in `normalizeSettings()` — the moved code is the spec.
- [ ] **Step 4:** `npm run lint && npm test && npm run build` → green.
- [ ] **Step 5:** Commit: `refactor: extract print math and file readers to src/print.js, src/fileread.js`
- [ ] **Step 6:** Checkpoint: `wc -l src/App.jsx` → expect ≈ 7,900. Record the number in the PR description.

## PR 3 — widgets, search, grid, mobile (branch `claude/split-pr3-widgets`)

Four tasks, one file each, strictly in this order (later files import from earlier ones). All are Move Protocol tasks; no new tests (JSX components have no test harness in this repo — the lint gate + build + smoke is the net).

### Task 5: `src/widgets.jsx`

Move: `LazyBoundary` (35–50), `FitSelect` (125–135), `useAnchoredPanel`/`vPos`/`PANEL_MAX` (218–263), `DotMenu` (277–326), `BuilderCombo` (668–709), `MetaChip` (710–722), `SalespersonPop` (723–754), `SegBar` (755–784), `WasteBar` (785–830), `FilesPop` (831–863), `ThemeSwitch` (1780–1818), `MarginLine` (1819–1831), `Modal` (5102–5116).
Export all; `useAnchoredPanel`/`vPos`/`PANEL_MAX` are also consumed by Task 6.
Commit: `refactor: extract shared widgets to src/widgets.jsx`

### Task 6: `src/search.jsx`

Move: `SKU_SHOW` (136), `hitKey` (141), `faceSize` (146–150), `SizeChip` (152–158), `StockHit` (159–177), `OrderHit` (178–197), `Hit` (198–217), `SEARCH_PANEL_MIN`/`searchPanelBox` (264–276), `SkuPicker` (327–411), `StockSearch` (412–442), `FamilySearch` (443–469).
Imports `useAnchoredPanel`, `vPos`, `PANEL_MAX` from `./widgets.jsx`. Exports `SkuPicker`, `StockSearch`, `FamilySearch`, `Hit`, `searchPanelBox`, `SEARCH_PANEL_MIN`, `SKU_SHOW`, `hitKey`, `faceSize` — `hitKey`/`faceSize` are consumed by Tasks 7–8 (grid + mobile), `SKU_SHOW` also by App's `searchOrder` memo (App.jsx:2735, 2747). Leaving `hitKey`/`faceSize` behind would force search.jsx to import from App.jsx — a cycle the lint gate can't fix.
Commit: `refactor: extract price-book search widgets to src/search.jsx`

### Task 7: `src/grid.jsx`

Move: `TypeSelect` (1437–1500), `GRID_COLS` (1501), `GridPriceCell` (1515–1540), `GridSizeInput` (1541–1592), `GridProductBox` (1593–1622), `GridOmniSearch` (1623 to its real closing brace ≈ 1746 — NOT 1765). `gridEnterNav` (1749–1760, used only by App's grid render at 4124), `vMeta` (1764, used by `loadDetail`) and `normProfile` (1765, used by boot + Phase 2 Task 20) **stay in App.jsx**.
Commit: `refactor: extract selection-grid cells to src/grid.jsx`

### Task 8: `src/mobile.jsx`

Move: `MobileSheet` (864–945), `MobileSearchSheet` (946–1018), `MobileProductRow` (1019–1065), `MobileRowSheet` (1066–1436).
Commit: `refactor: extract mobile sheets to src/mobile.jsx`

- [ ] After each task: `npm run lint && npm test && npm run build` green; grep-assert; commit.
- [ ] End of PR 3 checkpoint: `wc -l src/App.jsx` → expect ≈ 6,200. Smoke items for this PR (human, before merge): desktop grid row edit + SKU search panel + omni row; mobile viewport row sheet + search sheet; theme switch; salesperson popover; files popover; waste bar.

## PR 4 — the admin surface becomes its own chunk (branch `claude/split-pr4-admin`)

This is the payoff PR: ~3,000 lines leave the boot chunk. Three move tasks + the lazy flip + docs.

### Task 9: `src/TeamTodos.jsx`

Move: `TeamTodos` (5163–5266 — the component closes at 5266; lines 5270–5286 are the price-book banner comment + `bookFieldOptions`, which belong to Task 11, NOT this file). Commit: `refactor: extract TeamTodos to its own file`

### Task 10: `src/vendorpanel.jsx`

Move: `FLAG_SEMANTICS` (5287–5294), `StaleChip` (5295–5311), `VendorBookmarklet` (5727–5751), `SignInPaste` (5752–5834), `VendorBookRow` (5835–5911), `VendorSheetRow` (5912–5981), `VendorGroupCard` (5982–6065), `useVendorFetch` (6066–6224), `VendorFetchPage` (6225–6276), `InHouseColumn` (6277–6312), `PasteSignInPopover` (6313–6340).
Export `useVendorFetch`, `VendorFetchPage`, `InHouseColumn`, `PasteSignInPopover`, `StaleChip`, `FLAG_SEMANTICS` (consumed by Task 11).
Commit: `refactor: extract vendor-sheet board to src/vendorpanel.jsx`

### Task 11: `src/pricebooklib.jsx`

Move: `bookFieldOptions` (5279–5286 — consumed only by `BookImportWizard` at 7485), `GateGap` (5312–5345), `ImportRouter` (5346–5558), `StockItems` (5559–5726), `PriceBookLibrary` (6341–6595), `ImportHistory` (6596–6673), `ManualSourcesCard` (6674–6716), `SourceSheetStrip` (6717–6759), `BookDetail` (6760–7060), `BookItemEditModal` (7061–7111), `GROUP_LABEL`/`GROUP_AXES` (7112–7113), `MarkupEditor` (7114–7204), `AddFileNotice` (7205–7220), `BookImportWizard` (7221–7633).
Export only `PriceBookLibrary` (consumed by Task 12's `SettingsWorkspace`) — `ImportRouter`'s sole render site is inside `PriceBookLibrary` itself (App.jsx:6557).
Commit: `refactor: extract price-book library to src/pricebooklib.jsx`

### Task 12: `src/SettingsWorkspace.jsx` + lazy flip

**Files:**
- Create: `src/SettingsWorkspace.jsx` — move `MATERIAL_CATEGORIES` (7634–7639) + `SettingsWorkspace` (7640–8297); `export default SettingsWorkspace`.
- Modify: `src/App.jsx` — delete the static definition; next to the existing lazy declarations (App.jsx:28–29) add:

```jsx
const SettingsWorkspace = lazy(() => import("./SettingsWorkspace.jsx"));
```

and wrap the render site (App.jsx:4832, `{showSettings && (<SettingsWorkspace …/>)}`) in the exact `showApps`/`AppsWorkspace` pattern from App.jsx:4844–4866:

```jsx
{showSettings && (
  <LazyBoundary>
  <Suspense fallback={null}>
    <SettingsWorkspace onClose={() => setShowSettings(false)}
      {/* …props unchanged, byte-for-byte from the current call site… */} />
  </Suspense>
  </LazyBoundary>
)}
```

- [ ] **Step: verify the chunk exists and the boot chunk shrank.** Run `npm run build` and compare `dist/assets` against a `main` build: a new `SettingsWorkspace-*.js` chunk appears; the main `index-*.js` chunk shrinks (expect roughly 80–120 KB minified lighter — record exact before/after sizes in the PR).
- [ ] Smoke items for this PR (human): open Settings (chunk loads — check the Network tab), walk all four nav sections; price-book library board renders; open a book detail + its import history; open (then cancel) the import wizard on an existing book; StockItems list renders; vendor board columns render; Issues modal; sign out/in.
- [ ] Commit: `refactor: SettingsWorkspace to a lazy chunk (ADR 0026 rule 5)`

### Task 13: docs

Update CLAUDE.md's source-layout block with the new files (one line each, matching its existing style). Note in the PR that `App.jsx` is now ≈ 3,300 lines (record actual `wc -l`).
Commit: `docs: source layout after App.jsx split`

---

# Phase 2 — domain hooks (6 PRs)

**The pattern.** Each hook owns its domain's `useState` + write paths, moved **unchanged**; App calls the hook and spreads the same names into scope, so the render tree and props don't change. The two-stage boot effect stays in App (ADR 0026 keeps boot orchestration in one place) and hydrates each hook through an exported setter. `useVendorFetch` (now in `src/vendorpanel.jsx`) is the in-repo precedent. Hooks live in flat `src/use<domain>.js` files — no JSX, importable by `node --test` only where logic is pure; hook wiring itself is verified by lint (`rules-of-hooks`), build, and smoke.

Phase 2 tasks are refactors, not rewrites: every function body moves verbatim; only the closure it lives in changes. Any diff beyond `s/const X = /…/` plumbing is out of scope.

## PR 5 — `useToast` + `useBooks` (branch `claude/split-pr5-books`)

Books come **before** stock: the stock-book import (`applyImport`/`rollbackStock`) snapshots versions through `snapshotBookVersion`/`appliedFromDiff`, so those two are extracted here as **module-level exports** of `usebooks.js` (they close over nothing — supabase + `uid` + `BOOK_VERSION_KEEP` only), which `usestock.js` then imports in PR 6 with no hook-ordering or circular-import constraint.

### Task 14: `src/usetoast.js`

```js
import { useRef, useState } from "react";

export function useToast() {
  const [toast, setToast] = useState("");
  const [saveOk, setSaveOk] = useState(false);
  const saveOkTimer = useRef(null);
  const ping = (m) => { setToast(m); setTimeout(() => setToast(""), 2200); };
  const flashSaved = () => { if (saveOkTimer.current) clearTimeout(saveOkTimer.current); setSaveOk(true); saveOkTimer.current = setTimeout(() => setSaveOk(false), 2000); };
  return { toast, saveOk, ping, flashSaved };
}
```

In App: `const { toast, saveOk, ping, flashSaved } = useToast();` replaces the `toast`/`saveOk` state (App.jsx:1899, 1944) and `ping`/`flashSaved` (2488–2489). Lint/build/test; commit `refactor: useToast hook`.

### Task 15: `src/usebooks.js`

```js
// Module-level (NOT hook-bound) — consumed by usestock.js in PR 6:
export const appliedFromDiff = (diff) => …   // verbatim from App.jsx:2325
export async function snapshotBookVersion(bookId, appliedItems, toData) { … }  // verbatim from App.jsx:2333–2346

export function useBooks({ user, ping, flashSaved }) → {
  books, hydrateBooks(rows),
  orderItems, setOrderItems,        // consumed by useOrderSearch (Task 17)
  loadBookItems, addBook, updateBook, delBook, applyBookImport,
  loadBookVersions, loadBookVersionSnapshot, pinBookVersion,
  updateBookItem, reviewBookItemFlags, setBookItemsDisabled,
}
```

Bodies verbatim from App.jsx 2234–2414, with `appliedFromDiff`/`snapshotBookVersion` hoisted to module level as above (`BOOK_VERSION_KEEP` comes from `./uiconst.js`).
Smoke for PR 5: book detail opens, import history renders, markup editor renders. Commit `refactor: useBooks hook`.

## PR 6 — `useStock` + `useOrderSearch` (branch `claude/split-pr6-stock`)

### Task 16: `src/usestock.js`

```js
import { appliedFromDiff, snapshotBookVersion } from "./usebooks.js";

export function useStock({ user, ping, flashSaved, profile, settings, setSettings }) → {
  stock, stockReady, stockFailed,           // state (names unchanged)
  hydrateStock(rows), markStockReady(), markStockFailed(),  // boot hooks
  importing, importPreview, setImportPreview, pbRef,
  importStockFile, importPriceBook, applyImport, rollbackStock,
  setStockItemsDisabled,
}
```

The widened param list is not optional: `importStockFile` reads `settings.catalog` (App.jsx:2165); `applyImport`/`rollbackStock` read `settings.ops`, call `setSettings` + `flashSaved`, and stamp `profile.name` (2196–2221). Bodies move verbatim from App.jsx 2152–2233 (`importStockFile`, `importPriceBook`, `upsertStock` — internal, not returned — `applyImport`, `rollbackStock`) and 2415–2429 (`setStockItemsDisabled`); state from 1869–1871, 1895–1897. The boot effect's stage-2 stock load (inside 2027–2109) now calls `hydrateStock`/`markStockReady`/`markStockFailed` instead of the raw setters. `gFamilies` (the `useMemo` at 1873) stays in App, fed by `stock`.
Lint/build/test; smoke: SKU search fills a row (throwaway project), Settings→Price book stock panel renders. Commit `refactor: useStock hook`.

### Task 17: `src/useordersearch.js`

```js
export function useOrderSearch({ books, sel, orderItems, setOrderItems }) → { searchOrder, orderRowKeys, bookName }
```

`orderItems`/`setOrderItems` are owned by `useBooks` (Task 15) and passed through — the drift effect reads and writes them (App.jsx:2782–2818). `SKU_SHOW` imports from `./search.jsx` (exported there since Task 6). Move the `fuzzyRpc` ref, `orderBooks`/`bookName` (2717–2718), the `searchOrder` memo (2730–2764), `orderRowKeys` memo (2765–2780) and the drift effect (2781–2818) verbatim. Commit `refactor: useOrderSearch hook`.

Smoke for PR 6: order search in a row (special-order results appear, drift chips render); a stock re-import preview opens and is cancelled.

## PR 7 — `useTodos` + `useLabels` (branch `claude/split-pr7-sidecars`)

### Task 18: `src/usetodos.js` and `src/uselabels.js`

`useTodos({ user, profile, ping, flashSaved, setSidebarOpen })` ← state 1876–1877 + bodies 3054–3105 (`todoData`, `openTodos`, `addTodo`, `updateTodo`, `toggleTodo`, `delTodo`, `clearDoneTodos`, `reorderTodos`), returning also `showTodos`/`setShowTodos` and `hydrateTodos`. (`openTodos` calls `setSidebarOpen(false)` at 3056 — sidebar state stays in App; the mutators call `flashSaved`.)
`useLabels({ user, profile, ping, flashSaved, setSidebarOpen, settings, setSettings })` ← state 1881–1882 + bodies 3106–3146, returning `labels`, `hydrateLabels`, `showApps`/`setShowApps`, `openApps`, `addLabel`, `addLabelsBulk`, `updateLabel`, `delLabel`, `saveLabelPreset`. (`openApps` calls `setSidebarOpen(false)` at 3110; `saveLabelPreset` reads `settings.apps` and writes through `setSettings` at 3141–3146.)
Smoke: Issues modal add/check/reorder in a throwaway item, then delete it; Apps hub opens, label preview renders. Commit per hook.

## PR 8 — `useVersions` (branch `claude/split-pr8-versions`)

### Task 19: `src/useversions.js`

```js
export function useVersions({ user, ping, flashSaved, sel, setData, dataRef, baselineRef, updateProject, selId }) → {
  showVersions, setShowVersions, namingVersion, versionName, setVersionName,
  startVersionName, confirmVersion, insertVersion, loadVersion, delVersion, autoSnapshot,
}
```

`sel`/`setData`/`flashSaved` are required: `startVersionName` reads `namedCount(sel)` (App.jsx:2995), `confirmVersion` uses all three (2996–3006), `loadVersion`/`delVersion` use `sel.id` + `setData` (3007–3019), `autoSnapshot` calls `setData` (3025–3041). Bodies verbatim from App.jsx 2988–3041 (`insertVersion` … `autoSnapshot`; `AUTO_KEEP` from `./uiconst.js`, `catSig` from `./model.js`). The deselect effect (3042–3047) and `handleSignOut` (3048) **stay in App** and call `autoSnapshot` from the hook — the selection lifecycle remains App's. Smoke: save a named version in the throwaway project, restore it, delete it; deselect writes an auto version. Commit `refactor: useVersions hook`.

## PR 9 — `useDirectory` (branch `claude/split-pr9-directory`)

The riskiest hook — it owns the shared `customers`-lineage write paths — so it goes last among the data hooks, when the pattern is well-worn.

### Task 20: `src/usedirectory.js`

```js
// Module-level exports (pure, consumed by App):
export const attPath = (custId, fileId) => `${custId}/${fileId}`;  // verbatim from App.jsx:2980
export const normProfile = …                                       // verbatim from App.jsx:1765 (kept in App through Phase 1, moves here now)

export function useDirectory({ user, ping, flashSaved, setSidebarOpen }) → {
  data, setData, loading,                    // { projects, people, builders, settings } — names unchanged
  selId, selCustId, sel, selCust,            // selection state + derived, moved as-is
  hydrateDirectory(rows), loadDetail,
  updateProject, addProject, startQuickPrice, pickProject, goHome, delProject,
  linkProject, promoteProject, promoteToNewCustomer,
  addPerson, updatePerson, delPerson, addBuilderFor,
  builderNameOf, projectsOf, migrateLegacyCustomers,
  setSettings, saveProfile, profile, setProfile, appBlobRef,   // setProfile/appBlobRef feed the boot effect that stays in App
}
```

No `autoSnapshot` parameter — its only call sites are the deselect effect (App.jsx:3045) and `handleSignOut` (3048), both of which stay in App; wiring it into this hook would also invert the PR-8→PR-9 call order for nothing. `setSidebarOpen` IS required (`addProject` at 2564, `pickProject`/`goHome` at 2636-region close the sidebar; sidebar state stays in App). Bodies verbatim from App.jsx 2110–2151 (`loadDetail`), 2430–2452 (`migrateLegacyCustomers`), 2495 (`custData` — used by the CRUD, comes along), 2499–2513 (`setSettings`, `saveProfile`), 2553–2675 (directory CRUD), plus the `data`/`loading`/`selId`/`selCustId`/`profile` state and `appBlobRef`/`dataRef`/`baselineRef`/`prevSelRef` refs. `delProject` calls `attPath` (2583–2585) — hence the module-level export above; the four attachment *handlers* (2980–2983) stay in App and import `attPath` from this file. Hook order in App: `useDirectory` first, then `useVersions({ …, sel, setData, updateProject })`.
Smoke: create a person + project (throwaway), edit, link to a builder, promote a quick price, delete all of it; reload and confirm the sidebar buckets. Commit `refactor: useDirectory hook`.

## PR 10 — `EstimatePrint` (branch `claude/split-pr10-print`)

### Task 21: `src/EstimatePrint.jsx` — **static import**

Convert the two closures `renderEstimatePaperClassic` (3279–3435) and `renderEstimatePaperCards` (3436–3588) plus `renderEstimatePaper` (3589) and `PRINT_DASH` into one component:

```jsx
export function EstimatePaper({ sel, people, profile, tv, jobWaste, pMats, settings }) { … }
```

Procedure: paste the closure bodies into the component, then let `npm run lint` enumerate every remaining free identifier — each becomes a prop, added to the signature AND the two call sites (view tab 4750, print path 4828). Expected prop set is the list above; if lint reveals more (e.g. `wSet`, `aByCat`), add them the same way — do not re-derive anything inside the component. The two call sites are the Preview tab (App.jsx:4753) and the print path (App.jsx:4828). `import { EstimatePaper } from "./EstimatePrint.jsx"` must be **static** (see Global Constraints — the `window.print()` race).
Smoke (the print pillar — be thorough): Preview tab renders identically; Print estimate → browser preview matches a `main` build print of the same job for full/unit/none pricing modes and both tiers with a tag; order-sheet print unchanged; cancel every dialog. Screenshot before/after pairs go in the PR.
Commit `refactor: extract EstimatePaper component`.

### Task 22: close out

`wc -l src/App.jsx` → record (expect ≈ 2,300–2,600). Update CLAUDE.md source layout again. Commit `docs: source layout after phase 2`.

---

## Verification template (every PR description)

```
- [ ] npm run lint — 0 errors
- [ ] npm test — all pass (N tests)
- [ ] npm run build — success; chunk sizes recorded (PR 4 — the only chunk-affecting PR)
- [ ] wc -l src/App.jsx — recorded
- [ ] moved names grep to 0 in App.jsx
- [ ] smoke checklist (human, live site rules: browse-only + throwaway project) — checked
- [ ] before/after screenshots attached
```

## Review log

- 2026-07-20: ESLint gate validated empirically against the working tree — 0 `no-undef` errors on current code; probe file with a planted missing helper + missing component produced exactly the 2 expected errors; scaffolding removed.
- 2026-07-20: adversarial agent review (independent context, read-only, evidence-required). 13 findings: 1 blocker (useStock↔useBooks internal-function split — fixed by hoisting `appliedFromDiff`/`snapshotBookVersion` to module level and swapping PR 5/6), 8 major (hook signatures missing real closure deps; three orphan declarations — `hitKey`/`faceSize`, `bookFieldOptions`, `gridEnterNav`/`vMeta`/`normProfile` — re-homed), 4 minor (range/citation drift). All folded in. The review also confirmed: no external importers of App.jsx exports, SettingsWorkspace is closure-free and safe to lazy-load, the admin cluster is unreachable outside it, every test assertion in Tasks 3–4 matches the real implementations, and the smoke steps stay inside sanctioned app write paths.

## Explicit non-goals (do not let scope creep into these)

- **No selection-grid render extraction** (the ~1,400-line JSX return). It closes over ~40 handlers; extracting it is a future plan of its own.
- **No router, no TypeScript, no test-framework addition** (React component tests stay out; `node --test` only).
- **No `exportBackup`/`importBackup` move** — they deliberately cross every domain and stay in App.
- **No boot-effect split** — ADR 0026's two-stage orchestration stays one effect in App.
- **No stylistic lint rules** — the gate is `no-undef`-class only.
- **No behavior/copy/pixel changes anywhere.**
