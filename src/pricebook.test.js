import { test } from "node:test";
import { rowAdvisories, pricedItem } from "./orderbook.js";
import assert from "node:assert/strict";
import { stockPatch } from "./stock.js";
import { parseMapped, mappedSkuRe, splitSizeFromDescription, mmToFraction, guessBookField, guessHeaderRow, bestDataSheet, columnsFromHeader, detectVtcEft, detectVendorSkuAnalysis, floorTypeFromDescription, schluterDescription } from "./pricebook.js";

const sheet = (name, rows) => ({ name, rows });
const bySku = (items, sku) => items.find((i) => i.sku === sku);

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

test("parseMapped: a piece-priced trim reclassifies to a count line at import (ADR 0013 amendment)", () => {
  const rows = [
    ["", "VTC MFG", "VTC Color", "VTC Pattern", "VTC Item Code", "", "Product Line Name", "", "", "Dealer", "Price U/M", "No Broken U/M", "PC/CT", "SF/CT", ""],
    // The real end cap: notional 121.1 SF/CT (45 pcs × 1 m²) on a per-piece trim.
    ["", "ADX", "NEBL", "BASE12EDS", "ADXNEBLBASE12EDS", "NERI BLACK BASE BOARD END CAP 12 IN SATIN", "NERI", "", "", 23.89, "PC", "PC", 45, 121.1, ""],
    // A genuine SF-priced field tile in the same sheet stays flooring.
    ["", "ADX", "EAAS", "312", "ADXEAAS312", "EARTH ASH GRAY 3X12", "EARTH", "", "", 11.64, "SF", "PC", 50, 12.5, ""],
  ];
  const mapping = {
    headerRow: 0, skuPattern: "^[A-Z0-9]{6,20}$", defaultType: "tile",
    columns: { 1: "mfg", 2: "color", 3: "style", 4: "sku", 5: "description", 6: "productLine", 9: "cost", 10: "priceUnit", 11: "orderUnit", 12: "pcPerUnit", 13: "sfPerUnit" },
  };
  const { items } = parseMapped(rows, mapping);
  const trim = bySku(items, "ADXNEBLBASE12EDS");
  assert.equal(trim.trim, true);
  assert.equal(trim.type, null);            // count line — quotes per piece
  assert.equal(trim.trimSignal, "lexicon"); // provenance for review list & chips
  assert.equal(trim.cost, 23.89);           // cost untouched, still per piece
  const tile = bySku(items, "ADXEAAS312");
  assert.equal(tile.trim, false);
  assert.equal(tile.type, "tile");
  assert.equal(tile.trimSignal, "");
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

test("parseMapped: a description leading with the ABBREVIATED product line isn't doubled (Marazzi)", () => {
  // The MRZ EFT sheet abbreviates the series inside the description
  // ("MOROCCAN CONC CHARCOAL…") while the Product Line column spells it out
  // ("MOROCCAN CONCRETE"), which used to import as
  // "Moroccan Concrete Moroccan Conc Charcoal Rect". The abbreviation counts
  // as the series already leading, and the label keeps the full spelling.
  const rows = [
    ["", "VTC MFG", "VTC Color", "VTC Pattern", "VTC Item Code", "", "Product Line Name", "", "", "Dealer", "Price U/M", "No Broken U/M", "PC/CT", "SF/CT", ""],
    ["", "MRZ", "MC57", "1224RN", "MRZMC571224RN", "MOROCCAN CONC CHARCOAL 12X24 RECT *NEW PKG", "MOROCCAN CONCRETE             ", "", "", 3.27, "SF", "CT", 9, 17.02, ""],
    ["", "MRZ", "MS01", "WL", "MRZMS01WL", "MIDDLETON SQ WALL LATTE GLOSS", "MIDDLETON SQUARE", "", "", 2.9, "SF", "CT", 10, 12.5, ""],
    ["", "ADX", "EARI", "312", "ADXEARI312", "EARTHEN RIDGE 3X12", "EARTH", "", "", 11.64, "SF", "PC", 50, 12.5, ""],
  ];
  const mapping = {
    headerRow: 0, skuPattern: "^[A-Z0-9]{6,20}$", defaultType: "tile",
    columns: { 1: "mfg", 2: "color", 3: "style", 4: "sku", 5: "description", 6: "productLine", 9: "cost", 10: "priceUnit", 11: "orderUnit", 12: "pcPerUnit", 13: "sfPerUnit" },
  };
  const { items } = parseMapped(rows, mapping);
  // "*NEW PKG" is ERP repack noise and "RECT" an edge stamp — normOrderItem's
  // cleanDescription drops both.
  assert.equal(bySku(items, "MRZMC571224RN").description, "Moroccan Concrete Charcoal");
  assert.equal(bySku(items, "MRZMC571224RN").size, "12x24");
  // A 2-letter abbreviation counts once the lead word has anchored the match.
  assert.equal(bySku(items, "MRZMS01WL").description, "Middleton Square Wall Latte Gloss");
  // A shared stem is NOT an abbreviation — "Earthen" doesn't lead with "Earth",
  // so that product line still fronts the label.
  assert.equal(bySku(items, "ADXEARI312").description, "Earth Earthen Ridge");
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

test("parseMapped: an accessory description with nothing to extract still Title-Cases", () => {
  // The LATDSGRACS10OZ report: no size/thickness/sheet in the text meant the
  // split's smartCase never ran and the row imported SHOUTING — worse when a
  // Title-Cased product line joined on and the mixed result dodged the
  // no-lowercase test downstream.
  const rows = [
    ["", "VTC MFG", "Color", "Pattern", "VTC Item Code", "", "Product Line", "", "", "Dealer", "U/M", "", "", "", ""],
    ["", "LAT", "", "", "LATDSGRACS10OZ", "GROUT ADMIX ACRYLIC 10 OZ", "PERMACOLOR", "", "", 8.5, "EA", "", "", "", ""],
  ];
  const mapping = {
    headerRow: 0, skuPattern: "^[A-Z0-9]{9,16}$",
    columns: { 1: "mfg", 2: "color", 3: "style", 4: "sku", 5: "description", 6: "productLine", 9: "cost", 10: "unit" },
  };
  const t = bySku(parseMapped(rows, mapping).items, "LATDSGRACS10OZ");
  assert.equal(t.description, "Permacolor Grout Admix Acrylic 10 Oz");
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

test("parseMapped: a review map mutes warnings for codes already confirmed/ignored on the book", () => {
  const rows = [
    ["", "VTC MFG", "Color", "Pattern", "VTC Item Code", "", "Product Line", "Lead Time", "Consumer", "Dealer", "U/M", "No Broken", "PC/CT", "SF/CT", ""],
    ["", "CER", "", "3x12", "CER0000021", "BULLNOSE 3X12", "PRESLEY", "", 12, 9, "PC", "CT", "", 5.38, ""],
  ];
  const mapping = { ...VTC_MAPPING, headerRow: 0, columns: { ...VTC_MAPPING.columns, 11: "orderUnit" } };
  const before = parseMapped(rows, mapping);
  assert.ok(before.warnings.some((w) => /no PC\/CT column mapped/.test(w)));
  const review = new Map([["CER0000021", { "no-pc-carton": { state: "confirmed", by: "", at: 1 } }]]);
  const after = parseMapped(rows, mapping, review);
  assert.equal(after.warnings.some((w) => /no PC\/CT column mapped/.test(w)), false);
  assert.equal(after.items.length, before.items.length); // muting warns, never rows
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

test("splitSizeFromDescription: a bare T×W×L triple is a board — thickness split out, no dim litter in the name", () => {
  // the ERP stock export prints KERDI-BOARD panels markless; the old read
  // took "0.5x48" as the size and left "X64" in the name
  assert.deepEqual(splitSizeFromDescription("0.5 X 48 X 64 KERDI-BOARD PANEL"),
    { size: "48x64", thickness: '0.5"', name: "Kerdi-Board Panel", sheetSize: "" });
  assert.deepEqual(splitSizeFromDescription("KERDI BOARD 1/2 X 48 X 64"),
    { size: "48x64", thickness: '1/2"', name: "Kerdi Board", sheetSize: "" });
  // no sub-1.5" dim → not a board: the plain first-two read stands
  assert.equal(splitSizeFromDescription("MOSAIC BLEND 12 X 24 X 36").size, "12x24");
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
  // A SPACE-spelled mixed fraction parses whole too — the Glazzio long-hex
  // pages print "2 1/2X1" (CLNL289 report, 2026-08-26); reading from the
  // middle made the chip 0.5x1 and left a stray "2" in the name.
  assert.deepEqual(splitSizeFromDescription("LONG HEX VILLAGE SQUARE 2 1/2X1"), { size: "2.5x1", thickness: "", name: "Long Hex Village Square", sheetSize: "" });
  assert.deepEqual(splitSizeFromDescription('LONG HEX VILLAGE SQUARE 2 1/2" X 1"'), { size: "2.5x1", thickness: "", name: "Long Hex Village Square", sheetSize: "" });
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

test("splitSizeFromDescription: leading-decimal dims (VTC pencil/edge trim, no leading zero)", () => {
  // VTC writes edge/pencil trim widths as a bare decimal — ".43X12", ".3X4.6".
  // SIZE_RE's DIM required a digit before the dot, so the leading "." was dropped:
  // ".43X12" read as "43x12" (100× too wide) and left a stray "." in the name.
  assert.deepEqual(splitSizeFromDescription("CRAFTED WHITE .43X12 ROUNDED EDGE"), { size: "0.43x12", thickness: "", name: "Crafted White Rounded Edge", sheetSize: "" });
  assert.deepEqual(splitSizeFromDescription("BITS CELADON .3X4.6 GLOSS"), { size: "0.3x4.6", thickness: "", name: "Bits Celadon Gloss", sheetSize: "" });
  // A leading zero was always fine and must stay fine.
  assert.equal(splitSizeFromDescription("POTTERS SWAN ROUNDED EDGE 0.5X10 GLOSSY").size, "0.5x10");
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

test("parseMapped: a mosaic's bare L\u00d7W that covers the whole piece is the sheet, not the chip (VTCTUWHMOSHEX, ADR 0014)", () => {
  // The VTC Tuscany hex mosaics print only the backing sheet — "HEXAGON MOSAIC
  // 10X12" — with no SHEET word and no chip. SIZE_RE read it as a 10×12 tile
  // (Marcus 2026-09-16: "no sheet size"). The row's own coverage settles it:
  // 4.09 SF/CT ÷ 5 PC/CT = 0.818 sf per piece ≈ 10×12 in², so those dims are
  // the whole piece — a chip can't be. Other books print the chip in the same
  // spot ("BOOST GREY MOSAIC 2X2", 0.028 sf vs 0.969 per sheet), which stays.
  const mapping = {
    headerRow: 0,
    columns: { 0: "sku", 1: "description", 2: "cost", 3: "unit", 4: "orderUnit", 5: "pcPerUnit", 6: "sfPerUnit" },
    skuPattern: "^[A-Z0-9]{6,20}$",
    defaultType: "tile",
  };
  const rows = [
    ["SKU", "DESC", "COST", "UM", "NO BROKEN", "PC/CT", "SF/CT"],
    ["VTCTUWHMOSHEX", "TUSCANY WHITE HEXAGON MOSAIC 10X12", "23.44", "PC", "PC", "5", "4.09"],
    ["ISASHBIINTRECCIO", "SHIBUSA BIANCO INTRECCIO MOS=I 12X12", "14.1", "SF", "SH", "5", "4.84"],
    ["VTCORBBINTHEXR", "ORLEANS BEIGE & BLACK ++ INTERLCK HEX MOSAIC 12X10", "9.5", "SF", "SH", "12", "5.47"],
    ["ATLBOGRMOS22", "BOOST GREY MOSAIC 2X2==", "5.9", "SF", "SH", "10", "9.69"],
    ["CRVAV341MOS212U", "ALTERED STATE WHITE HOT MOS 2X12 UNPOL CROSS SHEEN", "12", "SF", "SH", "8", "7.68"],
    ["MLSABBR1224", "ABSOLUTE BROWN 12X24", "2.1", "SF", "CT", "8", "16"],
    ["MLSNOCOV", "NO COVERAGE HEX MOSAIC 10X12", "23.44", "PC", "PC", "", "N/A"],
  ];
  const { items } = parseMapped(rows, mapping);
  const by = (sku) => items.find((i) => i.sku === sku);
  const tus = by("VTCTUWHMOSHEX");
  assert.equal(tus.size, "");                   // never the chip L×W
  assert.equal(tus.sheetSize, "10x12");
  assert.equal(tus.sfPerUnit, 4.09);            // the book's own SF/CT still wins
  assert.equal(tus.description, "Tuscany White Hexagon Mosaic");
  // The same rule across the sheet: a 12×12 = 1 sf sheet at 0.968 sf/piece, and
  // an interlocking 12×10 whose net coverage (0.456) is below its outline — a
  // chip is never HALF the piece, so ≥ half is the sheet.
  assert.equal(by("ISASHBIINTRECCIO").sheetSize, "12x12");
  assert.equal(by("ISASHBIINTRECCIO").size, "");
  assert.equal(by("VTCORBBINTHEXR").sheetSize, "12x10");
  // Chips stay chips: 2×2 on a ~1 sf sheet, 2×12 on a 0.96 sf sheet.
  assert.equal(by("ATLBOGRMOS22").size, "2x2");
  assert.equal(by("ATLBOGRMOS22").sheetSize, "");
  assert.equal(by("CRVAV341MOS212U").size, "2x12");
  assert.equal(by("CRVAV341MOS212U").sheetSize, "");
  // An ordinary tile's L×W always covers its whole piece — no mosaic word, no rule.
  assert.equal(by("MLSABBR1224").size, "12x24");
  assert.equal(by("MLSABBR1224").sheetSize, "");
  // No coverage to check against → unchanged (the L×W stays, as before).
  assert.equal(by("MLSNOCOV").size, "10x12");
  assert.equal(by("MLSNOCOV").sheetSize, "");
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

// The Schluter EFT (SLR_EFT_25_10_01): the same VTC template, but the brand
// line above the header reads "Schluter Systems" — membranes, profiles and
// setting materials, no flooring at all. Real rows, real SKUs. Coverage rides
// the description ("= 134.5 SF"), sizes come in every spelling Schluter owns:
// spaced feet-inches, quote-less feet-inches, FT/IN words, trailing stick
// lengths, three-dim boards, packaging counts.
const SLR_WORKBOOK = [
  { name: "MFG Data", rows: [
    ["Account Name: KEIM LUMBER"], ["p VIRGINIATILE"],
    [null, "Schluter Systems"], [],
    ["", "VTC MFG", "VTC Color", "VTC Pattern", "VTC Item Code", "VTC Description", "Product Line Name", "VTC ESTIMATED LEAD TIME", "CONSUMER LEVEL PRICE (Dealer to Consumer)", "DEALER PRICE (VTC to Dealer)", "Price U/M", "No Broken U/M", "PC/CT", "SF/CT", "Additional Comments"],
    ["", "SLR", "DIT", "30M", "SLRDITRA30M", "DITRA UNCOUPLING/WATERPROOF 3 FT 3 IN X 98 FT 5 IN=323 SF", "DITRA", "IMPORT", 1.17, 1.17, "SF", "RL", "N/A", "N/A", ""],
    ["", "SLR", "DH5", "12M", "SLRDH512M", "DITRA-HEAT MEMBRANE ROLL 3' 3\" X 41' 1\" = 134.5 SF", "DITRA HEAT", "READY SHIP", 1.74, 1.74, "SF", "RL", "N/A", "N/A", ""],
    ["", "SLR", "DHPS", "512M", "SLRDHPS512M", "DITRA-HEAT-PS ROLL 3'3 X 41'1 ", "DITRA HEAT", "READY SHIP", 2.18, 2.18, "SF", "RL", "N/A", "N/A", ""],
    ["", "SLR", "DHDPS", "810M", "SLRDHDPS810M", "DITRA-HEAT-DUO-PS ROLL 3'3\" X 33'", "DITRA HEAT", "READY SHIP", 3.12, 3.12, "SF", "RL", "N/A", "N/A", ""],
    ["", "SLR", "DH5", "MA", "SLRDH5MA", "DITRA-HEAT MEMBRANE SHEET 3' 2\" X 2' 7\" = 8.4 S.F.", "DITRA HEAT", "READY SHIP", 15.22, 15.22, "SH", "SH", "N/A", "N/A", ""],
    ["", "SLR", "DHEHK", "12011", "SLRDHEHK12011", "DITRA-HEAT CABLE 120V 10 SF", "DITRA HEAT", "READY SHIP", 133.61, 133.61, "EA", "EA", "N/A", "N/A", ""],
    ["", "SLR", "ASTF", "2240300", "SLRASTF2240300", "DILEX-STF STRUCTURAL MVMT JNT 22/40 10'", "DILEX", "IMPORT", 327.25, 327.25, "EA", "EA", "N/A", "N/A", ""],
    ["", "SLR", "BWA8", "0SP", "SLRBWA80SP", "DILEX-BWA 3/8 MVMT JNT 5/16 SAND PEBBLE.", "DILEX", "IMPORT", 13.77, 13.77, "PC", "PC", "N/A", "N/A", ""],
    ["", "SLR", "BTZ", "RG75100", "SLRBTZRG75100", "BEKOTEC-THERM-RH HEATING CLAMPS (100/BOX)", "BEKOTEC", "IMPORT", 42.97, 42.97, "CT", "CT", "N/A", "N/A", ""],
    ["", "SLR", "BRS", "808KF", "SLRBRS808KF", "BEKOTEC-BRS/KF ADHSTRIP 82FTX3-1/8INX5/16IN", "BEKOTEC", "IMPORT", 100.89, 100.89, "RL", "RL", "N/A", "N/A", ""],
    ["", "SLR", "EN23", "F10", "SLREN23F10", "BEKOTECF SCREED PANEL 471/4IN X 35-7/16IN (10/BOX)", "BEKOTEC", "IMPORT", 222.62, 222.62, "CT", "CT", 10, "N/A", ""],
    ["", "SLR", "KB15", "12203050", "SLRKB1512203050", "KERDIBOARD, PANEL 5/8IN X 48IN X 120IN", "KERDI BOARD", "IMPORT", 111.65, 111.65, "SH", "PA", "N/A", "N/A", "*PALLETS/SLR REP MUST APPROVE"],
  ] },
];

test("Schluter EFT: the brand line switches off the tile default and reads coverage from the text", () => {
  const m = detectVtcEft(SLR_WORKBOOK);
  assert.ok(m, "signature recognized");
  assert.equal(m.title, "Schluter Systems");
  assert.equal(m.defaultType, null);
  assert.ok(m.sfFromDescription);
  assert.ok(m.schluter, "the Schluter word/profile rules ride the mapping");
  const { items, warnings } = parseMapped(SLR_WORKBOOK[0].rows, m);
  assert.equal(items.length, 12);
  // Coverage-bearing membranes type as underlayment (spec 2026-09-18); nothing
  // else types as flooring — Schluter sells none.
  assert.ok(items.every((i) => i.type == null || i.type === "underlayment"), "nothing types as flooring — Schluter sells none");

  const by = (sku) => items.find((i) => i.sku === sku);
  // FT/IN words: the words become marks, coverage comes out of the "=323 SF".
  const ditra = by("SLRDITRA30M");
  assert.equal(ditra.size, `3'3"x98'5"`);
  assert.equal(ditra.sfPerUnit, 323);
  assert.equal(ditra.description, "Schluter Ditra Uncoupling/Waterproof");
  // Spaced feet-inches with the coverage after "=".
  const heat = by("SLRDH512M");
  assert.equal(heat.size, `3'3"x41'1"`);
  assert.equal(heat.sfPerUnit, 134.5);
  // Was "Ditra Heat Ditra-Heat Membrane Roll": the EFT product line no longer fronts a Schluter name.
  assert.equal(heat.description, "Schluter Ditra-Heat Membrane Roll");
  // Quote-less feet-inches ("3'3 X 41'1") — the inches close on their marks.
  assert.equal(by("SLRDHPS512M").size, `3'3"x41'1"`);
  // No stated coverage at all: the feet L×W IS the roll's area (SF-priced,
  // roll-sold — the row can't price without it).
  assert.equal(by("SLRDHDPS810M").sfPerUnit, 107.25);
  // The membrane SHEET: geometry-confirmed 8.4 sf, so no sf/sh? advisory, and
  // the vendor's trailing period is gone.
  const sheet = by("SLRDH5MA");
  assert.equal(sheet.size, `3'2"x2'7"`);
  assert.equal(sheet.sfPerUnit, 8.4);
  assert.deepEqual(rowAdvisories(sheet), []);
  // Schluter EFT membranes type as underlayment too — the one typing the EFT
  // does (ADR 0041 never types profiles or accessories).
  assert.equal(sheet.type, "underlayment");
  assert.equal(heat.type, "underlayment");
  assert.equal(by("SLRDITRA30M").type, "underlayment");
  // An EA-sold cable's "10 SF" is its kit size, not coverage — stays put.
  const cable = by("SLRDHEHK12011");
  assert.equal(cable.sfPerUnit, null);
  assert.match(cable.description, /10 SF/i);
  assert.equal(cable.type, null);
  // A trailing stick length is the size; the 22/40 profile spec stays a name.
  const stf = by("SLRASTF2240300");
  assert.equal(stf.size, "10'");
  assert.match(stf.description, /22\/40/);
  // Vendor punctuation: the trailing period drops, so no name-litter flag.
  assert.deepEqual(rowAdvisories(by("SLRBWA80SP")), []);
  // "(100/BOX)" with an empty PC/CT column: the count comes from the text.
  const clamps = by("SLRBTZRG75100");
  assert.equal(clamps.pcPerUnit, 100);
  assert.ok(!/100\/BOX/i.test(clamps.description));
  // Feet roll with a third ×-dimension: the tail is the thickness.
  const strip = by("SLRBRS808KF");
  assert.equal(strip.size, `82'x3-1/8"`);
  assert.equal(strip.thickness, `5/16"`);
  // "471/4IN" is 47-1/4 printed tight, never 471/4.
  assert.equal(by("SLREN23F10").size, "47.25x35.4375");
  // Three inch dims: the sub-inch one is the thickness, the panel is the size.
  const board = by("SLRKB1512203050");
  assert.equal(board.size, "48x120");
  assert.equal(board.thickness, `5/8"`);
  // Every warning line on this fixture is an honest hazard, not a mis-parse:
  // the pallet-sold board is the one unfamiliar unit.
  assert.equal(warnings.length, 1, warnings.join(" | "));
  assert.match(warnings[0], /PA/);
});

// --- Schluter profiles (owner, 2026-09-14) ------------------------------------
// The EFT's 5,800 profile rows print the thickness as a BARE fraction ("RONDEC
// BULLNOSE TRIM 3/8 ALUM TEXTURED IVORY"), state no length on a standard
// 8'2-1/2" stick, and file every Rondec under the "RONDEC CORNERS" product
// line. The owner wants them to read like the ERP stock book's own rows
// ("3/8\"x8' Schluter Rondec - …"): thickness × length in the size field (the
// implied stick shortened to 8'), the vendor shorthand spelled out, the bare
// ALUM dropped (aluminum is Schluter's default), a Schluter lead, and no
// product-line prefix. Real rows, real SKUs.
const prof = (desc, pl = "RONDEC CORNERS") => schluterDescription(desc, pl);

test("schluterDescription: a straight profile lands thickness × implied 8' stick, clean words, Schluter lead", () => {
  assert.deepEqual(prof("RONDEC BULLNOSE TRIM 3/8 ALUM TEXTURED IVORY"), { size: `3/8"x8'`, thickness: `3/8"`, name: "Schluter Rondec Bullnose Trim Textured Ivory" });
  // PVC is not the default material, so it stays; a hyphen suffix code keeps its caps.
  assert.deepEqual(prof("JOLLY-P EDGE TRIM 3/8 PVC BAHAMA", "JOLLY"), { size: `3/8"x8'`, thickness: `3/8"`, name: "Schluter Jolly-P Edge Trim PVC Bahama" });
  // A stated length wins over the implied stick; feet words normalize.
  assert.deepEqual(prof("QUADEC SQUARE TRIM 3/8 ALUM GREIGE 10'", "QUADEC"), { size: `3/8"x10'`, thickness: `3/8"`, name: "Schluter Quadec Square Trim Greige" });
  assert.deepEqual(prof("TREP-FL STAIR EDG 11/32IN BRH SS 4FT11IN", "TREP"), { size: `11/32"x4'11"`, thickness: `11/32"`, name: "Schluter Trep-FL Stair Edge Brushed Stainless Steel" });
  assert.deepEqual(prof(`TREP-V 42 7/16" SAND PEBBLE 4' 11"`, "TREP"), { size: `7/16"x4'11"`, thickness: `7/16"`, name: "Schluter Trep-V 42 Sand Pebble" });
  // "SS STAINLESS STEEL" says it twice; the alloy grade keeps its caps.
  assert.deepEqual(prof("QUADEC SQUARE EDGE 5/16 SS STAINLESS STEEL V4A", "QUADEC"), { size: `5/16"x8'`, thickness: `5/16"`, name: "Schluter Quadec Square Edge Stainless Steel V4A" });
  // A marked fraction with a spaced IN word: the word goes with the number.
  assert.deepEqual(prof("DECO-SG SHADOW GAP 7/16 IN BRUSH STN STEEL 15MM", "DECO"), { size: `7/16"x8'`, thickness: `7/16"`, name: "Schluter Deco-SG Shadow Gap Brushed Stainless Steel 15MM" });
  // The vendor's trailing period is punctuation, not information.
  assert.deepEqual(prof("VINPRO-S EDGE TRIM 5/16\" ALUM BRUSH BRONZE.", "VINPRO"), { size: `5/16"x8'`, thickness: `5/16"`, name: "Schluter Vinpro-S Edge Trim Brushed Bronze" });
});

test("schluterDescription: corners, connectors and end caps have no length — thickness only, or nothing", () => {
  // A leading angle moves behind the corner words.
  assert.deepEqual(prof("90 DEGREE JOLLY OUT CORNER 3/8 ALUM BRONZE", "JOLLY"), { size: `3/8"`, thickness: `3/8"`, name: "Schluter Jolly Out Corner 90° Bronze" });
  assert.deepEqual(prof("RONDEC-CT IN CRN 90 DEG 3/8 BRUSHED BRASS ALUM"), { size: `3/8"`, thickness: `3/8"`, name: "Schluter Rondec-CT In Corner 90° Brushed Brass" });
  assert.deepEqual(prof("RONDEC/QUADEC CONNECTOR 5/16 STAINLESS STEEL"), { size: `5/16"`, thickness: `5/16"`, name: "Schluter Rondec/Quadec Connector Stainless Steel" });
  assert.deepEqual(prof("QUADEC IN/OUT CRN 1/4 ALUM BLACK BROWN", "QUADEC"), { size: `1/4"`, thickness: `1/4"`, name: "Schluter Quadec In/Out Corner Black Brown" });
  assert.deepEqual(prof("DILEX-AHKA END CAP RIGHT TEXTURED ALUM PEWTER", "DILEX"), { size: "", thickness: "", name: "Schluter Dilex-AHKA End Cap Right Textured Pewter" });
  // A 90° EDGE TRIM is a straight stick, not a corner — the angle still moves behind the type words.
  assert.deepEqual(prof("90 DEGREE JOLLY EDGE TRIM 3/8 ALUM SATIN NICKEL 10'", "JOLLY"), { size: `3/8"x10'`, thickness: `3/8"`, name: "Schluter Jolly Edge Trim 90° Satin Nickel" });
});

test("schluterDescription: a width or joint fraction is not a thickness and stays in the name with its inch mark", () => {
  // DILEX movement joints print the JOINT width first and the tile thickness after it.
  assert.deepEqual(prof("DILEX-BWA 3/8 MVMT JNT 5/16 SAND PEBBLE.", "DILEX"), { size: `5/16"x8'`, thickness: `5/16"`, name: `Schluter Dilex-BWA 3/8" Movement Joint Sand Pebble` });
  assert.deepEqual(prof("DILEX-KSN 3/8 ALU W/ 7/16 JNT GROUT GREY", "DILEX"), { size: `3/8"x8'`, thickness: `3/8"`, name: `Schluter Dilex-KSN with 7/16" Joint Grout Grey` });
  assert.deepEqual(prof(`DECO 1/4" WIDE REVEAL 3/8" SATIN ANOD ALUMINUM`, "DECO"), { size: `3/8"x8'`, thickness: `3/8"`, name: `Schluter Deco 1/4" Wide Reveal Satin Anodized` });
  assert.deepEqual(prof("RENO-T 9/16 WIDE TRANSITION BRASS", "RENO"), { size: "", thickness: "", name: `Schluter Reno-T 9/16" Wide Transition Brass` });
  // ECK angles print W/H-suffixed leg dims and a mid-string length: no thickness, the stated length only.
  assert.deepEqual(prof("ECK-K 1-9/32W 10 FT STAINLESS STEEL", "ECK"), { size: "10'", thickness: "", name: `Schluter Eck-K 1-9/32" Wide Stainless Steel` });
  // A cove's two leg dims are an L×W of fractions: kept as vendor text, never a decimal tile size.
  assert.deepEqual(prof("DILEX-HKS COVE 5/16 X 11/32 SS V4A / CLASSIC GREY", "DILEX"), { size: `5/16"x11/32"`, thickness: "", name: "Schluter Dilex-HKS Cove Stainless Steel V4A Classic Grey" });
  // A whole-inch leg, and the vendor's "9/ 32" typo.
  assert.deepEqual(prof("DILEX-HKS COVE 1 X 7/16 SS GREY", "DILEX").size, `1"x7/16"`);
  assert.deepEqual(prof("DILEX-EHK COVE 9/ 32 X 9/32\" BRUSHED SS", "DILEX").size, `9/32"x9/32"`);
});

test("schluterDescription: a profile spec or face height is not a tile thickness", () => {
  // "22/40" is a DILEX-STF joint spec (no inch denominator), never a dimension.
  assert.deepEqual(prof("DILEX-STF STRUCTURAL MVMT JNT 22/40 10'", "DILEX"), { size: "10'", thickness: "", name: "Schluter Dilex-STF Structural Movement Joint 22/40" });
  // BARA balcony edges and DESIGNBASE bases print their face HEIGHT — it stays in the name.
  assert.deepEqual(prof("BARA-RW BALCONY EDGE 4-3/4 IN ALUM CLASSIC GREY", "BARA"), { size: "", thickness: "", name: `Schluter Bara-RW Balcony Edge 4-3/4" Classic Grey` });
  assert.deepEqual(prof(`BARA-RW RAD BALC EDGE 4-3/4" ALU ANTH GR`, "BARA").name, `Schluter Bara-RW Radius Balcony Edge 4-3/4" Anthracite Grey`);
  assert.deepEqual(prof("DILEX-AHK OUT CRN SQ 90 DEG POLISHED CHROME ANOD ALUM", "DILEX").name, "Schluter Dilex-AHK Out Corner Square 90° Polished Chrome Anodized");
  assert.deepEqual(prof("BARA-RW RADIUS BALCONY EDGE 9/16 IN ALUM CLASSIC GREY", "BARA").name, `Schluter Bara-RW Radius Balcony Edge 9/16" Classic Grey`);
  assert.deepEqual(prof("DESIGNBASE-SL OUT CRN 2-3/8 ALUM SATIN 90 DEG", "DESIGNBASE"), { size: "", thickness: "", name: `Schluter Designbase-SL Out Corner 2-3/8" Satin 90°` });
  // A ramp's width rides with a real tile thickness: the LAST tile-sized fraction is the thickness.
  assert.deepEqual(prof("RENO-RAMP 2-1/2 REDUCER 3/8 SATIN ALUM", "RENO"), { size: `3/8"x8'`, thickness: `3/8"`, name: `Schluter Reno-Ramp 2-1/2" Reducer Satin` });
  assert.deepEqual(prof("TREP-GB 2-5/32IN STAIR NOSING 9/16IN SS CLEAR 8FT", "TREP"), { size: `9/16"x8'`, thickness: `9/16"`, name: `Schluter Trep-GB 2-5/32" Stair Nosing Stainless Steel Clear` });
  // A mixed fraction printed tight ("111/32IN" = 1-11/32) reads whole, like the board rows' "471/4IN".
  assert.deepEqual(prof("TREPGKS 111/32IN STAIR NOSING SS CLEAR RETROFIT 8FT", "TREP").thickness, `1-11/32"`);
  // Thick-stone SCHIENE profiles really are 1-3/16" thick.
  assert.deepEqual(prof("SCHIENE EDGE TRIM 1-3/16 ALUMINUM SATIN", "SCHIENE"), { size: `1-3/16"x8'`, thickness: `1-3/16"`, name: "Schluter Schiene Edge Trim Satin" });
  // Slash-wrapped material tokens ("/ALU BASE/") are the same shorthand.
  assert.deepEqual(prof("TREPB 3/8IN /ALU BASE/ 21/8IN PVC YELLOW", "TREP"), { size: `3/8"x8'`, thickness: `3/8"`, name: `Schluter Trepb Base 2-1/8" PVC Yellow` });
  // "1IN" spells out like any other inch token.
  assert.deepEqual(prof("TREP-B INSERT 2-1/8IN PVC LT BEIGE 8FT", "TREP"), { size: "8'", thickness: "", name: `Schluter Trep-B Insert 2-1/8" PVC Light Beige` });
});

const SLR_PROFILE_ROWS = [
  ["", "SLR", "RO10", "0TSI", "SLRRO100TSI", "RONDEC BULLNOSE TRIM 3/8 ALUM TEXTURED IVORY", "RONDEC CORNERS                ", "READY SHIP", 26.68, 26.68, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "EVJ1", "00TSOB", "SLREVJ100TSOB", "90 DEGREE JOLLY OUT CORNER 3/8 ALUM BRONZE", "JOLLY", "READY SHIP", 9.1, 9.1, "EA", "PC", "N/A", "N/A", ""],
  ["", "SLR", "BWA8", "0SP", "SLRBWA80SP", "DILEX-BWA 3/8 MVMT JNT 5/16 SAND PEBBLE.", "DILEX", "IMPORT", 13.77, 13.77, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "KB15", "12203050", "SLRKB1512203050", "KERDIBOARD, PANEL 5/8IN X 48IN X 120IN", "KERDI BOARD", "IMPORT", 111.65, 111.65, "SH", "SH", "N/A", "N/A", ""],
  ["", "SLR", "SET", "A50W", "SLRSETA50W", "SCHLUTER ALL SET WHITE MOD 50 LB WHITE MODIFIED", "THIN SETS", "READY SHIP", 27.49, 27.49, "BG", "BG", "N/A", "N/A", ""],
];
const SLR_PROFILE_WORKBOOK = [{ name: "MFG Data", rows: [...SLR_WORKBOOK[0].rows.slice(0, 5), ...SLR_PROFILE_ROWS] }];

test("Schluter EFT: profile rows import like the stock book's, other rows keep the generic split plus the Schluter words", () => {
  const m = detectVtcEft(SLR_PROFILE_WORKBOOK);
  const { items } = parseMapped(SLR_PROFILE_WORKBOOK[0].rows, m);
  const by = (sku) => items.find((i) => i.sku === sku);
  const ro = by("SLRRO100TSI");
  assert.equal(ro.size, `3/8"x8'`);
  assert.equal(ro.thickness, `3/8"`);
  // No "Rondec Corners" prefix: the EFT's product line is a grouping label, not a series.
  assert.equal(ro.description, "Schluter Rondec Bullnose Trim Textured Ivory");
  assert.equal(ro.productLine, "RONDEC CORNERS");
  assert.equal(by("SLREVJ100TSOB").size, `3/8"`);
  assert.equal(by("SLREVJ100TSOB").description, "Schluter Jolly Out Corner 90° Bronze");
  assert.equal(by("SLRBWA80SP").description, `Schluter Dilex-BWA 3/8" Movement Joint Sand Pebble`);
  // A board is not a profile: the three-dim split still runs, the words still clean.
  const board = by("SLRKB1512203050");
  assert.equal(board.size, "48x120");
  assert.equal(board.thickness, `5/8"`);
  assert.equal(board.description, "Schluter Kerdiboard, Panel");
  // A description that already says Schluter is not doubled.
  assert.equal(by("SLRSETA50W").description, "Schluter All Set White Mod 50 LB White Modified");
  for (const it of items) assert.deepEqual(rowAdvisories(it), [], `${it.sku}: ${it.description}`);
});

// --- Schluter accessories (owner, 2026-09-14, second pass) --------------------
// The non-profile rows — KERDI, KERDI-BOARD, KERDI-LINE, drains, DITRA, kits —
// keep the generic split but get the same treatment: spaced inch words and
// space-spelled fractions marked, pack counts out of the name and into
// pieces-per-unit (and a stock-book-style "N ct" size, which is what the
// configurator counts fasteners from), dims kept whole, more shorthand.

test("splitSizeFromDescription: a mixed number's fraction tail is never a thickness, nor is a width", () => {
  assert.deepEqual(splitSizeFromDescription('KERDI-BOARD 1-5/8" SCREWS AND WASHERS'), { size: "", thickness: "", name: 'Kerdi-Board 1-5/8" Screws And Washers', sheetSize: "" });
  assert.deepEqual(splitSizeFromDescription('KERDI-BOARD-ZSD 3-1/2" ANCHOR'), { size: "", thickness: "", name: 'Kerdi-Board-Zsd 3-1/2" Anchor', sheetSize: "" });
  assert.equal(splitSizeFromDescription('TAPE 1/2" WIDTH DOUBLE SIDED').thickness, "");
  assert.equal(splitSizeFromDescription('OAK PLANK 5X48 3/8"').thickness, '3/8"'); // a real trailing thickness still reads
});

test("splitSizeFromDescription: a marked three-dim board up to 2\" thick is a board; a bare roll width is inches", () => {
  assert.deepEqual(splitSizeFromDescription('KERDI-BOARD-V 2"X 24.5"X 96" GROOVED BUILDING PANEL'), { size: "24.5x96", thickness: '2"', name: "Kerdi-Board-V Grooved Building Panel", sheetSize: "" });
  // The bare side of a feet roll is inches ("5 X 98 FT 5" is a 5" strip).
  assert.equal(splitSizeFromDescription("KERDI-FLEX WATERPROOFING STRIP 5 X 98 FT 5").size, `5"x98'5"`);
  // Spaced bare inches before ROLL count as inches ("16 FT 5 ROLL" is 16'5").
  assert.deepEqual(splitSizeFromDescription("KERDI-WATERPROOFING MEMBRANE 3 FT 3 X 16 FT 5 ROLL"), { size: `3'3"x16'5"`, thickness: "", name: "Kerdi-Waterproofing Membrane Roll", sheetSize: "" });
});

const SLR_ACCESSORY_ROWS = [
  ["", "SLR", "KD3", "FLKE", "SLRKD3FLKE", "KERDI-DRAIN FLANGE KIT 3 IN STAINLESS STEEL", "KERDI DRAIN KIT", "READY SHIP", 50, 50, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "KBSC", "115150152", "SLRKBSC115150152", "KERDI-BOARD-SC CURB 60 X 6 X 4 1/2", "KERDI BOARD", "READY SHIP", 59.1, 59.1, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "KBZS", "35GT32Z10", "SLRKBZS35GT32Z10", "KERDI-BOARD 1-5/8\" SCREWS AND WASHERS (100/EA)", "KERDI BOARD", "READY SHIP", 15.82, 15.82, "EA", "EA", "N/A", "N/A", ""],
  ["", "SLR", "KERECK", "FA2", "SLRKERECKFA2", "KERDI-KERECK-F PRE-FORMED OUT CORNER (2 PACK)", "KERDI", "READY SHIP", 10.85, 10.85, "PK", "PK", "N/A", "N/A", ""],
  ["", "SLR", "KM", "511722", "SLRKM511722", "KERDI-KM PIPE COLLARS 7X7 (5)", "KERDI", "READY SHIP", 20, 20, "PK", "PK", "N/A", "N/A", ""],
  ["", "SLR", "TRL", "DIT", "SLRTRLDIT", "DITRA-TROWEL 11/64\" X 11/64\" SQUARE NOTCH", "DITRA", "READY SHIP", 18.78, 18.78, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "KBSB", "410TA", "SLRKBSB410TA", "KERDI-BOARD-SB BENCH 16 X 16 X 20 TRIANGULAR", "KERDI", "READY SHIP", 108.47, 108.47, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "KERS", "20L", "SLRKERS20L", "KERDI-KERS SIDE CORNER LEFT H=20 MM", "KERDI", "READY SHIP", 12, 12, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "KST", "965BF", "SLRKST965BF", "KERDI-SHOWER-TT TRAY 38X38 CENTER DRA PLACEMENT", "KERDI", "READY SHIP", 71.64, 71.64, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "KST", "965810BF", "SLRKST965810BF", "KERDI-SHOWER-TRAY-THIN 38X32 CENTER DRAIN", "KERDI SHOWER KIT", "READY SHIP", 84.52, 84.52, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "SPWS", "19AE", "SLRSPWS19AE", "SHOWERPROFILE-WS SPLASHGUARD TRIM 8 FT 2.5 IN", "KERDI SHOWER RAMP", "READY SHIP", 40, 40, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "DITRA", "XL", "SLRDITRAXL", "DITRA XL UNCPLING / WATRPROOF 3 FT 3 IN X 53 FT 3 IN=175 SF", "DITRA", "READY SHIP", 1.5, 1.5, "SF", "RL", "N/A", "N/A", ""],
  ["", "SLR", "KD2", "ABSEKIT", "SLRKD2ABSEKIT", "KERDI-DRAIN KIT ABS 4 INCH SS (DRAIN,CORNERS,SEALS)", "KERDI DRAIN KIT", "READY SHIP", 120, 120, "EA", "EA", "N/A", "N/A", ""],
  ["", "SLR", "DHERT", "103BW", "SLRDHERT103BW", "DITRA-HEAT THERMOSTAT W/GFCI NON-PROGRAMMABLE", "DITRA HEAT", "READY SHIP", 150, 150, "EA", "EA", "N/A", "N/A", ""],
  ["", "SLR", "EKBZA", "38EB", "SLREKBZA38EB", "KERDI-BOARD-ZA/E 1.5\" OUT CRN FOR ZA  BRUSHED ST STEEL", "KERDI BOARD", "READY SHIP", 30, 30, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "KBZDK", "1210M", "SLRKBZDK1210M", "KERDI-BOARD-ZDK 1/2\" WIDTH DOUBLE SIDED TAPE (33 LF/RL)", "KERDI BOARD", "READY SHIP", 20, 20, "RL", "RL", "N/A", "N/A", ""],
  ["", "SLR", "KL1AR", "19MGS70", "SLRKL1AR19MGS70", "KERDI-LINE 3/4\" FRAME 28\" SOLID GRATE MATTE BLACK", "KERDI LINE", "READY SHIP", 200, 200, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "KL1B", "30EB120", "SLRKL1B30EB120", "KERDI-LINE 1-1/8 FRAME 48 IN PERFORATED GRATE", "KERDI LINE", "READY SHIP", 300, 300, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "KLVR", "ID13MGS12", "SLRKLVRID13MGS12", "KERDI-LINE-VARIO 4' D13-HERRINGBONE MATTE BLACK", "KERDI LINE", "READY SHIP", 250, 250, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "KMS", "1017220", "SLRKMS1017220", "KERDI-SEAL PS 3/4 IN PIPE SEAL W/OVERMOLD RUBBER GASKET 10 PK", "KERDI", "READY SHIP", 50, 50, "PK", "PK", "N/A", "N/A", ""],
  ["", "SLR", "ETV", "60SG", "SLRETV60SG", "TREP-V 60 END CAP STONE GREY (R+L)", "TREP", "READY SHIP", 5, 5, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "SWS", "1D5TSOB", "SLRSWS1D5TSOB", "SHELF RECTANGULAR WALL FLORAL BRONZE (ALUM)", "SHELF", "READY SHIP", 60, 60, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "KBZSD", "110Z", "SLRKBZSD110Z", "KERDI-BOARD-ZSD 4-5/16\" ANCHOR (25 ANCHORS/BOX) GALV STEEL", "KERDI BOARD", "READY SHIP", 30, 30, "EA", "EA", "N/A", "N/A", ""],
  ["", "SLR", "AKWS", "160PG", "SLRAKWS160PG", "DILEX-AKWS 5/8 ALU W/ 1/4 JOINT CL GREY", "DILEX", "READY SHIP", 20, 20, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "KSLT", "9151830S", "SLRKSLT9151830S", "KERDI-SHOWER-LTS TRAY 36X72 PERIMETER DRAIN 36 INCH SIDE", "KERDI LINE", "READY SHIP", 204.2, 204.2, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "KDH2", "PVCFL", "SLRKDH2PVCFL", "KERDI-DRAIN WITH HORIZONTAL OUTLET, 2 IN PVC, W/O CRN/SEAL", "KERDI DRAIN KIT", "READY SHIP", 90, 90, "EA", "EA", "N/A", "N/A", ""],
  ["", "SLR", "KD2", "ETHFL", "SLRKD2ETHFL", "KERDI-DRAIN ST. STEEL THREADED FLANGE KIT 2 IN", "KERDI DRAIN KIT", "READY SHIP", 80, 80, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "QK", "125ABGB", "SLRQK125ABGB", "QUADEC-K W/O ANCHORING LEG 1/2 BRUSHED ANTIQUE BRONZE ANOD AL", "QUADEC", "READY SHIP", 20, 20, "PC", "PC", "N/A", "N/A", ""],
];
const SLR_ACCESSORY_WORKBOOK = [{ name: "MFG Data", rows: [...SLR_WORKBOOK[0].rows.slice(0, 5), ...SLR_ACCESSORY_ROWS] }];

test("Schluter EFT accessories: inch words marked, dims kept whole, pack counts out of the name, shorthand spelled out", () => {
  const m = detectVtcEft(SLR_ACCESSORY_WORKBOOK);
  const { items } = parseMapped(SLR_ACCESSORY_WORKBOOK[0].rows, m);
  const by = (sku) => items.find((i) => i.sku === sku);
  const row = (sku, size, thickness, description) => {
    const it = by(sku);
    assert.deepEqual({ size: it.size, thickness: it.thickness, description: it.description }, { size, thickness, description }, sku);
  };
  row("SLRKD3FLKE", "", "", 'Schluter Kerdi-Drain Flange Kit 3" Stainless Steel');
  row("SLRKBSC115150152", `60"x6"x4-1/2"`, "", "Schluter Kerdi-Board-SC Curb");
  row("SLRKBZS35GT32Z10", "100 ct", "", 'Schluter Kerdi-Board 1-5/8" Screws and Washers');
  assert.equal(by("SLRKBZS35GT32Z10").pcPerUnit, 100);
  row("SLRKERECKFA2", "2 ct", "", "Schluter Kerdi-Kereck-F Pre-Formed Out Corner");
  assert.equal(by("SLRKERECKFA2").pcPerUnit, 2);
  row("SLRKM511722", "7x7", "", "Schluter Kerdi-KM Pipe Collars");
  assert.equal(by("SLRKM511722").pcPerUnit, 5);
  row("SLRTRLDIT", `11/64"x11/64"`, "", "Schluter Ditra-Trowel Square Notch");
  row("SLRKBSB410TA", `16"x16"x20"`, "", "Schluter Kerdi-Board-SB Bench Triangular");
  row("SLRKERS20L", "", "", "Schluter Kerdi-KERS Side Corner Left H=20 MM");
  row("SLRKST965BF", "38x38", "", "Schluter Kerdi-Shower-TT Tray Center Drain Placement");
  row("SLRKST965810BF", "38x32", "", "Schluter Kerdi-Shower-Tray-Thin Center Drain");
  row("SLRSPWS19AE", "8'", "", "Schluter Showerprofile-WS Splashguard Trim");
  row("SLRDITRAXL", `3'3"x53'3"`, "", "Schluter Ditra XL Uncoupling Waterproof");
  assert.equal(by("SLRDITRAXL").sfPerUnit, 175);
  row("SLRKD2ABSEKIT", "", "", 'Schluter Kerdi-Drain Kit ABS 4" Stainless Steel (Drain, Corners, Seals)');
  row("SLRDHERT103BW", "", "", "Schluter Ditra-Heat Thermostat with GFCI Non-Programmable");
  row("SLREKBZA38EB", "", "", 'Schluter Kerdi-Board-ZA/E 1.5" Out Corner for ZA Brushed Stainless Steel');
  row("SLRKBZDK1210M", "", "", 'Schluter Kerdi-Board-ZDK 1/2" Width Double Sided Tape');
  // A lone marked fraction on an accessory is a frame height or a pipe size,
  // never a tile thickness; a KERDI-LINE's grate length is its size.
  row("SLRKL1AR19MGS70", '28"', "", 'Schluter Kerdi-Line 3/4" Frame Solid Grate Matte Black');
  row("SLRKL1B30EB120", '48"', "", 'Schluter Kerdi-Line 1-1/8" Frame Perforated Grate');
  row("SLRKLVRID13MGS12", "4'", "", "Schluter Kerdi-Line-Vario D13-Herringbone Matte Black");
  row("SLRKMS1017220", "10 ct", "", 'Schluter Kerdi-Seal PS 3/4" Pipe Seal with Overmold Rubber Gasket');
  assert.equal(by("SLRKMS1017220").pcPerUnit, 10);
  row("SLRETV60SG", "", "", "Schluter Trep-V 60 End Cap Stone Grey (R+L)");
  row("SLRSWS1D5TSOB", "", "", "Schluter Shelf Rectangular Wall Floral Bronze");
  row("SLRKBZSD110Z", "", "", 'Schluter Kerdi-Board-ZSD 4-5/16" Anchor Galvanized Steel');
  row("SLRAKWS160PG", `5/8"x8'`, `5/8"`, `Schluter Dilex-AKWS with 1/4" Joint Clear Grey`);
  row("SLRQK125ABGB", `1/2"x8'`, `1/2"`, "Schluter Quadec-K without Anchoring Leg Brushed Antique Bronze Anodized");
  // Virginia Tile files the LTS trays under "KERDI LINE": the grate-length rule is for KERDI-LINE drains only.
  row("SLRKSLT9151830S", "36x72", "", 'Schluter Kerdi-Shower-LTS Tray Perimeter Drain 36" Side');
  // Shorthand keeps its meaning behind a comma or across a slash (the CTNS sheet's drain rows).
  row("SLRKDH2PVCFL", "", "", 'Schluter Kerdi-Drain with Horizontal Outlet, 2" PVC, without Corner/Seal');
  row("SLRKD2ETHFL", "", "", 'Schluter Kerdi-Drain Stainless Steel Threaded Flange Kit 2"');
  for (const it of items) assert.deepEqual(rowAdvisories(it), [], `${it.sku}: ${it.description}`);
});

// Another brand's EFT that carries Schluter rows (the owner's "CTNS EFT 26 01
// 15"): the brand line says nothing about Schluter, so the row's own VTC MFG
// code (SLR) is what says the row is Schluter — same rules, per row, while
// the brand's own rows keep the tile default and the generic split.
const CTNS_WORKBOOK = [{ name: "MFG Data", rows: [
  ["Account Name: KEIM LUMBER"], ["p VIRGINIATILE"],
  [null, "CTNS"], [],
  ["", "VTC MFG", "VTC Color", "VTC Pattern", "VTC Item Code", "VTC Description", "Product Line Name", "VTC ESTIMATED LEAD TIME", "CONSUMER LEVEL PRICE (Dealer to Consumer)", "DEALER PRICE (VTC to Dealer)", "Price U/M", "No Broken U/M", "PC/CT", "SF/CT", "Additional Comments"],
  ["", "CTN", "EAAS", "1224", "CTNEARTHAS1224", "EARTH ASH GRAY 12X24 10MM", "EARTH", "READY SHIP", 5.2, 3.1, "SF", "CT", 8, 15.5, ""],
  ["", "SLR", "RO10", "0TSI", "SLRRO100TSI", "RONDEC BULLNOSE TRIM 3/8 ALUM TEXTURED IVORY", "RONDEC CORNERS", "READY SHIP", 26.68, 26.68, "PC", "PC", "N/A", "N/A", ""],
  ["", "SLR", "DIT", "30M", "SLRDITRA30M", "DITRA UNCOUPLING/WATERPROOF 3 FT 3 IN X 98 FT 5 IN=323 SF", "DITRA", "IMPORT", 1.17, 1.17, "SF", "RL", "N/A", "N/A", ""],
] }];

test("another brand's EFT: a row whose VTC MFG is SLR gets the Schluter rules; the brand's rows don't", () => {
  const m = detectVtcEft(CTNS_WORKBOOK);
  assert.equal(m.title, "CTNS");
  assert.ok(!m.schluter, "the brand line is not Schluter's");
  assert.equal(m.defaultType, "tile");
  const { items } = parseMapped(CTNS_WORKBOOK[0].rows, m);
  const by = (sku) => items.find((i) => i.sku === sku);
  const tile = by("CTNEARTHAS1224");
  assert.equal(tile.type, "tile");
  assert.equal(tile.size, "12x24");
  assert.equal(tile.description, "Earth Ash Gray");
  const ro = by("SLRRO100TSI");
  assert.equal(ro.type, null, "Schluter sells no flooring, whatever sheet it rides");
  assert.equal(ro.size, `3/8"x8'`);
  assert.equal(ro.thickness, `3/8"`);
  assert.equal(ro.description, "Schluter Rondec Bullnose Trim Textured Ivory");
  const ditra = by("SLRDITRA30M");
  // The membrane-typing exception (spec 2026-09-18) rides the per-row SLR
  // detection like every other Schluter rule here — a coverage-bearing
  // uncoupling membrane types as underlayment even on another brand's EFT.
  assert.equal(ditra.type, "underlayment");
  assert.equal(ditra.size, `3'3"x98'5"`);
  assert.equal(ditra.sfPerUnit, 323, "coverage rides the description on a Schluter row even when the sheet's mapping doesn't say so");
  assert.equal(ditra.description, "Schluter Ditra Uncoupling/Waterproof");
});

test("detectVtcEft: returns null when the signature is absent", () => {
  assert.equal(detectVtcEft([{ name: "Sheet1", rows: [["Name", "Price"], ["Oak", 5]] }]), null);
  assert.equal(guessHeaderRow([["nope"], ["still nope"]]), -1);
});

// --- the ERP "Vendor SKU Analysis" stock exports ------------------------------
// One flat sheet per supplier (DOIT / SHEOG / MANMI…), header on row 1: shop
// Product Code (the SKU), Full Description, Base Price (Cost), Retail Price,
// Unit of Stock. No SF/CT column — coverage rides in the description text.

const VSA_WORKBOOK = [sheet("Vendor SKU Analysis", [
  ["Product Code", "Full Description", "Base Price (Cost)", "Retail Price", "Unit of Stock", "Supplier Prod Code", "Mfg Product Code", "Product Group", "Free Stock", "Total Stock"],
  ["05153", "Slip Tongue Flooring Spline", 0.3, 0.48, "LF", "05153", "05153", "C29AEAC", 4, 4],
  ["1517410", "7x60 Mannington AduraMax - Preservation Fossil 23.76 sf", 85.34, 141.45, "CT", "MPB823", "MPB823", "", 2, 2],
  ["94593", "6x48 Mann AduraMax Plank - Napa Dry Cork MAX060", 82.42, 136.61, "CT", "MAX742", "MAX742", "", 1, 1],
  ["28920", "6\" Mann AduraMax Plank - Acacia Tiger's Eye 27.39 sf/ct", 79.43, 131.2, "CT", "MAX011", "MAX011", "", 3, 3],
  ["05068", "2-1/4\" Sheoga Clear RO Flr - Unfinished 22sf/ct (BDL)", 68.2, 94.38, "BL", "05068", "05068", "", 6, 6],
  ["1518929", "2x10 Glazzio Sarsen Essex Satin 7.53 sf/ct - SAN1173", 39.65, 61.75, "CT", "SAN1173", "SAN1173", "", 2, 2],
  ["1518213", "94\" Mann AduraMax T-Mold - Noble Oak Dry Leaf TMG820", 30.14, 46.8, "EA", "TMG820", "TMG820", "", 2, 2],
  ["29965", "3/16\" x 1/4\" x 3/8\" Stauf #5 - Notched Trowel for Eng Flr", 9.54, 15.49, "EA", "STAXTR5", "STAXTR5", "", 1, 1],
  ["07879", "Aquabar B Underlayment  - 500sf/roll 3'x167'", 26.8, 42.89, "EA", "348423", "348423", "", 9, 9],
  // A real MANMI row where the two code columns disagree (a vendor reissue) —
  // both are kept, either may be the one a vendor book states.
  ["13192", "94\" Mann AduraMax T-Molding - Acacia Tiger's Eye 011", 27.87, 46.8, "EA", "389118", "449406", "", 1, 1],
  // A real OHIVA mosaic sold by the SHEET, coverage printed with no leading
  // zero (".969sf/sh") — the "969" must not read as the coverage.
  ["22974", "2x2 Atlas Concorde Mosaic - 600110000217 Rid Bg .969sf/sh", 12.15, 18.22, "SH", "AUSRIBEMOS22", "600110000217", "C29AOAL", 2, 2],
  // The MANMI adhesive from the Claude issue bucket (1518014): a gallon-sold
  // accessory whose text carries a SPREAD RATE, not a sell-basis coverage.
  ["1518014", "1Gal Mannington M Grip Adhesive - 250 sf", 48, 72, "GL", "588683", "588683", "", 4, 4],
])];

test("detectVendorSkuAnalysis: recognizes the export, maps the known columns", () => {
  const m = detectVendorSkuAnalysis(VSA_WORKBOOK);
  assert.ok(m, "signature recognized");
  assert.equal(m.sheet, "Vendor SKU Analysis");
  assert.equal(m.headerRow, 0);
  assert.equal(m.columns[0], "sku");
  assert.equal(m.columns[1], "description");
  assert.equal(m.columns[2], "cost");
  assert.equal(m.columns[3], "price");
  assert.equal(m.columns[4], "unit");
  // The manufacturer-code columns are the exact floor↔trim bridge to the
  // vendor books (2026-07-23) — the description is not a safe source for them.
  assert.equal(m.columns[5], "vendorSku");
  assert.equal(m.columns[6], "vendorSku2");
  // The stock counts are point-in-time — never item fields.
  assert.equal(Object.keys(m.columns).length, 7);
  assert.ok(m.sfFromDescription);
  assert.ok(m.leadWidthSize);
  assert.ok(m.typeFromDescription);
  assert.ok(mappedSkuRe(m.skuPattern).test("05153"));     // leading zero
  assert.ok(mappedSkuRe(m.skuPattern).test("29500-LF"));  // unit-suffixed code
  assert.ok(mappedSkuRe(m.skuPattern).test("29SHEOGAW")); // category placeholder
  assert.ok(!mappedSkuRe(m.skuPattern).test("Product Code")); // never the header
});

test("detectVendorSkuAnalysis: null without the signature", () => {
  assert.equal(detectVendorSkuAnalysis([sheet("Sheet1", [["Name", "Price"], ["Oak", 5]])]), null);
  assert.equal(detectVendorSkuAnalysis([]), null);
});

test("Vendor SKU Analysis mapping: retail + cost both land; SF/carton pulled from the description", () => {
  const m = detectVendorSkuAnalysis(VSA_WORKBOOK);
  const { items } = parseMapped(VSA_WORKBOOK[0].rows, m);
  assert.equal(items.length, 12);
  const spline = items.find((i) => i.sku === "05153"); // leading zero survives
  assert.equal(spline.price, 0.48);
  assert.equal(spline.cost, 0.3);
  assert.equal(spline.unit, "LF");
  assert.equal(spline.sfPerUnit, null);
  const max = items.find((i) => i.sku === "1517410");
  assert.equal(max.sfPerUnit, 23.76);            // "23.76 sf" from the text
  assert.equal(max.size, "7x60");                // size split keeps working
  assert.match(max.description, /Preservation Fossil/);
  assert.ok(!/23\.76/.test(max.description), "coverage token stripped from the name");
  assert.equal(max.priceSqft, 5.9533);           // 141.45 / 23.76, per sqft
  const cork = items.find((i) => i.sku === "94593");
  assert.equal(cork.sfPerUnit, null);            // no sf in its text — flagged, not invented
  assert.equal(cork.priceSqft, null);
  // The manufacturer codes land structured; agreeing columns dedupe, a
  // disagreement (vendor reissue) keeps both.
  assert.deepEqual(max.vendorSkus, ["MPB823"]);
  assert.deepEqual(items.find((i) => i.sku === "1518213").vendorSkus, ["TMG820"]);
  assert.deepEqual(items.find((i) => i.sku === "13192").vendorSkus, ["389118", "449406"]);
  // The underlayment's 3'x167' roll keeps its foot marks — not a 3x167-inch tile.
  assert.equal(items.find((i) => i.sku === "07879").size, "3'x167'");
});

// The Unit of Stock column names the sell basis: a carton/bundle-sold row with
// real coverage is flooring — it gets a type (read from the description's
// wording) so the pick fills a sqft line ordering whole cartons at the carton
// price, instead of a per-piece count line quoting the carton price each.
test("Vendor SKU Analysis: carton-sold rows with coverage become typed flooring", () => {
  const m = detectVendorSkuAnalysis(VSA_WORKBOOK);
  const { items, warnings } = parseMapped(VSA_WORKBOOK[0].rows, m);
  const plank = items.find((i) => i.sku === "28920");
  assert.equal(plank.type, "vinyl");             // "AduraMax" — LVP despite the wood color name
  assert.equal(plank.sfPerUnit, 27.39);
  assert.equal(plank.priceSqft, 4.7901);         // 131.20/CT ÷ 27.39 SF/CT
  assert.equal(items.find((i) => i.sku === "1517410").type, "vinyl");
  const sheoga = items.find((i) => i.sku === "05068");
  assert.equal(sheoga.type, "hardwood");         // BL bundles count as carton-sold
  assert.equal(sheoga.sfPerUnit, 22);
  const glazzio = items.find((i) => i.sku === "1518929");
  assert.equal(glazzio.type, "tile");            // no type word — the 2x10 L×W decides
  assert.equal(glazzio.size, "2x10");
  // The U/M gate: EA/LF rows never type, whatever their words or coverage say.
  assert.equal(items.find((i) => i.sku === "05153").type, null);   // LF, "Flooring" word
  assert.equal(items.find((i) => i.sku === "1518213").type, null); // EA trim stick
  assert.equal(items.find((i) => i.sku === "07879").type, null);   // EA underlayment, 500sf/roll
  // A carton-sold row with no sf in its text can't do sqft math — named, not silent.
  assert.ok(warnings.some((w) => /carton-sold/.test(w) && /94593/.test(w)), warnings.join(" | "));
});

// Issue bucket 8/10 — MANMI 1518014, 1Gal M Grip Adhesive: a pre-gate import
// stored it as vinyl covering 250 sf, so it priced $0.192/sqft (the psf-outlier
// flag Marcus parked) instead of $48 → $72 the gallon. The U/M gate keeps a
// GL row an untyped count line — its "250 sf" is a spread rate, never a sell
// basis — and since type/sfPerUnit are diffed fields (BOOK_FIELDS), a re-import
// of the current export rewrites the stale row.
test("Vendor SKU Analysis: a gallon-sold adhesive stays an untyped count line (MANMI 1518014)", () => {
  const m = detectVendorSkuAnalysis(VSA_WORKBOOK);
  const { items } = parseMapped(VSA_WORKBOOK[0].rows, m);
  const glue = items.find((i) => i.sku === "1518014");
  assert.equal(glue.type, null);
  assert.equal(glue.sfPerUnit, null);
  assert.equal(glue.priceSqft, null);
  assert.equal(glue.unit, "GL");
  assert.equal(glue.cost, 48);
  assert.equal(glue.price, 72);
  assert.deepEqual(glue.vendorSkus, ["588683"]);
});

// SKU 22974: a sheet-sold mosaic whose coverage prints with no leading zero
// (".969sf/sh"). The old regex read the bare "969" as 969 sf/sheet and left
// "./sh" litter in the name; SH wasn't a coverage-sold unit, so the row never
// typed as flooring — though pricing already handled SH + per-sheet coverage
// (the unitcombos truth table).
test("Vendor SKU Analysis: a sheet-sold mosaic with .Nsf/sh coverage", () => {
  const m = detectVendorSkuAnalysis(VSA_WORKBOOK);
  const { items } = parseMapped(VSA_WORKBOOK[0].rows, m);
  const mosaic = items.find((i) => i.sku === "22974");
  assert.equal(mosaic.sfPerUnit, 0.969);
  assert.equal(mosaic.type, "tile");             // "Mosaic", sold by the sheet
  assert.equal(mosaic.size, "2x2");
  assert.equal(mosaic.unit, "SH");
  assert.equal(mosaic.priceSqft, 18.8029);       // 18.22/SH ÷ .969 SF/SH
  assert.match(mosaic.description, /Atlas Concorde Mosaic/);
  assert.ok(!/969|\/sh|\./i.test(mosaic.description), `no coverage litter: "${mosaic.description}"`);
  assert.deepEqual(mosaic.vendorSkus, ["600110000217", "AUSRIBEMOS22"]);
});

// The export leads flooring descriptions with the bare plank width — it lands
// in the size field (not the name), and consuming the whole mixed fraction
// keeps THICK_FRAC_RE from reading the 1/4" of a 2-1/4" width as a thickness.
test("Vendor SKU Analysis: a leading bare width becomes the size", () => {
  const m = detectVendorSkuAnalysis(VSA_WORKBOOK);
  const { items } = parseMapped(VSA_WORKBOOK[0].rows, m);
  const plank = items.find((i) => i.sku === "28920");
  assert.equal(plank.size, '6"');
  assert.match(plank.description, /^Mann AduraMax Plank/);
  const sheoga = items.find((i) => i.sku === "05068");
  assert.equal(sheoga.size, '2-1/4"');
  assert.equal(sheoga.thickness, "");
  assert.match(sheoga.description, /^Sheoga Clear RO Flr/);
  const trim = items.find((i) => i.sku === "1518213");
  assert.equal(trim.size, '94"');                // stick length off the name, into Size
  assert.match(trim.description, /^Mann AduraMax T-Mold/);
  // A leading dimension followed by ×-something is an L×W, not a bare width.
  const trowel = items.find((i) => i.sku === "29965");
  assert.notEqual(trowel.size, '3/16"');
});

test("floorTypeFromDescription: word ladder, then the size decides", () => {
  assert.equal(floorTypeFromDescription("Mann AduraMax Plank - Noble Oak Bark", '6"'), "vinyl"); // vinyl outranks species words
  assert.equal(floorTypeFromDescription("Mirage Red Oak Classic - Carmel", '4-1/4"'), "hardwood");
  assert.equal(floorTypeFromDescription("Pergo Outlast Waterproof Laminate", ""), "laminate");
  assert.equal(floorTypeFromDescription("Glazzio Sarsen Essex Satin", "2x10"), "tile");    // short L×W
  assert.equal(floorTypeFromDescription("Brandless Plank Line", "7x60"), "vinyl");         // plank-long L×W
  assert.equal(floorTypeFromDescription("Mann Riverwalk Dew - RVWK07DEW1", '6.5"'), "hardwood"); // bare width = wood
  assert.equal(floorTypeFromDescription("Mystery Product", ""), null);
  // "Underlayment" in the name types the row directly (spec 2026-09-18),
  // ahead of the foot-marked-size-is-roll-goods fallback below it.
  assert.equal(floorTypeFromDescription("Aquabar B Underlayment", "3'x167'"), "underlayment");
  // A hexagon chip leads with its bare width — the shape word outranks the
  // bare-width-means-wood fallback (sheet-sold OHIVA mosaics, SKU 1501219 kin).
  assert.equal(floorTypeFromDescription("Anatolia Soho Hexagon - 4501-0467-0 Ret Blk M", '2"'), "tile");
  // A sheet-sold membrane has real coverage and is no FLOOR — it is underlayment
  // (spec 2026-09-18), ordered in whole sheets like a carton.
  assert.equal(floorTypeFromDescription("Schluter Ditra Heat - Membrane Sheet", '3"'), "underlayment");
  assert.equal(floorTypeFromDescription("Kerdi Membrane - KERDI200", "3'3\"x98'"), "underlayment");
  assert.equal(floorTypeFromDescription("HardieBacker 1/4 Backer Board 3x5", "36x60"), "underlayment");
});

test("guessBookField: the ERP export headers, without disturbing the EFT guesses", () => {
  assert.equal(guessBookField("Product Code"), "sku");
  assert.equal(guessBookField("Full Description"), "description");
  assert.equal(guessBookField("Base Price (Cost)"), "cost");
  assert.equal(guessBookField("Retail Price"), "price");
  assert.equal(guessBookField("Unit of Stock"), "unit");
  assert.equal(guessBookField("CONSUMER LEVEL PRICE (Dealer to Consumer)"), "msrp");
  assert.equal(guessBookField("DEALER PRICE (VTC to Dealer)"), "cost");
  assert.equal(guessBookField("Price U/M"), "priceUnit");
  assert.equal(guessBookField("Supplier Prod Code"), "vendorSku");
  assert.equal(guessBookField("Mfg Product Code"), "vendorSku"); // a vendor code, not the markup-group axis
  assert.equal(guessBookField("MFG"), "mfg");                    // the EFT group column keeps its slot
});

// --- roll-sold stock (2026-07-25) ---------------------------------------------
// The Schluter export sells sheet goods by the RL. A roll bundles coverage like
// a carton, so it belongs in the same class — but, like every other unit, it
// only types a row whose description names a floor.
const ROLL_WORKBOOK = [sheet("Vendor SKU Analysis", [
  ["Product Code", "Full Description", "Base Price (Cost)", "Retail Price", "Unit of Stock"],
  ["23015", "Schluter Kerdi-Band 5\" x 33' Waterproofing Strip", 50.5, 84.2, "RL"],
  ["23031", "Schluter Ditra-Heat Membrane - 134.5sf/roll", 480.0, 720.0, "RL"],
  ["40122", "12' Prestige Sheet Vinyl Oak Plank - 240sf/roll", 480.0, 720.0, "RL"],
])];

test("a roll-sold floor types and carries its coverage; a roll of membrane types as underlayment", () => {
  const m = detectVendorSkuAnalysis(ROLL_WORKBOOK);
  const { items } = parseMapped(ROLL_WORKBOOK[0].rows, m);
  const by = (sku) => items.find((i) => i.sku === sku);

  const vinyl = by("40122");
  assert.equal(vinyl.type, "vinyl");
  assert.equal(vinyl.sfPerUnit, 240);
  assert.equal(vinyl.unit, "RL");
  assert.equal(vinyl.size, "12'");               // a feet lead keeps its foot mark

  // A membrane has real coverage and is no FLOOR — it types as underlayment
  // (spec 2026-09-18) now that RL is a coverage-bundling unit.
  assert.equal(by("23031").type, "underlayment");
  assert.equal(by("23031").sfPerUnit, 134.5);
  // No coverage in the description at all: a plain roll accessory.
  assert.equal(by("23015").type, null);
  assert.equal(by("23015").unit, "RL");
  assert.equal(by("23015").size, "5\"x33'");     // inches × feet, kept whole as text
});

// --- feet-marked roll dimensions (issue bucket, 2026-08-07) --------------------
// The ERP writes Schluter roll widths in feet-and-inches — "3'3\"x98' Kerdi
// Membrane", sometimes dotted ("3'.3\"" = 3 ft 3 in, not three tenths). The
// inch-minded regexes used to read the leading 3' as a 3" width (leadWidthSize)
// or pull 3"x98 out of the middle (SIZE_RE), leaving a 3-inch membrane with the
// rest of the size still in its name. A foot mark on either side now lands the
// whole spelling in the size field as free text — parseTileSize refuses it, so
// no grout/mortar math ever runs on a roll.

const KERDI_WORKBOOK = [sheet("Vendor SKU Analysis", [
  ["Product Code", "Full Description", "Base Price (Cost)", "Retail Price", "Unit of Stock", "Supplier Prod Code", "Mfg Product Code"],
  ["1509781", "3'3\"x98' Kerdi Membrane 323sf/rl - KERDI200", 352.07, 528.1, "RL", "KERDI200", "KERDI200"],
  ["1509785", "3'.3\"x16'5\" Kerdi Membrane 54sf/rl - KERDI200/5M", 71.29, 106.94, "RL", "KERDI200/5M", "KERDI200/5M"],
  ["23031", "3'3\"x2'7\" Schluter Ditra Heat 8.4sf/sh - Membrane Sheet", 14.32, 21.49, "SH", "SLRDH5MA", "SLRDH5MA"],
])];

test("feet-and-inches roll dimensions land whole in the size field, off the name", () => {
  const m = detectVendorSkuAnalysis(KERDI_WORKBOOK);
  const { items, warnings } = parseMapped(KERDI_WORKBOOK[0].rows, m);
  const by = (sku) => items.find((i) => i.sku === sku);

  const roll = by("1509781");
  assert.equal(roll.size, "3'3\"x98'");
  assert.equal(roll.description, "Kerdi Membrane - KERDI200");
  assert.equal(roll.sfPerUnit, 323);
  assert.equal(roll.type, "underlayment");        // a membrane is underlayment, not no floor
  assert.equal(by("1509785").type, "underlayment");
  // The dotted ERP spelling is the same 3-foot-3 width.
  assert.equal(by("1509785").size, "3'3\"x16'5\"");
  // Ditra Heat sheet: 3'3" × 2'7" IS 8.4 sf — the coverage was never wrong.
  const ditra = by("23031");
  assert.equal(ditra.size, "3'3\"x2'7\"");
  assert.equal(ditra.description, "Schluter Ditra Heat - Membrane Sheet");
  assert.equal(ditra.sfPerUnit, 8.4);
  assert.equal(ditra.type, "underlayment");
  // Clean names — the mis-split size advisory stays quiet.
  assert.ok(!warnings.some((w) => /still showing a size/.test(w)), warnings.join(" | "));
});

// The Schluter rolls found this: the coverage suffix list knew /ct and /sh but
// not /roll, so the number was read and the suffix left in the product name.
test("a roll coverage suffix is consumed, and the separator it leaves is trimmed", () => {
  const sheetOf = (desc) => [sheet("Vendor SKU Analysis", [
    ["Product Code", "Full Description", "Base Price (Cost)", "Retail Price", "Unit of Stock"],
    ["23031", desc, 480, 720, "RL"],
  ])];
  const parse = (desc) => {
    const wb = sheetOf(desc);
    return parseMapped(wb[0].rows, detectVendorSkuAnalysis(wb)).items[0];
  };
  const trailing = parse("Schluter Ditra-Heat Uncoupling Membrane - 134.5sf/roll");
  assert.equal(trailing.sfPerUnit, 134.5);
  assert.equal(trailing.description, "Schluter Ditra-Heat Uncoupling Membrane");

  assert.equal(parse("Schluter Ditra 323.2sf/rl Uncoupling Membrane").description, "Schluter Ditra Uncoupling Membrane");
  assert.equal(parse("Schluter Kerdi 108sf/rolls Membrane").sfPerUnit, 108);
  // An interior separator is the vendor's own punctuation and stays.
  assert.equal(parse("Sheoga Clear RO Flr - Unfinished 22sf/ct").description, "Sheoga Clear RO Flr - Unfinished");
});

test("a membrane pick lands a sq ft row ordering whole sheets/rolls (spec 2026-09-18)", () => {
  const m = detectVendorSkuAnalysis(KERDI_WORKBOOK);
  const { items } = parseMapped(KERDI_WORKBOOK[0].rows, m);
  const land = (sku) => stockPatch(pricedItem(items.find((i) => i.sku === sku), { default: 50 }), {});
  const sheet = land("23031");
  assert.equal(sheet.type, "underlayment");
  assert.equal(sheet.qtyType, "sqft");
  assert.equal(sheet.cartonSf, "8.4");
  assert.equal(sheet.cartonUnit, "SH");
  assert.equal(sheet.priceSqft, "2.56");         // retail $21.49 per sheet ÷ 8.4 sf (stockPriceSqft → round2)
  assert.equal(sheet.sizeText, "3'3\"x2'7\"");
  const roll = land("1509781");
  assert.equal(roll.type, "underlayment");
  assert.equal(roll.cartonSf, "323");
  assert.equal(roll.cartonUnit, "RL");
  // $528.10 per roll ÷ 323 sf, rounded to the cent — assert the invariant, not
  // a hand-rounded literal (1.635 sits on a rounding edge in binary).
  assert.ok(Math.abs(+roll.priceSqft * 323 - 528.1) < 323 * 0.005, roll.priceSqft);
});
