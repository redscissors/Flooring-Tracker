import test from "node:test";
import assert from "node:assert/strict";
import { jobTotals } from "./jobtotals.js";
import { normC } from "./model.js";
import { normalizeSettings, withProjWaste, getMortar, getGrout, ceilQty } from "./catalog.js";
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

test("an underlayment row adds money, never floor area (spec 2026-09-18)", () => {
  const membrane = { type: "underlayment", brandColor: "Schluter Ditra Heat - Membrane Sheet", qtyType: "sqft", qty: "100", priceSqft: "2.56", cartonSf: "8.4", cartonUnit: "SH", grout: { checked: false }, mortar: { checked: false }, underlay: { checked: false } };
  const cats = normC({ id: "j2", name: "J", categories: [{ name: "Bath", option: "", products: [tile(100), membrane] }] }).categories;
  const t = totals(cats);
  assert.equal(t.totalSqft, 100);                       // the tile's floor, measured once
  assert.equal(t.orderedSqft, 100);                     // tile has no carton → its own sq ft
  assert.equal(t.flooringPrice, 100 * 2 + 12 * 8.4 * 2.56);   // ceil(100 ÷ 8.4) = 12 sheets
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

test("gList carries the grout color's source book and the catalog unit cost for order entry", () => {
  const settings2 = normalizeSettings({ grouts: { "PermaColor Select": { unit: "units", price: 18.95, cost: 9.5, coverage: 100 } } });
  const cats = normC({ id: "j2", name: "J", categories: [{ name: "A", option: "", products: [
    tile(100, { grout: { checked: true, product: "PermaColor Select", color: "Raven", sku: "LAT-45", bookId: "lat", joint: 0.125 } }),
    tile(50, { grout: { checked: true, product: "PermaColor Select", color: "Raven", sku: "LAT-45", bookId: "lat", joint: 0.125 } }),
    tile(50, { grout: { checked: true, product: "PermaColor Select", color: "Almond", sku: "PC85", joint: 0.125 } }),
  ] }] }).categories;
  const w2 = withProjWaste(settings2, proj);
  const t = jobTotals({ ...proj, categories: cats }, { ...proj, categories: cats }, w2, w2, settings2, []);
  const raven = t.gList.find((g) => g.color === "Raven"), almond = t.gList.find((g) => g.color === "Almond");
  assert.equal(raven.bookId, "lat");
  assert.equal(almond.bookId, "");
  assert.equal(raven.unitCost, 9.5);
  assert.equal(t.matAll.find((m) => m.kind === "Grout" && /Raven/.test(m.product)).bookId, "lat");
});

test("grout bases follow each row's pick and consolidate per base (ADR 0006 amendment 2026-09-29)", () => {
  const s = normalizeSettings({ grouts: { "SpectraLOCK PRO": { unit: "kits", price: 38.9, coverage: 100,
    base: { sku: "SLP-FULL", name: "Full Unit", unit: "units", price: 62, per: 1 },
    altBases: [{ sku: "SLP-COMM", name: "Commercial Unit", unit: "units", price: 218, per: 4 }] } } });
  const g = (color, base) => ({ checked: true, product: "SpectraLOCK PRO", color, joint: 0.125, base });
  const p = normC({ id: "j2", name: "J", waste: { tile: 10, floor: 5, tileOn: true, floorOn: false }, categories: [
    { name: "Bath", option: "", products: [tile(100, { grout: g("White", "SLP-COMM") }), tile(100, { grout: g("Gray", "SLP-COMM") })] },
  ] });
  const w = withProjWaste(s, p);
  const t = jobTotals(p, p, w, w, s, []);
  assert.equal(t.bList.length, 1);
  assert.equal(t.bList[0].sku, "SLP-COMM");
  assert.equal(t.bList[0].order, 1); // 2 + 2 kits / 4
  assert.equal(t.baseCost, 218);
  assert.ok(t.matAll.some((m) => m.kind === "Grout base" && m.product === "Commercial Unit"));
});

// ADR 0053: two 20 sf rows each need ~0.32 bag of mortar and 0.2 unit of grout —
// one each rounded per row, but one of each for the whole job.
test("materials charge the rounded job order (ADR 0053)", () => {
  const cats = normC({ id: "j3", name: "J", categories: [{ name: "Bath", option: "", products: [tile(20), tile(20)] }] }).categories;
  const [r1, r2] = cats[0].products;
  const m1 = getMortar(r1, wSet).exact, m2 = getMortar(r2, wSet).exact;
  const g1 = getGrout(r1, wSet).exact, g2 = getGrout(r2, wSet).exact;
  assert.equal(Math.ceil(m1) + Math.ceil(m2), ceilQty(m1 + m2) + 1);
  assert.equal(Math.ceil(g1) + Math.ceil(g2), ceilQty(g1 + g2) + 1);
  const t = totals(cats);
  assert.equal(t.mortarCost, ceilQty(m1 + m2) * 18.95);
  assert.equal(t.mList[0].cost, t.mortarCost);
  assert.equal(t.groutCost, ceilQty(g1 + g2) * 18.95);
  assert.equal(t.gList[0].cost, t.groutCost);
});

// The printed job list must add up to the Install materials total — every kind,
// including caulk (a hand-typed per-row count, charged per row).
test("the printed materials list sums to materialsCost", () => {
  const caulked = (price) => tile(40, { grout: { checked: true, product: "PermaColor Select", joint: 0.125, color: "Bright White", caulk: "1", caulkPrice: String(price) } });
  const cats = normC({ id: "j4", name: "J", categories: [{ name: "Bath", option: "", products: [caulked(10), caulked(12), tile(20)] }] }).categories;
  const t = totals(cats);
  const listed = t.pMats.filter((m) => m.kind !== "Freight").reduce((s, m) => s + m.cost, 0);
  assert.equal(Math.round(listed * 100), Math.round(t.materialsCost * 100));
});
