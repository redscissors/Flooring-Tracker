import { test } from "node:test";
import assert from "node:assert/strict";
import { kitFor, buildFromMarker as wediFromMarker } from "./wedi.js";
import { FIXTURE_ITEMS } from "./schluterfixture.js";
import { catalogOf, buildFromMarker as schFromMarker } from "./schluter.js";
import { wediPieces, schluterPieces } from "./showersf.js";
import { WEDI, SCHLUTER } from "./addedgolden.js";

// Old hand-added-line markers — wedi `addons`, Schluter `cfg.manual` rows in
// the old { sku, qty } shape — must reopen to the bill and tile-sf niche the
// pre-1c code gave them (ticket 158 Phase 1c spec, "Golden first"). The
// golden was captured from that code; bills compare as quantities per part,
// because 1c moves added lines into their own groups.
const bag = (lines, keyOf) => {
  const q = new Map();
  lines.filter((l) => !l.noteOnly).forEach((l) => q.set(keyOf(l.item), (q.get(keyOf(l.item)) || 0) + l.qty));
  return [...q].map(([k, n]) => k + "x" + n).sort().join(" ");
};
const nicheOf = (p) => { const n = p && p.pieces.find((x) => x.piece === "niche"); return n ? n.sf : 0; };

test("every old wedi addons marker reopens to its pre-1c bill and niche sf", () => {
  assert.equal(WEDI.length, 21);
  for (const [pan, addons, bill, niche] of WEDI) {
    const cfg = { ...kitFor(pan, {}).cfg, addons };
    delete cfg.manual;
    const at = pan + " " + addons.join(",");
    assert.equal(bag(wediFromMarker({ mode: "kit", cfg }).lines, (i) => i.key), bill, at);
    assert.equal(nicheOf(wediPieces(cfg)), niche, at);
  }
});

test("every old Schluter manual marker reopens to its pre-1c bill and niche sf", () => {
  assert.equal(SCHLUTER.length, 12);
  const cat = catalogOf(FIXTURE_ITEMS);
  for (const [drain, manual, bill, niche] of SCHLUTER) {
    const cfg = {
      w: 60, d: 36, curbed: true, drain, wallSys: "membrane", source: "all", manual,
      walls: [{ name: "Back", on: true, len: 60, h: 96 }, { name: "Left", on: true, len: 36, h: 96 }, { name: "Right", on: true, len: 36, h: 96 }],
    };
    const at = drain + " " + manual.map((m) => m.sku).join(",");
    assert.equal(bag(schFromMarker({ mode: "custom", cfg }, cat).lines, (i) => i.sku), bill, at);
    assert.equal(nicheOf(schluterPieces(cfg)), niche, at);
  }
});
