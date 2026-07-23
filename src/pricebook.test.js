import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMapped, mappedSkuRe, splitSizeFromDescription, mmToFraction, guessBookField, guessHeaderRow, bestDataSheet, columnsFromHeader, detectVtcEft, detectVendorSkuAnalysis, floorTypeFromDescription } from "./pricebook.js";

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
  assert.equal(bySku(items, "MRZMC571224RN").description, "Moroccan Concrete Charcoal Rect *New Pkg");
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
  assert.equal(items.length, 11);
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
  // A hexagon chip leads with its bare width — the shape word outranks the
  // bare-width-means-wood fallback (sheet-sold OHIVA mosaics, SKU 1501219 kin).
  assert.equal(floorTypeFromDescription("Anatolia Soho Hexagon - 4501-0467-0 Ret Blk M", '2"'), "tile");
  // A sheet-sold membrane has real coverage but is no floor (Ditra Heat 23031).
  assert.equal(floorTypeFromDescription("Schluter Ditra Heat - Membrane Sheet", '3"'), null);
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
