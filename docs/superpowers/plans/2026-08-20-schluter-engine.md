# Schluter Engine Implementation Plan (Phase 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** `src/schluter.js` — the Schluter shower-system knowledge layer and
solver (classifier, tray solver, kit recipes, pricing lens) — plus the
boot-side search recognizer `src/schluterquery.js`, fully covered by
`node --test`, with totals pinned to the approved prototype's numbers.

**Architecture:** The engine is the mirror-opposite of `wedi.js` on data:
it embeds NO catalog. It classifies registry-book items by Schluter's SKU
grammar (`classify`), and every solver/pricing function takes the classified
catalog as an argument (owner decision 7: registry-driven — a sheet upload
in the Price book library repricing the configurator with no code change).
The reference implementation is the approved prototype
`.scratch/097_schluter-configurator/prototype.html` (the inline `<script>`:
`SLT_SECTIONS`, `trayCandidates`, `pickRolls`, `buildSchluter`, `priceOf`);
this plan ports it to tested module code, same math, same recipes.

**Tech Stack:** Plain ES modules, `node --test` (the wedi.test.js pattern:
dependency-free, imports name the `.js` extension). No React in this phase.

## Global Constraints

- Branch: `claude/schluter-engine-<suffix>` off latest `main`; its own PR;
  never push to `main`. No UI in this phase; no Supabase access anywhere.
- `src/schluterquery.js` must NEVER import `schluter.js` (ADR 0026 boot
  contract — the wediquery precedent); `schluter.js` re-exports its four
  functions.
- Owner decisions 2–8 (roadmap doc) are binding; the factory recipes come
  from `.scratch/097_schluter-configurator/pricelist-notes.md` and are cited
  in code comments only where the rule would look wrong without the source
  (e.g. "2× 38\" curbs — the factory 38×60 kit recipe, price list p.195").
- Every commit: `node --test src/schluter.test.js src/schluterquery.test.js src/model.test.js` green.

---

### Task 1: Test fixture — the real catalog snapshot

**Files:**
- Create: `src/schluterfixture.js`
- Test: `src/schluter.test.js` (started here, grown by every later task)

**Interfaces:**
- Produces: `export const FIXTURE_ITEMS` — an array of stock-book-shaped
  rows `{ sku, erp, name, price, cost, unit, stock, free, lead, … }`, the
  55 real rows + 5 factory kits from the prototype.

- [ ] **Step 1: Extract the fixture.** Copy the `const SLT = [ … ]` array
  and the `SLT_KITS` array VERBATIM from
  `.scratch/097_schluter-configurator/prototype.html` (search for
  `const SLT = [`) into `src/schluterfixture.js` as
  `export const FIXTURE_ITEMS = [ … ]` and
  `export const FIXTURE_KITS = [ … ]`, with a header comment: "test
  fixture — the 2026-08-20 stock-sheet/EFT snapshot the prototype was
  approved on; production reads the live registry books, never this file."
  Strip the prototype-only fields `g`, `w`, `d`, `drain`, `part`, `sf`,
  `lf`, `len`, `sfPerBag`, `ramp`, `thick2` from FIXTURE_ITEMS — deriving
  those is `classify`'s job and the tests must prove it derives them.
  Then append the five FIXTURE_KITS rows into FIXTURE_ITEMS as plain
  book rows (`{ sku, name: desc, cost, price, unit: "EA", stock: false,
  lead: "READY SHIP" }`) — in production the kits arrive as ordinary EFT
  rows, and Tasks 2 and 5 classify them out of the same list.

- [ ] **Step 2: Write the smoke test and watch it fail.**

  ```js
  // src/schluter.test.js
  import test from "node:test";
  import assert from "node:assert/strict";
  import { FIXTURE_ITEMS } from "./schluterfixture.js";
  import { classify } from "./schluter.js";

  test("fixture loads", () => assert.equal(FIXTURE_ITEMS.length >= 55, true));
  test("classify exists", () => assert.equal(typeof classify, "function"));
  ```

  Run: `node --test src/schluter.test.js`
  Expected: FAIL — `Cannot find module './schluter.js'`.

- [ ] **Step 3: Create `src/schluter.js`** with the module header (mirrors
  wedi.js's: heavy-module warning is NOT needed — say instead that the
  module is table-free and registry-fed) and `export function classify(item) { return null; }`.

  Run: `node --test src/schluter.test.js` → both tests PASS.

- [ ] **Step 4: Commit.**

```bash
git add src/schluterfixture.js src/schluter.js src/schluter.test.js
git commit -m "Schluter engine scaffold + real-catalog test fixture"
```

---

### Task 2: `classify` — the SKU grammar

**Files:**
- Modify: `src/schluter.js`
- Test: `src/schluter.test.js`

**Interfaces:**
- Produces: `classify(item) -> entry | null` where `entry` is the item
  spread plus `{ g, w?, d?, drain?, part?, sf?, lf?, len?, sfPerBag?,
  ramp?, thin? }` with `g` one of
  `"tray"|"drain"|"membrane"|"seam"|"board"|"curb"|"extra"|"set"|"kit"`.
  Non-shower Schluter items (profiles, Ditra, shelves…) return `null` —
  the configurator ignores them; they stay ordinary book items.
- Consumes: stock-book/EFT row shape (Task 1 fixture is the contract).

- [ ] **Step 1: Write the failing tests — real SKUs, derived facts.**

  ```js
  const by = (sku) => classify(FIXTURE_ITEMS.find((i) => i.sku === sku));

  test("tray mm-pair grammar", () => {
    assert.deepEqual(
      (({ g, w, d, drain }) => ({ g, w, d, drain }))(by("KST965/1525")),
      { g: "tray", w: 60, d: 38, drain: "point" });
    assert.equal(by("KST965/1525S").drain, "offset");
    assert.equal(by("KST965BF").thin, true);            // TT = curbless play
    assert.deepEqual(
      (({ g, w, d, drain }) => ({ g, w, d, drain }))(by("KSLT965/1930S")),
      { g: "tray", w: 76, d: 38, drain: "linear" });
  });
  test("drains", () => {
    assert.deepEqual((({ g, drain, part }) => ({ g, drain, part }))(by("KD2FLKPVC")),
      { g: "drain", drain: "point", part: "flange" });
    assert.deepEqual((({ part, len }) => ({ part, len }))(by("KLVRID3EB122")),
      { part: "channel", len: 48 });
  });
  test("membrane/band/board/curb/set", () => {
    assert.equal(by("KERDI200/10M").sf, 108);
    assert.equal(by("KEBA100/125/10M").lf, 33);
    assert.equal(by("KB1212202440").sf, 32);
    assert.equal(by("KBSC1151501524").len, 60);
    assert.equal(by("SLRSETA50W").g, "set");
    assert.equal(by("SLRKSR3051220").ramp, true);
    assert.equal(by("SLRKSK9651525PVC").g, "kit");
  });
  test("non-shower items are null", () => {
    assert.equal(classify({ sku: "SLRA100ATGB", name: '3/8" Schluter Jolly' }), null);
  });
  ```

  Run: `node --test src/schluter.test.js` → new tests FAIL.

- [ ] **Step 2: Implement.** The mm→inch pair table is the load-bearing
  piece — Schluter encodes metric dims in every tray/curb/board SKU:

  ```js
  const MM_IN = { 810: 32, 915: 36, 965: 38, 1000: 39, 1220: 48,
    1395: 55, 1525: 60, 1830: 72, 1930: 76 };
  ```

  Grammar (match on `sku` with the `SLR` prefix stripped and `/`
  normalized away, falling back to `name` where the sheet's mfg code is
  bare): `KST<a>[/<b>][S][BF]` → tray point/offset, `BF` sets
  `thin: true`; `KSLT…S` → tray linear; `KD…FLK…` flange / `KD4GRK…`
  grate / `KLVRID<design><fin><122|244>` channel (len 48/96) /
  `KLVR2FLK` linear flange; `KERDI200…` rolls (sf from the name's
  "= N sf" or the roll table 5M=54 7M=75 10M=108 12M=128 20M=215
  plain=323); `KEBA…/<5|10>M` band (lf 16/33, no suffix = 98);
  `KERECK|KMS|KMSMV` seam; `KB12…`/`KB50…` board (sf from dims,
  `thick2` on 2"); `KBSC…<mm>` curb (len via MM_IN); `KSR` ramp;
  `KB12SN`/`KBSB`/`KERSB` extra; `SETA` set (`sfPerBag: 55`);
  `KSK…` kit. Everything else → `null`.

- [ ] **Step 3:** `node --test src/schluter.test.js` → PASS.
- [ ] **Step 4: Commit** — `git commit -m "classify: the Schluter SKU grammar"`.

---

### Task 3: Solver — `catalogOf`, `trayCandidates`, `pickRolls`

**Files:**
- Modify: `src/schluter.js`
- Test: `src/schluter.test.js`

**Interfaces:**
- Produces:
  `catalogOf(items) -> entry[]` (classify + drop nulls),
  `trayCandidates(cfg, cat, { source }) -> [{ tray?, cut, deep, kind }]`
  (kind `"exact"|"cut"|"mortar"`, max 4, ranked drain-match → cut → price;
  curbless prefers `thin` trays — decision 6),
  `pickRolls(sfNeed, cat, { source }) -> [{ item, qty }]` (largest-roll
  greedy + smallest top-up).
- Consumes: `classify` (Task 2). `cfg` shape (used by every later task):
  `{ w, d, curbed, drain: "point"|"offset"|"linear", wallSys:
  "membrane"|"board", walls: [{ on, len, h }], bench?, mortarItem? }`.

- [ ] **Step 1: Failing tests** — port the prototype's behavior as pinned
  cases (the numbers are the approved ones):

  ```js
  import { catalogOf, trayCandidates, pickRolls } from "./schluter.js";
  const CAT = catalogOf(FIXTURE_ITEMS);
  const cfg = (o) => ({ w: 60, d: 38, curbed: true, drain: "point", wallSys: "membrane",
    walls: [{ on: true, len: 60, h: 84 }, { on: true, len: 38, h: 84 }, { on: true, len: 38, h: 84 }], ...o });

  test("60x38 point: exact tray first", () => {
    const c = trayCandidates(cfg({}), CAT, { source: "all" });
    assert.equal(c[0].kind, "exact");
    assert.equal(c[0].tray.sku, "KST965/1525");
  });
  test("48x48 linear stock-only re-ranks to the 55x55 deep cut", () => {
    const c = trayCandidates(cfg({ w: 48, d: 48, drain: "linear" }), CAT, { source: "stock" });
    assert.equal(c[0].tray.sku, "KSLT1395S");
    assert.equal(c[0].deep, true);
  });
  test("no tray fits -> mortar card", () => {
    const c = trayCandidates(cfg({ w: 30, d: 90 }), CAT, { source: "all" });
    assert.equal(c[0].kind, "mortar");
  });
  test("curbless prefers thin trays", () => {
    const c = trayCandidates(cfg({ w: 38, d: 38, curbed: false }), CAT, { source: "all" });
    assert.equal(c[0].tray.thin, true);
  });
  test("roll ladder: 79 sf of wall -> one 108 sf roll", () => {
    const p = pickRolls(79 * 1.1, CAT, { source: "all" });
    assert.deepEqual(p.map((x) => [x.item.sku, x.qty]), [["KERDI200/10M", 1]]);
  });
  ```

- [ ] **Step 2: Implement** by porting the prototype functions (same fit
  window: `w,d` covered and total cut ≤ 26; deep past 6"/side; sort
  drain-match → cut → price, plus the curbless `thin`-first term the
  prototype lacks — decision 6 makes it explicit here).
- [ ] **Step 3:** tests PASS. **Step 4: Commit** —
  `git commit -m "Schluter tray solver + membrane roll ladder"`.

---

### Task 4: `buildKit` — the recipes

**Files:**
- Modify: `src/schluter.js`
- Test: `src/schluter.test.js`

**Interfaces:**
- Produces: `buildKit(cfg, cat, { source, pick }) -> { lines, cand }`,
  `lines: [{ g, item, qty, note, so, noteOnly? }]` with groups
  `Base|Drain|Walls|Seams|Curb|Setting|Extras`, and
  `linesTotal(lines, priceFn) -> number`.
- Consumes: Task 3's solver + `cfg` shape. Recipes (pricelist-notes.md,
  all already proven in the prototype): factory corner counts (2× inside
  packs + 1× outside pack, point builds only), Vario flange kit
  self-contained (linear builds carry NO separate corner/seal lines),
  channel cut note min 10", curb multiples cut end-to-end with their own
  2+2 corners noted, membrane +10% laps + backer-by-others note line,
  board 1.05× + 100 ct fasteners per 60 sf, ALL-SET at
  `ceil((wallSf+floorSf)/sfPerBag)`, KERDI-FIX ×1, ramp when curbless,
  bench options per decision 4 (`cfg.bench: "framed"|"buildup"` → ½" wrap
  board / 2× 2" board), mortar fallback per decision 2
  (`cfg.mortarItem` line at its own rate — fixture uses
  `{ name: "60 lb deck mud", sfPerBagAt15: 8 }` — plus KERDI over the bed).

- [ ] **Step 1: Failing truth-table tests** (retail = the stocked row's
  `price`; special order = `cost × 1.5`):

  ```js
  import { buildKit, linesTotal } from "./schluter.js";
  const retail = (it) => it.stock ? it.price : it.cost * 1.5;

  test("60x38 curbed point membrane — the approved bill", () => {
    const b = buildKit(cfg({}), CAT, { source: "all" });
    assert.equal(b.lines.filter((l) => !l.noteOnly).length, 12);
    assert.equal(Math.round(linesTotal(b.lines, retail) * 100), 75975); // $759.75
    assert.equal(b.lines.filter((l) => l.so).length, 0);
  });
  test("linear build: Vario kit carries the seals", () => {
    const b = buildKit(cfg({ w: 48, d: 48, drain: "linear" }), CAT, { source: "all" });
    assert.equal(b.lines.some((l) => /KERECK|SEAL/.test(l.item.name)), false);
    assert.equal(b.lines.some((l) => l.item.part === "flange" && l.item.drain === "linear"), true);
  });
  test("mortar fallback carries the picked mortar", () => {
    const mortarItem = { name: "60 lb deck mud", price: 9.6, cost: 6.4, stock: true, sfPerBagAt15: 8 };
    const b = buildKit(cfg({ w: 30, d: 90, mortarItem }), CAT, { source: "all" });
    const m = b.lines.find((l) => l.item === mortarItem);
    assert.equal(m.qty, Math.ceil((30 * 90 / 144) / 8));
    assert.equal(b.lines.some((l) => l.g === "Base" && l.item.sf), true); // KERDI over the bed
  });
  test("bench build-up lands 2x 2-inch board", () => {
    const b = buildKit(cfg({ bench: "buildup" }), CAT, { source: "all" });
    const x = b.lines.find((l) => l.g === "Extras");
    assert.equal(x.item.thick2, true); assert.equal(x.qty, 2);
  });
  ```

- [ ] **Step 2: Implement** (port `buildSchluter` from the prototype,
  parameterizing price via the `priceFn` argument instead of the
  prototype's inline tiers). **Step 3:** PASS. **Step 4: Commit** —
  `git commit -m "buildKit: the Schluter shelf-kit recipes"`.

---

### Task 5: Pricing lens + `product.schluter` marker

**Files:**
- Modify: `src/schluter.js`, `src/model.js` (normP pass-through),
  `src/catalog.js` (settings knob)
- Test: `src/schluter.test.js`, `src/model.test.js`

**Interfaces:**
- Produces: `tierPrice(entry, tier, { builderPct }) -> number` (retail =
  stocked `price` else `cost × 1.5`; builder = retail × (1 − builderPct);
  cost = `cost`), settings knob `pricing.schluterBuilderPct` default `8`
  (normPricing, beside `wediBuilderPct`), and
  `lineItems(build, cfg) -> productRow[]` where the anchor row carries
  `schluter: { mode, cfg }` and companions `schluter: { part: true }` —
  the exact shape `product.wedi` uses.
- **GATE: load the `floortrack-data-model` skill before this task's
  model.js edit** and mirror the `wedi` pass-through in `normP`
  line-for-line.

- [ ] **Step 1: Failing tests**, including the normP round-trip:

  ```js
  // model.test.js addition
  test("normP passes the schluter marker through", () => {
    const p = normP({ name: "x", schluter: { mode: "custom", cfg: { w: 60 } } });
    assert.deepEqual(p.schluter, { mode: "custom", cfg: { w: 60 } });
  });
  // schluter.test.js
  test("tier lens", () => {
    const tray = CAT.find((e) => e.sku === "KST965/1525");
    assert.equal(tierPrice(tray, "retail", {}), 121.91);
    assert.equal(tierPrice(tray, "cost", {}), 81.27);
    const kit = CAT.find((e) => e.g === "kit");
    assert.equal(tierPrice(kit, "retail", {}), +(kit.cost * 1.5).toFixed(2));
  });
  ```

- [ ] **Step 2: Implement**; `node --test src/schluter.test.js src/model.test.js src/catalog.test.js` PASS.
- [ ] **Step 3: Commit** — `git commit -m "Schluter tier lens, settings knob, and the schluter product marker"`.

---

### Task 6: `schluterquery.js` — the boot-side recognizer

**Files:**
- Create: `src/schluterquery.js`
- Test: `src/schluterquery.test.js`
- Modify: `src/schluter.js` (re-export the four functions — the wediquery
  contract, stated in both file headers)

**Interfaces:**
- Produces: `queryHit(q)`, `parseQuery(q)`, `querySummary(parsed)`,
  `seedFromQuery(parsed)` — same contract as `wediquery.js` (read that
  file first; copy its structure, swap the vocabulary).

- [ ] **Step 1: Failing tests:**

  ```js
  import test from "node:test";
  import assert from "node:assert/strict";
  import { queryHit, parseQuery } from "./schluterquery.js";

  test("trade words hit", () => {
    for (const q of ["sch", "schluter", "kerdi", "kerdi-board", "kerdi board 48x48", "vario"])
      assert.equal(queryHit(q), true, q);
  });
  test("non-hits stay quiet", () => {
    for (const q of ["wedi", "mannington", "grout", "12x24 tile"])
      assert.equal(queryHit(q), false, q);
  });
  test("size parse seeds the room", () => {
    assert.deepEqual(parseQuery("kerdi shower 48x60").size, { w: 48, d: 60 });
  });
  ```

- [ ] **Step 2: Implement** (word list: schluter/sch…, kerdi, kerdi-board,
  ditra is NOT a hit — floor product, kerdi-line, vario, kst, kslt, tray,
  shower kit; reuse wediquery's size regex verbatim). Confirm the
  no-import rule: `grep -n "schluter.js" src/schluterquery.js` → no output.
- [ ] **Step 3:** PASS. **Step 4:** update `src/CLAUDE.md` (schluter.js,
  schluterfixture.js, schluterquery.js entries), write the
  **registry-driven-pricing ADR** (docs/adr/, next free number, indexed).
- [ ] **Step 5: Commit, push, open the PR.**

```bash
git add -A && git commit -m "schluterquery recognizer + docs + registry-pricing ADR"
git push -u origin claude/schluter-engine-<suffix>
```

## Self-review notes

- Decisions 2 (mortar), 4 (benches), 6 (thin-tray curbless), 7 (registry
  catalog-as-argument), 8 (geometry is phase 3's concern — no curb-inset
  math here, deliberately) each map to a named task/test above; decision 5
  is UI (phase 3) but `classify` tagging `g:"kit"` is its data half.
- Pinned dollar totals come from the approved prototype run
  (60×38 → $759.75, 12 lines, 0 SO). If a port produces a different
  number, the port is wrong — diff against the prototype's functions
  before touching the expected value.
- The `Iso`/`TopDown` geometry feed is NOT this phase: `buildKit` output
  plus `cfg` is what phase 3 adapts into the shared drawing shape.
