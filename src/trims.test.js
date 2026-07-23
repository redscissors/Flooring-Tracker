import test from "node:test";
import assert from "node:assert/strict";
import { existingTrimRows, seedTrimPlan, applyTrimPlan, preferStockTrims } from "./trims.js";

const trim = (sku, over = {}) => ({ sku, bookId: "b1", trim: true, ...over });
const row = (id, over = {}) => ({ id, sku: "", bookId: "", qty: "", ...over });

const floor = row("f", { sku: "APX020", bookId: "b1", type: "vinyl", qty: "200" });
const trims = [trim("384421"), trim("384469")];

test("existingTrimRows: matches by SKU, skips the floor, first match wins", () => {
  const dup = row("t1b", { sku: "384421", bookId: "b1", qty: "9" });
  const t1 = row("t1", { sku: "384421", bookId: "b1", qty: "2" });
  const rows = existingTrimRows([floor, t1, dup], "f", trims);
  assert.equal(rows.get("384421").id, "t1");
  assert.equal(rows.has("384469"), false);
});

test("existingTrimRows: a line added from the other space still seeds (SKU, not bookId)", () => {
  // The trim went on as a stock line; the popup lists its special-order twin
  // (or vice versa) — same vendor SKU is the same product (mergeSearch rule).
  const stockLine = row("s1", { sku: "384421", bookId: "stock1", qty: "3" });
  const rows = existingTrimRows([floor, stockLine], "f", trims);
  assert.equal(rows.get("384421").id, "s1");
});

test("existingTrimRows: bookId-less rows never match — a hand-typed row isn't a book line", () => {
  const hand = row("h1", { sku: "384421", qty: "3" });
  assert.equal(existingTrimRows([floor, hand], "f", trims).size, 0);
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

test("preferStockTrims: an exact-SKU live stock item outranks the special-order twin", () => {
  const order = { sku: "384421", bookId: "order1", trim: true, fits: ["APX020"], price: 42.16 };
  const stock = { sku: "384421", bookId: "stock1", stockKind: true, price: 39.99, active: true };
  const out = preferStockTrims([order, trim("384469")], [stock]);
  assert.deepEqual(out[0], { ...stock, trim: true, fits: ["APX020"] });
  assert.equal(out[1].sku, "384469"); // no twin — the special-order item stays
});

test("preferStockTrims: retired/disabled/discontinued stock never swaps in", () => {
  const order = { sku: "384421", bookId: "order1", trim: true, fits: [] };
  for (const dead of [{ active: false }, { disabled: true }, { discontinued: true }]) {
    const out = preferStockTrims([order], [{ sku: "384421", bookId: "stock1", ...dead }]);
    assert.equal(out[0].bookId, "order1");
  }
});

test("preferStockTrims: no stock cache yet → the list passes through untouched", () => {
  const list = [trim("384421")];
  assert.equal(preferStockTrims(list, []), list);
});
