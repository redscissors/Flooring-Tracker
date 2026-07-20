import test from "node:test";
import assert from "node:assert/strict";
import { normalizeSettings } from "./catalog.js";
import { newProduct } from "./model.js";
import { printProduct, orderLineCost } from "./print.js";

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
