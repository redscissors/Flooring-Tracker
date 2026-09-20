import test from "node:test";
import assert from "node:assert/strict";
import { normErpNo, normErpOrders, normErpKeyed, gated, erpNosOf, erpHit, orderCounts } from "./erporders.js";

test("normErpNo keeps digits only, at most 10", () => {
  assert.equal(normErpNo(" #48213 "), "48213");
  assert.equal(normErpNo("SO-48213"), "48213");
  assert.equal(normErpNo("123456789012"), "1234567890");
  assert.equal(normErpNo(""), "");
  assert.equal(normErpNo(null), "");
  assert.equal(normErpNo(48213), "48213");
});

test("normErpOrders drops invalid entries and dedupes by number, first kept", () => {
  const out = normErpOrders([
    { no: "48213", addedBy: "Marcus Mast", addedAt: 10 },
    { no: "48213", addedBy: "Later", addedAt: 20 },
    { no: "abc" },
    null,
    { no: 48260 },
  ]);
  assert.deepEqual(out, [
    { no: "48213", addedBy: "Marcus Mast", addedAt: 10 },
    { no: "48260", addedBy: "", addedAt: 0 },
  ]);
  assert.deepEqual(normErpOrders(undefined), []);
  assert.deepEqual(normErpOrders("nope"), []);
});

test("normErpKeyed keeps only stamps on a known order", () => {
  const orders = [{ no: "48213", addedBy: "", addedAt: 0 }];
  const out = normErpKeyed({ a: { no: "48213", at: 5, by: "M" }, b: { no: "99999", at: 6, by: "M" }, c: { no: "" }, "": { no: "48213" } }, orders);
  assert.deepEqual(out, { a: { no: "48213", at: 5, by: "M" } });
  assert.deepEqual(normErpKeyed(null, orders), {});
});

test("gated only when the project is numbered and has no order", () => {
  assert.equal(gated({ projectNo: 214, erpOrders: [] }), true);
  assert.equal(gated({ projectNo: 214, erpOrders: [{ no: "48213" }] }), false);
  assert.equal(gated({ projectNo: null, erpOrders: [] }), false);
  assert.equal(gated({ quick: true }), false);
});

test("erpNosOf reads a full row's orders or a light row's projection, live orders winning", () => {
  assert.deepEqual(erpNosOf({ erpOrders: [{ no: "48213" }, { no: "48260" }] }), ["48213", "48260"]);
  assert.deepEqual(erpNosOf({ erpNos: ["47901"] }), ["47901"]);
  assert.deepEqual(erpNosOf({ erpNos: ["47901"], erpOrders: [] }), []);
  assert.deepEqual(erpNosOf({}), []);
});

test("erpHit matches the digit run of the query against any order number", () => {
  const p = { erpNos: ["48213", "48260"] };
  assert.equal(erpHit(p, "48213"), true);
  assert.equal(erpHit(p, "482"), true);
  assert.equal(erpHit(p, "#48260"), true);
  assert.equal(erpHit(p, "hendricks"), false);
  assert.equal(erpHit(p, ""), false);
  assert.equal(erpHit({}, "482"), false);
});

test("orderCounts tallies stamps per order over the whole job", () => {
  assert.deepEqual(orderCounts({ a: { no: "48213" }, b: { no: "48213" }, c: { no: "48260" } }), { 48213: 2, 48260: 1 });
  assert.deepEqual(orderCounts({}), {});
  assert.deepEqual(orderCounts(undefined), {});
});
