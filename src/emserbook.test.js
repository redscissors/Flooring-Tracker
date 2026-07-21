import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEmser, isEmserIspl, parseSizeCell, cleanDescription, EMSER_MAPPING } from "./emserbook.js";
import { parseMapped } from "./pricebook.js";
import { fileFormat } from "./dropimport.js";

// A compact slice of the real Emser ISPL workbook exercising every quirk: the
// title/legend block above the header, a chip/sheet mosaic size, a dropped (Y)
// item, a field tile whose description embeds the size and a finish code, a PC
// trim, an LF-priced trim carrying SF/CT that must NOT become coverage, an
// EMCORE SPC vinyl line, a pebble sheet whose chip token isn't an L×W, a
// limited-availability (ABC R) row, and a "Dropped from PB but still active"
// status without the Y flag.
const HEADER = ["Price Class", "Item Number", "Description", "Series", "Size", "Major Classification", "Material Type", "Product Type", "Trim Type", "SF/PC or LF/PC", "LB/PC", "PC/CT", "SF/CT or LF/CT", "LB/CT", "Price", "UOM", "Order ", "Drop from PB", "ABC Rating", "Dropped/Will Drop"];
const ITEMS = [
  ["", "July 2026 Item Price List: 1374258 KEIM LUMBER COMPANY", "", "#N/A"],
  ["", "2026-06-24"],
  ["", "", "Dropped/Will Drop Items"],
  ["", "", "Dropped from price book but still active"],
  ["", "", "Limited Availability"],
  [],
  HEADER,
  ["F01G51", "F51AFLOCO1313MO1", "AFLOAT COBALT MO 0101/1313", "AFLOAT", "1X1/13X13", "DECORATIVE", "PORCELAIN", "FIELD MOSAIC", "MOSAIC", 1.106, 2.54, 16, 17.696, 40.64, 11.4, "SF", 1, "Previously active and still active", "A", ""],
  ["F01G51", "F51AFLOAQ1313MO1", "AFLOAT AQUA MO 0101/1313", "AFLOAT", "1X1/13X13", "DECORATIVE", "PORCELAIN", "FIELD MOSAIC", "MOSAIC", 1.106, 2.54, 16, 17.696, 40.64, 11.4, "SF", 2, "Previously active and still active", "X", "Y"],
  ["C08A04", "F02AGIODU4747M", "AGIO DUNA MT 47X47", "AGIO", "47X47", "MANUFACTURED TILE", "PORCELAIN", "FIELD TILE", "FLOOR, LARGE FORMAT", 15.5, 60, 2, 31, 120, 7.21, "SF", 3, "New for July 2026", "N", ""],
  ["F44A01", "F44ANVAAS0312SBM", "ANVAYA ASTER MT SBN 3X12", "ANVAYA ", "3X12", "MANUFACTURED TILE", "PORCELAIN", "TRIM", "SINGLE BULLNOSE", "", "", 20, "", "", 7.14, "PC", 4, "Previously active and still active", "B", ""],
  ["W71B02", "W71SOURBK0202SB", "SOURCE BLACK SBN 2X2", "SOURCE", "2X2", "MANUFACTURED TILE", "PORCELAIN", "TRIM", "SINGLE BULLNOSE, WALL", 0.974, 1, 33, 32.142, 40, 14.69, "LF", 5, "Previously active and still active", "E", ""],
  ["Y01C03", "Y01HYLTGR1224", "HYLTON GRY 1224 5M/12ML", "EMCORE", "12X24", "RESILIENT", "STONE POLYMER COMPOSITE", "FIELD TILE", "FLOOR, OBLONG", 1.962, 4, 13, 25.506, 52, 1.68, "SF", 6, "Previously active and still active", "A", ""],
  ["D77P04", "D77PEBBBG1212M", "PEBBLES BEIGE MT", "PEBBLES", "PEBB/12X12", "NATURAL STONE", "PEBBLES", "FIELD MOSAIC", "MOSAIC", 0.97, 4, 10, 9.7, 40, 12.5, "SF", 7, "Previously active and still active", "R", ""],
  ["W11X05", "W11COSHWH0707P", "BATH CRNR SHELF WHITE GL 7\"", "SHOWER CORNER", "7X7", "DECORATIVE", "CERAMIC", "ACCESSORY", "CORNER SHELF", "", "", 12, "", "", 16.58, "PC", 8, "Dropped", "Q", ""],
];
const SHEETS = [{ name: "Item Price List", rows: ITEMS }, { name: "Series Price List", rows: [["Price Class", "Description", "Series"]] }, { name: "Sheet1", rows: [] }];

const parse = () => parseEmser(SHEETS, "Emser ISPL");
const bySku = (res, sku) => res.rows.find((r) => r[0] === sku);
// End-to-end: the canonical rows through the mapped importer, as the wizard runs them.
const importItems = () => parseMapped(parse().rows, parse().mapping).items;
const itemBySku = (sku) => importItems().find((it) => it.sku === sku);

test("detects the Emser ISPL workbook (and only its item sheet)", () => {
  assert.equal(isEmserIspl(SHEETS), true);
  assert.equal(isEmserIspl([{ name: "x", rows: [["something else"]] }]), false);
  // The Series summary sheet alone must not qualify — it has no Item Number.
  assert.equal(isEmserIspl([SHEETS[1]]), false);
  assert.equal(fileFormat({ sheets: SHEETS }), "emser-ispl");
});

test("parses every item row and only item rows", () => {
  const res = parse();
  assert.equal(res.rows.length - 1, 8); // legend/title/blank rows never become items
  assert.equal(res.meta.items, 8);
  assert.equal(res.meta.trims, 2);
  assert.equal(res.meta.dropped, 1);
  assert.deepEqual(res.warnings, []);
});

test("a chip/sheet mosaic splits into tile size and backing sheet", () => {
  const mo = bySku(parse(), "F51AFLOCO1313MO1");
  assert.equal(mo[4], "1x1");    // chip — the tile L×W grout/mortar read
  assert.equal(mo[5], "13x13");  // backing sheet, never the tile size
  assert.equal(mo[6], "17.696"); // SF/CT
  assert.equal(mo[7], "16");     // PC/CT
  assert.equal(mo[1], "Afloat Cobalt Mosaic"); // pattern code stripped, MO expanded
});

test("descriptions drop embedded sizes/codes and expand finish abbreviations", () => {
  assert.equal(cleanDescription("AGIO DUNA MT 47X47"), "Agio Duna Matte");
  assert.equal(cleanDescription("ANVAYA ASTER MT SBN 3X12"), "Anvaya Aster Matte Bullnose");
  assert.equal(cleanDescription("AFLOAT COBALT MO 0101/1313"), "Afloat Cobalt Mosaic");
  // Wear-layer specs are not pattern codes and survive.
  assert.equal(cleanDescription("HYLTON GRY 1224 5M/12ML"), "Hylton Gry 1224 5m/12ml");
  // The 30-char ERP field fuses the size onto the word before it.
  assert.equal(cleanDescription("BROOK II GRAPHITE WALL SBN3X12"), "Brook Ii Graphite Wall Bullnose");
  assert.equal(cleanDescription("EXPANSE MARMO METALLO MT39X118"), "Expanse Marmo Metallo Matte");
  assert.equal(cleanDescription("COSMOPOLITAN CHARC MO2X2/12X12"), "Cosmopolitan Charc Mosaic");
  assert.equal(cleanDescription("PLYMOUTH ALDEN 2MM/12MIL GLU-D"), "Plymouth Alden 2mm/12mil Glue-down");
});

test("size cell shapes", () => {
  assert.deepEqual(parseSizeCell("13X13"), { size: "13x13", sheetSize: "", odd: "" });
  assert.deepEqual(parseSizeCell("1X1/13X13"), { size: "1x1", sheetSize: "13x13", odd: "" });
  assert.deepEqual(parseSizeCell("PEBB/12X12"), { size: "", sheetSize: "12x12", odd: "PEBB/12X12" });
  assert.deepEqual(parseSizeCell("0.625X0.625/13X"), { size: "0.625x0.625", sheetSize: "", odd: "" });
  assert.deepEqual(parseSizeCell("VERSAILLES SET"), { size: "", sheetSize: "", odd: "VERSAILLES SET" });
});

test("a dropped (Y) item imports discontinued; active neighbours don't", () => {
  assert.equal(itemBySku("F51AFLOAQ1313MO1").discontinued, true);
  assert.equal(itemBySku("F51AFLOCO1313MO1").discontinued, false);
});

test("a PC trim lands per-piece, untyped, flagged trim, with its carton count", () => {
  const it = itemBySku("F44ANVAAS0312SBM");
  assert.equal(it.trim, true);
  assert.equal(it.type, null);
  assert.equal(it.unit, "PC");
  assert.equal(it.pcPerUnit, 20);
  assert.equal(it.cost, 7.14);
});

test("an LF-priced trim never gets SF coverage — $/LF must not derive a $/sqft", () => {
  const it = itemBySku("W71SOURBK0202SB");
  assert.equal(it.unit, "LF");
  assert.equal(it.sfPerUnit, null);
  assert.equal(it.cost, 14.69);
});

test("material type drives flooring type and the markup section", () => {
  const spc = itemBySku("Y01HYLTGR1224");
  assert.equal(spc.type, "vinyl");
  assert.equal(spc.sfPerUnit, 25.506);
  const tile = itemBySku("F02AGIODU4747M");
  assert.equal(tile.type, "tile");
  assert.equal(tile.section, "Porcelain");
  assert.equal(tile.productLine, "AGIO");
  assert.match(tile.note, /New for July 2026/);
});

test("odd size tokens and PB-only drops surface in the note, R rates as limited", () => {
  const pebb = itemBySku("D77PEBBBG1212M");
  assert.equal(pebb.sheetSize, "12x12");
  assert.equal(pebb.size, "");
  assert.match(pebb.note, /size PEBB\/12X12/);
  assert.equal(pebb.leadTime, "Limited availability");
  const shelf = itemBySku("W11COSHWH0707P");
  assert.equal(shelf.discontinued, false);
  assert.match(shelf.note, /Dropped from price book, still active/);
  assert.equal(shelf.type, null); // accessory — a count line, not a floor
});

test("the trimmed Series and the description lead-merge read clean", () => {
  const it = itemBySku("F44ANVAAS0312SBM");
  assert.equal(it.productLine, "ANVAYA"); // trailing space trimmed
  assert.equal(it.description, "Anvaya Aster Matte Bullnose");
});

test("mapping is a passthrough the wizard can re-run", () => {
  assert.equal(EMSER_MAPPING.groupBy, "section");
  assert.equal(EMSER_MAPPING.flags.drop, "discontinued");
});
