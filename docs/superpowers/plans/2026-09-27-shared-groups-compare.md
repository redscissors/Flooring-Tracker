# Shared Groups and Compare Alignment (Phase 1d) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Both shower bills, both print sheets and the Compare tab use one
group list: Base · Drain · Curb · Walls · Seams · Niches · Bench · Setting ·
Extras. Compare lines both brands up row by row by slot. Every line the
host popup added by hand is mirrored onto the other brand: the nearest part
in the same slot, or a "+" that opens that brand's picker.

**Architecture:**
- **The display group comes from the slot.**
  - `src/slots.js` gains `GROUPS` / `groupOf` / `groupLabel`.
  - Both popups and Compare draw a line under `groupOf(line.slot)`.
  - The engines' own groups (Schluter `l.g`, wedi `l.group`) stay as they
    are. They are internal keys, already saved in qty-override keys and
    added rows, so no saved shape changes and nothing translates on read.
- **The "+" tables are re-keyed by shared group.**
  - `ADD_PARTS` / `WEDI_ADD_PARTS` entries each carry the engine group an
    add stores (`g` / `group`).
  - A part's `hit` only matches parts whose slot, read under that engine
    group, lands back in the offering group. So "+" and display can never
    disagree.
  - The popups key rows by `add.g`, the engine group, and list parts by
    `add.grp`, the shared group.
- **One slot re-tag.** wedi `fastener` → `wallBoard`, so fasteners sit with
  the panels.
- **The mirror.**
  - `src/comparemirror.js` is new and engine-free: size readers, ranking and
    qty.
  - `src/comparekit.js` adds the brand-specific side: `hostAddedLines`,
    `mirrorParts`, `mirrorCandidates`, `mirrorPlan`, `mirrorRow`,
    `pruneMirror` and `compareLayout`. It stays the only module that
    imports both engines.
  - `CompareTab` rebuilds the other brand's house kit with the plan's
    `manual` rows, so that engine bills them. The rows, "+", ⇄, × and the
    picker are drawn in the tab.
  - The popups hold the pick/drop state for the session (`mirror`).

**Tech Stack:** React 18 (hooks), Vite 5, Tailwind, plain `node --test`
(`npm test` = `node --test src/*.test.js`), ESLint (`npm run lint`), Playwright
for preview proof.

**Spec:** `docs/superpowers/specs/2026-09-27-shared-groups-compare-design.md`.
Read it first. It builds on 1a/1b/1c
(`docs/superpowers/specs/2026-09-26-drain-slot-design.md`,
`docs/superpowers/specs/2026-09-26-swap-every-line-design.md`,
`docs/superpowers/specs/2026-09-27-add-another-design.md`, each with its
Amendments section) and ADR 0049
(`docs/adr/0049-configurator-swaps-remember-the-choice.md`). The ticket is
`.scratch/158_shower-config-roadmap/ticket.md` (Phase 1).

**Prototype:** every diff below was run in a scratch worktree off `804a1c0`
first:
- the full suite green (1779 tests after Task 5);
- lint clean;
- the 1a–1c proof scripts and both new p1d scripts passing.

Each task's diff applies with `git apply` on top of the previous task's.

## Global Constraints

- **No saved kit's bill moves.** Both goldens stay green, untouched:
  `src/wedimarkergolden.test.js` (1b) and `src/addedgolden.test.js` (1c).
  Run `npm test` after every task; it must end `# fail 0`.
- **Engine groups are internal keys.** Never rename Schluter `l.g` values
  ("Base", "Walls", "Extras"…) or wedi buckets ("floor", "install",
  "addon"…). Never write the shared group key into a marker. Added rows are
  still keyed by engine group + part (1c).
- **Display group = `groupOf(line.slot)`.** Every bill line needs a `slot`.
  A line built without one files under Extras, which is a bug.
- **Lookups key on engine group + part**, never part alone. That covers mirror
  state keys (`"<engine group>|<sku or key>"`), picks
  (`{ g, id, qty }`) and the engine's `manual` rows.
- **The mirror's picker and auto-match share one candidate function**
  (`mirrorParts` → `mirrorCandidates`). The picker never decides availability
  by a rule of its own.
- **comparekit.js stays the only module importing both engines.**
  `comparemirror.js` imports no engine. Both are LAZY-CHUNK-ONLY (ADR 0026),
  reached only through `CompareTab.jsx`.
- **Comments:** be conservative (root `CLAUDE.md` "Code Comments").
- **Branch and deploy rules.** Work on `claude/shower-config-phase-1d-eafhd0`.
  Never push to `main`. Never touch the live Supabase project. UI changes
  need preview screenshots (Task 7).
- **Build locally** with placeholder env:
  `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build`
  (a pre-existing CSS minify warning prints; ignore it).
- **Commit trailer:** end every commit message with the session's attribution
  lines. The harness supplies them.
- **Preview server** for every shoot step: `npx vite --port 5199 --strictPort`
  in the background. Load Playwright with
  `createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core")`
  and `executablePath: "/opt/pw-browsers/chromium"`.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/slots.js` | modify | `GROUPS` (nine, owner order), `groupOf(slot)`, `groupLabel(key)` |
| `src/slots.test.js` | modify | groups cover every slot once; `groupOf` |
| `src/schluter.js` | modify | `ADD_PARTS` keyed by shared group, each part with its engine `g`; `addParts` / `addPartOf` take the shared key |
| `src/schluter.test.js` | modify | "+" tables by shared key; every part lands back in its group |
| `src/SchluterConfigurator.jsx` | modify | bill and print by `GROUPS`; `openAdd(grp)` with `add.grp` / `add.g`; `mirror` state → CompareTab |
| `src/wedi.js` | modify | fastener → `wallBoard`; `WEDI_ADD_PARTS` keyed by shared group, each part with its bucket `group`; PRO-SET and Recess kit parts |
| `src/wedi.test.js` | modify | as Schluter; the fastener slot |
| `src/WediConfigurator.jsx` | modify | bill and print by `GROUPS`; the add-on chips as their own block; Browse-only lines get `slot`; `openAdd(grp)`; `mirror` state |
| `src/comparemirror.js` | create | engine-free size readers, `sizeDistance`, `rankParts`, `nearest`, `matchQty` |
| `src/comparemirror.test.js` | create | its tests |
| `src/comparekit.js` | modify | rows carry `group` / `slot` / `key` / `added`; `COMPARE_CATS` / `WEDI_CAT` retire; build-fors take `manual`; the mirror functions; `compareLayout` |
| `src/comparekit.test.js` | modify | group asserts replace category asserts; the mirror |
| `src/CompareTab.jsx` | modify | group bands + slot rows; mirrored lines with ⇄ / ×; "+" rows; the picker |
| `.scratch/158_shower-config-roadmap/p1d/*.mjs` | create | proof scripts |
| `.scratch/158_shower-config-roadmap/p1b/shoot-schluter.mjs`, `p1c/shoot-schluter.mjs`, `p1c/shoot-wedi.mjs` | modify | the renamed groups |
| records | modify | spec Amendments, ADR 0049, `src/CLAUDE.md`, ticket, handoff |

## Rulings made while prototyping (record them in Task 8)

1. **The add-on chips stay a block of their own**, titled "Add-ons", below
   the nine groups, on both bills.
   - Schluter already draws them that way. wedi's chips move out of the
     retired Add-ons bucket into the same kind of block.
   - The spec's "niche chips move into Niches" is amended. What a chip adds
     still lands in its own group.
2. **`comparemirror.js` is engine-free.** comparekit hands it parts
   (`{ brand, item, slot, g, id, cov, retail }`), so comparekit stays the one
   module importing both engines. This amends the spec's "Where the code
   lives".
3. **A Schluter niche's size is read from the SKU only** (`KB..SN<mm><mm>`).
   The lighted niche (`KB12SNLT…`) has none, so it never auto-matches. It is
   still in the picker's list.
4. **`data-add-group` carries the group label** ("Niches"), for the proof
   scripts.
5. **`schluterBuildFor` bills `cfg.manual`.** `buildKit` bills the recipe
   only; every other caller (`buildFromMarker`, the popup) pushes
   `addedLines` itself.
6. **wedi Browse-only lines get `slot`.** They had none and would have filed
   under Extras.
7. **wedi's Walls Fit / One-size control** shows only when the Walls group
   holds a kit panel, since fasteners now share the group.
8. **A "+" part only offers parts that land back in its group.** Without
   this, wedi's "Other" caught S-DRY parts that `wediSlotOf` files under
   Seams, and PRO-SET (catalog group `sdry`) showed under "Membrane & tape".
9. **The mirror "+" is shown only when the brand has parts for that group.**
   Otherwise the row reads "No Schluter flange in the book".
10. **The picker's price is retail**, whatever the Compare lens. It is a list
    of parts, not a quote.
11. **A pick whose part left the book reads as "none"** (a "+"). It never
    falls back to an auto-match silently.
12. **Two host lines landing on one part sum into one engine row.** The
    Compare column still draws one mirrored line per host line; the totals
    agree.
13. **Kit-line group coverage.** It is pinned by the Compare-row tests (the
    60×38 point build on both brands, every row a known group and slot) and
    by the "+" round-trip tests. There is no separate per-build-type fixture
    sweep.

---

### Task 1: `slots.js` — the nine shared groups

**Model:** Sonnet (mechanical; the plan holds the code).

**Files:**
- Modify: `src/slots.js`
- Test: `src/slots.test.js`

**Interfaces:**
- Consumes: `SLOTS`, `SLOT_LABEL` (existing).
- Produces (exported from `src/slots.js`):
  - `GROUPS: { key, label, slots: string[] }[]` — in order `base`, `drain`,
    `curb`, `walls`, `seams`, `niches`, `bench`, `setting`, `extras`;
    labels Base · Drain · Curb · Walls · Seams · Niches · Bench · Setting ·
    Extras; every slot in exactly one group.
  - `groupOf(slot) → string` — the group key; an unknown or missing slot →
    `"extras"`.
  - `groupLabel(key) → string` — the label, or the key itself when unknown.

- [ ] **Step 1: Write the failing tests** — apply to `src/slots.test.js`:

```diff
diff --git a/src/slots.test.js b/src/slots.test.js
index 9745e9e..95d9e28 100644
--- a/src/slots.test.js
+++ b/src/slots.test.js
@@ -1,9 +1,29 @@
 import { test } from "node:test";
 import assert from "node:assert/strict";
-import { SLOTS, SLOT_LABEL, isSlot } from "./slots.js";
+import { SLOTS, SLOT_LABEL, isSlot, GROUPS, groupOf, groupLabel } from "./slots.js";
 
 test("every slot has a label and isSlot knows the list", () => {
   for (const s of SLOTS) assert.equal(typeof SLOT_LABEL[s], "string");
   assert.equal(isSlot("drainBody"), true);
   assert.equal(isSlot("nope"), false);
 });
+
+test("GROUPS holds every slot exactly once, in the owner's order", () => {
+  assert.deepEqual(GROUPS.map((g) => g.label),
+    ["Base", "Drain", "Curb", "Walls", "Seams", "Niches", "Bench", "Setting", "Extras"]);
+  const all = GROUPS.flatMap((g) => g.slots);
+  assert.deepEqual([...all].sort(), [...SLOTS].sort());
+  assert.equal(new Set(all).size, all.length);
+});
+
+test("groupOf reads a slot's group; an unknown slot is an extra", () => {
+  assert.equal(groupOf("tray"), "base");
+  assert.equal(groupOf("grate"), "drain");
+  assert.equal(groupOf("wallMembrane"), "walls");
+  assert.equal(groupOf("corners"), "seams");
+  assert.equal(groupOf("niche"), "niches");
+  assert.equal(groupOf("setting"), "setting");
+  assert.equal(groupOf("nope"), "extras");
+  assert.equal(groupOf(undefined), "extras");
+  assert.equal(groupLabel("niches"), "Niches");
+});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test src/slots.test.js`
Expected: FAIL — `GROUPS` / `groupOf` / `groupLabel` are not exported.

- [ ] **Step 3: Implement** — apply to `src/slots.js`:

```diff
diff --git a/src/slots.js b/src/slots.js
index ca1f7d1..fcd630f 100644
--- a/src/slots.js
+++ b/src/slots.js
@@ -12,3 +12,23 @@ export const SLOT_LABEL = {
 };
 
 export const isSlot = (s) => SLOTS.includes(s);
+
+// The bill groups both popups and Compare draw (Phase 1d, owner order). A
+// line's group is read off its slot, never off the engine's own group key —
+// those stay internal (saved override keys and added rows carry them).
+export const GROUPS = [
+  { key: "base", label: "Base", slots: ["tray"] },
+  { key: "drain", label: "Drain", slots: ["drainBody", "grate", "flange"] },
+  { key: "curb", label: "Curb", slots: ["curb"] },
+  { key: "walls", label: "Walls", slots: ["wallBoard", "wallMembrane"] },
+  { key: "seams", label: "Seams", slots: ["seam", "corners"] },
+  { key: "niches", label: "Niches", slots: ["niche"] },
+  { key: "bench", label: "Bench", slots: ["bench"] },
+  { key: "setting", label: "Setting", slots: ["setting"] },
+  { key: "extras", label: "Extras", slots: ["extra"] },
+];
+
+/** The group key a slot draws under; an unknown slot is an extra. */
+export const groupOf = (slot) => (GROUPS.find((g) => g.slots.includes(slot)) || GROUPS[GROUPS.length - 1]).key;
+
+export const groupLabel = (key) => (GROUPS.find((g) => g.key === key) || {}).label || key;
```

- [ ] **Step 4: Run the tests**

Run: `node --test src/slots.test.js` → PASS; `npm test` → `# fail 0`
(1749); `npm run lint` → clean.

- [ ] **Step: Commit**

```bash
git add src/slots.js src/slots.test.js
git commit -m "slots: the nine shared bill groups, groupOf, groupLabel (158 1d)"   # (end the message with the session's attribution lines)
```

---

### Task 2: Schluter — "+" parts by shared group; bill and print by `GROUPS`

**Model:** Opus (popup UI; the "+" wiring keys saved rows).

**Files:**
- Modify: `src/schluter.js` (the `ADD_PARTS` block, `addParts`, `addPartOf`,
  one import)
- Modify: `src/SchluterConfigurator.jsx` (drop the local `GROUPS`; `openAdd`,
  `canSwapAdded`, the "+" panel, the bill loop, the print table)
- Test: `src/schluter.test.js`

**Interfaces:**
- Consumes: `GROUPS`, `groupOf`, `groupLabel` (Task 1); `slotOf`,
  `addedLines`, `setAddedQty`, `addedQty` (existing, unchanged).
- Produces:
  - `ADD_PARTS: { [sharedGroupKey]: { key, label, g, hit?, stepped? }[] }`
    — keys `base drain curb walls seams niches bench setting extras`; `g`
    is the engine group an add stores ("Base", "Drain", "Curb", "Walls",
    "Seams", "Extras", "Setting"); `hit(i)` only matches when
    `groupOf(slotOf(g, i))` is the offering group.
  - `addParts(grp, cat, { linear })` / `addPartOf(grp, item)` — `grp` is the
    shared key now.
  - Popup: the `add` state is `{ grp, g, part, qty, q, draft, replace, rect,
    anchor }` — `grp` lists the parts and titles the panel; `g` keys every
    `addedQty` / `setAddedQty` call (the added line's own `l.g` on ⇄, else
    the part's `g`; a Part-row pick sets both `part` and `g`).
  - `data-add-group` carries the group **label** ("Niches").

- [ ] **Step 1: Write the failing tests** — apply to `src/schluter.test.js`:

```diff
diff --git a/src/schluter.test.js b/src/schluter.test.js
index 422d13f..2c88e66 100644
--- a/src/schluter.test.js
+++ b/src/schluter.test.js
@@ -3,8 +3,8 @@ import assert from "node:assert/strict";
 import { FIXTURE_ITEMS } from "./schluterfixture.js";
 import { FINISH_LABEL, ovKey, rowItemEntry, sessionFromRows, classify, catalogOf, coverageOf, trayCandidates, pickRolls, pickFrom, buildKit, buildFromMarker, linesTotal, tierPrice, lineItems, orderCopyLines, entryOpening, openRuns, boardPlan, boardSheets, expandBoardFaces, normBench, benchTrayRoom, slotOf, resolveDrain, drainOptions, pointGrateLabel,
   resolveMembrane, membraneOptions, resolveBand, bandOptions, bandWidthLabel,
-  addedGroup, addedLines, setAddedQty, addParts, addPartOf, addRollOptions, drainAddOptions, applyBoardPlan, applyQtyOv } from "./schluter.js";
-import { isSlot } from "./slots.js";
+  addedGroup, addedLines, setAddedQty, ADD_PARTS, addParts, addPartOf, addRollOptions, drainAddOptions, applyBoardPlan, applyQtyOv } from "./schluter.js";
+import { isSlot, groupOf } from "./slots.js";
 
 const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
 
@@ -1403,20 +1403,38 @@ test("setAddedQty: rows key on group + sku; 0 removes; order kept", () => {
   assert.deepEqual(setAddedQty([{ sku: "KEBA100/125", qty: 1 }], "Seams", "KEBA100/125", 2, CAT), [{ sku: "KEBA100/125", qty: 2, g: "Seams" }], "an old row with no g is the same row");
 });
 
-test("addParts / addPartOf: each group's '+' parts, only those the catalog carries", () => {
+test("addParts / addPartOf: each shared group's '+' parts, only those the catalog carries", () => {
   const keys = (g, c = CAT) => addParts(g, c).map((p) => p.key);
-  assert.deepEqual(keys("Drain"), ["drain", "grate", "body", "flange"]);
-  assert.deepEqual(addParts("Drain", CAT, { linear: false }).map((p) => p.key), ["grate", "body", "flange"], "a point build's Drain + leads with the grate");
-  assert.deepEqual(keys("Walls"), ["board", "membrane", "fastener"]);
-  assert.deepEqual(keys("Seams"), ["band", "corners"]);
-  assert.deepEqual(keys("Extras"), ["niche", "bench", "other"]);
-  assert.deepEqual(keys("Setting"), ["setting"]);
-  assert.deepEqual(keys("Drain", CAT.filter((i) => i.part !== "channel")), ["grate", "flange"], "no channel or body — no Drain or Body part");
-  assert.equal(addPartOf("Walls", sk("KB1212202440")).key, "board");
-  assert.equal(addPartOf("Extras", sk("KB1212202440")).key, "bench");
-  assert.equal(addPartOf("Seams", sk("KEBA100/125")).key, "band");
-  assert.equal(addPartOf("Walls", sk("KERDI200/10M")).key, "membrane");
-  assert.equal(addPartOf("Drain", sk("KLVRID3EB244")).key, "body");
+  assert.deepEqual(keys("drain"), ["drain", "grate", "body", "flange"]);
+  assert.deepEqual(addParts("drain", CAT, { linear: false }).map((p) => p.key), ["grate", "body", "flange"], "a point build's Drain + leads with the grate");
+  assert.deepEqual(keys("base"), ["tray", "membrane"]);
+  assert.deepEqual(keys("curb"), ["curb"]);
+  assert.deepEqual(keys("walls"), ["board", "membrane", "fastener"]);
+  assert.deepEqual(keys("seams"), ["band", "corners"]);
+  assert.deepEqual(keys("niches"), ["niche"]);
+  assert.deepEqual(keys("bench"), ["bench"]);
+  assert.deepEqual(keys("setting"), ["setting"]);
+  assert.deepEqual(keys("extras"), ["other"]);
+  assert.deepEqual(keys("drain", CAT.filter((i) => i.part !== "channel")), ["grate", "flange"], "no channel or body — no Drain or Body part");
+  assert.equal(addPartOf("walls", sk("KB1212202440")).key, "board");
+  assert.equal(addPartOf("bench", sk("KB1212202440")).key, "bench");
+  assert.equal(addPartOf("seams", sk("KEBA100/125")).key, "band");
+  assert.equal(addPartOf("walls", sk("KERDI200/10M")).key, "membrane");
+  assert.equal(addPartOf("drain", sk("KLVRID3EB244")).key, "body");
+  assert.equal(addPartOf("niches", sk("KB12SN305508A1")).g, "Extras", "a niche + stores the engine's Extras group");
+  assert.equal(addPartOf("extras", sk("KB12SN305508A1")), null, "a niche is never an Other extra");
+});
+
+test("every Schluter '+' part lands back in the group that offered it", () => {
+  for (const [grp, parts] of Object.entries(ADD_PARTS)) {
+    for (const p of parts) {
+      if (!p.hit) continue;
+      for (const e of CAT.filter(p.hit)) {
+        const [line] = addedLines([{ sku: e.sku, qty: 1, g: p.g }], CAT);
+        assert.equal(groupOf(line.slot), grp, `${e.sku} added by ${grp}/${p.key} draws under ${groupOf(line.slot)}`);
+      }
+    }
+  }
 });
 
 test("addRollOptions: Width → Roll with no Auto; a width alone lands on its first roll", () => {
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test src/schluter.test.js`
Expected: FAIL — `addParts("drain", …)` is empty (the table is still keyed
"Drain"), and the round-trip test can't find `ADD_PARTS.niches`.

- [ ] **Step 3: Implement the engine** — apply to `src/schluter.js`:

```diff
diff --git a/src/schluter.js b/src/schluter.js
index 70ff7af..453be06 100644
--- a/src/schluter.js
+++ b/src/schluter.js
@@ -15,6 +15,7 @@
 import { queryHit, parseQuery, querySummary, seedFromQuery } from "./schluterquery.js";
 import { BENCH_DEPTH, WALL_THICK } from "./showerdraw.js";
 import { planPanels } from "./panelplan.js";
+import { groupOf } from "./slots.js";
 
 export { queryHit, parseQuery, querySummary, seedFromQuery };
 
@@ -896,48 +897,53 @@ export function setAddedQty(manual, g, sku, n, cat) {
   return [...rest.slice(0, at), row, ...rest.slice(at)];
 }
 
-// What a "+" on each bill group can add (Phase 1c). A stepped part opens the
-// swap popover's rows without Auto; the rest are one-click lists.
+// What a "+" on each shared bill group (slots.js GROUPS) can add. Each part
+// names the engine group `g` its rows store — the key the recipe, the added
+// rows and the qty overrides already speak — and only offers parts whose slot,
+// read under that `g`, lands back in the group that offered it. A stepped part
+// opens the swap popover's rows without Auto; the rest are one-click lists.
 const benchBoard = (i) => i.g === "board" && !i.fastener;
+const plusPart = (grp, g, key, label, hit, stepped) => ({
+  key, label, g, ...(stepped ? { stepped } : {}),
+  ...(hit ? { hit: (i) => hit(i) && groupOf(slotOf(g, i)) === grp } : {}),
+});
 export const ADD_PARTS = {
-  Base: [{ key: "tray", label: "Tray", hit: (i) => i.g === "tray" }, { key: "membrane", label: "Membrane", hit: (i) => i.g === "membrane" }],
-  Drain: [
-    { key: "drain", label: "Drain", stepped: "drain" },
-    { key: "grate", label: "Grate", hit: (i) => i.part === "grate" || i.part === "cover" },
-    { key: "body", label: "Body", hit: (i) => i.part === "channel" || i.part === "body" },
-    { key: "flange", label: "Flange", hit: (i) => i.part === "flange" },
+  base: [plusPart("base", "Base", "tray", "Tray", (i) => i.g === "tray"), plusPart("base", "Base", "membrane", "Membrane", (i) => i.g === "membrane")],
+  drain: [
+    plusPart("drain", "Drain", "drain", "Drain", null, "drain"),
+    plusPart("drain", "Drain", "grate", "Grate", (i) => i.part === "grate" || i.part === "cover"),
+    plusPart("drain", "Drain", "body", "Body", (i) => i.part === "channel" || i.part === "body"),
+    plusPart("drain", "Drain", "flange", "Flange", (i) => i.part === "flange"),
   ],
-  Walls: [
-    { key: "board", label: "Board", hit: benchBoard },
-    { key: "membrane", label: "Membrane", stepped: "membrane", hit: (i) => i.g === "membrane" },
-    { key: "fastener", label: "Fasteners", hit: (i) => !!i.fastener },
+  curb: [plusPart("curb", "Curb", "curb", "Curb", (i) => i.g === "curb")],
+  walls: [
+    plusPart("walls", "Walls", "board", "Board", benchBoard),
+    plusPart("walls", "Walls", "membrane", "Membrane", (i) => i.g === "membrane", "membrane"),
+    plusPart("walls", "Walls", "fastener", "Fasteners", (i) => !!i.fastener),
   ],
-  Seams: [
-    { key: "band", label: "Band", stepped: "band", hit: (i) => i.g === "seam" && !!i.lf },
-    { key: "corners", label: "Corners & seals", hit: (i) => i.g === "seam" && !i.lf },
-  ],
-  Curb: [{ key: "curb", label: "Curb", hit: (i) => i.g === "curb" }],
-  Setting: [{ key: "setting", label: "Setting", hit: (i) => i.g === "set" }],
-  Extras: [
-    { key: "niche", label: "Niche", hit: (i) => i.extra === "niche" },
-    { key: "bench", label: "Bench", hit: (i) => i.extra === "bench" || i.extra === "benchkit" || benchBoard(i) },
-    { key: "other", label: "Other", hit: (i) => (i.g === "extra" && !["niche", "bench", "benchkit"].includes(i.extra)) || i.g === "kit" },
+  seams: [
+    plusPart("seams", "Seams", "band", "Band", (i) => i.g === "seam" && !!i.lf, "band"),
+    plusPart("seams", "Seams", "corners", "Corners & seals", (i) => i.g === "seam" && !i.lf),
   ],
+  niches: [plusPart("niches", "Extras", "niche", "Niche", (i) => i.extra === "niche")],
+  bench: [plusPart("bench", "Extras", "bench", "Bench", (i) => i.extra === "bench" || i.extra === "benchkit" || benchBoard(i))],
+  setting: [plusPart("setting", "Setting", "setting", "Setting", (i) => i.g === "set")],
+  extras: [plusPart("extras", "Extras", "other", "Other", (i) => i.g === "extra" || i.g === "kit")],
 };
 
 const DRAIN_ADD = (i) => (i.g === "drain" && i.part === "channel" && i.len) || (i.g === "line" && i.part === "body");
 
 /**
- * The "+" parts a group offers with this catalog — a part with nothing to add
- * never shows. A whole drain is a linear build's add (`linear`); a point
- * build's Drain "+" leads with the grate.
+ * The "+" parts a shared group (`grp`, slots.js) offers with this catalog — a
+ * part with nothing to add never shows. A whole drain is a linear build's add
+ * (`linear`); a point build's Drain "+" leads with the grate.
  */
-export function addParts(g, cat, { linear = true } = {}) {
-  return (ADD_PARTS[g] || []).filter((p) => (p.stepped === "drain" ? linear && cat.some(DRAIN_ADD) : cat.some(p.hit)));
+export function addParts(grp, cat, { linear = true } = {}) {
+  return (ADD_PARTS[grp] || []).filter((p) => (p.stepped === "drain" ? linear && cat.some(DRAIN_ADD) : cat.some(p.hit)));
 }
 
-/** The part an added line's ⇄ swaps within: the first of its group's parts whose rule matches it. */
-export const addPartOf = (g, item) => (ADD_PARTS[g] || []).find((p) => p.hit && p.hit(item)) || null;
+/** The part an added line's ⇄ swaps within: the first of its shared group's parts whose rule matches it. */
+export const addPartOf = (grp, item) => (ADD_PARTS[grp] || []).find((p) => p.hit && p.hit(item)) || null;
 
 export const VARIO_DESIGN = { 3: "Square", 5: "Floral", 13: "Herringbone", 14: "Slant" };
 const cheapestFirst = (list) => list.slice().sort((a, b) => a.len - b.len || a.price - b.price);
```

- [ ] **Step 4: Implement the popup** — apply to `src/SchluterConfigurator.jsx`:

```diff
diff --git a/src/SchluterConfigurator.jsx b/src/SchluterConfigurator.jsx
index fe0d2cf..b224ca5 100644
--- a/src/SchluterConfigurator.jsx
+++ b/src/SchluterConfigurator.jsx
@@ -22,6 +22,7 @@ import {
   applyBoardPlan, applyQtyOv,
 } from "./schluter.js";
 import { SwapPop, fmDelta, inchGlyph } from "./swappop.jsx";
+import { GROUPS, groupOf, groupLabel } from "./slots.js";
 import { mortarItemFrom, MORTAR_BED_SF_PER_BAG } from "./schluteradapter.js";
 import { useSchluterCatalog } from "./useschlutercatalog.js";
 import { normKitBasketEntry } from "./model.js";
@@ -73,8 +74,6 @@ const SECTIONS = [
 ];
 const sectionHit = (s, i) => (s.hit ? s.hit(i) : s.subs.some((sb) => sb.hit(i)));
 
-const GROUPS = ["Base", "Drain", "Walls", "Seams", "Curb", "Setting", "Extras"];
-
 const inches = (n) => (n % 12 === 0 ? n / 12 + "'" : n + '"');
 const szLbl = (t) => `${inches(t.w)}×${inches(t.d)}`;
 
@@ -1039,18 +1038,21 @@ export default function SchluterConfigurator({
     }
     return null;
   };
-  const openAdd = (g, ev, line) => {
-    const part = line ? addPartOf(g, line.item) : addParts(g, cat, { linear: !!build?.drainFit })[0];
+  // `grp` is the shared group whose "+" (or added line's ⇄) opened the panel;
+  // `g` is the engine group the rows are keyed under — the added line's own,
+  // else the part's.
+  const openAdd = (grp, ev, line) => {
+    const part = line ? addPartOf(grp, line.item) : addParts(grp, cat, { linear: !!build?.drainFit })[0];
     if (!part) return;
     setSwap(null);
     setAdd({
-      g, part: part.key, qty: 1, q: "", draft: addDraft(part, line ? line.item : null), replace: line ? line.item.sku : null,
+      grp, g: line ? line.g : part.g, part: part.key, qty: 1, q: "", draft: addDraft(part, line ? line.item : null), replace: line ? line.item.sku : null,
       rect: ev.currentTarget.getBoundingClientRect(), anchor: ev.currentTarget.closest(line ? ".bline" : ".bg-h"),
     });
   };
   // an added line's ⇄: the part it sits in offers more than itself
   const canSwapAdded = (l) => {
-    const part = l.manual && addPartOf(l.g, l.item);
+    const part = l.manual && addPartOf(groupOf(l.slot), l.item);
     if (!part) return false;
     if (part.stepped) return true;
     return new Set([...pool(cat.filter(part.hit)).map((i) => i.sku), l.item.sku]).size > 1;
@@ -1579,14 +1581,14 @@ export default function SchluterConfigurator({
             <div className="t">Build</div>
             <div className="sub">{inches(cfg.w)}×{inches(cfg.d)}{cfg.maxIn ? " tray (max inside)" : ""} · {cfg.curbed ? "curbed" : "curbless"} · {effDrain} drain · {cfg.wallSys === "board" ? "KERDI-BOARD walls" : "KERDI membrane walls"}{pickCand && pickCand.cut ? ` · tray cut ${pickCand.cut}″` : ""}</div>
           </div>
-          {GROUPS.map((g) => {
-            const gl = build.lines.filter((l) => l.g === g);
+          {GROUPS.map(({ key: g, label }) => {
+            const gl = build.lines.filter((l) => groupOf(l.slot) === g);
             const canAdd = addParts(g, cat).length > 0;
             if (!gl.length && !canAdd) return null;
             return (
               <div className="bgroup" key={g}>
-                <div className="bg-h">{g}
-                  {g === "Walls" && cfg.wallSys === "board" && (
+                <div className="bg-h">{label}
+                  {g === "walls" && cfg.wallSys === "board" && (
                     <span className="wallctl">
                       <span className="pfseg">
                         <button className={panelFit ? "on" : ""} title="mixed sheet sizes, level courses, minimal vertical seams" onClick={() => setPanelFit(true)} data-schluter-fit>Fit</button>
@@ -1594,7 +1596,7 @@ export default function SchluterConfigurator({
                       </span>
                     </span>
                   )}
-                  {canAdd && <button className="addb" title={`add another line to ${g}`} onClick={(ev) => openAdd(g, ev)} data-add-group={g}>+</button>}
+                  {canAdd && <button className="addb" title={`add another line to ${label}`} onClick={(ev) => openAdd(g, ev)} data-add-group={label}>+</button>}
                 </div>
                 {gl.map((l, li) => {
                   const e = l.item;
@@ -1616,7 +1618,7 @@ export default function SchluterConfigurator({
                       )}
                       {canSwapAdded(l) && (
                         <button className="swapb" title="swap this added line" data-schluter-swapb={e.sku} data-added-swapb
-                          onClick={(ev) => openAdd(l.g, ev, l)}>⇄</button>
+                          onClick={(ev) => openAdd(groupOf(l.slot), ev, l)}>⇄</button>
                       )}
                       {!l.noteOnly && (
                         <div className="stepper">
@@ -2324,15 +2326,15 @@ export default function SchluterConfigurator({
   // its qty.
   const addPanel = (() => {
     if (!add || !build) return null;
-    const parts = add.replace ? [addPartOf(add.g, cat.find((i) => i.sku === add.replace))].filter(Boolean) : addParts(add.g, cat, { linear: !!build.drainFit });
+    const parts = add.replace ? [addPartOf(add.grp, cat.find((i) => i.sku === add.replace))].filter(Boolean) : addParts(add.grp, cat, { linear: !!build.drainFit });
     const part = parts.find((p) => p.key === add.part) || parts[0];
     if (!part) return null;
     const setA = (patch) => setAdd((a) => (a ? { ...a, ...patch } : a));
     const r = add.rect;
     const at = { anchor: add.anchor, x: r.right - 470, y: r.bottom + 6 };
     const partRow = !add.replace && parts.length > 1 ? [{ label: "Part", chips: parts.map((p) => ({
-      key: p.key, label: p.label, ok: true, on: p.key === part.key, onPick: () => setA({ part: p.key, draft: addDraft(p, null), q: "" }) })) }] : [];
-    const title = add.replace ? `Swap the added ${part.label.toLowerCase()}` : `Add to ${add.g}`;
+      key: p.key, label: p.label, ok: true, on: p.key === part.key, onPick: () => setA({ part: p.key, g: p.g, draft: addDraft(p, null), q: "" }) })) }] : [];
+    const title = add.replace ? `Swap the added ${part.label.toLowerCase()}` : `Add to ${groupLabel(add.grp)}`;
     const oldQty = add.replace ? addedQty(manual, add.g, add.replace, cat) : 0;
     const old = add.replace ? cat.find((i) => i.sku === add.replace) : null;
     const summaryFor = (items, why) => {
@@ -2471,7 +2473,7 @@ export default function SchluterConfigurator({
       <table className="ps-table">
         <thead><tr><th>SKU</th><th>Description</th><th>Size</th><th className="num">Qty</th><th className="num">{tierId}</th><th className="num">Total</th></tr></thead>
         <tbody>
-          {GROUPS.flatMap((g) => build.lines.filter((l) => l.g === g && !l.noteOnly).map((l, li) => {
+          {GROUPS.flatMap(({ key: g }) => build.lines.filter((l) => groupOf(l.slot) === g && !l.noteOnly).map((l, li) => {
             const p = tierOf(l.item);
             return (
               <tr key={g + (l.item.sku || l.item.name) + li}>
```

- [ ] **Step 5: Verify**

Run: `npm test` → `# fail 0` (1750); `npm run lint` → clean; the build (see
Global Constraints) → built. Then, with the preview server up, open
`schluter-preview.html`, Full catalog, tray KST965/1525: the build column
reads Base · Drain · Curb · Walls · Seams · Niches · Bench · Setting · Extras
(each with "+"), then the Add-ons chip block; "+ Niches" lists the
KERDI-BOARD-SN niches and a click lands one under Niches tagged "added".

- [ ] **Step: Commit**

```bash
git add src/schluter.js src/schluter.test.js src/SchluterConfigurator.jsx
git commit -m "Schluter: + parts keyed by shared group; bill and print draw the nine groups (158 1d)"   # (end the message with the session's attribution lines)
```

---

### Task 3: wedi — fastener slot, "+" parts by shared group; bill and print by `GROUPS`

**Model:** Opus (engine slot change + popup UI).

**Files:**
- Modify: `src/wedi.js` (`WEDI_SLOT.fastener`, the `WEDI_ADD_PARTS` block,
  `wediAddParts`, `wediAddPartOf`, one import)
- Modify: `src/WediConfigurator.jsx` (drop `BUCKETS`; Browse-only lines get
  `slot`; `openAdd`, `canSwapAdded`, the "+" panel, the bill loop, the Add-ons
  chip block, the print table)
- Test: `src/wedi.test.js`

**Interfaces:**
- Consumes: `GROUPS`, `groupOf`, `groupLabel` (Task 1); `wediSlotOf`,
  `wediBucketOf`, `addedRows`, `setAddedRow` (existing).
- Produces:
  - `WEDI_SLOT.fastener === "wallBoard"`.
  - `WEDI_ADD_PARTS: { [sharedGroupKey]: { key, label, group, hit, stepped? }[] }`
    — `group` is the wedi bucket an add stores ("floor", "walls", "bench",
    "drain", "install", "addon"); new parts: Base "Recess kit"
    (`install`), Walls "Fasteners" (`install`), Setting "PRO-SET"
    (`install`, `i.key === SKU.proSet`); `hit(i)` only matches when
    `groupOf(wediSlotOf({ item: i, group }))` is the offering group.
  - `wediAddParts(grp)` / `wediAddPartOf(grp, it)` — `grp` is the shared key.
  - Popup `add` state as Task 2 (`grp` + bucket `g`); a Part-row pick sets
    `g: p.group`.
  - The add-on chips render in their own `Add-ons` block after the groups
    (only with a pan), unchanged inside.

- [ ] **Step 1: Write the failing tests** — apply to `src/wedi.test.js`:

```diff
diff --git a/src/wedi.test.js b/src/wedi.test.js
index 3997c5c..795172e 100644
--- a/src/wedi.test.js
+++ b/src/wedi.test.js
@@ -1,7 +1,7 @@
 import { test } from "node:test";
 import assert from "node:assert/strict";
 import { rowItemKey, sessionFromRows,
-  addedRows, setAddedRow, wediBucketOf, wediAddParts, wediAddPartOf, curbAddOptions, coverAddOptions,
+  addedRows, setAddedRow, wediBucketOf, WEDI_ADD_PARTS, wediAddParts, wediAddPartOf, curbAddOptions, coverAddOptions,
   catalog, item, group, pans, curbs, kitFor, buildFromMarker, solve, figureConsumables, panelPlan,
   openEdges, openCorners, curbRuns, wallSpans, expandWallFaces, WALL_THICK, panThick, BROWSE_SECTIONS, sectionHit,
   tierPrice, lineItems, factoryKit, linearCoverFor, legacyCoverPick, coverStyles, coverFrames, coverFrameFor, dims, round2, inch,
@@ -15,7 +15,7 @@ import { rowItemKey, sessionFromRows,
   resolveCurb, legacyCurbPick, curbOptions, curbPickOf, markerCurbKey,
   panelOptions, panelSheets, fastenerKits,
 } from "./wedi.js";
-import { isSlot } from "./slots.js";
+import { isSlot, groupOf } from "./slots.js";
 
 // Ported whole from the prototype's self-test
 // (.scratch/066_wedi-configurator/proto-engine.js) — 135 assertions, section
@@ -1671,15 +1671,32 @@ test("setAddedRow: rows key on bucket + key; 0 removes; order kept", () => {
   assert.deepEqual(setAddedRow([{ key: SKU.panelDefault, qty: 1 }], "walls", SKU.panelDefault, 2), [{ key: SKU.panelDefault, qty: 2, group: "walls" }], "a groupless row is its default bucket's row");
 });
 
-test("wediAddParts / wediAddPartOf: each bucket's '+' parts", () => {
+test("wediAddParts / wediAddPartOf: each shared group's '+' parts", () => {
   const keys = (b) => wediAddParts(b).map((p) => p.key);
-  assert.deepEqual(keys("walls"), ["panel"]);
+  assert.deepEqual(keys("walls"), ["panel", "fastener"]);
   assert.deepEqual(keys("drain"), ["cover", "frame", "drainKit"].filter((k) => k !== "drainKit" || group("drainKit").length));
-  assert.ok(keys("addon").includes("niche") && keys("addon").includes("shelf"));
-  assert.ok(keys("floor").includes("curb"));
-  assert.equal(wediAddPartOf("addon", item("US3000004")).key, "niche");
+  assert.ok(keys("niches").includes("niche") && keys("niches").includes("shelf"));
+  assert.ok(keys("curb").includes("curb"));
+  assert.ok(keys("setting").includes("proSet"));
+  assert.equal(wediAddPartOf("niches", item("US3000004")).key, "niche");
   assert.equal(wediAddPartOf("bench", item("US3000002")).key, "bench");
-  assert.equal(wediAddPartOf("floor", item(SKU.curbLean60)).key, "curb");
+  assert.equal(wediAddPartOf("curb", item(SKU.curbLean60)).key, "curb");
+  assert.equal(wediAddPartOf("seams", item(SKU.proSet)), null, "PRO-SET is S-DRY by catalog group but a Setting part");
+  assert.equal(wediAddPartOf("setting", item(SKU.proSet)).group, "install");
+});
+
+test("every wedi '+' part lands back in the group that offered it", () => {
+  for (const [grp, parts] of Object.entries(WEDI_ADD_PARTS)) {
+    for (const p of parts) {
+      for (const e of catalog().filter(p.hit)) {
+        assert.equal(groupOf(wediSlotOf({ item: e, group: p.group })), grp, `${e.key} added by ${grp}/${p.key}`);
+      }
+    }
+  }
+});
+
+test("wedi fasteners fill the wall-board slot, beside the panels", () => {
+  assert.equal(wediSlotOf({ item: item(SKU.fastenerKit), group: "install" }), "wallBoard");
 });
 
 test("curbAddOptions: Style → Profile → Length with no Auto or No curb; the piece is one at a real length", () => {
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test src/wedi.test.js`
Expected: FAIL — the bucket-keyed table has no `walls` fasteners / `setting`
PRO-SET, and the fastener slot is still `seam`.

- [ ] **Step 3: Implement the engine** — apply to `src/wedi.js`:

```diff
diff --git a/src/wedi.js b/src/wedi.js
index 6d91bca..8df48c6 100644
--- a/src/wedi.js
+++ b/src/wedi.js
@@ -28,6 +28,7 @@
 
 import { queryHit, parseQuery, querySummary, seedFromQuery } from "./wediquery.js";
 import { planPanels } from "./panelplan.js";
+import { groupOf } from "./slots.js";
 import { WALL_THICK, CURB_LAP, panThick, benchFootprint, BENCH_DEPTH, curbWidthOf } from "./showerdraw.js";
 
 export { queryHit, parseQuery, querySummary, seedFromQuery };
@@ -5322,7 +5323,7 @@ function push(lines, key, qty, grp, note, auto) {
 const WEDI_SLOT = {
   pan: "tray", module: "tray", modExt: "tray", extension: "tray", cornerExt: "tray", kit: "tray", recess: "tray",
   curb: "curb", ramp: "curb", panel: "wallBoard", cover: "grate", coverFrame: "grate", drainKit: "drainBody",
-  collar: "corners", sealant: "seam", fastener: "seam", subliner: "seam", sdry: "seam", tool: "setting",
+  collar: "corners", sealant: "seam", fastener: "wallBoard", subliner: "seam", sdry: "seam", tool: "setting",
   niche: "niche", shelf: "niche", seat: "bench", bench: "bench",
 };
 
@@ -5370,48 +5371,59 @@ export function setAddedRow(manual, group, key, n) {
   return at < 0 ? [...rest, row] : [...rest.slice(0, at), row, ...rest.slice(at)];
 }
 
-// What a "+" on each bucket can add (Phase 1c). A stepped part opens the swap
+// What a "+" on each shared bill group (slots.js GROUPS) can add. Each part
+// names the wedi bucket `group` its rows store — the key kitFor and the added
+// rows already speak — and only offers parts whose slot, read in that bucket,
+// lands back in the group that offered it. A stepped part opens the swap
 // popover's rows without Auto; the rest are one-click lists.
-const ADDON_KINDS = ["niche", "shelf", "seat", "bench"];
+const plusPart = (grp, group, key, label, hit, stepped) => ({
+  key, label, group, ...(stepped ? { stepped } : {}),
+  hit: (i) => hit(i) && groupOf(wediSlotOf({ item: i, group })) === grp,
+});
 export const WEDI_ADD_PARTS = {
-  floor: [
-    { key: "pan", label: "Pan", hit: (i) => ["pan", "module", "kit"].includes(i.group) },
-    { key: "ext", label: "Extension", hit: (i) => ["extension", "modExt", "cornerExt"].includes(i.group) },
-    { key: "curb", label: "Curb", stepped: "curb", hit: (i) => i.group === "curb" && !!i.len },
-    { key: "ramp", label: "Ramp", hit: (i) => i.group === "ramp" },
-  ],
-  walls: [{ key: "panel", label: "Panel", stepped: "panel", hit: (i) => i.group === "panel" && i.sf > 0 }],
-  bench: [
-    { key: "bench", label: "Seat & bench", hit: (i) => i.group === "seat" || i.group === "bench" },
-    { key: "panel", label: "Panel", stepped: "panel", hit: (i) => i.group === "panel" && i.sf > 0 },
+  base: [
+    plusPart("base", "floor", "pan", "Pan", (i) => ["pan", "module", "kit"].includes(i.group)),
+    plusPart("base", "floor", "ext", "Extension", (i) => ["extension", "modExt", "cornerExt"].includes(i.group)),
+    plusPart("base", "install", "recess", "Recess kit", (i) => i.group === "recess"),
   ],
   drain: [
-    { key: "cover", label: "Cover", stepped: "cover", hit: (i) => i.group === "cover" },
-    { key: "frame", label: "Frame", hit: (i) => i.group === "coverFrame" },
-    { key: "drainKit", label: "Drain kit", hit: (i) => i.group === "drainKit" },
+    plusPart("drain", "drain", "cover", "Cover", (i) => i.group === "cover", "cover"),
+    plusPart("drain", "drain", "frame", "Frame", (i) => i.group === "coverFrame"),
+    plusPart("drain", "drain", "drainKit", "Drain kit", (i) => i.group === "drainKit"),
+  ],
+  curb: [
+    plusPart("curb", "floor", "curb", "Curb", (i) => i.group === "curb" && !!i.len, "curb"),
+    plusPart("curb", "floor", "ramp", "Ramp", (i) => i.group === "ramp"),
+  ],
+  walls: [
+    plusPart("walls", "walls", "panel", "Panel", (i) => i.group === "panel" && i.sf > 0, "panel"),
+    plusPart("walls", "install", "fastener", "Fasteners", (i) => i.group === "fastener"),
   ],
-  install: [
-    { key: "fastener", label: "Fasteners", hit: (i) => i.group === "fastener" },
-    { key: "sealant", label: "Sealant", hit: (i) => i.group === "sealant" },
-    { key: "membrane", label: "Membrane & tape", hit: (i) => i.group === "subliner" || i.group === "sdry" },
-    { key: "collar", label: "Collars & seals", hit: (i) => i.group === "collar" },
-    { key: "tool", label: "Tools", hit: (i) => i.group === "tool" },
-    { key: "recess", label: "Recess kit", hit: (i) => i.group === "recess" },
+  seams: [
+    plusPart("seams", "install", "sealant", "Sealant", (i) => i.group === "sealant"),
+    plusPart("seams", "install", "membrane", "Membrane & tape", (i) => i.group === "subliner" || i.group === "sdry"),
+    plusPart("seams", "install", "collar", "Collars & seals", (i) => i.group === "collar"),
+  ],
+  niches: [
+    plusPart("niches", "addon", "niche", "Niche", (i) => i.group === "niche"),
+    plusPart("niches", "addon", "shelf", "Glass shelf", (i) => i.group === "shelf"),
+  ],
+  bench: [
+    plusPart("bench", "addon", "bench", "Seat & bench", (i) => i.group === "seat" || i.group === "bench"),
+    plusPart("bench", "bench", "panel", "Panel", (i) => i.group === "panel" && i.sf > 0, "panel"),
   ],
-  addon: [
-    { key: "niche", label: "Niche", hit: (i) => i.group === "niche" },
-    { key: "shelf", label: "Glass shelf", hit: (i) => i.group === "shelf" },
-    { key: "seat", label: "Seat", hit: (i) => i.group === "seat" },
-    { key: "bench", label: "Bench", hit: (i) => i.group === "bench" },
-    { key: "other", label: "Other", hit: (i) => wediBucketOf(i) === "addon" && !ADDON_KINDS.includes(i.group) },
+  setting: [
+    plusPart("setting", "install", "tool", "Tools", (i) => i.group === "tool"),
+    plusPart("setting", "install", "proSet", "PRO-SET", (i) => i.key === SKU.proSet),
   ],
+  extras: [plusPart("extras", "addon", "other", "Other", (i) => wediBucketOf(i) === "addon")],
 };
 
-/** The "+" parts a bucket offers with this book — a part with nothing to add never shows. */
-export const wediAddParts = (bucket) => (WEDI_ADD_PARTS[bucket] || []).filter((p) => catalog().some(p.hit));
+/** The "+" parts a shared group (`grp`, slots.js) offers with this book — a part with nothing to add never shows. */
+export const wediAddParts = (grp) => (WEDI_ADD_PARTS[grp] || []).filter((p) => catalog().some(p.hit));
 
-/** The part an added line's ⇄ swaps within: the first of its bucket's parts whose rule matches it. */
-export const wediAddPartOf = (bucket, it) => (WEDI_ADD_PARTS[bucket] || []).find((p) => p.hit(it)) || null;
+/** The part an added line's ⇄ swaps within: the first of its shared group's parts whose rule matches it. */
+export const wediAddPartOf = (grp, it) => (WEDI_ADD_PARTS[grp] || []).find((p) => p.hit(it)) || null;
 
 /** The shared slot (slots.js) a kitFor line fills. */
 export function wediSlotOf(line) {
```

- [ ] **Step 4: Implement the popup** — apply to `src/WediConfigurator.jsx`:

```diff
diff --git a/src/WediConfigurator.jsx b/src/WediConfigurator.jsx
index 7391a37..3136af3 100644
--- a/src/WediConfigurator.jsx
+++ b/src/WediConfigurator.jsx
@@ -27,6 +27,7 @@ import {
   addedRows, setAddedRow, wediBucketOf, wediAddParts, wediAddPartOf, curbAddOptions, coverAddOptions, curbProfile, catalog,
 } from "./wedi.js";
 import { SwapPop, fmDelta, inchGlyph } from "./swappop.jsx";
+import { GROUPS, groupOf, groupLabel } from "./slots.js";
 import { TopDown, Iso, railSplit, RAIL_DESIGN_W, curbHeight } from "./showerdraw.jsx";
 import { normKitBasketEntry } from "./model.js";
 import { useWediCatalog } from "./usewedicatalog.js";
@@ -457,7 +458,6 @@ const sizeLed = (e) => /^\d/.test(e.name);
 const browseSub = (e) => [finName(e), sizeLed(e) ? e.sizeText : "", GROUP_LABEL[e.group] || e.group, e.stock ? "stock" : "special order"]
   .filter(Boolean).join(" · ");
 
-const BUCKETS = [["floor", "Floor"], ["walls", "Walls"], ["bench", "Bench"], ["drain", "Drain & finish"], ["install", "Install"], ["addon", "Add-ons"]];
 const bucketOf = wediBucketOf;
 
 // One word each, no descriptive line (owner 2026-08-02): the Kits tab is a
@@ -958,7 +958,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
       return { ...b, cfg: { ...b.cfg, source }, lines: applySession(b, buildWalls, { qtyOv, panelFit }) };
     }
     if (manual.length) {
-      const lines = addedRows({ manual }).map((r) => ({ item: item(r.key), qty: r.qty, group: r.group, note: "", auto: false, added: true }));
+      const lines = addedRows({ manual }).map((r) => ({ item: item(r.key), qty: r.qty, group: r.group, note: "", auto: false, added: true, slot: wediSlotOf({ item: item(r.key), group: r.group }) }));
       if (!lines.length) return null;
       const soNet = round2(lines.reduce((t, l) => t + (l.item.stock ? 0 : (l.item.soNet || l.item.cost || 0) * l.qty), 0));
       const hints = [];
@@ -1365,19 +1365,22 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
     if (part.stepped === "cover") return (e || kit((i) => i.group === "cover")?.item || {}).key;
     return null;
   };
-  const openAdd = (g, ev, line) => {
-    const part = line ? wediAddPartOf(g, line.item) : wediAddParts(g)[0];
+  // `grp` is the shared group whose "+" (or added line's ⇄) opened the panel;
+  // `g` is the bucket the rows are keyed under — the added line's own, else
+  // the part's.
+  const openAdd = (grp, ev, line) => {
+    const part = line ? wediAddPartOf(grp, line.item) : wediAddParts(grp)[0];
     if (!part) return;
     setSwap(null); setChipMenu(null);
     setAdd({
-      g, part: part.key, qty: 1, q: "", draft: addDraft(part, line ? line.item : null), replace: line ? line.item.key : null,
+      grp, g: line ? line.group : part.group, part: part.key, qty: 1, q: "", draft: addDraft(part, line ? line.item : null), replace: line ? line.item.key : null,
       rect: ev.currentTarget.getBoundingClientRect(), anchor: ev.currentTarget.closest(line ? ".bline" : ".bg-h"),
     });
   };
   const addPool = (part) => bySource(catalog().filter(part.hit)).slice().sort((a, b) => (b.stock ? 1 : 0) - (a.stock ? 1 : 0) || a.retail - b.retail);
   // an added line's ⇄: the part it sits in offers more than itself
   const canSwapAdded = (l) => {
-    const part = l.added && wediAddPartOf(l.group, l.item);
+    const part = l.added && wediAddPartOf(groupOf(l.slot), l.item);
     if (!part) return false;
     return !!part.stepped || new Set([...addPool(part).map((e) => e.key), l.item.key]).size > 1;
   };
@@ -1994,15 +1997,14 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
             <div className="sub">{pan ? (option ? option.title : unwedi(pan.name)) : "manual — from Browse"}</div>
           </div>
 
-          {BUCKETS.map((bk) => {
-            const lines = build.lines.filter((l) => l.group === bk[0]);
-            const isAddon = bk[0] === "addon";
-            const canAdd = wediAddParts(bk[0]).length > 0;
-            if (!lines.length && !isAddon && !canAdd) return null;
+          {GROUPS.map(({ key: g, label }) => {
+            const lines = build.lines.filter((l) => groupOf(l.slot) === g);
+            const canAdd = wediAddParts(g).length > 0;
+            if (!lines.length && !canAdd) return null;
             return (
-              <div className="bgroup" key={bk[0]}>
-                <div className="bg-h">{bk[1]}
-                  {bk[0] === "walls" && lines.length > 0 && (
+              <div className="bgroup" key={g}>
+                <div className="bg-h">{label}
+                  {g === "walls" && lines.some((l) => l.group === "walls" && l.item.group === "panel") && (
                     <span className="wallctl">
                       <span className="pfseg">
                         <button className={panelFit ? "on" : ""} title="mixed sheet sizes, level courses, minimal vertical seams" onClick={() => setPanelFit(true)}>Fit</button>
@@ -2010,7 +2012,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
                       </span>
                     </span>
                   )}
-                  {canAdd && <button className="addb" title={`add another line to ${bk[1]}`} onClick={(ev) => openAdd(bk[0], ev)} data-add-group={bk[0]}>+</button>}
+                  {canAdd && <button className="addb" title={`add another line to ${label}`} onClick={(ev) => openAdd(g, ev)} data-add-group={label}>+</button>}
                 </div>
                 {lines.map((l) => {
                   const e = l.item;
@@ -2037,7 +2039,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
                       </div>
                       {can && <button className="swapb" title="swap" data-wedi-swapb={e.key} onClick={(ev) => setSwap({ key: e.key, grp: l.group, rect: ev.currentTarget.getBoundingClientRect(), anchor: ev.currentTarget.closest(".bline"),
                         ...(e.group === "cover" || e.group === "panel" ? { draft: e.key } : e.group === "curb" ? { draft: opts.curbPick || null } : {}) })}>⇄</button>}
-                      {canSwapAdded(l) && <button className="swapb" title="swap this added line" data-wedi-swapb={e.key} data-added-swapb onClick={(ev) => openAdd(l.group, ev, l)}>⇄</button>}
+                      {canSwapAdded(l) && <button className="swapb" title="swap this added line" data-wedi-swapb={e.key} data-added-swapb onClick={(ev) => openAdd(groupOf(l.slot), ev, l)}>⇄</button>}
                       {l.auto === false && !l.added ? (
                         <div className="stepph" title="one per bench on the drawing — add or remove it there" data-no-stepper>{l.qty}</div>
                       ) : (
@@ -2052,41 +2054,47 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
                     </div>
                   );
                 })}
-                {isAddon && pan && (
-                  <div className="addchips">
-                    {ADDON_CHIPS.filter((ac) => (ac[0] === "recess" ? pan && pan.sub === "curbless"
-                      : ac[0] === "coverFrame" ? frameOpts.length > 0 : true)).map((ac) => {
-                      // niche · seat · bench · shelf add another each click (Phase 1c) —
-                      // one comes off on its own line's − or ⇄, never all at once
-                      const many = ["niche", "seat", "bench", "shelf"].includes(ac[0]);
-                      const count = many ? build.lines.reduce((t, l) => t + (l.item.group === ac[0] ? l.qty : 0), 0) : 0;
-                      // Recess kit / Cover frame are the kit's option: an added ramp or frame is its own line
-                      const kitOpt = ac[0] === "recess" || ac[0] === "coverFrame";
-                      const hit = (l) => !(kitOpt && l.added) && (ac[0] === "recess"
-                        ? l.item.group === "recess" || l.item.group === "ramp" : l.item.group === ac[0]);
-                      const on = ac[0] === "gun" ? build.lines.some((l) => l.item.key === SKU.gun) : build.lines.some(hit);
-                      return (
-                        <button key={ac[0]} className={"addchip" + (on ? " on" : "")} data-wedi-chip={ac[0]} onClick={(ev) => {
-                          if (ac[0] === "gun") { toggleGun(); return; }
-                          const cur = !many && build.lines.find(hit);
-                          if (cur) {
-                            if (ac[0] === "recess") setOpts((o) => ({ ...o, recess: "none" }));
-                            else if (ac[0] === "coverFrame") setOpts((o) => ({ ...o, coverFrame: undefined }));
-                            setQtyOv((o) => { const n = { ...o }; delete n[cur.item.key]; return n; });
-                          } else {
-                            const ch = chipChoices(ac[0]).filter(Boolean);
-                            if (ch.length > 1) setChipMenu({ group: ac[0], label: ac[1], rect: ev.currentTarget.getBoundingClientRect(), anchor: ev.currentTarget });
-                            else if (ch.length) chipPick(ac[0], ch[0].key);
-                          }
-                        }}>{(on ? "✓ " : "+ ") + ac[1] + (count > 1 ? " ×" + count : "")}</button>
-                      );
-                    })}
-                  </div>
-                )}
               </div>
             );
           })}
 
+          {/* The add-on chips sit below the groups, as on the Schluter bill:
+              what they add lands in its own group (a niche under Niches). */}
+          {pan && (
+            <div className="bgroup">
+              <div className="bg-h">Add-ons</div>
+              <div className="addchips">
+                {ADDON_CHIPS.filter((ac) => (ac[0] === "recess" ? pan && pan.sub === "curbless"
+                  : ac[0] === "coverFrame" ? frameOpts.length > 0 : true)).map((ac) => {
+                  // niche · seat · bench · shelf add another each click (Phase 1c) —
+                  // one comes off on its own line's − or ⇄, never all at once
+                  const many = ["niche", "seat", "bench", "shelf"].includes(ac[0]);
+                  const count = many ? build.lines.reduce((t, l) => t + (l.item.group === ac[0] ? l.qty : 0), 0) : 0;
+                  // Recess kit / Cover frame are the kit's option: an added ramp or frame is its own line
+                  const kitOpt = ac[0] === "recess" || ac[0] === "coverFrame";
+                  const hit = (l) => !(kitOpt && l.added) && (ac[0] === "recess"
+                    ? l.item.group === "recess" || l.item.group === "ramp" : l.item.group === ac[0]);
+                  const on = ac[0] === "gun" ? build.lines.some((l) => l.item.key === SKU.gun) : build.lines.some(hit);
+                  return (
+                    <button key={ac[0]} className={"addchip" + (on ? " on" : "")} data-wedi-chip={ac[0]} onClick={(ev) => {
+                      if (ac[0] === "gun") { toggleGun(); return; }
+                      const cur = !many && build.lines.find(hit);
+                      if (cur) {
+                        if (ac[0] === "recess") setOpts((o) => ({ ...o, recess: "none" }));
+                        else if (ac[0] === "coverFrame") setOpts((o) => ({ ...o, coverFrame: undefined }));
+                        setQtyOv((o) => { const n = { ...o }; delete n[cur.item.key]; return n; });
+                      } else {
+                        const ch = chipChoices(ac[0]).filter(Boolean);
+                        if (ch.length > 1) setChipMenu({ group: ac[0], label: ac[1], rect: ev.currentTarget.getBoundingClientRect(), anchor: ev.currentTarget });
+                        else if (ch.length) chipPick(ac[0], ch[0].key);
+                      }
+                    }}>{(on ? "✓ " : "+ ") + ac[1] + (count > 1 ? " ×" + count : "")}</button>
+                  );
+                })}
+              </div>
+            </div>
+          )}
+
           {build.hints.includes("sausage-gun") && (
             <div className="whint">Sausage sealant with no gun on the job
               <button onClick={() => { if (!gunOn()) toggleGun(); }}>Add gun {fm(tierOf(item(SKU.gun)))}</button>
@@ -2332,16 +2340,15 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
 
   const addPanel = (() => {
     if (!add || !build) return null;
-    const parts = add.replace ? [wediAddPartOf(add.g, item(add.replace))].filter(Boolean) : wediAddParts(add.g);
+    const parts = add.replace ? [wediAddPartOf(add.grp, item(add.replace))].filter(Boolean) : wediAddParts(add.grp);
     const part = parts.find((p) => p.key === add.part) || parts[0];
     if (!part) return null;
     const setA = (patch) => setAdd((a) => (a ? { ...a, ...patch } : a));
     const r = add.rect;
     const at = { anchor: add.anchor, x: r.right - 470, y: r.bottom + 6 };
     const partRow = !add.replace && parts.length > 1 ? [{ label: "Part", chips: parts.map((p) => ({
-      key: p.key, label: p.label, ok: true, on: p.key === part.key, onPick: () => setA({ part: p.key, draft: addDraft(p, null), q: "" }) })) }] : [];
-    const bucketLabel = (BUCKETS.find((b) => b[0] === add.g) || [])[1] || add.g;
-    const title = add.replace ? `Swap the added ${part.label.toLowerCase()}` : `Add to ${bucketLabel}`;
+      key: p.key, label: p.label, ok: true, on: p.key === part.key, onPick: () => setA({ part: p.key, g: p.group, draft: addDraft(p, null), q: "" }) })) }] : [];
+    const title = add.replace ? `Swap the added ${part.label.toLowerCase()}` : `Add to ${groupLabel(add.grp)}`;
     const oldQty = add.replace ? addedQty(manual, add.g, add.replace) : 0;
     const old = add.replace ? item(add.replace) : null;
     const sell = round2(build.lines.reduce((t, l) => t + tierOf(l.item) * l.qty, 0));
@@ -2749,10 +2756,10 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
       <table className="ps-table">
         <thead><tr><th>SKU</th><th>Description</th><th>Size</th><th className="num">Qty</th><th className="num">{tierId}</th><th className="num">Total</th></tr></thead>
         <tbody>
-          {BUCKETS.flatMap((bk) => build.lines.filter((l) => l.group === bk[0]).map((l) => {
+          {GROUPS.flatMap(({ key: g }) => build.lines.filter((l) => groupOf(l.slot) === g).map((l) => {
             const p = tierOf(l.item);
             return (
-              <tr key={bk[0] + l.item.key + (l.added ? "+" : "")}>
+              <tr key={l.group + l.item.key + (l.added ? "+" : "")}>
                 <td>{l.item.stock ? l.item.erp : "wedi " + l.item.us}</td>
                 <td>{unwedi(l.item.name)}</td><td>{l.item.sizeText || ""}</td>
                 <td className="num">{l.qty}</td><td className="num">{fm(p)}</td><td className="num">{fm(round2(p * l.qty))}</td>
```

- [ ] **Step 5: Verify**

Run: `npm test` → `# fail 0` (1752; both goldens untouched and green);
`npm run lint`; the build. Preview `wedi-preview.html`, Full catalog, pan
US9100004: groups Base · Drain · Curb · Walls (Fit / One size, Fastener Kit
and panels) · Seams (sealant, valve and pipe seals) · Niches · Bench ·
Setting (putty knife, PRO-SET), then the Add-ons chips; "+ Setting" shows a
Part row Tools · PRO-SET.

- [ ] **Step: Commit**

```bash
git add src/wedi.js src/wedi.test.js src/WediConfigurator.jsx
git commit -m "wedi: fasteners fill wallBoard; + parts keyed by shared group; bill and print draw the nine groups (158 1d)"   # (end the message with the session's attribution lines)
```

---

### Task 4: `comparemirror.js` — sizes, ranking, qty (engine-free)

**Model:** Sonnet (pure module; the plan holds the code).

**Files:**
- Create: `src/comparemirror.js`
- Test: `src/comparemirror.test.js`

**Interfaces:**
- Consumes: nothing (no engine imports — a part is
  `{ brand: "wedi"|"schluter", item, slot, g?, id, cov: {n, unit}|null, retail }`).
- Produces:
  - `sizeOf(part) → object|null` — per slot: niche `{w,h}` (wedi
    "interior W x H" text; Schluter `KB..SN<mm><mm>` SKU), bench `{w,d}`,
    curb `{len}`, tray `{w,d}`, wallBoard `{t,sf}`, wallMembrane `{sf}`,
    seam `{w,lf}`; every other slot null.
  - `sizeDistance(slot, a, b) → number|null` — thickness ×1000 on boards,
    width ×1000 on seams.
  - `rankParts(host, parts) → parts with .dist` — dist (unsized last), stock,
    retail, id.
  - `nearest(host, parts) → part|null` — the top ranked with a size.
  - `matchQty(host, hostQty, match) → number` — coverage ÷ coverage (same
    unit, ceil) else the host qty.

- [ ] **Step 1: Write the failing tests** — create `src/comparemirror.test.js`:

```diff
diff --git a/src/comparemirror.test.js b/src/comparemirror.test.js
new file mode 100644
index 0000000..3b3564f
--- /dev/null
+++ b/src/comparemirror.test.js
@@ -0,0 +1,79 @@
+import { test } from "node:test";
+import assert from "node:assert/strict";
+import { sizeOf, sizeDistance, rankParts, nearest, matchQty } from "./comparemirror.js";
+
+const W = (slot, item, cov = null) => ({ brand: "wedi", slot, item, cov, id: item.key, retail: item.retail || 0 });
+const S = (slot, item, cov = null) => ({ brand: "schluter", slot, item, cov, id: item.sku, retail: item.price || 0 });
+
+test("niche: wedi reads the interior off the size text, Schluter off the SKU's mm code", () => {
+  assert.deepEqual(sizeOf(W("niche", { key: "a", sizeText: 'interior 12" x 38 1/4"' })), { w: 12, h: 38.25 });
+  assert.deepEqual(sizeOf(S("niche", { sku: "KB12SN305508A1" })), { w: 12, h: 20 });
+  assert.equal(sizeOf(S("niche", { sku: "KB12SNLT2WW", name: 'lighted niche 12"×20"' })), null, "no mm code, no size");
+  assert.equal(sizeOf(W("niche", { key: "shelf", sizeText: '11 7/8" x 3 1/2" x 3/8"' })), null, "a glass shelf has no opening");
+});
+
+test("bench: long side first; a Schluter corner seat is its leg both ways", () => {
+  assert.deepEqual(sizeOf(W("bench", { key: "a", group: "bench", w: 18, d: 47 })), { w: 47, d: 18 });
+  assert.deepEqual(sizeOf(S("bench", { sku: "KBSB410TA", bench: { corner: true, a: 16 } })), { w: 16, d: 16 });
+  assert.deepEqual(sizeOf(S("bench", { sku: "KBSB4101220RA", bench: { d: 16, len: 48 } })), { w: 48, d: 16 });
+  assert.equal(sizeOf(W("bench", { key: "p", group: "panel", w: 48, d: 96, sf: 32 })), null, "a bench's panel isn't a seat");
+});
+
+test("wall board: thickness from the name, else the KB mm code; needs sf coverage", () => {
+  assert.deepEqual(sizeOf(S("wallBoard", { sku: "KB1212202440", name: 'KERDI-BOARD 1/2" panel' }, { n: 32, unit: "sf" })), { t: 0.5, sf: 32 });
+  assert.deepEqual(sizeOf(S("wallBoard", { sku: "KB506252440", name: "X96 KERDI-BOARD PANEL" }, { n: 16.33, unit: "sf" })), { t: 2, sf: 16.33 });
+  assert.deepEqual(sizeOf(W("wallBoard", { key: "p", t: 0.5 }, { n: 15, unit: "sf" })), { t: 0.5, sf: 15 });
+  assert.equal(sizeOf(W("wallBoard", { key: "fastener" })), null, "fasteners have no size");
+});
+
+test("seam: width in inches (Schluter stores mm), then lf", () => {
+  assert.deepEqual(sizeOf(S("seam", { sku: "KEBA100/125", width: "125" }, { n: 98, unit: "lf" })), { w: 5, lf: 98 });
+  assert.deepEqual(sizeOf(W("seam", { key: "t", w: 5 }, { n: 82, unit: "lf" })), { w: 5, lf: 82 });
+  assert.equal(sizeOf(W("seam", { key: "sealant" })), null);
+});
+
+test("slots with no comparable size never size", () => {
+  for (const slot of ["drainBody", "grate", "flange", "corners", "setting", "extra"]) {
+    assert.equal(sizeOf(W(slot, { key: "x", w: 4, d: 4, len: 4 })), null, slot);
+  }
+});
+
+test("distance: thickness outranks area on boards, width outranks length on bands", () => {
+  assert.ok(sizeDistance("wallBoard", { t: 0.5, sf: 15 }, { t: 0.5, sf: 32 }) < sizeDistance("wallBoard", { t: 0.5, sf: 15 }, { t: 2, sf: 15 }));
+  assert.ok(sizeDistance("seam", { w: 5, lf: 98 }, { w: 5, lf: 16 }) < sizeDistance("seam", { w: 5, lf: 98 }, { w: 7.25, lf: 98 }));
+  assert.equal(sizeDistance("niche", { w: 12, h: 20 }, { w: 12, h: 18 }), 2);
+  assert.equal(sizeDistance("grate", {}, {}), null);
+});
+
+test("ranking: nearest first, then stock, then price, then part number; unsized sorts last", () => {
+  const host = S("curb", { sku: "C48", len: 48 });
+  const parts = [
+    W("curb", { key: "full60", len: 60, stock: true, retail: 90 }),
+    W("curb", { key: "lean60", len: 60, stock: true, retail: 54 }),
+    W("curb", { key: "so60", len: 60, stock: false, retail: 10 }),
+    W("curb", { key: "lean96", len: 96, stock: true, retail: 70 }),
+    W("curb", { key: "ramp", stock: true, retail: 1 }),
+  ].map((p) => ({ ...p, retail: p.item.retail }));
+  assert.deepEqual(rankParts(host, parts).map((p) => p.id), ["lean60", "full60", "so60", "lean96", "ramp"]);
+  assert.equal(nearest(host, parts).id, "lean60");
+  assert.equal(rankParts(host, parts)[4].dist, null);
+});
+
+test("nearest is null when nothing sizes, or the host doesn't", () => {
+  assert.equal(nearest(S("curb", { sku: "C48", len: 48 }), [W("curb", { key: "ramp" })]), null);
+  assert.equal(nearest(S("grate", { sku: "G" }), [W("grate", { key: "c" })]), null);
+  assert.equal(nearest(S("curb", { sku: "R" }), [W("curb", { key: "c", len: 60 })]), null);
+});
+
+test("a candidate in another slot never auto-matches", () => {
+  const host = W("wallBoard", { key: "p", t: 0.5 }, { n: 32, unit: "sf" });
+  assert.equal(nearest(host, [S("bench", { sku: "KB1212202440", name: 'KERDI-BOARD 1/2" panel' }, { n: 32, unit: "sf" })]), null);
+});
+
+test("qty: coverage for coverage, else the same count", () => {
+  assert.equal(matchQty({ cov: { n: 98, unit: "lf" } }, 1, { cov: { n: 82, unit: "lf" } }), 2);
+  assert.equal(matchQty({ cov: { n: 15, unit: "sf" } }, 6, { cov: { n: 32, unit: "sf" } }), 3);
+  assert.equal(matchQty({ cov: { n: 32, unit: "sf" } }, 2, { cov: { n: 32, unit: "sf" } }), 2);
+  assert.equal(matchQty({ cov: null }, 3, { cov: { n: 32, unit: "sf" } }), 3);
+  assert.equal(matchQty({ cov: { n: 5, unit: "lf" } }, 1, { cov: { n: 32, unit: "sf" } }), 1, "unlike units count");
+});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test src/comparemirror.test.js` → FAIL (module not found).

- [ ] **Step 3: Implement** — create `src/comparemirror.js`:

```diff
diff --git a/src/comparemirror.js b/src/comparemirror.js
new file mode 100644
index 0000000..ca8140d
--- /dev/null
+++ b/src/comparemirror.js
@@ -0,0 +1,119 @@
+// comparemirror — how Compare finds the other brand's part for a line added
+// by hand (ticket 158 Phase 1d). Pure: items in, sizes and rankings out. It
+// never imports an engine; comparekit hands it each part's brand, slot and
+// coverage, so comparekit stays the one module that reads both engines.
+//
+// A part is { item, brand: "wedi"|"schluter", slot, cov: {n, unit}|null }.
+
+const quarter = (n) => Math.round(n * 4) / 4;
+const half = (n) => Math.round(n * 2) / 2;
+const mmIn = (mm) => half(+mm / 25.4);
+// "12", "38 1/4", "38-1/4", "3/8" → inches
+const inchNum = (s) => {
+  const m = /^(?:(\d+(?:\.\d+)?)(?:[\s-]+(\d+)\/(\d+))?|(\d+)\/(\d+))$/.exec(String(s || "").trim());
+  if (!m) return NaN;
+  return m[4] ? +m[4] / +m[5] : +m[1] + (m[2] ? +m[2] / +m[3] : 0);
+};
+const INCH = String.raw`(\d+(?:\.\d+)?(?:[\s-]+\d+\/\d+)?|\d+\/\d+)`;
+const covOf = (p, unit) => (p.cov && p.cov.unit === unit && p.cov.n > 0 ? p.cov.n : null);
+
+// A board's thickness in inches: the name's fraction first ('KERDI-BOARD 1/2"
+// panel'), else the SKU's millimetre code (KB12… = 12 mm = ½″).
+function boardThick(p) {
+  const it = p.item;
+  if (p.brand === "wedi") return it.t > 0 ? it.t : null;
+  const named = new RegExp(INCH + '"').exec(it.name || "");
+  if (named) { const n = inchNum(named[1]); if (n > 0) return n; }
+  const code = /^KB(\d{2})/.exec(it.sku || "");
+  return code ? quarter(+code[1] / 25.4) : null;
+}
+
+const SIZE = {
+  // the niche's interior opening: wedi prints it in the size text
+  // ("interior 12" x 8""), Schluter's SKU codes it in mm (KB12SN305508 = 12″ × 20″)
+  niche: (p) => {
+    if (p.brand === "wedi") {
+      const m = new RegExp("interior\\s+" + INCH + '"?\\s*x\\s*' + INCH, "i").exec(p.item.sizeText || "");
+      return m ? { w: inchNum(m[1]), h: inchNum(m[2]) } : null;
+    }
+    const m = /^KB\d{2}SN(\d{3})(\d{3})/.exec(p.item.sku || "");
+    return m ? { w: mmIn(m[1]), h: mmIn(m[2]) } : null;
+  },
+  // a seat or bench footprint, long side first; a corner seat is its leg both ways
+  bench: (p) => {
+    const it = p.item;
+    if (p.brand === "wedi") return (it.group === "seat" || it.group === "bench") && it.w > 0 && it.d > 0
+      ? { w: Math.max(it.w, it.d), d: Math.min(it.w, it.d) } : null;
+    const b = it.bench;
+    if (!b) return null;
+    if (b.corner) return b.a > 0 ? { w: b.a, d: b.a } : null;
+    const len = b.len || b.d;
+    return len > 0 && b.d > 0 ? { w: Math.max(len, b.d), d: Math.min(len, b.d) } : null;
+  },
+  curb: (p) => (p.item.len > 0 ? { len: p.item.len } : null),
+  tray: (p) => {
+    const it = p.item;
+    const ok = p.brand === "wedi" ? ["pan", "kit"].includes(it.group) : it.g === "tray";
+    return ok && it.w > 0 && it.d > 0 ? { w: Math.max(it.w, it.d), d: Math.min(it.w, it.d) } : null;
+  },
+  wallBoard: (p) => {
+    const sf = covOf(p, "sf");
+    const t = sf && boardThick(p);
+    return sf && t ? { t, sf } : null;
+  },
+  wallMembrane: (p) => { const sf = covOf(p, "sf"); return sf ? { sf } : null; },
+  // a band or tape: its width in inches (Schluter stores mm), then its length
+  seam: (p) => {
+    const lf = covOf(p, "lf");
+    if (!lf) return null;
+    const w = p.brand === "wedi" ? p.item.w : +p.item.width ? quarter(+p.item.width / 25.4) : null;
+    return w > 0 ? { w, lf } : null;
+  },
+};
+
+/** A part's comparable size in its slot, or null when the slot has none or it can't be read. */
+export const sizeOf = (p) => (SIZE[p.slot] ? SIZE[p.slot](p) : null);
+
+/** How far apart two sizes in one slot are — 0 is the same size. Thickness / width outrank area / length. */
+export function sizeDistance(slot, a, b) {
+  if (!a || !b) return null;
+  switch (slot) {
+    case "niche": return Math.abs(a.w - b.w) + Math.abs(a.h - b.h);
+    case "bench":
+    case "tray": return Math.abs(a.w - b.w) + Math.abs(a.d - b.d);
+    case "curb": return Math.abs(a.len - b.len);
+    case "wallBoard": return Math.abs(a.t - b.t) * 1000 + Math.abs(a.sf - b.sf);
+    case "wallMembrane": return Math.abs(a.sf - b.sf);
+    case "seam": return Math.abs(a.w - b.w) * 1000 + Math.abs(a.lf - b.lf);
+    default: return null;
+  }
+}
+
+/**
+ * The other brand's parts ranked against the host part: nearest size first
+ * (a part with no comparable size sorts last), then stock before special
+ * order, then the lower retail price, then the part number. Each comes back
+ * with its `dist` (null when unsized).
+ */
+export function rankParts(host, parts) {
+  const hs = sizeOf(host);
+  return parts
+    .map((p) => ({ ...p, dist: p.slot === host.slot ? sizeDistance(host.slot, hs, sizeOf(p)) : null }))
+    .sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity)
+      || (b.item.stock ? 1 : 0) - (a.item.stock ? 1 : 0)
+      || (+a.retail || 0) - (+b.retail || 0)
+      || String(a.id).localeCompare(String(b.id)));
+}
+
+/** The auto-match: the nearest sized part in the host's slot, or null. */
+export function nearest(host, parts) {
+  const top = rankParts(host, parts)[0];
+  return top && top.dist != null ? top : null;
+}
+
+/** The mirrored qty: coverage for coverage (sf or lf on both), else the same count. */
+export function matchQty(host, hostQty, match) {
+  const hc = host.cov, mc = match.cov;
+  if (hc && mc && hc.unit === mc.unit && hc.n > 0 && mc.n > 0) return Math.max(1, Math.ceil((hostQty * hc.n) / mc.n - 1e-9));
+  return hostQty;
+}
```

- [ ] **Step 4: Run the tests**

Run: `node --test src/comparemirror.test.js` → PASS (10); `npm test` →
`# fail 0` (1762); `npm run lint` → clean.

- [ ] **Step: Commit**

```bash
git add src/comparemirror.js src/comparemirror.test.js
git commit -m "comparemirror: engine-free size readers, ranking and qty for the Compare mirror (158 1d)"   # (end the message with the session's attribution lines)
```

---

### Task 5: `comparekit.js` — rows by group and slot, the mirror plan, the layout

**Model:** Opus (can move what option B bills).

**Files:**
- Modify: `src/comparekit.js`
- Test: `src/comparekit.test.js`

**Note:** after this task `CompareTab.jsx` still imports `COMPARE_CATS`, so
**the build fails until Task 6**. Tests and lint are this task's gate; don't
run the preview.

**Interfaces:**
- Consumes: `GROUPS`, `groupOf`, `SLOT_LABEL` (Task 1); `ADD_PARTS`,
  `slotOf`, `addedLines`, `coverageOf` (schluter.js); `WEDI_ADD_PARTS`,
  `wediSlotOf`, `catalog`, `coverageOf` (wedi.js); `rankParts`, `nearest`,
  `matchQty` (Task 4).
- Produces (exported from `src/comparekit.js`):
  - `COMPARE_CATS` and `WEDI_CAT` are gone. `wediCompareRows` /
    `schluterCompareRows` rows are `{ group, slot, key, added, name, sub, qty,
    stock, noteOnly, est, retail, builder, cost }` — `key` is engine group +
    part (`"addon|US3000005"`, `"Extras|KB12SN305508A1"`); a wedi row is
    `added` only beside a pan.
  - `wediBuildFor(room, { source, tier, manual })` passes `manual` to
    `kitFor`; `schluterBuildFor(room, cat, { source, mortarItem, manual })`
    puts it on `cfg.manual` and bills it (`addedLines`).
  - `hostAddedLines(build, brand) → { key, qty, name, part }[]`.
  - `mirrorParts(brand, grp, { cat, source }) → { key, label, g, parts }[]`
    — the brand's own "+" parts for the group; `source: "stock"` pools.
  - `mirrorCandidates(host, part) → ranked parts` — the picker's list; the
    auto-match is the top sized entry of the same pool.
  - `mirrorPlan(hostBuild, hostBrand, state, { cat, source }) →
    { brand, entries, manual }` — `state` is
    `{ [hostKey]: { pick: { g, id, qty } } | { dropped: true } }`;
    entry `kind` is `matched` | `picked` | `none` | `dropped`; `manual` is
    the other engine's added rows (Schluter `{ sku, qty, g }`, wedi
    `{ key, qty, group }`), one per engine group + part.
  - `mirrorRow(entry, brand, { builderPct })` — a Compare row with
    `mirror: entry.kind`, `hostKey`, `sub: "for <host line>"`.
  - `pruneMirror(state, hostKeys)`.
  - `compareLayout({ wedi, schluter }, { wedi?, schluter? }) →
    { key, label, slots: { slot, label, wedi, schluter, wediPlus,
    schluterPlus }[] }[]`.

- [ ] **Step 1: Write the failing tests** — apply to `src/comparekit.test.js`:

```diff
diff --git a/src/comparekit.test.js b/src/comparekit.test.js
index 03ab7c5..3f2059c 100644
--- a/src/comparekit.test.js
+++ b/src/comparekit.test.js
@@ -4,9 +4,13 @@ import { FIXTURE_ITEMS } from "./schluterfixture.js";
 import { catalogOf } from "./schluter.js";
 import { item, kitFor, SKU } from "./wedi.js";
 import {
-  COMPARE_CATS, roomFromSchluter, roomFromWedi, wediBuildFor, schluterBuildFor,
+  roomFromSchluter, roomFromWedi, wediBuildFor, schluterBuildFor,
   wediCompareRows, schluterCompareRows, compareTotals,
+  hostAddedLines, mirrorParts, mirrorCandidates, mirrorPlan, mirrorRow, pruneMirror, compareLayout,
 } from "./comparekit.js";
+import { GROUPS, SLOTS } from "./slots.js";
+import { lineItems as wediLineItems, buildFromMarker as wediFromMarker } from "./wedi.js";
+import { lineItems as schluterLineItems, buildFromMarker as schluterFromMarker } from "./schluter.js";
 
 const CAT = catalogOf(FIXTURE_ITEMS);
 
@@ -93,12 +97,16 @@ test("wediBuildFor returns a kit build whose cfg carries the solved pan", () =>
   assert.deepEqual(b.cfg.room, { w: 60, d: 38 });
 });
 
-test("wedi rows bucket into COMPARE_CATS, with a Walls panel line", () => {
+test("wedi rows file by shared group and slot, with a Walls panel line", () => {
   const rows = wediCompareRows(wediBuildFor(room60x38()));
-  rows.forEach((r) => assert.ok(COMPARE_CATS.includes(r.cat), r.cat + " is not a compare category"));
-  const walls = rows.filter((r) => r.cat === "Walls");
+  const keys = GROUPS.map((g) => g.key);
+  rows.forEach((r) => assert.ok(keys.includes(r.group) && SLOTS.includes(r.slot), r.name + " → " + r.group + "/" + r.slot));
+  const walls = rows.filter((r) => r.group === "walls" && /building panel/i.test(r.name));
   assert.equal(walls.length, 1);
-  assert.ok(/building panel/i.test(walls[0].name));
+  assert.equal(walls[0].slot, "wallBoard");
+  assert.equal(rows.find((r) => /fastener kit/i.test(r.name)).group, "walls", "fasteners sit with the panels");
+  assert.equal(rows.find((r) => /valve seal/i.test(r.name)).slot, "corners");
+  assert.ok(rows.every((r) => r.added === false), "a house kit has no added lines");
   assert.ok(walls[0].retail > 0);
   assert.ok(rows.every((r) => typeof r.est === "boolean"));
 });
@@ -106,7 +114,7 @@ test("wedi rows bucket into COMPARE_CATS, with a Walls panel line", () => {
 test("wedi rows carry the part number and the engine note as the sub line", () => {
   const b = wediBuildFor(room60x38());
   const rows = wediCompareRows(b);
-  const base = rows.find((r) => r.cat === "Base");
+  const base = rows.find((r) => r.group === "base");
   assert.equal(base.sub, b.pan.us);
   const sealant = rows.find((r) => /sealant/i.test(r.name));
   const line = b.lines.find((l) => l.item.group === "sealant");
@@ -117,7 +125,7 @@ test("wedi rows carry the part number and the engine note as the sub line", () =
 // configurators' own totals use ($54.66 × 0.82 = $44.82 a sheet, six sheets)
 test("wedi rows price through the engine's own tier lens, extended by qty", () => {
   const rows = wediCompareRows(wediBuildFor(room60x38()));
-  const panel = rows.find((r) => r.cat === "Walls");
+  const panel = rows.find((r) => r.slot === "wallBoard" && /building panel/i.test(r.name));
   assert.equal(panel.qty, 6);
   assert.deepEqual([panel.retail, panel.builder, panel.cost], [327.96, 268.92, 198.78]);
 });
@@ -126,7 +134,7 @@ test("wedi's PRO-SET bag files under Setting — no by-others thin-set note", ()
   const rows = wediCompareRows(wediBuildFor(room60x38()));
   const ps = rows.filter((r) => /PRO-SET/.test(r.name));
   assert.equal(ps.length, 1);
-  assert.deepEqual([ps[0].cat, ps[0].qty, ps[0].noteOnly], ["Setting", 1, false]);
+  assert.deepEqual([ps[0].group, ps[0].qty, ps[0].noteOnly], ["setting", 1, false]);
   assert.equal(rows.some((r) => r.noteOnly), false);
 });
 
@@ -135,7 +143,7 @@ test("wediCompareRows(null) is empty", () => {
 });
 
 test("an engine note quoting an allowance marks the row est", () => {
-  const rows = wediCompareRows({ lines: [{ item: item(SKU.sealantSausage), qty: 2, note: "field seal — allowance" }] });
+  const rows = wediCompareRows({ lines: [{ item: item(SKU.sealantSausage), qty: 2, note: "field seal — allowance", slot: "seam" }] });
   assert.equal(rows[0].est, true);
   assert.equal(rows[0].noteOnly, false);
 });
@@ -163,13 +171,16 @@ test("a room missing a side leaves that schluter wall off", () => {
   assert.deepEqual(cfg.walls.map((w) => w.on), [true, true, false]);
 });
 
-test("schluter rows bucket into COMPARE_CATS and keep the noteOnly backer at $0", () => {
+test("schluter rows file by shared group and keep the noteOnly backer at $0", () => {
   const { build } = schluterBuildFor(room60x38(), CAT);
   const rows = schluterCompareRows(build);
-  rows.forEach((r) => assert.ok(COMPARE_CATS.includes(r.cat), r.cat + " is not a compare category"));
+  const keys = GROUPS.map((g) => g.key);
+  rows.forEach((r) => assert.ok(keys.includes(r.group) && SLOTS.includes(r.slot), r.name + " → " + r.group + "/" + r.slot));
+  assert.equal(rows.find((r) => /flange kit/i.test(r.name)).slot, "flange");
+  assert.equal(rows.find((r) => /grate/i.test(r.name)).slot, "grate");
   const notes = rows.filter((r) => r.noteOnly);
   assert.equal(notes.length, 1);
-  assert.equal(notes[0].cat, "Walls");
+  assert.equal(notes[0].group, "walls");
   assert.deepEqual([notes[0].retail, notes[0].builder, notes[0].cost], [0, 0, 0]);
 });
 
@@ -215,7 +226,7 @@ test("a curbless compare column carries no auto ramp — the entry treatment is
   // the derived house kit matches wedi's own no-entry-part treatment
   const { build } = schluterBuildFor({ ...room60x38(), curbed: false }, CAT);
   const rows = schluterCompareRows(build);
-  assert.equal(rows.some((r) => r.cat === "Curb"), false);
+  assert.equal(rows.some((r) => r.group === "curb"), false);
   const t = compareTotals(rows);
   assert.equal(t.stocked + t.soCount, t.lines);
 });
@@ -248,3 +259,157 @@ test("compare rows carry each line's shared slot", () => {
   const rows = wediCompareRows(wediBuildFor(room60x38()));
   assert.ok(rows.length && rows.every((r) => typeof r.slot === "string"));
 });
+
+// --- (f) the mirror (ticket 158 Phase 1d) -----------------------------------
+
+const schHost = (manual) => schluterBuildFor(room60x38(), CAT, { manual }).build;
+const wediHost = (manual) => kitFor("US9100004", { room: { w: 60, d: 36 }, mode: "kit", manual });
+
+test("schluterBuildFor bills added rows on top of the recipe, and its cfg carries them", () => {
+  const { build, cfg } = schluterBuildFor(room60x38(), CAT, { manual: [{ sku: "KB12SN305508A1", qty: 2, g: "Extras" }] });
+  const added = build.lines.filter((l) => l.manual);
+  assert.deepEqual(added.map((l) => [l.item.sku, l.qty, l.slot]), [["KB12SN305508A1", 2, "niche"]]);
+  assert.deepEqual(cfg.manual, [{ sku: "KB12SN305508A1", qty: 2, g: "Extras" }]);
+  assert.equal(schluterBuildFor(room60x38(), CAT).cfg.manual, undefined);
+});
+
+test("wediBuildFor bills added rows as added lines", () => {
+  const b = wediBuildFor(room60x38(), { manual: [{ key: "US3000005", qty: 1, group: "addon" }] });
+  assert.deepEqual(b.lines.filter((l) => l.added).map((l) => [l.item.key, l.slot]), [["US3000005", "niche"]]);
+  assert.deepEqual(b.cfg.manual, [{ key: "US3000005", qty: 1, group: "addon" }]);
+});
+
+test("host added lines: key is engine group + part; kit lines and a Browse-only wedi build give none", () => {
+  const h = hostAddedLines(schHost([{ sku: "KB12SN305508A1", qty: 2, g: "Extras" }]), "schluter");
+  assert.deepEqual(h.map((x) => [x.key, x.qty, x.part.slot]), [["Extras|KB12SN305508A1", 2, "niche"]]);
+  assert.deepEqual(hostAddedLines(schluterBuildFor(room60x38(), CAT).build, "schluter"), []);
+  const browse = { pan: null, lines: [{ item: item("US3000005"), qty: 1, group: "addon", added: true, slot: "niche" }] };
+  assert.deepEqual(hostAddedLines(browse, "wedi"), []);
+  assert.deepEqual(hostAddedLines(null, "wedi"), []);
+});
+
+test("mirror parts are the brand's own '+' parts for the group, pooled by source", () => {
+  assert.deepEqual(mirrorParts("wedi", "niches").map((p) => [p.key, p.g]), [["niche", "addon"], ["shelf", "addon"]]);
+  assert.deepEqual(mirrorParts("schluter", "niches", { cat: CAT }).map((p) => [p.key, p.g]), [["niche", "Extras"]]);
+  const all = mirrorParts("schluter", "base", { cat: CAT }).flatMap((p) => p.parts);
+  const stock = mirrorParts("schluter", "base", { cat: CAT, source: "stock" }).flatMap((p) => p.parts);
+  assert.ok(stock.length < all.length && stock.every((c) => c.item.stock));
+});
+
+test("a Schluter niche mirrors to the nearest wedi interior; the picker's list agrees with the match", () => {
+  const plan = mirrorPlan(schHost([{ sku: "KB12SN305508A1", qty: 2, g: "Extras" }]), "schluter", {}, { cat: CAT });
+  assert.equal(plan.brand, "wedi");
+  const [e] = plan.entries;
+  assert.deepEqual([e.kind, e.match.id, e.qty, e.grp], ["matched", "US3000007", 2, "niches"]);
+  const part = mirrorParts("wedi", "niches").find((p) => p.key === "niche");
+  assert.equal(mirrorCandidates(e.host, part)[0].id, e.match.id);
+  assert.deepEqual(plan.manual, [{ key: "US3000007", qty: 2, group: "addon" }]);
+});
+
+test("coverage parts mirror by coverage: a 98 lf band is two 82 lf tapes", () => {
+  const plan = mirrorPlan(schHost([{ sku: "KEBA100/125", qty: 1, g: "Seams" }]), "schluter", {}, { cat: CAT });
+  assert.deepEqual([plan.entries[0].match.id, plan.entries[0].qty], ["095225053", 2]);
+});
+
+test("wedi → Schluter: a seat mirrors to the nearest bench, a panel to KERDI-BOARD by sf", () => {
+  const plan = mirrorPlan(wediHost([{ key: "US3000002", qty: 1, group: "addon" }, { key: "US8000017", qty: 6, group: "walls" }]), "wedi", {}, { cat: CAT });
+  const by = Object.fromEntries(plan.entries.map((e) => [e.slot, e]));
+  assert.equal(by.bench.match.id, "KBSB410TA");
+  assert.deepEqual([by.wallBoard.match.id, by.wallBoard.qty], ["KB1212201625", 5], "a 15 sf sheet is nearest the 21.3 sf board; 6 × 15 = 90 sf → five");
+  assert.deepEqual(plan.manual.map((r) => r.g), ["Extras", "Walls"]);
+});
+
+test("unsized slots, and sizes that don't read, give no match", () => {
+  const plan = mirrorPlan(schHost([{ sku: "KD4GRKE", qty: 1, g: "Drain" }, { sku: "KB12SNLT2WW", qty: 1, g: "Extras" }]), "schluter", {}, { cat: CAT });
+  assert.deepEqual(plan.entries.map((e) => e.kind), ["none", "none"]);
+  assert.deepEqual(plan.manual, []);
+});
+
+test("Stock only pools the auto-match; a hand pick stands", () => {
+  const host = schHost([{ sku: "KB12SN305508A1", qty: 1, g: "Extras" }]);
+  const so = mirrorParts("wedi", "niches").flatMap((p) => p.parts).find((c) => !c.item.stock && c.slot === "niche");
+  assert.ok(so, "the fixture carries a special-order niche");
+  const auto = mirrorPlan(host, "schluter", {}, { cat: CAT, source: "stock" });
+  assert.ok(auto.entries[0].match.item.stock);
+  const picked = mirrorPlan(host, "schluter", { "Extras|KB12SN305508A1": { pick: { g: "addon", id: so.id, qty: 3 } } }, { cat: CAT, source: "stock" });
+  assert.deepEqual([picked.entries[0].kind, picked.entries[0].match.id, picked.entries[0].qty], ["picked", so.id, 3]);
+});
+
+test("a drop shows the '+', a pick whose part left the book shows the '+', and an orphan entry is ignored", () => {
+  const host = schHost([{ sku: "KB12SN305508A1", qty: 1, g: "Extras" }]);
+  const k = "Extras|KB12SN305508A1";
+  assert.equal(mirrorPlan(host, "schluter", { [k]: { dropped: true } }, { cat: CAT }).entries[0].kind, "dropped");
+  assert.equal(mirrorPlan(host, "schluter", { [k]: { pick: { g: "addon", id: "GONE", qty: 1 } } }, { cat: CAT }).entries[0].kind, "none");
+  const orphan = mirrorPlan(host, "schluter", { "Walls|NOPE": { dropped: true } }, { cat: CAT });
+  assert.equal(orphan.entries[0].kind, "matched");
+  assert.deepEqual(pruneMirror({ [k]: { dropped: true }, "Walls|NOPE": { dropped: true } }, [k]), { [k]: { dropped: true } });
+});
+
+test("a pick is keyed by engine group + part: the same part in another group isn't hijacked", () => {
+  const host = schHost([{ sku: "KB1212202440", qty: 1, g: "Walls" }, { sku: "KB1212202440", qty: 1, g: "Extras" }]);
+  const plan = mirrorPlan(host, "schluter", { "Extras|KB1212202440": { dropped: true } }, { cat: CAT });
+  const by = Object.fromEntries(plan.entries.map((e) => [e.hostKey, e.kind]));
+  assert.deepEqual(by, { "Walls|KB1212202440": "matched", "Extras|KB1212202440": "dropped" });
+});
+
+test("two host lines landing on one part sum into one engine row", () => {
+  const plan = mirrorPlan(wediHost([{ key: "US3000005", qty: 1, group: "addon" }, { key: "US3000004", qty: 1, group: "addon" }]), "wedi", {}, { cat: CAT });
+  assert.deepEqual(plan.entries.map((e) => e.match.id), ["KB12SN305508A1", "KB12SN305508A1"]);
+  assert.deepEqual(plan.manual, [{ sku: "KB12SN305508A1", qty: 2, g: "Extras" }]);
+});
+
+test("a mirror row is priced by the other engine and names the host line", () => {
+  const plan = mirrorPlan(schHost([{ sku: "KB12SN305508A1", qty: 2, g: "Extras" }]), "schluter", {}, { cat: CAT });
+  const r = mirrorRow(plan.entries[0], "wedi", { builderPct: 18 });
+  assert.deepEqual([r.group, r.slot, r.added, r.mirror, r.qty], ["niches", "niche", true, "matched", 2]);
+  assert.match(r.sub, /^for 2× .*niche/i);
+  assert.equal(r.retail, Math.round(item("US3000007").retail * 2 * 100) / 100);
+});
+
+test("the mirrored build's totals equal its rows: the other engine bills what Compare shows", () => {
+  const host = schHost([{ sku: "KB12SN305508A1", qty: 1, g: "Extras" }, { sku: "KEBA100/125", qty: 1, g: "Seams" }]);
+  const plan = mirrorPlan(host, "schluter", {}, { cat: CAT });
+  const other = wediBuildFor(room60x38(), { manual: plan.manual });
+  const rows = [...wediCompareRows(other).filter((r) => !r.added), ...plan.entries.map((e) => mirrorRow(e, "wedi"))];
+  assert.equal(compareTotals(rows).retail, compareTotals(wediCompareRows(other)).retail);
+});
+
+test("option B lands the mirrored rows in its marker, and reopens them as added lines", () => {
+  const plan = mirrorPlan(wediHost([{ key: "US3000005", qty: 1, group: "addon" }]), "wedi", {}, { cat: CAT });
+  const { build, cfg } = schluterBuildFor(room60x38(), CAT, { manual: plan.manual });
+  const rows = schluterLineItems({ ...build, mode: "custom", cfg }, {});
+  const mark = rows[0].schluter || rows[0].kit || Object.values(rows[0]).find((v) => v && v.cfg);
+  assert.deepEqual(mark.cfg.manual, plan.manual);
+  const back = schluterFromMarker(mark, CAT);
+  assert.deepEqual(back.lines.filter((l) => l.manual).map((l) => [l.item.sku, l.qty]), [["KB12SN305508A1", 1]]);
+
+  const p2 = mirrorPlan(schHost([{ sku: "KB12SN305508A1", qty: 1, g: "Extras" }]), "schluter", {}, { cat: CAT });
+  const w = wediBuildFor(room60x38(), { manual: p2.manual });
+  const wrows = wediLineItems(w, {});
+  const wmark = wrows[0].wedi || Object.values(wrows[0]).find((v) => v && v.cfg);
+  assert.deepEqual(wmark.cfg.manual, p2.manual);
+  assert.deepEqual(wediFromMarker(wmark).lines.filter((l) => l.added).map((l) => l.item.key), ["US3000007"]);
+});
+
+test("compareLayout: group bands in order, a slot per row, one-sided slots kept, empties dropped", () => {
+  const w = wediCompareRows(wediBuildFor(room60x38()));
+  const { build } = schluterBuildFor(room60x38(), CAT);
+  const s = schluterCompareRows(build);
+  const plus = { wedi: [{ slot: "flange", hostKey: "x" }] };
+  const L = compareLayout({ wedi: w, schluter: s }, plus);
+  const order = GROUPS.map((g) => g.key);
+  assert.deepEqual(L.map((g) => g.key), order.filter((k) => L.some((g) => g.key === k)));
+  const drain = L.find((g) => g.key === "drain");
+  const flange = drain.slots.find((r) => r.slot === "flange");
+  assert.equal(flange.wedi.length, 0);
+  assert.equal(flange.schluter.length, 1);
+  assert.equal(flange.wediPlus.length, 1);
+  assert.ok(!L.some((g) => g.key === "niches"), "no niche on either side");
+  for (const g of L) for (const r of g.slots) assert.ok(r.wedi.length + r.schluter.length + r.wediPlus.length + r.schluterPlus.length > 0);
+});
+
+test("compareLayout puts added lines after the kit's in a cell", () => {
+  const rows = [{ slot: "seam", added: true, name: "a" }, { slot: "seam", added: false, name: "k" }];
+  const cell = compareLayout({ wedi: rows, schluter: [] }).find((g) => g.key === "seams").slots[0].wedi;
+  assert.deepEqual(cell.map((r) => r.name), ["k", "a"]);
+});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test src/comparekit.test.js`
Expected: FAIL — rows have no `group`, the mirror exports don't exist.

- [ ] **Step 3: Implement** — apply to `src/comparekit.js`:

```diff
diff --git a/src/comparekit.js b/src/comparekit.js
index 10f33b6..70205e5 100644
--- a/src/comparekit.js
+++ b/src/comparekit.js
@@ -9,19 +9,15 @@
 //   { w, d, curbed, drain: "point"|"offset"|"linear",
 //     walls: [{ side: "back"|"left"|"right", on, len, h }] }
 
-import { solve, kitFor, item, tierPrice as wediTierPrice, round2, SKU } from "./wedi.js";
-import { trayCandidates, buildKit, tierPrice as schluterTierPrice } from "./schluter.js";
-
-export const COMPARE_CATS = ["Base", "Drain", "Walls", "Seams", "Curb", "Setting", "Extras"];
-
-// wedi lines carry no category token of their own — the catalog group is it.
-const WEDI_CAT = {
-  pan: "Base", module: "Base", modExt: "Base", extension: "Base",
-  cornerExt: "Base", kit: "Base", curb: "Curb", ramp: "Curb", panel: "Walls",
-  cover: "Drain", coverFrame: "Drain", drainKit: "Drain", collar: "Drain",
-  sealant: "Seams", fastener: "Seams", subliner: "Seams", sdry: "Seams",
-  tool: "Setting",
-};
+import {
+  solve, kitFor, item, tierPrice as wediTierPrice, round2, WEDI_ADD_PARTS, wediSlotOf,
+  catalog as wediCatalog, coverageOf as wediCoverageOf,
+} from "./wedi.js";
+import {
+  trayCandidates, buildKit, addedLines, tierPrice as schluterTierPrice, ADD_PARTS, slotOf, coverageOf as schluterCoverageOf,
+} from "./schluter.js";
+import { GROUPS, groupOf, SLOT_LABEL } from "./slots.js";
+import { rankParts, nearest, matchQty } from "./comparemirror.js";
 
 const SIDES = [["Back", "back"], ["Left", "left"], ["Right", "right"]];
 const WEDI_DRAIN = { point: "center", offset: "offset", linear: "linear" };
@@ -65,7 +61,7 @@ export function roomFromWedi(cfg) {
  * popup's own customizations (no add-ons, benches, overrides or curb inset).
  * Null when nothing solves.
  */
-export function wediBuildFor(room, { source, tier } = {}) {
+export function wediBuildFor(room, { source, tier, manual } = {}) {
   room = room || {};
   const walls = (room.walls || []).filter((w) => w.on)
     .map((w) => ({ side: w.side, len: +w.len || 0, h: +w.h || 84 }));
@@ -80,6 +76,7 @@ export function wediBuildFor(room, { source, tier } = {}) {
     option: option, room: option.room,
     walls: walls, wallHeight: (walls[0] && walls[0].h) || 84,
     mode: "kit", tier: tier,
+    ...(manual && manual.length ? { manual } : {}),
   });
 }
 
@@ -88,7 +85,7 @@ export function wediBuildFor(room, { source, tier } = {}) {
  * for its top-ranked tray. The cfg comes back beside the build because it is
  * what "Schluter — reconfigure" reopens on.
  */
-export function schluterBuildFor(room, cat, { source, mortarItem } = {}) {
+export function schluterBuildFor(room, cat, { source, mortarItem, manual } = {}) {
   room = room || {};
   const w = +room.w || 0, d = +room.d || 0;
   const cfg = {
@@ -99,50 +96,68 @@ export function schluterBuildFor(room, cat, { source, mortarItem } = {}) {
       return { name: name, on: !!(hit && hit.on), len: i === 0 ? w : d, h: (hit && +hit.h) || 84 };
     }),
     ...(mortarItem ? { mortarItem } : {}),
+    ...(manual && manual.length ? { manual } : {}),
   };
   const pick = trayCandidates(cfg, cat, { source })[0];
-  return { build: buildKit(cfg, cat, { source, pick }), cfg };
+  const build = buildKit(cfg, cat, { source, pick });
+  // buildKit bills the recipe only; added rows ride on top, as buildFromMarker does
+  if (build && build.lines && cfg.manual) build.lines.push(...addedLines(cfg.manual, cat));
+  return { build, cfg };
+}
+
+// One engine's three money columns for `qty` of a part. builderPct is that
+// brand's OWN knob — wedi's percent-off (18 ≡ the ×0.82 house rule,
+// wedi.js builderMult) or Schluter's −8% — never the other's. wedi's tier
+// lens has no cost tier: cost IS the distributor net field, read the way the
+// wedi popup's own cost line reads it.
+function money(brand, e, qty, builderPct) {
+  if (brand === "wedi") return {
+    retail: round2(wediTierPrice(e, "retail") * qty),
+    builder: round2(wediTierPrice(e, "builder", builderPct) * qty),
+    cost: round2((+e.cost || 0) * qty),
+  };
+  return {
+    retail: round2(schluterTierPrice(e, "retail", {}) * qty),
+    builder: round2(schluterTierPrice(e, "builder", { builderPct }) * qty),
+    cost: round2(schluterTierPrice(e, "cost", {}) * qty),
+  };
 }
 
+// Every row names its shared group and slot (slots.js), and whether it was
+// added by hand — a Browse-only wedi build is all hand-added, so nothing there
+// is tagged. `key` is the 1c added-row identity: engine group + part.
 export function wediCompareRows(build, { builderPct } = {}) {
-  const rows = ((build && build.lines) || []).map((l) => {
+  return ((build && build.lines) || []).map((l) => {
     const e = l.item;
     return {
-      cat: e.key === SKU.proSet ? "Setting" : WEDI_CAT[e.group] || "Extras",
-      slot: l.slot || null,
+      group: groupOf(l.slot), slot: l.slot || "extra",
+      key: l.group + "|" + e.key,
+      added: !!(l.added && build.pan),
       name: e.name,
       sub: sub(e.us, l.note),
       qty: l.qty,
       stock: !!e.stock,
       noteOnly: false,
       est: isEst(l.note),
-      retail: round2(wediTierPrice(e, "retail") * l.qty),
-      // builderPct here is wedi's OWN percent-off knob (18 ≡ the ×0.82 house
-      // rule, wedi.js builderMult) — never feed it schluter's builderPct.
-      builder: round2(wediTierPrice(e, "builder", builderPct) * l.qty),
-      // wedi's tier lens has no cost tier — cost IS the distributor net field,
-      // read the way the wedi popup's own cost line reads it
-      cost: round2((+e.cost || 0) * l.qty),
+      ...money("wedi", e, l.qty, builderPct),
     };
   });
-  return rows;
 }
 
 export function schluterCompareRows(build, { builderPct } = {}) {
   return ((build && build.lines) || []).map((l) => {
     const e = l.item;
     return {
-      cat: COMPARE_CATS.includes(l.g) ? l.g : "Extras",
-      slot: l.slot || null,
+      group: groupOf(l.slot), slot: l.slot || "extra",
+      key: l.g + "|" + (e.sku || e.name),
+      added: !!l.manual,
       name: e.name,
       sub: sub(e.sku, l.note),
       qty: l.qty,
       stock: !!e.stock,
       noteOnly: !!l.noteOnly,
       est: isEst(l.note),
-      retail: round2(schluterTierPrice(e, "retail", {}) * l.qty),
-      builder: round2(schluterTierPrice(e, "builder", { builderPct }) * l.qty),
-      cost: round2(schluterTierPrice(e, "cost", {}) * l.qty),
+      ...money("schluter", e, l.qty, builderPct),
     };
   });
 }
@@ -158,3 +173,119 @@ export function compareTotals(rows) {
     soCount: bill.filter((r) => !r.stock).length,
   };
 }
+
+// ---------------------------------------------------------------------------
+// The mirror (ticket 158 Phase 1d): each line the host popup's build added by
+// hand gets the other brand's nearest part in the same slot, shown as an
+// added line in the other column and billed by the other engine. A hand pick
+// or a drop is session state keyed by the host line's `key`.
+
+const other = (brand) => (brand === "wedi" ? "schluter" : "wedi");
+
+function asPart(brand, e, slot, g) {
+  return {
+    brand, item: e, slot, g,
+    id: brand === "wedi" ? e.key : e.sku,
+    cov: brand === "wedi" ? wediCoverageOf(e) : schluterCoverageOf(e),
+    retail: brand === "wedi" ? wediTierPrice(e, "retail") : schluterTierPrice(e, "retail", {}),
+  };
+}
+
+/** The host build's added lines as mirror hosts: { key, qty, name, part }. */
+export function hostAddedLines(build, brand) {
+  if (!build || !build.lines) return [];
+  const rows = brand === "wedi" ? wediCompareRows(build) : schluterCompareRows(build);
+  return build.lines.map((l, i) => [l, rows[i]]).filter(([, r]) => r.added && !r.noteOnly)
+    .map(([l, r]) => ({ key: r.key, qty: l.qty, name: l.item.name, part: asPart(brand, l.item, r.slot, brand === "wedi" ? l.group : l.g) }));
+}
+
+/**
+ * A brand's "+" parts for a shared group, each with its candidates as mirror
+ * parts: [{ key, label, g, parts }]. The same table the popups' "+" reads, so
+ * Compare never offers a part the brand's own bill wouldn't. `cat` is the
+ * Schluter catalog; wedi reads its installed one.
+ */
+export function mirrorParts(brand, grp, { cat, source } = {}) {
+  const wedi = brand === "wedi";
+  const items = wedi ? wediCatalog() : cat || [];
+  return ((wedi ? WEDI_ADD_PARTS : ADD_PARTS)[grp] || []).filter((p) => p.hit).map((p) => {
+    const g = wedi ? p.group : p.g;
+    const list = items.filter((e) => p.hit(e) && (source !== "stock" || e.stock));
+    return {
+      key: p.key, label: p.label, g,
+      parts: list.map((e) => asPart(brand, e, wedi ? wediSlotOf({ item: e, group: g }) : slotOf(g, e), g)),
+    };
+  }).filter((p) => p.parts.length);
+}
+
+/** One part's candidates, nearest the host first — what the picker lists and the auto-match takes the top of. */
+export const mirrorCandidates = (host, part) => rankParts(host.part, part.parts);
+
+/**
+ * The other column's mirror for a host build.
+ *   state: { [hostKey]: { pick: { g, id, qty } } | { dropped: true } }
+ * Returns { brand, entries, manual }: one entry per host added line —
+ * kind "matched" | "picked" (with `match` and `qty`) | "none" | "dropped" —
+ * and `manual`, the other engine's added rows (one per engine group + part,
+ * qty summed) to rebuild its house kit with.
+ */
+export function mirrorPlan(hostBuild, hostBrand, state, { cat, source } = {}) {
+  const brand = other(hostBrand);
+  const entries = hostAddedLines(hostBuild, hostBrand).map((h) => {
+    const grp = groupOf(h.part.slot);
+    const s = (state || {})[h.key];
+    const base = { hostKey: h.key, host: h, grp, slot: h.part.slot };
+    if (s && s.dropped) return { ...base, kind: "dropped" };
+    if (s && s.pick) {
+      // a hand pick stands under Stock only too — it was chosen, not figured
+      const all = mirrorParts(brand, grp, { cat, source: "all" }).flatMap((p) => p.parts);
+      const hit = all.find((c) => c.g === s.pick.g && c.id === s.pick.id);
+      return hit ? { ...base, kind: "picked", match: hit, qty: s.pick.qty } : { ...base, kind: "none" };
+    }
+    const cands = mirrorParts(brand, grp, { cat, source }).flatMap((p) => p.parts).filter((c) => c.slot === h.part.slot);
+    const m = nearest(h.part, cands);
+    return m ? { ...base, kind: "matched", match: m, qty: matchQty(h.part, h.qty, m) } : { ...base, kind: "none" };
+  });
+  const manual = [];
+  for (const e of entries) {
+    if (!e.match) continue;
+    const hit = manual.find((r) => (brand === "wedi" ? r.key === e.match.id && r.group === e.match.g : r.sku === e.match.id && r.g === e.match.g));
+    if (hit) hit.qty += e.qty;
+    else manual.push(brand === "wedi" ? { key: e.match.id, qty: e.qty, group: e.match.g } : { sku: e.match.id, qty: e.qty, g: e.match.g });
+  }
+  return { brand, entries, manual };
+}
+
+/** The Compare row for a mirrored line, priced by the other engine. */
+export function mirrorRow(entry, brand, { builderPct } = {}) {
+  const e = entry.match.item;
+  return {
+    group: entry.grp, slot: entry.match.slot, key: entry.hostKey,
+    added: true, mirror: entry.kind, hostKey: entry.hostKey,
+    name: e.name,
+    sub: "for " + (entry.host.qty > 1 ? entry.host.qty + "× " : "") + entry.host.name,
+    qty: entry.qty, stock: !!e.stock, noteOnly: false, est: false,
+    ...money(brand, e, entry.qty, builderPct),
+  };
+}
+
+/** A mirror state with entries for host lines that are gone dropped. */
+export const pruneMirror = (state, hostKeys) => Object.fromEntries(Object.entries(state || {}).filter(([k]) => hostKeys.includes(k)));
+
+/**
+ * The grid: one band per shared group, one row per slot either column fills
+ * (a mirror "+" counts), in slots.js order; empty slots and groups drop out.
+ *   cols: { wedi: rows, schluter: rows }, plus: { wedi: entries, schluter: entries }
+ */
+export function compareLayout(cols, plus = {}) {
+  const pick = (list, slot) => (list || []).filter((r) => r.slot === slot);
+  const kitFirst = (rs) => [...rs.filter((r) => !r.added), ...rs.filter((r) => r.added)];
+  return GROUPS.map((g) => ({
+    key: g.key, label: g.label,
+    slots: g.slots.map((slot) => ({
+      slot, label: SLOT_LABEL[slot],
+      wedi: kitFirst(pick(cols.wedi, slot)), schluter: kitFirst(pick(cols.schluter, slot)),
+      wediPlus: pick(plus.wedi, slot), schluterPlus: pick(plus.schluter, slot),
+    })).filter((r) => r.wedi.length || r.schluter.length || r.wediPlus.length || r.schluterPlus.length),
+  })).filter((g) => g.slots.length);
+}
```

- [ ] **Step 4: Run the tests**

Run: `node --test src/comparekit.test.js` → PASS; `npm test` → `# fail 0`
(1779); `npm run lint` → clean.

- [ ] **Step: Commit**

```bash
git add src/comparekit.js src/comparekit.test.js
git commit -m "comparekit: rows by shared group and slot; the added-line mirror and the slot layout (158 1d)"   # (end the message with the session's attribution lines)
```

---

### Task 6: `CompareTab` — group bands, slot rows, mirrored lines, the picker

**Model:** Opus (popup UI).

**Files:**
- Modify: `src/CompareTab.jsx`
- Modify: `src/SchluterConfigurator.jsx`, `src/WediConfigurator.jsx` (the
  `mirror` state and two CompareTab props)

**Interfaces:**
- Consumes: everything Task 5 produces; `matchQty` (Task 4); `groupLabel`,
  `SLOT_LABEL` (Task 1); `SwapPop` (`src/swappop.jsx`, `add` mode with
  `qty` / `onQty` / `summary` / children).
- Produces:
  - `CompareTab` props `mirror` (state object) and `onMirror` (a setter taking
    an updater); the popups hold `const [mirror, setMirror] = useState({})`.
  - DOM hooks for proof: `data-cmp-group`, `data-cmp-slot`,
    `data-mirror-line` (a mirrored line, value = host key),
    `data-mirror-plus` (a "+" row), `data-mirror-add`, `data-mirror-swap`,
    `data-mirror-drop`, `data-mirror-row` (a picker row), `data-added-tag`.
  - The other column's build is rebuilt with `plan.manual`, so its total,
    the delta line and the quote-options payload all include the mirror.

- [ ] **Step 1: Implement the tab** — apply to `src/CompareTab.jsx`:

```diff
diff --git a/src/CompareTab.jsx b/src/CompareTab.jsx
index d023644..6074395 100644
--- a/src/CompareTab.jsx
+++ b/src/CompareTab.jsx
@@ -11,9 +11,13 @@
 import { Fragment, useMemo, useState } from "react";
 import { X } from "lucide-react";
 import {
-  COMPARE_CATS, roomFromSchluter, roomFromWedi, wediBuildFor, schluterBuildFor,
+  roomFromSchluter, roomFromWedi, wediBuildFor, schluterBuildFor,
   wediCompareRows, schluterCompareRows, compareTotals,
+  mirrorPlan, mirrorRow, mirrorParts, mirrorCandidates, pruneMirror, hostAddedLines, compareLayout,
 } from "./comparekit.js";
+import { matchQty } from "./comparemirror.js";
+import { groupLabel, SLOT_LABEL } from "./slots.js";
+import { SwapPop } from "./swappop.jsx";
 import { useEscClose, HelpTip } from "./widgets.jsx";
 import { useSchluterCatalog } from "./useschlutercatalog.js";
 import { useWediCatalog } from "./usewedicatalog.js";
@@ -23,6 +27,7 @@ import { lineItems as schluterLineItems } from "./schluter.js";
 
 const fm = (n) => "$" + (+n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
 const DRAIN_LBL = { point: "point drain", offset: "offset drain", linear: "linear drain" };
+const BRAND = { wedi: "wedi", schluter: "Schluter" };
 
 const CSS = `
 .cmp-tab{flex:1 1 0;min-width:0;display:flex;flex-direction:column;overflow-y:auto;position:relative;
@@ -38,7 +43,8 @@ const CSS = `
 .cmp-tab .lensseg small{display:block;font-size:8.5px;font-weight:600;opacity:.75}
 .cmp-tab .cmp-grid{display:grid;grid-template-columns:150px 1fr 1fr;border-bottom:1px solid var(--ft-border)}
 .cmp-tab .cmp-grid>div{padding:7px 14px;font-size:12px;border-bottom:1px solid var(--ft-row-line)}
-.cmp-tab .cmp-grid .cat{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.11em;color:var(--ft-faint);display:flex;align-items:center}
+.cmp-tab .cmp-grid .gband{grid-column:1/-1;padding:6px 14px 4px;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.11em;color:var(--ft-faint);background:var(--ft-tint);border-bottom:1px solid var(--ft-row-line)}
+.cmp-tab .cmp-grid .cat{font-size:11px;font-weight:700;color:var(--ft-muted);display:flex;align-items:center}
 .cmp-tab .cmp-grid .cell .ln{display:flex;justify-content:space-between;gap:10px;padding:1px 0}
 .cmp-tab .cmp-grid .cell .ln .n{min-width:0}
 .cmp-tab .cmp-grid .cell .ln .n small{color:var(--ft-faint);font-size:10px;display:block;overflow:hidden;text-overflow:ellipsis}
@@ -46,6 +52,11 @@ const CSS = `
 .cmp-tab .cmp-grid .cell .ln.so .n{color:var(--s-rust,#B4552D)}
 .cmp-tab .cmp-grid .cell .ln.note .n,.cmp-tab .cmp-grid .cell .ln.note .p{color:var(--ft-faint);font-style:italic;font-weight:600}
 .cmp-tab .cmp-grid .cell .ln.dash .n{color:var(--ft-faint)}
+.cmp-tab .cmp-grid .cell .ln .tag{font-size:8.5px;font-weight:800;color:var(--ft-brand-deep);background:var(--ft-brand-soft);border-radius:4px;padding:0 5px;margin-left:4px;vertical-align:1px;white-space:nowrap}
+.cmp-tab .cmp-grid .cell .ln .acts{display:inline-flex;gap:3px;flex:none;align-self:center}
+.cmp-tab .cmp-grid .cell .ln .acts button{width:20px;height:20px;border-radius:5px;border:1px solid var(--ft-border);background:var(--ft-card);color:var(--ft-muted);font-size:11px;font-weight:800;line-height:1;cursor:pointer;font-family:inherit}
+.cmp-tab .cmp-grid .cell .ln .acts button:hover{border-color:var(--ft-brand);color:var(--ft-brand-deep)}
+.cmp-tab .cmp-grid .cell .ln.plus .n{color:var(--ft-faint);font-style:italic;font-weight:600}
 .cmp-tab .cmp-grid .cell .miss{font-size:11.5px;color:var(--ft-faint);font-weight:600;line-height:1.5}
 .cmp-tab .cmp-grid .brandh{font-size:13px;font-weight:800;display:flex;align-items:center;gap:8px}
 .cmp-tab .cmp-grid .brandh small{font-size:10.5px;font-weight:600;color:var(--ft-faint)}
@@ -75,26 +86,53 @@ const CSS = `
 .cmp-tab .cmodal .orow .v{margin-left:auto;font-variant-numeric:tabular-nums}
 .cmp-tab .cmodal .bn{font-size:11px;color:var(--ft-muted);line-height:1.55;margin-top:9px}
 .cmp-tab .cmodal .bf{display:flex;gap:8px;justify-content:flex-end;padding:10px 14px;border-top:1px solid var(--ft-border-strong);background:var(--ft-sand)}
+.cmp-pick .cmp-list{max-height:300px;overflow-y:auto;margin-top:4px}
+.cmp-pick .srow{display:flex;align-items:center;gap:8px;width:100%;border:none;background:none;padding:6px 8px;border-radius:6px;cursor:pointer;text-align:left;font-family:inherit}
+.cmp-pick .srow:hover{background:var(--ft-tint)}
+.cmp-pick .srow.on{background:var(--ft-brand-soft);box-shadow:inset 0 0 0 1.5px var(--ft-brand)}
+.cmp-pick .sdot{flex:none;width:6px;height:6px;border-radius:50%;background:var(--ft-brand)}
+.cmp-pick .sdot.so{background:transparent;border:1.3px solid var(--ft-faint)}
+.cmp-pick .srow .n{flex:1;min-width:0;font-size:11.5px;font-weight:700;color:var(--ft-text);line-height:1.3}
+.cmp-pick .srow .n small{display:block;font-size:9.5px;color:var(--ft-faint);font-weight:600}
+.cmp-pick .srow .p{font-size:11.5px;font-weight:800;font-variant-numeric:tabular-nums;color:var(--ft-text)}
 `;
 
-function Column({ rows, lens, cat, miss, first }) {
-  const ls = rows.filter((r) => r.cat === cat);
+// One side of a slot row: its lines (kit first, then added, then mirrored),
+// and for the mirrored side the host lines that found nothing — each with a
+// "+" when the brand has parts for that group at all.
+function Cell({ rows, plus, lens, miss, first, brand, onPick, onDrop, canAdd }) {
   if (miss) return <div className="cell">{first ? <div className="miss">{miss}</div> : null}</div>;
-  if (!ls.length) return <div className="cell"><div className="ln dash"><span className="n">—</span></div></div>;
+  if (!rows.length && !plus.length) return <div className="cell"><div className="ln dash"><span className="n">—</span></div></div>;
   return (
     <div className="cell">
-      {ls.map((r, i) => {
+      {rows.map((r, i) => {
         const amt = lens === "builder" ? r.builder : r.retail;
         return (
-          <div key={i} className={"ln" + (r.noteOnly ? " note" : !r.stock ? " so" : "")}>
+          <div key={i} className={"ln" + (r.noteOnly ? " note" : !r.stock ? " so" : "")} {...(r.mirror ? { "data-mirror-line": r.hostKey } : {})}>
             <span className="n">
               {r.qty > 1 ? r.qty + "× " : ""}{r.name}
+              {r.added && <span className="tag" data-added-tag>{r.mirror === "matched" ? "added · matched" : "added"}</span>}
               <small>{r.sub}{r.est ? " · est." : ""}</small>
             </span>
+            {r.mirror && (
+              <span className="acts">
+                <button type="button" title="pick another part" data-mirror-swap onClick={(ev) => onPick(r.hostKey, ev)}>⇄</button>
+                <button type="button" title="drop this line from the comparison" data-mirror-drop onClick={() => onDrop(r.hostKey)}>×</button>
+              </span>
+            )}
             <span className="p">{amt ? fm(amt) : "—"}</span>
           </div>
         );
       })}
+      {plus.map((e) => (
+        <div key={e.hostKey} className="ln plus" data-mirror-plus={e.hostKey}>
+          <span className="n">
+            {e.kind === "dropped" ? "Not mirrored" : canAdd(e) ? `Nothing comparable in the ${BRAND[brand]} book` : `No ${BRAND[brand]} ${SLOT_LABEL[e.slot].toLowerCase()} in the book`}
+            <small>for {e.host.qty > 1 ? e.host.qty + "× " : ""}{e.host.name}</small>
+          </span>
+          {canAdd(e) && <span className="acts"><button type="button" title={`add a ${BRAND[brand]} part`} data-mirror-add onClick={(ev) => onPick(e.hostKey, ev)}>+</button></span>}
+        </div>
+      ))}
     </div>
   );
 }
@@ -104,9 +142,11 @@ export default function CompareTab({
   wediBuilderPct, schluterBuilderPct,
   stockRows, bookStockReady, books, loadBookItems,
   mortars, mortarDefault, areaName, onQuoteOptions,
+  mirror, onMirror,
 }) {
   const [lens, setLens] = useState("retail");
   const [confirm, setConfirm] = useState(null);
+  const [pick, setPick] = useState(null);
 
   // The confirm modal is a layer of its own on the Esc ladder (ADR 0028): it
   // registers ABOVE the host popup's handler, so one press dismisses the modal
@@ -149,19 +189,41 @@ export default function CompareTab({
     () => mortarItemFrom(mortarDefault || Object.keys(mortars || {})[0] || "", mortars || {}),
     [mortarDefault, mortars]);
 
+  // The mirror (Phase 1d): the host build's hand-added lines, each answered by
+  // the other brand's nearest part or a "+". Picks and drops are the popup's
+  // session state (`mirror`), so they outlive a tab switch but not the popup.
+  const hostBrand = wediHost ? "wedi" : "schluter";
+  const otherReady = wediHost ? schCatReady && schCat.length > 0 : wediCatReady;
+  const plan = useMemo(
+    () => (otherReady ? mirrorPlan(hostBuild, hostBrand, mirror, { cat: schCat, source })
+      : { brand: wediHost ? "schluter" : "wedi", entries: [], manual: [] }),
+    [otherReady, hostBuild, hostBrand, mirror, schCat, source, wediHost]);
+
   // The HOST column is whatever that popup has on screen; the other column is
-  // that engine's house kit for the same room.
+  // that engine's house kit for the same room, plus the mirrored lines.
   const wediBuild = useMemo(
-    () => (wediHost ? hostBuild || null : roomOk && wediCatReady ? wediBuildFor(room, { source, tier }) : null),
-    [wediHost, hostBuild, room, roomOk, wediCatReady, source, tier]);
+    () => (wediHost ? hostBuild || null : roomOk && wediCatReady ? wediBuildFor(room, { source, tier, manual: plan.manual }) : null),
+    [wediHost, hostBuild, room, roomOk, wediCatReady, source, tier, plan.manual]);
   const sch = useMemo(() => {
     if (!wediHost) return { build: hostBuild || null, cfg: hostCfg || null };
     if (!roomOk || !schCatReady || !schCat.length) return { build: null, cfg: null };
-    return schluterBuildFor(room, schCat, { source, mortarItem });
-  }, [wediHost, hostBuild, hostCfg, room, roomOk, schCat, schCatReady, source, mortarItem]);
+    return schluterBuildFor(room, schCat, { source, mortarItem, manual: plan.manual });
+  }, [wediHost, hostBuild, hostCfg, room, roomOk, schCat, schCatReady, source, mortarItem, plan.manual]);
 
-  const wediRows = useMemo(() => wediCompareRows(wediBuild, { builderPct: wPct }), [wediBuild, wPct]);
-  const schRows = useMemo(() => schluterCompareRows(sch.build, { builderPct: sPct }), [sch.build, sPct]);
+  // The other column draws its kit lines from its build and its mirrored
+  // lines from the plan, one per host line — the engine bills them summed.
+  const otherPct = plan.brand === "wedi" ? wPct : sPct;
+  const mirrorRows = useMemo(
+    () => plan.entries.filter((e) => e.match).map((e) => mirrorRow(e, plan.brand, { builderPct: otherPct })),
+    [plan, otherPct]);
+  const wediRows = useMemo(() => {
+    const rows = wediCompareRows(wediBuild, { builderPct: wPct });
+    return wediHost || !rows.length ? rows : [...rows.filter((r) => !r.added), ...mirrorRows];
+  }, [wediBuild, wPct, wediHost, mirrorRows]);
+  const schRows = useMemo(() => {
+    const rows = schluterCompareRows(sch.build, { builderPct: sPct });
+    return !wediHost || !rows.length ? rows : [...rows.filter((r) => !r.added), ...mirrorRows];
+  }, [sch.build, sPct, wediHost, mirrorRows]);
   const wTot = useMemo(() => compareTotals(wediRows), [wediRows]);
   const sTot = useMemo(() => compareTotals(schRows), [schRows]);
 
@@ -179,6 +241,30 @@ export default function CompareTab({
             : "No Schluter build for this room.";
 
   const bothPriced = !wediMiss && !schMiss;
+  const otherMiss = plan.brand === "wedi" ? wediMiss : schMiss;
+  const layout = useMemo(
+    () => compareLayout({ wedi: wediRows, schluter: schRows }, otherMiss ? {} : { [plan.brand]: plan.entries.filter((e) => !e.match) }),
+    [wediRows, schRows, plan, otherMiss]);
+
+  const hostKeys = () => hostAddedLines(hostBuild, hostBrand).map((h) => h.key);
+  const writeMirror = (key, v) => onMirror && onMirror((m) => pruneMirror({ ...m, [key]: v }, hostKeys()));
+  const partsFor = (e) => mirrorParts(plan.brand, e.grp, { cat: schCat, source });
+  const openPick = (hostKey, ev) => {
+    const e = plan.entries.find((x) => x.hostKey === hostKey);
+    if (!e) return;
+    const parts = partsFor(e);
+    const part = (e.match && parts.find((p) => p.g === e.match.g && p.parts.some((c) => c.id === e.match.id)))
+      || parts.find((p) => p.parts.some((c) => c.slot === e.slot)) || parts[0];
+    if (!part) return;
+    const list = mirrorCandidates(e.host, part);
+    const cur = e.match && list.find((c) => c.id === e.match.id);
+    const first = cur || list[0];
+    const r = ev.currentTarget.getBoundingClientRect();
+    setPick({
+      hostKey, part: part.key, id: first.id, qty: cur ? e.qty : matchQty(e.host.part, e.host.qty, first),
+      at: { anchor: ev.currentTarget.closest(".ln"), x: r.right - 470, y: r.bottom + 6 },
+    });
+  };
   const diff = bothPriced ? (lens === "builder" ? sTot.builder - wTot.builder : sTot.retail - wTot.retail) : 0;
   const wLess = diff > 0;
 
@@ -245,13 +331,27 @@ export default function CompareTab({
           <span className="bbadge slt">Schluter</span> KERDI system
           <small>{wediHost ? "house kit" : "this build"}</small>
         </div>
-        {COMPARE_CATS.map((c, i) => (
-          <Fragment key={c}>
-            <div className="cat">{c}</div>
-            <Column rows={wediRows} lens={lens} cat={c} miss={wediMiss} first={i === 0} />
-            <Column rows={schRows} lens={lens} cat={c} miss={schMiss} first={i === 0} />
+        {layout.map((g, gi) => (
+          <Fragment key={g.key}>
+            <div className="gband" data-cmp-group={g.key}>{g.label}</div>
+            {g.slots.map((r, ri) => (
+              <Fragment key={r.slot}>
+                <div className="cat" data-cmp-slot={r.slot}>{r.label}</div>
+                {["wedi", "schluter"].map((b) => (
+                  <Cell key={b} brand={b} rows={r[b]} plus={r[b + "Plus"]} lens={lens}
+                    miss={b === "wedi" ? wediMiss : schMiss} first={gi === 0 && ri === 0}
+                    onPick={openPick} onDrop={(k) => writeMirror(k, { dropped: true })}
+                    canAdd={(e) => partsFor(e).length > 0} />
+                ))}
+              </Fragment>
+            ))}
           </Fragment>
         ))}
+        {!layout.length && (<>
+          <div className="cat" />
+          <Cell brand="wedi" rows={[]} plus={[]} lens={lens} miss={wediMiss} first canAdd={() => false} />
+          <Cell brand="schluter" rows={[]} plus={[]} lens={lens} miss={schMiss} first canAdd={() => false} />
+        </>)}
       </div>
 
       <div className="cmp-tot">
@@ -275,6 +375,41 @@ export default function CompareTab({
         </div>
       )}
 
+      {pick && (() => {
+        const e = plan.entries.find((x) => x.hostKey === pick.hostKey);
+        const parts = e ? partsFor(e) : [];
+        const part = parts.find((p) => p.key === pick.part) || parts[0];
+        if (!e || !part) return null;
+        const list = mirrorCandidates(e.host, part);
+        const cur = list.find((c) => c.id === pick.id) || list[0];
+        const setP = (patch) => setPick((p) => (p ? { ...p, ...patch } : p));
+        const partRow = parts.length > 1 ? [{ label: "Part", chips: parts.map((p) => ({
+          key: p.key, label: p.label, ok: true, on: p.key === part.key,
+          onPick: () => { const top = mirrorCandidates(e.host, p)[0]; setP({ part: p.key, id: top.id, qty: matchQty(e.host.part, e.host.qty, top) }); },
+        })) }] : [];
+        const price = (c) => (c.brand === "wedi" ? c.item.retail : c.retail);
+        return (
+          <SwapPop add at={pick.at} className="cmp-pick" stockFirst={false}
+            title={`${e.match ? "Swap" : "Add to"} ${BRAND[plan.brand]} · ${groupLabel(e.grp)} — for ${e.host.name}`}
+            rows={partRow} qty={pick.qty} onQty={(n) => setP({ qty: n })}
+            summary={{ what: (pick.qty > 1 ? pick.qty + " × " : "") + cur.item.name, why: [cur.id, cur.item.stock ? "stock" : "special order"].join(" · "),
+              delta: "retail", total: fm(price(cur) * pick.qty), up: false }}
+            onUse={() => { writeMirror(e.hostKey, { pick: { g: cur.g, id: cur.id, qty: pick.qty } }); setPick(null); }}
+            onClose={() => setPick(null)}>
+            <div className="cmp-list">
+              {list.slice(0, 60).map((c) => (
+                <button key={c.g + c.id} type="button" className={"srow" + (c.id === cur.id ? " on" : "")} data-mirror-row={c.id}
+                  onClick={() => setP({ id: c.id, qty: matchQty(e.host.part, e.host.qty, c) })}>
+                  <span className={"sdot" + (c.item.stock ? "" : " so")} />
+                  <span className="n">{c.item.name}<small>{[c.id, c.item.stock ? "stock" : "special order"].join(" · ")}</small></span>
+                  <span className="p">{fm(price(c))}</span>
+                </button>
+              ))}
+            </div>
+          </SwapPop>
+        );
+      })()}
+
       {confirm && (
         <div className="cmodal" onClick={() => setConfirm(null)}>
           <div className="box" onClick={(e) => e.stopPropagation()}>
```

- [ ] **Step 2: Wire the popups** — apply:

```diff
diff --git a/src/SchluterConfigurator.jsx b/src/SchluterConfigurator.jsx
index b224ca5..78ba949 100644
--- a/src/SchluterConfigurator.jsx
+++ b/src/SchluterConfigurator.jsx
@@ -457,6 +457,9 @@ export default function SchluterConfigurator({
   const s0 = init.current;
 
   const [tab, setTab] = useState(s0.tab);
+  // Compare's mirrored lines (Phase 1d): hand picks and drops for the other
+  // brand's column, keyed by host added line — kept for this popup session only.
+  const [mirror, setMirror] = useState({});
   const [source, setSource] = useState(s0.source);
   const [w, setW] = useState(s0.w);
   const [d, setD] = useState(s0.d);
@@ -2515,7 +2518,8 @@ export default function SchluterConfigurator({
         wediBuilderPct={wediBuilderPct} schluterBuilderPct={bPct}
         books={books} loadBookItems={loadBookItems} bookStockReady={bookStockReady}
         mortars={mortars} mortarDefault={mortarDefault}
-        areaName={areaName} onQuoteOptions={onQuoteOptions} />
+        areaName={areaName} onQuoteOptions={onQuoteOptions}
+        mirror={mirror} onMirror={setMirror} />
     </Suspense>
   );
 
diff --git a/src/WediConfigurator.jsx b/src/WediConfigurator.jsx
index 3136af3..e9ca547 100644
--- a/src/WediConfigurator.jsx
+++ b/src/WediConfigurator.jsx
@@ -629,6 +629,9 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
   const s0 = init.current;
 
   const [tab, setTab] = useState(s0.tab);
+  // Compare's mirrored lines (Phase 1d): hand picks and drops for the other
+  // brand's column, keyed by host added line — kept for this popup session only.
+  const [mirror, setMirror] = useState({});
   const [panKey, setPanKey] = useState(s0.panKey);
   const [option, setOption] = useState(null);
   const [results, setResults] = useState([]);
@@ -2789,7 +2792,8 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
         stockRows={stockRows} bookStockReady={bookStockReady}
         books={books} loadBookItems={loadBookItems}
         mortars={mortars} mortarDefault={mortarDefault}
-        areaName={areaName} onQuoteOptions={onQuoteOptions} />
+        areaName={areaName} onQuoteOptions={onQuoteOptions}
+        mirror={mirror} onMirror={setMirror} />
     </Suspense>
   );
 
```

- [ ] **Step 3: Verify**

Run: `npm test` → `# fail 0`; `npm run lint`; the build → built. Preview
`schluter-preview.html` (Full catalog, KST965/1525), "+ Niches" → first row,
"+ Drain" → Part: Grate → first row, then the Compare tab:
- bands Base · Drain · Curb · Walls · Seams · Niches · Setting with slot rows
  (Tray, Grate / cover, Flange, Curb, Wall board, Wall membrane, Seam / band,
  Corners, Niche, Setting material);
- the wedi Niche cell holds "16"x22" Shower Niche" tagged `added · matched`,
  "for … niche 12"×20"", with ⇄ and ×;
- the wedi Grate / cover cell holds "Nothing comparable in the wedi book"
  with a "+"; the picker titled "Add to wedi · Drain — for …" has a Part row
  Cover · Frame · Drain kit, a list, qty and Use this.

- [ ] **Step: Commit**

```bash
git add src/CompareTab.jsx src/SchluterConfigurator.jsx src/WediConfigurator.jsx
git commit -m "Compare: group bands and slot rows; hand-added lines mirrored onto the other brand with + / ⇄ / × (158 1d)"   # (end the message with the session's attribution lines)
```

---

### Task 7: Proof — p1d shots, the 1a–1c scripts re-run

**Model:** Sonnet (scripts are in the plan; judgement only on which PNGs
changed for real).

**Files:**
- Create: `.scratch/158_shower-config-roadmap/p1d/shoot-bills.mjs`, `.scratch/158_shower-config-roadmap/p1d/shoot-compare.mjs`, and their PNGs
- Modify: `.scratch/158_shower-config-roadmap/p1b/shoot-schluter.mjs`, `.scratch/158_shower-config-roadmap/p1c/shoot-schluter.mjs`,
  `.scratch/158_shower-config-roadmap/p1c/shoot-wedi.mjs` (the renamed groups), re-rendered PNGs under
  `p1a/`, `p1b/`, `p1c/`

- [ ] **Step 1: Apply the scripts:**

```diff
diff --git a/.scratch/158_shower-config-roadmap/p1b/shoot-schluter.mjs b/.scratch/158_shower-config-roadmap/p1b/shoot-schluter.mjs
index 5a12f28..7d17939 100644
--- a/.scratch/158_shower-config-roadmap/p1b/shoot-schluter.mjs
+++ b/.scratch/158_shower-config-roadmap/p1b/shoot-schluter.mjs
@@ -93,12 +93,12 @@ await pg.locator("[data-schluter-benchchip]").click(); await pg.waitForTimeout(3
 await pg.locator("[data-schluter-benchpick-framed]").click(); await pg.waitForTimeout(500);
 await pg.locator("[data-schluter-benchchip]").click(); await pg.waitForTimeout(300);
 await pg.locator("[data-schluter-benchpick-site]").click(); await pg.waitForTimeout(600);
-const wrap = grp("Extras").locator(".bline", { hasText: /1\/2/ }).first();
-const buildup = grp("Extras").locator(".bline", { hasText: /2"|2″/ }).last();
-console.log("extras:", await grpText("Extras"));
+const wrap = grp("Bench").locator(".bline", { hasText: /1\/2/ }).first();
+const buildup = grp("Bench").locator(".bline", { hasText: /2"|2″/ }).last();
+console.log("extras:", await grpText("Bench"));
 if (!(await wrap.locator("[data-schluter-swapb]").count())) fail("the framed wrap board has no ⇄");
 if (await buildup.locator("[data-schluter-swapb]").count()) fail("the one-part 2″ build-up board shows a ⇄");
-await grp("Extras").evaluate((el) => el.scrollIntoView({ block: "center" }));
+await grp("Bench").evaluate((el) => el.scrollIntoView({ block: "center" }));
 await shot("s5-bench-lines");
 
 // the wrap swap opens its own bench list (not the Walls board line that
@@ -113,7 +113,7 @@ await shot("s6-bench-wrap-list");
 const other = rowSkus.find((k) => k !== wrapSku);
 await pg.locator(`.sch-swappanel [data-schluter-swaprow="${other}"]`).click();
 await pg.waitForTimeout(500);
-const wrapAfter = await grp("Extras").locator(".bline").first().innerText();
+const wrapAfter = await grp("Bench").locator(".bline").first().innerText();
 console.log("wrap after pick:", flat(wrapAfter));
 if (!wrapAfter.includes(other)) fail("the wrap pick did not land on the bench line");
 if (!(await grpText("Walls")).includes(wrapSku)) fail("the wrap pick moved the Walls board");
@@ -125,7 +125,7 @@ await pg.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await pg.waitFo
 const menu = pg.locator("[data-schluter-benchmenu]");
 await menu.locator("button", { hasText: "2″ build-up" }).click(); await pg.waitForTimeout(400);
 await menu.locator("button", { hasText: /^Framed$/ }).click(); await pg.waitForTimeout(500);
-const wrapReset = await grp("Extras").locator(".bline").first().innerText();
+const wrapReset = await grp("Bench").locator(".bline").first().innerText();
 console.log("wrap after build change:", flat(wrapReset));
 if (!wrapReset.includes(wrapSku) || wrapReset.includes(other)) fail("the board pick survived a build change");
 
diff --git a/.scratch/158_shower-config-roadmap/p1c/shoot-schluter.mjs b/.scratch/158_shower-config-roadmap/p1c/shoot-schluter.mjs
index f90c98c..a2b0038 100644
--- a/.scratch/158_shower-config-roadmap/p1c/shoot-schluter.mjs
+++ b/.scratch/158_shower-config-roadmap/p1c/shoot-schluter.mjs
@@ -24,7 +24,7 @@ await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg
 
 const groups = await pg.locator("[data-add-group]").evaluateAll((els) => els.map((e) => e.getAttribute("data-add-group")));
 console.log("+ on:", groups.join(", "));
-if (groups.join() !== "Base,Drain,Walls,Seams,Curb,Setting,Extras") fail("not every group has a +");
+if (groups.join() !== "Base,Drain,Curb,Walls,Seams,Niches,Bench,Setting,Extras") fail("not every group has a +");
 
 // a one-part group: a list, no Part row; a click adds 1 and closes
 await plus("Curb");
diff --git a/.scratch/158_shower-config-roadmap/p1c/shoot-wedi.mjs b/.scratch/158_shower-config-roadmap/p1c/shoot-wedi.mjs
index d163155..a832605 100644
--- a/.scratch/158_shower-config-roadmap/p1c/shoot-wedi.mjs
+++ b/.scratch/158_shower-config-roadmap/p1c/shoot-wedi.mjs
@@ -29,21 +29,21 @@ await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout
 
 const groups = await pg.locator("[data-add-group]").evaluateAll((els) => els.map((e) => e.getAttribute("data-add-group")));
 console.log("+ on:", groups.join(", "));
-if (groups.join() !== "floor,walls,bench,drain,install,addon") fail("not every bucket has a +");
+if (groups.join() !== "Base,Drain,Curb,Walls,Seams,Niches,Bench,Setting") fail("not every shared group has a +");
 
 // two niches of different sizes through the chip — it adds another each click
 for (const nth of [0, 3]) {
   await pg.locator('[data-wedi-chip="niche"]').click(); await pg.waitForTimeout(300);
   await pg.locator(".wedi-chipmenu .srow").nth(nth).click(); await pg.waitForTimeout(300);
 }
-const addons = await grpText("Add-ons");
+const addons = await grpText("Niches") + " | " + await grpText("Add-ons");
 console.log("Add-ons:", addons);
-if ((await grp("Add-ons").locator("[data-added-tag]").count()) !== 2) fail("two niche sizes did not land as two added lines");
+if ((await grp("Niches").locator("[data-added-tag]").count()) !== 2) fail("two niche sizes did not land as two added lines");
 if (!/✓ Niche ×2/.test(addons)) fail("the niche chip does not read ✓ Niche ×2");
 await shot("w1-two-niches");
 
 // a stepped panel add: the kit's panel again, qty 2 — its own line, "kit also bills 2"
-await plus("walls");
+await plus("Walls");
 if (await pg.locator('[data-drain-chip^="Size:auto"]').count()) fail("the panel + shows an Auto chip");
 await pg.locator("[data-add-qty] button").nth(1).click(); await pg.waitForTimeout(200);
 console.log("panel +:", await pop());
@@ -57,7 +57,7 @@ if (wallLines[wallLines.length - 1] !== true || wallLines.slice(0, -1).some(Bool
 await shot("w3-panel-kit-also");
 
 // a stepped curb add: Style → Length, no Auto, no No curb
-await plus("floor");
+await plus("Curb");
 await pg.locator('[data-drain-chip="Part:curb"]').click(); await pg.waitForTimeout(300);
 const curbPop = await pop();
 console.log("curb +:", curbPop);
@@ -66,19 +66,19 @@ await shot("w4-curb-add");
 await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);
 
 // an added niche's own ⇄: a list of niches, the row it replaces lit
-await grp("Add-ons").locator("[data-added-swapb]").first().click(); await pg.waitForTimeout(300);
+await grp("Niches").locator("[data-added-swapb]").first().click(); await pg.waitForTimeout(300);
 console.log("added ⇄:", (await pop()).slice(0, 200));
 if (!/Swap the added niche/.test(await pop())) fail("the added niche's ⇄ is not its own panel");
 await shot("w5-added-swap");
 await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);
 
 // − on one niche takes that one off, not both
-await grp("Add-ons").locator(".bline").first().locator(".stepper button").first().click(); await pg.waitForTimeout(400);
-if ((await grp("Add-ons").locator(".bline").count()) !== 1) fail("− on one niche did not leave the other");
+await grp("Niches").locator(".bline").first().locator(".stepper button").first().click(); await pg.waitForTimeout(400);
+if ((await grp("Niches").locator(".bline").count()) !== 1) fail("− on one niche did not leave the other");
 
 const q = async (ln) => +(await ln.locator(".stepper .q").innerText());
 // an added niche stepped to 2 and back comes off one, not all
-const niche = grp("Add-ons").locator(".bline").first();
+const niche = grp("Niches").locator(".bline").first();
 await niche.locator(".stepper button").nth(1).click(); await pg.waitForTimeout(300);
 if ((await q(niche)) !== 2) fail("+ on the added niche did not step it to 2");
 await niche.locator(".stepper button").first().click(); await pg.waitForTimeout(300);
@@ -99,24 +99,24 @@ if (a1 !== a0) fail("+ on the kit panel line moved the added panel line");
 // a room re-solve keeps the added lines as they were
 const addedLines = async () => pg.locator(".bline").filter({ has: pg.locator("[data-added-tag]") })
   .evaluateAll((els) => els.map((e) => e.querySelector(".n").textContent + " ×" + e.querySelector(".stepper .q").textContent));
-const added0 = await addedLines(), floor0 = await grpText("Floor");
+const added0 = await addedLines(), floor0 = await grpText("Base");
 await pg.locator(".modetab", { hasText: "Custom shower" }).click(); await pg.waitForTimeout(500);
 const wIn = pg.locator(".roomform .rinp").first();
 await wIn.fill("72"); await wIn.press("Enter"); await pg.waitForTimeout(900);
 const added1 = await addedLines();
-console.log("re-solved 72″:", (await grpText("Floor")).slice(0, 80), "| added:", added1.join(", "));
-if ((await grpText("Floor")) === floor0) fail("the room did not re-solve");
+console.log("re-solved 72″:", (await grpText("Base")).slice(0, 80), "| added:", added1.join(", "));
+if ((await grpText("Base")) === floor0) fail("the room did not re-solve");
 if (!added0.length || added1.join() !== added0.join()) fail("the re-solve dropped or changed the added lines");
 await shot("w8-resolve-keeps-added");
 
 // land + Reconfigure: the added lines come back, nothing doubles
-const before = await grpText("Walls") + await grpText("Add-ons");
+const before = await grpText("Walls") + await grpText("Niches");
 await pg.locator("[data-wedi-add]").click();
 await pg.waitForSelector("[data-wedi-confirm]", { timeout: 5000 });
 await pg.locator("[data-wedi-confirm]").click(); await pg.waitForTimeout(600);
 await pg.locator("[data-sheet-reconfig]").first().click();
 await pg.waitForSelector(".stepper", { timeout: 5000 }); await pg.waitForTimeout(900);
-const after = await grpText("Walls") + await grpText("Add-ons");
+const after = await grpText("Walls") + await grpText("Niches");
 console.log("reopened:", after);
 if (after !== before) fail("Reconfigure did not reopen the added lines as they were");
 await shot("w6-reconfigure-round-trip");
@@ -127,7 +127,7 @@ await pg.getByRole("button", { name: "Clear design" }).click(); await pg.waitFor
 await pg.locator(".modetab", { hasText: "Kits" }).dispatchEvent("click"); await pg.waitForTimeout(400);
 await pg.locator("[data-wedi-pan='US9200007']").click(); await pg.waitForTimeout(800);
 const flat0 = await drawing();
-await plus("floor");
+await plus("Curb");
 await pg.locator('[data-drain-chip="Part:curb"]').click(); await pg.waitForTimeout(300);
 await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(600);
 if (!(await pg.locator(".bline", { hasText: /Curb(?!less)/ }).count())) fail("the added curb did not bill");
diff --git a/.scratch/158_shower-config-roadmap/p1d/shoot-bills.mjs b/.scratch/158_shower-config-roadmap/p1d/shoot-bills.mjs
new file mode 100644
index 0000000..a3c336d
--- /dev/null
+++ b/.scratch/158_shower-config-roadmap/p1d/shoot-bills.mjs
@@ -0,0 +1,76 @@
+// Proof: both bills draw the nine shared groups (ticket 158 Phase 1d) — Base ·
+// Drain · Curb · Walls · Seams · Niches · Bench · Setting · Extras — each with
+// its "+"; wedi's fasteners sit with the panels under Walls; a niche lands
+// under Niches and a bench under Bench on both brands; both print sheets list
+// the lines in group order.
+//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p1d/shoot-bills.mjs
+import { createRequire } from "node:module";
+const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
+const OUT = ".scratch/158_shower-config-roadmap/p1d";
+const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
+const pg = await b.newPage({ viewport: { width: 1760, height: 1300 } });
+let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
+const fail = (m) => { console.error("FAIL:", m); err = true; };
+const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
+const flat = (t) => t.replace(/\n+/g, " | ");
+const grp = (name) => pg.locator(".bgroup", { has: pg.locator(".bg-h", { hasText: new RegExp("^" + name, "i") }) });
+const grpText = async (name) => flat(await grp(name).innerText());
+const plus = async (g) => { await pg.locator(`[data-add-group="${g}"]`).click(); await pg.waitForSelector("[data-add-pop]", { timeout: 5000 }); await pg.waitForTimeout(200); };
+const heads = async () => (await pg.locator(".buildcol .bg-h, .bc-scroll .bg-h").allInnerTexts()).map((t) => t.split("\n")[0].trim().toUpperCase());
+const NINE = ["BASE", "DRAIN", "CURB", "WALLS", "SEAMS", "NICHES", "BENCH", "SETTING", "EXTRAS"];
+
+// --- Schluter ---
+await pg.goto("http://localhost:5199/schluter-preview.html");
+await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
+await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(600); // Full catalog
+await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);
+const sPlus = await pg.locator("[data-add-group]").evaluateAll((els) => els.map((e) => e.getAttribute("data-add-group")));
+console.log("Schluter +:", sPlus.join(", "));
+if (sPlus.join() !== "Base,Drain,Curb,Walls,Seams,Niches,Bench,Setting,Extras") fail("Schluter lacks a + on every shared group, in order");
+await plus("Niches");
+await pg.locator("[data-add-row]").first().click(); await pg.waitForTimeout(400);
+if (!/KB12SN/.test(await grpText("Niches"))) fail("the niche did not land under Niches");
+await plus("Bench");
+await pg.locator("[data-add-row]", { hasText: /bench/i }).first().click(); await pg.waitForTimeout(400);
+if ((await grp("Bench").locator("[data-added-tag]").count()) !== 1) fail("the bench did not land under Bench");
+const sHeads = await heads();
+console.log("Schluter groups:", sHeads.join(" · "));
+if (sHeads.slice(0, 9).join() !== NINE.join()) fail("Schluter groups are not the nine in order");
+await shot("s1-schluter-groups");
+await pg.locator("[data-schluter-print]").click(); await pg.waitForTimeout(700);
+const sPrint = await pg.locator(".ps-table tbody tr").allInnerTexts();
+const sAt = (re) => sPrint.findIndex((t) => re.test(t));
+console.log("Schluter print:", sPrint.map((t) => t.replace(/\s+/g, " ").slice(0, 36)).join(" · "));
+if (!(sAt(/Tray/) < sAt(/curb/i) && sAt(/curb/i) < sAt(/membrane roll/) && sAt(/membrane roll/) < sAt(/niche/) && sAt(/niche/) < sAt(/ALL-SET/))) fail("Schluter print is not in group order");
+await shot("s2-schluter-print");
+await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);
+
+// --- wedi ---
+await pg.goto("http://localhost:5199/wedi-preview.html");
+await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
+await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500);
+await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout(800); // 36×60
+await pg.locator('[data-wedi-chip="niche"]').click(); await pg.waitForTimeout(300);
+await pg.locator(".wedi-chipmenu .srow").first().click(); await pg.waitForTimeout(300);
+await pg.locator('[data-wedi-chip="seat"]').click(); await pg.waitForTimeout(300);
+if (await pg.locator(".wedi-chipmenu .srow").count()) { await pg.locator(".wedi-chipmenu .srow").first().click(); await pg.waitForTimeout(300); }
+const wHeads = await heads();
+console.log("wedi groups:", wHeads.join(" · "));
+if (!["BASE", "DRAIN", "CURB", "WALLS", "SEAMS", "NICHES", "BENCH", "SETTING"].every((h, i, a) => wHeads.indexOf(h) >= 0 && (i === 0 || wHeads.indexOf(a[i - 1]) < wHeads.indexOf(h)))) fail("wedi groups are not in the shared order");
+if (wHeads.some((h) => /FLOOR|INSTALL|DRAIN & FINISH/.test(h))) fail("an old wedi bucket survived");
+if (!/Fastener Kit/.test(await grpText("Walls"))) fail("wedi fasteners are not under Walls");
+if (!/Niche/.test(await grpText("Niches"))) fail("the wedi niche is not under Niches");
+if (!/Seat/.test(await grpText("Bench"))) fail("the wedi seat is not under Bench");
+if (!/Valve Seal/.test(await grpText("Seams"))) fail("the valve seal is not under Seams");
+if (!/Curb/.test(await grpText("Curb"))) fail("the curb is not under Curb");
+await shot("w1-wedi-groups");
+await pg.locator("[data-wedi-print], button:has-text('Print layout')").first().click(); await pg.waitForTimeout(700);
+const wPrint = await pg.locator(".ps-table tbody tr").allInnerTexts();
+const wAt = (re) => wPrint.findIndex((t) => re.test(t));
+console.log("wedi print:", wPrint.map((t) => t.replace(/\s+/g, " ").slice(0, 36)).join(" · "));
+if (!(wAt(/Shower Base/) < wAt(/Curb/) && wAt(/Curb/) < wAt(/Building Panel/) && wAt(/Building Panel/) < wAt(/Niche/) && wAt(/Niche/) < wAt(/PRO-SET/))) fail("wedi print is not in group order");
+await shot("w2-wedi-print");
+
+await b.close();
+if (err) { console.error("— checks FAILED"); process.exit(1); }
+console.log("— all checks passed");
diff --git a/.scratch/158_shower-config-roadmap/p1d/shoot-compare.mjs b/.scratch/158_shower-config-roadmap/p1d/shoot-compare.mjs
new file mode 100644
index 0000000..b74a8c1
--- /dev/null
+++ b/.scratch/158_shower-config-roadmap/p1d/shoot-compare.mjs
@@ -0,0 +1,98 @@
+// Proof: Compare lines both brands up by shared group and slot (ticket 158
+// Phase 1d), and mirrors the host's hand-added lines onto the other brand —
+// the nearest part tagged "added · matched", a "+" where nothing compares, a
+// picker on the brand's own "+" parts, × to drop, and quote option B carrying
+// the mirrored lines. Schluter host first, then wedi host.
+//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p1d/shoot-compare.mjs
+import { createRequire } from "node:module";
+const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
+const OUT = ".scratch/158_shower-config-roadmap/p1d";
+const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
+const pg = await b.newPage({ viewport: { width: 1760, height: 1300 } });
+let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
+const fail = (m) => { console.error("FAIL:", m); err = true; };
+const shot = async (name, full = true) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png`, fullPage: full }); console.log("shot", name); };
+const flat = (t) => t.replace(/\n+/g, " | ");
+const plus = async (g) => { await pg.locator(`[data-add-group="${g}"]`).click(); await pg.waitForSelector("[data-add-pop]", { timeout: 5000 }); await pg.waitForTimeout(200); };
+const toCompare = async () => { await pg.locator(".modetab", { hasText: "Compare" }).dispatchEvent("click"); await pg.waitForSelector(".cmp-grid [data-cmp-group]", { timeout: 20000 }); await pg.waitForTimeout(800); };
+const slotRow = (slot) => pg.locator(`.cmp-grid [data-cmp-slot="${slot}"]`);
+const bands = async () => pg.locator(".cmp-grid [data-cmp-group]").evaluateAll((els) => els.map((e) => e.getAttribute("data-cmp-group")));
+const ORDER = ["base", "drain", "curb", "walls", "seams", "niches", "bench", "setting", "extras"];
+const inOrder = (xs) => xs.every((x, i) => i === 0 || ORDER.indexOf(xs[i - 1]) < ORDER.indexOf(x));
+
+// --- Schluter host: an added niche and an added grate ---
+await pg.goto("http://localhost:5199/schluter-preview.html");
+await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
+await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(600);
+await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);
+await plus("Niches"); await pg.locator("[data-add-row]").first().click(); await pg.waitForTimeout(400);
+await plus("Drain"); await pg.locator('[data-drain-chip="Part:grate"]').click(); await pg.waitForTimeout(300);
+await pg.locator("[data-add-row]").first().click(); await pg.waitForTimeout(400);
+await toCompare();
+const b1 = await bands();
+console.log("bands:", b1.join(" · "));
+if (!inOrder(b1)) fail("group bands are out of order");
+const slots = await pg.locator(".cmp-grid [data-cmp-slot]").evaluateAll((els) => els.map((e) => e.getAttribute("data-cmp-slot")));
+if (!["tray", "grate", "flange", "curb", "wallBoard", "wallMembrane", "seam", "corners", "niche", "setting"].every((s) => slots.includes(s))) fail("a slot row is missing: " + slots.join(","));
+const matched = pg.locator("[data-mirror-line]");
+if ((await matched.count()) !== 1) fail("the added niche did not mirror onto wedi");
+const mText = flat(await matched.first().innerText());
+console.log("mirrored:", mText);
+if (!/added · matched/.test(mText) || !/for .*niche 12"×20"/.test(mText)) fail("the mirrored niche lacks its tag or its 'for'");
+const plusRow = pg.locator("[data-mirror-plus]");
+if ((await plusRow.count()) !== 1 || !/Nothing comparable in the wedi book/.test(await plusRow.innerText())) fail("the added grate did not get a '+'");
+if ((await pg.locator("[data-cmp-slot]", { hasText: "Flange" }).count()) !== 1) fail("the flange row is gone");
+await shot("c1-schluter-host");
+
+// the "+": the wedi Drain parts, a Part row, a list, qty, Use this
+await pg.locator("[data-mirror-add]").click(); await pg.waitForSelector("[data-add-pop]"); await pg.waitForTimeout(300);
+const pick = flat(await pg.locator("[data-add-pop]").innerText());
+console.log("picker:", pick.slice(0, 160));
+if (!/Add to wedi · Drain/.test(pick) || !/PART \| Cover/.test(pick)) fail("the picker isn't the wedi Drain parts");
+await shot("c2-picker", false);
+await pg.locator("[data-mirror-row]").nth(1).click(); await pg.waitForTimeout(200);
+await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(700);
+if ((await pg.locator("[data-mirror-line]").count()) !== 2) fail("the pick did not land as a mirrored line");
+const totBefore = flat(await pg.locator(".cmp-tot").innerText());
+
+// × drops the niche's mirror: the "+" comes back and wedi's total falls
+await pg.locator("[data-mirror-line]", { hasText: /Niche/ }).locator("[data-mirror-drop]").click(); await pg.waitForTimeout(700);
+if (!/Not mirrored/.test(await pg.locator("[data-mirror-plus]").innerText())) fail("× did not put the '+' back");
+const totAfter = flat(await pg.locator(".cmp-tot").innerText());
+console.log("totals:", totBefore, "→", totAfter);
+if (totAfter === totBefore) fail("dropping a mirrored line did not move the wedi total");
+await shot("c3-dropped");
+
+// a tab switch keeps the drop (popup session state)
+await pg.locator(".modetab", { hasText: "Kits" }).dispatchEvent("click"); await pg.waitForTimeout(400);
+await toCompare();
+if (!/Not mirrored/.test(await pg.locator("[data-mirror-plus]").innerText())) fail("the drop did not survive a tab switch");
+
+// --- wedi host: an added niche and an added panel ---
+await pg.goto("http://localhost:5199/wedi-preview.html");
+await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
+await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500);
+await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout(800);
+await pg.locator('[data-wedi-chip="niche"]').click(); await pg.waitForTimeout(300);
+await pg.locator(".wedi-chipmenu .srow").nth(1).click(); await pg.waitForTimeout(300);
+await plus("Walls"); await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(500);
+await toCompare();
+const lines = await pg.locator("[data-mirror-line]").allInnerTexts();
+console.log("wedi host mirrored:", lines.map(flat).join(" || "));
+if (lines.length !== 2) fail("wedi host: expected the niche and the panel to mirror");
+if (!lines.some((t) => /KERDI-BOARD .*panel/i.test(t) && /Building Panel/.test(t))) fail("the panel did not mirror to KERDI-BOARD");
+if (!lines.some((t) => /KERDI-BOARD-SN niche/i.test(t))) fail("the niche did not mirror to a KERDI-BOARD-SN niche");
+await shot("c4-wedi-host");
+
+// quote options: option B carries the mirrored lines
+await pg.locator(".qfoot .cbtn.primary").click(); await pg.waitForTimeout(400);
+const modal = flat(await pg.locator(".cmodal").innerText());
+console.log("modal:", modal.slice(0, 120));
+const sTot = (await pg.locator(".cmp-tot > div").nth(2).locator(".tv").innerText()).match(/\$[\d,]+\.\d\d/)[0];
+console.log("Schluter column total:", sTot);
+if (!new RegExp("B \\| Schluter — \\d+ lines \\| \\" + sTot).test(modal)) fail("option B's total isn't the column's total");
+await shot("c5-quote-options", false);
+
+await b.close();
+if (err) { console.error("— checks FAILED"); process.exit(1); }
+console.log("— all checks passed");
```

- [ ] **Step 2: Shoot before (from `main`)** — for the PR's before/after, check
  out `804a1c0` in a scratch worktree, run its preview on another port, and
  screenshot the Schluter bill (KST965/1525), the wedi bill (US9100004) and the
  Schluter Compare tab into `.scratch/158_shower-config-roadmap/p1d/before-*.png` (three shots; the existing
  `p1c` scripts' page setup is the model).

- [ ] **Step 3: Run everything** with the preview server up:
  `p1d/shoot-bills.mjs`, `p1d/shoot-compare.mjs` (each ends
  `— all checks passed`), then `p1a/shoot-schluter.mjs`, `p1a/shoot-wedi.mjs`,
  `p1b/shoot-schluter.mjs`, `p1b/shoot-wedi.mjs`, `p1b/shoot-band-default.mjs`,
  `p1b/shoot-finish-names.mjs` (exit 0, no `FAIL` / `PAGEERROR`) and both
  `p1c` scripts (`— all checks passed`).

- [ ] **Step 4: Keep only real changes.** Shots that include the build
  column changed for real (new headers) — keep them. Restore
  (`git checkout -- <png>`) any PNG whose only difference is noise. Look at
  every p1d PNG before committing.

- [ ] **Step: Commit**

```bash
git add .scratch/158_shower-config-roadmap
git commit -m "Proof: p1d bills and Compare shots; 1a-1c scripts on the shared groups"   # (end the message with the session's attribution lines)
```

---

### Task 8: Records and full verification

**Model:** Sonnet for the edits; the controller reviews against the ledger.

**Files:**
- Modify: `docs/superpowers/specs/2026-09-27-shared-groups-compare-design.md`,
  `docs/adr/0049-configurator-swaps-remember-the-choice.md`,
  `docs/adr/0034-cross-vendor-compare.md` (one cross-reference line), `src/CLAUDE.md`,
  `.scratch/158_shower-config-roadmap/ticket.md`
- Create: `.scratch/handoffs/shower-config-phase2-2026-09-27.md`

- [ ] **Step 1: Spec amendments** — replace `(none yet)` under "Amendments
  during planning and build" with the thirteen rulings from this plan's
  "Rulings made while prototyping", plus any the build adds (from the SDD
  ledger).

- [ ] **Step 2: ADR 0049** — append `## Amendment (2026-09-27): shared groups
  and the Compare mirror (Phase 1d)`:
  1. The display group derives from the slot (`slots.js` `GROUPS`,
     `groupOf`). Engine groups (Schluter `g`, wedi buckets) stay internal
     keys — nothing saved changes, nothing translates.
  2. wedi fasteners fill `wallBoard`.
  3. "+" tables key on the shared group; each part stores its engine group and
     only offers parts that land back in its group.
  4. Compare's other column holds session state: mirrored added lines (auto
     nearest-size matches, hand picks, drops), priced by the other engine and
     landed in option B's marker as ordinary added lines.
  In ADR 0034 add one line under its consequences pointing at this
  amendment (Compare rows are slot-aligned; the other column can carry added
  lines).

- [ ] **Step 3: `src/CLAUDE.md`** — update the entries for `slots.js`,
  `schluter.js`, `wedi.js`, `comparekit.js`, `CompareTab.jsx`,
  `SchluterConfigurator.jsx`, `WediConfigurator.jsx`; add `comparemirror.js`
  (engine-free, lazy-chunk-only).

- [ ] **Step 4: Ticket and handoff** — ticket 158: a **1d DONE (2026-09-27)**
  block (spec, plan, ADR, proof `p1d/`, PR); Phase 1 complete. Handoff
  `.scratch/handoffs/shower-config-phase2-2026-09-27.md` for Phase 2 (Board vs
  Membrane) in the 1d handoff's house style, carrying the open 1c deferrals.

- [ ] **Step 5: Full verification** — `npm test` (`# fail 0`), `npm run lint`,
  the build, both p1d scripts.

- [ ] **Step: Commit**

```bash
git add docs src/CLAUDE.md .scratch/158_shower-config-roadmap/ticket.md .scratch/handoffs/shower-config-phase2-2026-09-27.md
git commit -m "Records: ADR 0049 1d amendment, spec amendments, CLAUDE.md, ticket, handoff"   # (end the message with the session's attribution lines)
```

