# Sheoga Configurator — Basket + Multi-Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a persistent per-job shopping basket to the Sheoga configurator plus a multi-width floor mode (unfinished & custom + stocked prefinished tabs) that splits a job across several plank widths with pooled once-per-job fees.

**Architecture:** Pure pricing/normalization helpers go in `src/sheoga.js` (unit-tested in `src/sheoga.test.js`). The basket persists on the existing project record (`sel.sheogaBasket`) via the existing `updateProject(id, patch)` path — no Supabase schema change. UI lives in `src/SheogaConfigurator.jsx`; App-side wiring (normalization, props, move-to-line) in `src/App.jsx`. The dev harness (`.scratch/023_sheoga-configurator-prototype/harness-main.jsx`) is the Supabase-free preview surface and is extended to exercise the basket.

**Tech Stack:** React 18 (hooks, no router), Vite 5, Tailwind 3 + `--ft-*` CSS vars, `node:test` unit tests. Design spec: `docs/superpowers/specs/2026-07-18-sheoga-cart-multiwidth-design.md`. Clickable mockup: `.scratch/024_sheoga-cart-multiwidth/mockup.html`.

## Global Constraints

- **No live Supabase mutation by an agent** — the basket uses the existing `customers.data` jsonb; no SQL, no new column.
- **Every change lands via PR; never push to `main`.**
- **No UI/print change merges without preview proof** — screenshot from the dev harness or app preview.
- **Snapshot rule (ADR 0003):** nothing reprices after landing on a row; basket entries store configs and are priced from the code-constant Sheoga sheets at display/move time.
- **Extend the normalizers** (`normC`, `defaultConfig`) when adding fields so old records stay valid.
- **Money helper:** use existing `round2` for cost, `sellOf(cost, markupPct)` for sell — never re-invent rounding.
- **Run all tests with** `npm test` (`node --test src/*.test.js`). All must stay green.

---

## File structure

| File | Responsibility | Change |
|---|---|---|
| `src/sheoga.js` | Pricing engine + payloads + basket-entry normalizer | Add `redistributeShares`, `multiWidthBuild`, `multiWidthLineItems`, `normBasketEntry` |
| `src/sheoga.test.js` | Unit tests | Add tests for the four new exports |
| `src/SheogaConfigurator.jsx` | Popup UI | Rail width/gutter, remove helper line, Multi chip + multi-select + stepper, `MultiWidthCard`, basket button + drawer/sheet, wiring |
| `src/App.jsx` | Project normalization + configurator mount + move-to-line | `normC`/`newProject` add `sheogaBasket`; pass basket props + area name; persist via `updateProject` |
| `.scratch/023_sheoga-configurator-prototype/harness-main.jsx` | Supabase-free preview | Provide in-memory basket state + area name so the UI is verifiable |

---

## Task 1: Cleanups — rail width, scrollbar gutter, remove helper copy

**Files:**
- Modify: `src/SheogaConfigurator.jsx` (rail `div` in the desktop layout ~line 735; the helper line in `BuildCard` ~line 519)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing (pure presentation).

- [ ] **Step 1: Widen the rail and reserve the scrollbar gutter**

Find the desktop options rail:
```jsx
<div className="w-[50%] max-w-[468px] shrink-0 border-r border-slate-300 overflow-y-auto p-4">{rail}</div>
```
Replace with (wider cap + reserved gutter so chips never reflow when the rail scrolls):
```jsx
<div className="w-[50%] max-w-[500px] shrink-0 border-r border-slate-300 overflow-y-auto p-4" style={{ scrollbarGutter: "stable" }}>{rail}</div>
```
Then find the popup shell:
```jsx
<div className={`bg-white flex flex-col overflow-hidden ${isWide ? "rounded-xl w-full max-w-5xl h-[min(820px,94vh)] border border-slate-300 shadow-2xl" : "w-full h-full relative"}`}
```
Change `max-w-5xl` to `max-w-[1060px]` so the build pane keeps its width.

- [ ] **Step 2: Remove the helper line under the build-card description**

In `BuildCard`, delete this line:
```jsx
<div className="px-3.5 pb-2 text-[11px] text-slate-500 font-medium">↑ this description <b>is</b> the order — it snapshots onto the job line.</div>
```

- [ ] **Step 3: Verify in the harness**

Start the dev server (preview_start `dev`), open `/.scratch/023_sheoga-configurator-prototype/harness.html`, click **Open configurator**, resize the browser to 1280px wide. Confirm: species show in 2 rows, the helper line is gone. Screenshot for PR proof.

- [ ] **Step 4: Commit**

```bash
git add src/SheogaConfigurator.jsx
git commit -m "Sheoga: wider rail + reserved scrollbar gutter; drop the 'description is the order' line"
```

---

## Task 2: `redistributeShares` — proportional-to-width default split

**Files:**
- Modify: `src/sheoga.js` (add export near the herringbone/util section)
- Test: `src/sheoga.test.js`

**Interfaces:**
- Produces: `redistributeShares(widthVals: number[]) → { [w: number]: number }` — each width's share as a whole-number percentage; wider width gets the larger share; values sum to exactly 100.

- [ ] **Step 1: Write the failing tests**

Add to `src/sheoga.test.js`:
```js
import { redistributeShares } from "./sheoga.js";

test("redistributeShares: proportional to plank width, sums to 100, wider gets more", () => {
  const s = redistributeShares([3.25, 4.25, 5.25]);
  assert.equal(s[3.25] + s[4.25] + s[5.25], 100);
  assert.ok(s[5.25] > s[4.25] && s[4.25] > s[3.25]);
  assert.deepEqual(s, { 3.25: 25, 4.25: 33, 5.25: 42 });
});

test("redistributeShares: four widths still sum to 100", () => {
  const s = redistributeShares([3.25, 4.25, 5.25, 6.25]);
  assert.equal(Object.values(s).reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(s, { 3.25: 17, 4.25: 22, 5.25: 28, 6.25: 33 });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | grep -A2 redistributeShares`
Expected: FAIL (`redistributeShares is not a function`).

- [ ] **Step 3: Implement**

Add to `src/sheoga.js`:
```js
// Default multi-width split: each width's share ∝ its plank width (wider plank →
// bigger share, i.e. the 3-4-5 repeating look with equal plank counts). Whole
// percentages; the rounding remainder lands on the widest width so it sums to 100.
export function redistributeShares(widthVals) {
  const sum = widthVals.reduce((a, w) => a + w, 0) || 1;
  const out = {}; let acc = 0;
  widthVals.forEach((w) => { out[w] = Math.round((w / sum) * 100); acc += out[w]; });
  if (widthVals.length) { const big = [...widthVals].sort((a, b) => b - a)[0]; out[big] += 100 - acc; }
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/sheoga.js src/sheoga.test.js
git commit -m "sheoga: redistributeShares — width-proportional multi-width split"
```

---

## Task 3: `multiWidthBuild` (floor mode) — split + pooled floor fees

**Files:**
- Modify: `src/sheoga.js`
- Test: `src/sheoga.test.js`

**Interfaces:**
- Consumes: existing `calcFloor`, `calcStocked`, `stockedItem`, `CUSTOM_FINISHES`, `SAMPLE_FEE`, `SHEEN_FEE`.
- Produces: `multiWidthBuild(base: {mode:"floor"|"stocked", cfg}, widths: {w:number, share:number}[], sf: number) → { lines: {w,share,sf,cost,size,rest,cartonSf,ok}[], fees: {label,amt}[], sf }`. Per-width `lines` carry NO fees; `fees` is the pooled once-per-job set. Stocked handled in Task 4.

- [ ] **Step 1: Write the failing tests (floor)**

Add to `src/sheoga.test.js`:
```js
import { multiWidthBuild } from "./sheoga.js";

const mwFloor = (over = {}) => ({ mode: "floor", cfg: { ...defaultConfig("floor"), sp: "White Oak", grade: "char", cons: "solid", ...over } });
const shares = (ws) => ws.map((w) => ({ w, share: 1 }));

test("multiWidthBuild floor: per-width sf splits and reconciles to the exact total", () => {
  const b = multiWidthBuild(mwFloor(), [{ w: 3.25, share: 25 }, { w: 4.25, share: 33 }, { w: 5.25, share: 42 }], 420);
  assert.equal(b.lines.length, 3);
  assert.equal(b.lines.reduce((a, l) => a + l.sf, 0), 420);
  assert.ok(b.lines.every((l) => l.cost > 0 && l.ok));
});

test("multiWidthBuild floor: unfinished has no fees; small-order fee pools once on total sf", () => {
  const unf = multiWidthBuild(mwFloor({ finish: "unf" }), shares([3.25, 4.25, 5.25]), 300);
  assert.deepEqual(unf.fees, []);
  const small = multiWidthBuild(mwFloor({ finish: "est" }), shares([3.25, 4.25, 5.25]), 300);
  assert.equal(small.fees.filter((f) => /Small-order/.test(f.label)).length, 1);
  assert.equal(small.fees.find((f) => /Small-order/.test(f.label)).amt, 300);
  const big = multiWidthBuild(mwFloor({ finish: "est" }), shares([3.25, 4.25, 5.25]), 600);
  assert.equal(big.fees.filter((f) => /Small-order/.test(f.label)).length, 0);
});

test("multiWidthBuild floor: custom color sample charged once for the bundle", () => {
  const b = multiWidthBuild(mwFloor({ finish: "t1" }), shares([3.25, 4.25, 5.25]), 600);
  assert.equal(b.fees.filter((f) => /sample/i.test(f.label)).length, 1);
  assert.equal(b.fees.find((f) => /sample/i.test(f.label)).amt, 750);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | grep -A2 multiWidthBuild`
Expected: FAIL (`multiWidthBuild is not a function`).

- [ ] **Step 3: Implement (floor branch + shared split; stocked branch stubbed for Task 4)**

Add to `src/sheoga.js`:
```js
// A multi-width floor: one build per width sharing every other option, the job
// size split by share (∝ width by default), and the per-build setup fees pooled
// to ONCE per bundle. Per-width `lines` carry no fees; `fees` are the pooled set.
export function multiWidthBuild(base, widths, sf) {
  const stocked = base.mode === "stocked";
  const sum = widths.reduce((a, x) => a + (x.share || 0), 0) || 1;
  const lines = widths.map((x) => {
    const cfg = { ...base.cfg, w: x.w };
    const c = stocked ? calcStocked(cfg) : calcFloor(cfg, Math.round((sf * (x.share || 0)) / sum));
    return {
      w: x.w, share: x.share || 0, sf: Math.round((sf * (x.share || 0)) / sum),
      cost: c ? c.cost : null, size: c ? c.size : null, rest: c ? c.rest : null,
      cartonSf: c ? c.cartonSf : null, ok: !!c,
    };
  });
  const diff = sf - lines.reduce((a, l) => a + l.sf, 0);
  if (lines.length) {
    let bi = 0; lines.forEach((l, i) => { if (l.sf > lines[bi].sf) bi = i; });
    lines[bi].sf += diff;
  }
  const fees = [];
  if (stocked) {
    const it = stockedItem(base.cfg);
    const std = it ? it.sheen : null;
    const sheen = base.cfg.sheen != null && base.cfg.sheen !== "" ? String(base.cfg.sheen) : String(std);
    if (std != null && Number(sheen) !== std) fees.push({ label: `Non-standard sheen — ${sheen}-sheen (standard ${std})`, amt: SHEEN_FEE });
  } else {
    const f = base.cfg;
    if (f.finish !== "unf") { const fee = sf < 250 ? 600 : sf < 500 ? 300 : 0; if (fee) fees.push({ label: `Small-order fee — prefinished job under ${sf < 250 ? 250 : 500} sf`, amt: fee }); }
    if (CUSTOM_FINISHES.includes(f.finish) || (f.finish === "est" && f.sample)) fees.push({ label: "Custom color-match sample — approval bundle shipped", amt: SAMPLE_FEE });
  }
  return { lines, fees, sf };
}
```
Confirm `CUSTOM_FINISHES`, `SAMPLE_FEE`, `SHEEN_FEE`, `stockedItem`, `calcStocked`, `calcFloor` are already defined above this point in the file (they are).

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/sheoga.js src/sheoga.test.js
git commit -m "sheoga: multiWidthBuild — split + pooled floor fees"
```

---

## Task 4: `multiWidthBuild` (stocked mode) — pooled sheen fee, width availability

**Files:**
- Modify: `src/sheoga.js` (no code change if Task 3's stocked branch is complete — this task adds the tests that lock stocked behavior)
- Test: `src/sheoga.test.js`

**Interfaces:**
- Consumes/Produces: same `multiWidthBuild` as Task 3.

- [ ] **Step 1: Write the failing tests (stocked)**

Add to `src/sheoga.test.js`. `STOCKED[0]` is `{ sp: "Cherry", color: "Natural", sheen: 30, clear:[N,5.30,5.55,5.80], char:[N,5.25,...] }`:
```js
const mwStocked = (over = {}) => ({ mode: "stocked", cfg: { sp: "Cherry", color: "Natural", grade: "char", sheen: "30", sheenCustom: false, ...over } });

test("multiWidthBuild stocked: no small-order fee; standard sheen has no fee", () => {
  const b = multiWidthBuild(mwStocked(), [{ w: 3.25, share: 40 }, { w: 4.25, share: 60 }], 200);
  assert.equal(b.lines.reduce((a, l) => a + l.sf, 0), 200);
  assert.deepEqual(b.fees, []);
});

test("multiWidthBuild stocked: off-standard sheen pools once at $250", () => {
  const b = multiWidthBuild(mwStocked({ sheen: "5" }), [{ w: 3.25, share: 40 }, { w: 4.25, share: 60 }], 200);
  assert.equal(b.fees.length, 1);
  assert.match(b.fees[0].label, /sheen/i);
  assert.equal(b.fees[0].amt, 250);
});

test("multiWidthBuild stocked: a width the product doesn't ship is flagged ok:false", () => {
  // Cherry Natural char has null at 2¼" (index 0)
  const b = multiWidthBuild(mwStocked(), [{ w: 2.25, share: 50 }, { w: 4.25, share: 50 }], 200);
  assert.equal(b.lines.find((l) => l.w === 2.25).ok, false);
  assert.equal(b.lines.find((l) => l.w === 4.25).ok, true);
});
```

- [ ] **Step 2: Run to verify failure/pass**

Run: `npm test 2>&1 | grep -A2 "stocked:"`
Expected: PASS (Task 3's stocked branch already satisfies these). If any fail, fix the stocked branch in `multiWidthBuild` per the assertions.

- [ ] **Step 3: Commit**

```bash
git add src/sheoga.test.js
git commit -m "sheoga: lock stocked multi-width behavior (pooled sheen fee, width availability)"
```

---

## Task 5: `multiWidthLineItems` — row payloads for both modes

**Files:**
- Modify: `src/sheoga.js`
- Test: `src/sheoga.test.js`

**Interfaces:**
- Consumes: `multiWidthBuild`, `sellOf`, `round2`, `DEFAULT_MARKUP`.
- Produces: `multiWidthLineItems(base, widths, sf, markupPct=DEFAULT_MARKUP) → LinePayload[]` — one `type:"hardwood"` row per shippable width (`sizeText`, `brandColor`, `qtyType:"sqft"`, `qty`, `priceSqft`, `costSqft`, `markupPct`, optional `cartonSf`, `sheoga:{mode,cfg,multiWidth:true}`) followed by one `type:"misc"` row per pooled fee. Same shape as `lineItems`, so `addSheogaLines` consumes it unchanged.

- [ ] **Step 1: Write the failing tests**

Add to `src/sheoga.test.js`:
```js
import { multiWidthLineItems } from "./sheoga.js";

test("multiWidthLineItems: N width rows + pooled fee rows, correct shapes", () => {
  const rows = multiWidthLineItems(mwFloor({ finish: "t1" }), [{ w: 3.25, share: 25 }, { w: 4.25, share: 33 }, { w: 5.25, share: 42 }], 300, 40);
  const hardwood = rows.filter((r) => r.type === "hardwood");
  const misc = rows.filter((r) => r.type === "misc");
  assert.equal(hardwood.length, 3);
  assert.ok(hardwood.every((r) => r.qtyType === "sqft" && r.sheoga.multiWidth === true));
  assert.equal(hardwood.reduce((a, r) => a + Number(r.qty), 0), 300);
  // t1 custom under 300 sf → small-order ($300) + custom sample ($750) = 2 fee rows
  assert.equal(misc.length, 2);
  assert.ok(misc.every((r) => r.markupPct === "0" && r.priceSqft === r.costSqft));
});

test("multiWidthLineItems: unshippable widths are dropped, not zero-priced", () => {
  const rows = multiWidthLineItems(mwStocked(), [{ w: 2.25, share: 50 }, { w: 4.25, share: 50 }], 200, 40);
  assert.equal(rows.filter((r) => r.type === "hardwood").length, 1);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | grep -A2 multiWidthLineItems`
Expected: FAIL (`multiWidthLineItems is not a function`).

- [ ] **Step 3: Implement**

Add to `src/sheoga.js`:
```js
// Multi-width → row payloads: a hardwood row per shippable width + pooled fee
// misc rows. Same shape as lineItems() so addSheogaLines consumes it unchanged.
export function multiWidthLineItems(base, widths, sf, markupPct = DEFAULT_MARKUP) {
  const b = multiWidthBuild(base, widths, sf);
  const rows = b.lines.filter((l) => l.ok).map((l) => ({
    type: "hardwood", sku: "", sizeText: l.size || "", brandColor: `Sheoga — ${l.rest}`,
    qtyType: "sqft", qty: l.sf > 0 ? String(l.sf) : "",
    priceSqft: String(sellOf(l.cost, markupPct)), costSqft: String(round2(l.cost)), markupPct: String(markupPct),
    ...(l.cartonSf ? { cartonSf: String(l.cartonSf) } : {}),
    note: "Sheoga multi-width — one floor in mixed widths",
    sheoga: { mode: base.mode, cfg: JSON.parse(JSON.stringify({ ...base.cfg, w: l.w })), multiWidth: true },
  }));
  const fees = b.fees.map((x) => ({
    type: "misc", sku: "", sizeText: "", brandColor: `Sheoga — ${x.label}`, qtyType: "count", qty: "1",
    priceSqft: String(x.amt), costSqft: String(x.amt), markupPct: "0",
    note: "Sheoga vendor fee — passed through at cost (shared across the multi-width set)",
  }));
  return [...rows, ...fees];
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/sheoga.js src/sheoga.test.js
git commit -m "sheoga: multiWidthLineItems — add-to-line payloads for both modes"
```

---

## Task 6: `normBasketEntry` — basket persistence normalizer

**Files:**
- Modify: `src/sheoga.js`
- Test: `src/sheoga.test.js`

**Interfaces:**
- Consumes: `DEFAULT_MARKUP`.
- Produces: `normBasketEntry(e) → BasketEntry | null`. Single: `{id, kind:"single", addedAt, markupPct, snap:{mode,cfg}, sf}`. Bundle: `{id, kind:"bundle", addedAt, markupPct, base:{mode:"floor"|"stocked", cfg}, widths:{w,share}[], sf}`. Returns `null` for junk (a bundle needs ≥2 widths and a `base.cfg`; a single needs a `snap.cfg`).

- [ ] **Step 1: Write the failing tests**

Add to `src/sheoga.test.js`:
```js
import { normBasketEntry } from "./sheoga.js";

test("normBasketEntry: valid single/bundle pass; junk drops to null", () => {
  const s = normBasketEntry({ kind: "single", snap: { mode: "floor", cfg: { sp: "White Oak" } }, sf: 100 });
  assert.equal(s.kind, "single"); assert.ok(s.id && s.markupPct);
  const b = normBasketEntry({ kind: "bundle", base: { mode: "floor", cfg: { sp: "White Oak" } }, widths: [{ w: 3.25, share: 40 }, { w: 4.25, share: 60 }], sf: 200 });
  assert.equal(b.kind, "bundle"); assert.equal(b.widths.length, 2);
  assert.equal(normBasketEntry({ kind: "bundle", base: null, widths: [] }), null);
  assert.equal(normBasketEntry({ kind: "single" }), null);
  assert.equal(normBasketEntry(null), null);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test 2>&1 | grep -A2 normBasketEntry`
Expected: FAIL.

- [ ] **Step 3: Implement**

Add to `src/sheoga.js`:
```js
const bkId = () => "bk" + Math.random().toString(36).slice(2, 9);

// Normalize one persisted basket entry; returns null for junk so a bad record
// can't crash the drawer. Called by App.jsx normC over sheogaBasket.
export function normBasketEntry(e) {
  if (!e || typeof e !== "object") return null;
  const head = { id: e.id || bkId(), addedAt: e.addedAt || Date.now(), markupPct: Number(e.markupPct) || DEFAULT_MARKUP };
  if (e.kind === "bundle") {
    if (!e.base || !e.base.cfg) return null;
    const widths = (Array.isArray(e.widths) ? e.widths : [])
      .filter((w) => w && Number.isFinite(+w.w))
      .map((w) => ({ w: +w.w, share: Number(w.share) || 0 }));
    if (widths.length < 2) return null;
    return { ...head, kind: "bundle", base: { mode: e.base.mode === "stocked" ? "stocked" : "floor", cfg: e.base.cfg }, widths, sf: Number(e.sf) || 0 };
  }
  if (!e.snap || !e.snap.cfg) return null;
  return { ...head, kind: "single", snap: { mode: e.snap.mode || "floor", cfg: e.snap.cfg }, sf: Number(e.sf) || 0 };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test 2>&1 | tail -5`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/sheoga.js src/sheoga.test.js
git commit -m "sheoga: normBasketEntry — normalize persisted basket rows"
```

---

## Task 7: Project normalization + configurator props (App.jsx)

**Files:**
- Modify: `src/App.jsx` (`newProject` ~line 552, `normC` ~line 566, the `<SheogaConfigurator>` mount ~line 4630)
- Modify: `.scratch/023_sheoga-configurator-prototype/harness-main.jsx`

**Interfaces:**
- Consumes: `normBasketEntry`, `multiWidthLineItems`, existing `updateProject`, `addSheogaLines`.
- Produces: `SheogaConfigurator` gains props `basket: BasketEntry[]`, `onBasketChange(nextBasket)`, `areaName: string`, `onMove(lines)` (adds to the active row/area). App persists the basket on `sel.sheogaBasket`.

- [ ] **Step 1: Add `sheogaBasket` to the project shape + normalizer**

In `newProject` (line 552), add `sheogaBasket: []` to the returned object (e.g. after `attachments: []`).
In `normC` (line 566), add `sheogaBasket: (c.sheogaBasket || []).map(normBasketEntry).filter(Boolean)` to the returned object.
Add `normBasketEntry, multiWidthLineItems` to the existing `./sheoga.js` import at line 18.

- [ ] **Step 2: Pass basket props into the configurator**

Replace the `<SheogaConfigurator ... />` mount (~line 4630) with the props added:
```jsx
<SheogaConfigurator seed={sheogaPop.seed}
  initialSf={num(row.qty) > 0 && row.qtyType === "sqft" ? num(row.qty) : 0}
  markupDefault={normPricing(settings.pricing).sheogaMarkupPct}
  ventMarkupDefault={normPricing(settings.pricing).sheogaVentMarkupPct}
  basket={sel.sheogaBasket || []}
  onBasketChange={(next) => updateProject(sel.id, { sheogaBasket: next })}
  areaName={sel.categories.find((x) => x.id === sheogaPop.aid)?.name || "this area"}
  onMove={(lines) => addSheogaLines(sheogaPop.aid, sheogaPop.pid, lines)}
  onAdd={(lines) => { addSheogaLines(sheogaPop.aid, sheogaPop.pid, lines); setSheogaPop(null); setFocusQty(sheogaPop.pid); }}
  onClose={() => setSheogaPop(null)} />
```
(`onAdd` closes the popup after a direct add; `onMove` adds without closing, for basket moves.)

- [ ] **Step 3: Give the harness a basket so the UI is testable without Supabase**

In `.scratch/023_sheoga-configurator-prototype/harness-main.jsx`, add basket state in `Harness()`:
```jsx
const [basket, setBasket] = useState([]);
```
and pass to the `<SheogaConfigurator>`:
```jsx
basket={basket} onBasketChange={setBasket} areaName="Kitchen"
onMove={(lines) => setAdded(lines)}
```

- [ ] **Step 4: Verify nothing regressed**

Run: `npm test 2>&1 | tail -3` (normC change is covered indirectly; add a quick check if `catalog.test.js`/App normalization has a home — otherwise rely on the app booting). Start the harness, open the configurator, confirm it still renders and **Add to product line** still works.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx .scratch/023_sheoga-configurator-prototype/harness-main.jsx
git commit -m "app: persist Sheoga basket on the project; pass basket/area props to the configurator"
```

---

## Task 8: Multi-width mode UI — Multi chip, multi-select, stepper

**Files:**
- Modify: `src/SheogaConfigurator.jsx` (`FloorRail`, `StockedRail`, and the popup component state)

**Interfaces:**
- Consumes: `redistributeShares`, `WIDTHS`, `WIDTH_LABEL`, `floorWidths`, `STOCKED_WIDTHS`, `calcFloor`, `calcStocked`.
- Produces: configurator-level state `multi` (bool), `mwWidths` (number[]), `mwShares` ({[w]:share}); the rail renders multi-select width chips + a Multi chip + a count stepper when `multi` is on. Consumed by Task 9's `MultiWidthCard`.

- [ ] **Step 1: Lift multi-width state into the popup component**

In `SheogaConfigurator` (the default export), add near the other `useState`s:
```jsx
const [multi, setMulti] = useState(false);
const [mwWidths, setMwWidths] = useState([3.25, 4.25, 5.25]);
const [mwShares, setMwShares] = useState(() => redistributeShares([3.25, 4.25, 5.25]));
const multiOk = mode === "floor" || mode === "stocked"; // multi-width only on width-run tabs
useEffect(() => { if (!multiOk && multi) setMulti(false); }, [mode, multiOk, multi]);
const availWidths = mode === "stocked" ? STOCKED_WIDTHS[cfg.grade] || [] : floorWidths(cfg);
const setMwSet = (nextWidths) => { const ws = [...new Set(nextWidths)].sort((a, b) => a - b); setMwWidths(ws); setMwShares(redistributeShares(ws)); };
const toggleMwWidth = (w) => { if (mwWidths.includes(w)) { if (mwWidths.length > 2) setMwSet(mwWidths.filter((x) => x !== w)); } else setMwSet([...mwWidths, w]); };
const stepMw = (d) => { if (d > 0) { const add = availWidths.find((w) => !mwWidths.includes(w)); if (add != null) setMwSet([...mwWidths, add]); } else if (mwWidths.length > 2) setMwSet(mwWidths.slice(0, -1)); };
const setShare = (w, v) => setMwShares((s) => ({ ...s, [w]: Math.max(0, Math.round(Number(v) || 0)) }));
```
Import the new names at the top: add `redistributeShares, multiWidthBuild, multiWidthLineItems, STOCKED_WIDTHS` (STOCKED_WIDTHS is already imported; add the three new ones) to the `./sheoga.js` import.

- [ ] **Step 2: Render the Multi chip + multi-select in the Width sections**

In `FloorRail`, the Width section currently is:
```jsx
<Sect title="Width">
  <Chips cur={f.w} onPick={(w) => set({ ...f, w: +w })}
    items={floorWidths(f).map((w) => { const c = calcFloor({ ...f, w }, sf); return { id: w, label: WIDTH_LABEL[w], sub: c ? sell(c) : "—", dis: !c }; })} />
</Sect>
```
Pass new props from the popup into `FloorRail`/`StockedRail`: `multi, mwWidths, onMultiToggle, onMwWidth, mwStep`. Replace the Width section body with a helper that renders either single-select chips or multi-select checkboxes + the Multi chip. Add this shared component near `Chips`:
```jsx
function WidthRow({ items, cur, multi, selected, onPick, onToggle, onMultiToggle, onStep, count }) {
  return (<>
    <div className="flex flex-wrap gap-1.5 items-start">
      {items.map((it) => {
        const on = multi ? selected.includes(it.id) : it.id === cur;
        return (
          <button key={it.id} disabled={it.dis} onClick={() => (multi ? onToggle(it.id) : onPick(it.id))}
            className={`relative rounded-md border px-2.5 py-1.5 text-xs font-bold leading-tight text-center ${multi ? "pl-6" : ""} ${on ? "bg-slate-900 border-slate-900 text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"} ${it.dis ? "opacity-30 cursor-not-allowed line-through" : ""}`}>
            {multi && <span className={`absolute left-1.5 top-1/2 -translate-y-1/2 w-3 h-3 rounded-[3px] border ${on ? "bg-white/90 border-white/90 text-slate-900" : "border-slate-300"} flex items-center justify-center text-[8px] font-black`}>{on ? "✓" : ""}</span>}
            {it.label}{it.sub != null && !multi && <span className={`block text-[10px] font-semibold ${on ? "text-white/70" : "text-slate-400"}`}>{it.sub}</span>}
          </button>);
      })}
      <button onClick={onMultiToggle}
        className={`rounded-md border px-2.5 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 ${multi ? "text-white" : "text-[color:var(--ft-brand-deep)]"}`}
        style={multi ? { background: "var(--ft-brand)", borderColor: "var(--ft-brand)" } : { borderColor: "var(--ft-brand)", borderStyle: "dashed" }}>
        ◨ Multi{multi ? " ✓" : ""}
      </button>
    </div>
    {multi && (
      <div className="mt-2.5 rounded-lg p-3" style={{ border: "1px solid var(--ft-tint-border)", background: "var(--ft-tint)" }}>
        <div className="flex items-center gap-2.5">
          <span className="ft-eyebrow text-[10px]">Multi-width</span>
          <span className="text-[11px] font-semibold text-slate-500">How many widths?</span>
          <div className="inline-flex rounded-md border border-slate-300 overflow-hidden bg-white">
            <button onClick={() => onStep(-1)} className="w-7 h-7 text-base font-bold">−</button>
            <span className="w-8 text-center font-bold text-[13px] leading-7">{count}</span>
            <button onClick={() => onStep(1)} className="w-7 h-7 text-base font-bold">+</button>
          </div>
          <span className="ml-auto text-[10.5px] text-slate-400 font-medium">split ∝ width · editable →</span>
        </div>
        <div className="mt-1.5 text-[11px] text-slate-500 font-medium">Tick the widths above; job size splits proportionally to plank width. Adjust each share on the right.</div>
      </div>
    )}
  </>);
}
```
Use `WidthRow` in both `FloorRail` and `StockedRail`'s Width section, passing `items` built exactly as today (label + `sub` sell price + `dis`), `multi`, `selected={mwWidths}`, and the handlers.

- [ ] **Step 3: Verify in the harness**

Start the harness, open the configurator (floor tab), click **◨ Multi**: width chips become checkboxes with 3¼/4¼/5¼ ticked, the stepper appears. Tick 6¼ and confirm (via the next task's card, or temporarily log `mwShares`) that shares recompute. Switch to **Stocked prefinished**, confirm Multi works and unavailable widths are disabled. Screenshot.

- [ ] **Step 4: Commit**

```bash
git add src/SheogaConfigurator.jsx
git commit -m "Sheoga: multi-width entry — Multi chip, multi-select widths, count stepper (floor + stocked)"
```

---

## Task 9: `MultiWidthCard` — live split breakdown + add actions

**Files:**
- Modify: `src/SheogaConfigurator.jsx` (new `MultiWidthCard` component; render it in the desktop pane and mobile sheet in place of `BuildCard` when `multi` is on)

**Interfaces:**
- Consumes: `multiWidthBuild`, `sellOf`, `WIDTH_LABEL`, popup state `mwWidths`/`mwShares`/`sf`/`activeMarkup`, `setShare`, `multiWidthLineItems`.
- Produces: renders per-width rows (editable %, sf, sell, line), pooled fee lines, bundle total, and **Add bundle to basket** / **Add N lines to product line** buttons.

- [ ] **Step 1: Add the `MultiWidthCard` component**

Add near `BuildCard`:
```jsx
function MultiWidthCard({ base, widths, shares, sf, markup, onShare, onAddBasket, onMove, showActions = true }) {
  const wlist = widths.map((w) => ({ w, share: shares[w] ?? 0 }));
  const b = useMemo(() => multiWidthBuild(base, wlist, sf), [base, JSON.stringify(wlist), sf]);
  const ok = b.lines.filter((l) => l.ok);
  const linesTot = ok.reduce((a, l) => a + Math.round(sellOf(l.cost, markup) * l.sf), 0);
  const feesTot = b.fees.reduce((a, x) => a + x.amt, 0);
  const total = linesTot + feesTot;
  return (
    <div className="rounded-lg border overflow-hidden bg-white" style={{ borderColor: "var(--ft-grid-line)" }}>
      <div className="flex items-center gap-2 px-3.5 py-2" style={{ background: "var(--ft-sand)" }}>
        <span className="w-5 h-5 rounded text-[10px] font-extrabold text-white flex items-center justify-center" style={{ background: "var(--ft-brand-deep)" }}>H</span>
        <span className="text-[13px] font-extrabold flex-1">Multi-width — {base.cfg.sp} floor</span>
      </div>
      <div className="px-3.5 pt-2 pb-1 text-[9px] font-bold uppercase tracking-wider text-slate-400 flex">
        <span className="w-11">Width</span><span className="w-16">Share</span><span className="w-16">Sq ft</span><span className="w-14">Sell</span><span className="ml-auto">Line</span>
      </div>
      <div className="px-3.5">
        {b.lines.map((l) => (
          <div key={l.w} className={`flex items-center gap-2 py-1.5 border-t border-slate-100 ${l.ok ? "" : "opacity-40"}`}>
            <span className="w-11 font-extrabold text-[13px]">{WIDTH_LABEL[l.w]}</span>
            <span className="inline-flex items-center rounded-md border border-slate-300 overflow-hidden bg-white">
              <input type="number" min="0" max="100" value={shares[l.w] ?? 0} onChange={(e) => onShare(l.w, e.target.value)}
                className="w-11 px-1.5 py-1 text-xs font-bold text-right focus:outline-none" /><span className="px-1.5 text-[11px] font-bold text-slate-400">%</span>
            </span>
            <span className="w-16 text-[11px] font-semibold text-slate-500">{l.ok ? `${l.sf} sf` : "n/a"}</span>
            <span className="w-14 text-[11px] font-semibold text-slate-400">{l.ok ? fm(sellOf(l.cost, markup)) : "—"}</span>
            <span className="ml-auto font-extrabold tabular-nums text-[13px]">{l.ok ? fmInt(Math.round(sellOf(l.cost, markup) * l.sf)) : "—"}</span>
          </div>
        ))}
      </div>
      {b.fees.length > 0 && (
        <div className="px-3.5 py-2 border-t border-dashed border-slate-300">
          {b.fees.map((x, i) => (
            <div key={i} className="flex items-baseline gap-2 py-[2px] text-[11.5px] font-semibold" style={{ color: "var(--ft-brand-deep)" }}>
              <span className="flex-1">{x.label} — one line, shared across widths</span><span className="tabular-nums">+{fmInt(x.amt)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="flex items-center gap-4 px-3.5 py-2.5 border-t border-slate-300" style={{ background: "var(--ft-sand)" }}>
        <div className="leading-tight"><div className="ft-eyebrow text-[8.5px]">{ok.length} width lines</div><div className="text-base font-extrabold tabular-nums">{fmInt(linesTot)}</div></div>
        <div className="text-xs text-slate-400">+ pooled fees →</div>
        <div className="ml-auto text-right leading-tight"><div className="ft-eyebrow text-[8.5px]">bundle total · {sf} sq ft</div><div className="text-xl font-extrabold tabular-nums" style={{ color: "var(--ft-brand-deep)" }}>{fmInt(total)}</div></div>
      </div>
      {showActions && (
        <div className="flex gap-2 px-3.5 py-2.5 border-t border-slate-200">
          <button onClick={onAddBasket} disabled={!ok.length} className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5"><Plus size={13} /> Add bundle to basket</button>
          <button onClick={onMove} disabled={!ok.length} className="ml-auto rounded-md bg-indigo-600 text-white px-3.5 py-1.5 text-xs font-bold hover:bg-indigo-700 flex items-center gap-1.5"><Plus size={13} /> Add {ok.length} lines to product line</button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Render it when `multi` is on**

In the desktop pane and the mobile build sheet, when `multi && multiOk`, render `MultiWidthCard` instead of `BuildCard`:
```jsx
{multi && multiOk ? (
  <MultiWidthCard base={{ mode, cfg }} widths={mwWidths} shares={mwShares} sf={sf} markup={activeMarkup} onShare={setShare}
    onAddBasket={() => addBundleToBasket()} onMove={() => moveBundleToLine()} />
) : (!c ? (<div className="rounded-lg border border-slate-300 bg-white p-5 text-sm text-slate-400">This combination isn't offered — pick an available width.</div>) : (
  <BuildCard ... /> // unchanged
))}
```
Add the two handlers in the popup component:
```jsx
const addBundleToBasket = () => {
  const entry = { id: undefined, kind: "bundle", addedAt: Date.now(), markupPct: activeMarkup, base: { mode, cfg: JSON.parse(JSON.stringify(cfg)) }, widths: mwWidths.map((w) => ({ w, share: mwShares[w] ?? 0 })), sf };
  onBasketChange([...(basket || []), normBasketEntry(entry)].filter(Boolean));
  setBasketOpen(true);
};
const moveBundleToLine = () => { onMove(multiWidthLineItems({ mode, cfg }, mwWidths.map((w) => ({ w, share: mwShares[w] ?? 0 })), sf, activeMarkup)); onClose(); };
```
Import `normBasketEntry` in the file's `./sheoga.js` import.

- [ ] **Step 3: Verify in the harness**

Open the configurator, enable Multi, edit a % and watch sf/line/bundle totals recompute live; add/remove a width and watch shares rebalance. Click **Add bundle to basket** (basket count increments), and **Add N lines to product line** (harness shows the payload rows: N hardwood + pooled misc). Repeat on the Stocked tab. Screenshots (desktop + the recompute).

- [ ] **Step 4: Commit**

```bash
git add src/SheogaConfigurator.jsx
git commit -m "Sheoga: MultiWidthCard — live split, pooled fees, add-to-basket / add-to-line"
```

---

## Task 10: Basket button + drawer (desktop) / sheet (mobile)

**Files:**
- Modify: `src/SheogaConfigurator.jsx` (basket button in header, `BasketPanel` component, add-to-basket on single builds, wiring)

**Interfaces:**
- Consumes: props `basket`, `onBasketChange`, `areaName`, `onMove`; `lineItems`, `multiWidthLineItems`, `calcConfig`, `sellOf`.
- Produces: a basket drawer (desktop, slides from right; mobile, bottom sheet) with per-item checkbox, remove, and Move actions; **Add to basket** on the single build card.

- [ ] **Step 1: Add basket state + header button**

In the popup component:
```jsx
const [basketOpen, setBasketOpen] = useState(false);
const [sel, setSel] = useState({}); // id -> selected
const selIds = (basket || []).filter((b) => sel[b.id]).map((b) => b.id);
```
In the `header`, before the close button, add:
```jsx
<button onClick={() => setBasketOpen(true)} className="relative inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold hover:bg-slate-50">
  🧺 Basket{(basket || []).length > 0 && <span className="rounded-full bg-[color:var(--ft-brand)] text-white text-[11px] font-extrabold min-w-[18px] h-[18px] px-1 flex items-center justify-center">{basket.length}</span>}
</button>
```

- [ ] **Step 2: Add "Add to basket" on the single build**

Add a handler and wire it into `BuildCard`'s actions (and the mobile sheet footer) next to Add-to-line:
```jsx
const addSingleToBasket = () => {
  const entry = normBasketEntry({ kind: "single", addedAt: Date.now(), markupPct: activeMarkup, snap: { mode, cfg: JSON.parse(JSON.stringify(cfg)) }, sf });
  if (entry) { onBasketChange([...(basket || []), entry]); setBasketOpen(true); }
};
```
Pass `onAddBasket={addSingleToBasket}` into `BuildCard` and render a secondary button `＋ Add to basket` beside the existing Add-to-line button.

- [ ] **Step 3: Add the `BasketPanel` component**

```jsx
function basketEntryView(entry) {
  if (entry.kind === "bundle") {
    const b = multiWidthBuild(entry.base, entry.widths, entry.sf);
    const ok = b.lines.filter((l) => l.ok);
    const linesTot = ok.reduce((a, l) => a + Math.round(sellOf(l.cost, entry.markupPct) * l.sf), 0);
    const feesTot = b.fees.reduce((a, x) => a + x.amt, 0);
    return { title: `${entry.base.cfg.sp} — multi-width (${ok.length} widths)`, meta: `${entry.sf} sf total · one job`, price: linesTot + feesTot,
      subs: ok.map((l) => ({ label: `${WIDTH_LABEL[l.w]} · ${l.sf} sf`, amt: Math.round(sellOf(l.cost, entry.markupPct) * l.sf) })),
      fees: b.fees.map((x) => ({ label: x.label, amt: x.amt })), lines: () => multiWidthLineItems(entry.base, entry.widths, entry.sf, entry.markupPct) };
  }
  const c = calcConfig(entry.snap, entry.sf);
  const isEa = c && c.per === "ea";
  const price = c ? Math.round(sellOf(c.cost, entry.markupPct) * (isEa ? (c.qty || 1) : entry.sf)) : 0;
  return { title: `${c ? (c.size ? c.size + " " : "") + (c.rest || c.desc) : "build"}`, meta: isEa ? `${c?.qty || 1} pcs` : `${entry.sf} sf`, price, subs: [], fees: [], lines: () => lineItems(entry.snap, { sf: entry.sf, markupPct: entry.markupPct }) };
}

function BasketPanel({ basket, sel, onToggle, onRemove, onSelectAll, onMove, onMoveAll, areaName, onClose, isWide }) {
  const n = basket.length, selCount = basket.filter((b) => sel[b.id]).length;
  return (
    <div className="flex flex-col h-full">
      {!isWide && <div className="mx-auto mt-2 h-1.5 w-10 rounded-full shrink-0" style={{ background: "var(--ft-border-strong, rgba(28,26,23,.25))" }} onClick={onClose} />}
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200">
        <span className="text-sm font-extrabold">Basket</span>
        <span className="text-[11px] text-slate-400 font-semibold">{n} item{n === 1 ? "" : "s"} · saved with this job</span>
        <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {n === 0 ? <div className="text-center text-xs font-semibold text-slate-400 py-10">Basket is empty. Build a config and “Add to basket”.</div> :
          basket.map((entry) => { const v = basketEntryView(entry); const on = !!sel[entry.id]; return (
            <div key={entry.id} className={`flex gap-2.5 items-start rounded-lg border p-2.5 mb-2 ${on ? "border-[color:var(--ft-brand)]" : "border-slate-200"}`}>
              <button onClick={() => onToggle(entry.id)} className={`w-[18px] h-[18px] mt-0.5 rounded-[5px] border flex items-center justify-center text-[11px] font-black text-white shrink-0 ${on ? "bg-[color:var(--ft-brand)] border-[color:var(--ft-brand)]" : "border-slate-300"}`}>{on ? "✓" : ""}</button>
              <div className="flex-1 min-w-0">
                {entry.kind === "bundle" && <span className="inline-block text-[9px] font-extrabold uppercase tracking-wide text-[color:var(--ft-brand-deep)] mb-1">Multi-width bundle</span>}
                <div className="text-[13px] font-bold leading-tight">{v.title}</div>
                <div className="text-[11px] text-slate-500 font-semibold">{v.meta}</div>
                {v.subs.map((s, i) => <div key={i} className="flex text-[11px] text-slate-500 font-semibold pt-0.5"><span>{s.label}</span><span className="ml-auto font-bold text-slate-700">{fmInt(s.amt)}</span></div>)}
                {v.fees.map((s, i) => <div key={i} className="flex text-[11px] font-semibold pt-0.5" style={{ color: "var(--ft-brand-deep)" }}><span>{s.label}</span><span className="ml-auto">+{fmInt(s.amt)}</span></div>)}
              </div>
              <div className="flex flex-col items-end gap-1.5"><span className="font-extrabold tabular-nums text-[13px]">{fmInt(v.price)}</span><button onClick={() => onRemove(entry.id)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button></div>
            </div>); })}
        {n > 0 && <div className="text-center pt-1"><button onClick={onSelectAll} className="text-[11px] font-bold underline underline-offset-2" style={{ color: "var(--ft-brand-deep)" }}>{selCount === n ? "Clear selection" : "Select all"}</button></div>}
      </div>
      <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-200">
        <span className="text-[11px] text-slate-500 font-semibold">{selCount} selected → <b>{areaName}</b></span>
        <button disabled={!n} onClick={onMoveAll} className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold disabled:opacity-40">Move all</button>
        <button disabled={!selCount} onClick={onMove} className="rounded-md bg-indigo-600 text-white px-3.5 py-1.5 text-xs font-bold disabled:opacity-40">Move {selCount} → {areaName}</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Mount the panel (drawer desktop / sheet mobile) + wire move/remove**

Add handlers to the popup component:
```jsx
const toggleSel = (id) => setSel((s) => ({ ...s, [id]: !s[id] }));
const selectAll = () => { const all = (basket || []).every((b) => sel[b.id]); const next = {}; (basket || []).forEach((b) => { next[b.id] = !all; }); setSel(next); };
const removeEntry = (id) => onBasketChange((basket || []).filter((b) => b.id !== id));
const moveEntries = (entries) => { entries.forEach((e) => onMove(basketEntryView(e).lines())); onBasketChange((basket || []).filter((b) => !entries.includes(b))); setSel({}); };
const moveSelected = () => moveEntries((basket || []).filter((b) => sel[b.id]));
const moveAll = () => moveEntries([...(basket || [])]);
```
Desktop — inside the popup shell, after the footer, add a scrim + right drawer:
```jsx
{isWide && (<>
  <div className={`absolute inset-0 z-[55] transition-opacity ${basketOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} style={{ background: "rgba(20,15,10,.4)" }} onClick={() => setBasketOpen(false)} />
  <div className={`absolute top-0 right-0 bottom-0 z-[56] w-[400px] bg-white border-l border-slate-300 shadow-2xl transition-transform ${basketOpen ? "translate-x-0" : "translate-x-full"}`}>
    <BasketPanel basket={basket || []} sel={sel} onToggle={toggleSel} onRemove={removeEntry} onSelectAll={selectAll} onMove={moveSelected} onMoveAll={moveAll} areaName={areaName} onClose={() => setBasketOpen(false)} isWide />
  </div>
</>)}
```
Mobile — reuse `MobileBuildSheet` for the basket:
```jsx
{!isWide && (
  <MobileBuildSheet open={basketOpen} onClose={() => setBasketOpen(false)}>
    <BasketPanel basket={basket || []} sel={sel} onToggle={toggleSel} onRemove={removeEntry} onSelectAll={selectAll} onMove={moveSelected} onMoveAll={moveAll} areaName={areaName} onClose={() => setBasketOpen(false)} isWide={false} />
  </MobileBuildSheet>
)}
```
Extend the Escape handler so it closes the basket first: in the existing `onKey` effect, add `else if (basketOpen) setBasketOpen(false)` before the `onClose()` branch, and add `basketOpen` to its dependency array.

- [ ] **Step 5: Verify in the harness (desktop + mobile)**

Desktop: add a single build and a multi-width bundle to the basket; open the drawer; the bundle shows sub-lines + pooled fees; select one, **Move 1 → Kitchen** (harness shows payloads and the item leaves the basket). Mobile: switch the harness viewport (`resize_window` mobile), confirm the basket rises as a bottom sheet and Move works. Screenshots of both.

- [ ] **Step 6: Commit**

```bash
git add src/SheogaConfigurator.jsx
git commit -m "Sheoga: shopping basket — drawer/sheet, add/remove/select, move to product line"
```

---

## Task 11: Full-run verification + PR

- [ ] **Step 1: Run the whole suite**

Run: `npm test 2>&1 | tail -6`
Expected: all pass (previous 422 + the new sheoga tests).

- [ ] **Step 2: Build**

Run: `npm run build 2>&1 | tail -3`
Expected: built with no errors.

- [ ] **Step 3: End-to-end harness pass**

In the harness, walk the full flow on both tabs: single add → basket → move; multi-width build → dynamic split → add bundle → move; confirm rail 2-row species + no helper line. Capture the proof screenshots.

- [ ] **Step 4: Open the PR**

```bash
git push -u origin <branch>
gh pr create --title "Sheoga configurator: shopping basket + multi-width floors" --body "<summary + screenshots + 'runs supabase/ nothing; basket lives in existing jsonb'>"
```

---

## Self-review (completed)

- **Spec coverage:** basket persistence (Tasks 6,7,10) · slide-out drawer/bottom sheet (Task 10) · add-to-basket + add-to-line both kept (Tasks 9,10) · multi-width entry from Width row (Task 8) · width-proportional dynamic split (Tasks 2,8) · pooled floor fees (Task 3) · pooled stocked sheen fee + width availability (Task 4) · line payloads both modes (Task 5) · rail width/gutter + copy removal (Task 1) · move targets the active area (Tasks 7,10). All spec sections map to a task.
- **Placeholder scan:** none — every code step carries full code; PR body text is the only intentional fill-in.
- **Type consistency:** `multiWidthBuild` line shape (`{w,share,sf,cost,size,rest,cartonSf,ok}`), `BasketEntry` single/bundle shapes, and `multiWidthLineItems`/`lineItems` payload shape are used identically across Tasks 3–10.
