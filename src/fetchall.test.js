import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchAllRows, PAGE_ROWS } from "./fetchall.js";

// A fake Supabase query builder: buildQuery() returns an object whose
// .range(from, to) resolves the inclusive slice of `rows`, recording each call.
const fakeTable = (rows, calls = []) => () => ({
  range: async (from, to) => {
    calls.push([from, to]);
    return { data: rows.slice(from, to + 1), error: null };
  },
});

const rowsOf = (n) => Array.from({ length: n }, (_, i) => ({ sku: `S${String(i).padStart(5, "0")}` }));

test("fetchAllRows: a short table comes back in one page", async () => {
  const calls = [];
  const out = await fetchAllRows(fakeTable(rowsOf(3), calls));
  assert.equal(out.length, 3);
  assert.deepEqual(calls, [[0, PAGE_ROWS - 1]]);
});

test("fetchAllRows: a table past the PostgREST cap is paged until exhausted", async () => {
  const calls = [];
  const out = await fetchAllRows(fakeTable(rowsOf(2500), calls));
  assert.equal(out.length, 2500);
  assert.deepEqual(out[0], { sku: "S00000" });
  assert.deepEqual(out[2499], { sku: "S02499" });
  assert.deepEqual(calls, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test("fetchAllRows: an exact page-multiple total fetches one trailing empty page and stops", async () => {
  const calls = [];
  const out = await fetchAllRows(fakeTable(rowsOf(PAGE_ROWS), calls));
  assert.equal(out.length, PAGE_ROWS);
  assert.equal(calls.length, 2);
});

test("fetchAllRows: a page error throws instead of returning a partial set", async () => {
  const boom = () => ({ range: async () => ({ data: null, error: new Error("bad") }) });
  await assert.rejects(() => fetchAllRows(boom), /bad/);
});
