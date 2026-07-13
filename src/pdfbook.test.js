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

test("clusterRows merges a two-baseline row but keeps distinct rows apart", () => {
  const rows = clusterRows([
    word(50, 100, "A"), word(200, 101, "B"), // 1px apart → same row
    word(50, 110, "C"),                       // 9px below → new row
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].items.length, 2);
});
