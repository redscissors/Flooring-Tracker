import test from "node:test";
import assert from "node:assert/strict";
import { loadProjects, loadTodos, resolveSharedSettings, loadSettingsRow, listSelect, loadSampleRequests, PERSON_SELECT, personRow } from "./bootload.js";

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

// --- project numbers (spec 2026-08-14) ---
// Module note: listSelect() is downgrade-once state, so the success-path test
// must run before the fallback test (node:test runs a file in order).
test("loadProjects mirrors project_no as projectNo (null when absent)", async () => {
  const db = fakeDb({ projects: [{ id: "p1", project_no: 214 }, { id: "p2" }] });
  const rows = await loadProjects(db);
  assert.equal(rows[0].projectNo, 214);
  assert.equal(rows[1].projectNo, null);
  assert.ok(listSelect().includes("project_no"));
});

test("loadProjects falls back to the legacy select when project_no is missing", async () => {
  const asked = [];
  const db = { from: () => ({ select: (sel) => { asked.push(sel); const error = sel.includes("project_no") ? { message: "column projects.project_no does not exist" } : null; return { then: (ok, err) => Promise.resolve({ data: error ? null : [{ id: "a" }], error }).then(ok, err) }; } }) };
  const rows = await loadProjects(db);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].projectNo, null);
  assert.equal(asked.length, 2);
  assert.ok(!listSelect().includes("project_no"));
});

test("loadSampleRequests maps and normalizes rows", async () => {
  const rows = await loadSampleRequests(fakeDb({ sample_requests: [
    { id: "r1", data: { status: "ordered", projectId: "c1", item: { name: "Calacatta", sku: "CM1224" } } },
    { id: "r2", data: { status: "bogus" } },
  ] }));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].status, "ordered");
  assert.equal(rows[0].item.sku, "CM1224");
  assert.equal(rows[1].status, "need");
});

test("PERSON_SELECT asks for the stored distance — without it the value silently never loads", () => {
  assert.match(PERSON_SELECT, /distance:data->distance/);
});

test("personRow normalizes the distance jsonb it gets back", () => {
  const row = { id: "p1", data: {}, distance: { miles: 18.4, minutes: 27, from: "shop", to: "job", at: 5 } };
  assert.deepEqual(personRow(row).distance, { miles: 18.4, minutes: 27, from: "shop", to: "job", at: 5 });
  assert.equal(personRow({ id: "p2" }).distance, null);
});
