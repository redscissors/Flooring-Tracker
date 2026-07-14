import { test } from "node:test";
import assert from "node:assert/strict";
import { isManningtonCartons, parseManningtonPages } from "./manningtonbook.js";
import { parseMapped } from "./pricebook.js";

// Build text items the way pdf.js yields them: { str, x, y, w }.
const word = (x, y, s) => ({ str: s, x, y, w: String(s).length * 6 });

// One Mannington "Cartons Detail" page: category banner, a section header, the
// stacked trim-column header, the "Pattern …" price row, and data rows. x-values
// mirror the real grid the parser reads by fixed band.
function page(category, sectionLine, dataRows) {
  const items = [
    word(378, 10, category),                                  // category banner (top)
    word(9, 100, sectionLine), word(433, 100, "Warranty: Limited"), // section header
    // stacked trim labels (band above the Pattern row)
    word(496, 150, "Quarter"), word(491, 158, "Round"),
    word(531, 150, "Reducer"),
    word(564, 150, "T-Mold"),
    // the "Pattern …" row carries each trim column's single price
    word(30, 175, "Pattern"), word(96, 175, "Width"), word(144, 175, "Color"),
    word(184, 175, "Color"), word(200, 175, "Code"), word(233, 175, "Catalog"), word(258, 175, "#"),
    word(269, 175, "SQ.Ft."), word(301, 175, "Carton"), word(459, 175, "Profile"),
    word(497, 175, "$13.68"), word(534, 175, "$27.87"), word(571, 175, "$27.87"),
  ];
  dataRows.forEach((r, i) => {
    const y = 190 + i * 15;
    for (const w of r.pattern.split(" ").map((s, j) => word(12 + j * 30, y, s))) items.push(w);
    items.push(word(97, y, r.size), word(145, y, r.color), word(189, y, r.code), word(236, y, r.catalog));
    items.push(word(271, y, r.psf), word(301, y, r.carton), word(336, y, r.sf));
    items.push(word(363, y, "1170.000"), word(403, y, "50"), word(423, y, "38.320"), word(457, y, "Painted"));
    (r.trims || []).forEach((t, k) => items.push(word(496 + k * 37, y, t)));
  });
  return items;
}

const apexPage = page("LVT", "ADURA APEX (APXHP)", [
  { pattern: "Spalted Wych Elm", size: "8X72", color: "Dew", code: "APX020", catalog: "554236",
    psf: "$3.54", carton: "$82.84", sf: "23.40", trims: ["384421", "384469", "384445"] },
  { pattern: "Napa", size: "8X72", color: "Dry Cork", code: "APX040", catalog: "554241",
    psf: "$3.54", carton: "$82.84", sf: "23.40", trims: ["384430", "384469", "384454"] }, // 384469 shared
]);

const run = (...pages) => {
  const { rows, mapping, meta, warnings } = parseManningtonPages(pages);
  return { ...parseMapped(rows, mapping), meta, warnings };
};

test("recognizes the Mannington Cartons Detail layout", () => {
  assert.equal(isManningtonCartons([apexPage]), true);
  // a page with none of the signature headers is not Mannington
  assert.equal(isManningtonCartons([[word(55, 40, "Item"), word(80, 40, "#"), word(140, 40, "Color")]]), false);
});

test("flooring rows: SKU = color code, carton cost + coverage, category → type", () => {
  const { items, meta } = run(apexPage);
  assert.equal(meta.flooring, 2);
  const floor = items.find((i) => i.sku === "APX020");
  assert.ok(floor, "flooring keyed by color code");
  assert.equal(floor.type, "vinyl");             // LVT banner → vinyl
  assert.equal(floor.cost, 82.84);               // carton price
  assert.equal(floor.priceUnit, "BX");
  assert.equal(floor.sfPerUnit, 23.4);           // SF/carton coverage snapshot
  assert.match(floor.description, /Spalted Wych Elm Dew/);
  assert.equal(floor.productLine, "ADURA APEX"); // section heading, code stripped
});

test("trim rows: SKU = catalog #, per-piece cost, no floor type, parent code in description", () => {
  const { items } = run(apexPage);
  const trim = items.find((i) => i.sku === "384421");
  assert.ok(trim, "trim keyed by its catalog number");
  assert.equal(trim.type, null);                 // a misc / transition line, not a floor
  assert.equal(trim.priceUnit, "EA");
  assert.equal(trim.cost, 13.68);                // Quarter Round header price
  assert.match(trim.description, /Quarter Round/);
  assert.match(trim.description, /APX020/);       // fits its parent floor's code (searchable)
});

test("a trim shared by two colors is one product listing both parent codes", () => {
  const { items, meta } = run(apexPage);
  const shared = items.filter((i) => i.sku === "384469");
  assert.equal(shared.length, 1, "deduped to a single trim product");
  assert.match(shared[0].description, /APX020/);
  assert.match(shared[0].description, /APX040/);
  assert.equal(meta.trims, 5); // 384421,384445,384430,384454 + shared 384469
});

test("price reconciliation guard: mismatched carton drops to per-sq-ft cost", () => {
  const bad = page("LVT", "ADURA APEX (APXHP)", [
    { pattern: "Bad", size: "8X72", color: "Row", code: "BAD001", catalog: "111111",
      psf: "$3.54", carton: "$100.00", sf: "10.00", trims: [] }, // 100/10=10 ≠ 3.54
  ]);
  const { items } = run(bad);
  const f = items.find((i) => i.sku === "BAD001");
  assert.equal(f.cost, 3.54, "distrust the carton, quote the honest per-sqft cost");
  assert.equal(f.priceUnit, "SF");
});

test("laminate page maps to laminate type", () => {
  const lam = page("Laminate", "Restoration Collection (RST8V)", [
    { pattern: "Hillside Hickory", size: "8", color: "Acorn", code: "28210", catalog: "553376",
      psf: "$2.50", carton: "$43.75", sf: "17.50", trims: ["310656"] },
  ]);
  const { items } = run(lam);
  assert.equal(items.find((i) => i.sku === "28210").type, "laminate");
});
