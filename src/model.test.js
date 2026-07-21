import test from "node:test";
import assert from "node:assert/strict";
import { normP, normC, rowBlank, newProduct, newProject, areaLabel, money, catSig } from "./model.js";

test("normP fills every field a grid row reads from a bare object", () => {
  const p = normP({ id: "x" });
  assert.equal(p.type, "tile");
  assert.equal(p.thickness, "0.375");
  assert.equal(p.qtyType, "sqft");
  assert.equal(p.grout.joint, 0.125);
  assert.equal(p.grout.checked, false);
  assert.deepEqual(p.attached, {});
  assert.equal(p.underlay.install, false);
});

test("normP keeps a saved row's snapshot values untouched", () => {
  const saved = { id: "r1", type: "vinyl", sku: "ABC-1", priceSqft: "4.25", cartonSf: "23.5", bookId: "b1", costSqft: "2.10" };
  const p = normP(saved);
  assert.equal(p.sku, "ABC-1");
  assert.equal(p.priceSqft, "4.25");
  assert.equal(p.cartonSf, "23.5");
  assert.equal(p.bookId, "b1");
  assert.equal(p.costSqft, "2.10");
});

test("normP maps the legacy brand/color pair into brandColor", () => {
  assert.equal(normP({ brand: "Daltile", color: "Ash" }).brandColor, "Daltile / Ash");
});

test("normC normalizes areas, versions, tier and waste", () => {
  const c = normC({ id: "c1", categories: [{ products: [{}] }] });
  assert.equal(c.priceTier, "retail");
  assert.equal(c.printPricing, "full");
  assert.equal(c.categories[0].products[0].type, "tile");
  assert.deepEqual(c.versions, []);
  assert.equal(c.waste, null);
});

test("rowBlank: a fresh row is blank, a priced row is not", () => {
  assert.equal(rowBlank(newProduct()), true);
  assert.equal(rowBlank({ ...newProduct(), priceSqft: "3" }), false);
});

test("catSig ignores blank adder rows so autosave doesn't fire on no-ops", () => {
  const area = { id: "a", name: "", note: "", products: [newProduct()] };
  const area2 = { ...area, products: [...area.products, newProduct()] };
  assert.equal(catSig([area]), catSig([area2]));
});

test("newProject seeds the ADR 0018 pricing fields and quick-flag", () => {
  const pr = newProject(null, "Job", { quick: true, seedArea: true });
  assert.equal(pr.priceTier, "retail");
  assert.equal(pr.quick, true);
  assert.equal(pr.categories.length, 1);
});

test("areaLabel falls back to a 1-based index", () => {
  assert.equal(areaLabel({ name: " " }, 0), "Area 1");
  assert.equal(areaLabel({ name: "Kitchen" }, 3), "Kitchen");
});

test("money formats to two decimals", () => {
  assert.equal(money(1234.5), "$1,234.50");
  assert.equal(money(), "$0.00");
});
