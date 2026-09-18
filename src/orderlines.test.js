import test from "node:test";
import assert from "node:assert/strict";
import { mergeOrderLines, lineGroup, groupOrderLines, sheetBands, compactBands, areaVendorBands } from "./orderlines.js";
import { group as wediGroup } from "./wedi.js";

const stock = (over = {}) => ({
  id: over.id || "p" + Math.random().toString(36).slice(2, 7), special: false, area: "Master bath",
  sku: "47741", name: "5' Wedi Curb Full Foam", qty: 1, qtyAssumed: false, unitCode: "EA", qtyText: "1 EA",
  ...over,
});
const special = (over = {}) => ({
  ...stock({ special: true, sku: "EW03", name: "Daltile Emerson Wood Brazilian Walnut", unitCode: "CT", qty: 14, qtyText: "14 CT", perCost: 38.2, perSell: 61.1, desc: { main: "x", tier: "full" }, copy: "x", ...over }),
});

test("mergeOrderLines: two stock lines with one SKU and unit become one line with the summed quantity", () => {
  const out = mergeOrderLines([stock({ id: "a", area: "Master bath", qty: 1 }), stock({ id: "b", area: "Hall bath", qty: 2 })]);
  assert.equal(out.length, 1);
  const m = out[0];
  assert.equal(m.qty, 3);
  assert.equal(m.qtyText, "3 EA");
  assert.equal(m.sku, "47741");
  assert.deepEqual(m.from.map((f) => [f.area, f.qty]), [["Master bath", 1], ["Hall bath", 2]]);
});

test("mergeOrderLines: the merged id is stable across runs and distinct from the sources", () => {
  const rows = [stock({ id: "a" }), stock({ id: "b" })];
  const [m1] = mergeOrderLines(rows);
  const [m2] = mergeOrderLines(rows);
  assert.equal(m1.id, m2.id);
  assert.notEqual(m1.id, "a");
  assert.notEqual(m1.id, "b");
});

test("mergeOrderLines: a line that stands alone passes through untouched, with no from list", () => {
  const r = stock({ id: "a" });
  const out = mergeOrderLines([r]);
  assert.equal(out[0], r);
  assert.equal(out[0].from, undefined);
});

test("mergeOrderLines: skuKeys spellings merge — a manufacturer form and the shop's SLR twin", () => {
  const out = mergeOrderLines([
    stock({ id: "a", sku: "KST965/810BF", qty: 1 }),
    stock({ id: "b", sku: "SLRKST965810BF", qty: 1 }),
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].qty, 2);
  assert.equal(out[0].sku, "KST965/810BF", "the first line's spelling is what pastes");
});

test("mergeOrderLines: the same SKU in two units never sums — both lines stay and say why", () => {
  const out = mergeOrderLines([stock({ id: "a", unitCode: "CT", qty: 3 }), stock({ id: "b", unitCode: "PC", qty: 5 })]);
  assert.equal(out.length, 2);
  assert.deepEqual(out.map((r) => r.qty), [3, 5]);
  assert.deepEqual(out.map((r) => r.kept), ["unit", "unit"]);
});

test("mergeOrderLines: an assumed 1 is absorbed by a real quantity, not added to it", () => {
  const out = mergeOrderLines([stock({ id: "a", qty: 12 }), stock({ id: "b", area: "Hall bath", qty: 1, qtyAssumed: true })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].qty, 12);
  assert.equal(out[0].qtyAssumed, false);
  assert.deepEqual(out[0].from.map((f) => [f.qty, f.qtyAssumed]), [[12, false], [1, true]]);
});

test("mergeOrderLines: lines that were all assumed merge to one assumed 1", () => {
  const out = mergeOrderLines([stock({ id: "a", qty: 1, qtyAssumed: true }), stock({ id: "b", area: "Hall bath", qty: 1, qtyAssumed: true })]);
  assert.equal(out.length, 1);
  assert.equal(out[0].qty, 1);
  assert.equal(out[0].qtyAssumed, true);
});

test("mergeOrderLines: lines with no SKU never merge (Sheoga by description, freight)", () => {
  const out = mergeOrderLines([
    special({ id: "a", sku: "", byDesc: true, name: "Sheoga White Oak" }),
    special({ id: "b", sku: "", byDesc: true, name: "Sheoga White Oak" }),
    special({ id: "f", sku: "", freight: true, name: "Freight — Daltile" }),
  ]);
  assert.equal(out.length, 3);
  assert.ok(out.every((r) => !r.from && !r.kept));
});

test("mergeOrderLines: special lines merge only when per-unit cost and sell match", () => {
  const same = mergeOrderLines([special({ id: "a", qty: 14 }), special({ id: "b", area: "Hall bath", qty: 9 })]);
  assert.equal(same.length, 1);
  assert.equal(same[0].qty, 23);
  assert.equal(same[0].perSell, 61.1);

  const priced = mergeOrderLines([special({ id: "a", qty: 14 }), special({ id: "b", area: "Kitchen", qty: 6, perSell: 58 })]);
  assert.equal(priced.length, 2);
  assert.deepEqual(priced.map((r) => r.kept), ["price", "price"]);
});

test("mergeOrderLines: a third matching line joins the pair, and a price-split leaves the matching pair merged", () => {
  const out = mergeOrderLines([
    special({ id: "a", area: "Master bath", qty: 14 }),
    special({ id: "b", area: "Kitchen", qty: 6, perSell: 58 }),
    special({ id: "c", area: "Hall bath", qty: 9 }),
  ]);
  assert.equal(out.length, 2);
  const merged = out.find((r) => r.from);
  assert.equal(merged.qty, 23);
  assert.equal(merged.kept, "price");
  assert.equal(out.find((r) => !r.from).kept, "price");
});

test("mergeOrderLines: stock and special lines never merge with each other", () => {
  const out = mergeOrderLines([stock({ id: "a", sku: "EW03", unitCode: "CT" }), special({ id: "b" })]);
  assert.equal(out.length, 2);
});

test("lineGroup: a wedi line files under its catalog group, in the desk's order", () => {
  const pan = wediGroup("pan")[0].key, curb = wediGroup("curb")[0].key, panel = wediGroup("panel")[0].key, ext = wediGroup("extension")[0].key;
  const g = (key) => lineGroup(stock({ wedi: { part: key } }));
  assert.equal(g(pan).label, "wedi · Pans");
  assert.equal(g(curb).label, "wedi · Curbs");
  assert.equal(g(panel).label, "wedi · Building panels");
  assert.equal(g(ext).label, "wedi · Extensions");
  assert.ok(g(pan).order < g(curb).order);
  assert.ok(g(curb).order < g(panel).order, "building panels follow curbs (owner 2026-09-14)");
  assert.ok(g(panel).order < g(ext).order);
  // the anchor row's marker carries the key under `key`, not `part`
  assert.equal(lineGroup(stock({ wedi: { mode: "kit", cfg: {}, key: pan } })).label, "wedi · Pans");
});

test("lineGroup: a Schluter line files by its family, read off the marker's manufacturer code", () => {
  assert.equal(lineGroup(stock({ sku: "1509824", schluter: { part: "KST965BF" } })).label, "Schluter · Trays");
  assert.equal(lineGroup(stock({ sku: "", schluter: { key: "KB12SN12x28", mode: "kit", cfg: {} } })).label, "Schluter · Niches & benches");
  assert.equal(lineGroup(stock({ sku: "KD2FLK", schluter: { part: "KD2FLK" } })).label, "Schluter · Drains");
  // a Schluter code the classifier doesn't know still files under Schluter
  assert.equal(lineGroup(stock({ sku: "A80", schluter: { part: "A80" } })).label, "Schluter");
});

test("lineGroup: book brand, Sheoga, hand-entered, materials and freight each have a home, in that order", () => {
  const brand = lineGroup(stock({ brand: "Ragno" }));
  const sheoga = lineGroup(special({ sheoga: { mode: "floor" } }));
  const other = lineGroup(stock({}));
  const mat = lineGroup({ id: "mat0", sku: "1509901", qty: 4, name: "Ultraflex 2", kind: "Mortar" });
  const freight = lineGroup(special({ freight: true, sku: "" }));
  const wedi = lineGroup(stock({ wedi: { part: wediGroup("pan")[0].key } }));
  const schl = lineGroup(stock({ schluter: { part: "KST965BF" } }));
  assert.equal(brand.label, "Ragno");
  assert.equal(sheoga.label, "Sheoga");
  assert.equal(other.label, "Other items");
  assert.equal(mat.label, "Materials");
  assert.equal(freight.label, "Freight");
  const orders = [wedi, schl, sheoga, brand, other, mat, freight].map((g) => g.order);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
  assert.equal(new Set(orders).size, orders.length);
});

test("groupOrderLines: groups come out in desk order, lines within a group by SKU", () => {
  const pan = wediGroup("pan")[0].key, curb = wediGroup("curb")[0].key;
  const rows = [
    { id: "mat0", sku: "1509901", qty: 4, name: "Ultraflex 2", kind: "Mortar" },
    stock({ id: "r2", sku: "1517411", brand: "Ragno" }),
    stock({ id: "c", sku: "47741", wedi: { part: curb } }),
    stock({ id: "r1", sku: "1517410", brand: "Ragno" }),
    stock({ id: "p", sku: "1518702", wedi: { part: pan } }),
    stock({ id: "h", sku: "05153" }),
  ];
  const groups = groupOrderLines(rows);
  assert.deepEqual(groups.map((g) => g.label), ["wedi · Pans", "wedi · Curbs", "Ragno", "Other items", "Materials"]);
  assert.deepEqual(groups.find((g) => g.label === "Ragno").rows.map((r) => r.id), ["r1", "r2"]);
  assert.equal(groups.flatMap((g) => g.rows).length, rows.length);
});

test("groupOrderLines: two book brands sort alphabetically, and materials keep the print-sheet kind order", () => {
  const rows = [
    stock({ id: "t", brand: "Tarkett" }),
    stock({ id: "g", brand: "Glazzio" }),
    { id: "m1", sku: "1", qty: 1, name: "mortar", kind: "Mortar" },
    { id: "m2", sku: "2", qty: 1, name: "grout", kind: "Grout" },
    { id: "m3", sku: "3", qty: 1, name: "caulk", kind: "Caulk" },
  ];
  const groups = groupOrderLines(rows);
  assert.deepEqual(groups.map((g) => g.label), ["Glazzio", "Tarkett", "Materials"]);
  assert.deepEqual(groups[2].rows.map((r) => r.id), ["m2", "m3", "m1"]);
});

test("sheetBands: consecutive area runs band the sheet-order list; materials and freight get their own bands", () => {
  const rows = [
    stock({ id: "a", area: "Master bath" }),
    stock({ id: "b", area: "Master bath" }),
    stock({ id: "c", area: "Hall bath" }),
    { id: "mat0", sku: "1509901", qty: 4, name: "Ultraflex 2", kind: "Mortar" },
    special({ id: "f", freight: true, sku: "", area: "whole order" }),
  ];
  const bands = sheetBands(rows);
  assert.deepEqual(bands.map((b) => [b.label, b.rows.map((r) => r.id)]), [
    ["Master bath", ["a", "b"]],
    ["Hall bath", ["c"]],
    ["Materials", ["mat0"]],
    ["Freight", ["f"]],
  ]);
});

// --- Compact / Area + vendor views (owner 2026-09-17) -------------------------

const tile = (over = {}) => stock({ type: "tile", sku: "1518929", name: "Glazzio Sarsen Essex Satin", unitCode: "CT", qty: 6, ...over });
const trim = (over = {}) => stock({ type: "misc", sku: "23189", name: "Schluter Jolly Trendline A100TSI", unitCode: "EA", qty: 1, ...over });
const mat = (over = {}) => ({ id: "mat0", sku: "1509901", qty: 4, name: "Ultraflex 2", kind: "Mortar", area: "", ...over });

test("compactBands: one merged run, tile and flooring before trims, then materials and freight", () => {
  const bands = compactBands([
    trim({ id: "j1", area: "Backsplash" }),
    tile({ id: "t1", area: "Backsplash" }),
    mat(),
    trim({ id: "j2", area: "Floor", qty: 2 }),
    stock({ id: "h", type: "hardwood", sku: "99001", name: "Sheoga Hickory", area: "Floor", qty: 12 }),
    special({ id: "f", freight: true, sku: "", area: "whole order" }),
  ]);
  assert.deepEqual(bands.map((b) => b.label), ["All areas", "Materials", "Freight"]);
  const run = bands[0].rows;
  assert.deepEqual(run.map((r) => r.sku), ["99001", "1518929", "23189"], "tile & flooring by numeric SKU, then misc by SKU");
  const jolly = run[2];
  assert.equal(jolly.qty, 3, "the Jolly in two areas is one line");
  assert.deepEqual(jolly.from.map((f) => f.area), ["Backsplash", "Floor"]);
  assert.equal(bands[1].rows[0].id, "mat0");
  assert.equal(bands[2].rows[0].id, "f");
  assert.ok(bands.every((b) => !b.area), "no band styles as an area");
});

test("areaVendorBands: areas in sheet order with tile before trims, merging only inside an area", () => {
  const bands = areaVendorBands([
    trim({ id: "j1", area: "Backsplash" }),
    tile({ id: "t1", area: "Backsplash" }),
    trim({ id: "j1b", area: "Backsplash", qty: 2 }),
    tile({ id: "t2", area: "Floor", sku: "1517410", name: "Ragno Bianco" }),
    trim({ id: "j2", area: "Floor" }),
    mat(),
  ]);
  assert.deepEqual(bands.map((b) => [b.label, !!b.area]), [["Backsplash", true], ["Floor", true], ["Materials", false]]);
  const bs = bands[0].rows;
  assert.deepEqual(bs.map((r) => r.sku), ["1518929", "23189"]);
  assert.equal(bs[1].qty, 3, "the two Backsplash Jollies combine");
  assert.deepEqual(bs[1].from.map((f) => f.id), ["j1", "j1b"]);
  const fl = bands[1].rows;
  assert.deepEqual(fl.map((r) => r.id), ["t2", "j2"], "the Floor Jolly stays its own line in its own area");
  assert.equal(fl[1].from, undefined);
  assert.notEqual(bs[1].id, fl[1].id);
});

test("areaVendorBands: two areas each merging the same SKU get distinct merged ids", () => {
  const bands = areaVendorBands([
    trim({ id: "a1", area: "Backsplash" }), trim({ id: "a2", area: "Backsplash" }),
    trim({ id: "b1", area: "Floor" }), trim({ id: "b2", area: "Floor" }),
  ]);
  const ids = bands.flatMap((b) => b.rows).map((r) => r.id);
  assert.equal(ids.length, 2);
  assert.equal(new Set(ids).size, 2);
});

test("areaVendorBands: configurator wedi and Schluter lines leave their areas for vendor bands below, merged across areas", () => {
  const pan = wediGroup("pan")[0].key, curb = wediGroup("curb")[0].key;
  const bands = areaVendorBands([
    stock({ id: "p1", type: "misc", sku: "1518702", area: "Master bath", wedi: { part: pan } }),
    stock({ id: "c1", type: "misc", sku: "47741", area: "Master bath", wedi: { part: curb } }),
    tile({ id: "t1", area: "Master bath" }),
    stock({ id: "p2", type: "misc", sku: "1518702", area: "Hall bath", wedi: { part: pan } }),
    stock({ id: "n", type: "misc", sku: "1509870", area: "Hall bath", schluter: { part: "KB12SN305711" } }),
    // a Jolly picked from a book is NOT a configurator line — it stays in its area
    trim({ id: "j", area: "Hall bath" }),
    mat(),
    special({ id: "f", freight: true, sku: "", area: "whole order" }),
  ]);
  assert.deepEqual(bands.map((b) => b.label), ["Master bath", "Hall bath", "wedi · Pans", "wedi · Curbs", "Schluter · Niches & benches", "Materials", "Freight"]);
  assert.deepEqual(bands[0].rows.map((r) => r.id), ["t1"]);
  assert.deepEqual(bands[1].rows.map((r) => r.id), ["j"]);
  const pans = bands[2].rows;
  assert.equal(pans.length, 1);
  assert.equal(pans[0].qty, 2);
  assert.deepEqual(pans[0].from.map((f) => f.area), ["Master bath", "Hall bath"]);
  assert.ok(bands.slice(2).every((b) => !b.area));
});

test("areaVendorBands: special-order rows band the same way, and a price-split stays apart inside its area", () => {
  const bands = areaVendorBands([
    special({ id: "a", area: "Kitchen", qty: 14 }),
    special({ id: "b", area: "Kitchen", qty: 6, perSell: 58 }),
    special({ id: "c", area: "Master bath", qty: 9 }),
  ]);
  assert.deepEqual(bands.map((b) => b.label), ["Kitchen", "Master bath"]);
  assert.deepEqual(bands[0].rows.map((r) => r.kept), ["price", "price"]);
  assert.equal(bands[1].rows[0].from, undefined, "no merge across areas");
});
