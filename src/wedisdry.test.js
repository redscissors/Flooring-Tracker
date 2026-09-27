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
