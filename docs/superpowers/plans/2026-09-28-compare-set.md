# Compare set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Compare's 2×2 grid + two-column detail with four fixed
columns (wedi Board · wedi Membrane · Schluter Board · Schluter Membrane).
Let **Open** hand off to the real configurator while keeping the build you
left, **Sync** a kept build to the anchor's room while keeping your picks,
and save the set per shower with a resume prompt.

**Architecture:**
- A new pure module, `src/compareset.js`, owns the stored set: normalize,
  save, clear, room-changed, resume choices, and the Sync merge. It imports
  no engine, so it is boot-safe.
- `comparekit.js` gains benches on the neutral room, choice-carrying
  builders and kept-entry builders.
- `comparegrid.js` reorders its cells and gains kept-entry cells.
- `CompareTab.jsx` redraws as four columns.
- The popups save their build on unmount (their one choke point for every
  close path), and take a `compare` seed tab, a `detached` start and a
  resume prompt.
- `App.jsx` holds the per-area set and does the cross-brand hand-off.

**Tech Stack:** React 18 (hooks), Vite, `node --test` (`npm test`), eslint.

**Spec:** `docs/superpowers/specs/2026-09-28-compare-set-design.md` (read it
first). **Mockup:** `.scratch/mockups/compare-set-2026-09-28.html` (layout
A).

## Global Constraints

- `main` is production. Work on `claude/hopeful-curie-1dwb3u`, PR only.
- Never touch the live Supabase project. No SQL: `compareSets` rides
  `customers.data`.
- ADR 0026: the boot chunk must not contain `comparekit`, `comparegrid`,
  `KERDI`, `Fundo` or `No tray fits`. `compareset.js` must import no engine.
- Goldens `wallsysgolden`, `wedimarkergolden` and `addedgolden` stay
  byte-identical. `comparegridgolden` may change only its cell order and the
  new bench room.
- The column order is `["wedi:board","wedi:membrane","schluter:board","schluter:membrane"]`,
  and quote-option letters A–D follow it.
- Copy (verbatim):
  - status tags: "House kit" and "Your build";
  - anchor tab: "CURRENT";
  - delta line: "Current build" on the anchor;
  - buttons: "Open", "Sync", "Clear set", and the "Option" checkbox;
  - room-changed chip: "Built for ⟨w⟩×⟨d⟩ — room changed" (or "Built for a
    different room");
  - dropped chip: "Your ⟨slot⟩ pick doesn't fit — house pick used";
  - unbuildable chip: "Your build can't be rebuilt — showing the house
    kit";
  - resume title: "Pick up where you left off?", with the button "Start
    new".
- Comments stay rare (CLAUDE.md), explaining business rules and surprising
  constraints only.
- Every UI change needs preview proof (the `p4/` shots) before merge.

## Rulings made writing this plan (they amend the spec; record them in the spec's amendments)

1. **Kept entries store the marker only**, `snap: { mode, cfg }`, with no
   `session`.
   - Hand-added lines already ride `cfg.manual` on both brands (ticket 158
     1c).
   - Stepped quantities (`qtyOv`) do not carry into a kept build. That's
     the same rule a placed kit's marker follows.
   - The kept column prices the marker's build, with the default panel /
     board Fit plan applied.
2. **Browse-only builds are not kept.** A wedi build with no pan, or a
   Schluter build with no room, has no marker to reopen.
3. **wedi's Fit plan moves into the engine.**
   - `applyPanelFit` (a closure in `WediConfigurator.jsx`) moves to
     `wedi.js` as `panelFitLines(lines, walls, panelSf)`, and the popup
     calls it.
   - That lets a kept wedi column price exactly what the popup showed.
   - Engine totals don't move: it is the same code, now exported.
4. **Sync takes the neutral room** (`w`, `d`, `curbed`, `drain`, `walls`,
   `benches`) and resets brand-only geometry to defaults, since the neutral
   room can't say where those go:
   - Schluter `xwalls`, `corners`, `drainX`/`drainY`/`drainRef`, `ramp`,
     `maxIn`, `tileT`, and `pick` (the tray is re-ranked);
   - wedi `corners`, `maxIn`, `tileT`, and the solve (it re-solves).
5. **Save happens on the popup body's unmount.**
   - Unmount covers every close path: ✕, Esc, backdrop, Add, the hand-off,
     and Reconfigure-another.
   - A ref holds the latest `{ key, entry }`, and the cleanup writes it
     through `onCompareSet`.

## File map

| File | Responsibility |
|---|---|
| `src/compareset.js` (new) | the pure set model: `CELL_KEYS`, `normCompareSets`, `roomChanged`, `roomLabel`, `saveEntry`, `clearSet`, `resumeChoices`, `mergeManual`, `entryOf` |
| `src/compareset.test.js` (new) | its tests |
| `src/model.js` | `normC` → `compareSets: normCompareSets(c.compareSets, areaIds)`; `newProject` seeds `{}` |
| `src/wedi.js` | export `panelFitLines` (moved from the popup) |
| `src/comparekit.js` | the room's `benches`; `wediBuildFor`/`schluterBuildFor` take `benches`; `wediKeptBuild`/`schluterKeptBuild`; `syncCfg` |
| `src/comparegrid.js` | `CELLS` reorder; `cellBuild(key, ctx, { mirror, sdryPick, kept })`; flags `room`, `dropped`, `lost` |
| `src/CompareTab.jsx` | the four-column layout (replaces grid + detail) |
| `src/WediConfigurator.jsx`, `src/SchluterConfigurator.jsx` | props `compareSet`, `onCompareSet`, `onOpenCell`, `onResume`, `savedBy`, `startDetached`; save on unmount; seed tab `compare`; resume prompt |
| `src/App.jsx` | the per-area set, `updateProject` writes, the hand-off, resume |
| records | ADR 0052; ADR 0034/0049 notes; data-model skill; `src/CLAUDE.md`; ticket 158; handoff; spec amendments |

---

### Task 1: `compareset.js` — the pure set model + `normC`

**Files:**
- Create: `src/compareset.js`
- Create: `src/compareset.test.js`
- Modify: `src/model.js` (`normC`, `newProject`)
- Modify: `src/model.test.js` (one `normC` case)

**Interfaces — Produces:**
- `CELL_KEYS: string[]`: the column order.
- `normCompareSets(v, areaIds?: string[]) → { [areaId]: { [cellKey]: Entry } }`
- `Entry = { snap: { mode, cfg }, room, target?, dropped?: string[], savedAt, savedBy }`
- `roomChanged(a: Room, b: Room) → boolean`
- `roomLabel(room) → string`: `"60×38"`.
- `saveEntry(sets, areaId, cellKey, entry) → sets`: immutable.
- `clearSet(sets, areaId, keepKey) → sets`: keeps only `keepKey`'s entry.
- `resumeChoices(areaSet, brand) → [{ key, entry }]`: newest first.
- `isMarkerSeed(seed) → boolean`
- `mergeManual(own: Row[], incoming: Row[], keyOf) → Row[]`: own first,
  then incoming lines whose key is new.
- `entryOf({ snap, room, target, savedBy, now }) → Entry | null`: null
  without `snap.cfg`.

- [ ] **Step 1: Write the failing tests** (`src/compareset.test.js`)

```js
import test from "node:test";
import assert from "node:assert/strict";
import {
  CELL_KEYS, normCompareSets, roomChanged, roomLabel, saveEntry, clearSet,
  resumeChoices, isMarkerSeed, mergeManual, entryOf,
} from "./compareset.js";

const room = { w: 60, d: 38, curbed: true, drain: "point", walls: [{ side: "back", on: true, len: 60, h: 84 }], benches: [] };
const snap = { mode: "custom", cfg: { w: 60, d: 38 } };

test("CELL_KEYS is the fixed column order", () => {
  assert.deepEqual(CELL_KEYS, ["wedi:board", "wedi:membrane", "schluter:board", "schluter:membrane"]);
});

test("normCompareSets: absent / junk read as {}", () => {
  for (const v of [undefined, null, 3, "x", []]) assert.deepEqual(normCompareSets(v), {});
});

test("normCompareSets: drops unknown cells, entries without cfg, orphaned areas", () => {
  const got = normCompareSets({
    a1: { "wedi:board": { snap, room, savedAt: 5, savedBy: "Dana" }, "nope:x": { snap, room }, "schluter:board": { snap: {} } },
    gone: { "wedi:board": { snap, room } },
  }, ["a1"]);
  assert.deepEqual(Object.keys(got), ["a1"]);
  assert.deepEqual(Object.keys(got.a1), ["wedi:board"]);
  assert.equal(got.a1["wedi:board"].savedBy, "Dana");
});

test("normCompareSets: keeps target / dropped only when well-formed; an empty area is dropped", () => {
  const got = normCompareSets({ a1: { "wedi:board": {
    snap, room, target: { areaId: "a1", rowId: "r1", kitId: "k" }, dropped: ["drain", 4, ""],
  } }, a2: {} }, ["a1", "a2"]);
  const e = got.a1["wedi:board"];
  assert.deepEqual(e.target, { areaId: "a1", rowId: "r1", kitId: "k" });
  assert.deepEqual(e.dropped, ["drain"]);
  assert.equal(got.a2, undefined);
  const bad = normCompareSets({ a1: { "wedi:board": { snap, room, target: { areaId: "a1" } } } }, ["a1"]);
  assert.equal(bad.a1["wedi:board"].target, undefined);
});

test("roomChanged: each field", () => {
  assert.equal(roomChanged(room, { ...room }), false);
  assert.equal(roomChanged(room, { ...room, w: 62 }), true);
  assert.equal(roomChanged(room, { ...room, curbed: false }), true);
  assert.equal(roomChanged(room, { ...room, drain: "linear" }), true);
  assert.equal(roomChanged(room, { ...room, walls: [{ side: "back", on: true, len: 60, h: 96 }] }), true);
  assert.equal(roomChanged(room, { ...room, benches: [{ kind: "corner", corner: "bl", build: "premade" }] }), true);
  // a bench's brand part is not geometry
  const b = { kind: "wall", side: "back", build: "premade", depth: 14 };
  assert.equal(roomChanged({ ...room, benches: [{ ...b, part: "X" }] }, { ...room, benches: [{ ...b, part: "Y" }] }), false);
  assert.equal(roomChanged(null, room), true);
});

test("roomLabel", () => {
  assert.equal(roomLabel(room), "60×38");
  assert.equal(roomLabel({ w: 60.5, d: 38 }), "60.5×38");
});

test("saveEntry / clearSet are immutable", () => {
  const e = entryOf({ snap, room, savedBy: "Dana", now: 7 });
  const s1 = saveEntry({}, "a1", "wedi:board", e);
  const s2 = saveEntry(s1, "a1", "schluter:board", e);
  assert.deepEqual(Object.keys(s2.a1).sort(), ["schluter:board", "wedi:board"]);
  assert.equal(Object.keys(s1.a1).length, 1);
  const s3 = clearSet(s2, "a1", "schluter:board");
  assert.deepEqual(Object.keys(s3.a1), ["schluter:board"]);
  assert.deepEqual(clearSet(s2, "a1", null), {});
});

test("entryOf: null without a cfg; stamps savedAt/savedBy", () => {
  assert.equal(entryOf({ snap: { mode: "kit" }, room }), null);
  const e = entryOf({ snap, room, savedBy: "", now: 9, target: { areaId: "a", rowId: "r", kitId: "" } });
  assert.equal(e.savedAt, 9);
  assert.deepEqual(e.target, { areaId: "a", rowId: "r", kitId: "" });
});

test("resumeChoices: that brand only, newest first", () => {
  const set = {
    "wedi:board": entryOf({ snap, room, now: 1 }),
    "wedi:membrane": entryOf({ snap, room, now: 3 }),
    "schluter:board": entryOf({ snap, room, now: 9 }),
  };
  assert.deepEqual(resumeChoices(set, "wedi").map((c) => c.key), ["wedi:membrane", "wedi:board"]);
  assert.deepEqual(resumeChoices(undefined, "wedi"), []);
});

test("isMarkerSeed", () => {
  assert.equal(isMarkerSeed({ mode: "kit", cfg: { panKey: "P" } }), true);
  assert.equal(isMarkerSeed({ mode: "custom", cfg: { w: 60, d: 38 } }), true);
  assert.equal(isMarkerSeed({ tab: "custom", input: { w: 60 } }), false);
  assert.equal(isMarkerSeed(null), false);
});

test("mergeManual: own first, incoming only when its key is new", () => {
  const k = (r) => r.key;
  assert.deepEqual(
    mergeManual([{ key: "a", qty: 1 }], [{ key: "a", qty: 2 }, { key: "b", qty: 1 }], k),
    [{ key: "a", qty: 1 }, { key: "b", qty: 1 }]);
});
```

- [ ] **Step 2: Run to verify it fails.** Run `node --test src/compareset.test.js`.
  Expected: FAIL, with `Cannot find module './compareset.js'`.

- [ ] **Step 3: Implement `src/compareset.js`**

```js
// compareset — the Compare set (ticket 158 Phase 4, ADR 0052): per shower
// (area), up to one kept build per Compare column. Pure and engine-free, so
// the popups may import it without pulling either engine onto their path.

export const CELL_KEYS = ["wedi:board", "wedi:membrane", "schluter:board", "schluter:membrane"];

const obj = (v) => v && typeof v === "object" && !Array.isArray(v);

const normTarget = (t) => {
  if (!obj(t)) return undefined;
  const areaId = typeof t.areaId === "string" ? t.areaId.trim() : "";
  const rowId = typeof t.rowId === "string" ? t.rowId.trim() : "";
  if (!areaId || !rowId) return undefined;
  return { areaId, rowId, kitId: typeof t.kitId === "string" ? t.kitId : "" };
};

const normEntry = (e) => {
  if (!obj(e) || !obj(e.snap) || !obj(e.snap.cfg)) return null;
  const out = {
    snap: { mode: typeof e.snap.mode === "string" ? e.snap.mode : "custom", cfg: e.snap.cfg },
    room: obj(e.room) ? e.room : null,
    savedAt: +e.savedAt || 0,
    savedBy: typeof e.savedBy === "string" ? e.savedBy : "",
  };
  const target = normTarget(e.target);
  if (target) out.target = target;
  const dropped = Array.isArray(e.dropped) ? e.dropped.filter((s) => typeof s === "string" && s) : [];
  if (dropped.length) out.dropped = dropped;
  return out;
};

export function normCompareSets(v, areaIds) {
  if (!obj(v)) return {};
  const keep = Array.isArray(areaIds) ? new Set(areaIds) : null;
  const out = {};
  for (const [aid, set] of Object.entries(v)) {
    if ((keep && !keep.has(aid)) || !obj(set)) continue;
    const cells = {};
    for (const k of CELL_KEYS) {
      const e = normEntry(set[k]);
      if (e) cells[k] = e;
    }
    if (Object.keys(cells).length) out[aid] = cells;
  }
  return out;
}

export function entryOf({ snap, room, target, savedBy, now }) {
  return normEntry({ snap, room, target, savedBy: savedBy || "", savedAt: now || Date.now() });
}

const n = (v) => Math.round((+v || 0) * 100) / 100;
const wallSig = (w) => [w.side, !!w.on, n(w.len), n(w.h)].join(":");
// a bench's `part` is a brand SKU, not geometry — a Schluter premade and the
// wedi seat it maps to are the same bench
const benchSig = (b) => [b.kind, b.side || "", b.corner || "", b.build || "", n(b.len), n(b.depth), n(b.h), n(b.size)].join(":");
const roomSig = (r) => [
  n(r.w), n(r.d), !!r.curbed, r.drain || "point",
  (r.walls || []).map(wallSig).sort().join("|"),
  (r.benches || []).map(benchSig).sort().join("|"),
].join("#");

export const roomChanged = (a, b) => !a || !b || roomSig(a) !== roomSig(b);
export const roomLabel = (r) => n(r && r.w) + "×" + n(r && r.d);

export function saveEntry(sets, areaId, cellKey, entry) {
  return { ...(sets || {}), [areaId]: { ...((sets || {})[areaId] || {}), [cellKey]: entry } };
}

export function clearSet(sets, areaId, keepKey) {
  const cur = (sets || {})[areaId] || {};
  const rest = { ...(sets || {}) };
  delete rest[areaId];
  return keepKey && cur[keepKey] ? { ...rest, [areaId]: { [keepKey]: cur[keepKey] } } : rest;
}

export const resumeChoices = (areaSet, brand) => CELL_KEYS
  .filter((k) => k.startsWith(brand + ":") && areaSet && areaSet[k])
  .map((k) => ({ key: k, entry: areaSet[k] }))
  .sort((a, b) => b.entry.savedAt - a.entry.savedAt);

export const isMarkerSeed = (seed) => !!(seed && obj(seed.cfg) && (seed.cfg.panKey || (+seed.cfg.w > 0 && +seed.cfg.d > 0)));

export function mergeManual(own, incoming, keyOf) {
  const seen = new Set((own || []).map(keyOf));
  return [...(own || []), ...(incoming || []).filter((r) => !seen.has(keyOf(r)))];
}
```

- [ ] **Step 4: Wire `normC` / `newProject`** in `src/model.js`.
  - Import `normCompareSets` from `./compareset.js`.
  - In `newProject`, add `compareSets: {}` after `schluterBasket: []`.
  - In `normC`, add
    `compareSets: normCompareSets(c.compareSets, (c.categories || []).map((a) => a.id)),`
    after `schluterBasket`.
- [ ] **Step 5: Add the model test** to `src/model.test.js`:

```js
test("normC: compareSets normalized, pruned to live areas (ADR 0052)", () => {
  const c = normC({ id: "c", categories: [{ id: "a1", name: "Shower", products: [] }],
    compareSets: { a1: { "wedi:board": { snap: { mode: "kit", cfg: { panKey: "P" } }, room: {} } }, gone: { "wedi:board": { snap: { cfg: {} } } } } });
  assert.deepEqual(Object.keys(c.compareSets), ["a1"]);
  assert.deepEqual(normC({ id: "c", categories: [] }).compareSets, {});
});
```

- [ ] **Step 6: Run the tests.** Run `npm test`. Expected: all pass.
- [ ] **Step 7: Commit:** `git commit -m "compareset: the pure Compare set model + normC"`

---

### Task 2: engine seams — benches on the room, Fit plan export, kept builders, Sync cfg

**Files:**
- Modify: `src/wedi.js`
- Modify: `src/WediConfigurator.jsx` (use the export)
- Modify: `src/comparekit.js`
- Test: `src/comparekit.test.js` (existing, or created beside it)
- Test: `src/comparegridgolden.js` (add the bench room)

**Interfaces:**
- Consumes: `mergeManual` (Task 1).
- Produces:
  - `panelFitLines(lines, walls, panelSf)` (wedi.js): the popup's
    `applyPanelFit`, verbatim.
  - The neutral room gains `benches: Bench[]` (`roomFromWedi`,
    `roomFromSchluter`).
  - `wediBuildFor(room, { …, benches })` and
    `schluterBuildFor(room, cat, { …, benches })`: `benches` default to
    `room.benches`, and a cross-brand `part` is stripped by the caller
    through `benchesFor(brand, room, fromBrand)`.
  - `benchesFor(brand, room, fromBrand) → Bench[]`
  - `wediKeptBuild(snap) → build | null`: `buildFromMarker` plus
    `panelFitLines` when the build has panels.
  - `schluterKeptBuild(snap, cat) → { build, cfg } | null`:
    `buildFromMarker` plus the board plan on Board, exactly as the basket's
    `entryView`.
  - `syncCfg(brand, entryCfg, room, anchorManual, { fromBrand }) → cfg`:
    the entry's choices, with room fields replaced, brand-only geometry
    reset and `manual` merged (rulings 1 and 4).
  - `keptDropped(brand, cfg, build) → string[]`: the slot names whose kept
    choice didn't resolve.

- [ ] **Step 1: Move `applyPanelFit`.**
  - Cut the body from `WediConfigurator.jsx:923-935` into `wedi.js` as
    `export function panelFitLines(lines, wl, panelSf)`. It uses `panelPlan`,
    `expandWallFaces`, `item` and `round2`, all already in wedi.js.
  - In the popup, import `panelFitLines`, and replace the two
    `applyPanelFit(` calls.
  - Run `npm test`. The wedi goldens must be unchanged.
- [ ] **Step 2: Write the failing comparekit tests:**
  - `roomFromWedi({ …, benches:[b] }).benches` deep-equals `[b]`;
    `roomFromSchluter` does the same, and a legacy `cfg.bench === "framed"`
    reads as one back-wall framed bench;
  - `benchesFor("wedi", { benches:[{…, part:"KBSB406406"}] }, "schluter")`
    has no `part`, and with `fromBrand === "wedi"` it keeps it;
  - `wediBuildFor(room60x38WithCornerBench, { wallSys:"board" })` bills a
    bench line (`slot`/`group` benches), and the same room without the bench
    doesn't;
  - `schluterBuildFor` does the same with the Schluter fixture cat;
  - `syncCfg("schluter", { w:48, d:36, swaps:{grate:"X"}, drainPick:{family:"point"}, xwalls:[{}], pick:"T", manual:[{sku:"A",qty:1}] }, room, [{sku:"A",qty:2},{sku:"B",qty:1}])`
    returns `w/d` from the room, keeps `swaps`/`drainPick`, returns
    `xwalls: []` and `pick: null`, and `manual` equals
    `[{sku:"A",qty:1},{sku:"B",qty:1}]`;
  - `syncCfg("wedi", …)` keeps `coverPick`/`curbPick`/`panelPick`/`wallSys`/
    `sdryBase`, and drops `solve`, `corners`, `maxIn` and `tileT`;
  - `wediKeptBuild({ mode:"custom", cfg: wediBuildFor(room).cfg })` totals
    equal the house kit plus the Fit plan;
  - `keptDropped("schluter", { swaps:{ grate:"NOPE" } }, build)` returns
    `["grate"]`, and a resolved swap returns `[]`.
- [ ] **Step 3: Run to verify they fail.** Run
  `node --test src/comparekit.test.js`.
- [ ] **Step 4: Implement in `comparekit.js`.**
  - `roomFromSchluter`: add
    `benches: cfgBenches(cfg)` (imported from schluter.js), mapped to plain
    `{…}` copies.
  - `roomFromWedi`: add `benches: (cfg.benches || []).map((b) => ({ ...b }))`.
  - `wediBuildFor`: pass `benches: opts.benches || room.benches || []` into
    `kitFor`.
  - `schluterBuildFor`: replace `bench: null` with
    `benches: (opts.benches || room.benches || []).map((b) => ({ ...b }))`.
  - `benchesFor`:
    `(brand, room, fromBrand) => (room.benches || []).map(({ part, ...b }) => (brand === fromBrand && part ? { ...b, part } : b))`.
  - `wediKeptBuild`:
    `const b = buildFromMarker(snap); if (!b) return null; return { ...b, cfg: { ...b.cfg, source: snap.cfg.source }, lines: panelFitLines(b.lines, b.cfg.walls, b.panelSf) };`
  - `schluterKeptBuild`: `buildFromMarker(snap, cat)`, then
    `applyBoardPlan(…)` when `cfg.wallSys === "board"`, with the plan
    source from `cfg.source`. Return `{ build: { ...b, lines }, cfg }`.
  - `syncCfg`:
    - Schluter:
      `{ ...cfg, w, d, curbed, drain, walls: SIDES.map(…room.walls…), benches: benchesFor("schluter", room, fromBrand), xwalls: [], corners: [], drainX: 0, drainY: 0, drainRef: "left", ramp: false, maxIn: false, tileT: 0, pick: null, manual: mergeManual(cfg.manual, anchorManual, (r) => r.sku) }`;
    - wedi:
      `const { solve, corners, maxIn, tileT, ...keep } = cfg; return { ...keep, room: { w, d }, walls: room.walls.filter(on).map(→{side,len,h}), benches: benchesFor("wedi", room, fromBrand), manual: mergeManual(cfg.manual, anchorManual, (r) => r.key) }`;
    - the wedi rebuild then goes through `wediBuildFor(room, { …choices })`
      (below), not `buildFromMarker`, because it must re-solve.
  - `wediBuildFor` gains a `choices` option:
    `{ panelPick, curbPick, coverPick, coverFrame, fastenerKey, sealantForm, recess }`.
    These are spread into the `kitFor` opts. Absent means today's call.
  - `keptDropped`:
    - Schluter: each `cfg.swaps[slot]` SKU that no `build.lines` item
      carries (`l.item.sku`), plus `"drain"` when `build.drainFit` says
      `fallback`;
    - wedi: `"curb"` when `cfg.curbPick` is a key that no curb line carries,
      `"cover"` for `cfg.coverPick.key` the same way, and `"panel"` for
      `cfg.panelPick`.
- [ ] **Step 5: Add a golden room** to `comparegridgolden.js`: 60×38, curbed,
  point drain, a back-left corner premade bench. Pin all four cells.
  Existing rooms stay unchanged.
- [ ] **Step 6: Run `npm test`.** All pass. `wallsysgolden`,
  `wedimarkergolden` and `addedgolden` are untouched.
- [ ] **Step 7: Commit:** `git commit -m "comparekit: benches ride the neutral room; kept builders; Sync cfg; wedi Fit plan exported"`

---

### Task 3: `comparegrid` — column order, kept cells, new chips; option letters

**Files:**
- Modify: `src/comparegrid.js`
- Modify: `src/comparegrid.test.js`
- Modify: `src/comparegridgolden.js` (order only)
- Modify: `src/options.test.js` (the letters)

**Interfaces:**
- Consumes: `wediKeptBuild`, `schluterKeptBuild`, `keptDropped` (Task 2);
  `roomChanged`, `roomLabel` (Task 1).
- Produces:
  - `CELLS` in `CELL_KEYS` order;
  - `cellBuild(key, ctx, { mirror, sdryPick, kept })`, where `kept` is an
    Entry or undefined. Return: today's fields plus
    `status: "current"|"yours"|"house"` and `kept` (the entry used, or
    null);
  - `cellFlags(...)` output may now lead with
    `{ id: "room", label, rowKey: null }`, then
    `{ id: "lost", label, rowKey: null }`, then
    `{ id: "dropped:<slot>", label, rowKey: null }`, before the Phase 3
    flags.

- [ ] **Step 1: Write the failing tests:**
  - `CELLS.map((c) => c.key)` deep-equals `CELL_KEYS`;
  - with a kept entry for `schluter:board` built from a 60×36 room while the
    host room is 60×38: `status === "yours"`, the rows come from the kept
    build, and `flags[0].id === "room"` with the label
    `"Built for 60×36 — room changed"`;
  - the same entry with only a wall height changed gives the label
    `"Built for a different room"`;
  - a kept entry whose `snap.cfg.panKey` is unknown gives `status "house"`,
    and `flags[0].id === "lost"`;
  - a kept entry on the host key is ignored (`status "current"`, the host
    rows);
  - an entry with `dropped: ["drain"]` gives a
    `"dropped:drain"` flag labelled
    `"Your drain pick doesn't fit — house pick used"`.
- [ ] **Step 2: Run to verify they fail.**
- [ ] **Step 3: Implement.**
  - Reorder `CELLS` to `CELL_KEYS`.
  - In `cellBuild`, before the house branch:
    - when `kept && !live && ctx.ready[brand]`, build from the entry:
      wedi `wediKeptBuild(kept.snap)`, Schluter
      `schluterKeptBuild(kept.snap, ctx.cat)`;
    - on success: `plan = null`, the rows are the kept build's rows,
      `status = "yours"`;
    - on null: fall through to the house kit with a `lost` flag.
  - In the room flag: `roomChanged(kept.room, ctx.room)`. Its label is
    `"Built for " + roomLabel(kept.room) + " — room changed"` when `w`/`d`
    differ, else `"Built for a different room"`.
  - Slot words for `dropped`: `{ drain:"drain", grate:"grate", cover:"drain cover", curb:"curb", board:"board", panel:"panel", membrane:"membrane", band:"band", fastener:"fastener" }`.
- [ ] **Step 4: Re-pin `comparegridgolden`** with the new order (totals
  identical, keys reordered). Update `options.test.js` wherever the tab's
  letter order is asserted (the `compareOptionsPatch` shape itself is
  unchanged).
- [ ] **Step 5: Run `npm test`.** Expected: all pass.
- [ ] **Step 6: Commit:** `git commit -m "comparegrid: fixed column order; kept cells; room/dropped/lost chips"`

---

### Task 4: `CompareTab.jsx` — four fixed columns

**Files:**
- Modify: `src/CompareTab.jsx`

**Interfaces:**
- Consumes: Tasks 1–3.
- New props:
  - `compareSet` (the area's `{ [cellKey]: Entry }` or null; null means the
    Apps hub, with no Open/Sync/Clear);
  - `onCompareSet(nextAreaSet)`;
  - `onOpenCell(cellKey, seed, target?)`, where
    `seed = { mode, cfg, tab: "compare" }`;
  - `savedBy`.

**Behavior** (spec §1–§4, mockup layout A):
- **Layout:**
  - `.cmp-cols` is a CSS grid:
    `grid-template-columns: 104px repeat(4, minmax(250px, 1fr))`;
  - the header row is sticky at `top:0`, and the label column is sticky at
    `left:0`;
  - the wrapper is `overflow:auto`, so narrow widths scroll sideways.
- **Rows:** from `compareLayout` extended to four columns.
  - Call it with `cols = { c0: rows0, c1: rows1, c2: rows2, c3: rows3 }` and
    the matching `plus` map. `compareLayout` already takes any column names
    (Phase 3 ruling 5).
  - Each slot row renders one `Cell` per column (`data-cmp-cell=<key>`).
  - Group bands span all columns.
- **Headers** (`data-cmp-col=<key>`), each holding:
  - the brand badge and label;
  - the status tag (`data-cmp-status`);
  - the total (`data-cmp-total`);
  - the delta (`data-cmp-diff`);
  - the chips (`data-cmp-flag`), the first two plus "+N more";
  - Open (`data-cmp-open`), Sync (`data-cmp-sync`, Your build only) and the
    Option checkbox (`data-cmp-check`).
- **The anchor ring:** an absolutely positioned
  `<div className="ring" data-cmp-current>` placed with
  `gridColumn: idx+2; gridRow: 1 / <rowCount+1>`, a 2px `--ft-brand`
  border, and a `<span className="tab">CURRENT</span>`.
- **Every line / Subtotals:** a `lensseg`-styled toggle
  (`data-cmp-view=lines|sum`). Its state lives in the grid session object
  (`grid.view`) next to `checked`.
  - In Subtotals, each group renders one `.sub` cell per column: the sum in
    the lens and "N lines ▸".
  - Clicking a subtotal adds that group to `grid.open` and renders its
    lines.
- **Open:**
  - Build the seed. For a kept column:
    `{ ...entry.snap, tab: "compare" }` plus `entry.target`.
  - For a house kit:
    - wedi: `{ mode: "custom", cfg: build.cfg }`;
    - Schluter: `{ mode: "custom", cfg: { ...c.cfg, manual: plan ? plan.manual : c.cfg.manual, source } }`.
  - Then call `onOpenCell(key, seed, target)`. The popup does the saving on
    unmount (ruling 5).
- **Sync:**
  - `cfg = syncCfg(brand, entry.snap.cfg, room, anchorManualFor(brand), { fromBrand: hostBrand })`.
  - `anchorManualFor(brand)`:
    - same brand: `hostBuild.cfg.manual` (wedi) or `hostCfg.manual`
      (Schluter);
    - other brand: `mirrorPlan(hostBuild, hostBrand, {}, …).manual`.
  - Rebuild (wedi: `wediBuildFor(room, { …choices from cfg, manual: cfg.manual, wallSys, source })`;
    Schluter: `schluterKeptBuild({ mode:"custom", cfg }, cat)`).
  - Compute `dropped = keptDropped(brand, cfg, build)`, then
    `onCompareSet({ ...compareSet, [key]: entryOf({ snap: { mode: "custom", cfg: builtCfg }, room, target: entry.target, savedBy }) + dropped })`.
- **Clear set** (`data-cmp-clear`): `window.confirm` with the text "Clear
  every kept build for this shower? Columns go back to house kits.", then
  `onCompareSet(clearSet({ x: compareSet }, "x", hostKey).x || {})`.
- **Kept columns** have no mirror (`plan` is null). **House kits** keep
  Phase 3's per-cell mirror.
- **The S-DRY no-fit ask** renders at the top of the `wedi:membrane`
  column's first cell, only while it is a house kit with the `sdry` flag.
- **Quote options:**
  - `sendable` in `CELLS` order, with `LETTERS` following it;
  - the foot button and confirm modal are unchanged;
  - default checked: the host key and the other brand's same wall system,
    `hostKey.replace(/^(wedi|schluter)/, other)`, replacing
    `opposite(hostKey)` as the default.
- **Removed:** `.quad`, `tile()`, `selected`, the two-column `cmp-grid` and
  `cmp-tot`, and the `delta` paragraph. `grid.selected` is no longer read.
- **Help tip:** rewritten for the columns — fixed order, Current, Open,
  Sync, the set.

- [ ] **Step 1:** Implement per the behavior above. Reuse `Cell` as is, add
  the `.cmp-cols`, `.colh`, `.ring`, `.sub` and `.pill` CSS from the mockup
  (tokens only), and delete the grid CSS.
- [ ] **Step 2:** Run `npm run lint && npm test`. Both are clean.
- [ ] **Step 3:** Run a smoke preview with `npx vite --port 5199`, using
  `wedi-preview.html` → Compare. Four columns, the ring on wedi Board, and
  no console errors.
- [ ] **Step 4: Commit:** `git commit -m "CompareTab: four fixed columns, Current ring, Open/Sync/Clear set, subtotals"`

---

### Task 5: the popups — save on unmount, hand-off seeds, detached start, resume prompt

**Files:**
- Modify: `src/WediConfigurator.jsx`
- Modify: `src/SchluterConfigurator.jsx`

**Interfaces:**
- Consumes: `entryOf`, `resumeChoices`, `isMarkerSeed`, `roomLabel`
  (Task 1). `CompareTab`'s new props (Task 4).
- New props on both popups:
  - `compareSet`: the area's set, or undefined in the hub;
  - `onCompareSet(nextAreaSet)`;
  - `onOpenCell(cellKey, seed, target)`;
  - `onResume(entry)`;
  - `savedBy`;
  - `startDetached`.

- [ ] **Step 1: `seedState` in both popups.** After the marker branch sets
  `s.tab`, honor `seed.tab === "compare"`:
  `if (seed.tab === "compare") s.tab = "compare";` inside the marker branch,
  before `return s`.
- [ ] **Step 2: Detached start.**
  - wedi: `useState(false)` becomes `useState(!!startDetached)` for
    `detached`.
  - Schluter: find its `detached` state (grep `setDetached`) and do the
    same. If Schluter has none, add the wedi trio verbatim (`detached`,
    `edit`, `commitLines`) and route its Add through `commitLines`.
- [ ] **Step 3: Save on unmount.**
  - Keep `const keep = useRef(null)`. On every render where the build has a
    marker (wedi: `build && build.pan`; Schluter: `build && markCfg.w > 0`),
    set
    `keep.current = { key: hostCellKey, entry: entryOf({ snap: { mode, cfg }, room: neutralRoom, target: edit || undefined, savedBy }) }`.
  - The neutral room is built inline without comparekit (the boot rule):
    - wedi:
      `{ w: cfg.room.w, d: cfg.room.d, curbed: cfg.solve?.input ? cfg.solve.input.curb !== "curbless" : pan.sub !== "curbless", drain: …, walls: cfg.walls.map(w => ({ side: w.side, on: true, len: +w.len, h: +w.h })), benches: cfg.benches || [] }`;
    - Schluter:
      `{ w, d, curbed, drain, walls: cfg.walls.map((w) => ({ side: w.name.toLowerCase(), on: !!w.on, len: +w.len, h: +w.h })), benches: cfg.benches || [] }`.
  - Both must match `roomFromWedi`/`roomFromSchluter` field for field. A
    test pins it: the `compareset.test.js` "popup room" case is fed with the
    output of the comparekit functions.
  - To keep the two in lockstep, move `roomFromWedi`/`roomFromSchluter` into
    `compareset.js` as `neutralRoomWedi(cfg, panOf)` /
    `neutralRoomSchluter(cfg)`. The pan lookup is passed in, so the module
    stays engine-free, and comparekit re-exports them under the old names.
    The pan is needed only for Kits-tab picks.
  - `useEffect(() => () => { const k = keep.current; if (k && k.entry && onCompareSet && compareSetRef.current) onCompareSet({ ...compareSetRef.current, [k.key]: k.entry }); }, [])`,
    where `compareSetRef` tracks the latest `compareSet` prop.
  - The host cell key is inlined:
    `(brand + ":" + (wallSys === "membrane" ? "membrane" : "board"))`.
    The wedi default is board, and Schluter reads `cfg.wallSys`.
- [ ] **Step 4: Resume prompt.**
  - On mount, if `compareSet && !isMarkerSeed(seed)` and
    `resumeChoices(compareSet, brand).length`, show a modal ("Pick up where
    you left off?") listing each choice:
    - the label (wedi: "wedi · Building Panel" or "wedi · S-DRY membrane";
      Schluter: "Schluter · KERDI-BOARD" or "Schluter · KERDI membrane");
    - `roomLabel(entry.room)`;
    - "saved ⟨ago⟩ by ⟨name⟩", where ago is minutes, hours or days.
  - Rows are `data-resume-pick=<key>`, and **Start new** is
    `data-resume-new`.
  - Picking calls `onResume(entry)`. Start new closes the modal.
  - Esc is a layer: `useEscClose`.
- [ ] **Step 5: Pass the props through** to `CompareTab`: `compareSet`,
  `onCompareSet`, `onOpenCell`, `savedBy`.
- [ ] **Step 6:** Run `npm run lint && npm test`.
- [ ] **Step 7: Commit:** `git commit -m "popups: keep the build on close, compare hand-off seeds, detached start, resume prompt"`

---

### Task 6: `App.jsx` — the set, the hand-off, resume

**Files:**
- Modify: `src/App.jsx` (the wedi and Schluter popup mounts, ~2992–3072)

- [ ] **Step 1: Per mount** (shown for wedi; Schluter mirrors it with
  `schluterPop`/`setSchluterPop`):

```jsx
compareSet={(sel.compareSets || {})[wediPop.aid] || {}}
onCompareSet={(next) => updateProject(sel.id, { compareSets: { ...(sel.compareSets || {}), [wediPop.aid]: next } })}
savedBy={profile?.name || ""}
startDetached={!!wediPop.detached}
onOpenCell={(key, seed, target) => openCell(wediPop, key, seed, target)}
onResume={(entry) => setWediPop((p) => ({ ...p, seed: entry.snap, pid: rowLive(entry.target) ? entry.target.rowId : p.pid, n: (p.n || 0) + 1, detached: false }))}
```

- [ ] **Step 2: Helpers** above the return:

```js
// A compare hand-off (ADR 0052): reopen on the kit a kept build came from
// when that row is still on the job; else stay on the row the popup was on,
// detached when that row already carries a configurator kit, so Add appends
// instead of writing the other brand over it.
const rowOf = (aid, pid) => sel?.categories.find((a) => a.id === aid)?.products.find((p) => p.id === pid);
const rowLive = (t) => !!(t && rowOf(t.areaId, t.rowId));
const openCell = (pop, key, seed, target) => {
  const brand = key.split(":")[0];
  const onTarget = rowLive(target);
  const row = rowOf(pop.aid, pop.pid);
  const marked = !!(row && (row.wedi?.cfg || row.schluter?.cfg || row.sheoga));
  const next = { aid: onTarget ? target.areaId : pop.aid, pid: onTarget ? target.rowId : pop.pid, seed, n: (pop.n || 0) + 1, detached: !onTarget && marked };
  if (brand === "wedi") { setSchluterPop(null); setWediPop(next); }
  else { setWediPop(null); setSchluterPop(next); }
};
```

- [ ] **Step 3:** Confirm that `profile` is in scope where the popups mount
  (grep `profile`), and that `updateProject` merges into the latest record
  (two patches in one tick: Add's `categories`, then unmount's
  `compareSets`). If `updateProject` spreads a stale `sel`, route
  `onCompareSet` through the functional form it offers. Check before
  writing.
- [ ] **Step 4:** Run `npm run lint && npm test`, then build with the dummy
  env vars, then the boot grep:
  `grep -c "comparegrid\|KERDI\|Fundo\|No tray fits" dist/assets/index-*.js`
  → `0`.
- [ ] **Step 5: Commit:** `git commit -m "App: per-shower compare set, cross-brand hand-off, resume"`

---

### Task 7: proof + records

- [ ] **Step 1:** Write `.scratch/158_shower-config-roadmap/p4/shoot-set.mjs`,
  modelled on `p3/shoot-grid.mjs`. Assert and shoot:
  - `c1`: the four columns from the wedi harness: the order, the ring on
    `wedi:board`, and three House kit tags;
  - `c2`: the same from the Schluter harness, with the ring on
    `schluter:membrane` and the same column order;
  - `c3`: Subtotals;
  - `c4`: a kept entry seeded through the harness's `compareSet` (the
    harness gets a `?set=` param, as `?seed=` works): Your build, the
    room-changed chip, and Sync visible;
  - `c5`: after Sync, the chip is gone and the kept pick is still on the
    line;
  - `c6`: Open on `schluter:board` calls `onOpenCell` with a `compare`-tab
    seed (the harness logs it);
  - `c7`: the resume prompt (the harness opened with `?set=` and no seed);
  - `c8`: the confirm modal with three options in the new letter order.

  End with "all checks passed". Re-run `p1a`–`p3`, and `git checkout` any
  PNG with no real change.
- [ ] **Step 2: Records.**
  - `docs/adr/0052-compare-set.md` and its README row;
  - ADR 0034 amendment notes on decisions 3 and 5;
  - an ADR 0049 note (Sync resolves kept choices, and dropped picks are
    named);
  - the data-model skill's `Customer` entry for `compareSets`;
  - `src/CLAUDE.md` entries (`compareset.js` new, `comparekit.js`,
    `comparegrid.js`, `CompareTab.jsx`, both popups, `wedi.js`
    `panelFitLines`);
  - the spec's amendments, rulings 1–5 above plus any made while building;
  - ticket 158's Phase 4 block;
  - `.scratch/handoffs/shower-config-phase5-2026-09-28.md`.
- [ ] **Step 3:** Run `npm test`, `npm run lint`, and the build plus boot
  grep. Commit, push, and open the PR, with the p4 shots in the body.
