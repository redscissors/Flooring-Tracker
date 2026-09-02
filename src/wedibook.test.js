import test from "node:test";
import assert from "node:assert/strict";
import { PRICELIST_SHEETS } from "./wedipricelistfixture.js";

test("fixture: the five-sheet snapshot, blank rows dropped, nothing interpreted", () => {
  assert.deepEqual(PRICELIST_SHEETS.map((s) => s.name),
    ["wedi Fundo", "wedi S-Dry", "wedi Builder Choice", "Wellness and Spa", "New Product Data"]);
  assert.deepEqual(PRICELIST_SHEETS.map((s) => s.rows.length), [301, 79, 48, 99, 75]);
  // A raw grid: the title line is still there, uninterpreted.
  assert.match(String(PRICELIST_SHEETS[0].rows[0][1]), /^wedi Distribution Pricelist 2026/);
  // Numbers stayed numbers (the parser reads prices by type, not by parsing text).
  assert.equal(typeof PRICELIST_SHEETS[0].rows[5][6], "number");
});
