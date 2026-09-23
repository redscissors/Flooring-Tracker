import test from "node:test";
import assert from "node:assert/strict";
import { wediPieces, schluterPieces, jobShowers } from "./showersf.js";
import { curbInsets } from "./wedi.js";

const sf = (r) => Object.fromEntries(r.pieces.map((p) => [p.piece, p.sf]));
const W3 = [{ side: "back", len: 60, h: 96 }, { side: "left", len: 36, h: 96 }, { side: "right", len: 36, h: 96 }];
const base = { panKey: "US9100002", room: { w: 60, d: 36 }, walls: W3 };

test("wedi: three walls, curb cap across the entry, one 12×12 niche", () => {
  const r = wediPieces({ ...base, curbKey: "US3000008", addons: ["US3000005"] });
  assert.deepEqual(sf(r), { walls: 88, floor: 15, curb: 6.1, niche: 1 });
  assert.equal(r.curbed, true);
  assert.deepEqual(r.pieces.map((p) => p.piece), ["walls", "floor", "curb", "niche"]);
});

test("wedi: lean curb and a back bench (face into walls, top its own piece, footprint off the floor)", () => {
  assert.deepEqual(sf(wediPieces({ ...base, curbKey: "US3000038", benches: [{ kind: "wall", side: "back", len: 48 }] })),
    { walls: 94, floor: 10.3, curb: 3.8, benchTop: 4.7 });
});

test("wedi: a premade floor-standing bench takes its footprint off the floor", () => {
  assert.equal(sf(wediPieces({ ...base, benches: [{ kind: "wall", side: "back", part: "US3000056" }] })).floor, 9.7);
});

test("wedi: a suspended bench leaves the floor tiled beneath it", () => {
  assert.equal(sf(wediPieces({ ...base, benches: [{ kind: "wall", side: "back", part: "US3000000" }] })).floor, 15);
  assert.equal(sf(wediPieces({ ...base, benches: [{ kind: "corner", corner: "bl", part: "US3000002" }] })).floor, 15);
});

test("wedi: a framed bench leaves the floor the configurator's clear space (whole strip, cut or smaller pan)", () => {
  for (const panFit of ["cut", "smaller"]) {
    const r = wediPieces({ ...base, benches: [{ kind: "wall", side: "back", build: "framed", panFit, len: 48 }] });
    assert.equal(sf(r).floor, 9.2);   // 60 × (36 − 14)
  }
});

test("wedi: 'max — curb inside' + a full-run side bench doesn't subtract the part over the curb", () => {
  const cfg = { ...base, curbKey: "US3000008", maxIn: true, tileT: 0.375, benches: [{ kind: "wall", side: "left" }] };
  const ins = curbInsets(cfg.room, cfg.walls, cfg.curbKey, cfg.tileT);
  const fw = 60 - ins.left - ins.right, fd = 36 - ins.back - ins.entry;
  const expected = Math.round(((fw * fd - 14 * fd) / 144) * 10) / 10;
  assert.equal(sf(wediPieces(cfg)).floor, expected);
});

test("wedi: 'max — curb inside' takes the curb out of the floor", () => {
  assert.equal(sf(wediPieces({ ...base, curbKey: "US3000008", maxIn: true, tileT: 0.375 })).floor, 13.2);
});

test("wedi: kit mode (no room) reads the pan; corner bench", () => {
  assert.deepEqual(sf(wediPieces({ panKey: "US9100002", walls: W3, curbKey: "US3000008", benches: [{ kind: "corner", corner: "bl" }] })),
    { walls: 92.2, floor: 10, curb: 4.9, benchTop: 2 });
});

test("wedi: a corner bench's triangle comes off the floor in every corner", () => {
  for (const corner of ["bl", "br", "fl", "fr"]) assert.equal(sf(wediPieces({ ...base, benches: [{ kind: "corner", corner }] })).floor, 13);
});

test("wedi: curbless has no curb piece", () => {
  assert.equal(wediPieces({ ...base, curbKey: null }).pieces.some((p) => p.piece === "curb"), false);
  assert.equal(wediPieces({ ...base, curbKey: null }).curbed, false);
});

test("wedi: an unknown curb part is 'enter manually' (sf null), never a guess", () => {
  const c = wediPieces({ ...base, curbKey: "NOPE" }).pieces.find((p) => p.piece === "curb");
  assert.equal(c.sf, null);
});

test("wedi: unknown pan → null", () => {
  assert.equal(wediPieces({ panKey: "NOPE" }), null);
  assert.equal(wediPieces(null), null);
});

const S = { w: 60, d: 36, curbed: true, walls: [{ name: "Back", on: true, len: 60, h: 96 }, { name: "Left", on: true, len: 36, h: 96 }, { name: "Right", on: true, len: 36, h: 96 }] };

test("schluter: walls, floor, 6\"×4½\" curb", () => {
  assert.deepEqual(sf(schluterPieces(S)), { walls: 88, floor: 15, curb: 6.9 });
});

test("schluter: premade bench reads its size off the SKU; niche off its SKU", () => {
  const r = schluterPieces({ ...S, benches: [{ kind: "wall", side: "back", part: "KBSB4101220RA" }], manual: [{ sku: "KB12SN305508A1", qty: 1 }] });
  assert.deepEqual(sf(r), { walls: 94.7, floor: 9.7, curb: 6.9, niche: 1.7, benchTop: 5.3 });
});

test("schluter: a framed bench leaves the floor the tray's clear space", () => {
  assert.equal(sf(schluterPieces({ ...S, benches: [{ kind: "wall", side: "left", build: "framed", len: 24 }] })).floor, 11.5);   // (60 − 14) × 36
});

test("schluter: curbless → no curb piece", () => {
  assert.equal(schluterPieces({ ...S, curbed: false }).pieces.some((p) => p.piece === "curb"), false);
});

test("jobShowers lists every placed kit with its area name and pieces", () => {
  const cats = [
    { id: "a1", name: "Master Bath", products: [{ id: "r1", kitId: "k1", wedi: { mode: "custom", cfg: { ...base, curbKey: "US3000008" } } }] },
    { id: "a2", name: "Guest", products: [{ id: "r2", kitId: "", schluter: { mode: "custom", cfg: S } }] },
  ];
  const list = jobShowers(cats);
  assert.deepEqual(list.map((s) => [s.key, s.vendor, s.areaName, s.size]), [["k1", "wedi", "Master Bath", "60×36"], ["row:r2", "schluter", "Guest", "60×36"]]);
});

test("jobShowers keeps an unmeasurable kit on the list, marked unmeasured", () => {
  const cats = [{ id: "a1", name: "Master Bath", products: [{ id: "r1", kitId: "k1", wedi: { mode: "custom", cfg: { ...base, panKey: "NOPE" } } }] }];
  assert.deepEqual(jobShowers(cats), [{ key: "k1", vendor: "wedi", areaName: "Master Bath", size: "", curbed: false, pieces: [], unmeasured: true }]);
});
