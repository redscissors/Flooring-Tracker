# Drain Slot (Phase 1a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the shower drain at every level, in both configurators:
- **Schluter:** family (Vario / fixed KERDI-LINE / frameless), then grate
  style / frame / finish.
- **wedi:** cover style and finish.

Swaps save the choice, never the part, so lengths re-fit the room. Both engines
also start tagging every bill line with a shared slot name.

**Architecture:**
- **`slots.js`:** a new pure module holding the slot vocabulary.
- **`schluter.js`:** gains `resolveDrain` (choice + pan width → drain lines)
  and `drainOptions` (what the popover may offer). `buildKit`'s linear branch
  calls `resolveDrain`.
- **`wedi.js`:** gains `coverPick` resolution plus translation of old markers.
- **`drainswap.jsx`:** a new shared, presentation-only stepped popover that both
  popups mount from the drain line's ⇄.

**Tech Stack:** React 18 (hooks), Vite 5, Tailwind, plain `node --test`
(`npm test` = `node --test src/*.test.js`), ESLint (`npm run lint`), Playwright
for preview proof.

**Spec:** `docs/superpowers/specs/2026-09-26-drain-slot-design.md`. Read it
first. The ticket is `.scratch/158_shower-config-roadmap/ticket.md` (Phase 1).

## Global Constraints

- **Unchanged defaults.** Existing pinned bills must not move. A build with no
  `cfg.drain` (Schluter) or no `coverPick` (wedi) must bill exactly as today.
  Run the whole suite after every task.
- **Vario default and sizing.** Vario stays the default drain. Take the shortest
  channel with `len >= panW`, cut to `panW`. `panW` is the pan's installed width,
  `benchTrayRoom(benches, cfg).w`.
- **Fixed KERDI-LINE.**
  - The bill is **channel body + grate**, nothing else.
  - The length is the **longest length ≤ panW at which both a body and a
    matching grate exist**.
  - Offset bodies (`offset: true`) pair **only** with the offset frameless grate
    (`KL1DROE`, `frameless && offset`).
- **Frameless:** the fixed body plus the frameless tileable grate
  (`frameless: true`) with matching `offset`.
- **A room change keeps the choice and re-fits the length** (the choice stores
  no SKU or length).
- **Nothing silently dropped.** An impossible choice falls back to Vario, and
  the first drain line's note says why.
- **Stock only:** the `stockPool`/`pickFrom` rule. A stocked match wins;
  otherwise the special-order match lands and the line is flagged `so`.
- **Popover layout A** (mockup `.scratch/mockups/drain-swap-2026-09-26.html`):
  Family → Grate → Frame → Finish rows, a summary strip (what · why · Δ ·
  total), and **Use this**.
- **Comments:** be conservative (root `CLAUDE.md` "Code Comments"). Explain only
  non-obvious business rules.
- **Branch and deploy rules.**
  - Never push to `main`; open a PR.
  - Never touch the live Supabase project.
  - UI changes need preview screenshots in the PR.
- **Build locally** with placeholder env:
  `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build`.
  Without it, the HTML placeholder fails the build, the same as on `main`.
- **Commit trailer:** end every commit message with the session's attribution
  lines. The harness supplies them.

---

### Task 1: Slot vocabulary and slot tags on every bill line

**Files:**
- Create: `src/slots.js`
- Create: `src/slots.test.js`
- Modify: `src/schluter.js`
  - add `slotOf` above `buildKit`
  - tag lines at the end of `buildKit` (the `return { lines: L, cand };` line)
  - tag lines in `buildFromMarker`'s manual push (`b.lines.push({ g: "Extras", … manual: true })`)
- Modify: `src/wedi.js`
  - add `wediSlotOf` near `push()`
  - tag lines at the end of `kitFor`, just before `const cfg = {`
- Modify: `src/SchluterConfigurator.jsx`
  - the manual-line push (`b.lines.push({ g: "Extras", item: e, … manual: true })`)
  - the board-plan lines (`planLines` in `applyBoardPlan`, `g: "Walls"`)
- Modify: `src/WediConfigurator.jsx`: `applySession`'s manual push (the one with
  `auto: false` and `group: bucketOf(it)`)
- Modify: `src/comparekit.js`: each row object in `wediCompareRows` (next to
  `cat: e.key === SKU.proSet ? …`) and in `schluterCompareRows` (next to
  `cat: COMPARE_CATS.includes(l.g) ? …`) gains `slot: l.slot || null`
- Test: `src/slots.test.js`, `src/schluter.test.js`, `src/wedi.test.js`, `src/comparekit.test.js`

**Interfaces:**
- Produces:
  - Compare rows carry `slot` (1d aligns on it).
  - `SLOTS: string[]`, `SLOT_LABEL: Record<string,string>`,
    `isSlot(s): boolean` (`slots.js`)
  - `slotOf(g: string, item): string` (`schluter.js`)
  - `wediSlotOf(line: {item, group}): string` (`wedi.js`)
  - Every `buildKit` and `kitFor` line gains `slot: string` ∈ `SLOTS`.

- [ ] **Step 1: Write the failing tests**

`src/slots.test.js`:
```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { SLOTS, SLOT_LABEL, isSlot } from "./slots.js";

test("every slot has a label and isSlot knows the list", () => {
  for (const s of SLOTS) assert.equal(typeof SLOT_LABEL[s], "string");
  assert.equal(isSlot("drainBody"), true);
  assert.equal(isSlot("nope"), false);
});
```

Append to `src/schluter.test.js`. Add `slotOf` to its import from
`./schluter.js`, and `import { isSlot } from "./slots.js";` at the top:
```js
test("every buildKit line carries a slot from the shared vocabulary", () => {
  for (const c of [cfg({}), cfg({ w: 48, d: 48, drain: "linear" }), cfg({ wallSys: "board", bench: "buildup" })]) {
    const b = buildKit(c, CAT, { source: "all" });
    for (const l of b.lines) assert.ok(isSlot(l.slot), `${l.g} ${l.item.sku || l.item.name} → ${l.slot}`);
  }
  const lin = buildKit(cfg({ w: 48, d: 48, drain: "linear" }), CAT, { source: "all" });
  assert.deepEqual(lin.lines.filter((l) => l.g === "Drain").map((l) => l.slot), ["drainBody", "flange"]);
  const pt = buildKit(cfg({}), CAT, { source: "all" });
  assert.deepEqual(pt.lines.filter((l) => l.g === "Drain").map((l) => l.slot), ["flange", "grate"]);
  assert.equal(slotOf("Setting", { g: "set" }), "setting");
});
```

Append to `src/wedi.test.js`. Add `wediSlotOf` to its import from
`./wedi.js`, and `import { isSlot } from "./slots.js";`:
```js
test("every kitFor line carries a slot from the shared vocabulary", () => {
  for (const pan of ["US9100004", "US9200003", "US9310001", "US9320002"]) {
    for (const l of kitFor(pan).lines) assert.ok(isSlot(l.slot), `${pan} ${l.item.key} → ${l.slot}`);
  }
  const k = kitFor("US9100004");
  assert.equal(k.lines.find((l) => l.item.group === "cover").slot, "grate");
  assert.equal(k.lines.find((l) => l.item.key === SKU.proSet).slot, "setting");
  assert.equal(wediSlotOf({ item: { group: "pan" }, group: "floor" }), "tray");
});
```

Append to `src/comparekit.test.js`:
```js
test("compare rows carry each line's shared slot", () => {
  const rows = wediCompareRows(wediBuildFor(room60x38()));
  assert.ok(rows.length && rows.every((r) => typeof r.slot === "string"));
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `node --test src/slots.test.js src/schluter.test.js src/wedi.test.js src/comparekit.test.js 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: FAIL. `slots.js` can't be found, and `slotOf`/`wediSlotOf` aren't
exported.

- [ ] **Step 3: Implement**

`src/slots.js`:
```js
// The shared bill-line slots (ticket 158 Phase 1, ADR 0049): both shower
// engines tag every line with one of these, so swaps, "+" pickers and Compare
// treat a Schluter line and a wedi line as the same kind of thing.
export const SLOTS = ["tray", "drainBody", "grate", "flange", "wallBoard", "wallMembrane",
  "seam", "corners", "niche", "bench", "curb", "setting", "extra"];

export const SLOT_LABEL = {
  tray: "Tray", drainBody: "Drain body", grate: "Grate / cover", flange: "Flange",
  wallBoard: "Wall board", wallMembrane: "Wall membrane", seam: "Seam / band",
  corners: "Corners", niche: "Niche", bench: "Bench", curb: "Curb",
  setting: "Setting material", extra: "Extras",
};

export const isSlot = (s) => SLOTS.includes(s);
```

`src/schluter.js`. Add above `export function buildKit`:
```js
const G_SLOT = { Base: "tray", Drain: "drainBody", Walls: "wallBoard", Seams: "seam", Curb: "curb", Setting: "setting", Extras: "extra" };

/** The shared slot (slots.js) a buildKit line fills: its catalog facts first, the bill group as the fallback. */
export function slotOf(g, i) {
  if (!i) return G_SLOT[g] || "extra";
  if (i.part === "flange") return "flange";
  if (i.part === "grate" || i.part === "cover") return "grate";
  if (i.part === "channel" || i.part === "body") return "drainBody";
  if (i.g === "membrane") return g === "Base" ? "tray" : "wallMembrane";
  if (i.g === "board") return g === "Extras" ? "bench" : "wallBoard";
  if (i.g === "seam") return i.corner || i.seal ? "corners" : "seam";
  if (i.g === "tray") return "tray";
  if (i.g === "curb") return "curb";
  if (i.g === "set") return "setting";
  if (i.extra === "niche") return "niche";
  if (i.extra === "bench" || i.extra === "benchkit") return "bench";
  return G_SLOT[g] || "extra";
}
```
In `buildKit`, replace `  return { lines: L, cand };` with:
```js
  for (const l of L) l.slot = slotOf(l.g, l.item);
  return { lines: L, cand };
```
In `buildFromMarker`, change the manual push to:
```js
    if (e && m.qty > 0) b.lines.push({ g: "Extras", item: e, qty: m.qty, so: !e.stock, manual: true, slot: slotOf("Extras", e) });
```

`src/wedi.js`. Add near `function push(`:
```js
const WEDI_SLOT = {
  pan: "tray", module: "tray", modExt: "tray", extension: "tray", cornerExt: "tray", kit: "tray", recess: "tray",
  curb: "curb", ramp: "curb", panel: "wallBoard", cover: "grate", coverFrame: "grate", drainKit: "drainBody",
  collar: "corners", sealant: "seam", fastener: "seam", subliner: "seam", sdry: "seam", tool: "setting",
  niche: "niche", shelf: "niche", seat: "bench", bench: "bench",
};

/** The shared slot (slots.js) a kitFor line fills. */
export function wediSlotOf(line) {
  const it = (line && line.item) || {};
  if (it.key === SKU.proSet) return "setting";
  if (line.group === "bench" && it.group === "panel") return "bench";
  return WEDI_SLOT[it.group] || "extra";
}
```
In `kitFor`, immediately before `  const cfg = {` (the marker object with
`panKey: pan.key`), add:
```js
  lines.forEach((l) => { l.slot = wediSlotOf(l); });
```
`SKU` is declared with `export const SKU = {` at module top level (around line
3752). `kitFor` runs after module init, so the reference is safe.

`src/SchluterConfigurator.jsx`:
- Manual push. Change it to
  `if (e) b.lines.push({ g: "Extras", item: e, qty: m.qty, so: !e.stock, manual: true, slot: slotOf("Extras", e) });`
  and add `slotOf` to the `./schluter.js` import.
- `applyBoardPlan`. Inside the `planLines` map's returned object, next to
  `g: "Walls",`, add `slot: "wallBoard",`.

`src/WediConfigurator.jsx`. In `applySession`, on the pushed manual line object
(it has `group: bucketOf(it), auto: false`), add
`slot: wediSlotOf({ item: it, group: bucketOf(it) })`, and add `wediSlotOf` to
the `./wedi.js` import.

In `src/comparekit.js`, add `slot: l.slot || null,` to the row object returned
in `wediCompareRows`'s map and in `schluterCompareRows`'s map.

- [ ] **Step 4: Run the whole suite**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`. No pinned total moves, because slots are data only.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint src/slots.js src/schluter.js src/wedi.js src/SchluterConfigurator.jsx src/WediConfigurator.jsx src/*.test.js
git add src/slots.js src/slots.test.js src/schluter.js src/wedi.js src/comparekit.js src/SchluterConfigurator.jsx src/WediConfigurator.jsx src/schluter.test.js src/wedi.test.js src/comparekit.test.js
git commit -m "Shared slot vocabulary; every Schluter and wedi bill line carries its slot (ticket 158 Phase 1a)"
```

---

### Task 2: `resolveDrain` — a Schluter drain choice becomes drain lines

**Files:**
- Modify: `src/schluter.js`
  - the Vario channel branch in `classifyCode` (`if (/^KLVR/.test(code)) {`)
  - add `VARIO_DESIGN`, `resolveDrain` (and the private `resolveVario`,
    `resolveFixed`) above `buildKit`
  - replace `buildKit`'s linear branch
  - return `drainFit`
- Test: `src/schluter.test.js`

**Interfaces:**
- Consumes: `stockPool` and `pickFrom` (existing, `schluter.js`); `slotOf`
  (Task 1).
- Produces:
  - `VARIO_DESIGN = { "3": "Square", "5": "Floral", "13": "Herringbone", "14": "Slant" }`
  - `resolveDrain(choice, panW, cat, { source }) → { family, len, gap, cut, lines: [{ slot, item, qty, note }], subst?: string, fallback?: string }`
  - `buildKit(cfg, …)` reads `cfg.drain` (a choice) and returns
    `{ lines, cand, drainFit }`, where `drainFit = { family, len, gap }`
    (`null` on point drains).
- Choice shape:
  `{ family: "vario"|"fixed"|"frameless", design?, style?, frame?, finish?, offset? }`
  - `style` ∈ `"solid" | "perforated" | "lock" | "floral" | "curve" | "pure" | "tile"`
  - `"lock"` matches grates with `lock: true`. Plain `"perforated"` excludes
    them.

- [ ] **Step 1: Write the failing tests**

Append to `src/schluter.test.js`. Add `resolveDrain` to the import. A small
real-shaped KERDI-LINE catalog built on the fixture:
```js
const KL = (sku, price, stock = false) => ({ sku, name: sku, price, cost: price / 1.5, stock });
const KL_ROWS = [
  ...[50, 60, 100, 120, 130, 180].map((cm) => KL(`SLRKL1V60E${cm}`, 300 + cm)),
  ...[100, 120].map((cm) => KL(`SLRKL1VO60E${cm}`, 420 + cm)),
  ...[50, 100, 120, 130, 180].map((cm) => KL(`SLRKL1AR19EB${cm}`, 280 + cm)),
  KL("SLRKL1AR19MBW130", 574.77),
  ...[100, 120].map((cm) => KL(`SLRKL1IFE23EB${cm}`, 400 + cm)),
  ...[100, 130].map((cm) => KL(`SLRKL1DRE${cm}`, 200 + cm)),
  KL("SLRKL1DROE120", 202.91),
  KL("SLRKL1BL19EB130", 535.5),
  KL("SLRKL1B19EB130", 496.59),
  KL("SLRKLVRID5EB244", 420.3),
];
const KLCAT = catalogOf([...FIXTURE_ITEMS, ...KL_ROWS]);
const skus = (r) => r.lines.map((l) => l.item.sku);

test("resolveDrain: no choice is today's Vario — shortest covering channel, cut to the pan", () => {
  const r = resolveDrain(null, 55, KLCAT, { source: "all" });
  assert.equal(r.family, "vario");
  assert.equal(r.lines[0].item.len, 96);
  assert.match(r.lines[0].note, /^cut to 55"/);
  assert.deepEqual(r.lines.map((l) => l.slot), ["drainBody", "flange"]);
});

test("resolveDrain: Vario design choice, and a design not made long enough substitutes with a note", () => {
  const r = resolveDrain({ family: "vario", design: "5", finish: "EB" }, 55, KLCAT, { source: "all" });
  assert.equal(r.lines[0].item.sku, "SLRKLVRID5EB244");
  const s = resolveDrain({ family: "vario", design: "14", finish: "EB" }, 55, KLCAT, { source: "all" });
  assert.ok(s.subst);
  assert.match(s.lines[0].note, /Slant not made/);
});

test("resolveDrain: fixed = body + grate at the longest length <= pan with both", () => {
  const r = resolveDrain({ family: "fixed", style: "solid", frame: '3/4"', finish: "EB" }, 55, KLCAT, { source: "all" });
  assert.deepEqual(skus(r), ["SLRKL1V60E130", "SLRKL1AR19EB130"]);
  assert.deepEqual([r.len, r.gap], [52, 3]);
  assert.deepEqual(r.lines.map((l) => l.slot), ["drainBody", "grate"]);
  assert.match(r.lines[1].note, /fill 3" at the ends/);
  const full = resolveDrain({ family: "fixed", style: "solid", finish: "EB" }, 72, KLCAT, { source: "all" });
  assert.deepEqual([full.len, full.gap], [72, 0]);
});

test("resolveDrain: floral steps down to 48 and says so; lock and perforated stay apart", () => {
  const r = resolveDrain({ family: "fixed", style: "floral", finish: "EB" }, 55, KLCAT, { source: "all" });
  assert.deepEqual([r.len, r.gap], [48, 7]);
  assert.match(r.lines[0].note, /stepped down from 52"/);
  assert.equal(resolveDrain({ family: "fixed", style: "lock" }, 55, KLCAT, { source: "all" }).lines[1].item.sku, "SLRKL1BL19EB130");
  assert.equal(resolveDrain({ family: "fixed", style: "perforated" }, 55, KLCAT, { source: "all" }).lines[1].item.sku, "SLRKL1B19EB130");
});

test("resolveDrain: frameless straight and offset; offset takes only the offset frameless grate", () => {
  assert.deepEqual(skus(resolveDrain({ family: "frameless" }, 55, KLCAT, { source: "all" })), ["SLRKL1V60E130", "SLRKL1DRE130"]);
  assert.deepEqual(skus(resolveDrain({ family: "frameless", offset: true }, 55, KLCAT, { source: "all" })), ["SLRKL1VO60E120", "SLRKL1DROE120"]);
  const noFramed = resolveDrain({ family: "fixed", offset: true, style: "solid" }, 55, KLCAT, { source: "all" });
  assert.equal(noFramed.family, "vario");
  assert.ok(noFramed.fallback);
});

test("resolveDrain: an impossible fixed choice falls back to Vario and names why", () => {
  const r = resolveDrain({ family: "fixed", style: "solid" }, 18, KLCAT, { source: "all" });
  assert.equal(r.family, "vario");
  assert.match(r.fallback, /under 20"/);
  assert.match(r.lines[0].note, /Vario used/);
});

test("resolveDrain: stock only prefers a stocked match and flags a special-order one", () => {
  const cat = catalogOf([...FIXTURE_ITEMS, ...KL_ROWS.map((r) => (r.sku === "SLRKL1AR19EB120" ? { ...r, stock: true } : r))]);
  const r = resolveDrain({ family: "fixed", style: "solid", finish: "EB" }, 55, cat, { source: "stock" });
  assert.equal(r.len, 52);
  assert.equal(r.lines[1].item.stock, false);
});

test("buildKit bills the chosen drain and reports drainFit; no choice bills as before", () => {
  const room = cfg({ w: 55, d: 55, drain: "linear" });
  const plain = buildKit(room, KLCAT, { source: "all" });
  assert.equal(plain.drainFit.family, "vario");
  const fixed = buildKit({ ...room, drainPick: { family: "fixed", style: "solid", finish: "EB" } }, KLCAT, { source: "all" });
  assert.deepEqual(fixed.lines.filter((l) => l.g === "Drain").map((l) => l.item.sku), ["SLRKL1V60E130", "SLRKL1AR19EB130"]);
  assert.deepEqual(fixed.drainFit, { family: "fixed", len: 52, gap: 3 });
  assert.equal(buildKit(cfg({}), KLCAT, { source: "all" }).drainFit, null);
});
```
The saved choice lives in **`cfg.drainPick`**, not `cfg.drain` as the spec
wrote it, because `cfg.drain` is already the drain TYPE (`"linear"` /
`"point"` / `"any"`). Task 9 records the rename in the spec.

- [ ] **Step 2: Run to verify they fail**

Run: `node --test src/schluter.test.js 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: the new tests FAIL (`resolveDrain` is not exported).

- [ ] **Step 3: Implement**

In `classifyCode`, replace the Vario channel branch:
```js
  if (/^KLVR/.test(code)) {
    const entry = { ...item, g: "drain", drain: "linear", part: "channel" };
    if (/122$/.test(code)) entry.len = 48;
    else if (/244$/.test(code)) entry.len = 96;
    const m = /^KLVRID(\d+)([A-Z]+?)(122|244)$/.exec(code);
    if (m) { entry.design = m[1]; entry.finish = m[2]; }
    return entry;
  }
```

Above `buildKit` (after `slotOf`), add:
```js
export const VARIO_DESIGN = { 3: "Square", 5: "Floral", 13: "Herringbone", 14: "Slant" };
const cheapestFirst = (list) => list.slice().sort((a, b) => a.len - b.len || a.price - b.price);

function resolveVario(c, panW, cat, source) {
  const all = cheapestFirst(cat.filter((i) => i.g === "drain" && i.part === "channel" && i.len));
  const want = all.filter((i) => (!c.design || i.design === c.design) && (!c.finish || i.finish === c.finish));
  const covering = (list) => stockPool(list.filter((i) => i.len >= panW), source)[0] || null;
  let ch = covering(want), subst = "";
  if (!ch && (c.design || c.finish)) {
    ch = covering(all);
    if (ch) subst = `${VARIO_DESIGN[c.design] || "that design"} not made at ${panW}" — ${VARIO_DESIGN[ch.design] || "another design"} used`;
  }
  if (!ch) ch = stockPool(all, source).slice(-1)[0] || null;
  const cut = ch && ch.len > panW ? `cut to ${panW}"`
    : ch && ch.len < panW ? `${panW}" run — the ${ch.len}" channel is the longest available, runs short`
      : "full pan width";
  const lines = [];
  if (ch) lines.push({ slot: "drainBody", item: ch, qty: 1, note: (subst ? subst + " · " : "") + cut + ' — min cut 10", IPC 2.5 gpm' });
  const fl = pickFrom(cat, (i) => i.g === "drain" && i.part === "flange" && i.drain === "linear", { source });
  if (fl) lines.push({ slot: "flange", item: fl, qty: 1, note: "incl. 4+2 corners, pipe + valve seals, couplings" });
  return { family: "vario", len: ch ? ch.len : 0, cut: panW, gap: 0, lines, ...(subst ? { subst } : {}) };
}

const STYLE_WORD = { solid: "Solid", perforated: "Perforated", lock: "Perforated with lock", floral: "Floral", curve: "Curve", pure: "Pure", tile: "Tile" };

function resolveFixed(c, panW, cat, source) {
  const offset = !!c.offset;
  const frameless = c.family === "frameless";
  const bodies = cat.filter((i) => i.g === "line" && i.part === "body" && !!i.offset === offset);
  const styleOk = (g) => (c.style === "lock" ? !!g.lock : !c.style || (g.style === c.style && !g.lock));
  const grates = cat.filter((g) => g.g === "line" && g.part === "grate" && (frameless
    ? g.frameless && !!g.offset === offset
    : !g.frameless && !offset && styleOk(g) && (!c.frame || g.frame === c.frame) && (!c.finish || (g.finish || "") === c.finish)));
  const lens = [...new Set(bodies.map((b) => b.len))].filter((l) => l <= panW).sort((a, b) => b - a);
  const pick = (list) => stockPool(list.slice().sort((a, b) => a.price - b.price), source)[0] || null;
  for (const L of lens) {
    const b = pick(bodies.filter((x) => x.len === L));
    const g = pick(grates.filter((x) => x.len === L));
    if (!b || !g) continue;
    const gap = panW - L;
    const why = L === lens[0] ? `longest that fits the ${panW}" pan`
      : `stepped down from ${lens[0]}" — ${frameless ? "frameless" : STYLE_WORD[c.style] || "this grate"} made to ${L}"`;
    return {
      family: c.family, len: L, gap, cut: 0,
      lines: [
        { slot: "drainBody", item: b, qty: 1, note: why },
        { slot: "grate", item: g, qty: 1, note: gap > 0 ? `fill ${gap}" at the ends` : "full pan width" },
      ],
    };
  }
  if (panW < 20) return { reason: `pan under 20"` };
  if (!bodies.length) return { reason: "no KERDI-LINE bodies in the books" };
  return { reason: `no ${frameless ? "frameless" : STYLE_WORD[c.style] || ""} grate matches a body length that fits` };
}

/**
 * A drain choice (the saved `cfg.drainPick`) → the drain lines for a pan of
 * width `panW`. No choice is Vario, today's default. A fixed or frameless
 * choice that can't be built falls back to Vario with the reason in `fallback`
 * and on the first line — never silently dropped.
 */
export function resolveDrain(choice, panW, cat, { source } = {}) {
  const c = choice && typeof choice === "object" ? choice : { family: "vario" };
  if (c.family === "fixed" || c.family === "frameless") {
    const r = resolveFixed(c, panW, cat, source);
    if (r.lines) return r;
    const v = resolveVario({}, panW, cat, source);
    const fallback = `${c.family === "frameless" ? "frameless" : "fixed KERDI-LINE"} can't be made here: ${r.reason}`;
    if (v.lines[0]) v.lines[0] = { ...v.lines[0], note: `${fallback} — Vario used · ${v.lines[0].note}` };
    return { ...v, fallback };
  }
  return resolveVario(c, panW, cat, source);
}
```

In `buildKit`, replace the whole `if (drain === "linear") { … } else {` linear
block (from `if (drain === "linear") {` through the
`add("Drain", pickFrom(… flange … linear …), 1, "incl. 4+2 corners, pipe + valve seals, couplings");`
line) with:
```js
  let drainFit = null;
  if (drain === "linear") {
    const r = resolveDrain(cfg.drainPick, benchTrayRoom(benches, cfg).w, cat, { source });
    for (const l of r.lines) add("Drain", l.item, l.qty, l.note);
    drainFit = { family: r.family, len: r.len, gap: r.gap };
  } else {
```
The point `else` branch stays unchanged. Change the final return to
`return { lines: L, cand, drainFit };`.

- [ ] **Step 4: Run the suite**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`. The existing Vario tests ("shortest channel at least the
pan's width", "stock-only linear channel…") must still pass unchanged; they
prove the default is untouched.

- [ ] **Step 5: Lint and commit**

```bash
npx eslint src/schluter.js src/schluter.test.js
git add src/schluter.js src/schluter.test.js
git commit -m "Schluter resolveDrain: Vario / fixed KERDI-LINE / frameless from a saved drain choice (ticket 158 Phase 1a)"
```

---

### Task 3: `drainOptions` — what the popover may offer

**Files:**
- Modify: `src/schluter.js` (add after `resolveDrain`)
- Test: `src/schluter.test.js`

**Interfaces:**
- Consumes: `resolveDrain`, `VARIO_DESIGN`, the catalog fields from Task 2.
- Produces:
  `drainOptions(choice, panW, cat, { source }) → { family, families, styles, frames, finishes, result }`
  - `families`: `[{ key, label, ok }]` for vario / fixed / frameless, plus
    offset for fixed and frameless
  - `styles`: `[{ key, label, ok, max }]`. For Vario the keys are design codes.
    For fixed, style keys. For frameless, `"straight" | "offset"`.
  - `frames`: `[{ key, ok }]` (fixed only)
  - `finishes`: `[{ key, label, ok }]`
  - `result`: `resolveDrain(choice…)`
  - `ok` means "resolves in the current family with no `fallback` and no
    `subst`".
- Produces `FINISH_LABEL = { EB: "Brushed stainless", EP: "Polished stainless", MBW: "Matte black" }`.
  Other finish codes display as their code; the owner can supply names later.

- [ ] **Step 1: Write the failing test**

```js
test("drainOptions: availability comes from resolveDrain, never a second rule", () => {
  const o = drainOptions({ family: "fixed", style: "solid", finish: "EB" }, 55, KLCAT, { source: "all" });
  assert.equal(o.family, "fixed");
  assert.deepEqual(o.families.map((f) => [f.key, f.ok]), [["vario", true], ["fixed", true], ["frameless", true]]);
  const floral = o.styles.find((s) => s.key === "floral");
  assert.equal(floral.ok, true);
  assert.equal(floral.max, 48);
  assert.equal(o.finishes.find((f) => f.key === "MBW").ok, true);
  assert.equal(o.result.len, 52);
  const v = drainOptions(null, 55, KLCAT, { source: "all" });
  assert.equal(v.family, "vario");
  assert.ok(v.styles.some((s) => s.key === "5" && s.label === "Floral"));
});
```
Add `drainOptions` to the import.

- [ ] **Step 2: Run to verify it fails**

Run: `node --test src/schluter.test.js 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: FAIL (`drainOptions` is not exported).

- [ ] **Step 3: Implement**

```js
export const FINISH_LABEL = { EB: "Brushed stainless", EP: "Polished stainless", MBW: "Matte black" };

/** The drain popover's rows for a pan of width `panW`: each chip resolved through resolveDrain. */
export function drainOptions(choice, panW, cat, { source } = {}) {
  const c = choice && typeof choice === "object" ? choice : { family: "vario" };
  const family = c.family === "fixed" || c.family === "frameless" ? c.family : "vario";
  const works = (ch) => { const r = resolveDrain(ch, panW, cat, { source }); return !r.fallback && !r.subst; };
  const families = [["vario", "Vario"], ["fixed", "Fixed"], ["frameless", "Frameless"]]
    .map(([key, label]) => ({ key, label, ok: works({ family: key }) }));
  let styles = [], frames = [], finishes = [];
  if (family === "vario") {
    const chans = cat.filter((i) => i.g === "drain" && i.part === "channel" && i.design);
    styles = [...new Set(chans.map((i) => i.design))].map((d) => ({ key: d, label: VARIO_DESIGN[d] || d, ok: works({ family, design: d }) }));
    finishes = [...new Set(chans.filter((i) => !c.design || i.design === c.design).map((i) => i.finish))]
      .map((f) => ({ key: f, label: FINISH_LABEL[f] || f, ok: works({ ...c, family, finish: f }) }));
  } else if (family === "fixed") {
    const grates = cat.filter((g) => g.g === "line" && g.part === "grate" && !g.frameless);
    const styleOf = (g) => (g.lock ? "lock" : g.style);
    styles = [...new Set(grates.map(styleOf))].map((s) => ({
      key: s, label: STYLE_WORD[s] || s, ok: works({ family, style: s }),
      max: Math.max(...grates.filter((g) => styleOf(g) === s).map((g) => g.len)),
    }));
    const inStyle = grates.filter((g) => !c.style || styleOf(g) === c.style);
    frames = [...new Set(inStyle.map((g) => g.frame).filter(Boolean))].map((f) => ({ key: f, ok: works({ ...c, family, frame: f }) }));
    finishes = [...new Set(inStyle.filter((g) => !c.frame || g.frame === c.frame).map((g) => g.finish).filter(Boolean))]
      .map((f) => ({ key: f, label: FINISH_LABEL[f] || f, ok: works({ ...c, family, finish: f }) }));
  } else {
    styles = [{ key: "straight", label: "Straight", ok: works({ family, offset: false }) },
      { key: "offset", label: "Offset", ok: works({ family, offset: true }) }];
  }
  return { family, families, styles, frames, finishes, result: resolveDrain(c, panW, cat, { source }) };
}
```

- [ ] **Step 4: Run the suite**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
npx eslint src/schluter.js src/schluter.test.js
git add src/schluter.js src/schluter.test.js
git commit -m "Schluter drainOptions: popover availability through resolveDrain (ticket 158 Phase 1a)"
```

---

### Task 4: Drawing and cut list draw a fixed channel at its real length

**Files:**
- Modify: `src/schluterdraw.js`: `schluterDiag(cfg, cand, benches)` gains a
  4th param `drainFit`
- Modify: `src/SchluterConfigurator.jsx`:
  - the `diag` memo (`schluterDiag(cfg, pickCand, normBenches)`)
  - the cut list (the block with `✂ Trim the Vario channel`)
- Test: `src/schluterdraw.test.js`

**Interfaces:**
- Consumes: `buildKit(...).drainFit` (Task 2).
- Produces: `schluterDiag(cfg, cand, benches, drainFit?)`. With
  `drainFit.family !== "vario"` and `drainFit.len`, the linear drain's `len` is
  `drainFit.len`, still centred.

- [ ] **Step 1: Failing test** (append to `src/schluterdraw.test.js`)

```js
test("a fixed KERDI-LINE channel draws at its real length, centred", () => {
  const c = cfg({ w: 55, d: 55, drain: "linear" });
  const o = schluterDiag(c, candFor(c), [], { family: "fixed", len: 52, gap: 3 });
  assert.equal(o.drain.len, 52);
  assert.equal(o.drain.x, 27.5);
  assert.equal(schluterDiag(c, candFor(c), []).drain.len, 55);
});
```

- [ ] **Step 2: Run**

Run: `node --test src/schluterdraw.test.js 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: FAIL (len 55 ≠ 52).

- [ ] **Step 3: Implement**

In `schluterdraw.js`, change the signature to
`export function schluterDiag(cfg, cand, benches, drainFit) {`, and in the
linear branch change the drain's `len`:
```js
    const fixedLen = drainFit && drainFit.family !== "vario" && drainFit.len > 0 ? drainFit.len : 0;
    drain = { type: "linear", x: round2(cx), y: round2(troom.y0 + 2.75), len: fixedLen || Math.max(10, rw), axis: "w", note: "" };
```

In `SchluterConfigurator.jsx`:
- Change the `diag` memo to
  `schluterDiag(cfg, pickCand, normBenches, build ? build.drainFit : null)`, and
  add `build` to its dependency array.
- In the cut-list block, after the `✂ Trim the Vario channel` push, add:
```js
    if (build?.drainFit && build.drainFit.family !== "vario" && build.drainFit.len)
      out.push(`▭ KERDI-LINE ${build.drainFit.len}" channel + grate${build.drainFit.gap ? ` — fill ${build.drainFit.gap}" at the ends` : ""}`);
```

- [ ] **Step 4: Run the suite** — `npm test …` → `# fail 0`.

- [ ] **Step 5: Commit**

```bash
npx eslint src/schluterdraw.js src/SchluterConfigurator.jsx src/schluterdraw.test.js
git add src/schluterdraw.js src/SchluterConfigurator.jsx src/schluterdraw.test.js
git commit -m "Schluter drawing + cut list: fixed KERDI-LINE at its real length with the fill gap (ticket 158 Phase 1a)"
```

---

### Task 5: `DrainSwapPop` — the shared stepped popover (layout A)

**Files:**
- Create: `src/drainswap.jsx`

**Interfaces:**
- Consumes: `PopMenu` from `./widgets.jsx`. Existing signature:
  `<PopMenu at={{ anchor, x, y }} width pad z onClose>`.
- Produces:
```jsx
<DrainSwapPop
  at={{ anchor, x, y }} className="sch-swappanel"   // the caller's outside-click class
  title="Swap the drain — 55″ pan"
  rows={[{ label: "Family", chips: [{ key, label, on, ok, title, onPick }] }, …]}
  summary={{ what: "52″ body + 52″ solid grate, ¾″, brushed", why: "longest that fits the 55″ pan · fill 3″ at the ends", delta: "+$496.71", total: "$1,003.31", up: true }}
  onUse={() => …} onClose={() => …} />
```
Presentation only. It holds no state and knows no engine. A chip with `ok: false`
renders dashed, can't be clicked, and shows its `title` on hover.

- [ ] **Step 1: Implement**

```jsx
// The stepped drain swap (ticket 158 Phase 1a, mockup layout A): rows of chips
// and a summary strip. Both shower popups mount it; each owns what a chip means.
import { PopMenu } from "./widgets.jsx";

export function DrainSwapPop({ at, className = "", title, rows, summary, onUse, onClose }) {
  return (
    <PopMenu at={at} width={460} pad={10} z={90} onClose={onClose}>
      <div className={className + " text-[12px]"} onClick={(e) => e.stopPropagation()} data-drain-swap>
        <div className="font-extrabold text-[13px] mb-2">{title}</div>
        {rows.filter((r) => r.chips.length).map((r) => (
          <div key={r.label} className="flex items-center gap-2 my-1.5 flex-wrap">
            <span className="w-[64px] text-[10px] font-extrabold uppercase tracking-wider text-slate-500">{r.label}</span>
            {r.chips.map((c) => (
              <button key={c.key} type="button" title={c.title || ""} disabled={!c.ok}
                onClick={() => c.ok && c.onPick()}
                className={"rounded-full px-2.5 py-0.5 font-bold border "
                  + (c.on ? "bg-[color:var(--ft-brand)] border-[color:var(--ft-brand)] text-white"
                    : c.ok ? "border-slate-400 bg-white" : "border-dashed border-slate-300 text-slate-400 cursor-not-allowed")}
                data-drain-chip={r.label + ":" + c.key}>
                {c.label}
              </button>
            ))}
          </div>
        ))}
        <div className="mt-2 rounded-lg border border-slate-200 bg-[color:var(--ft-tint)] px-2.5 py-2 flex items-center gap-2 flex-wrap">
          <div className="flex-1 min-w-[200px]">
            <b>{summary.what}</b>
            <span className="block text-[11px] text-slate-500 font-semibold">{summary.why}</span>
          </div>
          <span className={"font-extrabold tabular-nums " + (summary.up ? "text-[color:var(--s-rust,#B4552D)]" : "")}>{summary.delta} · {summary.total}</span>
          <button type="button" onClick={onUse} className="rounded-md bg-[color:var(--ft-brand)] text-white font-extrabold px-3 py-1" data-drain-use>Use this</button>
        </div>
      </div>
    </PopMenu>
  );
}
```

- [ ] **Step 2: Lint** — `npx eslint src/drainswap.jsx`. Expected: clean.
  There's no unit test for this component; Tasks 6, 8 and 9 prove it with
  preview shots.

- [ ] **Step 3: Commit**

```bash
git add src/drainswap.jsx
git commit -m "DrainSwapPop: the shared stepped drain popover (ticket 158 Phase 1a)"
```

---

### Task 6: Schluter popup — the drain choice, its marker, and the popover

**Files:**
- Modify: `src/SchluterConfigurator.jsx`
- Modify: `src/schluterpreview.jsx`: add a handful of KERDI-LINE rows so every
  family resolves in the preview. The P0-2 slice already carries straight bodies
  and `KL1AR19EB*`. Add `SLRKL1DRE130`, `SLRKL1VO60E120`, `SLRKL1DROE120` and
  `SLRKL1IFE23EB120` to the same array with EFT costs: 163.10 / 298.54 / 135.27 /
  312.35 (cost = retail ÷ 1.5).

**Interfaces:**
- Consumes: `drainOptions`, `resolveDrain`, `VARIO_DESIGN`, `FINISH_LABEL`,
  `benchTrayRoom`, `tierPrice`/`tierOf` (existing), `DrainSwapPop` (Task 5).
- Produces:
  - popup state `drainPick` (a choice or `null`)
  - `cfg.drainPick` in the cfg memo, which therefore rides `markCfg` and the
    saved marker

- [ ] **Step 1: State, seed, cfg, mode and dirty**
  - **`seedState` defaults** (the object with `swaps: {}`): add `drainPick: null`.
  - **`seedState` from the marker:** after the
    `s.swaps = cfg.swaps && …` line, add:
    ```js
    s.drainPick = cfg.drainPick && typeof cfg.drainPick === "object" ? { ...cfg.drainPick } : null;
    ```
  - **State:** next to `const [swaps, setSwaps] = useState(s0.swaps);`, add
    `const [drainPick, setDrainPick] = useState(s0.drainPick);`
  - **cfg memo:** next to `...(Object.keys(swaps).length ? { swaps } : {}),`, add
    `...(drainPick ? { drainPick } : {}),`. Add `drainPick` to that memo's
    dependency array.
  - **mode:** in the `mode` expression, append `&& !cfg.drainPick` next to
    `&& !cfg.swaps`.
  - **kitDirty:** next to `|| Object.keys(swaps).length > 0`, add
    `|| !!drainPick`.
  - **Resets:** everywhere `setSwaps({})` is called (Clear design and `pickKit`),
    also call `setDrainPick(null)`.

- [ ] **Step 2: The popover**

Next to `swapChoices`, add the drain-line test and the panel. The pan width uses
the same rule as the engine:
```js
  const isDrainLine = (l) => l.g === "Drain" && !l.noteOnly && build?.drainFit;
  const panW = benchTrayRoom(normBenches, cfg).w;
```
In the build-column line render, the `⇄` button condition becomes
`(isDrainLine(l) || swapChoices(l)) &&`. Its `onClick` sets
`setSwap({ key: e.sku || e.name, rect, anchor, drain: !!isDrainLine(l) })`.

At the top of `swapPanel`, before the existing list render, add the drain
branch. It reuses `swap` so Esc and the outside-click listener (`.sch-swappanel`)
keep working:
```js
    if (swap.drain) {
      const o = drainOptions(drainPick, panW, cat, { source });
      const cur = build.lines.filter((l) => l.g === "Drain").reduce((t, l) => t + tierOf(l.item) * l.qty, 0);
      const next = o.result.lines.reduce((t, l) => t + tierOf(l.item) * l.qty, 0);
      const d = Math.round((next - cur) * 100) / 100;
      const set = (patch) => setDrainPick((p) => ({ ...(p || { family: "vario" }), ...patch }));
      const fam = o.family;
      const rows = [
        { label: "Family", chips: o.families.map((f) => ({ key: f.key, label: f.label, ok: f.ok, on: f.key === fam,
          title: f.ok ? "" : "not made for this pan", onPick: () => setDrainPick({ family: f.key }) })) },
        { label: fam === "frameless" ? "Body" : "Grate", chips: o.styles.map((s) => ({ key: s.key,
          label: s.label + (s.max && s.max < panW ? ` · to ${s.max}″` : ""), ok: s.ok,
          on: fam === "vario" ? s.key === (drainPick?.design || "") : fam === "frameless" ? (s.key === "offset") === !!drainPick?.offset : s.key === drainPick?.style,
          title: s.ok ? "" : "not made at this length",
          onPick: () => set(fam === "vario" ? { design: s.key } : fam === "frameless" ? { offset: s.key === "offset" } : { style: s.key, frame: undefined, finish: undefined }) })) },
        { label: "Frame", chips: o.frames.map((f) => ({ key: f.key, label: f.key, ok: f.ok, on: f.key === drainPick?.frame, onPick: () => set({ frame: f.key }) })) },
        { label: "Finish", chips: o.finishes.map((f) => ({ key: f.key, label: f.label, ok: f.ok, on: f.key === drainPick?.finish,
          title: f.ok ? "" : "not made in this style / length", onPick: () => set({ finish: f.key }) })) },
      ];
      const r0 = o.result;
      const what = r0.lines.map((l) => shown(l.item.name)).join(" + ");
      const why = r0.fallback || r0.subst || (r0.lines[r0.family === "vario" ? 0 : 1]?.note || "");
      const r = swap.rect;
      return (
        <DrainSwapPop at={{ anchor: swap.anchor, x: r.right - 470, y: r.bottom + 6 }} className="sch-swappanel"
          title={`Swap the drain — ${panW}″ pan`} rows={rows}
          summary={{ what, why, delta: (d > 0 ? "+" : d < 0 ? "−" : "±") + (d ? fm(Math.abs(d)) : "0"), total: fm(next), up: d > 0 }}
          onUse={() => { setQtyOv((q) => Object.fromEntries(Object.entries(q).filter(([k]) => !k.startsWith("Drain|")))); setKitPick(false); setSwap(null); }}
          onClose={() => setSwap(null)} />
      );
    }
```
**Decision to keep:** the chips write `drainPick` live, so the bill and the
drawing behind the popover update as you click. **Use this** only closes the
popover, clears the drain lines' hand-set quantities, and moves the build off
the Kits tab (`setKitPick(false)`, the leaveKit rule). This matches the mockup,
where the summary reflects the current chips. Esc or a click outside keeps the
live choice, the same as today's swaps, which apply immediately.

Imports: add `drainOptions` to the `./schluter.js` import, and
`import { DrainSwapPop } from "./drainswap.jsx";`.

- [ ] **Step 3: Verify in the preview**

```bash
npx vite --port 5199 &
node .scratch/158_shower-config-roadmap/p1a/shoot-schluter.mjs
```
Create `.scratch/158_shower-config-roadmap/p1a/shoot-schluter.mjs`, modelled on
`.scratch/158_shower-config-roadmap/vario/shoot.mjs`:
1. Open `http://localhost:5199/schluter-preview.html` and untick Stock only.
2. Click the `[data-schluter-tray='KSLT1395S']` kit (55×55).
3. Click `[data-schluter-swapb="KLVRID3EB244"]`, or the first
   `[data-schluter-swapb]` in the Drain group, and shoot the vario popover.
4. Click `[data-drain-chip="Family:fixed"]` and shoot (52″ body + solid grate,
   fill 3″).
5. Click `[data-drain-chip="Grate:floral"]` and shoot (stepped down to 48″).
6. Click `[data-drain-chip="Family:frameless"]` then `[data-drain-chip="Body:offset"]`
   and shoot.
7. Click `[data-drain-use]` and shoot the build column plus the drawing (the
   fixed channel at its real length).

Fail on any `pageerror`. Read every PNG and check what it shows.

- [ ] **Step 4: Round trip in tests**

Append to `src/schluter.test.js`:
```js
test("a drain choice survives the marker: buildFromMarker bills the same drain", () => {
  const room = { ...cfg({ w: 55, d: 55, drain: "linear" }), drainPick: { family: "fixed", style: "solid", finish: "EB" } };
  const live = buildKit(room, KLCAT, { source: "all" });
  const back = buildFromMarker({ mode: "custom", cfg: { ...room, source: "all" } }, KLCAT);
  assert.deepEqual(back.lines.filter((l) => l.g === "Drain").map((l) => l.item.sku), live.lines.filter((l) => l.g === "Drain").map((l) => l.item.sku));
  const old = buildFromMarker({ mode: "custom", cfg: { ...cfg({ w: 55, d: 55, drain: "linear" }), source: "all" } }, KLCAT);
  assert.equal(old.drainFit.family, "vario");
});
```
Run `npm test`. Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
npx eslint src/SchluterConfigurator.jsx src/schluterpreview.jsx
git add src/SchluterConfigurator.jsx src/schluterpreview.jsx src/schluter.test.js .scratch/158_shower-config-roadmap/p1a
git commit -m "Schluter popup: drain ⇄ opens the stepped drain popover; drainPick rides the marker (ticket 158 Phase 1a)"
```

---

### Task 7: wedi engine — the cover choice and old markers

**Files:**
- Modify: `src/wedi.js`
  - add `legacyCoverPick` and `coverStyles` near `linearCoverFor`
  - in `kitFor`, the `// --- drain finish` block and the `cfg` object
  - in `buildFromMarker`, the object with `coverKey: cfg.coverKey || undefined`
- Test: `src/wedi.test.js`

**Interfaces:**
- Consumes: `linearCoverFor(channel, finish)` (existing), `item`, `group`,
  `SKU.coverSS`.
- Produces:
  - `opts.coverPick` / `cfg.coverPick`: `{ finish }` for a linear pan (the
    finish code carries the style: `P` suffix = perforated, `T` = tileable),
    `{ key }` for a point pan.
  - `legacyCoverPick(coverKey) → coverPick | undefined`
  - `coverStyles(len) → { solid: [item…], perforated: [item…], tileable: [item…] }`
- **Spec amendment:** the linear choice stores the wedi finish code alone,
  because wedi's codes already encode the style. `linearCoverFor` needs no new
  argument. Task 9 records this in the spec.

- [ ] **Step 1: Failing tests** (append to `src/wedi.test.js`; add
  `legacyCoverPick`, `coverStyles`, `buildFromMarker` to the import if they're
  missing)

```js
test("wedi cover choice: a linear pick keeps its finish and follows the channel length", () => {
  const k = kitFor("US9310001", { coverPick: { finish: "MB" } });
  const cov = k.lines.find((l) => l.item.group === "cover").item;
  assert.deepEqual([cov.finish, cov.len], ["MB", 43]);
  assert.equal(k.cfg.coverPick.finish, "MB");
  assert.equal(k.cfg.coverKey, undefined);
});

test("wedi cover: no pick writes no coverPick; the default cover still lands", () => {
  const k = kitFor("US9100004");
  assert.equal(k.cfg.coverPick, undefined);
  assert.ok(k.lines.some((l) => l.item.group === "cover"));
});

test("legacyCoverPick: an old default cover reads as no pick; a real pick keeps its finish or key", () => {
  assert.equal(legacyCoverPick(SKU.coverSS), undefined);
  const lin = group("cover").find((c) => c.sub === "linear" && c.finish === "MB");
  assert.deepEqual(legacyCoverPick(lin.key), { finish: "MB" });
  const linSS = group("cover").find((c) => c.sub === "linear" && c.finish === "SS");
  assert.equal(legacyCoverPick(linSS.key), undefined);
  const pt = group("cover").find((c) => c.sub === "point" && c.key !== SKU.coverSS);
  assert.deepEqual(legacyCoverPick(pt.key), { key: pt.key });
});

test("an old marker's coverKey reopens through buildFromMarker as the same cover", () => {
  const lin = group("cover").find((c) => c.sub === "linear" && c.finish === "MB" && c.len === 43);
  const k = kitFor("US9310001", { coverKey: lin.key });
  const back = buildFromMarker({ mode: "kit", cfg: { ...k.cfg, coverKey: lin.key, coverPick: undefined } });
  assert.equal(back.lines.find((l) => l.item.group === "cover").item.finish, "MB");
});

test("coverStyles groups a length's linear covers by style", () => {
  const s = coverStyles(43);
  assert.ok(s.solid.some((c) => c.finish === "SS"));
  assert.ok(s.perforated.some((c) => c.finish === "SSP"));
  assert.ok(s.tileable.some((c) => c.finish === "T"));
});
```
`US9310001` (3′×5′ linear base) takes the 43″ cover (`US1000085`, stainless) by default.

- [ ] **Step 2: Run** — `node --test src/wedi.test.js …` → the new tests FAIL.

- [ ] **Step 3: Implement**

Near `linearCoverFor`:
```js
/** An old marker's resolved coverKey → the choice it stands for; the recipe's own default reads as no choice. */
export function legacyCoverPick(key) {
  const it = key ? item(key) : null;
  if (!it || key === SKU.coverSS) return undefined;
  if (it.sub === "linear") return it.finish && it.finish !== "SS" ? { finish: it.finish } : undefined;
  return { key };
}

/** A channel length's linear covers by style — wedi's finish codes carry it (P = perforated, T = tileable). */
export function coverStyles(len) {
  const out = { solid: [], perforated: [], tileable: [] };
  for (const c of group("cover")) {
    if (c.sub !== "linear" || c.len !== len) continue;
    (c.finish === "T" ? out.tileable : /P$/.test(c.finish) ? out.perforated : out.solid).push(c);
  }
  return out;
}
```
In `kitFor`'s `// --- drain finish` block, replace the cover pick with:
```js
  const coverPick = opts.coverPick || legacyCoverPick(opts.coverKey);
  let cover = null;
  if (coverPick && coverPick.key) cover = item(coverPick.key);
  else if (fam === "linear") {
    const ch = pan.channel || (option && option.drain && option.drain.len) || 0;
    cover = linearCoverFor(ch, (coverPick && coverPick.finish) || opts.coverFinish || "SS");
  } else cover = item(SKU.coverSS);
```
In the marker `cfg` object, replace `coverKey: cover ? cover.key : null,` with:
```js
    ...(coverPick ? { coverPick } : {}),
```
In `buildFromMarker`, replace `coverKey: cfg.coverKey || undefined,` with:
```js
    coverPick: cfg.coverPick || legacyCoverPick(cfg.coverKey),
```

- [ ] **Step 4: Run the suite**

Run: `npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `# fail 0`. If a pinned test asserts `cfg.coverKey`, update it to
`coverPick`, but only where the kit had a cover picked. A default kit must now
have **no** `coverPick`. Record each re-pin in the commit message.

- [ ] **Step 5: Commit**

```bash
npx eslint src/wedi.js src/wedi.test.js
git add src/wedi.js src/wedi.test.js
git commit -m "wedi: the cover choice rides the marker as coverPick; old coverKeys translate (ticket 158 Phase 1a)"
```

---

### Task 8: wedi popup — cover ⇄ opens the stepped popover

**Files:**
- Modify: `src/WediConfigurator.jsx`:
  - `DEF_OPTS`
  - `seedState`'s `s.opts`
  - the `kitFor(...)` call in the `build` memo
  - `kitDirty`
  - `swapChoices` (the two `g === "cover"` branches)
  - `swapPanel`

**Interfaces:**
- Consumes: `coverStyles`, `legacyCoverPick` (Task 7), `DrainSwapPop` (Task 5),
  `FINISHES` (existing).
- Produces: `opts.coverPick` in the popup, passed to `kitFor`.

- [ ] **Step 1: Wire the choice**
  - **`DEF_OPTS`:** replace `coverKey: undefined` with `coverPick: undefined`.
  - **`seedState`:** in `s.opts`, replace `coverKey: cfg.coverKey || undefined,`
    with `coverPick: cfg.coverPick || legacyCoverPick(cfg.coverKey),`.
  - **`build` memo:** in the `kitFor(panKey, { … })` options, replace
    `coverKey: opts.coverKey,` with `coverPick: opts.coverPick,`.
  - **`kitDirty`:** replace `opts.coverKey !== undefined` with
    `opts.coverPick !== undefined`.
  - **Imports:** add `coverStyles, legacyCoverPick` to the `./wedi.js` import,
    and `import { DrainSwapPop } from "./drainswap.jsx";`.

- [ ] **Step 2: The popover**

In `swapChoices`, make both cover branches return a marker the panel
recognises:
```js
    if (g === "cover") return { drain: true };
```
In `swapPanel`, right after `const ch = swapChoices(line); if (!ch) return null;`:
```js
    if (ch.drain) {
      const cur = line.item;
      const lin = cur.sub === "linear";
      const styles = lin ? coverStyles(cur.len) : null;
      const styleOf = (c) => (c.finish === "T" ? "tileable" : /P$/.test(c.finish) ? "perforated" : "solid");
      const pickStyle = lin ? styleOf(cur) : null;
      const pool = lin ? styles[pickStyle] : group("cover").filter((c) => c.sub === "point");
      const setPick = (c) => setOpts((o) => ({ ...o, coverPick: lin ? { finish: c.finish } : { key: c.key } }));
      const rows = [
        ...(lin ? [{ label: "Style", chips: ["solid", "perforated", "tileable"].map((s) => ({ key: s, label: s[0].toUpperCase() + s.slice(1),
          ok: styles[s].length > 0, on: s === pickStyle, title: styles[s].length ? "" : `not made at ${cur.len}″`,
          onPick: () => setPick(styles[s].find((c) => c.stock) || styles[s][0]) })) }] : []),
        { label: "Finish", chips: bySource(pool).map((c) => ({ key: c.key, label: FINISHES[c.finish] || c.finish, ok: true, on: c.key === cur.key, onPick: () => setPick(c) })) },
      ];
      const d = Math.round((tierOf(cur) - tierOf(line.item)) * 100) / 100;
      const r = swap.rect;
      return (
        <DrainSwapPop at={{ anchor: swap.anchor, x: r.right - 470, y: r.bottom + 6 }} className="wedi-grown"
          title={lin ? `Linear cover — ${cur.len}″ channel` : "Drain cover — 4×4"} rows={rows}
          summary={{ what: unwedi(cur.name), why: lin ? "follows the channel length if the room changes" : "", delta: d ? fm(d) : "±0", total: fm(tierOf(cur)), up: d > 0 }}
          onUse={() => { setQtyOv((o) => { const n = { ...o }; delete n[cur.key]; return n; }); setSwap(null); }}
          onClose={() => setSwap(null)} />
      );
    }
```
The chips write `opts.coverPick` live, so the bill rebuilds and `line.item` is
already the picked cover. The Δ therefore reads ±0 once picked. That's
acceptable: the price is the line itself. **Use this** closes the popover.

- [ ] **Step 3: Verify in the preview**

Create `.scratch/158_shower-config-roadmap/p1a/shoot-wedi.mjs`:
1. Open `http://localhost:5199/wedi-preview.html` and click the first linear
   pan row in the Kits tab. Its name contains "Linear"; use
   `pg.locator('[data-wedi-pan]', { hasText: /Linear/ }).first()` or the LINEAR
   group's first row.
2. Click the ⇄ on the cover line (the `.bline` whose name contains "Cover") and
   shoot.
3. Click `[data-drain-chip="Style:perforated"]` and shoot.
4. Close the popover, switch to Custom shower, change the room width to a
   different channel length, and shoot: the cover keeps "perforated" at the new
   length.

Fail on `pageerror`. Read the PNGs.

- [ ] **Step 4: Run the suite and lint**

`npm test` → `# fail 0`; `npx eslint src/WediConfigurator.jsx` clean.

- [ ] **Step 5: Commit**

```bash
git add src/WediConfigurator.jsx .scratch/158_shower-config-roadmap/p1a
git commit -m "wedi popup: cover ⇄ opens the stepped drain popover; coverPick follows the channel (ticket 158 Phase 1a)"
```

---

### Task 9: Records, full verification, PR

**Files:**
- Create: `docs/adr/0049-configurator-swaps-remember-the-choice.md`
- Modify:
  - `docs/adr/README.md` (index row)
  - `src/CLAUDE.md` (entries for `slots.js` and `drainswap.jsx` (new),
    `schluter.js`, `schluterdraw.js`, `wedi.js`, both popups)
  - `docs/superpowers/specs/2026-09-26-drain-slot-design.md` (amendments)
  - `.scratch/158_shower-config-roadmap/ticket.md` (Phase 1: 1a DONE)

- [ ] **Step 1: ADR 0049**

Follow the format of `docs/adr/0048-one-dropdown-look.md` (Status / Date / Scope
/ Related, then Context, Decision, Consequences).
- **Context:** the Problem section of the spec.
- **Decision:**
  - Swaps save choices, not parts.
  - Engines resolve a choice per build, so lengths re-fit.
  - `SLOTS` is the one line vocabulary.
  - Old markers translate on read (`legacyCoverPick`; no `drainPick` = Vario).
  - Defaults are unchanged.
- **Consequences:** 1b to 1d extend the same pattern (curb and panel choices
  replace wedi's resolved `curbKey`/`panelKey`).

- [ ] **Step 2: Spec amendments**

At the end of the spec's Design section, add a dated "Amendments during
planning" note covering two changes:
- The Schluter choice lives in `cfg.drainPick`. `cfg.drain` is already the drain
  TYPE (`"linear"`/`"point"`/`"any"`).
- The wedi linear choice is `{ finish }`, because wedi finish codes carry the
  style (`P`/`T`).

- [ ] **Step 3: File map and ticket**

Update the `src/CLAUDE.md` entries, one short clause each, in the existing
style. Mark 1a DONE in the ticket's Phase 1 section, with the PR link once it
exists.

- [ ] **Step 4: Full verification**

```bash
npm test 2>&1 | grep -E "^not ok|^# (pass|fail)"
npm run lint
VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build 2>&1 | grep -E "built in|rror"
node .scratch/158_shower-config-roadmap/p1a/shoot-schluter.mjs
node .scratch/158_shower-config-roadmap/p1a/shoot-wedi.mjs
```
Expected: `# fail 0`, lint clean, `✓ built`, and shots with no page errors. Read
every shot before claiming anything.

- [ ] **Step 5: Commit, push, PR**

```bash
git add docs/adr/0049-configurator-swaps-remember-the-choice.md docs/adr/README.md src/CLAUDE.md docs/superpowers/specs/2026-09-26-drain-slot-design.md .scratch/158_shower-config-roadmap/ticket.md
git commit -m "ADR 0049 + records for the drain slot (ticket 158 Phase 1a)"
git push -u origin <branch>
```
Open the PR with the GitHub MCP tools. Check for a PR template first. The body
covers:
- what changed per task
- the owner decisions (spec)
- that default bills are unchanged, with proof (tests)
- the preview shots
- checks run
- "No SQL or data changes"

Subscribe to PR activity.
