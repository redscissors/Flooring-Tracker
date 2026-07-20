import test from "node:test";
import assert from "node:assert/strict";
import { bootTrace, traceRows } from "./boottrace.js";

const ticker = (step = 10) => { let t = 0; return () => (t += step); };

test("span passes the result through and records a duration", async () => {
  const tr = bootTrace(ticker());
  const out = await tr.span("stock", async () => "rows");
  assert.equal(out, "rows");
  const r = tr.report();
  assert.equal(r.spans.length, 1);
  assert.equal(r.spans[0].name, "stock");
  assert.ok(r.spans[0].ms > 0);
});

test("span records the load even when it throws, and rethrows", async () => {
  const tr = bootTrace(ticker());
  await assert.rejects(() => tr.span("todos", async () => { throw new Error("boom"); }), /boom/);
  assert.equal(tr.report().spans[0].name, "todos");
});

test("paint and done stamp offsets from construction", async () => {
  const tr = bootTrace(ticker());
  tr.paint();
  tr.done();
  const r = tr.report();
  assert.ok(r.paintAt > 0);
  assert.ok(r.doneAt > r.paintAt);
});

test("traceRows renders spans plus paint/done marker rows", async () => {
  const tr = bootTrace(ticker());
  await tr.span("projects", async () => []);
  tr.paint();
  const rows = traceRows(tr.report());
  assert.equal(rows[0].load, "projects");
  assert.equal(rows.at(-1).load, "first paint");
});
