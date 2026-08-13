import test from "node:test";
import assert from "node:assert/strict";
import { normClaudeIssue, issueRef, jobSource, bookSource, sourceLines, issueReport, SOURCE_LABEL } from "./claudeissues.js";

test("normClaudeIssue defaults an empty row to a general open issue", () => {
  const i = normClaudeIssue({});
  assert.equal(i.text, "");
  assert.equal(i.done, false);
  assert.equal(i.source.kind, "general");
  assert.equal(i.source.snapshot, null);
});

test("normClaudeIssue keeps a job source and drops an unknown kind to general", () => {
  const job = normClaudeIssue({ source: { kind: "job", custName: "Klein", sku: "HC1224AS" } });
  assert.equal(job.source.kind, "job");
  assert.equal(job.source.custName, "Klein");
  assert.equal(normClaudeIssue({ source: { kind: "mystery" } }).source.kind, "general");
});

test("issueRef reads per kind", () => {
  assert.equal(issueRef(normClaudeIssue({ source: { kind: "job", custName: "Klein, Whitney", areaName: "Master Bath", sku: "HC1224AS" } })), "Klein, Whitney · Master Bath · HC1224AS");
  assert.equal(issueRef(normClaudeIssue({ source: { kind: "book", bookName: "Home Collection", sku: "HC0838MB" } })), "Home Collection · HC0838MB");
  assert.equal(issueRef(normClaudeIssue({})), "Typed on the list");
  // A job ref prefers the product name over the SKU when it has one.
  assert.equal(issueRef(normClaudeIssue({ source: { kind: "job", custName: "K", snapshot: { brandColor: "Aniston Silver" }, sku: "X" } })), "K · Aniston Silver");
});

test("jobSource freezes the row and keeps the live ids", () => {
  const s = jobSource({ id: "c1", name: "Klein" }, { id: "a1", name: "Bath" }, { id: "p1", sku: "HC1", brandColor: "Aniston", type: "tile", priceSqft: "4.79", qty: "138", bookId: "b1" });
  assert.equal(s.kind, "job");
  assert.equal(s.custId, "c1");
  assert.equal(s.productId, "p1");
  assert.equal(s.bookId, "b1");
  assert.equal(s.snapshot.brandColor, "Aniston");
  assert.equal(s.snapshot.priceSqft, "4.79");
});

test("bookSource carries the item core", () => {
  const s = bookSource({ id: "b1", name: "Home Collection" }, { sku: "HC0838MB", description: "Hex Mosaic", cost: 4.2 });
  assert.equal(s.kind, "book");
  assert.equal(s.bookName, "Home Collection");
  assert.equal(s.snapshot.cost, 4.2);
});

test("sourceLines gives the popover its captured-context lines", () => {
  const job = sourceLines(jobSource({ name: "Klein" }, { name: "Bath" }, { sku: "HC1", brandColor: "Aniston", sizeText: "12×24" }));
  assert.deepEqual(job, ["Klein · Bath", "12×24 · Aniston · SKU HC1"]);
  assert.deepEqual(sourceLines({ kind: "general" }), []);
});

test("issueReport covers open issues only, with note, ref, and snapshot json", () => {
  const issues = [
    normClaudeIssue({ id: "1", text: "Price wrong", createdBy: "Sam", createdAt: 1755000000000, source: { kind: "book", bookName: "HC", sku: "X1", snapshot: { cost: 1 } } }),
    normClaudeIssue({ id: "2", text: "old", done: true, source: { kind: "general" } }),
  ];
  const r = issueReport(issues);
  assert.match(r, /1 open issue\b/);
  assert.match(r, new RegExp(`## ${SOURCE_LABEL.book} — HC · X1`));
  assert.match(r, /Price wrong/);
  assert.match(r, /"cost": 1/);
  assert.doesNotMatch(r, /old/);
});

test("issueReport says context-only when the note is blank", () => {
  const r = issueReport([normClaudeIssue({ id: "1", source: { kind: "job", custName: "K" } })]);
  assert.match(r, /\(no note — context only\)/);
});
