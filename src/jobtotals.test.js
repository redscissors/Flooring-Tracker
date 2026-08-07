import test from "node:test";
import assert from "node:assert/strict";
import { jobTotals } from "./jobtotals.js";
import { normC } from "./model.js";
import { normalizeSettings, withProjWaste } from "./catalog.js";
import { scopedCats, bucketCats } from "./options.js";

// Real catalog product names (not made-up ones): mergeSettings only merges
// custom grout/mortar prices onto the fixed GROUTS/MORTARS vocabulary, so a
// name outside it (e.g. "Frost") is silently dropped and prices at $0.
const settings = normalizeSettings({
  grouts: { "PermaColor Select": { unit: "units", price: 18.95, coverage: 100 } },
  mortars: { "ProLite": { unit: "bags", price: 18.95, coverage: 60 } },
});
const tile = (qty, over = {}) => ({ type: "tile", brandColor: "T", L: "12", W: "12", thickness: "0.375", qtyType: "sqft", qty: String(qty), priceSqft: "2.00", grout: { checked: true, product: "PermaColor Select", joint: 0.125 }, mortar: { checked: true, product: "ProLite" }, ...over });
const proj = normC({ id: "j1", name: "J", waste: { tile: 10, floor: 5, tileOn: false, floorOn: false }, categories: [
  { name: "Shared", option: "", products: [tile(100)] },
  { name: "Bath A", option: "A", products: [tile(50)] },
  { name: "Bath B", option: "B", products: [tile(50, { priceSqft: "10.00" })] },
] });
const wSet = withProjWaste(settings, proj);
const totals = (cats) => jobTotals({ ...proj, categories: cats }, { ...proj, categories: cats }, wSet, wSet, settings, []);

test("all-scope totals match hand math and consolidate materials", () => {
  const t = totals(proj.categories);
  assert.equal(t.totalSqft, 200);
  assert.equal(t.flooringPrice, 100 * 2 + 50 * 2 + 50 * 10);
  assert.equal(t.gList.length, 1); // one grout product+color across all areas
  assert.equal(t.mList.length, 1);
  assert.ok(t.grandTotal > t.flooringPrice);
});

test("buckets consolidate within themselves; whole-job is additive", () => {
  const shared = totals(bucketCats(proj.categories, "shared"));
  const optA = totals(bucketCats(proj.categories, "A"));
  assert.equal(shared.totalSqft, 100);
  assert.equal(optA.totalSqft, 50);
  const whole = shared.grandTotal + optA.grandTotal;
  assert.ok(whole > 0);
  // union consolidation may save a rounding unit vs the additive figure
  const union = totals(scopedCats(proj.categories, "A"));
  assert.ok(union.grandTotal <= whole);
});

test("empty scope returns zeros, not NaN", () => {
  const t = totals([]);
  assert.equal(t.grandTotal, 0);
  assert.deepEqual(t.matLines, []);
});

// A minimal freight program (see freight.js normFreight / freight.test.js's
// GLAZZIO fixture): a shared area and an option-A area both carry rows from
// the same freight-program book. Freight is order-scoped (one minimum per
// vendor per ORDER, ADR 0030) — the union run must charge that vendor once,
// not once per bucket (Fix 2, ADR 0031).
const FREIGHT_BOOK = { id: "fv1", name: "Freighted Vendor", kind: "order", data: { freight: {
  mode: "program", destination: "OH", palletSf: 500, perSqft: 1, minCharge: 50,
  palletAt: 0, palletRate: 0, largeRate: 0, largeAtSqin: 200, largeSeries: "",
  smallSeries: "", perPiece: 0, pieceMin: 0, effective: "2026",
} } };
const fproj = normC({ id: "j2", name: "J2", waste: { tile: 10, floor: 5, tileOn: false, floorOn: false }, categories: [
  { name: "Shared", option: "", products: [tile(10, { bookId: "fv1" })] },
  { name: "Bath A", option: "A", products: [tile(10, { bookId: "fv1" })] },
] });
const fwSet = withProjWaste(settings, fproj);
const ftotals = (cats) => jobTotals({ ...fproj, categories: cats }, { ...fproj, categories: cats }, fwSet, fwSet, settings, [FREIGHT_BOOK]);

test("freight consolidates over the union: one line per book, no double-minimum", () => {
  const shared = ftotals(bucketCats(fproj.categories, "shared"));
  const bucketA = ftotals(bucketCats(fproj.categories, "A"));
  const union = ftotals(scopedCats(fproj.categories, "A"));
  // Each bucket independently trips the vendor's $50 minimum (10 sf × $1 < $50).
  assert.equal(shared.freightCost, 50);
  assert.equal(bucketA.freightCost, 50);
  assert.equal(union.fList.length, 1);
  assert.ok(union.freightCost <= shared.freightCost + bucketA.freightCost);
  // Strictly less: the union's 20 sf still only trips the minimum once.
  assert.ok(union.freightCost < shared.freightCost + bucketA.freightCost);
});
