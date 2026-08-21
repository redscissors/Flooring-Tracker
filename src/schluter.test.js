import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { classify, catalogOf, trayCandidates, pickRolls, buildKit, linesTotal } from "./schluter.js";

test("fixture loads", () => assert.equal(FIXTURE_ITEMS.length >= 55, true));
test("classify exists", () => assert.equal(typeof classify, "function"));

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
  assert.ok(Math.abs(by("KB506252440").sf - 16.33) < 0.01);
});
test("non-shower items are null", () => {
  assert.equal(classify({ sku: "SLRA100ATGB", name: '3/8" Schluter Jolly' }), null);
});

// Own test: every fixture row classifies — this fixture is all shower-system
// rows plus kits, so the expected null set is empty. A row that legitimately
// belongs outside the shower-system grammar would need to be named here.
test("classify covers every fixture row (expected-null set is empty)", () => {
  const EXPECTED_NULL_SKUS = new Set();
  const nulls = FIXTURE_ITEMS
    .filter((item) => classify(item) === null)
    .map((item) => item.sku);
  assert.deepEqual(new Set(nulls), EXPECTED_NULL_SKUS);
});

// --- Solver: catalogOf, trayCandidates, pickRolls (Task 3) ---

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

test("curbless thin-priority order pinned in trayCandidates", () => {
  const synCat = [
    { g: "tray", w: 38, d: 36, drain: "point", thin: true, stock: true, price: 100, sku: "SYN-THIN" },
    { g: "tray", w: 36, d: 36, drain: "point", thin: false, stock: true, price: 90, sku: "SYN-EXACT" },
  ];
  // decision 6 pinned: for curbless, thin outranks cut — owner-reviewable
  const curbless = trayCandidates(cfg({ w: 36, d: 36, curbed: false }), synCat, { source: "all" });
  assert.equal(curbless[0].tray.sku, "SYN-THIN");
  const curbed = trayCandidates(cfg({ w: 36, d: 36, curbed: true }), synCat, { source: "all" });
  assert.equal(curbed[0].tray.sku, "SYN-EXACT");
});

// --- buildKit: the shelf-kit recipes (Task 4) ---

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
test("mortar fallback without mortarItem: no-fit room must not crash", () => {
  const b = buildKit(cfg({ w: 30, d: 90 }), CAT, { source: "all" });
  const noteOnlyBase = b.lines.find((l) => l.g === "Base" && l.noteOnly);
  assert.ok(noteOnlyBase, "noteOnly placeholder Base line present");
  assert.equal(noteOnlyBase.item.name, "Mortar bed — pick a mortar in Settings → Materials");
  assert.equal(b.lines.some((l) => l.g === "Base" && l.item.sf), true); // KERDI over the bed still present
});
test("bench build-up lands 2x 2-inch board", () => {
  const b = buildKit(cfg({ bench: "buildup" }), CAT, { source: "all" });
  const x = b.lines.find((l) => l.g === "Extras");
  assert.equal(x.item.thick2, true); assert.equal(x.qty, 2);
});
