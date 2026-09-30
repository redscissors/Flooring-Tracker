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

test("a layout with a trimmed piece never reads No cutting — the nearest room", () => {
  const o = sdryNearest({ w: 100, d: 120, drain: "any" }, cat);
  assert.ok(o.pieces.some((p) => p.cut), "the nearest layout trims an extension");
  assert.ok(!o.badges.includes("No cutting"), o.badges.join(" · "));
  assert.ok(o.badges.includes("Trim to fit"), o.badges.join(" · "));
});

test("curb: full by default, lean on pick, one 72 per 72 of opening", () => {
  assert.deepEqual([sdryCurb(60, null, cat).item.key, sdryCurb(60, null, cat).qty], [SDRY.curbFull, 1]);
  assert.equal(sdryCurb(80, { sub: "lean" }, cat).item.key, SDRY.curbLean);
  assert.equal(sdryCurb(80, null, cat).qty, 2);
  assert.equal(sdryCurb(60, { none: true }, cat).qty, 0);
  assert.equal(sdryCurb(60, null, cat).note, 'cut to 60"');
  assert.equal(sdryCurb(72, null, cat).note, "full length — no cut");
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

test("walls: the standard 50\"×25' roll by default; a pick swaps to XL; a stale pick falls back", () => {
  const walls = [{ side: "back", len: 60, h: 96 }, { side: "left", len: 36, h: 96 }, { side: "right", len: 36, h: 96 }];
  const args = { wallSf: 132 * 96 / 144, walls, curbed: true, openLen: 60, seams: [] };
  const roll = (pick) => sdryWalls({ ...args, pick }, cat).rows.find((r) => r.key === SDRY.roll || r.key === SDRY.rollXL);
  // 88 sf of wall × 1.1 laps = 96.8 sf
  assert.deepEqual([roll().key, roll().qty], [SDRY.roll, 1]);
  assert.deepEqual([roll(SDRY.rollXL).key, roll(SDRY.rollXL).qty], [SDRY.rollXL, 1]);
  assert.equal(roll("US0000000").key, SDRY.roll);
  assert.match(roll("US0000000").note, /not in the book/);
  const big = sdryWalls({ ...args, wallSf: 200 }, cat).rows.find((r) => r.key === SDRY.roll);
  assert.equal(big.qty, 3, "220 sf ÷ 104 sf/roll");
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

test("a room a base covers alone offers no extension card", () => {
  const { options } = fit(24, 24, "offset");
  assert.ok(options.length > 0);
  assert.ok(options.every((o) => !o.floorLines.some((l) => l.item.key === SDRY.ext)), options.map((o) => o.title).join(" · "));
});

test("no option bills an extension it has no piece for", () => {
  const extsOf = (o) => (o.floorLines.find((l) => l.item.key === SDRY.ext) || { qty: 0 }).qty;
  for (let w = 24; w <= 100; w += 4) for (let d = 24; d <= 124; d += 4) for (const drain of ["any", "center", "offset"]) {
    const opts = fit(w, d, drain).options.concat(sdryNearest({ w, d, drain }, cat) || []);
    for (const o of opts) {
      const n = o.pieces.filter((p) => p.kind === "ext").length;
      assert.equal(extsOf(o), n, `${w}×${d} ${drain}: ${o.title}`);
      assert.ok(o.seams.length <= n, `${w}×${d} ${drain}: ${o.title} seams ${o.seams}`);
      assert.equal(/2 extensions/.test(o.title) ? 2 : /extension/.test(o.title) ? 1 : 0, n, `${w}×${d} ${drain}: ${o.title}`);
    }
  }
});
