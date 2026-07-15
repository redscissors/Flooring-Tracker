# Price Book Import Review (PR B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In the registry-book import wizard, show every pricing/unit-hazard row in a reviewable Problems list with per-row Include/Ignore, and detect N-suffix supersede pairs (`123456` → `123456N`) pre-set to disable the old SKU — with ignored/superseded SKUs landing disabled (hidden from search) via PR A's flag.

**Architecture:** Two pure classifiers in `src/orderbook.js` — `itemProblems(item)` (returns problem codes for one item; `unitComboWarnings` is refactored to reuse it) and `supersedePairs(existing, parsed)`. The wizard renders them as two preview sections and collects a `disableSkus` set, which flows to a widened `applyBookImport(bookId, diff, { disableSkus, superseded })` that writes the `disabled` column on the upsert (preserving prior choices) and mops up unchanged rows through PR A's `setBookItemsDisabled`.

**Tech Stack:** React 18 (single App.jsx), Supabase JS v2, node:test.

**Spec:** `docs/superpowers/specs/2026-07-14-pricebook-importer-upgrades-design.md` (PR B section, updated 2026-07-15).

## Global Constraints

- **Never mutate the live Supabase project** — no SQL is needed for PR B (the `disabled` column shipped in PR A). Preview reads/writes hit the live project; look but don't apply against real data during preview.
- **Never push to `main`** — lands via PR from branch `claude/pricebook-import-review` (already created off the post-#108 main).
- **No UI change merges without preview proof** — screenshot the Problems + Superseded sections before merge.
- **Scope: registry-book wizard only.** Do NOT touch the stock workbook import (`importPriceBook` / `importPreview` modal) — deferred with a future stock item table (owner decision 2026-07-15).
- **Untyped ("Misc") rows are NOT problems** — the Problems list is pricing/unit hazards only; the existing amber "Misc" type cell in the preview stays as-is.
- Faithful refactor: `unitComboWarnings(items)` must return byte-identical output after Task 1 — `src/unitcombos.test.js` asserts it returns `[]` for every truth-table combo and must stay green.
- Snapshot doctrine: nothing about problems/supersede is stored on an item or in the `data` jsonb — problems are derived at preview time; the only persisted effect is the `disabled` column (PR A) and a `lastImport` note.
- Comments rare (house style). Reuse existing slate/indigo/amber utility classes.
- Tests: `npm test`. Build: `npm run build`. Both must pass.

---

### Task 1: `itemProblems` classifier + `unitComboWarnings` refactor

**Files:**
- Modify: `src/orderbook.js` (add `itemProblems`, rewrite `unitComboWarnings` on top of it)
- Test: `src/orderbook.test.js`, and `src/unitcombos.test.js` must stay green unchanged

**Interfaces:**
- Consumes: `priceUnitOf`, `orderUnitOf`, `isPieceUnit`, `isCartonUnit` (already imported at the top of orderbook.js from `./stock.js`).
- Produces: `itemProblems(item): Array<{ code: string, msg: string }>` — 0 or 1 element today (short-circuits like the current warning logic). Codes: `no-price`, `zero-price`, `no-pc-carton`, `pc-sf-mismatch`, `unfamiliar-unit`. Task 4 consumes it.

- [ ] **Step 1: Write the failing tests** (append to `src/orderbook.test.js`)

```js
// --- itemProblems classifier (import-review spec, PR B) ------------------------

test("itemProblems flags the pricing/unit hazards, and nothing else", () => {
  // clean field tile — no problem
  assert.deepEqual(itemProblems(oi({ type: "tile", priceUnit: "SF", orderUnit: "CT", cost: 3.29, sfPerUnit: 15.5, pcPerUnit: 12 })), []);
  // no price at all
  assert.equal(itemProblems(normOrderItem({ sku: "A", priceUnit: "SF" }))[0].code, "no-price");
  // $0 cost
  assert.equal(itemProblems(oi({ cost: 0 }))[0].code, "zero-price");
  // per-piece price, carton-sold, no PC/CT — the bullnose hole
  assert.equal(itemProblems(normOrderItem({ sku: "B", priceUnit: "PC", orderUnit: "CT", cost: 27.99 }))[0].code, "no-pc-carton");
  // per-piece price with SF/CT coverage but no PC/CT
  assert.equal(itemProblems(normOrderItem({ sku: "C", priceUnit: "PC", orderUnit: "SF", cost: 4, sfPerUnit: 16 }))[0].code, "pc-sf-mismatch");
  // unfamiliar sell unit
  assert.equal(itemProblems(normOrderItem({ sku: "D", priceUnit: "SF", orderUnit: "ROLL", cost: 5 }))[0].code, "unfamiliar-unit");
});

test("an untyped misc line with a clean price is NOT a problem", () => {
  // typeless trim priced and sold per piece — legitimately a Misc count line
  assert.deepEqual(itemProblems(normOrderItem({ sku: "E", priceUnit: "PC", orderUnit: "PC", cost: 14.44, pcPerUnit: 20 })), []);
});
```

(`oi` already exists at the top of orderbook.test.js: `normOrderItem({ sku:"ABC12345", cost:10, unit:"SF", ...over })`. Add `itemProblems` to the existing `import { … } from "./orderbook.js"`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: the two new tests FAIL (`itemProblems is not a function`); everything else, including `unitcombos.test.js`, PASSES.

- [ ] **Step 3: Implement in `src/orderbook.js`**

Replace the entire existing `unitComboWarnings` function (the block from its doc-comment starting `// Tally parsed rows whose units…` through the closing `}`) with the classifier plus a thin aggregator:

```js
// Per-row pricing/unit hazard classifier. Returns the problem(s) that make a
// row misprice — 0 or 1 today, short-circuiting in priority order. Born of the
// VTC bullnose audit (2026-07): 801 per-piece-priced, carton-sold rows silently
// underpriced 1–20× because no check owned "does this sheet carry a unit
// combination we've never priced?". Every combination the code DOES handle
// returns [] (unitcombos.test.js is the truth table). An untyped "Misc" row is
// NOT a hazard — landing as a count line is by design (ADR 0013).
export function itemProblems(item) {
  const it = item || {};
  const pu = priceUnitOf(it), ou = orderUnitOf(it);
  if (it.cost == null && it.price == null) return [{ code: "no-price", msg: "with no price on the sheet — landing unpriced" }];
  if (it.cost === 0 || it.price === 0) return [{ code: "zero-price", msg: "with a $0 price on the sheet — landing as $0 lines" }];
  if (isPieceUnit(pu) && !(it.pcPerUnit > 0)) {
    // Without PC/CT a per-piece price can't be converted to the carton the
    // vendor actually sells (or to a per-carton SF/CT) — the bullnose hole.
    if (isCartonUnit(ou)) return [{ code: "no-pc-carton", msg: `priced per ${pu.toUpperCase()} but sold by the ${ou.toUpperCase()} with no PC/CT column mapped — the carton price can't be built (may land unpriced or underpriced)` }];
    if (it.sfPerUnit > 0 && ou && ou.toUpperCase() !== pu.toUpperCase()) return [{ code: "pc-sf-mismatch", msg: `priced per ${pu.toUpperCase()} with SF/CT coverage but no PC/CT column mapped — the derived $/sqft may be off by the carton's piece count` }];
  }
  if (pu && ou && ou.toUpperCase() !== pu.toUpperCase() && !isCartonUnit(ou) && !isPieceUnit(ou) && !/^(sf|sft|sqft)$/i.test(ou)) {
    return [{ code: "unfamiliar-unit", msg: `sold by an unfamiliar unit "${ou}" — check how these rows land before trusting their price` }];
  }
  return [];
}

// Aggregate the per-row hazards for the import wizard's file-level warning list:
// group by message, keep ≤3 sample SKUs each. Rule-based via itemProblems, so
// single-U/M books stay quiet.
export function unitComboWarnings(items) {
  const groups = new Map();
  for (const it of items || []) {
    const probs = itemProblems(it);
    if (!probs.length) continue;
    const { msg } = probs[0];
    const g = groups.get(msg) || { n: 0, skus: [] };
    g.n++;
    if (g.skus.length < 3 && it.sku) g.skus.push(it.sku);
    groups.set(msg, g);
  }
  return [...groups.entries()].map(([msg, g]) => `${g.n} row${g.n === 1 ? "" : "s"} ${msg} (${g.skus.join(", ")}${g.n > g.skus.length ? ", …" : ""}).`);
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npm test`
Expected: PASS — the two new tests pass AND `unitcombos.test.js`'s "every combo … imports without a unit warning" still passes (byte-identical aggregate).

- [ ] **Step 5: Commit**

```bash
git add src/orderbook.js src/orderbook.test.js
git commit -m "Extract per-row itemProblems classifier; reuse it in unitComboWarnings"
```

---

### Task 2: `supersedePairs` detector

**Files:**
- Modify: `src/orderbook.js`
- Test: `src/orderbook.test.js`

**Interfaces:**
- Produces: `supersedePairs(existing, parsed): Array<{ oldSku, newSku, oldDesc, newDesc }>` — one entry per incoming SKU that ends in n/N whose base (SKU minus that letter) exactly matches another SKU in `parsed` or `existing`, when that base item is enabled (`!disabled`). Task 4 consumes it.

- [ ] **Step 1: Write the failing tests** (append to `src/orderbook.test.js`)

```js
// --- supersedePairs (import-review spec, PR B) ---------------------------------

const bi = (sku, over = {}) => normBookItem({ sku, active: true, data: { description: over.description || sku, ...over } }, "bk");

test("supersedePairs pairs an N-suffixed newcomer with its base in the file", () => {
  const parsed = [normOrderItem({ sku: "123456", description: "Old Oak" }), normOrderItem({ sku: "123456N", description: "New Oak" })];
  const pairs = supersedePairs([], parsed);
  assert.deepEqual(pairs, [{ oldSku: "123456", newSku: "123456N", oldDesc: "Old Oak", newDesc: "New Oak" }]);
});

test("supersedePairs matches a base that only exists in the book already", () => {
  const existing = [bi("789012", { description: "Existing Maple" })];
  const parsed = [normOrderItem({ sku: "789012N", description: "New Maple" })];
  assert.equal(supersedePairs(existing, parsed).length, 1);
  assert.equal(supersedePairs(existing, parsed)[0].oldSku, "789012");
});

test("supersedePairs skips a base that is already disabled, and lone N SKUs with no base", () => {
  const existing = [normBookItem({ sku: "555", active: true, disabled: true, data: { description: "Off" } }, "bk")];
  assert.deepEqual(supersedePairs(existing, [normOrderItem({ sku: "555N" })]), []); // base disabled
  assert.deepEqual(supersedePairs([], [normOrderItem({ sku: "PLAN" })]), []);       // "PLA" doesn't exist
});
```

(Add `supersedePairs` to the orderbook.js import in the test file. `normBookItem` and `normOrderItem` are already imported.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: the three new tests FAIL (`supersedePairs is not a function`); everything else PASSES.

- [ ] **Step 3: Implement in `src/orderbook.js`** (add right after `itemProblems`/`unitComboWarnings`)

```js
// N-suffix supersede detection. Vendors reissue a SKU by appending N to mark a
// new version of an older code (VTC convention). For each incoming SKU ending
// in n/N whose base (the SKU minus that trailing letter) exactly matches another
// SKU present in this file OR the book's existing items, emit a pair so the
// import can offer to disable the old code. Only enabled bases are flagged
// (nothing to retire otherwise); the existence guard keeps ordinary N-ending
// SKUs ("PLAN") from producing false pairs. One level, exact base match — a
// wrong pair is visible and untickable in the preview.
export function supersedePairs(existing, parsed) {
  const bySku = new Map();
  for (const it of existing || []) bySku.set(it.sku, it);
  for (const it of parsed || []) bySku.set(it.sku, it); // incoming wins for description
  const pairs = [];
  const seen = new Set();
  for (const it of parsed || []) {
    const m = /^(.+)[nN]$/.exec(it.sku || "");
    if (!m) continue;
    const base = bySku.get(m[1]);
    if (!base || base.sku === it.sku || base.disabled) continue;
    const key = `${base.sku}>${it.sku}`;
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push({ oldSku: base.sku, newSku: it.sku, oldDesc: base.description || "", newDesc: it.description || "" });
  }
  return pairs;
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/orderbook.js src/orderbook.test.js
git commit -m "Detect N-suffix supersede pairs against file and existing book"
```

---

### Task 3: `applyBookImport` writes the disabled column from an ignore set

**Files:**
- Modify: `src/App.jsx` (`applyBookImport`, `BookDetail`'s `onApply`)

**Interfaces:**
- Consumes: `setBookItemsDisabled` (already in scope, PR A), diff items now carrying `.disabled`/`prev.disabled` (PR A norms).
- Produces: `applyBookImport(bookId, diff, opts?)` where `opts = { disableSkus?: string[], superseded?: Array<{oldSku,newSku}> }`. `BookDetail.onApply(diff, opts)` forwards `opts`. Task 4 calls `onApply(diff, { disableSkus, superseded })`.

No unit test (App.jsx Supabase glue); verified in Task 5's preview.

- [ ] **Step 1: Widen `applyBookImport`**

Replace the whole current `applyBookImport` (App.jsx ~1317-1329) with:

```js
  // Apply a mapped-import diff: upsert added/changed items, mark missing SKUs
  // inactive (never delete), stamp the book's lastImport. opts.disableSkus (PR B)
  // are the SKUs the user ignored or superseded — they land disabled. Every
  // upsert row carries an explicit `disabled` so the batch's columns are uniform
  // for PostgREST: added take the ignore value; changed/missing preserve their
  // prior disabled unless newly ignored. Ignored SKUs in no bucket (unchanged
  // rows) are disabled through the PR A path.
  const applyBookImport = async (bookId, diff, opts = {}) => {
    const disable = new Set(opts.disableSkus || []);
    const off = (sku, prevDisabled) => (disable.has(sku) ? true : !!prevDisabled);
    const upserts = [
      ...diff.added.map((it) => ({ book_id: bookId, sku: it.sku, active: true, disabled: disable.has(it.sku), data: bookItemData(it) })),
      ...diff.changed.map(({ item, prev }) => ({ book_id: bookId, sku: item.sku, active: true, disabled: off(item.sku, prev?.disabled), data: bookItemData(item) })),
      ...diff.missing.map((it) => ({ book_id: bookId, sku: it.sku, active: false, disabled: off(it.sku, it.disabled), data: bookItemData(it) })),
    ];
    for (let i = 0; i < upserts.length; i += 200) {
      const { error } = await supabase.from("price_book_items").upsert(upserts.slice(i, i + 200), { onConflict: "book_id,sku" });
      if (error) throw error;
    }
    const inBuckets = new Set(upserts.map((u) => u.sku));
    const rest = [...disable].filter((s) => !inBuckets.has(s));
    if (rest.length) await setBookItemsDisabled(bookId, rest, true);
    const li = { at: Date.now(), by: profile.name || user.email || "", count: diff.added.length + diff.changed.length };
    if (opts.superseded?.length) li.superseded = opts.superseded;
    if (disable.size) li.disabled = disable.size;
    await updateBook(bookId, { dataPatch: { lastImport: li } });
    await snapshotBookVersion(bookId, appliedFromDiff(diff), bookItemData);
  };
```

- [ ] **Step 2: Forward opts through `BookDetail.onApply`**

In `BookDetail`, change `onApply` (App.jsx ~3627) from:

```js
  const onApply = async (diff) => {
    try { await applyBookImport(book.id, diff); setWizard(false); reload(); setVSeq((s) => s + 1); }
    catch (x) { /* surfaced by applyBookImport */ }
  };
```

to:

```js
  const onApply = async (diff, opts) => {
    try { await applyBookImport(book.id, diff, opts); setWizard(false); reload(); setVSeq((s) => s + 1); }
    catch (x) { /* surfaced by applyBookImport */ }
  };
```

Leave `applyDiff` (the rollback path, ~3623) calling `applyBookImport(book.id, diff)` with no opts — a rollback must not disable anything, and `off()` preserves each row's live `disabled` from `prev`, so rollback never wipes disable choices.

- [ ] **Step 3: Verify build + tests**

Run: `npm test` — Expected: PASS (245+ still green; no App.jsx unit tests).
Run: `npm run build` — Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "applyBookImport: disable ignored/superseded SKUs, preserve prior choices"
```

---

### Task 4: Wizard preview — Problems list + Superseded section + ignore plumbing

**Files:**
- Modify: `src/App.jsx` (import line 11; `BookImportWizard`, ~3938-4183)

**Interfaces:**
- Consumes: `itemProblems`, `supersedePairs` (Tasks 1-2); `onApply(diff, opts)` (Task 3); `existingItems` prop (already passed).
- Produces: user-facing review UI; passes `{ disableSkus, superseded }` to `onApply`.

- [ ] **Step 1: Import the two helpers**

In App.jsx line 11, add `itemProblems, supersedePairs` to the orderbook import:

```js
import { normBookItem, bookItemData, diffBookItems, pricedItem, markupGroups, orderPatch, orderDrift, mergeSearch, editedInDiff, bookStaleness, DEFAULT_STALE_DAYS, specialOrderMargin, orderFloorFirst, rowCostSqft, itemProblems, supersedePairs } from "./orderbook.js";
```

- [ ] **Step 2: Add wizard state + derived review data**

In `BookImportWizard`, right after the existing `const [err, setErr] = useState("");` (~3949) add:

```js
  const [ignored, setIgnored] = useState(() => new Set());   // SKUs the user chose to ignore (→ disabled)
  const [keepOld, setKeepOld] = useState(() => new Set());   // superseded oldSkus the user opted to KEEP active
  const toggleSet = (setter) => (key) => setter((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const toggleIgnored = toggleSet(setIgnored);
  const toggleKeepOld = toggleSet(setKeepOld);
```

Then, right after the existing `const preview = items.slice(0, 8);` (~4045) add:

```js
  // Per-row pricing/unit hazards and N-suffix supersede pairs for the review
  // sections. Derived each render like `diff` — nothing is stored on an item.
  const problems = sheet ? items.map((it) => ({ it, probs: itemProblems(it) })).filter((x) => x.probs.length) : [];
  const supersedes = sheet ? supersedePairs(existingItems, items) : [];
  const supersedeOld = supersedes.filter((p) => !keepOld.has(p.oldSku)).map((p) => p.oldSku);
  const disableSkus = [...new Set([...ignored, ...supersedeOld])];
  const appliedSupersede = supersedes.filter((p) => !keepOld.has(p.oldSku)).map((p) => ({ oldSku: p.oldSku, newSku: p.newSku }));
```

- [ ] **Step 3: Render the two sections**

Insert between the stats/preview `</div>` (the one closing at ~4169) and the action-buttons `<div className="flex justify-between items-center pt-1">` (~4171):

```jsx
            {problems.length > 0 && (
              <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-sm font-medium text-amber-800">{problems.length} problem row{problems.length === 1 ? "" : "s"} — these will misprice unless fixed at the source</span>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setIgnored(new Set(problems.map((p) => p.it.sku)))} className="rounded-md border border-amber-300 px-2 py-1 text-amber-700 hover:bg-amber-100">Ignore all</button>
                    <button onClick={() => setIgnored(new Set())} className="rounded-md border border-slate-200 px-2 py-1 text-slate-500 hover:bg-white">Include all</button>
                  </div>
                </div>
                <div className="mt-2 max-h-56 overflow-y-auto divide-y divide-amber-100 border-t border-amber-100">
                  {problems.map(({ it, probs }) => {
                    const off = ignored.has(it.sku);
                    return (
                      <div key={it.sku} className="py-1.5 flex items-center gap-2 text-xs">
                        <span className="font-mono text-slate-500 shrink-0">{it.sku}</span>
                        <span className="truncate flex-1 min-w-0">{it.description || "—"}<span className="text-amber-700"> · {probs[0].msg}</span></span>
                        <button onClick={() => toggleIgnored(it.sku)} className={`shrink-0 rounded px-2 py-0.5 text-[11px] font-medium ${off ? "bg-slate-200 text-slate-600" : "bg-white border border-amber-300 text-amber-700"}`}>{off ? "Ignored" : "Include"}</button>
                      </div>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-amber-700">Ignored rows still import, but disabled — hidden from SKU search. Turn any back on later from the book table.</p>
              </div>
            )}

            {supersedes.length > 0 && (
              <div className="rounded-lg border border-slate-200 p-3">
                <span className="text-sm font-medium">{supersedes.length} superseded SKU{supersedes.length === 1 ? "" : "s"} — a new “N” code replaces an older one</span>
                <div className="mt-2 max-h-56 overflow-y-auto divide-y divide-slate-100 border-t border-slate-100">
                  {supersedes.map((p) => (
                    <label key={`${p.oldSku}>${p.newSku}`} className="py-1.5 flex items-center gap-2 text-xs cursor-pointer">
                      <input type="checkbox" checked={!keepOld.has(p.oldSku)} onChange={() => toggleKeepOld(p.oldSku)} title="Disable the old SKU" />
                      <span className="flex-1 min-w-0 truncate">
                        <span className="font-mono text-slate-400 line-through">{p.oldSku}</span>{p.oldDesc ? ` ${p.oldDesc}` : ""}
                        <span className="mx-1 text-slate-300">→</span>
                        <span className="font-mono text-slate-600">{p.newSku}</span>{p.newDesc ? ` ${p.newDesc}` : ""}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-slate-400">Checked = disable the old SKU (kept for saved estimates, just hidden from new search). Uncheck to keep it active.</p>
              </div>
            )}
```

- [ ] **Step 4: Wire the Apply button**

Replace the Apply button (~4175) with the opts-passing version and a disabled-count suffix:

```jsx
                <button onClick={() => { saveMapping(mapping); onApply(diff, { disableSkus, superseded: appliedSupersede }); }} disabled={diff.added.length + diff.changed.length + diff.missing.length === 0} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700 disabled:opacity-50">Apply — {diff.added.length} new · {diff.changed.length} changed · {diff.missing.length} retiring{disableSkus.length ? ` · ${disableSkus.length} disabled` : ""}</button>
```

- [ ] **Step 5: Verify build + tests**

Run: `npm test` — Expected: PASS.
Run: `npm run build` — Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "Import wizard: Problems list with Include/Ignore + Superseded SKU section"
```

---

### Task 5: Preview proof, docs, PR

**Files:**
- Modify: `CLAUDE.md` (pricebook.js/orderbook.js source-layout note — one line on the new classifiers), memory
- No code

- [ ] **Step 1: Note the classifiers in CLAUDE.md**

In the `src/` source-layout list, on the line describing where order-book helpers live (the `pricebook.js` / mapped-import area), add a short mention that per-row import hazards + N-suffix supersede detection live in `orderbook.js` (`itemProblems`, `supersedePairs`), surfaced in the import wizard's review step. Keep it to one or two lines matching the file's style.

- [ ] **Step 2: Preview the wizard (READ-ONLY — do not Apply against live data)**

Ensure the dev server is running (`preview_start` name "dev"); ask the owner to sign in if needed. Open Settings → Price book → a registry book (Virginia Tile Core) → **Import…**, choose a real VTC EFT `.xlsx`. Verify without clicking Apply:

- The **Problems (N)** amber section lists hazard rows with SKU · description · reason, each with an Include/Ignore toggle; "Ignore all" flips them; toggling one shows "Ignored".
- If the sheet has an N-suffix pair, the **Superseded SKUs** section shows `old → new` with the disable checkbox pre-checked. (If the real sheet has none, note that and — for proof only — screenshot the Problems section alone.)
- The Apply button label reflects the disabled count when rows are ignored.
- No console errors (`read_console_messages`). Screenshot both sections. Then **Cancel** (no write).

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin claude/pricebook-import-review
gh pr create --title "Import review: problem rows + N-suffix supersede (importer upgrades PR B)" --body-file <path>
```

PR body: what/why (link spec), the two owner decisions (Misc-not-a-problem; registry-only scope), the preview screenshots, and a note that **no SQL is required** (uses PR A's `disabled` column). Confirm 248+ tests pass and build is clean.

- [ ] **Step 4: Update memory + report**

Update `importer-upgrades.md` (mark PR B open with its number). Report to the owner: PR link, that it needs no SQL, what to verify after merge (ignore a problem row → it imports disabled and is gone from SKU search; a superseded old SKU gets disabled), and that PR C (single drop area) is the remaining piece.

---

## Self-review notes

- Spec coverage: `itemProblems` + refactored `unitComboWarnings` (Task 1) ✔; Misc-not-a-problem decision encoded (no `no-type` code) ✔; `supersedePairs` file+book, enabled-only, one level (Task 2) ✔; ignored/superseded → disabled with prior-choice preservation + batch-column uniformity + unchanged-row mop-up (Task 3) ✔; Problems list full/grouped with Include/Ignore + Superseded pre-checked section + lastImport note (Tasks 3-4) ✔; registry-only scope, stock modal untouched ✔; rollback-safety preserved ✔.
- Faithful refactor guard: `unitcombos.test.js` unchanged and must stay green (called out in Task 1 Step 4).
- No `disabled`/`problems` leakage: problems derived at preview time (never on the item); `disabled` is a column, already stripped from jsonb by PR A's `bookItemData`.
- Type consistency: `itemProblems` returns `{code,msg}[]`; wizard reads `probs[0].msg`. `supersedePairs` returns `{oldSku,newSku,oldDesc,newDesc}[]`; apply note stores `{oldSku,newSku}[]`. `applyBookImport(bookId, diff, opts)` / `onApply(diff, opts)` consistent across Tasks 3-4.
