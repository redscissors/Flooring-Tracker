import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, GROUTS, MORTARS, mergeSettings } from "./catalog.js";

// --- Slice 01: shared settings store -----------------------------------------
// The migration/seed path is just mergeSettings producing the canonical record
// from whatever raw settings it is handed, and being a no-op on re-run.

test("mergeSettings fills the full shape from built-in defaults when given nothing", () => {
  const s = mergeSettings(undefined);
  assert.equal(s.wastePct, 10);
  assert.deepEqual(Object.keys(s.grouts).sort(), [...GROUTS].sort());
  assert.deepEqual(Object.keys(s.mortars).sort(), [...MORTARS].sort());
  assert.equal(s.grouts["PermaColor Select"].coverage, 110);
  assert.equal(s.mortars["ProLite"].tier1, 90);
});

test("mergeSettings preserves a designated user's tuned numbers (seed source)", () => {
  const raw = {
    wastePct: 15,
    grouts: { "PermaColor Select": { coverage: 95, unit: "bags", price: 42 } },
    mortars: { "ProLite": { tier1: 88, tier2: 60, tier3: 44, unit: "bags", price: 19 } },
  };
  const s = mergeSettings(raw);
  assert.equal(s.wastePct, 15);
  assert.equal(s.grouts["PermaColor Select"].coverage, 95);
  assert.equal(s.grouts["PermaColor Select"].price, 42);
  assert.equal(s.mortars["ProLite"].price, 19);
  // Untouched products still backfill from defaults.
  assert.equal(s.grouts["SpectraLOCK 1"].coverage, 85);
  assert.equal(s.mortars["AcrylPro"].tier1, 40);
});

test("mergeSettings is idempotent — re-running on its own output is a no-op", () => {
  const once = mergeSettings({ wastePct: 12, grouts: { "PermaColor Select": { coverage: 100, unit: "bags", price: 5 } } });
  const twice = mergeSettings(once);
  assert.deepEqual(twice, once);
});

test("mergeSettings migrates the legacy single-mortar field onto ProLite", () => {
  const s = mergeSettings({ mortar: { tier1: 77, tier2: 50, tier3: 33, unit: "bags", price: 9 } });
  assert.equal(s.mortars["ProLite"].tier1, 77);
  assert.equal(s.mortars["ProLite"].price, 9);
});

test("DEFAULTS exposes the seeded built-in product names", () => {
  assert.deepEqual(Object.keys(DEFAULTS.grouts).sort(), [...GROUTS].sort());
  assert.deepEqual(Object.keys(DEFAULTS.mortars).sort(), [...MORTARS].sort());
});
