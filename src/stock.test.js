import { test } from "node:test";
import assert from "node:assert/strict";
import { searchStock, findStock, parseTileSize, parseThickness, stockPatch, stockDrift, stockCompanionBase, stockBaseVariant, stockBaseCompanion, groutFamilies, groutColorItem, groutCaulkItem, groutSnapshotPatch, deriveSquareDim } from "./stock.js";
import { normOrderItem } from "./orderbook.js";
import { groutExact, mortarExact, mergeSettings, ceilQty } from "./catalog.js";

// Stock-shaped item factory, same DB-row-ish call shape the old workbook
// normalizer took so the cases below read unchanged (column-backed fields
// outrank the data payload, like the real row loaders).
const normStockItem = (row) => normOrderItem({
  ...(row.data || {}),
  sku: row.sku,
  ...(row.active !== undefined ? { active: row.active } : {}),
  ...(row.disabled !== undefined ? { disabled: row.disabled } : {}),
});
const item = (over = {}) => normStockItem({ sku: over.sku || "12345", active: over.active, data: { description: "Test item", price: 10, ...over } });

// --- size / thickness parsing -------------------------------------------------

test("parseTileSize handles the price book's size spellings", () => {
  assert.deepEqual(parseTileSize("12x24"), ["12", "24"]);
  assert.deepEqual(parseTileSize('2x8"'), ["2", "8"]);
  assert.deepEqual(parseTileSize("4X12"), ["4", "12"]);
  assert.deepEqual(parseTileSize("2 x 6"), ["2", "6"]);
  // Glazzio size cells carry a trailing word — the L×W must still fill the size
  // cells instead of being shoved into the color name.
  assert.deepEqual(parseTileSize('4" x 4" Nominal'), ["4", "4"]);
  assert.deepEqual(parseTileSize('8"x9" Hex'), ["8", "9"]);
  assert.equal(parseTileSize("Esagonia"), null);
  assert.equal(parseTileSize('6"'), null);
  assert.equal(parseTileSize('2" Hex'), null); // single dimension, no L×W
  // A leading-decimal width with no leading zero (VTC/Mannington pencil trim)
  // must parse whole — the digit-first pattern used to read ".43" as "43".
  assert.deepEqual(parseTileSize(".43x12"), [".43", "12"]);
  assert.deepEqual(parseTileSize(".3x4.6"), [".3", "4.6"]);
  assert.deepEqual(parseTileSize("0.5x10"), ["0.5", "10"]);
});

test("parseThickness handles fractions, millimeters and decimals", () => {
  assert.equal(parseThickness('3/8"'), "0.375");
  assert.equal(parseThickness("10MM"), "0.3937");
  assert.equal(parseThickness("8.5 MM"), "0.3346");
  assert.equal(parseThickness("0.75"), "0.75");
  assert.equal(parseThickness(""), null);
  assert.equal(parseThickness("thick"), null);
});

// --- filling a product row -----------------------------------------------------

test("a tile stock item snapshots type, size, thickness and $/sqft onto the row", () => {
  const it = normStockItem({ sku: "1518114", data: { type: "tile", unit: "CT", size: "4x15", thickness: '3/8"', description: "Marazzi Terramater Moss", brand: "Marazzi", price: 102.79, priceSqft: 9.9893 } });
  const patch = stockPatch(it, {});
  assert.equal(patch.sku, "1518114");
  assert.equal(patch.type, "tile");
  assert.equal(patch.L, "4");
  assert.equal(patch.W, "15");
  assert.equal(patch.thickness, "0.375");
  assert.equal(patch.priceSqft, "9.99");
  assert.equal(patch.qtyType, "sqft");
  assert.match(patch.brandColor, /Terramater Moss/);
});

test("a hardwood item fills sizeText; brand prefixes when not already in the description", () => {
  const it = normStockItem({ sku: "05068", data: { type: "hardwood", size: '2-1/4"', description: "Clear Red Oak", brand: "Sheoga", price: 94.38, priceSqft: 4.29, sfPerUnit: 22 } });
  const patch = stockPatch(it, {});
  assert.equal(patch.type, "hardwood");
  assert.equal(patch.sizeText, '2-1/4"');
  assert.equal(patch.brandColor, "Sheoga Clear Red Oak");
  assert.equal(patch.priceSqft, "4.29");
  assert.equal(patch.cartonSf, "22"); // SF/CT snapshots as the row's carton size
  assert.equal(patch.cartonUnit, "CT"); // no U/M column on the Hardwood sheet — default
});

test("a mosaic sold by the sheet (only a sheet price) still fills as tile, deriving $/sqft", () => {
  const it = normStockItem({ sku: "1504051", data: { type: "tile", unit: "SH", size: "2x2", description: "Historic Limestone Native", price: 27.99, sfPerUnit: 2 } });
  const patch = stockPatch(it, {});
  assert.equal(patch.type, "tile"); // not demoted to misc
  assert.equal(patch.L, "2");
  assert.equal(patch.W, "2");
  assert.equal(patch.brandColor, "Historic Limestone Native"); // size lands in L/W, not the name
  assert.equal(patch.priceSqft, "14"); // 27.99 / 2 sf per sheet
  assert.equal(patch.cartonSf, "2");
  assert.equal(patch.cartonUnit, "SH");
});

test("a sheet-sold order-book mosaic snapshots per-sheet coverage, not per-carton (SF/CT ÷ PC/CT)", () => {
  // VTC EFT: SF/CT (9.72) is coverage per CARTON; No Broken U/M = SH sells a
  // single sheet, and PC/CT (12) sheets make a carton — so one sheet covers
  // 9.72 / 12 = 0.81 SF, not 9.72. Real row MRZMC57MOSHEX (Moroccan Concrete).
  const item = { sku: "MRZMC57MOSHEX", type: "tile", orderUnit: "SH", priceUnit: "SF", sfPerUnit: 9.72, pcPerUnit: 12, priceSqft: 5.55, size: '1-1/2" Hex' };
  const patch = stockPatch(item, {});
  assert.equal(patch.cartonUnit, "SH");
  assert.equal(patch.cartonSf, "0.81"); // 9.72 ÷ 12 sheets, not the full carton
  assert.equal(patch.priceSqft, "5.55"); // price is per sq ft — unaffected
  // A carton-sold sibling (8" hex, No Broken = CT) keeps full-carton coverage.
  const cart = { sku: "MRZMC57HEX8N", type: "tile", orderUnit: "CT", priceUnit: "SF", sfPerUnit: 9.27, pcPerUnit: 25, priceSqft: 3.43 };
  assert.equal(stockPatch(cart, {}).cartonSf, "9.27");
});

test("a hex tile snapshots the vendor size and derives a square L×W for grout/mortar (ticket 009)", () => {
  const it = normStockItem({ sku: "CLNL270", data: { type: "tile", unit: "CT", size: '2" Hex', description: "Colonial Collection Presidential Grey", price: 10, priceSqft: 5 } });
  const patch = stockPatch(it, {});
  assert.equal(patch.sizeText, '2" Hex');   // vendor string reads on the row
  assert.equal(patch.L, "2");               // background square proxy for the math
  assert.equal(patch.W, "2");
  assert.doesNotMatch(patch.brandColor, /Hex/); // size not shoved into the color name

  // Golden numbers (ticket 009): 2×2 proxy, PermaColor Select cov 110, 1/8"
  // joint, 3/8" thick, 10% waste, 100 sqft → grout exact 6.00 → 6 bags;
  // mortar longest = 2 < 8 → tier1.
  const s = mergeSettings({});
  const p = { type: "tile", qtyType: "sqft", qty: "100", L: patch.L, W: patch.W, thickness: "0.375", grout: { product: "PermaColor Select", joint: 0.125 }, mortar: { product: "ProLite" } };
  assert.ok(Math.abs(groutExact(p, s) - 6) < 1e-6);
  assert.equal(ceilQty(groutExact(p, s)), 6);
  assert.ok(Math.abs(mortarExact(p, s) - 110 / 90) < 1e-6); // tier1 = 90
});

test("deriveSquareDim: the 94\" trim-stick firewall and mosaic/oversize carve-outs (ticket 009)", () => {
  const tile = (over) => normStockItem({ sku: "x", data: { type: "tile", ...over } });
  // Genuine per-chip hex → derives its single dimension.
  assert.equal(deriveSquareDim(tile({ size: '2" Hex' })), 2);
  assert.equal(deriveSquareDim(tile({ size: '1" Penny Round' })), 1);
  // Trim: shape word but sold by the linear foot and reads "Reducer" → no coverage.
  assert.equal(deriveSquareDim(tile({ size: '94" Hex', unit: "LF", description: "Reducer Oak" })), null);
  // Oversize cap: a shape word over 24" is not a small area tile.
  assert.equal(deriveSquareDim(tile({ size: '30" Hex' })), null);
  // Mosaic relaxation (ticket 010 amendment): a shape size is per-chip by
  // construction, so "mosaic" in the text no longer blocks a chip-scale dim…
  assert.equal(deriveSquareDim(tile({ size: '1" Hex', description: "Hex Mosaic Sheet" })), 1);
  assert.equal(deriveSquareDim(tile({ size: '3" Hex', description: 'Art Reflect 3" Hexagon Mosaic Glossy' })), 3);
  // …but a sheet-scale dim on a mosaic still never fakes coverage.
  assert.equal(deriveSquareDim(tile({ size: '12" Hex', description: "Hex Mosaic Sheet" })), null);
  // A piece-sold item WITH sq-ft coverage is a mosaic sheet, not a trim stick —
  // the vendor sells '1" HEX MOSAIC' as PC with SF/PC printed; a real stick
  // (no coverage) stays behind the linear-unit firewall.
  assert.equal(deriveSquareDim(tile({ size: '1" Hex', unit: "PC", sfPerUnit: 24.29, description: "Mosaics Black Hex Mosaic Gloss" })), 1);
  assert.equal(deriveSquareDim(tile({ size: '2" Hex', unit: "EA" })), null);
  // No shape word in the size → no coverage (a bare 6" stays free text).
  assert.equal(deriveSquareDim(tile({ size: '6"' })), null);
  // Not a tile → never derives.
  assert.equal(deriveSquareDim(normStockItem({ sku: "y", data: { type: "hardwood", size: '2" Hex' } })), null);
});

test("deriveSquareDim reads a mixed-fraction chip dimension (ticket 010)", () => {
  const tile = (over) => normStockItem({ sku: "x", data: { type: "tile", ...over } });
  assert.equal(deriveSquareDim(tile({ size: '1-1/2" Hex' })), 1.5);
  assert.equal(deriveSquareDim(tile({ size: '3/4" Penny' })), 0.75);
});

test("a fraction hex chip fills sizeText and the derived square L/W (ticket 010)", () => {
  const it = normStockItem({ sku: "MRZMC50MOSHEX", data: { type: "tile", unit: "SH", size: '1-1/2" Hex', description: "Moroccan Conc Off White Mos", price: 5.55, priceSqft: 5.55, sfPerUnit: 9.72 } });
  const patch = stockPatch(it, {});
  assert.equal(patch.sizeText, '1-1/2" Hex');
  assert.equal(patch.L, "1.5");
  assert.equal(patch.W, "1.5");
});

test("a mosaic sheet shows a labeled sheet size and leaves L×W blank for a hand-entered chip (ADR 0014)", () => {
  // A plain order-shaped item (pcPerUnit lives on order items, not the stock norm).
  const it = { sku: "MLSMBOGHEXM", type: "tile", priceUnit: "PC", orderUnit: "SH", sheetSize: "9x11", pcPerUnit: 10, sfPerUnit: 6.875, description: "Marbles Oniciata Grey Hex Mosaic Matte", price: 29.24 };
  const patch = stockPatch(it, {});
  assert.equal(patch.type, "tile");             // a real square-foot tile, not a count line
  assert.equal(patch.sizeText, "9x11 sheet");   // the sheet reads as the vendor size
  assert.equal(patch.L, undefined);             // L×W blank → the row prompts for the chip size
  assert.equal(patch.W, undefined);
  assert.equal(patch.cartonSf, "0.6875");       // one 9×11 sheet covers 0.6875 sf
  assert.equal(patch.cartonUnit, "SH");
  // $/sqft = per-piece price × PC/CT ÷ SF/CT = 29.24 × 10 ÷ 6.875.
  assert.equal(patch.priceSqft, "42.53");
});

test("a mosaic sheet whose No-Broken unit is spelled PC still orders whole sheets (ADR 0014)", () => {
  // VTC lists the identical marble hex as SH on the matte row and PC on the
  // polished one — a "piece" here is the 9×11 backing sheet, so it must snapshot
  // the same per-sheet coverage as its SH sibling, not fall to loose exact-area.
  const it = { sku: "MLSMBOIHEXP", type: "tile", priceUnit: "PC", orderUnit: "PC", sheetSize: "9x11", pcPerUnit: 10, sfPerUnit: 6.875, description: "Marbles Oniciata Ivory Hex Mosaic Polished", price: 32.54 };
  const patch = stockPatch(it, {});
  assert.equal(patch.cartonSf, "0.6875");       // one 9×11 sheet, same as the SH sibling
  assert.equal(patch.cartonUnit, "PC");         // reflects this row's own No-Broken unit
  assert.equal(patch.sizeText, "9x11 sheet");
  assert.equal(patch.priceSqft, "47.33");       // 32.54 × 10 ÷ 6.875
});

test("a loose piece-sold tile with no sheet (a per-piece bullnose w/ coverage) still orders exact area", () => {
  // The looseOrder path is unchanged for genuine loose pieces: no sheetSize, so a
  // PC No-Broken unit keeps its exact-area ordering (no carton/sheet rounding).
  const it = { sku: "LOOSEPC", type: "tile", priceUnit: "SF", orderUnit: "PC", sfPerUnit: 5, pcPerUnit: 8, priceSqft: 4 };
  const patch = stockPatch(it, {});
  assert.equal(patch.cartonSf, undefined);
});

test("a 94\" hex reducer fills free-text sizeText with no derived L/W (ticket 009 guard)", () => {
  const it = normStockItem({ sku: "R94", data: { type: "tile", unit: "LF", size: '94" Hex', description: "Reducer Oak", price: 20, priceSqft: 3 } });
  const patch = stockPatch(it, {});
  assert.equal(patch.sizeText, '94" Hex'); // shows the vendor string
  assert.equal(patch.L, undefined);        // but no coverage — the guard rejected it
  assert.equal(patch.W, undefined);
});

test("an accessory (no per-sqft price) fills as a Miscellaneous line with its flat price", () => {
  const it = normStockItem({ sku: "55006", data: { type: null, size: '2¼ x 12"', description: "Red Oak — Self Rim", price: 30.99 } });
  const patch = stockPatch(it, {});
  assert.equal(patch.type, "misc");
  assert.equal(patch.priceSqft, "30.99");
  assert.equal(patch.brandColor, "Red Oak — Self Rim"); // size lands in its own field, not the name
  assert.equal(patch.sizeText, '2¼ x 12"');
});

test("an unpriced trim SKU still links and describes, leaving price empty", () => {
  const it = normStockItem({ sku: "13191", data: { type: null, description: "Acacia Tiger's Eye — Reducer", price: null } });
  const patch = stockPatch(it, {});
  assert.equal(patch.type, "misc");
  assert.equal(patch.priceSqft, undefined);
  assert.equal(patch.sku, "13191");
});

test("a per-piece price with PC/CT scales to the carton before deriving $/sqft", () => {
  // Two-unit books carry SF/CT per CARTON while a PC price is per piece — the
  // derivation must multiply by PC/CT first (the VTC bullnose mispricing).
  const it = { sku: "CTIEPLIBN336R", type: "tile", priceUnit: "PC", orderUnit: "CT", price: 27.99, sfPerUnit: 5.38, pcPerUnit: 8 };
  const patch = stockPatch(it, {});
  assert.equal(patch.priceSqft, "41.62");   // (27.99 × 8) / 5.38, not 27.99 / 5.38
  assert.equal(patch.cartonSf, "5.38");
});

test("a typed, piece-priced, carton-sold item with no coverage lands as a per-piece count line with carton rounding", () => {
  const it = { sku: "CDSTABABN240R", type: "tile", priceUnit: "PC", orderUnit: "CT", price: 71.11, pcPerUnit: 10, description: "Tahoe Barrel Bullnose 2x40" };
  const patch = stockPatch(it, {});
  assert.equal(patch.type, "misc");         // no coverage → no honest sqft line
  assert.equal(patch.priceSqft, "71.11");   // per PIECE (ADR 0013 amendment)
  assert.equal(patch.cartonPc, "10");       // ordering rounds up to cartons of 10
  assert.equal(patch.cartonUnit, "CT");
  assert.doesNotMatch(patch.brandColor, /carton of/);
});

// --- drift -----------------------------------------------------------------------

test("stockDrift flags a snapshot whose price the book has since changed", () => {
  const it = normStockItem({ sku: "1", data: { type: "tile", priceSqft: 5.15, price: 50 } });
  assert.deepEqual(stockDrift(it, { priceSqft: "4.79" }), { from: 4.79, to: 5.15 });
  assert.equal(stockDrift(it, { priceSqft: "5.15" }), null);
  assert.equal(stockDrift(it, { priceSqft: "" }), null);
  assert.equal(stockDrift(null, { priceSqft: "4.79" }), null);
});

test("stockDrift compares sheet-priced items against the same derived $/sqft the snapshot filled", () => {
  const it = normStockItem({ sku: "1504051", data: { type: "tile", unit: "SH", price: 27.99, sfPerUnit: 2 } });
  assert.equal(stockDrift(it, { priceSqft: "14" }), null); // the snapshot's own value — no false drift
  assert.deepEqual(stockDrift(it, { priceSqft: "12.5" }), { from: 12.5, to: 14 });
});

// --- search ---------------------------------------------------------------------

test("searchStock matches SKU prefixes and word queries, skipping retired items", () => {
  const items = [
    item({ sku: "28920", description: "Acacia Tiger's Eye", brand: "Mannington Aduramax" }),
    item({ sku: "28921", description: "Old thing", discontinued: true }),
    item({ sku: "55006", description: "Red Oak — Self Rim", sheet: "Wood Vents", active: false }),
    item({ sku: "55007", description: "Red Oak — Self Rim", sheet: "Wood Vents" }),
  ];
  assert.deepEqual(searchStock(items, "289").map((i) => i.sku), ["28920"]); // 28921 is discontinued
  assert.deepEqual(searchStock(items, "oak vent").map((i) => i.sku), ["55007"]); // sheet text searchable, inactive skipped
  assert.deepEqual(searchStock(items, "a"), []); // too short
  assert.equal(findStock(items, "55006").sku, "55006"); // findStock still resolves retired SKUs
});

test("searchStock returns every match — display code does the truncating", () => {
  const items = Array.from({ length: 40 }, (_, i) => item({ sku: String(10000 + i), description: "Napa Tannin — Stairnose" }));
  assert.equal(searchStock(items, "stairnose").length, 40);
});

test("'transition' matches the book's trim profile labels", () => {
  const items = [
    item({ sku: "28870", description: "Napa Tannin", brand: "Mannington Aduramax" }),
    item({ sku: "13137", description: "Napa Tannin — Reducer", brand: "Mannington Aduramax" }),
    item({ sku: "13165", description: "Napa Tannin — Stairnose", brand: "Mannington Aduramax" }),
    item({ sku: "1510339", description: "Fresco Canvas — T-Mold", brand: "Mannington Aduramax" }),
    item({ sku: "23051", description: "Schluter All Set White" }),
  ];
  assert.deepEqual(searchStock(items, "transition").map((i) => i.sku), ["13137", "13165", "1510339"]);
  assert.deepEqual(searchStock(items, "mannington transitions").map((i) => i.sku), ["13137", "13165", "1510339"]);
  assert.deepEqual(searchStock(items, "napa transition").map((i) => i.sku), ["13137", "13165"]);
});

// --- Laticrete base-unit companions ---------------------------------------------

const baseStock = () => [
  normStockItem({ sku: "1518983", data: { section: "Laticrete Bulk & Base Units", brand: "Laticrete", product: "Laticrete SpectraLock Full Unit", description: "SpectraLock Full Unit", style: "Full Unit", size: "0.8 GAL", unit: "EA", price: 132.99 } }),
  normStockItem({ sku: "1518984", data: { section: "Laticrete Bulk & Base Units", brand: "Laticrete", product: "Laticrete SpectraLock Comm. Unit", description: "SpectraLock Comm. Unit", style: "Comm. Unit", size: "3.2 GAL", unit: "EA", price: 374.99 } }),
  normStockItem({ sku: "1519065", data: { section: "Laticrete Bulk & Base Units", brand: "Laticrete", product: "Laticrete PermaColor Sanded Base", description: "PermaColor Sanded Base", style: "Sanded Base", size: "10 LB", unit: "EA", price: 24.75 } }),
  normStockItem({ sku: "1519066", data: { section: "Laticrete Bulk & Base Units", brand: "Laticrete", product: "Laticrete PermaColor Unsanded Base", description: "PermaColor Unsanded Base", style: "Unsanded Base", size: "8 LB", unit: "EA", price: 25.89 } }),
];
const pigment = (variant) => normStockItem({ sku: "1518985", data: { section: "Laticrete Grout & Caulk", brand: "Laticrete", product: `Laticrete ${variant}`, description: `85 Almond ${variant}`, color: "85 Almond", unit: "EA", price: 32.89 } });

test("stockCompanionBase pairs a pigment with its default base", () => {
  const stock = baseStock();
  assert.equal(stockCompanionBase(pigment("Spectralock Part C"), stock).sku, "1518983"); // Full, not Comm
  assert.equal(stockCompanionBase(pigment("Permacolor Color Kit"), stock).sku, "1519065"); // Sanded, not Unsanded
});

test("stockCompanionBase returns null for things that need no base", () => {
  const stock = baseStock();
  assert.equal(stockCompanionBase(pigment("Latasil Caulk"), stock), null);
  assert.equal(stockCompanionBase(stock[0], stock), null); // a base unit itself
  assert.equal(stockCompanionBase(item({ description: "Marazzi Tile", type: "tile" }), stock), null);
});

test("stockCompanionBase skips inactive/discontinued bases and no-ops without a book", () => {
  const stock = baseStock().map((b) => normStockItem({ sku: b.sku, active: false, data: { ...b, section: b.section } }));
  assert.equal(stockCompanionBase(pigment("Spectralock Part C"), stock), null);
  assert.equal(stockCompanionBase(pigment("Spectralock Part C"), []), null);
});

test("stockBaseVariant toggles to the sibling base variant", () => {
  const stock = baseStock();
  assert.equal(stockBaseVariant(stock[0], stock).sku, "1518984"); // Full -> Comm
  assert.equal(stockBaseVariant(stock[1], stock).sku, "1518983"); // Comm -> Full
  assert.equal(stockBaseVariant(stock[2], stock).sku, "1519066"); // Sanded -> Unsanded
  assert.equal(stockBaseVariant(stock[3], stock).sku, "1519065"); // Unsanded -> Sanded
  assert.equal(stockBaseVariant(pigment("Spectralock Part C"), stock), null); // not a base
});

// --- ADR 0006: base companion for the catalog ------------------------------------

test("stockBaseCompanion builds the catalog base at a 1:1 ratio, null when none", () => {
  const stock = baseStock();
  const c = stockBaseCompanion(pigment("Spectralock Part C"), stock);
  assert.equal(c.sku, "1518983");
  assert.equal(c.name, "SpectraLock Full Unit");
  assert.equal(c.per, 1);
  assert.equal(c.price, 132.99);
  assert.equal(stockBaseCompanion(pigment("Latasil Caulk"), stock), null);
});

// --- ADR 0007: grout color families ----------------------------------------------

const colorItem = (sku, product, color, price, over = {}) =>
  normStockItem({ sku, active: over.active, data: { sheet: "Grout & Caulk", section: "LATICRETE GROUT & CAULK", brand: "Laticrete", product, color, description: `${color} ${product}`, unit: "EA", price, ...over } });

test("groutFamilies groups live Grout & Caulk items by product, one SKU per color", () => {
  const stock = [
    colorItem("1519025", "Laticrete Permacolor Color Kit", "Almond", 5.39),
    colorItem("1519032", "Laticrete Permacolor Color Kit", "Raven", 5.39),
    colorItem("2001", "Tec Power Grout", "Charcoal", 21.99),
    colorItem("1519040", "Laticrete Permacolor Color Kit", "Retired Beige", 5.39, { active: false }),
    colorItem("1519041", "Laticrete Permacolor Color Kit", "Gone Grey", 5.39, { discontinued: true }),
    item({ sku: "777", description: "Some tile, not a grout color item" }),
  ];
  const fams = groutFamilies(stock);
  assert.deepEqual(fams.map((f) => f.product), ["Laticrete Permacolor Color Kit", "Tec Power Grout"]);
  const pc = fams[0];
  assert.deepEqual(pc.colors.map((c) => c.color), ["Almond", "Raven"]); // live colors only
  assert.equal(pc.colors[0].sku, "1519025");
  assert.equal(pc.price, 5.39);
  assert.equal(pc.brand, "Laticrete");
});

test("groutColorItem resolves a family color to its stock item, case-insensitively", () => {
  const stock = [colorItem("1519025", "Laticrete Permacolor Color Kit", "Almond", 5.39)];
  assert.equal(groutColorItem(stock, "laticrete permacolor color kit", "ALMOND").sku, "1519025");
  assert.equal(groutColorItem(stock, "Laticrete Permacolor Color Kit", "Nope"), null);
  assert.equal(groutColorItem(stock, "", "Almond"), null);
  assert.equal(groutColorItem(stock, "Laticrete Permacolor Color Kit", ""), null);
});

test("groutCaulkItem finds the same section's caulk column in the picked color", () => {
  const tecItem = (sku, product, color, over = {}) =>
    normStockItem({ sku, active: over.active, data: { sheet: "Grout & Caulk", section: "TEC GROUT & CAULK", brand: "TEC", product, color, description: `${color} ${product}`, unit: "EA", price: 9.99, ...over } });
  const stock = [
    colorItem("1519025", "Laticrete Permacolor Color Kit", "Almond", 5.39),
    colorItem("1519067", "Laticrete Latasil Caulk", "Almond", 12.5),
    colorItem("1519068", "Laticrete Latasil Caulk", "Raven", 12.5),
    tecItem("2001", "Tec Power Grout", "Almond"),
    tecItem("2002", "TEC Caulk", "Almond"),
  ];
  // Same section + same color, not the other brand's caulk.
  assert.equal(groutCaulkItem(stock, "Laticrete Permacolor Color Kit", "Almond").sku, "1519067");
  assert.equal(groutCaulkItem(stock, "Tec Power Grout", "Almond").sku, "2002");
  // Color the caulk column doesn't carry, or a retired caulk SKU → null.
  assert.equal(groutCaulkItem(stock, "Tec Power Grout", "Raven"), null);
  const retired = [colorItem("1", "Laticrete Permacolor Color Kit", "Almond", 5.39), colorItem("2", "Laticrete Latasil Caulk", "Almond", 12.5, { active: false })];
  assert.equal(groutCaulkItem(retired, "Laticrete Permacolor Color Kit", "Almond"), null);
  // A family that IS the caulk column matches itself.
  assert.equal(groutCaulkItem(stock, "Laticrete Latasil Caulk", "Raven").sku, "1519068");
});

test("groutSnapshotPatch bundles color SKU + caulk SKU/price; empty on a miss", () => {
  const stock = [
    colorItem("1519025", "Laticrete Permacolor Color Kit", "Almond", 5.39),
    colorItem("1519067", "Laticrete Latasil Caulk", "Almond", 12.5),
  ];
  assert.deepEqual(groutSnapshotPatch(stock, "Laticrete Permacolor Color Kit", "Almond"),
    { sku: "1519025", caulkSku: "1519067", caulkPrice: "12.5" });
  assert.deepEqual(groutSnapshotPatch(stock, "Laticrete Permacolor Color Kit", "Nope"),
    { sku: "", caulkSku: "", caulkPrice: "" });
  assert.deepEqual(groutSnapshotPatch([], "Laticrete Permacolor Color Kit", "Almond"),
    { sku: "", caulkSku: "", caulkPrice: "" });
  assert.deepEqual(groutSnapshotPatch(stock, "", "Almond"), { sku: "", caulkSku: "", caulkPrice: "" });
});

// --- disabled switch (importer-upgrades spec, PR A) ----------------------------

test("searchStock skips disabled items", () => {
  const on = normStockItem({ sku: "11111", data: { description: "Blue glass tile" } });
  const off = normStockItem({ sku: "22222", disabled: true, data: { description: "Blue glass tile" } });
  assert.deepEqual(searchStock([on, off], "blue glass").map((i) => i.sku), ["11111"]);
});

test("grout family colors and their caulk skip disabled SKUs", () => {
  const g = (sku, color, disabled = false) =>
    normStockItem({ sku, disabled, data: { sheet: "Grout & Caulk", section: "TEC", product: "TEC Power Grout", color, price: 21 } });
  const caulk = (sku, color, disabled = false) =>
    normStockItem({ sku, disabled, data: { sheet: "Grout & Caulk", section: "TEC", product: "TEC Caulk", color, price: 9 } });
  const stock = [g("70001", "Charcoal"), g("70002", "Bone", true), caulk("70003", "Charcoal", true)];
  const fams = groutFamilies(stock);
  const powerGrout = fams.find((f) => f.product === "TEC Power Grout");
  assert.deepEqual(powerGrout.colors.map((c) => c.color), ["Charcoal"]); // Bone is disabled
  assert.equal(groutCaulkItem(stock, "TEC Power Grout", "Charcoal"), null); // its caulk is disabled
});
