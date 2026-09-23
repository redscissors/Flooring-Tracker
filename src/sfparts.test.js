import test from "node:test";
import assert from "node:assert/strict";
import { PIECES, normSfParts, sfPartsTotal, fmtSf, togglePiece, addExtra, removeAt, sfPatch, sfPartsState, sfPartsText, droppedText } from "./sfparts.js";

const SH = { key: "k1", vendor: "wedi", areaName: "Master Bath", size: "60×36", curbed: true,
  pieces: [{ piece: "walls", label: "Walls (incl. bench faces)", sf: 88 }, { piece: "floor", label: "Floor", sf: 15 }, { piece: "niche", label: "Niche back", sf: 1 }] };

test("PIECES lists the five pieces in menu order", () => {
  assert.deepEqual(PIECES.map((x) => x.piece), ["walls", "floor", "curb", "niche", "benchTop"]);
});

test("normSfParts keeps valid entries, drops junk, and returns undefined when empty", () => {
  assert.equal(normSfParts(undefined), undefined);
  assert.equal(normSfParts([]), undefined);
  assert.equal(normSfParts([null, { kind: "shower", kitId: "", piece: "walls", sf: 1 }, { kind: "shower", kitId: "k", piece: "roof", sf: 1 }]), undefined);
  assert.deepEqual(normSfParts([{ kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: "88" }, { kind: "extra", label: " Hall ", sf: 45 }, { kind: "extra", label: "", sf: "x" }]), [
    { kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: 88 },
    { kind: "extra", label: "Hall", sf: 45 },
  ]);
});

test("sfPartsTotal sums to one decimal", () => {
  assert.equal(sfPartsTotal([{ sf: 72 }, { sf: 6.15 }, { sf: 0.1 }]), 78.3);
  assert.equal(sfPartsTotal(undefined), 0);
});

test("fmtSf drops a trailing .0", () => {
  assert.equal(fmtSf(72), "72");
  assert.equal(fmtSf(6.1), "6.1");
});

test("togglePiece adds then removes a shower piece", () => {
  const on = togglePiece([], SH, SH.pieces[0]);
  assert.deepEqual(on, [{ kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: 88 }]);
  assert.deepEqual(togglePiece(on, SH, SH.pieces[0]), []);
});

test("addExtra / removeAt edit the extra-space list", () => {
  const a = addExtra([], " Hall ", 45);
  assert.deepEqual(a, [{ kind: "extra", label: "Hall", sf: 45 }]);
  assert.deepEqual(removeAt(a, 0), []);
});

test("sfPatch sets qty to the total, and clears both when empty", () => {
  assert.deepEqual(sfPatch([{ kind: "extra", label: "Hall", sf: 45 }]), { sfParts: [{ kind: "extra", label: "Hall", sf: 45 }], qty: "45" });
  assert.deepEqual(sfPatch([]), { sfParts: undefined, qty: "" });
});

test("sfPartsState: no breakdown → null", () => {
  assert.equal(sfPartsState({ qty: "10" }, [SH]), null);
});

test("sfPartsState: typed override drifts against the pieces", () => {
  const parts = [{ kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: 88 }];
  const s = sfPartsState({ qty: "100", sfParts: parts }, [SH]);
  assert.equal(s.changed, false);
  assert.deepEqual(s.drift, { auto: 88, have: 100 });
});

test("sfPartsState: a reconfigured shower refreshes the live total", () => {
  const parts = [{ kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: 80 }];
  const s = sfPartsState({ qty: "80", sfParts: parts }, [SH]);
  assert.equal(s.changed, true);
  assert.deepEqual(s.drift, { auto: 88, have: 80 });
  assert.equal(s.fresh[0].sf, 88);
});

test("sfPartsState: in step → no drift", () => {
  const parts = [{ kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: 88 }, { kind: "extra", label: "Hall", sf: 45 }];
  assert.equal(sfPartsState({ qty: "133", sfParts: parts }, [SH]).drift, null);
});

test("sfPartsState: a removed shower keeps its last sf and is reported gone", () => {
  const parts = [{ kind: "shower", kitId: "gone", piece: "walls", where: "Guest", sf: 64 }];
  const s = sfPartsState({ qty: "64", sfParts: parts }, [SH]);
  assert.equal(s.gone.length, 1);
  assert.equal(s.drift, null);
});

test("sfPartsState: a piece that can no longer be measured keeps its saved sf", () => {
  const sh = { ...SH, pieces: [{ piece: "walls", label: "Walls", sf: null }] };
  const parts = [{ kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: 88 }];
  assert.equal(sfPartsState({ qty: "88", sfParts: parts }, [sh]).drift, null);
});

test("sfPartsState: a ticked piece the shower no longer has is dropped, its sf still counted", () => {
  const parts = [
    { kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: 88 },
    { kind: "shower", kitId: "k1", piece: "curb", where: "Master Bath", sf: 6.1 },
    { kind: "extra", label: "Hall", sf: 45 },
  ];
  const s = sfPartsState({ qty: "139.1", sfParts: parts }, [SH]);
  assert.deepEqual(s.dropped, [parts[1]]);
  assert.deepEqual(s.gone, []);
  assert.equal(s.fresh[1].sf, 6.1);
  assert.equal(s.live, 139.1);
  assert.equal(s.drift, null);
});

test("sfPartsState: a piece present with sf null is neither dropped nor drift", () => {
  const sh = { ...SH, pieces: [{ piece: "walls", label: "Walls", sf: null }] };
  const parts = [{ kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: 88 }];
  const s = sfPartsState({ qty: "88", sfParts: parts }, [sh]);
  assert.deepEqual(s.dropped, []);
  assert.equal(s.drift, null);
});

test("sfPartsState: an unmeasured shower keeps every linked piece as saved", () => {
  const sh = { key: "k1", vendor: "wedi", areaName: "Master Bath", size: "", curbed: false, pieces: [], unmeasured: true };
  const parts = [{ kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: 88 }];
  const s = sfPartsState({ qty: "88", sfParts: parts }, [sh]);
  assert.deepEqual(s.dropped, []);
  assert.deepEqual(s.gone, []);
  assert.equal(s.drift, null);
});

test("droppedText names each shower once with its dropped pieces", () => {
  assert.equal(droppedText([
    { kind: "shower", kitId: "k1", piece: "curb", where: "Master Bath", sf: 6.1 },
    { kind: "shower", kitId: "k1", piece: "benchTop", where: "Master Bath", sf: 1 },
    { kind: "shower", kitId: "k2", piece: "niche", where: "", sf: 1 },
  ]), "Master Bath curb, bench top; Shower niche");
});

test("sfPartsText groups a shower's pieces under its area name", () => {
  const parts = [
    { kind: "shower", kitId: "k1", piece: "walls", where: "Master Bath", sf: 72 },
    { kind: "shower", kitId: "k1", piece: "niche", where: "Master Bath", sf: 1 },
    { kind: "extra", label: "Hall", sf: 45 },
    { kind: "extra", label: "Mudroom", sf: 60 },
  ];
  assert.equal(sfPartsText(parts), "Master Bath: walls 72 · niche 1 · Hall 45 · Mudroom 60");
});
