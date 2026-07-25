import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSettings } from "./catalog.js";
import { newProduct } from "./model.js";
import { printProduct, orderLineCost, printMatList, areaPrintLabel, orderEntryRow } from "./print.js";

const s = normalizeSettings();

test("areaPrintLabel: a named area prints its name alone, unnamed keeps the ordinal", () => {
  assert.equal(areaPrintLabel({ name: "Kitchen" }, 0), "Kitchen");
  assert.equal(areaPrintLabel({ name: "  Master Bath  " }, 4), "Master Bath");
  assert.equal(areaPrintLabel({ name: "" }, 0), "Area 01");
  assert.equal(areaPrintLabel({ name: "   " }, 9), "Area 10");
});

test("printProduct: a misc count line bills qty × each-price", () => {
  const p = { ...newProduct(), type: "misc", qtyType: "count", qty: "3", priceSqft: "10" };
  const c = printProduct(p, s);
  assert.equal(c.line, 30);
  assert.equal(c.qtyText, "3 EA"); // a count line names the unit it's counted in
  assert.equal(c.priceText, "$10.00/ea");
  assert.equal(c.orderedSf, 0);
});

test("printProduct: a plain sqft line is sqft × price with no materials", () => {
  const p = { ...newProduct(), type: "vinyl", qty: "100", priceSqft: "2.5" };
  const c = printProduct(p, s);
  assert.equal(c.line, 250);
  assert.deepEqual(c.mats, []);
});

test("printProduct: a carton line bills whole cartons (ADR 0013)", () => {
  const p = { ...newProduct(), type: "hardwood", qty: "100", priceSqft: "5", cartonSf: "23" };
  const c = printProduct(p, s);
  assert.equal(c.C.order, Math.ceil((100 * (1 + s.waste.floor / 100)) / 23));
  assert.equal(c.line, c.C.order * 23 * 5);
});

test("printMatList: a grout with no footage still lists its base, ordering nothing", () => {
  const s2 = normalizeSettings({
    catalog: { companies: [{ name: "Laticrete", enabled: true, mortars: [], underlayments: [], grouts: [
      { name: "Spectralock Part C", coverage: 90, unit: "kits", price: 32.89, base: { sku: "1518984", name: "SpectraLock Comm. Unit", unit: "units", price: 374.99, per: 4 } },
    ] }] },
  });
  const p = { ...newProduct(), type: "tile", qty: "", grout: { ...newProduct().grout, checked: true, product: "Spectralock Part C", color: "Silver" } };
  const rows = printMatList({ categories: [{ id: "a", name: "Kitchen", products: [p] }] }, s2);
  const grout = rows.find((r) => r.kind === "Grout");
  assert.equal(grout.order, 0);
  const base = rows.find((r) => r.kind === "Grout base");
  assert.equal(base.name, "SpectraLock Comm. Unit");
  assert.equal(base.order, 0);
  assert.equal(base.cost, 0);

  // With footage the pair computes normally: 200 sf / 90 coverage -> 3 kits, 1 base.
  const rows2 = printMatList({ categories: [{ id: "a", name: "Kitchen", products: [{ ...p, qty: "200", L: "12", W: "12" }] }] }, s2);
  assert.equal(rows2.find((r) => r.kind === "Grout").order, 3);
  assert.equal(rows2.find((r) => r.kind === "Grout base").order, 1);
});

test("orderLineCost: snapshotted costSqft rides the same quantity math as sell", () => {
  const p = { ...newProduct(), type: "vinyl", qty: "100", priceSqft: "4", costSqft: "2" };
  const sell = printProduct(p, s).line;
  assert.equal(orderLineCost(p, s, sell), 200);
});

test("orderLineCost: pre-costSqft rows derive cost from the markup", () => {
  const p = { ...newProduct(), type: "vinyl", qty: "10", priceSqft: "13", markupPct: "30" };
  const sell = printProduct(p, s).line;
  assert.ok(Math.abs(orderLineCost(p, s, sell) - sell / 1.3) < 1e-9);
});

// --- sell units (2026-07-25) --------------------------------------------------

// The print's price column always names the unit its number is quoted in, so a
// $84.20 line can't be read as $84.20 a foot.
test("printProduct: the price unit is SF for area lines, the row's own unit for counted ones", () => {
  const area = { ...newProduct(), type: "vinyl", qty: "100", priceSqft: "2.5" };
  assert.equal(printProduct(area, s).priceUnit, "SF");
  assert.equal(printProduct(area, s).priceText, "$2.50/sf");

  const roll = { ...newProduct(), type: "misc", qtyType: "count", qty: "3", priceSqft: "84.2", sellUnit: "RL" };
  const c = printProduct(roll, s);
  assert.equal(c.priceUnit, "RL");
  assert.equal(c.countUnit, "RL");
  assert.equal(c.qtyText, "3 RL");
  assert.equal(c.priceText, "$84.20/rl");
  assert.ok(Math.abs(c.line - 252.6) < 1e-9); // still qty × price — only the label changed
});

// A carton/roll-billed area line keeps SF as its price unit; the per-bundle
// price the layouts show beside it is coverage × that.
test("printProduct: a roll-billed floor prices per SF and orders in whole rolls", () => {
  const p = { ...newProduct(), type: "vinyl", qty: "300", priceSqft: "3", cartonSf: "240", cartonUnit: "RL" };
  const c = printProduct(p, s);
  assert.equal(c.priceUnit, "SF");
  assert.equal(c.C.unit, "rl");
  assert.equal(c.C.order, 2); // 300 sf + waste over a 240 sf roll → 2 rolls
  assert.equal(c.qtyText, "2 rl");
});

test("orderEntryRow: a roll line is keyed and tagged in rolls", () => {
  const p = { ...newProduct(), type: "misc", qtyType: "count", qty: "3", priceSqft: "84.2", sellUnit: "RL", brandColor: "Schluter Kerdi-Band", sku: "23015" };
  const r = orderEntryRow(p, s, "Master Bath", 0, []);
  assert.equal(r.qty, 3);
  assert.equal(r.unitCode, "RL");
  assert.equal(r.qtyText, "3 RL");
  assert.equal(r.tag, "RL"); // the desk can't key this as a plain "each"
  assert.equal(r.perSell, 84.2);
});

// A plain each line is what the panel has always shown — no tag, no change.
test("orderEntryRow: an each line still carries no unit tag", () => {
  const p = { ...newProduct(), type: "misc", qtyType: "count", qty: "2", priceSqft: "18", brandColor: "Trowel" };
  const r = orderEntryRow(p, s, "Master Bath", 0, []);
  assert.equal(r.unitCode, "EA");
  assert.equal(r.tag, "");
});
