import { test } from "node:test";
import assert from "node:assert/strict";
import { isTrueTouch, parseTrueTouchPages, isTrueTouchSheet, parseTrueTouchSheet } from "./truetouchbook.js";
import { parseMapped } from "./pricebook.js";
import { fileFormat } from "./dropimport.js";
import { parseOvf } from "./ovfbook.js";

// Build text items the way pdf.js yields them: { str, x, y, w }.
const word = (x, y, s) => ({ str: s, x, y, w: String(s).length * 6 });

// Page 1 of a TrueTouch-shaped sheet: the account line, then one real-wood
// collection (banner → spec → coverage → stacked trim header → price band →
// color rows), then a waterproof collection's banner/spec/coverage whose grid
// only opens on page 2. x/y values mirror the real sheet.
const page1 = [
  word(54, 105, "Prepared especially for KEIM LUMBER CO"), word(300, 105, "@(70) (035360)"),
  // EVOLV — banner shares its clustered row with the warranty text
  word(509, 119, "Limited Lifetime Residential / 15 Year Limited Commercial Warranty"),
  word(44, 121, "EVOLV"),
  word(154, 134, '1/2" 12mm (10mm REAL WOOD + 2mm PAD attached)'), word(351, 134, 'x 7 11/16" x 24"/36"/60" RL •'), word(463, 134, "AC4+ Wear Layer"),
  word(322, 148, "25.68 SF/CT"), word(379, 148, "50 CT/PA"),
  // stacked trim-column header (labels wrap across several baselines)
  word(567, 160, "Round Stair"),
  word(253, 164, "T-Molding"), word(321, 164, "Reducer"), word(438, 164, "Overlap Stair"), word(505, 164, "Flush Stair"),
  word(370, 165, "Square Nose/ End"),
  word(570, 169, 'Tread 48"'), word(79, 169, "Item Name"), word(188, 169, "Item #"),
  word(381, 172, 'Cap (94.5")'),
  word(260, 173, '(94.5")'), word(323, 173, '(94.5")'), word(438, 173, "Nose"), word(503, 173, 'Nose (94.5")'),
  word(571, 178, "3 ctn min"),
  // the price band: floor $/SF + $/CT, one per-piece price per trim column
  word(252, 194, "$21.49 /EA"), word(315, 194, "$21.49 /EA"), word(378, 194, "$21.49 /EA"),
  word(441, 194, "$42.89 /EA"), word(504, 194, "$42.89 /EA"), word(567, 194, "$84.99 /EA"),
  word(74, 195, "$3.70 /SF"), word(171, 195, "$94.96 /CT"),
  // color rows — SKUs only; the second row splits across two baselines
  word(42, 211, "Canopy Elegance"), word(178, 211, "EM815CEP"),
  word(253, 211, "EM815TMD"), word(317, 211, "EM815RED"), word(380, 211, "EM815SQN"),
  word(443, 211, "EM815STN"), word(504, 211, "EM815FSTN"), word(566, 211, "408TTF295R"),
  word(253, 225, "EM824TMD"), word(317, 225, "EM824RED"),
  word(42, 226, "Canopy Party"), word(178, 226, "EM824CPP"),
  // Hawaii 4.5mm — banner + spec + coverage only; its grid opens page 2
  word(44, 543, "Hawaii 4.5mm"), word(200, 543, "25 Year Residential / 10 Year Commercial Warranty"),
  word(114, 558, '7" x 48"'), word(160, 558, "4.5mm (3.5mm + 1mm EVA PAD attached)"), word(370, 558, "• 12mil Wear Layer"), word(504, 558, "Waterproof"),
  word(322, 570, "28.68 SF/CT"),
];

// Page 2: the Hawaii grid, with the account line sitting INSIDE the trim-label
// band (the real failure mode) and letters-only trim codes.
const page2 = [
  word(231, 105, "Prepared especially for KEIM LUMBER CO"),
  word(312, 116, "Overlap Stair"), word(379, 116, "Flush Stair"),
  word(79, 121, "Item Name"), word(188, 121, "Item #"), word(261, 121, "3 IN 1"),
  word(316, 125, 'Nose (94")'), word(379, 125, 'Nose (94")'),
  word(252, 141, "$42.89 /EA"), word(315, 141, "$42.89 /EA"), word(378, 141, "$51.79 /EA"),
  word(74, 142, "$2.29 /SF"), word(171, 142, "$65.68 /CT"),
  word(176, 157, "HW45HO409"), word(40, 158, "Honolulu"), word(254, 158, "HWHO3N1"),
  word(318, 159, "HWHOSTN"), word(379, 159, "HWHOFSTN"),
];

const run = (...pages) => {
  const { rows, mapping, meta, warnings } = parseTrueTouchPages(pages);
  return { ...parseMapped(rows, mapping), meta, warnings };
};

test("recognizes the OVF TrueTouch layout, and the drop router tags it", () => {
  assert.equal(isTrueTouch([page1, page2]), true);
  // an "Item Name/Item #" grid without the OVF account line is not this sheet
  assert.equal(isTrueTouch([page1.filter((i) => !/Prepared/.test(i.str))]), false);
  // …nor is the account line alone
  assert.equal(isTrueTouch([[word(54, 105, "Prepared especially for KEIM LUMBER CO")]]), false);
  assert.equal(fileFormat({ pages: [page1, page2], isPdf: true }), "ovf-truetouch");
});

test("floors: SKU = Item #, carton cost + coverage from the band, REAL WOOD → hardwood", () => {
  const { items, meta } = run(page1, page2);
  assert.equal(meta.flooring, 3);
  const floor = items.find((i) => i.sku === "EM815CEP");
  assert.ok(floor, "flooring keyed by Item #");
  assert.equal(floor.cost, 94.96);
  assert.equal(floor.priceUnit, "BX");
  assert.equal(floor.sfPerUnit, 25.68);
  assert.equal(floor.type, "hardwood");            // "REAL WOOD" construction
  assert.equal(floor.productLine, "Evolv");        // banner, title-cased
  assert.equal(floor.brand, "TrueTouch");
  assert.equal(floor.description, "Evolv Canopy Elegance");
  assert.equal(floor.size, '7 11/16" x 24"/36"/60" RL'); // the spec line's size clause
});

test("trims: per-column price, cleaned label, trim marker, fits the floor SKU", () => {
  const { items } = run(page1, page2);
  const tmold = items.find((i) => i.sku === "EM815TMD");
  assert.equal(tmold.cost, 21.49);
  assert.equal(tmold.priceUnit, "EA");
  assert.equal(tmold.trim, true);
  assert.match(tmold.description, /Canopy Elegance — T-Molding/);
  assert.match(tmold.description, /fits EM815CEP/);
  assert.deepEqual(tmold.fits, ["EM815CEP"]);
  // the stair-nose columns carry their own (higher) price
  assert.equal(items.find((i) => i.sku === "EM815STN").cost, 42.89);
  // the tread column's carton-minimum note rides the description
  const tread = items.find((i) => i.sku === "408TTF295R");
  assert.equal(tread.cost, 84.99);
  assert.match(tread.description, /Round Stair Tread \(3 ctn min\)/);
  // floors don't carry the marker
  assert.equal(items.find((i) => i.sku === "EM815CEP").trim, false);
});

test("a color row split across two baselines still reads as one row", () => {
  const { items } = run(page1, page2);
  const floor = items.find((i) => i.sku === "EM824CPP");
  assert.equal(floor.description, "Evolv Canopy Party");
  assert.match(items.find((i) => i.sku === "EM824TMD").description, /fits EM824CPP/);
});

test("a section banner on one page feeds the grid on the next; waterproof → vinyl", () => {
  const { items } = run(page1, page2);
  const floor = items.find((i) => i.sku === "HW45HO409");
  assert.equal(floor.productLine, "Hawaii 4.5mm");  // carried across the page break
  assert.equal(floor.type, "vinyl");
  assert.equal(floor.cost, 65.68);
  assert.equal(floor.sfPerUnit, 28.68);
  assert.equal(floor.size, '7" x 48"');
});

test("letters-only trim codes survive, and the account line never joins a label", () => {
  const { items } = run(page1, page2);
  const stn = items.find((i) => i.sku === "HWHOSTN");   // no digit in the code
  assert.ok(stn, "letters-only trim code kept");
  assert.equal(stn.cost, 42.89);
  assert.match(stn.description, /Overlap Stair Nose/);
  assert.equal(items.find((i) => i.sku === "HWHOFSTN").cost, 51.79);
  const n1 = items.find((i) => i.sku === "HWHO3N1");
  assert.match(n1.description, /Honolulu — 3 IN 1/);
  assert.doesNotMatch(n1.description, /Prepared/);      // the page-2 account line sits in the label band
});

test("price reconciliation guard: a mismatched carton drops to the per-sq-ft cost", () => {
  const bad = [
    word(44, 119, "BADLINE"), word(300, 119, "15 Year Residential / 5 Year Commercial Warranty"),
    word(114, 134, '7" x 48"'), word(160, 134, "4.5mm (3.5mm + 1mm EVA PAD attached) Waterproof"),
    word(322, 148, "10 SF/CT"),
    word(79, 169, "Item Name"), word(188, 169, "Item #"), word(261, 165, "3 IN 1"),
    word(74, 195, "$3.54 /SF"), word(171, 195, "$100.00 /CT"), word(252, 194, "N/A /PC"),
    word(40, 211, "Bad Row"), word(178, 211, "BR1001"), word(254, 211, "BR1001N1"),
  ];
  const { items } = run(bad);
  const f = items.find((i) => i.sku === "BR1001");
  assert.equal(f.cost, 3.54, "distrust the carton, quote the honest per-sqft cost"); // 100/10 ≠ 3.54
  assert.equal(f.priceUnit, "SF");
  // an "N/A" trim column is a listed molding with no current price
  const t = items.find((i) => i.sku === "BR1001N1");
  assert.equal(t.cost, null);
  assert.equal(t.priceUnit, "PC");
});

test("a re-organized sheet degrades to a visible warning, never garbage rows", () => {
  const { meta, warnings } = run([[word(40, 100, "Some unrelated prose page")]]);
  assert.equal(meta.flooring, 0);
  assert.equal(warnings.length, 1);
});

// --- the .xls workbook version -----------------------------------------------
// Rows verbatim from the real ovf-truetouch.xls (a band per collection kind):
// the Evolv real-wood grid, the two Hawaii thicknesses sharing trim codes, and
// a Tsunami band with an N/A trim column and a trimless color.
const SHEET_ROWS = [
  [null, null, null, null, null, null, null, null, null, null],
  ["Prepared especially for KEIM LUMBER CO           @(70) (035360)", null, null, null, null, null, null, null, null, null],
  [" EVOLV", null, null, null, null, null, null, null, null, "Limited Lifetime Residential / 15 Year Limited Commercial Warranty "],
  ["1/2\" 12mm (10mm REAL WOOD + 2mm PAD attached)  x 7 11/16\" x 24\"/36\"/60\" RL •  AC4+ Wear Layer  •  Painted Bevel  •  Unilin Click", null, null, null, null, null, null, null, null, null],
  ["25.68 SF/CT  •  50 CT/PA  •  49.02 LB/CT", null, null, null, null, null, null, null, null, null],
  ["Item Name", "Item #", "T-Molding \n(94.5\")", "Reducer\n(94.5\")", "Square Nose/ End Cap (94.5\")", "Overlap Stair Nose  (94.5\")", "Flush Stair\nNose (94.5\")", "Round Stair Tread 48\"\n3 ctn min", "Square Stair Tread 48\"\n3 ctn min", null],
  ["$3.70 /SF", "$94.96 /CT", "$21.49 /EA", "$21.49 /EA", "$21.49 /EA", "$42.89 /EA", "$42.89 /EA", "$84.99 /EA", "$84.99 /EA", null],
  [" Canopy Elegance", "EM815CEP", "EM815TMD", "EM815RED", "EM815SQN", "EM815STN", "EM815FSTN", "408TTF295R", "409TTF295S", null],
  [" Canopy Party", "EM824CPP", "EM824TMD", "EM824RED", "EM824SQN", "EM824STN", "EM824FSTN", "408TTF299R", "409TTF299S", null],
  ["Hawaii 4.5mm", null, null, null, null, null, null, "25 Year Residential / 10 Year Commercial Warranty ", null, null],
  ["7\" x 48\"  •  4.5mm (3.5mm + 1mm EVA PAD attached)  • 12mil Wear Layer  •  Micro Bevel  •  Waterproof", null, null, null, null, null, null, null, null, null],
  ["28.68 SF/CT  •  55 CT/PA  •  43.32 LB/CT", null, null, null, null, null, null, null, null, null],
  ["Item Name", "Item #", "3 IN 1", "Overlap Stair Nose (94\")", "Flush Stair\nNose (94\")", null, null, null, null, null],
  ["$2.29 /SF", "$65.68 /CT", "$42.89 /EA", "$42.89 /EA", "$51.79 /EA", null, null, null, null, null],
  ["Honolulu", "HW45HO409", "HWHO3N1", "HWHOSTN", "HWHOFSTN", null, null, null, null, null],
  ["Hawaii 5.0 mm", null, null, null, null, null, null, "25 Year Residential / 10 Year Commercial Warranty ", null, null],
  ["7\" x 60\"  •  5.0 mm (4.0mm + 1mm EVA PAD attached)  • 20mil Wear Layer  •  Painted Bevel  •  Waterproof", null, null, null, null, null, null, null, null, null],
  ["30.02 SF/CT  •  55 CT/PA  •  44.40 LB/CT", null, null, null, null, null, null, null, null, null],
  ["Item Name", "Item #", "3 IN 1", "Overlap Stair Nose (94\")", "Flush Stair\nNose (94\")", null, null, null, null, null],
  ["$2.69 /SF", "$80.75 /CT", "$42.89 /EA", "$42.89 /EA", "$51.79 /EA", null, null, null, null, null],
  ["Honolulu", "HW50HO509", "HWHO3N1", "HWHOSTN", "HWHOFSTN", null, null, null, null, null],
  [" TSUNAMI (7\" x 60\")", null, null, null, null, null, null, "15 Year Residential / 5 Year Commercial Warranty ", null, null],
  ["7\" x 60\"  •  6.5mm (1.5mm LVT + 4mm WPC + 1mm EVA PAD attached)  • 20mil Wear Layer  •  Micro Bevel  •  Waterproof", null, null, null, null, null, null, null, null, null],
  ["36.12 SF/CT  •  60 CT/PA  •  51 LB/CT", null, null, null, null, null, null, null, null, null],
  ["Item Name", "Item #", "Overlap Stair Nose (94\")", "Flush Stair Nose (94\")", "3 IN 1      (94\")", null, null, null, null, null],
  ["$3.08 /SF", "$111.41 /CT", "N/A /PC", "$66.49 /PC", "$44.99 /PC", null, null, null, null, null],
  [" Beach", "W88718", null, null, null, null, null, null, null, null],
  [" Crest", "W88711", "W88711STN", "W88711FSTN", "W887113N1", null, null, null, null, null],
];
const SHEETS = [{ name: "Sheet1", rows: SHEET_ROWS }];

const runSheet = (rows = SHEET_ROWS) => {
  const { rows: canon, mapping, meta, warnings } = parseTrueTouchSheet(rows);
  return { ...parseMapped(canon, mapping), meta, warnings };
};

test("xls: recognized, routed to the SAME tag as the PDF, and parseOvf dispatches it", () => {
  assert.equal(isTrueTouchSheet(SHEETS), true);
  assert.equal(fileFormat({ sheets: SHEETS }), "ovf-truetouch");
  // the account line alone (a non-TrueTouch OVF book) is not this sheet
  assert.equal(isTrueTouchSheet([{ name: "S", rows: [SHEET_ROWS[1]] }]), false);
  const via = parseOvf(SHEETS, "ovf-truetouch");
  assert.equal(via.meta.flooring, 6);
});

test("xls floors: carton cost + coverage, types from the construction prose", () => {
  const { items, meta, warnings } = runSheet();
  assert.equal(meta.flooring, 6);
  assert.equal(warnings.length, 0);
  const floor = items.find((i) => i.sku === "EM815CEP");
  assert.equal(floor.cost, 94.96);
  assert.equal(floor.priceUnit, "BX");
  assert.equal(floor.sfPerUnit, 25.68);
  assert.equal(floor.type, "hardwood");
  assert.equal(floor.productLine, "Evolv");
  assert.equal(floor.brand, "TrueTouch");
  assert.equal(floor.description, "Evolv Canopy Elegance");
  assert.equal(floor.size, '7 11/16" x 24"/36"/60" RL');
  const ts = items.find((i) => i.sku === "W88718");
  assert.equal(ts.productLine, 'Tsunami (7" x 60")');
  assert.equal(ts.type, "vinyl");
  assert.equal(ts.cost, 111.41);
});

test("xls trims: column price + label, tread note, N/A stays a priceless listing", () => {
  const { items } = runSheet();
  const tmold = items.find((i) => i.sku === "EM815TMD");
  assert.equal(tmold.cost, 21.49);
  assert.equal(tmold.trim, true);
  assert.match(tmold.description, /Canopy Elegance — T-Molding/);
  assert.deepEqual(tmold.fits, ["EM815CEP"]);
  const tread = items.find((i) => i.sku === "408TTF295R");
  assert.match(tread.description, /Round Stair Tread \(3 ctn min\)/);
  // the Tsunami overlap-nose column prints "N/A /PC"
  const na = items.find((i) => i.sku === "W88711STN");
  assert.equal(na.cost, null);
  assert.equal(na.priceUnit, "PC");
  assert.equal(items.find((i) => i.sku === "W88711FSTN").cost, 66.49);
});

test("xls: one trim shared by both Hawaii thicknesses fits both floors", () => {
  const { items } = runSheet();
  const n1 = items.find((i) => i.sku === "HWHO3N1");
  assert.deepEqual(n1.fits, ["HW45HO409", "HW50HO509"]);
  assert.equal(items.filter((i) => i.sku === "HWHO3N1").length, 1); // deduped, not doubled
});

test("xls: a re-organized sheet degrades to a visible warning, never garbage rows", () => {
  const { meta, warnings } = runSheet([["Some unrelated prose"], ["More prose", "notasku"]]);
  assert.equal(meta.flooring, 0);
  assert.equal(warnings.length, 1);
});
