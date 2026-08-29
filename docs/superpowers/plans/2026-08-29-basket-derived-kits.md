# Basket Derived Kits (ADR 0035 step 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve the Sheoga multi-width bundle across "Move" and give the Sheoga basket drawer a derived "In this project" section — every placed kit listed live off its anchor row's marker, with Reconfigure (reopen + replace) and Remove (delete the kit's lines) per kit.

**Architecture:** The basket never becomes a second persisted registry (ADR 0035): only staged entries persist in `sel.sheogaBasket`; placed kits are derived from anchor markers by a pure `placedKits(categories, vendor)` scan in model.js. The bundle's reopenable snapshot rides the first width line's `sheoga.bundle`; a bundle's anchor therefore OWNS its kitId group, unlocking whole-group replacement that step 1's sibling guard deliberately blocked.

**Tech Stack:** React 18 + Vite 5, plain `node --test` for pure modules, Playwright + pre-installed Chromium for preview screenshots.

**Spec:** `docs/adr/0035-configurator-kit-instance-id.md` (the binding authority; its second paragraph and Consequences define this step). Historical context: `docs/superpowers/specs/2026-07-18-sheoga-cart-multiwidth-design.md` (the original basket spec — its "no in-place edit" non-goal is superseded for PLACED kits by ADR 0035's reconfigure-replace; staged entries stay remove-and-rebuild).

## Global Constraints

- NEVER touch the live Supabase project — no SQL, no data/storage writes. There is no schema change in this plan; if you think you need one, STOP and report BLOCKED.
- NEVER push to `main`. Commit on the current branch `claude/configurator-basket-persistence-ccspby` only; never `git push` at all (the controller pushes).
- Snapshot doctrine (ADR 0003/0018): landed rows are price snapshots; nothing in this plan may reprice a saved row outside an explicit re-land through `landKitLines`.
- Write-path conventions (root CLAUDE.md): customer mutations only through the existing helpers; the plan's UI wiring goes through `updateProject` patches built by pure model.js functions.
- `sheoga.js` stays dependency-free (no imports) so `node --test` can parse it. `src/sheogapreview.jsx` is dev-only: never imported from `App.jsx` or any boot-path module.
- Comments: rare, only for non-obvious business rules or decisions that would look wrong without context. Match surrounding idiom (dense single-line style in model.js/sheoga.js).
- Tests run with `node --test src/<file>.test.js` (full suite: `npm test`). Every task ends with the FULL suite green.
- All tests are TDD: write the failing test, watch it fail, implement, watch it pass. `npm run lint` has 8 pre-existing errors and `npm run build` fails on a pre-existing `index.html` issue — do not fix those, and do not add NEW lint errors in files you touch.

---

### Task 1: Bundle snapshot on the first width line (sheoga.js)

**Files:**
- Modify: `src/sheoga.js` (function `multiWidthLineItems`, ~line 720)
- Test: `src/sheoga.test.js` (append near the existing `multiWidthLineItems` tests, ~line 720)

**Interfaces:**
- Consumes: existing `multiWidthLineItems(base, widths, sf, markupPct)` where `base = { mode, cfg }`, `widths = [{ w, share }]`.
- Produces: the FIRST emitted hardwood row's `sheoga` marker additionally carries `bundle: { base, widths, sf, markupPct }` (deep copy). Tasks 2–4 rely on exactly this key and shape.

- [ ] **Step 1: Write the failing test**

Append to `src/sheoga.test.js` (the helpers `mwFloor` and `normBasketEntry` already exist in this file):

```js
test("multiWidthLineItems: the first width line carries the whole bundle snapshot (ADR 0035 step 2)", () => {
  const base = mwFloor();
  const widths = [{ w: 3.25, share: 40 }, { w: 4.25, share: 60 }];
  const rows = multiWidthLineItems(base, widths, 200, 40);
  const floors = rows.filter((r) => r.type === "hardwood");
  assert.equal(floors.length, 2);
  assert.deepEqual(floors[0].sheoga.bundle, { base, widths, sf: 200, markupPct: 40 });
  assert.notEqual(floors[0].sheoga.bundle.base, base, "deep copy, not a shared reference");
  assert.ok(floors.slice(1).every((r) => r.sheoga.bundle === undefined), "only the first width line carries it");
  assert.ok(rows.filter((r) => r.type === "misc").every((r) => !r.sheoga.bundle), "fee lines never carry it");
  assert.ok(normBasketEntry({ kind: "bundle", ...floors[0].sheoga.bundle }), "the snap round-trips through normBasketEntry");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/sheoga.test.js`
Expected: the new test FAILS with `bundle` being `undefined` in the deepEqual. Every other test passes.

- [ ] **Step 3: Implement**

In `multiWidthLineItems`, the width rows are built by `b.lines.filter((l) => l.ok).map((l) => ({ ... }))`. Change the map to `(l, i)` and replace the `sheoga:` field of that object with:

```js
    sheoga: {
      mode: base.mode, cfg: JSON.parse(JSON.stringify({ ...base.cfg, w: l.w })), multiWidth: true,
      // The first width line is the bundle's ANCHOR: it carries the whole
      // reopenable bundle (ADR 0035 step 2) and owns the kit group outright.
      ...(i === 0 ? { bundle: JSON.parse(JSON.stringify({ base, widths, sf, markupPct })) } : {}),
    },
```

Nothing else in the function changes.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/sheoga.test.js` then `npm test`
Expected: all pass (baseline is 1175 + your new test).

- [ ] **Step 5: Commit**

```bash
git add src/sheoga.js src/sheoga.test.js
git commit -m "Stamp the bundle snapshot on a multi-width emission's first line (ADR 0035 step 2)"
```

---

### Task 2: Bundle-anchor-owns-group + removeKitLines + placedKits (model.js)

**Files:**
- Modify: `src/model.js` (the "configurator kit landing (ADR 0035)" section)
- Modify: `docs/adr/0035-configurator-kit-instance-id.md` (amendment, exact text below)
- Modify: `.claude/skills/floortrack-data-model/SKILL.md` (marker note, exact text below)
- Test: `src/model.test.js` (append to the "kit instance id (ADR 0035)" section; its helpers `wediAnchor`/`wediPart` exist there)

**Interfaces:**
- Consumes: Task 1's `marker.bundle` key; existing `landKitLines`, `VENDOR_KEYS`, `hasCfg`, `isCompanion`, `vendorOf`, `areaLabel`.
- Produces (Tasks 3–4 rely on these exact signatures):
  - `landKitLines` — unchanged signature; NEW rule: an anchor whose marker carries `.bundle` replaces its whole kitId group even when the group holds other cfg-bearing rows.
  - `export const removeKitLines = (categories, aid, pid) => categories' | null` — removes the anchor row AND its kit companions (same group/legacy/guard rules as landing; the anchor-owns-group rule applies). `null` when the anchor is missing.
  - `export const placedKits = (categories, vendor) => [{ rowId, kitId, areaId, areaName, marker, qty, markupPct }]` — one entry per reconfigurable anchor of `vendor` ("sheoga"|"wedi"|"schluter"): rows where `row[vendor].cfg` exists; a `multiWidth` row WITHOUT `bundle` is skipped when another row shares its kitId and carries `bundle` (the anchor represents it); legacy bundles (no bundle snap in the group) list each width individually. `areaName` via `areaLabel(area, index)`; `qty`/`markupPct` are the row's raw strings.

- [ ] **Step 1: Write the failing tests**

Append to `src/model.test.js` (inside the ADR 0035 section, before the `isRealProjectName` test), and add `removeKitLines, placedKits` to the model.js import at the top of the file:

```js
const bundleMarker = () => ({ mode: "floor", cfg: { w: 3.25 }, multiWidth: true, bundle: { base: { mode: "floor", cfg: { sp: "Hickory" } }, widths: [{ w: 3.25, share: 50 }, { w: 4.25, share: 50 }], sf: 200, markupPct: 40 } });

test("landKitLines: a bundle's own anchor replaces the whole group, siblings included", () => {
  const w1 = { ...newProduct(), brandColor: "Sheoga — 3 1/4", kitId: "K", sheoga: bundleMarker() };
  const w2 = { ...newProduct(), brandColor: "Sheoga — 4 1/4", kitId: "K", sheoga: { mode: "floor", cfg: { w: 4.25 }, multiWidth: true } };
  const fee = { ...newProduct(), brandColor: "Sheoga — fee", kitId: "K", sheoga: { fee: true } };
  const other = { ...newProduct(), brandColor: "Tile", priceSqft: "4" };
  const cats = [{ ...newArea(), products: [w1, w2, fee, other] }];
  const next = landKitLines(cats, cats[0].id, w1.id, [{ brandColor: "Sheoga — 5in", sheoga: { mode: "floor", cfg: { w: 5 } } }]);
  assert.deepEqual(next[0].products.map((p) => p.brandColor), ["Sheoga — 5in", "Tile"], "re-emitting the bundle replaces every width and the pooled fee");
});

test("removeKitLines: removes the anchor and its companions, across areas", () => {
  const anchor = wediAnchor({ kitId: "K" });
  const p1 = wediPart({ kitId: "K" });
  const other = { ...newProduct(), brandColor: "Tile", priceSqft: "4" };
  const stray = wediPart({ kitId: "K" });
  const cats = [{ ...newArea(), products: [anchor, p1, other] }, { ...newArea(), products: [stray] }];
  const next = removeKitLines(cats, cats[0].id, anchor.id);
  assert.deepEqual(next[0].products.map((p) => p.brandColor), ["Tile"]);
  assert.equal(next[1].products.length, 0);
});

test("removeKitLines: a bundle anchor takes the whole bundle; a sibling width takes only itself", () => {
  const mk = () => {
    const w1 = { ...newProduct(), brandColor: "w1", kitId: "K", sheoga: bundleMarker() };
    const w2 = { ...newProduct(), brandColor: "w2", kitId: "K", sheoga: { mode: "floor", cfg: { w: 4.25 }, multiWidth: true } };
    const fee = { ...newProduct(), brandColor: "fee", kitId: "K", sheoga: { fee: true } };
    return [{ ...newArea(), products: [w1, w2, fee] }];
  };
  let cats = mk();
  assert.deepEqual(removeKitLines(cats, cats[0].id, cats[0].products[1].id)[0].products.map((p) => p.brandColor), ["w1", "fee"], "a sibling width never takes its neighbors");
  cats = mk();
  assert.deepEqual(removeKitLines(cats, cats[0].id, cats[0].products[0].id)[0].products, [], "the bundle anchor owns the group");
});

test("removeKitLines: legacy anchor takes its contiguous companion run; missing anchor is null", () => {
  const anchor = wediAnchor();
  const p1 = wediPart(), p2 = wediPart();
  const stamped = wediPart({ kitId: "other" });
  const cats = [{ ...newArea(), products: [anchor, p1, p2, stamped] }];
  const next = removeKitLines(cats, cats[0].id, anchor.id);
  assert.deepEqual(next[0].products.map((p) => p.brandColor), ["wedi — screws"], "the run stops at a part stamped by another kit");
  assert.equal(removeKitLines(cats, cats[0].id, "nope"), null);
});

test("placedKits: anchors only — companions, fees and stamped bundle siblings fold away", () => {
  const single = { ...newProduct(), qty: "120", markupPct: "40", kitId: "K1", sheoga: { mode: "floor", cfg: { sp: "Hickory" } } };
  const fee1 = { ...newProduct(), kitId: "K1", sheoga: { fee: true } };
  const bw1 = { ...newProduct(), kitId: "K2", sheoga: bundleMarker() };
  const bw2 = { ...newProduct(), kitId: "K2", sheoga: { mode: "floor", cfg: { w: 4.25 }, multiWidth: true } };
  const wediRow = wediAnchor();
  const plain = { ...newProduct(), brandColor: "Tile", priceSqft: "4" };
  const a = { ...newArea(), name: "Kitchen", products: [single, fee1, bw1, bw2, wediRow, plain] };
  const ks = placedKits([a], "sheoga");
  assert.deepEqual(ks.map((k) => k.rowId), [single.id, bw1.id]);
  assert.equal(ks[0].areaName, "Kitchen");
  assert.equal(ks[0].qty, "120");
  assert.equal(ks[0].markupPct, "40");
  assert.equal(ks[1].marker.bundle.widths.length, 2);
  assert.deepEqual(placedKits([a], "wedi").map((k) => k.rowId), [wediRow.id]);
});

test("placedKits: legacy bundle widths (no bundle snap in the group) each list as their own kit", () => {
  const bw1 = { ...newProduct(), kitId: "K", sheoga: { mode: "floor", cfg: { w: 3.25 }, multiWidth: true } };
  const bw2 = { ...newProduct(), kitId: "K", sheoga: { mode: "floor", cfg: { w: 4.25 }, multiWidth: true } };
  assert.equal(placedKits([{ ...newArea(), products: [bw1, bw2] }], "sheoga").length, 2);
});

test("placedKits: area name falls back to the 1-based index", () => {
  const anchor = { ...newProduct(), sheoga: { mode: "floor", cfg: { sp: "Oak" } } };
  const ks = placedKits([{ ...newArea(), products: [] }, { ...newArea(), products: [anchor] }], "sheoga");
  assert.equal(ks[0].areaName, "Area 2");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test src/model.test.js`
Expected: the first new test fails on the deepEqual (siblings survive today); the rest fail at import/assert level for the missing exports. Pre-existing tests all pass — especially `landKitLines: a second cfg-bearing row in the group blocks group removal`, which MUST keep passing (its anchor has no `.bundle`).

- [ ] **Step 3: Implement**

In `src/model.js`, inside the ADR 0035 section:

1. Add after `isCompanion`:

```js
// A bundle's anchor (the row whose marker carries the whole bundle snap) OWNS
// its group: re-emitting or deleting the bundle takes every width and pooled
// fee. Only a bundle-less anchor defers to the sibling guard below.
const ownsGroup = (p) => VENDOR_KEYS.some((k) => p?.[k]?.bundle);
// The rows a kit's anchor takes with it — shared by landing and delete so the
// two can never disagree. `v` is the vendor whose companions a legacy
// (kitId-less) anchor may consume.
const kitCompanionIds = (categories, a, anchor, v) => {
  const remove = new Set();
  if (anchor.kitId) {
    const group = categories.flatMap((c) => c.products).filter((p) => p.kitId === anchor.kitId && p.id !== anchor.id);
    if (ownsGroup(anchor) || !group.some(hasCfg)) group.forEach((p) => remove.add(p.id));
  } else if (v && anchor[v]?.cfg) {
    const i = a.products.findIndex((p) => p.id === anchor.id);
    for (let j = i + 1; j < a.products.length; j++) {
      const r = a.products[j];
      if (r.kitId || !isCompanion(r, v)) break;
      remove.add(r.id);
    }
  }
  return remove;
};
```

2. In `landKitLines`, replace the whole `const remove = new Set(); if (anchor.kitId) { ... } else { ... }` block with:

```js
  const remove = kitCompanionIds(categories, a, anchor, vendorOf(stamped[0]));
```

(The behavior is identical for every step-1 case; the only new behavior is the `ownsGroup` bypass.)

3. Add after `landKitLines`:

```js
// Delete a placed kit: the anchor row plus everything kitCompanionIds says is
// its — the basket drawer's "Remove" (ADR 0035 step 2). Null when the anchor
// is already gone.
export const removeKitLines = (categories, aid, pid) => {
  const a = (categories || []).find((x) => x.id === aid);
  const anchor = a?.products.find((p) => p.id === pid);
  if (!anchor) return null;
  const remove = kitCompanionIds(categories, a, anchor, vendorOf(anchor));
  remove.add(pid);
  return categories.map((c) => ({ ...c, products: c.products.filter((p) => !remove.has(p.id)) }));
};
// The derived "in this project" list (ADR 0035: the rows ARE the registry —
// placed kits are never stored twice). One entry per reconfigurable anchor of
// `vendor`; a stamped bundle's sibling widths fold under their anchor, while a
// LEGACY bundle (moved before the snap existed) lists each width on its own.
export const placedKits = (categories, vendor) => {
  const cats = categories || [];
  const bundleKits = new Set();
  for (const c of cats) for (const p of c.products || []) if (p[vendor]?.bundle && p.kitId) bundleKits.add(p.kitId);
  const out = [];
  cats.forEach((c, i) => (c.products || []).forEach((p) => {
    const m = p[vendor];
    if (!m?.cfg) return;
    if (m.multiWidth && !m.bundle && p.kitId && bundleKits.has(p.kitId)) return;
    out.push({ rowId: p.id, kitId: p.kitId || "", areaId: c.id, areaName: areaLabel(c, i), marker: m, qty: p.qty ?? "", markupPct: p.markupPct ?? "" });
  }));
  return out;
};
```

4. In `docs/adr/0035-configurator-kit-instance-id.md`, in the first Consequences bullet, change "…in which case replacement is refused and the old append behavior stands, so a sibling width is never deleted by editing its neighbor." to: "…in which case replacement is refused and the old append behavior stands, so a sibling width is never deleted by editing its neighbor — with one exception (step 2): an anchor whose marker carries the bundle snap owns its whole group, so re-emitting the bundle, or editing it down to a single, replaces every width and pooled fee."

5. In `.claude/skills/floortrack-data-model/SKILL.md`, in the Product-shape comment block, at the end of the `kitId` comment (after "…delete the original's rows)."), add: "A multi-width bundle's first width line also carries `bundle: { base, widths, sf, markupPct }` inside its sheoga marker — the whole reopenable bundle snapshot (ADR 0035 step 2) — and that anchor owns its kitId group outright; the basket drawer's 'In this project' list derives from these markers (`placedKits`/`removeKitLines`, model.js), never from stored basket entries."

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test src/model.test.js` then `npm test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/model.js src/model.test.js docs/adr/0035-configurator-kit-instance-id.md .claude/skills/floortrack-data-model/SKILL.md
git commit -m "Bundle anchors own their kit group; add removeKitLines + placedKits (ADR 0035 step 2)"
```

---

### Task 3: Bundle reopen + "In this project" drawer section (SheogaConfigurator.jsx, App.jsx)

**Files:**
- Modify: `src/SheogaConfigurator.jsx` (seed initializers ~line 1231-1300; `BasketPanel` ~line 1193; both `BasketPanel` mounts ~line 1580-1590; component signature ~line 1230)
- Modify: `src/App.jsx` (the SheogaConfigurator job-context mount, `{sheogaPop && (` block ~line 2723; the model.js import line)

**Interfaces:**
- Consumes: Task 2's `placedKits(categories, "sheoga")` row shape and `removeKitLines(categories, aid, pid)`; Task 1's `marker.bundle` shape; existing `basketEntryView(entry, tierCtx)`, `redistributeShares`, `defaultConfig`, `MODES`.
- Produces: SheogaConfigurator props `placed` (the raw `placedKits` array), `onOpenPlaced(k)`, `onDeleteKit(k)`. Task 4's harness passes exactly these.

No unit tests: this task is component wiring (the repo's `.jsx` files carry no unit tests); Task 2 covers the logic, Task 4 is the preview proof. Verification is the full suite staying green plus the harness in Task 4.

- [ ] **Step 1: Bundle seed restore**

In `SheogaConfigurator`'s signature add the three props: `placed, onOpenPlaced, onDeleteKit` (after `onMoveEntries`). Then rework the seed initializers. Immediately before `const [mode, setMode] = ...` add:

```js
  // A bundle marker (sheoga.bundle on the first width line, ADR 0035 step 2)
  // reopens the whole multi-width build, not the anchor's single width.
  const bseed = seed?.bundle;
  const seedMode = bseed?.base?.mode || seed?.mode;
```

and change the initializers to:

```js
  const [mode, setMode] = useState(seedMode || "floor");
  const [cfgs, setCfgs] = useState(() => {
    const base = Object.fromEntries(MODES.map((m) => [m.id, defaultConfig(m.id)]));
    if (bseed?.base?.mode && bseed.base.cfg) base[bseed.base.mode] = { ...base[bseed.base.mode], ...bseed.base.cfg };
    else if (seed?.mode && seed?.cfg) base[seed.mode] = { ...base[seed.mode], ...seed.cfg };
    return base;
  });
  const [markup, setMarkup] = useState(bseed?.markupPct ?? markupDefault ?? DEFAULT_MARKUP);
```

change the `sf` initializer to:

```js
  const [sf, setSf] = useState(bseed?.sf > 0 ? bseed.sf : initialSf > 0 ? initialSf : 1);
```

change `floorSrc`/`flatSrc` to read `seedMode` instead of `seed?.mode` (same expressions otherwise), and change the multi-width state initializers to:

```js
  const [multi, setMulti] = useState(!!bseed);
  const [mwWidths, setMwWidths] = useState(() => (bseed ? bseed.widths.map((x) => x.w) : [3.25, 4.25, 5.25]));
  const [mwShares, setMwShares] = useState(() => (bseed ? Object.fromEntries(bseed.widths.map((x) => [x.w, x.share ?? 0])) : redistributeShares([3.25, 4.25, 5.25])));
```

(`defaultConfig` and `MODES` are already imported in this file. Leave `ventMarkup` alone.)

- [ ] **Step 2: Derive the placed view + panel props**

Next to `moveAllBasket` add:

```js
  // Placed kits derive an entry-shaped view so basketEntryView prices them the
  // same way it prices staged entries; sf follows the ROW's live qty, so a
  // hand-stepped square footage shows in the drawer too.
  const placedView = (placed || []).map((k) => {
    const mp = parseFloat(k.markupPct);
    return { ...k, entry: k.marker.bundle
      ? { kind: "bundle", ...k.marker.bundle }
      : { kind: "single", snap: { mode: k.marker.mode, cfg: k.marker.cfg }, sf: Math.max(1, parseFloat(k.qty) || 1), markupPct: Number.isFinite(mp) ? mp : activeMarkup } };
  });
```

Pass to BOTH `BasketPanel` mounts (the desktop drawer and the `MobileBuildSheet` copy) the extra props: `placed={placedView} onEditPlaced={(k) => onOpenPlaced?.(k)} onDeletePlaced={(k) => onDeleteKit?.(k)}`.

- [ ] **Step 3: The drawer section**

Change `BasketPanel`'s signature to add `placed = [], onEditPlaced, onDeletePlaced`, add `const [armDel, setArmDel] = useState(null);` at its top (import of `useState` already exists in the file), change the empty-state condition from `n === 0 ?` to `n === 0 && !placed.length ?`, and insert directly after the staged `basket.map(...)` block and its Select-all line (still inside the scrolling `div`):

```jsx
        {placed.length > 0 && <>
          <div className="flex items-center gap-2 px-1 pt-3 pb-1.5">
            <span className="text-[11px] font-extrabold uppercase tracking-wide text-slate-400">In this project</span>
            <span className="text-[10px] text-slate-400 font-semibold">reconfigure to change — the lines follow</span>
          </div>
          {placed.map((k) => { const v = basketEntryView(k.entry, tierCtx); const arm = armDel === k.rowId; return (
            <div key={k.rowId} className="rounded-lg border border-slate-200 p-2.5 mb-2">
              <div className="flex gap-2.5 items-start">
                <div className="flex-1 min-w-0">
                  {k.entry.kind === "bundle" && <span className="inline-block text-[9px] font-extrabold uppercase tracking-wide text-[color:var(--ft-brand-deep)] mb-1">Multi-width bundle</span>}
                  <div className="text-[13px] font-bold leading-tight">{v.title}</div>
                  <div className="text-[11px] text-slate-500 font-semibold">{v.meta} · in <b>{k.areaName}</b></div>
                </div>
                <span className="font-extrabold tabular-nums text-[13px]" style={tierColor ? { color: tierColor } : undefined}>{fmInt(v.price)}</span>
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
```

- [ ] **Step 4: App.jsx wiring**

On the model.js import line add `placedKits, removeKitLines`. In the job-context `{sheogaPop && (<SheogaConfigurator ...` mount add `key={sheogaPop.pid}` as the FIRST attribute (retargeting to another kit must remount so the seed re-applies), and the props:

```jsx
            placed={placedKits(sel.categories, "sheoga")}
            onOpenPlaced={(k) => setSheogaPop({ aid: k.areaId, pid: k.rowId, seed: k.marker })}
            onDeleteKit={(k) => { const next = removeKitLines(sel.categories, k.areaId, k.rowId); if (next) updateProject(sel.id, { categories: next }); }}
```

Do NOT touch the AppsWorkspace mount (the hub has no project context; the section hides on the missing prop). Deleting the kit the popup itself was opened from leaves `sheogaPop.pid` pointing at a removed row — that is safe by design: `landKitLines` returns null on a missing anchor and Add becomes a no-op.

- [ ] **Step 5: Verify + commit**

Run: `npm test` (all pass) and `npx eslint src/SheogaConfigurator.jsx src/App.jsx` (no NEW errors beyond the pre-existing `claimProjectNo` one in App.jsx).

```bash
git add src/SheogaConfigurator.jsx src/App.jsx
git commit -m "Sheoga drawer: derived In-this-project kits with reconfigure/remove; bundle seed reopens the multi-width build"
```

---

### Task 4: Preview harness + screenshots + docs

**Files:**
- Create: `sheoga-preview.html` (repo root, beside `wedi-preview.html`)
- Create: `src/sheogapreview.jsx`
- Create: `.scratch/116_basket-derived-kits/ticket.md` + screenshot PNGs
- Modify: `src/CLAUDE.md` (three annotations, exact text below)

**Interfaces:**
- Consumes: Task 3's `placed`/`onOpenPlaced`/`onDeleteKit` props; Task 2's `placedKits`/`removeKitLines`/`landKitLines`/`stampKit`; Task 1's bundle stamp via `multiWidthLineItems`.

- [ ] **Step 1: The harness page**

`sheoga-preview.html` — copy `wedi-preview.html` byte-for-byte, then change the `<title>` to `FloorTrack — Sheoga configurator preview` and the script src to `/src/sheogapreview.jsx`.

- [ ] **Step 2: The harness module**

`src/sheogapreview.jsx`:

```jsx
// Dev-only harness (sheoga-preview.html): the REAL SheogaConfigurator over
// local mock state, no Supabase — preview proof for the ADR 0035 step 2
// drawer (staged basket + derived "In this project" kits). Landing, delete
// and reconfigure run the REAL model.js paths over local state, so the shots
// exercise production behavior end to end. Not part of the app build.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import SheogaConfigurator from "./SheogaConfigurator.jsx";
import { newProduct, newArea, stampKit, landKitLines, removeKitLines, placedKits, uid } from "./model.js";
import { lineItems, multiWidthLineItems, defaultConfig, normBasketEntry } from "./sheoga.js";

const floorCfg = { ...defaultConfig("floor"), sp: "White Oak", grade: "char", cons: "solid" };
const land = (patches) => patches.map((p) => ({ ...newProduct(), ...p }));
const singleLines = stampKit(lineItems({ mode: "floor", cfg: floorCfg }, { sf: 320, markupPct: 40 }));
const bundleLines = stampKit(multiWidthLineItems({ mode: "floor", cfg: { ...floorCfg, sp: "Hickory" } }, [{ w: 3.25, share: 40 }, { w: 4.25, share: 60 }], 240, 40));
const area0 = { ...newArea(), name: "Great room", products: [...land(singleLines), ...land(bundleLines), newProduct()] };
const staged = [normBasketEntry({ id: uid(), kind: "single", addedAt: Date.now(), markupPct: 40, snap: { mode: "floor", cfg: { ...floorCfg, sp: "Maple" } }, sf: 150 })].filter(Boolean);

function Harness() {
  const [cats, setCats] = useState([area0]);
  const [basket, setBasket] = useState(staged);
  const [pop, setPop] = useState({ aid: area0.id, pid: area0.products.at(-1).id, seed: null });
  return (
    <SheogaConfigurator key={pop.pid}
      seed={pop.seed} initialSf={200} markupDefault={40} ventMarkupDefault={50}
      basket={basket} onBasketChange={setBasket}
      areaName="Great room"
      placed={placedKits(cats, "sheoga")}
      onOpenPlaced={(k) => setPop({ aid: k.areaId, pid: k.rowId, seed: k.marker })}
      onDeleteKit={(k) => setCats((c) => removeKitLines(c, k.areaId, k.rowId) || c)}
      onAdd={(lines) => setCats((c) => landKitLines(c, pop.aid, pop.pid, lines) || c)}
      onMove={(lines) => setCats((c) => landKitLines(c, pop.aid, pop.pid, lines) || c)}
      onMoveEntries={(lines, nextBasket) => { setCats((c) => c.map((a) => (a.id === pop.aid ? { ...a, products: [...a.products, ...land(lines)] } : a))); setBasket(nextBasket); }}
      onClose={() => console.log("close")}
      onConfigChange={() => {}}
    />
  );
}

createRoot(document.getElementById("preview")).render(<Harness />);
```

- [ ] **Step 3: Screenshots**

Playwright is not a repo dependency — install it session-locally with `npm ls playwright || npm i --no-save playwright` (never commit a package.json change). Start the dev server in the background: `PORT=5199 npm run dev`. Write the shot script to the session scratchpad (NOT the repo) and run it with `node`:

```js
import { chromium } from "playwright";
const b = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
const page = await (await b).newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto("http://localhost:5199/sheoga-preview.html");
await page.waitForTimeout(1500);
await page.click("button:has-text('Basket')");
await page.waitForTimeout(600);
await page.screenshot({ path: ".scratch/116_basket-derived-kits/drawer-placed-kits.png" });
await page.click("button:has-text('Remove…')");
await page.waitForTimeout(300);
await page.screenshot({ path: ".scratch/116_basket-derived-kits/drawer-remove-confirm.png" });
await page.click("button:has-text('Keep')");
const recon = page.locator("button:has-text('Reconfigure')").last();
await recon.click();
await page.waitForTimeout(1200);
await page.screenshot({ path: ".scratch/116_basket-derived-kits/bundle-reopened.png" });
await (await b).close();
```

If `chromium.launch` needs a different path, `ls /opt/pw-browsers/` and use the chromium binary inside. VERIFY each PNG by opening it (Read tool): `drawer-placed-kits.png` must show the drawer with the staged Maple entry AND an "In this project" section listing the White Oak single and the Hickory "Multi-width bundle" with prices and "in Great room"; `bundle-reopened.png` must show the configurator with the multi-width build active (Hickory, two widths). If a shot shows something else, fix the code (or the selectors) and reshoot — do not commit a wrong screenshot. Kill the dev server when done.

- [ ] **Step 4: Ticket + CLAUDE.md**

`.scratch/116_basket-derived-kits/ticket.md`:

```md
# Basket: derived "In this project" kits + bundle snap (ADR 0035 step 2)

Status: done

The Sheoga drawer now shows two sections: the staged basket (persisted,
delete-on-move unchanged) and "In this project" — every placed kit derived
live from the anchor markers (placedKits), with Reconfigure (reopen +
replace via the kitId group) and Remove (removeKitLines). A multi-width
move stamps the whole bundle on its first line, so bundles reopen and are
no longer information loss. Preview shots in this directory; design in
docs/adr/0035-configurator-kit-instance-id.md.
```

In `src/CLAUDE.md`: (a) at the end of the `model.js` entry's ADR 0035 paragraph append: `; removeKitLines (a placed kit's delete — anchor + the same companion set) and placedKits (the derived in-this-project list — a stamped bundle's siblings fold under their anchor, legacy widths list singly)`; (b) in the `SheogaConfigurator.jsx` entry, after the sentence about the basket/Move (search for "Move" in that entry), append: `The basket drawer's second section, "In this project" (ADR 0035 step 2), derives from placedKits — Reconfigure retargets the popup onto that kit's anchor (App.jsx remounts on key={pid} so the seed re-applies; a bundle seed restores the whole multi-width build off sheoga.bundle) and Remove deletes the kit's lines through removeKitLines with an inline confirm.`; (c) add a `sheogapreview.jsx` entry after `wedipreview.jsx` mirroring its style: `# dev-only harness (sheoga-preview.html): the REAL SheogaConfigurator over local mock state, no Supabase — preview proof for the ADR 0035 step 2 drawer; landing/delete/reconfigure run the real model.js paths over local state; not part of the app build`.

- [ ] **Step 5: Verify + commit**

Run: `npm test` (all pass); confirm `git status` shows no `package.json`/`package-lock.json` changes.

```bash
git add sheoga-preview.html src/sheogapreview.jsx src/CLAUDE.md .scratch/116_basket-derived-kits/
git commit -m "Sheoga preview harness + ADR 0035 step 2 preview shots and ticket"
```
