import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSettings } from "./catalog.js";
import { newProduct } from "./model.js";
import { printProduct } from "./print.js";
import { specSize, specLine, qtyCells, priceCells, COLS, matColumn, lineCells, columnsUsed, needText, gridSpec, jobListGroups, specialCheck, isOneLine, cellParts, loneUnnamedArea } from "./printcols.js";

const s = normalizeSettings();
const mat = (kind, over = {}) => ({ kind, name: `${kind} item`, spec: "", detail: "", exact: 1, order: 1, unit: "units", price: 10, cost: 10, ...over });

test("specSize: tile drops thickness and tightens ×", () => {
  assert.equal(specSize({ type: "tile", L: "12", W: "24", thickness: "0.375", sizeText: "" }), '12"×24"');
  assert.equal(specSize({ type: "tile", sizeText: "12x24", thickness: "0.375" }), "12×24");
  assert.equal(specSize({ type: "misc", sizeText: '48" x 60" x 1/2"' }), '48"×60"×1/2"');
  assert.equal(specSize({ type: "misc", sizeText: "" }), "");
});

test("specLine: size · coverage · SKU, coverage per carton / sheet / piece carton", () => {
  const tile = { ...newProduct(), type: "tile", L: "12", W: "24", thickness: "0.375", qtyType: "sqft", qty: "120", cartonSf: "11.6", cartonUnit: "CT", priceSqft: "10.92", sku: "1504065" };
  assert.equal(specLine(tile, printProduct(tile, s)), '12"×24" · 11.6 SF/ct · SKU 1504065');
  const edge = { ...newProduct(), type: "misc", qtyType: "count", qty: "1", cartonPc: "20", cartonUnit: "CT", sellUnit: "CT", priceSqft: "9.74", sizeText: "0.3x5", sku: "WOW" };
  assert.equal(specLine(edge, printProduct(edge, s)), "0.3×5 · 20 PC/CT · SKU WOW");
});

test("qtyCells/priceCells: carton line shows ct over SF and $/sf over $/ct", () => {
  const tile = { ...newProduct(), type: "tile", L: "12", W: "24", qtyType: "sqft", qty: "120", cartonSf: "11.6", cartonUnit: "CT", priceSqft: "10.92" };
  const c = printProduct(tile, s);
  assert.deepEqual(qtyCells(tile, c), { top: `${c.C.order} ct`, sub: `${Math.round(c.orderedSf * 10) / 10} SF` });
  assert.deepEqual(priceCells(tile, c), { top: "$10.92/sf", sub: `$${(11.6 * 10.92).toFixed(2)}/ct` });
  const trim = { ...newProduct(), type: "misc", qtyType: "count", qty: "4", priceSqft: "22.5" };
  const t = printProduct(trim, s);
  assert.deepEqual(qtyCells(trim, t), { top: "4 ea", sub: "" });
  assert.deepEqual(priceCells(trim, t), { top: "$22.50/ea", sub: "" });
});

test("matColumn: caulk and install items stay out of the columns", () => {
  assert.equal(matColumn(mat("Grout")), "grout");
  assert.equal(matColumn(mat("Mortar")), "mortar");
  assert.equal(matColumn(mat("Tile Backer")), "underlay");
  assert.equal(matColumn(mat("Underlayment")), "underlay");
  assert.equal(matColumn(mat("Sealer", { addon: true })), "other");
  assert.equal(matColumn(mat("Caulk")), null);
  assert.equal(matColumn(mat("Install")), null);
  assert.equal(matColumn(mat("Install materials")), null);
});

test("lineCells: a tile's mortar and its underlayment's install mortar share the Mortar cell", () => {
  const cells = lineCells({ mats: [mat("Grout"), mat("Mortar", { name: "ProLite" }), mat("Mortar", { name: "VersaBond", inline: false }), mat("Caulk"), mat("Tile Backer")] });
  assert.equal(cells.grout.length, 1);
  assert.deepEqual(cells.mortar.map((m) => m.name), ["ProLite", "VersaBond"]);
  assert.equal(cells.underlay.length, 1);
  assert.equal(cells.other.length, 0);
});

test("columnsUsed: only columns some line uses, in COLS order; none → []", () => {
  assert.deepEqual(columnsUsed([{ mats: [mat("Grout"), mat("Caulk")] }, { mats: [] }]).map((c) => c.key), ["grout"]);
  assert.deepEqual(columnsUsed([{ mats: [mat("Tile Backer")] }, { mats: [mat("Grout")] }]).map((c) => c.key), ["grout", "underlay"]);
  assert.deepEqual(columnsUsed([{ mats: [] }, { mats: [mat("Caulk")] }]), []);
  assert.deepEqual(COLS.map((c) => [c.label, c.w]), [["Grout", 102], ["Mortar", 74], ["Underlay", 94], ["Other", 90]]);
});

test("needText: one decimal, singular at 1.0, dash when uncomputed", () => {
  assert.equal(needText(1.62, "kits"), "1.6 kits");
  assert.equal(needText(1.04, "bags"), "1.0 bag");
  assert.equal(needText(0.8, "rolls"), "0.8 rolls");
  assert.equal(needText(0, "kits"), "—");
  assert.equal(needText(1.62, "units"), "1.6 units"); // the catalog's own word, as the print always showed it
  assert.equal(needText(1, "units"), "1.0 unit");
  assert.equal(needText(1.8, "EA"), "1.8 EA");
});

test("gridSpec: unit shows price only, none shows qty only; the material strip is one track", () => {
  const cols = COLS.slice(0, 2);
  const full = gridSpec("full", cols);
  assert.deepEqual(full.money, { qty: true, price: true, total: true });
  assert.equal(full.left, "10px minmax(0,1fr) 34px 50px 58px");
  assert.equal(full.matsW, 176);
  assert.equal(full.outer, "minmax(0,1fr) 176px");
  assert.deepEqual(gridSpec("unit", cols).money, { qty: false, price: true, total: false });
  assert.equal(gridSpec("unit", cols).left, "10px minmax(0,1fr) 50px");
  assert.deepEqual(gridSpec("none", []).money, { qty: true, price: false, total: false });
  assert.equal(gridSpec("none", []).left, "10px minmax(0,1fr) 34px");
  assert.equal(gridSpec("none", []).outer, "minmax(0,1fr)");
});

test("jobListGroups: order, merged Underlay, blank needed for base/caulk/freight", () => {
  const rows = [
    mat("Grout", { name: "SpectraLOCK PRO", spec: "Bright White", exact: 1.62, order: 2, unit: "kits", price: 32.89, cost: 65.78, bookId: "bk" }),
    mat("Grout base", { name: "0.8 Gal Full Unit", exact: 2, order: 2 }),
    mat("Caulk", { name: "SpectraLOCK PRO matching caulk", spec: "Bright White", exact: 1, order: 1, unit: "tubes" }),
    mat("Mortar", { name: "ProLite", exact: 6.4, order: 7, unit: "bags" }),
    mat("Tile Backer", { name: "Ditra", exact: 2.6, order: 3, unit: "rolls" }),
    mat("Underlayment", { name: "Aquabar B", exact: 1.2, order: 2, unit: "EA" }),
    mat("Sealer", { addon: true, name: "Seal-it" }),
    mat("Freight", { name: "Vendor — freight", exact: 0, order: 1 }),
  ];
  const g = jobListGroups(rows);
  assert.deepEqual(g.map((x) => x.label), ["Grout color", "Grout base", "Caulk", "Mortar", "Underlay", "Sealer", "Freight"]);
  assert.equal(g[0].rows[0].name, "SpectraLOCK PRO · Bright White");
  assert.equal(g[0].rows[0].needed, "1.6 kits");
  assert.equal(g[0].rows[0].total, 65.78);
  assert.equal(g[0].rows[0].bookId, "bk");
  assert.equal(g[1].rows[0].needed, "");
  assert.equal(g[2].rows[0].needed, "");
  assert.equal(g[2].rows[0].name, "SpectraLOCK PRO matching caulk · Bright White");
  assert.equal(g[4].rows.length, 2);
  assert.equal(g[6].rows[0].needed, "");
});

test("specialCheck: no ◆ at all until the stock books have loaded", () => {
  const row = { bookId: "bk", sku: "X1" };
  const off = specialCheck(undefined, null);
  assert.equal(off.row(row), false);
  assert.equal(off.mat({ bookId: "bk" }), false);
  const on = specialCheck(new Set(["stock1"]), new Set());
  assert.equal(on.row(row), true);
  assert.equal(on.row({ bookId: "stock1", sku: "X1" }), false);
  assert.equal(on.mat({ bookId: "bk" }), true);
});

test("isOneLine: a line keeps its second line when it has ordered SF or a bundle price", () => {
  const empty = { grout: [], mortar: [], underlay: [], other: [] };
  const cols = COLS.slice(0, 1);
  assert.equal(isOneLine(empty, cols, { top: "4 ea", sub: "" }, { top: "$22.50/ea", sub: "" }), true);
  assert.equal(isOneLine(empty, [], { top: "39 ct", sub: "916.5 SF" }, { top: "$14.98/sf", sub: "$352.03/ct" }), false);
  assert.equal(isOneLine({ ...empty, grout: [mat("Grout")] }, cols, { top: "4 ea", sub: "" }, { top: "", sub: "" }), false);
});

test("cellParts: amount and its unit apart; add-ons carry their label; grout its color · joint", () => {
  assert.deepEqual(cellParts(mat("Sealer", { addon: true, name: "Seal-it", exact: 1.2, unit: "bottles" })), { label: "Sealer", name: "Seal-it", sub: "", qty: "1.2", unit: "bottles" });
  assert.deepEqual(cellParts(mat("Grout", { name: "SpectraLOCK PRO", spec: "Bright White", detail: '1/8" joint', exact: 1.62, unit: "units" })), { label: "", name: "SpectraLOCK PRO", sub: 'Bright White · 1/8"', qty: "1.6", unit: "units" });
  assert.deepEqual(cellParts(mat("Mortar", { name: "ProLite", exact: 1, unit: "bags" })), { label: "", name: "ProLite", sub: "", qty: "1.0", unit: "bag" });
  assert.deepEqual(cellParts(mat("Mortar", { name: "ProLite", exact: 0, unit: "bags" })), { label: "", name: "ProLite", sub: "", qty: "", unit: "" });
});

test("loneUnnamedArea: one printed area that was never named; blank areas don't count", () => {
  const live = { brandColor: "Tile" }, blank = {};
  const area = (name, ...products) => ({ name, products });
  assert.equal(loneUnnamedArea([area("", live, blank)]), true);
  assert.equal(loneUnnamedArea([area("  ", live), area("Hall", blank)]), true);
  assert.equal(loneUnnamedArea([area("Kitchen", live)]), false);
  assert.equal(loneUnnamedArea([area("", live), area("", live)]), false);
  assert.equal(loneUnnamedArea([]), false);
});

test("jobListGroups: freight keeps its note and a whole sq ft count", () => {
  const g = jobListGroups([mat("Freight", { name: "Glazzio — small format", spec: "OH", detail: "order minimum applied", exact: 0, order: 148.37, unit: "sq ft", price: 0.25, cost: 79 })]);
  assert.equal(g[0].rows[0].detail, "order minimum applied");
  assert.equal(g[0].rows[0].order, 148);
  assert.equal(g[0].rows[0].total, 79);
});
