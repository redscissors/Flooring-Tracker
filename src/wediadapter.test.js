import test from "node:test";
import assert from "node:assert/strict";
import { normBookItem } from "./orderbook.js";
import { FIXTURE_ROWS } from "./wedifixture.js";

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
