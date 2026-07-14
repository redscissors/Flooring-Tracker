import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normOrderItem, normBookItem, bookItemData, costSqft, resolveMarkup, sellPrice,
  pricedItem, orderPatch, orderDrift, mergeSearch, markupGroups, diffBookItems, editedInDiff,
  bookStaleness, DEFAULT_STALE_DAYS, specialOrderMargin, orderFloorFirst,
} from "./orderbook.js";

const DAY = 86400000;

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

// --- two units: priceUnit (cost basis) + orderUnit (No Broken) ----------------

test("costSqft: reads priceUnit (cost basis) when the two units are split", () => {
  // VTC: Price U/M = SF, No Broken = CT. Cost is per sqft; ordering is by carton.
  assert.equal(costSqft(oi({ unit: "", priceUnit: "SF", orderUnit: "CT", cost: 3.29, sfPerUnit: 15.5 })), 3.29);
});

test("orderPatch: a split SF/CT item prices by the foot and orders in whole cartons", () => {
  const item = oi({ sku: "CER1", type: "tile", priceUnit: "SF", orderUnit: "CT", unit: "", cost: 3.29, sfPerUnit: 15.5, size: "12x24" });
  const patch = orderPatch(item, book(), {});
  assert.equal(patch.cartonSf, "15.5");
  assert.equal(patch.cartonUnit, "CT");            // labeled by the order unit, not the price unit
  assert.equal(patch.priceSqft, "4.11");           // cost basis is SF → 3.29 × 1.25 = 4.11
});

test("orderPatch: a No-Broken PC item orders loose — no whole-carton rounding", () => {
  const item = oi({ sku: "CER2", type: "tile", priceUnit: "SF", orderUnit: "PC", unit: "", cost: 4, sfPerUnit: 16, size: "12x12" });
  const patch = orderPatch(item, book(), {});
  assert.equal(patch.cartonSf, undefined);         // loose pieces → bill exact sqft, no carton coverage
  assert.equal(patch.cartonUnit, undefined);
  assert.equal(patch.qtyType, "sqft");
});

test("orderPatch: single-U/M items are unchanged (fallback to unit)", () => {
  // No priceUnit/orderUnit mapped: both fall back to `unit`, so a plain CT item
  // behaves exactly as before the split.
  const item = oi({ sku: "HW9", type: "hardwood", unit: "CT", cost: 200, sfPerUnit: 20 });
  const patch = orderPatch(item, book(), {});
  assert.equal(patch.cartonSf, "20");
  assert.equal(patch.cartonUnit, "CT");
});

test("orderPatch: snapshots the per-sqft cost (costSqft) so the margin can't drift with the price", () => {
  // Mannington Adura Max: $92.85/carton over 27.39 SF/CT → $3.39/sf cost.
  const item = oi({ sku: "MAX010", type: "vinyl", unit: "BX", cost: 92.85, sfPerUnit: 27.39 });
  const patch = orderPatch(item, book(), {});
  assert.equal(patch.cost, "92.85");     // raw vendor carton cost, for drift
  assert.equal(patch.costSqft, "3.39");  // 92.85 / 27.39, per sell unit
});

test("orderPatch: costSqft reads the split cost basis, and a misc line carries its per-each cost", () => {
  const split = oi({ sku: "CER1", type: "tile", priceUnit: "SF", orderUnit: "CT", unit: "", cost: 3.29, sfPerUnit: 15.5 });
  assert.equal(orderPatch(split, book(), {}).costSqft, "3.29");   // cost basis is SF, not carton
  const misc = oi({ sku: "ACC1", type: null, unit: "EA", cost: 15, sfPerUnit: null });
  assert.equal(orderPatch(misc, book(), {}).costSqft, "15");      // per-each cost for a flat line
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

test("resolveMarkup: a trim line uses the book's trim markup, outranking group + default", () => {
  const markups = { groupBy: "mfg", default: 45, byGroup: { CER: 60 }, trim: 30 };
  assert.equal(resolveMarkup(markups, oi({ trim: true })), 30);        // trim wins over default
  assert.equal(resolveMarkup(markups, oi({ trim: true, mfg: "CER" })), 30); // and over a group override
  assert.equal(resolveMarkup(markups, oi({ trim: false, mfg: "CER" })), 60); // a floor still takes its group
  assert.equal(resolveMarkup(markups, oi({ trim: false })), 45);       // a floor with no group → default
});

test("resolveMarkup: no trim markup set → a trim falls back to the default", () => {
  assert.equal(resolveMarkup({ default: 45 }, oi({ trim: true })), 45);
  assert.equal(resolveMarkup({ default: 45, trim: 0 }, oi({ trim: true })), 0); // an explicit 0% is honored
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

test("normOrderItem carries editedBy/editedAt with legacy-safe defaults", () => {
  const fresh = normOrderItem({ sku: "X1" });
  assert.equal(fresh.editedBy, "");
  assert.equal(fresh.editedAt, null);
  const edited = normOrderItem({ sku: "X1", editedBy: "Marcus", editedAt: 1720000000000 });
  assert.equal(edited.editedBy, "Marcus");
  assert.equal(edited.editedAt, 1720000000000);
});

test("editedInDiff flags only hand-edited items a re-import would overwrite", () => {
  const existing = [
    normBookItem({ sku: "A1", active: true, data: { cost: 5, description: "Hand fix", editedBy: "Marcus", editedAt: 111 } }, "b"), // edited + will change
    normBookItem({ sku: "B2", active: true, data: { cost: 3, editedBy: "Dana", editedAt: 222 } }, "b"),                            // edited but unchanged by import
    normBookItem({ sku: "C3", active: true, data: { cost: 9 } }, "b"),                                                            // changed but never edited
  ];
  const parsed = [
    normOrderItem({ sku: "A1", cost: 6, description: "Hand fix" }), // cost differs → overwrites the edit
    normOrderItem({ sku: "B2", cost: 3 }),                          // identical → no overwrite that matters
    normOrderItem({ sku: "C3", cost: 8 }),                          // changed, but not hand-edited
  ];
  const flagged = editedInDiff(existing, parsed);
  assert.deepEqual(flagged.map((i) => i.sku), ["A1"]);
});

// --- markup editor groups ----------------------------------------------------

test("markupGroups lists the group values present, each with its override or the default", () => {
  const items = [oi({ mfg: "CER" }), oi({ mfg: "CER" }), oi({ mfg: "FLO" }), oi({ mfg: "" })];
  const groups = markupGroups(items, { groupBy: "mfg", default: 45, byGroup: { CER: 60 } });
  assert.equal(groups.length, 2);            // "" skipped; only real groups are priceable
  assert.deepEqual(groups[0], { key: "CER", count: 2, pct: 60, overridden: true });
  assert.deepEqual(groups[1], { key: "FLO", count: 1, pct: 45, overridden: false });
});

// --- book staleness (§8.3) ---------------------------------------------------

test("bookStaleness: a recent import is not stale and reports its age in days", () => {
  const now = 1_000 * DAY;
  const r = bookStaleness(now - 10 * DAY, DEFAULT_STALE_DAYS, now);
  assert.equal(r.days, 10);
  assert.equal(r.stale, false);
  assert.equal(r.threshold, DEFAULT_STALE_DAYS);
});

test("bookStaleness: an import older than the threshold is stale (boundary is inclusive)", () => {
  const now = 1_000 * DAY;
  assert.equal(bookStaleness(now - 119 * DAY, 120, now).stale, false);
  assert.equal(bookStaleness(now - 120 * DAY, 120, now).stale, true);   // exactly at threshold
  assert.equal(bookStaleness(now - 200 * DAY, 120, now).stale, true);
});

test("bookStaleness: a never-imported book has no age and is not flagged stale", () => {
  const now = 1_000 * DAY;
  for (const v of [null, undefined, 0, ""]) {
    const r = bookStaleness(v, 120, now);
    assert.equal(r.days, null);
    assert.equal(r.stale, false);
  }
});

test("bookStaleness: an out-of-range threshold falls back to the default", () => {
  const now = 1_000 * DAY;
  for (const bad of [0, -5, null, undefined, "x"]) {
    assert.equal(bookStaleness(now - 130 * DAY, bad, now).threshold, DEFAULT_STALE_DAYS);
    assert.equal(bookStaleness(now - 130 * DAY, bad, now).stale, true);   // 130 ≥ 120 default
  }
});

// --- internal materials margin (§8.1) ----------------------------------------

test("specialOrderMargin: sell − cost per line, blended margin as % of sell", () => {
  // One line: cost 8/sf × 25% markup → sell 10/sf, 100 sf → $1000 sell.
  const r = specialOrderMargin([{ sell: 1000, markupPct: 25 }]);
  assert.equal(r.sell, 1000);
  assert.equal(r.margin, 200);          // 1000 × 25/125
  assert.equal(r.cost, 800);            // 800 × 1.25 = 1000 ✓
  assert.equal(r.pct, 20);              // margin / sell (gross margin, not the 25% markup)
  assert.equal(r.lines, 1);
});

test("specialOrderMargin: sums multiple lines and blends the percent", () => {
  const r = specialOrderMargin([
    { sell: 1000, markupPct: 25 },      // margin 200
    { sell: 500, markupPct: 40 },       // margin 500 × 40/140 = 142.86
  ]);
  assert.equal(r.sell, 1500);
  assert.equal(r.margin, 342.86);
  assert.equal(r.cost, 1157.14);
  assert.equal(r.pct, 22.9);            // 342.86 / 1500
  assert.equal(r.lines, 2);
});

test("specialOrderMargin: a 0% markup line adds sell but no margin", () => {
  const r = specialOrderMargin([{ sell: 300, markupPct: 0 }]);
  assert.equal(r.sell, 300);
  assert.equal(r.margin, 0);
  assert.equal(r.cost, 300);
  assert.equal(r.pct, 0);
});

test("specialOrderMargin: ignores zero/blank sell lines and handles empty input", () => {
  const r = specialOrderMargin([{ sell: 0, markupPct: 40 }, { sell: "", markupPct: 30 }]);
  assert.deepEqual(r, { sell: 0, cost: 0, margin: 0, pct: 0, lines: 0 });
  assert.deepEqual(specialOrderMargin([]), { sell: 0, cost: 0, margin: 0, pct: 0, lines: 0 });
  assert.deepEqual(specialOrderMargin(undefined), { sell: 0, cost: 0, margin: 0, pct: 0, lines: 0 });
});

test("specialOrderMargin: accepts string sell/markup (row fields are strings)", () => {
  const r = specialOrderMargin([{ sell: "1000", markupPct: "25" }]);
  assert.equal(r.margin, 200);
});

test("specialOrderMargin: a line's snapshotted cost anchors the margin, not the markup", () => {
  // Cost $800; the salesperson discounts the $1000 sell to $900. The cost holds
  // and the margin absorbs the cut — it does NOT keep 25% and push cost to $720.
  const r = specialOrderMargin([{ sell: 900, cost: 800, markupPct: 25 }]);
  assert.equal(r.cost, 800);            // vendor cost is fixed
  assert.equal(r.margin, 100);          // 900 − 800, the shrunk margin
  assert.equal(r.pct, 11.1);            // 100 / 900
});

test("orderFloorFirst: the searched code's floor leads, then its trims", () => {
  // A color-code search returns the floor (exact SKU) plus trims that carry the
  // code in their text. The server may rank a trim first; the floor must lead.
  const res = [
    { sku: "384421", type: null, description: "… — Quarter Round · fits APX020" },
    { sku: "APX020", type: "vinyl", description: "Adura Apex Spalted Wych Elm Dew" },
    { sku: "384469", type: null, description: "… — Reducer · fits APX020" },
  ];
  const out = orderFloorFirst(res, "APX020");
  assert.equal(out[0].sku, "APX020");           // exact-SKU floor first
  assert.deepEqual(out.slice(1).map((i) => i.sku), ["384421", "384469"]); // trims keep server order
});

test("orderFloorFirst: floors outrank trims even with no exact SKU hit", () => {
  const res = [
    { sku: "384470", type: null, description: "Oak Reducer" },
    { sku: "APX999", type: "laminate", description: "Oak plank" },
  ];
  assert.deepEqual(orderFloorFirst(res, "oak").map((i) => i.sku), ["APX999", "384470"]);
});

test("orderFloorFirst: stable and safe on empty/undefined", () => {
  assert.deepEqual(orderFloorFirst([], "x"), []);
  assert.deepEqual(orderFloorFirst(undefined, "x"), []);
});
