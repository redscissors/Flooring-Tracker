import test from "node:test";
import assert from "node:assert/strict";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { classify, catalogOf, trayCandidates, normBench } from "./schluter.js";
import { schluterDiag, schluterWalls, schluterCurb, schluterWallOn, schluterOpenCorners, schluterCuts } from "./schluterdraw.js";
import { boardPlan, expandBoardFaces } from "./schluter.js";

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

test("added walls (cfg.xwalls) ride into dWalls, anchored at their end", () => {
  const c = cfg({ wallSys: "board", xwalls: [{ edge: "entry", at: "hi", len: 24, h: 40 }] });
  const dw = schluterWalls(c);
  assert.equal(dw.length, 4);
  const x = dw[3];
  assert.deepEqual(
    (({ side, at, len, h, extra }) => ({ side, at, len, h, extra }))(x),
    { side: "entry", at: "hi", len: 24, h: 40, extra: true });
  assert.deepEqual(x.courses, [{ lens: [24], y0: 0, ch: 40 }]);
  // membrane walls carry no course ticks, added or not
  assert.deepEqual(schluterWalls(cfg({ xwalls: [{ edge: "entry", len: 24, h: 40 }] }))[3].courses, []);
});

test("the curb spans the entry opening, butting the entry walls", () => {
  const one = schluterCurb(cfg({ xwalls: [{ edge: "entry", at: "lo", len: 24, h: 84 }] }));
  assert.deepEqual(one.segs, [{ side: "entry", from: 24, len: 36, ext0: 0, ext1: 0 }]);
  const both = schluterCurb(cfg({ xwalls: [
    { edge: "entry", at: "lo", len: 12, h: 84 }, { edge: "entry", at: "hi", len: 18, h: 84 }] }));
  assert.deepEqual(both.segs, [{ side: "entry", from: 12, len: 30, ext0: 0, ext1: 0 }]);
  // fully walled entry: no curb band left to draw
  assert.deepEqual(schluterCurb(cfg({ xwalls: [{ edge: "entry", at: "lo", len: 60, h: 84 }] })).segs, []);
  // a side wall never narrows the entry run
  assert.equal(schluterCurb(cfg({ xwalls: [{ edge: "left", at: "lo", len: 24, h: 84 }] })).segs[0].len, 60);
});

test("a pinned candidate's achieved drain position draws, without the centre warning", () => {
  const c = cfg({ w: 50, drainX: 20 });
  const cand = candFor(c);
  assert.equal(cand.miss, 0);
  const o = schluterDiag(c, cand);
  assert.equal(o.drain.x, 20);
  assert.deepEqual(o.warnings, []);
  // a pin the cut can't reach warns with the miss
  const far = cfg({ w: 50, drainX: 5 });
  const o2 = schluterDiag(far, candFor(far));
  assert.equal(o2.warnings.length, 1);
  assert.match(o2.warnings[0], /off the pinned point/);
});

test("open corners: fronts are open (the curb never boxes), backs boxed by their walls", () => {
  const walled = schluterOpenCorners(cfg({}));
  assert.deepEqual(walled, { bl: false, br: false, fl: true, fr: true });
  // left wall off frees both left corners
  const noLeft = cfg({ walls: [{ on: true, len: 60, h: 84 }, { on: false, len: 38, h: 84 }, { on: true, len: 38, h: 84 }] });
  assert.equal(schluterOpenCorners(noLeft).bl, true);
  // an entry wall boxes its front corner
  const entryLo = cfg({ xwalls: [{ edge: "entry", at: "lo", len: 24, h: 84 }] });
  assert.equal(schluterOpenCorners(entryLo).fl, false);
  assert.equal(schluterOpenCorners(entryLo).fr, true);
});

test("schluterCuts keeps only OPEN cut corners, legged 12x12", () => {
  const c = cfg({ corners: ["bl", "fl"] });
  assert.deepEqual(schluterCuts(c), [{ corner: "fl", h: 12, v: 12 }]);
});

test("a cut front corner turns the curb diagonally and the run gives up the leg", () => {
  const one = schluterCurb(cfg({ corners: ["fl"] }));
  assert.deepEqual(one.segs, [{ side: "entry", from: 12, len: 48, ext0: 0, ext1: 0 }]);
  assert.equal(one.diags.length, 1);
  assert.deepEqual(
    (({ corner, h, v, len }) => ({ corner, h, v, len }))(one.diags[0]),
    { corner: "fl", h: 12, v: 12, len: 16.97 });
  const both = schluterCurb(cfg({ corners: ["fl", "fr"] }));
  assert.deepEqual(both.segs, [{ side: "entry", from: 12, len: 36, ext0: 0, ext1: 0 }]);
  assert.equal(both.diags.length, 2);
});

test('an "any" room draws whatever the picked tray is', () => {
  const room = cfg({ w: 48, d: 48, drain: "any" });
  const cands = trayCandidates(room, CAT, { source: "all" });
  const lin = cands.find((c) => c.tray.drain === "linear");
  assert.equal(schluterDiag(room, lin).drain.type, "linear");
  assert.equal(schluterDiag(room, cands[0]).drain.type, "point");
});

// --- benches (wedi parity round 3) ------------------------------------------

test("a framed back bench offsets and shrinks the tray piece; the drain follows", () => {
  const bench = normBench({ kind: "wall", side: "back", build: "framed" }, { w: 60, d: 38 }, CAT);
  const c = cfg({ benches: [{ kind: "wall", side: "back", build: "framed" }] });
  const cand = candFor(c);
  const o = schluterDiag(c, cand, [bench]);
  const p = o.pieces[0];
  assert.equal(p.y, 14);
  assert.equal(p.d, 24);
  assert.equal(p.w, 60);
  assert.equal(o.room.d, 38);           // the room outline stays full size
  assert.ok(o.drain.y >= 14, "drain sits inside the tray region");
});

test("a kept tray whose drain ends up behind the bench face warns", () => {
  // a 22"-deep framed bench on "Cut it down": the full-room 60×38 tray keeps
  // its centred drain at y=19, but the clear space starts at y=22
  const row = { kind: "wall", side: "back", build: "framed", depth: 22 };
  const bench = normBench(row, { w: 60, d: 38 }, CAT);
  const c = cfg({ benches: [row] });
  const o = schluterDiag(c, candFor(c), [bench]);
  assert.equal(o.pieces[0].y, 22);
  assert.ok(o.warnings.some((w) => /under the framed bench/.test(w)));
});

test("a build-up bench never moves the tray piece", () => {
  const bench = normBench({ kind: "wall", side: "back", build: "site" }, { w: 60, d: 38 }, CAT);
  const c = cfg({ benches: [{ kind: "wall", side: "back", build: "site" }] });
  const o = schluterDiag(c, candFor(c), [bench]);
  assert.equal(o.pieces[0].y, 0);
  assert.equal(o.pieces[0].d, 38);
});

test("the curb butts a framed left bench that reaches the entry; a build-up leaves it whole", () => {
  const dims = { w: 60, d: 38 };
  const framed = normBench({ kind: "wall", side: "left", build: "framed" }, dims, CAT);
  const c = cfg({});
  const cut = schluterCurb(c, [framed]);
  assert.equal(cut.segs.length, 1);
  assert.equal(cut.segs[0].from, 14);   // the run starts at the bench face
  assert.equal(cut.segs[0].len, 46);
  const site = normBench({ kind: "wall", side: "left", build: "site" }, dims, CAT);
  const whole = schluterCurb(c, [site]);
  assert.equal(whole.segs[0].from, 0);
  assert.equal(whole.segs[0].len, 60);
  // a framed bench short of the entry never touches the curb
  const shortB = normBench({ kind: "wall", side: "left", build: "framed", len: 20 }, dims, CAT);
  assert.equal(schluterCurb(c, [shortB]).segs[0].len, 60);
});

// --- round 6: curb on every open edge + faces passthrough -------------------

test("a wall turned off hands its edge to the curb band", () => {
  const c = cfg({});
  c.walls = c.walls.map((w, i) => (i === 1 ? { ...w, on: false } : w));
  const cut = schluterCurb(c, []);
  assert.deepEqual(cut.segs.map((s) => [s.side, s.from, s.len]), [["left", 0, 38], ["entry", 0, 60]]);
});

test("a cut corner between two open edges draws one diagonal, runs give up the legs", () => {
  const c = cfg({ corners: ["fl"] });
  c.walls = c.walls.map((w, i) => (i === 1 ? { ...w, on: false } : w));
  const cut = schluterCurb(c, []);
  assert.deepEqual(cut.segs.map((s) => [s.side, s.from, s.len]), [["left", 0, 26], ["entry", 12, 48]]);
  assert.equal(cut.diags.length, 1);
  assert.equal(cut.diags[0].corner, "fl");
});

test("schluterWalls passes per-wall faces through to the drawings", () => {
  const c = cfg({ xwalls: [{ id: 1, edge: "entry", at: "lo", len: 24, h: 84, faces: "in-end" }] });
  c.walls = c.walls.map((w, i) => (i === 1 ? { ...w, faces: "both" } : w));
  const dw = schluterWalls(c);
  assert.equal(dw.find((w) => w.side === "left").faces, "both");
  assert.equal(dw.find((w) => w.extra).faces, "in-end");
  assert.equal(dw.find((w) => w.side === "back").faces, "in");
});

// --- round 7: the Fit plan's courses reach the drawings ---------------------

test("schluterWalls takes the plan's per-wall courses; without a plan the 48\" ticks stand in", () => {
  const c = cfg({ wallSys: "board" });
  const plan = boardPlan(expandBoardFaces(c), CAT, { source: "all" });
  const dw = schluterWalls(c, plan);
  // back 60x84: two stacked courses off the plan (not one floor-to-top)
  const back = dw.find((w) => w.side === "back");
  assert.equal(back.courses.length, 2);
  assert.equal(back.courses[1].y0, 48);
  // left 38x84 stood vertical: one seamless course
  const left = dw.find((w) => w.side === "left");
  assert.equal(left.courses.length, 1);
  assert.equal(left.courses[0].vertical, true);
  // no plan → the old one-course tick pattern
  const bare = schluterWalls(c);
  assert.equal(bare.find((w) => w.side === "back").courses.length, 1);
  // membrane walls never carry courses, plan or not
  const mem = cfg({});
  assert.deepEqual(schluterWalls(mem, plan).find((w) => w.side === "back").courses, []);
});
