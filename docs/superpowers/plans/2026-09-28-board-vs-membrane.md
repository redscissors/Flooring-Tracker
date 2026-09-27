# Board vs Membrane (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Both shower configurators offer the same wall-system fork. wedi
gains **Membrane (S-DRY)** beside **Building Panel**: an S-DRY base with
extensions, the S-DRY curb, drain and cover, and S-DRY membrane walls billed
from wedi's published rates. When no S-DRY base fits, the owner picks a
fallback. Schluter's "KERDI over backer" is renamed **Membrane**. Compare
builds the other brand on the host's wall system.

**Architecture:**
- **New `src/sdry.js`, pure and engine-free.** The caller hands in its
  catalog, so wedi.js imports it and it never imports wedi.js.
  - `sdryFit` lists the S-DRY floor options in the wedi solver's option
    shape.
  - `sdryNearest` is the "use the nearest base anyway" answer.
  - `sdryCurb` bills the curb.
  - `sdryWalls` bills membrane, tape, corners, collars and SEAL.
  - `sdryProSet` counts PRO-SET bags.
  - `sdryRole` / `sdrySlot` read a part's role and slot off its SKU.
- **wedi.js takes the choice, never the part (ADR 0049).**
  - `kitFor(pan, { wallSys: "membrane", sdryBase })` bills S-DRY walls in
    place of Building Panel.
  - An S-DRY pan under Membrane also bills the S-DRY floor recipe.
  - `solve({ ...input, system: "sdry", nearest? })` runs the S-DRY fit.
  - `buildFromMarker` passes both fields back through.
  - An absent `wallSys` bills exactly as today, so no saved kit moves.
- **The wedi popup holds the fork as state.**
  - State: `wallSys`, `sdryBase`, `sdryNear`, and `sdryAsk` for the
    reopened prompt.
  - It re-solves when they change.
  - It shows the S-DRY bases on the Kits tab, the S-DRY options on the
    Custom tab, and the no-fit prompt, plus a bill chip when the floor isn't
    an S-DRY fit.
- **Compare follows the host's wall system.**
  - `wediBuildFor` / `schluterBuildFor` take `wallSys`.
  - wedi falls back to a wedi pan with S-DRY walls when S-DRY can't fit.
  - Column headers name each side's system.

**Tech Stack:** React 18 (hooks), Vite 5, Tailwind, plain `node --test`
(`npm test` = `node --test src/*.test.js`), ESLint (`npm run lint`), Playwright
for preview proof.

**Spec:** `docs/superpowers/specs/2026-09-28-board-vs-membrane-design.md`.
Read it first, especially **Sourced rates**, which gives every rate's source.
It builds on ADR 0049 (`docs/adr/0049-configurator-swaps-remember-the-choice.md`,
amended for 1b–1d) and ADR 0034 (`docs/adr/0034-cross-vendor-compare.md`).
The ticket is `.scratch/158_shower-config-roadmap/ticket.md` (Phase 2).

**Prototype:** every diff below was first run in a scratch worktree off
`864c51f` (the spec commit). There it had:
- the full suite green (1814 tests after Task 6);
- lint clean and the build succeeding;
- both new p2 proof scripts ending "all checks passed".

The tasks were then re-applied in order on a fresh checkout of `864c51f`. Each
task's diff applies with `git apply` on top of the previous task's, and the
suite stays green after every task.

## Global Constraints

- **No saved kit's bill moves.** Three goldens stay green and untouched:
  - `src/wedimarkergolden.test.js` (1b)
  - `src/addedgolden.test.js` (1c)
  - `src/wallsysgolden.test.js` (Task 1 — every wedi kit card, every room
    solve built and reopened, both Schluter wall systems, Compare's default
    builds)

  Run `npm test` after every task. It must end `# fail 0`.
- **The wall system is a choice, not a part (ADR 0049).**
  - `cfg.wallSys` is `"membrane"` or absent (Building Panel).
  - `cfg.sdryBase` is `"wedi"` or absent (S-DRY).
  - Any other value reads as the default.
  - Never write the resolved parts into the marker.
- **The S-DRY floor recipe rides Membrane.** Bonding drain, S-DRY cover and
  S-DRY curb apply only when the pan is an S-DRY base **and**
  `wallSys === "membrane"`. The 1b golden pins an S-DRY pan's old bill with no
  `wallSys`; it must not move.
- **`sdry.js` never imports `wedi.js`** — the caller passes `catalog()`.
- **Display group = `groupOf(line.slot)`.** Every S-DRY line gets its slot
  through `wediSlotOf` → `sdrySlot`.
- **Rates are wedi's published ones**, from the spec's Sourced rates. Don't
  change them:
  - PRO-SET 100 sf per bag at the 1/8″ notch;
  - SEAL ~45 lf per unit;
  - tape 32 lf per roll;
  - curb 72″;
  - membrane +10% for laps.
- **comparekit.js stays the only module importing both engines.**
  WediConfigurator.jsx may import `sdry.js` (pure, lazy chunk) but never
  `comparekit.js` (ADR 0026).
- **Commits** end with the session's trailer lines (the executing session's
  own). Never push to `main`, and never touch the live Supabase project.
- **UI proof:** Task 7's scripts must print "all checks passed". The before
  shots come from Task 1, taken before any code changes.

## File Structure

| File | Task | Responsibility |
|---|---|---|
| `.scratch/158_shower-config-roadmap/tools/gen-wallsys-golden.mjs` | 1 | Generator: captures today's bills |
| `src/wallsysgolden.js` | 1 | GENERATED golden data — never hand-edited |
| `src/wallsysgolden.test.js` | 1 | Golden test |
| `.scratch/158_shower-config-roadmap/p2/shoot-before.mjs` | 1 | Before shots, on pre-change code |
| `src/sdry.js` | 2 | S-DRY fit, curb, walls, PRO-SET, role/slot — pure |
| `src/sdry.test.js` | 2 | Its tests |
| `src/wedi.js` | 3 | `kitFor` wall system + S-DRY floor, `solve` system, `buildFromMarker`, slots, "+" parts, `sdryNoFit`, `markerCurbKey` |
| `src/wedi.test.js` | 3 | "+" parts expectation update |
| `src/wedisdry.test.js` | 3, 4 | Engine integration (3) + Compare (4) tests |
| `src/comparekit.js` | 4 | `wallSys` in both build-fors; the wedi backer note row |
| `src/WediConfigurator.jsx` | 5 | The fork, S-DRY cards, S-DRY options, the prompt, chip, subtitle, hint, print, swaps |
| `src/CompareTab.jsx` | 6 | Other side follows the host; headers; help tip |
| `src/SchluterConfigurator.jsx` | 6 | "Membrane" rename, subtitle |
| `.scratch/158_shower-config-roadmap/p2/shoot-{wedi,compare}.mjs` | 7 | Proof |
| ADR 0051, ADR 0034/0049 amendments, data-model skill, `src/CLAUDE.md`, spec amendments, ticket, Phase 3 handoff | 8 | Records |

## Rulings made while prototyping (record them in Task 8)

Each of these is a call the spec left open or got wrong. The prototype made
it; Task 8 writes each one into the spec's "Amendments during planning and
build" section, and the ADR records the load-bearing ones.

1. **The S-DRY floor recipe rides Membrane.** An S-DRY pan with no `wallSys`
   (a shape only an old marker can carry; the 1b golden pins it) bills exactly
   as before. The first prototype applied the S-DRY recipe to every S-DRY pan,
   and the 1b golden caught it.
2. **The backer is a build hint, not a bill line.** wedi lines have no
   `noteOnly` concept. Instead:
   - `kitFor` pushes hint `"backer"`;
   - the bill shows it as a `whint`;
   - the print sheet adds it under "Cuts & install notes";
   - Compare writes the same $0 note row the Schluter column carries
     (`wediCompareRows`).
3. **Membrane drops, from the walls:**
   - the Building Panel line;
   - the fastener kit and joint sealant, figured on wall sf;
   - the wedi collars (`US5000000` / `US5000033`), replaced by the S-DRY
     collars;
   - the corner putty trowel (`US5000044`).

   PRO-SET becomes 1 + ⌈membrane sf ÷ 100⌉.
4. **Benches stay panel-based under Membrane.** Their wrap and board lines
   bill as today, and fasteners and joint sealant are figured on the bench
   surfaces only.
5. **The S-DRY solve.**
   - `solve({ ...input, system: "sdry" })` returns `sdryFit`'s options;
     `nearest: true` returns `[sdryNearest]`. Both flags ride the option's
     `input`, so `buildFromMarker` re-solves the same answer.
   - The S-DRY fit ignores the Max-curb-inside inset, the drain pin and
     "Pan against": the base is cut evenly. The popup disables those inputs
     under S-DRY.
   - `sdryNoFit(input)` is exported for the prompt, and the popup passes it
     the Stock only source.
6. **`cfg.sdryBase: "wedi"` is derived.** kitFor writes it from
   `opts.sdryBase`. The popup passes `"wedi"` whenever Membrane sits on a
   non-S-DRY pan. The popup's own `sdryBase` state is the owner's prompt
   answer, and it decides which solve runs.
7. **Two extensions side by side** are allowed along a base edge of 49–96″.
   The S-DRY bases' longest edge is 72″, so this is the spec's "along 72″".
   Extensions sit on the back (depth) or left (width) side. The footprint is
   then cut evenly back to the room. An extension that isn't cut carries no
   cut, so the cut list doesn't show "Cut to 48×24 (from 48×24)".
8. **Roll coverage** is read from the name ("104sf"), else from wedi's
   published `ROLL_SF` constant. The distribution pricelist names the roll
   "S-DRY™ XL" with no sf, and the preview proved it.
9. **Tape lf, the curb term** = entry width + 12″ (the two curb ends).
10. **S-DRY cover and curb ⇄** are one-click lists.
    - Cover: every S-DRY cover.
    - Curb: Full / Lean / No curb.
    - They store the usual `coverPick: { key }` and `curbPick: { sub: "lean" }`
      / `{ none: true }`.
    - A non-S-DRY cover pick (e.g. a Fundo cover carried over) falls back to
      S-DRY stainless.
11. **Compare's KERDI-BOARD side bills the Fit plan** (`applyBoardPlan`),
    which is the Schluter popup's default.
12. **The curb drawing and tile sf read the S-DRY curb.** The popup's `curb`
    memo and `markerCurbKey` both know it; the S-DRY curb is group `sdry`, not
    `curb`.
13. **Flipping the wall system:**
    - On the Custom tab, or with an option picked, it re-solves and picks the
      top option.
    - On the Kits tab, it refreshes the cards only.
    - A loaded S-DRY kit (no option) flipped to Building Panel clears the
      build.
    - A loaded wedi kit flipped to Membrane keeps its pan with S-DRY walls,
      and the chip says so.
    - The re-solve runs in an effect keyed on
      `wallSys|sdryBase|sdryNear`, so it reads the new state rather than a
      stale closure.
14. **The prompt** shows when Membrane + S-DRY finds no fit, or when the bill
    chip reopens it. Its buttons:
    - "S-DRY base, fit to the room" (only when one fits);
    - "Use a wedi pan + curb, with S-DRY walls";
    - "Use the nearest S-DRY base anyway";
    - "Back to Building Panel".
15. **The Fit panel plan skips a build with no kit panel line.** Under
    Membrane it used to replace the membrane line with panel sheets; the
    preview caught it (`applyPanelFit` guard).
16. **Showroom samples stay out of Extras "+".** S-DRY samples (`US7076001`/`2`,
    role `other`) are excluded; before Phase 2 their slot was `seam`, so they
    never showed.
17. **Compare's help tip** drops the "not apples-to-apples" walls caveat. Both
    columns are now always on the same wall system. The delta line never
    carried a walls caveat.
18. **The S-DRY Kits cards** price the full S-DRY build at the popup's current
    wall setup, the same rule every other card follows.

---

### Task 1: The wall-system golden, plus the before shots (on pre-change code)

Model: Sonnet (mechanical). It must run **before any code change**, because
it captures today's bills and today's screens.

**Files:**
- Create: `.scratch/158_shower-config-roadmap/tools/gen-wallsys-golden.mjs`
- Create (generated): `src/wallsysgolden.js`
- Create: `src/wallsysgolden.test.js`
- Create: `.scratch/158_shower-config-roadmap/p2/shoot-before.mjs`
- Create (shots): `.scratch/158_shower-config-roadmap/p2/before-{wedi-kits,wedi-compare,schluter-kits}.png`

**Interfaces:**
- Consumes: today's `kitFor`, `solve`, `buildFromMarker`, `pans`, `group`
  (wedi.js); `catalogOf`, `trayCandidates`, `buildKit` (schluter.js);
  `wediBuildFor`, `schluterBuildFor` (comparekit.js), called with no
  wall-system argument.
- Produces: `CARDS`, `SOLVES`, `SCHLUTER`, `COMPARE` exports in
  `src/wallsysgolden.js`, which pin every later task.

- [ ] **Step 1: Take the before shots.** Start vite
  (`npx vite --port 5199`, background). Create
  `.scratch/158_shower-config-roadmap/p2/shoot-before.mjs`:

```js
// Before shots for Phase 2 (ticket 158) — run on the pre-change code, before
// Task 1: the wedi Kits tab + a Building Panel bill, the Schluter Kits tab's
// "KERDI over backer" segment, and Compare from the wedi host.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p2/shoot-before.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p2";
const PORT = process.env.PORT || 5199;
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1300 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const toCompare = async () => { await pg.locator(".modetab", { hasText: "Compare" }).dispatchEvent("click"); await pg.waitForSelector(".cmp-grid [data-cmp-group]", { timeout: 20000 }); await pg.waitForTimeout(800); };

await pg.goto(`http://localhost:${PORT}/wedi-preview.html`);
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500);
await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout(800);
await shot("before-wedi-kits");
await toCompare();
await shot("before-wedi-compare");

await pg.goto(`http://localhost:${PORT}/schluter-preview.html`);
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(600);
await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);
await shot("before-schluter-kits");

await b.close();
if (err) { console.error("checks FAILED"); process.exit(1); }
console.log("all checks passed");
```

Run: `node .scratch/158_shower-config-roadmap/p2/shoot-before.mjs`
Expected: three "shot" lines, then "all checks passed".

- [ ] **Step 2: Write the generator**
  `.scratch/158_shower-config-roadmap/tools/gen-wallsys-golden.mjs`:

```js
// Captures what today's Building Panel wedi builds and both Schluter wall
// systems bill (ticket 158 Phase 2), before the S-DRY Membrane fork lands:
// every wedi kit card at its own size, a spread of wedi room solves (every
// option each returns, built through kitFor and re-opened through
// buildFromMarker), Schluter point + linear rooms on membrane and board walls,
// and the Compare house kits. Run ONCE against the pre-Phase-2 code;
// src/wallsysgolden.test.js compares the new code against it.
//   node .scratch/158_shower-config-roadmap/tools/gen-wallsys-golden.mjs
import { writeFileSync } from "node:fs";
import { pans, group, kitFor, solve, buildFromMarker as wediFromMarker } from "../../../src/wedi.js";
import { FIXTURE_ITEMS } from "../../../src/schluterfixture.js";
import { catalogOf, trayCandidates, buildKit } from "../../../src/schluter.js";
import { wediBuildFor, schluterBuildFor } from "../../../src/comparekit.js";

// a bill as quantities per part — "<key>x<total qty>" sorted
const bag = (lines, keyOf) => {
  const q = new Map();
  lines.filter((l) => !l.noteOnly).forEach((l) => q.set(keyOf(l.item), (q.get(keyOf(l.item)) || 0) + l.qty));
  return [...q].map(([k, n]) => k + "x" + n).sort().join(" ");
};
const wk = (i) => i.key;
const sk = (i) => i.sku || i.name;

// wedi kit cards: every pan and neo module at its own size
const cards = [...pans(), ...group("module").filter((m) => m.sub === "neo")].map((p) => {
  const b = kitFor(p.key, { mode: "kit" });
  return [p.key, b ? bag(b.lines, wk) : null];
});

// wedi room solves: every option, as kitFor bills it and as a marker reopens it
const ROOMS = [
  [36, 60, "curbed", "any"], [42, 60, "curbed", "center"], [48, 72, "curbed", "offset"],
  [60, 60, "curbless", "any"], [36, 60, "curbed", "linear"], [54, 80, "curbed", "any"],
];
const solves = ROOMS.map(([w, d, curb, drain]) => {
  const res = solve({ w, d, curb, drain, tolerance: 0.51, source: "all" });
  return [[w, d, curb, drain], res.map((o) => {
    const b = kitFor(o.pan.key, { option: o, room: o.room, mode: "custom" });
    const back = wediFromMarker({ mode: "custom", cfg: b.cfg });
    return [o.id, o.pan.key, bag(b.lines, wk), bag(back.lines, wk)];
  })];
});

// Schluter: both wall systems on a point and a linear room
const cat = catalogOf(FIXTURE_ITEMS);
const schRoom = (drain, wallSys) => ({
  w: 60, d: 36, curbed: true, drain, wallSys, bench: null,
  walls: [{ name: "Back", on: true, len: 60, h: 96 }, { name: "Left", on: true, len: 36, h: 96 }, { name: "Right", on: true, len: 36, h: 96 }],
});
const schluter = [];
for (const drain of ["point", "linear"]) {
  for (const wallSys of ["membrane", "board"]) {
    const cfg = schRoom(drain, wallSys);
    const pick = trayCandidates(cfg, cat, { source: "all" })[0];
    schluter.push([drain, wallSys, bag(buildKit(cfg, cat, { source: "all", pick }).lines, sk)]);
  }
}

// Compare's house kits for a 60×38 room, curbed and curbless
const croom = (curbed) => ({ w: 60, d: 38, curbed, drain: "point",
  walls: ["back", "left", "right"].map((side) => ({ side, on: true, len: side === "back" ? 60 : 38, h: 84 })) });
const compare = [true, false].map((curbed) => [curbed,
  bag(wediBuildFor(croom(curbed)).lines, wk), bag(schluterBuildFor(croom(curbed), cat).build.lines, sk)]);

const out = `// GENERATED by .scratch/158_shower-config-roadmap/tools/gen-wallsys-golden.mjs
// from the pre-Phase-2 engines (ticket 158) — what Building Panel wedi builds
// and both Schluter wall systems billed before the S-DRY Membrane fork. Never
// hand-edit; a bill that moves is a test failure, not a re-pin.
// CARDS: [panKey, bill]. SOLVES: [[w, d, curb, drain], [[optionId, panKey, kitFor bill, reopened bill]]].
// SCHLUTER: [drain, wallSys, bill]. COMPARE: [curbed, wedi house kit, Schluter house kit].
export const CARDS = ${JSON.stringify(cards, null, 1)};
export const SOLVES = ${JSON.stringify(solves, null, 1)};
export const SCHLUTER = ${JSON.stringify(schluter, null, 1)};
export const COMPARE = ${JSON.stringify(compare, null, 1)};
`;
writeFileSync(new URL("../../../src/wallsysgolden.js", import.meta.url), out);
console.log("cards", cards.length, "solves", solves.reduce((t, s) => t + s[1].length, 0), "schluter", schluter.length);
```

- [ ] **Step 3: Run it.**

Run: `node .scratch/158_shower-config-roadmap/tools/gen-wallsys-golden.mjs`
Expected: `cards 35 solves 22 schluter 4` and a new `src/wallsysgolden.js`
(~14.6 KB, header "GENERATED by …"). Never hand-edit it.

- [ ] **Step 4: Write the golden test** `src/wallsysgolden.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { kitFor, solve, buildFromMarker as wediFromMarker } from "./wedi.js";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { catalogOf, trayCandidates, buildKit } from "./schluter.js";
import { wediBuildFor, schluterBuildFor } from "./comparekit.js";
import { CARDS, SOLVES, SCHLUTER, COMPARE } from "./wallsysgolden.js";

// Phase 2 (ticket 158) adds a Membrane (S-DRY) wall system to wedi. Nothing
// built on Building Panel — and nothing on Schluter — may bill differently.
const bag = (lines, keyOf) => {
  const q = new Map();
  lines.filter((l) => !l.noteOnly).forEach((l) => q.set(keyOf(l.item), (q.get(keyOf(l.item)) || 0) + l.qty));
  return [...q].map(([k, n]) => k + "x" + n).sort().join(" ");
};
const wk = (i) => i.key;
const sk = (i) => i.sku || i.name;

test("every wedi kit card bills as before", () => {
  for (const [key, bill] of CARDS) {
    const b = kitFor(key, { mode: "kit" });
    assert.equal(b ? bag(b.lines, wk) : null, bill, key);
  }
});

test("every wedi room solve offers and bills as before, built and reopened", () => {
  for (const [[w, d, curb, drain], opts] of SOLVES) {
    const res = solve({ w, d, curb, drain, tolerance: 0.51, source: "all" });
    assert.deepEqual(res.map((o) => [o.id, o.pan.key]), opts.map((o) => [o[0], o[1]]), `${w}x${d} ${curb} ${drain}`);
    res.forEach((o, i) => {
      const b = kitFor(o.pan.key, { option: o, room: o.room, mode: "custom" });
      assert.equal(bag(b.lines, wk), opts[i][2], `${w}x${d} ${o.id} built`);
      assert.equal(bag(wediFromMarker({ mode: "custom", cfg: b.cfg }).lines, wk), opts[i][3], `${w}x${d} ${o.id} reopened`);
    });
  }
});

test("Schluter bills both wall systems as before", () => {
  const cat = catalogOf(FIXTURE_ITEMS);
  for (const [drain, wallSys, bill] of SCHLUTER) {
    const cfg = {
      w: 60, d: 36, curbed: true, drain, wallSys, bench: null,
      walls: [{ name: "Back", on: true, len: 60, h: 96 }, { name: "Left", on: true, len: 36, h: 96 }, { name: "Right", on: true, len: 36, h: 96 }],
    };
    const pick = trayCandidates(cfg, cat, { source: "all" })[0];
    assert.equal(bag(buildKit(cfg, cat, { source: "all", pick }).lines, sk), bill, drain + " " + wallSys);
  }
});

test("Compare's default house kits bill as before", () => {
  const cat = catalogOf(FIXTURE_ITEMS);
  for (const [curbed, wedi, sch] of COMPARE) {
    const room = { w: 60, d: 38, curbed, drain: "point",
      walls: ["back", "left", "right"].map((side) => ({ side, on: true, len: side === "back" ? 60 : 38, h: 84 })) };
    assert.equal(bag(wediBuildFor(room).lines, wk), wedi, "wedi curbed=" + curbed);
    assert.equal(bag(schluterBuildFor(room, cat).build.lines, sk), sch, "schluter curbed=" + curbed);
  }
});
```

- [ ] **Step 5: Run the suite.**

Run: `npm test`
Expected: `# pass 1790`, `# fail 0` (4 new tests, all green on today's code).

- [ ] **Step 6: Commit.**

```bash
git add .scratch/158_shower-config-roadmap/tools/gen-wallsys-golden.mjs src/wallsysgolden.js src/wallsysgolden.test.js \
  .scratch/158_shower-config-roadmap/p2/shoot-before.mjs .scratch/158_shower-config-roadmap/p2/before-*.png
git commit -m "Phase 2 golden: pin today's wedi and Schluter wall-system bills; before shots"
```

---

### Task 2: `src/sdry.js` — the S-DRY fit, curb, walls and PRO-SET (pure)

Model: Opus. This is the bill math, and it is sourced from wedi's published
rates.

**Files:**
- Create: `src/sdry.js`
- Create: `src/sdry.test.js`

**Interfaces:**
- Consumes: a catalog array in wedi `catalog()` entry shape (`key`, `group`,
  `sub`, `stock`, `retail`, `w`, `d`, `drain`, `name`). Tests pass the real
  `catalog()`.
- Produces (all exported):
  - `SDRY`: SKU constants — `ext`, `curbFull`, `curbLean`, `drain`,
    `coverSS`, `roll`, `rollXL`, `tape`, `inCorner`, `outCorner`,
    `collarValve`, `collarPipe`, `seal`, `sealTrowel`, `proSet`.
  - Rate constants: `PROSET_SF = 100`, `SEAL_LF = 45`, `TAPE_LF = 32`,
    `CURB_LEN = 72`, `LAP = 1.1`.
  - `sdryRole(e)` → `"base"|"ext"|"curb"|"drain"|"cover"|"membrane"|"tape"|"corner"|"collar"|"seal"|"setting"|"kit"|"other"|null`.
  - `sdrySlot(e)` → a slots.js slot, or `null`.
  - `sdryFit(input, cat)` → `{ options, reason }`. Each option has the wedi
    solver shape plus `seams` (inches). Option ids are `"sdry-<tier>-<rank>"`,
    kind is `"sdry"`, and `input.system` is `"sdry"`.
  - `sdryNearest(input, cat)` → one option, id `"sdry-nearest"`,
    `input.nearest: true`; `null` when the book has no S-DRY base.
  - `sdryCurb(openLen, pick, cat)` → `{ item, qty, note, len }`.
  - `sdryWalls({ wallSf, walls, curbed, openLen, seams }, cat)` →
    `{ rows: [{ key, qty, note }], membraneSf, tapeLf }`.
  - `sdryProSet(membraneSf)` → bags.

- [ ] **Step 1: Write the failing test** `src/sdry.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { catalog } from "./wedi.js";
import { SDRY, sdryFit, sdryNearest, sdryCurb, sdryWalls, sdryProSet, sdrySlot, sdryRole } from "./sdry.js";

const cat = catalog();
const fit = (w, d, drain = "any", source) => sdryFit({ w, d, drain, source }, cat);

test("a room a base covers is one piece, cut evenly", () => {
  const { options } = fit(36, 60);
  assert.equal(options[0].pan.key, "US9176001");
  assert.equal(options[0].floorLines.length, 1);
  assert.deepEqual(options[0].badges, ["Best fit", "One piece", "cut 1″ off each side, cut 2″ off each end"]);
  assert.equal(options[0].input.system, "sdry");
});

test("a room past every base takes an extension along a short edge", () => {
  const { options } = fit(48, 90);
  const o = options[0];
  assert.equal(o.pan.key, "US9176003");
  assert.deepEqual(o.floorLines.map((l) => [l.item.key, l.qty]), [["US9176003", 1], [SDRY.ext, 1]]);
  assert.deepEqual(o.seams, [48]);
});

test("an edge past 48 takes two extensions side by side", () => {
  const { options } = fit(72, 90);
  const o = options.find((x) => x.floorLines.some((l) => l.item.key === SDRY.ext && l.qty === 2));
  assert.ok(o, "a two-extension option");
  assert.ok(o.warnings[0].includes("side by side"));
});

test("a linear drain and an oversize room name why", () => {
  assert.equal(fit(36, 60, "linear").reason, "S-DRY has no linear-drain base");
  assert.equal(fit(100, 120).reason, "the room is larger than an S-DRY base with extensions covers");
});

test("the offset drain pref keeps to offset bases", () => {
  const { options } = fit(36, 60, "offset");
  assert.ok(options.every((o) => o.pan.drain.type === "offset"));
});

test("Stock only pools stocked bases only", () => {
  const soCat = cat.map((e) => (e.key === "US9176001" ? { ...e, stock: false } : e));
  assert.equal(sdryFit({ w: 36, d: 60, drain: "center" }, soCat).options[0].pan.key, "US9176001");
  assert.notEqual(sdryFit({ w: 36, d: 60, drain: "center", source: "stock" }, soCat).options[0].pan.key, "US9176001");
});

test("nearest covers what it can and names the shortfall", () => {
  const o = sdryNearest({ w: 100, d: 120, drain: "any" }, cat);
  assert.equal(o.id, "sdry-nearest");
  assert.ok(o.input.nearest);
  assert.match(o.warnings[0], /wider and .* deeper than the S-DRY floor/);
});

test("curb: full by default, lean on pick, one 72 per 72 of opening", () => {
  assert.deepEqual([sdryCurb(60, null, cat).item.key, sdryCurb(60, null, cat).qty], [SDRY.curbFull, 1]);
  assert.equal(sdryCurb(80, { sub: "lean" }, cat).item.key, SDRY.curbLean);
  assert.equal(sdryCurb(80, null, cat).qty, 2);
  assert.equal(sdryCurb(60, { none: true }, cat).qty, 0);
});

test("PRO-SET matches wedi's own examples", () => {
  const walls = (w, d) => [{ side: "back", len: w, h: 84 }, { side: "left", len: d, h: 84 }, { side: "right", len: d, h: 84 }];
  const sf = (w, d) => walls(w, d).reduce((t, x) => t + x.len * x.h, 0) / 144;
  // wedi TDS: a 36×60 alcove → 2 bags, a 48×72 → 3 bags (3 walls at 84″)
  assert.equal(sdryProSet(sdryWalls({ wallSf: sf(60, 36), walls: walls(60, 36) }, cat).membraneSf), 2);
  assert.equal(sdryProSet(sdryWalls({ wallSf: sf(72, 48), walls: walls(72, 48) }, cat).membraneSf), 3);
});

test("the wall bill for a curbed 60×36 alcove", () => {
  const walls = [{ side: "back", len: 60, h: 96 }, { side: "left", len: 36, h: 96 }, { side: "right", len: 36, h: 96 }];
  const { rows } = sdryWalls({ wallSf: 132 * 96 / 144, walls, curbed: true, openLen: 60, seams: [] }, cat);
  const q = Object.fromEntries(rows.map((r) => [r.key, r.qty]));
  assert.equal(q[SDRY.tape], 2);          // 2×96 + 132 + 72 = 396″ = 33 lf → 2 rolls
  assert.equal(q[SDRY.inCorner], 2);      // 2 wall corners + 2 at the curb
  assert.equal(q[SDRY.outCorner], 1);
  assert.equal(q[SDRY.collarValve], 1);
  assert.equal(q[SDRY.collarPipe], 1);
  assert.equal(q[SDRY.seal], 1);          // 33 lf ÷ 45
  assert.equal(q[SDRY.sealTrowel], 1);
  assert.ok(q[SDRY.roll] || q[SDRY.rollXL]);
});

test("slots: every S-DRY role lands in a shared slot", () => {
  const e = (key) => cat.find((x) => x.key === key);
  assert.equal(sdrySlot(e("US9176001")), "tray");
  assert.equal(sdrySlot(e(SDRY.ext)), "tray");
  assert.equal(sdrySlot(e(SDRY.drain)), "drainBody");
  assert.equal(sdrySlot(e(SDRY.coverSS)), "grate");
  assert.equal(sdrySlot(e(SDRY.curbFull)), "curb");
  assert.equal(sdrySlot(e(SDRY.roll)), "wallMembrane");
  assert.equal(sdrySlot(e(SDRY.tape)), "seam");
  assert.equal(sdrySlot(e(SDRY.inCorner)), "corners");
  assert.equal(sdrySlot(e(SDRY.seal)), "setting");
  assert.equal(sdryRole(e("US7076002")), "other");
  assert.equal(sdrySlot({ key: "US1234", group: "panel" }), null);
});
```

- [ ] **Step 2: Run it.**

Run: `node --test src/sdry.test.js`
Expected: FAIL — `Cannot find module './sdry.js'`.

- [ ] **Step 3: Write `src/sdry.js`:**

```js
// sdry — wedi's S-DRY system, the wedi "Membrane" wall choice (ticket 158
// Phase 2, ADR 0051): how S-DRY bases and extensions fit a room, and what an
// S-DRY membrane wall bills. Pure: the caller (wedi.js) hands in its catalog,
// so this module never imports the engine and the engine imports it freely.
//
// Rates are wedi's published ones (spec 2026-09-28, "Sourced rates"):
//   PRO-SET, 1/8" × 1/8" notch = 100 sf of membrane per 25 lb bag;
//   S-DRY SEAL, one unit (32 oz liquid + 2 × 16 oz powder) = ~45 lf of seams.

export const SDRY = {
  ext: "US3076003", curbFull: "US3076001", curbLean: "US3076002",
  drain: "US9476006", coverSS: "US1076002",
  roll: "US5076009", rollXL: "US5076008", tape: "US5076007",
  inCorner: "US5076002", outCorner: "US5076005",
  collarValve: "US5076003", collarPipe: "US5076006",
  seal: "US5076011", sealTrowel: "US5076010", proSet: "US5076012",
};

export const PROSET_SF = 100;
export const SEAL_LF = 45;
export const TAPE_LF = 32;
export const CURB_LEN = 72;
export const LAP = 1.1;
// wedi's published roll coverage — the stock export names it ("104sf"), the
// distribution pricelist doesn't, so the name is read first and this backs it
const ROLL_SF = { US5076009: 104, US5076008: 106 };
const EXT_W = 48, EXT_D = 24;

const COVERS = new Set(["US1076001", "US1076002", "US1076003", "US1076004", "US1076005", "US1076006", "US1076007", "US1076008"]);
const ROLE = {
  [SDRY.ext]: "ext", [SDRY.curbFull]: "curb", [SDRY.curbLean]: "curb",
  [SDRY.drain]: "drain", US9476016: "drain", US9476011: "drain", US9476012: "drain",
  [SDRY.roll]: "membrane", [SDRY.rollXL]: "membrane", [SDRY.tape]: "tape",
  [SDRY.inCorner]: "corner", US5076001: "corner", [SDRY.outCorner]: "corner", US5076004: "corner",
  [SDRY.collarValve]: "collar", [SDRY.collarPipe]: "collar",
  [SDRY.seal]: "seal", [SDRY.sealTrowel]: "seal", [SDRY.proSet]: "setting",
  US2076001: "kit", US2076002: "kit",
};

/** An S-DRY part's role, read off its SKU; null for anything else. */
export function sdryRole(e) {
  if (!e) return null;
  if (e.group === "pan" && e.sub === "sdry") return "base";
  if (COVERS.has(e.key)) return "cover";
  return ROLE[e.key] || (e.group === "sdry" ? "other" : null);
}

const SLOT_OF_ROLE = {
  base: "tray", ext: "tray", kit: "tray", curb: "curb", drain: "drainBody", cover: "grate",
  membrane: "wallMembrane", tape: "seam", corner: "corners", collar: "corners",
  seal: "setting", setting: "setting", other: "extra",
};
/** The shared slot (slots.js) an S-DRY part fills; null for anything else. */
export const sdrySlot = (e) => SLOT_OF_ROLE[sdryRole(e)] || null;

const r2 = (n) => Math.round(n * 100) / 100;
const inch = (n) => String(r2(n));

// --- the fit -----------------------------------------------------------------

function footprints(base, ext) {
  const out = [];
  const orients = [{ w: base.w, d: base.d, rot: false }];
  if (base.w !== base.d) orients.push({ w: base.d, d: base.w, rot: true });
  for (const o of orients) {
    out.push({ tier: 1, o, w: o.w, d: o.d, exts: [] });
    if (!ext) continue;
    // an extension lies 24" deep along a base edge, cut along its 48" side to
    // that edge; past 48" two lie side by side, seamed (owner 2026-09-28)
    for (const along of ["w", "d"]) {
      const edge = o[along];
      const n = edge <= EXT_W ? 1 : edge <= 2 * EXT_W ? 2 : 0;
      if (!n) continue;
      out.push({ tier: n === 1 ? 2 : 3, o, along, n,
        w: along === "w" ? o.w : o.w + EXT_D, d: along === "w" ? o.d + EXT_D : o.d });
    }
  }
  return out;
}

// Base + extension pieces in room coordinates (x from the left wall, y from
// the back wall); an extension sits on the back (depth) or the left (width)
// side, and the footprint is cut evenly back to the room.
function layout(base, ext, fp, W, D) {
  const cx = r2((fp.w - W) / 2), cy = r2((fp.d - D) / 2);
  const bx = fp.along === "d" ? EXT_D : 0, by = fp.along === "w" ? EXT_D : 0;
  const clip = (x, y, w, d) => {
    const x0 = Math.max(x - cx, 0), y0 = Math.max(y - cy, 0);
    const x1 = Math.min(x + w - cx, W), y1 = Math.min(y + d - cy, D);
    return { x: r2(x0), y: r2(y0), w: r2(x1 - x0), d: r2(y1 - y0) };
  };
  const bp = clip(bx, by, fp.o.w, fp.o.d);
  const pieces = [{ kind: "pan", item: base, ...bp,
    cut: bp.w < fp.o.w - 0.01 || bp.d < fp.o.d - 0.01 ? { w: fp.o.w, d: fp.o.d } : null }];
  const seams = [];
  if (fp.along) {
    const edge = fp.o[fp.along];
    for (let i = 0; i < fp.n; i++) {
      const span = Math.min(EXT_W, edge - i * EXT_W);
      const ep = fp.along === "w" ? clip(i * EXT_W, 0, span, EXT_D) : clip(0, i * EXT_W, EXT_D, span);
      const full = { w: fp.along === "w" ? EXT_W : EXT_D, d: fp.along === "w" ? EXT_D : EXT_W };
      if (ep.w > 0 && ep.d > 0) pieces.push({ kind: "ext", item: ext, ...ep, cut: ep.w < full.w - 0.01 || ep.d < full.d - 0.01 ? full : null });
    }
    seams.push(r2(fp.along === "w" ? bp.w : bp.d));
    if (fp.n === 2) seams.push(EXT_D);
  }
  return { pieces, seams, cx, cy };
}

const DRAIN_OK = { any: ["center", "offset"], center: ["center"], offset: ["offset"] };

/**
 * S-DRY options for a room, best first, in the wedi solver's option shape —
 * { id, kind, title, badges, pieces, drain, warnings, floorLines, floorPrice,
 *   waste, seams, room, pan, input }. Tiers: one base cut down; + one 24×48
 * extension along an edge of 48" or less; + two side by side (seamed) along a
 * longer edge. Within a tier: least cut-away, stock first, cheaper.
 * `{ options, reason }` — reason names why nothing fits when options is empty.
 */
export function sdryFit(input, cat) {
  const W = +input.w || 0, D = +input.d || 0;
  if (!(W > 0 && D > 0)) return { options: [], reason: "no room size" };
  if (input.drain === "linear") return { options: [], reason: "S-DRY has no linear-drain base" };
  const stockOnly = input.source === "stock";
  let bases = cat.filter((e) => e.group === "pan" && e.sub === "sdry" && e.drain && (!stockOnly || e.stock));
  if (!bases.length) return { options: [], reason: "no S-DRY bases in the price book" };
  const want = DRAIN_OK[input.drain] || DRAIN_OK.any;
  const typed = bases.filter((b) => want.includes(b.drain.type));
  const ext = cat.find((e) => e.key === SDRY.ext && (!stockOnly || e.stock)) || cat.find((e) => e.key === SDRY.ext) || null;
  const cands = [];
  for (const pool of [typed.length ? typed : bases]) {
    for (const base of pool) {
      for (const fp of footprints(base, ext)) {
        if (fp.w < W - 0.01 || fp.d < D - 0.01) continue;
        const pieceCost = base.retail + (fp.n || 0) * (ext ? ext.retail : 0);
        cands.push({ base, fp, cut: fp.w * fp.d - W * D, cost: pieceCost });
      }
    }
  }
  if (!cands.length) return { options: [], reason: "the room is larger than an S-DRY base with extensions covers" };
  cands.sort((a, b) => a.fp.tier - b.fp.tier || a.cut - b.cut
    || (b.base.stock ? 1 : 0) - (a.base.stock ? 1 : 0) || a.cost - b.cost);
  // the best per tier, and within tier 1 the best per base size
  const seen = new Set(), picked = [];
  for (const c of cands) {
    const k = c.fp.tier + ":" + (c.fp.tier === 1 ? c.base.w + "x" + c.base.d : "");
    if (seen.has(k)) continue;
    seen.add(k);
    picked.push(c);
  }
  const options = picked.slice(0, 3).map((c, i) => optionOf(c, ext, W, D, input, i));
  if (options.length) options[0].badges = ["Best fit"].concat(options[0].badges);
  return { options, reason: "" };
}

function optionOf(c, ext, W, D, input, rank) {
  const { base, fp } = c;
  const { pieces, seams, cx, cy } = layout(base, ext, fp, W, D);
  const dr = base.drain;
  const bx = fp.along === "d" ? EXT_D : 0, by = fp.along === "w" ? EXT_D : 0;
  const drx = fp.o.rot ? dr.y : dr.x, dry = fp.o.rot ? dr.x : dr.y;
  const drain = { type: dr.type, x: r2(bx + drx - cx), y: r2(by + dry - cy), len: 0, axis: null, note: "" };
  const floorLines = [{ item: base, qty: 1 }];
  if (fp.n) floorLines.push({ item: ext, qty: fp.n });
  const cutW = r2(fp.w - W), cutD = r2(fp.d - D);
  const cutTxt = [cutW > 0.01 ? `cut ${inch(cutW / 2)}″ off each side` : "", cutD > 0.01 ? `cut ${inch(cutD / 2)}″ off each end` : ""].filter(Boolean).join(", ");
  const baseTxt = `S-DRY ${inch(fp.o.w)}×${inch(fp.o.d)}`;
  const title = fp.tier === 1 ? baseTxt : fp.tier === 2 ? baseTxt + " + extension" : baseTxt + " + 2 extensions (seamed)";
  const warnings = [];
  if (fp.tier === 3) warnings.push("two extensions side by side — S-DRY tape seals the seam between them");
  return {
    id: "sdry-" + fp.tier + "-" + rank, kind: "sdry", title,
    badges: [fp.tier === 1 ? "One piece" : fp.tier === 2 ? "Base + extension" : "Base + 2 extensions"].concat(cutTxt ? [cutTxt] : ["No cutting"]),
    pieces, drain, warnings, seams,
    floorLines, floorPrice: r2(floorLines.reduce((t, l) => t + l.item.retail * l.qty, 0)),
    waste: r2(c.cut / 144), input: { ...input, system: "sdry" },
    room: { w: W, d: D }, pan: base,
  };
}

/**
 * The fallback "use the nearest S-DRY base anyway": the footprint that leaves
 * the least floor uncovered, cut where it overhangs, with a warning naming the
 * shortfall. Null only when the book has no S-DRY base at all.
 */
export function sdryNearest(input, cat) {
  const W = +input.w || 0, D = +input.d || 0;
  const bases = cat.filter((e) => e.group === "pan" && e.sub === "sdry" && e.drain);
  if (!bases.length || !(W > 0 && D > 0)) return null;
  const ext = cat.find((e) => e.key === SDRY.ext) || null;
  let best = null;
  for (const base of bases.filter((b) => b.drain.type === "center").concat(bases)) {
    for (const fp of footprints(base, ext)) {
      const short = Math.max(0, W - fp.w) + Math.max(0, D - fp.d);
      const over = Math.max(0, fp.w - W) + Math.max(0, fp.d - D);
      if (!best || short < best.short || (short === best.short && (fp.tier < best.fp.tier || (fp.tier === best.fp.tier && over < best.over))))
        best = { base, fp, short, over };
    }
  }
  const fw = Math.min(best.fp.w, W), fd = Math.min(best.fp.d, D);
  const o = optionOf({ base: best.base, fp: best.fp, cut: best.fp.w * best.fp.d - fw * fd, cost: 0 }, ext, fw, fd, input, 0);
  const miss = [W > fw + 0.01 ? `${inch(W - fw)}″ wider` : "", D > fd + 0.01 ? `${inch(D - fd)}″ deeper` : ""].filter(Boolean).join(" and ");
  o.id = "sdry-nearest";
  o.title = "Nearest S-DRY — " + o.title;
  o.room = { w: W, d: D };
  o.input = { ...input, system: "sdry", nearest: true };
  if (miss) o.warnings.unshift(`room is ${miss} than the S-DRY floor — the extra floor is by others`);
  if (input.drain === "linear") o.warnings.unshift("S-DRY has no linear base — a point-drain base is used");
  return o;
}

/** The S-DRY curb for an open edge: full by default, lean on pick; ⌈open ÷ 72⌉. */
export function sdryCurb(openLen, pick, cat) {
  if (!(openLen > 0) || (pick && pick.none)) return { item: null, qty: 0, note: "", len: 0 };
  const key = pick && pick.sub === "lean" ? SDRY.curbLean : SDRY.curbFull;
  const it = cat.find((e) => e.key === key) || null;
  if (!it) return { item: null, qty: 0, note: "", len: 0 };
  const qty = Math.max(1, Math.ceil((openLen - 0.01) / CURB_LEN));
  return { item: it, qty, note: qty > 1 ? r2(openLen) + '" of open edge — cut to fit' : "cut to " + r2(openLen) + '"', len: CURB_LEN };
}

// --- the walls ---------------------------------------------------------------

/**
 * What an S-DRY membrane wall bills, as { key, qty, note } rows the engine
 * pushes. `wallSf` is the membrane's wall area (all faces), `walls` the
 * standing walls ({ side, len, h }), `curbed` / `openLen` the entry, `seams`
 * the floor's extension seams (lf, in inches).
 */
export function sdryWalls({ wallSf, walls, curbed, openLen, seams }, cat) {
  const byKey = (k) => cat.find((e) => e.key === k) || null;
  const rows = [];
  const need = r2((wallSf || 0) * LAP);
  if (need > 0) {
    const rolls = [SDRY.roll, SDRY.rollXL].map(byKey).filter(Boolean).map((e) => {
      const sf = +(/(\d+(?:\.\d+)?)\s*sf\b/i.exec(e.name || "") || [])[1] || ROLL_SF[e.key] || 0;
      return sf > 0 ? { e, sf, n: Math.ceil(need / sf) } : null;
    }).filter(Boolean).sort((a, b) => a.n * a.e.retail - b.n * b.e.retail || (b.e.stock ? 1 : 0) - (a.e.stock ? 1 : 0));
    if (rolls[0]) rows.push({ key: rolls[0].e.key, qty: rolls[0].n, note: `${need} sf of wall + laps — ${rolls[0].sf} sf/roll` });
  }
  const sides = new Set((walls || []).map((w) => w.side));
  const vCorners = sides.has("back") ? ["left", "right"].filter((s) => sides.has(s)).length : 0;
  const hOf = (w) => +w.h || 0;
  const back = (walls || []).find((w) => w.side === "back");
  const lfIn = vCorners * (back ? hOf(back) : 0)
    + (walls || []).reduce((t, w) => t + (+w.len || 0), 0)
    + (curbed && openLen > 0 ? openLen + 12 : 0)
    + (seams || []).reduce((t, s) => t + s, 0);
  const lf = r2(lfIn / 12);
  if (lf > 0) rows.push({ key: SDRY.tape, qty: Math.ceil(lf / TAPE_LF), note: `${lf} lf — corners, wall base${curbed ? ", curb" : ""}${(seams || []).length ? ", extension seams" : ""}` });
  const inside = vCorners + (curbed && openLen > 0 ? 2 : 0);
  if (inside > 0) rows.push({ key: SDRY.inCorner, qty: Math.ceil(inside / 2), note: `${inside} inside corners — 2 per bag` });
  if (curbed && openLen > 0) rows.push({ key: SDRY.outCorner, qty: 1, note: "2 outside corners at the curb ends" });
  rows.push({ key: SDRY.collarValve, qty: 1, note: "mixing valve" });
  rows.push({ key: SDRY.collarPipe, qty: 1, note: "shower arm / pipe" });
  if (lf > 0) rows.push({ key: SDRY.seal, qty: Math.ceil(lf / SEAL_LF), note: `${lf} lf of seams — ~${SEAL_LF} lf per unit` });
  rows.push({ key: SDRY.sealTrowel, qty: 1, note: '3/16" x 5/32" notch' });
  return { rows, membraneSf: need, tapeLf: lf };
}

/** PRO-SET bags on a Membrane build: one sets the base, then 100 sf of membrane per bag. */
export const sdryProSet = (membraneSf) => 1 + Math.ceil(Math.max(0, membraneSf || 0) / PROSET_SF);
```

- [ ] **Step 4: Run the tests.**

Run: `node --test src/sdry.test.js && npm test`
Expected: sdry.test.js 11 pass; the suite `# pass 1801`, `# fail 0`.

- [ ] **Step 5: Commit.**

```bash
git add src/sdry.js src/sdry.test.js
git commit -m "sdry.js: the S-DRY fit, curb, walls and PRO-SET from wedi's published rates"
```

---

### Task 3: wedi.js — the wall system in `kitFor`, the S-DRY solve, slots and "+"

Model: Opus. This is the engine every saved wedi bill goes through, and all
three goldens guard it.

**Files:**
- Modify: `src/wedi.js`: the import block, `WEDI_ADD_PARTS`, `wediSlotOf`,
  `kitFor`, `buildFromMarker`, `markerCurbKey`, `solve`, and the new
  `sdryNoFit` above `panelPlan`
- Modify: `src/wedi.test.js` (the "+" parts expectation)
- Create: `src/wedisdry.test.js`

**Interfaces:**
- Consumes (Task 2): `SDRY`, `sdryFit`, `sdryNearest`, `sdryCurb`,
  `sdryWalls`, `sdryProSet`, `sdryRole`, `sdrySlot`.
- Produces:
  - `kitFor(pan, opts)` reads `opts.wallSys` (`"membrane"` or anything
    else = Building Panel) and `opts.sdryBase` (`"wedi"` or absent).
    - It returns `cfg.wallSys: "membrane"` and `cfg.sdryBase: "wedi"` only
      when set.
    - It returns `hints` including `"backer"` under Membrane, and a new
      top-level `sdry` field: `sdryWalls`' result, or `null`.
  - `solve(input)` honours `input.system === "sdry"` (and `input.nearest`).
  - `buildFromMarker` passes `cfg.wallSys` / `cfg.sdryBase`.
  - New export `sdryNoFit(input)` → the reason string, `""` when a base fits.
  - `wediSlotOf` gives S-DRY parts their S-DRY slot.
  - `WEDI_ADD_PARTS` gains:
    - `base` — `sdryExt`
    - `drain` — `sdryDrain`, `sdryCover`
    - `curb` — `sdryCurb`
    - `walls` — `sdryMembrane`
    - `setting` — `sdrySeal`

    Extras "Other" excludes S-DRY samples.
  - `markerCurbKey` resolves the S-DRY curb on a Membrane S-DRY marker.

- [ ] **Step 1: Write the failing test** `src/wedisdry.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { solve, kitFor, buildFromMarker, sdryNoFit, wediSlotOf, item, SKU, markerCurbKey } from "./wedi.js";
import { SDRY } from "./sdry.js";

const qty = (b) => Object.fromEntries(b.lines.map((l) => [l.item.key, l.qty]));
const room = (w, d, curb = "curbed", drain = "any") => ({ w, d, curb, drain, tolerance: 0.51 });
const build = (o, extra) => kitFor(o.pan.key, { option: o, room: o.room, mode: "custom", wallSys: "membrane", ...extra });

test("solve: system sdry lists S-DRY options; plain solve never does", () => {
  const s = solve({ ...room(60, 36), system: "sdry" });
  assert.ok(s.length && s.every((o) => o.kind === "sdry" && o.pan.sub === "sdry"));
  assert.ok(solve(room(60, 36)).every((o) => o.pan.sub !== "sdry"));
});

test("an S-DRY Membrane build bills the S-DRY floor and walls, no panel", () => {
  const b = build(solve({ ...room(60, 36), system: "sdry" })[0]);
  const q = qty(b);
  assert.equal(q.US9176001, 1);
  assert.equal(q[SDRY.curbFull], 1);
  assert.equal(q[SDRY.drain], 1);
  assert.equal(q[SDRY.coverSS], 1);
  assert.equal(q[SKU.proSet], 2);
  for (const gone of [SKU.panelDefault, SKU.fastenerKit, SKU.sealantSausage, SKU.collarValve, SKU.collarPipe, SKU.trowel, SKU.coverSS])
    assert.equal(q[gone], undefined, gone);
  assert.ok(b.hints.includes("backer"));
  assert.equal(b.cfg.wallSys, "membrane");
  assert.equal(b.cfg.sdryBase, undefined);
});

test("curbless S-DRY takes no curb; the extension seam joins the tape run", () => {
  const o = solve({ ...room(48, 90, "curbless"), system: "sdry" })[0];
  const b = build(o);
  assert.equal(qty(b)[SDRY.curbFull], undefined);
  assert.equal(qty(b)[SDRY.ext], 1);
  assert.match(b.lines.find((l) => l.item.key === SDRY.tape).note, /extension seams/);
});

test("a picked S-DRY cover and the lean curb land; a Fundo cover pick falls back to stainless", () => {
  const o = solve({ ...room(60, 36), system: "sdry" })[0];
  const q1 = qty(build(o, { coverPick: { key: "US1076003" }, curbPick: { sub: "lean" } }));
  assert.equal(q1.US1076003, 1);
  assert.equal(q1[SDRY.curbLean], 1);
  assert.equal(qty(build(o, { coverPick: { key: SKU.coverSS } }))[SDRY.coverSS], 1);
});

test("S-DRY walls on a wedi pan keep the pan side exactly", () => {
  const o = solve(room(60, 36))[0];
  const panel = kitFor(o.pan.key, { option: o, room: o.room, mode: "custom" });
  const mem = build(o, { sdryBase: "wedi" });
  for (const k of [o.pan.key, SKU.curbLean60, SKU.coverSS]) assert.equal(qty(mem)[k], qty(panel)[k], k);
  assert.equal(qty(mem)[SKU.panelDefault], undefined);
  assert.equal(mem.cfg.sdryBase, "wedi");
});

test("a Membrane marker reopens to the same bill — fit and nearest", () => {
  const fit = build(solve({ ...room(48, 90), system: "sdry" })[0]);
  assert.deepEqual(qty(buildFromMarker({ mode: "custom", cfg: fit.cfg })), qty(fit));
  const near = solve({ ...room(100, 120), system: "sdry", nearest: true })[0];
  const nb = build(near);
  assert.equal(nb.cfg.solve.input.nearest, true);
  assert.deepEqual(qty(buildFromMarker({ mode: "custom", cfg: nb.cfg })), qty(nb));
});

test("tile sf reads the S-DRY curb a Membrane marker bills", () => {
  const o = solve({ ...room(60, 36), system: "sdry" })[0];
  assert.equal(markerCurbKey(build(o).cfg), SDRY.curbFull);
  assert.equal(markerCurbKey(build(o, { curbPick: { sub: "lean" } }).cfg), SDRY.curbLean);
  const cl = solve({ ...room(60, 36, "curbless"), system: "sdry" })[0];
  assert.equal(markerCurbKey(build(cl).cfg), null);
});

test("an absent or unknown wallSys bills Building Panel exactly", () => {
  const o = solve(room(60, 36))[0];
  const plain = qty(kitFor(o.pan.key, { option: o, room: o.room, mode: "custom" }));
  assert.deepEqual(qty(kitFor(o.pan.key, { option: o, room: o.room, mode: "custom", wallSys: "board" })), plain);
  assert.deepEqual(qty(kitFor(o.pan.key, { option: o, room: o.room, mode: "custom", wallSys: "xyz" })), plain);
  assert.equal(kitFor(o.pan.key, { option: o, room: o.room, mode: "custom", wallSys: "xyz" }).cfg.wallSys, undefined);
});

test("sdryNoFit names why nothing fits", () => {
  assert.equal(sdryNoFit(room(60, 36)), "");
  assert.equal(sdryNoFit(room(60, 36, "curbed", "linear")), "S-DRY has no linear-drain base");
  assert.match(sdryNoFit(room(100, 120)), /larger than an S-DRY base/);
});

test("the curbless field seal draws under Setting now; its bill is unchanged", () => {
  assert.equal(wediSlotOf({ item: item(SKU.sdrySeal), group: "install" }), "setting");
});
```

- [ ] **Step 2: Run it.**

Run: `node --test src/wedisdry.test.js`
Expected: FAIL — `sdryNoFit` / `markerCurbKey` behaviour missing
(`does not provide an export named 'sdryNoFit'`).

- [ ] **Step 3: Apply the engine diff.** Save it as `/tmp/task3.diff` and run
  `git apply /tmp/task3.diff`, or make the same edits by hand:

```diff
diff --git a/src/wedi.js b/src/wedi.js
index 8df48c6..63f8491 100644
--- a/src/wedi.js
+++ b/src/wedi.js
@@ -29,6 +29,7 @@
 import { queryHit, parseQuery, querySummary, seedFromQuery } from "./wediquery.js";
 import { planPanels } from "./panelplan.js";
 import { groupOf } from "./slots.js";
+import { SDRY, sdryFit, sdryNearest, sdryCurb, sdryWalls, sdryProSet, sdryRole, sdrySlot } from "./sdry.js";
 import { WALL_THICK, CURB_LAP, panThick, benchFootprint, BENCH_DEPTH, curbWidthOf } from "./showerdraw.js";
 
 export { queryHit, parseQuery, querySummary, seedFromQuery };
@@ -5247,7 +5248,14 @@ export function markerCurbKey(cfg) {
   const room = cfg.room ? { w: +cfg.room.w || 0, d: +cfg.room.d || 0 } : panRoomDims(pan);
   const walls = cfg.walls && cfg.walls.length ? cfg.walls : defaultWalls(pan, cfg.room || null);
   const benches = (cfg.benches || []).map((b) => normBench(b, room));
-  const r = resolveCurb(cfg.curbPick, openLenOf(room, walls, cfg.corners, benches), familyOf(pan));
+  const openLen = openLenOf(room, walls, cfg.corners, benches);
+  // an S-DRY Membrane build bills the S-DRY curb (kitFor's sdryFloor rule)
+  if (pan.sub === "sdry" && cfg.wallSys === "membrane") {
+    if (cfg.solve && cfg.solve.input && cfg.solve.input.curb === "curbless") return null;
+    const sc = sdryCurb(openLen, cfg.curbPick, catalog());
+    return sc.item ? sc.item.key : null;
+  }
+  const r = resolveCurb(cfg.curbPick, openLen, familyOf(pan));
   return r.item ? r.item.key : null;
 }
 
@@ -5385,19 +5393,24 @@ export const WEDI_ADD_PARTS = {
     plusPart("base", "floor", "pan", "Pan", (i) => ["pan", "module", "kit"].includes(i.group)),
     plusPart("base", "floor", "ext", "Extension", (i) => ["extension", "modExt", "cornerExt"].includes(i.group)),
     plusPart("base", "install", "recess", "Recess kit", (i) => i.group === "recess"),
+    plusPart("base", "floor", "sdryExt", "S-DRY extension", (i) => sdryRole(i) === "ext"),
   ],
   drain: [
     plusPart("drain", "drain", "cover", "Cover", (i) => i.group === "cover", "cover"),
     plusPart("drain", "drain", "frame", "Frame", (i) => i.group === "coverFrame"),
     plusPart("drain", "drain", "drainKit", "Drain kit", (i) => i.group === "drainKit"),
+    plusPart("drain", "drain", "sdryDrain", "S-DRY drain", (i) => sdryRole(i) === "drain"),
+    plusPart("drain", "drain", "sdryCover", "S-DRY cover", (i) => sdryRole(i) === "cover"),
   ],
   curb: [
     plusPart("curb", "floor", "curb", "Curb", (i) => i.group === "curb" && !!i.len, "curb"),
     plusPart("curb", "floor", "ramp", "Ramp", (i) => i.group === "ramp"),
+    plusPart("curb", "floor", "sdryCurb", "S-DRY curb", (i) => sdryRole(i) === "curb"),
   ],
   walls: [
     plusPart("walls", "walls", "panel", "Panel", (i) => i.group === "panel" && i.sf > 0, "panel"),
     plusPart("walls", "install", "fastener", "Fasteners", (i) => i.group === "fastener"),
+    plusPart("walls", "walls", "sdryMembrane", "S-DRY membrane", (i) => sdryRole(i) === "membrane"),
   ],
   seams: [
     plusPart("seams", "install", "sealant", "Sealant", (i) => i.group === "sealant"),
@@ -5415,8 +5428,10 @@ export const WEDI_ADD_PARTS = {
   setting: [
     plusPart("setting", "install", "tool", "Tools", (i) => i.group === "tool"),
     plusPart("setting", "install", "proSet", "PRO-SET", (i) => i.key === SKU.proSet),
+    plusPart("setting", "install", "sdrySeal", "S-DRY SEAL", (i) => sdryRole(i) === "seal"),
   ],
-  extras: [plusPart("extras", "addon", "other", "Other", (i) => wediBucketOf(i) === "addon")],
+  // S-DRY samples are showroom pieces, never a shower's part
+  extras: [plusPart("extras", "addon", "other", "Other", (i) => wediBucketOf(i) === "addon" && sdryRole(i) !== "other")],
 };
 
 /** The "+" parts a shared group (`grp`, slots.js) offers with this book — a part with nothing to add never shows. */
@@ -5430,7 +5445,7 @@ export function wediSlotOf(line) {
   const it = (line && line.item) || {};
   if (it.key === SKU.proSet) return "setting";
   if (line.group === "bench" && it.group === "panel") return "bench";
-  return WEDI_SLOT[it.group] || "extra";
+  return sdrySlot(it) || WEDI_SLOT[it.group] || "extra";
 }
 
 export const panRoomDims = (pan) => (pan.group === "module"
@@ -5442,6 +5457,13 @@ export function kitFor(panKey, opts) {
   const pan = typeof panKey === "string" ? item(panKey) : panKey;
   if (!pan) return null;
   const fam = familyOf(pan);
+  // Phase 2 (ADR 0051): the Membrane wall system bills S-DRY membrane in place
+  // of Building Panel; absent is Building Panel, so old markers bill as before.
+  const membrane = opts.wallSys === "membrane";
+  // The S-DRY floor recipe (bonding drain, S-DRY cover and curb) rides the
+  // Membrane choice: an S-DRY pan under Building Panel is only an old marker
+  // shape (wedimarkergolden pins it), and bills as it always did.
+  const sdryFloor = fam === "sdry" && membrane;
   const option = opts.option || null;
   const room = opts.room || (option ? { w: option.room.w, d: option.room.d } : null);
   const walls = opts.walls || defaultWalls(pan, room, opts.wallHeight);
@@ -5513,7 +5535,7 @@ export function kitFor(panKey, opts) {
   // A 2"-deep pan's extensions sit low — the kit carries the ½" sheet the
   // shop rips into build-up strips underneath them (owner practice).
   const floorOpt = panPlan ? panPlan.option : option;
-  if (floorOpt && floorPan.group !== "module" && panThick(floorPan) >= 1.9) {
+  if (floorOpt && fam !== "sdry" && floorPan.group !== "module" && panThick(floorPan) >= 1.9) {
     const extSf = extensionSf(floorOpt);
     const sheet = item(BUILDUP_SHEET);
     if (extSf > 0 && sheet && sheet.sf) {
@@ -5526,7 +5548,8 @@ export function kitFor(panKey, opts) {
   const sheets = panelSheets(panelSf, panel);
   // A live book can drop the default panel; the floor in usewedicatalog.js
   // refuses such a book, and this is the belt to that brace.
-  if (panel) push(lines, panel, sheets, "walls",
+  if (membrane) hints.push("backer");
+  else if (panel) push(lines, panel, sheets, "walls",
     round2(panelSf) + " sf of wall — " + (panel.sf || 0) + " sf/sheet"
       + (panelStale ? " · " + opts.panelKey + " not in the book — default panel used" : ""), true);
   else hints.push("no-panel");
@@ -5542,19 +5565,26 @@ export function kitFor(panKey, opts) {
   const openLen = openLenOf(roomDims, walls, opts.corners, benches);
   // an old marker's resolved curbKey reads as the choice it stood for (ADR 0049)
   const curbPick = opts.curbPick !== undefined ? opts.curbPick : legacyCurbPick(opts.curbKey, fam, openLen);
-  const curb = resolveCurb(curbPick, openLen, fam);
+  const curbless = !!(option && option.input && option.input.curb === "curbless");
+  const curb = sdryFloor
+    ? (curbless ? { item: null, qty: 0 } : sdryCurb(openLen, curbPick, catalog()))
+    : resolveCurb(curbPick, openLen, fam);
   if (curb.item && curb.qty > 0) push(lines, curb.item, curb.qty, "floor", curb.note, true);
 
   // --- drain finish ----------------------------------------------------------
   const coverPick = opts.coverPick || legacyCoverPick(opts.coverKey);
   let cover = null;
-  if (fam === "linear") {
+  if (sdryFloor) {
+    push(lines, SDRY.drain, 1, "drain", "", true);
+    const picked = coverPick && coverPick.key ? item(coverPick.key) : null;
+    cover = sdryRole(picked) === "cover" ? picked : item(SDRY.coverSS);
+  } else if (fam === "linear") {
     const ch = pan.channel || (option && option.drain && option.drain.len) || 0;
     cover = linearCoverFor(ch, (coverPick && coverPick.finish) || opts.coverFinish || "SS");
   } else cover = item((coverPick && coverPick.key) || SKU.coverSS);
   if (cover) push(lines, cover, 1, "drain", "", true);
   else hints.push("no-cover");
-  const frame = cover && opts.coverFrame ? coverFrameFor(cover, opts.coverFrame === true ? null : opts.coverFrame) : null;
+  const frame = cover && !sdryFloor && opts.coverFrame ? coverFrameFor(cover, opts.coverFrame === true ? null : opts.coverFrame) : null;
   if (frame) push(lines, frame, 1, "drain", "trim ring around the cover", true);
 
   // --- curbless waterproofing ------------------------------------------------
@@ -5576,15 +5606,28 @@ export function kitFor(panKey, opts) {
   // --- consumables + install -------------------------------------------------
   // Bench surfaces (tops + faces, framed wraps) seal and fasten like wall
   // panel; premades whose kit already includes the sealant contribute nothing.
-  const con = figureConsumables(panelSf + bl.surfSf, form, opts.fastenerKey);
+  // Under Membrane only the bench surfaces are panel, so only they take
+  // fasteners and joint sealant.
+  const con = figureConsumables((membrane ? 0 : panelSf) + bl.surfSf, form, opts.fastenerKey);
   const fastener = con.lines.find((l) => l.item.group === "fastener");
   con.lines.forEach((l) => { lines.push(l); });
-  push(lines, SKU.collarValve, 1, "install", "mixing valve", true);
-  push(lines, SKU.collarPipe, 1, "install", "shower arm / pipe", true);
-  push(lines, SKU.trowel, 1, "install", "", true);
-  // Owner rule 2026-09-26 (ticket 158): one bag of PRO-SET sets the pan —
-  // flat, not figured by area, mirroring Schluter's ALL-SET line.
-  push(lines, SKU.proSet, 1, "install", "sets the pan — 1 bag", true);
+  let sdry = null;
+  if (membrane) {
+    sdry = sdryWalls({
+      wallSf: panelSf, walls, curbed: !!(curb.item && curb.qty > 0), openLen,
+      seams: sdryFloor && option && option.seams ? option.seams : [],
+    }, catalog());
+    sdry.rows.forEach((r) => push(lines, r.key, r.qty, r.key === SDRY.roll || r.key === SDRY.rollXL ? "walls" : "install", r.note, true));
+    push(lines, SKU.proSet, sdryProSet(sdry.membraneSf), "install",
+      "1 bag sets the base + 1 per 100 sf of membrane (1/8\" notch)", true);
+  } else {
+    push(lines, SKU.collarValve, 1, "install", "mixing valve", true);
+    push(lines, SKU.collarPipe, 1, "install", "shower arm / pipe", true);
+    push(lines, SKU.trowel, 1, "install", "", true);
+    // Owner rule 2026-09-26 (ticket 158): one bag of PRO-SET sets the pan —
+    // flat, not figured by area, mirroring Schluter's ALL-SET line.
+    push(lines, SKU.proSet, 1, "install", "sets the pan — 1 bag", true);
+  }
 
   // --- added lines (Phase 1c; old `addons` translate) -------------------------
   const added = addedRows(opts);
@@ -5616,6 +5659,8 @@ export function kitFor(panKey, opts) {
     ...(curbPick ? { curbPick } : {}),
     ...(fastener && fastener.item.key !== SKU.fastenerKit ? { fastenerKey: fastener.item.key } : {}),
     ...(coverPick ? { coverPick } : {}),
+    ...(membrane ? { wallSys: "membrane" } : {}),
+    ...(opts.sdryBase === "wedi" ? { sdryBase: "wedi" } : {}),
     coverFrame: frame ? frame.finish : null,
     sealantForm: form, recess: recess,
     ...(added.length ? { manual: added.map((r) => ({ ...r })) } : {}),
@@ -5627,7 +5672,7 @@ export function kitFor(panKey, opts) {
   };
 
   return {
-    pan: pan, lines: lines, panelSf: round2(panelSf), factory: factory, hints: hints,
+    pan: pan, lines: lines, panelSf: round2(panelSf), factory: factory, hints: hints, sdry: sdry,
     mode: opts.mode || (option ? "custom" : "kit"), cfg: cfg, curbFit: { openLen, fam },
     consumables: con, soNet: round2(soNet), benches: benches, panPlan: panPlan,
   };
@@ -5661,6 +5706,7 @@ export function buildFromMarker(marker) {
     curbPick: cfg.curbPick, curbKey: cfg.curbKey, fastenerKey: cfg.fastenerKey,
     coverPick: cfg.coverPick || legacyCoverPick(cfg.coverKey),
     coverFrame: cfg.coverFrame || undefined,
+    wallSys: cfg.wallSys, sdryBase: cfg.sdryBase,
     sealantForm: cfg.sealantForm, recess: cfg.recess,
     manual: addedRows(cfg), benches: (cfg.benches || []).map((b) => ({ ...b })),
     corners: (cfg.corners || []).slice(),
@@ -6236,6 +6282,7 @@ function mirrorOption(o) {
 }
 
 export function solve(input) {
+  const sys = input && input.system === "sdry" ? { system: "sdry", ...(input.nearest ? { nearest: true } : {}) } : null;
   input = {
     w: +(input && input.w) || 0, d: +(input && input.d) || 0,
     curb: (input && input.curb) === "curbless" ? "curbless" : "curbed",
@@ -6250,8 +6297,15 @@ export function solve(input) {
     // (extensions, covers) stay as picked and render flagged: a line with no
     // stocked substitute is never silently dropped.
     source: (input && input.source) === "stock" ? "stock" : "all",
+    ...sys,
   };
   if (!(input.w > 0) || !(input.d > 0)) return [];
+  // Phase 2 (ADR 0051): the S-DRY system has its own fit — base, extensions,
+  // cut evenly; `nearest` is the "use the nearest S-DRY base anyway" answer.
+  if (sys) {
+    if (input.nearest) { const o = sdryNearest(input, catalog()); return o ? [o] : []; }
+    return sdryFit(input, catalog()).options;
+  }
   const explicitTarget = input.drainX > 0 && input.drainY > 0;
   // Center clicked with no position given = the drain sits at the centre of
   // the ROOM, and the pan is cut to make that true (owner rule 2026-07-29).
@@ -6350,6 +6404,9 @@ const PANEL_SHEETS = [
   { key: "US8000017", w: 36, len: 60 },
 ];
 
+/** Why no S-DRY base fits a room ("" when one does) — the popup's fallback prompt reads it. */
+export const sdryNoFit = (input) => sdryFit({ ...input, w: +input.w || 0, d: +input.d || 0 }, catalog()).reason;
+
 export function panelPlan(walls) {
   return planPanels(walls, PANEL_SHEETS.map((s) => {
     const e = item(s.key);
```

- [ ] **Step 4: Update the "+" parts expectation in `src/wedi.test.js`.** The
  walls and drain groups now offer the S-DRY parts too:

```diff
diff --git a/src/wedi.test.js b/src/wedi.test.js
index 795172e..e81ca0f 100644
--- a/src/wedi.test.js
+++ b/src/wedi.test.js
@@ -1673,8 +1673,8 @@ test("setAddedRow: rows key on bucket + key; 0 removes; order kept", () => {
 
 test("wediAddParts / wediAddPartOf: each shared group's '+' parts", () => {
   const keys = (b) => wediAddParts(b).map((p) => p.key);
-  assert.deepEqual(keys("walls"), ["panel", "fastener"]);
-  assert.deepEqual(keys("drain"), ["cover", "frame", "drainKit"].filter((k) => k !== "drainKit" || group("drainKit").length));
+  assert.deepEqual(keys("walls"), ["panel", "fastener", "sdryMembrane"]);
+  assert.deepEqual(keys("drain"), ["cover", "frame", "drainKit", "sdryDrain", "sdryCover"].filter((k) => k !== "drainKit" || group("drainKit").length));
   assert.ok(keys("niches").includes("niche") && keys("niches").includes("shelf"));
   assert.ok(keys("curb").includes("curb"));
   assert.ok(keys("setting").includes("proSet"));
```

- [ ] **Step 5: Run the tests.**

Run: `node --test src/wedisdry.test.js src/wallsysgolden.test.js src/wedimarkergolden.test.js src/addedgolden.test.js && npm test`
Expected: wedisdry 10 pass; the three goldens green; the suite
`# pass 1811`, `# fail 0`. If `wedimarkergolden` fails on an `US9176…` key,
the S-DRY floor recipe is not gated on `membrane` (Global Constraints).

- [ ] **Step 6: Lint and commit.**

```bash
npx eslint src/wedi.js src/sdry.js src/wedisdry.test.js
git add src/wedi.js src/wedi.test.js src/wedisdry.test.js
git commit -m "wedi.js: Membrane (S-DRY) wall system in kitFor, the S-DRY solve, slots and + parts"
```

---

### Task 4: comparekit.js — the wall system in both build-fors, the wedi backer row

Model: Sonnet.

**Files:**
- Modify: `src/comparekit.js`: the schluter.js import, `wediBuildFor`,
  `schluterBuildFor`, `wediCompareRows`
- Modify: `src/wedisdry.test.js` (append the Compare tests)

**Interfaces:**
- Consumes (Task 3): `solve({...input, system: "sdry"})`,
  `kitFor(…, { wallSys, sdryBase })`, `build.hints`. From schluter.js:
  `boardPlan`, `expandBoardFaces`, `applyBoardPlan`.
- Produces:
  - `wediBuildFor(room, { source, tier, manual, wallSys, sdryBase })`. Under
    `wallSys: "membrane"` it tries the S-DRY fit first (unless
    `sdryBase: "wedi"`), else a wedi pan with `sdryBase: "wedi"`.
  - `schluterBuildFor(room, cat, { source, mortarItem, manual, wallSys })`.
    `wallSys: "board"` bills KERDI-BOARD with the Fit plan; anything else is
    membrane, as today.
  - `wediCompareRows` appends a `noteOnly` `wallBoard` row when the build
    hints `"backer"`.

- [ ] **Step 1: Write the failing tests.** In `src/wedisdry.test.js`, add
  under the existing imports:

```js
import { wediBuildFor, schluterBuildFor, mirrorPlan } from "./comparekit.js";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { catalogOf } from "./schluter.js";
```

and append to the end of the file:

```js

const neutral = (curbed) => ({ w: 60, d: 38, curbed, drain: "point",
  walls: ["back", "left", "right"].map((side) => ({ side, on: true, len: side === "back" ? 60 : 38, h: 84 })) });

test("Compare: wediBuildFor under Membrane builds S-DRY, or a wedi pan when S-DRY can't fit", () => {
  const b = wediBuildFor(neutral(true), { wallSys: "membrane" });
  assert.equal(b.pan.sub, "sdry");
  assert.equal(b.cfg.wallSys, "membrane");
  const lin = wediBuildFor({ ...neutral(true), drain: "linear" }, { wallSys: "membrane" });
  assert.notEqual(lin.pan.sub, "sdry");
  assert.equal(lin.cfg.sdryBase, "wedi");
  assert.equal(qty(lin)[SKU.panelDefault], undefined);
});

test("Compare: schluterBuildFor bills KERDI-BOARD on request", () => {
  const cat = catalogOf(FIXTURE_ITEMS);
  const { build: b, cfg } = schluterBuildFor(neutral(true), cat, { wallSys: "board" });
  assert.equal(cfg.wallSys, "board");
  assert.ok(b.lines.some((l) => l.slot === "wallBoard"));
  assert.ok(!b.lines.some((l) => l.slot === "wallMembrane"));
});

test("Compare: a hand-added KERDI roll mirrors onto an S-DRY roll", () => {
  const cat = catalogOf(FIXTURE_ITEMS);
  const roll = cat.find((e) => /^KERDI200/.test(e.sku));
  const { build: b } = schluterBuildFor(neutral(true), cat, { manual: [{ sku: roll.sku, qty: 1, g: "Walls" }] });
  const e = mirrorPlan(b, "schluter", {}, { cat, source: "all" }).entries[0];
  assert.equal(e.kind, "matched");
  assert.equal(e.match.item.key, SDRY.roll);
});
```

- [ ] **Step 2: Run them.**

Run: `node --test src/wedisdry.test.js`
Expected: the first two Compare tests FAIL (S-DRY not built; KERDI-BOARD
not billed); the mirror test already passes on Task 3's "+" parts.

- [ ] **Step 3: Apply the diff:**

```diff
diff --git a/src/comparekit.js b/src/comparekit.js
index 00bb6db..83bafc0 100644
--- a/src/comparekit.js
+++ b/src/comparekit.js
@@ -15,6 +15,7 @@ import {
 } from "./wedi.js";
 import {
   trayCandidates, buildKit, addedLines, tierPrice as schluterTierPrice, ADD_PARTS, slotOf, coverageOf as schluterCoverageOf,
+  boardPlan, expandBoardFaces, applyBoardPlan,
 } from "./schluter.js";
 import { GROUPS, groupOf, SLOT_LABEL } from "./slots.js";
 import { rankParts, nearest, matchQty } from "./comparemirror.js";
@@ -59,23 +60,29 @@ export function roomFromWedi(cfg) {
  * Solve the room in wedi and build the house kit for the top-ranked option —
  * the composition WediConfigurator.jsx's `solveRoom`/`build` make, minus the
  * popup's own customizations (no add-ons, benches, overrides or curb inset).
- * Null when nothing solves.
+ * Under Membrane (ADR 0051) the S-DRY fit goes first; when it can't fit, a
+ * wedi pan takes the floor with S-DRY walls — no prompt here, the build's
+ * `cfg.sdryBase` says so. Null when nothing solves.
  */
-export function wediBuildFor(room, { source, tier, manual } = {}) {
+export function wediBuildFor(room, { source, tier, manual, wallSys, sdryBase } = {}) {
   room = room || {};
   const walls = (room.walls || []).filter((w) => w.on)
     .map((w) => ({ side: w.side, len: +w.len || 0, h: +w.h || 84 }));
-  const option = solve({
+  const input = {
     w: +room.w || 0, d: +room.d || 0,
     curb: room.curbed ? "curbed" : "curbless",
     drain: WEDI_DRAIN[room.drain] || "center",
     tolerance: 0.51, drainX: 0, drainY: 0, anchor: "left", source: source,
-  })[0];
+  };
+  const membrane = wallSys === "membrane";
+  const sdry = membrane && sdryBase !== "wedi" ? solve({ ...input, system: "sdry" })[0] : null;
+  const option = sdry || solve(input)[0];
   if (!option) return null;
   return kitFor(option.pan.key, {
     option: option, room: option.room,
     walls: walls, wallHeight: (walls[0] && walls[0].h) || 84,
     mode: "kit", tier: tier,
+    ...(membrane ? { wallSys: "membrane", ...(sdry ? {} : { sdryBase: "wedi" }) } : {}),
     ...(manual && manual.length ? { manual } : {}),
   });
 }
@@ -85,12 +92,12 @@ export function wediBuildFor(room, { source, tier, manual } = {}) {
  * for its top-ranked tray. The cfg comes back beside the build because it is
  * what "Schluter — reconfigure" reopens on.
  */
-export function schluterBuildFor(room, cat, { source, mortarItem, manual } = {}) {
+export function schluterBuildFor(room, cat, { source, mortarItem, manual, wallSys } = {}) {
   room = room || {};
   const w = +room.w || 0, d = +room.d || 0;
   const cfg = {
     w: w, d: d, curbed: !!room.curbed, drain: room.drain || "point",
-    wallSys: "membrane", bench: null,
+    wallSys: wallSys === "board" ? "board" : "membrane", bench: null,
     walls: SIDES.map(([name, side], i) => {
       const hit = (room.walls || []).find((x) => x.side === side);
       return { name: name, on: !!(hit && hit.on), len: i === 0 ? w : d, h: (hit && +hit.h) || 84 };
@@ -100,6 +107,9 @@ export function schluterBuildFor(room, cat, { source, mortarItem, manual } = {})
   };
   const pick = trayCandidates(cfg, cat, { source })[0];
   const build = buildKit(cfg, cat, { source, pick });
+  // KERDI-BOARD walls bill the popup's default Fit plan, per sheet
+  if (build && build.lines && cfg.wallSys === "board")
+    build.lines = applyBoardPlan(build.lines, cfg, boardPlan(expandBoardFaces(cfg), cat, { source }), cat);
   // buildKit bills the recipe only; added rows ride on top, as buildFromMarker does
   if (build && build.lines && cfg.manual) build.lines.push(...addedLines(cfg.manual, cat));
   return { build, cfg };
@@ -127,7 +137,7 @@ function money(brand, e, qty, builderPct) {
 // added by hand — a Browse-only wedi build is all hand-added, so nothing there
 // is tagged. `key` is the 1c added-row identity: engine group + part.
 export function wediCompareRows(build, { builderPct } = {}) {
-  return ((build && build.lines) || []).map((l) => {
+  const rows = ((build && build.lines) || []).map((l) => {
     const e = l.item;
     return {
       group: groupOf(l.slot), slot: l.slot || "extra",
@@ -142,6 +152,14 @@ export function wediCompareRows(build, { builderPct } = {}) {
       ...money("wedi", e, l.qty, builderPct),
     };
   });
+  // S-DRY walls need a backer as KERDI does; the wedi bill carries it as a
+  // hint, so Compare writes the same $0 note row the Schluter column carries
+  if (build && build.hints && build.hints.includes("backer")) rows.push({
+    group: "walls", slot: "wallBoard", key: "note|backer", added: false,
+    name: "Cement board / drywall substrate", sub: "by others · membrane needs a backer",
+    qty: 1, stock: false, noteOnly: true, est: false, retail: 0, builder: 0, cost: 0,
+  });
+  return rows;
 }
 
 export function schluterCompareRows(build, { builderPct } = {}) {
```

- [ ] **Step 4: Run the tests.**

Run: `node --test src/wedisdry.test.js src/wallsysgolden.test.js && npm test`
Expected: wedisdry 13 pass; the suite `# pass 1814`, `# fail 0` (the
golden's COMPARE rows call both build-fors with no `wallSys` and stay put).

- [ ] **Step 5: Commit.**

```bash
git add src/comparekit.js src/wedisdry.test.js
git commit -m "comparekit: build either brand on either wall system; wedi backer note row"
```

---

### Task 5: WediConfigurator.jsx — the fork, S-DRY cards and options, the prompt

Model: Opus. It is a large stateful popup, and the re-solve ordering is subtle
(ruling 13).

**Files:**
- Modify: `src/WediConfigurator.jsx`

**Interfaces:**
- Consumes (Task 3): `sdryNoFit` (wedi.js), `SDRY` / `sdryRole` (sdry.js),
  `kitFor(…, { wallSys, sdryBase })`, `solve({...input, system, nearest})`,
  `pans({ family: "sdry", sdry: true })`, and the `"backer"` hint.
- Produces: the DOM hooks Task 7's proof reads:
  - `data-wedi-wallsys`, `data-wedi-wallsys-board`,
    `data-wedi-wallsys-membrane`
  - `data-wedi-sdryask`, `data-sdry-answer="sdry|wedi|nearest|board"`
  - `data-wedi-sdrychip`, `data-wedi-backer`

  `build.cfg` carries `wallSys` / `sdryBase`, which CompareTab reads in
  Task 6.

What the diff does:
- **Seed.** `seedState` reads `cfg.wallSys` / `cfg.sdryBase` /
  `cfg.solve.input.nearest` and strips `system` / `nearest` off the room
  form.
- **State.** Four new state hooks.
- **Solves.** `sdrySys()`, and `solveRoom` routes to the S-DRY solve.
  `seedFormFromKit` / `hardReset` solve through `solveRoom`.
- **Re-solve.** The `sysSig` effect, plus `setWallSystem`, `answerSdry` and
  the `wallSysSeg` segment.
- **Kits tab.** The segment, the S-DRY cards under Membrane, and S-DRY card
  prices in `kitTotals`.
- **Custom tab.** A Wall system group; the drain pin and "Pan against"
  disabled under S-DRY; the prompt in place of the option cards; and option
  cards priced on the current wall system.
- **Bill.** The subtitle, the chip, the backer hint, and the `applyPanelFit`
  guard.
- **Print.** The head's wall-system line and the backer note.
- **Swaps.** The S-DRY cover and curb list swaps; the curb drawing reads the
  S-DRY curb.

- [ ] **Step 1: Apply the diff:**

```diff
diff --git a/src/WediConfigurator.jsx b/src/WediConfigurator.jsx
index e9ca547..d8a9ab9 100644
--- a/src/WediConfigurator.jsx
+++ b/src/WediConfigurator.jsx
@@ -25,7 +25,9 @@ import {
   BENCH_CORNER_LBL, buildFromMarker, sessionFromRows, wediSlotOf, coverStyles, legacyCoverPick, coverPickApplies,
   resolveCurb, curbOptions, curbPickOf, panelOptions, panelSheets, fastenerKits,
   addedRows, setAddedRow, wediBucketOf, wediAddParts, wediAddPartOf, curbAddOptions, coverAddOptions, curbProfile, catalog,
+  sdryNoFit,
 } from "./wedi.js";
+import { SDRY, sdryRole } from "./sdry.js";
 import { SwapPop, fmDelta, inchGlyph } from "./swappop.jsx";
 import { GROUPS, groupOf, groupLabel } from "./slots.js";
 import { TopDown, Iso, railSplit, RAIL_DESIGN_W, curbHeight } from "./showerdraw.jsx";
@@ -136,6 +138,11 @@ const CSS = `
    above the first family is gone entirely (owner 2026-08-02). */
 .wedi-pop .fam{margin-bottom:9px}
 .wedi-pop .fam-h{display:flex;align-items:baseline;gap:9px;margin-bottom:2px}
+.wedi-pop .wsnote{font-size:10px;color:var(--ft-faint);font-weight:600;line-height:1.4;margin-top:3px;max-width:300px}
+.wedi-pop .sdryask{border:1px solid var(--ft-border-strong);border-radius:9px;background:var(--ft-card);padding:12px 14px;margin:10px 0;font-size:12px;line-height:1.5}
+.wedi-pop .sdryask .why{font-weight:700;color:var(--ft-text);margin-bottom:8px}
+.wedi-pop .sdryask .acts{display:flex;flex-wrap:wrap;gap:6px}
+.wedi-pop .sdrychip{display:inline-block;margin-left:6px;font-size:10px;font-weight:700;color:var(--ft-brand-deep);background:var(--ft-tint);border:1px solid var(--ft-border);border-radius:9px;padding:0 7px;cursor:pointer}
 .wedi-pop .fam-h .t{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.1em;color:var(--ft-brand-deep)}
 .wedi-pop .cards{display:flex;flex-direction:column}
 .wedi-pop .pancard{display:flex;align-items:center;gap:10px;padding:1px 5px;border:0;border-bottom:1px solid var(--ft-row-line);background:none;cursor:pointer;text-align:left;color:inherit}
@@ -499,6 +506,7 @@ function seedState(seed) {
     tab: "kits", inp: { ...DEF_INP }, q: "", panKey: null, opts: { ...DEF_OPTS },
     manual: [], benches: [], walls: DEF_WALLS.map((w) => ({ ...w })), extraWalls: [], wallH: 96, wallSeq: 0,
     corners: { bl: false, br: false, fl: false, fr: false }, solveInput: null, maxIn: false, tileT: "", source: "stock",
+    wallSys: "board", sdryBase: "sdry", sdryNear: false,
   };
   if (!seed) return s;
   const cfg = seed.cfg;
@@ -511,6 +519,10 @@ function seedState(seed) {
     s.tileT = +cfg.tileT > 0 ? String(+cfg.tileT) : "";
     s.tab = seed.mode === "custom" ? "custom" : seed.mode === "browse" ? "browse" : "kits";
     s.panKey = cfg.panKey;
+    // Phase 2 (ADR 0051): the wall system and the Membrane floor answer
+    s.wallSys = cfg.wallSys === "membrane" ? "membrane" : "board";
+    s.sdryBase = cfg.sdryBase === "wedi" ? "wedi" : "sdry";
+    s.sdryNear = !!(cfg.solve && cfg.solve.input && cfg.solve.input.nearest);
     s.opts = {
       // old markers wrote the resolved panel and curb; the recipe's own reads as no pick (ADR 0049)
       panelKey: cfg.panelKey && cfg.panelKey !== SKU.panelDefault ? cfg.panelKey : undefined,
@@ -533,7 +545,12 @@ function seedState(seed) {
     s.walls.forEach((w) => { if (!rows.includes(w)) w.on = false; });
     (cfg.corners || []).forEach((k) => { if (s.corners[k] != null) s.corners[k] = true; });
     if (cfg.walls && cfg.walls.length) s.wallH = Math.round(+cfg.walls[0].h) || 96;
-    if (cfg.solve && cfg.solve.input) { s.solveInput = cfg.solve.input; s.inp = { ...DEF_INP, ...cfg.solve.input, drainX: cfg.solve.input.drainX || "", drainY: cfg.solve.input.drainY || "" }; }
+    if (cfg.solve && cfg.solve.input) {
+      // the system rides the popup's own state, never the room form
+      const { system, nearest, ...si } = cfg.solve.input;
+      s.solveInput = si;
+      s.inp = { ...DEF_INP, ...si, drainX: si.drainX || "", drainY: si.drainY || "" };
+    }
     else if (cfg.room) s.inp = { ...s.inp, w: cfg.room.w, d: cfg.room.d };
     return s;
   }
@@ -640,6 +657,13 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
   const [benches, setBenches] = useState(s0.benches);
   const [opts, setOpts] = useState(s0.opts);
   const [inp, setInp] = useState(s0.inp);
+  // The wall system (Phase 2, ADR 0051): Building Panel, or Membrane — S-DRY
+  // walls on an S-DRY base, or on a wedi pan when the owner answered the
+  // no-fit prompt that way (sdryBase "wedi"), or on the nearest S-DRY base.
+  const [wallSys, setWallSys] = useState(s0.wallSys);
+  const [sdryBase, setSdryBase] = useState(s0.sdryBase);
+  const [sdryNear, setSdryNear] = useState(s0.sdryNear);
+  const [sdryAsk, setSdryAsk] = useState(false);
   // "Overall max" (owner ask 2026-07-30): the typed sizes are the whole
   // footprint — every fully open edge pulls its curb inside the line and
   // the pan space gives up (curb width − the ½" pan lap).
@@ -882,8 +906,10 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
     round2(((+len || 0) * (+h || 0) * (faces === "both" ? 2 : 1) + (faces === "in-end" ? WALL_THICK * (+h || 0) : 0)) / 144);
 
   // The Fit plan (level courses, mixed sheet sizes, a vertical single sheet
-  // where it kills the seams) replaces the engine's by-area panel line.
+  // where it kills the seams) replaces the engine's by-area panel line — a
+  // Membrane build has none, and its membrane line stays.
   const applyPanelFit = (lines, wl, panelSf) => {
+    if (!lines.some((l) => l.group === "walls" && l.auto !== false && l.item.group === "panel")) return lines;
     const plan = panelPlan(expandWallFaces(wl));
     const out = lines.filter((l) => !(l.group === "walls" && l.auto !== false));
     const vWalls = plan.detail.filter((d) => d.vertical).length;
@@ -953,6 +979,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
         walls: buildWalls, wallHeight: +wallH || 80,
         panelKey: opts.panelKey, curbPick: opts.curbPick, fastenerKey: opts.fastenerKey, coverPick: opts.coverPick,
         coverFrame: opts.coverFrame, sealantForm: opts.sealantForm, recess: opts.recess,
+        ...(wallSys === "membrane" ? { wallSys, ...(pan && pan.sub !== "sdry" ? { sdryBase: "wedi" } : {}) } : {}),
         manual: manual.slice(), benches: benches.slice(), tier: tierId,
         corners: ["bl", "br", "fl", "fr"].filter((k) => corners[k]),
         mode: option ? "custom" : "kit", maxIn: maxIn, tileT: tileIn,
@@ -970,7 +997,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
       return { pan: null, lines, panelSf: 0, factory: null, hints, mode: "browse", cfg: {}, soNet };
     }
     return null;
-  }, [panKey, option, buildWalls, wallH, opts, benches, qtyOv, manual, panelFit, tierId, corners, maxIn, tileIn, source]);
+  }, [panKey, option, buildWalls, wallH, opts, benches, qtyOv, manual, panelFit, tierId, corners, maxIn, tileIn, source, wallSys]);
 
   // A Reconfigure opens on what the sheet says (owner 2026-09-02): the placed
   // rows are the truth once a kit lands, so a quantity typed on a row — or
@@ -1056,7 +1083,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
     setInp(next);
     // a kit's size IS the pan size — the seeded form reads it that way
     setMaxIn(false);
-    setResults(solve({ w: next.w, d: next.d, curb: next.curb, drain: next.drain, tolerance: 0.51, anchor: next.anchor || "left", source }));
+    setResults(solveRoom(next, false));
   };
   // A kit card is a hard reset (owner rule 2026-07-30): once a build is
   // customized it IS the custom shower, so a kit click asks before wiping it.
@@ -1077,7 +1104,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
       setInp({ ...DEF_INP });
       setMaxIn(false);
       setTileT("");
-      setResults(solve({ w: DEF_INP.w, d: DEF_INP.d, curb: DEF_INP.curb, drain: DEF_INP.drain, tolerance: 0.51, source }));
+      setResults(solveRoom(DEF_INP, false));
     }
   };
   const pickPan = (key) => {
@@ -1113,7 +1140,12 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
     const picked = opts.curbPick ? resolveCurb(opts.curbPick, 60, "fundo").item : null;
     return curbInsets({ w: +i.w || 0, d: +i.d || 0 }, wl, picked ? picked.key : SKU.curbLean60, tileIn);
   };
+  // Membrane on an S-DRY base runs the S-DRY fit: bases are cut evenly, so the
+  // curb inset, the drain pin and the anchor don't apply.
+  const sdrySys = () => (wallSys === "membrane" && sdryBase === "sdry" ? { system: "sdry", ...(sdryNear ? { nearest: true } : {}) } : null);
   const solveRoom = (i, maxOn, src) => {
+    const sys = sdrySys();
+    if (sys) return solve({ w: +i.w || 0, d: +i.d || 0, curb: i.curb, drain: i.drain, tolerance: 0.51, source: src || source, ...sys });
     const ins = insetFor(i, maxOn);
     const dx = +i.drainX || 0, dy = +i.drainY || 0;
     const res = solve({
@@ -1140,6 +1172,35 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
     const next = { ...inp, ...patch }; setInp(next); runSolve(next);
     if (patch.curb && patch.curb !== inp.curb) setOpts((o) => ({ ...o, curbPick: undefined }));
   };
+  // Flipping the wall system re-solves once the new state is in: a custom build
+  // re-picks its top option, the Kits tab only refreshes the cards.
+  const sysSig = wallSys + "|" + sdryBase + "|" + sdryNear;
+  const sysSeen = useRef(sysSig);
+  useEffect(() => {
+    if (sysSeen.current === sysSig) return;
+    sysSeen.current = sysSig;
+    if (option || tab === "custom") runSolve(inp); else setResults(solveRoom(inp, maxIn));
+    // eslint-disable-next-line react-hooks/exhaustive-deps
+  }, [sysSig]);
+  const setWallSystem = (ws) => {
+    if (ws === wallSys) return;
+    setWallSys(ws); setSdryBase("sdry"); setSdryNear(false); setSdryAsk(false);
+    // an S-DRY base takes Membrane walls only — Building Panel starts from the cards
+    if (ws === "board" && pan && pan.sub === "sdry" && !option) hardReset(null);
+  };
+  const answerSdry = (how) => {
+    setSdryAsk(false);
+    if (how === "board") { setWallSystem("board"); return; }
+    setSdryBase(how === "wedi" ? "wedi" : "sdry");
+    setSdryNear(how === "nearest");
+    setTab("custom");
+  };
+  const wallSysSeg = (
+    <div className="rseg" data-wedi-wallsys>
+      <button className={wallSys === "board" ? "on" : ""} onClick={() => setWallSystem("board")} data-wedi-wallsys-board>Building Panel</button>
+      <button className={wallSys === "membrane" ? "on" : ""} onClick={() => setWallSystem("membrane")} data-wedi-wallsys-membrane>Membrane (S-DRY)</button>
+    </div>
+  );
   const selectOption = (k) => { const o = results[k]; if (!o) return; retuneWalls(); setOption(o); setPanKey(o.pan.key); resetBuild(true); };
 
   // One-shot at mount: the room always arrives solved, so the Custom tab is
@@ -1336,7 +1397,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
     const runs = curbRuns(diag.room, buildWalls, ["bl", "br", "fl", "fr"].filter((k) => corners[k]),
       (build && build.benches) || []);
     // the kit's own curb — an added curb is a part on the bill, not a curb in the room
-    const line = build && build.lines.find((l) => l.item.group === "curb" && !l.added);
+    const line = build && build.lines.find((l) => (l.item.group === "curb" || sdryRole(l.item) === "curb") && !l.added);
     return {
       segs: line ? runs.segs : [], diags: line ? runs.diags : [], cuts: runs.diags,
       h: line ? curbHeight(line.item) : 0, w: line ? curbWidth(line.item) : 0,
@@ -1407,6 +1468,15 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
       };
     }
     if (g === "curb") return build.curbFit ? { stepped: "curb" } : null;
+    const role = sdryRole(line.item);
+    if (role === "cover") {
+      return { title: "S-DRY drain cover", list: bySource(catalog().filter((e) => sdryRole(e) === "cover")),
+        set: (k) => setOpts((o) => ({ ...o, coverPick: k && k !== SDRY.coverSS ? { key: k } : undefined })) };
+    }
+    if (role === "curb") {
+      return { title: "S-DRY curb", list: bySource([item(SDRY.curbFull), item(SDRY.curbLean)].filter(Boolean)), none: "No curb",
+        set: (k) => setOpts((o) => ({ ...o, curbPick: !k ? { none: true } : k === SDRY.curbLean ? { sub: "lean" } : undefined })) };
+    }
     if (g === "fastener" && fastenerKits().some((f) => f.key === line.item.key)) {
       return { title: "Fastener kit", list: bySource(fastenerKits()), set: (k) => setOpts((o) => ({ ...o, fastenerKey: k && k !== SKU.fastenerKit ? k : undefined })) };
     }
@@ -1449,11 +1519,14 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
   // second confusing price beside the pan's).
   const kitTotals = useMemo(() => {
     const out = {};
-    const fams = FAM_DEFS.map((f) => (f[0] === "module" ? group("module").filter((m) => m.sub === "neo") : pans({ family: f[0] })));
+    const fams = FAM_DEFS.map((f) => (f[0] === "module" ? group("module").filter((m) => m.sub === "neo") : pans({ family: f[0] })))
+      .concat([pans({ family: "sdry", sdry: true })]);
     fams.forEach((list) => list.forEach((p) => {
       const wl = wallsArr(p, null);
       const lens = autoWallLens(p, null);
-      const b = kitFor(p.key, { walls: wl, sealantForm: opts.sealantForm, room: { w: lens.back, d: lens.left } });
+      // an S-DRY card prices the full S-DRY build: S-DRY curb, drain and walls
+      const b = kitFor(p.key, { walls: wl, sealantForm: opts.sealantForm, room: { w: lens.back, d: lens.left },
+        ...(p.sub === "sdry" ? { wallSys: "membrane" } : {}) });
       if (!b) return;
       const lines = panelFit ? applyPanelFit(b.lines, wl, b.panelSf) : b.lines;
       out[p.key] = round2(lines.reduce((t, l) => t + tierOf(l.item) * l.qty, 0));
@@ -1574,8 +1647,12 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
 
   const kitsTab = (
     <>
-      {FAM_DEFS.map((fd) => {
-        const list = fd[0] === "module" ? group("module").filter((m) => m.sub === "neo") : pans({ family: fd[0] });
+      <div className="fam-h" style={{ alignItems: "center", gap: 10 }}>
+        <div className="t">Wall system</div>
+        {wallSysSeg}
+      </div>
+      {(wallSys === "membrane" ? [["sdry", "S-DRY bases"]] : FAM_DEFS).map((fd) => {
+        const list = fd[0] === "module" ? group("module").filter((m) => m.sub === "neo") : pans({ family: fd[0], sdry: fd[0] === "sdry" });
         if (!list.length) return null;
         const usualDrain = majority(list, (p) => (p.group === "module" ? "module" : p.drain?.type || ""));
         return (
@@ -1678,7 +1755,10 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
 
   const customTab = (() => {
     const sel = option && results.includes(option) ? option : null;
-    const tileEats = maxIn && inp.curb !== "curbless";
+    const onSdry = !!sdrySys();
+    const tileEats = maxIn && inp.curb !== "curbless" && !onSdry;
+    const noFit = wallSys === "membrane" ? sdryNoFit({ ...inp, source }) : "";
+    const ask = wallSys === "membrane" && (sdryAsk || (onSdry && !sdryNear && !results.length));
     return (
       <>
         <div className="roomform">
@@ -1738,22 +1818,30 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
                     ))}
                   </div>
                 </div>
-                <div className="rf"><label>Drain — from left × back</label>
+                <div className={"rf" + (onSdry ? " dim" : "")} title={onSdry ? "an S-DRY base is cut evenly on every side — the drain stays centred on it" : undefined}>
+                  <label>Drain — from left × back</label>
                   <div className="dims">
-                    <NumIn className="rinp" placeholder="auto" value={inp.drainX} onCommit={(v) => setInput({ drainX: v.trim() })} />
+                    <NumIn className="rinp" placeholder="auto" disabled={onSdry} value={inp.drainX} onCommit={(v) => setInput({ drainX: v.trim() })} />
                     <span>×</span>
-                    <NumIn className="rinp" placeholder="auto" value={inp.drainY} onCommit={(v) => setInput({ drainY: v.trim() })} />
+                    <NumIn className="rinp" placeholder="auto" disabled={onSdry} value={inp.drainY} onCommit={(v) => setInput({ drainY: v.trim() })} />
                     <span>in</span>
                   </div>
                 </div>
-                <div className="rf"><label>Pan against</label>
+                <div className={"rf" + (onSdry ? " dim" : "")}><label>Pan against</label>
                   <div className="rseg">
-                    <button className={inp.anchor !== "right" ? "on" : ""} onClick={() => setInput({ anchor: "left" })}>Left</button>
-                    <button className={inp.anchor === "right" ? "on" : ""} onClick={() => setInput({ anchor: "right" })}>Right</button>
+                    <button disabled={onSdry} className={inp.anchor !== "right" ? "on" : ""} onClick={() => setInput({ anchor: "left" })}>Left</button>
+                    <button disabled={onSdry} className={inp.anchor === "right" ? "on" : ""} onClick={() => setInput({ anchor: "right" })}>Right</button>
                   </div>
                 </div>
               </div>
             </div>
+            <div className="rfgrp">
+              <div className="h">Wall system</div>
+              {wallSysSeg}
+              <div className="wsnote">{wallSys === "membrane"
+                ? "S-DRY membrane over cement board or drywall (by others), on " + (sdryBase === "wedi" ? "a wedi pan." : sdryNear ? "the nearest S-DRY base." : "an S-DRY base.")
+                : "wedi Building Panel is the substrate — no backer needed."}</div>
+            </div>
             <div className="rfgrp span">
               <div className="h rowh">Walls
                 <span className="wallctl">
@@ -1773,7 +1861,19 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
           </div>
         </div>
 
-        {!results.length ? (
+        {ask ? (
+          <div className="sdryask" data-wedi-sdryask>
+            <div className="why">{noFit
+              ? "No S-DRY base fits — " + noFit + "."
+              : "How should this Membrane shower's floor be built?"}</div>
+            <div className="acts">
+              {!noFit && <button className={"addchip" + (sdryBase === "sdry" && !sdryNear ? " on" : "")} onClick={() => answerSdry("sdry")} data-sdry-answer="sdry">S-DRY base, fit to the room</button>}
+              <button className={"addchip" + (sdryBase === "wedi" ? " on" : "")} onClick={() => answerSdry("wedi")} data-sdry-answer="wedi">Use a wedi pan + curb, with S-DRY walls</button>
+              <button className={"addchip" + (sdryNear ? " on" : "")} onClick={() => answerSdry("nearest")} data-sdry-answer="nearest">Use the nearest S-DRY base anyway</button>
+              <button className="addchip" onClick={() => answerSdry("board")} data-sdry-answer="board">Back to Building Panel</button>
+            </div>
+          </div>
+        ) : !results.length ? (
           <div className="nores">
             No option fits {inch(inp.w)}″ × {inch(inp.d)}″ {inp.curb}
             {inp.drain !== "any" ? " with a " + inp.drain + " drain" : ""} — extensions reach{" "}
@@ -1782,7 +1882,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
         ) : (<>
           <div className="optrow">
             {results.map((o, k) => {
-              const kit = kitFor(o.pan.key, { option: o, walls: wallsArr(o.pan, o.room) });
+              const kit = kitFor(o.pan.key, { option: o, walls: wallsArr(o.pan, o.room), ...(wallSys === "membrane" ? { wallSys } : {}) });
               const floor = round2(o.floorLines.reduce((t, l) => t + tierOf(l.item) * l.qty, 0));
               const full = kit ? kit.lines.reduce((t, l) => t + tierOf(l.item) * l.qty, 0) : 0;
               return (
@@ -1997,7 +2097,13 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
         <div className="bc-scroll">
           <div className="bc-h">
             <div className="t">The build</div>
-            <div className="sub">{pan ? (option ? option.title : unwedi(pan.name)) : "manual — from Browse"}</div>
+            <div className="sub">{pan ? (option ? option.title : unwedi(pan.name)) : "manual — from Browse"}
+              {pan && " · " + (wallSys === "membrane" ? "S-DRY membrane walls" : "Building Panel walls")}
+              {pan && wallSys === "membrane" && (pan.sub !== "sdry" || sdryNear) && (
+                <button className="sdrychip" data-wedi-sdrychip title="reopen the Membrane floor choice"
+                  onClick={() => { setSdryAsk(true); setTab("custom"); }}>
+                  {pan.sub !== "sdry" ? "S-DRY walls on a wedi pan" : "nearest S-DRY base"} · change</button>
+              )}</div>
           </div>
 
           {GROUPS.map(({ key: g, label }) => {
@@ -2109,6 +2215,9 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
           {build.hints.includes("no-panel") && (
             <div className="whint">No wedi building panel in the price book — wall sheets were not priced. Re-import the book, or pick a panel by hand.</div>
           )}
+          {build.hints.includes("backer") && (
+            <div className="whint" data-wedi-backer>Membrane needs a backer — cement board or drywall behind it, by others</div>
+          )}
           {build.hints.includes("no-cover") && (
             <div className="whint">No drain cover in the price book — the drain line was left off. Re-import the book, or pick a cover by hand.</div>
           )}
@@ -2729,6 +2838,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
       <div className="ps-head">
         <div className="t">wedi Shower Layout</div>
         {projectName ? <div className="sub">{projectName}</div> : null}
+        <div className="sub">{wallSys === "membrane" ? "S-DRY membrane walls" : "Building Panel walls"}</div>
         <div className="dt">{new Date().toLocaleDateString()}</div>
       </div>
       <div className="ps-diags">
@@ -2740,7 +2850,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
           <Iso o={drawDiag} w={460} h={360} dWalls={dWalls} panelFit={panelFit} benches={(build && build.benches) || []}
             framedFit={!!(build && build.panPlan)} cuts={curb.cuts} curbs={curb.segs} curbDiags={curb.diags} curbH={curb.h} curbW={curb.w} /></div>
       </div>
-      {(drawDiag.pieces.some((p) => p.cut) || (drawDiag.warnings || []).length || CORNER_LBL.some((c) => corners[c[0]])) && (<>
+      {(drawDiag.pieces.some((p) => p.cut) || (drawDiag.warnings || []).length || CORNER_LBL.some((c) => corners[c[0]]) || build.hints.includes("backer")) && (<>
         <div className="ps-sec">Cuts &amp; install notes</div>
         {drawDiag.pieces.filter((p) => p.cut).map((p, i) => (
           <div className="ps-warn" key={"c" + i}>✂ Cut {p.item.us || p.item.erp} to {inch(p.w)}″ × {inch(p.d)}″ (from {inch(p.cut.w)}″ × {inch(p.cut.d)}″)</div>
@@ -2754,6 +2864,7 @@ function WediConfiguratorBody({ seed, tier, onTierChange, wediBuilderPct, schlut
           );
         })}
         {drawDiag.drain && drawDiag.drain.note && <div className="ps-warn">• {drawDiag.drain.note}</div>}
+        {build.hints.includes("backer") && <div className="ps-warn">• Cement board / drywall substrate — by others · membrane needs a backer</div>}
       </>)}
       <div className="ps-sec">Materials</div>
       <table className="ps-table">
```

- [ ] **Step 2: Lint and test.**

Run: `npx eslint src/WediConfigurator.jsx && npm test`
Expected: lint clean; `# pass 1814`, `# fail 0`.

- [ ] **Step 3: Smoke it in the preview.** Start vite if it isn't running
  (`npx vite --port 5199`), open `http://localhost:5199/wedi-preview.html`
  and check:
  - Kits → Membrane (S-DRY) shows four S-DRY bases.
  - Clicking 4′×6′ bills S-DRY lines, with the Walls group holding the
    membrane roll and no Building Panel.
  - Custom 100×120 shows the prompt.

  Task 7 scripts this in full.

- [ ] **Step 4: Commit.**

```bash
git add src/WediConfigurator.jsx
git commit -m "wedi popup: Building Panel | Membrane (S-DRY) fork, S-DRY cards and options, the no-fit prompt"
```

---

### Task 6: CompareTab follows the host's wall system; Schluter says "Membrane"

Model: Sonnet.

**Files:**
- Modify: `src/CompareTab.jsx`
- Modify: `src/SchluterConfigurator.jsx` (the two segment labels, the bill
  subtitle)

**Interfaces:**
- Consumes (Task 4): `wediBuildFor(room, { …, wallSys })`,
  `schluterBuildFor(room, cat, { …, wallSys })`. From Task 5, the host
  `hostCfg.wallSys`.
- Produces: `data-cmp-sys="wedi|schluter"` column headers that read the
  system:
  - wedi: "S-DRY membrane", "S-DRY membrane on a wedi pan" or
    "Building Panel";
  - Schluter: "KERDI membrane" or "KERDI-BOARD".

- [ ] **Step 1: Apply the diffs:**

```diff
diff --git a/src/CompareTab.jsx b/src/CompareTab.jsx
index d2fc9d5..e2c4921 100644
--- a/src/CompareTab.jsx
+++ b/src/CompareTab.jsx
@@ -138,6 +138,13 @@ function Cell({ rows, plus, lens, miss, first, brand, onPick, onDrop, canAdd })
   );
 }
 
+// What the wedi column's walls are — S-DRY on a wedi pan when S-DRY can't fit.
+function wediSysLabel(build, wallSys) {
+  const sys = build ? (build.cfg && build.cfg.wallSys) || "board" : wallSys;
+  if (sys !== "membrane") return "Building Panel";
+  return build && build.pan && build.pan.sub !== "sdry" ? "S-DRY membrane on a wedi pan" : "S-DRY membrane";
+}
+
 export default function CompareTab({
   host, hostCfg, hostBuild, cat, source, tier, hostMode = "custom",
   wediBuilderPct, schluterBuilderPct,
@@ -163,6 +170,11 @@ export default function CompareTab({
     () => (wediHost ? roomFromWedi(hostCfg) : roomFromSchluter(hostCfg)),
     [wediHost, hostCfg]);
   const roomOk = room.w > 0 && room.d > 0;
+  // The other column follows the host's wall system (Phase 2, ADR 0051):
+  // Membrane faces Membrane, board faces board.
+  const wallSys = wediHost
+    ? (hostCfg && hostCfg.wallSys === "membrane" ? "membrane" : "board")
+    : (hostCfg && hostCfg.wallSys === "board" ? "board" : "membrane");
 
   // The registry bag the host hands over serves whichever engine THIS tab has
   // to assemble — the host popup already has its own. Hooks can't be
@@ -204,13 +216,13 @@ export default function CompareTab({
   // The HOST column is whatever that popup has on screen; the other column is
   // that engine's house kit for the same room, plus the mirrored lines.
   const wediBuild = useMemo(
-    () => (wediHost ? hostBuild || null : roomOk && wediCatReady ? wediBuildFor(room, { source, tier, manual: plan.manual }) : null),
-    [wediHost, hostBuild, room, roomOk, wediCatReady, source, tier, plan.manual]);
+    () => (wediHost ? hostBuild || null : roomOk && wediCatReady ? wediBuildFor(room, { source, tier, manual: plan.manual, wallSys }) : null),
+    [wediHost, hostBuild, room, roomOk, wediCatReady, source, tier, plan.manual, wallSys]);
   const sch = useMemo(() => {
     if (!wediHost) return { build: hostBuild || null, cfg: hostCfg || null };
     if (!roomOk || !schCatReady || !schCat.length) return { build: null, cfg: null };
-    return schluterBuildFor(room, schCat, { source, mortarItem, manual: plan.manual });
-  }, [wediHost, hostBuild, hostCfg, room, roomOk, schCat, schCatReady, source, mortarItem, plan.manual]);
+    return schluterBuildFor(room, schCat, { source, mortarItem, manual: plan.manual, wallSys });
+  }, [wediHost, hostBuild, hostCfg, room, roomOk, schCat, schCatReady, source, mortarItem, plan.manual, wallSys]);
 
   // The other column draws its kit lines from its build and its mirrored
   // lines from the plan, one per host line — the engine bills them summed.
@@ -301,10 +313,9 @@ export default function CompareTab({
 
   const tip = (
     <div className="space-y-1.5">
-      <p><b>Walls</b> - wedi: structural foam panel, no backer, sealant seams. Schluter: KERDI membrane over cement board
-        (cheap material, more labor) or KERDI-BOARD (closest to wedi). The wall line isn't apples-to-apples: the wedi
-        panel <i>is</i> the substrate, while KERDI membrane needs backer (by others) under it. Switch the Schluter build
-        to KERDI-BOARD to compare like-for-like structure.</p>
+      <p><b>Walls</b> - both columns use the same wall system as the build: Membrane (wedi S-DRY or KERDI, over cement
+        board or drywall by others) or board (wedi Building Panel or KERDI-BOARD, no backer). Flip the wall system in
+        the popup to compare the other pair.</p>
       <p><b>Fit strategy</b> - wedi extends pans and cuts them (extensions + the 6″/12″ deep-cut rule). Schluter cuts
         trays only - no extension parts - so odd rooms lean on the next tray up or a mortar bed.</p>
       <p><b>Pricing model</b> - wedi publishes retail; cost is the ERP net, no markup knob. Schluter is a markup book:
@@ -346,12 +357,12 @@ export default function CompareTab({
 
       <div className="cmp-grid">
         <div className="cat" />
-        <div className="brandh">
-          <span className="bbadge wedi">wedi</span> foam pan system
+        <div className="brandh" data-cmp-sys="wedi">
+          <span className="bbadge wedi">wedi</span> {wediSysLabel(wediBuild, wallSys)}
           <small>{wediHost ? "this build" : "house kit"}</small>
         </div>
-        <div className="brandh">
-          <span className="bbadge slt">Schluter</span> KERDI system
+        <div className="brandh" data-cmp-sys="schluter">
+          <span className="bbadge slt">Schluter</span> {(sch.cfg ? sch.cfg.wallSys : wallSys) === "board" ? "KERDI-BOARD" : "KERDI membrane"}
           <small>{wediHost ? "house kit" : "this build"}</small>
         </div>
         {layout.map((g, gi) => (
```

```diff
diff --git a/src/SchluterConfigurator.jsx b/src/SchluterConfigurator.jsx
index 78ba949..faa02b4 100644
--- a/src/SchluterConfigurator.jsx
+++ b/src/SchluterConfigurator.jsx
@@ -1191,7 +1191,7 @@ export default function SchluterConfigurator({
       <div className="fam-h" style={{ alignItems: "center", gap: 10 }}>
         <div className="t">Wall system</div>
         <div className="rseg">
-          <button className={wallSys === "membrane" ? "on" : ""} onClick={() => setWallSys("membrane")} data-schluter-kits-membrane>KERDI over backer</button>
+          <button className={wallSys === "membrane" ? "on" : ""} onClick={() => setWallSys("membrane")} data-schluter-kits-membrane>Membrane</button>
           <button className={wallSys === "board" ? "on" : ""} onClick={() => setWallSys("board")} data-schluter-kits-board>KERDI-BOARD</button>
         </div>
         <div className="hint">every price below is the FULL kit under this wall system — flip to compare</div>
@@ -1362,7 +1362,7 @@ export default function SchluterConfigurator({
           <div className="rfgrp">
             <div className="h">Wall system — the Schluter fork</div>
             <div className="rseg">
-              <button className={wallSys === "membrane" ? "on" : ""} onClick={custom(() => setWallSys("membrane"))}>KERDI over backer</button>
+              <button className={wallSys === "membrane" ? "on" : ""} onClick={custom(() => setWallSys("membrane"))}>Membrane</button>
               <button className={wallSys === "board" ? "on" : ""} onClick={custom(() => setWallSys("board"))}>KERDI-BOARD</button>
             </div>
             <div className="wsnote">{wallSys === "membrane"
@@ -1582,7 +1582,7 @@ export default function SchluterConfigurator({
         <div className="bc-scroll">
           <div className="bc-h">
             <div className="t">Build</div>
-            <div className="sub">{inches(cfg.w)}×{inches(cfg.d)}{cfg.maxIn ? " tray (max inside)" : ""} · {cfg.curbed ? "curbed" : "curbless"} · {effDrain} drain · {cfg.wallSys === "board" ? "KERDI-BOARD walls" : "KERDI membrane walls"}{pickCand && pickCand.cut ? ` · tray cut ${pickCand.cut}″` : ""}</div>
+            <div className="sub">{inches(cfg.w)}×{inches(cfg.d)}{cfg.maxIn ? " tray (max inside)" : ""} · {cfg.curbed ? "curbed" : "curbless"} · {effDrain} drain · {cfg.wallSys === "board" ? "KERDI-BOARD walls" : "Membrane walls (KERDI)"}{pickCand && pickCand.cut ? ` · tray cut ${pickCand.cut}″` : ""}</div>
           </div>
           {GROUPS.map(({ key: g, label }) => {
             const gl = build.lines.filter((l) => groupOf(l.slot) === g);
```

- [ ] **Step 2: Lint, test, build.**

Run: `npx eslint src && npm test && VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build`
Expected: lint clean; `# pass 1814`, `# fail 0`; the build succeeds (the CSS
minify warning was already there).

- [ ] **Step 3: Commit.**

```bash
git add src/CompareTab.jsx src/SchluterConfigurator.jsx
git commit -m "Compare follows the host's wall system and names it; Schluter's fork reads Membrane"
```

---

### Task 7: Proof — the p2 shots; re-run 1a–1d

Model: Sonnet.

**Files:**
- Create: `.scratch/158_shower-config-roadmap/p2/shoot-wedi.mjs`
- Create: `.scratch/158_shower-config-roadmap/p2/shoot-compare.mjs`
- Create (shots): `.scratch/158_shower-config-roadmap/p2/{k1-sdry-kit,c1-sdry-extension,f1-sdry-prompt,f2-wedi-pan-sdry-walls,f3-nearest,p1-sdry-print,k2-building-panel,cm1-wedi-membrane,cm2-wedi-board,cm3-schluter-membrane,cm4-schluter-board,cm5-linear-fallback}.png`

- [ ] **Step 1: Write `shoot-wedi.mjs`:**

```js
// Proof: wedi's Membrane (S-DRY) wall system (ticket 158 Phase 2, ADR 0051) —
// the Kits tab's S-DRY cards, an S-DRY build's bill (S-DRY floor, membrane,
// tape, corners, collars, SEAL, PRO-SET by area, the backer hint), the Custom
// tab's S-DRY options (extension, two extensions), the no-fit prompt and its
// "wedi pan + S-DRY walls" answer with the bill chip, and the print sheet.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p2/shoot-wedi.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p2";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1300 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const fail = (m) => { console.error("FAIL:", m); err = true; };
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const printShot = async (name) => {
  await pg.emulateMedia({ media: "print" });
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  await pg.emulateMedia({ media: null });
  console.log("shot", name);
};
const flat = (t) => t.replace(/\n+/g, " | ");
const grp = (name) => pg.locator(".bgroup", { has: pg.locator(".bg-h", { hasText: new RegExp("^" + name, "i") }) });
const grpText = async (name) => (await grp(name).count() ? flat(await grp(name).innerText()) : "");
const tab = (name) => pg.locator(".modetab", { hasText: name }).first().click();
const room = async (w, d) => {
  const dims = pg.locator(".rf", { hasText: "Shower size" }).locator("input");
  await dims.nth(0).fill(String(w)); await dims.nth(0).press("Enter"); await pg.waitForTimeout(300);
  await dims.nth(1).fill(String(d)); await dims.nth(1).press("Enter"); await pg.waitForTimeout(600);
};

await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500); // Full catalog

// --- Kits: the Membrane cards are the four S-DRY bases ---
await pg.locator("[data-wedi-wallsys-membrane]").first().click(); await pg.waitForTimeout(600);
const cards = await pg.locator("[data-wedi-pan]").evaluateAll((els) => els.map((e) => e.getAttribute("data-wedi-pan")));
console.log("Membrane cards:", cards.join(", "));
if (cards.join() !== "US9176001,US9176002,US9176003,US9176004") fail("the Membrane Kits tab is not the four S-DRY bases");
await pg.locator("[data-wedi-pan='US9176003']").click(); await pg.waitForTimeout(800);
const sub = await pg.locator(".bc-h .sub").innerText();
console.log("subtitle:", sub);
if (!/S-DRY membrane walls/.test(sub)) fail("the bill subtitle does not name the S-DRY walls");
// the preview's stock book names S-DRY parts its own way ("S-DRY™ BFD")
const need = [["Base", /S-Dry Shower Base/i], ["Drain", /BFD|Bonding/i], ["Drain", /DCSS|Drain Cover/i], ["Curb", /S-DRY.*Curb/i],
  ["Walls", /S-DRY/i], ["Seams", /S-DRY.*Tape/i], ["Seams", /Inside Corner/i], ["Seams", /Mixing Valve Collar/i],
  ["Setting", /S-DRY.*SEAL/i], ["Setting", /PRO-SET/]];
for (const [g, re] of need) if (!re.test(await grpText(g))) fail(`${re} is not under ${g}`);
if (/Building Panel|Fastener Kit|Joint/.test(await grpText("Walls") + await grpText("Seams"))) fail("a Building Panel line survived under Membrane");
if (!(await pg.locator("[data-wedi-backer]").count())) fail("no backer hint");
await shot("k1-sdry-kit");

// --- Custom: S-DRY options ---
await tab("Custom shower"); await pg.waitForTimeout(500);
await room(48, 90);
const t1 = await pg.locator(".optcard .t").allInnerTexts();
console.log("48×90 options:", t1.join(" / "));
if (!/extension/.test(t1[0] || "")) fail("48×90 does not lead with base + extension");
await shot("c1-sdry-extension");
await room(72, 90);
const t2 = await pg.locator(".optcard .t").allInnerTexts();
console.log("72×90 options:", t2.join(" / "));
if (!t2.some((t) => /2 extensions/.test(t))) fail("72×90 offers no two-extension option");

// --- the no-fit prompt ---
await room(100, 120);
const why = await pg.locator("[data-wedi-sdryask] .why").innerText().catch(() => "");
console.log("prompt:", why);
if (!/larger than an S-DRY base/.test(why)) fail("no prompt naming why S-DRY can't fit");
await shot("f1-sdry-prompt");
await pg.locator('[data-sdry-answer="wedi"]').click(); await pg.waitForTimeout(900);
const chip = await pg.locator("[data-wedi-sdrychip]").innerText().catch(() => "");
console.log("chip:", chip);
if (!/S-DRY walls on a wedi pan/.test(chip)) fail("no 'S-DRY walls on a wedi pan' chip");
if (/S-Dry Shower Base/i.test(await grpText("Base"))) fail("the wedi-pan answer still bills an S-DRY base");
if (!/S-DRY/i.test(await grpText("Walls"))) fail("the wedi-pan answer lost the S-DRY walls");
await shot("f2-wedi-pan-sdry-walls");
await pg.locator("[data-wedi-sdrychip]").click(); await pg.waitForTimeout(400);
await pg.locator('[data-sdry-answer="nearest"]').click(); await pg.waitForTimeout(900);
if (!/S-Dry Shower Base/i.test(await grpText("Base"))) fail("the nearest answer did not build on an S-DRY base");
if (!/nearest S-DRY base/.test(await pg.locator("[data-wedi-sdrychip]").innerText().catch(() => ""))) fail("no nearest chip");
await shot("f3-nearest");

// --- print ---
await room(48, 72);
await pg.locator('[data-sdry-answer="sdry"]').click().catch(() => {}); await pg.waitForTimeout(600);
await pg.locator("[data-wedi-print], button:has-text('Print layout')").first().click(); await pg.waitForTimeout(400);
const pt = await pg.locator(".wedi-printsheet").innerText().catch(() => "");
if (!/S-DRY membrane walls/.test(pt)) fail("the print head does not name the wall system");
if (!/membrane needs a backer/.test(pt)) fail("the print sheet lacks the backer note");
await printShot("p1-sdry-print");
await pg.keyboard.press("Escape"); await pg.waitForTimeout(300);

// --- back to Building Panel: the kit is as today ---
await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500);
if ((await pg.locator("[data-wedi-pan='US9176001']").count())) fail("S-DRY cards show under Building Panel");
await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout(800);
if (!/Building Panel walls/.test(await pg.locator(".bc-h .sub").innerText())) fail("the Building Panel subtitle is missing");
if (!/Building Panel/.test(await grpText("Walls"))) fail("the Building Panel kit lost its panel");
await shot("k2-building-panel");

await b.close();
if (err) { console.error("checks FAILED"); process.exit(1); }
console.log("all checks passed");
```

- [ ] **Step 2: Write `shoot-compare.mjs`:**

```js
// Proof: Compare follows the host's wall system (ticket 158 Phase 2, ADR
// 0051) — wedi Membrane (S-DRY) faces Schluter KERDI membrane, wedi Building
// Panel faces KERDI-BOARD, and the Schluter host (now "Membrane | KERDI-BOARD")
// the other way round; a linear room the S-DRY fit can't take puts the wedi
// column on a wedi pan with S-DRY walls, and the header says so.
//   npx vite --port 5199 ; node .scratch/158_shower-config-roadmap/p2/shoot-compare.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire("/opt/node22/lib/node_modules/playwright/")("playwright-core");
const OUT = ".scratch/158_shower-config-roadmap/p2";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const pg = await b.newPage({ viewport: { width: 1760, height: 1300 } });
let err = false; pg.on("pageerror", (e) => { console.error("PAGEERROR", e); err = true; });
const fail = (m) => { console.error("FAIL:", m); err = true; };
const shot = async (name) => { await pg.waitForTimeout(500); await pg.screenshot({ path: `${OUT}/${name}.png` }); console.log("shot", name); };
const toCompare = async () => { await pg.locator(".modetab", { hasText: "Compare" }).dispatchEvent("click"); await pg.waitForSelector(".cmp-grid [data-cmp-group]", { timeout: 20000 }); await pg.waitForTimeout(800); };
const toTab = async (t) => { await pg.locator(".modetab", { hasText: t }).dispatchEvent("click"); await pg.waitForTimeout(500); };
const sys = async () => ({
  wedi: (await pg.locator('[data-cmp-sys="wedi"]').innerText()).replace(/\s+/g, " "),
  sch: (await pg.locator('[data-cmp-sys="schluter"]').innerText()).replace(/\s+/g, " "),
});
const flatRow = (t) => t.replace(/\s+/g, " ");
const slots = async () => pg.locator(".cmp-grid [data-cmp-slot]").evaluateAll((els) => els.map((e) => e.getAttribute("data-cmp-slot")));

// --- wedi host, Membrane ---
await pg.goto("http://localhost:5199/wedi-preview.html");
await pg.waitForSelector("[data-wedi-pan]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(500);
await pg.locator("[data-wedi-wallsys-membrane]").first().click(); await pg.waitForTimeout(500);
await pg.locator("[data-wedi-pan='US9176001']").click(); await pg.waitForTimeout(800);
await toCompare();
let h = await sys(); console.log("wedi Membrane host:", h);
if (!/S-DRY membrane/.test(h.wedi) || !/KERDI membrane/.test(h.sch)) fail("wedi Membrane does not face KERDI membrane");
const wb = flatRow(await pg.locator('.cmp-grid [data-cmp-slot="wallBoard"] ~ *').first().innerText().catch(() => ""));
if (!/by others/.test(wb)) fail("the wedi column lacks the backer note row");
if (!(await slots()).includes("wallMembrane")) fail("no wall-membrane row");
await shot("cm1-wedi-membrane");

// --- wedi host, Building Panel ---
await toTab("Kits");
await pg.locator("[data-wedi-wallsys-board]").first().click(); await pg.waitForTimeout(500);
await pg.locator("[data-wedi-pan='US9100004']").click(); await pg.waitForTimeout(800);
await toCompare();
h = await sys(); console.log("wedi Building Panel host:", h);
if (!/Building Panel/.test(h.wedi) || !/KERDI-BOARD/.test(h.sch)) fail("wedi Building Panel does not face KERDI-BOARD");
if (!(await slots()).includes("wallBoard")) fail("no wall-board row");
await shot("cm2-wedi-board");

// --- Schluter host ---
await pg.goto("http://localhost:5199/schluter-preview.html");
await pg.waitForSelector("[data-schluter-tray]", { timeout: 20000 }); await pg.waitForTimeout(600);
await pg.locator("[data-source-toggle]").click(); await pg.waitForTimeout(600);
if ((await pg.locator("[data-schluter-kits-membrane]").innerText()).trim() !== "Membrane") fail("the Schluter segment does not read Membrane");
await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);
if (!/Membrane walls \(KERDI\)/.test(await pg.locator(".bc-h .sub, .sub").first().innerText())) fail("the Schluter subtitle does not read Membrane walls (KERDI)");
await toCompare();
h = await sys(); console.log("Schluter Membrane host:", h);
if (!/S-DRY membrane/.test(h.wedi)) fail("Schluter Membrane does not face wedi S-DRY");
await shot("cm3-schluter-membrane");
await toTab("Kits");
await pg.locator("[data-schluter-kits-board]").click(); await pg.waitForTimeout(600);
await pg.locator("[data-schluter-tray='KST965/1525']").first().click(); await pg.waitForTimeout(800);
await toCompare();
h = await sys(); console.log("Schluter KERDI-BOARD host:", h);
if (!/Building Panel/.test(h.wedi) || !/KERDI-BOARD/.test(h.sch)) fail("Schluter KERDI-BOARD does not face wedi Building Panel");
await shot("cm4-schluter-board");

// --- a linear Schluter room: S-DRY can't fit, wedi falls back to a wedi pan ---
await toTab("Kits");
await pg.locator("[data-schluter-kits-membrane]").click(); await pg.waitForTimeout(600);
const lin = pg.locator("[data-schluter-tray^='KSLT']");
if (await lin.count()) {
  await lin.first().click(); await pg.waitForTimeout(800);
  await toCompare();
  h = await sys(); console.log("Schluter linear host:", h);
  if (!/S-DRY membrane on a wedi pan/.test(h.wedi)) fail("the linear room's wedi column does not say S-DRY on a wedi pan");
  await shot("cm5-linear-fallback");
} else fail("no linear tray in the preview book");

await b.close();
if (err) { console.error("checks FAILED"); process.exit(1); }
console.log("all checks passed");
```

- [ ] **Step 3: Run both** (vite on 5199).

Run: `node .scratch/158_shower-config-roadmap/p2/shoot-wedi.mjs && node .scratch/158_shower-config-roadmap/p2/shoot-compare.mjs`
Expected: each prints its shots, then "all checks passed". The prototype
logged:
- Membrane cards: `US9176001, US9176002, US9176003, US9176004`
- 48×90 → "S-DRY 48×72 + extension / S-DRY 72×72 + 2 extensions (seamed)"
- 100×120 → the prompt ("…larger than an S-DRY base with extensions covers.")
- The linear Schluter host → wedi "S-DRY membrane on a wedi pan".

- [ ] **Step 4: Look at every shot** (Read each PNG). Check what the scripts
  can't:
  - the Walls group holds the S-DRY roll, not panel sheets;
  - the prompt's buttons wrap cleanly;
  - the chip sits under the subtitle;
  - the print sheet has the wall-system line and the backer note;
  - Compare's two headers name the systems.

- [ ] **Step 5: Re-run the 1a–1d scripts.** They must still pass (the
  prototype ran all ten clean):

```bash
for f in .scratch/158_shower-config-roadmap/p1*/*.mjs; do echo "== $f"; node "$f" 2>&1 | grep -E "FAIL|PAGEERROR|passed"; done
```

Expected: no FAIL or PAGEERROR lines. p1c/p1d print "— all checks passed".
p1a/p1b print nothing matching on success (they exit 1 on a failure).

- [ ] **Step 6: Restore the 1a–1d shots.** The re-runs overwrite their
  committed PNGs, and nothing about them changed, so restore them:
  `git checkout -- '.scratch/158_shower-config-roadmap/p1*/*.png'`.

- [ ] **Step 7: Commit the p2 proof.**

```bash
git add .scratch/158_shower-config-roadmap/p2/
git commit -m "Phase 2 proof: S-DRY kits, options, prompt, print; Compare on both wall systems"
```

---

### Task 8: Records and full verification

Model: Sonnet for the writing; the controller reviews the ADR text.

**Files:**
- Create: `docs/adr/0051-wedi-membrane-is-s-dry.md`
- Modify: `docs/adr/README.md` (index row)
- Modify: `docs/adr/0034-cross-vendor-compare.md` (close the "KERDI-BOARD
  toggle" open item)
- Modify: `docs/adr/0049-configurator-swaps-remember-the-choice.md` (Phase 2
  amendment)
- Modify: `.claude/skills/floortrack-data-model/SKILL.md` (the wedi marker's
  `wallSys` / `sdryBase`)
- Modify: `src/CLAUDE.md` (new `sdry.js` and `wallsysgolden.js` entries;
  Phase 2 lines on `wedi.js`, `WediConfigurator.jsx`, `comparekit.js`,
  `CompareTab.jsx`, `SchluterConfigurator.jsx`)
- Modify: `docs/superpowers/specs/2026-09-28-board-vs-membrane-design.md`
  (Amendments)
- Modify: `.scratch/158_shower-config-roadmap/ticket.md` (Phase 2 done)
- Create: `.scratch/handoffs/shower-config-phase3-<date>.md`

- [ ] **Step 1: Write ADR 0051** (`docs/adr/0051-wedi-membrane-is-s-dry.md`):

```markdown
# ADR 0051 — wedi's "Membrane" wall system is S-DRY

- **Status:** Accepted
- **Date:** <today>
- **Scope:** the wedi and Schluter shower configurators and Compare
  (`src/sdry.js`, `src/wedi.js`, `src/comparekit.js`, `WediConfigurator.jsx`,
  `SchluterConfigurator.jsx`, `CompareTab.jsx`).
- **Related:**
  - spec `docs/superpowers/specs/2026-09-28-board-vs-membrane-design.md`;
  - plan `docs/superpowers/plans/2026-09-28-board-vs-membrane.md`;
  - ticket 158 Phase 2 (`.scratch/158_shower-config-roadmap/ticket.md`);
  - ADR 0049 (choices, not parts — amended for Phase 2);
  - ADR 0034 (Compare — its KERDI-BOARD open item closes here).

## Context

Schluter has a wall-system fork: KERDI membrane over a backer, or
KERDI-BOARD. wedi had only Building Panel. So Compare set a structural wedi
panel against a membrane that still needs cement board by others, and the
difference lived in a caveat sentence.

wedi does sell a membrane system, S-DRY, and every part is in the book:
- four bases, and a 24×48 extension;
- full and lean 72″ curbs;
- a bonding-flange drain and eight covers;
- 104 and 106 sf rolls, 5″ × 32′ tape, corners and collars;
- S-DRY SEAL.

The owner chose S-DRY over Subliner Dry as wedi's Membrane. The goal is the
whole system: an S-DRY base when one fits, and the owner's pick when none
does.

## Decision

1. **Both brands carry the same fork.**
   - Schluter's segment reads **Membrane | KERDI-BOARD**.
   - wedi's reads **Building Panel | Membrane (S-DRY)**.
2. **Two choices, not parts (ADR 0049).**
   - `cfg.wallSys: "membrane"`; absent means Building Panel.
   - `cfg.sdryBase: "wedi"`, meaning S-DRY walls on a wedi pan; absent means
     S-DRY.
   - `kitFor` resolves both on every build, and an unknown value reads as
     the default. Every marker saved before this bills exactly as it did
     (`src/wallsysgolden.test.js`).
3. **The S-DRY fit (`sdryFit`), in rank order:**
   - one base, cut evenly;
   - a base + one 24×48 extension along an edge ≤ 48″;
   - a base + two extensions side by side along the 72″ edge, seamed with
     tape.

   Ties within a tier: least cut-away, then stock, then price. A linear
   drain, an oversize room and a book with no bases each carry a stated
   reason.
4. **The Membrane bill comes from wedi's published rates.**
   - Membrane: wall sf + 10% for laps, on the cheaper roll.
   - Tape: corners + wall bases + the curb + extension seams, in 32′ rolls.
   - Inside corners: 2 per bag.
   - Outside corners: 1 bag when curbed.
   - Collars: 1 valve and 1 pipe collar.
   - SEAL: ⌈tape lf ÷ 45⌉ + 1 trowel.
   - PRO-SET: 1 + ⌈membrane sf ÷ 100⌉ at the 1/8″ notch. This matches
     wedi's TDS: a 36×60 alcove takes 2 bags, a 48×72 takes 3.
   - An S-DRY base also bills the S-DRY curb (⌈open ÷ 72⌉), the
     bonding-flange drain and an S-DRY cover.
   - The backer (cement board or drywall, by others) is a build hint, a
     print note and a Compare note row — never a priced line.
5. **No fit → the owner picks.** The Custom tab shows the reason and three
   buttons:
   - a wedi pan + curb with S-DRY walls;
   - the nearest S-DRY base anyway, with a warning naming the shortfall;
   - back to Building Panel.

   A non-fit answer wears a bill chip that reopens the choice.
6. **Compare follows the host's wall system.**
   - Membrane faces Membrane, and board faces board.
   - The wedi side falls back to a wedi pan with S-DRY walls, without a
     prompt, and its header says so.

## Consequences

- **Old kits.** No saved kit's bill moves. One display move: the curbless
  Fundo kit's S-DRY Seal line draws under Setting (was Seams), with the same
  bill.
- **Rates.** They are wedi's, and they live in `src/sdry.js`. Change them
  only against a new wedi source, and cite it.
- **Benches under Membrane** stay panel-based; their fasteners and sealant
  are figured on the bench surfaces only.
- **Compare on the Schluter host.** It now shows wedi as S-DRY, since the
  popup opens on Membrane (it showed Building Panel before). ADR 0034's
  "KERDI-BOARD toggle" open item is closed.
- **Out of scope:**
  - extensions stacked two deep, and on the curbless entry side;
  - the drain height kit;
  - a four-way compare (Phase 3).
```

- [ ] **Step 2: Index it.** Append to the table in `docs/adr/README.md`:

```markdown
| [0051](0051-wedi-membrane-is-s-dry.md) | wedi's "Membrane" wall system is S-DRY (base, curb, drain, membrane walls) billed from wedi's published rates; `cfg.wallSys`/`cfg.sdryBase` are choices, absent = Building Panel; no fit → the owner picks wedi pan + S-DRY walls, nearest S-DRY base, or Building Panel; Compare builds the other brand on the host's wall system | Accepted | <today> |
```

- [ ] **Step 3: Close ADR 0034's open item.** Under "Open — owner calls this
  phase surfaced, not decided", replace the first bullet ("No like-for-like
  KERDI-BOARD toggle on the compare surface…") with:

```markdown
- ~~No like-for-like KERDI-BOARD toggle on the compare surface.~~ **Closed by
  ADR 0051 (ticket 158 Phase 2, 2026-09-28):** the other column follows the
  host's wall system — wedi Building Panel faces KERDI-BOARD, wedi S-DRY
  faces KERDI membrane, and the Schluter host the other way round. Column
  headers name each side's system; the help tip's walls caveat is gone. A
  four-way grid (any system vs any) is Phase 3.
```

- [ ] **Step 4: Amend ADR 0049.** Append a section:

```markdown
## Amendment — Phase 2 (2026-09-28): the wall system is a choice too

The wedi marker gains two ADR-0049 choices (ADR 0051): `cfg.wallSys`
(`"membrane"`, absent = Building Panel) and `cfg.sdryBase` (`"wedi"`, absent =
S-DRY). `kitFor` resolves them to parts on every build; an unknown value reads
as the default, so every old marker bills as before (`src/wallsysgolden.test.js`
pins it beside the 1b/1c goldens). S-DRY parts take their slot from
`sdrySlot` (src/sdry.js) through `wediSlotOf` — tray, curb, drainBody, grate,
wallMembrane, seam, corners, setting — which moves one existing line's
DISPLAY only: the curbless Fundo kit's "S-DRY Seal — field seal" now draws
under Setting (it was Seams). Its bill is unchanged. The S-DRY cover and curb
⇄ store the usual `coverPick: { key }` / `curbPick: { sub: "lean" } | { none: true }`.
```

- [ ] **Step 5: The data-model skill.** In
  `.claude/skills/floortrack-data-model/SKILL.md`, after the wedi marker's
  `source` paragraph ("…Both popups open Stock only by default."), add:

```
           // Its cfg also carries `wallSys` ("membrane" — absent is Building
           // Panel) and `sdryBase` ("wedi" — absent is S-DRY), ticket 158
           // Phase 2 / ADR 0051: choices, not parts. Membrane bills S-DRY
           // membrane walls; on an S-DRY base it also bills the S-DRY curb,
           // drain and cover. `cfg.solve.input` may carry `system: "sdry"`
           // and `nearest: true`, so buildFromMarker re-solves the same
           // S-DRY option. Old markers carry neither and bill as before.
```

- [ ] **Step 6: `src/CLAUDE.md`.** Add two entries, the first after
  `wediquery.js` and the second after `addedgolden.js`:

```
  sdry.js           # wedi's S-DRY system, the wedi "Membrane" wall choice
                    # (ticket 158 Phase 2, ADR 0051) — PURE: the caller
                    # passes its catalog, so it never imports wedi.js and
                    # wedi.js imports it freely. `sdryFit` (base cut evenly →
                    # + one 24×48 extension along an edge ≤48″ → + two side by
                    # side, seamed; least cut, stock, price; `{ options,
                    # reason }` — the no-fit reason the popup's prompt shows),
                    # `sdryNearest` (the "nearest S-DRY base anyway" answer,
                    # shortfall warned), `sdryCurb` (full default, lean on
                    # pick, ⌈open ÷ 72⌉), `sdryWalls` (membrane +10% laps on
                    # the cheaper roll, tape lf in 32′ rolls, corners, collars,
                    # SEAL ⌈lf ÷ 45⌉ + trowel), `sdryProSet` (1 + ⌈membrane
                    # sf ÷ 100⌉ — wedi's TDS: 36×60 → 2, 48×72 → 3),
                    # `sdryRole`/`sdrySlot` (role and slot off the SKU).
                    # Rates are wedi's published ones — see the Phase 2 spec's
                    # Sourced rates before changing any (sdry.test.js)
  wallsysgolden.js  # the golden bill of every Building Panel wedi build and
                    # both Schluter wall systems, captured BEFORE Phase 2
                    # added S-DRY (ticket 158): every kit card, a spread of
                    # room solves built and reopened, Schluter point/linear
                    # on membrane and board, Compare's default house kits.
                    # Never hand-edited — GENERATED by
                    # `.scratch/158_shower-config-roadmap/tools/gen-wallsys-golden.mjs`
                    # (wallsysgolden.test.js)
```

  Then append one paragraph to each of these entries, at the end of the
  entry, in the entry's own comment style:
  - **wedi.js:** "Ticket 158 Phase 2 (ADR 0051): `kitFor` takes
    `opts.wallSys` ("membrane") and `opts.sdryBase` ("wedi"). Under Membrane,
    sdry.js `sdryWalls` replaces the panel, the wall fasteners and sealant,
    the wedi collars and the putty knife. PRO-SET becomes `sdryProSet`, and
    the build hints `"backer"`. An S-DRY base under Membrane also bills the
    S-DRY curb, drain and cover (the recipe is gated on Membrane — an S-DRY
    pan without it is an old marker shape the 1b golden pins). `solve` takes
    `input.system: "sdry"` (+ `nearest`), `sdryNoFit(input)` names why nothing
    fits, and `markerCurbKey` knows the S-DRY curb (tile sf). S-DRY parts
    slot through `sdrySlot`, and `WEDI_ADD_PARTS` gains them
    (wedisdry.test.js, wallsysgolden.test.js)."
  - **WediConfigurator.jsx:** "Ticket 158 Phase 2 (ADR 0051): the
    Building Panel | Membrane (S-DRY) segment sits on the Kits tab (Membrane
    lists the four S-DRY bases, each priced as a full S-DRY build) and in a
    Custom-tab Wall system group. State is `wallSys`/`sdryBase`/`sdryNear`
    (seeded from the marker). A change re-solves through one effect keyed on
    all three, so the solve reads the new state. Under S-DRY, the drain pin
    and Pan against are disabled (the base is cut evenly). No S-DRY fit shows
    an inline prompt (`data-wedi-sdryask`): wedi pan + S-DRY walls, nearest
    S-DRY base, or Back to Building Panel. A non-fit answer wears a bill chip
    (`data-wedi-sdrychip`) that reopens it. The subtitle and the print head
    name the wall system; the backer hint shows on the bill and prints under
    the install notes. The S-DRY cover and curb ⇄ are one-click lists.
    `applyPanelFit` skips a build with no kit panel line."
  - **comparekit.js:** "Phase 2 (ADR 0051): `wediBuildFor(room, { wallSys,
    sdryBase })` tries the S-DRY fit under Membrane, else a wedi pan with
    S-DRY walls (`cfg.sdryBase: "wedi"`, no prompt).
    `schluterBuildFor(room, cat, { wallSys })` bills KERDI-BOARD with the
    popup's default Fit plan. `wediCompareRows` adds the $0 backer note row
    when the build hints it."
  - **CompareTab.jsx:** "Phase 2 (ADR 0051): the other column follows the
    host's wall system (`hostCfg.wallSys`). The column headers
    (`data-cmp-sys`) name each side's system; the help tip's walls caveat is
    gone."
  - **SchluterConfigurator.jsx:** "Phase 2: the wall-system segment reads
    "Membrane | KERDI-BOARD" (was "KERDI over backer") and the bill subtitle
    "Membrane walls (KERDI)"; the saved `cfg.wallSys` values are unchanged."

- [ ] **Step 7: Spec amendments.** In
  `docs/superpowers/specs/2026-09-28-board-vs-membrane-design.md`, replace
  "(none yet)" under "Amendments during planning and build" with the numbered
  rulings 1–18 from this plan's "Rulings made while prototyping". Copy each
  one's bold lead and its one or two sentences, and add any amendment the
  build itself makes (review findings the controller accepts).

- [ ] **Step 8: The ticket and the Phase 3 handoff.** In
  `.scratch/158_shower-config-roadmap/ticket.md`:
  - mark Phase 2 done, with the spec / plan / ADR 0051 / proof
    (`.scratch/158_shower-config-roadmap/p2/`) / PR lines in the 1d block's
    shape;
  - point "Next" at the new handoff.

  Write `.scratch/handoffs/shower-config-phase3-<date>.md` in the Phase 2
  handoff's shape (`.scratch/handoffs/shower-config-phase2-2026-09-27.md`):
  - where things stand (Phases 0–2 merged);
  - records to read (ADR 0049 + amendments, 0034, 0051; the specs);
  - Phase 3's ask from the ticket (the four-way compare: the same room
    through wedi Board, wedi Membrane, Schluter Board, Schluter Membrane,
    with the owner's checkboxes idea);
  - the carry list, plus these Phase 2 deferrals:
    - the pricelist's bare "S-DRY™ XL"-style names in the bill;
    - S-DRY curb height/width in the drawings;
    - extensions stacked two deep and on the curbless entry (spec: out of
      scope);
    - the drain height kit.

- [ ] **Step 9: Full verification.**

```bash
npm test
npx eslint src netlify/functions
VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build
node .scratch/158_shower-config-roadmap/p2/shoot-wedi.mjs
node .scratch/158_shower-config-roadmap/p2/shoot-compare.mjs
git checkout -- '.scratch/158_shower-config-roadmap/p1*/*.png'
```

Expected:
- `# fail 0`;
- lint clean;
- the build succeeds;
- both scripts print "all checks passed";
- `git status` shows only the Task 8 files.

- [ ] **Step 10: Commit.**

```bash
git add docs/adr/0051-wedi-membrane-is-s-dry.md docs/adr/README.md docs/adr/0034-cross-vendor-compare.md \
  docs/adr/0049-configurator-swaps-remember-the-choice.md .claude/skills/floortrack-data-model/SKILL.md src/CLAUDE.md \
  docs/superpowers/specs/2026-09-28-board-vs-membrane-design.md .scratch/158_shower-config-roadmap/ticket.md \
  .scratch/handoffs/shower-config-phase3-*.md
git commit -m "Phase 2 records: ADR 0051, ADR 0034/0049 amendments, data model, file map, spec amendments, Phase 3 handoff"
```

---

## After the tasks

Run the final whole-branch review (subagent-driven-development's last step,
Opus), fix what it finds, then open the PR:
- base `main`, head `claude/shower-config-phase-1d-eafhd0`;
- body in the 1d PR's shape (What it does / Old saved kits / Needs your call
  / Verification / Preview proof with before and after images at the head
  commit's raw URLs);
- then subscribe to its activity.

**Do not merge without the owner's say-so.** The before and after shots are
the UI proof (Non-negotiable 3).
