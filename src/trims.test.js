import test from "node:test";
import assert from "node:assert/strict";
import { existingTrimRows, seedTrimPlan, applyTrimPlan } from "./trims.js";

const trim = (sku, over = {}) => ({ sku, bookId: "b1", trim: true, ...over });
const row = (id, over = {}) => ({ id, sku: "", bookId: "", qty: "", ...over });

const floor = row("f", { sku: "APX020", bookId: "b1", type: "vinyl", qty: "200" });
const trims = [trim("384421"), trim("384469")];

test("existingTrimRows: matches bookId+sku, skips the floor, first match wins", () => {
  const dup = row("t1b", { sku: "384421", bookId: "b1", qty: "9" });
  const other = row("x", { sku: "384421", bookId: "b2", qty: "4" }); // same SKU, other book
  const t1 = row("t1", { sku: "384421", bookId: "b1", qty: "2" });
  const rows = existingTrimRows([floor, t1, dup, other], "f", trims);
  assert.equal(rows.get("384421").id, "t1");
  assert.equal(rows.has("384469"), false);
});

test("seedTrimPlan: on-job quantities seed, the rest start at 0", () => {
  const t1 = row("t1", { sku: "384421", bookId: "b1", qty: "3" });
  assert.deepEqual(seedTrimPlan([floor, t1], floor, trims), [
    { sku: "384421", rowId: "t1", qty: 3 },
    { sku: "384469", rowId: null, qty: 0 },
  ]);
});

test("applyTrimPlan: new picks land directly below the floor, in order", () => {
  const tail = row("z");
  const out = applyTrimPlan([floor, tail], "f", [
    { rowId: null, qty: 2, row: row("n1", { sku: "384421", qty: "2" }) },
    { rowId: null, qty: 1, row: row("n2", { sku: "384469", qty: "1" }) },
  ]);
  assert.deepEqual(out.map((p) => p.id), ["f", "n1", "n2", "z"]);
});

test("applyTrimPlan: new picks group after the floor's existing trim rows", () => {
  const t1 = row("t1", { sku: "384421", bookId: "b1", qty: "2" });
  const tail = row("z");
  const out = applyTrimPlan([floor, t1, tail], "f", [
    { rowId: "t1", qty: 2, row: null },
    { rowId: null, qty: 1, row: row("n2", { sku: "384469", qty: "1" }) },
  ]);
  assert.deepEqual(out.map((p) => p.id), ["f", "t1", "n2", "z"]);
});

test("applyTrimPlan: a quantity change touches qty only — hand edits survive", () => {
  const t1 = row("t1", { sku: "384421", bookId: "b1", qty: "2", priceSqft: "19.99", note: "hand-set" });
  const out = applyTrimPlan([floor, t1], "f", [{ rowId: "t1", qty: 5, row: null }]);
  assert.deepEqual(out[1], { ...t1, qty: "5" });
});

test("applyTrimPlan: an unchanged quantity keeps the identical row object", () => {
  const t1 = row("t1", { sku: "384421", bookId: "b1", qty: "2" });
  const out = applyTrimPlan([floor, t1], "f", [{ rowId: "t1", qty: 2, row: null }]);
  assert.equal(out[1], t1);
});

test("applyTrimPlan: clearing a seeded line to 0 removes it", () => {
  const t1 = row("t1", { sku: "384421", bookId: "b1", qty: "2" });
  const tail = row("z");
  const out = applyTrimPlan([floor, t1, tail], "f", [{ rowId: "t1", qty: 0, row: null }]);
  assert.deepEqual(out.map((p) => p.id), ["f", "z"]);
});

test("applyTrimPlan: a 0-qty new pick never inserts; a missing floor is a no-op", () => {
  const list = [floor];
  assert.equal(applyTrimPlan(list, "f", [{ rowId: null, qty: 0, row: row("n1") }]).length, 1);
  assert.equal(applyTrimPlan(list, "gone", [{ rowId: null, qty: 2, row: row("n1") }]), list);
});
