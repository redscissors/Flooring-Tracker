# Shower Tile Sq Ft Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a tile row's sq ft be built from ticked pieces of placed wedi/Schluter showers (walls, floor, curb, niche back, bench top) plus named extra spaces, with a drift chip when a shower changes.

**Architecture:** A boot-safe `src/sfparts.js` owns the stored breakdown (`p.sfParts`): normalizing, totals, toggles, drift state, print text. A lazy-only `src/showersf.js` imports both configurator engines and turns each placed kit's saved cfg into piece sq ft; `src/usejobshowers.js` dynamic-imports it only when the job has a placed shower or a row with a breakdown (ADR 0026). `src/SfPartsMenu.jsx` is the tick-box menu opened by right-click on the desktop sq ft field or a Bath icon on mobile.

**Tech Stack:** React 18, Vite 5, lucide-react, `node --test` (`npm test` runs `src/*.test.js`), ESLint (`npm run lint`).

**Spec:** `docs/superpowers/specs/2026-09-23-shower-tile-sf-design.md`

## Global Constraints

- Never import `wedi.js`, `schluter.js` or `schluterdraw.js` from a boot-path file (`App.jsx`, `model.js`, `mobile.jsx`, `EstimatePrint.jsx`, `sfparts.js`, `SfPartsMenu.jsx`). Only `showersf.js` imports them, and only `usejobshowers.js` loads it, via `import()`.
- All piece values are raw sq ft rounded to 0.1 (`Math.round(sqin / 144 * 10) / 10`). Waste is never added here.
- A typed sq ft is an override and is never changed by code; only a user click on **Use N** / **Remove** / a tick changes `qty`.
- Existing rows have no `sfParts`; `normP` must return them without the key.
- No SQL, no Supabase writes. All writes go through `updProduct` (→ `updateCust`).
- Comments: only for non-obvious business rules (see CLAUDE.md "Code Comments").
- UI change: preview screenshots before merge (non-negotiable 3). Never push to `main`.

---

### Task 1: The stored breakdown — `src/sfparts.js` + `normP`

**Files:**
- Create: `src/sfparts.js`
- Create: `src/sfparts.test.js`
- Modify: `src/model.js` (import + `normP`, the one-line `export const normP = ...` near line 102)
- Modify: `src/model.test.js` (append tests)

**Interfaces:**
- Produces (all exported from `src/sfparts.js`):
  - `PIECES: Array<{ piece: "walls"|"floor"|"curb"|"niche"|"benchTop", label: string }>`
  - `normSfParts(list: unknown): SfPart[] | undefined`
  - `sfPartsTotal(parts: SfPart[] | undefined): number` (rounded to 0.1)
  - `fmtSf(n: number): string` ("72", "6.1")
  - `togglePiece(parts, shower: Shower, pc: Piece): SfPart[]`
  - `addExtra(parts, label: string, sf: number): SfPart[]`
  - `removeAt(parts, i: number): SfPart[]`
  - `sfPatch(next: SfPart[]): { sfParts: SfPart[] | undefined, qty: string }`
  - `sfPartsState(p, showers: Shower[]): null | { fresh: SfPart[], gone: SfPart[], live: number, have: number, changed: boolean, drift: null | { auto: number, have: number } }`
  - `sfPartsText(parts): string`
  - Types: `SfPart = { kind: "shower", kitId: string, piece: string, where: string, sf: number } | { kind: "extra", label: string, sf: number }`; `Shower = { key: string, vendor: "wedi"|"schluter", areaName: string, size: string, curbed: boolean, pieces: Piece[] }`; `Piece = { piece: string, label: string, sf: number | null }`.

- [ ] **Step 1: Write the failing tests** — `src/sfparts.test.js`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { PIECES, normSfParts, sfPartsTotal, fmtSf, togglePiece, addExtra, removeAt, sfPatch, sfPartsState, sfPartsText } from "./sfparts.js";

const SH = { key: "k1", vendor: "wedi", areaName: "Master Bath", size: "60×36", curbed: true,
  pieces: [{ piece: "walls", label: "Walls (incl. bench faces)", sf: 88 }, { piece: "floor", label: "Floor", sf: 15 }, { piece: "niche", label: "Niche back", sf: 1 }] };

test("PIECES lists the five pieces in menu order", () => {
  assert.deepEqual(PIECES.map((x) => x.piece), ["walls", "floor", "curb", "niche", "benchTop"]);
});

test("normSfParts keeps valid entries, drops junk, and returns undefined when empty", () => {
  assert.equal(normSfParts(undefined), undefined);
  assert.equal(normSfParts([]), undefined);
  assert.equal(normSfParts([null, { kind: "shower", kitId: "", piece: "walls", sf: 1 }, { kind: "shower", kitId: "k", piece: "roof", sf: 1 }]), undefined);
  assert.deepEqual(normSfParts([{ kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: "88" }, { kind: "extra", label: " Hall ", sf: 45 }, { kind: "extra", label: "", sf: "x" }]), [
    { kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: 88 },
    { kind: "extra", label: "Hall", sf: 45 },
  ]);
});

test("sfPartsTotal sums to one decimal", () => {
  assert.equal(sfPartsTotal([{ sf: 72 }, { sf: 6.15 }, { sf: 0.1 }]), 78.3);
  assert.equal(sfPartsTotal(undefined), 0);
});

test("fmtSf drops a trailing .0", () => {
  assert.equal(fmtSf(72), "72");
  assert.equal(fmtSf(6.1), "6.1");
});

test("togglePiece adds then removes a shower piece", () => {
  const on = togglePiece([], SH, SH.pieces[0]);
  assert.deepEqual(on, [{ kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: 88 }]);
  assert.deepEqual(togglePiece(on, SH, SH.pieces[0]), []);
});

test("addExtra / removeAt edit the extra-space list", () => {
  const a = addExtra([], " Hall ", 45);
  assert.deepEqual(a, [{ kind: "extra", label: "Hall", sf: 45 }]);
  assert.deepEqual(removeAt(a, 0), []);
});

test("sfPatch sets qty to the total, and clears both when empty", () => {
  assert.deepEqual(sfPatch([{ kind: "extra", label: "Hall", sf: 45 }]), { sfParts: [{ kind: "extra", label: "Hall", sf: 45 }], qty: "45" });
  assert.deepEqual(sfPatch([]), { sfParts: undefined, qty: "" });
});

test("sfPartsState: no breakdown → null", () => {
  assert.equal(sfPartsState({ qty: "10" }, [SH]), null);
});

test("sfPartsState: typed override drifts against the pieces", () => {
  const parts = [{ kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: 88 }];
  const s = sfPartsState({ qty: "100", sfParts: parts }, [SH]);
  assert.equal(s.changed, false);
  assert.deepEqual(s.drift, { auto: 88, have: 100 });
});

test("sfPartsState: a reconfigured shower refreshes the live total", () => {
  const parts = [{ kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: 80 }];
  const s = sfPartsState({ qty: "80", sfParts: parts }, [SH]);
  assert.equal(s.changed, true);
  assert.deepEqual(s.drift, { auto: 88, have: 80 });
  assert.equal(s.fresh[0].sf, 88);
});

test("sfPartsState: in step → no drift", () => {
  const parts = [{ kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: 88 }, { kind: "extra", label: "Hall", sf: 45 }];
  assert.equal(sfPartsState({ qty: "133", sfParts: parts }, [SH]).drift, null);
});

test("sfPartsState: a removed shower keeps its last sf and is reported gone", () => {
  const parts = [{ kind: "shower", kitId: "gone", piece: "walls", where: "Guest", sf: 64 }];
  const s = sfPartsState({ qty: "64", sfParts: parts }, [SH]);
  assert.equal(s.gone.length, 1);
  assert.equal(s.drift, null);
});

test("sfPartsState: a piece that can no longer be measured keeps its saved sf", () => {
  const sh = { ...SH, pieces: [{ piece: "walls", label: "Walls", sf: null }] };
  const parts = [{ kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: 88 }];
  assert.equal(sfPartsState({ qty: "88", sfParts: parts }, [sh]).drift, null);
});

test("sfPartsText groups a shower's pieces under its area name", () => {
  const parts = [
    { kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: 72 },
    { kind: "shower", kitId: "k1", piece: "niche", where: "Master Bath", sf: 1 },
    { kind: "extra", label: "Hall", sf: 45 },
    { kind: "extra", label: "Mudroom", sf: 60 },
  ];
  assert.equal(sfPartsText(parts), "Master Bath: walls 72 · niche 1 · Hall 45 · Mudroom 60");
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test src/sfparts.test.js`
Expected: FAIL — `Cannot find module './sfparts.js'`.

- [ ] **Step 3: Implement** — `src/sfparts.js`

```js
// A row's sq ft built from placed-shower pieces + named extra spaces
// (spec 2026-09-23). Boot-safe: never import the configurator engines here.
import { num } from "./catalog.js";

export const PIECES = [
  { piece: "walls", label: "Walls (incl. bench faces)" },
  { piece: "floor", label: "Floor" },
  { piece: "curb", label: "Curb top + faces" },
  { piece: "niche", label: "Niche back" },
  { piece: "benchTop", label: "Bench top" },
];
const PIECE_IDS = PIECES.map((x) => x.piece);
const SHORT = { walls: "walls", floor: "floor", curb: "curb", niche: "niche", benchTop: "bench top" };

const r1 = (n) => Math.round(n * 10) / 10;
export const fmtSf = (n) => String(r1(+n || 0));

export function normSfParts(list) {
  if (!Array.isArray(list)) return undefined;
  const out = list.map((e) => {
    if (!e || typeof e !== "object" || e.sf === "" || !Number.isFinite(+e.sf)) return null;
    const sf = +e.sf;
    if (e.kind === "shower") {
      if (typeof e.kitId !== "string" || !e.kitId || !PIECE_IDS.includes(e.piece)) return null;
      return { kind: "shower", kitId: e.kitId, piece: e.piece, where: typeof e.where === "string" ? e.where : "", sf };
    }
    return { kind: "extra", label: typeof e.label === "string" ? e.label.trim() : "", sf };
  }).filter(Boolean);
  return out.length ? out : undefined;
}

export const sfPartsTotal = (parts) => r1((parts || []).reduce((s, e) => s + (+e.sf || 0), 0));

const isPiece = (e, kitId, piece) => e.kind === "shower" && e.kitId === kitId && e.piece === piece;

export function togglePiece(parts, shower, pc) {
  const list = parts || [];
  if (list.some((e) => isPiece(e, shower.key, pc.piece))) return list.filter((e) => !isPiece(e, shower.key, pc.piece));
  return [...list, { kind: "shower", kitId: shower.key, piece: pc.piece, where: shower.areaName, sf: pc.sf }];
}

export const addExtra = (parts, label, sf) => [...(parts || []), { kind: "extra", label: String(label || "").trim(), sf: +sf || 0 }];
export const removeAt = (parts, i) => (parts || []).filter((_, j) => j !== i);

export const sfPatch = (next) => (next.length
  ? { sfParts: next, qty: String(sfPartsTotal(next)) }
  : { sfParts: undefined, qty: "" });

// A piece whose shower is gone, or can no longer be measured, keeps its last
// saved sf: the row's number must never quietly drop.
export function sfPartsState(p, showers) {
  const parts = p && p.sfParts;
  if (!parts || !parts.length) return null;
  const byKey = new Map((showers || []).map((s) => [s.key, s]));
  const gone = [];
  const fresh = parts.map((e) => {
    if (e.kind !== "shower") return e;
    const s = byKey.get(e.kitId);
    if (!s) { gone.push(e); return e; }
    const pc = s.pieces.find((x) => x.piece === e.piece);
    return pc && pc.sf != null ? { ...e, sf: pc.sf } : e;
  });
  const live = sfPartsTotal(fresh), have = r1(num(p.qty));
  return { fresh, gone, live, have, changed: live !== sfPartsTotal(parts), drift: live !== have ? { auto: live, have } : null };
}

export function sfPartsText(parts) {
  let where = null;
  return (parts || []).map((e) => {
    if (e.kind !== "shower") { where = null; return `${e.label || "Extra"} ${fmtSf(e.sf)}`; }
    const head = e.where !== where ? `${e.where || "Shower"}: ` : "";
    where = e.where;
    return `${head}${SHORT[e.piece]} ${fmtSf(e.sf)}`;
  }).join(" · ");
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node --test src/sfparts.test.js`
Expected: all PASS.

- [ ] **Step 5: `normP` carries the field — failing test first.** Append to `src/model.test.js`:

```js
test("normP keeps a valid sfParts list and omits the key on rows without one", () => {
  assert.equal("sfParts" in normP({ id: "x" }), false);
  assert.equal("sfParts" in normP({ id: "x", sfParts: [] }), false);
  const p = normP({ id: "x", sfParts: [{ kind: "extra", label: "Hall", sf: "45" }] });
  assert.deepEqual(p.sfParts, [{ kind: "extra", label: "Hall", sf: 45 }]);
});
```

Run: `node --test src/model.test.js` — Expected: the new test FAILS (`p.sfParts` undefined).

- [ ] **Step 6: Implement in `src/model.js`.** Add to the imports at the top: `import { normSfParts } from "./sfparts.js";`. At the end of the `normP` object literal, change `attached: normAttachedJob(p.attached) });` to:

```js
attached: normAttachedJob(p.attached), ...sfPartsField(p.sfParts) });
const sfPartsField = (v) => { const s = normSfParts(v); return s ? { sfParts: s } : {}; };
```

(`sfPartsField` is a `const` arrow referenced only when `normP` runs, so defining it right after is safe. `sfparts.js` imports only `catalog.js`, which `model.js` already imports — no cycle.)

- [ ] **Step 7: Run everything**

Run: `npm test && npm run lint`
Expected: all PASS, lint clean.

- [ ] **Step 8: Commit**

```bash
git add src/sfparts.js src/sfparts.test.js src/model.js src/model.test.js
git commit -m "Shower tile sf: stored sq ft breakdown (sfParts) + normP"
```

---

### Task 2: Shower piece math — `src/showersf.js`

**Files:**
- Modify: `src/wedi.js` (export `panRoomDims`; use it in `kitFor`, ~line 5071)
- Create: `src/showersf.js`
- Create: `src/showersf.test.js`

**Interfaces:**
- Consumes: `PIECES` from `sfparts.js`; `placedKits(categories, vendor)` from `model.js` (returns `{ rowId, kitId, areaId, areaName, marker }[]`).
- Produces:
  - `wediPieces(cfg): null | { w, d, curbed, pieces: Piece[] }`
  - `schluterPieces(cfg): null | { w, d, curbed, pieces: Piece[] }`
  - `jobShowers(categories): Shower[]` — `key = kitId || "row:" + rowId`, `size = "60×36"`.

- [ ] **Step 1: Export the room rule from `wedi.js`.** In `kitFor`, replace

```js
  const roomDims = room
    || (pan.group === "module" ? { w: pan.len, d: MODULE_DEPTH + MODEXT_DEPTH }
      : { w: Math.max(pan.w, pan.d), d: Math.min(pan.w, pan.d) });
```

with `const roomDims = room || panRoomDims(pan);` and add just above `export function kitFor`:

```js
export const panRoomDims = (pan) => (pan.group === "module"
  ? { w: pan.len, d: MODULE_DEPTH + MODEXT_DEPTH }
  : { w: Math.max(pan.w, pan.d), d: Math.min(pan.w, pan.d) });
```

Run: `node --test src/wedi.test.js src/wediequivalence.test.js` — Expected: PASS (pure refactor).

- [ ] **Step 2: Write the failing tests** — `src/showersf.test.js`. Values were checked against the live engines on 2026-09-23.

```js
import test from "node:test";
import assert from "node:assert/strict";
import { wediPieces, schluterPieces, jobShowers } from "./showersf.js";

const sf = (r) => Object.fromEntries(r.pieces.map((p) => [p.piece, p.sf]));
const W3 = [{ side: "back", len: 60, h: 96 }, { side: "left", len: 36, h: 96 }, { side: "right", len: 36, h: 96 }];
const base = { panKey: "US9100002", room: { w: 60, d: 36 }, walls: W3 };

test("wedi: three walls, curb cap across the entry, one 12×12 niche", () => {
  const r = wediPieces({ ...base, curbKey: "US3000008", addons: ["US3000005"] });
  assert.deepEqual(sf(r), { walls: 88, floor: 15, curb: 6.1, niche: 1 });
  assert.equal(r.curbed, true);
  assert.deepEqual(r.pieces.map((p) => p.piece), ["walls", "floor", "curb", "niche"]);
});

test("wedi: lean curb and a back bench (face into walls, top its own piece)", () => {
  assert.deepEqual(sf(wediPieces({ ...base, curbKey: "US3000038", benches: [{ kind: "wall", side: "back", len: 48 }] })),
    { walls: 94, floor: 15, curb: 3.8, benchTop: 4.7 });
});

test("wedi: 'max — curb inside' takes the curb out of the floor", () => {
  assert.equal(sf(wediPieces({ ...base, curbKey: "US3000008", maxIn: true, tileT: 0.375 })).floor, 13.2);
});

test("wedi: kit mode (no room) reads the pan; corner bench", () => {
  assert.deepEqual(sf(wediPieces({ panKey: "US9100002", walls: W3, curbKey: "US3000008", benches: [{ kind: "corner", corner: "bl" }] })),
    { walls: 92.2, floor: 12, curb: 4.9, benchTop: 2 });
});

test("wedi: curbless has no curb piece", () => {
  assert.equal(wediPieces({ ...base, curbKey: null }).pieces.some((p) => p.piece === "curb"), false);
  assert.equal(wediPieces({ ...base, curbKey: null }).curbed, false);
});

test("wedi: an unknown curb part is 'enter manually' (sf null), never a guess", () => {
  const c = wediPieces({ ...base, curbKey: "NOPE" }).pieces.find((p) => p.piece === "curb");
  assert.equal(c.sf, null);
});

test("wedi: unknown pan → null", () => {
  assert.equal(wediPieces({ panKey: "NOPE" }), null);
  assert.equal(wediPieces(null), null);
});

const S = { w: 60, d: 36, curbed: true, walls: [{ name: "Back", on: true, len: 60, h: 96 }, { name: "Left", on: true, len: 36, h: 96 }, { name: "Right", on: true, len: 36, h: 96 }] };

test("schluter: walls, floor, 6\"×4½\" curb", () => {
  assert.deepEqual(sf(schluterPieces(S)), { walls: 88, floor: 15, curb: 6.9 });
});

test("schluter: premade bench reads its size off the SKU; niche off its SKU", () => {
  const r = schluterPieces({ ...S, benches: [{ kind: "wall", side: "back", part: "KBSB4101220RA" }], manual: [{ sku: "KB12SN305508A1", qty: 1 }] });
  assert.deepEqual(sf(r), { walls: 94.7, floor: 15, curb: 6.9, niche: 1.7, benchTop: 5.3 });
});

test("schluter: curbless → no curb piece", () => {
  assert.equal(schluterPieces({ ...S, curbed: false }).pieces.some((p) => p.piece === "curb"), false);
});

test("jobShowers lists every placed kit with its area name and pieces", () => {
  const cats = [
    { id: "a1", name: "Master Bath", products: [{ id: "r1", kitId: "k1", wedi: { mode: "custom", cfg: { ...base, curbKey: "US3000008" } } }] },
    { id: "a2", name: "Guest", products: [{ id: "r2", kitId: "", schluter: { mode: "custom", cfg: S } }] },
  ];
  const list = jobShowers(cats);
  assert.deepEqual(list.map((s) => [s.key, s.vendor, s.areaName, s.size]), [["k1", "wedi", "Master Bath", "60×36"], ["row:r2", "schluter", "Guest", "60×36"]]);
});
```

(Niche 12"×20" = 240 sq in → 1.7 sf.)

- [ ] **Step 3: Run to verify failure**

Run: `node --test src/showersf.test.js` — Expected: FAIL, module not found.

- [ ] **Step 4: Implement** — `src/showersf.js`

```js
// Tile sq ft for each piece of a placed shower, read off its saved cfg
// (spec 2026-09-23). LAZY-CHUNK-ONLY — imports both configurator engines;
// only usejobshowers.js may load it, via import().
import { item, normBench, curbRuns, curbWidth, curbInsets, expandWallFaces, panRoomDims } from "./wedi.js";
import { classify, cfgBenches, wallArea } from "./schluter.js";
import { schluterCurb } from "./schluterdraw.js";
import { curbHeight } from "./showerdraw.js";
import { PIECES } from "./sfparts.js";
import { placedKits } from "./model.js";

const sf1 = (sqin) => Math.round((sqin / 144) * 10) / 10;

// sq: square inches per piece; 0/undefined = the shower has none (omitted),
// null = it has one we can't measure (shown as "enter manually").
const assemble = (sq) => PIECES
  .filter((d) => sq[d.piece] === null || sq[d.piece] > 0)
  .map((d) => ({ ...d, sf: sq[d.piece] === null ? null : sf1(sq[d.piece]) }));

// Bench faces count as wall tile (owner, 2026-09-23); a suspended bench shows
// its slab edge, not its height off the floor.
function benchSq(benches) {
  let face = 0, top = 0;
  benches.forEach((b) => {
    const rise = b.suspended ? b.thick : b.h;
    if (b.kind === "corner") { face += Math.hypot(b.size, b.size) * rise; top += (b.size * b.size) / 2; }
    else { face += b.len * rise; top += b.len * b.depth; }
  });
  return { face, top };
}

// The pricelist sizes a niche by its exterior; the tiled back is the
// interior (4" flange rule when the name doesn't spell it out).
function wediNicheSq(key) {
  const it = item(key);
  if (!it || it.group !== "niche") return 0;
  const m = String(it.sizeText || "").match(/interior ([\d.]+)" x ([\d.]+)"/);
  if (m) return +m[1] * +m[2];
  return it.w > 4 && it.d > 4 ? (it.w - 4) * (it.d - 4) : null;
}

export function wediPieces(cfg) {
  const pan = cfg && cfg.panKey ? item(cfg.panKey) : null;
  if (!pan) return null;
  const room = cfg.room ? { w: +cfg.room.w || 0, d: +cfg.room.d || 0 } : panRoomDims(pan);
  const walls = cfg.walls || [];
  const benches = (cfg.benches || []).map((b) => normBench(b, room));
  const bs = benchSq(benches);
  const inset = cfg.maxIn && cfg.curbKey ? curbInsets(room, walls, cfg.curbKey, cfg.tileT) : null;
  const floor = (room.w - (inset ? inset.left + inset.right : 0)) * (room.d - (inset ? inset.back + inset.entry : 0));
  const c = cfg.curbKey ? item(cfg.curbKey) : null;
  const curb = !cfg.curbKey ? 0
    : c ? curbRuns(room, walls, cfg.corners, benches).openLen * (curbWidth(c) + 2 * curbHeight(c)) : null;
  let niche = 0;
  for (const a of cfg.addons || []) {
    const s = wediNicheSq(typeof a === "string" ? a : a && a.key);
    niche = niche === null || s === null ? null : niche + s;
  }
  return {
    w: room.w, d: room.d, curbed: !!cfg.curbKey,
    pieces: assemble({
      walls: expandWallFaces(walls).reduce((s, w) => s + (+w.len || 0) * (+w.h || 0), 0) + bs.face,
      floor, curb, niche, benchTop: bs.top,
    }),
  };
}

export function schluterPieces(cfg) {
  if (!cfg || !(cfg.w > 0 && cfg.d > 0)) return null;
  const parts = (cfg.benches || []).filter((b) => b && b.part).map((b) => classify({ sku: b.part }));
  const benches = cfgBenches(cfg, parts);
  const bs = benchSq(benches);
  const c = schluterCurb(cfg, benches);
  const run = c.segs.reduce((s, x) => s + x.len, 0) + c.diags.reduce((s, x) => s + x.cut, 0);
  let niche = 0;
  // KERDI-BOARD-SN codes carry the interior in mm: KB12SN<w><h>…
  for (const m of cfg.manual || []) {
    const hit = /SN(\d{3})(\d{3})/.exec(m && m.sku || "");
    if (hit && classify({ sku: m.sku }).extra === "niche") niche += Math.round(+hit[1] / 25.4) * Math.round(+hit[2] / 25.4) * (+m.qty || 1);
  }
  return {
    w: +cfg.w, d: +cfg.d, curbed: cfg.curbed !== false,
    pieces: assemble({
      walls: wallArea(cfg) * 144 + bs.face,
      floor: cfg.w * cfg.d,
      curb: c.h > 0 ? run * (c.w + 2 * c.h) : 0,
      niche, benchTop: bs.top,
    }),
  };
}

const PIECES_FOR = { wedi: wediPieces, schluter: schluterPieces };

export function jobShowers(categories) {
  const out = [];
  for (const vendor of ["wedi", "schluter"]) {
    for (const k of placedKits(categories, vendor)) {
      let r = null;
      try { r = PIECES_FOR[vendor](k.marker.cfg); } catch { r = null; }   // a junk saved cfg must not break the grid
      if (!r) continue;
      out.push({ key: k.kitId || "row:" + k.rowId, vendor, areaName: k.areaName, size: `${r.w}×${r.d}`, curbed: r.curbed, pieces: r.pieces });
    }
  }
  return out;
}
```

- [ ] **Step 5: Confirm the Schluter niche chip writes `cfg.manual`.** Run `grep -n "qtyIn\|setManual" src/SchluterConfigurator.jsx | head`. If niches are stored somewhere other than `cfg.manual[{ sku, qty }]`, read that field instead in `schluterPieces` and adjust the test's cfg to match, keeping the expected `niche: 1.7`.

- [ ] **Step 6: Run to verify pass**

Run: `node --test src/showersf.test.js && npm test && npm run lint`
Expected: all PASS.

- [ ] **Step 7: Confirm it stays out of the boot chunk.** Run `npm run build` and check that `showersf` does not appear in the entry chunk: `grep -l "schluterPieces" dist/assets/*.js` must list only files other than `dist/assets/index-*.js`. (This will hold once Task 3 loads it via `import()`; at this step there are no importers, so it simply must not be in `index-*.js`.)

- [ ] **Step 8: Commit**

```bash
git add src/wedi.js src/showersf.js src/showersf.test.js
git commit -m "Shower tile sf: piece math for placed wedi/Schluter showers"
```

---

### Task 3: Load the showers on demand — `src/usejobshowers.js`

**Files:**
- Create: `src/usejobshowers.js`
- Create: `src/usejobshowers.test.js`
- Modify: `src/App.jsx` (import + one hook call after the `areaMenu` state, ~line 322)

**Interfaces:**
- Consumes: `jobShowers(categories)` (Task 2, via `import()`).
- Produces: `hasShowerData(categories): boolean`; `useJobShowers(categories): Shower[] | null` (null until loaded or when the job has nothing to show).

- [ ] **Step 1: Failing test** — `src/usejobshowers.test.js`

```js
import test from "node:test";
import assert from "node:assert/strict";
import { hasShowerData } from "./usejobshowers.js";

test("hasShowerData: only a placed kit or a row with a breakdown loads the engines", () => {
  assert.equal(hasShowerData(undefined), false);
  assert.equal(hasShowerData([{ products: [{ id: "a" }] }]), false);
  assert.equal(hasShowerData([{ products: [{ wedi: { part: "X" } }] }]), false);
  assert.equal(hasShowerData([{ products: [{ wedi: { mode: "kit", cfg: {} } }] }]), true);
  assert.equal(hasShowerData([{ products: [{ schluter: { mode: "kit", cfg: {} } }] }]), true);
  assert.equal(hasShowerData([{ products: [{ sfParts: [{ kind: "extra", label: "Hall", sf: 1 }] }] }]), true);
});
```

Run: `node --test src/usejobshowers.test.js` — Expected: FAIL, module not found.

- [ ] **Step 2: Implement** — `src/usejobshowers.js`

```js
// ADR 0026: the configurator engines load only when a job has a placed
// shower or a row whose sq ft came from one.
import { useEffect, useMemo, useState } from "react";

export const hasShowerData = (cats) => (cats || []).some((c) => (c.products || []).some((p) =>
  (p.wedi && p.wedi.cfg) || (p.schluter && p.schluter.cfg) || (p.sfParts && p.sfParts.length)));

export function useJobShowers(categories) {
  const [mod, setMod] = useState(null);
  const need = hasShowerData(categories);
  useEffect(() => {
    if (need && !mod) import("./showersf.js").then(setMod).catch(() => {});
  }, [need, mod]);
  return useMemo(() => (need && mod ? mod.jobShowers(categories) : null), [need, mod, categories]);
}
```

- [ ] **Step 3: Run** `node --test src/usejobshowers.test.js` — Expected: PASS.

- [ ] **Step 4: Wire into `App.jsx`.** Add `import { useJobShowers } from "./usejobshowers.js";` beside the other local imports. Directly after `const [areaMenu, setAreaMenu] = useState(null);` (~line 322) add:

```js
  const showers = useJobShowers(sel?.categories);
  const [sfMenu, setSfMenu] = useState(null); // { aid, pid, x?, y? } — a row's sq ft breakdown menu
```

Confirm there is no early `return` in `App` above this line (`awk 'NR>144 && NR<330 && /^  (if .*return|return)/' src/App.jsx` prints nothing).

- [ ] **Step 5: Verify lazy split.** Run `npm run build`, then `grep -l "schluterPieces" dist/assets/*.js` — Expected: one or more chunk files, **not** `index-*.js`.

- [ ] **Step 6: Run** `npm test && npm run lint` — Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/usejobshowers.js src/usejobshowers.test.js src/App.jsx
git commit -m "Shower tile sf: load placed-shower pieces on demand"
```

---

### Task 4: The menu + desktop wiring + chips

**Files:**
- Create: `src/SfPartsMenu.jsx`
- Modify: `src/App.jsx` — sq ft input (~line 2094), chip strip (after the `cDrift` chip, ~line 1974), menu render (beside the `areaMenu` overlay, ~line 3173), lucide import (line 2: add `Bath`)

**Interfaces:**
- Consumes: `showers`, `sfMenu`/`setSfMenu` (Task 3); `sfparts.js` exports (Task 1); `updProduct(aid, pid, patch)` (App.jsx:763).
- Produces: `SfPartsMenu({ x?, y?, product, showers, onPatch, onClose })`; `SfPartsChips({ state, onPatch })` (named exports of `SfPartsMenu.jsx`).

- [ ] **Step 1: Create `src/SfPartsMenu.jsx`**

```jsx
import { useState } from "react";
import { X } from "lucide-react";
import { sfPartsTotal, togglePiece, addExtra, removeAt, sfPatch, fmtSf } from "./sfparts.js";

export function SfPartsMenu({ x, y, product, showers, onPatch, onClose }) {
  const parts = product.sfParts || [];
  const [label, setLabel] = useState("");
  const [sf, setSf] = useState("");
  const commit = (next) => onPatch(sfPatch(next));
  const on = (s, piece) => parts.some((e) => e.kind === "shower" && e.kitId === s.key && e.piece === piece);
  const extras = parts.map((e, i) => [e, i]).filter(([e]) => e.kind === "extra");
  const add = () => { if (+sf > 0) { commit(addExtra(parts, label, +sf)); setLabel(""); setSf(""); } };
  const anchored = x != null;
  const box = anchored
    ? { left: Math.max(8, Math.min(x, window.innerWidth - 296)), top: Math.max(8, Math.min(y, window.innerHeight - 428)), width: 288 }
    : { left: 12, right: 12, bottom: 12 };
  return (
    <div className="ft-noprint fixed inset-0 z-50" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }}>
      <div className="fixed rounded-lg border border-slate-200 bg-white shadow-lg text-xs overflow-y-auto" style={{ ...box, maxHeight: 420, padding: 10 }} onClick={(e) => e.stopPropagation()}>
        {(showers || []).length === 0 && <div className="text-slate-400 mb-2">No wedi or Schluter shower on this job.</div>}
        {(showers || []).map((s) => (
          <div key={s.key} className="mb-2">
            <div className="font-semibold text-slate-700 mb-0.5">{s.areaName} — {s.size}{s.curbed ? "" : ", curbless"}</div>
            {s.pieces.map((pc) => (
              <label key={pc.piece} className={`flex items-center gap-2 py-0.5 ${pc.sf == null ? "text-slate-400" : "cursor-pointer"}`}>
                <input type="checkbox" disabled={pc.sf == null} checked={on(s, pc.piece)} onChange={() => commit(togglePiece(parts, s, pc))} />
                <span className="flex-1">{pc.label}</span>
                <span className="ft-mono">{pc.sf == null ? "size unknown — add below" : fmtSf(pc.sf)}</span>
              </label>
            ))}
          </div>
        ))}
        <div className="border-t border-slate-200 pt-2 mt-1">
          <div className="font-semibold text-slate-700 mb-1">Extra space</div>
          {extras.map(([e, i]) => (
            <div key={i} className="flex items-center gap-2 py-0.5">
              <span className="flex-1">{e.label || "Extra"}</span>
              <span className="ft-mono">{fmtSf(e.sf)}</span>
              <button onClick={() => commit(removeAt(parts, i))} title="Remove" className="text-slate-400 hover:text-slate-700"><X size={12} /></button>
            </div>
          ))}
          <div className="flex items-center gap-1 mt-1">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name (Hall)" className="ft-cell flex-1 min-w-0 border border-slate-200 rounded px-1.5 py-1" />
            <input type="number" value={sf} onChange={(e) => setSf(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="sf" className="ft-cell w-14 text-right border border-slate-200 rounded px-1.5 py-1" />
            <button onClick={add} className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50 font-medium">Add</button>
          </div>
        </div>
        <div className="border-t border-slate-200 pt-2 mt-2 flex justify-between font-semibold">
          <span>Total on this row</span><span className="ft-mono">{fmtSf(sfPartsTotal(parts))} sf</span>
        </div>
      </div>
    </div>
  );
}

export function SfPartsChips({ state, onPatch }) {
  if (!state) return null;
  const gone = state.gone;
  const goneSf = sfPartsTotal(gone);
  const keep = state.fresh.filter((e) => !gone.includes(e));
  return (<>
    {state.drift && (<>
      <span className="text-amber-600">{state.changed ? "Shower now calculates to" : "Pieces add to"} {fmtSf(state.drift.auto)} sf — this row is set to {fmtSf(state.drift.have)}</span>
      <button tabIndex={-1} onClick={() => onPatch(sfPatch(state.fresh))} className="rounded-full border border-amber-300 text-amber-700 px-2 py-0.5 hover:bg-amber-50 font-medium">Use {fmtSf(state.drift.auto)}</button>
    </>)}
    {gone.length > 0 && (<>
      <span className="text-amber-600">{[...new Set(gone.map((e) => e.where || "A"))].join(", ")} shower was removed — {fmtSf(goneSf)} sf still counted</span>
      <button tabIndex={-1} onClick={() => onPatch(sfPatch(keep))} className="rounded-full border border-amber-300 text-amber-700 px-2 py-0.5 hover:bg-amber-50 font-medium">Remove</button>
    </>)}
  </>);
}
```

- [ ] **Step 2: Right-click + tag on the desktop sq ft field.** In `App.jsx` add `Bath` to the lucide import on line 2 and `import { SfPartsMenu, SfPartsChips } from "./SfPartsMenu.jsx";` and `import { sfPartsState } from "./sfparts.js";`. Replace the sqft branch of the sq ft cell (~line 2093-2095):

```jsx
                                {p.type !== "misc" && p.qtyType === "sqft" ? (
                                  <input ref={...unchanged...} ... />
```

with (keep every existing attribute on the input; add `onContextMenu`, and the button after it):

```jsx
                                {p.type !== "misc" && p.qtyType === "sqft" ? (<>
                                  <input ref={(el) => { if (el) qtyRefs.current[p.id] = el; }} type="number" value={p.qty} onChange={(e) => updProduct(a.id, p.id, { qty: e.target.value })}
                                    onContextMenu={showers?.length || p.sfParts?.length ? (e) => { e.preventDefault(); setSfMenu({ aid: a.id, pid: p.id, x: e.clientX, y: e.clientY }); } : undefined}
                                    data-c="sf" className={`ft-cell text-right ${qtyMissing ? "ring-2 ring-inset ring-amber-400 bg-amber-50 rounded" : ""}`} placeholder="0" title={qtyMissing ? "Enter square footage" : p.sfParts?.length ? "Square feet — from the shower breakdown (right-click to change)" : showers?.length ? "Square feet — right-click to take it from a shower" : "Square feet"} />
                                  {p.sfParts?.length > 0 && (
                                    <button tabIndex={-1} onClick={(e) => setSfMenu({ aid: a.id, pid: p.id, x: e.clientX, y: e.clientY })} title="Sq ft from the shower breakdown — click to change" className="shrink-0 pr-1 text-slate-400 hover:text-slate-700"><Bath size={11} /></button>
                                  )}
                                </>) : (<>
```

(The row wrapper's own `onContextMenu` at ~line 2052 already returns early for events inside an `input`, so the line menu does not also open.)

- [ ] **Step 3: Chips.** Inside the row map, next to `const cDrift = ...` (~line 1778), add:

```js
                        const sfState = showers ? sfPartsState(p, showers) : null;
```

Then in the chip strip, right after `{cDrift && <QtyDriftChip ... />}` (~line 1974):

```jsx
                            <SfPartsChips state={sfState} onPatch={(patch) => updProduct(a.id, p.id, patch)} />
```

Check the strip's render condition (the JSX that wraps the chip strip decides whether the strip shows at all — search upward from line 1974 for the condition that includes `cDrift`) and add `|| sfState?.drift || sfState?.gone.length` to it so the strip appears when only our chip applies.

- [ ] **Step 4: Render the menu.** Beside the `areaMenu` overlay (~line 3173), add:

```jsx
      {sfMenu && (() => {
        const a = sel?.categories.find((c) => c.id === sfMenu.aid);
        const p = a?.products.find((x) => x.id === sfMenu.pid);
        return p ? <SfPartsMenu x={sfMenu.x} y={sfMenu.y} product={p} showers={showers} onPatch={(patch) => updProduct(a.id, p.id, patch)} onClose={() => setSfMenu(null)} /> : null;
      })()}
```

- [ ] **Step 5: Run** `npm test && npm run lint && npm run build` — Expected: PASS, and `grep -l "schluterPieces" dist/assets/index-*.js` prints nothing.

- [ ] **Step 6: Preview check (desktop).** Use the `run` skill to start `npm run dev` and drive it with Playwright. Local dev talks to the live Supabase project, so **do not save anything**: open an existing job that already has a wedi or Schluter shower read-only, or, if none is available, stop and ask the owner which job to use. Capture screenshots to the scratchpad: (1) right-click menu on a tile row's sq ft field; (2) the row after ticking Walls + Niche, showing the total and the Bath tag; (3) the "Pieces add to" chip after typing a different number. Any tick writes to the live row — so get the owner's OK before clicking, or demonstrate on a Quick Price job the owner designates as scratch.

- [ ] **Step 7: Commit**

```bash
git add src/SfPartsMenu.jsx src/App.jsx
git commit -m "Shower tile sf: sq ft breakdown menu, tag and drift chips (desktop)"
```

---

### Task 5: Mobile

**Files:**
- Modify: `src/mobile.jsx` — `MobileRowSheet` props (line 255) and the sq ft field (~line 443); lucide import (line 3: add `Bath`)
- Modify: `src/App.jsx` — the `<MobileRowSheet` render (~line 1983)

**Interfaces:**
- Consumes: `SfPartsMenu` (Task 4), `showers` (Task 3).

- [ ] **Step 1: Pass showers in.** In `App.jsx` on `<MobileRowSheet`, add `showers={showers}`.

- [ ] **Step 2: Mobile sheet.** In `mobile.jsx`: add `showers` to the `MobileRowSheet` destructured props; add `import { SfPartsMenu } from "./SfPartsMenu.jsx";`; add `const [sfOpen, setSfOpen] = useState(false);` at the top of `MobileRowSheet` (confirm `useState` is imported there); inside the sq ft field's `<div className="relative">`, after the SF/count toggle button, add:

```jsx
            {p.type !== "misc" && p.qtyType !== "count" && (showers?.length > 0 || p.sfParts?.length > 0) && (
              <button onClick={() => setSfOpen(true)} title="Take the sq ft from a shower" className="absolute right-10 top-1/2 -translate-y-1/2 px-1 text-slate-500"><Bath size={14} /></button>
            )}
```

and change the input's `pr-10` to `pr-16` when that button shows (`(p.type !== "misc" ? (showers?.length || p.sfParts?.length ? " pr-16" : " pr-10") : "")`). At the end of the sheet's JSX add:

```jsx
      {sfOpen && <SfPartsMenu product={p} showers={showers} onPatch={onPatch} onClose={() => setSfOpen(false)} />}
```

- [ ] **Step 3: Run** `npm test && npm run lint` — Expected: PASS.

- [ ] **Step 4: Preview check (phone width).** Same live-data rule as Task 4 Step 6. Screenshot at 390×844: the Bath icon in the sq ft field and the bottom-anchored menu open.

- [ ] **Step 5: Commit**

```bash
git add src/mobile.jsx src/App.jsx
git commit -m "Shower tile sf: breakdown menu on the phone row sheet"
```

---

### Task 6: Print line

**Files:**
- Modify: `src/EstimatePrint.jsx` (import; product row block ~line 90-98)

**Interfaces:**
- Consumes: `sfPartsText(parts)` (Task 1).

- [ ] **Step 1: Implement.** Add `import { sfPartsText } from "./sfparts.js";`. In the product `Fragment`, directly after the `{inline.length > 0 && (...)}` block and before `{p.note && ...}`, add:

```jsx
                    {p.sfParts?.length > 0 && (
                      <div style={{ padding: "0 12px 4px 24px", fontSize: 9.5, color: "var(--ft-muted)" }}>{sfPartsText(p.sfParts)}</div>
                    )}
```

- [ ] **Step 2: Run** `npm test && npm run lint` — Expected: PASS.

- [ ] **Step 3: Print preview.** On the same designated job, open Print and screenshot the tile line with the breakdown under it (e.g. *Master Bath: walls 72 · niche 1 · Hall 45*).

- [ ] **Step 4: Commit**

```bash
git add src/EstimatePrint.jsx
git commit -m "Shower tile sf: breakdown line under the tile row on print"
```

---

### Task 7: Docs

**Files:**
- Modify: `.claude/skills/floortrack-data-model/SKILL.md` (Product shape, beside `kitId`, ~line 163)
- Modify: `src/CLAUDE.md` (annotate the four new files)
- Modify: `docs/superpowers/specs/2026-09-23-shower-tile-sf-design.md` (Status → implemented)

- [ ] **Step 1: Data model.** Under the Product shape, after `kitId: "" | string,`, add:

```
           sfParts?: [ { kind:"shower", kitId, piece:"walls"|"floor"|"curb"|"niche"|"benchTop", where, sf }
                     | { kind:"extra", label, sf } ]
           // spec 2026-09-23: a sq ft row built from placed-shower pieces +
           // named extra spaces; qty = the sum when set, a typed qty is an
           // override (drift chip). kitId is the kit's kitId, or "row:<rowId>"
           // for a legacy anchor with none. sf is the last known value — a
           // removed shower's pieces keep counting until the user clicks
           // Remove. Absent on every row without a breakdown (normSfParts).
```

- [ ] **Step 2: `src/CLAUDE.md`.** Add entries, in the file's existing format and alphabetical position, for:
  - `sfparts.js` — the stored sq ft breakdown (`p.sfParts`): normalize, totals, toggles, drift state, print text. Boot-safe.
  - `showersf.js` — tile sq ft per piece of a placed wedi/Schluter shower from its saved cfg. LAZY-CHUNK-ONLY (imports both engines); loaded only by usejobshowers.js.
  - `usejobshowers.js` — `useJobShowers(categories)`: dynamic-imports showersf.js only when the job has a placed shower or a row with `sfParts` (ADR 0026).
  - `SfPartsMenu.jsx` — the sq ft breakdown menu (right-click the desktop sq ft field / Bath icon on the phone) and its drift/removed chips.

- [ ] **Step 3: Spec status.** Change `**Status:** approved by owner in chat` to `**Status:** implemented`.

- [ ] **Step 4: Commit and push**

```bash
git add .claude/skills/floortrack-data-model/SKILL.md src/CLAUDE.md docs/superpowers/specs/2026-09-23-shower-tile-sf-design.md
git commit -m "Shower tile sf: data-model + src docs"
git push -u origin claude/relaxed-meitner-xbidto
```

- [ ] **Step 5: Hand back.** Send the owner the Task 4–6 screenshots and ask whether to open a PR. Do not open one or merge without that answer.
