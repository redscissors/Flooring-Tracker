# "+" on Every Group — Add Another Line (Phase 1c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every bill group in both shower configurators gets a "+" that adds
another line — stepped where the group's swap is stepped (no Auto), a list
elsewhere. Added lines are parts with a hand-set qty, each its own line, saved
in the marker (wedi for the first time), tagged "added" with a "kit also bills
N" hint, with their own ⇄. wedi's `addons` retire into the same list, so a
kit can carry several niches of different sizes.

**Architecture:**
- **One added-lines list per brand, in the marker.**
  - Schluter: `cfg.manual = [{ sku, qty, g? }]` (the list it already had;
    rows gain their bill group).
  - wedi: `cfg.manual = [{ key, qty, group? }]`, written by `kitFor`, which
    now bills the rows itself. Old `addons` keys translate on read
    (`addedRows`).
  - Rows key on group + part. Engine helpers own the shape: Schluter
    `addedGroup` / `addedLines` / `addedQty` / `setAddedQty`; wedi
    `addedRows` / `setAddedRow` / `wediBucketOf`.
- **"+" parts per group live in the engines** (`ADD_PARTS` / `addParts` /
  `addPartOf`; `WEDI_ADD_PARTS` / `wediAddParts` / `wediAddPartOf`). Stepped
  "+" options ask the same resolvers ⇄ uses, with Auto dropped:
  `addRollOptions`, `drainAddOptions` (Schluter); `curbAddOptions`,
  `coverAddOptions`, `panelOptions` (wedi).
- **`SwapPop` grows** a qty stepper, children (a list) and an optional summary,
  so the "+" popover is the ⇄ popover.
- **Golden first:** Task 1 captures what old hand-added-line markers bill on
  the pre-1c code; every later task keeps it green, untouched.

**Tech Stack:** React 18 (hooks), Vite 5, Tailwind, plain `node --test`
(`npm test` = `node --test src/*.test.js`), ESLint (`npm run lint`), Playwright
for preview proof.

**Spec:** `docs/superpowers/specs/2026-09-27-add-another-design.md`. Read it
first. It builds on 1a/1b (`docs/superpowers/specs/2026-09-26-drain-slot-design.md`,
`docs/superpowers/specs/2026-09-26-swap-every-line-design.md`, each with its
Amendments section) and ADR 0049
(`docs/adr/0049-configurator-swaps-remember-the-choice.md`). The ticket is
`.scratch/158_shower-config-roadmap/ticket.md` (Phase 1).

**Prototype:** every code block below was run in a scratch copy of the repo
first — full suite green (1743 tests after Task 3), lint clean, build clean,
and both p1c proof scripts passing. The diffs apply cleanly to `main` at
`a98a146` (`git apply --check`).

## Global Constraints

- **No saved kit's bill moves.** An old marker (Schluter `cfg.manual` rows with
  no `g`; wedi `addons`) reopens to the bill it billed before — the Task 1
  golden (`src/addedgolden.test.js`) proves it. Run the whole suite
  (`npm test`) after every task; it must end `# fail 0`.
- **An added line is a part + a hand-set qty** (spec decision 3): never an
  ADR 0049 choice, never re-fitting to the room. A "+" popover has **no Auto
  chip** (and the wedi curb "+" no No curb).
- **An added line is always its own line** (decision 5): never merged into a
  kit line of the same part; its stepper edits its own row; a kit line's
  stepper still writes `qtyOv`.
- **Rows key on group + part**, never part alone (the 1b "swap lookup keyed on
  SKU alone" lesson). An added line's ⇄ replaces only its own row, keeping its
  qty; it never writes the kit's own pick.
- **Old markers translate on read, never on write** (ADR 0049 rule 4):
  `seedState` / `buildFromMarker` / the tile-sf reader translate; `normP`
  passes markers through untouched. No SQL, no Supabase change.
- **Stock only.** Pools narrow to stocked rows unless none are (`pool` /
  `bySource`); stocked first; a special-order pick lands flagged with the SO
  dot; a popover is never empty.
- **The "added" tag and "kit also bills N" are screen only** — the print
  sheets don't show them. A wedi Browse-only build (no pan) hides both.
- **Comments:** be conservative (root `CLAUDE.md` "Code Comments"). Explain
  only non-obvious business rules.
- **Branch and deploy rules.** Never push to `main`. Never touch the live
  Supabase project. UI changes need preview screenshots (Tasks 5–7).
- **Build locally** with placeholder env:
  `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build`
  (a pre-existing CSS minify warning prints; ignore it).
- **Commit trailer:** end every commit message with the session's attribution
  lines. The harness supplies them.
- **Preview server** for every shoot step: `npx vite --port 5199 --strictPort`
  in the background from the repo root; stop it afterwards. Harnesses:
  `http://localhost:5199/schluter-preview.html`,
  `http://localhost:5199/wedi-preview.html`. Playwright via
  `createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core")`,
  `executablePath: "/opt/pw-browsers/chromium"`. The harness opens on Stock
  only; `[data-source-toggle]` switches to Full catalog.
- **Applying a diff block:** save the block verbatim (from `diff --git` to the
  end of the block) to a scratch file and run `git apply <file>`. If it
  refuses, stop and report — do not hand-merge.

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `.scratch/158_shower-config-roadmap/tools/gen-added-golden.mjs` | create (T1) | One-shot capture of what old hand-added-line markers bill on the pre-1c code |
| `src/addedgolden.js` | create (T1, generated) | The golden: wedi `addons` bills + niche sf; Schluter `manual` bills + niche sf |
| `src/addedgolden.test.js` | create (T1) | Every old marker reopens to its golden bill and tile-sf niche |
| `src/schluter.js` | modify (T2) | `BILL_GROUPS`, `addedGroup`, `addedLines`, `addedQty`, `setAddedQty`, `ADD_PARTS`, `addParts`, `addPartOf`, `addRollOptions`, `drainAddOptions`; `buildFromMarker` bills `addedLines`; `sessionFromRows` nets added lines |
| `src/wedi.js` | modify (T3) | `WEDI_BUCKETS`, `wediBucketOf`, `addedRows`, `setAddedRow`, `WEDI_ADD_PARTS`, `wediAddParts`, `wediAddPartOf`, `curbAddOptions`, `coverAddOptions`; `kitFor` bills and writes `manual` (never `addons`); `buildFromMarker` passes `addedRows(cfg)`; `sessionFromRows` nets added lines |
| `src/showersf.js` | modify (T3) | wedi niche back reads `addedRows(cfg)` × qty |
| `src/swappop.jsx` | modify (T4) | `qty` / `onQty` stepper, `children`, optional `summary`, `add` (`data-add-pop`) |
| `src/SchluterConfigurator.jsx` | modify (T5) | "+" on every group header, `addPanel`, the "added" tag and hint, added-line ⇄, group-aware steppers, niche picker adds another, `drainRowsFor` extracted from `drainPanel` |
| `src/WediConfigurator.jsx` | modify (T6) | the same for wedi; `addons` state retired into `manual`; chips add another; the curb drawing and "Turn into a curb" follow the kit's own curb |
| `src/schluter.test.js`, `src/wedi.test.js`, `src/showersf.test.js` | modify (T2, T3) | Engine tests |
| `.scratch/158_shower-config-roadmap/p1c/shoot-schluter.mjs`, `shoot-wedi.mjs` | create (T5, T6) | Preview proof with pass/fail checks |
| `.scratch/158_shower-config-roadmap/p1b/shoot-wedi.mjs` | modify (T6) | Two 1b assertions superseded by 1c (spec §3) |
| `docs/adr/0049-…md`, the spec, `src/CLAUDE.md`, `src/model.js` (comment), `.claude/skills/floortrack-data-model/SKILL.md`, the ticket, a new handoff | modify (T8) | Records |

Task order matters:
- **Task 1 runs before any engine change.** Its golden is the pre-1c behaviour.
- **Tasks 2–4 before Tasks 5–6.** The popups call the engines and `SwapPop`.

---

### Task 1: Golden of old hand-added-line markers, captured from the pre-1c code

**Files:**
- Create: `.scratch/158_shower-config-roadmap/tools/gen-added-golden.mjs`
- Create (generated): `src/addedgolden.js`
- Create: `src/addedgolden.test.js`

**Interfaces:**
- Consumes: today's `kitFor`, wedi `buildFromMarker`, Schluter `buildFromMarker`,
  `wediPieces`, `schluterPieces` — unchanged.
- Produces: `WEDI` and `SCHLUTER` arrays in `src/addedgolden.js`; later tasks
  must keep `src/addedgolden.test.js` green **without editing either file**.

Bills compare as **quantities per part** (`"<key>x<total>"`, sorted), because
1c moves added lines into their own groups and a key saved twice in `addons`
becomes one row of qty 2 — the bill is the same, the line layout isn't.

- [ ] **Step 1: Write the generator** — create
  `.scratch/158_shower-config-roadmap/tools/gen-added-golden.mjs`:

```js
// Captures what OLD hand-added-line markers bill today (ticket 158 Phase 1c):
// wedi `addons` shapes (one niche, the same niche twice, two sizes, niche +
// sealant gun, niche + seat, a glass shelf, a premade bench) on a fundo, a
// linear and a module pan, with their tile-sf niche figure; and Schluter
// `cfg.manual` rows in the old { sku, qty } shape. Run ONCE against the
// pre-1c code; src/addedgolden.test.js compares 1c's buildFromMarker (and
// wediPieces) against it.
//   node .scratch/158_shower-config-roadmap/tools/gen-added-golden.mjs
import { writeFileSync } from "node:fs";
import { group, kitFor, buildFromMarker as wediFromMarker, SKU } from "../../../src/wedi.js";
import { FIXTURE_ITEMS } from "../../../src/schluterfixture.js";
import { catalogOf, buildFromMarker as schFromMarker } from "../../../src/schluter.js";
import { wediPieces, schluterPieces } from "../../../src/showersf.js";

// a bill as quantities per part — "<key>x<total qty>" sorted — so a line that
// changes group, order or splits/merges (1c files added lines under their own
// group; a key saved twice in addons becomes one row of qty 2) still compares
const bag = (lines, keyOf) => {
  const q = new Map();
  lines.filter((l) => !l.noteOnly).forEach((l) => q.set(keyOf(l.item), (q.get(keyOf(l.item)) || 0) + l.qty));
  return [...q].map(([k, n]) => k + "x" + n).sort().join(" ");
};
const nicheOf = (p) => { const n = p && p.pieces.find((x) => x.piece === "niche"); return n ? n.sf : 0; };

const linear = group("pan").find((p) => p.drain && p.drain.type === "linear");
const wediPans = ["US9100004", linear.key, "075100052"];
const ADDONS = [
  ["US3000004"], ["US3000004", "US3000004"], ["US3000004", "US3000248"],
  ["US3000005", SKU.gun], ["US3000005", "US3000002"], ["US3000050"], ["US3000043"],
];
const wedi = [];
for (const pan of wediPans) {
  for (const addons of ADDONS) {
    const cfg = kitFor(pan, { addons }).cfg;
    const b = wediFromMarker({ mode: "kit", cfg });
    wedi.push([pan, addons, bag(b.lines, (i) => i.key), nicheOf(wediPieces(cfg))]);
  }
}

const cat = catalogOf(FIXTURE_ITEMS);
const room = (drain) => ({
  w: 60, d: 36, curbed: true, drain, wallSys: "membrane",
  walls: [{ name: "Back", on: true, len: 60, h: 96 }, { name: "Left", on: true, len: 36, h: 96 }, { name: "Right", on: true, len: 36, h: 96 }],
});
const MANUAL = [
  [{ sku: "KEBA100/125", qty: 1 }],
  [{ sku: "KB1212202440", qty: 2 }],
  [{ sku: "KB12SN305508A1", qty: 2 }, { sku: "KB12SN305711A1", qty: 1 }],
  [{ sku: "KERDIFIX/BW", qty: 1 }, { sku: "SLRSETA50W", qty: 1 }],
  [{ sku: "KEBA100/125/10M", qty: 1 }],
  [{ sku: "KERDI200/10M", qty: 1 }, { sku: "KBSB410TA", qty: 1 }, { sku: "KD4GRKECS", qty: 1 }],
];
const schluter = [];
for (const drain of ["point", "linear"]) {
  for (const manual of MANUAL) {
    const cfg = { ...room(drain), manual, source: "all" };
    const b = schFromMarker({ mode: "custom", cfg }, cat);
    schluter.push([drain, manual, bag(b.lines, (i) => i.sku), nicheOf(schluterPieces(cfg))]);
  }
}

const out = `// GENERATED by .scratch/158_shower-config-roadmap/tools/gen-added-golden.mjs
// from the pre-1c engines (ticket 158 Phase 1c) — what old hand-added-line
// markers billed before added lines moved into their own groups and wedi's
// addons retired into cfg.manual. Never hand-edit; a bill that moves is a
// test failure, not a re-pin. Bills are quantities per part: "<key>x<total>" sorted.
// WEDI: [pan, cfg.addons, bill, tile-sf niche back (sf, null = enter manually)].
// SCHLUTER: [drain, cfg.manual, bill, tile-sf niche back (sf, null = enter manually)] on a 60×36 room.
export const WEDI = [
${wedi.map((c) => "  " + JSON.stringify(c)).join(",\n")},
];
export const SCHLUTER = [
${schluter.map((c) => "  " + JSON.stringify(c)).join(",\n")},
];
`;
writeFileSync(new URL("../../../src/addedgolden.js", import.meta.url), out);
console.log("wedi:", wedi.length, "schluter:", schluter.length, "bytes:", out.length);
```

- [ ] **Step 2: Generate the golden on the untouched code**

Run: `node .scratch/158_shower-config-roadmap/tools/gen-added-golden.mjs`
Expected: `wedi: 21 schluter: 12 bytes: 6758` and a new `src/addedgolden.js`.
Spot-check: the `["US9100004",["US3000004","US3000004"],…]` row carries
`US3000004x2` and niche `1.3`; the Schluter niche rows carry `5.7`.

- [ ] **Step 3: Write the golden test** — create `src/addedgolden.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { kitFor, buildFromMarker as wediFromMarker } from "./wedi.js";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { catalogOf, buildFromMarker as schFromMarker } from "./schluter.js";
import { wediPieces, schluterPieces } from "./showersf.js";
import { WEDI, SCHLUTER } from "./addedgolden.js";

// Old hand-added-line markers — wedi `addons`, Schluter `cfg.manual` rows in
// the old { sku, qty } shape — must reopen to the bill and tile-sf niche the
// pre-1c code gave them (ticket 158 Phase 1c spec, "Golden first"). The
// golden was captured from that code; bills compare as quantities per part,
// because 1c moves added lines into their own groups.
const bag = (lines, keyOf) => {
  const q = new Map();
  lines.filter((l) => !l.noteOnly).forEach((l) => q.set(keyOf(l.item), (q.get(keyOf(l.item)) || 0) + l.qty));
  return [...q].map(([k, n]) => k + "x" + n).sort().join(" ");
};
const nicheOf = (p) => { const n = p && p.pieces.find((x) => x.piece === "niche"); return n ? n.sf : 0; };

test("every old wedi addons marker reopens to its pre-1c bill and niche sf", () => {
  assert.equal(WEDI.length, 21);
  for (const [pan, addons, bill, niche] of WEDI) {
    const cfg = { ...kitFor(pan, {}).cfg, addons };
    delete cfg.manual;
    const at = pan + " " + addons.join(",");
    assert.equal(bag(wediFromMarker({ mode: "kit", cfg }).lines, (i) => i.key), bill, at);
    assert.equal(nicheOf(wediPieces(cfg)), niche, at);
  }
});

test("every old Schluter manual marker reopens to its pre-1c bill and niche sf", () => {
  assert.equal(SCHLUTER.length, 12);
  const cat = catalogOf(FIXTURE_ITEMS);
  for (const [drain, manual, bill, niche] of SCHLUTER) {
    const cfg = {
      w: 60, d: 36, curbed: true, drain, wallSys: "membrane", source: "all", manual,
      walls: [{ name: "Back", on: true, len: 60, h: 96 }, { name: "Left", on: true, len: 36, h: 96 }, { name: "Right", on: true, len: 36, h: 96 }],
    };
    const at = drain + " " + manual.map((m) => m.sku).join(",");
    assert.equal(bag(schFromMarker({ mode: "custom", cfg }, cat).lines, (i) => i.sku), bill, at);
    assert.equal(nicheOf(schluterPieces(cfg)), niche, at);
  }
});
```

(`delete cfg.manual` keeps the case an OLD marker once Task 3 makes `kitFor`
write `manual`; today it is a no-op.)

- [ ] **Step 4: Run it**

Run: `node --test src/addedgolden.test.js` → `# pass 2`, `# fail 0`.
Run: `npm test` → `# fail 0` (1725 tests).

- [ ] **Step 5: Commit**

```bash
git add .scratch/158_shower-config-roadmap/tools/gen-added-golden.mjs src/addedgolden.js src/addedgolden.test.js
git commit -m "Golden: what old hand-added-line markers bill before 1c (ticket 158)"
```

---

### Task 2: Schluter engine — added lines, "+" parts, stepped "+" options

**Files:**
- Modify: `src/schluter.js`
- Test: `src/schluter.test.js`

**Interfaces:**
- Consumes: `slotOf`, `membraneOptions`, `bandOptions`, `drainOptions`,
  `resolveDrain`, `ovKey` (existing).
- Produces (all exported from `src/schluter.js`):
  - `BILL_GROUPS: string[]` — `["Base","Drain","Walls","Seams","Curb","Setting","Extras"]`.
  - `addedGroup(row, item) → string` — `row.g` when it is a bill group, else
    the group the kit files the part under (`slotOf(undefined, item)` → group).
  - `addedLines(manual, cat) → line[]` — `{ g, item, qty, so, manual: true, slot }`
    per row; unknown sku or qty ≤ 0 dropped.
  - `addedQty(manual, g, sku, cat) → number`.
  - `setAddedQty(manual, g, sku, n, cat) → manual` — rows key on group + sku; 0
    removes; the row keeps its place; the written row always carries `g`.
  - `ADD_PARTS: { [group]: { key, label, hit?, stepped? }[] }`;
    `addParts(g, cat, { linear = true }) → part[]` (a part with nothing to add
    hides; the whole-drain part only when `linear`); `addPartOf(g, item) → part|null`.
  - `addRollOptions("membrane"|"band", choice, cat, { source }) → { widths, rolls, choice, item }`
    — no Auto chip; `choice` always names a roll; `item` is the roll it adds.
  - `drainAddOptions(choice, cat, { source }) → { ...drainOptions, lengths, len, choice, lines }`
    — a Length row of the family's lengths; `choice.len` unset or not made →
    the longest length ≤ it (else the longest); `lines` are the parts one
    drain adds.
  - `buildFromMarker` appends `addedLines(cfg.manual, cat)`;
    `sessionFromRows` takes the marker's added lines (`l.manual`) off each
    total first, so only a kit line's hand-set qty becomes an override.

- [ ] **Step 1: Write the failing tests** — apply to `src/schluter.test.js`:

```diff
diff --git a/src/schluter.test.js b/src/schluter.test.js
index 06a1d7c..ed7aceb 100644
--- a/src/schluter.test.js
+++ b/src/schluter.test.js
@@ -2,7 +2,8 @@ import { test } from "node:test";
 import assert from "node:assert/strict";
 import { FIXTURE_ITEMS } from "./schluterfixture.js";
 import { FINISH_LABEL, ovKey, rowItemEntry, sessionFromRows, classify, catalogOf, coverageOf, trayCandidates, pickRolls, pickFrom, buildKit, buildFromMarker, linesTotal, tierPrice, lineItems, orderCopyLines, entryOpening, openRuns, boardPlan, boardSheets, expandBoardFaces, normBench, benchTrayRoom, slotOf, resolveDrain, drainOptions, pointGrateLabel,
-  resolveMembrane, membraneOptions, resolveBand, bandOptions, bandWidthLabel } from "./schluter.js";
+  resolveMembrane, membraneOptions, resolveBand, bandOptions, bandWidthLabel,
+  addedGroup, addedLines, setAddedQty, addParts, addPartOf, addRollOptions, drainAddOptions } from "./schluter.js";
 import { isSlot } from "./slots.js";
 
 const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
@@ -1359,3 +1360,101 @@ test("resolveBand with no width choice stays on the narrowest width carried, wha
   }
   assert.deepEqual(picks(resolveBand({ width: "185" }, 120, first185, { source: "all" })), [["KEBA100/185", 2]]);
 });
+
+// --- added lines (ticket 158 Phase 1c) ---------------------------------------
+
+const sk = (sku) => CAT.find((i) => i.sku === sku);
+
+test("addedGroup: a row's own g wins; an old row files where the kit bills the part", () => {
+  assert.equal(addedGroup({ sku: "KEBA100/125" }, sk("KEBA100/125")), "Seams");
+  assert.equal(addedGroup({ sku: "KERECK/FI2" }, sk("KERECK/FI2")), "Seams");
+  assert.equal(addedGroup({ sku: "KB1212202440" }, sk("KB1212202440")), "Walls");
+  assert.equal(addedGroup({ sku: "KERDI200/10M" }, sk("KERDI200/10M")), "Walls");
+  assert.equal(addedGroup({ sku: "KB12SN305508A1" }, sk("KB12SN305508A1")), "Extras");
+  assert.equal(addedGroup({ sku: "SLRSETA50W" }, sk("SLRSETA50W")), "Setting");
+  assert.equal(addedGroup({ sku: "KERDIFIX/BW" }, sk("KERDIFIX/BW")), "Setting");
+  assert.equal(addedGroup({ sku: "KD4GRKECS" }, sk("KD4GRKECS")), "Drain");
+  assert.equal(addedGroup({ sku: "KBSC115150970" }, sk("KBSC115150970")), "Curb");
+  assert.equal(addedGroup({ sku: "KB1212202440", g: "Extras" }, sk("KB1212202440")), "Extras", "a board added under Extras stays a bench board");
+  assert.equal(addedGroup({ sku: "KB1212202440", g: "Nowhere" }, sk("KB1212202440")), "Walls", "an unknown g falls back");
+});
+
+test("addedLines: each row is its own manual line with its group's slot", () => {
+  const l = addedLines([{ sku: "KB1212202440", qty: 2, g: "Extras" }, { sku: "KB1212202440", qty: 1 }, { sku: "NOPE", qty: 1 }, { sku: "KEBA100/125", qty: 0 }], CAT);
+  assert.deepEqual(l.map((x) => [x.g, x.item.sku, x.qty, x.slot, x.manual]),
+    [["Extras", "KB1212202440", 2, "bench", true], ["Walls", "KB1212202440", 1, "wallBoard", true]]);
+});
+
+test("buildFromMarker: an added line with a kit line's part stays its own line; the kit line is untouched", () => {
+  const c = cfg({});
+  const kit = buildKit(c, CAT, { source: "all" });
+  const band = kit.lines.find((l) => l.g === "Seams" && l.item.lf);
+  const b = buildFromMarker({ mode: "custom", cfg: { ...c, manual: [{ sku: band.item.sku, qty: 2, g: "Seams" }] } }, CAT);
+  const same = b.lines.filter((l) => l.item.sku === band.item.sku);
+  assert.deepEqual(same.map((l) => [l.g, l.qty, !!l.manual]), [["Seams", band.qty, false], ["Seams", 2, true]]);
+});
+
+test("setAddedQty: rows key on group + sku; 0 removes; order kept", () => {
+  let m = setAddedQty([], "Walls", "KB1212202440", 1, CAT);
+  m = setAddedQty(m, "Extras", "KB1212202440", 2, CAT);
+  m = setAddedQty(m, "Walls", "KB1212202440", 3, CAT);
+  assert.deepEqual(m, [{ sku: "KB1212202440", qty: 3, g: "Walls" }, { sku: "KB1212202440", qty: 2, g: "Extras" }]);
+  assert.deepEqual(setAddedQty(m, "Walls", "KB1212202440", 0, CAT), [{ sku: "KB1212202440", qty: 2, g: "Extras" }]);
+  assert.deepEqual(setAddedQty([{ sku: "KEBA100/125", qty: 1 }], "Seams", "KEBA100/125", 2, CAT), [{ sku: "KEBA100/125", qty: 2, g: "Seams" }], "an old row with no g is the same row");
+});
+
+test("addParts / addPartOf: each group's '+' parts, only those the catalog carries", () => {
+  const keys = (g, c = CAT) => addParts(g, c).map((p) => p.key);
+  assert.deepEqual(keys("Drain"), ["drain", "grate", "body", "flange"]);
+  assert.deepEqual(addParts("Drain", CAT, { linear: false }).map((p) => p.key), ["grate", "body", "flange"], "a point build's Drain + leads with the grate");
+  assert.deepEqual(keys("Walls"), ["board", "membrane", "fastener"]);
+  assert.deepEqual(keys("Seams"), ["band", "corners"]);
+  assert.deepEqual(keys("Extras"), ["niche", "bench", "other"]);
+  assert.deepEqual(keys("Setting"), ["setting"]);
+  assert.deepEqual(keys("Drain", CAT.filter((i) => i.part !== "channel")), ["grate", "flange"], "no channel or body — no Drain or Body part");
+  assert.equal(addPartOf("Walls", sk("KB1212202440")).key, "board");
+  assert.equal(addPartOf("Extras", sk("KB1212202440")).key, "bench");
+  assert.equal(addPartOf("Seams", sk("KEBA100/125")).key, "band");
+  assert.equal(addPartOf("Walls", sk("KERDI200/10M")).key, "membrane");
+  assert.equal(addPartOf("Drain", sk("KLVRID3EB244")).key, "body");
+});
+
+test("addRollOptions: Width → Roll with no Auto; a width alone lands on its first roll", () => {
+  const o = addRollOptions("band", {}, CAT, { source: "all" });
+  assert.ok(!o.rolls.some((r) => r.key === "auto"));
+  assert.ok(o.choice.roll, "the draft always names a roll");
+  assert.equal(o.item.roll, o.choice.roll);
+  const pinned = addRollOptions("band", { width: o.item.width, roll: "10M" }, CAT, { source: "all" });
+  assert.equal(pinned.item.sku, "KEBA100/125/10M");
+  assert.ok(pinned.rolls.find((r) => r.key === "10M").on);
+  const mem = addRollOptions("membrane", { wide: true }, CAT, { source: "all" });
+  assert.equal(mem.item.wide, true);
+  assert.ok(!mem.rolls.some((r) => r.key === "auto"));
+});
+
+test("drainAddOptions: a Length row in place of the pan fit; the lines are what one drain adds", () => {
+  const v = drainAddOptions({ family: "vario" }, KLCAT, { source: "all" });
+  assert.deepEqual(v.lengths.map((l) => l.key), [...new Set(KLCAT.filter((i) => i.g === "drain" && i.part === "channel" && i.len).map((i) => i.len))].sort((a, b) => a - b).map(String));
+  assert.equal(v.len, v.lengths[v.lengths.length - 1].key * 1, "unset length = the longest");
+  assert.deepEqual(v.lines.map((l) => l.slot), ["drainBody", "flange"]);
+  const f = drainAddOptions({ family: "fixed", len: 48 }, KLCAT, { source: "all" });
+  assert.equal(f.len, 48);
+  assert.deepEqual(f.lines.map((l) => [l.slot, l.item.len]), [["drainBody", 48], ["grate", 48]]);
+  assert.ok(f.lengths.find((l) => l.key === "48").on);
+  const down = drainAddOptions({ family: "fixed", len: 50 }, KLCAT, { source: "all" });
+  assert.equal(down.len, 48, "a length the family isn't made at steps down");
+});
+
+test("sessionFromRows: the marker's added lines come off each total — a placed added line is never an override or a second extra", () => {
+  const c = cfg({});
+  const kit = buildKit(c, CAT, { source: "all" });
+  const band = kit.lines.find((l) => l.g === "Seams" && l.item.lf);
+  const manual = [{ sku: band.item.sku, qty: 2, g: "Seams" }, { sku: "KB12SN305508A1", qty: 1, g: "Extras" }];
+  const b = buildFromMarker({ mode: "custom", cfg: { ...c, manual } }, CAT);
+  const bill = b.lines.filter((l) => !l.noteOnly);
+  const rows = lineItems({ ...b, cfg: { ...c, manual } }, {});
+  assert.deepEqual(sessionFromRows(bill, rows, CAT), { qtyOv: {}, manual: [] });
+  // the sheet took one more band on the kit's line: only the kit line overrides
+  const bumped = rows.map((r, i) => (i === bill.findIndex((l) => l.item.sku === band.item.sku && !l.manual) ? { ...r, qty: String(band.qty + 1) } : r));
+  assert.deepEqual(sessionFromRows(bill, bumped, CAT), { qtyOv: { [ovKey(band)]: band.qty + 1 }, manual: [] });
+});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test src/schluter.test.js`
Expected: FAIL — `addedGroup` (and the other new names) are not exported.

- [ ] **Step 3: Implement** — apply to `src/schluter.js`:

```diff
diff --git a/src/schluter.js b/src/schluter.js
index d9d57ab..c534349 100644
--- a/src/schluter.js
+++ b/src/schluter.js
@@ -850,6 +850,97 @@ export function slotOf(g, i) {
   return G_SLOT[g] || "extra";
 }
 
+// ---------------------------------------------------------------------------
+// Added lines (ticket 158 Phase 1c): cfg.manual rows { sku, qty, g? } are
+// parts with a hand-set qty — never a choice, so they don't re-fit the room.
+// A row draws under its own bill group; an old row with no `g` files where
+// the kit would bill that part.
+
+export const BILL_GROUPS = ["Base", "Drain", "Walls", "Seams", "Curb", "Setting", "Extras"];
+const SLOT_G = {
+  tray: "Base", drainBody: "Drain", grate: "Drain", flange: "Drain", wallBoard: "Walls", wallMembrane: "Walls",
+  seam: "Seams", corners: "Seams", curb: "Curb", setting: "Setting", niche: "Extras", bench: "Extras", extra: "Extras",
+};
+
+/** The bill group an added row draws under: its own `g`, else where the kit files the part. */
+export const addedGroup = (row, item) => (BILL_GROUPS.includes(row && row.g) ? row.g : SLOT_G[slotOf(undefined, item)] || "Extras");
+
+/** cfg.manual → bill lines, each flagged `manual` (the popup's "added" tag). */
+export function addedLines(manual, cat) {
+  const out = [];
+  for (const m of manual || []) {
+    const e = m && cat.find((i) => i.sku === m.sku);
+    if (!e || !(m.qty > 0)) continue;
+    const g = addedGroup(m, e);
+    out.push({ g, item: e, qty: m.qty, so: !e.stock, manual: true, slot: slotOf(g, e) });
+  }
+  return out;
+}
+
+/** The qty of the added row for `sku` under group `g` (0 when there is none). */
+export function addedQty(manual, g, sku, cat) {
+  const e = cat.find((i) => i.sku === sku);
+  const m = (manual || []).find((r) => r.sku === sku && addedGroup(r, e) === g);
+  return m ? m.qty : 0;
+}
+
+/** An added row's qty set to `n` (0 removes it); rows are keyed by group + sku. */
+export function setAddedQty(manual, g, sku, n, cat) {
+  const e = cat.find((i) => i.sku === sku);
+  const same = (m) => m.sku === sku && addedGroup(m, e) === g;
+  const rest = (manual || []).filter((m) => !same(m));
+  const at = (manual || []).findIndex(same);
+  if (!(n > 0)) return rest;
+  const row = { sku, qty: n, g };
+  if (at < 0) return [...rest, row];
+  return [...rest.slice(0, at), row, ...rest.slice(at)];
+}
+
+// What a "+" on each bill group can add (Phase 1c). A stepped part opens the
+// swap popover's rows without Auto; the rest are one-click lists.
+const benchBoard = (i) => i.g === "board" && !i.fastener;
+export const ADD_PARTS = {
+  Base: [{ key: "tray", label: "Tray", hit: (i) => i.g === "tray" }, { key: "membrane", label: "Membrane", hit: (i) => i.g === "membrane" }],
+  Drain: [
+    { key: "drain", label: "Drain", stepped: "drain" },
+    { key: "grate", label: "Grate", hit: (i) => i.part === "grate" || i.part === "cover" },
+    { key: "body", label: "Body", hit: (i) => i.part === "channel" || i.part === "body" },
+    { key: "flange", label: "Flange", hit: (i) => i.part === "flange" },
+  ],
+  Walls: [
+    { key: "board", label: "Board", hit: benchBoard },
+    { key: "membrane", label: "Membrane", stepped: "membrane", hit: (i) => i.g === "membrane" },
+    { key: "fastener", label: "Fasteners", hit: (i) => !!i.fastener },
+  ],
+  Seams: [
+    { key: "band", label: "Band", stepped: "band", hit: (i) => i.g === "seam" && !!i.lf },
+    { key: "corners", label: "Corners & seals", hit: (i) => i.g === "seam" && !i.lf },
+  ],
+  Curb: [{ key: "curb", label: "Curb", hit: (i) => i.g === "curb" }],
+  Setting: [{ key: "setting", label: "Setting", hit: (i) => i.g === "set" }],
+  Extras: [
+    { key: "niche", label: "Niche", hit: (i) => i.extra === "niche" },
+    { key: "bench", label: "Bench", hit: (i) => i.extra === "bench" || i.extra === "benchkit" || benchBoard(i) },
+    { key: "other", label: "Other", hit: (i) => (i.g === "extra" && !["niche", "bench", "benchkit"].includes(i.extra)) || i.g === "kit" },
+  ],
+};
+
+const DRAIN_ADD = (i) => (i.g === "drain" && i.part === "channel" && i.len) || (i.g === "line" && i.part === "body");
+
+/**
+ * The "+" parts a group offers with this catalog — a part with nothing to add
+ * never shows. A whole drain is a linear build's add (`linear`); a point
+ * build's Drain "+" leads with the grate.
+ */
+export function addParts(g, cat, { linear = true } = {}) {
+  return (ADD_PARTS[g] || []).filter((p) => (p.stepped === "drain" ? linear && cat.some(DRAIN_ADD)
+    : p.stepped === "band" ? cat.some((i) => i.g === "seam" && i.lf)
+      : cat.some(p.hit)));
+}
+
+/** The part an added line's ⇄ swaps within: the first of its group's parts whose rule matches it. */
+export const addPartOf = (g, item) => (ADD_PARTS[g] || []).find((p) => p.hit && p.hit(item)) || null;
+
 export const VARIO_DESIGN = { 3: "Square", 5: "Floral", 13: "Herringbone", 14: "Slant" };
 const cheapestFirst = (list) => list.slice().sort((a, b) => a.len - b.len || a.price - b.price);
 
@@ -1107,6 +1198,43 @@ export function bandOptions(choice, lfNeed, cat, { source } = {}) {
   return { widths, rolls, result };
 }
 
+/**
+ * A "+" on a membrane or band (Phase 1c): the swap popover's Width → Roll rows
+ * without Auto — an added line is a real roll, not a re-fitting choice. A
+ * draft with no roll (a width chip's `next`) lands on that width's first roll
+ * that resolves; `item` is the roll it adds.
+ */
+export function addRollOptions(kind, choice, cat, { source } = {}) {
+  const opts = kind === "membrane" ? membraneOptions : bandOptions;
+  let c = choice && typeof choice === "object" ? choice : {};
+  let o = opts(c, 1, cat, { source });
+  if (!c.roll || o.result.subst) {
+    const first = o.rolls.find((r) => r.key !== "auto" && r.ok) || o.rolls.find((r) => r.key !== "auto");
+    if (first) { c = first.next; o = opts(c, 1, cat, { source }); }
+  }
+  return { widths: o.widths, rolls: o.rolls.filter((r) => r.key !== "auto"), choice: c, item: o.result.lines[0] ? o.result.lines[0].item : null };
+}
+
+/**
+ * A "+" on the Drain group of a linear build (Phase 1c): the drain popover's
+ * rows plus a Length row of the lengths the family comes in, in place of
+ * fitting the pan. `choice.len` picks the length (the longest when unset or
+ * not made); `lines` are the parts it adds, each qty 1 per drain.
+ */
+export function drainAddOptions(choice, cat, { source } = {}) {
+  const c = { family: "vario", ...(choice && typeof choice === "object" ? choice : {}) };
+  const lensOf = (ch) => (ch.family === "vario"
+    ? cat.filter((i) => i.g === "drain" && i.part === "channel" && i.len).map((i) => i.len)
+    : cat.filter((i) => i.g === "line" && i.part === "body" && !!i.offset === !!ch.offset).map((i) => i.len));
+  const lens = [...new Set(lensOf(c))].sort((a, b) => a - b);
+  const len = lens.includes(c.len) ? c.len : lens.filter((L) => !(c.len > 0) || L <= c.len).slice(-1)[0] || lens[lens.length - 1] || 0;
+  const at = { ...c, len };
+  const o = drainOptions(at, len, cat, { source });
+  const works = (ch) => { const r = resolveDrain(ch, ch.len, cat, { source }); return !r.fallback && !r.subst; };
+  const lengths = lens.map((L) => ({ key: String(L), label: L + '"', ok: works({ ...at, len: L }), on: L === len, next: { ...at, len: L } }));
+  return { ...o, lengths, len, choice: at, lines: o.result.lines };
+}
+
 /** A point grate's chip label — size, design and finish ("4″ floral, brushed"), not the row's "kit 4" floral brushed SS". */
 export function pointGrateLabel(e) {
   const s = String((e && e.name) || "").replace(/^schluter\s+(?:—\s*)?/i, "").replace(/^kerdi-drain\s+/i, "")
@@ -1277,10 +1405,7 @@ export function buildFromMarker(marker, cat) {
   const pick = (cfg.pick && cands.find((c) => c.tray && c.tray.sku === cfg.pick)) || cands[0] || null;
   if (!pick) return null;
   const b = buildKit(cfg, cat, { source, pick });
-  (cfg.manual || []).forEach((m) => {
-    const e = cat.find((i) => i.sku === m.sku);
-    if (e && m.qty > 0) b.lines.push({ g: "Extras", item: e, qty: m.qty, so: !e.stock, manual: true, slot: slotOf("Extras", e) });
-  });
+  b.lines.push(...addedLines(cfg.manual, cat));
   return { ...b, pick };
 }
 
@@ -1399,7 +1524,9 @@ export function rowItemEntry(row, cat) {
 // takes that total as its override (ovKey), a line with no row left steps to
 // 0, and a row the build doesn't produce is a manual extra { sku, qty }. A
 // blank qty is "not said". When no row resolves the session stays empty
-// rather than zeroing the kit.
+// rather than zeroing the kit. The marker's own added lines (`manual`) are
+// taken off each total first, so only a kit line's hand-set qty becomes an
+// override and a placed added line never bills twice (Phase 1c).
 export function sessionFromRows(lines, rows, cat) {
   const qtyOv = {}, manual = [];
   const totals = new Map(), present = new Set();
@@ -1411,18 +1538,21 @@ export function sessionFromRows(lines, rows, cat) {
     totals.set(e.sku, (totals.get(e.sku) || 0) + (Number(r.qty) || 0));
   }
   if (!present.size) return { qtyOv, manual };
-  const want = new Map();
+  const want = new Map(), added = new Map();
   for (const l of lines || []) {
     if (l.noteOnly || !l.item) continue;
     const sku = l.item.sku;
+    if (l.manual) { added.set(sku, (added.get(sku) || 0) + l.qty); continue; }
     if (!want.has(sku)) want.set(sku, { qty: 0, line: l });
     want.get(sku).qty += l.qty;
   }
   for (const [sku, w] of want) {
-    const have = totals.has(sku) ? totals.get(sku) : present.has(sku) ? null : 0;
+    const raw = totals.has(sku) ? totals.get(sku) : present.has(sku) ? null : 0;
+    const have = raw == null ? null : Math.max(0, raw - (added.get(sku) || 0));
     if (have == null || have === w.qty) continue;
     qtyOv[ovKey(w.line)] = have;
   }
+  for (const [sku, q] of added) if (!want.has(sku) && totals.has(sku)) totals.set(sku, Math.max(0, totals.get(sku) - q));
   for (const [sku, q] of totals) if (!want.has(sku) && q > 0) manual.push({ sku, qty: q });
   return { qtyOv, manual };
 }
```

- [ ] **Step 4: Run the tests**

Run: `node --test src/schluter.test.js` → `# fail 0`.
Run: `npm test` → `# fail 0`; `src/addedgolden.test.js` still green,
untouched. Run: `npx eslint src/schluter.js src/schluter.test.js` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/schluter.js src/schluter.test.js
git commit -m "Schluter engine: added lines by group, + parts, stepped + options (1c)"
```

---

### Task 3: wedi engine — added rows in the marker, addons translate, "+" parts and options; tile sf

**Files:**
- Modify: `src/wedi.js`, `src/showersf.js`
- Test: `src/wedi.test.js`, `src/showersf.test.js`

**Interfaces:**
- Consumes: `item`, `group`, `catalog`, `push`, `curbOptions`, `FINISHES`,
  `byStockThenPrice`, `SKU` (existing, module-internal where noted).
- Produces (exported from `src/wedi.js`):
  - `WEDI_BUCKETS`, `wediBucketOf(item) → bucket` — the popup's old
    `BUCKET_OF` / `bucketOf`, moved here verbatim.
  - `addedRows(src) → { key, qty, group }[]` — `src.addons` (old markers: one
    row per key in the `"addon"` bucket, a key listed twice = qty 2) then
    `src.manual` (a row's `group` when it is a bucket, else `wediBucketOf`);
    same key + bucket merge; unknown key or qty ≤ 0 dropped.
  - `setAddedRow(manual, group, key, n) → manual` — rows key on bucket + key.
  - `WEDI_ADD_PARTS`, `wediAddParts(bucket)`, `wediAddPartOf(bucket, item)`.
  - `curbAddOptions(pick) → { styles, profiles, lengths, choice, item }` — no
    Auto, no No curb; a style not made at the drafted length lands its longest.
  - `coverAddOptions(key) → { cur, sizes, styles, finishes }` — Size (point +
    each linear length) → Style (linear) → Finish; each chip's `next` a cover
    key, stocked first, the drafted finish kept across a size change.
  - `kitFor(pan, opts)`: bills `addedRows(opts)` (so `opts.manual` and legacy
    `opts.addons`) as `{ group: row.group, auto: false, added: true }` lines
    at the old add-on position (before the hints, so an added gun clears
    `sausage-gun`); `cfg.manual` written only when non-empty; **`cfg.addons`
    never written**.
  - `buildFromMarker(marker)` passes `manual: addedRows(cfg)`.
  - `sessionFromRows(lines, rows)` takes `l.added` lines off each total first.
  - `showersf.js` `wediPieces`: niche back = Σ `wediNicheSq(row.key) × row.qty`
    over `addedRows(cfg)`.

- [ ] **Step 1: Write the failing tests** — apply:

```diff
diff --git a/src/showersf.test.js b/src/showersf.test.js
index fcdf810..801ebe1 100644
--- a/src/showersf.test.js
+++ b/src/showersf.test.js
@@ -14,6 +14,11 @@ test("wedi: three walls, curb cap across the entry, one 12×12 niche", () => {
   assert.deepEqual(r.pieces.map((p) => p.piece), ["walls", "floor", "curb", "niche"]);
 });
 
+test("wedi: added niches count × qty — two sizes, one twice (ticket 158 Phase 1c)", () => {
+  const r = wediPieces({ ...base, curbKey: "US3000008", manual: [{ key: "US3000005", qty: 2, group: "addon" }, { key: "US3000004", qty: 1, group: "addon" }] });
+  assert.equal(sf(r).niche, 2.7);
+});
+
 test("wedi: lean curb and a back bench (face into walls, top its own piece, footprint off the floor)", () => {
   assert.deepEqual(sf(wediPieces({ ...base, curbKey: "US3000038", benches: [{ kind: "wall", side: "back", len: 48 }] })),
     { walls: 94, floor: 10.3, curb: 3.8, benchTop: 4.7 });
diff --git a/src/wedi.test.js b/src/wedi.test.js
index 4acc747..3997c5c 100644
--- a/src/wedi.test.js
+++ b/src/wedi.test.js
@@ -1,6 +1,7 @@
 import { test } from "node:test";
 import assert from "node:assert/strict";
 import { rowItemKey, sessionFromRows,
+  addedRows, setAddedRow, wediBucketOf, wediAddParts, wediAddPartOf, curbAddOptions, coverAddOptions,
   catalog, item, group, pans, curbs, kitFor, buildFromMarker, solve, figureConsumables, panelPlan,
   openEdges, openCorners, curbRuns, wallSpans, expandWallFaces, WALL_THICK, panThick, BROWSE_SECTIONS, sectionHit,
   tierPrice, lineItems, factoryKit, linearCoverFor, legacyCoverPick, coverStyles, coverFrames, coverFrameFor, dims, round2, inch,
@@ -1622,3 +1623,95 @@ test("kitFor: a stale or non-panel panelKey falls back to the default panel with
   assert.equal(notAPanel.note.includes(SKU.fastenerKit + " not in the book — default panel used"), true);
   assert.equal("panelKey" in kitFor("US9100004", { panelKey: "NOPE" }).cfg, false, "a stale pick never rides the marker");
 });
+
+// --- added lines (ticket 158 Phase 1c) ---------------------------------------
+
+test("addedRows: old addons translate (a key twice = qty 2, add-on bucket); manual rows keep their bucket", () => {
+  assert.deepEqual(addedRows({ addons: ["US3000004", "US3000004", SKU.gun] }),
+    [{ key: "US3000004", qty: 2, group: "addon" }, { key: SKU.gun, qty: 1, group: "addon" }]);
+  assert.deepEqual(addedRows({ manual: [{ key: "US3000004", qty: 1, group: "addon" }, { key: SKU.panelDefault, qty: 2 }, { key: "NOPE", qty: 1 }, { key: "US3000005", qty: 0 }] }),
+    [{ key: "US3000004", qty: 1, group: "addon" }, { key: SKU.panelDefault, qty: 2, group: "walls" }]);
+  assert.deepEqual(addedRows({ manual: [{ key: "US3000002", qty: 1, group: "bench" }] }), [{ key: "US3000002", qty: 1, group: "bench" }], "a seat added under Bench stays there");
+  assert.deepEqual(addedRows({}), []);
+  assert.equal(wediBucketOf(item(SKU.panelDefault)), "walls");
+  assert.equal(wediBucketOf(item("US3000004")), "addon");
+});
+
+test("kitFor: added rows bill as their own un-auto lines; a kit part added again never merges; the marker writes manual, not addons", () => {
+  const plain = kitFor("US9100004");
+  const panel = plain.lines.find((l) => l.item.group === "panel");
+  const k = kitFor("US9100004", { manual: [{ key: panel.item.key, qty: 2, group: "walls" }, { key: "US3000004", qty: 2, group: "addon" }] });
+  const same = k.lines.filter((l) => l.item.key === panel.item.key);
+  assert.deepEqual(same.map((l) => [l.group, l.qty, l.auto, !!l.added]), [["walls", panel.qty, true, false], ["walls", 2, false, true]]);
+  assert.deepEqual(k.lines.filter((l) => l.item.key === "US3000004").map((l) => [l.group, l.qty, l.slot]), [["addon", 2, "niche"]]);
+  assert.deepEqual(k.cfg.manual, [{ key: panel.item.key, qty: 2, group: "walls" }, { key: "US3000004", qty: 2, group: "addon" }]);
+  assert.equal(k.cfg.addons, undefined);
+  assert.equal(plain.cfg.manual, undefined, "no added rows — no manual key");
+  assert.deepEqual(kitFor("US9100004", { addons: ["US3000004", "US3000004"] }).cfg.manual, [{ key: "US3000004", qty: 2, group: "addon" }], "old addons re-save as rows");
+});
+
+test("kitFor: an added sealant gun clears the sausage-gun hint", () => {
+  assert.ok(kitFor("US9100004", { sealantForm: "sausage" }).hints.includes("sausage-gun"));
+  assert.ok(!kitFor("US9100004", { sealantForm: "sausage", manual: [{ key: SKU.gun, qty: 1, group: "install" }] }).hints.includes("sausage-gun"));
+});
+
+test("buildFromMarker: added rows round-trip — same lines, same bill", () => {
+  const k = kitFor("US9100004", { manual: [{ key: "US3000004", qty: 1, group: "addon" }, { key: "US3000248", qty: 2, group: "addon" }] });
+  const back = buildFromMarker({ mode: "kit", cfg: k.cfg });
+  assert.deepEqual(back.lines.map((l) => l.item.key + "×" + l.qty + "@" + l.group), k.lines.map((l) => l.item.key + "×" + l.qty + "@" + l.group));
+  assert.deepEqual(back.cfg.manual, k.cfg.manual);
+});
+
+test("setAddedRow: rows key on bucket + key; 0 removes; order kept", () => {
+  let m = setAddedRow([], "addon", "US3000004", 1);
+  m = setAddedRow(m, "addon", "US3000248", 1);
+  m = setAddedRow(m, "addon", "US3000004", 3);
+  assert.deepEqual(m, [{ key: "US3000004", qty: 3, group: "addon" }, { key: "US3000248", qty: 1, group: "addon" }]);
+  assert.deepEqual(setAddedRow(m, "addon", "US3000004", 0), [{ key: "US3000248", qty: 1, group: "addon" }]);
+  assert.deepEqual(setAddedRow([{ key: SKU.panelDefault, qty: 1 }], "walls", SKU.panelDefault, 2), [{ key: SKU.panelDefault, qty: 2, group: "walls" }], "a groupless row is its default bucket's row");
+});
+
+test("wediAddParts / wediAddPartOf: each bucket's '+' parts", () => {
+  const keys = (b) => wediAddParts(b).map((p) => p.key);
+  assert.deepEqual(keys("walls"), ["panel"]);
+  assert.deepEqual(keys("drain"), ["cover", "frame", "drainKit"].filter((k) => k !== "drainKit" || group("drainKit").length));
+  assert.ok(keys("addon").includes("niche") && keys("addon").includes("shelf"));
+  assert.ok(keys("floor").includes("curb"));
+  assert.equal(wediAddPartOf("addon", item("US3000004")).key, "niche");
+  assert.equal(wediAddPartOf("bench", item("US3000002")).key, "bench");
+  assert.equal(wediAddPartOf("floor", item(SKU.curbLean60)).key, "curb");
+});
+
+test("curbAddOptions: Style → Profile → Length with no Auto or No curb; the piece is one at a real length", () => {
+  const o = curbAddOptions();
+  assert.deepEqual(o.choice, { sub: "lean", len: 60 });
+  assert.equal(o.item.key, SKU.curbLean60);
+  assert.ok(!o.lengths.some((c) => c.key === "auto") && !o.styles.some((c) => c.key === "none"));
+  assert.ok(o.styles.every((c) => c.next.len === 60), "a style chip keeps the drafted length");
+  assert.equal(curbAddOptions({ sub: "lean", len: 96 }).item.len, 96);
+  const at = curbAddOptions({ sub: "at", len: 96 });
+  assert.equal(at.choice.len, 60, "AT isn't made at 96″ — its longest lands");
+  assert.equal(at.item.len, 60);
+});
+
+test("coverAddOptions: Size → Style → Finish, each chip a cover key", () => {
+  const o = coverAddOptions("US1000085");
+  assert.equal(o.cur.key, "US1000085");
+  assert.ok(o.sizes.find((c) => c.key === "43").on);
+  assert.equal(o.sizes.find((c) => c.key === "27").next, "676797048", "the drafted finish follows a size change, stocked first");
+  assert.equal(o.styles.find((c) => c.key === "tileable").next, "US1000087");
+  assert.ok(o.finishes.every((c) => item(c.next).len === 43));
+  const pt = coverAddOptions();
+  assert.equal(pt.cur.key, SKU.coverSS);
+  assert.equal(pt.styles.length, 0, "a point cover has no style row");
+  assert.ok(pt.finishes.every((c) => item(c.next).sub === "point"));
+});
+
+test("sessionFromRows: a placed kit's added lines come off the totals — never an override or a second extra", () => {
+  const k = kitFor("US9100004", { manual: [{ key: "US3000004", qty: 2, group: "addon" }, { key: SKU.panelDefault, qty: 1, group: "walls" }] });
+  const rows = lineItems(k);
+  assert.deepEqual(sessionFromRows(k.lines, rows), { qtyOv: {}, manual: [] });
+  const panel = k.lines.find((l) => l.item.key === SKU.panelDefault && !l.added);
+  const bumped = rows.map((r, i) => (k.lines[i] === panel ? { ...r, qty: String(panel.qty + 1) } : r));
+  assert.deepEqual(sessionFromRows(k.lines, bumped), { qtyOv: { [SKU.panelDefault]: panel.qty + 1 }, manual: [] });
+});
```

- [ ] **Step 2: Run them to see them fail**

Run: `node --test src/wedi.test.js src/showersf.test.js`
Expected: FAIL — `addedRows` (and the other new names) are not exported.

- [ ] **Step 3: Implement** — apply:

```diff
diff --git a/src/showersf.js b/src/showersf.js
index 0d4ec87..abdfda3 100644
--- a/src/showersf.js
+++ b/src/showersf.js
@@ -3,7 +3,7 @@
 // only usejobshowers.js may load it, via import().
 // Known limitation: wedi sizes come from whichever catalog is installed — the
 // transcribed fallback until a wedi popup installs the live book this session.
-import { item, normBench, curbRuns, curbWidth, curbInsets, expandWallFaces, panRoomDims, markerCurbKey } from "./wedi.js";
+import { item, normBench, curbRuns, curbWidth, curbInsets, expandWallFaces, panRoomDims, markerCurbKey, addedRows } from "./wedi.js";
 import { classify, cfgBenches, wallArea } from "./schluter.js";
 import { schluterCurb } from "./schluterdraw.js";
 import { curbHeight, benchFootprint } from "./showerdraw.js";
@@ -101,9 +101,9 @@ export function wediPieces(cfg) {
   const curb = !curbKey ? 0
     : c ? curbRuns(room, walls, cfg.corners, benches).openLen * (curbWidth(c) + 2 * curbHeight(c)) : null;
   let niche = 0;
-  for (const a of cfg.addons || []) {
-    const s = wediNicheSq(typeof a === "string" ? a : a && a.key);
-    niche = niche === null || s === null ? null : niche + s;
+  for (const r of addedRows(cfg)) {
+    const s = wediNicheSq(r.key);
+    niche = niche === null || s === null ? null : niche + s * r.qty;
   }
   return {
     w: room.w, d: room.d, curbed: !!curbKey,
diff --git a/src/wedi.js b/src/wedi.js
index 26261ff..6d91bca 100644
--- a/src/wedi.js
+++ b/src/wedi.js
@@ -5052,6 +5052,37 @@ export function coverStyles(len) {
   return out;
 }
 
+/**
+ * A "+" on a drain cover (Phase 1c): Size (the point covers, each linear
+ * length) → Style (linear) → Finish, drafted as a cover key. Each chip's
+ * `next` is the cover it lands on — stocked first, then the cheapest, and the
+ * drafted finish kept across a size or style change when it's made there.
+ */
+export function coverAddOptions(key) {
+  const covers = group("cover");
+  const cur = (key && covers.find((c) => c.key === key)) || item(SKU.coverSS) || covers[0] || null;
+  if (!cur) return { cur: null, sizes: [], styles: [], finishes: [] };
+  const best = (l) => l.slice().sort(byStockThenPrice)[0] || null;
+  const sizeOf = (c) => (c.sub === "linear" ? String(c.len) : "point");
+  const styleOf = (c) => (c.finish === "T" ? "tileable" : /P$/.test(c.finish) ? "perforated" : "solid");
+  const chip = (k, label, c, on) => ({ key: k, label, ok: !!c, so: !!c && !c.stock, on, next: c ? c.key : null });
+  const sizes = [...new Set(covers.map(sizeOf))].sort((a, b) => (a === "point" ? -1 : b === "point" ? 1 : a - b)).map((z) => {
+    const l = covers.filter((c) => sizeOf(c) === z);
+    return chip(z, z === "point" ? "4×4 point" : z + '"', best(l.filter((c) => c.finish === cur.finish)) || best(l), z === sizeOf(cur));
+  });
+  const inSize = covers.filter((c) => sizeOf(c) === sizeOf(cur));
+  const lin = cur.sub === "linear";
+  const styles = lin ? ["solid", "perforated", "tileable"].map((st) => {
+    const l = inSize.filter((c) => styleOf(c) === st);
+    return chip(st, st[0].toUpperCase() + st.slice(1), best(l), st === styleOf(cur));
+  }) : [];
+  const inStyle = lin ? inSize.filter((c) => styleOf(c) === styleOf(cur)) : inSize;
+  const finishes = lin
+    ? [...new Set(inStyle.map((c) => c.finish))].map((f) => chip(f, FINISHES[f] || f, best(inStyle.filter((c) => c.finish === f)), f === cur.finish))
+    : inStyle.slice().sort(byStockThenPrice).map((c) => chip(c.key, FINISHES[c.finish] || c.finish || c.name, c, c.key === cur.key));
+  return { cur, sizes, styles, finishes };
+}
+
 /** Whether a saved coverPick bills on this pan — a point `{ key }` on a linear pan, or a `{ finish }` on a point pan, is kept but inert. */
 export function coverPickApplies(pick, panKey) {
   const pan = typeof panKey === "string" ? item(panKey) : panKey;
@@ -5187,6 +5218,26 @@ export function curbOptions(pick, openLen, fam) {
   return { styles, profiles, lengths, result, recipe: curbIsRecipe(pick, fam) };
 }
 
+/**
+ * A "+" on a curb (Phase 1c): the curb popover's rows without Auto or No curb —
+ * an added curb is one piece at a real length. A style not made at the
+ * drafted length lands on its longest; `item` is the piece it adds.
+ */
+export function curbAddOptions(pick) {
+  const all = group("curb").filter((c) => c.len);
+  let p = { sub: "lean", ...(pick && !pick.none ? pick : {}) };
+  if (!p.len) p = { ...p, len: Math.min(...all.filter((c) => c.sub === p.sub).map((c) => c.len)) || 60 };
+  let o = curbOptions(p, p.len, "fundo");
+  if (o.result.item && o.result.item.len !== p.len) { p = { ...p, len: o.result.item.len }; o = curbOptions(p, p.len, "fundo"); }
+  const withLen = (c) => ({ ...c, next: { ...c.next, len: p.len } });
+  return {
+    styles: o.styles.filter((c) => c.key !== "none").map(withLen),
+    profiles: o.profiles.map(withLen),
+    lengths: o.lengths.filter((c) => c.key !== "auto"),
+    choice: p, item: o.result.item,
+  };
+}
+
 /** The curb a saved marker bills (tile sf reads it): a legacy curbKey as saved, else the choice resolved at the marker's own opening. */
 export function markerCurbKey(cfg) {
   const pan = cfg && cfg.panKey ? item(cfg.panKey) : null;
@@ -5275,6 +5326,93 @@ const WEDI_SLOT = {
   niche: "niche", shelf: "niche", seat: "bench", bench: "bench",
 };
 
+// The popup's bill buckets, by catalog group; anything unlisted (niches,
+// seats, benches, shelves, …) is an add-on.
+const BUCKET_OF = {
+  pan: "floor", module: "floor", modExt: "floor", extension: "floor", cornerExt: "floor", ramp: "floor",
+  curb: "floor", kit: "floor", panel: "walls", cover: "drain", coverFrame: "drain", drainKit: "drain",
+  recess: "install", fastener: "install", sealant: "install", tool: "install", collar: "install", subliner: "install",
+};
+export const WEDI_BUCKETS = ["floor", "walls", "bench", "drain", "install", "addon"];
+/** The bill bucket a part files under when the kit bills it. */
+export const wediBucketOf = (e) => BUCKET_OF[e && e.group] || "addon";
+
+// ---------------------------------------------------------------------------
+// Added lines (ticket 158 Phase 1c): cfg.manual rows { key, qty, group? } are
+// parts with a hand-set qty, each its own line — never merged into a kit line
+// and never a re-fitting choice. Old markers' `addons` keys read as rows in
+// the add-on bucket (a key saved twice is qty 2); nothing writes `addons` now.
+
+const addedBucket = (row, it) => (WEDI_BUCKETS.includes(row && row.group) ? row.group : wediBucketOf(it));
+
+/** A marker's (or kitFor opts') added rows: `manual`, plus any old `addons` translated. */
+export function addedRows(src) {
+  const out = [];
+  const put = (key, qty, grp) => {
+    const it = key ? item(key) : null;
+    if (!it || !(qty > 0)) return;
+    const group = addedBucket({ group: grp }, it);
+    const hit = out.find((r) => r.key === key && r.group === group);
+    if (hit) hit.qty += qty; else out.push({ key, qty, group });
+  };
+  (src && src.addons || []).forEach((a) => put(typeof a === "string" ? a : a && a.key, (a && a.qty) || 1, "addon"));
+  (src && src.manual || []).forEach((m) => m && put(m.key, +m.qty || 0, m.group));
+  return out;
+}
+
+/** An added row's qty set to `n` (0 removes it); rows key on bucket + key. */
+export function setAddedRow(manual, group, key, n) {
+  const same = (m) => m.key === key && addedBucket(m, item(key)) === group;
+  const rest = (manual || []).filter((m) => !same(m));
+  const at = (manual || []).findIndex(same);
+  if (!(n > 0)) return rest;
+  const row = { key, qty: n, group };
+  return at < 0 ? [...rest, row] : [...rest.slice(0, at), row, ...rest.slice(at)];
+}
+
+// What a "+" on each bucket can add (Phase 1c). A stepped part opens the swap
+// popover's rows without Auto; the rest are one-click lists.
+const ADDON_KINDS = ["niche", "shelf", "seat", "bench"];
+export const WEDI_ADD_PARTS = {
+  floor: [
+    { key: "pan", label: "Pan", hit: (i) => ["pan", "module", "kit"].includes(i.group) },
+    { key: "ext", label: "Extension", hit: (i) => ["extension", "modExt", "cornerExt"].includes(i.group) },
+    { key: "curb", label: "Curb", stepped: "curb", hit: (i) => i.group === "curb" && !!i.len },
+    { key: "ramp", label: "Ramp", hit: (i) => i.group === "ramp" },
+  ],
+  walls: [{ key: "panel", label: "Panel", stepped: "panel", hit: (i) => i.group === "panel" && i.sf > 0 }],
+  bench: [
+    { key: "bench", label: "Seat & bench", hit: (i) => i.group === "seat" || i.group === "bench" },
+    { key: "panel", label: "Panel", stepped: "panel", hit: (i) => i.group === "panel" && i.sf > 0 },
+  ],
+  drain: [
+    { key: "cover", label: "Cover", stepped: "cover", hit: (i) => i.group === "cover" },
+    { key: "frame", label: "Frame", hit: (i) => i.group === "coverFrame" },
+    { key: "drainKit", label: "Drain kit", hit: (i) => i.group === "drainKit" },
+  ],
+  install: [
+    { key: "fastener", label: "Fasteners", hit: (i) => i.group === "fastener" },
+    { key: "sealant", label: "Sealant", hit: (i) => i.group === "sealant" },
+    { key: "membrane", label: "Membrane & tape", hit: (i) => i.group === "subliner" || i.group === "sdry" },
+    { key: "collar", label: "Collars & seals", hit: (i) => i.group === "collar" },
+    { key: "tool", label: "Tools", hit: (i) => i.group === "tool" },
+    { key: "recess", label: "Recess kit", hit: (i) => i.group === "recess" },
+  ],
+  addon: [
+    { key: "niche", label: "Niche", hit: (i) => i.group === "niche" },
+    { key: "shelf", label: "Glass shelf", hit: (i) => i.group === "shelf" },
+    { key: "seat", label: "Seat", hit: (i) => i.group === "seat" },
+    { key: "bench", label: "Bench", hit: (i) => i.group === "bench" },
+    { key: "other", label: "Other", hit: (i) => wediBucketOf(i) === "addon" && !ADDON_KINDS.includes(i.group) },
+  ],
+};
+
+/** The "+" parts a bucket offers with this book — a part with nothing to add never shows. */
+export const wediAddParts = (bucket) => (WEDI_ADD_PARTS[bucket] || []).filter((p) => catalog().some(p.hit));
+
+/** The part an added line's ⇄ swaps within: the first of its bucket's parts whose rule matches it. */
+export const wediAddPartOf = (bucket, it) => (WEDI_ADD_PARTS[bucket] || []).find((p) => p.hit(it)) || null;
+
 /** The shared slot (slots.js) a kitFor line fills. */
 export function wediSlotOf(line) {
   const it = (line && line.item) || {};
@@ -5436,10 +5574,11 @@ export function kitFor(panKey, opts) {
   // flat, not figured by area, mirroring Schluter's ALL-SET line.
   push(lines, SKU.proSet, 1, "install", "sets the pan — 1 bag", true);
 
-  // --- add-ons ---------------------------------------------------------------
-  (opts.addons || []).forEach((a) => {
-    const key = typeof a === "string" ? a : a.key;
-    push(lines, key, (a && a.qty) || 1, "addon", (a && a.note) || "", false);
+  // --- added lines (Phase 1c; old `addons` translate) -------------------------
+  const added = addedRows(opts);
+  added.forEach((r) => {
+    push(lines, r.key, r.qty, r.group, "", false);
+    lines[lines.length - 1].added = true;
   });
 
   const hasGun = lines.some((l) => l.item.key === SKU.gun);
@@ -5467,7 +5606,7 @@ export function kitFor(panKey, opts) {
     ...(coverPick ? { coverPick } : {}),
     coverFrame: frame ? frame.finish : null,
     sealantForm: form, recess: recess,
-    addons: (opts.addons || []).map((a) => (typeof a === "string" ? a : a.key)),
+    ...(added.length ? { manual: added.map((r) => ({ ...r })) } : {}),
     benches: benches.map((b) => ({ ...b })),
     corners: (opts.corners || []).slice(),
     room: room || null, solve: option ? { id: option.id, input: option.input } : null,
@@ -5486,8 +5625,8 @@ export function kitFor(panKey, opts) {
 // ({ mode, cfg } — cfg from kitFor). The drawer's staged and placed kits both
 // price through this, so a kit reads the same before and after it lands. A
 // custom cfg re-runs the solver and re-picks its option by id (the seedState
-// doctrine); qtyOv/manual never rode the cfg, so a rebuilt kit is exactly
-// what Reconfigure restores. Null when the catalog no longer knows the pan.
+// doctrine); added lines ride the cfg (`manual`, old `addons` translated),
+// qtyOv never does. Null when the catalog no longer knows the pan.
 export function buildFromMarker(marker) {
   const cfg = marker && marker.cfg;
   if (!cfg || !cfg.panKey || !item(cfg.panKey)) return null;
@@ -5511,7 +5650,7 @@ export function buildFromMarker(marker) {
     coverPick: cfg.coverPick || legacyCoverPick(cfg.coverKey),
     coverFrame: cfg.coverFrame || undefined,
     sealantForm: cfg.sealantForm, recess: cfg.recess,
-    addons: (cfg.addons || []).slice(), benches: (cfg.benches || []).map((b) => ({ ...b })),
+    manual: addedRows(cfg), benches: (cfg.benches || []).map((b) => ({ ...b })),
     corners: (cfg.corners || []).slice(),
     maxIn: !!cfg.maxIn, tileT: cfg.tileT, tier: cfg.tier,
     mode: marker.mode || undefined,
@@ -6272,13 +6411,17 @@ export function sessionFromRows(lines, rows) {
     totals.set(key, (totals.get(key) || 0) + (Number(r.qty) || 0));
   }
   if (!matched) return { qtyOv, manual };
-  const want = new Map(), auto = new Map();
+  // the marker's own added lines come off each total first, so only a kit
+  // line's hand-set qty becomes an override (Phase 1c)
+  const want = new Map(), auto = new Map(), added = new Map();
   for (const l of lines || []) {
     const key = l.item && l.item.key;
     if (!key) continue;
+    if (l.added) { added.set(key, (added.get(key) || 0) + l.qty); continue; }
     want.set(key, (want.get(key) || 0) + l.qty);
     if (l.auto !== false) auto.set(key, true);
   }
+  for (const [key, q] of added) if (totals.has(key)) totals.set(key, Math.max(0, totals.get(key) - q));
   for (const [key, w] of want) {
     const have = totals.has(key) ? totals.get(key) : matchedKeys(rows).has(key) ? null : 0;
     if (have == null || have === w) continue;
```

- [ ] **Step 4: Run the tests**

Run: `node --test src/wedi.test.js src/showersf.test.js src/addedgolden.test.js src/wedimarkergolden.test.js` → `# fail 0`.
Run: `npm test` → `# fail 0` (1743 tests). Both goldens untouched.
Run: `npx eslint src/wedi.js src/showersf.js src/wedi.test.js src/showersf.test.js` → clean.

- [ ] **Step 5: Commit**

```bash
git add src/wedi.js src/showersf.js src/wedi.test.js src/showersf.test.js
git commit -m "wedi engine: added rows ride the marker, addons translate, + parts and options (1c)"
```

---

### Task 4: `SwapPop` — qty stepper, a list as children, optional summary

**Files:**
- Modify: `src/swappop.jsx`

**Interfaces:**
- Produces: `SwapPop` gains `qty`, `onQty(n)` (stepper in the summary strip,
  floor 1, `data-add-qty`), `children` (rendered between the rows and the
  strip), an optional `summary` (no strip when absent), and `add` (marks the
  root `data-add-pop`). Every existing call site is unchanged: no new prop is
  required, and `data-drain-swap` / `data-drain-chip` / `data-drain-use` stay.

- [ ] **Step 1: Implement** — apply to `src/swappop.jsx`:

```diff
diff --git a/src/swappop.jsx b/src/swappop.jsx
index b5238a7..6511f47 100644
--- a/src/swappop.jsx
+++ b/src/swappop.jsx
@@ -1,6 +1,8 @@
 // The stepped swap popover (ticket 158 Phase 1, mockup layout A): rows of
 // chips and a summary strip. Both shower popups mount it for the drain and
-// every stepped line; each owns what a chip means and what Use this commits.
+// every stepped line, and for a group's "+" (Phase 1c: a qty stepper in the
+// strip, a list of parts as children); each owns what a chip means and what
+// Use this commits.
 import { PopMenu } from "./widgets.jsx";
 
 const money = (n) => "$" + (+n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
@@ -18,10 +20,10 @@ export const inchGlyph = (s) => String(s || "")
 // Auto keeps its place ahead of them).
 const stockOrder = (chips) => [...chips].sort((a, b) => (a.so ? 1 : 0) - (b.so ? 1 : 0));
 
-export function SwapPop({ at, className = "", title, rows, summary, onUse, onClose, stockFirst = false }) {
+export function SwapPop({ at, className = "", title, rows, summary, onUse, onClose, stockFirst = false, qty, onQty, children, add = false }) {
   return (
     <PopMenu at={at} width={460} pad={10} z={90} onClose={onClose}>
-      <div className={className + " text-[12px] px-2.5 py-2"} onClick={(e) => e.stopPropagation()} data-drain-swap>
+      <div className={className + " text-[12px] px-2.5 py-2"} onClick={(e) => e.stopPropagation()} data-drain-swap {...(add ? { "data-add-pop": "" } : {})}>
         <div className="font-extrabold text-[13px] mb-2">{title}</div>
         {rows.filter((r) => r.chips.length).map((r) => (
           <div key={r.label} className="flex items-center gap-2 my-1.5 flex-wrap">
@@ -39,14 +41,24 @@ export function SwapPop({ at, className = "", title, rows, summary, onUse, onClo
             ))}
           </div>
         ))}
+        {children}
+        {summary && (
         <div className="mt-2 rounded-lg border border-slate-200 bg-[color:var(--ft-tint)] px-2.5 py-2 flex items-center gap-2 flex-wrap">
           <div className="flex-1 min-w-[200px]">
             <b>{summary.what}</b>
             <span className="block text-[11px] text-slate-500 font-semibold">{summary.why}</span>
           </div>
           <span className={"font-extrabold tabular-nums " + (summary.up ? "text-[color:var(--s-rust,#B4552D)]" : "")}>{summary.delta} · {summary.total}</span>
+          {onQty && (
+            <span className="inline-flex items-center rounded-md border border-slate-300 bg-white" data-add-qty>
+              <button type="button" className="px-2 font-extrabold" onClick={() => onQty(Math.max(1, qty - 1))} title="one less">−</button>
+              <span className="min-w-[18px] text-center font-extrabold tabular-nums">{qty}</span>
+              <button type="button" className="px-2 font-extrabold" onClick={() => onQty(qty + 1)} title="one more">+</button>
+            </span>
+          )}
           <button type="button" onClick={onUse} className="rounded-md bg-[color:var(--ft-brand)] text-white font-extrabold px-3 py-1" data-drain-use>Use this</button>
         </div>
+        )}
       </div>
     </PopMenu>
   );
```

- [ ] **Step 2: Verify**

Run: `npx eslint src/swappop.jsx` → clean. Run: `npm test` → `# fail 0`.
Run: `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build` → built.

- [ ] **Step 3: Commit**

```bash
git add src/swappop.jsx
git commit -m "SwapPop: qty stepper, list children, optional summary (1c)"
```

---

### Task 5: Schluter popup — "+" on every group, added lines tagged, their own ⇄

**Files:**
- Modify: `src/SchluterConfigurator.jsx`
- Create: `.scratch/158_shower-config-roadmap/p1c/shoot-schluter.mjs`

**Interfaces:**
- Consumes: Task 2's exports, Task 4's `SwapPop` props.
- Produces (DOM hooks the proof relies on): `[data-add-group="<Group>"]` on
  each header's "+"; `[data-add-pop]` on the "+" popover;
  `[data-add-row="<sku>"]` on a list row; `[data-add-search]`;
  `[data-added-tag]` on an added line; `[data-added-swapb]` on an added line's
  ⇄ (which also keeps `data-schluter-swapb`).

What the diff does:
- **State:** `add = { g, part, draft, qty, q, replace?, rect, anchor }`.
- **Build:** `b.lines.push(...addedLines(manual, cat))` replaces the inline
  Extras push (so `slotOf` leaves the imports).
- **Steppers:** Browse, the chips and the figurer write the part's own group
  (`browseG` → `addedGroup`); a build-line stepper on an added line writes its
  own row (`addQty(l.g, …)`); a kit line still writes `qtyOv`.
- **Reconfigure:** `sessionFromRows`'s leftovers top up the matching row
  instead of appending a duplicate.
- **Kit ⇄ never opens on an added line:** `swapChoices`, `steppedKind` and
  `drainKind` return null for `l.manual`.
- **`drainRowsFor(o, draft, setDraft, width)`** is `drainPanel`'s row/summary
  builder extracted unchanged except `panW` → `width`, so the drain "+" reuses
  it with its Length row spliced in second.
- **`addDraft` / `openAdd` / `canSwapAdded`** sit above the renders (they are
  called while the build column renders); **`addPanel`** sits before
  `swapPanel` and mounts after it.
- **Headers:** a group with lines or any `addParts` shows, with a "+"
  (`.addb`); the Walls Fit | One size toggle keeps its place.
- **Lines:** `added` tag (`.addtag`) + `kit also bills N` in the meta line;
  the added line's ⇄ opens `addPanel` on its own row.
- **Niche picker:** a row adds another (`✓ ×n`) instead of toggling.
- `clearDesign` / `keepAdded` / `openSwap` close the "+" popover.

- [ ] **Step 1: Implement** — apply to `src/SchluterConfigurator.jsx`:

```diff
diff --git a/src/SchluterConfigurator.jsx b/src/SchluterConfigurator.jsx
index 47eabbf..741d1e5 100644
--- a/src/SchluterConfigurator.jsx
+++ b/src/SchluterConfigurator.jsx
@@ -16,8 +16,9 @@ import { PaneBack, PaneClose } from "./raildrawer.jsx";
 import { TIER_COLOR } from "./uiconst.js";
 import {
   trayCandidates, pickRolls, buildKit, tierPrice, coverageOf, lineItems, orderCopyLines, normBench, benchTrayRoom,
-  boardPlan, expandBoardFaces, wallArea, halfBoardPool, buildFromMarker, ovKey, sessionFromRows, slotOf, drainOptions,
+  boardPlan, expandBoardFaces, wallArea, halfBoardPool, buildFromMarker, ovKey, sessionFromRows, drainOptions,
   resolveDrain, FINISH_LABEL, VARIO_DESIGN, pointGrateLabel, membraneOptions, bandOptions, bandWidthLabel,
+  addedLines, addedGroup, addedQty, setAddedQty, addParts, addPartOf, addRollOptions, drainAddOptions,
 } from "./schluter.js";
 import { SwapPop, fmDelta, inchGlyph } from "./swappop.jsx";
 import { mortarItemFrom, MORTAR_BED_SF_PER_BAG } from "./schluteradapter.js";
@@ -240,6 +241,9 @@ const CSS = `
 .sch-pop .bgroup{margin-top:8px}
 .sch-pop .bg-h{display:flex;align-items:center;gap:7px;font-size:9.5px;font-weight:800;text-transform:uppercase;letter-spacing:.12em;color:var(--ft-muted);padding-bottom:4px;border-bottom:1px solid var(--ft-border-strong)}
 .sch-pop .bg-h .wallctl{margin-left:auto;display:flex;align-items:center;gap:4px;text-transform:none;letter-spacing:0}
+.sch-pop .bg-h .addb{margin-left:auto;flex:none;border:1px solid var(--ft-border);background:var(--ft-card);border-radius:5px;color:var(--ft-muted);font-size:12px;font-weight:800;width:20px;height:18px;cursor:pointer;line-height:1;padding:0}
+.sch-pop .bg-h .wallctl + .addb{margin-left:6px}
+.sch-pop .bg-h .addb:hover{border-color:var(--ft-brand);color:var(--ft-brand-deep)}
 .sch-pop .pfseg{display:inline-flex;border:1px solid var(--ft-border-strong);border-radius:5px;overflow:hidden}
 .sch-pop .pfseg button{border:none;background:var(--ft-card);color:var(--ft-faint);font-size:9px;font-weight:800;padding:3px 7px;cursor:pointer}
 .sch-pop .pfseg button + button{border-left:1px solid var(--ft-border-strong)}
@@ -247,6 +251,7 @@ const CSS = `
 .sch-pop .bline{display:flex;align-items:center;gap:7px;padding:3px 0;border-bottom:1px solid var(--ft-row-line)}
 .sch-pop .bline .bn{flex:1;min-width:0}
 .sch-pop .bline .bn .n{font-size:11.5px;font-weight:700;line-height:1.25;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
+.sch-pop .bline .bn .n .addtag{font-size:8.5px;font-weight:800;color:var(--ft-brand-deep);background:var(--ft-brand-soft);border-radius:4px;padding:0 5px;margin-left:6px;vertical-align:1px;text-transform:lowercase}
 .sch-pop .bline .bn .n .sotag{font-size:8.5px;font-weight:800;color:var(--s-rust);background:var(--ft-hover-red,#F7E8E1);border-radius:4px;padding:0 5px;margin-left:6px;vertical-align:1px}
 .sch-pop .bline .bn .m{font-size:9.5px;color:var(--ft-faint);font-weight:600;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
 .sch-pop .bline .bn .m b{color:var(--ft-muted);font-weight:700}
@@ -479,6 +484,7 @@ export default function SchluterConfigurator({
   const [swaps, setSwaps] = useState(s0.swaps);
   const [drainPick, setDrainPick] = useState(s0.drainPick);
   const [swap, setSwap] = useState(null);           // { key, rect, anchor, drain?, draft? } — a line's ⇄ popover
+  const [add, setAdd] = useState(null);             // { g, part, draft, qty, q, replace?, rect, anchor } — a group's "+" (Phase 1c)
   const [confirmKit, setConfirmKit] = useState(null); // tray clicked over a customized build
   const [manual, setManual] = useState(s0.manual);
   const [qtyOv, setQtyOv] = useState({}); // hand-stepped line quantities (the wedi idiom) — session only, never in the marker
@@ -738,10 +744,7 @@ export default function SchluterConfigurator({
     if (!pickCand) return null;
     const b = buildKit(cfg, cat, { source, pick: pickCand });
     b.lines = applyQtyOv(applyBoardPlan(b.lines, cfg, plan), qtyOv);
-    manual.forEach((m) => {
-      const e = cat.find((i) => i.sku === m.sku);
-      if (e) b.lines.push({ g: "Extras", item: e, qty: m.qty, so: !e.stock, manual: true, slot: slotOf("Extras", e) });
-    });
+    b.lines.push(...addedLines(manual, cat));
     return b;
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [cfg, cat, source, pickCand, manual, qtyOv, plan]);
@@ -760,7 +763,11 @@ export default function SchluterConfigurator({
     const lines = applyBoardPlan(b.lines, c2, c2.wallSys === "board" ? boardPlan(expandBoardFaces(c2), cat, { source: c2.source === "stock" ? "stock" : "all" }) : null);
     const s = sessionFromRows(lines, editRows, cat);
     if (Object.keys(s.qtyOv).length) setQtyOv(s.qtyOv);
-    if (s.manual.length) setManual((m) => [...m, ...s.manual]);
+    // a placed row's extra beyond the marker's own added lines tops up that row
+    if (s.manual.length) setManual((m) => s.manual.reduce((acc, r) => {
+      const g = addedGroup(r, cat.find((i) => i.sku === r.sku));
+      return setAddedQty(acc, g, r.sku, addedQty(acc, g, r.sku, cat) + r.qty, cat);
+    }, m));
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [catReady, cat]);
   const mode = kitPick && !manual.length && !benches.length && !liveXwalls.length && !cfg.drainX && !cfg.drainY
@@ -878,15 +885,17 @@ export default function SchluterConfigurator({
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [mode, markCfg, tab, q, started]);
 
-  const qtyIn = (sku) => (manual.find((m) => m.sku === sku) || { qty: 0 }).qty;
-  const setQty = (sku, n) => setManual((mm) => {
-    const rest = mm.filter((m) => m.sku !== sku);
-    return n > 0 ? [...rest, { sku, qty: n }] : rest;
-  });
-  // a build-column stepper: a hand-added Extras line adjusts its manual row,
-  // a recipe line takes a qtyOv override
+  // Added lines (Phase 1c) are cfg.manual rows keyed by group + sku. Browse,
+  // the chips and the figurer add under the part's own group (addedGroup);
+  // a group's "+" adds under that group.
+  const browseG = (sku) => addedGroup({}, cat.find((i) => i.sku === sku));
+  const qtyIn = (sku) => addedQty(manual, browseG(sku), sku, cat);
+  const setQty = (sku, n) => setManual((mm) => setAddedQty(mm, browseG(sku), sku, n, cat));
+  const addQty = (g, sku, n) => setManual((mm) => setAddedQty(mm, g, sku, n, cat));
+  // a build-column stepper: an added line adjusts its own row, a recipe line
+  // takes a qtyOv override
   const stepLine = (l, delta) => {
-    if (l.manual) { setQty(l.item.sku, Math.max(0, l.qty + delta)); return; }
+    if (l.manual) { addQty(l.g, l.item.sku, Math.max(0, l.qty + delta)); return; }
     setQtyOv((o) => ({ ...o, [ovKey(l)]: Math.max(0, l.qty + delta) }));
   };
 
@@ -982,7 +991,7 @@ export default function SchluterConfigurator({
   const setBenchPick = (bi, patch) => setBenches((xs) => xs.map((b, j) => (j === bi ? { ...b, ...patch } : b)));
   const swapChoices = (l) => {
     const e = l.item;
-    if (l.noteOnly) return null;
+    if (l.noteOnly || l.manual) return null;
     if (l.g === "Curb" && e.g === "curb" && e.len) return {
       title: "Curb",
       list: pool(cat.filter((i) => i.g === "curb" && i.len)).slice().sort((a, b2) => a.len - b2.len),
@@ -1017,7 +1026,7 @@ export default function SchluterConfigurator({
   // KERDI membrane and KERDI-BAND lines open the stepped popover (Phase 1b):
   // Width → Roll, the choice riding cfg.swaps.membrane / cfg.swaps.band.
   const steppedKind = (l) => {
-    if (l.noteOnly || !build) return null;
+    if (l.noteOnly || l.manual || !build) return null;
     if (l.g === "Walls" && l.item.g === "membrane") return cat.filter((i) => i.g === "membrane").length > 1 ? "membrane" : null;
     if (l.g === "Seams" && l.item.g === "seam" && l.item.lf) return cat.filter((i) => i.g === "seam" && i.lf).length > 1 ? "band" : null;
     return null;
@@ -1027,10 +1036,11 @@ export default function SchluterConfigurator({
   // 1a): linear builds choose family → grate → frame → finish, point builds
   // only the grate (the tray fixes the drain family).
   const pointGrates = () => pool(cat.filter((i) => i.g === "drain" && i.part === "grate")).sort(byShelf);
-  const drainKind = (l) => (l.g !== "Drain" || l.noteOnly || !build ? null
+  const drainKind = (l) => (l.g !== "Drain" || l.noteOnly || l.manual || !build ? null
     : build.drainFit ? "linear" : pointGrates().length ? "point" : null);
   const panW = benchTrayRoom(normBenches, cfg).w;
   const openSwap = (l, ev) => {
+    setAdd(null);
     const kind = drainKind(l);
     const stepped = !kind && steppedKind(l);
     const grate = kind === "point" && build.lines.find((x) => x.g === "Drain" && x.item.part === "grate");
@@ -1043,6 +1053,36 @@ export default function SchluterConfigurator({
     });
   };
 
+  // Added lines (Phase 1c): a group's "+" and an added line's ⇄ open addPanel.
+  const addDraft = (part, e) => {
+    const kitLine = (hit) => build && build.lines.find((l) => !l.manual && !l.noteOnly && hit(l.item));
+    if (part.stepped === "membrane") {
+      const m = e || kitLine((i) => i.g === "membrane")?.item;
+      return m ? { wide: !!m.wide, roll: m.roll } : {};
+    }
+    if (part.stepped === "band") {
+      const b = e || kitLine((i) => i.g === "seam" && i.lf)?.item;
+      return b ? { width: b.width, roll: b.roll } : {};
+    }
+    if (part.stepped === "drain") return { ...(drainPick || { family: "vario" }), ...(build?.drainFit ? { len: build.drainFit.len } : {}) };
+    return null;
+  };
+  const openAdd = (g, ev, line) => {
+    const part = line ? addPartOf(g, line.item) : addParts(g, cat, { linear: !!build?.drainFit })[0];
+    if (!part) return;
+    setSwap(null);
+    setAdd({
+      g, part: part.key, qty: 1, q: "", draft: addDraft(part, line ? line.item : null), replace: line ? line.item.sku : null,
+      rect: ev.currentTarget.getBoundingClientRect(), anchor: ev.currentTarget.closest(line ? ".bline" : ".bg-h"),
+    });
+  };
+  // an added line's ⇄: the part it sits in offers more than itself
+  const canSwapAdded = (l) => {
+    const part = l.manual && addPartOf(l.g, l.item);
+    if (!part) return false;
+    if (part.stepped) return true;
+    return new Set([...pool(cat.filter(part.hit)).map((i) => i.sku), l.item.sku]).size > 1;
+  };
   // A kit click over customized work asks before wiping it (the wedi
   // overwrite rule) — an untouched kit-to-kit hop stays one click.
   const kitDirty = manual.length > 0 || benches.length > 0 || liveXwalls.length > 0
@@ -1133,7 +1173,7 @@ export default function SchluterConfigurator({
     setCorners({}); setMaxIn(false); setTileT("");
     setDrainX(""); setDrainY(""); setDrainRef("left");
     setBenches([]); setBenchMenu(null); setWallMenu(null); setPicker(null);
-    setMortarName(""); setRamp(false); setSwaps({}); setDrainPick(null); setSwap(null); setManual([]); setQtyOv({});
+    setMortarName(""); setRamp(false); setSwaps({}); setDrainPick(null); setSwap(null); setAdd(null); setManual([]); setQtyOv({});
     setPick(null); setKitPick(false); setStarted(false);
   };
 
@@ -1157,7 +1197,7 @@ export default function SchluterConfigurator({
   // tray size.
   const keepAdded = (t) => {
     setWalls((ws) => ws.map((x, i) => (+x.len > 0 && Math.abs(+x.len - (i === 0 ? cfg.w : cfg.d)) < 0.01 ? { ...x, len: "" } : x)));
-    setPlacing(false); setWallMenu(null); setBenchMenu(null); setPicker(null); setSwap(null);
+    setPlacing(false); setWallMenu(null); setBenchMenu(null); setPicker(null); setSwap(null); setAdd(null);
     setSwaps({}); setQtyOv({}); setMaxIn(false);
     setW(String(t.w)); setD(String(t.d)); setDrain(t.drain); setCurbed(!t.thin);
     setPick(t.sku); setKitPick(true); setStarted(true);
@@ -1498,16 +1538,12 @@ export default function SchluterConfigurator({
               const inBuild = (sku) => (build ? build.lines.reduce((t, l) => t + (!l.noteOnly && l.item.sku === sku ? l.qty : 0), 0) : 0);
               const want = figRolls.map((p) => [p.item.sku, p.qty]);
               if (allset) want.push([allset.sku, figBags]);
-              setManual((mm) => {
-                let next = mm.slice();
-                want.forEach(([sku, qty]) => {
-                  const need = qty - inBuild(sku);
-                  if (need <= 0) return;
-                  const m = next.find((x) => x.sku === sku);
-                  next = m ? next.map((x) => (x === m ? { ...x, qty: Math.max(x.qty, need) } : x)) : [...next, { sku, qty: need }];
-                });
-                return next;
-              });
+              setManual((mm) => want.reduce((next, [sku, qty]) => {
+                const need = qty - inBuild(sku);
+                if (need <= 0) return next;
+                const g = browseG(sku);
+                return setAddedQty(next, g, sku, Math.max(addedQty(next, g, sku, cat), need), cat);
+              }, mm));
               say("KERDI + ALL-SET added for " + figSfVal + " sf of wall");
             }}>Add to build</button>
           )}
@@ -1573,7 +1609,8 @@ export default function SchluterConfigurator({
           </div>
           {GROUPS.map((g) => {
             const gl = build.lines.filter((l) => l.g === g);
-            if (!gl.length) return null;
+            const canAdd = addParts(g, cat).length > 0;
+            if (!gl.length && !canAdd) return null;
             return (
               <div className="bgroup" key={g}>
                 <div className="bg-h">{g}
@@ -1585,15 +1622,19 @@ export default function SchluterConfigurator({
                       </span>
                     </span>
                   )}
+                  {canAdd && <button className="addb" title={`add another line to ${g}`} onClick={(ev) => openAdd(g, ev)} data-add-group={g}>+</button>}
                 </div>
                 {gl.map((l, li) => {
                   const e = l.item;
                   const price = tierOf(e);
-                  const meta = [e.sku, e.size, l.note, l.noteOnly ? "" : perUnit(e, false)].filter(Boolean);
+                  // the kit's own lines of an added line's part — a double-up after a room or kit change
+                  const kitAlso = l.manual ? build.lines.reduce((t, k) => t + (!k.manual && !k.noteOnly && k.item.sku === e.sku ? k.qty : 0), 0) : 0;
+                  const meta = [e.sku, e.size, l.note, kitAlso ? "kit also bills " + kitAlso : "", l.noteOnly ? "" : perUnit(e, false)].filter(Boolean);
                   return (
                     <div className={"bline" + (l.noteOnly ? " note" : "")} key={g + (e.sku || e.name) + li}>
                       <div className="bn">
                         <div className="n">{shown(e.name)}
+                          {l.manual && <span className="addtag" title="added by hand — doesn't re-figure when the room or kit changes" data-added-tag>added</span>}
                           {!l.noteOnly && !e.stock && <span className="sotag">special order</span>}</div>
                         <div className="m" title={meta.join(" · ") || undefined}>{meta.map((s2, k) => (k ? " · " + s2 : <b key="k">{s2}</b>))}</div>
                       </div>
@@ -1601,6 +1642,10 @@ export default function SchluterConfigurator({
                         <button className="swapb" title="swap" data-schluter-swapb={e.sku}
                           onClick={(ev) => openSwap(l, ev)}>⇄</button>
                       )}
+                      {canSwapAdded(l) && (
+                        <button className="swapb" title="swap this added line" data-schluter-swapb={e.sku} data-added-swapb
+                          onClick={(ev) => openAdd(l.g, ev, l)}>⇄</button>
+                      )}
                       {!l.noteOnly && (
                         <div className="stepper">
                           <button onClick={() => stepLine(l, -1)} title="one less — at 0 the line leaves the bill">−</button>
@@ -2141,11 +2186,13 @@ export default function SchluterConfigurator({
         <div className="ph">Niches <HelpTip className="align-middle ml-1" w={220} tip={NICHE_PICK_TIP} /></div>
         {list.map((e) => {
           const n = qtyIn(e.sku);
+          // a row adds another (Phase 1c) — several niches, several sizes;
+          // the build line's − or ⇄ is where one comes off
           return (
             <button key={e.sku} className={"srow" + (n ? " on" : e.stock ? " stk" : "")}
-              onClick={() => setQty(e.sku, n ? 0 : 1)} data-schluter-pick={e.sku}>
+              onClick={() => setQty(e.sku, n + 1)} data-schluter-pick={e.sku}>
               <span className={"sdot" + (e.stock ? "" : " so")} />
-              <span className="n">{(n ? "✓ " : "") + shown(e.name)}<small>{[e.size, e.sku, e.stock ? "stock" : "special order"].filter(Boolean).join(" · ")}</small></span>
+              <span className="n">{(n ? `✓ ×${n} ` : "") + shown(e.name)}<small>{[e.size, e.sku, e.stock ? "stock" : "special order"].filter(Boolean).join(" · ")}</small></span>
               <span className="p">{fm(tierOf(e))}</span>
             </button>
           );
@@ -2193,6 +2240,22 @@ export default function SchluterConfigurator({
     if (!build.drainFit) return null;
     const draft = swap.draft;
     const o = drainOptions(draft, panW, cat, { source });
+    const { rows, what, why } = drainRowsFor(o, draft, setDraft, panW);
+    return (
+      <SwapPop at={at} className="sch-swappanel" title={`Swap the drain — ${panW}″ pan`} rows={rows}
+        summary={summaryOf(what, why, drainTotal(o.result.lines))}
+        onUse={() => {
+          setDrainPick(draft.family === "vario" && !draft.design && !draft.finish ? null : draft);
+          clearDrainQty(); setKitPick(false); setSwap(null);
+        }}
+        onClose={() => setSwap(null)} />
+    );
+  };
+
+  // The linear drain popover's rows and summary text for a drain choice at a
+  // `width` — the pan's installed width on a swap, the Length row's pick on a
+  // "+" (Phase 1c).
+  const drainRowsFor = (o, draft, setDraft, width) => {
     const fam = o.family, res = o.result;
     // unchosen steps light the chip of what actually resolved
     const got = res.family === fam ? res.lines[fam === "vario" ? 0 : 1]?.item : null;
@@ -2201,14 +2264,14 @@ export default function SchluterConfigurator({
     // than dragging the whole choice onto a substitute or the Vario fallback
     const keepFinish = (next) => {
       if (!next.finish) return next;
-      const t = resolveDrain(next, panW, cat, { source });
+      const t = resolveDrain(next, width, cat, { source });
       if (!t.fallback && !t.subst) return next;
       const { finish, ...bare } = next;
       return bare;
     };
     const rows = [
       { label: "Family", chips: o.families.map((f) => ({ key: f.key, label: f.label, ok: f.ok, on: f.key === fam,
-        title: f.ok ? "" : `can't be made for a ${panW}″ pan`, onPick: () => setDraft({ family: f.key }) })) },
+        title: f.ok ? "" : `can't be made for a ${width}″ pan`, onPick: () => setDraft({ family: f.key }) })) },
       { label: fam === "frameless" ? "Body" : "Grate", chips: o.styles.map((st) => ({ key: st.key, ok: st.ok,
         label: st.label + (st.max && st.max < o.fit ? ` · to ${st.max}″` : ""),
         on: fam === "vario" ? st.key === (draft.design || got?.design)
@@ -2238,15 +2301,7 @@ export default function SchluterConfigurator({
           + (g.frame ? `, ${inchGlyph(g.frame)} frame` : "") + (g.finish ? ", " + low(FINISH_LABEL[g.finish] || g.finish) : "");
       why = [l0.note, l1.note].filter(Boolean).join(" · ");
     }
-    return (
-      <SwapPop at={at} className="sch-swappanel" title={`Swap the drain — ${panW}″ pan`} rows={rows}
-        summary={summaryOf(what, why, drainTotal(res.lines))}
-        onUse={() => {
-          setDrainPick(draft.family === "vario" && !draft.design && !draft.finish ? null : draft);
-          clearDrainQty(); setKitPick(false); setSwap(null);
-        }}
-        onClose={() => setSwap(null)} />
-    );
+    return { rows, what, why };
   };
 
   // The membrane / band popover — the drain popover's draft model: chips edit
@@ -2290,6 +2345,88 @@ export default function SchluterConfigurator({
     );
   };
 
+  // The "+" on a bill group (Phase 1c): the group's parts — stepped where the
+  // swap is stepped, with no Auto (an added line is a real part), a list
+  // elsewhere. Use this / a list click adds under that group; an added line's
+  // ⇄ opens the same panel on its own part and replaces that row, keeping
+  // its qty.
+  const addPanel = (() => {
+    if (!add || !build) return null;
+    const parts = add.replace ? [addPartOf(add.g, cat.find((i) => i.sku === add.replace))].filter(Boolean) : addParts(add.g, cat, { linear: !!build.drainFit });
+    const part = parts.find((p) => p.key === add.part) || parts[0];
+    if (!part) return null;
+    const setA = (patch) => setAdd((a) => (a ? { ...a, ...patch } : a));
+    const r = add.rect;
+    const at = { anchor: add.anchor, x: r.right - 470, y: r.bottom + 6 };
+    const partRow = !add.replace && parts.length > 1 ? [{ label: "Part", chips: parts.map((p) => ({
+      key: p.key, label: p.label, ok: true, on: p.key === part.key, onPick: () => setA({ part: p.key, draft: addDraft(p, null), q: "" }) })) }] : [];
+    const title = add.replace ? `Swap the added ${part.label.toLowerCase()}` : `Add to ${add.g}`;
+    const oldQty = add.replace ? addedQty(manual, add.g, add.replace, cat) : 0;
+    const old = add.replace ? cat.find((i) => i.sku === add.replace) : null;
+    const summaryFor = (items, why) => {
+      const q = add.replace ? oldQty : add.qty;
+      const cost = round2(items.reduce((t, e) => t + tierOf(e), 0) * q);
+      const d = round2(cost - (old ? tierOf(old) * q : 0));
+      return { what: (q > 1 ? q + " × " : "") + items.map((e) => shown(e.name)).join(" + "), why, delta: fmDelta(d), total: fm(round2((totals ? totals.sell : 0) + d)), up: d > 0 };
+    };
+    const use = (items) => {
+      if (add.replace) {
+        const to = items[0].sku;
+        if (to !== add.replace) setManual((mm) => setAddedQty(setAddedQty(mm, add.g, add.replace, 0, cat), add.g, to, addedQty(mm, add.g, to, cat) + oldQty, cat));
+      } else setManual((mm) => items.reduce((acc, e) => setAddedQty(acc, add.g, e.sku, addedQty(acc, add.g, e.sku, cat) + add.qty, cat), mm));
+      setAdd(null);
+    };
+    const qtyProps = add.replace ? {} : { qty: add.qty, onQty: (n) => setA({ qty: n }) };
+    const shelfWhy = (e) => [e.sku, e.stock ? "stock" : "special order"].join(" · ");
+    if (part.stepped === "membrane" || part.stepped === "band") {
+      const o = addRollOptions(part.stepped, add.draft, cat, { source });
+      const chip = (c) => ({ ...c, onPick: () => setA({ draft: c.next }) });
+      const rows = [...partRow,
+        { label: "Width", chips: o.widths.map((c) => ({ ...chip(c), label: part.stepped === "membrane" ? c.label : inchGlyph(c.label) })) },
+        { label: "Roll", chips: o.rolls.map(chip) }];
+      return (
+        <SwapPop add at={at} className="sch-swappanel" title={title} rows={rows} stockFirst={source === "stock"} {...qtyProps}
+          summary={o.item ? summaryFor([o.item], shelfWhy(o.item)) : { what: "Nothing in the books", why: "", delta: "", total: "" }}
+          onUse={() => o.item && use([o.item])} onClose={() => setAdd(null)} />
+      );
+    }
+    if (part.stepped === "drain") {
+      const o = drainAddOptions(add.draft, cat, { source });
+      const { rows, what } = drainRowsFor(o, o.choice, (d) => setA({ draft: { ...d, len: d.len ?? o.len } }), o.len);
+      rows.splice(1, 0, { label: "Length", chips: o.lengths.map((c) => ({ ...c, onPick: () => setA({ draft: c.next }) })) });
+      const items = o.lines.map((l) => l.item);
+      return (
+        <SwapPop add at={at} className="sch-swappanel" title={title} rows={[...partRow, ...rows]} {...qtyProps}
+          summary={{ ...summaryFor(items, items.map((e) => e.sku).join(" + ")), what: (add.qty > 1 ? add.qty + " × " : "") + what }}
+          onUse={() => items.length && use(items)} onClose={() => setAdd(null)} />
+      );
+    }
+    const all = pool(cat.filter(part.hit)).sort(byShelf);
+    const toks = add.q.toLowerCase().split(/\s+/).filter(Boolean);
+    const list = all.filter((e) => toks.every((t) => (e.name + " " + e.sku + " " + (e.size || "")).toLowerCase().includes(t)));
+    return (
+      <SwapPop add at={at} className="sch-swappanel" title={title} rows={partRow} onClose={() => setAdd(null)}>
+        {all.length > 12 && (
+          <input className="w-full rounded-md border border-slate-300 px-2 py-1 mb-1 text-[12px]" autoFocus value={add.q}
+            placeholder={`Search ${part.label.toLowerCase()}…`} onChange={(e) => setA({ q: e.target.value })} data-add-search />
+        )}
+        <div className="sch-swap sch-grown">
+          {list.slice(0, 60).map((e) => {
+            const n = addedQty(manual, add.g, e.sku, cat);
+            return (
+              <button key={e.sku} className={"srow" + (add.replace === e.sku ? " on" : "") + (e.stock ? " stk" : "")}
+                onClick={() => use([e])} data-add-row={e.sku}>
+                <span className={"sdot" + (e.stock ? "" : " so")} />
+                <span className="n">{(!add.replace && n ? `✓ ×${n} ` : "") + shown(e.name)}<small>{[e.size, e.sku, e.stock ? "stock" : "special order"].filter(Boolean).join(" · ")}</small></span>
+                <span className="p">{fm(tierOf(e))}</span>
+              </button>
+            );
+          })}
+        </div>
+      </SwapPop>
+    );
+  })();
+
   // The ⇄ swap popover — the wedi anchored panel: the line's alternatives,
   // stock tinted, the standing pick highlighted.
   const swapPanel = (() => {
@@ -2467,6 +2604,7 @@ export default function SchluterConfigurator({
       {benchMenuPanel}
       {pickerPanel}
       {swapPanel}
+      {addPanel}
       {confirmModal}
       {payloadModal}
       {printSheet}
```

- [ ] **Step 2: Static checks**

Run: `npx eslint src/SchluterConfigurator.jsx` → clean. Run: `npm test` →
`# fail 0`. Run the build (Global Constraints) → built.

- [ ] **Step 3: Write the proof script** — create
  `.scratch/158_shower-config-roadmap/p1c/shoot-schluter.mjs`:

```js
// Proof: "+" on every Schluter bill group (ticket 158 Phase 1c) — a one-part
// group's list, Walls with its Part row, a stepped band add with the qty
// stepper, a linear build's whole-drain add with a Length row, an added line's
// "added" tag and "kit also bills N", and an added line's own ⇄.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p1c/shoot-schluter.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p1c";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const fail = (m) => { console.error("FAIL:", m); err = true; };
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const flat = (t) => t.replace(/\n+/g, " | ");
const pop = async () => flat(await pg.locator("[data-add-pop]").innerText());
const grp = (name) => pg.locator(".bgroup", { has: pg.locator(".bg-h", { hasText: new RegExp("^" + name) }) });
const grpText = async (name) => flat(await grp(name).innerText());
const plus = async (g) => { await pg.locator(`[data-add-group="${g}"]`).click(); await pg.waitForSelector("[data-add-pop]", { timeout: 5000 }); await pg.waitForTimeout(200); };

await pg.goto("http://localhost:5199/schluter-preview.html");
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(600); // Full catalog
await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);

const groups = await pg.locator("[data-add-group]").evaluateAll((els) => els.map((e) => e.getAttribute("data-add-group")));
console.log("+ on:", groups.join(", "));
if (groups.join() !== "Base,Drain,Walls,Seams,Curb,Setting,Extras") fail("not every group has a +");

// a one-part group: a list, no Part row; a click adds 1 and closes
await plus("Curb");
const curbPop = await pop();
console.log("curb +:", curbPop);
if (/PART/.test(curbPop)) fail("the one-part Curb + shows a Part row");
await shot("s1-curb-list");
await pg.locator("[data-add-row]").first().click(); await pg.waitForTimeout(400);
if (await pg.locator("[data-add-pop]").count()) fail("a list click did not close the popover");
if ((await grp("Curb").locator("[data-added-tag]").count()) !== 1) fail("the curb add did not land as an added line");

// Walls: the Part row names Board · Membrane · Fasteners
await plus("Walls");
const wallsPop = await pop();
console.log("walls +:", wallsPop);
if (!/PART \| Board \| Membrane \| Fasteners/.test(wallsPop)) fail("Walls + lacks its Part row");
await shot("s2-walls-part-row");
await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);

// a stepped band add: no Auto chip, the draft starts on the kit's band, qty 2
await plus("Seams");
if (await pg.locator('[data-drain-chip="Roll:auto"]').count()) fail("the band + shows an Auto chip");
await pg.locator('[data-drain-chip="Roll:5M"]').click();
await pg.locator("[data-add-qty] button").nth(1).click(); await pg.waitForTimeout(200);
const bandPop = await pop();
console.log("band + draft:", bandPop);
if (!/2 × KERDI-BAND/.test(bandPop) || !/KEBA100\/125\/5M/.test(bandPop)) fail("the band draft is not 2 × the 5 m roll");
await shot("s3-band-add-qty");
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(500);
const seams = await grpText("Seams");
console.log("Seams:", seams);
if (!/KEBA100\/125\/10M/.test(seams) || !/added/.test(seams)) fail("the added band did not land beside the kit's");

// the same part as the kit's line: its own line, tagged, with "kit also bills"
await plus("Seams");
await pg.locator('[data-drain-chip="Roll:10M"]').click(); await pg.waitForTimeout(200);
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(500);
const seams2 = await grpText("Seams");
console.log("Seams, same part:", seams2);
if (!/kit also bills 1/.test(seams2)) fail("the added 10 m band lacks 'kit also bills 1'");
if ((await grp("Seams").locator(".bline").count()) !== 3) fail("the same-part add merged into the kit line");
await shot("s4-added-tag-kit-also");

// an added line's own ⇄: replaces only that row, qty kept
await grp("Seams").locator("[data-added-swapb]").first().click(); await pg.waitForTimeout(300);
const swapPop = await pop();
console.log("added ⇄:", swapPop);
if (!/Swap the added band/.test(swapPop) || /PART/.test(swapPop)) fail("the added line's ⇄ is not its own panel");
await shot("s5-added-swap");
await pg.locator('[data-drain-chip="Roll:30M"]').click(); await pg.waitForTimeout(200);
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(500);
const seams3 = await grpText("Seams");
console.log("Seams after ⇄:", seams3);
if (/KEBA100\/125\/5M/.test(seams3) || !/KEBA100\/125 ·/.test(seams3)) fail("the ⇄ did not replace the 5 m row with the 30 m roll");

// a linear build's Drain +: the whole drain with a Length row
await pg.getByRole("button", { name: "Clear design" }).click(); await pg.waitForTimeout(400);
await pg.locator("[data-schluter-tray='KSLT965/1930S']").first().click(); await pg.waitForTimeout(800);
await plus("Drain");
const drainPop = await pop();
console.log("drain +:", drainPop);
if (!/PART \| Drain/.test(drainPop) || !/LENGTH/.test(drainPop)) fail("the linear Drain + lacks its whole-drain Length row");
await shot("s6-drain-add");
await pg.keyboard.press("Escape");

await b.close();
if (err) { console.error("— FAILED"); process.exit(1); }
console.log("— all checks passed");
```

- [ ] **Step 4: Shoot**

Start the preview server; run
`node .scratch/158_shower-config-roadmap/p1c/shoot-schluter.mjs`.
Expected: `— all checks passed`, six PNGs `s1…s6` in `p1c/`. Open
`s4-added-tag-kit-also.png` and check the tag and hint read cleanly. Stop the
server.

- [ ] **Step 5: Commit**

```bash
git add src/SchluterConfigurator.jsx .scratch/158_shower-config-roadmap/p1c/shoot-schluter.mjs .scratch/158_shower-config-roadmap/p1c/s*.png
git commit -m "Schluter popup: + on every group, added lines tagged with their own swap (1c)"
```

---

### Task 6: wedi popup — "+" on every bucket, addons retired, chips add another

**Files:**
- Modify: `src/WediConfigurator.jsx`,
  `.scratch/158_shower-config-roadmap/p1b/shoot-wedi.mjs`
- Create: `.scratch/158_shower-config-roadmap/p1c/shoot-wedi.mjs`

**Interfaces:**
- Consumes: Task 3's exports (plus the existing `curbProfile`, `catalog`),
  Task 4's `SwapPop` props.
- Produces: the same DOM hooks as Task 5 (`data-add-group` carries the bucket
  key: `floor`, `walls`, `bench`, `drain`, `install`, `addon`), plus
  `[data-wedi-chip="<chip>"]` on each add-on chip.

What the diff does:
- **`addons` state is gone.** `seedState` reads `s.manual = addedRows(cfg)`
  (old `addons` translated); `kitFor` gets `manual`; `kitDirty` counts
  `manual` only.
- **`applySession`** no longer merges `manual` into kit lines. It carries
  `added`, moves added lines to the end (below the Fit plan's re-appended
  panels), and appends `s.manual` only for a basket entry **staged before
  1c** (those extras rode the session), each its own line.
- **Staging:** a kit build's session no longer carries `manual` (the cfg
  does); a Browse-only build's still does.
- **Steppers:** `step(key, ±1)` (Browse) edits the added row in the part's
  bucket; `stepLine(l, ±1)` edits an added line's own row, sends a non-added
  un-auto kit line (a premade bench) to `step`, and writes `qtyOv` for the
  rest. This fixes both 1b bugs: + on a merged line no longer jumps by 3, and
  − on a niche at 2 no longer drops it to 0.
- **Reconfigure:** leftovers top up the matching row.
- **Chips:** Niche · Seat · Bench · Glass shelf always open their picker and
  add another (`✓ Niche ×2`); the Sealant gun toggles a gun row (`toggleGun`);
  Recess kit / Cover frame unchanged.
- **⇄:** `swapChoices` returns null for added lines and drops the old
  niche/seat/bench/shelf branch (it rewrote `addons`). A kit's premade-bench
  line loses that branch's ⇄ too — it wrote `addons`, which the bench recipe
  never read, so it never changed the bill; benches still change on the
  drawing. Added lines get `canSwapAdded` → `openAdd(…, line)`.
- **"+"** on every bucket with parts (`wediAddParts`); `addPanel` —
  curb (`curbAddOptions`), panel (`panelOptions`), cover (`coverAddOptions`)
  stepped; the rest a list with search past 12 rows.
- **Curb drawing and "Turn into a curb"** read only the kit's own curb
  (`!l.added`) — an added curb bills but is not drawn.
- **Line React key** gains `+` for an added line (a kit line and an added
  line of the same part share a bucket now).
- **p1b `shoot-wedi.mjs`:** two assertions checked "a Browse-added line has
  no ⇄"; 1c gives added lines their own ⇄ (spec §3 replaces 1b's rule), so
  they now check there is no **kit** ⇄ (`.swapb:not([data-added-swapb])`).

- [ ] **Step 1: Implement** — apply both:

```diff
diff --git a/src/WediConfigurator.jsx b/src/WediConfigurator.jsx
index 1f0dbab..37914e4 100644
--- a/src/WediConfigurator.jsx
+++ b/src/WediConfigurator.jsx
@@ -24,6 +24,7 @@ import {
   normBench, benchPremades, benchPanRoom, benchPanPlan, smallerPanFor,
   BENCH_CORNER_LBL, buildFromMarker, sessionFromRows, wediSlotOf, coverStyles, legacyCoverPick, coverPickApplies,
   resolveCurb, curbOptions, curbPickOf, panelOptions, panelSheets, fastenerKits,
+  addedRows, setAddedRow, wediBucketOf, wediAddParts, wediAddPartOf, curbAddOptions, coverAddOptions, curbProfile, catalog,
 } from "./wedi.js";
 import { SwapPop, fmDelta, inchGlyph } from "./swappop.jsx";
 import { TopDown, Iso, railSplit, RAIL_DESIGN_W, curbHeight } from "./showerdraw.jsx";
@@ -316,6 +317,10 @@ const CSS = `
 .wedi-pop .bline .stepper .q.ov{color:var(--w-rust)}
 .wedi-pop .swapb{flex:none;border:1px solid var(--ft-border);background:var(--ft-card);border-radius:5px;width:20px;height:20px;font-size:11px;color:var(--ft-muted);cursor:pointer;line-height:1}
 .wedi-pop .swapb:hover{border-color:var(--ft-brand);color:var(--ft-brand-deep)}
+.wedi-pop .bg-h .addb{margin-left:auto;flex:none;border:1px solid var(--ft-border);background:var(--ft-card);border-radius:5px;color:var(--ft-muted);font-size:12px;font-weight:800;width:20px;height:18px;cursor:pointer;line-height:1;padding:0}
+.wedi-pop .bg-h .wallctl + .addb{margin-left:6px}
+.wedi-pop .bg-h .addb:hover{border-color:var(--ft-brand);color:var(--ft-brand-deep)}
+.wedi-pop .bline .addtag{font-size:8.5px;font-weight:800;color:var(--ft-brand-deep);background:var(--ft-brand-soft);border-radius:4px;padding:0 5px;margin-left:6px;vertical-align:1px;text-transform:lowercase}
 .wedi-pop .starb{flex:none;border:1px solid var(--ft-border);background:var(--ft-card);border-radius:5px;width:22px;height:22px;font-size:12px;color:var(--ft-faint);cursor:pointer;line-height:1;padding:0}
 .wedi-pop .starb.on{color:#C9A050;border-color:#C9A050}
 .wedi-pop .addchips{display:flex;flex-wrap:wrap;gap:5px;padding:5px 0 2px}
@@ -452,12 +457,7 @@ const browseSub = (e) => [finName(e), sizeLed(e) ? e.sizeText : "", GROUP_LABEL[
   .filter(Boolean).join(" · ");
 
 const BUCKETS = [["floor", "Floor"], ["walls", "Walls"], ["bench", "Bench"], ["drain", "Drain & finish"], ["install", "Install"], ["addon", "Add-ons"]];
-const BUCKET_OF = {
-  pan: "floor", module: "floor", modExt: "floor", extension: "floor", cornerExt: "floor", ramp: "floor",
-  curb: "floor", kit: "floor", panel: "walls", cover: "drain", coverFrame: "drain", drainKit: "drain",
-  recess: "install", fastener: "install", sealant: "install", tool: "install", collar: "install", subliner: "install",
-};
-const bucketOf = (e) => BUCKET_OF[e.group] || "addon";
+const bucketOf = wediBucketOf;
 
 // One word each, no descriptive line (owner 2026-08-02): the Kits tab is a
 // price list to scan, and the difference between these four is the one word.
@@ -496,7 +496,7 @@ const DEF_INP = { w: 48, d: 66, curb: "curbed", drain: "any", drainX: "", drainY
 function seedState(seed) {
   const s = {
     tab: "kits", inp: { ...DEF_INP }, q: "", panKey: null, opts: { ...DEF_OPTS },
-    addons: [], benches: [], walls: DEF_WALLS.map((w) => ({ ...w })), extraWalls: [], wallH: 96, wallSeq: 0,
+    manual: [], benches: [], walls: DEF_WALLS.map((w) => ({ ...w })), extraWalls: [], wallH: 96, wallSeq: 0,
     corners: { bl: false, br: false, fl: false, fr: false }, solveInput: null, maxIn: false, tileT: "", source: "stock",
   };
   if (!seed) return s;
@@ -520,7 +520,8 @@ function seedState(seed) {
       sealantForm: cfg.sealantForm === "sausage" ? "sausage" : "tube",
       recess: cfg.recess || undefined,
     };
-    s.addons = (cfg.addons || []).slice();
+    // added lines (Phase 1c): cfg.manual, an old marker's addons translated
+    s.manual = addedRows(cfg);
     s.benches = (cfg.benches || []).map((b) => ({ ...b }));
     const rows = [];
     (cfg.walls || []).forEach((w) => {
@@ -631,8 +632,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
   const [option, setOption] = useState(null);
   const [results, setResults] = useState([]);
   const [qtyOv, setQtyOv] = useState({});
-  const [manual, setManual] = useState([]);
-  const [addons, setAddons] = useState(s0.addons);
+  const [manual, setManual] = useState(s0.manual);
   const [benches, setBenches] = useState(s0.benches);
   const [opts, setOpts] = useState(s0.opts);
   const [inp, setInp] = useState(s0.inp);
@@ -727,6 +727,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
   });
   const [swap, setSwap] = useState(null);     // { key, rect }
   const [chipMenu, setChipMenu] = useState(null);   // { group, rect } — add-on chip picker
+  const [add, setAdd] = useState(null);             // { g, part, draft, qty, q, replace?, rect, anchor } — a bucket's "+" (Phase 1c)
   const [wallMenu, setWallMenu] = useState(null);   // { wid, extra, x, y } — right-clicked wall
   const [benchMenu, setBenchMenu] = useState(null); // { kind, side|corner, x, y } — pan zone clicked
   const [confirmPan, setConfirmPan] = useState(null); // kit card clicked over a custom shower
@@ -893,22 +894,23 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
   };
 
   // The build column's tail over a kitFor result — panel plan, stepped
-  // quantities, hand-added extras. The basket drawer runs it too, so a staged
-  // entry prices the build that was staged and not just its marker.
+  // quantities. The basket drawer runs it too, so a staged entry prices the
+  // build that was staged and not just its marker. Added lines ride the cfg
+  // (kitFor bills them); `s.manual` is only a basket entry staged before
+  // Phase 1c, whose extras rode the session — each its own line now.
   const applySession = (b, wl, s) => {
-    let lines = b.lines.map((l) => ({ item: l.item, qty: l.qty, group: l.group, note: l.note, auto: l.auto, slot: l.slot }));
+    let lines = b.lines.map((l) => ({ item: l.item, qty: l.qty, group: l.group, note: l.note, auto: l.auto, slot: l.slot, added: l.added }));
     if (s.panelFit) lines = applyPanelFit(lines, wl, b.panelSf);
     lines.forEach((l) => {
       const ov = s.qtyOv[l.item.key];
       if (ov != null && l.auto !== false) { l.autoQty = l.qty; l.qty = ov; l.ov = true; }
     });
-    lines = lines.filter((l) => l.qty > 0);
-    s.manual.forEach((m) => {
-      const it = item(m.key);
-      if (!it || !(m.qty > 0)) return;
-      const hit = lines.find((l) => l.item.key === m.key);
-      if (hit) hit.qty += m.qty;
-      else lines.push({ item: it, qty: m.qty, group: bucketOf(it), note: "", auto: false, slot: wediSlotOf({ item: it, group: bucketOf(it) }) });
+    // the Fit plan re-appends the kit's panels, so added lines move back to
+    // the end — below the kit lines of their bucket
+    lines = [...lines.filter((l) => l.qty > 0 && !l.added), ...lines.filter((l) => l.qty > 0 && l.added)];
+    addedRows({ manual: s.manual }).forEach((r) => {
+      const it = item(r.key);
+      lines.push({ item: it, qty: r.qty, group: r.group, note: "", auto: false, added: true, slot: wediSlotOf({ item: it, group: r.group }) });
     });
     return lines;
   };
@@ -928,7 +930,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
     || (w.h !== "" && Math.abs(+w.h - (+wallH || 96)) >= 0.01)
     || (w.faces || "in") !== "in");
   const geomDirty = wallsTouched || extraWalls.length > 0 || Object.values(corners).some(Boolean) || wallFlip || +wallH !== 96;
-  const kitDirty = !!panKey && (geomDirty || Object.keys(qtyOv).length > 0 || manual.length > 0 || addons.length > 0
+  const kitDirty = !!panKey && (geomDirty || Object.keys(qtyOv).length > 0 || manual.length > 0
     || benches.length > 0
     || opts.panelKey !== undefined || opts.curbPick !== undefined || opts.fastenerKey !== undefined
     || coverPickApplies(opts.coverPick, panKey)
@@ -947,18 +949,15 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
         walls: buildWalls, wallHeight: +wallH || 80,
         panelKey: opts.panelKey, curbPick: opts.curbPick, fastenerKey: opts.fastenerKey, coverPick: opts.coverPick,
         coverFrame: opts.coverFrame, sealantForm: opts.sealantForm, recess: opts.recess,
-        addons: addons.slice(), benches: benches.slice(), tier: tierId,
+        manual: manual.slice(), benches: benches.slice(), tier: tierId,
         corners: ["bl", "br", "fl", "fr"].filter((k) => corners[k]),
         mode: option ? "custom" : "kit", maxIn: maxIn, tileT: tileIn,
       });
       if (!b) return null;
-      return { ...b, cfg: { ...b.cfg, source }, lines: applySession(b, buildWalls, { qtyOv, manual, panelFit }) };
+      return { ...b, cfg: { ...b.cfg, source }, lines: applySession(b, buildWalls, { qtyOv, panelFit }) };
     }
     if (manual.length) {
-      const lines = manual.filter((m) => m.qty > 0).map((m) => {
-        const it = item(m.key);
-        return it ? { item: it, qty: m.qty, group: bucketOf(it), note: "", auto: false } : null;
-      }).filter(Boolean);
+      const lines = addedRows({ manual }).map((r) => ({ item: item(r.key), qty: r.qty, group: r.group, note: "", auto: false, added: true }));
       if (!lines.length) return null;
       const soNet = round2(lines.reduce((t, l) => t + (l.item.stock ? 0 : (l.item.soNet || l.item.cost || 0) * l.qty), 0));
       const hints = [];
@@ -967,7 +966,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
       return { pan: null, lines, panelSf: 0, factory: null, hints, mode: "browse", cfg: {}, soNet };
     }
     return null;
-  }, [panKey, option, buildWalls, wallH, opts, addons, benches, qtyOv, manual, panelFit, tierId, corners, maxIn, tileIn, source]);
+  }, [panKey, option, buildWalls, wallH, opts, benches, qtyOv, manual, panelFit, tierId, corners, maxIn, tileIn, source]);
 
   // A Reconfigure opens on what the sheet says (owner 2026-09-02): the placed
   // rows are the truth once a kit lands, so a quantity typed on a row — or
@@ -981,9 +980,13 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
     rowsSeeded.current = true;
     const b = buildFromMarker(seed);
     if (!b) return;
-    const s = sessionFromRows(applySession(b, b.cfg.walls, { qtyOv: {}, manual: [], panelFit: true }), editRows);
+    const s = sessionFromRows(applySession(b, b.cfg.walls, { qtyOv: {}, panelFit: true }), editRows);
     if (Object.keys(s.qtyOv).length) setQtyOv(s.qtyOv);
-    if (s.manual.length) setManual(s.manual);
+    // a placed row's extra beyond the marker's own added lines tops up that row
+    if (s.manual.length) setManual((m) => s.manual.reduce((acc, r) => {
+      const g = bucketOf(item(r.key));
+      return setAddedRow(acc, g, r.key, addedQty(acc, g, r.key) + r.qty);
+    }, m));
     // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);
 
@@ -996,27 +999,29 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
 
   const qtyIn = (key) => (build ? build.lines.reduce((t, l) => t + (l.item.key === key ? l.qty : 0), 0) : 0);
 
+  // Added lines (Phase 1c) are manual rows keyed by bucket + key, each its own
+  // line. Browse, the chips and the figurer add under the part's own bucket;
+  // a bucket's "+" adds under that bucket.
+  const addedQty = (mm, g, key) => (addedRows({ manual: mm }).find((r) => r.key === key && r.group === g) || { qty: 0 }).qty;
+  const addTo = (g, key, n) => setManual((mm) => setAddedRow(mm, g, key, n));
+  const browseQty = (key) => addedQty(manual, bucketOf(item(key)), key);
   const step = (key, delta) => {
-    const auto = build && build.lines.find((l) => l.item.key === key && l.auto !== false);
-    if (auto) {
-      setQtyOv((o) => ({ ...o, [key]: Math.max(0, (o[key] != null ? o[key] : auto.qty) + delta) }));
-      return;
-    }
-    const m = manual.find((x) => x.key === key);
-    let next = manual;
-    if (m) {
-      const nq = Math.max(0, m.qty + delta);
-      next = nq ? manual.map((x) => (x === m ? { ...x, qty: nq } : x)) : manual.filter((x) => x !== m);
-    } else if (delta > 0) next = [...manual, { key, qty: delta }];
-    setManual(next);
-    // an add-on stepped past its last piece drops its chip too
-    if (delta < 0 && addons.includes(key) && !next.some((x) => x.key === key && x.qty > 0)) setAddons((a) => a.filter((k) => k !== key));
+    const g = bucketOf(item(key));
+    addTo(g, key, Math.max(0, browseQty(key) + delta));
+  };
+  // a build-column stepper: an added line adjusts its own row, a kit line
+  // takes a qtyOv override
+  const stepLine = (l, delta) => {
+    if (l.added) { addTo(l.group, l.item.key, Math.max(0, l.qty + delta)); return; }
+    if (l.auto === false) return step(l.item.key, delta);
+    const key = l.item.key;
+    setQtyOv((o) => ({ ...o, [key]: Math.max(0, (o[key] != null ? o[key] : l.qty) + delta) }));
   };
 
   // A re-solved room keeps the cover and curb choices: they name a finish or
   // a style, not a part, so they re-fit the new room (ADR 0049).
   const resetBuild = (keepChoices) => {
-    setQtyOv({}); setAddons([]); setBenches([]); setBenchMenu(null); setManual([]);
+    setQtyOv({}); setBenches([]); setBenchMenu(null); setManual([]);
     setOpts((o) => ({ ...DEF_OPTS, coverPick: keepChoices ? o.coverPick : undefined, curbPick: keepChoices ? o.curbPick : undefined }));
   };
   // Only a genuinely modified wall survives a room/option change (owner rule):
@@ -1322,7 +1327,8 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
     if (!diag) return { segs: [], diags: [], cuts: [] };
     const runs = curbRuns(diag.room, buildWalls, ["bl", "br", "fl", "fr"].filter((k) => corners[k]),
       (build && build.benches) || []);
-    const line = build && build.lines.find((l) => l.item.group === "curb");
+    // the kit's own curb — an added curb is a part on the bill, not a curb in the room
+    const line = build && build.lines.find((l) => l.item.group === "curb" && !l.added);
     return {
       segs: line ? runs.segs : [], diags: line ? runs.diags : [], cuts: runs.diags,
       h: line ? curbHeight(line.item) : 0, w: line ? curbWidth(line.item) : 0,
@@ -1340,18 +1346,42 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
     });
   }, [cornerOpenMap]);
 
+  // --- added lines (Phase 1c) -------------------------------------------------
+  // A bucket's "+" and an added line's ⇄ open addPanel: the bucket's parts,
+  // stepped where the swap is stepped (no Auto — an added line is a real
+  // part), a list elsewhere.
+  const addDraft = (part, e) => {
+    const kit = (hit) => build && build.lines.find((l) => !l.added && hit(l.item));
+    if (part.stepped === "curb") {
+      const c = e || kit((i) => i.group === "curb" && i.len)?.item;
+      return c ? { sub: c.sub, len: c.len, ...(c.sub === "at" ? { profile: curbProfile(c) } : {}) } : undefined;
+    }
+    if (part.stepped === "panel") return (e || kit((i) => i.group === "panel" && i.sf > 0)?.item || {}).key;
+    if (part.stepped === "cover") return (e || kit((i) => i.group === "cover")?.item || {}).key;
+    return null;
+  };
+  const openAdd = (g, ev, line) => {
+    const part = line ? wediAddPartOf(g, line.item) : wediAddParts(g)[0];
+    if (!part) return;
+    setSwap(null); setChipMenu(null);
+    setAdd({
+      g, part: part.key, qty: 1, q: "", draft: addDraft(part, line ? line.item : null), replace: line ? line.item.key : null,
+      rect: ev.currentTarget.getBoundingClientRect(), anchor: ev.currentTarget.closest(line ? ".bline" : ".bg-h"),
+    });
+  };
+  const addPool = (part) => bySource(catalog().filter(part.hit)).slice().sort((a, b) => (b.stock ? 1 : 0) - (a.stock ? 1 : 0) || a.retail - b.retail);
+  // an added line's ⇄: the part it sits in offers more than itself
+  const canSwapAdded = (l) => {
+    const part = l.added && wediAddPartOf(l.group, l.item);
+    if (!part) return false;
+    return !!part.stepped || new Set([...addPool(part).map((e) => e.key), l.item.key]).size > 1;
+  };
+
   // --- swaps ----------------------------------------------------------------
   const swapChoices = (line) => {
     const g = line.item.group;
-    if (["niche", "seat", "bench", "shelf"].includes(g)) {
-      return {
-        title: GROUP_LABEL[g], list: bySource(group(g)), set: (k) => {
-          if (!k) return;
-          setAddons((a) => a.map((x) => (x === line.item.key ? k : x)));
-          setManual((mm) => mm.map((x) => (x.key === line.item.key ? { ...x, key: k } : x)));
-        },
-      };
-    }
+    // an added line's ⇄ is the "+" panel on its own row (Phase 1c)
+    if (line.added) return null;
     // every other swap writes opts, which a Browse-only build (no pan) ignores
     // and a Browse-added line in a kit build isn't the part they pick
     if (!build || !build.pan || line.auto === false) return null;
@@ -1394,9 +1424,12 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
   const chipPick = (g, key) => {
     if (g === "recess") setOpts((o) => ({ ...o, recess: key === SKU.ramp ? "ramp" : "kit" }));
     else if (g === "coverFrame") setOpts((o) => ({ ...o, coverFrame: (item(key) || {}).finish }));
-    else setAddons((a) => [...a, key]);
+    else addTo("addon", key, addedQty(manual, "addon", key) + 1);
     setChipMenu(null);
   };
+  const gunOn = () => manual.some((m) => m.key === SKU.gun);
+  const toggleGun = () => setManual((mm) => (mm.some((m) => m.key === SKU.gun) ? mm.filter((m) => m.key !== SKU.gun)
+    : setAddedRow(mm, "addon", SKU.gun, 1)));
 
   // --- kit cards ------------------------------------------------------------
   // What each house kit sells for through the tier lens with the current wall
@@ -1476,7 +1509,8 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
     if (!build || !onBasketChange) return false;
     const entry = normKitBasketEntry({
       addedAt: Date.now(), snap: { mode: build.mode, cfg: JSON.parse(JSON.stringify(build.cfg)) },
-      session: { qtyOv: { ...qtyOv }, manual: manual.map((m) => ({ ...m })), panelFit },
+      // a kit build's added lines ride its cfg; a Browse-only build has no cfg
+      session: { qtyOv: { ...qtyOv }, ...(build.pan ? {} : { manual: manual.map((m) => ({ ...m })) }), panelFit },
       target: edit || undefined,
     });
     if (!entry) return false;
@@ -1801,15 +1835,12 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
     }).sort((a, b) => (b.stock ? 1 : 0) - (a.stock ? 1 : 0) || (a.group > b.group ? 1 : a.group < b.group ? -1 : 0) || a.retail - b.retail);
     const MAX = 48;
     const addFigured = () => {
-      let next = manual.slice();
-      fig.lines.forEach((l) => {
+      setManual((mm) => fig.lines.reduce((next, l) => {
         const cur = qtyIn(l.item.key);
-        if (cur >= l.qty) return;
-        const need = l.qty - cur;
-        const m = next.find((x) => x.key === l.item.key);
-        next = m ? next.map((x) => (x === m ? { ...x, qty: x.qty + need } : x)) : [...next, { key: l.item.key, qty: need }];
-      });
-      setManual(next);
+        if (cur >= l.qty) return next;
+        const g = bucketOf(l.item);
+        return setAddedRow(next, g, l.item.key, addedQty(next, g, l.item.key) + l.qty - cur);
+      }, mm));
       say("Sealant + fasteners added for " + sf + " sf");
     };
     return (
@@ -1892,7 +1923,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
           </div>
         </div>
         {list.slice(0, MAX).map((e) => {
-          const n = qtyIn(e.key);
+          const n = browseQty(e.key);
           // Cover FRAMES lead with what the buyer picks by — Size · Type ·
           // COLOR (color a shade bolder) — the vendor name drops to the small
           // line (owner ask 2026-07-30). Covers themselves say all three in
@@ -1961,7 +1992,8 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
           {BUCKETS.map((bk) => {
             const lines = build.lines.filter((l) => l.group === bk[0]);
             const isAddon = bk[0] === "addon";
-            if (!lines.length && !isAddon) return null;
+            const canAdd = wediAddParts(bk[0]).length > 0;
+            if (!lines.length && !isAddon && !canAdd) return null;
             return (
               <div className="bgroup" key={bk[0]}>
                 <div className="bg-h">{bk[1]}
@@ -1973,20 +2005,25 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
                       </span>
                     </span>
                   )}
+                  {canAdd && <button className="addb" title={`add another line to ${bk[1]}`} onClick={(ev) => openAdd(bk[0], ev)} data-add-group={bk[0]}>+</button>}
                 </div>
                 {lines.map((l) => {
                   const e = l.item;
                   const price = tierOf(e);
                   const ch = e.group === "panel" && panelFit ? null : swapChoices(l);
                   const can = ch && (ch.drain || ch.stepped || new Set([...ch.list.map((x) => x.key), e.key]).size + (ch.none ? 1 : 0) > 1);
+                  // tag and double-up hint only beside a kit — a Browse-only build is all added
+                  const tagged = l.added && !!build.pan;
+                  const kitAlso = tagged ? build.lines.reduce((t, k) => t + (!k.added && k.item.key === e.key ? k.qty : 0), 0) : 0;
                   return (
-                    <div className="bline" key={e.key + l.group}>
+                    <div className="bline" key={e.key + l.group + (l.added ? "+" : "")}>
                       <div className="bn">
-                        <div className="n"><FinDot e={e} />{unwedi(e.name)}</div>
+                        <div className="n"><FinDot e={e} />{unwedi(e.name)}
+                          {tagged && <span className="addtag" title="added by hand — doesn't re-figure when the room or kit changes" data-added-tag>added</span>}</div>
                         {(() => {
                           // Contents lead, the auto note follows — the line truncates from
                           // the right, and "100 ct" is the part that must survive it.
-                          const meta = [finName(e) || e.sizeText, l.note, perUnit(e, false)].filter(Boolean);
+                          const meta = [finName(e) || e.sizeText, l.note, kitAlso ? "kit also bills " + kitAlso : "", perUnit(e, false)].filter(Boolean);
                           return (
                             <div className="m" title={meta.join(" · ") || undefined}><b>{e.stock ? e.erp : "SO " + e.us}</b>
                               {meta.map((s) => " · " + s).join("")}</div>
@@ -1995,10 +2032,11 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
                       </div>
                       {can && <button className="swapb" title="swap" data-wedi-swapb={e.key} onClick={(ev) => setSwap({ key: e.key, grp: l.group, rect: ev.currentTarget.getBoundingClientRect(), anchor: ev.currentTarget.closest(".bline"),
                         ...(e.group === "cover" || e.group === "panel" ? { draft: e.key } : e.group === "curb" ? { draft: opts.curbPick || null } : {}) })}>⇄</button>}
+                      {canSwapAdded(l) && <button className="swapb" title="swap this added line" data-wedi-swapb={e.key} data-added-swapb onClick={(ev) => openAdd(l.group, ev, l)}>⇄</button>}
                       <div className="stepper">
-                        <button onClick={() => step(e.key, -1)}>−</button>
+                        <button onClick={() => stepLine(l, -1)}>−</button>
                         <span className={"q" + (l.ov ? " ov" : "")} title={l.ov ? "hand-set — auto is " + l.autoQty : undefined}>{l.qty}</span>
-                        <button onClick={() => step(e.key, 1)}>+</button>
+                        <button onClick={() => stepLine(l, 1)}>+</button>
                       </div>
                       <div className="lp" style={{ color: tierColor }}>{fm(round2(price * l.qty))}
                         <small>{fm(price)}{e.unit && e.unit !== "EA" ? "/" + e.unit.toLowerCase() : " ea"}</small></div>
@@ -2009,28 +2047,28 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
                   <div className="addchips">
                     {ADDON_CHIPS.filter((ac) => (ac[0] === "recess" ? pan && pan.sub === "curbless"
                       : ac[0] === "coverFrame" ? frameOpts.length > 0 : true)).map((ac) => {
+                      // niche · seat · bench · shelf add another each click (Phase 1c) —
+                      // one comes off on its own line's − or ⇄, never all at once
+                      const many = ["niche", "seat", "bench", "shelf"].includes(ac[0]);
+                      const count = many ? build.lines.reduce((t, l) => t + (l.item.group === ac[0] ? l.qty : 0), 0) : 0;
                       const on = ac[0] === "gun" ? build.lines.some((l) => l.item.key === SKU.gun)
                         : ac[0] === "recess" ? build.lines.some((l) => l.item.group === "recess" || l.item.group === "ramp")
                           : build.lines.some((l) => l.item.group === ac[0]);
                       return (
-                        <button key={ac[0]} className={"addchip" + (on ? " on" : "")} onClick={(ev) => {
-                          if (ac[0] === "gun") { setAddons((a) => (a.includes(SKU.gun) ? a.filter((k) => k !== SKU.gun) : [...a, SKU.gun])); return; }
-                          const cur = build.lines.find((l) => ac[0] === "recess"
+                        <button key={ac[0]} className={"addchip" + (on ? " on" : "")} data-wedi-chip={ac[0]} onClick={(ev) => {
+                          if (ac[0] === "gun") { toggleGun(); return; }
+                          const cur = !many && build.lines.find((l) => ac[0] === "recess"
                             ? l.item.group === "recess" || l.item.group === "ramp" : l.item.group === ac[0]);
                           if (cur) {
                             if (ac[0] === "recess") setOpts((o) => ({ ...o, recess: "none" }));
                             else if (ac[0] === "coverFrame") setOpts((o) => ({ ...o, coverFrame: undefined }));
-                            else {
-                              setAddons((a) => a.filter((k) => { const it = item(k); return !it || it.group !== ac[0]; }));
-                              setManual((mm) => mm.filter((m) => { const it = item(m.key); return !it || it.group !== ac[0]; }));
-                            }
                             setQtyOv((o) => { const n = { ...o }; delete n[cur.item.key]; return n; });
                           } else {
                             const ch = chipChoices(ac[0]).filter(Boolean);
                             if (ch.length > 1) setChipMenu({ group: ac[0], label: ac[1], rect: ev.currentTarget.getBoundingClientRect(), anchor: ev.currentTarget });
                             else if (ch.length) chipPick(ac[0], ch[0].key);
                           }
-                        }}>{(on ? "✓ " : "+ ") + ac[1]}</button>
+                        }}>{(on ? "✓ " : "+ ") + ac[1] + (count > 1 ? " ×" + count : "")}</button>
                       );
                     })}
                   </div>
@@ -2041,7 +2079,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
 
           {build.hints.includes("sausage-gun") && (
             <div className="whint">Sausage sealant with no gun on the job
-              <button onClick={() => setAddons((a) => (a.includes(SKU.gun) ? a : [...a, SKU.gun]))}>Add gun {fm(tierOf(item(SKU.gun)))}</button>
+              <button onClick={() => { if (!gunOn()) toggleGun(); }}>Add gun {fm(tierOf(item(SKU.gun)))}</button>
             </div>
           )}
           {build.hints.includes("small-order") && (
@@ -2282,6 +2320,81 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
     );
   })();
 
+  const addPanel = (() => {
+    if (!add || !build) return null;
+    const parts = add.replace ? [wediAddPartOf(add.g, item(add.replace))].filter(Boolean) : wediAddParts(add.g);
+    const part = parts.find((p) => p.key === add.part) || parts[0];
+    if (!part) return null;
+    const setA = (patch) => setAdd((a) => (a ? { ...a, ...patch } : a));
+    const r = add.rect;
+    const at = { anchor: add.anchor, x: r.right - 470, y: r.bottom + 6 };
+    const partRow = !add.replace && parts.length > 1 ? [{ label: "Part", chips: parts.map((p) => ({
+      key: p.key, label: p.label, ok: true, on: p.key === part.key, onPick: () => setA({ part: p.key, draft: addDraft(p, null), q: "" }) })) }] : [];
+    const bucketLabel = (BUCKETS.find((b) => b[0] === add.g) || [])[1] || add.g;
+    const title = add.replace ? `Swap the added ${part.label.toLowerCase()}` : `Add to ${bucketLabel}`;
+    const oldQty = add.replace ? addedQty(manual, add.g, add.replace) : 0;
+    const old = add.replace ? item(add.replace) : null;
+    const sell = round2(build.lines.reduce((t, l) => t + tierOf(l.item) * l.qty, 0));
+    const summaryFor = (e) => {
+      const q = add.replace ? oldQty : add.qty;
+      const d = round2(tierOf(e) * q - (old ? tierOf(old) * q : 0));
+      return { what: (q > 1 ? q + " × " : "") + unwedi(e.name) + (e.stock ? "" : " · special order"), why: e.stock ? e.erp : "SO " + e.us, delta: fmDelta(d), total: fm(round2(sell + d)), up: d > 0 };
+    };
+    const use = (e) => {
+      if (add.replace) {
+        if (e.key !== add.replace) setManual((mm) => setAddedRow(setAddedRow(mm, add.g, add.replace, 0), add.g, e.key, addedQty(mm, add.g, e.key) + oldQty));
+      } else setManual((mm) => setAddedRow(mm, add.g, e.key, addedQty(mm, add.g, e.key) + add.qty));
+      setAdd(null);
+    };
+    if (part.stepped) {
+      const chip = (c) => ({ ...c, label: inchGlyph(c.label), onPick: () => setA({ draft: c.next }) });
+      let rows = [], e = null;
+      if (part.stepped === "curb") {
+        const o = curbAddOptions(add.draft);
+        rows = [{ label: "Style", chips: o.styles.map(chip) }, { label: "Profile", chips: o.profiles.map(chip) }, { label: "Length", chips: o.lengths.map(chip) }];
+        e = o.item;
+      } else if (part.stepped === "panel") {
+        const o = panelOptions(add.draft);
+        rows = [{ label: "Type", chips: o.types.map(chip) }, { label: "Thickness", chips: o.thicknesses.map(chip) }, { label: "Size", chips: o.sizes.map(chip) }];
+        e = o.cur;
+      } else {
+        const o = coverAddOptions(add.draft);
+        rows = [{ label: "Size", chips: o.sizes.map(chip) }, { label: "Style", chips: o.styles.map(chip) }, { label: "Finish", chips: o.finishes.map(chip) }];
+        e = o.cur;
+      }
+      return (
+        <SwapPop add at={at} className="wedi-swap wedi-grown" title={title} rows={[...partRow, ...rows]} stockFirst={source === "stock"}
+          {...(add.replace ? {} : { qty: add.qty, onQty: (n) => setA({ qty: n }) })}
+          summary={e ? summaryFor(e) : { what: "Nothing in the book", why: "", delta: "", total: "" }}
+          onUse={() => e && use(e)} onClose={() => setAdd(null)} />
+      );
+    }
+    const all = addPool(part);
+    const toks = add.q.toLowerCase().split(/\s+/).filter(Boolean);
+    const list = all.filter((e) => toks.every((t) => (e.name + " " + e.us + " " + e.erp + " " + (e.sizeText || "")).toLowerCase().includes(t)));
+    return (
+      <SwapPop add at={at} className="wedi-swap wedi-grown" title={title} rows={partRow} onClose={() => setAdd(null)}>
+        {all.length > 12 && (
+          <input className="w-full rounded-md border border-slate-300 px-2 py-1 mb-1 text-[12px]" autoFocus value={add.q}
+            placeholder={`Search ${part.label.toLowerCase()}…`} onChange={(ev) => setA({ q: ev.target.value })} data-add-search />
+        )}
+        <div className="wedi-swap wedi-grown">
+          {list.slice(0, 60).map((e) => {
+            const n = addedQty(manual, add.g, e.key);
+            return (
+              <button key={e.key} className={"srow" + (add.replace === e.key ? " on" : "") + (e.stock ? " stk" : "")} onClick={() => use(e)} data-add-row={e.key}>
+                <span className={"sdot" + (e.stock ? "" : " so")} />
+                <span className="n"><FinDot e={e} />{(!add.replace && n ? `✓ ×${n} ` : "") + unwedi(e.name)}
+                  <small>{[finName(e), e.sizeText, e.stock ? e.erp : "SO — " + e.us].filter(Boolean).join(" · ")}</small></span>
+                <span className="p">{fm(tierOf(e))}</span>
+              </button>
+            );
+          })}
+        </div>
+      </SwapPop>
+    );
+  })();
+
   // The add-on chip picker: same anchored popover as a swap, listing the
   // chip's possible parts — a chip with one part never gets here.
   const chipPanel = (() => {
@@ -2378,7 +2491,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
             onClick={() => {
               if (wallMenu.extra) setExtraWalls((xs) => xs.filter((x) => x.id !== wallMenu.wid));
               else setWalls((ws) => ws.map((x) => (x.id === wallMenu.wid ? { ...x, on: false, len: "", h: "", faces: "in" } : x)));
-              if (build && !build.lines.some((l) => l.item.group === "curb"))
+              if (build && !build.lines.some((l) => l.item.group === "curb" && !l.added))
                 setOpts((o) => ({ ...o, curbPick: pan && pan.sub === "curbless" ? { sub: "lean" } : undefined }));
               setWallMenu(null);
               say("Wall turned into a curb — the run butts the walls square, figured at its longest point");
@@ -2727,6 +2840,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
       </div>
       {swapPanel}
       {chipPanel}
+      {addPanel}
       {wallMenuPanel}
       {benchMenuPanel}
       {confirmModal}
```

```diff
diff --git a/.scratch/158_shower-config-roadmap/p1b/shoot-wedi.mjs b/.scratch/158_shower-config-roadmap/p1b/shoot-wedi.mjs
index eeb270f..96a4016 100644
--- a/.scratch/158_shower-config-roadmap/p1b/shoot-wedi.mjs
+++ b/.scratch/158_shower-config-roadmap/p1b/shoot-wedi.mjs
@@ -180,7 +180,8 @@ for (const [sec, row] of [[/^Curbs/, /Lean/], [/^Fasteners/, /Tabless/], [/^Seal
 }
 await pg.waitForSelector(".bline", { timeout: 5000 });
 for (const re of [/Curb/, /Fastener/, /Joint Sealant/i]) {
-  const n = await line(re).count() ? await line(re).locator(".swapb").count() : -1;
+  // 1c: an added line has its own ⇄ (data-added-swapb) that writes its row; no kit ⇄
+  const n = await line(re).count() ? await line(re).locator(".swapb:not([data-added-swapb])").count() : -1;
   console.log(`browse-only ${re}:`, n < 0 ? "no line" : n ? "⇄" : "no ⇄", "|", n < 0 ? "" : await lineText(re));
   if (n < 0) fail(`the Browse-only build has no ${re} line`);
   if (n > 0) {
@@ -219,7 +220,8 @@ await pg.locator("[data-wedi-pan='US9200007']").click(); await pg.waitForTimeout
 await pg.locator(".modetab", { hasText: "Browse" }).click(); await pg.waitForTimeout(500);
 await pg.locator(".ft-hopt", { hasText: /^Curbs/ }).click(); await pg.waitForTimeout(300);
 await pg.locator(".brow", { hasText: /Lean/ }).first().locator(".stepper button", { hasText: "+" }).click(); await pg.waitForTimeout(500);
-const manualCurb = await line(/Curb(?!less)/).count() ? await line(/Curb(?!less)/).locator(".swapb").count() : -1;
+// 1c: an added line has its own ⇄ (data-added-swapb) that writes its row; no kit ⇄
+const manualCurb = await line(/Curb(?!less)/).count() ? await line(/Curb(?!less)/).locator(".swapb:not([data-added-swapb])").count() : -1;
 console.log("kit + Browse curb:", manualCurb < 0 ? "no line" : manualCurb ? "⇄" : "no ⇄", "|", manualCurb < 0 ? "" : await lineText(/Curb(?!less)/));
 if (manualCurb < 0) fail("the Browse-added curb did not land in the kit build");
 if (manualCurb > 0) {
```

- [ ] **Step 2: Static checks**

Run: `npx eslint src/WediConfigurator.jsx` → clean. Run: `npm test` →
`# fail 0`. Run the build → built.

- [ ] **Step 3: Write the proof script** — create
  `.scratch/158_shower-config-roadmap/p1c/shoot-wedi.mjs`:

```js
// Proof: "+" on every wedi bucket (ticket 158 Phase 1c) — two niches of
// different sizes ("✓ Niche ×2"), a stepped panel add with "kit also bills",
// a stepped curb add with no Auto or No curb, an added line's own ⇄, − taking
// one niche off (not both), a land + Reconfigure round trip that keeps the
// added lines without doubling, and a curb added to a curbless kit billed but
// not drawn.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p1c/shoot-wedi.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p1c";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1120 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const fail = (m) => { console.error("FAIL:", m); err = true; };
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const flat = (t) => t.replace(/\n+/g, " | ");
const pop = async () => flat(await pg.locator("[data-add-pop]").innerText());
const grp = (name) => pg.locator(".bgroup", { has: pg.locator(".bg-h", { hasText: new RegExp("^" + name, "i") }) });
const grpText = async (name) => flat(await grp(name).innerText());
const plus = async (g) => { await pg.locator(`[data-add-group="${g}"]`).click(); await pg.waitForSelector("[data-add-pop]", { timeout: 5000 }); await pg.waitForTimeout(200); };
const drawing = async () => pg.locator("svg").evaluateAll((els) => els.map((e) => e.outerHTML).join(""));

await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500); // Full catalog
await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout(800); // 36×60

const groups = await pg.locator("[data-add-group]").evaluateAll((els) => els.map((e) => e.getAttribute("data-add-group")));
console.log("+ on:", groups.join(", "));
if (groups.join() !== "floor,walls,bench,drain,install,addon") fail("not every bucket has a +");

// two niches of different sizes through the chip — it adds another each click
for (const nth of [0, 3]) {
  await pg.locator('[data-wedi-chip="niche"]').click(); await pg.waitForTimeout(300);
  await pg.locator(".wedi-chipmenu .srow").nth(nth).click(); await pg.waitForTimeout(300);
}
const addons = await grpText("Add-ons");
console.log("Add-ons:", addons);
if ((await grp("Add-ons").locator("[data-added-tag]").count()) !== 2) fail("two niche sizes did not land as two added lines");
if (!/✓ Niche ×2/.test(addons)) fail("the niche chip does not read ✓ Niche ×2");
await shot("w1-two-niches");

// a stepped panel add: the kit's panel again, qty 2 — its own line, "kit also bills 2"
await plus("walls");
if (await pg.locator('[data-drain-chip^="Size:auto"]').count()) fail("the panel + shows an Auto chip");
await pg.locator("[data-add-qty] button").nth(1).click(); await pg.waitForTimeout(200);
console.log("panel +:", await pop());
await shot("w2-panel-add");
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(500);
const walls = await grpText("Walls");
console.log("Walls:", walls);
if (!/kit also bills 2/.test(walls)) fail("the added panel lacks 'kit also bills 2'");
const wallLines = await grp("Walls").locator(".bline").evaluateAll((els) => els.map((e) => !!e.querySelector("[data-added-tag]")));
if (wallLines[wallLines.length - 1] !== true || wallLines.slice(0, -1).some(Boolean)) fail("the added panel is not its own line below the kit's");
await shot("w3-panel-kit-also");

// a stepped curb add: Style → Length, no Auto, no No curb
await plus("floor");
await pg.locator('[data-drain-chip="Part:curb"]').click(); await pg.waitForTimeout(300);
const curbPop = await pop();
console.log("curb +:", curbPop);
if (/Auto|No curb/.test(curbPop)) fail("the curb + offers Auto or No curb");
await shot("w4-curb-add");
await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);

// an added niche's own ⇄: a list of niches, the row it replaces lit
await grp("Add-ons").locator("[data-added-swapb]").first().click(); await pg.waitForTimeout(300);
console.log("added ⇄:", (await pop()).slice(0, 200));
if (!/Swap the added niche/.test(await pop())) fail("the added niche's ⇄ is not its own panel");
await shot("w5-added-swap");
await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);

// − on one niche takes that one off, not both
await grp("Add-ons").locator(".bline").first().locator(".stepper button").first().click(); await pg.waitForTimeout(400);
if ((await grp("Add-ons").locator(".bline").count()) !== 1) fail("− on one niche did not leave the other");

// land + Reconfigure: the added lines come back, nothing doubles
const before = await grpText("Walls") + await grpText("Add-ons");
await pg.locator("[data-wedi-add]").click();
await pg.waitForSelector("[data-wedi-confirm]", { timeout: 5000 });
await pg.locator("[data-wedi-confirm]").click(); await pg.waitForTimeout(600);
await pg.locator("[data-sheet-reconfig]").first().click();
await pg.waitForSelector(".stepper", { timeout: 5000 }); await pg.waitForTimeout(900);
const after = await grpText("Walls") + await grpText("Add-ons");
console.log("reopened:", after);
if (after !== before) fail("Reconfigure did not reopen the added lines as they were");
await shot("w6-reconfigure-round-trip");

// a curb added to a curbless kit bills but isn't drawn
await pg.getByRole("button", { name: "Clear design" }).click(); await pg.waitForTimeout(400);
await pg.locator("[data-wedi-pan='US9200007']").click(); await pg.waitForTimeout(800);
const flat0 = await drawing();
await plus("floor");
await pg.locator('[data-drain-chip="Part:curb"]').click(); await pg.waitForTimeout(300);
await pg.locator("[data-drain-use]").click(); await pg.waitForTimeout(600);
if (!(await pg.locator(".bline", { hasText: /Curb(?!less)/ }).count())) fail("the added curb did not bill");
if ((await drawing()) !== flat0) fail("the drawing changed for an added curb");
await shot("w7-curbless-added-curb-not-drawn");

await b.close();
if (err) { console.error("— FAILED"); process.exit(1); }
console.log("— all checks passed");
```

- [ ] **Step 4: Shoot**

Start the preview server; run
`node .scratch/158_shower-config-roadmap/p1c/shoot-wedi.mjs`.
Expected: `— all checks passed`, seven PNGs `w1…w7`. Then prove the
curb-drawing check bites: temporarily drop `&& !l.added` from the `curb`
memo's `find`, re-run → `FAIL: the drawing changed for an added curb`; restore
it (`git diff src/WediConfigurator.jsx` shows no change from Step 1's result).
Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/WediConfigurator.jsx .scratch/158_shower-config-roadmap/p1b/shoot-wedi.mjs .scratch/158_shower-config-roadmap/p1c/shoot-wedi.mjs .scratch/158_shower-config-roadmap/p1c/w*.png
git commit -m "wedi popup: + on every bucket, addons retire into added lines, chips add another (1c)"
```

---

### Task 7: Re-run the 1a / 1b proof

**Files:**
- Modify (re-rendered PNGs only): `.scratch/158_shower-config-roadmap/p1a/*.png`,
  `.scratch/158_shower-config-roadmap/p1b/*.png`

- [ ] **Step 1: Run every older script**

With the preview server up, run each of
`.scratch/158_shower-config-roadmap/p1a/shoot-schluter.mjs`, `p1a/shoot-wedi.mjs`,
`p1b/shoot-schluter.mjs`, `p1b/shoot-wedi.mjs`, `p1b/shoot-band-default.mjs`,
`p1b/shoot-finish-names.mjs`. Expected: no `FAIL` and no `PAGEERROR` in any.

- [ ] **Step 2: Keep only real changes**

The build column now shows a "+" on every group header, so re-rendered shots
that include the build column changed for real — keep those. Restore
(`git checkout -- <png>`) any PNG whose only difference is noise (open both
versions and compare). List which were kept in the commit message.

- [ ] **Step 3: Commit**

```bash
git add .scratch/158_shower-config-roadmap/p1a .scratch/158_shower-config-roadmap/p1b
git commit -m "Proof: 1a/1b shots re-rendered with the group + (1c)"
```

---

### Task 8: Records and full verification

**Files:**
- Modify: `docs/adr/0049-configurator-swaps-remember-the-choice.md`,
  `docs/superpowers/specs/2026-09-27-add-another-design.md`, `src/CLAUDE.md`,
  `src/model.js` (one comment), `.claude/skills/floortrack-data-model/SKILL.md`,
  `.scratch/158_shower-config-roadmap/ticket.md`
- Create: `.scratch/handoffs/shower-config-phase1d-2026-09-27.md`

- [ ] **Step 1: ADR 0049 amendment** — append a section
  `## Amendment (2026-09-27): add another line (Phase 1c)`:
  1. Added lines are **parts + a hand-set qty**, never choices; they don't
     re-fit. One list per brand in the marker: Schluter `cfg.manual`
     `{ sku, qty, g? }`, wedi `cfg.manual` `{ key, qty, group? }` (wedi's
     first time in the marker; `kitFor` bills and writes it). Rows key on
     group + part; an added line is always its own line.
  2. **Translation on read:** a Schluter row with no `g` files where the kit
     bills that part (`addedGroup`) — it moves out of Extras on screen and
     print, its qty and the total unchanged; wedi `addons` become rows in the
     add-on bucket (a key twice = qty 2) and are never written again.
     `src/addedgolden.test.js` pins every old shape.
  3. The "+" popover is the ⇄ popover (`SwapPop`) with Auto dropped; an added
     line's ⇄ replaces only its own row. This replaces 1b's rule that hid
     opts-backed ⇄ on Browse-added lines in a wedi kit build.
  4. The wedi curb drawing (and "Turn into a curb") follow only the kit's own
     curb.

- [ ] **Step 2: Spec amendments** — replace `_None yet._` under "Amendments
  during planning and build" in the 1c spec with the calls made in planning
  (and any the build adds, from the SDD ledger):
  - **A point build's Drain "+" has no whole-drain part** — the Part row reads
    Grate · Body · Flange and opens on Grate; the whole drain (Length row) is
    a linear build's.
  - **Drain "+" has a Body part** (channels and KERDI-LINE bodies), so an
    added body line has a ⇄ list.
  - **Schluter Niche picker rows add another** (`✓ ×n`); they used to toggle.
  - **wedi premade-bench kit line loses a ⇄ that never billed** (it rewrote
    `addons`, which the bench recipe doesn't read).
  - **A kit build's staged session no longer carries `manual`**; a basket
    entry staged before 1c still applies its `session.manual`, each its own
    line.
  - **wedi `kitFor` bills added rows itself** (at the old add-on position), so
    an added sealant gun now clears the sausage-gun hint and added lines count
    toward the special-order net.

- [ ] **Step 3: `src/CLAUDE.md`** — update the entries for `schluter.js`,
  `wedi.js`, `swappop.jsx`, `showersf.js`, `SchluterConfigurator.jsx` and
  `WediConfigurator.jsx` with the new exports and behaviour from Tasks 2–6, and
  add `addedgolden.js` / `addedgolden.test.js` beside the `wedimarkergolden`
  entries (generated by `tools/gen-added-golden.mjs`, never hand-edited).

- [ ] **Step 4: Data-model records**
  - `src/model.js`, the comment above `normKitSession`: the session's
    `manual` is now only a Browse-only wedi build's (or an entry staged before
    1c); kit builds' added lines ride the marker on both brands.
  - `.claude/skills/floortrack-data-model/SKILL.md`, the `*Basket` note: the
    same correction, and the wedi marker's `cfg.manual` `{ key, qty, group }`
    / Schluter rows' `g`.

- [ ] **Step 5: Ticket and handoff**
  - Ticket 158: a **1c DONE (2026-09-27)** block (spec, plan, ADR, proof
    `p1c/`, PR); trim the carry-over list — the merged-line ⇄ and the curb
    drawing items are resolved; the bench-board shared qty stays.
  - Handoff `.scratch/handoffs/shower-config-phase1d-2026-09-27.md` for 1d
    (shared group names, Compare alignment), in the house style of the 1c
    handoff.

- [ ] **Step 6: Full verification**

Run: `npm test` (`# fail 0`), `npm run lint` (clean), the build (built), both
p1c scripts (`— all checks passed`).

- [ ] **Step 7: Commit**

```bash
git add docs src/CLAUDE.md src/model.js .claude/skills/floortrack-data-model/SKILL.md .scratch/158_shower-config-roadmap/ticket.md .scratch/handoffs/shower-config-phase1d-2026-09-27.md
git commit -m "Records: ADR 0049 1c amendment, spec amendments, CLAUDE.md, ticket, handoff"
```

