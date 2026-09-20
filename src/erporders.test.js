import test from "node:test";
import assert from "node:assert/strict";
import { normErpNo, normErpOrders, normErpKeyed, gated, erpNosOf, erpHit, orderCounts, addErpOrder, removeErpOrder, stampErpLines, clearErpStamps, lineIds, lineStamp, keyedNo, copyable, remainingRows, erpCounts, keyedNote } from "./erporders.js";

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

const proj = () => ({
  projectNo: 214,
  erpOrders: [{ no: "48213", addedBy: "Marcus Mast", addedAt: 10 }],
  erpKeyed: { p1: { no: "48213", at: 11, by: "Marcus Mast" } },
});

test("addErpOrder appends a new number and returns null for a duplicate or blank", () => {
  const patch = addErpOrder(proj(), "48260", "Gina", 50);
  assert.deepEqual(patch.erpOrders, [
    { no: "48213", addedBy: "Marcus Mast", addedAt: 10 },
    { no: "48260", addedBy: "Gina", addedAt: 50 },
  ]);
  assert.deepEqual(patch.erpKeyed, { p1: { no: "48213", at: 11, by: "Marcus Mast" } });
  assert.equal(addErpOrder(proj(), "48213", "Gina"), null);
  assert.equal(addErpOrder(proj(), "abc", "Gina"), null);
});

test("removeErpOrder drops the order and every stamp on it", () => {
  const p = { ...proj(), erpOrders: [...proj().erpOrders, { no: "48260", addedBy: "", addedAt: 20 }], erpKeyed: { ...proj().erpKeyed, p2: { no: "48260", at: 21, by: "" } } };
  const patch = removeErpOrder(p, "48213");
  assert.deepEqual(patch.erpOrders, [{ no: "48260", addedBy: "", addedAt: 20 }]);
  assert.deepEqual(patch.erpKeyed, { p2: { no: "48260", at: 21, by: "" } });
});

test("stampErpLines stamps every id on a known order, a re-stamp moving the line", () => {
  const patch = stampErpLines(proj(), ["p1", "p2", ""], "48213", "Gina", 99);
  assert.deepEqual(patch.erpKeyed, { p1: { no: "48213", at: 99, by: "Gina" }, p2: { no: "48213", at: 99, by: "Gina" } });
  assert.equal(stampErpLines(proj(), ["p2"], "77777", "Gina"), null);
});

test("clearErpStamps deletes the given keys only", () => {
  const p = { ...proj(), erpKeyed: { ...proj().erpKeyed, p2: { no: "48213", at: 12, by: "" } } };
  assert.deepEqual(clearErpStamps(p, ["p1", "zz"]).erpKeyed, { p2: { no: "48213", at: 12, by: "" } });
});

test("lineIds and lineStamp read a plain row or a merged row's sources", () => {
  const merged = { id: "merged|x", from: [{ id: "a" }, { id: "b" }] };
  assert.deepEqual(lineIds({ id: "p1" }), ["p1"]);
  assert.deepEqual(lineIds(merged), ["a", "b"]);
  const keyed = { a: { no: "48213", at: 1, by: "M" } };
  assert.deepEqual(lineStamp(merged, keyed), { no: "48213", at: 1, by: "M" });
  assert.equal(lineStamp({ id: "zz" }, keyed), null);
});

test("keyedNo: plain, fully keyed, mixed and partly keyed merged rows", () => {
  const keyed = { a: { no: "48213" }, b: { no: "48213" }, c: { no: "48260" } };
  assert.equal(keyedNo({ id: "a" }, keyed), "48213");
  assert.equal(keyedNo({ id: "zz" }, keyed), null);
  assert.equal(keyedNo({ id: "m", from: [{ id: "a" }, { id: "b" }] }, keyed), "48213");
  assert.equal(keyedNo({ id: "m", from: [{ id: "a" }, { id: "c" }] }, keyed), "mixed");
  assert.equal(keyedNo({ id: "m", from: [{ id: "a" }, { id: "zz" }] }, keyed), null);
  assert.equal(keyedNo({ id: "a" }, undefined), null);
});

test("copyable / remainingRows: a stock row needs a SKU, a special row never does", () => {
  const rows = [
    { id: "s1", special: true, sku: "", byDesc: true },
    { id: "s2", special: true, sku: "EW03" },
    { id: "k1", sku: "1517410" },
    { id: "k2", sku: "" },
  ];
  assert.deepEqual(rows.map(copyable), [true, true, true, false]);
  assert.deepEqual(remainingRows(rows, { s2: { no: "48213" } }).map((r) => r.id), ["s1", "k1"]);
  assert.deepEqual(remainingRows(rows, undefined).map((r) => r.id), ["s1", "s2", "k1"]);
});

test("erpCounts and keyedNote describe the visible list", () => {
  const rows = [{ id: "a", sku: "1" }, { id: "b", sku: "2" }, { id: "c", sku: "3" }, { id: "d", sku: "4" }, { id: "e", sku: "" }];
  const keyed = { a: { no: "48213" }, b: { no: "48213" }, c: { no: "48260" } };
  assert.deepEqual(erpCounts(rows, keyed), { keyed: 3, total: 4, byNo: { 48213: 2, 48260: 1 } });
  assert.equal(keyedNote(rows, keyed), "3 of 4 keyed · 2 on 48213, 1 on 48260");
  assert.equal(keyedNote(rows, {}), "");
});
