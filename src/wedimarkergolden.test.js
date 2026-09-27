import { test } from "node:test";
import assert from "node:assert/strict";
import { group, kitFor, buildFromMarker, panRoomDims, SKU } from "./wedi.js";
import { BASE, CURBS, PANELS } from "./wedimarkergolden.js";

// Every old wedi marker shape — resolved curbKey and panelKey always written —
// must reopen to the bill the pre-1b code gave it (ticket 158 Phase 1b spec,
// "Old wedi markers, exhaustively"). The golden was captured from that code;
// the marker is rebuilt here as it was saved: today's cfg for the same room
// plus the two resolved keys the old kitFor always wrote.
const bill = (b, keep) => b.lines.filter(keep).map((l) => l.item.key + "x" + l.qty).join(" ");
const isCurb = (l) => l.item.group === "curb";
const roomOf = (pan, widen) => {
  const own = panRoomDims([...group("pan"), ...group("module")].find((p) => p.key === pan));
  return { w: own.w + widen, d: own.d };
};

test("every old curb marker (each pan × curb key, none, the recipe default × own and widened opening) reopens to its pre-1b bill", () => {
  assert.equal(CURBS.length, 840);
  for (const [pan, widen, arg, saved, curbLines] of CURBS) {
    const cfg = { ...kitFor(pan, { room: roomOf(pan, widen) }).cfg, curbKey: saved, panelKey: SKU.panelDefault };
    const back = buildFromMarker({ mode: "kit", cfg });
    const at = `${pan} +${widen}" ${arg}`;
    assert.equal(bill(back, isCurb), curbLines, at);
    assert.equal(bill(back, (l) => !isCurb(l)), BASE[pan + "|" + widen], at);
  }
});

test("every old panel marker reopens to its pre-1b bill", () => {
  assert.equal(PANELS.length, group("panel").length);
  for (const [, saved, whole] of PANELS) {
    const cfg = { ...kitFor("US9100004", { room: { w: 60, d: 36 } }).cfg, curbKey: SKU.curbLean60, panelKey: saved };
    assert.equal(bill(buildFromMarker({ mode: "kit", cfg }), () => true), whole, saved);
  }
});
