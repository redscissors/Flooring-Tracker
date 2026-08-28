import test from "node:test";
import assert from "node:assert/strict";
import { normA } from "./model.js";
import { sampleGroups, sampleCounts, sampleCopyText, SAMPLE_LABEL, SAMPLE_STATUSES } from "./samples.js";

const BOOKS = [
  { id: "b1", kind: "order", name: "Glazzio EFT", data: { brandLabel: "Glazzio" } },
  { id: "b2", kind: "stock", name: "GLATI stock", data: {} },
];

const area = (name, products, extra = {}) => normA({ id: "a-" + name, name, products, ...extra });
const mark = (status = "need", at = 1000) => ({ status, at });

test("sampleGroups: groups marked rows by book, brand label over book name, Other last", () => {
  const cats = [
    area("Kitchen", [
      { id: "p1", brandColor: "Calacatta Gold", sku: "CM1224", L: "12", W: "24", bookId: "b1", sample: mark() },
      { id: "p2", brandColor: "No sample here", bookId: "b1" },
      { id: "p3", brandColor: "Hand entered", sizeText: "3x6", sample: mark("ordered", 2000) },
    ]),
    area("Bath", [
      { id: "p4", brandColor: "Stocked Hex", sku: "GL-77", bookId: "b2", sample: mark("in") },
      { id: "p5", brandColor: "More Glazzio", sku: "CM99", bookId: "b1", sample: mark() },
    ]),
  ];
  const gs = sampleGroups(cats, BOOKS);
  assert.deepEqual(gs.map((g) => g.name), ["Glazzio", "GLATI stock", "Other / hand-entered"]);
  const glazzio = gs[0];
  assert.deepEqual(glazzio.rows.map((r) => r.pid), ["p1", "p5"]);
  assert.equal(glazzio.rows[0].areaName, "Kitchen");
  assert.equal(glazzio.rows[0].size, "12×24", "tile L/W renders as a size when sizeText is blank");
  assert.equal(glazzio.rows[0].status, "need");
  const other = gs[2];
  assert.deepEqual(other.rows.map((r) => r.pid), ["p3"]);
  assert.equal(other.rows[0].size, "3x6");
});

test("sampleGroups: a Sheoga line files under Sheoga, an unknown bookId under Other", () => {
  const cats = [area("Living", [
    { id: "p1", brandColor: "White Oak 5", sheoga: { mode: "floor", cfg: {} }, sample: mark() },
    { id: "p2", brandColor: "Deleted book row", bookId: "gone", sample: mark() },
  ])];
  const gs = sampleGroups(cats, BOOKS);
  assert.deepEqual(gs.map((g) => g.name), ["Sheoga Hardwood", "Other / hand-entered"]);
});

test("sampleGroups: a nameless marked row falls back to SKU, then the type label", () => {
  const cats = [area("", [
    { id: "p1", sku: "SKU-1", sample: mark() },
    { id: "p2", type: "hardwood", sample: mark() },
  ])];
  const rows = sampleGroups(cats, BOOKS)[0].rows;
  assert.equal(rows[0].name, "SKU-1");
  assert.equal(rows[1].name, "Hardwood");
  assert.equal(rows[0].areaName, "Area 1", "unnamed areas label by position");
});

test("sampleCounts: open = need + ordered, received stays out of the badge", () => {
  const cats = [area("A", [
    { id: "p1", sample: mark("need") },
    { id: "p2", sample: mark("ordered") },
    { id: "p3", sample: mark("in") },
    { id: "p4" },
  ])];
  const c = sampleCounts(cats);
  assert.equal(c.total, 3);
  assert.equal(c.open, 2);
  assert.deepEqual([c.need, c.ordered, c.in], [1, 1, 1]);
  assert.equal(sampleCounts([]).open, 0);
});

test("sampleCopyText: one readable line per sample, SKU trailing, blanks omitted", () => {
  const rows = [
    { size: "12×24", name: "Calacatta Gold", sku: "CM1224" },
    { size: "", name: "Hand entered", sku: "" },
  ];
  assert.equal(sampleCopyText(rows), "12×24 Calacatta Gold — CM1224\nHand entered");
});

test("every status has a label", () => {
  for (const s of SAMPLE_STATUSES) assert.ok(SAMPLE_LABEL[s]);
});
