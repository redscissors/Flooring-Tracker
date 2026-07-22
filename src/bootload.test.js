import test from "node:test";
import assert from "node:assert/strict";
import { loadProjects, loadTodos, resolveSharedSettings, loadSettingsRow } from "./bootload.js";

// Chainable thenable standing in for the supabase query builder (same idea as
// fetchall.test.js): select/eq/order return the builder; awaiting it resolves
// {data, error}; range slices for fetchAllRows; upsert records seed writes.
function fakeTable(rows, calls = []) {
  const res = { data: rows, error: null };
  const q = {
    select: (...a) => { calls.push(["select", ...a]); return q; },
    eq: () => q,
    order: () => q,
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    range: async (from, to) => ({ data: rows.slice(from, to + 1), error: null }),
    upsert: async (row) => { calls.push(["upsert", row]); return { error: null }; },
    then: (ok, err) => Promise.resolve(res).then(ok, err),
  };
  return q;
}
const fakeDb = (tables, calls = []) => ({ from: (t) => fakeTable(tables[t] || [], calls) });

test("loadProjects maps light rows and coerces the projected quick flag", async () => {
  const db = fakeDb({ projects: [{ id: "p1", customer_id: null, created_at: "2026-01-01", updated_at: "2026-01-02", name: "Smith", quick: "true" }] });
  const rows = await loadProjects(db);
  assert.equal(rows[0].id, "p1");
  assert.equal(rows[0].quick, true);
  assert.equal(rows[0]._full, false);
});

test("loadTodos maps row shape", async () => {
  const rows = await loadTodos(fakeDb({ todos: [{ id: "t1", position: 2, data: { text: "fix", done: false } }] }));
  assert.deepEqual({ id: rows[0].id, position: rows[0].position, text: rows[0].text }, { id: "t1", position: 2, text: "fix" });
});

test("resolveSharedSettings seeds when the shared row is missing and not when present", async () => {
  const calls = [];
  const settings = await resolveSharedSettings(fakeDb({}, calls), null, undefined);
  assert.ok(settings);
  assert.ok(calls.some(([op]) => op === "upsert"), "missing row must seed");

  const row = await loadSettingsRow(fakeDb({ shared_settings: [{ data: { catalog: null } }] }));
  assert.ok(row);
});
