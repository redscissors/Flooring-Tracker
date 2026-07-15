import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULTS, GROUTS, MORTARS, mergeSettings, seedCatalog, resolveCatalog, normalizeSettings, normalizeCatalog, normWaste, wasteFor, serializeSettings, groutExact, mortarExact, getGrout, getGroutBase, groutBaseList, getMortar, cartonExact, getCarton, underlayExact, getUnderlay, getUnderlayInstall, offeredUnderlayments, catalogHasSeedUnderlayments, materialWarnings } from "./catalog.js";

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
  assert.deepEqual(s.waste, { tile: 10, floor: 10 });
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
  assert.deepEqual(s.waste, { tile: 15, floor: 15 });
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

// --- Waste split: separate tile vs. other-flooring rates ---------------------

test("normWaste migrates a legacy single wastePct onto both families", () => {
  assert.deepEqual(normWaste({ wastePct: 18 }), { tile: 18, floor: 18 });
  assert.deepEqual(normWaste(undefined), { tile: 10, floor: 10 });
});

test("normWaste keeps an explicit waste split and ignores a stale legacy number", () => {
  assert.deepEqual(normWaste({ waste: { tile: 8, floor: 12 }, wastePct: 99 }), { tile: 8, floor: 12 });
  // A half-specified split fills the missing family from the legacy number, then 10.
  assert.deepEqual(normWaste({ waste: { tile: 8 }, wastePct: 15 }), { tile: 8, floor: 15 });
  assert.deepEqual(normWaste({ waste: { floor: 12 } }), { tile: 10, floor: 12 });
});

test("wasteFor picks tile rate for tile, floor rate for every other type", () => {
  const s = { waste: { tile: 10, floor: 20 } };
  assert.equal(wasteFor({ type: "tile" }, s), 1.1);
  for (const t of ["hardwood", "vinyl", "laminate", "carpet"]) assert.equal(wasteFor({ type: t }, s), 1.2);
});

test("carton/underlay math applies the family-specific waste rate", () => {
  const s = normalizeSettings({ waste: { tile: 10, floor: 20 } });
  // A tile carton uses the tile rate...
  assert.equal(cartonExact(tile({ qty: "200", cartonSf: "20", cartonManual: "" }), s), 200 * 1.1 / 20);
  // ...a vinyl carton uses the floor rate.
  assert.equal(cartonExact({ type: "vinyl", qtyType: "sqft", qty: "200", cartonSf: "20" }, s), 200 * 1.2 / 20);
});

test("serializeSettings persists the waste split, not the legacy scalar", () => {
  const s = normalizeSettings({ waste: { tile: 7, floor: 13 } });
  const out = serializeSettings(s);
  assert.deepEqual(out.waste, { tile: 7, floor: 13 });
  assert.equal("wastePct" in out, false);
  // Round-trips back through normalize unchanged.
  assert.deepEqual(normalizeSettings(out).waste, { tile: 7, floor: 13 });
});

// --- Slice 02: catalog shape + seed -----------------------------------------

const allGroutNames = (catalog) => catalog.companies.flatMap((c) => c.grouts.map((p) => p.name));
const allMortarNames = (catalog) => catalog.companies.flatMap((c) => c.mortars.map((p) => p.name));

test("seedCatalog builds the expected companies from the built-ins", () => {
  const cat = seedCatalog(mergeSettings(undefined));
  assert.deepEqual(cat.companies.map((c) => c.name), ["Laticrete", "Custom Building Products", "Tec", "Schluter", "James Hardie", "Wedi", "Fortifiber", "MP Global", "Sika"]);
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
  assert.deepEqual(s.waste, { tile: 14, floor: 14 });
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
  const cat = normalizeSettings(undefined); // { waste, catalog, grouts, mortars }
  const p = tile();
  assert.equal(groutExact(p, cat), groutExact(p, flat));
  assert.equal(mortarExact(p, cat), mortarExact(p, flat));
  // And the same after tuning a number through the catalog's derived map.
  const tuned = normalizeSettings({ grouts: { "PermaColor Select": { coverage: 95, unit: "bags", price: 0 } } });
  const tunedFlat = mergeSettings({ grouts: { "PermaColor Select": { coverage: 95, unit: "bags", price: 0 } } });
  assert.equal(groutExact(p, tuned), groutExact(p, tunedFlat));
});

test("penny rounds get extra grout for the corners the circle leaves (ADR 0015)", () => {
  const s = mergeSettings(undefined);
  // Same 3/4" size and 1/8" joint; the only difference is the round shape.
  const square = tile({ L: "0.75", W: "0.75", thickness: "0.25", sizeText: "3/4 Square" });
  const penny = tile({ L: "0.75", W: "0.75", thickness: "0.25", sizeText: '3/4" Penny' });
  const sq = groutExact(square, s), pn = groutExact(penny, s);
  assert.ok(pn > sq, "a penny needs more grout than the square proxy");
  // Corner fill for d=0.75, J=0.125, T=0.25: adds ((0.75^2·(1−π/4))/(0.875^2))·0.25
  // onto the square joint volume — about a 1.47× uplift.
  assert.ok(Math.abs(pn / sq - 1.47) < 0.02, `uplift ~1.47×, got ${(pn / sq).toFixed(3)}`);
  // getGrout flags the row so the estimate can say why the grout is higher.
  assert.equal(getGrout(penny, s).round, true);
  assert.equal(getGrout(square, s).round, false);
  // A hex tiles flush — no uplift.
  const hex = tile({ L: "2", W: "2", sizeText: '2" Hexagon' });
  assert.equal(getGrout(hex, s).round, false);
  assert.equal(groutExact(hex, s), groutExact(tile({ L: "2", W: "2", sizeText: "" }), s));
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

// --- Cartons: flooring sold by the carton/sheet --------------------------------

test("cartonExact: waste-adjusted square footage over the carton's coverage", () => {
  const s = normalizeSettings(undefined); // 10% waste
  const p = tile({ qty: "200", cartonSf: "23.5", cartonUnit: "CT", cartonManual: "" });
  assert.equal(cartonExact(p, s), 200 * 1.1 / 23.5);
  const C = getCarton(p, s);
  assert.equal(C.order, Math.ceil(200 * 1.1 / 23.5)); // 10 whole cartons
  assert.equal(C.sf, 23.5);
  assert.equal(C.unit, "ct");
});

test("getCarton: an exact carton count doesn't over-order from float noise", () => {
  const s = normalizeSettings(undefined);
  // 200 sf at 10% waste over 22 sf/ct is exactly 10 cartons.
  const C = getCarton(tile({ qty: "200", cartonSf: "22", cartonManual: "" }), s);
  assert.equal(C.order, 10);
});

test("getCarton: a manual total overrides the calculation, same as grout/mortar", () => {
  const s = normalizeSettings(undefined);
  const p = tile({ qty: "200", cartonSf: "23.5", cartonUnit: "SH", cartonManual: "12" });
  const C = getCarton(p, s);
  assert.equal(C.order, 12);
  assert.equal(C.unit, "sh");
});

test("getCarton never applies to misc lines, count rows, or rows without a carton size", () => {
  const s = normalizeSettings(undefined);
  assert.equal(getCarton(tile({ type: "misc", cartonSf: "20", cartonManual: "" }), s), null);
  assert.equal(getCarton(tile({ qtyType: "count", cartonSf: "20", cartonManual: "" }), s), null);
  assert.equal(getCarton(tile({ cartonSf: "", cartonManual: "" }), s), null);
  // Vinyl/hardwood/etc. get cartons too — only misc is excluded.
  assert.ok(getCarton({ type: "vinyl", qtyType: "sqft", qty: "100", cartonSf: "27.39", cartonUnit: "CT", cartonManual: "" }, s));
});

// --- Slice 04: enabled checkboxes drive dropdown eligibility -----------------

import { isOffered, offeredGrouts, offeredMortars, resolveMaterialDefault, normDefaults, setCatalogDefault } from "./catalog.js";

test("resolveMaterialDefault keeps the row's own pick when it is still offered", () => {
  assert.equal(resolveMaterialDefault(["ProLite", "AcrylPro"], "AcrylPro", "ProLite"), "AcrylPro");
});

test("resolveMaterialDefault uses the catalog default for a fresh (blank) row", () => {
  assert.equal(resolveMaterialDefault(["ProLite", "AcrylPro"], "", "AcrylPro"), "AcrylPro");
});

test("resolveMaterialDefault falls to the first offered when neither pick nor catalog default is offered", () => {
  assert.equal(resolveMaterialDefault(["AcrylPro", "Schluter All Set"], "ProLite", "ProLite"), "AcrylPro");
});

test("resolveMaterialDefault returns '' when the catalog offers nothing", () => {
  assert.equal(resolveMaterialDefault([], "ProLite", "ProLite"), "");
  assert.equal(resolveMaterialDefault(undefined, "", ""), "");
});

test("normDefaults seeds ProLite / PermaColor Select and keeps stored names verbatim", () => {
  assert.deepEqual(normDefaults(undefined), { grout: "PermaColor Select", mortar: "ProLite", underlay: "" });
  assert.deepEqual(normDefaults({ grout: "CEG-Lite", mortar: "AcrylPro" }), { grout: "CEG-Lite", mortar: "AcrylPro", underlay: "" });
  assert.equal(normDefaults({ underlay: "HardieBacker" }).underlay, "HardieBacker");
});

test("setCatalogDefault updates only the named kind's default", () => {
  const s = normalizeSettings(undefined);
  const c1 = setCatalogDefault(s.catalog, "mortars", "AcrylPro");
  assert.equal(c1.defaults.mortar, "AcrylPro");
  assert.equal(c1.defaults.grout, "PermaColor Select");
  const c2 = setCatalogDefault(c1, "grouts", "Tec Power Grout");
  assert.equal(c2.defaults.grout, "Tec Power Grout");
  assert.equal(c2.defaults.mortar, "AcrylPro");
});

test("normalizeSettings carries catalog.defaults through a serialize round-trip", () => {
  const s = normalizeSettings(undefined);
  const c = setCatalogDefault(s.catalog, "mortars", "Schluter All Set");
  const round = normalizeSettings(serializeSettings({ ...s, catalog: c }));
  assert.equal(round.catalog.defaults.mortar, "Schluter All Set");
});

test("setCatalogDefault 'underlayments' sets defaults.underlay and leaves grout/mortar", () => {
  const s = normalizeSettings(undefined);
  const c = setCatalogDefault(s.catalog, "underlayments", "HardieBacker");
  assert.equal(c.defaults.underlay, "HardieBacker");
  assert.equal(c.defaults.grout, "PermaColor Select");
  assert.equal(c.defaults.mortar, "ProLite");
});

test("underlay default survives a serialize round-trip", () => {
  const s = normalizeSettings(undefined);
  const c = setCatalogDefault(s.catalog, "underlayments", "HardieBacker");
  const round = normalizeSettings(serializeSettings({ ...s, catalog: c }));
  assert.equal(round.catalog.defaults.underlay, "HardieBacker");
});

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

// --- Slice 05: add companies/products + unique-name rule ---------------------

import { isDuplicateName, addCompany, addProduct } from "./catalog.js";

test("isDuplicateName rejects a duplicate within the grout namespace", () => {
  const s = normalizeSettings(undefined);
  assert.equal(isDuplicateName(s.catalog, "grouts", "PermaColor Select"), true);
  assert.equal(isDuplicateName(s.catalog, "grouts", "Brand New Grout"), false);
});

test("isDuplicateName rejects a duplicate within the mortar namespace", () => {
  const s = normalizeSettings(undefined);
  assert.equal(isDuplicateName(s.catalog, "mortars", "ProLite"), true);
  assert.equal(isDuplicateName(s.catalog, "mortars", "Brand New Mortar"), false);
});

test("the same name is allowed across grout vs mortar (separate namespaces)", () => {
  const s = normalizeSettings(undefined);
  assert.equal(isDuplicateName(s.catalog, "mortars", "PermaColor Select"), false);
  assert.equal(isDuplicateName(s.catalog, "grouts", "ProLite"), false);
});

test("isDuplicateName matches case- and whitespace-insensitively (lookup-consistent)", () => {
  const s = normalizeSettings(undefined);
  assert.equal(isDuplicateName(s.catalog, "grouts", "  permacolor select  "), true);
  assert.equal(isDuplicateName(s.catalog, "grouts", "PERMACOLOR SELECT"), true);
  assert.equal(isDuplicateName(s.catalog, "grouts", ""), false);
});

test("addCompany appends an enabled, empty company", () => {
  const s = normalizeSettings(undefined);
  const cat = addCompany(s.catalog, "MAPEI");
  const added = cat.companies.find((c) => c.name === "MAPEI");
  assert.ok(added);
  assert.equal(added.enabled, true);
  assert.deepEqual(added.grouts, []);
  assert.deepEqual(added.mortars, []);
});

test("addProduct appends an enabled product whose numbers resolve by name", () => {
  const s = normalizeSettings(undefined);
  const co = s.catalog.companies.find((c) => c.name === "Laticrete");
  const cat = addProduct(s.catalog, co.id, "grouts", { name: "PermaColor Pro", coverage: 120, unit: "bags", price: 30 });
  const { grouts } = resolveCatalog(cat);
  assert.equal(grouts["PermaColor Pro"].coverage, 120);
  const addedCo = cat.companies.find((c) => c.id === co.id);
  assert.equal(addedCo.grouts.find((g) => g.name === "PermaColor Pro").enabled, true);
});

// --- Underlayment: coverage math, type-scoped offering, and seed backfill -----

const un = (over = {}) => ({ type: "tile", qtyType: "sqft", qty: "200", underlay: { checked: true, product: "Ditra Underlayment Uncoupling Membrane", manual: "" }, ...over });

test("seedCatalog seeds Ditra under Schluter, tagged tile-only", () => {
  const cat = seedCatalog(mergeSettings(undefined));
  const schluter = cat.companies.find((c) => c.name === "Schluter");
  const ditra = schluter.underlayments.find((u) => u.name === "Ditra Underlayment Uncoupling Membrane");
  assert.ok(ditra, "Ditra seeded");
  assert.equal(ditra.enabled, true);
  assert.deepEqual(ditra.types, ["tile"]);
  assert.equal(ditra.coverage, 54);
});

test("underlayExact scales off square footage with the waste factor (no tile volumetrics)", () => {
  const s = normalizeSettings(undefined); // 10% waste, Ditra coverage 54
  assert.equal(underlayExact(un(), s), 200 * 1.1 / 54);
  // Independent of tile L/W/thickness, unlike grout.
  assert.equal(underlayExact(un({ L: "24", W: "24", thickness: "0.5" }), s), 200 * 1.1 / 54);
});

test("getUnderlay rounds up and honors a manual override", () => {
  const s = normalizeSettings(undefined);
  const auto = getUnderlay(un(), s);
  assert.equal(auto.order, Math.ceil(200 * 1.1 / 54));
  assert.equal(auto.unit, "rolls");
  const manual = getUnderlay(un({ underlay: { checked: true, product: "Ditra Underlayment Uncoupling Membrane", manual: "3" } }), s);
  assert.equal(manual.order, 3);
});

test("getUnderlay applies to non-tile types too (unlike grout/mortar)", () => {
  const s = normalizeSettings(undefined);
  // Add a carpet-tagged underlayment and select it on a carpet product.
  const co = s.catalog.companies[0];
  const cat = addProduct(s.catalog, co.id, "underlayments", { name: "Carpet Pad", coverage: 100, unit: "rolls", price: 0, types: ["carpet"] });
  const s2 = { ...s, ...resolveCatalog(cat) };
  const p = { type: "carpet", qtyType: "sqft", qty: "300", underlay: { checked: true, product: "Carpet Pad", manual: "" } };
  assert.equal(getUnderlay(p, s2).order, Math.ceil(300 * 1.1 / 100));
});

test("offeredUnderlayments filters by flooring type; unchecked box returns null exact", () => {
  const s = normalizeSettings(undefined);
  assert.ok(offeredUnderlayments(s.catalog, "tile").includes("Ditra Underlayment Uncoupling Membrane"));
  assert.equal(offeredUnderlayments(s.catalog, "carpet").includes("Ditra Underlayment Uncoupling Membrane"), false);
  assert.equal(getUnderlay({ ...un(), underlay: { checked: false, product: "", manual: "" } }, s), null);
});

test("backfill: a pre-underlayment catalog gains every starter; catalogHasSeedUnderlayments tracks it", () => {
  const seeded = seedCatalog(mergeSettings(undefined));
  // Simulate the stored shared catalog from before underlayments existed.
  const legacy = { companies: seeded.companies.map(({ underlayments, ...co }) => co) };
  assert.equal(catalogHasSeedUnderlayments(legacy), false);
  const normalized = normalizeCatalog(legacy);
  assert.equal(catalogHasSeedUnderlayments(normalized), true);
  assert.ok(offeredUnderlayments(normalized, "tile").includes("Ditra Underlayment Uncoupling Membrane"));
});

test("backfill merges new starters into a catalog that already has Ditra, without duplicating it", () => {
  // Simulate the live shared catalog from when Ditra was the only starter: the
  // original four companies, underlayments stripped everywhere except Schluter.
  const seeded = seedCatalog(mergeSettings(undefined));
  const legacy = {
    companies: seeded.companies
      .filter((co) => ["Laticrete", "Custom Building Products", "Tec", "Schluter"].includes(co.name))
      .map((co) => ({ ...co, underlayments: co.name === "Schluter" ? co.underlayments : [] })),
  };
  assert.equal(catalogHasSeedUnderlayments(legacy), false);
  const normalized = normalizeCatalog(legacy);
  assert.equal(catalogHasSeedUnderlayments(normalized), true);
  // Ditra untouched (same id, no duplicate).
  const ditras = normalized.companies.flatMap((co) => co.underlayments.filter((u) => u.name === "Ditra Underlayment Uncoupling Membrane"));
  assert.equal(ditras.length, 1);
  assert.equal(ditras[0].id, legacy.companies.find((co) => co.name === "Schluter").underlayments[0].id);
  // New tile options land under existing and newly created companies.
  const tileNames = offeredUnderlayments(normalized, "tile");
  for (const n of ["RedGard Uncoupling Membrane", "HardieBacker", "Wedi S-Dry"]) assert.ok(tileNames.includes(n), `${n} offered for tile`);
  assert.ok(normalized.companies.some((co) => co.name === "James Hardie"), "missing seed company created");
  // Type scoping for the non-tile starters.
  const hw = offeredUnderlayments(normalized, "hardwood");
  for (const n of ["Aquabar B", "FloorMuffler UltraSeal", "Sika MB Rapid Seal"]) assert.ok(hw.includes(n), `${n} offered for hardwood`);
  const lam = offeredUnderlayments(normalized, "laminate");
  assert.ok(lam.includes("FloorMuffler UltraSeal"));
  assert.ok(lam.includes("Sika MB Rapid Seal"));
  assert.equal(lam.includes("Aquabar B"), false);
  const vinyl = offeredUnderlayments(normalized, "vinyl");
  assert.ok(vinyl.includes("Sika MB Rapid Seal"));
  assert.equal(vinyl.includes("FloorMuffler UltraSeal"), false);
  // Re-running the backfill on its own output is a no-op (no duplicates).
  const again = normalizeCatalog(normalized);
  assert.equal(again.companies.flatMap((co) => co.underlayments).length, normalized.companies.flatMap((co) => co.underlayments).length);
});

// --- Underlayment install materials (backer mortar + screws) ------------------

const hb = (over = {}) => ({ type: "tile", qtyType: "sqft", qty: "200", underlay: { checked: true, product: "HardieBacker", manual: "", install: true, installMortars: {} }, ...over });

test("seedCatalog seeds install materials: linked mortars for HardieBacker/Ditra, custom screws for HardieBacker", () => {
  const cat = seedCatalog(mergeSettings(undefined));
  const hardie = cat.companies.find((c) => c.name === "James Hardie").underlayments.find((u) => u.name === "HardieBacker");
  assert.deepEqual(hardie.install.map((m) => m.kind), ["mortar", "custom"]);
  assert.equal(hardie.install[0].product, "ProLite");
  assert.equal(hardie.install[1].name, "BackerOn screws");
  assert.ok(hardie.install.every((m) => m.id && m.coverage > 0));
  const ditra = cat.companies.find((c) => c.name === "Schluter").underlayments[0];
  assert.deepEqual(ditra.install.map((m) => [m.kind, m.product]), [["mortar", "Schluter All Set"]]);
  // A mortar row carries no unit/price of its own — they resolve from the mortar.
  assert.equal(hardie.install[0].unit, undefined);
  assert.equal(hardie.install[0].price, undefined);
});

test("getUnderlayInstall scales off sq ft; a mortar row resolves unit and price from the mortar catalog", () => {
  const s = normalizeSettings({ catalog: undefined, wastePct: 10 }); // seeds: ProLite 50, screws 75 sq ft/unit
  s.catalog.companies.forEach((co) => co.mortars.forEach((m) => { if (m.name === "ProLite") m.price = 20; }));
  const s2 = { ...s, ...resolveCatalog(s.catalog) };
  const items = getUnderlayInstall(hb(), s2);
  assert.equal(items.length, 2);
  assert.deepEqual([items[0].kind, items[0].name, items[0].unit, items[0].price], ["mortar", "ProLite", "bags", 20]);
  assert.equal(items[0].exact, 200 * 1.1 / 50);
  assert.equal(items[0].order, Math.ceil(200 * 1.1 / 50)); // 5 bags
  assert.deepEqual([items[1].kind, items[1].name, items[1].order], ["custom", "BackerOn screws", Math.ceil(200 * 1.1 / 75)]); // 3 tubs
});

test("the job's installMortars override swaps which mortar a linked row uses", () => {
  const s = normalizeSettings(undefined);
  const cat = s.catalog;
  const hardie = cat.companies.find((c) => c.name === "James Hardie").underlayments.find((u) => u.name === "HardieBacker");
  const defId = hardie.install[0].id;
  const p = hb({ underlay: { checked: true, product: "HardieBacker", manual: "", install: true, installMortars: { [defId]: "Schluter All Set" } } });
  const items = getUnderlayInstall(p, s);
  assert.equal(items[0].name, "Schluter All Set");
  assert.equal(items[0].unit, s.mortars["Schluter All Set"].unit);
});

test("getUnderlayInstall requires the extra checkbox, a checked underlayment, and real sq ft", () => {
  const s = normalizeSettings(undefined);
  assert.equal(getUnderlayInstall(hb({ underlay: { checked: true, product: "HardieBacker", manual: "", install: false } }), s), null);
  assert.equal(getUnderlayInstall(hb({ underlay: { checked: false, product: "HardieBacker", manual: "", install: true } }), s), null);
  assert.equal(getUnderlayInstall(hb({ qty: "" }), s), null);
  assert.equal(getUnderlayInstall(hb({ qtyType: "count", qty: "40" }), s), null);
  // A product with no install materials defined yields null even when checked.
  assert.equal(getUnderlayInstall(hb({ underlay: { checked: true, product: "RedGard Uncoupling Membrane", manual: "", install: true } }), s), null);
});

test("installSkip leaves an item out; skipping everything yields null", () => {
  const s = normalizeSettings(undefined);
  const hardie = s.catalog.companies.find((c) => c.name === "James Hardie").underlayments.find((u) => u.name === "HardieBacker");
  const [mortarId, screwsId] = hardie.install.map((m) => m.id);
  const one = getUnderlayInstall(hb({ underlay: { checked: true, product: "HardieBacker", manual: "", install: true, installMortars: {}, installSkip: { [mortarId]: true } } }), s);
  assert.deepEqual(one.map((m) => m.name), ["BackerOn screws"]);
  const none = getUnderlayInstall(hb({ underlay: { checked: true, product: "HardieBacker", manual: "", install: true, installMortars: {}, installSkip: { [mortarId]: true, [screwsId]: true } } }), s);
  assert.equal(none, null);
});

test("rows with no coverage, and mortar rows with no product picked, are skipped", () => {
  const s = normalizeSettings(undefined);
  s.catalog.companies.forEach((co) => co.underlayments.forEach((u) => { if (u.name === "HardieBacker") u.install = u.install.map((m) => m.kind === "mortar" ? { ...m, product: "" } : m); }));
  const s2 = { ...s, ...resolveCatalog(s.catalog) };
  assert.deepEqual(getUnderlayInstall(hb(), s2).map((m) => m.name), ["BackerOn screws"]);
  s2.catalog.companies.forEach((co) => co.underlayments.forEach((u) => { if (u.name === "HardieBacker") u.install = u.install.map((m) => ({ ...m, coverage: 0 })); }));
  const s3 = { ...s2, ...resolveCatalog(s2.catalog) };
  assert.equal(getUnderlayInstall(hb(), s3), null);
});

test("a stored pre-link install item (no kind) normalizes to a custom row with its fields intact", () => {
  const seeded = seedCatalog(mergeSettings(undefined));
  const legacyItem = { id: "old1", name: "Backer mortar", coverage: 40, unit: "bags", price: 12 };
  const legacy = { companies: seeded.companies.map((co) => ({ ...co, underlayments: co.underlayments.map((u) => u.name === "HardieBacker" ? { ...u, install: [legacyItem] } : u) })) };
  const norm = normalizeCatalog(legacy);
  const hardie = norm.companies.find((c) => c.name === "James Hardie").underlayments.find((u) => u.name === "HardieBacker");
  assert.deepEqual(hardie.install, [{ id: "old1", kind: "custom", name: "Backer mortar", coverage: 40, unit: "bags", price: 12, sku: "" }]);
});

test("backfill: a stored catalog without the install field gains the seed defaults once", () => {
  const seeded = seedCatalog(mergeSettings(undefined));
  const legacy = { companies: seeded.companies.map((co) => ({ ...co, underlayments: co.underlayments.map(({ install, ...u }) => u) })) };
  assert.equal(catalogHasSeedUnderlayments(legacy), false);
  const normalized = normalizeCatalog(legacy);
  assert.equal(catalogHasSeedUnderlayments(normalized), true);
  const hardie = normalized.companies.find((c) => c.name === "James Hardie").underlayments.find((u) => u.name === "HardieBacker");
  assert.deepEqual(hardie.install.map((m) => m.kind === "mortar" ? m.product : m.name), ["ProLite", "BackerOn screws"]);
  // A deliberately cleared list stays cleared — [] is "defined", not "missing".
  const cleared = { companies: normalized.companies.map((co) => ({ ...co, underlayments: co.underlayments.map((u) => ({ ...u, install: [] })) })) };
  assert.equal(catalogHasSeedUnderlayments(cleared), true);
  const renorm = normalizeCatalog(cleared);
  assert.deepEqual(renorm.companies.find((c) => c.name === "James Hardie").underlayments.find((u) => u.name === "HardieBacker").install, []);
});

import { removeProduct, removeCompany, renameProduct } from "./catalog.js";

test("removeProduct deletes the product; the name no longer resolves", () => {
  const seeded = seedCatalog(mergeSettings(undefined));
  const laticrete = seeded.companies.find((c) => c.name === "Laticrete");
  const perma = laticrete.grouts.find((g) => g.name === "PermaColor Select");
  const next = removeProduct(seeded, laticrete.id, "grouts", perma.id);
  assert.equal(resolveCatalog(next).grouts["PermaColor Select"], undefined);
  assert.equal(next.companies.find((c) => c.name === "Laticrete").grouts.some((g) => g.name === "PermaColor Select"), false);
});

test("a deleted seed underlayment is tombstoned and does not resurrect on normalize", () => {
  const seeded = normalizeCatalog(seedCatalog(mergeSettings(undefined)));
  const hardieCo = seeded.companies.find((c) => c.name === "James Hardie");
  const hardie = hardieCo.underlayments.find((u) => u.name === "HardieBacker");
  const next = removeProduct(seeded, hardieCo.id, "underlayments", hardie.id);
  assert.deepEqual(next.removedSeeds, ["hardiebacker"]);
  const reloaded = normalizeCatalog(next);
  assert.equal(reloaded.companies.flatMap((c) => c.underlayments).some((u) => u.name === "HardieBacker"), false);
  assert.equal(catalogHasSeedUnderlayments(reloaded), true); // tombstoned counts as present — nothing to persist
});

test("removeProduct on a non-seed product leaves removedSeeds alone; add/company ops carry it through", () => {
  const seeded = normalizeCatalog(seedCatalog(mergeSettings(undefined)));
  const hardieCo = seeded.companies.find((c) => c.name === "James Hardie");
  const hardie = hardieCo.underlayments.find((u) => u.name === "HardieBacker");
  let cat = removeProduct(seeded, hardieCo.id, "underlayments", hardie.id);
  const tec = cat.companies.find((c) => c.name === "Tec");
  cat = removeProduct(cat, tec.id, "grouts", tec.grouts[0].id);
  assert.deepEqual(cat.removedSeeds, ["hardiebacker"]);
  cat = addCompany(cat, "New Co");
  cat = addProduct(cat, cat.companies.at(-1).id, "grouts", { name: "X" });
  assert.deepEqual(cat.removedSeeds, ["hardiebacker"]);
});

test("renameProduct changes the resolving name and keeps the numbers", () => {
  const seeded = seedCatalog(mergeSettings(undefined));
  const laticrete = seeded.companies.find((c) => c.name === "Laticrete");
  const perma = laticrete.grouts.find((g) => g.name === "PermaColor Select");
  const before = resolveCatalog(seeded).grouts["PermaColor Select"];
  const next = renameProduct(seeded, laticrete.id, "grouts", perma.id, "PermaColor Select NS");
  const grouts = resolveCatalog(next).grouts;
  assert.equal(grouts["PermaColor Select"], undefined); // old name no longer resolves
  assert.equal(grouts["PermaColor Select NS"].coverage, before.coverage);
  assert.equal(next.companies.find((c) => c.name === "Laticrete").grouts.find((g) => g.id === perma.id).name, "PermaColor Select NS");
  assert.deepEqual(next.removedSeeds ?? [], seeded.removedSeeds ?? []); // grout rename never tombstones
  // Blank names are rejected, not applied.
  assert.equal(renameProduct(seeded, laticrete.id, "grouts", perma.id, "   "), seeded);
});

test("a renamed seed underlayment tombstones its seed name and does not resurrect", () => {
  const seeded = normalizeCatalog(seedCatalog(mergeSettings(undefined)));
  const hardieCo = seeded.companies.find((c) => c.name === "James Hardie");
  const hardie = hardieCo.underlayments.find((u) => u.name === "HardieBacker");
  const next = renameProduct(seeded, hardieCo.id, "underlayments", hardie.id, "HardieBacker 500");
  assert.deepEqual(next.removedSeeds, ["hardiebacker"]);
  const reloaded = normalizeCatalog(next);
  assert.equal(reloaded.companies.flatMap((c) => c.underlayments).some((u) => u.name === "HardieBacker"), false);
  assert.equal(reloaded.companies.flatMap((c) => c.underlayments).some((u) => u.name === "HardieBacker 500"), true);
  // A pure case change is the same seed name — nothing to tombstone.
  const cased = renameProduct(seeded, hardieCo.id, "underlayments", hardie.id, "HARDIEBACKER");
  assert.deepEqual(cased.removedSeeds ?? [], []);
});

test("removeCompany drops the company", () => {
  const seeded = seedCatalog(mergeSettings(undefined));
  const wedi = seeded.companies.find((c) => c.name === "Wedi");
  const next = removeCompany(seeded, wedi.id);
  assert.equal(next.companies.some((c) => c.name === "Wedi"), false);
});

// --- Ops provenance (last import / last backup stamps) ------------------------
// Shared, informational-only stamps carried with the settings record. They must
// survive the serialize -> persist -> normalize round trip, and garbage from an
// old or hand-edited record must normalize away rather than crash.

test("serializeSettings and normalizeSettings round-trip valid ops stamps", () => {
  const ops = { lastImport: { at: 1751500000000, by: "Dave", skus: 312 }, lastBackup: { at: 1751000000000, by: "Marcus" } };
  const out = serializeSettings(normalizeSettings({ waste: { tile: 10, floor: 10 }, ops }));
  assert.deepEqual(out.ops, ops);
  assert.deepEqual(serializeSettings(normalizeSettings(out)).ops, ops);
});

test("settings without ops stay without ops", () => {
  const s = normalizeSettings({ waste: { tile: 10, floor: 10 } });
  assert.equal(s.ops, undefined);
  assert.equal("ops" in serializeSettings(s), false);
});

test("normOps preserves a valid staleDays override and drops an invalid one", () => {
  const keep = serializeSettings(normalizeSettings({ waste: { tile: 10, floor: 10 }, ops: { staleDays: 90 } }));
  assert.equal(keep.ops.staleDays, 90);
  // rounds to whole days
  const round = serializeSettings(normalizeSettings({ waste: { tile: 10, floor: 10 }, ops: { staleDays: 90.6 } }));
  assert.equal(round.ops.staleDays, 91);
  // zero / negative / non-numeric are dropped, leaving no ops at all here
  for (const bad of [0, -30, "soon"]) {
    const out = serializeSettings(normalizeSettings({ waste: { tile: 10, floor: 10 }, ops: { staleDays: bad } }));
    assert.equal(out.ops, undefined);
  }
  // a staleDays override coexists with provenance stamps
  const both = serializeSettings(normalizeSettings({ waste: { tile: 10, floor: 10 }, ops: { staleDays: 60, lastImport: { at: 1751500000000, by: "Dave" } } }));
  assert.equal(both.ops.staleDays, 60);
  assert.equal(both.ops.lastImport.by, "Dave");
});

test("garbage ops normalize away instead of persisting", () => {
  for (const bad of ["yes", 7, { lastImport: "yesterday" }, { lastImport: { by: "Dave" } }, { lastImport: { at: "not a time" } }]) {
    const s = normalizeSettings({ waste: { tile: 10, floor: 10 }, ops: bad });
    assert.equal(s.ops, undefined, JSON.stringify(bad));
  }
});

test("one valid stamp survives even when the other is garbage", () => {
  const s = normalizeSettings({ waste: { tile: 10, floor: 10 }, ops: { lastImport: { at: 5 }, lastBackup: { at: "nope" } } });
  assert.deepEqual(s.ops, { lastImport: { at: 5, by: "" } });
});

// --- ADR 0006: catalog SKU link + grout base-unit companion --------------------

const catWithGrout = (grout) => normalizeSettings({
  waste: { tile: 10, floor: 10 },
  catalog: { companies: [{ name: "Laticrete", enabled: true, grouts: [grout], mortars: [], underlayments: [] }] },
});

test("catalog products carry an optional sku through normalize/resolve", () => {
  const s = normalizeSettings({
    waste: { tile: 10, floor: 10 },
    catalog: { companies: [{ name: "Laticrete", enabled: true,
      grouts: [{ name: "PermaColor Select", coverage: 110, unit: "units", price: 5.39, sku: "1519025" }],
      mortars: [{ name: "ProLite", tier1: 90, tier2: 63, tier3: 45, unit: "bags", price: 30, sku: "9001" }],
      underlayments: [{ name: "Ditra", coverage: 54, unit: "rolls", price: 0, types: ["tile"], sku: "9002" }] }] },
  });
  const { grouts, mortars, underlayments } = resolveCatalog(s.catalog);
  assert.equal(grouts["PermaColor Select"].sku, "1519025");
  assert.equal(mortars["ProLite"].sku, "9001");
  assert.equal(underlayments["Ditra"].sku, "9002");
  // Absent sku normalizes to "" (old records stay valid).
  const plain = normalizeSettings(undefined);
  assert.equal(resolveCatalog(plain.catalog).grouts["PermaColor Select"].sku, "");
});

test("baseCompanion normalizes: defaults per to 1, drops an identity-less base", () => {
  const s = catWithGrout({ name: "PermaColor Select", coverage: 110, unit: "units", price: 5.39, sku: "1519025",
    base: { sku: "1519065", name: "PermaColor Sanded Base", unit: "units", price: 24.75 } });
  const base = resolveCatalog(s.catalog).grouts["PermaColor Select"].base;
  assert.equal(base.per, 1); // defaulted
  assert.equal(base.name, "PermaColor Sanded Base");
  assert.equal(base.sku, "1519065");
  const none = catWithGrout({ name: "PermaColor Select", coverage: 110, base: { unit: "units", price: 5 } });
  assert.equal(resolveCatalog(none.catalog).grouts["PermaColor Select"].base, null);
});

test("getGrout exposes the product's sku for the totals summary", () => {
  const s = catWithGrout({ name: "PermaColor Select", coverage: 110, unit: "units", price: 5.39, sku: "1519025" });
  assert.equal(getGrout(tile(), s).sku, "1519025");
});

test("getGroutBase orders 1:1 with kits, per divides (Commercial unit = 4)", () => {
  // 200 sf, 12x12x3/8 tile, 1/8 joint, coverage 100, 10% waste -> 2.2 -> 3 kits.
  const one = catWithGrout({ name: "PermaColor Select", coverage: 100, unit: "units", price: 5.39,
    base: { sku: "1519065", name: "PermaColor Sanded Base", unit: "units", price: 24.75, per: 1 } });
  assert.equal(getGrout(tile(), one).order, 3);
  const b1 = getGroutBase(tile(), one);
  assert.equal(b1.order, 3);       // one base per kit
  assert.equal(b1.sku, "1519065");
  assert.equal(b1.per, 1);
  const four = catWithGrout({ name: "PermaColor Select", coverage: 100, unit: "units", price: 5.39,
    base: { sku: "1518984", name: "SpectraLock Comm. Unit", unit: "units", price: 374.99, per: 4 } });
  assert.equal(getGroutBase(tile(), four).order, 1); // ceil(3/4)
  assert.equal(getGroutBase(tile(), four).exact, 0.75);
});

test("getGroutBase is null when the grout has no base or isn't computed", () => {
  const noBase = catWithGrout({ name: "PermaColor Select", coverage: 110, unit: "units", price: 5.39 });
  assert.equal(getGroutBase(tile(), noBase), null);
  const withBase = catWithGrout({ name: "PermaColor Select", coverage: 110,
    base: { sku: "1519065", name: "PermaColor Sanded Base", per: 1 } });
  assert.equal(getGroutBase(tile({ grout: { checked: false, product: "PermaColor Select", color: "", joint: 0.125, manual: "" } }), withBase), null);
});

// --- Float noise must not inflate any order quantity ----------------------------
// 200 sf at 10% waste is 220.00000000000003 in floats; before ceilQty, every
// exact-boundary quantity ordered one extra unit.

test("getGrout: an exact kit count doesn't over-order from float noise", () => {
  // 12x12x3/8, 1/8" joint -> cov = coverage; 200 * 1.1 / 110 = exactly 2 kits.
  const s = catWithGrout({ name: "PermaColor Select", coverage: 110, unit: "units", price: 5.39 });
  assert.equal(getGrout(tile(), s).order, 2);
});

test("getMortar: an exact bag count doesn't over-order from float noise", () => {
  // 12" tile -> tier2; 200 * 1.1 / 55 = exactly 4 bags.
  const s = normalizeSettings(undefined);
  s.mortars["ProLite"] = { ...s.mortars["ProLite"], tier2: 55 };
  assert.equal(getMortar(tile(), s).order, 4);
});

test("getUnderlay + install materials: exact counts don't over-order from float noise", () => {
  // 200 * 1.1 / 55 = exactly 4 rolls; install mortar at coverage 44 -> exactly 5.
  const s = normalizeSettings({
    waste: { tile: 10, floor: 10 },
    catalog: { companies: [{ name: "Schluter", enabled: true, grouts: [], mortars: [{ name: "Schluter All Set", tier1: 95, tier2: 70, tier3: 45, unit: "bags", price: 0 }], underlayments: [
      { name: "Ditra", coverage: 55, unit: "rolls", price: 0, types: ["tile"], install: [{ kind: "mortar", product: "Schluter All Set", coverage: 44 }] },
    ] }] },
  });
  const p = tile({ underlay: { checked: true, product: "Ditra", manual: "", install: true, installMortars: {}, installSkip: {} } });
  assert.equal(getUnderlay(p, s).order, 4);
  assert.equal(getUnderlayInstall(p, s)[0].order, 5);
});

test("getGroutBase: an exact base count doesn't over-order from float noise", () => {
  // 2 kits over a per-4 Commercial unit -> exact 0.5 -> 1 (and no noise at per 1).
  const s = catWithGrout({ name: "PermaColor Select", coverage: 110, unit: "units", price: 5.39,
    base: { sku: "1519065", name: "PermaColor Sanded Base", unit: "units", price: 24.75, per: 1 } });
  assert.equal(getGroutBase(tile(), s).order, 2);
});

test("groutBaseList consolidates bases across colors/grouts and applies per", () => {
  const s = normalizeSettings({
    waste: { tile: 10, floor: 10 },
    catalog: { companies: [{ name: "Laticrete", enabled: true, mortars: [], underlayments: [], grouts: [
      { name: "PermaColor Color Kit", coverage: 100, unit: "kits", price: 5.39, base: { sku: "1519065", name: "PermaColor Sanded Base", unit: "units", price: 24.75, per: 1 } },
      { name: "Spectralock Part C", coverage: 90, unit: "kits", price: 32.89, base: { sku: "1518984", name: "SpectraLock Comm. Unit", unit: "units", price: 374.99, per: 4 } },
      { name: "Tec Power Grout", coverage: 45, unit: "bags", price: 33.53 }, // no base
    ] }] },
  });
  // Two colors of the same grout share one consolidated base line: 3 + 2 kits -> 5 bases.
  const list = groutBaseList([
    { product: "PermaColor Color Kit", order: 3 },
    { product: "PermaColor Color Kit", order: 2 },
    { product: "Spectralock Part C", order: 5 },
    { product: "Tec Power Grout", order: 4 },
    { product: "PermaColor Color Kit", order: 0 }, // pending line — no kits yet
  ], s);
  assert.equal(list.length, 2);
  const sanded = list.find((b) => b.sku === "1519065");
  assert.equal(sanded.order, 5);
  assert.equal(sanded.cost, 5 * 24.75);
  const comm = list.find((b) => b.sku === "1518984");
  assert.equal(comm.exact, 1.25); // 5 kits / per 4
  assert.equal(comm.order, 2);
  assert.deepEqual(groutBaseList([{ product: "Tec Power Grout", order: 4 }], s), []);
});

// --- ADR 0007: grout book-family link, install-item SKUs ------------------------

test("grout book link normalizes through catalog and resolve; absent book = empty", () => {
  const s = catWithGrout({ name: "PermaColor Select", coverage: 110, unit: "bags", price: 30, book: " Permacolor Select Grout " });
  assert.equal(resolveCatalog(s.catalog).grouts["PermaColor Select"].book, "Permacolor Select Grout");
  // Records saved before ADR 0007 have no book field - they normalize to "".
  const old = catWithGrout({ name: "Old Grout", coverage: 100 });
  assert.equal(resolveCatalog(old.catalog).grouts["Old Grout"].book, "");
});

test("custom install items carry a sku through normalize and into getUnderlayInstall", () => {
  const s = normalizeSettings(undefined);
  s.catalog.companies.forEach((co) => co.underlayments.forEach((u) => {
    if (u.name === "HardieBacker") u.install = u.install.map((m) => m.kind === "custom" ? { ...m, sku: "1600123" } : m);
  }));
  const s2 = { ...s, ...resolveCatalog(s.catalog) };
  const items = getUnderlayInstall(hb(), s2);
  const screws = items.find((m) => m.kind === "custom");
  assert.equal(screws.sku, "1600123");
  // Pre-0007 install items have no sku - they normalize to "" and still calculate.
  const plain = normalizeSettings(undefined);
  const old = getUnderlayInstall(hb(), plain).find((m) => m.kind === "custom");
  assert.equal(old.sku, "");
  assert.equal(old.order, Math.ceil(200 * 1.1 / 75));
});

// --- materials-not-calculating warnings (spec 2026-07-14) --------------------------

test("materialWarnings: checked materials that can't compute, SF-missing suppression", () => {
  const s = normalizeSettings(undefined);
  const mk = (over = {}, grout = {}, mortar = {}, underlay = {}) => ({
    type: "tile", qtyType: "sqft", qty: "100", L: "12", W: "12", thickness: "0.375",
    grout: { checked: true, product: "PermaColor Select", joint: 0.125, manual: "", ...grout },
    mortar: { checked: true, product: "ProLite", manual: "", ...mortar },
    underlay: { checked: false, product: "", manual: "", install: false, installMortars: {}, installSkip: {}, ...underlay },
    ...over,
  });
  // Everything computes → no warnings.
  assert.deepEqual(materialWarnings(mk(), s), []);
  // The mosaic case: SF entered but no L/W → grout AND mortar can't compute.
  assert.deepEqual(materialWarnings(mk({ L: "", W: "" }), s), ["grout", "mortar"]);
  // A typed manual total silences that material's warning.
  assert.deepEqual(materialWarnings(mk({ L: "", W: "" }, { manual: "3" }), s), ["mortar"]);
  // SF missing suppresses everything — the SF cell's amber ring owns that state.
  assert.deepEqual(materialWarnings(mk({ L: "", W: "", qty: "" }), s), []);
  // Unchecked materials never warn.
  assert.deepEqual(materialWarnings(mk({ L: "", W: "" }, { checked: false }, { checked: false }), s), []);
  // Misc rows never warn.
  assert.deepEqual(materialWarnings(mk({ type: "misc", L: "", W: "" }), s), []);
});

test("materialWarnings: underlayment and install-material failures", () => {
  const s = normalizeSettings(undefined);
  const mk = (underlay) => ({
    type: "vinyl", qtyType: "sqft", qty: "100", L: "", W: "", thickness: "",
    grout: { checked: false, product: "", joint: 0.125, manual: "" },
    mortar: { checked: false, product: "", manual: "" },
    underlay: { checked: true, product: "", manual: "", install: false, installMortars: {}, installSkip: {}, ...underlay },
  });
  // Unknown product → no coverage to compute from.
  assert.deepEqual(materialWarnings(mk({ product: "No Such Underlayment" }), s), ["underlay"]);
  // A known product computes.
  const known = Object.keys(s.underlayments).find((n) => s.underlayments[n].coverage > 0);
  assert.deepEqual(materialWarnings(mk({ product: known }), s), []);
  // Install materials included but none computable (all defs' coverage zeroed).
  const s2 = normalizeSettings(undefined);
  const hardie = s2.catalog.companies.find((c) => c.name === "James Hardie").underlayments.find((u) => u.name === "HardieBacker");
  hardie.install = hardie.install.map((m) => ({ ...m, coverage: 0 }));
  const s3 = { ...s2, ...resolveCatalog(s2.catalog) };
  assert.deepEqual(materialWarnings(mk({ product: "HardieBacker", install: true }), s3), ["install"]);
});
