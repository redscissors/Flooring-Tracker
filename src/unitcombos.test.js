// The unit-combination truth table.
//
// One row per {Price U/M × No Broken U/M × has-SF/CT × has-PC/CT} shape a real
// vendor sheet has produced, asserting end-to-end (pricedItem → stockPatch) how
// the pick lands: sqft-by-the-carton, sqft-loose, or a count line — and at what
// price. Born of the 2026-07 VTC audit, where 801 per-piece-priced carton-sold
// trims silently underpriced 1–20× because no test owned their combo. When a
// new book surfaces a combo that isn't here, unitComboWarnings flags it in the
// import wizard; teaching the code the combo means adding its row HERE first.
// Golden values come from real VTC EFT 25-07-28 rows (SKUs kept for traceability).
import { test } from "node:test";
import assert from "node:assert/strict";
import { normOrderItem, pricedItem, unitComboWarnings } from "./orderbook.js";
import { stockPatch } from "./stock.js";

// Markup 0 so sell = vendor cost and the table reads straight off the sheet.
const land = (fields) => stockPatch(pricedItem(normOrderItem({ sku: "X", unit: "", ...fields }), { default: 0 }), {});

const TABLE = [
  // name, item fields, expected patch fields
  ["SF·CT +SF/CT — field tile, whole cartons",
    { type: "tile", priceUnit: "SF", orderUnit: "CT", cost: 3.29, sfPerUnit: 15.5, pcPerUnit: 12 },
    { type: "tile", priceSqft: "3.29", cartonSf: "15.5", cartonUnit: "CT" }],
  ["SF·SH +SF/CT — mosaic by the sheet, per-sheet coverage (PR #105)",
    { type: "tile", priceUnit: "SF", orderUnit: "SH", cost: 5.55, sfPerUnit: 9.72, pcPerUnit: 12 },
    { type: "tile", priceSqft: "5.55", cartonSf: "0.81", cartonUnit: "SH" }],
  ["SF·PC +SF/CT — sold loose, exact sqft",
    { type: "tile", priceUnit: "SF", orderUnit: "PC", cost: 4, sfPerUnit: 16, pcPerUnit: 8 },
    { type: "tile", priceSqft: "4", cartonSf: undefined, cartonUnit: undefined }],
  ["PC·CT +SF/CT — bullnose by the carton (CTIEPLIBN336R)",
    { type: "tile", priceUnit: "PC", orderUnit: "CT", cost: 27.99, sfPerUnit: 5.38, pcPerUnit: 8 },
    { type: "tile", priceSqft: "41.62", cartonSf: "5.38", cartonUnit: "CT" }],
  ["PC·CT no SF/CT — bullnose carton with no coverage → count line (CDSTABABN240R)",
    { type: "tile", priceUnit: "PC", orderUnit: "CT", cost: 56.89, pcPerUnit: 10 },
    { type: "misc", priceSqft: "568.9" }],
  ["PC·PC +SF/CT — loose pieces of a cartoned tile",
    { type: "tile", priceUnit: "PC", orderUnit: "PC", cost: 4.5, sfPerUnit: 16, pcPerUnit: 8 },
    { type: "tile", priceSqft: "2.25", cartonSf: undefined }],
  ["PC·PC no SF/CT — loose trim pieces, count line per piece (EDICNBLBN216 kin)",
    { type: "tile", priceUnit: "PC", orderUnit: "PC", cost: 14.44, pcPerUnit: 20 },
    { type: "misc", priceSqft: "14.44" }],
  ["SH·CT +SF/CT — mosaic sold only by the carton (EDISAIVMOS22)",
    { type: "tile", priceUnit: "SH", orderUnit: "CT", cost: 21.29, sfPerUnit: 8.72, pcPerUnit: 9 },
    { type: "tile", priceSqft: "21.97", cartonSf: "8.72", cartonUnit: "CT" }],
  ["PC·SH +SF/CT — the piece IS the sheet (CDSSUBEMOS22)",
    { type: "tile", priceUnit: "PC", orderUnit: "SH", cost: 21.79, sfPerUnit: 5.81, pcPerUnit: 6 },
    { type: "tile", priceSqft: "22.5", cartonSf: "0.9683", cartonUnit: "SH" }],
  ["SH·PC +SF/CT — sheets sold loose (CRMRSCGMOS11)",
    { type: "tile", priceUnit: "SH", orderUnit: "PC", cost: 22.09, sfPerUnit: 11, pcPerUnit: 11 },
    { type: "tile", priceSqft: "22.09", cartonSf: undefined }],
  ["EA·PC no coverage — flat accessory each",
    { type: "tile", priceUnit: "EA", orderUnit: "PC", cost: 12 },
    { type: "misc", priceSqft: "12" }],
  ["ST·ST no coverage — trim stick, typeless",
    { type: null, priceUnit: "ST", orderUnit: "ST", cost: 45.79 },
    { type: "misc", priceSqft: "45.79" }],
  ["ST·CT no SF/CT — sticks sold by the carton → count line per carton",
    { type: "tile", priceUnit: "ST", orderUnit: "CT", cost: 22.14, pcPerUnit: 6 },
    { type: "misc", priceSqft: "132.84" }],
  ["CT·CT +SF/CT — single-U/M carton book (stock-book shape)",
    { type: "hardwood", unit: "CT", cost: 200, sfPerUnit: 20 },
    { type: "hardwood", priceSqft: "10", cartonSf: "20", cartonUnit: "CT" }],
  ["SH single-U/M + per-SHEET coverage (stock-book mosaic — no PC/CT, no scaling)",
    { type: "tile", unit: "SH", cost: 27.99, sfPerUnit: 2 },
    { type: "tile", priceSqft: "14", cartonSf: "2", cartonUnit: "SH" }],
];

for (const [name, fields, expected] of TABLE) {
  test(`combo: ${name}`, () => {
    const patch = land(fields);
    for (const [k, v] of Object.entries(expected)) assert.equal(patch[k], v, k);
  });
}

test("every combo in the truth table imports without a unit warning", () => {
  const items = TABLE.map(([, fields]) => normOrderItem({ sku: "X", unit: "", ...fields }));
  assert.deepEqual(unitComboWarnings(items), []);
});
