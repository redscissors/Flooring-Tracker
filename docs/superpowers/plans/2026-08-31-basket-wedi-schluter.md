# Basket Panels for wedi + Schluter (ADR 0035 step 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the wedi and Schluter configurators the same basket panel Sheoga got in step 2 — a persisted staged basket ("add to basket" without landing) plus the derived "In this project" section (every placed kit listed live off its anchor marker, with Reconfigure and two-click Remove) — and fix the reconfigure-current-kit no-op (deferred papercut 1) with a pop-state nonce.

**Architecture:** Staged entries persist as new per-project arrays (`wediBasket`, `schluterBasket`) normalized by ONE engine-free `normKitBasketEntry` in model.js — model.js must NEVER import wedi.js or schluter.js (they'd land their ~2,000-row tables on the boot path; the sheoga.js import normC already carries is grandfathered, not a precedent). An entry snapshots exactly what a saved row's Reconfigure marker carries — `snap: { mode, cfg }` — so each engine gains a pure `buildFromMarker` that re-derives the billed kit from a marker, and the drawer prices staged and placed kits identically through the popup's own tier lens. Placed kits derive from `placedKits(categories, "wedi"|"schluter")` (already vendor-generic, step 2). The panel shell is ONE shared presentation-only component (`KitBasketPanel`, widgets.jsx — the SourceSwitch doctrine: two popups can't drift on a shared control); each popup feeds it pre-priced view rows.

**Tech Stack:** React 18 + Vite 5, plain `node --test` for pure modules, Playwright + pre-installed Chromium for preview screenshots.

**Spec:** `docs/adr/0035-configurator-kit-instance-id.md` (binding; its second paragraph defines steps 2–3: only unplaced entries persist, placed kits derive from anchor markers, delete-on-move stands). Design notes settled with the owner: `.scratch/handoffs/basket-step3-2026-08-29.md`. Step-2 reference implementation: `docs/superpowers/plans/2026-08-29-basket-derived-kits.md` + the Sheoga drawer (`BasketPanel` in SheogaConfigurator.jsx).

## Global Constraints

- NEVER touch the live Supabase project — no SQL, no data/storage writes. There is no schema change in this plan (baskets ride the customers row's jsonb); if you think you need one, STOP and report BLOCKED.
- NEVER push to `main`. Commit on the current branch `claude/pr-345-merge-monitoring-qvv3r1` only; never `git push` at all (the controller pushes).
- Boot hygiene (ADR 0026): model.js, App.jsx and anything else on the boot path must never import wedi.js, schluter.js, schluteradapter.js, or the configurator .jsx files outside the existing `React.lazy` boundaries.
- Snapshot doctrine (ADR 0003/0018): landed rows are price snapshots; nothing here reprices a saved row outside an explicit re-land through `landKitLines`. Drawer prices are display-only live derivations (the step-2 doctrine).
- Write-path conventions (root CLAUDE.md): customer mutations only through `updateProject` patches built by pure model.js functions.
- Comments: rare, only for non-obvious business rules. Match surrounding idiom.
- Tests run with `node --test src/<file>.test.js` (full suite: `npm test`, baseline 1194 passing). TDD: write the failing test, watch it fail, implement, watch it pass. Every task ends with the FULL suite green.
- `npm run lint` has 8 pre-existing errors and `npm run build` fails on a pre-existing index.html issue — do not fix those, do not add NEW lint errors in files you touch.

---

### Task 1: Persisted staged baskets (model.js + data-model skill)

**Files:**
- Modify: `src/model.js` (`newProject` ~line 88, `normC` ~line 118; add `normKitBasketEntry` near the ADR 0035 section)
- Modify: `.claude/skills/floortrack-data-model/SKILL.md` (Customer shape note, exact text below)
- Test: `src/model.test.js`

**Interfaces:**
- Produces (Tasks 4–5 rely on these):
  - `export const normKitBasketEntry = (e) => entry | null` — entry shape `{ id: string, kind: "kit", addedAt: number, snap: { mode: string, cfg: object } }`. Null for anything without an object `snap.cfg`. NO engine knowledge — cfg validity is the engine's business at render time.
  - `normC` output gains `wediBasket: entry[]` and `schluterBasket: entry[]` (junk filtered, absent → `[]`); `newProject` seeds both `[]`.

- [ ] **Step 1: Write the failing tests**

Append to `src/model.test.js` (add `normKitBasketEntry` to the model.js import at the top):

```js
test("normKitBasketEntry: fills defaults, rejects junk (ADR 0035 step 3)", () => {
  const e = normKitBasketEntry({ snap: { mode: "custom", cfg: { panKey: "X" } } });
  assert.ok(e.id);
  assert.ok(e.addedAt > 0);
  assert.equal(e.kind, "kit");
  assert.deepEqual(e.snap, { mode: "custom", cfg: { panKey: "X" } });
  const kept = normKitBasketEntry({ id: "bk1", addedAt: 5, snap: { mode: "kit", cfg: {} } });
  assert.equal(kept.id, "bk1");
  assert.equal(kept.addedAt, 5);
  for (const junk of [null, 7, "x", {}, { snap: null }, { snap: {} }, { snap: { cfg: "nope" } }])
    assert.equal(normKitBasketEntry(junk), null, JSON.stringify(junk));
});

test("normC: wediBasket/schluterBasket normalize, drop junk, default empty (ADR 0035 step 3)", () => {
  const c = normC({ id: "c1", name: "X", wediBasket: [{ snap: { mode: "kit", cfg: { panKey: "P" } } }, { bad: true }], schluterBasket: "junk" });
  assert.equal(c.wediBasket.length, 1);
  assert.equal(c.wediBasket[0].snap.cfg.panKey, "P");
  assert.deepEqual(c.schluterBasket, []);
  assert.deepEqual(normC({ id: "c2", name: "Y" }).wediBasket, []);
  const p = newProject();
  assert.deepEqual(p.wediBasket, []);
  assert.deepEqual(p.schluterBasket, []);
});
```

(`schluterBasket: "junk"`: `(("junk") || [])` is a string — the implementation must coerce a non-array to `[]`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/model.test.js`
Expected: both fail — `normKitBasketEntry` is not exported. Pre-existing tests pass.

- [ ] **Step 3: Implement**

In `src/model.js`:

1. Above the `// --- configurator kit landing (ADR 0035)` section add:

```js
// One staged wedi/Schluter basket entry (ADR 0035 step 3): the snap IS the
// reconfigure marker shape ({ mode, cfg }), so a move re-lands through the
// engine exactly like a Reconfigure would. Engine-free on purpose — model.js
// must never import wedi.js/schluter.js (boot path); junk cfgs price as a
// faint row in the drawer instead of crashing here.
export const normKitBasketEntry = (e) => {
  if (!e || typeof e !== "object" || !e.snap || typeof e.snap !== "object" || !e.snap.cfg || typeof e.snap.cfg !== "object") return null;
  return { id: e.id || uid(), kind: "kit", addedAt: e.addedAt || Date.now(), snap: { mode: typeof e.snap.mode === "string" ? e.snap.mode : "custom", cfg: e.snap.cfg } };
};
const normKitBasket = (v) => (Array.isArray(v) ? v.map(normKitBasketEntry).filter(Boolean) : []);
```

2. In `newProject`, after `sheogaBasket: [],` add `wediBasket: [], schluterBasket: [],`.

3. In `normC`, after `sheogaBasket: (...)...,` add `wediBasket: normKitBasket(c.wediBasket), schluterBasket: normKitBasket(c.schluterBasket),`.

4. In `.claude/skills/floortrack-data-model/SKILL.md`, in the `Customer {` block, directly after the `optionNames: {A?..L?} }` line's comment block ends (before `Area     {`), the Customer shape line must gain the two fields. Change the line
`           optionNames: {A?..L?} }   // optionNames = quote-option labels (ADR 0031; slots A–L since 2026-08-26)`
to
`           optionNames: {A?..L?},   // optionNames = quote-option labels (ADR 0031; slots A–L since 2026-08-26)`
`           sheogaBasket: [], wediBasket: [], schluterBasket: [] }`
and append to that comment block (after the salesperson note):

```
           // *Basket = the configurators' STAGED (unplaced) kit entries
           // (ADR 0035 steps 2–3) — the only basket state that persists;
           // placed kits always derive from the anchor markers (placedKits).
           // Sheoga entries: sheoga.js normBasketEntry (single | bundle).
           // wedi/Schluter entries: model.js normKitBasketEntry —
           // { id, kind: "kit", addedAt, snap: { mode, cfg } }, the snap
           // being exactly the row marker Reconfigure reopens on.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/model.test.js` then `npm test`
Expected: all pass (1194 + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/model.js src/model.test.js .claude/skills/floortrack-data-model/SKILL.md
git commit -m "Persist wedi/Schluter staged baskets on the project (ADR 0035 step 3)"
```

---

### Task 2: `buildFromMarker` (wedi.js)

**Files:**
- Modify: `src/wedi.js` (add after `kitFor`, ~line 5181)
- Test: `src/wedi.test.js`

**Interfaces:**
- Consumes: existing `kitFor(panKey, opts)`, `solve(input)`, `item(key)`.
- Produces (Task 4 relies on this exact signature): `export function buildFromMarker(marker)` — `marker` is `{ mode, cfg }` (a saved row's `product.wedi` marker or a staged entry's `snap`); returns the same build object `kitFor` returns (so `lineItems(build, …)` and per-line tier pricing work on it), or `null` when the cfg names no known pan. No qtyOv/manual: the marker never carried them — a rebuilt kit is exactly what Reconfigure restores, the standing wedi rule.

- [ ] **Step 1: Write the failing tests**

Append to `src/wedi.test.js` (add `buildFromMarker` to the wedi.js import; `pans` and `kitFor` and `solve` are already imported there — add any that aren't):

```js
test("buildFromMarker: a kit marker round-trips to the same bill (ADR 0035 step 3)", () => {
  const pan = pans().find((p) => p.group === "fundo") || pans()[0];
  const b1 = kitFor(pan.key, {});
  const b2 = buildFromMarker({ mode: b1.mode, cfg: b1.cfg });
  assert.ok(b2);
  const bill = (b) => b.lines.map((l) => l.item.key + "×" + l.qty);
  assert.deepEqual(bill(b2), bill(b1));
  assert.deepEqual(b2.cfg, b1.cfg, "the cfg itself is stable across the round trip");
});

test("buildFromMarker: a custom (solved) marker re-solves and honors the option id", () => {
  const input = { w: 40, d: 62, curb: "curbed", drain: "center" };
  const res = solve({ ...input, tolerance: 0.51, anchor: "left" });
  assert.ok(res.length > 1, "the test needs a room with several options");
  const opt = res[1];
  const b1 = kitFor(opt.pan.key, { option: opt, room: opt.room, mode: "custom" });
  const b2 = buildFromMarker({ mode: "custom", cfg: b1.cfg });
  assert.ok(b2);
  assert.deepEqual(b2.lines.map((l) => l.item.key + "×" + l.qty), b1.lines.map((l) => l.item.key + "×" + l.qty));
});

test("buildFromMarker: junk is null, never a throw", () => {
  assert.equal(buildFromMarker(null), null);
  assert.equal(buildFromMarker({ mode: "kit", cfg: {} }), null);
  assert.equal(buildFromMarker({ mode: "kit", cfg: { panKey: "no-such-pan" } }), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/wedi.test.js`
Expected: fail at import (`buildFromMarker` not exported). Pre-existing tests pass.

- [ ] **Step 3: Implement**

Add after `kitFor` in `src/wedi.js`:

```js
// Re-derive the billed kit from a saved marker / staged basket entry
// ({ mode, cfg } — cfg from kitFor). The drawer's staged and placed kits both
// price through this, so a kit reads the same before and after it lands. A
// custom cfg re-runs the solver and re-picks its option by id (the seedState
// doctrine); qtyOv/manual never rode the cfg, so a rebuilt kit is exactly
// what Reconfigure restores. Null when the catalog no longer knows the pan.
export function buildFromMarker(marker) {
  const cfg = marker && marker.cfg;
  if (!cfg || !cfg.panKey || !item(cfg.panKey)) return null;
  let option = null;
  if (cfg.solve && cfg.solve.input) {
    const res = solve({ tolerance: 0.51, anchor: "left", ...cfg.solve.input });
    option = res.find((o) => o.id === cfg.solve.id) || res[0] || null;
  }
  return kitFor(cfg.panKey, {
    option: option || undefined,
    room: cfg.room || undefined,
    walls: cfg.walls && cfg.walls.length ? cfg.walls.map((w) => ({ ...w })) : undefined,
    wallHeight: cfg.walls && cfg.walls[0] ? +cfg.walls[0].h : undefined,
    panelKey: cfg.panelKey || undefined,
    curbKey: cfg.curbKey, coverKey: cfg.coverKey || undefined,
    coverFrame: cfg.coverFrame || undefined,
    sealantForm: cfg.sealantForm, recess: cfg.recess,
    addons: (cfg.addons || []).slice(), benches: (cfg.benches || []).map((b) => ({ ...b })),
    corners: (cfg.corners || []).slice(),
    maxIn: !!cfg.maxIn, tileT: cfg.tileT, tier: cfg.tier,
    mode: marker.mode || undefined,
  });
}
```

Notes for the implementer:
- `cfg.curbKey` passes through VERBATIM (it is the RESOLVED key or `null`; only `undefined` triggers kitFor's family default — that distinction is the whole reason not to write `cfg.curbKey || undefined`).
- If the round-trip test fails on the bill: diff `b1.cfg` against `b2.cfg` first — a key that changes across the trip means an opts field above is mapped wrong. Fix the mapping; do NOT change `kitFor`.
- If it fails on walls (`wallSf`/`curbRuns` disagree): kitFor's own `cfgWalls` output (`{ len, h, side, extra?, at?, hi?, faces? }`) is what this feeds back in; check which wall keys `expandWallFaces`/`curbRuns` read and map accordingly inside `buildFromMarker` (never by editing kitFor).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/wedi.test.js` then `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/wedi.js src/wedi.test.js
git commit -m "wedi buildFromMarker: re-derive a kit's bill from its marker (ADR 0035 step 3)"
```

---

### Task 3: `buildFromMarker` (schluter.js)

**Files:**
- Modify: `src/schluter.js` (add after `buildKit`)
- Test: `src/schluter.test.js`

**Interfaces:**
- Consumes: existing `trayCandidates(cfg, cat, { source })`, `buildKit(cfg, cat, { source, pick })`.
- Produces (Task 5 relies on this): `export function buildFromMarker(marker, cat)` — `marker` is `{ mode, cfg }` where cfg is the popup's `markCfg` (carries `manual`, `source`, `pick` too); returns `{ ...buildKit(...), pick }` with `cfg.manual` extras appended as `{ g: "Extras", item, qty, so, manual: true }` lines, or `null` when there's no room, no catalog rows, or no candidate. The caller applies its own board Fit plan and tier lens (both live in the popup).

- [ ] **Step 1: Write the failing tests**

Append to `src/schluter.test.js` (it already builds a catalog from `schluterfixture.js` — reuse the same `cat` the existing `buildKit` tests use; add `buildFromMarker` to the import):

```js
test("buildFromMarker: a marker round-trips to the same bill and honors the picked tray (ADR 0035 step 3)", () => {
  const cfg = { w: 38, d: 60, curbed: true, drain: "center", wallSys: "membrane", walls: [{ name: "Back", on: true, len: 38, h: 96 }, { name: "Left", on: true, len: 60, h: 96 }, { name: "Right", on: true, len: 60, h: 96 }] };
  const cands = trayCandidates(cfg, cat, { source: "all" });
  assert.ok(cands.length > 1, "the test needs several candidates");
  const pick = cands[1];
  const b1 = buildKit(cfg, cat, { source: "all", pick });
  const marker = { mode: "custom", cfg: { ...cfg, manual: [], source: "all", pick: pick.tray.sku } };
  const b2 = buildFromMarker(marker, cat);
  assert.ok(b2);
  const bill = (b) => b.lines.filter((l) => !l.noteOnly).map((l) => (l.item.sku || l.item.name) + "×" + l.qty);
  assert.deepEqual(bill(b2), bill(b1));
  assert.equal(b2.pick.tray.sku, pick.tray.sku, "the quoted tray stays picked, not whatever ranks first");
});

test("buildFromMarker: cfg.manual extras land as Extras lines; a stale pick falls back to rank 1", () => {
  const extra = cat.find((e) => e.g === "membrane" && e.sku);
  const cfg = { w: 38, d: 60, curbed: true, drain: "center", wallSys: "membrane", walls: [{ name: "Back", on: true, len: 38, h: 96 }], manual: [{ sku: extra.sku, qty: 2 }], source: "all", pick: "no-such-sku" };
  const b = buildFromMarker({ mode: "custom", cfg }, cat);
  assert.ok(b);
  const m = b.lines.find((l) => l.manual);
  assert.ok(m, "the manual extra rides the rebuilt bill");
  assert.equal(m.qty, 2);
  assert.ok(b.pick, "an unknown pick falls back to the top candidate");
});

test("buildFromMarker: no room, no catalog, junk — all null, never a throw", () => {
  assert.equal(buildFromMarker(null, cat), null);
  assert.equal(buildFromMarker({ mode: "kit", cfg: { w: 0, d: 60 } }, cat), null);
  assert.equal(buildFromMarker({ mode: "kit", cfg: { w: 38, d: 60, curbed: true, drain: "center", wallSys: "membrane", walls: [] } }, []), null);
});
```

Adjust the `walls` literals and the `extra` lookup to the fixture's real shape if the existing tests build cfgs differently — copy a WORKING cfg from a neighboring `buildKit` test rather than inventing one; the assertions above are what matters.

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/schluter.test.js`
Expected: fail at import. Pre-existing tests pass.

- [ ] **Step 3: Implement**

Add after `buildKit` in `src/schluter.js`:

```js
// Re-derive the billed kit from a saved marker / staged basket entry
// ({ mode, cfg } — cfg is the popup's markCfg, so it carries manual/source/
// pick too). The basket drawer prices staged and placed kits through this;
// the caller owns the board Fit plan and the tier lens. cfg.pick keeps the
// QUOTED tray picked (the markCfg doctrine — never whatever ranks first
// today); a pick the catalog no longer knows falls back to rank 1. Null when
// there's no room, no rows, or nothing fits.
export function buildFromMarker(marker, cat) {
  const cfg = marker && marker.cfg;
  if (!cfg || !(cfg.w > 0 && cfg.d > 0) || !(cat || []).length) return null;
  const source = cfg.source === "stock" ? "stock" : "all";
  const cands = trayCandidates(cfg, cat, { source });
  const pick = (cfg.pick && cands.find((c) => c.tray && c.tray.sku === cfg.pick)) || cands[0] || null;
  if (!pick) return null;
  const b = buildKit(cfg, cat, { source, pick });
  (cfg.manual || []).forEach((m) => {
    const e = cat.find((i) => i.sku === m.sku);
    if (e && m.qty > 0) b.lines.push({ g: "Extras", item: e, qty: m.qty, so: !e.stock, manual: true });
  });
  return { ...b, pick };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/schluter.test.js` then `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/schluter.js src/schluter.test.js
git commit -m "Schluter buildFromMarker: re-derive a kit's bill from its marker (ADR 0035 step 3)"
```

---

### Task 4: The shared drawer shell (widgets.jsx) + wedi basket UI + App/hub wiring + the reconfigure nonce

**Files:**
- Modify: `src/widgets.jsx` (add `KitBasketPanel`)
- Modify: `src/WediConfigurator.jsx` (imports; component props ~line 557; esc ladder ~line 708; basket state + views; pop-head ~line 2360; build column Add row ~line 1880; shell className + drawer mount ~line 2352)
- Modify: `src/App.jsx` (wedi mount ~line 2791; sheoga mount key ~line 2762; `appendSheogaLines` ~line 808)
- Modify: `src/AppsWorkspace.jsx` (hub wedi mount ~line 476; basket state ~line 131; commit path ~line 142)

**Interfaces:**
- Consumes: Task 1's entry shape + `normKitBasketEntry`; Task 2's `buildFromMarker(marker)`; existing `placedKits`/`removeKitLines`/`stampKit` (model.js), `lineItems`, `round2` (wedi.js), `useEscClose` (widgets.jsx).
- Produces:
  - `export function KitBasketPanel({ title = "Basket", staged, sel, onToggle, onSelectAll, onRemove, onMove, onMoveAll, placed, onEditPlaced, onDeletePlaced, areaName, onClose, tierColor, emptyText })` in widgets.jsx — presentation only, NO engine knowledge. `staged` rows: `{ id, title, meta, price, faint? }`; `placed` rows: `{ rowId, title, meta, areaName, price, faint? }`. `price: null` renders an em-dash. `faint` renders the row at 60% opacity (the Schluter catalog-loading state). The Move footer renders only when `onMove` is given (the hub passes it too; a popup with no landing target omits it).
  - WediConfigurator props (Task 6's harness passes these): `basket`, `onBasketChange(next)`, `onMoveEntries(lines, nextBasket)`, `placed`, `onOpenPlaced(k)`, `onDeleteKit(k)` — the Sheoga contract, minus onMove (wedi's Add already lands).
- Rules bound here:
  - Delete-on-move stands (ADR 0035): a moved staged entry leaves the basket in the SAME updateProject patch that lands its lines.
  - Each moved entry is its own kit: stamp per entry BEFORE flattening (`entries.flatMap((v) => stampKit(v.lines()))` — the Sheoga moveBasketEntries rule).
  - The nonce (deferred papercut 1, fixed here for ALL THREE pops): reconfiguring the kit the popup is currently open on must remount, so every pop's `key` becomes `pid + ":" + (n || 0)` and `onOpenPlaced` bumps `n`.

- [ ] **Step 1: `KitBasketPanel` in widgets.jsx**

Add (near SourceSwitch; import `X` from lucide-react is already there — check, else add it; `useState` likewise):

```jsx
// The wedi/Schluter basket drawer shell (ADR 0035 step 3) — one shared
// presentation component so the two popups can't drift (the SourceSwitch
// doctrine). Engine-free: callers hand it pre-priced view rows. Staged rows
// carry checkboxes + Move (delete-on-move rides the caller's patch); placed
// rows carry Reconfigure + the armed two-click Remove (the Sheoga idiom).
const fmt$ = (n) => (n == null ? "—" : "$" + Math.round(n).toLocaleString());
export function KitBasketPanel({ title = "Basket", staged = [], sel = {}, onToggle, onSelectAll, onRemove, onMove, onMoveAll, placed = [], onEditPlaced, onDeletePlaced, areaName, onClose, tierColor, emptyText = 'Basket is empty. Build a kit and "Add to basket".' }) {
  const n = staged.length, selCount = staged.filter((b) => sel[b.id]).length;
  const [armDel, setArmDel] = useState(null);
  return (
    <div className="flex flex-col h-full" data-kit-basket>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-200">
        <span className="text-sm font-extrabold">{title}</span>
        <span className="text-[11px] text-slate-400 font-semibold">{n} staged · saved with this job</span>
        <button onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-600"><X size={16} /></button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        {n === 0 && !placed.length ? <div className="text-center text-xs font-semibold text-slate-400 py-10">{emptyText}</div> :
          staged.map((v) => { const on = !!sel[v.id]; return (
            <div key={v.id} className={`flex gap-2.5 items-start rounded-lg border p-2.5 mb-2 ${on ? "border-[color:var(--ft-brand)]" : "border-slate-200"} ${v.faint ? "opacity-60" : ""}`}>
              <button onClick={() => onToggle(v.id)} className={`w-[18px] h-[18px] mt-0.5 rounded-[5px] border flex items-center justify-center text-[11px] font-black text-white shrink-0 ${on ? "bg-[color:var(--ft-brand)] border-[color:var(--ft-brand)]" : "border-slate-300"}`}>{on ? "✓" : ""}</button>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-bold leading-tight">{v.title}</div>
                <div className="text-[11px] text-slate-500 font-semibold">{v.meta}</div>
              </div>
              <div className="flex flex-col items-end gap-1.5"><span className="font-extrabold tabular-nums text-[13px]" style={tierColor ? { color: tierColor } : undefined}>{fmt$(v.price)}</span><button onClick={() => onRemove(v.id)} className="text-slate-400 hover:text-slate-600"><X size={14} /></button></div>
            </div>); })}
        {n > 0 && <div className="text-center pt-1"><button onClick={onSelectAll} className="text-[11px] font-bold underline underline-offset-2" style={{ color: "var(--ft-brand-deep)" }}>{selCount === n ? "Clear selection" : "Select all"}</button></div>}
        {placed.length > 0 && <>
          <div className="flex items-center gap-2 px-1 pt-3 pb-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">In this project</span>
            <span className="text-[10px] text-slate-400 font-semibold">reconfigure to change — the lines follow</span>
          </div>
          {placed.map((k) => { const arm = armDel === k.rowId; return (
            <div key={k.rowId} className={`rounded-lg border border-slate-200 p-2.5 mb-2 ${k.faint ? "opacity-60" : ""}`}>
              <div className="flex gap-2.5 items-start">
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-bold leading-tight">{k.title}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">{k.meta}{k.areaName ? <> · in <b>{k.areaName}</b></> : null}</div>
                </div>
                <span className="font-extrabold tabular-nums text-[13px]" style={tierColor ? { color: tierColor } : undefined}>{fmt$(k.price)}</span>
              </div>
              <div className="flex items-center gap-2 pt-1.5">
                <button onClick={() => onEditPlaced(k)} className="rounded-full border px-2 py-0.5 text-[11px] font-bold hover:bg-slate-50" style={{ borderColor: "var(--ft-brand)", color: "var(--ft-brand-deep)" }}>Reconfigure</button>
                {arm ? <>
                  <span className="text-[11px] font-semibold text-red-600">Remove this kit's lines?</span>
                  <button onClick={() => { setArmDel(null); onDeletePlaced(k); }} className="rounded-full border border-red-300 text-red-600 px-2 py-0.5 text-[11px] font-bold hover:bg-red-50">Remove</button>
                  <button onClick={() => setArmDel(null)} className="text-[11px] font-semibold text-slate-400">Keep</button>
                </> : <button onClick={() => setArmDel(k.rowId)} className="ml-auto text-[11px] font-semibold text-slate-400 hover:text-slate-600">Remove…</button>}
              </div>
            </div>); })}
        </>}
      </div>
      {onMove && <div className="flex items-center gap-2 px-3 py-3 border-t border-slate-200">
        <span className="text-[11px] text-slate-500 font-semibold">{selCount} selected → <b>{areaName}</b></span>
        <button disabled={!n} onClick={onMoveAll} className="ml-auto rounded-md border border-slate-300 px-3 py-1.5 text-xs font-bold disabled:opacity-40">Move all</button>
        <button disabled={!selCount} onClick={onMove} className="rounded-md bg-indigo-600 text-white px-3.5 py-1.5 text-xs font-bold disabled:opacity-40">Move {selCount} → {areaName}</button>
      </div>}
    </div>
  );
}
```

(bg-indigo-600 is the themed accent — the index.css overrides map it to the moss brand like the Sheoga footer's button; reuse, don't invent colors.)

- [ ] **Step 2: WediConfigurator basket state + views**

1. Imports: add `KitBasketPanel` to the widgets.jsx import; add `buildFromMarker` to the wedi.js import; add `import { stampKit, normKitBasketEntry } from "./model.js";`.
2. Signature (~line 557): after `onAdd,` add `basket, onBasketChange, onMoveEntries, placed, onOpenPlaced, onDeleteKit,`.
3. State beside `const [payload, setPayload] = useState(null);`: add

```js
  const [basketOpen, setBasketOpen] = useState(false);
  const [basketSel, setBasketSel] = useState({});
```

4. Esc ladder (~line 708): insert `else if (basketOpen) setBasketOpen(false);` as the LAST rung before `else onClose();`.
5. Below the `rows` memo (~line 1302) add the view derivations + actions:

```js
  // --- basket (ADR 0035 step 3) ---------------------------------------------
  // Staged and placed kits both re-derive through buildFromMarker and price
  // through the SAME tier lens as the build column, so a kit reads the same
  // number everywhere. Display-only derivations — nothing here reprices rows.
  const entryView = (marker) => {
    const b = buildFromMarker(marker);
    if (!b) return { title: "wedi build", meta: "the catalog no longer knows this kit", price: null, faint: true, lines: null };
    const room = b.cfg.room;
    return {
      title: b.pan ? b.pan.name : "wedi build",
      meta: `${b.lines.length} lines${room ? ` · ${round2(room.w)}×${round2(room.d)}"` : ""}`,
      price: round2(b.lines.reduce((t, l) => t + tierOf(l.item) * l.qty, 0)),
      lines: () => lineItems(b, { tier: tierId, builderPct: bPct }),
    };
  };
  const stagedViews = useMemo(() => (basket || []).map((e) => ({ id: e.id, ...entryView(e.snap) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [basket, tierId, customPct, salePct, bPct]);
  const placedViews = useMemo(() => (placed || []).map((k) => ({ ...k, ...entryView(k.marker) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [placed, tierId, customPct, salePct, bPct]);
  const addToBasket = () => {
    if (!build || !onBasketChange) return;
    const entry = normKitBasketEntry({ addedAt: Date.now(), snap: { mode: build.mode, cfg: JSON.parse(JSON.stringify(build.cfg)) } });
    if (entry) { onBasketChange([...(basket || []), entry]); setBasketOpen(true); say("Staged in the basket — saved with this job"); }
  };
  const moveEntries = (ids) => {
    const picked = (basket || []).filter((b) => ids.includes(b.id));
    const views = picked.map((e) => stagedViews.find((v) => v.id === e.id)).filter((v) => v && v.lines);
    if (!views.length || !onMoveEntries) return;
    // Stamped per entry BEFORE flattening: each staged entry is its own kit
    // (its own kitId group) even when several move in one click.
    const lines = views.flatMap((v) => stampKit(v.lines()));
    onMoveEntries(lines, (basket || []).filter((b) => !ids.includes(b.id) || !views.some((v) => v.id === b.id)));
    setBasketSel({});
  };
```

(A faint staged row — `lines: null` — never moves and never leaves the basket on Move all; it stays for the user to remove by hand.)

6. Pop-head (~line 2360): between the `name` div and the `rclear` button insert:

```jsx
          {onBasketChange && <button className="relative inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold hover:bg-slate-50" onClick={() => setBasketOpen(true)} data-wedi-basket>
            🧺 Basket{(basket || []).length > 0 && <span className="rounded-full bg-[color:var(--ft-brand)] text-white text-[11px] font-extrabold min-w-[18px] h-[18px] px-1 flex items-center justify-center">{basket.length}</span>}
          </button>}
```

7. Build column Add row (~line 1880): beside the `Add to product lines` button add:

```jsx
            {onBasketChange && <button className="wbtn" onClick={addToBasket} data-wedi-add-basket><Plus size={13} /> Basket</button>}
```

(same disabled-state region as the Add button — it only renders where `rows`/`build` exist. If the enclosing block renders without a build, guard with `disabled={!build}`.)

8. Drawer mount: on the popup SHELL div (the one carrying `data-wedi-pop`) add `relative overflow-hidden` to its className (popovers portal to document.body, so overflow is safe). Directly before `{swapPanel}` insert:

```jsx
      <div className={`absolute inset-0 z-[55] transition-opacity ${basketOpen ? "opacity-100" : "opacity-0 pointer-events-none"}`} style={{ background: "rgba(20,15,10,.4)" }} onClick={() => setBasketOpen(false)} />
      <div className={`absolute top-0 right-0 bottom-0 z-[56] w-[400px] max-w-full bg-white border-l border-slate-300 shadow-2xl transition-transform ${basketOpen ? "translate-x-0" : "translate-x-full"}`}>
        <KitBasketPanel staged={stagedViews} sel={basketSel}
          onToggle={(id) => setBasketSel((s) => ({ ...s, [id]: !s[id] }))}
          onSelectAll={() => { const all = stagedViews.every((v) => basketSel[v.id]); const next = {}; stagedViews.forEach((v) => { next[v.id] = !all; }); setBasketSel(next); }}
          onRemove={(id) => onBasketChange((basket || []).filter((b) => b.id !== id))}
          onMove={onMoveEntries ? () => moveEntries(stagedViews.filter((v) => basketSel[v.id]).map((v) => v.id)) : undefined}
          onMoveAll={() => moveEntries(stagedViews.map((v) => v.id))}
          placed={placedViews} onEditPlaced={(k) => onOpenPlaced?.(k)} onDeletePlaced={(k) => onDeleteKit?.(k)}
          areaName={areaName} tierColor={tierColor} onClose={() => setBasketOpen(false)} />
      </div>
```

BUT these two divs must sit INSIDE the shell div (after the flex-1 body, before the shell's closing tag), NOT beside the portaled panels — the drawer is absolute within the popup like Sheoga's. `tierColor` — the popup already derives a tier color for the TierBar (find the existing variable; if it's named differently, pass that; if none exists at this scope, pass `undefined`).

- [ ] **Step 3: App.jsx wiring (wedi + the nonce for all three)**

1. `appendSheogaLines` (~line 808): rename to `appendKitLines` (it is vendor-generic — it appends payload rows to an area); update its one existing call site (the Sheoga `onMoveEntries`).
2. Sheoga mount: change `key={sheogaPop.pid}` to `key={sheogaPop.pid + ":" + (sheogaPop.n || 0)}` and its `onOpenPlaced` to `(k) => setSheogaPop({ aid: k.areaId, pid: k.rowId, seed: k.marker, n: (sheogaPop.n || 0) + 1 })` (papercut 1: reconfiguring the kit the popup is CURRENTLY on must remount so the fresh seed applies).
3. Wedi mount: add `key={wediPop.pid + ":" + (wediPop.n || 0)}` as the first attribute, and the props:

```jsx
            basket={sel.wediBasket || []}
            onBasketChange={(next) => updateProject(sel.id, { wediBasket: next })}
            onMoveEntries={(lines, nextBasket) => updateProject(sel.id, { categories: appendKitLines(sel.categories, wediPop.aid, lines), wediBasket: nextBasket })}
            placed={placedKits(sel.categories, "wedi")}
            onOpenPlaced={(k) => setWediPop({ aid: k.areaId, pid: k.rowId, seed: k.marker, n: (wediPop.n || 0) + 1 })}
            onDeleteKit={(k) => { const next = removeKitLines(sel.categories, k.areaId, k.rowId); if (next) { updateProject(sel.id, { categories: next }); if (k.rowId === wediPop.pid) setWediPop(null); } }}
```

- [ ] **Step 4: Hub (AppsWorkspace.jsx)**

1. Beside `const [sheogaBasket, setSheogaBasket] = useState([]);` add `const [wediBasket, setWediBasket] = useState([]);`.
2. In the commit path where `if (p.dest === sheoga) setSheogaBasket(p.nextBasket || []);` lives, add `if (p.dest === wedi) setWediBasket(p.nextBasket || []);`.
3. On the hub's WediConfigurator mount add: `basket={wediBasket} onBasketChange={setWediBasket} onMoveEntries={(lines, nextBasket) => requestCommit(wedi, lines, nextBasket)}`. (No `placed` props — the hub has no project; the section hides on the missing prop.)

- [ ] **Step 5: Verify + commit**

Run: `npm test` (all pass) and `npx eslint src/WediConfigurator.jsx src/App.jsx src/AppsWorkspace.jsx src/widgets.jsx` (no NEW errors beyond pre-existing).

```bash
git add src/widgets.jsx src/WediConfigurator.jsx src/App.jsx src/AppsWorkspace.jsx
git commit -m "wedi basket drawer: staged entries + derived In-this-project kits; reconfigure nonce (ADR 0035 step 3)"
```

---

### Task 5: Schluter basket UI + App/hub wiring

**Files:**
- Modify: `src/SchluterConfigurator.jsx` (imports; props ~line 540; esc ladder ~line 568; basket state + views; pop-head; build column Add row ~line 1540; shell + drawer mount)
- Modify: `src/App.jsx` (schluter mount ~line 2820)
- Modify: `src/AppsWorkspace.jsx` (hub schluter mount, basket state, commit path)

**Interfaces:**
- Consumes: Task 1's entry shape + `normKitBasketEntry`; Task 3's `buildFromMarker(marker, cat)`; Task 4's `KitBasketPanel`; existing `placedKits`/`removeKitLines`/`stampKit`, the popup's own `applyBoardPlan`/`planFor`/`tierOf`/`lineItems`.
- Produces: SchluterConfigurator props `basket, onBasketChange, onMoveEntries, placed, onOpenPlaced, onDeleteKit` — identical contract to Task 4's wedi set.
- The Schluter wrinkle (handoff): the catalog is LIVE registry rows (ADR 0032), so entries can only price once `catReady` — before that every staged/placed row renders FAINT with "waiting on the price books…" as its meta, never a crash; Move is inert on faint rows.

- [ ] **Step 1: SchluterConfigurator basket UI**

Mirror Task 4's Step 2 exactly, with these Schluter-specific differences:

1. Imports: `KitBasketPanel` from widgets.jsx; `buildFromMarker` added to the schluter.js import; `import { stampKit, normKitBasketEntry } from "./model.js";`.
2. Props after `onAdd,`: `basket, onBasketChange, onMoveEntries, placed, onOpenPlaced, onDeleteKit,`.
3. State: `basketOpen`, `basketSel` (same as wedi). Esc ladder (~line 568): insert `else if (basketOpen) setBasketOpen(false);` as the LAST rung before `else onClose();`.
4. Views — the cat-gated derivation (place below the `rows` memo, ~line 737):

```js
  // --- basket (ADR 0035 step 3) ---------------------------------------------
  // The catalog is LIVE registry rows (ADR 0032): until catReady every entry
  // renders faint instead of pricing — never a crash. Prices re-derive through
  // buildFromMarker + the popup's own board plan + tier lens, so a kit reads
  // the same number in the drawer and the build column.
  const entryView = (marker) => {
    if (!catReady || !cat.length) return { title: "Schluter kit", meta: "waiting on the price books…", price: null, faint: true, lines: null };
    const b = buildFromMarker(marker, cat);
    if (!b) return { title: "Schluter kit", meta: "the catalog no longer knows this kit", price: null, faint: true, lines: null };
    const c2 = marker.cfg;
    let lines = applyBoardPlan(b.lines, c2, panelFit && c2.wallSys === "board" ? boardPlan(expandBoardFaces(c2), cat, { source: c2.source === "stock" ? "stock" : "all" }) : null);
    const bill = lines.filter((l) => !l.noteOnly);
    return {
      title: b.pick && b.pick.tray ? b.pick.tray.name : "Mortar-bed build",
      meta: `${bill.length} lines · ${round2(c2.w)}×${round2(c2.d)}"`,
      price: round2(bill.reduce((t, l) => t + tierOf(l.item) * l.qty, 0)),
      lines: () => lineItems({ ...b, lines, mode: marker.mode || "custom", cfg: c2 }, { builderPct: bPct }),
    };
  };
```

(`boardPlan`/`expandBoardFaces` are already imported for the popup's own plan; if `applyBoardPlan`'s local signature differs — it is `(lines, c, p)` — call it as the popup's build memo does. If `panelFit` isn't in scope where entryView lives, move entryView below its declaration.)

Then `stagedViews`/`placedViews`/`addToBasket`/`moveEntries` exactly as Task 4's wedi versions, with `addToBasket` snapshotting `{ mode, cfg: JSON.parse(JSON.stringify(markCfg)) }` (markCfg — it carries manual/source/pick, so a staged Schluter kit keeps its extras and its quoted tray) and the toast via this popup's `say`.

5. Pop-head: the same 🧺 Basket button (guarded on `onBasketChange`), placed before "Clear design"/the Source switch, `data-schluter-basket`.
6. Build column: `{onBasketChange && <button className="wbtn" onClick={addToBasket} data-schluter-add-basket><Plus size={13} /> Basket</button>}` beside "Add to product lines" (~line 1540).
7. Shell: add `relative overflow-hidden` to the shell div (the `data-schluter-pop`-equivalent root inside the overlay); mount the same backdrop + 400px right drawer with `KitBasketPanel` inside the shell, before the portaled panels.

- [ ] **Step 2: App.jsx wiring**

Schluter mount: add `key={schluterPop.pid + ":" + (schluterPop.n || 0)}` as the first attribute, and:

```jsx
            basket={sel.schluterBasket || []}
            onBasketChange={(next) => updateProject(sel.id, { schluterBasket: next })}
            onMoveEntries={(lines, nextBasket) => updateProject(sel.id, { categories: appendKitLines(sel.categories, schluterPop.aid, lines), schluterBasket: nextBasket })}
            placed={placedKits(sel.categories, "schluter")}
            onOpenPlaced={(k) => setSchluterPop({ aid: k.areaId, pid: k.rowId, seed: k.marker, n: (schluterPop.n || 0) + 1 })}
            onDeleteKit={(k) => { const next = removeKitLines(sel.categories, k.areaId, k.rowId); if (next) { updateProject(sel.id, { categories: next }); if (k.rowId === schluterPop.pid) setSchluterPop(null); } }}
```

- [ ] **Step 3: Hub**

`const [schluterBasket, setSchluterBasket] = useState([]);`, `if (p.dest === schluter) setSchluterBasket(p.nextBasket || []);` in the commit path, and `basket={schluterBasket} onBasketChange={setSchluterBasket} onMoveEntries={(lines, nextBasket) => requestCommit(schluter, lines, nextBasket)}` on the hub mount.

- [ ] **Step 4: Verify + commit**

Run: `npm test` and `npx eslint src/SchluterConfigurator.jsx src/App.jsx src/AppsWorkspace.jsx` (no NEW errors).

```bash
git add src/SchluterConfigurator.jsx src/App.jsx src/AppsWorkspace.jsx
git commit -m "Schluter basket drawer: staged entries + derived In-this-project kits (ADR 0035 step 3)"
```

---

### Task 6: Preview harnesses + screenshots + ticket + docs

**Files:**
- Modify: `src/wedipreview.jsx`, `src/schluterpreview.jsx` (stateful categories + basket wiring)
- Create: `.scratch/117_basket-wedi-schluter/ticket.md` + screenshot PNGs
- Modify: `src/CLAUDE.md` (annotations, exact text below)

**Interfaces:**
- Consumes: Tasks 4–5's popup props; `placedKits`/`removeKitLines`/`landKitLines`/`stampKit`/`newProduct`/`newArea` (model.js).

- [ ] **Step 1: Stateful harnesses**

Both harnesses currently mount their popup over the fixture registry bag with a bare `onAdd`. Rework each to hold local state the way `src/sheogapreview.jsx` does:

```jsx
function Harness() {
  const [cats, setCats] = useState([{ ...newArea(), name: "Master bath", products: [newProduct()] }]);
  const [basket, setBasket] = useState([]);
  const [pop, setPop] = useState({ aid: null, pid: null, seed: null, n: 0 });
  const aid = pop.aid || cats[0].id, pid = pop.pid || cats[0].products.at(-1).id;
  return (
    <WediConfigurator key={pid + ":" + pop.n} seed={pop.seed}
      /* ...the existing fixture/registry props unchanged... */
      basket={basket} onBasketChange={setBasket}
      areaName="Master bath"
      placed={placedKits(cats, "wedi")}
      onOpenPlaced={(k) => setPop((p) => ({ aid: k.areaId, pid: k.rowId, seed: k.marker, n: p.n + 1 }))}
      onDeleteKit={(k) => setCats((c) => removeKitLines(c, k.areaId, k.rowId) || c)}
      onAdd={(lines) => setCats((c) => { const withRow = c.map((a) => (a.id === aid && !a.products.some((x) => x.id === pid) ? { ...a, products: [...a.products, { ...newProduct(), id: pid }] } : a)); return landKitLines(withRow, aid, pid, lines) || withRow; })}
      onMoveEntries={(lines, nextBasket) => { setCats((c) => c.map((a) => (a.id === aid ? { ...a, products: [...a.products, ...lines.map((p2) => ({ ...newProduct(), ...p2 }))] } : a))); setBasket(nextBasket); }}
      onClose={() => console.log("close")} onConfigChange={() => {}} />
  );
}
```

Mirror for `schluterpreview.jsx` (vendor `"schluter"`, `data-schluter-*` ids, keep its existing registry bag + `onQuoteOptions` props). Keep each file's header comment and extend it with one line: `Stateful cats/basket so the ADR 0035 step 3 drawer exercises the real landKitLines/placedKits/removeKitLines paths.`

- [ ] **Step 2: Screenshots**

`npm ls playwright || npm i --no-save playwright` (NEVER commit package.json changes). `PORT=5199 npm run dev` in the background. Script in the session scratchpad, run with `node`. Drive the REAL UI:

wedi (`http://localhost:5199/wedi-preview.html`, viewport 1600×1000):
1. Click a Kits-tab row (e.g. the first pan row), wait, click `[data-wedi-add]` (Add to product lines), then the payload modal's confirm button (`button:has-text('Add')` inside the modal) — the kit LANDS (a placed kit now exists).
2. Click another Kits row, then `[data-wedi-add-basket]` — a staged entry lands and the drawer opens.
3. Shoot `.scratch/117_basket-wedi-schluter/wedi-drawer.png` — must show the staged entry (checkbox, price) AND "In this project" with the placed kit (title, "· in Master bath", price, Reconfigure/Remove…).
4. Click `Remove…` then shoot `wedi-remove-confirm.png` (armed confirm), click `Keep`.
5. Click `Reconfigure`, wait ~1s, shoot `wedi-reconfigured.png` — the popup remounted on that kit (build column filled with the kit's lines).

Schluter (`http://localhost:5199/schluter-preview.html`): same dance with `[data-schluter-add]` / `[data-schluter-add-basket]`, shoot `schluter-drawer.png` (staged + placed sections priced through the live-registry catalog).

VERIFY every PNG by opening it with the Read tool. A wrong shot means fix the code or the script and reshoot — never commit a wrong screenshot. Kill the dev server when done.

- [ ] **Step 3: Ticket + CLAUDE.md**

`.scratch/117_basket-wedi-schluter/ticket.md`:

```md
---
issue_type: Feature
summary: "ADR 0035 step 3: wedi + Schluter get the Sheoga basket panel —
  persisted staged entries (wediBasket/schluterBasket) + the derived
  'In this project' section, both priced live through each engine's own
  buildFromMarker. Reconfigure-current-kit nonce fixed for all three."
status: done
labels: [ready-for-human]
---

# wedi + Schluter basket panels (ADR 0035 step 3)

Staged entries persist per project (normKitBasketEntry, model.js — engine-
free so the boot path stays clean); snap = the reconfigure marker, so a move
re-lands exactly what Reconfigure restores (wedi drops session steppers, the
standing rule; Schluter's markCfg keeps manual/pick/source). Placed kits
derive from anchor markers (placedKits); Remove goes through removeKitLines;
prices are display-only live derivations (step-2 doctrine). The Schluter
drawer waits faint on catReady (ADR 0032). Drawer shell shared in
widgets.jsx (KitBasketPanel). Preview shots in this directory.

Still deferred (from the step-2 final review): refresh mid-bundle-
reconfigure reopens single-width; a drift footnote for re-transcribed
tables; ea-mode placed singles price off the marker qty; the price-delta
confirm before a reconfigure-Add clobbers lines.
```

`src/CLAUDE.md` annotations:
(a) `model.js` entry — append after the placedKits note: `; normKitBasketEntry — the wedi/Schluter staged basket entry (ADR 0035 step 3, engine-free on purpose: model.js must never import wedi.js/schluter.js), snap = the reconfigure marker`.
(b) `widgets.jsx` entry — append after the NumIn note: `, and KitBasketPanel — the shared wedi/Schluter basket drawer shell (ADR 0035 step 3, presentation-only view rows: the two popups can't drift on the drawer either)`.
(c) `wedi.js` entry — append (after the lineItems note): `buildFromMarker re-derives the billed kit from a saved marker/staged entry (re-solving a custom cfg and re-picking its option by id) so the basket drawer prices staged and placed kits through the engine itself (ADR 0035 step 3).`
(d) `schluter.js` entry — append: `buildFromMarker is the same rule over the LIVE catalog (cfg.pick keeps the quoted tray; cfg.manual extras ride along); the popup's drawer gates it on catReady and applies its own board plan (ADR 0035 step 3).`
(e) `WediConfigurator.jsx` entry — append: `A basket drawer (ADR 0035 step 3, the Sheoga idiom via the shared KitBasketPanel): staged entries persist in project.wediBasket ("Basket" beside Add), the derived In-this-project section reconfigures/removes placed kits (App remounts on a pid+nonce key so reconfiguring the CURRENT kit re-seeds too), delete-on-move stands.`
(f) `SchluterConfigurator.jsx` entry — append: `Same basket drawer (project.schluterBasket) — entries wait FAINT on catReady before pricing (ADR 0032); a staged snap is markCfg, so manual extras and the quoted tray survive staging.`
(g) `wedipreview.jsx` / `schluterpreview.jsx` entries — append to each: `Stateful cats/basket (ADR 0035 step 3) so the drawer shots run the real landKitLines/placedKits/removeKitLines paths.`

- [ ] **Step 4: Verify + commit**

Run: `npm test` (all pass); `git status` must show NO package.json/package-lock.json changes.

```bash
git add src/wedipreview.jsx src/schluterpreview.jsx src/CLAUDE.md .scratch/117_basket-wedi-schluter/
git commit -m "Preview proof: wedi + Schluter basket drawers (ADR 0035 step 3)"
```
