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

// --- Glazzio mosaics: chip vs. sheet (issue 016, ADR 0014 amendment) ----------

// Antiquities layout: a literal "Sheet Size" column and no chip anywhere (the
// shape is prose — "Hexagon"/"Diamond"). The sheet must NOT become the tile size.
test("mosaic with a Sheet Size column: sheet → coverage, chip left blank to prompt", () => {
  const header = [
    word(75, 175, "Item"), word(97, 175, "#"),
    word(141, 175, "Color"), word(169, 175, "Name"),
    word(219, 175, "Description"),
    word(300, 175, "Sheet"), word(328, 175, "Size"),
    word(372, 175, "SQF"), word(394, 175, "Per"), word(412, 175, "Sheet"),
    word(455, 175, "$"), word(463, 175, "Per"), word(480, 175, "SQF"),
    word(521, 175, "$"), word(529, 175, "Per"), word(547, 175, "Sheet"),
  ];
  const row = [
    word(73, 198, "ANQ52"), word(127, 198, "Eqyptian"), word(166, 198, "Ivory"),
    word(227, 198, "Hexagon"),
    word(289, 198, "11"), word(302, 198, '3/4"'), word(321, 198, "x"), word(329, 198, "11"), word(342, 198, '7/8"'),
    word(396, 198, "0.97"), word(463, 198, "$16.20"), word(533, 198, "$15.71"),
  ];
  const page = [word(52, 152, "Antiquities"), word(103, 152, "Collection"), ...header, ...row];
  const { items } = parse(page);
  const it = items.find((i) => i.sku === "ANQ52");
  assert.ok(it, "row survives");
  assert.equal(it.size, "", "the sheet dimension never fills the chip size");
  assert.equal(it.sheetSize, "11.75x11.875", "sheet dimension carried as sheetSize");
  assert.equal(it.sfPerUnit, 0.97, "per-sheet coverage");
  assert.equal(it.cost, 15.71); // priced per sheet, $/sqft = 15.71 / .97 ≈ 16.20 (reconciles)
  assert.match(it.description, /Hexagon/, "shape word stays in the name for the prompt");
});

// Aragon/Academia layout: Rows per Sheet + a prose SHEET SIZE line, no chip. The
// chip is derived (sheet ÷ rows) and coverage comes from the prose "= X SQF".
test("mosaic with Rows per Sheet + prose sheet line: chip derived, coverage from prose", () => {
  const header = [
    word(80, 139, "Item"), word(102, 139, "#"),
    word(176, 139, "Color"), word(203, 139, "Name"),
    word(277, 139, "Rows"), word(305, 139, "per"), word(322, 139, "Sheet"),
    word(392, 139, "$"), word(399, 139, "Per"), word(417, 139, "SQF"),
    word(483, 139, "$"), word(491, 139, "Per"), word(508, 139, "Sheet"),
  ];
  const row = [
    word(73, 162, "AGH5411"), word(180, 162, "Qassle"), word(212, 162, "Blu"),
    word(307, 162, "12"), word(400, 162, "$15.30"), word(492, 162, "$14.43"),
  ];
  const prose = [
    word(43, 220, "SHEET"), word(77, 220, "SIZE:"), word(103, 220, "11"), word(116, 220, '1/2"'),
    word(135, 220, "x"), word(142, 220, "11"), word(155, 220, '13/16"'), word(185, 220, "="),
    word(193, 220, ".943"), word(214, 220, "SQF"),
  ];
  const page = [word(44, 121, "Aragon"), word(82, 121, "Hills"), word(107, 121, "Collection"), ...header, ...row, ...prose];
  const { items } = parse(page);
  const it = items.find((i) => i.sku === "AGH5411");
  assert.ok(it, "row survives");
  assert.equal(it.size, "1x1", "chip ≈ 11.66 / 12 rows ≈ 1\", squared for grout");
  assert.equal(it.sheetSize, "11.5x11.8125");
  assert.equal(it.sfPerUnit, 0.943, "coverage from the prose = .943 SQF");
  assert.equal(it.cost, 14.43); // per sheet; $/sqft = 14.43 / .943 ≈ 15.30 (reconciles)
  assert.equal(it.pcPerUnit, null, "Rows per Sheet is NOT piece packaging");
});

// Eos 24x48 layout: a mosaic sub-table whose longer "-M" code kerns against the
// color name (no gutter) so the SKU/name cell merges. The code is peeled back
// off so the row survives, its name-borne "2x2" chip parses, and the coverage
// comes from the combined "…COVERAGE… MOSAIC COVERAGE: 12 x 12 = 1 SQF" line.
test("mosaic sub-table: merged SKU is un-split so the row survives with its 2x2 chip", () => {
  const header = [
    word(86, 235, "Item"), word(105, 235, "#"),
    word(155, 235, "Color"), word(179, 235, "Name"),
    word(231, 235, "Variation"), word(283, 235, "Thickness"), word(364, 235, "PEI"), word(421, 235, "Finish"),
    word(479, 235, "$"), word(486, 235, "per"), word(501, 235, "Sheet/SQF"),
  ];
  // The -M code's right edge overlaps the color name → detectColumns merges them.
  const row = [
    word(72, 257, "LRGSTB10-M"), word(129, 257, "Stream"), word(158, 257, "Bone"),
    word(179, 257, "2x2"), word(194, 257, "Mosaic"),
    word(291, 257, "10mm"), word(367, 257, "III"), word(417, 257, "Polished"), word(498, 257, "$21.00"),
  ];
  const prose = [
    word(69, 281, "24x48"), word(91, 281, "COVERAGE"), word(135, 281, ":"), word(139, 281, "7.75"), word(155, 281, "SQF/PC"),
    word(405, 281, "MOSAIC"), word(436, 281, "COVERAGE:"), word(483, 281, "12"), word(493, 281, "x"), word(498, 281, '12"'), word(511, 281, "="), word(518, 281, "1"), word(524, 281, "SQF"),
  ];
  const page = [word(69, 163, "24x48-6"), ...header, ...row, ...prose];
  const { items } = parse(page);
  const it = items.find((i) => i.sku === "LRGSTB10-M");
  assert.ok(it, "the merged-SKU row is not dropped");
  assert.equal(it.size, "2x2", "the name-borne chip size parses");
  assert.equal(it.sheetSize, "12x12", "sheet from the MOSAIC COVERAGE segment, not the 24x48 before it");
  assert.equal(it.sfPerUnit, 1, "one 12x12 sheet = 1 SQF");
  assert.equal(it.cost, 21);
  assert.match(it.description, /Stream Bone/);
});

test("clusterRows merges a two-baseline row but keeps distinct rows apart", () => {
  const rows = clusterRows([
    word(50, 100, "A"), word(200, 101, "B"), // 1px apart → same row
    word(50, 110, "C"),                       // 9px below → new row
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].items.length, 2);
});
