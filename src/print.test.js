import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSettings } from "./catalog.js";
import { newProduct } from "./model.js";
import { printProduct, orderLineCost, printMatList } from "./print.js";

const s = normalizeSettings();

test("printProduct: a misc count line bills qty × each-price", () => {
  const p = { ...newProduct(), type: "misc", qtyType: "count", qty: "3", priceSqft: "10" };
  const c = printProduct(p, s);
  assert.equal(c.line, 30);
  assert.equal(c.qtyText, "3");
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
