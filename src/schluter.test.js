import { test } from "node:test";
import assert from "node:assert/strict";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { classify, catalogOf, trayCandidates, pickRolls } from "./schluter.js";

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
