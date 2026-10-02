import { test } from "node:test";
import assert from "node:assert/strict";
import { sizeOf, sizeDistance, rankParts, nearest, matchQty } from "./comparemirror.js";

const W = (slot, item, cov = null) => ({ brand: "wedi", slot, item, cov, id: item.key, retail: item.retail || 0 });
const S = (slot, item, cov = null) => ({ brand: "schluter", slot, item, cov, id: item.sku, retail: item.price || 0 });

test("niche: wedi reads the interior off the entry, Schluter off the SKU's mm code", () => {
  assert.deepEqual(sizeOf(W("niche", { key: "a", sizeText: '16"x42"', interior: { w: 12, d: 38.25 } })), { w: 12, h: 38.25 });
  assert.deepEqual(sizeOf(S("niche", { sku: "KB12SN305508A1" })), { w: 12, h: 20 });
  assert.equal(sizeOf(S("niche", { sku: "KB12SNLT2WW", name: 'lighted niche 12"×20"' })), null, "no mm code, no size");
  assert.equal(sizeOf(W("niche", { key: "shelf", sizeText: '11 7/8" x 3 1/2" x 3/8"' })), null, "a glass shelf has no opening");
});

test("bench: long side first; a Schluter corner seat is its leg both ways", () => {
  assert.deepEqual(sizeOf(W("bench", { key: "a", group: "bench", w: 18, d: 47 })), { w: 47, d: 18 });
  assert.deepEqual(sizeOf(S("bench", { sku: "KBSB410TA", bench: { corner: true, a: 16 } })), { w: 16, d: 16 });
  assert.deepEqual(sizeOf(S("bench", { sku: "KBSB4101220RA", bench: { d: 16, len: 48 } })), { w: 48, d: 16 });
  assert.equal(sizeOf(S("bench", { sku: "KBSB410", bench: { d: 16 } })), null, "no len, no readable size");
  assert.equal(sizeOf(W("bench", { key: "p", group: "panel", w: 48, d: 96, sf: 32 })), null, "a bench's panel isn't a seat");
});

test("wall board: thickness from thickMm, else the KB mm code, else the name; needs sf coverage", () => {
  assert.deepEqual(sizeOf(S("wallBoard", { sku: "KB1212202440", name: 'KERDI-BOARD 1/2" panel' }, { n: 32, unit: "sf" })), { t: 0.5, sf: 32 });
  assert.deepEqual(sizeOf(S("wallBoard", { sku: "KB506252440", name: "X96 KERDI-BOARD PANEL" }, { n: 16.33, unit: "sf" })), { t: 2, sf: 16.33 });
  assert.deepEqual(sizeOf(S("wallBoard", { sku: "KB0912202440", name: "KERDI-BOARD PANEL" }, { n: 20, unit: "sf" })), { t: 0.375, sf: 20 });
  assert.deepEqual(sizeOf(S("wallBoard", { sku: "KB1212202440", name: 'KERDI-BOARD 48" x 96" x 1/2"' }, { n: 32, unit: "sf" })), { t: 0.5, sf: 32 }, "the code outranks a name that lists sides before thickness");
  assert.deepEqual(sizeOf(S("wallBoard", { sku: "KBXX", thickMm: 19 }, { n: 12, unit: "sf" })), { t: 0.75, sf: 12 });
  assert.deepEqual(sizeOf(W("wallBoard", { key: "p", t: 0.5 }, { n: 15, unit: "sf" })), { t: 0.5, sf: 15 });
  assert.equal(sizeOf(W("wallBoard", { key: "fastener" })), null, "fasteners have no size");
});

test("seam: width in inches (Schluter stores mm), then lf", () => {
  assert.deepEqual(sizeOf(S("seam", { sku: "KEBA100/125", width: "125" }, { n: 98, unit: "lf" })), { w: 5, lf: 98 });
  assert.deepEqual(sizeOf(W("seam", { key: "t", w: 5 }, { n: 82, unit: "lf" })), { w: 5, lf: 82 });
  assert.equal(sizeOf(W("seam", { key: "sealant" })), null);
});

test("slots with no comparable size never size", () => {
  for (const slot of ["drainBody", "grate", "flange", "corners", "setting", "extra"]) {
    assert.equal(sizeOf(W(slot, { key: "x", w: 4, d: 4, len: 4 })), null, slot);
  }
});

test("distance: thickness outranks area on boards, width outranks length on bands", () => {
  assert.ok(sizeDistance("wallBoard", { t: 0.5, sf: 15 }, { t: 0.5, sf: 32 }) < sizeDistance("wallBoard", { t: 0.5, sf: 15 }, { t: 2, sf: 15 }));
  assert.ok(sizeDistance("seam", { w: 5, lf: 98 }, { w: 5, lf: 16 }) < sizeDistance("seam", { w: 5, lf: 98 }, { w: 7.25, lf: 98 }));
  assert.equal(sizeDistance("niche", { w: 12, h: 20 }, { w: 12, h: 18 }), 2);
  assert.equal(sizeDistance("grate", {}, {}), null);
});

test("ranking: nearest first, then stock, then price, then part number; unsized sorts last", () => {
  const host = S("curb", { sku: "C48", len: 48 });
  const parts = [
    W("curb", { key: "full60", len: 60, stock: true, retail: 90 }),
    W("curb", { key: "lean60", len: 60, stock: true, retail: 54 }),
    W("curb", { key: "so60", len: 60, stock: false, retail: 10 }),
    W("curb", { key: "lean96", len: 96, stock: true, retail: 70 }),
    W("curb", { key: "ramp", stock: true, retail: 1 }),
  ].map((p) => ({ ...p, retail: p.item.retail }));
  assert.deepEqual(rankParts(host, parts).map((p) => p.id), ["lean60", "full60", "so60", "lean96", "ramp"]);
  assert.equal(nearest(host, parts).id, "lean60");
  assert.equal(rankParts(host, parts)[4].dist, null);
});

test("nearest is null when nothing sizes, or the host doesn't", () => {
  assert.equal(nearest(S("curb", { sku: "C48", len: 48 }), [W("curb", { key: "ramp" })]), null);
  assert.equal(nearest(S("grate", { sku: "G" }), [W("grate", { key: "c" })]), null);
  assert.equal(nearest(S("curb", { sku: "R" }), [W("curb", { key: "c", len: 60 })]), null);
});

test("a candidate in another slot never auto-matches", () => {
  const host = W("wallBoard", { key: "p", t: 0.5 }, { n: 32, unit: "sf" });
  assert.equal(nearest(host, [S("bench", { sku: "KB1212202440", name: 'KERDI-BOARD 1/2" panel' }, { n: 32, unit: "sf" })]), null);
});

test("qty: coverage for coverage, else the same count", () => {
  assert.equal(matchQty({ cov: { n: 98, unit: "lf" } }, 1, { cov: { n: 82, unit: "lf" } }), 2);
  assert.equal(matchQty({ cov: { n: 15, unit: "sf" } }, 6, { cov: { n: 32, unit: "sf" } }), 3);
  assert.equal(matchQty({ cov: { n: 32, unit: "sf" } }, 2, { cov: { n: 32, unit: "sf" } }), 2);
  assert.equal(matchQty({ cov: null }, 3, { cov: { n: 32, unit: "sf" } }), 3);
  assert.equal(matchQty({ cov: { n: 5, unit: "lf" } }, 1, { cov: { n: 32, unit: "sf" } }), 1, "unlike units count");
});
