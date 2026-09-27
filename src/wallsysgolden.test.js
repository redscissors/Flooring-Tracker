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
