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

test("orderEntryRow: a roll line keys in rolls but wears no unit tag — only CT leads", () => {
  // Marcus 2026-08-20: any start other than CT reads as noise at the desk, so
  // the tag is carton-only. The panel's qty/cost/sell still read in rolls.
  const p = { ...newProduct(), type: "misc", qtyType: "count", qty: "3", priceSqft: "84.2", sellUnit: "RL", brandColor: "Schluter Kerdi-Band", sku: "23015" };
  const r = orderEntryRow(p, s, "Master Bath", 0, []);
  assert.equal(r.qty, 3);
  assert.equal(r.unitCode, "RL");
  assert.equal(r.qtyText, "3 RL");
  assert.equal(r.tag, "");
  assert.equal(r.perSell, 84.2);
});

test("orderEntryRow: a carton line still leads with CT — the one keyed-in-bundles unit", () => {
  const p = { ...newProduct(), type: "tile", qty: "100", priceSqft: "5", cartonSf: "12.5", cartonUnit: "CT", sku: "TL-9", brandColor: "Hanoi White" };
  const r = orderEntryRow(p, s, "Kitchen", 0, new Set());
  assert.equal(r.tag, "CT");
  // a sheet-billed line drops its SH start the same as the roll above
  const sh = { ...newProduct(), type: "tile", qty: "20", priceSqft: "22.5", cartonSf: "0.97", cartonUnit: "SH", sku: "MOS-1", brandColor: "Hex Mosaic" };
  assert.equal(orderEntryRow(sh, s, "Kitchen", 0, new Set()).tag, "");
});

// A plain each line is what the panel has always shown — no tag, no change.
test("orderEntryRow: an each line still carries no unit tag", () => {
  const p = { ...newProduct(), type: "misc", qtyType: "count", qty: "2", priceSqft: "18", brandColor: "Trowel" };
  const r = orderEntryRow(p, s, "Master Bath", 0, []);
  assert.equal(r.unitCode, "EA");
  assert.equal(r.tag, "");
});

// A line the salesperson hasn't measured yet still has to reach the order desk:
// the ERP takes no zero-quantity line, and a zero qty also zeroes the per-unit
// cost/sell (they're extended ÷ qty), so the pricing they came to read is blank.
test("orderEntryRow: a quantity-less line keys as 1 and flags it", () => {
  const p = { ...newProduct(), type: "tile", qty: "", priceSqft: "6.5", costSqft: "4", sku: "ANA-1224", brandColor: "Anatolia Marlow", bookId: "bkVTC" };
  const r = orderEntryRow(p, s, "Master Bath", 0, new Set());
  assert.equal(r.qty, 1);
  assert.equal(r.qtyAssumed, true);
  assert.equal(r.qtyText, "1 SF");
  assert.equal(r.perSell, 6.5); // priced per sf, not $0.00
  assert.equal(r.perCost, 4);
});

// The assumed quantity is ONE OF THE SELL UNIT, so a carton-sold row reads per
// carton — the same per-unit it will read once the footage is entered.
test("orderEntryRow: a quantity-less carton line keys as one whole carton", () => {
  const p = { ...newProduct(), type: "tile", qty: "", priceSqft: "5", costSqft: "3", cartonSf: "12", sku: "TL-9", brandColor: "Hanoi White" };
  const r = orderEntryRow(p, s, "Kitchen", 0, new Set());
  assert.equal(r.qty, 1);
  assert.equal(r.qtyAssumed, true);
  assert.equal(r.unitCode, "CT");
  assert.equal(r.perSell, 60); // one 12 sf carton at $5/sf
  assert.equal(r.perCost, 36);
});

// A stock count line is what the desk copies as SKU⇥qty — "SKU 0" is the paste
// the ERP rejected.
test("orderEntryRow: a quantity-less count line keys as 1 in its own sell unit", () => {
  const p = { ...newProduct(), type: "misc", qtyType: "count", qty: "0", priceSqft: "84.2", sellUnit: "RL", sku: "23015", brandColor: "Schluter Kerdi-Band" };
  const r = orderEntryRow(p, s, "Master Bath", 0, new Set());
  assert.equal(r.qty, 1);
  assert.equal(r.qtyAssumed, true);
  assert.equal(r.qtyText, "1 RL");
  assert.equal(r.perSell, 84.2);
});

// A measured row must be untouched — no flag, no invented quantity.
test("orderEntryRow: a line with a quantity is never flagged", () => {
  const p = { ...newProduct(), type: "tile", qty: "240", priceSqft: "6.5", sku: "ANA-1224" };
  const r = orderEntryRow(p, s, "Master Bath", 0, new Set());
  assert.equal(r.qty, 240);
  assert.equal(r.qtyAssumed, false);
  assert.equal(r.perSell, 6.5);
});

test("orderEntryRow: the book's brand label rides the row for the fit ladder", () => {
  const p = { ...newProduct(), type: "tile", qty: "120", priceSqft: "6.5", costSqft: "4", sku: "GLZ-CI28", brandColor: "Glazzio Crystal Ice Blue", bookId: "bkGLZ", L: "2", W: "8" };
  const brands = new Map([["bkGLZ", "Glazzio"]]);
  const full = orderEntryRow(p, s, "Kitchen", 0, new Set(), brands);
  assert.equal(full.brand, "Glazzio");
  assert.ok(full.desc.main.includes("Glazzio Crystal Ice Blue"), "room to spare — the brand stays");
  const tight = orderEntryRow(p, s, "Kitchen", 34, new Set(), brands);
  assert.ok(!tight.desc.main.includes("Glazzio"), "cramped — the brand goes first");
  assert.ok(tight.desc.main.includes("GLZ-CI28"), "the SKU outlives it");
  assert.ok(tight.desc.ext.includes("Glazzio"), "the extended text keeps the whole line");
  // No entry for the row's book → nothing changes.
  assert.equal(orderEntryRow(p, s, "Kitchen", 0, new Set(), new Map()).brand, "");
});
