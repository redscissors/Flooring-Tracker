import test from "node:test";
import assert from "node:assert/strict";
import {
  CELL_KEYS, normCompareSets, roomChanged, sizeChanged, roomLabel, saveEntry, clearSet,
  resumeChoices, isMarkerSeed, mergeManual, entryOf, neutralRoomSchluter, neutralRoomWedi, savedAgo,
} from "./compareset.js";

const room = { w: 60, d: 38, curbed: true, drain: "point", walls: [{ side: "back", on: true, len: 60, h: 84 }], benches: [] };
const snap = { mode: "custom", cfg: { w: 60, d: 38 } };

test("CELL_KEYS is the fixed column order", () => {
  assert.deepEqual(CELL_KEYS, ["wedi:board", "wedi:membrane", "schluter:board", "schluter:membrane"]);
});

test("normCompareSets: absent / junk read as {}", () => {
  for (const v of [undefined, null, 3, "x", []]) assert.deepEqual(normCompareSets(v), {});
});

test("normCompareSets: drops unknown cells, entries without cfg, orphaned areas", () => {
  const got = normCompareSets({
    a1: { "wedi:board": { snap, room, savedAt: 5, savedBy: "Dana" }, "nope:x": { snap, room }, "schluter:board": { snap: {} } },
    gone: { "wedi:board": { snap, room } },
  }, ["a1"]);
  assert.deepEqual(Object.keys(got), ["a1"]);
  assert.deepEqual(Object.keys(got.a1), ["wedi:board"]);
  assert.equal(got.a1["wedi:board"].savedBy, "Dana");
});

test("normCompareSets: keeps target / dropped only when well-formed; an empty area is dropped", () => {
  const got = normCompareSets({ a1: { "wedi:board": {
    snap, room, target: { areaId: "a1", rowId: "r1", kitId: "k" }, dropped: ["drain", 4, ""],
  } }, a2: {} }, ["a1", "a2"]);
  const e = got.a1["wedi:board"];
  assert.deepEqual(e.target, { areaId: "a1", rowId: "r1", kitId: "k" });
  assert.deepEqual(e.dropped, ["drain"]);
  assert.equal(got.a2, undefined);
  const bad = normCompareSets({ a1: { "wedi:board": { snap, room, target: { areaId: "a1" } } } }, ["a1"]);
  assert.equal(bad.a1["wedi:board"].target, undefined);
});

test("roomChanged: each field", () => {
  assert.equal(roomChanged(room, { ...room }), false);
  assert.equal(roomChanged(room, { ...room, w: 62 }), true);
  assert.equal(roomChanged(room, { ...room, curbed: false }), true);
  assert.equal(roomChanged(room, { ...room, drain: "linear" }), true);
  assert.equal(roomChanged(room, { ...room, walls: [{ side: "back", on: true, len: 60, h: 96 }] }), true);
  assert.equal(roomChanged(room, { ...room, benches: [{ kind: "corner", corner: "bl", build: "premade" }] }), true);
  // a bench's brand part is not geometry
  const b = { kind: "wall", side: "back", build: "premade", depth: 14 };
  assert.equal(roomChanged({ ...room, benches: [{ ...b, part: "X" }] }, { ...room, benches: [{ ...b, part: "Y" }] }), false);
  assert.equal(roomChanged(null, room), true);
  assert.equal(sizeChanged(room, { ...room, drain: "linear" }), false);
  assert.equal(sizeChanged(room, { ...room, d: 36 }), true);
});

test("roomLabel", () => {
  assert.equal(roomLabel(room), "60×38");
  assert.equal(roomLabel({ w: 60.5, d: 38 }), "60.5×38");
});

test("saveEntry / clearSet are immutable", () => {
  const e = entryOf({ snap, room, savedBy: "Dana", now: 7 });
  const s1 = saveEntry({}, "a1", "wedi:board", e);
  const s2 = saveEntry(s1, "a1", "schluter:board", e);
  assert.deepEqual(Object.keys(s2.a1).sort(), ["schluter:board", "wedi:board"]);
  assert.equal(Object.keys(s1.a1).length, 1);
  const s3 = clearSet(s2, "a1", "schluter:board");
  assert.deepEqual(Object.keys(s3.a1), ["schluter:board"]);
  assert.deepEqual(clearSet(s2, "a1", null), {});
});

test("entryOf: null without a cfg; stamps savedAt/savedBy/dropped", () => {
  assert.equal(entryOf({ snap: { mode: "kit" }, room }), null);
  const e = entryOf({ snap, room, savedBy: "", now: 9, target: { areaId: "a", rowId: "r", kitId: "" }, dropped: ["curb"] });
  assert.equal(e.savedAt, 9);
  assert.deepEqual(e.target, { areaId: "a", rowId: "r", kitId: "" });
  assert.deepEqual(e.dropped, ["curb"]);
});

test("resumeChoices: that brand only, newest first", () => {
  const set = {
    "wedi:board": entryOf({ snap, room, now: 1 }),
    "wedi:membrane": entryOf({ snap, room, now: 3 }),
    "schluter:board": entryOf({ snap, room, now: 9 }),
  };
  assert.deepEqual(resumeChoices(set, "wedi").map((c) => c.key), ["wedi:membrane", "wedi:board"]);
  assert.deepEqual(resumeChoices(undefined, "wedi"), []);
});

test("isMarkerSeed", () => {
  assert.equal(isMarkerSeed({ mode: "kit", cfg: { panKey: "P" } }), true);
  assert.equal(isMarkerSeed({ mode: "custom", cfg: { w: 60, d: 38 } }), true);
  assert.equal(isMarkerSeed({ tab: "custom", input: { w: 60 } }), false);
  assert.equal(isMarkerSeed(null), false);
});

test("mergeManual: own first, incoming only when its key is new", () => {
  const k = (r) => r.key;
  assert.deepEqual(
    mergeManual([{ key: "a", qty: 1 }], [{ key: "a", qty: 2 }, { key: "b", qty: 1 }], k),
    [{ key: "a", qty: 1 }, { key: "b", qty: 1 }]);
});

test("neutral rooms: benches ride along, ids stripped, legacy Schluter flag read", () => {
  const b = { id: 3, kind: "corner", corner: "bl", build: "premade", part: "KBSB406406" };
  const s = neutralRoomSchluter({ w: 60, d: 38, curbed: true, drain: "point", walls: [{ name: "Back", on: true, len: 60, h: 84 }], benches: [b] });
  assert.deepEqual(s.benches, [{ kind: "corner", corner: "bl", build: "premade", part: "KBSB406406" }]);
  assert.deepEqual(s.walls, [{ side: "back", on: true, len: 60, h: 84 }]);
  assert.deepEqual(neutralRoomSchluter({ w: 60, d: 38, bench: "framed" }).benches, [{ kind: "wall", side: "back", build: "framed" }]);
  const w = neutralRoomWedi({ room: { w: 60, d: 38 }, solve: { input: { curb: "curbless", drain: "linear" } }, walls: [{ side: "back", len: 60, h: 96 }], benches: [b] });
  assert.equal(w.curbed, false);
  assert.equal(w.drain, "linear");
  assert.equal(w.benches[0].id, undefined);
  const kit = neutralRoomWedi({ room: { w: 36, d: 60 }, panKey: "P" }, () => ({ sub: "curbless", drain: { type: "offset" } }));
  assert.equal(kit.curbed, false);
  assert.equal(kit.drain, "offset");
});

test("savedAgo", () => {
  const now = 10 * 86400000;
  assert.equal(savedAgo(now - 20000, now), "just now");
  assert.equal(savedAgo(now - 5 * 60000, now), "5 min ago");
  assert.equal(savedAgo(now - 2 * 3600000, now), "2 hrs ago");
  assert.equal(savedAgo(now - 30 * 3600000, now), "yesterday");
  assert.equal(savedAgo(now - 4 * 86400000, now), "4 days ago");
});
