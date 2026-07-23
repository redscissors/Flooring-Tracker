import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normOrderItem, normBookItem, bookItemData, costSqft, resolveMarkup, sellPrice,
  pricedItem, orderPatch, orderDrift, mergeSearch, markupGroups, diffBookItems, forceDiff, editedInDiff,
  bookStaleness, DEFAULT_STALE_DAYS, specialOrderMargin, orderFloorFirst, unitComboWarnings,
  itemProblems, supersedePairs, rowAdvisories, importSanityWarnings, classifyTrim, itemFlags,
  flagReviewed, flagReviewBySku, trimsForFloor,
} from "./orderbook.js";

const DAY = 86400000;

// A normalized order item, overridable per field.
const oi = (over = {}) => normOrderItem({ sku: "ABC12345", cost: 10, unit: "SF", ...over });

// --- floor ↔ trim link (ADR 0012 amendment) ----------------------------------

test("fits normalizes from the parser's string or a round-tripped array", () => {
  assert.deepEqual(oi({ fits: "APX040 APX020" }).fits, ["APX020", "APX040"]); // sorted
  assert.deepEqual(oi({ fits: ["APX020", "APX020", " "] }).fits, ["APX020"]); // deduped, blanks dropped
  assert.deepEqual(oi({}).fits, []);
});

test("re-importing an unchanged trim doesn't churn the diff on its fits array", () => {
  const prev = oi({ sku: "384469", trim: true, fits: "APX020 APX040" });
  const same = oi({ sku: "384469", trim: true, fits: "APX040 APX020" });
  assert.equal(diffBookItems([prev], [same]).changed.length, 0);
  const grew = oi({ sku: "384469", trim: true, fits: "APX020 APX040 APX060" });
  assert.deepEqual(diffBookItems([prev], [grew]).changed[0].fields, ["fits"]);
});

// --- forceDiff (force full re-import) -----------------------------------------

test("forceDiff recasts every unchanged row into a changed write, prev resolved", () => {
  const a = oi({ sku: "A1", cost: 10 });
  const b = oi({ sku: "B2", cost: 20 });
  const c = oi({ sku: "C3", cost: 30 });
  const existing = [a, b, c];
  // a changed, b & c re-parsed identically (unchanged bucket).
  const parsed = [oi({ sku: "A1", cost: 11 }), oi({ sku: "B2", cost: 20 }), oi({ sku: "C3", cost: 30 })];
  const diff = diffBookItems(existing, parsed);
  assert.equal(diff.changed.length, 1);
  assert.equal(diff.unchanged.length, 2);

  const forced = forceDiff(diff, existing);
  assert.equal(forced.unchanged.length, 0);
  assert.equal(forced.changed.length, 3); // the real change + the two forced rows
  // added / missing pass through untouched (same array reference).
  assert.equal(forced.added, diff.added);
  assert.equal(forced.missing, diff.missing);
  // Each forced entry is a normal changed shape with prev from existing and no field deltas.
  const forcedB = forced.changed.find((c) => c.item.sku === "B2");
  assert.equal(forcedB.prev, b);
  assert.deepEqual(forcedB.fields, []);
});

test("forceDiff on an all-unchanged diff writes the whole set", () => {
  const existing = [oi({ sku: "A1" }), oi({ sku: "B2" })];
  const parsed = [oi({ sku: "A1" }), oi({ sku: "B2" })];
  const diff = diffBookItems(existing, parsed);
  assert.equal(diff.changed.length, 0);
  assert.equal(diff.unchanged.length, 2);

  const forced = forceDiff(diff, existing);
  assert.equal(forced.changed.length, 2);
  assert.equal(forced.unchanged.length, 0);
  assert.deepEqual(forced.changed.map((c) => c.item.sku).sort(), ["A1", "B2"]);
  assert.deepEqual(forced.changed.map((c) => c.prev.sku).sort(), ["A1", "B2"]);
});

test("trimsForFloor answers the reverse direction, exactly", () => {
  const items = [
    oi({ sku: "384421", trim: true, fits: "APX020" }),
    oi({ sku: "384469", trim: true, fits: "APX020 APX040" }),
    oi({ sku: "384999", trim: true, fits: "APX040" }),
    oi({ sku: "384888", trim: true, fits: "APX020", disabled: true }),
    oi({ sku: "384777", trim: true, fits: "APX020", active: false }),
    oi({ sku: "APX020", trim: false, type: "vinyl" }),   // the floor itself
  ];
  assert.deepEqual(trimsForFloor(items, "APX020").map((i) => i.sku), ["384421", "384469"]);
  // A neighbouring code shares no trims — the fuzzy description search can't say that.
  assert.deepEqual(trimsForFloor(items, "APX02").map((i) => i.sku), []);
  assert.deepEqual(trimsForFloor(items, "").map((i) => i.sku), []);
});

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

// --- per-piece cost basis (VTC trims & mosaics, 2026-07 mispricing fix) --------

test("costSqft: a per-piece cost scales by PC/CT before dividing by the carton's SF/CT", () => {
  // Real VTC row CTIEPLIBN336R: $27.99/pc bullnose, 8 pc per carton, 5.38 sf per
  // carton → $41.62/sqft. The old cost ÷ SF/CT gave $5.20 — 8× underpriced.
  assert.equal(costSqft(oi({ unit: "", priceUnit: "PC", orderUnit: "CT", cost: 27.99, sfPerUnit: 5.38, pcPerUnit: 8 })), 41.6208);
});

test("costSqft: a per-sheet cost scales the same way (mosaic sold by the carton)", () => {
  // Real VTC row EDISAIVMOS22: $21.29/sheet, 9 sheets/ctn, 8.72 sf/ctn.
  assert.equal(costSqft(oi({ unit: "", priceUnit: "SH", orderUnit: "CT", cost: 21.29, sfPerUnit: 8.72, pcPerUnit: 9 })), 21.9736);
});

test("costSqft: piece-priced with coverage but no PC/CT keeps the per-unit read (stock-book mosaics)", () => {
  // Single-U/M books carry sfPerUnit per the priced unit itself — no scaling.
  assert.equal(costSqft(oi({ unit: "SH", cost: 27.99, sfPerUnit: 2 })), 13.995);
});

test("orderPatch: a piece-priced carton-sold trim prices and bills by the real carton", () => {
  const item = oi({ sku: "CTIEPLIBN336R", type: "tile", unit: "", priceUnit: "PC", orderUnit: "CT", cost: 27.99, sfPerUnit: 5.38, pcPerUnit: 8 });
  const patch = orderPatch(item, book(), {});
  assert.equal(patch.priceSqft, "52.03");    // 41.6208 × 1.25
  assert.equal(patch.cartonSf, "5.38");
  assert.equal(patch.cartonUnit, "CT");
  assert.equal(patch.costSqft, "41.62");
  // One carton totals ≈ 8 pieces at the marked-up piece price: 52.03 × 5.38 ≈ 279.9.
});

test("orderPatch: a piece-priced carton-sold trim with NO coverage lands as a per-piece count line with carton rounding", () => {
  // Real VTC row CDSTABABN240R: $56.89/pc bullnose, No Broken = CT, 10 pc/ctn,
  // SF/CT = N/A. Quotes per piece; cartonPc rounds the order to whole cartons
  // (ADR 0013 amendment — the salesperson enters pieces, never cartons).
  const item = oi({ sku: "CDSTABABN240R", type: "tile", unit: "", priceUnit: "PC", orderUnit: "CT", cost: 56.89, pcPerUnit: 10 });
  const patch = orderPatch(item, book(), {});
  assert.equal(patch.type, "misc");
  assert.equal(patch.priceSqft, "71.11");    // 56.89 × 1.25, per PIECE
  assert.equal(patch.cartonPc, "10");        // order rounds up to cartons of 10
  assert.equal(patch.cartonUnit, "CT");
  assert.doesNotMatch(patch.brandColor, /carton of/);  // the row shows the rounding itself
  assert.equal(patch.costSqft, "56.89");     // vendor cost per piece, for the margin
  assert.equal(patch.cost, "56.89");         // raw per-piece cost, for drift
});

test("orderPatch: loose pieces of a cartoned tile still price by the carton's economics", () => {
  // PC-priced, No Broken = PC, but SF/CT + PC/CT are carton figures.
  const item = oi({ sku: "LOOSE1", type: "tile", unit: "", priceUnit: "PC", orderUnit: "PC", cost: 4.5, sfPerUnit: 16, pcPerUnit: 8 });
  const patch = orderPatch(item, book(), {});
  assert.equal(patch.priceSqft, "2.81");     // (4.5 × 8 / 16) × 1.25
  assert.equal(patch.cartonSf, undefined);   // sold loose — no whole-carton rounding
});

test("orderDrift: a count-landed carton line drifts on its per-piece sell", () => {
  const row = { type: "misc", cartonPc: "10", priceSqft: "71.11", cost: "56.89", markupPct: "25" };
  const item = oi({ sku: "CDSTABABN240R", type: "tile", unit: "", priceUnit: "PC", orderUnit: "CT", cost: 60, pcPerUnit: 10 });
  const drift = orderDrift(item, book(), row);
  assert.equal(drift.to, 75);                // 60 × 1.25, per piece
  assert.deepEqual(drift.cost, { from: 56.89, to: 60 });
  // and no false drift when nothing moved
  const same = oi({ sku: "CDSTABABN240R", type: "tile", unit: "", priceUnit: "PC", orderUnit: "CT", cost: 56.89, pcPerUnit: 10 });
  assert.equal(orderDrift(same, book(), row), null);
});

test("orderDrift: frame guard — cross-frame rows report the moved frame, never a price arrow", () => {
  // A trim picked as $/sqft before the classifier: the item now sells per piece.
  const sqftRow = { type: "tile", qtyType: "sqft", priceSqft: "13.32", cost: "23.89" };
  const trim = oi({ sku: "ADXNEBLBASE12EDS", type: null, trim: true, unit: "", priceUnit: "PC", orderUnit: "PC", cost: 23.89, pcPerUnit: 45 });
  assert.deepEqual(orderDrift(trim, book(), sqftRow), { frame: "piece" });
  // A count row saved per-carton (pre-cartonPc): same frame, price basis moved.
  const cartonRow = { type: "misc", priceSqft: "711.1", cost: "56.89" };
  const item = oi({ sku: "CDSTABABN240R", type: "tile", unit: "", priceUnit: "PC", orderUnit: "CT", cost: 56.89, pcPerUnit: 10 });
  assert.deepEqual(orderDrift(item, book(), cartonRow), { frame: "piece" });
});

// --- import-time unit sanity ---------------------------------------------------

test("unitComboWarnings: flags piece-priced carton-sold rows with no PC/CT to convert with", () => {
  const items = [
    oi({ sku: "BN1", unit: "", priceUnit: "PC", orderUnit: "CT", cost: 27.99, pcPerUnit: null }),
    oi({ sku: "BN2", unit: "", priceUnit: "PC", orderUnit: "CT", cost: 14.64, sfPerUnit: 5.38, pcPerUnit: null }),
  ];
  const warns = unitComboWarnings(items);
  assert.equal(warns.length, 1);
  assert.match(warns[0], /^2 rows/);
  assert.match(warns[0], /PC\/CT/);
  assert.match(warns[0], /BN1, BN2/);
});

test("unitComboWarnings: flags rows with no price and unfamiliar sell units", () => {
  const warns = unitComboWarnings([
    oi({ sku: "NOP1", cost: null }),
    oi({ sku: "ODD1", unit: "", priceUnit: "PC", orderUnit: "PA", cost: 9, pcPerUnit: 4 }),
  ]);
  assert.equal(warns.length, 2);
  assert.match(warns.join(" "), /unpriced/);
  assert.match(warns.join(" "), /"PA"/);
});

test("unitComboWarnings: silent for combos the pricing code handles", () => {
  const items = [
    oi({ sku: "OK1", unit: "SF", cost: 3.29, sfPerUnit: 15.5 }),                                              // classic sqft
    oi({ sku: "OK2", unit: "", priceUnit: "PC", orderUnit: "CT", cost: 27.99, sfPerUnit: 5.38, pcPerUnit: 8 }), // Case 1
    oi({ sku: "OK3", unit: "", priceUnit: "PC", orderUnit: "CT", cost: 56.89, pcPerUnit: 10 }),               // Case 2
    oi({ sku: "OK4", unit: "SH", cost: 27.99, sfPerUnit: 2 }),                                                // single-U/M mosaic
    oi({ sku: "OK5", unit: "EA", cost: 15 }),                                                                 // flat accessory
  ];
  assert.deepEqual(unitComboWarnings(items), []);
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
  const row = { type: "tile", priceSqft: "10", cost: "8", markupPct: "25" };
  const item = oi({ sku: "T1", type: "tile", unit: "SF", cost: 8.8, size: "12x24" });
  const drift = orderDrift(item, book({ markups: { default: 25 } }), row);
  assert.equal(drift.to, 11);                // 8.8 × 1.25
  assert.deepEqual(drift.cost, { from: 8, to: 8.8 });
});

test("orderDrift: null when the snapshot still matches today's sell", () => {
  const item = oi({ sku: "T1", type: "tile", unit: "SF", cost: 8, size: "12x24" });
  const row = { type: "tile", priceSqft: "10", cost: "8", markupPct: "25" };
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

// --- disabled switch (importer-upgrades spec, PR A) ----------------------------

test("normBookItem maps the disabled column legacy-safe; bookItemData strips it", () => {
  const off = normBookItem({ sku: "ABC123", active: true, disabled: true, data: { description: "Trim" } }, "book1");
  const legacy = normBookItem({ sku: "ABC124", active: true, data: { description: "Trim" } }, "book1");
  assert.equal(off.disabled, true);
  assert.equal(legacy.disabled, false);
  assert.equal("disabled" in bookItemData(off), false); // the import upsert's jsonb must never carry it
});

// --- itemProblems classifier (import-review spec, PR B) ------------------------

test("itemProblems flags the pricing/unit hazards, and nothing else", () => {
  assert.deepEqual(itemProblems(oi({ type: "tile", priceUnit: "SF", orderUnit: "CT", cost: 3.29, sfPerUnit: 15.5, pcPerUnit: 12 })), []);
  assert.equal(itemProblems(normOrderItem({ sku: "A", priceUnit: "SF" }))[0].code, "no-price");
  assert.equal(itemProblems(oi({ cost: 0 }))[0].code, "zero-price");
  assert.equal(itemProblems(normOrderItem({ sku: "B", priceUnit: "PC", orderUnit: "CT", cost: 27.99 }))[0].code, "no-pc-carton");
  assert.equal(itemProblems(normOrderItem({ sku: "C", priceUnit: "PC", orderUnit: "SF", cost: 4, sfPerUnit: 16 }))[0].code, "pc-sf-mismatch");
  assert.equal(itemProblems(normOrderItem({ sku: "D", priceUnit: "SF", orderUnit: "ROLL", cost: 5 }))[0].code, "unfamiliar-unit");
});

test("an untyped misc line with a clean price is NOT a problem", () => {
  assert.deepEqual(itemProblems(normOrderItem({ sku: "E", priceUnit: "PC", orderUnit: "PC", cost: 14.44, pcPerUnit: 20 })), []);
});

// --- supersedePairs (import-review spec, PR B) ---------------------------------

const bi = (sku, over = {}) => normBookItem({ sku, active: true, disabled: over.disabled, data: { description: over.description || sku } }, "bk");

test("supersedePairs pairs an N-suffixed newcomer with its base in the file", () => {
  const parsed = [normOrderItem({ sku: "123456", description: "Old Oak" }), normOrderItem({ sku: "123456N", description: "New Oak" })];
  const pairs = supersedePairs([], parsed);
  assert.deepEqual(pairs, [{ oldSku: "123456", newSku: "123456N", oldDesc: "Old Oak", newDesc: "New Oak" }]);
});

test("supersedePairs matches a base that only exists in the book already", () => {
  const existing = [bi("789012", { description: "Existing Maple" })];
  const parsed = [normOrderItem({ sku: "789012N", description: "New Maple" })];
  assert.equal(supersedePairs(existing, parsed).length, 1);
  assert.equal(supersedePairs(existing, parsed)[0].oldSku, "789012");
});

test("supersedePairs skips a base that is already disabled, and lone N SKUs with no base", () => {
  const existing = [bi("555", { disabled: true, description: "Off" })];
  assert.deepEqual(supersedePairs(existing, [normOrderItem({ sku: "555N" })]), []);
  assert.deepEqual(supersedePairs([], [normOrderItem({ sku: "PLAN" })]), []);
});

// --- import parse-quality advisories (rowAdvisories / importSanityWarnings) ----

const codes = (over) => rowAdvisories(normOrderItem(over)).map((a) => a.code);

test("rowAdvisories: a clean flooring row is quiet", () => {
  assert.deepEqual(codes({ sku: "A", type: "tile", description: "Crafted White Rounded Edge", size: "0.43x12", priceUnit: "PC", orderUnit: "CT", pcPerUnit: 16, cost: 9.24 }), []);
  assert.deepEqual(codes({ sku: "B", type: "tile", description: "Earth Ash Gray", size: "12x24", priceUnit: "SF", orderUnit: "CT", cost: 3.29, sfPerUnit: 15.5, pcPerUnit: 12 }), []);
});

test("rowAdvisories: leftover-punctuation litter (the original .43X12 mis-split residue)", () => {
  // What the description looked like BEFORE the DIM fix: a lone "." left behind.
  assert.deepEqual(codes({ sku: "C", description: "Crafted White . Rounded Edge" }), ["name-litter"]);
  assert.deepEqual(codes({ sku: "D", description: "Foo ()" }), ["name-litter"]);
  // A legitimate " - " separator is NOT litter.
  assert.deepEqual(codes({ sku: "E", type: "tile", description: "Black - White Mix", size: "12x12", priceUnit: "SF", cost: 4, sfPerUnit: 10 }), []);
});

test("rowAdvisories: a size still sitting in the product name", () => {
  assert.deepEqual(codes({ sku: "F", description: "Ovo 3x12 Glossy" }), ["name-size"]);
  assert.deepEqual(codes({ sku: "G", description: "Casbah Indigo .3x5 Edge" }), ["name-size"]);
});

test("rowAdvisories: a degenerate (empty / one-char) name", () => {
  assert.deepEqual(codes({ sku: "H", description: "" }), ["name-empty"]);
  assert.deepEqual(codes({ sku: "I", description: "•" }), ["name-empty"]);
});

test("rowAdvisories: a trim/molding row priced by the square foot, plus its $/sqft outlier", () => {
  // Real WOW row CASBAH INDIGO EDGE .3X5: $9.24/pc, 10 pc/ctn, 0.15 SF/ctn ⇒
  // ~$616/sqft. It fills flooring (typed + coverage) yet reads as an EDGE.
  const c = codes({ sku: "WOWCSINEDGE", type: "tile", description: "Casbah Indigo Edge", size: "0.3x5", priceUnit: "PC", orderUnit: "CT", pcPerUnit: 10, sfPerUnit: 0.15, cost: 9.24 });
  assert.ok(c.includes("trim-as-area"));
  assert.ok(c.includes("psf-outlier"));
});

test("rowAdvisories: area-below-piece-cost catches a square-footed trim the lexicon misses", () => {
  // Real VTC base-cap ADXNEBLBASE12EDS: $23.89/PC, 45 pc/carton, bogus 121.1
  // SF/CT ⇒ derived cost ~$8.88/sqft, below its own $23.89/pc — priced under
  // water. The English lexicon also flags this one ("Cap").
  const eng = codes({ sku: "ADXNEBLBASE12EDS", type: "tile", description: "Neri Black Base Board End Cap", priceUnit: "PC", orderUnit: "PC", pcPerUnit: 45, sfPerUnit: 121.1, cost: 23.89 });
  assert.ok(eng.includes("area-below-piece-cost"));
  // An Italian trim (angolare = corner) with a notional 10.76 = 1 m² SF/CT.
  // The bilingual lexicon now names it too; the cost inversion corroborates.
  const ita = codes({ sku: "CDSSUSIANGDX", type: "tile", description: "Supreme Silver Angolare Dx", size: "13x48", priceUnit: "PC", orderUnit: "PC", pcPerUnit: 1, sfPerUnit: 10.76, cost: 50 });
  assert.deepEqual(ita, ["trim-as-area", "area-below-piece-cost"]);
  // A lexicon-free name still relies on the inversion alone.
  assert.deepEqual(codes({ sku: "X1", type: "tile", description: "Custom Finishing Piece", size: "13x48", priceUnit: "PC", orderUnit: "PC", pcPerUnit: 1, sfPerUnit: 10.76, cost: 50 }), ["area-below-piece-cost"]);
  // A genuine large tile sold by the square foot never trips it (SF-priced ⇒
  // per-sqft cost equals the sheet price, not below it).
  assert.ok(!codes({ sku: "T", type: "tile", description: "Bristol Brown", size: "12x24", priceUnit: "SF", orderUnit: "CT", sfPerUnit: 15.5, cost: 3.29 }).includes("area-below-piece-cost"));
  // A mosaic sheet (~1 sqft/sheet) is exempt — a marginal inversion there is real
  // square-foot product, not a mispriced trim (the noise the guard removes).
  assert.ok(!codes({ sku: "M", type: "tile", description: "Oslo White 2x2 Mosaic", priceUnit: "PC", orderUnit: "PC", pcPerUnit: 1, sfPerUnit: 1.076, cost: 14.54 }).includes("area-below-piece-cost"));
  assert.ok(!codes({ sku: "M2", type: "tile", description: "Peacock Blue", priceUnit: "SH", orderUnit: "SH", pcPerUnit: 1, sfPerUnit: 1.02, cost: 23.04 }).includes("area-below-piece-cost"));
});

test("importSanityWarnings: aggregates by message with ≤3 sample SKUs", () => {
  const items = [
    normOrderItem({ sku: "L1", description: "Foo . Bar" }),
    normOrderItem({ sku: "L2", description: "Baz . Qux" }),
    normOrderItem({ sku: "L3", description: "One . Two" }),
    normOrderItem({ sku: "L4", description: "Three . Four" }),
  ];
  const w = importSanityWarnings(items);
  assert.equal(w.length, 1);
  assert.match(w[0], /^4 rows with leftover punctuation/);
  assert.match(w[0], /L1, L2, L3, …/);
});

// --- classifyTrim ladder (ADR 0013 amendment: quote frame follows product kind) --

const trimOf = (over) => classifyTrim(normOrderItem({ sku: "T", type: "tile", priceUnit: "PC", orderUnit: "PC", ...over }));

test("classifyTrim: mosaic/sheet guard outranks everything — never a trim", () => {
  // Notional 1 m² SF/CT on a mosaic is real sheet coverage, not fabrication.
  assert.equal(trimOf({ description: "Buildtech White Mosaic", size: "1x1", cost: 14.54, sfPerUnit: 10.76, pcPerUnit: 10 }), null);
  // Sheet units are area product even without a mosaic word.
  assert.equal(trimOf({ description: "Peacock Blue", priceUnit: "SH", orderUnit: "SH", cost: 23.04, sfPerUnit: 10.2, pcPerUnit: 10 }), null);
  // A parsed backing sheet (ADR 0014) is a mosaic whatever the name says.
  assert.equal(trimOf({ description: "Marble Chip", sheetSize: "12x12", cost: 21.79, sfPerUnit: 5.81, pcPerUnit: 6 }), null);
});

test("classifyTrim: bilingual lexicon — catches honest-coverage trims by name", () => {
  // Stair tread with REAL footprint coverage (ratio ≈ 1.06) — only the name says trim (CTIEPLISTAIRTRR).
  assert.equal(trimOf({ description: "Epitome Light St Tread", size: "12x48", orderUnit: "CT", cost: 294.54, sfPerUnit: 8.5, pcPerUnit: 2 }), "lexicon");
  // Italian: gradino (step), angolare (corner) — the words VTC actually writes.
  assert.equal(trimOf({ description: "Supreme Beige Gradino Natural", size: "13x48", cost: 266.19, sfPerUnit: 21.53, pcPerUnit: 2 }), "lexicon");
  assert.equal(trimOf({ description: "Supreme Silver Angolare Dx Natural", size: "13x48", cost: 434.44, sfPerUnit: 10.76, pcPerUnit: 1 }), "lexicon");
  // English end cap (ADXNEBLBASE12EDS).
  assert.equal(trimOf({ description: "Neri Black Base Board End Cap 12 In Satin", cost: 23.89, sfPerUnit: 121.1, pcPerUnit: 45 }), "lexicon");
  // The vendor's "ango" abbreviation of angolo (CTICADAANGODXR).
  assert.equal(trimOf({ description: "Chalmers Ebony Ango Dx Rect", size: "13x48", cost: 452.29, sfPerUnit: 4.31, pcPerUnit: 1 }), "lexicon");
  // Word beats word: a trim word next to a pattern word is a trim — a fascia
  // border strip in a herringbone pattern (CDSPOAVFASSPINA), not a mosaic.
  // Physical sheet evidence still outranks both (see the guard test).
  assert.equal(trimOf({ description: "P.D. Ostuni Avorio Fascia Spina (Herringbone)", size: "12x22", orderUnit: "CT", cost: 27.74, sfPerUnit: 8.88, pcPerUnit: 5 }), "lexicon");
  assert.equal(trimOf({ description: "Water's Edge Mosaic", sheetSize: "12x12", cost: 21.79, sfPerUnit: 5.81, pcPerUnit: 6 }), null, "a parsed backing sheet vetoes even a trim word");
});

test("classifyTrim: geometry-confirmed coverage keeps a genuine loose tile as flooring", () => {
  // Large-format field tile sold per piece: $4.50/pc but each piece covers 2 sqft —
  // cost-inversion would fire, but the size CONFIRMS the coverage (16 = 12x24/144 × 8).
  assert.equal(trimOf({ description: "Earth Ash Gray", size: "12x24", cost: 4.5, sfPerUnit: 16, pcPerUnit: 8 }), null);
});

test("classifyTrim: cost-inversion catches fabricated coverage the lexicon misses", () => {
  // Lexicon-free name, no parseable size, derived $/sqft cost below the piece cost.
  assert.equal(trimOf({ description: "Neri Black Finishing Piece 12 In", cost: 23.89, sfPerUnit: 121.1, pcPerUnit: 45 }), "inversion");
  // Same but geometry MISmatch: 13x48 piece (4.33 sf) with 10.76 stated on 1 pc.
  assert.equal(trimOf({ description: "Custom Deco Dx", size: "13x48", cost: 100, sfPerUnit: 10.76, pcPerUnit: 1 }), "inversion");
});

test("classifyTrim: notional metric SF/CT + geometry mismatch, no inversion needed", () => {
  // 0.5 m² stamped on a carton of twelve 3x6 strips (real: 1.5 sf) — cost stays
  // above water ($8/pc → $17.84/sqft) so inversion can't see it; the 5.38 tell +
  // the size mismatch can.
  assert.equal(trimOf({ description: "Deco Strip Dx", size: "3x6", orderUnit: "CT", cost: 8, sfPerUnit: 5.38, pcPerUnit: 12 }), "notional");
});

test("classifyTrim: out of scope — SF-priced, unpriced, uncovered, untyped rows", () => {
  assert.equal(trimOf({ description: "Neri Black Bullnose", priceUnit: "SF", cost: 11.34, sfPerUnit: 14.5, pcPerUnit: 116 }), null, "SF-priced trims keep today's path (v1)");
  assert.equal(trimOf({ description: "Plain Corner", cost: null, sfPerUnit: 10.76 }), null, "no cost");
  assert.equal(trimOf({ description: "Plain Corner", cost: 12 }), null, "no SF/CT — already a count line");
  assert.equal(classifyTrim(normOrderItem({ sku: "T", type: null, priceUnit: "PC", description: "Corner Piece", cost: 12, sfPerUnit: 10.76 })), null, "untyped is already a count line");
});

// --- itemFlags: the book table's derive-at-render flag chips --------------------

test("itemFlags: hazards and advisories become chips with the full message in tow", () => {
  const noPrice = normOrderItem({ sku: "F1", priceUnit: "SF" });
  const f1 = itemFlags(noPrice);
  assert.equal(f1[0].code, "no-price");
  assert.equal(f1[0].tone, "hazard");
  assert.match(f1[0].msg, /landing unpriced/);
  const trimArea = normOrderItem({ sku: "F2", type: "tile", description: "Casbah Indigo Edge", size: "0.3x5", priceUnit: "PC", orderUnit: "CT", pcPerUnit: 10, sfPerUnit: 0.15, cost: 9.24 });
  const codes = itemFlags(trimArea).map((f) => f.code);
  assert.ok(codes.includes("trim-as-area"));
  assert.ok(itemFlags(trimArea).every((f) => f.tone === "advisory"));
});

test("itemFlags: a reclassified trim carries a per-piece chip naming its signal", () => {
  const it = normOrderItem({ sku: "ADXNEBLBASE12EDS", trim: true, trimSignal: "lexicon", priceUnit: "PC", orderUnit: "PC", cost: 23.89, pcPerUnit: 45, sfPerUnit: 121.1 });
  const f = itemFlags(it).find((x) => x.code === "trim-reclassified");
  assert.ok(f);
  assert.equal(f.label, "per-piece");
  assert.match(f.msg, /named as a trim/i);
});

test("itemFlags: a disabled row explains itself when its N-successor exists", () => {
  const old = normOrderItem({ sku: "123456", description: "Old Oak", disabled: true, priceUnit: "SF", cost: 4 });
  const skus = new Set(["123456", "123456N"]);
  const f = itemFlags(old, skus).find((x) => x.code === "superseded");
  assert.ok(f);
  assert.match(f.msg, /123456N/);
  // No successor in the book → no superseded chip, just the plain disabled state.
  assert.equal(itemFlags(old, new Set(["123456"])).find((x) => x.code === "superseded"), undefined);
});

test("itemFlags: a clean row is chipless", () => {
  const it = normOrderItem({ sku: "OK1", type: "tile", description: "Earth Ash Gray", size: "12x24", priceUnit: "SF", orderUnit: "CT", cost: 3.29, sfPerUnit: 15.5, pcPerUnit: 12 });
  assert.deepEqual(itemFlags(it), []);
});

// --- flag review: confirmed/ignored verdicts survive normalization + mute warnings ---

test("normOrderItem carries flagReview and drops junk states", () => {
  const it = normOrderItem({ sku: "R1", flagReview: {
    "no-price": { state: "confirmed", by: "Sam", at: 5 },
    "zero-price": { state: "ignored" },
    "trim-as-area": { state: "banana" },
    "psf-outlier": "nope",
  } });
  assert.deepEqual(Object.keys(it.flagReview).sort(), ["no-price", "zero-price"]);
  assert.equal(flagReviewed(it, "no-price"), "confirmed");
  assert.equal(flagReviewed(it, "zero-price"), "ignored");
  assert.equal(flagReviewed(it, "trim-as-area"), null);
  // all-junk or absent → null, so the data blob stays lean
  assert.equal(normOrderItem({ sku: "R2", flagReview: { x: { state: "nope" } } }).flagReview, null);
  assert.equal(normOrderItem({ sku: "R3" }).flagReview, null);
});

test("flagReview round-trips through bookItemData (survives an import upsert merge)", () => {
  const it = normOrderItem({ sku: "R4", cost: 3, flagReview: { "no-pc-carton": { state: "ignored", by: "", at: 1 } } });
  const back = normOrderItem({ sku: "R4", ...bookItemData(it) });
  assert.equal(flagReviewed(back, "no-pc-carton"), "ignored");
});

test("itemFlags marks a reviewed code resolved but still derives it", () => {
  const it = normOrderItem({ sku: "R5", priceUnit: "SF", flagReview: { "no-price": { state: "confirmed", by: "Sam", at: 5 } } });
  const f = itemFlags(it).find((x) => x.code === "no-price");
  assert.equal(f.resolved, "confirmed");
  // an unreviewed code stays unresolved
  const raw = itemFlags(normOrderItem({ sku: "R6", priceUnit: "SF" })).find((x) => x.code === "no-price");
  assert.equal(raw.resolved, null);
});

test("unitComboWarnings mutes reviewed codes per SKU, not per file", () => {
  const items = [
    normOrderItem({ sku: "Q1", priceUnit: "SF" }),                    // no price, reviewed
    normOrderItem({ sku: "Q2", priceUnit: "SF" }),                    // no price, NOT reviewed
  ];
  const review = flagReviewBySku([
    normOrderItem({ sku: "Q1", flagReview: { "no-price": { state: "confirmed", by: "", at: 1 } } }),
  ]);
  const warns = unitComboWarnings(items, review);
  assert.equal(warns.length, 1);
  assert.match(warns[0], /^1 row /);
  assert.match(warns[0], /Q2/);
  assert.doesNotMatch(warns[0], /Q1/);
  // a DIFFERENT problem on the reviewed SKU still warns
  const other = [normOrderItem({ sku: "Q1", cost: 0 })]; // zero-price ≠ the reviewed no-price
  assert.equal(unitComboWarnings(other, review).length, 1);
});

test("importSanityWarnings mutes reviewed advisory codes the same way", () => {
  const trimArea = { sku: "Q3", type: "tile", description: "Casbah Indigo Edge", size: "0.3x5", priceUnit: "PC", orderUnit: "CT", pcPerUnit: 10, sfPerUnit: 0.15, cost: 9.24 };
  const codes = rowAdvisories(normOrderItem(trimArea)).map((a) => a.code);
  assert.ok(codes.includes("trim-as-area"));
  const review = flagReviewBySku([normOrderItem({ sku: "Q3", flagReview: Object.fromEntries(codes.map((c) => [c, { state: "ignored", by: "", at: 1 }])) })]);
  assert.deepEqual(importSanityWarnings([normOrderItem(trimArea)], review), []);
  assert.ok(importSanityWarnings([normOrderItem(trimArea)]).length > 0);
});

test("flagReviewBySku maps only the rows that carry a review", () => {
  const m = flagReviewBySku([
    normOrderItem({ sku: "A", flagReview: { "no-price": { state: "ignored", by: "", at: 1 } } }),
    normOrderItem({ sku: "B" }),
  ]);
  assert.equal(m.size, 1);
  assert.ok(m.get("A"));
});

test("pricedItem: an explicit retail price wins over cost × markup (ERP stock exports carry both)", () => {
  const p = pricedItem(normOrderItem({ sku: "1517410", cost: 85.34, price: 141.45, sfPerUnit: 23.76, unit: "CT" }), { default: 45 });
  assert.equal(p.price, 141.45); // the shop's retail, not 85.34 × 1.45
  assert.equal(p.markupPct, 45);
});
