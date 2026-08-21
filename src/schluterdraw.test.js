import test from "node:test";
import assert from "node:assert/strict";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { classify, catalogOf, trayCandidates } from "./schluter.js";
import { schluterDiag, schluterWalls, schluterCurb, schluterWallOn } from "./schluterdraw.js";

const CAT = catalogOf(FIXTURE_ITEMS);
const cfg = (o) => ({
  w: 60, d: 38, curbed: true, drain: "point", wallSys: "membrane",
  walls: [
    { name: "Back", on: true, len: 60, h: 84 },
    { name: "Left", on: true, len: 38, h: 84 },
    { name: "Right", on: true, len: 38, h: 84 },
  ],
  ...o,
});
const candFor = (c) => trayCandidates(c, CAT, { source: "all" })[0];

test("exact tray: one room-sized piece, no cut, centred drain, sku label", () => {
  const c = cfg({});
  const cand = candFor(c);
  assert.equal(cand.cut, 0);
  const o = schluterDiag(c, cand);
  assert.deepEqual(o.room, { w: 60, d: 38 });
  assert.equal(o.pieces.length, 1);
  assert.deepEqual(
    (({ x, y, w, d, cut }) => ({ x, y, w, d, cut }))(o.pieces[0]),
    { x: 0, y: 0, w: 60, d: 38, cut: null });
  assert.equal(o.pieces[0].item.us, cand.tray.sku);
  assert.deepEqual({ x: o.drain.x, y: o.drain.y, type: o.drain.type }, { x: 30, y: 19, type: "point" });
  assert.deepEqual(o.warnings, []);
});

test("cut tray: cut dims ride the piece and the off-centre drain warns", () => {
  // 50×38 point room on the 60×38 tray: 10" comes off one side, the moulded
  // drain stays at the uncut tray's centre — 5" off the room's own centre.
  const c = cfg({ w: 50 });
  const cand = candFor(c);
  assert.ok(cand.cut > 0);
  const o = schluterDiag(c, cand);
  assert.deepEqual(o.pieces[0].cut, { w: cand.tray.w, d: cand.tray.d });
  assert.equal(o.drain.x, cand.tray.w / 2);
  assert.equal(o.warnings.length, 1);
  assert.match(o.warnings[0], /off the room centre/);
});

test("linear room: the drain runs at the back wall, w-8 long", () => {
  const c = cfg({ w: 48, d: 48, drain: "linear" });
  const o = schluterDiag(c, candFor(c));
  assert.equal(o.drain.type, "linear");
  assert.equal(o.drain.axis, "w");
  assert.equal(o.drain.len, 40);
  assert.equal(o.drain.x, 24);
});

test("mortar fallback: an uncut room-shaped bed, titled", () => {
  const c = cfg({ w: 30, d: 30 }); // nothing in the catalog covers a 30×30 point room this tightly? it does — force mortar
  const o = schluterDiag(cfg({}), { kind: "mortar", cut: 0, deep: false });
  assert.equal(o.title, "Mortar bed + KERDI");
  assert.equal(o.pieces[0].cut, null);
  assert.ok(c);
});

test("walls: only the on walls, board walls carry 48\" course joints, membrane walls none", () => {
  const c = cfg({ wallSys: "board", walls: [
    { name: "Back", on: true, len: 60, h: 84 },
    { name: "Left", on: false, len: 38, h: 84 },
    { name: "Right", on: true, len: 38, h: 84 },
  ] });
  const dw = schluterWalls(c);
  assert.deepEqual(dw.map((w) => w.side), ["back", "right"]);
  assert.deepEqual(dw[0], {
    side: "back", len: 60, h: 84, at: "lo", faces: "in", wid: "back", extra: false,
    courses: [{ lens: [48, 12], y0: 0, ch: 84 }],
  });
  // a 38" run fits inside one 48" panel — no joint
  assert.deepEqual(dw[1].courses, [{ lens: [38], y0: 0, ch: 84 }]);
  assert.deepEqual(schluterWalls(cfg({})).map((w) => w.courses), [[], [], []]);
  assert.deepEqual(schluterWallOn(c), { back: true, left: false, right: true });
});

test("curb: one entry run with the KBSC profile; curbless has none", () => {
  const curbed = schluterCurb(cfg({}));
  assert.deepEqual(curbed.segs, [{ side: "entry", from: 0, len: 60, ext0: 0, ext1: 0 }]);
  assert.deepEqual(curbed.diags, []);
  assert.equal(curbed.w, 4.5);
  assert.equal(curbed.h, 6);
  assert.deepEqual(schluterCurb(cfg({ curbed: false })).segs, []);
});

test("a rotated candidate draws in its effective orientation", () => {
  const c = cfg({ w: 38, d: 60 });
  const cand = candFor(c);
  assert.equal(cand.rot, true);
  const o = schluterDiag(c, cand);
  // exact rotated fit — no cut, drain at the rotated tray's centre = room centre
  assert.equal(o.pieces[0].cut, null);
  assert.deepEqual({ x: o.drain.x, y: o.drain.y }, { x: 19, y: 30 });
  assert.deepEqual(o.warnings, []);
});

test("the classified tray feeding the diag is the adapter's shape too", () => {
  // guard: schluterDiag only reads tray {sku, name, w, d, drain} — fields
  // classify() derives for both fixture and adapted live rows
  const tray = classify(FIXTURE_ITEMS.find((i) => i.sku === "KST965/1525"));
  const o = schluterDiag(cfg({}), { tray, cut: 0, deep: false, kind: "exact" });
  assert.equal(o.title, tray.name);
});
