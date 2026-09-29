import { test } from "node:test";
import assert from "node:assert/strict";
import { printColumns, tierLabel } from "./compareprintcols.js";

const cells = ["schluter:membrane", "wedi:board", "schluter:board", "wedi:membrane"].map((key) => ({ key }));
const none = () => null;

test("printColumns keeps checked in column order", () => {
  const out = printColumns(cells, ["schluter:membrane", "wedi:board"], none);
  assert.deepEqual(out.map((c) => c.key), ["wedi:board", "schluter:membrane"]);
});

test("printColumns drops missing columns", () => {
  const miss = (c) => (c.key === "wedi:board" ? "Nothing built yet" : null);
  assert.deepEqual(printColumns(cells, ["wedi:board", "wedi:membrane"], miss).map((c) => c.key), ["wedi:membrane"]);
  assert.deepEqual(printColumns(cells, ["wedi:board"], miss), []);
  assert.deepEqual(printColumns(cells, [], none), []);
});

test("tierLabel is blank at retail and names any other level", () => {
  assert.equal(tierLabel("retail"), "");
  assert.equal(tierLabel(undefined), "");
  assert.equal(tierLabel("builder"), "Builder pricing");
  assert.equal(tierLabel("employee"), "Employee pricing");
});
