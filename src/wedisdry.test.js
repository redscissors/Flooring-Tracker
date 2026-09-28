import test from "node:test";
import assert from "node:assert/strict";
import { solve, savedOption, kitFor, buildFromMarker, sdryNoFit, wediSlotOf, item, SKU, markerCurbKey, coverPickApplies, setSoSource, clearSoSource } from "./wedi.js";
import { SDRY } from "./sdry.js";
import { wediBuildFor, schluterBuildFor, mirrorPlan, wediCompareRows } from "./comparekit.js";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { catalogOf } from "./schluter.js";

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
  assert.equal(q[SDRY.drain], undefined, "an S-DRY base has its drain built in");
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

test("an S-DRY cover pick is inert on a wedi point pan: it bills the wedi cover and leaves the kit clean", () => {
  const o = solve(room(60, 36, "curbed", "center"))[0];
  assert.notEqual(o.pan.sub, "sdry");
  const q = qty(kitFor(o.pan.key, { option: o, room: o.room, mode: "custom", coverPick: { key: "US1076003" } }));
  assert.equal(q[SKU.coverSS], 1);
  assert.equal(q.US1076003, undefined);
  assert.equal(coverPickApplies({ key: "US1076003" }, o.pan.key), false);
  assert.equal(coverPickApplies({ key: SKU.coverSS }, o.pan.key), true);
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

const sealLines = (b) => b.lines.filter((l) => l.item.key === SKU.sealantSausage);

test("S-DRY walls on a Fundo pan with extensions seal the pan and extension joints, with no fasteners", () => {
  const o = solve(room(60, 72)).find((x) => x.id === "extend");
  assert.ok(o.pieces.some((p) => p.kind === "ext"));
  const b = build(o, { sdryBase: "wedi" });
  const seal = sealLines(b);
  assert.equal(seal.length, 1);
  assert.ok(seal[0].qty > 0);
  assert.match(seal[0].note, /pan\/extension joints/);
  assert.equal(qty(b)[SKU.fastenerKit], undefined);
  const keys = b.lines.map((l) => l.item.key);
  assert.deepEqual(keys.filter((k, i) => keys.indexOf(k) !== i), []);
});

test("the pan/extension joint sealant figures the floor once where edge strips overlap", () => {
  const o = solve(room(100, 120, "curbed", "center"))[0];
  const pieceSf = o.pieces.reduce((t, p) => t + p.w * p.d / 144, 0);
  assert.ok(pieceSf > 100 * 120 / 144 + 1, "the solver's corner strips overlap");
  assert.match(sealLines(build(o, { sdryBase: "wedi" }))[0].note, /\(83\.33 sf of floor\)/);
});

test("a bench under S-DRY walls on a wedi pan fastens only its own surfaces", () => {
  const o = solve(room(60, 72)).find((x) => x.id === "extend");
  const benches = [{ kind: "wall", side: "left" }];
  const b = build(o, { sdryBase: "wedi", benches });
  const bench = kitFor(o.pan.key, { option: o, room: o.room, mode: "custom", wallSys: "membrane", benches }).consumables;
  assert.ok(bench.panelSf > 0);
  assert.equal(b.consumables.fastenerCount, Math.ceil(bench.panelSf));
  assert.equal(sealLines(b).length, 1);
});

test("a linear module under S-DRY walls seals its module and extension joints", () => {
  const o = solve(room(60, 36, "curbed", "linear")).find((x) => x.pan.group === "module");
  const seal = sealLines(build(o, { sdryBase: "wedi" }));
  assert.equal(seal.length, 1);
  assert.ok(seal[0].qty > 0);
});

test("an S-DRY floor under Membrane bills no Joint & Seal — its seams ride the tape", () => {
  const o = solve({ ...room(48, 90, "curbless"), system: "sdry" })[0];
  assert.deepEqual(sealLines(build(o)), []);
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

test("a curbless wedi pan under Membrane bills one SEAL line (walls + field seal) and one trowel", () => {
  const o = solve(room(60, 36, "curbless"))[0];
  const b = build(o, { sdryBase: "wedi" });
  const keys = b.lines.map((l) => l.item.key);
  assert.deepEqual(keys.filter((k, i) => keys.indexOf(k) !== i), []);
  const wallSeal = b.sdry.rows.find((r) => r.key === SDRY.seal);
  assert.equal(qty(b)[SDRY.seal], (wallSeal ? wallSeal.qty : 0) + 1);
  assert.match(b.lines.find((l) => l.item.key === SDRY.seal).note, /field seal/);
  assert.equal(qty(b)[SDRY.sealTrowel], 1);
  assert.equal(qty(b)[SKU.subliner53], 1);
  assert.equal(qty(b)[SKU.subCornerIn], 1);
});

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

test("savedOption reopens the saved option, not the first on its pan", () => {
  const res = solve({ w: 30, d: 30, curb: "curbed", drain: "any", tolerance: 0.51, anchor: "left", source: "all" });
  const first = res.find((o) => o.pan.key === "US9320001");
  const second = res.find((o) => o.pan.key === "US9320001" && o.id !== first.id);
  assert.ok(second, "two options share a pan");
  assert.equal(savedOption(res, second.id, "US9320001"), second);
  assert.equal(savedOption(res, "gone", "US9320001"), first);
  assert.equal(savedOption(res, second.id, "nope"), res[0]);
  assert.equal(savedOption([], "x", "y"), null);
});

test("coverPickApplies agrees with kitFor on an S-DRY base under Membrane", () => {
  const o = solve({ ...room(60, 36, "curbed", "center"), system: "sdry" })[0];
  assert.equal(o.pan.sub, "sdry");
  const bill = (pick) => qty(kitFor(o.pan.key, { option: o, room: o.room, mode: "custom", wallSys: "membrane", coverPick: pick }));
  assert.equal(bill({ key: SKU.coverSS })[SKU.coverSS], undefined, "a wedi cover is ignored on an S-DRY base");
  assert.equal(coverPickApplies({ key: SKU.coverSS }, o.pan.key, "membrane"), false);
  assert.equal(bill({ key: "US1076003" }).US1076003, 1);
  assert.equal(coverPickApplies({ key: "US1076003" }, o.pan.key, "membrane"), true);
});

test("Compare: a Membrane wedi build carries one backer note row, a Building Panel build none", () => {
  const backers = (b) => wediCompareRows(b).filter((r) => r.slot === "wallBoard" && r.noteOnly);
  for (const opts of [{ wallSys: "membrane" }, { wallSys: "membrane", sdryBase: "wedi" }]) {
    const rows = backers(wediBuildFor(neutral(true), opts));
    assert.equal(rows.length, 1, JSON.stringify(opts));
    assert.equal(rows[0].retail, 0);
  }
  assert.equal(backers(wediBuildFor(neutral(true), { wallSys: "board" })).length, 0);
  assert.equal(backers(wediBuildFor(neutral(true))).length, 0);
});

test("S-DRY drain covers read by color, not wedi's finish codes", () => {
  const want = {
    US1076002: "S-Dry Drain Cover — Stainless", US1076006: "S-Dry Drain Cover — Chrome",
    US1076001: "S-Dry Drain Cover — Oil-Rubbed Bronze", US1076003: "S-Dry Drain Cover — Matte Black",
    US1076005: "S-Dry Drain Cover — Gold", US1076007: "S-Dry Drain Cover — Brass",
    US1076004: "S-Dry Drain Cover — Tileable", US1076008: "S-Dry Drain Cover — Stainless Commercial (screw-down)",
  };
  const names = () => Object.fromEntries(Object.keys(want).map((k) => [k, item(k).name]));
  assert.deepEqual(names(), want);
  // the pricelist names them by code ("wedi® S-DRY™ DCMB")
  setSoSource(Object.keys(want).map((us) => ({ us, name: "wedi® S-DRY™ DC", size: "", details: "", retail: 99, net: 50, section: "S-DRY", erp: "" })));
  try { assert.deepEqual(names(), want); } finally { clearSoSource(); }
  setSoSource([{ us: "US1076099", name: "wedi® S-DRY™ DCX", size: "", details: "", retail: 99, net: 50, section: "S-DRY", erp: "" }]);
  try { assert.equal(item("US1076099").name, "wedi® S-DRY™ DCX", "an unknown SKU keeps the vendor name"); } finally { clearSoSource(); }
});
