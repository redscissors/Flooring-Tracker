import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normOrderItem, normBookItem, bookItemData, costSqft, resolveMarkup, sellPrice,
  pricedItem, orderPatch, orderDrift, mergeSearch, markupGroups, diffBookItems,
} from "./orderbook.js";

// A normalized order item, overridable per field.
const oi = (over = {}) => normOrderItem({ sku: "ABC12345", cost: 10, unit: "SF", ...over });

// --- normalization -----------------------------------------------------------

test("normOrderItem defaults every field and never stores a selling price", () => {
  const it = normOrderItem({ sku: "X1" });
  assert.equal(it.sku, "X1");
  assert.equal(it.active, true);
  assert.equal(it.price, null);      // order items store cost, never sell
  assert.equal(it.priceSqft, null);
  assert.equal(it.cost, null);
  assert.equal(it.freightFlag, false);
  assert.equal(it.tierPrices, null);
});

test("normBookItem reads the book_id/active/updated_at columns and the data blob", () => {
  const it = normBookItem({ sku: "V9", active: false, updated_at: "2026-07-12T00:00:00Z", data: { cost: 4.5, mfg: "CER", freightFlag: true } }, "book_1");
  assert.equal(it.bookId, "book_1");
  assert.equal(it.active, false);
  assert.equal(it.cost, 4.5);
  assert.equal(it.mfg, "CER");
  assert.equal(it.freightFlag, true);
  assert.ok(it.updatedAt > 0);
});

test("bookItemData strips the column-backed fields before a write", () => {
  const data = bookItemData(oi({ mfg: "FLO" }));
  assert.equal("sku" in data, false);
  assert.equal("bookId" in data, false);
  assert.equal("active" in data, false);
  assert.equal(data.mfg, "FLO");
  assert.equal(data.cost, 10);
});

// --- cost per sqft -----------------------------------------------------------

test("costSqft: as-is when priced by the square foot", () => {
  assert.equal(costSqft(oi({ unit: "SF", cost: 8 })), 8);
});

test("costSqft: derived from a carton cost and its SF/CT coverage", () => {
  assert.equal(costSqft(oi({ unit: "CT", cost: 200, sfPerUnit: 20 })), 10);
});

test("costSqft: null for a count/flat item with no coverage", () => {
  assert.equal(costSqft(oi({ unit: "EA", cost: 15, sfPerUnit: null })), null);
});

// --- markup resolution -------------------------------------------------------

test("resolveMarkup: a per-group override outranks the book default", () => {
  const markups = { groupBy: "mfg", default: 45, byGroup: { CER: 60, FLO: 40 } };
  assert.equal(resolveMarkup(markups, oi({ mfg: "CER" })), 60);
  assert.equal(resolveMarkup(markups, oi({ mfg: "FLO" })), 40);
});

test("resolveMarkup: an unmapped group quietly uses the default", () => {
  const markups = { groupBy: "mfg", default: 45, byGroup: { CER: 60 } };
  assert.equal(resolveMarkup(markups, oi({ mfg: "ADX" })), 45);
  assert.equal(resolveMarkup({ default: 30 }, oi({})), 30);
  assert.equal(resolveMarkup(null, oi({})), 0);
});

test("sellPrice rounds cost × (1 + pct/100) to cents", () => {
  assert.equal(sellPrice(10, 45), 14.5);
  assert.equal(sellPrice(2.1, 40), 2.94);
  assert.equal(sellPrice(null, 40), null);
});

// --- priced (stock-shaped) item ----------------------------------------------

test("pricedItem fills price/priceSqft from cost × markup", () => {
  const p = pricedItem(oi({ unit: "SF", cost: 8 }), { default: 25 });
  assert.equal(p.markupPct, 25);
  assert.equal(p.price, 10);
  assert.equal(p.priceSqft, 10);
});

test("pricedItem: a stock-kind item (no cost) passes through with its own price", () => {
  const p = pricedItem(normOrderItem({ sku: "S1", cost: null }), { default: 25 });
  assert.equal(p.price, null); // no cost to mark up
  assert.equal(p.markupPct, 25);
});

// --- pick snapshot -----------------------------------------------------------

const book = (over = {}) => ({ id: "vtc", data: { markups: { default: 25 }, ...over } });

test("orderPatch snapshots the sell price plus order-book provenance (tile)", () => {
  const item = oi({ sku: "TILE0001", type: "tile", unit: "SF", cost: 8, size: "12x24", mfg: "CER", freightFlag: true, tierPrices: { contractor: 9.2 } });
  const patch = orderPatch(item, book(), {});
  assert.equal(patch.sku, "TILE0001");
  assert.equal(patch.type, "tile");
  assert.equal(patch.L, "12");
  assert.equal(patch.W, "24");
  assert.equal(patch.priceSqft, "10");       // 8 × 1.25 — the selling price
  assert.equal(patch.bookId, "vtc");
  assert.equal(patch.cost, "8");             // internal, along for the ride
  assert.equal(patch.markupPct, "25");
  assert.equal(patch.freightFlag, true);
  assert.equal(patch.tierPrice, "9.2");      // snapshotted regardless of any toggle
});

test("orderPatch: a carton-priced order item bills in whole cartons", () => {
  const item = oi({ sku: "HW01", type: "hardwood", unit: "CT", cost: 200, sfPerUnit: 20 });
  const patch = orderPatch(item, book(), {});
  assert.equal(patch.cartonSf, "20");
  assert.equal(patch.cartonUnit, "CT");
  assert.equal(patch.priceSqft, "12.5");     // (200/20) × 1.25
});

test("orderPatch: a typeless item lands as a flat Miscellaneous line", () => {
  const item = oi({ sku: "ACC9", type: null, unit: "EA", cost: 15 });
  const patch = orderPatch(item, book(), {});
  assert.equal(patch.type, "misc");
  assert.equal(patch.priceSqft, "18.75");    // 15 × 1.25, flat
  assert.equal(patch.cost, "15");
});

// --- drift (the snapshot doctrine for markups) -------------------------------

test("orderDrift: a later markup change surfaces as drift but never rewrites the row", () => {
  const item = oi({ sku: "T1", type: "tile", unit: "SF", cost: 8, size: "12x24" });
  // Salesperson picked at 25% → row snapshotted 10.00.
  const row = orderPatch(item, book({ markups: { default: 25 } }), {});
  assert.equal(row.priceSqft, "10");
  // Book markup is later raised to 45%. The row is untouched; drift reports it.
  const drift = orderDrift(item, book({ markups: { default: 45 } }), row);
  assert.equal(row.priceSqft, "10");         // snapshot unchanged
  assert.deepEqual(drift, { from: 10, to: 11.6, markup: { from: 25, to: 45 } });
});

test("orderDrift: a vendor cost change is reported with its movement detail", () => {
  const row = { priceSqft: "10", cost: "8", markupPct: "25" };
  const item = oi({ sku: "T1", type: "tile", unit: "SF", cost: 8.8, size: "12x24" });
  const drift = orderDrift(item, book({ markups: { default: 25 } }), row);
  assert.equal(drift.to, 11);                // 8.8 × 1.25
  assert.deepEqual(drift.cost, { from: 8, to: 8.8 });
});

test("orderDrift: null when the snapshot still matches today's sell", () => {
  const item = oi({ sku: "T1", type: "tile", unit: "SF", cost: 8, size: "12x24" });
  const row = { priceSqft: "10", cost: "8", markupPct: "25" };
  assert.equal(orderDrift(item, book({ markups: { default: 25 } }), row), null);
});

// --- search collision (stock outranks order) ---------------------------------

test("mergeSearch: an exact-SKU order twin is dropped and the stock match tagged", () => {
  const stock = [{ sku: "1234", description: "Shop tile" }];
  const order = [{ sku: "1234", bookId: "vtc", description: "Vendor tile" }, { sku: "ZZ9", bookId: "vtc" }];
  const { stock: s, order: o } = mergeSearch(stock, order);
  assert.equal(s.length, 1);
  assert.deepEqual(s[0].alsoOn, ["vtc"]);    // "also on vtc" note, not a 2nd row
  assert.equal(o.length, 1);                 // only the non-colliding order item
  assert.equal(o[0].sku, "ZZ9");
});

// --- import diff -------------------------------------------------------------

test("diffBookItems: added / changed (by cost) / missing, mirroring diffStock", () => {
  const existing = [
    normBookItem({ sku: "A1", active: true, data: { cost: 5, description: "Keep" } }, "b"),
    normBookItem({ sku: "B2", active: true, data: { cost: 3, description: "Move" } }, "b"),
    normBookItem({ sku: "C3", active: true, data: { cost: 9, description: "Gone" } }, "b"),
  ];
  const parsed = [
    normOrderItem({ sku: "A1", cost: 5, description: "Keep" }),   // unchanged
    normOrderItem({ sku: "B2", cost: 4, description: "Move" }),   // cost changed
    normOrderItem({ sku: "D4", cost: 1, description: "New" }),    // added
  ];
  const diff = diffBookItems(existing, parsed);
  assert.deepEqual(diff.added.map((i) => i.sku), ["D4"]);
  assert.deepEqual(diff.changed.map((c) => c.item.sku), ["B2"]);
  assert.deepEqual(diff.changed[0].fields, ["cost"]);
  assert.deepEqual(diff.missing.map((i) => i.sku), ["C3"]); // absent → marked inactive
  assert.deepEqual(diff.unchanged.map((i) => i.sku), ["A1"]);
});

// --- markup editor groups ----------------------------------------------------

test("markupGroups lists the group values present, each with its override or the default", () => {
  const items = [oi({ mfg: "CER" }), oi({ mfg: "CER" }), oi({ mfg: "FLO" }), oi({ mfg: "" })];
  const groups = markupGroups(items, { groupBy: "mfg", default: 45, byGroup: { CER: 60 } });
  assert.equal(groups.length, 2);            // "" skipped; only real groups are priceable
  assert.deepEqual(groups[0], { key: "CER", count: 2, pct: 60, overridden: true });
  assert.deepEqual(groups[1], { key: "FLO", count: 1, pct: 45, overridden: false });
});
