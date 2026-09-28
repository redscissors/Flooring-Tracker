# Four-way Compare (Phase 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The Compare tab opens on a 2×2 grid: the same room as wedi and
Schluter, each on Board and on Membrane. The host's own cell is its live
build; the other three are house kits. Each cell shows a total, the
difference from the live build and short flag chips. A click drives today's
two-column detail; checked cells land as quote options A–D.

**Architecture:**
- **`src/comparegrid.js` (new, pure, compare chunk only).** It imports
  `comparekit.js` and never an engine, so wedi.js and schluter.js still meet
  in one module (ADR 0034 decision 1).
  - `CELLS`: the four cell keys in reading order.
  - `hostCellKey`, `opposite`, `cellLabel`: small helpers.
  - `cellFlags(brand, build, rows, plan, option)` lists the chips.
  - `cellBuild(key, ctx, { mirror, sdryPick })` builds one cell.
- **`comparekit.js` gains three engine-facing helpers and one generalization.**
  - `wediBuildFor(…, { sdryBase: "nearest" })`.
  - `wediSdryNoFit(room)`.
  - `wediOptionOf(build)` re-finds the solver option whose warnings the
    chips read.
  - `compareLayout` takes any column names.
- **`options.js`:** `compareOptionsPatch` takes `{ options: [{ lines, name }] }`
  and lands N areas lettered A, B, C… in one patch. The old
  `{ wediLines, schluterLines }` shape still reads as A = wedi, B = Schluter,
  so its tests stay untouched as the pin.
- **`CompareTab.jsx`:** builds the four cells with one `useMemo` each and
  draws the grid above the detail. The detail is the live cell vs the
  selected cell, in grid order.
  - Mirror state becomes `{ [cellKey]: state }`. It is written only by
    CompareTab through the popups' existing `setMirror`, so the popups don't
    change.
  - The S-DRY no-fit answer is shown inline under the grid.
  - The send button lands N options.
- **No engine (`wedi.js`, `schluter.js`, `sdry.js`) and no popup changes.**
  App.jsx doesn't change either: it already passes the payload straight to
  `compareOptionsPatch`.

**Tech Stack:** React 18 (hooks), Vite 5, plain `node --test` (`npm test`),
ESLint (`npm run lint`), Playwright for preview proof.

**Spec:** `docs/superpowers/specs/2026-09-29-four-way-compare-design.md` (read
it first). It builds on ADR 0034 (`docs/adr/0034-cross-vendor-compare.md`),
ADR 0051 (`docs/adr/0051-wedi-membrane-is-s-dry.md`) and ADR 0049. The ticket
is `.scratch/158_shower-config-roadmap/ticket.md` (Phase 3).

**Prototype:** every diff below was first run in a scratch worktree off
`f9f32c1` (the spec commit). There it had:
- the full suite green (1851 tests);
- lint clean and the build succeeding;
- the boot chunk free of `comparegrid`, `KERDI` and `Fundo`;
- the new p3 proof script ending "all checks passed";
- every p1a–p2 script re-run and passing, after one deliberate p1d wording
  update (Task 4).

The four diffs were then re-applied in order to a fresh checkout of `f9f32c1`
with `git apply`, the golden regenerated, and the suite re-run green.

## Global Constraints

- Never push to `main`. Every change lands through a PR from
  `claude/shower-config-phase3-4way`.
- Never touch the live Supabase project: no SQL, no data or storage writes.
- No engine edits: `src/wedi.js`, `src/schluter.js` and `src/sdry.js` stay
  byte-identical. No popup edits: `src/WediConfigurator.jsx` and
  `src/SchluterConfigurator.jsx` stay byte-identical.
- ADR 0034 decision 1: nothing on the boot path imports `comparekit.js`,
  `comparegrid.js` or `CompareTab.jsx`. `comparegrid.js` imports only
  `comparekit.js`.
- ADR 0034 decision 5: nothing new is saved. Grid state (selected, checked,
  the S-DRY answer, per-cell mirror) is session state.
- These goldens stay green and untouched: `src/wallsysgolden.test.js`,
  `src/wedimarkergolden.test.js`, `src/addedgolden.test.js`.
- Chip labels, exactly: "No tray fits — mortar bed", "No drain match",
  "No S-DRY base fits", "Channel runs short", "Deep cut", "No price",
  "Added line unmatched". Order: mortar, drain, sdry, short, deep, price,
  unmatched.
- Letters follow reading order: A = wedi Board, B = Schluter Board,
  C = wedi Membrane, D = Schluter Membrane. Only checked cells get letters,
  packed.
- Comments: conservative, matching the surrounding files (CLAUDE.md "Code
  Comments").
- Build: `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build`.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/comparekit.js` | modify | `wediInput` (private), `wediBuildFor` sdryBase "nearest", `wediSdryNoFit`, `wediOptionOf`, `compareLayout` over any column names |
| `src/comparekit.test.js` | modify | tests for the four above |
| `src/options.js` | modify | `compareOptionsPatch` takes N options |
| `src/options.test.js` | modify | N-option tests; the old tests stay as the pin |
| `src/comparegrid.js` | create | the four cells, their chips, labels, host key |
| `src/comparegrid.test.js` | create | unit tests, one per chip |
| `.scratch/158_shower-config-roadmap/tools/gen-grid-golden.mjs` | create | writes `src/comparegridgolden.js` |
| `src/comparegridgolden.js` | generated | GRID: five rooms × two hosts × four cells |
| `src/comparegridgolden.test.js` | create | pins every cell's totals, chip ids, bill |
| `src/CompareTab.jsx` | modify | the grid, per-cell mirror, S-DRY answer, N-option send |
| `.scratch/158_shower-config-roadmap/p3/shoot-grid.mjs` | create | preview proof |
| `.scratch/158_shower-config-roadmap/p1d/shoot-compare.mjs` | modify | two assertions follow the new wording |
| ADR 0034, ADR 0051, `src/CLAUDE.md`, spec, ticket, handoff | modify / create | records (Task 5) |

## Rulings made while prototyping (record them in Task 5)

1. **The old `compareOptionsPatch` shape stays readable.** A payload of
   `{ wediLines, schluterLines }` reads as two options named "wedi" and
   "Schluter". Keeping it means every existing `options.test.js` case stays
   byte-identical and pins today's output. A new test proves the two shapes
   land the same patch.
2. **`cellFlags` takes the wedi option as an argument** rather than solving
   inside. That keeps it pure and unit-testable against hand-made options:
   the derived fixture rooms never produce a "no center-drain base" warning.
   `cellBuild` supplies it through `wediOptionOf`.
3. **`wediOptionOf` re-solves** the build's saved `cfg.solve.input` and takes
   the option by id + pan. It returns null for a Kits-tab pick (no solve).
   This costs one extra wedi solve per wedi cell, only while the Compare tab
   is open.
4. **The S-DRY chip covers both no-fit answers.** It shows when
   `cfg.sdryBase === "wedi"` or `cfg.solve.id === "sdry-nearest"`. On a
   linear room the nearest base also raises "No drain match", from the
   option's "S-DRY has no linear base" warning.
5. **`compareLayout` takes any column names** (`cols: { L, R }`) instead of
   the fixed `wedi`/`schluter`. The existing calls and tests work unchanged,
   and the detail can now show two cells of the same brand.
6. **`CSS` is shadowed in CompareTab.jsx:** the file's stylesheet string is
   `const CSS`. The chip jump therefore matches `data-row-key` by attribute
   value instead of `CSS.escape`. The prototype hit a `CSS.escape is not a
   function` page error before this change.
7. **The picker title and modal rows name the cell** ("Add to wedi ·
   Building Panel · Drain", "B Schluter · KERDI membrane — 7 lines"). Two
   cells of one brand can each hold a mirror, so the brand alone is
   ambiguous. `p1d/shoot-compare.mjs`'s two assertions follow the new
   wording, and that is the only earlier-proof change.
8. **The send button reads "Check two or more cells for quote options"**
   (disabled) below two checked cells, and "Add N as quote options" at two or
   more. The confirm reads "Add options A–X". `data-compare-confirm` is kept.
9. **An unbuildable cell is unchecked and disabled.** `sendable` only counts
   checked cells that have rows.

---

### Task 1: comparekit — the grid's engine-facing helpers

**Model:** Opus. This touches `wediBuildFor`, which prices every Compare wedi
cell; the goldens are the gate.

**Files:**
- Modify: `src/comparekit.js`
- Test: `src/comparekit.test.js`

**Interfaces:**
- Produces:
  - `wediBuildFor(room, { source, tier, manual, wallSys, sdryBase })`, where
    `sdryBase` is `undefined | "wedi" | "nearest"`.
  - `wediSdryNoFit(room, { source }) → string` ("" when an S-DRY base fits).
  - `wediOptionOf(build) → option | null`, where `option.warnings` is a
    `string[]` and `option.deep` is a `boolean` or `undefined`.
  - `compareLayout(cols, plus)` with any keys: each slot row carries `r[k]`
    and `r[k + "Plus"]`.

- [ ] **Step 1: Add the failing tests.** Apply the `src/comparekit.test.js`
  hunks of the diff below (the four "Phase 3" tests and the import line).
- [ ] **Step 2: Run them and see them fail.**
  `node --test src/comparekit.test.js`. Expected: a SyntaxError that
  `wediSdryNoFit` isn't exported.
- [ ] **Step 3: Apply the `src/comparekit.js` hunks.**
- [ ] **Step 4: Verify.**
  - `node --test src/comparekit.test.js src/wallsysgolden.test.js src/wedimarkergolden.test.js src/addedgolden.test.js`
    all pass.
  - `npx eslint src/comparekit.js` is clean.
- [ ] **Step 5: Commit** — `comparekit: the grid's helpers — nearest S-DRY base, no-fit reason, the build's option, any-column layout`.

```diff
diff --git a/src/comparekit.js b/src/comparekit.js
index 83bafc0..8f55191 100644
--- a/src/comparekit.js
+++ b/src/comparekit.js
@@ -11,7 +11,7 @@
 
 import {
   solve, kitFor, item, tierPrice as wediTierPrice, round2, WEDI_ADD_PARTS, wediSlotOf,
-  catalog as wediCatalog, coverageOf as wediCoverageOf,
+  catalog as wediCatalog, coverageOf as wediCoverageOf, sdryNoFit,
 } from "./wedi.js";
 import {
   trayCandidates, buildKit, addedLines, tierPrice as schluterTierPrice, ADD_PARTS, slotOf, coverageOf as schluterCoverageOf,
@@ -56,26 +56,34 @@ export function roomFromWedi(cfg) {
   };
 }
 
+// The wedi solver input for a neutral room — what wediBuildFor solves.
+function wediInput(room, source) {
+  room = room || {};
+  return {
+    w: +room.w || 0, d: +room.d || 0,
+    curb: room.curbed ? "curbed" : "curbless",
+    drain: WEDI_DRAIN[room.drain] || "center",
+    tolerance: 0.51, drainX: 0, drainY: 0, anchor: "left", source: source,
+  };
+}
+
 /**
  * Solve the room in wedi and build the house kit for the top-ranked option —
  * the composition WediConfigurator.jsx's `solveRoom`/`build` make, minus the
  * popup's own customizations (no add-ons, benches, overrides or curb inset).
  * Under Membrane (ADR 0051) the S-DRY fit goes first; when it can't fit, a
  * wedi pan takes the floor with S-DRY walls — no prompt here, the build's
- * `cfg.sdryBase` says so. Null when nothing solves.
+ * `cfg.sdryBase` says so. `sdryBase: "nearest"` is the popup prompt's other
+ * answer: the nearest S-DRY base anyway. Null when nothing solves.
  */
 export function wediBuildFor(room, { source, tier, manual, wallSys, sdryBase } = {}) {
   room = room || {};
   const walls = (room.walls || []).filter((w) => w.on)
     .map((w) => ({ side: w.side, len: +w.len || 0, h: +w.h || 84 }));
-  const input = {
-    w: +room.w || 0, d: +room.d || 0,
-    curb: room.curbed ? "curbed" : "curbless",
-    drain: WEDI_DRAIN[room.drain] || "center",
-    tolerance: 0.51, drainX: 0, drainY: 0, anchor: "left", source: source,
-  };
+  const input = wediInput(room, source);
   const membrane = wallSys === "membrane";
-  const sdry = membrane && sdryBase !== "wedi" ? solve({ ...input, system: "sdry" })[0] : null;
+  const sdry = membrane && sdryBase !== "wedi"
+    ? solve({ ...input, system: "sdry", ...(sdryBase === "nearest" ? { nearest: true } : {}) })[0] : null;
   const option = sdry || solve(input)[0];
   if (!option) return null;
   return kitFor(option.pan.key, {
@@ -87,6 +95,21 @@ export function wediBuildFor(room, { source, tier, manual, wallSys, sdryBase } =
   });
 }
 
+/** Why no S-DRY base fits the room ("" when one does) — the grid's no-fit prompt reads it. */
+export const wediSdryNoFit = (room, { source } = {}) => sdryNoFit(wediInput(room, source));
+
+/**
+ * The solver option a wedi build was made from — its warnings and deep-cut
+ * flag are what the Compare grid's chips read. Re-solves the saved input and
+ * takes the option by id + pan; null for a Kits-tab pick (no solve) or when
+ * the option no longer comes back.
+ */
+export function wediOptionOf(build) {
+  const s = build && build.cfg && build.cfg.solve;
+  if (!s || !s.input || !build.pan) return null;
+  return solve(s.input).find((o) => o.id === s.id && o.pan && o.pan.key === build.pan.key) || null;
+}
+
 /**
  * The SchluterConfigurator `cfg` useMemo over the neutral room, plus the build
  * for its top-ranked tray. The cfg comes back beside the build because it is
@@ -296,17 +319,19 @@ export const pruneMirror = (state, hostKeys) => Object.fromEntries(Object.entrie
 /**
  * The grid: one band per shared group, one row per slot either column fills
  * (a mirror "+" counts), in slots.js order; empty slots and groups drop out.
- *   cols: { wedi: rows, schluter: rows }, plus: { wedi: entries, schluter: entries }
+ *   cols: { [col]: rows }, plus: { [col]: entries } — each slot row carries
+ *   r[col] and r[col + "Plus"] for every column named in `cols`.
  */
 export function compareLayout(cols, plus = {}) {
+  const keys = Object.keys(cols);
   const pick = (list, slot) => (list || []).filter((r) => r.slot === slot);
   const kitFirst = (rs) => [...rs.filter((r) => !r.added), ...rs.filter((r) => r.added)];
   return GROUPS.map((g) => ({
     key: g.key, label: g.label,
-    slots: g.slots.map((slot) => ({
-      slot, label: SLOT_LABEL[slot],
-      wedi: kitFirst(pick(cols.wedi, slot)), schluter: kitFirst(pick(cols.schluter, slot)),
-      wediPlus: pick(plus.wedi, slot), schluterPlus: pick(plus.schluter, slot),
-    })).filter((r) => r.wedi.length || r.schluter.length || r.wediPlus.length || r.schluterPlus.length),
+    slots: g.slots.map((slot) => {
+      const r = { slot, label: SLOT_LABEL[slot] };
+      for (const k of keys) { r[k] = kitFirst(pick(cols[k], slot)); r[k + "Plus"] = pick(plus[k], slot); }
+      return r;
+    }).filter((r) => keys.some((k) => r[k].length || r[k + "Plus"].length)),
   })).filter((g) => g.slots.length);
 }
diff --git a/src/comparekit.test.js b/src/comparekit.test.js
index d9360af..ac0cb0c 100644
--- a/src/comparekit.test.js
+++ b/src/comparekit.test.js
@@ -7,6 +7,7 @@ import {
   roomFromSchluter, roomFromWedi, wediBuildFor, schluterBuildFor,
   wediCompareRows, schluterCompareRows, compareTotals,
   hostAddedLines, mirrorParts, mirrorCandidates, mirrorPlan, mirrorRow, pruneMirror, compareLayout,
+  wediSdryNoFit, wediOptionOf,
 } from "./comparekit.js";
 import { GROUPS, SLOTS } from "./slots.js";
 import { lineItems as wediLineItems, buildFromMarker as wediFromMarker } from "./wedi.js";
@@ -426,3 +427,44 @@ test("compareLayout puts added lines after the kit's in a cell", () => {
   const cell = compareLayout({ wedi: rows, schluter: [] }).find((g) => g.key === "seams").slots[0].wedi;
   assert.deepEqual(cell.map((r) => r.name), ["k", "a"]);
 });
+
+// --- Phase 3: the grid's engine-facing helpers -------------------------------
+
+const linearRoom = () => roomFromSchluter(schCfg({ drain: "linear" }));
+
+test("wediSdryNoFit says why no S-DRY base fits, and nothing when one does", () => {
+  assert.equal(wediSdryNoFit(room60x38()), "");
+  assert.equal(wediSdryNoFit(linearRoom()), "S-DRY has no linear-drain base");
+});
+
+test("wediBuildFor sdryBase 'nearest' puts a no-fit Membrane room on the nearest S-DRY base", () => {
+  const pan = wediBuildFor(linearRoom(), { wallSys: "membrane" });
+  assert.equal(pan.cfg.sdryBase, "wedi");
+  assert.notEqual(pan.pan.sub, "sdry");
+  const near = wediBuildFor(linearRoom(), { wallSys: "membrane", sdryBase: "nearest" });
+  assert.equal(near.pan.sub, "sdry");
+  assert.equal(near.cfg.solve.id, "sdry-nearest");
+  assert.equal(near.cfg.sdryBase, undefined);
+});
+
+test("wediOptionOf re-finds the solver option a build came from; a Kits pick has none", () => {
+  const b = wediBuildFor(room60x38());
+  const o = wediOptionOf(b);
+  assert.equal(o.id, b.cfg.solve.id);
+  assert.equal(o.pan.key, b.pan.key);
+  assert.ok(Array.isArray(o.warnings));
+  const near = wediBuildFor(linearRoom(), { wallSys: "membrane", sdryBase: "nearest" });
+  assert.deepEqual(wediOptionOf(near).warnings, ["S-DRY has no linear base — a point-drain base is used"]);
+  assert.equal(wediOptionOf(kitFor("US9100007", { mode: "kit" })), null);
+  assert.equal(wediOptionOf(null), null);
+});
+
+test("compareLayout takes any two column names", () => {
+  const rows = [{ slot: "tray", added: false, key: "a" }];
+  const plus = [{ slot: "niche", hostKey: "h" }];
+  const g = compareLayout({ L: rows, R: [] }, { R: plus });
+  assert.deepEqual(g.map((x) => x.key), ["base", "niches"]);
+  assert.deepEqual(g[0].slots[0].L.map((r) => r.key), ["a"]);
+  assert.deepEqual(g[0].slots[0].R, []);
+  assert.deepEqual(g[1].slots[0].RPlus.map((e) => e.hostKey), ["h"]);
+});
```

### Task 2: options.js — land N quote options in one patch

**Model:** Sonnet (the diff is complete).

**Files:**
- Modify: `src/options.js`
- Test: `src/options.test.js` (append only; don't touch the existing cases)

**Interfaces:**
- Produces:
  `compareOptionsPatch(project, hostAreaId, { options: [{ lines, name }], label })
  → { categories, optionNames } | null`. The old
  `{ wediLines, schluterLines, label }` shape still works.

- [ ] **Step 1: Append the five N-option tests** (the `src/options.test.js`
  hunk).
- [ ] **Step 2: Run them and see them fail.** `node --test src/options.test.js`.
  Expected: the "N options land as sibling areas" test fails with a
  TypeError, because `categories` is read off `null`.
- [ ] **Step 3: Apply the `src/options.js` hunk.**
- [ ] **Step 4: Verify.** `node --test src/options.test.js` has 28 passing,
  and every original case is unchanged.
- [ ] **Step 5: Commit** — `options: compareOptionsPatch lands N quote options, lettered from A`.

```diff
diff --git a/src/options.js b/src/options.js
index c6f4d96..d096c19 100644
--- a/src/options.js
+++ b/src/options.js
@@ -66,27 +66,28 @@ export const duplicateInto = (area, slot) => {
   return { ...area, id: uid(), option: slot, products };
 };
 
-// The Compare tab (phase 5) prices one shower in both wedi and Schluter, then
-// lands each build as its own quote option. Both areas MUST land through a
-// single updateProject call — the directory's setter closes over stale state,
-// so two calls in one tick clobber each other — so this builds one patch, not
-// two writes. These are fresh sibling areas (not a copy of shared work), so
-// duplicateInto's shared-source retag rule doesn't apply here (recorded in the
-// ADR — task 7).
-export const compareOptionsPatch = (project, hostAreaId, { wediLines, schluterLines, label } = {}) => {
-  if (!(wediLines || []).length || !(schluterLines || []).length) return null;
+// The Compare tab lands each build it prices as its own quote option — two
+// since phase 5, up to four since the 4-way grid (ticket 158 Phase 3):
+// `options` is [{ lines, name }] in letter order, A first; the old
+// { wediLines, schluterLines } shape reads as A = wedi, B = Schluter. Every
+// area MUST land through a single updateProject call — the directory's setter
+// closes over stale state, so two calls in one tick clobber each other — so
+// this builds one patch, not N writes. These are fresh sibling areas (not a
+// copy of shared work), so duplicateInto's shared-source retag rule doesn't
+// apply here (ADR 0034 decision 4).
+export const compareOptionsPatch = (project, hostAreaId, { options, wediLines, schluterLines, label } = {}) => {
+  const opts = options || [{ lines: wediLines, name: "wedi" }, { lines: schluterLines, name: "Schluter" }];
+  if (!opts.length || opts.length > OPTION_SLOTS.length || opts.some((o) => !(o.lines || []).length)) return null;
   const cats = project.categories || [];
   const hostIdx = cats.findIndex((a) => a.id === hostAreaId);
   const host = hostIdx >= 0 ? cats[hostIdx] : null;
   const base = (label && label.trim()) || (host?.name && host.name.trim()) || "Shower";
-  const areaFor = (name, slot, lines) => ({
-    ...newArea(), name, option: slot,
-    products: [...stampKit(lines).map((p) => ({ ...newProduct(), ...p })), newProduct()],
-  });
-  const wediArea = areaFor(`${base} — wedi`, "A", wediLines);
-  const schluterArea = areaFor(`${base} — Schluter`, "B", schluterLines);
+  const areas = opts.map((o, i) => ({
+    ...newArea(), name: `${base} — ${o.name}`, option: OPTION_SLOTS[i],
+    products: [...stampKit(o.lines).map((p) => ({ ...newProduct(), ...p })), newProduct()],
+  }));
   const insertAt = hostIdx >= 0 ? hostIdx + 1 : cats.length;
-  const categories = [...cats.slice(0, insertAt), wediArea, schluterArea, ...cats.slice(insertAt)];
-  const optionNames = { A: "wedi", B: "Schluter", ...normOptionNames(project.optionNames) };
+  const categories = [...cats.slice(0, insertAt), ...areas, ...cats.slice(insertAt)];
+  const optionNames = { ...Object.fromEntries(opts.map((o, i) => [OPTION_SLOTS[i], o.name])), ...normOptionNames(project.optionNames) };
   return { categories, optionNames };
 };
diff --git a/src/options.test.js b/src/options.test.js
index e8c7909..eaee44e 100644
--- a/src/options.test.js
+++ b/src/options.test.js
@@ -232,3 +232,53 @@ test("returns null when both lines arrays are empty", () => {
   const host = proj.categories[1];
   assert.equal(compareOptionsPatch(proj, host.id, { wediLines: [], schluterLines: [] }), null);
 });
+
+// --- compareOptionsPatch with N options (ticket 158 Phase 3) -----------------
+
+const opt = (name, sku) => ({ name, lines: [{ ...wediLine, sku }] });
+
+test("N options land as sibling areas A, B, C… after the host, in the order given", () => {
+  const proj = hostProject();
+  const [before, host, after] = proj.categories;
+  const patch = compareOptionsPatch(proj, host.id, { options: [
+    opt("wedi · Building Panel", "W1"), opt("Schluter · KERDI-BOARD", "S1"), opt("wedi · S-DRY membrane", "W2"),
+  ] });
+  assert.deepEqual(patch.categories.map((a) => a.id === before.id ? "before" : a.id === host.id ? "host" : a.id === after.id ? "after" : a.option + " " + a.name), [
+    "before", "host",
+    "A Master Bath — wedi · Building Panel", "B Master Bath — Schluter · KERDI-BOARD", "C Master Bath — wedi · S-DRY membrane",
+    "after",
+  ]);
+  assert.deepEqual(patch.categories.slice(2, 5).map((a) => a.products[0].sku), ["W1", "S1", "W2"]);
+  assert.deepEqual(patch.optionNames, { A: "wedi · Building Panel", B: "Schluter · KERDI-BOARD", C: "wedi · S-DRY membrane" });
+});
+
+test("four options fill A–D; each area is its own kit", () => {
+  const proj = hostProject();
+  const patch = compareOptionsPatch(proj, proj.categories[1].id, { options: [opt("a", "1"), opt("b", "2"), opt("c", "3"), opt("d", "4")] });
+  const areas = patch.categories.slice(2, 6);
+  assert.deepEqual(areas.map((a) => a.option), ["A", "B", "C", "D"]);
+  assert.equal(new Set(areas.map((a) => a.products[0].kitId)).size, 4);
+});
+
+test("N options fill only empty name slots", () => {
+  const proj = hostProject({ optionNames: { B: "Mid", E: "Other" } });
+  const patch = compareOptionsPatch(proj, proj.categories[1].id, { options: [opt("a", "1"), opt("b", "2"), opt("c", "3")] });
+  assert.deepEqual(patch.optionNames, { A: "a", B: "Mid", C: "c", E: "Other" });
+});
+
+test("N options: null when the list is empty or any option has no lines", () => {
+  const proj = hostProject();
+  const host = proj.categories[1];
+  assert.equal(compareOptionsPatch(proj, host.id, { options: [] }), null);
+  assert.equal(compareOptionsPatch(proj, host.id, { options: [opt("a", "1"), { name: "b", lines: [] }] }), null);
+});
+
+test("the two-option shape and the old wedi/Schluter shape land the same patch", () => {
+  const proj = hostProject();
+  const host = proj.categories[1];
+  const strip = (p) => p.categories.map((a) => [a.name, a.option, a.products.map((x) => x.sku)]);
+  const old = compareOptionsPatch(proj, host.id, { wediLines: [wediLine], schluterLines: [schluterLine] });
+  const now = compareOptionsPatch(proj, host.id, { options: [{ name: "wedi", lines: [wediLine] }, { name: "Schluter", lines: [schluterLine] }] });
+  assert.deepEqual(strip(now), strip(old));
+  assert.deepEqual(now.optionNames, old.optionNames);
+});
```

### Task 3: comparegrid.js — the four cells and their chips, plus the golden

**Model:** Opus.

**Files:**
- Create: `src/comparegrid.js`, `src/comparegrid.test.js`,
  `.scratch/158_shower-config-roadmap/tools/gen-grid-golden.mjs`,
  `src/comparegridgolden.test.js`
- Generate: `src/comparegridgolden.js`

**Interfaces:**
- Consumes (Task 1): `wediBuildFor`, `wediOptionOf`, and the existing
  `schluterBuildFor`, `wediCompareRows`, `schluterCompareRows`,
  `compareTotals`, `mirrorPlan`, `mirrorRow`, `hostAddedLines`.
- Produces:
  - `CELLS: [{ key, brand, sys }]` in reading order.
  - `BRAND`.
  - `hostCellKey(brand, cfg) → key`.
  - `opposite(key) → key`.
  - `cellLabel(key, build) → string`.
  - `cellFlags(brand, build, rows, plan, option) → [{ id, label, rowKey }]`.
  - `cellBuild(key, ctx, { mirror, sdryPick }) → { key, brand, sys, live, build, cfg, rows, plan, totals, flags, label, name }`.
  - The `ctx` shape is `{ hostBrand, hostKey, hostBuild, hostCfg, room,
    roomOk, ready: { wedi, schluter }, cat, source, tier, mortarItem, wPct,
    sPct }`.

- [ ] **Step 1: Write the tests.** Create `src/comparegrid.test.js` from the
  diff.
- [ ] **Step 2: Run them and see them fail.**
  `node --test src/comparegrid.test.js`. Expected: `Cannot find module
  './comparegrid.js'`.
- [ ] **Step 3: Implement.** Create `src/comparegrid.js` from the diff.
- [ ] **Step 4: Verify.** `node --test src/comparegrid.test.js` gives
  13 passing.
- [ ] **Step 5: Generate the golden.**
  - Create the generator and `src/comparegridgolden.test.js` from the diff.
  - Run `node .scratch/158_shower-config-roadmap/tools/gen-grid-golden.mjs`.
    Expected: `rooms 5 grids 10`.
  - Then run `node --test src/comparegridgolden.test.js`: 2 passing.
- [ ] **Step 6: Check the golden against the prototype's figures.** Row one
  (60×38 curbed point, Schluter host) must read, in CELLS order:
  - retail 1382.65 / 883.52 / 781.3 / 671.87;
  - chips "" everywhere.

  The linear room reads chips "", "mortar", "sdry", "mortar". The 30×30 room
  reads "", "deep", "", "deep". The 100×60 room reads "", "mortar", "sdry",
  "mortar". A different figure means the task diverged from the prototype:
  stop and report, don't re-pin.
- [ ] **Step 7: Verify everything.** `npm test` is all green;
  `npx eslint src` is clean.
- [ ] **Step 8: Commit** — `comparegrid: the four-way grid's cells and chips, pinned by a golden`.

```diff
diff --git a/.scratch/158_shower-config-roadmap/tools/gen-grid-golden.mjs b/.scratch/158_shower-config-roadmap/tools/gen-grid-golden.mjs
new file mode 100644
index 0000000..f151d3a
--- /dev/null
+++ b/.scratch/158_shower-config-roadmap/tools/gen-grid-golden.mjs
@@ -0,0 +1,41 @@
+// Captures what the four-way Compare grid (ticket 158 Phase 3) prices when it
+// first lands: five rooms, each from a Schluter host and a wedi host (both on
+// their house kit), every cell's retail and builder total, its chip ids and
+// its bill. src/comparegridgolden.test.js compares later code against it.
+//   node .scratch/158_shower-config-roadmap/tools/gen-grid-golden.mjs
+import { writeFileSync } from "node:fs";
+import { FIXTURE_ITEMS } from "../../../src/schluterfixture.js";
+import { catalogOf } from "../../../src/schluter.js";
+import { wediBuildFor, schluterBuildFor } from "../../../src/comparekit.js";
+import { CELLS, hostCellKey, cellBuild } from "../../../src/comparegrid.js";
+
+const CAT = catalogOf(FIXTURE_ITEMS);
+const bag = (lines) => {
+  const q = new Map();
+  (lines || []).filter((l) => !l.noteOnly).forEach((l) => { const k = l.item.key || l.item.sku || l.item.name; q.set(k, (q.get(k) || 0) + l.qty); });
+  return [...q].map(([k, n]) => k + "x" + n).sort().join(" ");
+};
+const ROOMS = [[60, 38, true, "point"], [60, 38, true, "linear"], [48, 48, false, "point"], [30, 30, true, "point"], [100, 60, true, "point"]];
+const room = ([w, d, curbed, drain]) => ({ w, d, curbed, drain,
+  walls: ["back", "left", "right"].map((side) => ({ side, on: true, len: side === "back" ? w : d, h: 84 })) });
+const grid = [];
+for (const spec of ROOMS) for (const hostBrand of ["schluter", "wedi"]) {
+  const r = room(spec);
+  let hostBuild, hostCfg;
+  if (hostBrand === "wedi") { hostBuild = wediBuildFor(r); hostCfg = hostBuild && hostBuild.cfg; }
+  else ({ build: hostBuild, cfg: hostCfg } = schluterBuildFor(r, CAT));
+  const ctx = { hostBrand, hostKey: hostCellKey(hostBrand, hostCfg), hostBuild, hostCfg, room: r, roomOk: true,
+    ready: { wedi: true, schluter: true }, cat: CAT, source: "all", tier: "retail", mortarItem: null, wPct: 18, sPct: 8 };
+  grid.push([spec, hostBrand, CELLS.map((c) => {
+    const x = cellBuild(c.key, ctx);
+    return [x.totals.retail, x.totals.builder, x.flags.map((f) => f.id).join(","), bag(x.build && x.build.lines)];
+  })]);
+}
+const out = `// GENERATED by .scratch/158_shower-config-roadmap/tools/gen-grid-golden.mjs
+// from the first four-way Compare grid (ticket 158 Phase 3). Never hand-edit;
+// a cell that moves is a test failure, not a re-pin.
+// GRID: [[w, d, curbed, drain], hostBrand, [per cell in CELLS order: [retail, builder, chip ids, bill]]].
+export const GRID = ${JSON.stringify(grid, null, 1)};
+`;
+writeFileSync(new URL("../../../src/comparegridgolden.js", import.meta.url), out);
+console.log("rooms", ROOMS.length, "grids", grid.length);
diff --git a/src/comparegrid.js b/src/comparegrid.js
new file mode 100644
index 0000000..47fc688
--- /dev/null
+++ b/src/comparegrid.js
@@ -0,0 +1,139 @@
+// comparegrid — the four-way Compare grid (ticket 158 Phase 3): one room as
+// wedi and Schluter, each on Board and on Membrane. The host popup's own cell
+// is its live build; the other three are house kits derived fresh (ADR 0034
+// decision 3, extended).
+//
+// Imports comparekit only, never an engine: wedi.js and schluter.js still meet
+// in exactly one module (ADR 0034 decision 1). LAZY-CHUNK-ONLY, like it.
+import {
+  wediBuildFor, schluterBuildFor, wediCompareRows, schluterCompareRows, compareTotals,
+  mirrorPlan, mirrorRow, hostAddedLines, wediOptionOf,
+} from "./comparekit.js";
+
+// Reading order — quote options letter the checked cells in this order.
+export const CELLS = [
+  { key: "wedi:board", brand: "wedi", sys: "board" },
+  { key: "schluter:board", brand: "schluter", sys: "board" },
+  { key: "wedi:membrane", brand: "wedi", sys: "membrane" },
+  { key: "schluter:membrane", brand: "schluter", sys: "membrane" },
+];
+export const BRAND = { wedi: "wedi", schluter: "Schluter" };
+
+/** The cell a host popup's live build fills; absent/unknown wallSys reads as that brand's default (ADR 0051). */
+export const hostCellKey = (brand, cfg) => (brand === "wedi"
+  ? "wedi:" + (cfg && cfg.wallSys === "membrane" ? "membrane" : "board")
+  : "schluter:" + (cfg && cfg.wallSys === "board" ? "board" : "membrane"));
+
+/** Today's other column: the other brand on the host's wall system. */
+export const opposite = (key) => {
+  const [brand, sys] = key.split(":");
+  return (brand === "wedi" ? "schluter" : "wedi") + ":" + sys;
+};
+
+export function cellLabel(key, build) {
+  if (key === "wedi:board") return "Building Panel";
+  if (key === "schluter:board") return "KERDI-BOARD";
+  if (key === "schluter:membrane") return "KERDI membrane";
+  return build && build.pan && build.pan.sub !== "sdry" ? "S-DRY membrane on a wedi pan" : "S-DRY membrane";
+}
+
+// The host's hand-added lines as the SAME brand's `manual` — the other wall
+// system carries them as they are, no mirror.
+function sameBrandManual(build, brand) {
+  return hostAddedLines(build, brand).map((h) => (brand === "wedi"
+    ? { key: h.part.item.key, qty: h.qty, group: h.part.g }
+    : { sku: h.part.item.sku, qty: h.qty, g: h.part.g }));
+}
+
+// Chip order is severity order; the cell shows the first two.
+const FLAG_ORDER = ["mortar", "drain", "sdry", "short", "deep", "price", "unmatched"];
+const FLAG_LABEL = {
+  mortar: "No tray fits — mortar bed",
+  drain: "No drain match",
+  sdry: "No S-DRY base fits",
+  short: "Channel runs short",
+  deep: "Deep cut",
+  price: "No price",
+  unmatched: "Added line unmatched",
+};
+const WEDI_DRAIN_MISS = /^no \S+-drain base fits|^no base reaches|^S-DRY has no linear base/;
+
+/**
+ * What didn't map cleanly in one cell's build: [{ id, label, rowKey }], most
+ * severe first. rowKey is the detail row a chip scrolls to — the cell's Base
+ * row when the flag has no line of its own. `option` is the wedi solver option
+ * the build came from (wediOptionOf); Schluter reads its build's own `cand`.
+ */
+export function cellFlags(brand, build, rows, plan, option) {
+  rows = rows || [];
+  const keyWhere = (pred) => (rows.find(pred) || {}).key || null;
+  const baseKey = keyWhere((r) => r.group === "base") || (rows[0] && rows[0].key) || null;
+  const hit = {};
+  const note = (re) => keyWhere((r) => re.test(r.sub || ""));
+  if (brand === "schluter") {
+    const cand = build && build.cand;
+    if (cand && cand.kind === "mortar") hit.mortar = baseKey;
+    const dr = note(/can't be made here/);
+    if (dr) hit.drain = dr;
+    const sh = note(/runs short/);
+    if (sh) hit.short = sh;
+    if (cand && cand.deep) hit.deep = baseKey;
+  } else {
+    const warn = (option && option.warnings) || [];
+    if (warn.some((w) => WEDI_DRAIN_MISS.test(w))) hit.drain = keyWhere((r) => r.group === "drain") || baseKey;
+    const cfg = (build && build.cfg) || {};
+    if (cfg.wallSys === "membrane" && (cfg.sdryBase === "wedi" || (cfg.solve && cfg.solve.id === "sdry-nearest"))) hit.sdry = baseKey;
+    if (option && (option.deep || warn.some((w) => /^deep cut/.test(w)))) hit.deep = baseKey;
+  }
+  const free = keyWhere((r) => !r.noteOnly && !(r.retail > 0));
+  if (free) hit.price = free;
+  const lost = plan && plan.entries.find((e) => !e.match);
+  if (lost) hit.unmatched = lost.hostKey;
+  return FLAG_ORDER.filter((id) => id in hit).map((id) => ({ id, label: FLAG_LABEL[id], rowKey: hit[id] || baseKey }));
+}
+
+/**
+ * One grid cell. ctx (shared by all four):
+ *   { hostBrand, hostKey, hostBuild, hostCfg, room, roomOk,
+ *     ready: { wedi, schluter }, cat, source, tier, mortarItem, wPct, sPct }
+ * per-cell: { mirror } — this cell's mirror state (other-brand cells only) —
+ * and { sdryPick } — "nearest" puts a no-fit wedi Membrane cell on the
+ * nearest S-DRY base instead of a wedi pan.
+ * Returns { key, brand, sys, live, build, cfg, rows, plan, totals, flags, label, name };
+ * rows is empty when the cell can't be built.
+ */
+export function cellBuild(key, ctx, { mirror, sdryPick } = {}) {
+  const { brand, sys } = CELLS.find((c) => c.key === key);
+  const live = key === ctx.hostKey;
+  const pct = brand === "wedi" ? ctx.wPct : ctx.sPct;
+  const rowsOf = (b) => (brand === "wedi" ? wediCompareRows(b, { builderPct: pct }) : schluterCompareRows(b, { builderPct: pct }));
+  let build = null, cfg = null, rows = [], plan = null;
+  if (live) {
+    build = ctx.hostBuild || null;
+    cfg = brand === "schluter" ? ctx.hostCfg || null : null;
+    rows = rowsOf(build);
+  } else if (ctx.roomOk && ctx.ready[brand]) {
+    plan = brand === ctx.hostBrand ? null : mirrorPlan(ctx.hostBuild, ctx.hostBrand, mirror, { cat: ctx.cat, source: ctx.source });
+    const manual = plan ? plan.manual : sameBrandManual(ctx.hostBuild, brand);
+    if (brand === "wedi") {
+      build = wediBuildFor(ctx.room, {
+        source: ctx.source, tier: ctx.tier, manual, wallSys: sys,
+        ...(sys === "membrane" && sdryPick === "nearest" ? { sdryBase: "nearest" } : {}),
+      });
+    } else {
+      ({ build, cfg } = schluterBuildFor(ctx.room, ctx.cat, { source: ctx.source, mortarItem: ctx.mortarItem, manual, wallSys: sys }));
+    }
+    const kit = rowsOf(build);
+    // the other brand bills the mirrored lines summed; Compare shows one per host line
+    rows = !plan || !kit.length ? kit
+      : [...kit.filter((r) => !r.added), ...plan.entries.filter((e) => e.match).map((e) => mirrorRow(e, brand, { builderPct: pct }))];
+  }
+  const option = brand === "wedi" && rows.length ? wediOptionOf(build) : null;
+  const label = cellLabel(key, build);
+  return {
+    key, brand, sys, live, build, cfg, rows, plan,
+    totals: compareTotals(rows),
+    flags: rows.length ? cellFlags(brand, build, rows, plan, option) : [],
+    label, name: BRAND[brand] + " · " + label,
+  };
+}
diff --git a/src/comparegrid.test.js b/src/comparegrid.test.js
new file mode 100644
index 0000000..41c9c52
--- /dev/null
+++ b/src/comparegrid.test.js
@@ -0,0 +1,166 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import { FIXTURE_ITEMS } from "./schluterfixture.js";
+import { catalogOf } from "./schluter.js";
+import { wediBuildFor, schluterBuildFor, wediCompareRows, schluterCompareRows, compareTotals } from "./comparekit.js";
+import { CELLS, hostCellKey, opposite, cellLabel, cellFlags, cellBuild } from "./comparegrid.js";
+
+const CAT = catalogOf(FIXTURE_ITEMS);
+const room = (w, d, curbed, drain) => ({
+  w, d, curbed, drain,
+  walls: ["back", "left", "right"].map((side) => ({ side, on: true, len: side === "back" ? w : d, h: 84 })),
+});
+const R60 = room(60, 38, true, "point");
+const LINEAR = room(60, 38, true, "linear");
+
+// The ctx CompareTab hands every cell, around a host build.
+const ctxFor = (hostBrand, hostBuild, hostCfg, r = R60, o = {}) => ({
+  hostBrand, hostKey: hostCellKey(hostBrand, hostBrand === "wedi" ? hostBuild && hostBuild.cfg : hostCfg),
+  hostBuild, hostCfg, room: r, roomOk: r.w > 0 && r.d > 0,
+  ready: { wedi: true, schluter: true }, cat: CAT, source: "all", tier: "retail", mortarItem: null,
+  wPct: 18, sPct: 8, ...o,
+});
+const schHost = (r = R60, o = {}) => schluterBuildFor(r, CAT, o);
+const wediHost = (r = R60, o = {}) => wediBuildFor(r, o);
+
+test("CELLS run in reading order: Board row, then Membrane row, wedi before Schluter", () => {
+  assert.deepEqual(CELLS.map((c) => c.key), ["wedi:board", "schluter:board", "wedi:membrane", "schluter:membrane"]);
+});
+
+test("hostCellKey reads each brand's wallSys; absent is that brand's default", () => {
+  assert.equal(hostCellKey("wedi", {}), "wedi:board");
+  assert.equal(hostCellKey("wedi", { wallSys: "membrane" }), "wedi:membrane");
+  assert.equal(hostCellKey("wedi", null), "wedi:board");
+  assert.equal(hostCellKey("schluter", {}), "schluter:membrane");
+  assert.equal(hostCellKey("schluter", { wallSys: "board" }), "schluter:board");
+  assert.equal(opposite("wedi:board"), "schluter:board");
+  assert.equal(opposite("schluter:membrane"), "wedi:membrane");
+});
+
+test("cellLabel names each system, and S-DRY walls on a wedi pan say so", () => {
+  assert.equal(cellLabel("wedi:board", null), "Building Panel");
+  assert.equal(cellLabel("schluter:board", null), "KERDI-BOARD");
+  assert.equal(cellLabel("schluter:membrane", null), "KERDI membrane");
+  assert.equal(cellLabel("wedi:membrane", wediBuildFor(R60, { wallSys: "membrane" })), "S-DRY membrane");
+  assert.equal(cellLabel("wedi:membrane", wediBuildFor(LINEAR, { wallSys: "membrane" })), "S-DRY membrane on a wedi pan");
+});
+
+test("the live cell is the host build as it stands; the other three are house kits", () => {
+  const { build, cfg } = schHost();
+  const ctx = ctxFor("schluter", build, cfg);
+  const cells = CELLS.map((c) => cellBuild(c.key, ctx));
+  assert.deepEqual(cells.map((c) => c.live), [false, false, false, true]);
+  assert.equal(cells[3].build, build);
+  assert.deepEqual(cells[3].rows, schluterCompareRows(build, { builderPct: 8 }));
+  assert.equal(cells[0].totals.retail, compareTotals(wediCompareRows(wediBuildFor(R60), { builderPct: 18 })).retail);
+  assert.equal(cells[1].totals.retail, compareTotals(schluterCompareRows(schHost(R60, { wallSys: "board" }).build, { builderPct: 8 })).retail);
+  assert.equal(cells[2].totals.retail, compareTotals(wediCompareRows(wediBuildFor(R60, { wallSys: "membrane" }), { builderPct: 18 })).retail);
+  assert.ok(cells.every((c) => c.rows.length > 0));
+  assert.deepEqual(cells.map((c) => c.name), ["wedi · Building Panel", "Schluter · KERDI-BOARD", "wedi · S-DRY membrane", "Schluter · KERDI membrane"]);
+});
+
+test("a cell waits on its brand's catalog and the room", () => {
+  const { build, cfg } = schHost();
+  const notReady = ctxFor("schluter", build, cfg, R60, { ready: { wedi: false, schluter: true } });
+  assert.equal(cellBuild("wedi:board", notReady).rows.length, 0);
+  assert.equal(cellBuild("schluter:board", notReady).rows.length > 0, true);
+  const noRoom = ctxFor("schluter", build, cfg, room(0, 0, true, "point"));
+  assert.equal(cellBuild("schluter:board", noRoom).rows.length, 0);
+  assert.deepEqual(cellBuild("wedi:board", noRoom).flags, []);
+  // the live cell never waits — it is what the popup has on screen
+  assert.equal(cellBuild("schluter:membrane", noRoom).build, build);
+});
+
+test("same brand, other wall system: the host's added lines carry as they are, no mirror", () => {
+  const manual = [{ sku: "KB12SN305508A1", qty: 2, g: "Extras" }];
+  const { build, cfg } = schHost(R60, { manual });
+  const c = cellBuild("schluter:board", ctxFor("schluter", build, cfg));
+  assert.equal(c.plan, null);
+  assert.deepEqual(c.build.lines.filter((l) => l.manual).map((l) => [l.item.sku, l.qty]), [["KB12SN305508A1", 2]]);
+  assert.deepEqual(c.rows.filter((r) => r.added).map((r) => r.key), ["Extras|KB12SN305508A1"]);
+
+  const w = wediHost(R60, { manual: [{ key: "US3000005", qty: 1, group: "addon" }] });
+  const wc = cellBuild("wedi:membrane", ctxFor("wedi", w, null));
+  assert.deepEqual(wc.build.lines.filter((l) => l.added).map((l) => [l.item.key, l.qty]), [["US3000005", 1]]);
+});
+
+test("other brand: each cell mirrors the host's added lines from its own state", () => {
+  const { build, cfg } = schHost(R60, { manual: [{ sku: "KB12SN305508A1", qty: 1, g: "Extras" }] });
+  const ctx = ctxFor("schluter", build, cfg);
+  const auto = cellBuild("wedi:board", ctx);
+  assert.deepEqual(auto.plan.entries.map((e) => e.kind), ["matched"]);
+  assert.deepEqual(auto.rows.filter((r) => r.mirror).map((r) => r.hostKey), ["Extras|KB12SN305508A1"]);
+  const dropped = cellBuild("wedi:membrane", ctx, { mirror: { "Extras|KB12SN305508A1": { dropped: true } } });
+  assert.deepEqual(dropped.plan.entries.map((e) => e.kind), ["dropped"]);
+  assert.equal(dropped.rows.some((r) => r.mirror), false);
+  assert.deepEqual(dropped.flags.map((f) => [f.id, f.rowKey]), [["unmatched", "Extras|KB12SN305508A1"]]);
+  // the Board cell's own state is untouched by the Membrane cell's drop
+  assert.deepEqual(cellBuild("wedi:board", ctx).flags, []);
+});
+
+test("S-DRY no-fit: the wedi Membrane cell prices a wedi pan + S-DRY walls, flagged; 'nearest' moves it", () => {
+  const { build, cfg } = schHost(LINEAR);
+  const ctx = ctxFor("schluter", build, cfg, LINEAR);
+  const pan = cellBuild("wedi:membrane", ctx);
+  assert.equal(pan.build.cfg.sdryBase, "wedi");
+  assert.equal(pan.label, "S-DRY membrane on a wedi pan");
+  assert.deepEqual(pan.flags.map((f) => f.id), ["sdry"]);
+  const near = cellBuild("wedi:membrane", ctx, { sdryPick: "nearest" });
+  assert.equal(near.build.pan.sub, "sdry");
+  assert.equal(near.build.cfg.solve.id, "sdry-nearest");
+  // a point base under a linear room is a drain miss as well as a no-fit
+  assert.deepEqual(near.flags.map((f) => f.id), ["drain", "sdry"]);
+  // the pick only ever moves the wedi Membrane cell
+  assert.equal(cellBuild("wedi:board", ctx, { sdryPick: "nearest" }).build.pan.key, cellBuild("wedi:board", ctx).build.pan.key);
+});
+
+test("a room no Schluter tray fits flags the mortar bed at its Base row", () => {
+  const { build, cfg } = schHost(LINEAR);
+  const c = cellBuild("schluter:board", ctxFor("schluter", build, cfg, LINEAR));
+  assert.equal(c.flags[0].id, "mortar");
+  assert.equal(c.flags[0].label, "No tray fits — mortar bed");
+  assert.equal(c.rows.find((r) => r.key === c.flags[0].rowKey).group, "base");
+});
+
+// --- cellFlags over hand-made rows: one case per chip ------------------------
+
+const row = (o) => ({ group: "base", slot: "tray", key: "Base|T1", sub: "", noteOnly: false, retail: 100, ...o });
+
+test("Schluter chips: mortar, drain fallback, channel short, deep cut", () => {
+  const rows = [
+    row({}),
+    row({ group: "drain", slot: "drainBody", key: "Drain|D1", sub: "KLV · fixed KERDI-LINE can't be made here: no grate — Vario used" }),
+    row({ group: "drain", slot: "drainBody", key: "Drain|D2", sub: 'KLV · 60" run — the 48" channel is the longest available, runs short' }),
+  ];
+  assert.deepEqual(cellFlags("schluter", { cand: { kind: "mortar" } }, rows, null).map((f) => [f.id, f.rowKey]),
+    [["mortar", "Base|T1"], ["drain", "Drain|D1"], ["short", "Drain|D2"]]);
+  assert.deepEqual(cellFlags("schluter", { cand: { kind: "cut", deep: true } }, [row({})], null).map((f) => f.id), ["deep"]);
+  assert.deepEqual(cellFlags("schluter", { cand: { kind: "exact", deep: false } }, [row({})], null), []);
+});
+
+test("wedi chips read the solver option: drain miss, deep cut; S-DRY no-fit reads the cfg", () => {
+  const rows = [row({ key: "pan|P1" }), row({ group: "drain", slot: "drainBody", key: "drain|X1" })];
+  const miss = { warnings: ["no center-drain base fits this room — this is a offset-drain base floated to the plumbing"] };
+  assert.deepEqual(cellFlags("wedi", {}, rows, null, miss).map((f) => [f.id, f.rowKey]), [["drain", "drain|X1"]]);
+  assert.deepEqual(cellFlags("wedi", {}, rows, null, { warnings: ['no base reaches 30", 20" — x'] }).map((f) => f.id), ["drain"]);
+  assert.deepEqual(cellFlags("wedi", {}, rows, null, { deep: true, warnings: [] }).map((f) => f.id), ["deep"]);
+  assert.deepEqual(cellFlags("wedi", {}, rows, null, { warnings: ['deep cut — 8" comes off a side'] }).map((f) => f.id), ["deep"]);
+  assert.deepEqual(cellFlags("wedi", { cfg: { wallSys: "membrane", sdryBase: "wedi" } }, rows, null, null).map((f) => [f.id, f.rowKey]), [["sdry", "pan|P1"]]);
+  assert.deepEqual(cellFlags("wedi", { cfg: { wallSys: "membrane", solve: { id: "sdry-nearest" } } }, rows, null, null).map((f) => f.id), ["sdry"]);
+  // ordinary install notes are not chips
+  assert.deepEqual(cellFlags("wedi", {}, rows, null, { warnings: ["0 seams — set every joint in wedi Joint Sealant"] }), []);
+});
+
+test("a billed $0 row is 'No price'; a $0 note row is not", () => {
+  const rows = [row({}), row({ key: "Seams|S1", group: "seams", retail: 0 }), row({ key: "note|backer", noteOnly: true, retail: 0 })];
+  assert.deepEqual(cellFlags("schluter", {}, rows, null).map((f) => [f.id, f.rowKey]), [["price", "Seams|S1"]]);
+  assert.deepEqual(cellFlags("schluter", {}, [row({}), row({ key: "note|backer", noteOnly: true, retail: 0 })], null), []);
+});
+
+test("chips come most severe first, one per kind", () => {
+  const rows = [row({ retail: 0 }), row({ key: "Base|T2", retail: 0 })];
+  const plan = { entries: [{ hostKey: "h1", match: null }, { hostKey: "h2", match: null }] };
+  const f = cellFlags("schluter", { cand: { kind: "mortar", deep: true } }, rows, plan);
+  assert.deepEqual(f.map((x) => x.id), ["mortar", "deep", "price", "unmatched"]);
+  assert.equal(f.find((x) => x.id === "unmatched").rowKey, "h1");
+});
diff --git a/src/comparegridgolden.test.js b/src/comparegridgolden.test.js
new file mode 100644
index 0000000..a0b40ef
--- /dev/null
+++ b/src/comparegridgolden.test.js
@@ -0,0 +1,38 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import { FIXTURE_ITEMS } from "./schluterfixture.js";
+import { catalogOf } from "./schluter.js";
+import { wediBuildFor, schluterBuildFor } from "./comparekit.js";
+import { CELLS, hostCellKey, cellBuild } from "./comparegrid.js";
+import { GRID } from "./comparegridgolden.js";
+
+// Ticket 158 Phase 3: what every cell of the four-way grid priced, chipped and
+// billed when it landed, from either brand's host.
+const CAT = catalogOf(FIXTURE_ITEMS);
+const bag = (lines) => {
+  const q = new Map();
+  (lines || []).filter((l) => !l.noteOnly).forEach((l) => { const k = l.item.key || l.item.sku || l.item.name; q.set(k, (q.get(k) || 0) + l.qty); });
+  return [...q].map(([k, n]) => k + "x" + n).sort().join(" ");
+};
+const room = ([w, d, curbed, drain]) => ({ w, d, curbed, drain,
+  walls: ["back", "left", "right"].map((side) => ({ side, on: true, len: side === "back" ? w : d, h: 84 })) });
+
+test("every grid cell prices, chips and bills as when it landed", () => {
+  for (const [spec, hostBrand, cells] of GRID) {
+    const r = room(spec);
+    let hostBuild, hostCfg;
+    if (hostBrand === "wedi") { hostBuild = wediBuildFor(r); hostCfg = hostBuild && hostBuild.cfg; }
+    else ({ build: hostBuild, cfg: hostCfg } = schluterBuildFor(r, CAT));
+    const ctx = { hostBrand, hostKey: hostCellKey(hostBrand, hostCfg), hostBuild, hostCfg, room: r, roomOk: true,
+      ready: { wedi: true, schluter: true }, cat: CAT, source: "all", tier: "retail", mortarItem: null, wPct: 18, sPct: 8 };
+    CELLS.forEach((c, i) => {
+      const x = cellBuild(c.key, ctx);
+      assert.deepEqual([x.totals.retail, x.totals.builder, x.flags.map((f) => f.id).join(","), bag(x.build && x.build.lines)],
+        cells[i], `${spec.join(" ")} from ${hostBrand}: ${c.key}`);
+    });
+  }
+});
+
+test("a room reads the same from either host: the grid is symmetric on house kits", () => {
+  for (let i = 0; i < GRID.length; i += 2) assert.deepEqual(GRID[i][2], GRID[i + 1][2], GRID[i][0].join(" "));
+});
```

### Task 4: CompareTab — the grid, per-cell mirror, the S-DRY answer, N options; proof

**Model:** Opus. The file is stateful, and a review follows.

**Files:**
- Modify: `src/CompareTab.jsx`
- Create: `.scratch/158_shower-config-roadmap/p3/shoot-grid.mjs`
- Modify: `.scratch/158_shower-config-roadmap/p1d/shoot-compare.mjs`
  (two assertions, ruling 7)

**Interfaces:**
- Consumes: everything from Tasks 1–3.
- Unchanged props (the popups aren't edited): `host, hostCfg, hostBuild,
  cat, source, tier, hostMode, wediBuilderPct, schluterBuilderPct,
  stockRows, bookStockReady, books, loadBookItems, mortars, mortarDefault,
  areaName, onQuoteOptions, mirror, onMirror`.
- Changed payload: `onQuoteOptions({ options: [{ lines, name }], label })`.
  App.jsx passes it straight to `compareOptionsPatch` (Task 2).
- New DOM hooks:
  - `data-cmp-quad`, `data-cmp-tile=<key>`, `data-cmp-check=<key>`.
  - `data-cmp-total`, `data-cmp-diff`, `data-cmp-flag=<id>`.
  - `data-cmp-cell=<key>` (a detail column) and `data-row-key` (a detail
    line).
  - `data-cmp-sdryask`, `data-cmp-sdry-answer`.
  - `data-cmp-send`, `data-cmp-option=<letter>`.
- Kept: `data-cmp-sys`, `data-cmp-group`, `data-cmp-slot`, the mirror
  hooks, `data-compare-confirm`.

- [ ] **Step 1: Apply the `src/CompareTab.jsx` hunks.**
- [ ] **Step 2: Lint and build.**
  - `npx eslint src/CompareTab.jsx` is clean.
  - Build with the dummy env vars.
  - Confirm the boot chunk is clean with
    `grep -c "comparegrid\|KERDI\|Fundo\|No tray fits" dist/assets/index-*.js`,
    which should print 0.
  - Confirm `grep -l "No tray fits" dist/assets/*.js` names only
    `CompareTab-*.js`.
- [ ] **Step 3: Write the proof script.** Create `p3/shoot-grid.mjs` from the
  diff and apply the `p1d/shoot-compare.mjs` hunk.
- [ ] **Step 4: Prove it.**
  - Run `npx vite --port 5199 --strictPort` in the background.
  - `node .scratch/158_shower-config-roadmap/p3/shoot-grid.mjs` must end
    "all checks passed" and write g1–g7.
  - Look at every PNG. Each one must actually show what its check claims:
    - g1: four totals, the live cell outlined, reading "Current".
    - g3: the modal rows A–C.
    - g4: the lit line under the chip jump, plus the S-DRY answer.
    - g6: the grid visible, with the Membrane cell carrying the chip and the
      Board cell not.
- [ ] **Step 5: Re-run every earlier proof.** Run each script under
  `.scratch/158_shower-config-roadmap/p1a/` … `p2/`. Every one must pass.
  Restore any PNG that re-rendered with no real change
  (`git checkout -- <png>`). Keep only the Compare shots that genuinely
  changed (p1d `c*`, p2 `cm*`).
- [ ] **Step 6: Verify everything.** `npm test` is green; `npm run lint` is
  clean.
- [ ] **Step 7: Commit** — `Compare: the four-way grid — live cell + three house kits, chips, per-cell mirror, options A–D`.

```diff
diff --git a/.scratch/158_shower-config-roadmap/p1d/shoot-compare.mjs b/.scratch/158_shower-config-roadmap/p1d/shoot-compare.mjs
index e86b7e7..8c0243e 100644
--- a/.scratch/158_shower-config-roadmap/p1d/shoot-compare.mjs
+++ b/.scratch/158_shower-config-roadmap/p1d/shoot-compare.mjs
@@ -48,7 +48,8 @@ await shot("c1-schluter-host");
 await pg.locator("[data-mirror-add]").click(); await pg.waitForSelector("[data-add-pop]"); await pg.waitForTimeout(300);
 const pick = flat(await pg.locator("[data-add-pop]").innerText());
 console.log("picker:", pick.slice(0, 160));
-if (!/Add to wedi · Drain/.test(pick) || !/PART \| Cover/.test(pick)) fail("the picker isn't the wedi Drain parts");
+// Phase 3: the picker names its grid cell — two wedi cells can each mirror
+if (!/Add to wedi · [^·]+ · Drain/.test(pick) || !/PART \| Cover/.test(pick)) fail("the picker isn't the wedi Drain parts");
 await shot("c2-picker", false);
 await pg.locator("[data-mirror-row]").nth(1).click(); await pg.waitForTimeout(200);
 await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(700);
@@ -90,7 +91,8 @@ const modal = flat(await pg.locator(".cmodal").innerText());
 console.log("modal:", modal.slice(0, 120));
 const sTot = (await pg.locator(".cmp-tot > div").nth(2).locator(".tv").innerText()).match(/\$[\d,]+\.\d\d/)[0];
 console.log("Schluter column total:", sTot);
-if (!new RegExp("B \\| Schluter — \\d+ lines \\| \\" + sTot).test(modal)) fail("option B's total isn't the column's total");
+// Phase 3: an option row names its system, and any chips ride before the total
+if (!new RegExp("B \\| Schluter · [^|]+ — \\d+ lines \\| (?:[^|$]+ \\| )*\\" + sTot).test(modal)) fail("option B's total isn't the column's total");
 await shot("c5-quote-options", false);
 
 // --- Stock only (the popups' default): the mirror pools like the popups — a
diff --git a/.scratch/158_shower-config-roadmap/p3/shoot-grid.mjs b/.scratch/158_shower-config-roadmap/p3/shoot-grid.mjs
new file mode 100644
index 0000000..fd722f9
--- /dev/null
+++ b/.scratch/158_shower-config-roadmap/p3/shoot-grid.mjs
@@ -0,0 +1,121 @@
+// Proof: the four-way Compare grid (ticket 158 Phase 3) — wedi and Schluter on
+// Board and Membrane, the host's live cell outlined, three house kits beside
+// it; a cell click drives the detail; a chip jumps to its line; the S-DRY
+// no-fit answer moves only the wedi Membrane cell; a mirror drop is per cell;
+// checked cells land as options A–D in reading order.
+//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p3/shoot-grid.mjs
+import { createRequire } from "node:module";
+const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
+const { wediBuildFor } = await import(process.cwd() + "/src/comparekit.js");
+const OUT = ".scratch/158_shower-config-roadmap/p3";
+const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
+const pg = await b.newPage({ viewport: { width: 1500, height: 1250 } });
+let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
+const sent = []; pg.on("console", async (m) => { if (m.text().startsWith("onQuoteOptions")) sent.push(await m.args()[1].jsonValue()); });
+const fail = (m) => { console.error("FAIL:", m); err = true; };
+const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
+const toCompare = async () => { await pg.locator(".modetab", { hasText: "Compare" }).dispatchEvent("click"); await pg.waitForSelector("[data-cmp-quad] [data-cmp-total]", { timeout: 20000 }); await pg.waitForTimeout(800); };
+const toTab = async (t) => { await pg.locator(".modetab", { hasText: t }).dispatchEvent("click"); await pg.waitForTimeout(500); };
+const tile = (k) => pg.locator(`[data-cmp-tile="${k}"]`);
+const txt = async (loc) => (await loc.innerText()).replace(/\s+/g, " ").trim();
+const heads = async () => pg.locator(".cmp-grid [data-cmp-sys]").evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, " ").trim()));
+const KEYS = ["wedi:board", "schluter:board", "wedi:membrane", "schluter:membrane"];
+
+// --- 1. Schluter host, 38x60 KERDI membrane: four live totals ---
+await pg.goto("http://localhost:5199/schluter-preview.html");
+await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
+await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(600);
+await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);
+await toCompare();
+for (const k of KEYS) if (!/\$[\d,]+\.\d\d/.test(await txt(tile(k)))) fail(k + " has no total");
+if (!/Current/.test(await txt(tile("schluter:membrane")))) fail("the live cell does not read Current");
+if (!(await tile("schluter:membrane").getAttribute("class")).includes("live")) fail("the live cell is not outlined");
+if (!/vs current/.test(await txt(tile("wedi:board")))) fail("a house-kit cell has no difference from current");
+if (!(await tile("wedi:membrane").getAttribute("class")).includes("sel")) fail("the detail does not open on today's pair");
+let h = await heads(); console.log("default detail:", h);
+if (!/S-DRY membrane/.test(h[0]) || !/KERDI membrane/.test(h[1])) fail("the default detail is not wedi S-DRY vs KERDI membrane");
+const checkedKeys = async () => pg.locator("[data-cmp-check]").evaluateAll((els) => els.filter((e) => e.checked).map((e) => e.getAttribute("data-cmp-check")));
+if ((await checkedKeys()).sort().join() !== "schluter:membrane,wedi:membrane") fail("the default checks are not the live cell and today's opposite");
+if (!/Add 2 as quote options/.test(await txt(pg.locator("[data-cmp-send]")))) fail("the send button does not count two");
+await shot("g1-schluter-host-grid");
+
+// --- 2. a cell click drives the detail; the live cell doesn't move it ---
+await tile("wedi:board").click(); await pg.waitForTimeout(600);
+h = await heads(); console.log("after wedi Board click:", h);
+if (!/Building Panel/.test(h[0]) || !/KERDI membrane/.test(h[1])) fail("the detail did not follow the wedi Board click");
+await tile("schluter:board").click(); await pg.waitForTimeout(600);
+h = await heads(); console.log("after KERDI-BOARD click:", h);
+if (!/KERDI-BOARD/.test(h[0]) || !/KERDI membrane.*this build/.test(h[1])) fail("same-brand detail is not KERDI-BOARD vs the live KERDI membrane");
+await tile("schluter:membrane").click(); await pg.waitForTimeout(400);
+if (!(await tile("schluter:board").getAttribute("class")).includes("sel")) fail("clicking the live cell moved the selection");
+await shot("g2-same-brand-detail");
+
+// --- 3. three checked → options A–C in reading order ---
+await pg.locator('[data-cmp-check="wedi:board"]').check(); await pg.waitForTimeout(300);
+if (!/Add 3 as quote options/.test(await txt(pg.locator("[data-cmp-send]")))) fail("the send button does not count three");
+await pg.locator("[data-cmp-send]").click(); await pg.waitForTimeout(500);
+const rows = await pg.locator("[data-cmp-option]").evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, " ").trim()));
+console.log("modal:", rows);
+if (rows.length !== 3 || !/^A wedi · Building Panel/.test(rows[0]) || !/^B wedi · S-DRY membrane/.test(rows[1]) || !/^C Schluter · KERDI membrane/.test(rows[2])) fail("the modal does not letter A–C in reading order");
+await shot("g3-three-options-modal");
+await pg.locator("[data-compare-confirm]").click(); await pg.waitForTimeout(500);
+const p = sent.at(-1);
+if (!p || p.options.map((o) => o.name).join(" | ") !== "wedi · Building Panel | wedi · S-DRY membrane | Schluter · KERDI membrane"
+  || !p.options.every((o) => o.lines.length > 0)) fail("onQuoteOptions did not carry the three options in order");
+
+// --- 4. a linear room: the S-DRY no-fit chip, its jump, and the answer ---
+await toTab("Kits");
+const lin = pg.locator("[data-schluter-tray^='KSLT']");
+if (await lin.count()) {
+  await lin.first().click(); await pg.waitForTimeout(800);
+  await toCompare();
+  const chip = tile("wedi:membrane").locator('[data-cmp-flag="sdry"]');
+  if (!(await chip.count())) fail("the no-fit wedi Membrane cell has no S-DRY chip");
+  await tile("schluter:board").click(); await pg.waitForTimeout(400);
+  await chip.click(); await pg.waitForTimeout(400);
+  if (!(await tile("wedi:membrane").getAttribute("class")).includes("sel")) fail("the chip did not select its cell");
+  if (!(await pg.locator('[data-cmp-cell="wedi:membrane"] .ln.hl').count())) fail("the chip did not light its line");
+  if (!(await pg.locator("[data-cmp-sdryask]").count())) fail("no S-DRY answer under a no-fit cell");
+  await shot("g4-sdry-chip-jump");
+  const before = await txt(tile("wedi:membrane"));
+  const boardBefore = await txt(tile("wedi:board"));
+  await pg.locator('[data-cmp-sdry-answer="nearest"]').click(); await pg.waitForTimeout(700);
+  const after = await txt(tile("wedi:membrane"));
+  console.log("wedi Membrane:", before, "→", after);
+  if (!/on a wedi pan/.test(before) || /on a wedi pan/.test(after)) fail("'nearest' did not move the cell onto an S-DRY base");
+  if (!/No S-DRY base fits/.test(after)) fail("the nearest base lost its no-fit chip");
+  if (await txt(tile("wedi:board")) !== boardBefore) fail("the S-DRY answer moved another cell");
+  await shot("g5-sdry-nearest");
+} else fail("no linear tray in the preview book");
+
+// --- 5. wedi host with a hand-added niche: the mirror is per cell ---
+const seedB = wediBuildFor({ w: 60, d: 38, curbed: true, drain: "point",
+  walls: ["back", "left", "right"].map((side) => ({ side, on: true, len: side === "back" ? 60 : 38, h: 84 })) },
+{ manual: [{ key: "US3000005", qty: 1, group: "addon" }] });
+await pg.goto("http://localhost:5199/wedi-preview.html?seed=" + encodeURIComponent(JSON.stringify({ mode: "custom", cfg: seedB.cfg })));
+await pg.waitForSelector(".modetab", { timeout: 20000 }); await pg.waitForTimeout(800);
+await toCompare();
+if (!(await tile("wedi:board").getAttribute("class")).includes("live")) fail("the wedi host's live cell is not wedi Board");
+const sb = await txt(tile("schluter:board"));
+await tile("schluter:membrane").click(); await pg.waitForTimeout(500);
+const drop = pg.locator('[data-cmp-cell="schluter:membrane"] [data-mirror-drop]');
+if (!(await drop.count())) fail("the Schluter Membrane cell has no mirrored niche to drop");
+else {
+  await drop.first().click(); await pg.waitForTimeout(700);
+  if (!(await tile("schluter:membrane").locator('[data-cmp-flag="unmatched"]').count())) fail("the drop did not flag its cell");
+  if (await tile("schluter:board").locator('[data-cmp-flag="unmatched"]').count()) fail("the drop leaked into the Board cell");
+  if (await txt(tile("schluter:board")) !== sb) fail("the drop moved the Board cell's total");
+  if (!(await tile("wedi:membrane").locator('[data-cmp-flag]').count() === 0)) fail("the same-brand cell grew a chip");
+  if (!/added/.test(await txt(pg.locator("body")))) fail("no added tag anywhere");
+}
+await pg.locator(".cmp-tab").evaluate((e) => { e.scrollTop = 0; });
+await shot("g6-wedi-host-per-cell-mirror");
+await tile("wedi:membrane").click(); await pg.waitForTimeout(600);
+const addedSame = await pg.locator('[data-cmp-cell="wedi:membrane"] [data-added-tag]').count();
+if (addedSame < 1) fail("the same-brand Membrane cell does not carry the host's added niche");
+await pg.locator('[data-cmp-cell="wedi:membrane"] [data-added-tag]').first().scrollIntoViewIfNeeded();
+await shot("g7-same-brand-added-line");
+
+await b.close();
+if (err) { console.error("checks FAILED"); process.exit(1); }
+console.log("all checks passed");
diff --git a/src/CompareTab.jsx b/src/CompareTab.jsx
index e2c4921..4b03fd7 100644
--- a/src/CompareTab.jsx
+++ b/src/CompareTab.jsx
@@ -1,20 +1,23 @@
-// CompareTab — one room, both shower systems (phase 5, prototype P3).
+// CompareTab — one room, four shower systems (phase 5, prototype P3; the
+// 4-way grid is ticket 158 Phase 3).
 //
 // A fourth tab in EITHER vendor popup: the host popup passes its live cfg and
-// its build, and this tab derives the other engine's house kit for the same
-// room. The popups never import comparekit — they hand over a raw `hostCfg`
+// its build. A 2×2 grid prices the room as wedi and Schluter on Board and on
+// Membrane — the host's own cell is its live build, the other three are house
+// kits (comparegrid.js) — and the two-column detail below shows the live
+// build against the selected cell. The popups never import comparekit — they hand over a raw `hostCfg`
 // and the neutral room is derived HERE, so wedi.js and schluter.js only meet
 // inside comparekit.js (and, through it, this lazy chunk).
 //
 // LAZY-CHUNK-ONLY (ADR 0026): imports comparekit.js → both engines. Nothing on
 // the boot path may import this file — the popups mount it via React.lazy.
-import { Fragment, useMemo, useState } from "react";
+import { Fragment, useEffect, useMemo, useRef, useState } from "react";
 import { X } from "lucide-react";
 import {
-  roomFromSchluter, roomFromWedi, wediBuildFor, schluterBuildFor,
-  wediCompareRows, schluterCompareRows, compareTotals,
-  mirrorPlan, mirrorRow, mirrorParts, mirrorCandidates, pruneMirror, hostAddedLines, compareLayout,
+  roomFromSchluter, roomFromWedi, wediSdryNoFit,
+  mirrorParts, mirrorCandidates, pruneMirror, hostAddedLines, compareLayout,
 } from "./comparekit.js";
+import { CELLS, BRAND, hostCellKey, opposite, cellBuild } from "./comparegrid.js";
 import { matchQty } from "./comparemirror.js";
 import { groupLabel, SLOT_LABEL } from "./slots.js";
 import { SwapPop } from "./swappop.jsx";
@@ -27,7 +30,8 @@ import { lineItems as schluterLineItems } from "./schluter.js";
 
 const fm = (n) => "$" + (+n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
 const DRAIN_LBL = { point: "point drain", offset: "offset drain", linear: "linear drain" };
-const BRAND = { wedi: "wedi", schluter: "Schluter" };
+const LETTERS = ["A", "B", "C", "D"];
+const signed = (n) => (Math.abs(n) < 0.005 ? "same" : (n > 0 ? "+" : "−") + fm(Math.abs(n)));
 
 const CSS = `
 .cmp-tab{flex:1 1 0;min-width:0;display:flex;flex-direction:column;overflow-y:auto;position:relative;
@@ -96,20 +100,47 @@ const CSS = `
 .cmp-pick .srow .n small{display:block;font-size:9.5px;color:var(--ft-faint);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .cmp-pick .more{padding:6px 8px;font-size:9.5px;color:var(--ft-faint);font-weight:600}
 .cmp-pick .srow .p{font-size:11.5px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--ft-text)}
+.cmp-tab .quad{display:grid;grid-template-columns:86px 1fr 1fr;gap:8px;padding:12px 18px;border-bottom:1px solid var(--ft-border-strong)}
+.cmp-tab .quad .qh{display:flex;align-items:center}
+.cmp-tab .quad .qrow{font-size:10px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;color:var(--ft-faint);display:flex;align-items:center}
+.cmp-tab .tile{border:1px solid var(--ft-border);border-radius:9px;background:var(--ft-card);padding:9px 11px;cursor:pointer;min-width:0;text-align:left}
+.cmp-tab .tile:hover{border-color:var(--ft-border-strong);background:var(--ft-hover)}
+.cmp-tab .tile.live{box-shadow:inset 0 0 0 1.5px var(--ft-border-strong);cursor:default;background:var(--ft-tint)}
+.cmp-tab .tile.sel{box-shadow:inset 0 0 0 2px var(--ft-brand)}
+.cmp-tab .tile .tt{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:800}
+.cmp-tab .tile .tt input{margin:0;accent-color:var(--ft-brand);cursor:pointer}
+.cmp-tab .tile .tt .nm{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
+.cmp-tab .tile .tv{font-size:18px;font-weight:800;font-variant-numeric:tabular-nums;margin-top:3px}
+.cmp-tab .tile .dv{font-size:11px;font-weight:700;color:var(--ft-muted);font-variant-numeric:tabular-nums}
+.cmp-tab .tile .tmiss{font-size:11px;color:var(--ft-faint);font-weight:600;line-height:1.45;margin-top:4px}
+.cmp-tab .tile .chips{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;align-items:center}
+.cmp-tab .tile .chip{border:1px solid var(--ft-border-strong);background:var(--ft-hover-amber);color:var(--ft-text);border-radius:5px;font-size:10px;font-weight:800;padding:2px 7px;cursor:pointer;font-family:inherit}
+.cmp-tab .tile .chip:hover{border-color:var(--ft-text)}
+.cmp-tab .tile .more{font-size:10px;font-weight:700;color:var(--ft-faint)}
+.cmp-tab .cmp-grid .cell .ln.hl{background:var(--ft-hover-amber);border-radius:4px;transition:background .3s}
+.cmp-tab .sdryask{margin:10px 18px 0;border:1px solid var(--ft-border-strong);border-radius:9px;background:var(--ft-card);padding:10px 14px;font-size:12px;line-height:1.5}
+.cmp-tab .sdryask .why{font-weight:700;margin-bottom:7px}
+.cmp-tab .sdryask .acts{display:flex;flex-wrap:wrap;gap:6px}
+.cmp-tab .sdryask button{border:1px solid var(--ft-border-strong);background:var(--ft-card);color:var(--ft-text);border-radius:7px;font-size:11.5px;font-weight:700;padding:5px 11px;cursor:pointer;font-family:inherit}
+.cmp-tab .sdryask button.on{background:var(--ft-seg-on-bg);color:var(--ft-brand-deep);box-shadow:inset 0 0 0 1.5px var(--ft-brand)}
+.cmp-tab .cmodal .orow .fl{font-size:9.5px;font-weight:800;color:var(--ft-muted);background:var(--ft-hover-amber);border-radius:4px;padding:0 5px}
 `;
 
+
 // One side of a slot row: its lines (kit first, then added, then mirrored),
 // and for the mirrored side the host lines that found nothing — each with a
-// "+" when the brand has parts for that group at all.
-function Cell({ rows, plus, lens, miss, first, brand, onPick, onDrop, canAdd }) {
-  if (miss) return <div className="cell">{first ? <div className="miss">{miss}</div> : null}</div>;
-  if (!rows.length && !plus.length) return <div className="cell"><div className="ln dash"><span className="n">—</span></div></div>;
+// "+" when the brand has parts for that group at all. `cellKey` scopes the
+// row keys a flag chip scrolls to.
+function Cell({ cellKey, rows, plus, lens, miss, first, brand, onPick, onDrop, canAdd }) {
+  if (miss) return <div className="cell" data-cmp-cell={cellKey}>{first ? <div className="miss">{miss}</div> : null}</div>;
+  if (!rows.length && !plus.length) return <div className="cell" data-cmp-cell={cellKey}><div className="ln dash"><span className="n">—</span></div></div>;
   return (
-    <div className="cell">
+    <div className="cell" data-cmp-cell={cellKey}>
       {rows.map((r, i) => {
         const amt = lens === "builder" ? r.builder : r.retail;
         return (
-          <div key={i} className={"ln" + (r.noteOnly ? " note" : !r.stock ? " so" : "")} {...(r.mirror ? { "data-mirror-line": r.hostKey } : {})}>
+          <div key={i} className={"ln" + (r.noteOnly ? " note" : !r.stock ? " so" : "")} data-row-key={r.key}
+            {...(r.mirror ? { "data-mirror-line": r.hostKey } : {})}>
             <span className="n">
               {r.qty > 1 ? r.qty + "× " : ""}{r.name}
               {r.added && <span className="tag" data-added-tag>{r.mirror === "matched" ? "added · matched" : "added"}</span>}
@@ -126,7 +157,7 @@ function Cell({ rows, plus, lens, miss, first, brand, onPick, onDrop, canAdd })
         );
       })}
       {plus.map((e) => (
-        <div key={e.hostKey} className="ln plus" data-mirror-plus={e.hostKey}>
+        <div key={e.hostKey} className="ln plus" data-mirror-plus={e.hostKey} data-row-key={e.hostKey}>
           <span className="n">
             {e.kind === "dropped" ? "Not mirrored" : canAdd(e) ? `Nothing comparable in the ${BRAND[brand]} book` : `No ${BRAND[brand]} ${SLOT_LABEL[e.slot].toLowerCase()} in the book`}
             <small>for {e.host.qty > 1 ? e.host.qty + "× " : ""}{e.host.name}</small>
@@ -138,12 +169,7 @@ function Cell({ rows, plus, lens, miss, first, brand, onPick, onDrop, canAdd })
   );
 }
 
-// What the wedi column's walls are — S-DRY on a wedi pan when S-DRY can't fit.
-function wediSysLabel(build, wallSys) {
-  const sys = build ? (build.cfg && build.cfg.wallSys) || "board" : wallSys;
-  if (sys !== "membrane") return "Building Panel";
-  return build && build.pan && build.pan.sub !== "sdry" ? "S-DRY membrane on a wedi pan" : "S-DRY membrane";
-}
+const CELL_AT = Object.fromEntries(CELLS.map((c, i) => [c.key, i]));
 
 export default function CompareTab({
   host, hostCfg, hostBuild, cat, source, tier, hostMode = "custom",
@@ -152,9 +178,21 @@ export default function CompareTab({
   mortars, mortarDefault, areaName, onQuoteOptions,
   mirror, onMirror,
 }) {
+  const wediHost = host === "wedi";
+  const hostBrand = wediHost ? "wedi" : "schluter";
+  const hostKey = hostCellKey(hostBrand, hostCfg);
+
   const [lens, setLens] = useState("retail");
   const [confirm, setConfirm] = useState(null);
   const [pick, setPick] = useState(null);
+  // The grid (Phase 3): the cell the detail shows beside the live build, the
+  // cells checked for quote options, and the wedi Membrane cell's no-fit
+  // answer. Session state — it goes when the tab does.
+  const [selected, setSelected] = useState(() => opposite(hostKey));
+  const [checked, setChecked] = useState(() => [hostKey, opposite(hostKey)]);
+  const [sdryPick, setSdryPick] = useState("wedi");
+  const [jumpTo, setJumpTo] = useState(null);
+  const root = useRef(null);
 
   // The confirm modal is a layer of its own on the Esc ladder (ADR 0028): it
   // registers ABOVE the host popup's handler, so one press dismisses the modal
@@ -164,17 +202,11 @@ export default function CompareTab({
 
   const wPct = wediBuilderPct == null ? 18 : wediBuilderPct;
   const sPct = schluterBuilderPct == null ? 8 : schluterBuilderPct;
-  const wediHost = host === "wedi";
 
   const room = useMemo(
     () => (wediHost ? roomFromWedi(hostCfg) : roomFromSchluter(hostCfg)),
     [wediHost, hostCfg]);
   const roomOk = room.w > 0 && room.d > 0;
-  // The other column follows the host's wall system (Phase 2, ADR 0051):
-  // Membrane faces Membrane, board faces board.
-  const wallSys = wediHost
-    ? (hostCfg && hostCfg.wallSys === "membrane" ? "membrane" : "board")
-    : (hostCfg && hostCfg.wallSys === "board" ? "board" : "membrane");
 
   // The registry bag the host hands over serves whichever engine THIS tab has
   // to assemble — the host popup already has its own. Hooks can't be
@@ -203,119 +235,124 @@ export default function CompareTab({
     () => mortarItemFrom(mortarDefault || Object.keys(mortars || {})[0] || "", mortars || {}),
     [mortarDefault, mortars]);
 
-  // The mirror (Phase 1d): the host build's hand-added lines, each answered by
-  // the other brand's nearest part or a "+". Picks and drops are the popup's
-  // session state (`mirror`), so they outlive a tab switch but not the popup.
-  const hostBrand = wediHost ? "wedi" : "schluter";
-  const otherReady = wediHost ? schCatReady && schCat.length > 0 : wediCatReady;
-  const plan = useMemo(
-    () => (otherReady ? mirrorPlan(hostBuild, hostBrand, mirror, { cat: schCat, source })
-      : { brand: wediHost ? "schluter" : "wedi", entries: [], manual: [] }),
-    [otherReady, hostBuild, hostBrand, mirror, schCat, source, wediHost]);
-
-  // The HOST column is whatever that popup has on screen; the other column is
-  // that engine's house kit for the same room, plus the mirrored lines.
-  const wediBuild = useMemo(
-    () => (wediHost ? hostBuild || null : roomOk && wediCatReady ? wediBuildFor(room, { source, tier, manual: plan.manual, wallSys }) : null),
-    [wediHost, hostBuild, room, roomOk, wediCatReady, source, tier, plan.manual, wallSys]);
-  const sch = useMemo(() => {
-    if (!wediHost) return { build: hostBuild || null, cfg: hostCfg || null };
-    if (!roomOk || !schCatReady || !schCat.length) return { build: null, cfg: null };
-    return schluterBuildFor(room, schCat, { source, mortarItem, manual: plan.manual, wallSys });
-  }, [wediHost, hostBuild, hostCfg, room, roomOk, schCat, schCatReady, source, mortarItem, plan.manual, wallSys]);
-
-  // The other column draws its kit lines from its build and its mirrored
-  // lines from the plan, one per host line — the engine bills them summed.
-  const otherPct = plan.brand === "wedi" ? wPct : sPct;
-  const mirrorRows = useMemo(
-    () => plan.entries.filter((e) => e.match).map((e) => mirrorRow(e, plan.brand, { builderPct: otherPct })),
-    [plan, otherPct]);
-  const wediRows = useMemo(() => {
-    const rows = wediCompareRows(wediBuild, { builderPct: wPct });
-    return wediHost || !rows.length ? rows : [...rows.filter((r) => !r.added), ...mirrorRows];
-  }, [wediBuild, wPct, wediHost, mirrorRows]);
-  const schRows = useMemo(() => {
-    const rows = schluterCompareRows(sch.build, { builderPct: sPct });
-    return !wediHost || !rows.length ? rows : [...rows.filter((r) => !r.added), ...mirrorRows];
-  }, [sch.build, sPct, wediHost, mirrorRows]);
-  const wTot = useMemo(() => compareTotals(wediRows), [wediRows]);
-  const sTot = useMemo(() => compareTotals(schRows), [schRows]);
-
-  const wediMiss = wediRows.length ? null
-    : !roomOk ? "Enter a room size — the compare runs off the room on screen."
-      : wediHost ? "Nothing built yet — pick a kit or solve a room on the other tabs."
-        : ownWedi.bookError ? "Couldn't load the wedi price book — this column can't be priced without it."
-          : !wediCatReady ? "Loading the wedi price book…"
-            : "No wedi pan solves this room. Try Full catalog, or a size the pan family reaches.";
-  const schMiss = schRows.length ? null
-    : !roomOk ? "Enter a room size — the compare runs off the room on screen."
-      : !wediHost ? "Nothing built yet — pick a tray or solve a room on the other tabs."
-        : !schCatReady ? "Loading the Schluter price books…"
-          : !schCat.length ? "No Schluter rows in the price books yet — import the stock sheet or a Schluter order book."
-            : "No Schluter build for this room.";
-
-  const bothPriced = !wediMiss && !schMiss;
-  const otherMiss = plan.brand === "wedi" ? wediMiss : schMiss;
+  // Every cell prices off one shared context; a cell's own mirror state (its
+  // picks and drops for the host's hand-added lines — the popup's session
+  // state, keyed by cell) and the S-DRY answer only rebuild that cell.
+  const ctx = useMemo(() => ({
+    hostBrand, hostKey, hostBuild, hostCfg, room, roomOk,
+    ready: { wedi: wediCatReady, schluter: schCatReady && schCat.length > 0 },
+    cat: schCat, source, tier, mortarItem, wPct, sPct,
+  }), [hostBrand, hostKey, hostBuild, hostCfg, room, roomOk, wediCatReady, schCatReady, schCat, source, tier, mortarItem, wPct, sPct]);
+  const m = mirror || {};
+  const wB = useMemo(() => cellBuild("wedi:board", ctx, { mirror: m["wedi:board"] }), [ctx, m["wedi:board"]]);
+  const sB = useMemo(() => cellBuild("schluter:board", ctx, { mirror: m["schluter:board"] }), [ctx, m["schluter:board"]]);
+  const wM = useMemo(() => cellBuild("wedi:membrane", ctx, { mirror: m["wedi:membrane"], sdryPick }), [ctx, m["wedi:membrane"], sdryPick]);
+  const sM = useMemo(() => cellBuild("schluter:membrane", ctx, { mirror: m["schluter:membrane"] }), [ctx, m["schluter:membrane"]]);
+  const cells = { "wedi:board": wB, "schluter:board": sB, "wedi:membrane": wM, "schluter:membrane": sM };
+  const live = cells[hostKey];
+  const sel = cells[selected !== hostKey && cells[selected] ? selected : opposite(hostKey)];
+
+  const missOf = (c) => {
+    if (c.rows.length) return null;
+    if (!roomOk) return "Enter a room size — the compare runs off the room on screen.";
+    if (c.live) return c.brand === "wedi"
+      ? "Nothing built yet — pick a kit or solve a room on the other tabs."
+      : "Nothing built yet — pick a tray or solve a room on the other tabs.";
+    if (c.brand === "wedi") return ownWedi.bookError ? "Couldn't load the wedi price book — this column can't be priced without it."
+      : !wediCatReady ? "Loading the wedi price book…"
+        : "No wedi pan solves this room. Try Full catalog, or a size the pan family reaches.";
+    return !schCatReady ? "Loading the Schluter price books…"
+      : !schCat.length ? "No Schluter rows in the price books yet — import the stock sheet or a Schluter order book."
+        : "No Schluter build for this room.";
+  };
+  const amt = (c) => (lens === "builder" ? c.totals.builder : c.totals.retail);
+
+  // The detail: the live build and the selected cell, in grid order.
+  const [left, right] = [live, sel].sort((a, b) => CELL_AT[a.key] - CELL_AT[b.key]);
+  const plusOf = (c) => (c.plan && !missOf(c) ? c.plan.entries.filter((e) => !e.match) : []);
   const layout = useMemo(
-    () => compareLayout({ wedi: wediRows, schluter: schRows }, otherMiss ? {} : { [plan.brand]: plan.entries.filter((e) => !e.match) }),
-    [wediRows, schRows, plan, otherMiss]);
+    () => compareLayout({ L: left.rows, R: right.rows }, { L: plusOf(left), R: plusOf(right) }),
+    // eslint-disable-next-line react-hooks/exhaustive-deps
+    [left, right]);
 
+  // A chip scrolls the detail to its line once the selected cell has drawn.
+  useEffect(() => {
+    if (!jumpTo || !root.current) return;
+    const el = [...root.current.querySelectorAll(`[data-cmp-cell="${jumpTo.cell}"] [data-row-key]`)]
+      .find((e) => e.getAttribute("data-row-key") === jumpTo.rowKey);
+    if (!el) return;
+    el.scrollIntoView({ block: "center", behavior: "smooth" });
+    el.classList.add("hl");
+    const t = setTimeout(() => el.classList.remove("hl"), 1600);
+    return () => clearTimeout(t);
+  }, [jumpTo]);
+  const pickCell = (k) => { if (k !== hostKey) setSelected(k); };
+  const jump = (k, rowKey) => { pickCell(k); setJumpTo({ cell: k, rowKey, n: Date.now() }); };
+  const toggle = (k) => setChecked((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]));
+
+  // The mirror: picks and drops are per cell, each pruned to the host lines
+  // that still exist.
   const hostKeys = () => hostAddedLines(hostBuild, hostBrand).map((h) => h.key);
-  const writeMirror = (key, v) => onMirror && onMirror((m) => pruneMirror({ ...m, [key]: v }, hostKeys()));
-  const partsFor = (e) => mirrorParts(plan.brand, e.grp, { cat: schCat, source });
-  const sameAs = (m) => (c) => c.g === m.g && c.id === m.id;
+  const writeMirror = (cell, key, v) => onMirror && onMirror((all) => ({
+    ...(all || {}), [cell]: pruneMirror({ ...((all || {})[cell] || {}), [key]: v }, hostKeys()),
+  }));
+  const partsFor = (c, e) => mirrorParts(c.brand, e.grp, { cat: schCat, source });
+  const sameAs = (mt) => (c) => c.g === mt.g && c.id === mt.id;
   // mirrorPlan resolves a hand pick against the full catalog, so under Stock
   // only it can sit outside the pooled list; its part carries it as `standing`
   // so the picker still opens on it, marked, at the top.
-  const pickParts = (e) => {
-    const parts = partsFor(e);
-    const m = e.match;
-    if (!m) return parts;
-    const all = mirrorParts(plan.brand, e.grp, { cat: schCat, source: "all" });
-    const home = all.find((p) => p.parts.some(sameAs(m)));
+  const pickParts = (c, e) => {
+    const parts = partsFor(c, e);
+    const mt = e.match;
+    if (!mt) return parts;
+    const all = mirrorParts(c.brand, e.grp, { cat: schCat, source: "all" });
+    const home = all.find((p) => p.parts.some(sameAs(mt)));
     const pooled = new Map(parts.map((p) => [p.key, p]));
-    if (!home || (pooled.get(home.key) || { parts: [] }).parts.some(sameAs(m))) return parts;
+    if (!home || (pooled.get(home.key) || { parts: [] }).parts.some(sameAs(mt))) return parts;
     return all.filter((p) => pooled.has(p.key) || p === home).map((p) => {
       const q = pooled.get(p.key) || { ...p, parts: [] };
-      return p === home ? { ...q, standing: m } : q;
+      return p === home ? { ...q, standing: mt } : q;
     });
   };
   const listFor = (e, part) => {
     const list = mirrorCandidates(e.host, part);
     return part.standing ? [part.standing, ...list] : list;
   };
-  const openPick = (hostKey, ev) => {
-    const e = plan.entries.find((x) => x.hostKey === hostKey);
+  const openPick = (cellKey, hostLine, ev) => {
+    const c = cells[cellKey];
+    const e = c.plan && c.plan.entries.find((x) => x.hostKey === hostLine);
     if (!e) return;
-    const parts = pickParts(e);
+    const parts = pickParts(c, e);
     const part = (e.match && parts.find((p) => p.standing || p.parts.some(sameAs(e.match))))
-      || parts.find((p) => p.parts.some((c) => c.slot === e.slot)) || parts[0];
+      || parts.find((p) => p.parts.some((x) => x.slot === e.slot)) || parts[0];
     if (!part) return;
     const list = listFor(e, part);
     const cur = e.match && list.find(sameAs(e.match));
     const first = cur || list[0];
     const r = ev.currentTarget.getBoundingClientRect();
     setPick({
-      hostKey, part: part.key, id: first.id, qty: cur ? e.qty : matchQty(e.host.part, e.host.qty, first), q: "",
+      cell: cellKey, hostKey: hostLine, part: part.key, id: first.id, qty: cur ? e.qty : matchQty(e.host.part, e.host.qty, first), q: "",
       at: { anchor: ev.currentTarget.closest(".ln"), x: r.right - 470, y: r.bottom + 6 },
     });
   };
-  const diff = bothPriced ? (lens === "builder" ? sTot.builder - wTot.builder : sTot.retail - wTot.retail) : 0;
-  const wLess = diff > 0;
-
-  const openQuote = () => {
-    const wediLines = wediBuild ? wediLineItems(wediBuild, { tier, builderPct: wPct }) : [];
-    const schluterLines = sch.build
-      ? schluterLineItems({ ...sch.build, mode: wediHost ? "custom" : hostMode, cfg: sch.cfg || {} }, { builderPct: sPct })
-      : [];
-    setConfirm({ wediLines, schluterLines });
-  };
+
+  const bothPriced = !missOf(left) && !missOf(right);
+  const diff = bothPriced ? amt(right) - amt(left) : 0;
+  const cheaper = diff > 0 ? left : right;
+
+  const sendable = CELLS.map((c) => cells[c.key]).filter((c) => checked.includes(c.key) && !missOf(c));
+  const linesOf = (c) => (c.brand === "wedi"
+    ? wediLineItems(c.build, { tier, builderPct: wPct })
+    : schluterLineItems({ ...c.build, mode: c.live ? hostMode : "custom", cfg: c.cfg || {} }, { builderPct: sPct }));
+  const openQuote = () => setConfirm(sendable.map((c) => ({ key: c.key, name: c.name, total: c.totals.retail, flags: c.flags, lines: linesOf(c) })));
+  const lastLetter = (n) => LETTERS[Math.max(0, n - 1)];
 
   const tip = (
     <div className="space-y-1.5">
-      <p><b>Walls</b> - both columns use the same wall system as the build: Membrane (wedi S-DRY or KERDI, over cement
-        board or drywall by others) or board (wedi Building Panel or KERDI-BOARD, no backer). Flip the wall system in
-        the popup to compare the other pair.</p>
+      <p><b>The grid</b> - the same room as wedi and Schluter, each on Board (wedi Building Panel or KERDI-BOARD, no
+        backer) and Membrane (wedi S-DRY or KERDI, over cement board or drywall by others). Your build is the outlined
+        cell; the other three are house kits for the room, carrying your added lines. Click a cell to see it line by
+        line below; a chip names what didn't map cleanly and jumps to its line.</p>
       <p><b>Fit strategy</b> - wedi extends pans and cuts them (extensions + the 6″/12″ deep-cut rule). Schluter cuts
         trays only - no extension parts - so odd rooms lean on the next tray up or a mortar bed.</p>
       <p><b>Pricing model</b> - wedi publishes retail; cost is the ERP net, no markup knob. Schluter is a markup book:
@@ -323,27 +360,71 @@ export default function CompareTab({
         Price book - <b>wedi builder %</b> ({wPct}% ≡ ×{((100 - wPct) / 100).toFixed(2)}) and <b>Schluter builder %</b>{" "}
         (−{sPct}%) - neither one moves the other.</p>
       {onQuoteOptions && (
-        <p><b>Quote options</b> - Land both builds on this area as quote options - the estimate prints them side by side.</p>
+        <p><b>Quote options</b> - Check two to four cells and land them on this area as options A–D - the estimate
+          prints them side by side.</p>
       )}
     </div>
   );
 
-  const totCell = (miss, t) => (
+  const tile = (c) => {
+    const miss = missOf(c);
+    return (
+      <div key={c.key} role="button" tabIndex={c.live ? -1 : 0} data-cmp-tile={c.key}
+        className={"tile" + (c.live ? " live" : "") + (c.key === sel.key ? " sel" : "")}
+        onClick={() => pickCell(c.key)}
+        onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pickCell(c.key); } }}>
+        <div className="tt">
+          {onQuoteOptions && (
+            <input type="checkbox" data-cmp-check={c.key} checked={checked.includes(c.key) && !miss} disabled={!!miss}
+              title="land as a quote option" onClick={(ev) => ev.stopPropagation()} onChange={() => toggle(c.key)} />
+          )}
+          <span className="nm">{c.label}</span>
+        </div>
+        {miss ? <div className="tmiss">{miss}</div> : (<>
+          <div className="tv" data-cmp-total>{fm(amt(c))}</div>
+          <div className="dv" data-cmp-diff>{c.live ? "Current" : missOf(live) ? "" : signed(amt(c) - amt(live)) + " vs current"}</div>
+        </>)}
+        {c.flags.length > 0 && (
+          <div className="chips">
+            {c.flags.slice(0, 2).map((f) => (
+              <button key={f.id} type="button" className="chip" data-cmp-flag={f.id} title="show this line"
+                onClick={(ev) => { ev.stopPropagation(); jump(c.key, f.rowKey); }}>{f.label}</button>
+            ))}
+            {c.flags.length > 2 && <span className="more" title={c.flags.slice(2).map((f) => f.label).join(" · ")}>+{c.flags.length - 2} more</span>}
+          </div>
+        )}
+      </div>
+    );
+  };
+
+  const head = (c) => (
+    <div className="brandh" data-cmp-sys={c.brand}>
+      <span className={"bbadge " + (c.brand === "wedi" ? "wedi" : "slt")}>{BRAND[c.brand]}</span> {c.label}
+      <small>{c.live ? "this build" : "house kit"}</small>
+    </div>
+  );
+  const totCell = (c) => (
     <div>
-      {miss ? <span className="tv">—</span>
+      {missOf(c) ? <span className="tv">—</span>
         : (
-          <span className="tv">{fm(lens === "builder" ? t.builder : t.retail)}
-            <small>{t.stocked} of {t.lines} lines stocked</small>
+          <span className="tv">{fm(amt(c))}
+            <small>{c.totals.stocked} of {c.totals.lines} lines stocked</small>
           </span>
         )}
     </div>
   );
+  const cellFor = (c, rows, plus, first) => (
+    <Cell key={c.key} cellKey={c.key} brand={c.brand} rows={rows} plus={plus} lens={lens} miss={missOf(c)} first={first}
+      onPick={(k, ev) => openPick(c.key, k, ev)} onDrop={(k) => writeMirror(c.key, k, { dropped: true })}
+      canAdd={(e) => partsFor(c, e).length > 0} />
+  );
+  const askSdry = !sel.live && sel.key === "wedi:membrane" && sel.flags.some((f) => f.id === "sdry");
 
   return (
-    <div className="cmp-tab">
+    <div className="cmp-tab" ref={root}>
       <style>{CSS}</style>
       <div className="cmp-head">
-        <div className="t">Compare — one room, both systems<HelpTip className="align-middle" w={320} tip={tip} /></div>
+        <div className="t">Compare — one room, four systems<HelpTip className="align-middle" w={340} tip={tip} /></div>
         <div className="room">
           {roomOk ? `${room.w}″ × ${room.d}″ · ${room.curbed ? "curbed" : "curbless"} · ${DRAIN_LBL[room.drain] || "point drain"}` : "no room yet"}
         </div>
@@ -355,95 +436,111 @@ export default function CompareTab({
         </div>
       </div>
 
+      <div className="quad" data-cmp-quad>
+        <div />
+        <div className="qh"><span className="bbadge wedi">wedi</span></div>
+        <div className="qh"><span className="bbadge slt">Schluter</span></div>
+        {["board", "membrane"].map((sys) => (
+          <Fragment key={sys}>
+            <div className="qrow">{sys === "board" ? "Board" : "Membrane"}</div>
+            {tile(cells["wedi:" + sys])}
+            {tile(cells["schluter:" + sys])}
+          </Fragment>
+        ))}
+      </div>
+
+      {askSdry && (
+        <div className="sdryask" data-cmp-sdryask>
+          <div className="why">No S-DRY base fits — {wediSdryNoFit(room, { source }) || "the room is outside the S-DRY range"}.</div>
+          <div className="acts">
+            <button className={sdryPick !== "nearest" ? "on" : ""} onClick={() => setSdryPick("wedi")} data-cmp-sdry-answer="wedi">
+              Use a wedi pan + curb, with S-DRY walls</button>
+            <button className={sdryPick === "nearest" ? "on" : ""} onClick={() => setSdryPick("nearest")} data-cmp-sdry-answer="nearest">
+              Use the nearest S-DRY base anyway</button>
+          </div>
+        </div>
+      )}
+
       <div className="cmp-grid">
         <div className="cat" />
-        <div className="brandh" data-cmp-sys="wedi">
-          <span className="bbadge wedi">wedi</span> {wediSysLabel(wediBuild, wallSys)}
-          <small>{wediHost ? "this build" : "house kit"}</small>
-        </div>
-        <div className="brandh" data-cmp-sys="schluter">
-          <span className="bbadge slt">Schluter</span> {(sch.cfg ? sch.cfg.wallSys : wallSys) === "board" ? "KERDI-BOARD" : "KERDI membrane"}
-          <small>{wediHost ? "house kit" : "this build"}</small>
-        </div>
+        {head(left)}
+        {head(right)}
         {layout.map((g, gi) => (
           <Fragment key={g.key}>
             <div className="gband" data-cmp-group={g.key}>{g.label}</div>
             {g.slots.map((r, ri) => (
               <Fragment key={r.slot}>
                 <div className="cat" data-cmp-slot={r.slot}>{r.label}</div>
-                {["wedi", "schluter"].map((b) => (
-                  <Cell key={b} brand={b} rows={r[b]} plus={r[b + "Plus"]} lens={lens}
-                    miss={b === "wedi" ? wediMiss : schMiss} first={gi === 0 && ri === 0}
-                    onPick={openPick} onDrop={(k) => writeMirror(k, { dropped: true })}
-                    canAdd={(e) => partsFor(e).length > 0} />
-                ))}
+                {cellFor(left, r.L, r.LPlus, gi === 0 && ri === 0)}
+                {cellFor(right, r.R, r.RPlus, gi === 0 && ri === 0)}
               </Fragment>
             ))}
           </Fragment>
         ))}
         {!layout.length && (<>
           <div className="cat" />
-          <Cell brand="wedi" rows={[]} plus={[]} lens={lens} miss={wediMiss} first canAdd={() => false} />
-          <Cell brand="schluter" rows={[]} plus={[]} lens={lens} miss={schMiss} first canAdd={() => false} />
+          {cellFor(left, [], [], true)}
+          {cellFor(right, [], [], true)}
         </>)}
       </div>
 
       <div className="cmp-tot">
         <div className="k">Total</div>
-        {totCell(wediMiss, wTot)}
-        {totCell(schMiss, sTot)}
+        {totCell(left)}
+        {totCell(right)}
       </div>
 
       {bothPriced && (
         <div className="delta">
-          <b>{wLess ? "wedi is " + fm(Math.abs(diff)) + " less on material" : "Schluter is " + fm(Math.abs(diff)) + " less on material"}</b>{" "}
+          <b>{cheaper.name} is {fm(Math.abs(diff))} less on material</b>{" "}
           for this room at this tier.
         </div>
       )}
 
       {onQuoteOptions && (
         <div className="qfoot">
-          <button className="cbtn primary" disabled={!!wediMiss || !!schMiss} onClick={openQuote}>
-            Quote options: wedi → A · Schluter → B
+          <button className="cbtn primary" data-cmp-send disabled={sendable.length < 2} onClick={openQuote}>
+            {sendable.length < 2 ? "Check two or more cells for quote options" : `Add ${sendable.length} as quote options`}
           </button>
         </div>
       )}
 
       {pick && (() => {
-        const e = plan.entries.find((x) => x.hostKey === pick.hostKey);
-        const parts = e ? pickParts(e) : [];
+        const c = cells[pick.cell];
+        const e = c && c.plan && c.plan.entries.find((x) => x.hostKey === pick.hostKey);
+        const parts = e ? pickParts(c, e) : [];
         const part = parts.find((p) => p.key === pick.part) || parts[0];
         if (!e || !part) return null;
         const list = listFor(e, part);
-        const cur = list.find((c) => c.id === pick.id) || list[0];
+        const cur = list.find((x) => x.id === pick.id) || list[0];
         const toks = pick.q.toLowerCase().split(/\s+/).filter(Boolean);
-        const shown = list.filter((c) => toks.every((t) => (c.item.name + " " + c.id).toLowerCase().includes(t)));
-        const qtyOf = (c) => (e.match && sameAs(e.match)(c) ? e.qty : matchQty(e.host.part, e.host.qty, c));
+        const shown = list.filter((x) => toks.every((t) => (x.item.name + " " + x.id).toLowerCase().includes(t)));
+        const qtyOf = (x) => (e.match && sameAs(e.match)(x) ? e.qty : matchQty(e.host.part, e.host.qty, x));
         const setP = (patch) => setPick((p) => (p ? { ...p, ...patch } : p));
         const partRow = parts.length > 1 ? [{ label: "Part", chips: parts.map((p) => ({
           key: p.key, label: p.label, ok: true, on: p.key === part.key,
           onPick: () => { const top = listFor(e, p)[0]; setP({ part: p.key, id: top.id, qty: qtyOf(top), q: "" }); },
         })) }] : [];
-        const price = (c) => (c.brand === "wedi" ? c.item.retail : c.retail);
+        const price = (x) => (x.brand === "wedi" ? x.item.retail : x.retail);
         return (
           <SwapPop add at={pick.at} className="cmp-pick" stockFirst={false}
-            title={`${e.match ? "Swap" : "Add to"} ${BRAND[plan.brand]} · ${groupLabel(e.grp)} — for ${e.host.name}`}
+            title={`${e.match ? "Swap" : "Add to"} ${c.name} · ${groupLabel(e.grp)} — for ${e.host.name}`}
             rows={partRow} qty={pick.qty} onQty={(n) => setP({ qty: n })}
             summary={{ what: (pick.qty > 1 ? pick.qty + " × " : "") + cur.item.name, why: [cur.id, cur.item.stock ? "stock" : "special order"].join(" · "),
               delta: "retail", total: fm(price(cur) * pick.qty), up: false }}
-            onUse={() => { writeMirror(e.hostKey, { pick: { g: cur.g, id: cur.id, qty: pick.qty } }); setPick(null); }}
+            onUse={() => { writeMirror(pick.cell, e.hostKey, { pick: { g: cur.g, id: cur.id, qty: pick.qty } }); setPick(null); }}
             onClose={() => setPick(null)}>
             {list.length > 12 && (
               <input className="w-full rounded-md border border-slate-300 px-2 py-1 mb-1 text-[12px]" autoFocus value={pick.q}
                 placeholder={`Search ${part.label.toLowerCase()}…`} onChange={(ev) => setP({ q: ev.target.value })} data-add-search />
             )}
             <div className="cmp-list">
-              {shown.slice(0, 60).map((c) => (
-                <button key={c.g + c.id} type="button" className={"srow" + (c.id === cur.id ? " on" : "")} data-mirror-row={c.id}
-                  onClick={() => setP({ id: c.id, qty: qtyOf(c) })}>
-                  <span className={"sdot" + (c.item.stock ? "" : " so")} />
-                  <span className="n">{c.item.name}<small>{[c.brand === "wedi" ? c.item.sizeText : c.item.size, c.id, c.item.stock ? "stock" : "special order"].filter(Boolean).join(" · ")}</small></span>
-                  <span className="p">{fm(price(c))}</span>
+              {shown.slice(0, 60).map((x) => (
+                <button key={x.g + x.id} type="button" className={"srow" + (x.id === cur.id ? " on" : "")} data-mirror-row={x.id}
+                  onClick={() => setP({ id: x.id, qty: qtyOf(x) })}>
+                  <span className={"sdot" + (x.item.stock ? "" : " so")} />
+                  <span className="n">{x.item.name}<small>{[x.brand === "wedi" ? x.item.sizeText : x.item.size, x.id, x.item.stock ? "stock" : "special order"].filter(Boolean).join(" · ")}</small></span>
+                  <span className="p">{fm(price(x))}</span>
                 </button>
               ))}
               {!shown.length && <div className="more">Nothing matches — clear the search</div>}
@@ -461,20 +558,20 @@ export default function CompareTab({
               <button className="xbtn" onClick={() => setConfirm(null)}><X size={14} /></button>
             </div>
             <div className="bb">
-              {/* The money here is the compare grid's own total, not a re-sum of the
+              {/* The money here is each cell's own total, not a re-sum of the
                   payload rows — they agree because compareTotals and each engine's
                   lineItems both drop the noteOnly lines and both land RETAIL (ADR 0018). */}
-              <div className="orow">
-                <span className="c">A</span><span>wedi — {confirm.wediLines.length} line{confirm.wediLines.length === 1 ? "" : "s"}</span>
-                <span className="v">{fm(wTot.retail)}</span>
-              </div>
-              <div className="orow">
-                <span className="c">B</span><span>Schluter — {confirm.schluterLines.length} line{confirm.schluterLines.length === 1 ? "" : "s"}</span>
-                <span className="v">{fm(sTot.retail)}</span>
-              </div>
+              {confirm.map((o, i) => (
+                <div className="orow" key={o.key} data-cmp-option={LETTERS[i]}>
+                  <span className="c">{LETTERS[i]}</span>
+                  <span>{o.name} — {o.lines.length} line{o.lines.length === 1 ? "" : "s"}</span>
+                  {o.flags.map((f) => <span key={f.id} className="fl">{f.label}</span>)}
+                  <span className="v">{fm(o.total)}</span>
+                </div>
+              ))}
               <div className="bn">
-                Two new sibling areas land beside this one, tagged option A and B. Rows land <b>RETAIL</b> — the
-                job sheet's own tier lens reprices them (ADR 0018) — and each side's anchor row keeps its
+                {confirm.length} new sibling areas land beside this one, tagged options A–{lastLetter(confirm.length)}. Rows
+                land <b>RETAIL</b> — the job sheet's own tier lens reprices them (ADR 0018) — and each anchor row keeps its
                 configurator marker, so "reconfigure" reopens the build it came from.
               </div>
             </div>
@@ -482,11 +579,11 @@ export default function CompareTab({
               <button className="cbtn" onClick={() => setConfirm(null)}>Cancel</button>
               <button className="cbtn primary" data-compare-confirm
                 onClick={() => {
-                  const p = confirm;
+                  const opts = confirm;
                   setConfirm(null);
-                  onQuoteOptions({ wediLines: p.wediLines, schluterLines: p.schluterLines, label: areaName });
+                  onQuoteOptions({ options: opts.map((o) => ({ lines: o.lines, name: o.name })), label: areaName });
                 }}>
-                Add options A &amp; B
+                Add options A–{lastLetter(confirm.length)}
               </button>
             </div>
           </div>
```

### Task 5: Records and full verification

**Model:** Sonnet.

- [ ] **Step 1: ADR 0034.** Append "Amendment — Phase 3 (2026-09-28): the
  four-way grid":
  - Decision 3 becomes: the host cell is live and three cells are derived.
    The same brand's other wall system carries the host's added lines as
    they are; the other brand mirrors them, per cell.
  - Decision 4 becomes: N options, lettered A–D in reading order, in one
    patch. The old two-array shape stays readable (ruling 1).
  - Record that `comparegrid.js` imports only `comparekit.js` (decision 1
    holds).
  - Leave the "Open" item about sending with no feedback open.
  - Add a line to `docs/adr/README.md`'s entry if it lists amendments.
- [ ] **Step 2: ADR 0051.** Add a note: grid cells take the no-fit answer
  "wedi pan + S-DRY walls, flagged", and the detail offers the nearest base
  instead (ruling 4).
- [ ] **Step 3: `src/CLAUDE.md`.**
  - Add a new entry for `comparegrid.js`.
  - Update `comparekit.js` (the helpers from Task 1), `CompareTab.jsx` (the
    grid, per-cell mirror, N options) and `options.js`
    (`compareOptionsPatch`).
  - Add `comparegridgolden.js` beside the other goldens.
- [ ] **Step 4: The spec.** Fill "Amendments during planning and build" with
  rulings 1–9.
- [ ] **Step 5: Ticket and handoff.**
  - Mark Phase 3 done in `.scratch/158_shower-config-roadmap/ticket.md`,
    with the spec, plan, proof and PR.
  - Write `.scratch/handoffs/shower-config-phase4-2026-09-28.md` from the
    Phase 3 handoff's shape.
- [ ] **Step 6: Full verification.**
  - `npm test`, `npm run lint`, and the build.
  - The boot-chunk grep from Task 4.
  - `git diff --stat f9f32c1` must show no change to `src/wedi.js`,
    `src/schluter.js`, `src/sdry.js`, `src/WediConfigurator.jsx`,
    `src/SchluterConfigurator.jsx` or `src/App.jsx`.
- [ ] **Step 7: Commit** — `Phase 3 records: ADR 0034/0051 amendments, src/CLAUDE.md, spec amendments, ticket, handoff`.

## After the tasks

1. A final whole-branch review (Opus), then one fix wave.
2. The PR against `main`, with the g1–g7 shots and the changed p1d/p2
   Compare shots as preview proof.
3. Subscribe to the PR.
