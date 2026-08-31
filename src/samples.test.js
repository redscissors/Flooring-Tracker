import test from "node:test";
import assert from "node:assert/strict";
import { normA } from "./model.js";
import {
  normSampleRequest, requestFrom, sampleGroups, sampleCounts, projectSampleTally,
  repEmail, mailtoHref, SAMPLE_STATUSES, SAMPLE_LABEL,
} from "./samples.js";

const BOOKS = [
  { id: "b1", kind: "order", name: "Glazzio EFT", data: { brandLabel: "Glazzio" } },
  { id: "b2", kind: "stock", name: "GLATI stock", data: {} },
];
const req = (over = {}) => normSampleRequest({
  id: "r1", status: "need", createdBy: "Dana", createdAt: 1000,
  projectId: "c1", custName: "Kathy Marsh", areaName: "Kitchen", productId: "p1",
  bookId: "b1", bookName: "Glazzio", item: { name: "Calacatta Gold", sku: "CM1224", size: "12×24", type: "tile" },
  ...over,
});

test("normSampleRequest: fills the shape, drops junk, clamps status", () => {
  const r = req();
  assert.equal(r.status, "need");
  assert.equal(r.item.sku, "CM1224");
  assert.equal(normSampleRequest(null), null);
  assert.equal(normSampleRequest("x"), null);
  assert.equal(normSampleRequest({ id: "r2", status: "bogus" }).status, "need");
  assert.equal(normSampleRequest({ id: "r3", status: "ordered", orderedBy: "Sam", orderedAt: 5 }).orderedBy, "Sam");
});

test("requestFrom: snapshots the line, resolves the vendor, stamps the creator", () => {
  const area = normA({ id: "a1", name: "Kitchen", products: [{ id: "p1" }] });
  const product = { id: "p1", type: "tile", sku: "CM1224", brandColor: "Calacatta Gold", L: "12", W: "24", bookId: "b1" };
  const r = requestFrom({ project: { id: "c1" }, custName: "Kathy Marsh", area, areaIndex: 0, product, books: BOOKS, by: "Dana" });
  assert.equal(r.status, "need");
  assert.equal(r.projectId, "c1");
  assert.equal(r.custName, "Kathy Marsh");
  assert.equal(r.areaName, "Kitchen");
  assert.equal(r.productId, "p1");
  assert.deepEqual([r.bookId, r.bookName], ["b1", "Glazzio"]);
  assert.deepEqual(r.item, { name: "Calacatta Gold", sku: "CM1224", size: "12×24", type: "tile" });
  assert.equal(r.createdBy, "Dana");
  assert.ok(r.id && r.createdAt > 0);
});

test("requestFrom: sheoga rows file under Sheoga, hand rows under Other, name falls back sku then type", () => {
  const area = normA({ id: "a1", name: "", products: [{ id: "p1" }] });
  const base = { project: { id: "c1" }, custName: "K", area, areaIndex: 0, books: BOOKS, by: "D" };
  const sheoga = requestFrom({ ...base, product: { id: "p1", type: "hardwood", sheoga: { mode: "floor", cfg: {} } } });
  assert.equal(sheoga.bookName, "Sheoga Hardwood");
  const hand = requestFrom({ ...base, product: { id: "p2", type: "tile", sku: "X1", bookId: "gone" } });
  assert.equal(hand.bookName, "Other / hand-entered");
  assert.equal(hand.item.name, "X1");
  assert.equal(requestFrom({ ...base, product: { id: "p3", type: "vinyl" } }).item.name, "Vinyl");
  assert.equal(sheoga.areaName, "Area 1");
});

test("sampleGroups: groups by vendor in encounter order, Other last", () => {
  const rows = [
    req({ id: "r1", bookId: "b1", bookName: "Glazzio" }),
    req({ id: "r2", bookId: "", bookName: "Other / hand-entered", productId: "p2" }),
    req({ id: "r3", bookId: "b2", bookName: "GLATI stock", productId: "p3" }),
    req({ id: "r4", bookId: "b1", bookName: "Glazzio", productId: "p4" }),
  ];
  const gs = sampleGroups(rows);
  assert.deepEqual(gs.map((g) => g.name), ["Glazzio", "GLATI stock", "Other / hand-entered"]);
  assert.deepEqual(gs[0].rows.map((r) => r.id), ["r1", "r4"]);
  assert.equal(gs[0].bookId, "b1");
});

test("sampleCounts + projectSampleTally", () => {
  const rows = [
    req({ id: "r1", status: "need" }),
    req({ id: "r2", status: "ordered", projectId: "c2" }),
    req({ id: "r3", status: "ordered" }),
  ];
  assert.deepEqual(sampleCounts(rows), { need: 1, ordered: 2, total: 3 });
  const tally = projectSampleTally(rows);
  assert.deepEqual(tally.get("c1"), { need: 1, ordered: 1 });
  assert.deepEqual(tally.get("c2"), { need: 0, ordered: 1 });
  assert.deepEqual(sampleCounts([]), { need: 0, ordered: 0, total: 0 });
});

test("repEmail: item lines + ship-to, greeting by first name, NO salesperson info", () => {
  const rows = [req(), req({ id: "r2", item: { name: "Hand entered", sku: "", size: "", type: "tile" } })];
  const { subject, body } = repEmail({ rows, custName: "Kathy Marsh", address: "214 Old Mill Rd", phone: "(555) 210-0114", repName: "Jeff Krejci" });
  assert.equal(subject, "Sample request — Kathy Marsh");
  assert.ok(body.startsWith("Hi Jeff,"));
  assert.ok(body.includes("- 12×24 Calacatta Gold — CM1224"));
  assert.ok(body.includes("- Hand entered"));
  assert.ok(body.includes("Ship to:\nKathy Marsh\n214 Old Mill Rd\n(555) 210-0114"));
  assert.ok(!/sales/i.test(body));
  const bare = repEmail({ rows, custName: "", address: "", phone: "", repName: "" });
  assert.ok(bare.body.startsWith("Hi,"));
});

test("mailtoHref encodes subject and body", () => {
  const href = mailtoHref("rep@vendor.com", "Sample request — K & M", "line one\nline two");
  assert.ok(href.startsWith("mailto:rep%40vendor.com?subject=Sample%20request%20%E2%80%94%20K%20%26%20M&body=line%20one%0Aline%20two"));
});

test("status vocabulary is exactly two states, each labeled", () => {
  assert.deepEqual(SAMPLE_STATUSES, ["need", "ordered"]);
  for (const s of SAMPLE_STATUSES) assert.ok(SAMPLE_LABEL[s]);
});
