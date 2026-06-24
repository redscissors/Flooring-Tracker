import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, GROUTS, MORTARS, mergeSettings, seedCatalog, resolveCatalog, normalizeSettings, groutExact, mortarExact, getGrout, getMortar } from "./catalog.js";

// A fully-checked tile selection used by the math tests.
const tile = (over = {}) => ({
  type: "tile", qtyType: "sqft", qty: "200", L: "12", W: "12", thickness: "0.375",
  grout: { checked: true, product: "PermaColor Select", color: "", joint: 0.125, manual: "" },
  mortar: { checked: true, product: "ProLite", manual: "" },
  ...over,
});

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

// --- Slice 02: catalog shape + seed -----------------------------------------

const allGroutNames = (catalog) => catalog.companies.flatMap((c) => c.grouts.map((p) => p.name));
const allMortarNames = (catalog) => catalog.companies.flatMap((c) => c.mortars.map((p) => p.name));

test("seedCatalog builds the expected companies from the built-ins", () => {
  const cat = seedCatalog(mergeSettings(undefined));
  assert.deepEqual(cat.companies.map((c) => c.name), ["Laticrete", "Custom Building Products"]);
  assert.deepEqual(allGroutNames(cat).sort(), [...GROUTS].sort());
  assert.deepEqual(allMortarNames(cat).sort(), [...MORTARS].sort());
});

test("seedCatalog: every built-in product name survives unchanged (resolve-by-name)", () => {
  const cat = seedCatalog(mergeSettings(undefined));
  for (const name of GROUTS) assert.ok(allGroutNames(cat).includes(name), `grout ${name} preserved`);
  for (const name of MORTARS) assert.ok(allMortarNames(cat).includes(name), `mortar ${name} preserved`);
});

test("seedCatalog carries each product's numbers through and resolves them by name", () => {
  const flat = mergeSettings({ grouts: { "PermaColor Select": { coverage: 95, unit: "bags", price: 42 } } });
  const { grouts } = resolveCatalog(seedCatalog(flat));
  assert.equal(grouts["PermaColor Select"].coverage, 95);
  assert.equal(grouts["PermaColor Select"].price, 42);
  assert.equal(grouts["SpectraLOCK 1"].coverage, 85);
});

test("seeded products all default to enabled, all companies enabled", () => {
  const cat = seedCatalog(mergeSettings(undefined));
  assert.ok(cat.companies.every((c) => c.enabled));
  assert.ok(cat.companies.every((c) => [...c.grouts, ...c.mortars].every((p) => p.enabled)));
});

test("normalizeSettings backfills a pre-catalog (flat) record without dropping tuned numbers", () => {
  const preCatalog = { wastePct: 14, grouts: { "PermaColor Select": { coverage: 99, unit: "bags", price: 7 } }, mortars: {} };
  const s = normalizeSettings(preCatalog);
  assert.equal(s.wastePct, 14);
  assert.ok(s.catalog.companies.length >= 1);
  assert.equal(s.grouts["PermaColor Select"].coverage, 99); // derived map, tuned value preserved
  assert.equal(s.grouts["PermaColor Select"].price, 7);
});

test("normalizeSettings is idempotent on an already-catalog record", () => {
  const once = normalizeSettings({ wastePct: 10 });
  const twice = normalizeSettings(once);
  assert.deepEqual(twice.catalog.companies.map((c) => c.name), once.catalog.companies.map((c) => c.name));
  assert.deepEqual(allGroutNames(twice.catalog).sort(), allGroutNames(once.catalog).sort());
  assert.deepEqual(twice.grouts, once.grouts);
});

test("normalizeSettings attaches derived maps matching the flat seed numbers", () => {
  const s = normalizeSettings(undefined);
  const flat = mergeSettings(undefined);
  assert.equal(s.grouts["PermaColor Select"].coverage, flat.grouts["PermaColor Select"].coverage);
  assert.equal(s.mortars["ProLite"].tier1, flat.mortars["ProLite"].tier1);
});

// --- Slice 03: math sources numbers from the catalog by name -----------------

test("groutExact/mortarExact from the catalog match the flat-settings result", () => {
  const flat = mergeSettings(undefined);
  const cat = normalizeSettings(undefined); // { wastePct, catalog, grouts, mortars }
  const p = tile();
  assert.equal(groutExact(p, cat), groutExact(p, flat));
  assert.equal(mortarExact(p, cat), mortarExact(p, flat));
  // And the same after tuning a number through the catalog's derived map.
  const tuned = normalizeSettings({ grouts: { "PermaColor Select": { coverage: 95, unit: "bags", price: 0 } } });
  const tunedFlat = mergeSettings({ grouts: { "PermaColor Select": { coverage: 95, unit: "bags", price: 0 } } });
  assert.equal(groutExact(p, tuned), groutExact(p, tunedFlat));
});

test("resolve-by-name finds a product regardless of enabled state (hidden product still calculates)", () => {
  const s = normalizeSettings(undefined);
  // Disable every PermaColor Select entry; resolveCatalog must still expose it.
  s.catalog.companies.forEach((c) => c.grouts.forEach((g) => { if (g.name === "PermaColor Select") g.enabled = false; }));
  const { grouts } = resolveCatalog(s.catalog);
  assert.ok(grouts["PermaColor Select"], "disabled product still resolves by name");
  const s2 = { ...s, ...resolveCatalog(s.catalog) };
  assert.ok(groutExact(tile(), s2) > 0);
});

test("a selection naming a product with no catalog entry degrades gracefully (no crash)", () => {
  const s = normalizeSettings(undefined);
  const p = tile({ grout: { checked: true, product: "Ghost Grout", color: "", joint: 0.125, manual: "" }, mortar: { checked: true, product: "Ghost Mortar", manual: "" } });
  // groutExact divides by a 0-coverage fallback → finite number, no throw.
  assert.doesNotThrow(() => groutExact(p, s));
  // getMortar returns null when the product isn't found (same path as a missing rate).
  assert.equal(getMortar(p, s), null);
  // A manual override still produces an order even for an unknown product.
  const manual = tile({ grout: { checked: true, product: "Ghost Grout", color: "", joint: 0.125, manual: "7" } });
  assert.equal(getGrout(manual, s).order, 7);
});

// --- Slice 04: enabled checkboxes drive dropdown eligibility -----------------

import { isOffered, offeredGrouts, offeredMortars } from "./catalog.js";

test("isOffered requires both the company and the product to be enabled", () => {
  assert.equal(isOffered({ enabled: true }, { enabled: true }), true);
  assert.equal(isOffered({ enabled: false }, { enabled: true }), false);
  assert.equal(isOffered({ enabled: true }, { enabled: false }), false);
  assert.equal(isOffered({ enabled: false }, { enabled: false }), false);
});

test("disabling a company suppresses all of its products from the offered list", () => {
  const s = normalizeSettings(undefined);
  const laticrete = s.catalog.companies.find((c) => c.name === "Laticrete");
  laticrete.enabled = false;
  const offered = offeredGrouts(s.catalog);
  assert.equal(offered.includes("PermaColor Select"), false);
  assert.equal(offered.includes("SpectraLOCK 1"), false);
});

test("disabling one product hides only that product, others remain offered", () => {
  const s = normalizeSettings(undefined);
  const laticrete = s.catalog.companies.find((c) => c.name === "Laticrete");
  laticrete.grouts.find((g) => g.name === "PermaColor Select").enabled = false;
  const offered = offeredGrouts(s.catalog);
  assert.equal(offered.includes("PermaColor Select"), false);
  assert.equal(offered.includes("SpectraLOCK 1"), true);
});

test("a disabled product still resolves by name so an existing job keeps calculating", () => {
  const s = normalizeSettings(undefined);
  s.catalog.companies.forEach((c) => c.grouts.forEach((g) => { g.enabled = false; }));
  s.catalog.companies.forEach((c) => { c.enabled = false; });
  assert.equal(offeredGrouts(s.catalog).length, 0); // nothing offered
  const s2 = { ...s, ...resolveCatalog(s.catalog) };
  assert.ok(groutExact(tile(), s2) > 0); // but the math still resolves it
});
