import test from "node:test";
import assert from "node:assert/strict";
import { normOrderItem } from "./orderbook.js";
import { adaptRow, adaptBookRows, mortarItemFrom, MORTAR_BED_SF_PER_BAG } from "./schluteradapter.js";
import { classify } from "./schluter.js";

// The ADR 0032 first deliverable: live registry rows are NOT fixture-shaped.
// Every row here goes through the REAL normOrderItem so the adapter is tested
// against what the stock cache / an order-book fetch actually hands it.

// An ERP stock-export row: the shop's own code in sku, the Schluter
// manufacturer code in vendorSkus, the name in description.
const stockTray = normOrderItem({
  sku: "1509824",
  bookId: "bk_stock",
  description: 'KERDI-SHOWER-TT TRAY 38 X 38 PVC',
  vendorSkus: ["KST965BF"],
  unit: "EA",
  price: 101.14,
  cost: 67.42,
  leadTime: "READY SHIP",
});

// An EFT order-book row: the sku IS the distributor's mfg code, no vendorSkus.
const eftTray = normOrderItem({
  sku: "SLRKSLT1220S",
  bookId: "bk_eft",
  description: "KERDI-SHOWER-LTS TRAY 48 X 48",
  unit: "PC",
  cost: 173.06,
});

// A membrane roll whose coverage lives in the size text, stock-export shaped.
const stockRoll = normOrderItem({
  sku: "1509783",
  bookId: "bk_stock",
  description: "KERDI MEMBRANE ROLL",
  vendorSkus: ["KERDI200/10M"],
  size: "3'3\"×33' = 108 sf",
  unit: "RL",
  price: 207.65,
  cost: 138.43,
});

// A Schluter row that is not a shower part.
const ditra = normOrderItem({
  sku: "1509700",
  bookId: "bk_stock",
  description: "DITRA UNCOUPLING MEMBRANE 175 SF",
  vendorSkus: ["DITRA175M"],
  price: 400,
  cost: 266,
});

test("adaptRow maps a stock-export row: mfg code to sku, shop code to erp, description to name", () => {
  const e = adaptRow(stockTray, { stock: true });
  assert.equal(e.sku, "KST965BF");
  assert.equal(e.erp, "1509824");
  // normOrderItem's cleanDescription title-cases all-caps vendor text — the
  // adapted name is the CLEANED form, which is why buildKit must key on
  // classifier facts, never case-sensitive name regexes (task 2).
  assert.equal(e.name, "Kerdi-Shower-Tt Tray 38 X 38 Pvc");
  assert.equal(e.stock, true);
  assert.equal(e.price, 101.14);
  assert.equal(e.cost, 67.42);
  assert.equal(e.lead, "READY SHIP");
  // and the engine's grammar actually parses the adapted row
  const c = classify(e);
  assert.deepEqual({ g: c.g, w: c.w, d: c.d, drain: c.drain, thin: c.thin },
    { g: "tray", w: 38, d: 38, drain: "point", thin: true });
});

test("adaptRow keeps an EFT row's own mfg sku and stock:false, no erp", () => {
  const e = adaptRow(eftTray, { stock: false });
  assert.equal(e.sku, "SLRKSLT1220S");
  assert.equal(e.erp, "");
  assert.equal(e.stock, false);
  assert.equal(classify(e).drain, "linear");
});

test("adaptRow carries the size text so coverage still derives", () => {
  const e = adaptRow(stockRoll, { stock: true });
  assert.equal(classify(e).sf, 108);
});

test("adaptRow returns null for a row no code classifies", () => {
  assert.equal(adaptRow(ditra, { stock: true }), null);
});

test("adaptBookRows maps and drops the nulls", () => {
  const out = adaptBookRows([stockTray, ditra, stockRoll], { stock: true });
  assert.deepEqual(out.map((e) => e.sku), ["KST965BF", "KERDI200/10M"]);
  assert.equal(out.every((e) => e.stock === true), true);
});

test("mortarItemFrom maps a Settings mortars entry into cfg.mortarItem", () => {
  const mortars = { "Schluter All Set": { tier1: 95, tier2: 70, tier3: 45, unit: "bags", price: 39.21 } };
  const m = mortarItemFrom("Schluter All Set", mortars);
  assert.deepEqual(m, {
    name: "Schluter All Set", price: 39.21, cost: 39.21, stock: true,
    sfPerBagAt15: MORTAR_BED_SF_PER_BAG,
  });
  assert.equal(MORTAR_BED_SF_PER_BAG, 8);
  assert.equal(mortarItemFrom("Nope", mortars), null);
  assert.equal(mortarItemFrom("", mortars), null);
});
