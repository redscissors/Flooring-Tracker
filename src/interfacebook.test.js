import { test } from "node:test";
import assert from "node:assert/strict";
import { isInterfacePriceList, parseInterfacePages } from "./interfacebook.js";
import { parseMapped } from "./pricebook.js";
import { resolveMarkup, costSqft, pricedItem } from "./orderbook.js";
import { stockPatch } from "./stock.js";

// Build text items the way pdf.js yields them: { str, x, y, w }. x-values
// mirror the real sheet's grid (name 53, format 247, collection 328, i2 462,
// price 515).
const word = (x, y, s) => ({ str: s, x, y, w: String(s).length * 6 });

// The carpet header line plus the rotated format legend beside it, as printed
// on every page.
const header = () => [
  word(540, 25, "2025"),
  word(119, 133, "Style Name"),
  word(267, 133, "1"), word(267, 142, "x"), word(267, 151, "52"), word(267, 166, "=PS"),
  word(280, 133, "M1=M"), word(280, 166, "M"),
  word(293, 133, "M"), word(293, 145, "1"), word(293, 154, "x"), word(293, 163, "05"), word(293, 178, "=P"),
  word(354, 133, "Collection"), word(461, 134, "i2"), word(510, 133, "Price"),
];

// A carpet data row; coll/flag are optional, wrap is a collection first line
// printed on its own baseline just above the row.
const crow = (y, name, format, coll, flag, price, wrap) => {
  const items = [];
  if (wrap) items.push(word(328, y - 14, wrap)); // the wrap takes a full row slot of its own
  items.push(word(53, y, name), word(247, y, format));
  if (coll) items.push(word(328, y, coll));
  if (flag) items.push(word(462, y, flag));
  items.push(word(515, y, price));
  return items;
};

const carpetPage = [
  ...header(),
  ...crow(199, "SHIVER ME TIMBERS", "SP", "", "i2", "$26.25"),
  ...crow(213, "WW860", "SP", "World Woven", "", "$26.50"),
  ...crow(227, "AE310", "50", "Aerial", "i2", "$22.00"),
  ...crow(255, "BOUND BY THREAD I", "SP", "Coordinates", "", "$42.00", "Dressed Lines"),
  ...crow(269, "OPEN AIR 401", "SP", "Open Air", "Y", "$18.00"),
  ...crow(283, "OPEN AIR 408", "SP", "Open Air", "N", "$18.00"),
  ...crow(297, "CAP ROCK", "M", "Lost Palms", "", "$26.75"),
  ...crow(311, "VIVA COLORES", "50", "", "", "$29.83"),
  ...crow(325, "VIVA COLORES", "SP", "", "", "$29.83"),
  ...[word(53, 339, "OPEN AIR 442"), word(125, 339, "*"), word(247, 339, "M"), word(328, 339, "Open Air"), word(462, 339, "Y"), word(515, 339, "$21.75")],
];

// The LVT section: its own header row, then per-square-foot rows with metric
// sizes and a thickness column.
const lvtPage = [
  ...header(),
  word(112, 228, "Product Name"), word(275, 228, "Size"), word(354, 228, "Collection"), word(440, 228, "Thickness"), word(510, 228, "Price"),
  word(53, 242, "BRUSHED LINES"), word(247, 242, "25cm"), word(276, 242, "x"), word(284, 242, "1m"), word(436, 242, "4.5"), word(453, 242, "mm"), word(517, 242, "$3.35"),
  word(53, 256, "CLIFF"), word(247, 256, "25cm"), word(276, 256, "x"), word(284, 256, "1m"), word(328, 256, "Fresco"), word(364, 256, "Valley"), word(436, 256, "4.5"), word(453, 256, "mm"), word(517, 256, "$3.35"),
  word(53, 270, "HEIRLOOM 3.0mm"), word(247, 270, "25cm"), word(276, 270, "x"), word(284, 270, "1m"), word(328, 270, "Lasting"), word(364, 270, "Impressions"), word(436, 270, "3.0"), word(453, 270, "mm"), word(517, 270, "$2.35"),
];

const run = (...pages) => {
  const { rows, mapping, meta, warnings } = parseInterfacePages(pages);
  const parsed = parseMapped(rows, mapping);
  return { items: parsed.items, mapping, meta, warnings };
};

test("recognizes the Interface price list layout", () => {
  assert.equal(isInterfacePriceList([carpetPage]), true);
  assert.equal(isInterfacePriceList([[word(55, 40, "Pattern"), word(140, 40, "Color Code"), word(200, 40, "Catalog #")]]), false);
});

test("carpet rows: $/sy ÷ 9 cost, assumed carton, type carpet", () => {
  const { items, meta } = run(carpetPage);
  assert.equal(meta.carpet, 10);
  const smt = items.find((i) => i.sku === "SHIVER ME TIMBERS");
  assert.ok(smt, "style name is the SKU");
  assert.equal(smt.type, "carpet");
  assert.equal(smt.cost, 2.92);                 // $26.25/sy ÷ 9, the rep's own example
  assert.equal(smt.priceUnit, "SF");
  assert.equal(smt.orderUnit, "CT");
  assert.equal(smt.sfPerUnit, 53.82);           // 5.98 sy/carton, the standard pack
  assert.equal(smt.pcPerUnit, 20);
  assert.equal(smt.size, "25cm x 1m plank");
  assert.equal(smt.description, "Shiver Me Timbers");
  assert.equal(smt.brand, "Interface");
  assert.equal(smt.note, "i2 — non-directional install");
  assert.equal(costSqft(smt), 2.92);
});

test("a pick lands carpet with carton ordering", () => {
  const { items } = run(carpetPage);
  const smt = pricedItem(items.find((i) => i.sku === "SHIVER ME TIMBERS"), { default: 50 });
  const patch = stockPatch(smt, {});
  assert.equal(patch.type, "carpet");
  assert.equal(patch.priceSqft, "4.38");        // 2.92 × 1.5
  assert.equal(patch.cartonSf, "53.82");
  assert.equal(patch.cartonUnit, "CT");
  assert.equal(patch.sizeText, "25cm x 1m plank");
});

test("code-named styles keep their capitals and front the collection", () => {
  const { items } = run(carpetPage);
  assert.equal(items.find((i) => i.sku === "WW860").description, "World Woven WW860");
  const ae = items.find((i) => i.sku === "AE310");
  assert.equal(ae.description, "Aerial AE310");
  assert.equal(ae.size, "50cm x 50cm");
  assert.equal(ae.mfg, "Aerial");               // collection = the markup group + search subtitle
});

test("a wrapped collection joins onto its data row", () => {
  const { items } = run(carpetPage);
  const bbt = items.find((i) => i.sku === "BOUND BY THREAD I");
  assert.equal(bbt.mfg, "Dressed Lines Coordinates");
  assert.equal(bbt.description, "Bound By Thread I"); // roman numeral survives the casing
  // the wrap belongs to that row only — the next row keeps its own collection
  assert.equal(items.find((i) => i.sku === "OPEN AIR 401").mfg, "Open Air");
});

test("the i2 column's Y/N spelling reads as the i2 mark", () => {
  const { items } = run(carpetPage);
  assert.equal(items.find((i) => i.sku === "OPEN AIR 401").note, "i2 — non-directional install");
  assert.equal(items.find((i) => i.sku === "OPEN AIR 408").note, "");
});

test("large formats carry no assumed carton and order by exact square feet", () => {
  const { items, warnings } = run(carpetPage);
  const cap = items.find((i) => i.sku === "CAP ROCK");
  assert.equal(cap.size, "1m x 1m");
  assert.equal(cap.cost, 2.97);                 // $26.75/sy ÷ 9
  assert.equal(cap.sfPerUnit, null);
  assert.equal(cap.orderUnit, "");
  const patch = stockPatch(pricedItem(cap, { default: 50 }), {});
  assert.equal(patch.cartonSf, undefined);
  assert.ok(warnings.some((w) => /large-format/.test(w)));
});

test("a style sold in two formats splits into per-format SKUs", () => {
  const { items } = run(carpetPage);
  const sq = items.find((i) => i.sku === "VIVA COLORES 50");
  const pl = items.find((i) => i.sku === "VIVA COLORES SP");
  assert.ok(sq && pl, "both formats import");
  assert.equal(sq.size, "50cm x 50cm");
  assert.equal(pl.size, "25cm x 1m plank");
});

test("the footnote asterisk drops from SKU and name", () => {
  const { items } = run(carpetPage);
  const oa = items.find((i) => i.sku === "OPEN AIR 442");
  assert.ok(oa, "starred style keyed clean");
  assert.equal(oa.description, "Open Air 442");
});

test("LVT rows: per-square-foot as printed, type vinyl, metric size + thickness", () => {
  const { items, meta } = run(lvtPage);
  assert.equal(meta.lvt, 3);
  const bl = items.find((i) => i.sku === "BRUSHED LINES");
  assert.equal(bl.type, "vinyl");
  assert.equal(bl.cost, 3.35);
  assert.equal(bl.priceUnit, "SF");
  assert.equal(bl.size, "25cm x 1m");
  assert.equal(bl.thickness, "4.5 mm");
  assert.equal(bl.sfPerUnit, null);
  const heirloom = items.find((i) => i.sku === "HEIRLOOM 3.0mm");
  assert.ok(heirloom, "thickness twin keeps its own SKU");
  assert.equal(heirloom.cost, 2.35);
  assert.equal(items.find((i) => i.sku === "CLIFF").mfg, "Fresco Valley");
});

test("collection is the markup group", () => {
  const { items, mapping } = run(carpetPage);
  assert.equal(mapping.groupBy, "mfg");
  const markups = { default: 40, groupBy: "mfg", byGroup: { "Open Air": 60 } };
  assert.equal(resolveMarkup(markups, items.find((i) => i.sku === "OPEN AIR 401")), 60);
  assert.equal(resolveMarkup(markups, items.find((i) => i.sku === "WW860")), 40);
});

test("the square-yard conversion warning always rides a carpet import", () => {
  const { warnings } = run(carpetPage);
  assert.ok(warnings.some((w) => /square yard/.test(w) && /53\.82/.test(w)));
  const none = parseInterfacePages([[word(53, 40, "nothing here")]]);
  assert.ok(none.warnings.some((w) => /No Interface product rows/.test(w)));
});
