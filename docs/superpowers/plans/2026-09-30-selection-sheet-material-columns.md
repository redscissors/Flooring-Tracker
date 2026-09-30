# Selection Sheet Material Columns (G3c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the printed selection sheet's cards + Extras box with the G3c layout — Grout · Mortar · Underlay columns beside each product showing exact amounts, one priced job order list — and charge install materials by the rounded job order (ADR 0053).

**Architecture:** Pure formatting/grouping helpers live in a new `src/printcols.js` (node-tested). A new renderer `src/EstimateColumns.jsx` draws the sheet from those helpers; `EstimatePaper` delegates to it when `ESTIMATE_PRINT_LAYOUT === "columns"`. The masthead + people row move into `src/sheethead.jsx`, shared by the cards and columns renderers. The rounding change is two small edits in `jobtotals.js` and `printMatList`.

**Tech Stack:** React 18, Vite 5, node:test (`npm test`), ESLint (`npm run lint`), Playwright (preview proof).

**Spec:** `docs/superpowers/specs/2026-09-30-selection-sheet-material-columns-design.md` · **ADR:** `docs/adr/0053-materials-charge-the-rounded-job-order.md`

## Global Constraints

- Grid columns (full pricing): gutter 10px · product `minmax(0,1fr)` · Qty 38px · Price 60px · Total 58px · Grout 88px · Mortar 82px · Underlay 100px · Other 90px.
- Column headers exactly: `Grout`, `Mortar`, `Underlay`, `Other`. A material column prints only if some printed line uses it.
- Caulk and `Install` (underlayment install items) never appear in a column — list only.
- Material cell text 7.6px (names bold); product name 10px; spec 8.4px.
- Special-order footer copy exactly: `◆ Special order — special-order items can't be returned.`
- Totals labels exactly: `Flooring & trim`, `Install materials`, `Freight` (only when > 0), `Estimated total` (bold, same size as the others).
- Job list group labels, in order: `Grout color`, `Grout base`, `Caulk`, `Mortar`, `Underlay`, `Install`, add-on category names, `Freight`.
- No persisted-shape changes, no SQL, no Supabase writes. Never push to `main`; merge through a PR.

## Review Focus

- A grout picked on a row with no footage/thickness yet (`exact` 0) → the cell names the grout and prints `—` for the amount, not `0.0 kits`. Test in Task 2.
- A job with no install materials at all (LVP-only with no pad, trim only) → no material columns, no job list, product column takes the width. Test in Task 2 (`columnsUsed` → `[]`) and Task 5 (preview).
- A line with two items in one column (a tile's mortar plus its underlayment's install mortar) → both print in the Mortar cell. Test in Task 2.
- Quote-options job → shared list + one compact list per option, rounding per bucket; totals row and bottom comparison unchanged. Checked in Task 5's preview.
- Unit/no-price modes → no money leaks (no Qty in unit, no Price/Total/list prices in none). Test in Task 2 (`gridSpec`), checked in Task 5.

---

### Task 1: Charge the rounded job order (ADR 0053)

**Files:**
- Modify: `src/jobtotals.js` (the per-row accumulators on line 16; after the `gList`/`mList`/`uList` maps)
- Modify: `src/print.js` (`printProduct` grout mat; `printMatList`)
- Test: `src/jobtotals.test.js`, `src/print.test.js`

**Interfaces:**
- Produces: `jobTotals(...)` — `groutCost`, `mortarCost`, `underlayCost` now equal the sums of `gList`/`mList`/`uList` `.cost` (order × price). `printMatList(cust, s)` rows: `cost = order × price`; rows carry `bookId` (grout colors from an order book). `printProduct` grout mat carries `bookId: p.grout.bookId || ""`.

- [ ] **Step 1: Write the failing tests**

`jobtotals.test.js` — `test("materials charge the rounded job order (ADR 0053)")`: two tile rows sharing `ProLite`, footages chosen so that `Math.ceil(e1) + Math.ceil(e2) === ceilQty(e1 + e2) + 1` where `eN = getMortar(row, wSet).exact` (assert this premise first); then `assert.equal(t.mortarCost, ceilQty(e1 + e2) * 18.95)` and `assert.equal(t.mList[0].cost, t.mortarCost)`. Same premise-and-assert for grout (`groutCost`, `gList`).

`print.test.js` — `test("printMatList: a shared material costs its job order × price")`: same two rows; the Mortar row has `order === ceilQty(e1 + e2)` and `cost === order * price`. And `test("printMatList: a grout color keeps its order-book bookId")`: a row with `grout.bookId: "bk1"` → the Grout row's `bookId === "bk1"`.

- [ ] **Step 2: Run to verify they fail**

Run: `node --test src/jobtotals.test.js src/print.test.js`
Expected: the new tests FAIL (cost is the per-row sum; bookId undefined).

- [ ] **Step 3: Implement**

`jobtotals.js`: delete `groutCost += G.order * G.price;`, `mortarCost += M.order * M.price;`, `underlayCost += U.order * U.price;`, and the two `+= m.order * m.price` inside the `IN.forEach`; after the list maps set `groutCost`/`mortarCost`/`underlayCost` to the `.reduce` of the lists' `cost`. Replace the `printMatList` header comment line "sum the per-line costs so the breakdown reconciles with the grand total" with the ADR 0053 rule.
`print.js`: grout mat gains `bookId`; `printMatList` aggregates `e.bookId = e.bookId || m.bookId || ""`, and each row's `cost = order * m.price` for every kind (bases already do).

- [ ] **Step 4: Run the whole suite**

Run: `npm test`
Expected: PASS. If an existing golden fails, update it only when its fixture has two rows sharing a material (the ADR 0053 change); any other failure is a bug.

- [ ] **Step 5: Commit** — `git commit -m "Materials charge the rounded job order (ADR 0053)"`

### Task 2: Column/list helpers — `src/printcols.js`

**Files:**
- Create: `src/printcols.js`
- Test: `src/printcols.test.js`

**Interfaces:**
- Consumes: `printProduct` (mats with `kind`, `name`, `spec`, `detail`, `exact`, `order`, `unit`, `addon`, `bookId`), `printMatList` rows (+ freight rows), `unitNoun` (units.js), `money`/`sf1` (model.js).
- Produces:
  - `specSize(p) -> string` — tile: `sizeText` tightened, else `L"×W"`; **never thickness**; others: `sizeText` tightened. Tightening = `/(\d["”']?)\s*[x×]\s*(?=\d)/gi → "$1×"`.
  - `specLine(p, c) -> string` — `[specSize, coverage, "SKU "+sku].filter(Boolean).join(" · ")`; coverage `${sf1(C.sf)} SF/${C.unit}` or `${PC.per} PC/${PC.unit.toUpperCase()}`.
  - `qtyCells(p, c) -> { top: string, sub: string }` — carton: `"12 ct"` / `"139.6 SF"`; plain sqft: `"45 SF"` / `""`; count: `"4 ea"` (PC: `"1 ct"`) / `""`.
  - `priceCells(p, c) -> { top, sub }` — area: `"$10.92/sf"` / `"$127.00/ct"` (sub only with C); count: `c.priceText` / `""`.
  - `COLS = [{ key: "grout", label: "Grout", w: 88 }, { key: "mortar", label: "Mortar", w: 82 }, { key: "underlay", label: "Underlay", w: 100 }, { key: "other", label: "Other", w: 90 }]`
  - `matColumn(m) -> "grout"|"mortar"|"underlay"|"other"|null` — `Grout`→grout; `Mortar`→mortar; `Tile Backer`/`Underlayment`→underlay; `m.addon`→other; `Caulk`/`Install`/anything else→null.
  - `lineCells(c) -> { grout: mat[], mortar: mat[], underlay: mat[], other: mat[] }`
  - `columnsUsed(lines /* printProduct results */) -> COLS entries` in COLS order, only those with ≥1 item.
  - `needText(exact, unit) -> string` — `exact > 0` ? `` `${exact.toFixed(1)} ${unitNoun(round1 === 1 ? 1 : 2, unit)}` `` : `"—"`.
  - `gridSpec(pMode /* "full"|"unit"|"none" */, cols) -> { template: string, money: { qty, price, total } }` — full: qty+price+total; unit: price only; none: qty only.
  - `jobListGroups(pMats) -> [{ label, rows: [{ name, sku, needed, order, unit, price, total, bookId }] }]` — label per Global Constraints order; `Tile Backer`+`Underlayment` → `Underlay`; addon kinds by name; `needed` = `needText(exact, unit)` except `""` for Grout base, Caulk, Freight; row name: Grout/Caulk `${name} · ${spec}`, others `name`.

- [ ] **Step 1: Write the failing tests** (`src/printcols.test.js`)

```js
test("specSize: tile drops thickness and tightens ×", () => {
  assert.equal(specSize({ type: "tile", L: "12", W: "24", thickness: "0.375", sizeText: "" }), '12"×24"');
  assert.equal(specSize({ type: "tile", sizeText: "12x24", thickness: "0.375" }), "12×24");
  assert.equal(specSize({ type: "misc", sizeText: '48" x 60" x 1/2"' }), '48"×60"×1/2"');
});
test("matColumn: caulk and install items stay out of the columns", () => { /* Grout→grout, Mortar→mortar, Tile Backer→underlay, Underlayment→underlay, {addon:true}→other, Caulk→null, Install→null */ });
test("lineCells: a tile's mortar and its underlayment's install mortar share the Mortar cell", () => { /* printProduct of a tile with mortar + underlay whose install kit includes a mortar → lineCells(c).mortar.length === 2 */ });
test("columnsUsed: only columns some line uses, in COLS order; none → []", () => { /* grout-only lines → ["grout"]; trim-only lines → [] */ });
test("needText: one decimal, singular at 1.0, dash when uncomputed", () => {
  assert.equal(needText(1.62, "kits"), "1.6 kits");
  assert.equal(needText(1.04, "bags"), "1.0 bag");
  assert.equal(needText(0, "kits"), "—");
});
test("gridSpec: unit shows price only, none shows qty only", () => { /* full → money {qty:true,price:true,total:true}; unit → {qty:false,price:true,total:false}; none → {qty:true,price:false,total:false}; template ends with the used cols' widths */ });
test("jobListGroups: order, merged Underlay, blank needed for base/caulk/freight", () => { /* rows of kinds Mortar, Grout, Tile Backer, Underlayment, Grout base, Caulk, Freight → labels ["Grout color","Grout base","Caulk","Mortar","Underlay","Freight"]; Underlay has 2 rows; base/caulk/freight needed === "" */ });
test("qtyCells/priceCells: carton line shows ct over SF and $/sf over $/ct", () => { /* tile 120 sf, cartonSf 11.6, price 10.92 → qty {top:"12 ct", sub:"139.2 SF"}, price {top:"$10.92/sf", sub:"$126.67/ct"} (values from printProduct) */ });
```

- [ ] **Step 2: Run to verify they fail** — `node --test src/printcols.test.js` → FAIL (module not found).
- [ ] **Step 3: Implement `src/printcols.js`** per the Interfaces block. `gridSpec.template`: `["10px", "minmax(0,1fr)", qty && "38px", price && "60px", total && "58px", ...cols.map(c => c.w + "px")].filter(Boolean).join(" ")`.
- [ ] **Step 4: Run** — `npm test` → PASS; `npm run lint` → clean.
- [ ] **Step 5: Commit** — `git commit -m "printcols: helpers for the material-columns selection sheet"`

### Task 3: Shared masthead — `src/sheethead.jsx`

**Files:**
- Create: `src/sheethead.jsx`
- Modify: `src/EstimatePrint.jsx` (cards renderer's masthead + people row + notes, lines ~256–294)

**Interfaces:**
- Produces: `SheetHead({ sel, people, profile, tv, scopeNote, areaCount })` — renders exactly today's cards masthead, people row, and `sel.notes` line.

- [ ] **Step 1: Move** the cards masthead/people/notes JSX into `SheetHead` unchanged; the cards renderer renders `<SheetHead … />`. Keep `keimLogo`, `tierTag`, `quickPrintName`, `PRINT_DASH` usage identical.
- [ ] **Step 2: Verify** — `npm run build` succeeds; `npm test` PASS; the Task 5 harness with `ESTIMATE_PRINT_LAYOUT` temporarily `"cards"` renders the masthead pixel-identical to a `git stash` baseline screenshot (compare by eye).
- [ ] **Step 3: Commit** — `git commit -m "Extract the selection-sheet masthead into SheetHead"`

### Task 4: The columns renderer

**Files:**
- Create: `src/EstimateColumns.jsx`
- Modify: `src/EstimatePrint.jsx` (delegate), `src/print.js` (`ESTIMATE_PRINT_LAYOUT = "columns"` + comment), `src/App.jsx` (`paperProps` gains `stockBookIds`, `stockSkus`), `src/CLAUDE.md` (annotate `printcols.js`, `sheethead.jsx`, `EstimateColumns.jsx`; update the `EstimatePrint.jsx` / `print.js` / `jobtotals` notes)

**Interfaces:**
- Consumes: Task 2 helpers, Task 3 `SheetHead`, `isSpecialOrder(p, stockBookIds, stockSkus)`, `isSpecialMat(m, stockBookIds)` (orderentry.js), `normPrintPricing`, `areaPrintLabel`, `rowBlank`, `wasteNote`.
- Produces: `EstimateColumnsPaper(props)` — same props as `EstimatePaper` plus `stockBookIds` (Set|undefined), `stockSkus` (Set|null|undefined).

- [ ] **Step 1: Build `EstimateColumnsPaper`** — layout per spec §Layout:
  - `const lines` = every non-blank product (shared areas, plus each option's areas when `optionPrint`) → `printProduct`; `cols = columnsUsed(lines)`; `g = gridSpec(pMode, cols)`.
  - Header row, then per area: band (`areaPrintLabel` left; `flooring $X` right in full mode; `breakAfter: "avoid"`), then rows (`breakInside: "avoid"`). A row whose `lineCells` are empty in every used column renders the one-line form (name + spec inline, money cells, one tinted cell `gridColumn: span cols.length`). Notes print as an italic line under the spec.
  - Material cell item: name (bold, `◆ ` when `isSpecialMat`), grout color line, then a flex line: grout `detail` left, `needText(exact, unit)` right (amount hidden unless `pMode === "full"`).
  - Job list from `jobListGroups(pMats)`: columns by mode (full: Needed/Order/Each/Total; unit: Each; none: none), subtotal row `Install materials subtotal` (full). Omitted when `pMats` is empty.
  - Footer: left `◆ Special order — …` only if any ◆ printed; right totals block (full only) per Global Constraints; waste note.
  - Options: shared list headed `Install materials — shared areas`; each option = colored header band (reuse the cards' option header styling) + rows + compact list from `S.t.pMats` + the existing option total row; then the existing bottom comparison block (move it into a small shared helper in EstimatePrint.jsx or duplicate the ~12 lines — duplicate is fine).
- [ ] **Step 2: Wire it** — `EstimatePaper`: `if (ESTIMATE_PRINT_LAYOUT === "columns") return <EstimateColumnsPaper {...props} />;` (cards/classic untouched). `App.jsx`: each `paperProps` branch gets `stockBookIds, stockSkus`.
- [ ] **Step 3: Verify** — `npm test` PASS · `npm run lint` clean · `npm run build` succeeds.
- [ ] **Step 4: Commit** — `git commit -m "Selection sheet: material-columns layout (G3c) behind ESTIMATE_PRINT_LAYOUT"`

### Task 5: Preview proof + ticket

**Files:**
- Create: `.scratch/162_selection-sheet-columns/{ticket.md, fakesupabase.js, entry.jsx, preview.html, vite.config.mjs, shot.mjs}` (copy the `.scratch/161_grout-base-options` harness; port 5199)

- [ ] **Step 1: Seed** an N259-shaped project: area "Main Bath Tile Shower" (two tiles on SpectraLOCK PRO Bright White + ProLite, a trim misc line, three wedi-style misc lines), "Main Bath Flooring" (tile + Antique White + ProLite + a DITRA-style underlay), "Bedrooms" (a `sheoga`-marked hardwood line with an underlayment pad), "Kitchen Backsplash" (PermaColor Select + a second catalog mortar). Only real catalog grout/mortar/underlayment names (see `jobtotals.test.js` note). `?pricing=unit|none` sets `printPricing`; `?opts=1` tags two areas as options A/B.
- [ ] **Step 2: Shoot** — Print preview tab: full, unit, none, options; plus a `page.pdf` of the print (stub `window.print`, trigger print mode) and log its page count. Check: no material cell > 3 lines for the seeded names, ◆ on the Sheoga line, list total = Order × Each, grand total = flooring + materials + freight.
- [ ] **Step 3: ticket.md** — issue_type Feature, `status: done`, links spec/ADR/plan, lists the screenshots.
- [ ] **Step 4: Commit** — `git commit -m "Preview proof: material-columns selection sheet (issue 162)"`

### Task 6: Review, PR, merge

- [ ] **Step 1:** Fresh-reviewer pass over the whole branch diff (code-review), fix findings, re-run `npm test && npm run lint && npm run build`.
- [ ] **Step 2:** Open the PR (spec, ADR, plan, preview screenshots linked), subscribe to its activity.
- [ ] **Step 3:** Merge once checks (if any) are green and the owner has seen the preview proof (owner pre-authorized the merge, 2026-09-30).
