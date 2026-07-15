import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePriceBook, parseMapped, mappedSkuRe, splitSizeFromDescription, mmToFraction, guessBookField, guessHeaderRow, bestDataSheet, columnsFromHeader, detectVtcEft, detectStockWorkbook } from "./pricebook.js";

const sheet = (name, rows) => ({ name, rows });
const parse = (...sheets) => parsePriceBook(sheets);
const bySku = (items, sku) => items.find((i) => i.sku === sku);

// --- generic sectioned tables --------------------------------------------------

test("table sheet: sections, header mapping, sidebar Index column ignored", () => {
  const { items } = parse(sheet("Hardwood", [
    ["Unfinished Hardwood Flooring"],
    ["Sheoga"],
    ["", "SKU", "Thickness", "Width", "Description", "", "SF/CT", "Retail ", "SF Price", "Notes", "", "", "Index"],
    ["", "05068", 0.75, '2-1/4"', "Clear Red Oak", "", 22, 94.38, 4.29, "", "", "", "Unfinished", "Hardwood!A2"],
    ["", "", "", "", "", "", "", "", "", "", "", "", "Sheoga"],
    ["Mirage-Solid"],
    ["", "SKU", "Thickness", "Width", "Description", "", "SF/CT", "Retail ", "SF Price", "Notes"],
    ["", "29258", '3/4"', '3-1/4"', "Red Oak Natural", "", 20, 139.8, 6.99, "DISC"],
  ]));
  assert.equal(items.length, 2);
  const oak = bySku(items, "05068");
  assert.equal(oak.section, "Sheoga");
  assert.equal(oak.type, "hardwood");
  assert.equal(oak.size, '2-1/4"');
  assert.equal(oak.thickness, "0.75");
  assert.equal(oak.price, 94.38);
  assert.equal(oak.priceSqft, 4.29);
  assert.equal(oak.sfPerUnit, 22);
  assert.equal(oak.discontinued, false);
  assert.equal(oak.description, "Clear Red Oak"); // sidebar text not absorbed
  const mirage = bySku(items, "29258");
  assert.equal(mirage.section, "Mirage-Solid");
  assert.equal(mirage.discontinued, true);
});

test("table sheet: DISC marker in a headerless column, color carry-down, extra text kept", () => {
  const { items } = parse(sheet("Vinyl", [
    ["Floating Floors "],
    ["SKU", "Description", "", "", "", "SF/CT", "Price", "Price / SF"],
    ["1507639", "Metroflor Inception", "", "", "", 21.45, 71.88, 3.351, "Disc"],
    [],
    ['90" Metroflor Trims'],
    ["SKU", "Color", "Part #", "Desc", "Price"],
    ["", "Swing Oak"],
    ["1510297", "", "ARF97", "Reducer", 61.59],
    ["1510300", "Forest Oak", "ARF73", "Stair Nose", 82.59],
    ["1510301", "", "ARF98", "Reducer", 61.59],
    [],
    ["Schluter VinPro Mouldings"],
    ["SKU", "Description", "", "", "", "", "Price"],
    ["1503878", '1" Schluter Vinpro-T', "", "VPTL Brushed Chrome", "", "", 14.96],
  ]));
  const floor = bySku(items, "1507639");
  assert.equal(floor.discontinued, true);
  assert.equal(floor.type, "vinyl");
  assert.equal(floor.priceSqft, 3.351);
  // "90" Metroflor Trims" is a real title even though it starts with a digit.
  assert.equal(bySku(items, "1510297").section, '90" Metroflor Trims');
  // Color group label carries down until the next inline color.
  assert.match(bySku(items, "1510297").description, /Swing Oak/);
  assert.match(bySku(items, "1510301").description, /Forest Oak/);
  // Text in a headerless column inside the table lands in the description.
  assert.match(bySku(items, "1503878").description, /Brushed Chrome/);
});

test("table sheet: non-numeric price becomes a note, not a price", () => {
  const { items } = parse(sheet("Accessories", [
    ["Flooring Nails"],
    ["", "SKU", "U/M", "Size", "Decription", "", "", "Retail ", "", "Notes"],
    ["", "79550", "EA", "1200ct", '1-1/2" Hardwood Floor Nail', "", "", "See Catalyst"],
  ]));
  const nail = bySku(items, "79550");
  assert.equal(nail.price, null);
  assert.match(nail.note, /See Catalyst/);
  assert.equal(nail.type, null);
});

test("a re-arranged sheet with no recognizable items produces a warning", () => {
  const { items, warnings } = parse(sheet("Accessories", [["Something"], ["totally", "different"]]));
  assert.equal(items.length, 0);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /Accessories/);
});

// --- Mann Aduramax ---------------------------------------------------------------

test("Aduramax: flooring item + companion trim SKUs, size from section, Apex line", () => {
  const { items } = parse(sheet("Mann Aduramax", [
    ["Stock Mannington Vinyl Floors", "", "SKU", "SF/CT", "", "CT Price", "SF Price", "Reducer", "T-Mold", "End Cap", "Stairnosing"],
    ["6x48 Plank Visuals"],
    ["Acacia Tiger's Eye", "MAX011", "28920", 27.39, "", 131.1981, 4.79, "13191", "13192", "13194", "13193"],
    ["Kona Beach", "", "Discout", "", "", "", "", "94561", "94560", "94559", "94562", "DISC"],
    ["Apex- Check with Flooring"],
    ["Antiquity Memento", "APX180", "1517402", 23.4, "", 123.79, 5.29, "1518242", "1518241", "1518240", "1518243"],
  ]));
  const main = bySku(items, "28920");
  assert.equal(main.type, "vinyl");
  assert.equal(main.size, "6x48");
  assert.equal(main.price, 131.2);
  assert.equal(main.priceSqft, 4.79);
  const trim = bySku(items, "13191");
  assert.equal(trim.description, "Acacia Tiger's Eye — Reducer");
  assert.equal(trim.type, null);
  assert.equal(trim.price, null);
  // A discontinued floor with no main SKU still yields its (flagged) trims.
  assert.equal(bySku(items, "94561").discontinued, true);
  const apex = bySku(items, "1517402");
  assert.equal(apex.brand, "Mannington Adura Apex");
  assert.equal(apex.size, ""); // 6x48 must not leak into the Apex section
});

test("Aduramax: the group's trailing price row prices every trim in that group", () => {
  const { items } = parse(sheet("Mann Aduramax", [
    ["Stock Mannington Vinyl Floors", "", "SKU", "SF/CT", "", "CT Price", "SF Price", "Reducer", "T-Mold", "End Cap", "Stairnosing"],
    ["6x48 Plank Visuals"],
    ["Acacia Tiger's Eye", "MAX011", "28920", 27.39, "", 131.1981, 4.79, "13191", "13192", "13194", "13193"],
    ["Napa Tannin", "MAX061", "28870", 27.39, "", 131.1981, 4.79, "13137", "13151", "13179", "13165"],
    ["", "", "", "", "", "", "", 46.8, 46.8, 46.8, 94.99],
    ["7x48 Plank Visuals"],
    ["Swiss Oak Almond", "MAX740", "94568", 28.52, "", 136.6108, 4.79, "94571", "94570", "94569", "94572"],
    ["", "", "", "", "", "", "", 50, 50, 50, 99],
  ]));
  assert.equal(bySku(items, "13191").price, 46.8);  // Reducer
  assert.equal(bySku(items, "13193").price, 94.99); // Stairnose
  assert.equal(bySku(items, "13165").price, 94.99); // second color, same group
  assert.equal(bySku(items, "94571").price, 50);    // next group's own prices
  assert.equal(bySku(items, "28920").price, 131.2); // the floor is untouched
});

// --- Grout & Caulk matrices --------------------------------------------------------

test("grout matrix: product per column, SKU per color cell, first PRICE row wins", () => {
  const { items } = parse(sheet("Grout & Caulk", [
    ["TEC GROUT & CAULK", "", "", "", "", "", "Index"],
    ["COLOR#", "", "UNSANDED", "POWER GROUT", "CAULK", "", "TEC Grout and Caulk"],
    ["", "", "10#", "10#"],
    ["PRICE", "", 24.38, 33.53, 14.79],
    ["903 BIRCH", "", "-", "26742", "47849"],
    ["910 BRIGHT WHITE", "", "47018", "26736", "29439"],
    ["PRICE", "", 24.38, 33.53, 14.48],
    ["Custom Epoxy Grout"],
    ["COLOR#", "", "PART A", "PART B", "CAULK"],
    ["Price", "", 33.29, 97.64, 19.19],
    ["10 Antique White", "", "93776", "28865", "93777"],
    ["145 Light Smoke", "", "93792", "28865", "93793"],
  ]));
  const birch = bySku(items, "26742");
  assert.equal(birch.product, "TEC Power Grout");
  assert.equal(birch.color, "Birch");
  assert.equal(birch.price, 33.53); // first PRICE row, not the stale bottom one
  assert.equal(bySku(items, "47849").product, "TEC Caulk");
  assert.equal(bySku(items, "47018").product, "TEC Unsanded");
  const epoxy = bySku(items, "93776");
  assert.equal(epoxy.product, "Custom Epoxy Grout Part A");
  assert.equal(epoxy.color, "Antique White");
  assert.equal(epoxy.price, 33.29);
  // Part B's SKU is shared by every color row, so it imports as one
  // color-less item, not as the first color's ("Antique White") Part B.
  assert.equal(items.filter((i) => i.sku === "28865").length, 1);
  const partB = bySku(items, "28865");
  assert.equal(partB.description, "Custom Epoxy Grout Part B");
  assert.equal(partB.color, "");
  assert.equal(partB.price, 97.64);
});

test("grout matrix: Laticrete reads color-first with its number, base units imported", () => {
  const { items } = parse(sheet("Grout & Caulk", [
    ["Laticrete Grout & Caulk"],
    ["COLOR#", "", "SPECTRALOCK\nPART C", "PERMACOLOR\nCOLOR KIT", "LATASIL\nCAULK"],
    ["", "", "9LB", "COLOR KIT", "10.3OZ"],
    ["Price", "", 32.89, 5.39, 22.99],
    ["85 Almond", "", "1518985", "1519025", "1519067"],
    ["Laticrete Bulk & Base Units"],
    ["ITEM", "", "SIZE", "SKU", "PRICE"],
    ["SpectraLock\nFull Unit", "", "0.8 GAL", "1518983", 132.99],
    ["PermaColor\nSanded Base", "", "10 LB", "1519066", 24.75],
  ]));
  const partC = bySku(items, "1518985");
  assert.equal(partC.description, "85 Almond Spectralock Part C"); // color-first, number kept, newline collapsed
  assert.equal(partC.color, "85 Almond");
  assert.equal(partC.product, "Laticrete Spectralock Part C");
  assert.equal(partC.price, 32.89);
  assert.equal(bySku(items, "1519025").description, "85 Almond Permacolor Color Kit");
  assert.equal(bySku(items, "1519067").description, "85 Almond Latasil Caulk");
  const full = bySku(items, "1518983");
  assert.equal(full.section, "Laticrete Bulk & Base Units");
  assert.equal(full.description, "SpectraLock Full Unit");
  assert.equal(full.size, "0.8 GAL");
  assert.equal(full.price, 132.99);
  assert.equal(full.type, null);
  assert.equal(bySku(items, "1519066").description, "PermaColor Sanded Base");
});

// --- Tile Seats, Curbs, Trims --------------------------------------------------------

test("seats/curbs/trims: plain rows, color-coded matrix, mid-row SKU fallback, shelf matrix", () => {
  const { items } = parse(sheet("Tile Seats, Curbs, Trims", [
    ["Corner Shelves"],
    ["28973", '10" Black Granite', 48],
    ["Trendline"],
    ["Pricing is color coded", "", "", '1/2"', '3/8"', '5/16"', "", "Pricing"],
    ["MGS Matte Black", "", "Jolly", "22980", "23193", "23195", "", 22.07],
    ["Renu U Reducer"],
    ["AT-Satin Nickel", "", "Reno-U Reducer", "45506", "", 18.43],
    ["Schluter Shelves"],
    ["", "", "Triangle", "Pentagon"],
    ["Brushed Stainless EB"],
    ["", "Floral", "1501058", "1501063"],
  ]));
  const shelf = bySku(items, "28973");
  assert.equal(shelf.price, 48);
  assert.match(shelf.description, /Black Granite/);
  // one item per size column, priced from the Pricing column
  const jolly = bySku(items, "22980");
  assert.match(jolly.description, /Jolly 1\/2" — MGS Matte Black/);
  assert.equal(jolly.price, 22.07);
  assert.equal(items.filter((i) => /MGS Matte Black/.test(i.description)).length, 3);
  const renu = bySku(items, "45506");
  assert.equal(renu.price, 18.43);
  assert.match(renu.description, /AT-Satin Nickel/);
  const tri = bySku(items, "1501058");
  assert.match(tri.description, /Triangle Floral — Brushed Stainless/);
});

// --- dedupe ------------------------------------------------------------------------

test("duplicate SKUs collapse to one item, preferring the priced one, warning on conflicts", () => {
  const trowels = (sheetName, price) => sheet(sheetName, [
    ["Trowels"],
    ["", "SKU", "U/M", "Size", "Decription", "", "", "Retail ", "", "Notes"],
    ["", "1507211", "EA", "", "Grout Float", "", "", price],
    ["", "1514674", "EA", "", "Schluter Trowel", "", "", sheetName === "Accessories" ? 28.17 : null],
  ]);
  const { items, warnings } = parse(trowels("Accessories", 22.29), trowels("Tile-Mortar, Membrane, Underlay", 26.99));
  assert.equal(items.filter((i) => i.sku === "1507211").length, 1);
  assert.equal(bySku(items, "1507211").price, 22.29);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /1507211/);
  // unpriced duplicate defers to the priced occurrence, no warning
  assert.equal(bySku(items, "1514674").price, 28.17);
});

test('shop stock sheets: "Retail Price" header maps to price (Schluter/Wedi layouts)', () => {
  // Schluter: data from column 0; sub-group label rows carry into descriptions;
  // the unmapped "Mfg SKU" column's text still lands in the description.
  const { items } = parse(sheet("Schluter", [
    ["Keim Lumber 4465 State Route 557"],
    ["SCHLUTER SHOWER SYSTEM- RETAIL PRICING***", null, null, null, null, "*prices subject to change"],
    ["SKU", "Description", "Mfg SKU", "U/M", "Retail Price", "Notes"],
    ["Kerdi- Shower-T & TS"],
    [1509821, '38"x60" Kerdi Shower Tray Center', "KST965/1525", "EA", 121.902, null],
    [1509814, '48"x60" Kerdi Shower Tray Center', "KST1220/1525", "EA", 181.54, null],
  ]), sheet("Wedi", [
    // Wedi: same header one column right, formula-noise prices.
    [null, "WEDI SHOWER SYSTEM- RETAIL PRICING***"],
    [null, "SKU", "Description", "Mfg SKU", "U/M", "Retail Price", "Notes"],
    [null, "Shower Pans square Drain", null, null, null, null, "Do not use mastic on Wedi"],
    [null, 1504153, "3'x3' Wedi Fundo Shower Pan", "US9100001", "EA", 378.1802178, null],
  ]));
  assert.equal(items.length, 3);
  const tray = bySku(items, "1509821");
  assert.equal(tray.price, 121.9); // round2
  assert.equal(tray.unit, "EA");
  assert.equal(tray.type, null); // accessory — fills as a misc line
  assert.match(tray.description, /KST965\/1525/);
  const pan = bySku(items, "1504153");
  assert.equal(pan.price, 378.18);
  assert.match(pan.description, /US9100001/);
});

// --- generic mapped import (order books, ADR 0009) ----------------------------

// A Virginia-Tile-EFT-shaped sheet: title/legend prose, header at row 2, then
// item rows. Columns 0 (status flag) and 5 (description) are headerless.
const VTC_ROWS = [
  ["Virginia Tile EFT price list"],
  ["Key: xx=discontinued  *=freight  •=made to order"],
  ["", "VTC MFG", "Color", "Pattern", "VTC Item Code", "", "Product Line", "Lead Time", "Consumer", "Dealer", "U/M", "No Broken", "PC/CT", "SF/CT", "Comments"],
  ["", "CER", "Gray", "3x12", "CER0000001", "EARTH ASH GRAY 3X12", "PRESLEY", "READY SHIP", 5.0, 3.5, "SF", "SF", "", 12.5, ""],
  ["*", "CER", "", "48x48", "CER0000002", "BIG SLAB 48X48", "NANTUCKET", "IMPORT", 40, 30, "SF", "PC", "", 16, ""],
  ["xx", "FLO", "", "", "FLO0000003", "OLD LINE 6X6", "", "READY SHIP", 3, 2, "PC", "PC", "", "", "DISCO BY ADX 6-2025"],
  ["Note: totals below", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
];

const VTC_MAPPING = {
  headerRow: 2,
  skuPattern: "^[A-Z0-9]{9,16}$",
  columns: { 0: "flag", 1: "mfg", 6: "productLine", 4: "sku", 5: "description", 7: "leadTime", 8: "msrp", 9: "cost", 10: "unit", 13: "sfPerUnit", 14: "note" },
  groupBy: "mfg",
  flags: { xx: "discontinued", "*": "freight", "•": "madeToOrder", "◪": "transitioning" },
  defaultType: "tile",
};

test("parseMapped: reads mapped columns, applies the flag legend, stores cost not sell", () => {
  const { items, warnings } = parseMapped(VTC_ROWS, VTC_MAPPING);
  assert.equal(items.length, 3); // the title-prose row below is not a SKU → skipped
  assert.equal(warnings.length, 0);

  const t = bySku(items, "CER0000001");
  assert.equal(t.cost, 3.5);
  assert.equal(t.price, null); // order items never store a selling price
  assert.equal(t.priceSqft, null);
  assert.equal(t.unit, "SF");
  assert.equal(t.sfPerUnit, 12.5);
  assert.equal(t.mfg, "CER");
  assert.equal(t.section, "CER"); // group axis falls back into section/brand
  assert.equal(t.leadTime, "READY SHIP");
  assert.equal(t.msrp, 5);
  assert.equal(t.type, "tile"); // from defaultType
  // The size is pulled out of the description; the name leads with the product
  // line and reads clean (title-cased), no size text left in it.
  assert.equal(t.size, "3x12");
  assert.equal(t.description, "Presley Earth Ash Gray");
  assert.equal(bySku(items, "CER0000002").description, "Nantucket Big Slab");
  assert.equal(bySku(items, "CER0000002").size, "48x48");
  assert.equal(bySku(items, "FLO0000003").description, "Old Line"); // no product line → just the cleaned name
  assert.equal(bySku(items, "FLO0000003").size, "6x6");

  assert.equal(bySku(items, "CER0000002").freightFlag, true);
  assert.equal(bySku(items, "FLO0000003").discontinued, true);
  assert.match(bySku(items, "FLO0000003").note, /DISCO BY ADX/);
});

test("parseMapped: real MFG-Data shape — code columns stay out of the label, product line isn't doubled", () => {
  // The live VTC "MFG Data" sheet (unlike the hand-picked fixture above) has
  // VTC Color / VTC Pattern as internal CODES (EAAS / 312) and a product line
  // (EARTH) that is already the first word of the description. The app's
  // auto-guess maps all of them, which used to yield
  // "Earth Earth Ash Gray — Eaas — 312". The label must read clean.
  const rows = [
    ["", "VTC MFG", "VTC Color", "VTC Pattern", "VTC Item Code", "", "Product Line Name", "", "", "Dealer", "Price U/M", "No Broken U/M", "PC/CT", "SF/CT", ""],
    ["", "ADX", "EAAS", "312", "ADXEAAS312", "EARTH ASH GRAY 3X12", "EARTH", "", "", 11.64, "SF", "PC", 50, 12.5, ""],
  ];
  const mapping = {
    headerRow: 0, skuPattern: "^[A-Z0-9]{6,20}$", defaultType: "tile",
    columns: { 1: "mfg", 2: "color", 3: "style", 4: "sku", 5: "description", 6: "productLine", 9: "cost", 10: "priceUnit", 11: "orderUnit", 12: "pcPerUnit", 13: "sfPerUnit" },
  };
  const t = bySku(parseMapped(rows, mapping).items, "ADXEAAS312");
  assert.equal(t.description, "Earth Ash Gray"); // not doubled, no appended codes
  assert.equal(t.color, "EAAS"); // code still stored on its own field
  assert.equal(t.style, "312");
  assert.equal(t.priceUnit, "SF"); // both unit columns captured
  assert.equal(t.orderUnit, "PC");
  assert.equal(t.size, "3x12");
  // The mfg is a bare code — it stays off the on-row label (which is `brand` +
  // description in stock.js), so a picked row reads "Earth Ash Gray", not
  // "ADX Earth Ash Gray". mfg still rides for grouping/section.
  assert.equal(t.brand, "");
  assert.equal(t.mfg, "ADX");
});

test("parseMapped: with no description column, color + style are the fallback name", () => {
  const rows = [
    ["", "VTC MFG", "Color", "Pattern", "VTC Item Code", "", "Product Line", "", "", "Dealer", "U/M", "", "", "", ""],
    ["", "CER", "Bianco", "Carrara", "CER0000009", "", "PRESLEY", "", "", 6, "SF", "", "", "", ""],
  ];
  const mapping = {
    headerRow: 0, skuPattern: "^[A-Z0-9]{9,16}$", defaultType: "tile",
    columns: { 1: "mfg", 2: "color", 3: "style", 4: "sku", 6: "productLine", 9: "cost", 10: "unit" },
  };
  const t = bySku(parseMapped(rows, mapping).items, "CER0000009");
  assert.equal(t.description, "Presley Bianco Carrara");
});

test("parseMapped: only SKU-pattern rows are consumed (the honesty guarantee)", () => {
  // A rearranged sheet whose SKU column now holds descriptions yields nothing,
  // not garbage — the same visible-degradation rule as the stock parser.
  const wrong = { ...VTC_MAPPING, columns: { ...VTC_MAPPING.columns, 4: "description", 5: "sku" } };
  const { items, warnings } = parseMapped(VTC_ROWS, wrong);
  assert.equal(items.length, 0);
  assert.match(warnings[0], /No rows matched the SKU pattern/);
});

test("parseMapped: warns when no cost column is mapped", () => {
  const noCost = { ...VTC_MAPPING, columns: { 0: "flag", 4: "sku", 5: "description", 10: "unit" } };
  const { items, warnings } = parseMapped(VTC_ROWS, noCost);
  assert.ok(items.length > 0);
  assert.ok(warnings.some((w) => /No cost column/.test(w)));
});

test("parseMapped: a repeated SKU with different costs is deduped with a warning", () => {
  const rows = [
    VTC_ROWS[2],
    ["", "CER", "", "", "DUP0000001", "First", "", "READY SHIP", 5, 3, "SF", "", "", 10, ""],
    ["", "CER", "", "", "DUP0000001", "Second", "", "READY SHIP", 5, 4, "SF", "", "", 10, ""],
  ];
  const { items, warnings } = parseMapped(rows, { ...VTC_MAPPING, headerRow: 0 });
  assert.equal(items.length, 1);
  assert.ok(warnings.some((w) => /appears twice with different costs/.test(w)));
});

test("parseMapped: thickness embedded in the description becomes an inch fraction", () => {
  const rows = [
    VTC_ROWS[2], // header
    ["", "CER", "", "", "CER1000000", "EARTH 12X24 10MM", "PRESLEY", "IMPORT", 5.49, 3.29, "SF", "CT", 8, 15.5, ""],
  ];
  const { items } = parseMapped(rows, { ...VTC_MAPPING, headerRow: 0 });
  const t = bySku(items, "CER1000000");
  assert.equal(t.size, "12x24");
  assert.equal(t.thickness, '3/8"'); // 10mm → 3/8"
  assert.equal(t.description, "Presley Earth"); // size + thickness stripped, product line kept
});

test("splitSizeFromDescription: pulls size + thickness, leaves the rest as a clean name", () => {
  assert.deepEqual(splitSizeFromDescription("EARTH ASH GRAY 12X24 10MM"), { size: "12x24", thickness: '3/8"', name: "Earth Ash Gray", sheetSize: "" });
  assert.deepEqual(splitSizeFromDescription("2 x 8 SUBWAY WHITE"), { size: "2x8", thickness: "", name: "Subway White", sheetSize: "" });
  assert.deepEqual(splitSizeFromDescription('OAK PLANK 5X48 3/8"'), { size: "5x48", thickness: '3/8"', name: "Oak Plank", sheetSize: "" });
  // No LxW → passes through unchanged (honest fallback, nothing invented).
  assert.deepEqual(splitSizeFromDescription("BULLNOSE TRIM PIECE"), { size: "", thickness: "", name: "Bullnose Trim Piece", sheetSize: "" });
  // An "x" inside a word is never stripped.
  assert.equal(splitSizeFromDescription("MAX GREY 12X12").name, "Max Grey");
  // Already-mixed-case text is left as-is.
  assert.equal(splitSizeFromDescription("MSI Stone 12x12").name, "MSI Stone");
  // A size printed in both the color and the description column is stripped
  // from the name entirely, not left on a second copy beside a filled size cell.
  assert.deepEqual(splitSizeFromDescription("Ovo 3x12 Glossy 3x12 Ceramic Glossy Tile"), { size: "3x12", thickness: "", name: "Ovo Glossy Ceramic Glossy Tile", sheetSize: "" });
});

test("splitSizeFromDescription: a single-dimension hex size becomes the size string, not the name (ticket 009)", () => {
  const r = splitSizeFromDescription('Colonial Collection 2" Hex Presidential Grey');
  assert.equal(r.size, '2" Hex');
  assert.equal(r.name, "Colonial Collection Presidential Grey"); // size not doubled into the name
  // A shape word with no quote still normalizes to inch notation.
  assert.equal(splitSizeFromDescription("Penny Round White").size, ""); // no leading number → no shape size
  assert.equal(splitSizeFromDescription("1 Penny Round White").size, '1" Penny');
  // A bare dimension with no shape word is intentionally NOT a shape size — it
  // stays in the name, no coverage.
  assert.deepEqual(splitSizeFromDescription('SLATE 6" LEDGER'), { size: "", thickness: "", name: 'Slate 6" Ledger', sheetSize: "" });
  // An L×W still wins — the shape branch only fires when SIZE_RE missed.
  assert.equal(splitSizeFromDescription('8"x9" Hex Grey').size, "8x9");
});

test("splitSizeFromDescription: mixed-fraction dims parse whole, not from the middle (ticket 010)", () => {
  // The MRZ book's hex-mosaic chip size — SIZE_RE used to grab "2X1" out of
  // "1-1/2X1-1/2" and leave "1-1/ -1/2" litter in the name.
  assert.deepEqual(splitSizeFromDescription("MOROCCAN CONC OFF WHITE HEX MOS 1-1/2X1-1/2"), { size: '1-1/2" Hex', thickness: "", name: "Moroccan Conc Off White Mos", sheetSize: "" });
  // A packaging token ((12X10/SH)) is never the size and leaves no "( /Sh)" litter.
  assert.deepEqual(splitSizeFromDescription("ARTEZEN ELEGANT WHITE HEX MOS 1-1/2X1-1/2 (12X10/SH)"), { size: '1-1/2" Hex', thickness: "", name: "Artezen Elegant White Mos", sheetSize: "" });
  // A single-dim shape size behind a packaging token takes the chip, not the sheet.
  assert.equal(splitSizeFromDescription('GEOMETAL CHAMPAGNE GOLD 3" HEX MOS (11X12/SH)').size, '3" Hex');
  // Unequal fraction dims stay a rectangle — decimal so the L/W cells fill —
  // and the shape word stays in the name.
  assert.deepEqual(splitSizeFromDescription("ATTITUDE SIMPLY GREY HEX 8-1/2X10"), { size: "8.5x10", thickness: "", name: "Attitude Simply Grey Hex", sheetSize: "" });
  // Equal whole-number dims with a shape word read as a shape size too.
  assert.equal(splitSizeFromDescription("SUBURB GREY 2X2 HEX MATTE").size, '2" Hex');
  // An explicit SHEET/SHT token is the backing-sheet dimension, not the tile —
  // it lands in `sheetSize` (never the chip size), and coverage derives from it
  // at import (ADR 0014). "13X13 SHT" must not read as a 13" hex OR a 13x13 tile.
  const sheet = splitSizeFromDescription("EESOME GOLD HEX MOSAIC 13X13 SHT MIXED");
  assert.equal(sheet.size, "");
  assert.equal(sheet.sheetSize, "13x13");
  assert.equal(sheet.name, "Eesome Gold Hex Mosaic Mixed");
  // Regressions: the plain spellings are untouched.
  assert.equal(splitSizeFromDescription('MOROCCAN CONC OFF WHITE 8" HEX TILE').size, '8" Hex');
  assert.equal(splitSizeFromDescription("MOROCCAN CONC OFF WHITE 12X24 RECT *NEW PKG").size, "12x24");
});

test("splitSizeFromDescription: shape word BEFORE the size (MLS/ANA EFT hex rows)", () => {
  // ANALMCPHEX2PN — the reported row: 'HEXAGON 2 INCH' left the size cell empty.
  assert.deepEqual(splitSizeFromDescription("LA MARCA CALACATTA PAONAZZO HEXAGON 2 INCH POL *2022 PROD"), { size: '2" Hexagon', thickness: "", name: "La Marca Calacatta Paonazzo Pol *2022 Prod", sheetSize: "" });
  // 'HEX 3 IN' — bare IN counts as the inch mark.
  assert.deepEqual(splitSizeFromDescription("LUXURY AMANI GREY HEX 3 IN POLISHED"), { size: '3" Hex', thickness: "", name: "Luxury Amani Grey Polished", sheetSize: "" });
  // 'HEXAGON MOSAIC 2"' — the MOSAIC between shape and size stays in the name.
  assert.deepEqual(splitSizeFromDescription('JEM ARIA GOLD HEXAGON MOSAIC 2" MATTE'), { size: '2" Hexagon', thickness: "", name: "Jem Aria Gold Mosaic Matte", sheetSize: "" });
  assert.equal(splitSizeFromDescription('SHAPES METROPOLIS HEXAGON 10" CHISELED RECT').size, '10" Hexagon');
  assert.equal(splitSizeFromDescription("MAYFAIR ALLURE IVORY HEXAGON MOSAIC 1.25 INCH POL*NEW PKG*").size, '1.25" Hexagon');
  // The number-first spelling now takes a spelled-out inch word too.
  assert.equal(splitSizeFromDescription("MOROCCAN CONC OFF WHITE 2 INCH HEX TILE").size, '2" Hex');
  // No inch mark on the number → not a size ("HEXAGON 2022 PROD" stays a name).
  assert.equal(splitSizeFromDescription("ODDBALL GREY HEXAGON 2022 PROD").size, "");
});

test("splitSizeFromDescription: a parenthesized SHEET token is the sheet, not the tile size (MLSMBOGHEXM/P)", () => {
  // The reported MLS marble rows: "(9X11 SHEET)" is the backing sheet — it lands
  // in `sheetSize`, the chip `size` stays empty (the description names no chip),
  // and the parens leave no litter in the name (ADR 0014).
  assert.deepEqual(splitSizeFromDescription("MARBLES ONICIATA GREY HEX MOSAIC MATTE (9X11 SHEET)"), { size: "", thickness: "", name: "Marbles Oniciata Grey Hex Mosaic Matte", sheetSize: "9x11" });
  assert.deepEqual(splitSizeFromDescription("MARBLES ONICIATA GREY HEX MOSAIC POLISHED (9X11 SHEET)"), { size: "", thickness: "", name: "Marbles Oniciata Grey Hex Mosaic Polished", sheetSize: "9x11" });
});

test("splitSizeFromDescription: penny rounds are one shape labeled Penny, size before/after/absent (ADR 0015)", () => {
  // Size AFTER the shape, spelled "3/4 INCH" — the reported ANASOCCPENNY34 rows.
  assert.deepEqual(splitSizeFromDescription("SOHO CEMENT CHIC PENNY ROUND MOSAIC 3/4 INCH GLOSSY"), { size: '3/4" Penny', thickness: "", name: "Soho Cement Chic Mosaic Glossy", sheetSize: "" });
  // Size BEFORE the shape, jammed against it with an inch mark.
  assert.deepEqual(splitSizeFromDescription('SOHO CANVAS WHITE 3/4"PENNY RND GLOSSY *NEW PKG*'), { size: '3/4" Penny', thickness: "", name: "Soho Canvas White Glossy *New Pkg*", sheetSize: "" });
  // A bare number right before the shape (no inch mark) still reads (ticket 009).
  assert.equal(splitSizeFromDescription("1 Penny Round White").size, '1" Penny');
  // No printed chip size → a "Penny" sheet (sheetSize), the chip typed on the row.
  const noSize = splitSizeFromDescription("ELEMENT CLOUD PENNY ROUND MOSAIC");
  assert.equal(noSize.size, "");
  assert.equal(noSize.sheetSize, "Penny");
  assert.equal(noSize.name, "Element Cloud Mosaic");
  // "penny round" never splits into the standalone shape word "Round".
  assert.doesNotMatch(splitSizeFromDescription("SOHO GALLERY GREY PENNY ROUND MOSAIC 3/4 INCH GLOSSY").size, /Round/);
});

test("parseMapped: a mosaic sheet with SF/CT N/A derives coverage and a labeled sheet size (ADR 0014)", () => {
  const mapping = {
    headerRow: 0,
    columns: { 0: "sku", 1: "description", 2: "cost", 3: "priceUnit", 4: "orderUnit", 5: "pcPerUnit", 6: "sfPerUnit" },
    skuPattern: "^[A-Z0-9]{6,20}$",
    defaultType: "tile",
  };
  const rows = [
    ["SKU", "DESC", "COST", "PRICE UM", "NO BROKEN UM", "PC/CT", "SF/CT"],
    ["MLSMBOGHEXM", "MARBLES ONICIATA GREY HEX MOSAIC MATTE (9X11 SHEET)", "29.24", "PC", "SH", "10", "N/A"],
  ];
  const { items } = parseMapped(rows, mapping);
  const it = items.find((i) => i.sku === "MLSMBOGHEXM");
  assert.equal(it.size, "");                    // the sheet L×W is never the chip size
  assert.equal(it.sheetSize, "9x11");
  assert.equal(it.description, "Marbles Oniciata Grey Hex Mosaic Matte");
  // 9×11 in = 0.6875 sf/sheet × 10 sheets/carton = 6.875 sf/carton.
  assert.equal(it.sfPerUnit, 6.875);
});

test("mmToFraction: metric thickness → the fraction the trade calls it", () => {
  assert.equal(mmToFraction(6), '1/4"');
  assert.equal(mmToFraction(8), '5/16"');
  assert.equal(mmToFraction(10), '3/8"');
  assert.equal(mmToFraction(12), '1/2"');
  assert.equal(mmToFraction(20), '3/4"'); // trade call-out, not the nearest 1/16 (13/16")
  assert.equal(mmToFraction(25.4), '1"'); // a whole inch collapses
  assert.equal(mmToFraction(""), "");
  assert.equal(mmToFraction("nope"), "");
});

test("mappedSkuRe: the default pattern requires at least one digit", () => {
  const re = mappedSkuRe();
  assert.equal(re.test("ABC123"), true);
  assert.equal(re.test("ABCDEF"), false); // no digit → not a SKU
  assert.equal(re.test(""), false);
});

// --- mapped-import guessers + VTC EFT template recognizer ----------------------

test("guessBookField: consumer price wins over the dealer-cost matcher", () => {
  // Both VTC columns carry "Dealer"; the consumer column must map to msrp and
  // the dealer column to cost — never the other way round (which drops cost).
  assert.equal(guessBookField("CONSUMER LEVEL PRICE (Dealer to Consumer)"), "msrp");
  assert.equal(guessBookField("DEALER PRICE (VTC to Dealer)"), "cost");
  assert.equal(guessBookField("VTC Item Code"), "sku");
  assert.equal(guessBookField("Price U/M"), "priceUnit");
  assert.equal(guessBookField("No Broken U/M"), "orderUnit");
});

test("bestDataSheet: picks the sheet with the best header, not the biggest", () => {
  const helper = { name: "Helper Sheet", rows: Array.from({ length: 50 }, () => ["x", "y"]) };
  const data = { name: "MFG Data", rows: [
    ["title"], ["legend"],
    ["", "VTC MFG", "VTC Item Code", "DEALER PRICE", "Price U/M", "SF/CT"],
    ["", "ANA", "ANAALCA1224", 2.59, "SF", 15.5],
  ] };
  assert.equal(bestDataSheet([helper, data]).name, "MFG Data");
  assert.equal(bestDataSheet([data, helper]).name, "MFG Data");
});

test("columnsFromHeader: labels the blank description column right of the SKU", () => {
  const cols = columnsFromHeader(["", "VTC MFG", "VTC Item Code", "", "DEALER PRICE"]);
  assert.equal(cols[2], "sku");
  assert.equal(cols[3], "description"); // blank header, immediately right of SKU
  assert.equal(cols[4], "cost");
});

// One VTC "EFT" workbook: an oversized junk Helper Sheet plus the real data
// sheet whose header sits below a title block. Column 0 is a headerless status
// flag; columns 8/9 are the consumer/dealer prices; some item codes carry no
// digit. The recognizer must handle all of it in one step.
const EFT_WORKBOOK = [
  { name: "Helper Sheet", rows: Array.from({ length: 30 }, (_, i) => [`H${i}`, "junk"]) },
  { name: "MFG Data", rows: [
    ["Account Name: KEIM LUMBER"], ["p VIRGINIATILE"], ["blank"],
    ["", "VTC MFG", "VTC Color", "VTC Pattern", "VTC Item Code", "VTC Description", "Product Line Name", "VTC ESTIMATED LEAD TIME", "CONSUMER LEVEL PRICE (Dealer to Consumer)", "DEALER PRICE (VTC to Dealer)", "Price U/M", "No Broken U/M", "PC/CT", "SF/CT", "Additional Comments"],
    ["v", "ANA", "ALCA", "1224", "ANAALCA1224", "ALTEZZA CARRARA 12X24", "ALTEZZA", "READY SHIP", 2.59, 2.29, "SF", "CT", 8, 15.5, ""],
    ["*", "ANA", "SLAB", "4848", "ANASLAB4848", "BIG SLAB 48X48", "SLAB", "IMPORT", 40, 32, "SF", "PC", "", 16, ""],
    ["xx", "WOW", "ALPL", "RNDEDGE", "WOWALPLRNDEDGE", "ALCHEMIST POOL ROUNDED EDGE", "ALCHEMIST", "READY SHIP", 9.5, 7.25, "PC", "PC", "", "", "old code"],
  ] },
  { name: "Comments & Key", rows: [["KEY"], ["v New Product"]] },
];

test("detectVtcEft: finds the data sheet, maps every column, sets pattern + flags", () => {
  const m = detectVtcEft(EFT_WORKBOOK);
  assert.ok(m, "signature recognized");
  assert.equal(m.sheet, "MFG Data");
  assert.equal(m.headerRow, 3);
  assert.equal(m.columns[0], "flag");        // headerless, left of VTC MFG
  assert.equal(m.columns[1], "mfg");
  assert.equal(m.columns[4], "sku");
  assert.equal(m.columns[5], "description");
  assert.equal(m.columns[8], "msrp");         // consumer → msrp (not cost)
  assert.equal(m.columns[9], "cost");         // dealer → cost
  assert.equal(m.columns[10], "priceUnit");
  assert.equal(m.columns[11], "orderUnit");
  assert.equal(m.groupBy, "mfg");
  assert.equal(m.defaultType, "tile");
  assert.equal(m.flags["*"], "freight");
  assert.equal(m.flags["†"], "freight");
  assert.equal(m.flags["xx"], "discontinued");
});

test("detectVtcEft: the mapping parses all rows incl. digit-free item codes", () => {
  const m = detectVtcEft(EFT_WORKBOOK);
  const data = EFT_WORKBOOK.find((s) => s.name === m.sheet);
  const { items } = parseMapped(data.rows, m);
  assert.equal(items.length, 3); // WOWALPLRNDEDGE (no digit) is NOT dropped
  const carrara = items.find((i) => i.sku === "ANAALCA1224");
  assert.equal(carrara.cost, 2.29);   // dealer, not the 2.59 consumer price
  assert.equal(carrara.msrp, 2.59);
  assert.equal(carrara.mfg, "ANA");
  assert.equal(carrara.type, "tile");
  assert.equal(items.find((i) => i.sku === "ANASLAB4848").freightFlag, true);
  assert.equal(items.find((i) => i.sku === "WOWALPLRNDEDGE").discontinued, true);
});

test("detectStockWorkbook: two distinctive sheet names ⇒ true; a lone vendor sheet ⇒ false", () => {
  assert.equal(detectStockWorkbook([{ name: "Grout & Caulk", rows: [] }, { name: "Tile", rows: [] }, { name: "Index", rows: [] }]), true);
  assert.equal(detectStockWorkbook([{ name: "Tile", rows: [] }]), false); // one name alone isn't enough
  assert.equal(detectStockWorkbook([{ name: "EFT", rows: [["Item Code"]] }]), false);
  assert.equal(detectStockWorkbook([]), false);
});

test("detectVtcEft: returns null when the signature is absent", () => {
  assert.equal(detectVtcEft([{ name: "Sheet1", rows: [["Name", "Price"], ["Oak", 5]] }]), null);
  assert.equal(guessHeaderRow([["nope"], ["still nope"]]), -1);
});
