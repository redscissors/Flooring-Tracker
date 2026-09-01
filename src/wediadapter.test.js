import test from "node:test";
import assert from "node:assert/strict";
import { normBookItem } from "./orderbook.js";
import { FIXTURE_ROWS } from "./wedifixture.js";
import { usOf, descOf, adaptRow, adaptBookRows } from "./wediadapter.js";

const live = () => FIXTURE_ROWS.map((r) => normBookItem(r, "bk_wedi"));

test("fixture: 152 persisted rows, the whole export including the placeholder", () => {
  assert.equal(FIXTURE_ROWS.length, 152);
  assert.equal(FIXTURE_ROWS.every((r) => r.active === true && r.data), true);
});

test("fixture: normBookItem rehydrates the shape the adapter will see", () => {
  const washer = live().find((r) => r.sku === "47832");
  assert.deepEqual(washer.vendorSkus, ["US5000009"]);
  assert.equal(washer.unit, "BX");
  assert.equal(washer.cost, 93.42);
  assert.equal(washer.price, 154.14);
  assert.equal(washer.bookId, "bk_wedi");
  // vendorSkus is sorted+deduped by normFits — column order does NOT survive
  assert.deepEqual(live().find((r) => r.sku === "29075").vendorSkus, ["075100050", "US9330001"]);
  // the shop's own code can appear in vendorSkus and must be excluded by usOf
  assert.deepEqual(live().find((r) => r.sku === "47815").vendorSkus, ["095225053", "47815"]);
});

test("usOf: a US-shaped code beats a numeric article number, whatever the sort order", () => {
  // 29075 carries an article number and the real US-SKU; normFits sorted them
  const r = live().find((x) => x.sku === "29075");
  assert.equal(usOf(r), "US9330001");
});

test("usOf: the shop's own Product Code is never the vendor's code", () => {
  // 47815 repeats its own sku in a vendor column; the article number must win
  assert.equal(usOf(live().find((x) => x.sku === "47815")), "095225053");
});

test("usOf: the ten-digit Subliner code is preserved, NOT corrected", () => {
  // WEDI_STOCK holds us:"US50000005" and wedi.js:4331 compensates for it.
  // A fixup table here would silently re-key the entry and break item() lookups.
  assert.equal(usOf(live().find((x) => x.sku === "28954")), "US50000005");
});

test("usOf: the custom-item placeholder derives nothing and is dropped", () => {
  const placeholder = live().find((x) => x.sku === "29WEDIT");
  assert.equal(usOf(placeholder), "");
  assert.equal(adaptRow(placeholder), null);
});

test("adaptRow: one live row to the six-field stockRow shape", () => {
  const e = adaptRow(live().find((x) => x.sku === "47832"));
  assert.deepEqual(Object.keys(e).sort(), ["cost", "desc", "erp", "retail", "unit", "us"]);
  assert.equal(e.erp, "47832");
  assert.equal(e.us, "US5000009");
  assert.equal(e.cost, 93.42);
  assert.equal(e.retail, 154.14);
  assert.equal(e.unit, "BX");
});

test("adaptBookRows: 152 in, 151 out — only the placeholder drops", () => {
  const out = adaptBookRows(live());
  assert.equal(out.length, 151);
  assert.equal(out.some((r) => r.erp === "29WEDIT"), false);
  assert.equal(out.every((r) => r.us), true);
});

test("descOf: the dimensions the importer moved to size/thickness come back inline", () => {
  // 47815: table desc is "5\"x82' Wedi Mesh Tape - …"; the importer left
  // "Wedi Mesh Tape - …" with size "5\"x82'"
  assert.match(descOf(live().find((x) => x.sku === "47815")), /5"x82'/);
  // 47700: a panel — width, depth AND thickness all have to survive
  const panel = descOf(live().find((x) => x.sku === "47700"));
  assert.match(panel, /3'/);
  assert.match(panel, /5'/);
  assert.match(panel, /1\/2"/);
});

test("descOf: a row's sfPerUnit coverage comes back in a form makeEntry's sf regex matches", () => {
  // 28954 carries sfPerUnit 322 (the importer split it out of the
  // description); wedi.js:4296-4298 matches /(\d+)\s*(?:sft|sf|ft2)\b/i
  // against desc to derive e.sf, so the figure has to survive the round trip.
  const d = descOf(live().find((x) => x.sku === "28954"));
  assert.match(d, /(\d+)\s*(?:sft|sf|ft2)\b/i);
  assert.equal(d.match(/(\d+)\s*(?:sft|sf|ft2)\b/i)[1], "322");
});
