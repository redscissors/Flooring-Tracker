import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePdfPages, clusterRows } from "./pdfbook.js";
import { parseMapped } from "./pricebook.js";
import { costSqft } from "./orderbook.js";

// Build text items the way pdf.js yields them: { str, x, y, w }. `word` places
// one word; width is proportional to length (≈6px/char) so intra-label gaps stay
// small and inter-column gaps stay large, as on a real sheet.
const word = (x, y, s) => ({ str: s, x, y, w: String(s).length * 6 });

// A standard Glazzio page: 8-column box-priced tile, header on one baseline, two
// products, plus a marketing line the parser must ignore. Column x-centers are
// spaced so the data gutters are unambiguous.
const HEADER = [
  word(55, 40, "Item"), word(80, 40, "#"),
  word(140, 40, "Collection"),
  word(215, 40, "Color"), word(247, 40, "Name"),
  word(315, 40, "Variation"),
  word(380, 40, "Pieces"), word(418, 40, "per"), word(438, 40, "Box"),
  word(470, 40, "SQF"), word(490, 40, "per"), word(510, 40, "Box"),
  word(545, 40, "$"), word(553, 40, "per"), word(573, 40, "SQF"),
  word(610, 40, "$"), word(618, 40, "per"), word(638, 40, "Box"),
];
const product = (y, sku, coll, nameWords, v, pcs, sf, psf, pbox) => [
  word(52, y, sku), word(140, y, coll),
  ...nameWords.map((w, i) => word(215 + i * 30, y, w)),
  word(380, y, v), word(430, y, pcs), word(500, y, sf), word(575, y, psf), word(645, y, pbox),
];
const standardPage = [
  ...HEADER,
  ...product(100, "L11LASA", "Lasa", ["Lasa", "24x48", "Polished"], "V2", "2", "15.5", "$5.20", "$80.60"),
  ...product(112, "L11ST.IM", "Statuario", ["Statuario", "24x48", "Polished"], "V2", "2", "15.5", "$5.20", "$80.60"),
  // marketing / legend line — no SKU-shaped leftmost cell, must be dropped
  word(60, 300, "SQUARE"), word(120, 300, "FOOT"), word(200, 300, "PRICES"), word(300, 300, "REFERENCE"),
];

const parse = (...pages) => {
  const { rows, mapping } = parsePdfPages(pages);
  return parseMapped(rows, mapping);
};

test("standard box-priced page: fields, size split, box→$/sqft, honesty", () => {
  const { items } = parse(standardPage);
  assert.equal(items.length, 2); // marketing line dropped, both dotted+plain SKUs kept
  const it = items.find((i) => i.sku === "L11LASA");
  assert.equal(it.description, "Lasa Polished");   // size pulled out of the name
  assert.equal(it.size, "24x48");
  assert.equal(it.productLine, "Lasa");
  assert.equal(it.style, "V2");
  assert.equal(it.pcPerUnit, 2);
  assert.equal(it.sfPerUnit, 15.5);
  assert.equal(it.cost, 80.6);
  assert.equal(it.priceUnit, "BX");
  assert.equal(costSqft(it), 5.2);                 // 80.60 / 15.5, the app's real math
  assert.ok(items.find((i) => i.sku === "L11ST.IM"), "dotted SKU survives the pattern");
});

test("self-consistency guard: box that doesn't reconcile with $/sqft yields no cost", () => {
  // priceBox 100 / SF-box 10 = $10/sqft, but the page prints $5/sqft → misread.
  const page = [
    ...HEADER,
    ...product(100, "BAD001", "Coll", ["Name"], "V2", "2", "10", "$5.00", "$100.00"),
  ];
  const { items } = parse(page);
  const it = items.find((i) => i.sku === "BAD001");
  assert.equal(it.cost, null, "inconsistent row emits no cost, never a wrong one");
});

test("plausibility ceiling: a $200+/sqft value is a misread column, dropped", () => {
  // Header with only Item # / Color Name / $ per SQF; the price cell is a stray
  // pallet SF count (1160) landing in the price slot.
  const page = [
    word(55, 40, "Item"), word(80, 40, "#"), word(150, 40, "Color"), word(182, 40, "Name"),
    word(300, 40, "$"), word(308, 40, "per"), word(328, 40, "SQF"),
    word(52, 100, "VIN001"), word(150, 100, "Plank"), word(300, 100, "1160"),
  ];
  const { items } = parse(page);
  const it = items.find((i) => i.sku === "VIN001");
  assert.equal(it.cost, null);
});

test("no recognizable header: nothing parsed, warning emitted", () => {
  const page = [word(60, 40, "Just"), word(120, 40, "some"), word(200, 40, "text")];
  const { rows, mapping, warnings } = parsePdfPages([page]);
  assert.equal(rows.length, 1); // header row only, no data
  assert.ok(warnings.length);
  assert.equal(parseMapped(rows, mapping).items.length, 0);
});

// A Glazzio page as it really is: the collection is a heading ABOVE the header,
// there is NO Collection column, and a grid of SKU labels (the photo captions)
// sits below the table. Column x-positions mirror the real "Martha's Manor" page.
const noCollHeader = (y) => [
  word(76, y, "Item"), word(96, y, "#"),
  word(141, y, "Color"), word(167, y, "Name"),
  word(243, y, "Tile"), word(260, y, "Size"),
  word(314, y, "Pcs"), word(332, y, "Per"), word(349, y, "Box"),
  word(373, y, "SQF"), word(394, y, "Per"), word(410, y, "Box"),
  word(437, y, "$"), word(444, y, "Per"), word(461, y, "SQF"),
  word(500, y, "$"), word(507, y, "Per"), word(524, y, "Box"),
];
const noCollRow = (y, sku, name, pcs, sf, psf, pbox) => [
  word(68, y, sku), word(122, y, name),
  word(230, y, "Nominal"), word(336, y, pcs), word(391, y, sf),
  word(445, y, psf), word(505, y, pbox),
];
const disclaimer = (y) => [
  word(57, y, "SQUARE"), word(110, y, "FOOT"), word(150, y, "PRICES"),
  word(210, y, "REFERENCE"), word(300, y, "ONLY"),
];
// One Glazzio table with a heading, a disclaimer, a header, and its rows —
// spaced the way the real page is (heading −36, disclaimer −18 above the header,
// rows +15/+27 below) so header-merge and row clustering behave as in the book.
const heading = (y, words) => words.map((w, i) => word(57 + i * 42, y, w));
const noCollSection = (y0, titleWords, rows) => [
  ...heading(y0, titleWords),
  ...disclaimer(y0 + 18),
  ...noCollHeader(y0 + 36),
  ...rows.map((r, i) => noCollRow(y0 + 51 + i * 12, ...r)).flat(),
];

test("no Collection column: the section heading above the header becomes the collection", () => {
  const page = noCollSection(98, ["Martha's", "Manor", "Square"], [
    ["MMR6061", "Cottontail", "50", "5.38", "$5.70", "$30.67"],
    ["MMR6062", "Slate", "50", "5.38", "$5.70", "$30.67"],
  ]);
  const { items } = parse(page);
  assert.equal(items.length, 2);
  const it = items.find((i) => i.sku === "MMR6061");
  assert.equal(it.productLine, "Martha's Manor Square");
  assert.equal(it.description, "Martha's Manor Square Cottontail"); // line fronts the name
  assert.equal(it.cost, 30.67);
});

test("photo-caption SKU grid is dropped and does not collapse the columns", () => {
  const page = [
    ...noCollSection(98, ["Abstract", "Collection"], [
      ["ABS6001", "Talco", "25", "9.90", "$5.05", "$50.00"],
    ]),
    // the strip of SKU labels printed under the tile photos: every cell a code,
    // spread across the page — must not be read as a row nor wreck the grid.
    word(60, 300, "ABS6001"), word(260, 300, "ABS6002"), word(460, 300, "ABS6003"),
  ];
  const { items } = parse(page);
  assert.equal(items.length, 1, "caption grid dropped, one real row survives");
  const it = items[0];
  assert.equal(it.sku, "ABS6001");
  assert.equal(it.cost, 50);        // columns intact → cost read from its own cell
  assert.equal(it.productLine, "Abstract Collection");
});

test("two sections on one page each take their own heading as the collection", () => {
  const page = [
    ...noCollSection(98, ["Martha's", "Manor", "Square"], [
      ["MMR6061", "Cottontail", "50", "5.38", "$5.70", "$30.67"],
    ]),
    ...noCollSection(320, ["Martha's", "Manor", "Hex"], [
      ["MMR6071", "Cottontail", "50", "5.38", "$6.50", "$34.97"],
    ]),
  ];
  const { items } = parse(page);
  assert.equal(items.find((i) => i.sku === "MMR6061").productLine, "Martha's Manor Square");
  assert.equal(items.find((i) => i.sku === "MMR6071").productLine, "Martha's Manor Hex");
});

test("a header whose labels wrap above the Item# line does not leak as the collection", () => {
  // "Rows per / Sheets per" stack on a line ABOVE the Item# baseline; the real
  // heading sits above THAT and must win.
  const page = [
    word(57, 98, "Mayan"), word(99, 98, "Garden"), word(141, 98, "Collection"),
    word(314, 128, "Rows"), word(340, 128, "per"), word(373, 128, "Sheets"), word(415, 128, "per"),
    ...noCollHeader(134),
    ...noCollRow(149, "MYN1301", "Aztec", "6", "5.19", "$17.50", "$90.83"),
  ];
  const { items } = parse(page);
  assert.equal(items[0].productLine, "Mayan Garden Collection");
});

test("clusterRows merges a two-baseline row but keeps distinct rows apart", () => {
  const rows = clusterRows([
    word(50, 100, "A"), word(200, 101, "B"), // 1px apart → same row
    word(50, 110, "C"),                       // 9px below → new row
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].items.length, 2);
});
