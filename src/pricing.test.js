import { test } from "node:test";
import assert from "node:assert/strict";
import { TIER_IDS, PRINT_PRICING_IDS, normTier, normPrintPricing, normPricing, tierPct, tierUnitPrice, employeeNoCost, tierView, tierTag } from "./pricing.js";

const SETTINGS = {
  waste: { tile: 10, floor: 10 },
  pricing: { builderPct: 8, salePct: 10 },
  grouts: { "PermaColor Select": { coverage: 30, unit: "bags", price: 20, sku: "PC1", base: { sku: "B1", name: "Base", unit: "kits", price: 50, per: 1 } } },
  mortars: { "ProLite": { tier1: 90, tier2: 63, tier3: 45, unit: "bags", price: 30, sku: "M1" } },
  underlayments: { "Ditra": { coverage: 175, unit: "rolls", price: 400, sku: "U1", types: ["tile"], install: [{ id: "i1", name: "Screws", price: 25, coverage: 100, unit: "boxes" }] } },
  attached: { cat1: { "Transition strip": { price: 12, sku: "A1", coverage: 0, unit: "pcs" } } },
};

const row = (over = {}) => ({ id: "p1", type: "tile", qtyType: "sqft", qty: "100", priceSqft: "5.00", costSqft: "", grout: { checked: false, caulkPrice: "" }, ...over });
const proj = (tierOver = {}, products = [row()]) => ({ id: "c1", priceTier: "retail", customPct: "", printPricing: "full", categories: [{ id: "a1", name: "Main", products }], ...tierOver });

// --- normalization ------------------------------------------------------------

test("normTier / normPrintPricing default invalid values", () => {
  assert.equal(normTier("builder"), "builder");
  assert.equal(normTier("bogus"), "retail");
  assert.equal(normTier(undefined), "retail");
  assert.equal(normPrintPricing("unit"), "unit");
  assert.equal(normPrintPricing(""), "full");
  assert.ok(TIER_IDS.includes("employee") && PRINT_PRICING_IDS.includes("none"));
});

test("normPricing defaults builder 8 / sale 10 / Sheoga markup 40 / vent markup 50 and clamps", () => {
  assert.deepEqual(normPricing(undefined), { builderPct: 8, salePct: 10, sheogaMarkupPct: 40, sheogaVentMarkupPct: 50, descLimit: 30, searchStrictness: 0.3, searchFallback: 0.18 });
  assert.deepEqual(normPricing({ builderPct: 12, salePct: 15 }), { builderPct: 12, salePct: 15, sheogaMarkupPct: 40, sheogaVentMarkupPct: 50, descLimit: 30, searchStrictness: 0.3, searchFallback: 0.18 });
  assert.deepEqual(normPricing({ builderPct: -5, salePct: 400 }), { builderPct: 0, salePct: 100, sheogaMarkupPct: 40, sheogaVentMarkupPct: 50, descLimit: 30, searchStrictness: 0.3, searchFallback: 0.18 });
  assert.deepEqual(normPricing({ builderPct: "abc" }), { builderPct: 8, salePct: 10, sheogaMarkupPct: 40, sheogaVentMarkupPct: 50, descLimit: 30, searchStrictness: 0.3, searchFallback: 0.18 });
  // Markup is a % over cost, not a discount — it may exceed 100.
  assert.equal(normPricing({ sheogaMarkupPct: 150 }).sheogaMarkupPct, 150);
  assert.equal(normPricing({ sheogaMarkupPct: -3 }).sheogaMarkupPct, 0);
  assert.equal(normPricing({ sheogaVentMarkupPct: 75, descLimit: 30 }).sheogaVentMarkupPct, 75);
  // The ERP description-field width: whole characters, 0 = no fitting.
  assert.equal(normPricing({ descLimit: 40 }).descLimit, 40);
  assert.equal(normPricing({ descLimit: 0 }).descLimit, 0);
  assert.equal(normPricing({ descLimit: -5 }).descLimit, 0);
  assert.equal(normPricing({ descLimit: 9999 }).descLimit, 200);
  assert.equal(normPricing({ descLimit: "abc" }).descLimit, 30);
  // Item-search strictness: trigram threshold (fraction), clamped to [0.1, 0.9].
  assert.equal(normPricing(undefined).searchStrictness, 0.3);
  assert.equal(normPricing({ searchStrictness: 0.5 }).searchStrictness, 0.5);
  assert.equal(normPricing({ searchStrictness: 0.01 }).searchStrictness, 0.1);
  assert.equal(normPricing({ searchStrictness: 2 }).searchStrictness, 0.9);
  assert.equal(normPricing({ searchStrictness: "abc" }).searchStrictness, 0.3);
  // Near-match fallback: its own clamped fraction, default looser than the primary.
  assert.equal(normPricing(undefined).searchFallback, 0.18);
  assert.equal(normPricing({ searchFallback: 0.25 }).searchFallback, 0.25);
  assert.equal(normPricing({ searchFallback: 0.01 }).searchFallback, 0.1);
  assert.equal(normPricing({ searchFallback: 5 }).searchFallback, 0.9);
  assert.equal(normPricing({ searchFallback: "abc" }).searchFallback, 0.18);
});

// --- tierPct -------------------------------------------------------------------

test("tierPct reads the tier's percent, 0 for retail/employee", () => {
  assert.equal(tierPct(proj(), SETTINGS), 0);
  assert.equal(tierPct(proj({ priceTier: "builder" }), SETTINGS), 8);
  assert.equal(tierPct(proj({ priceTier: "sale" }), SETTINGS), 10);
  assert.equal(tierPct(proj({ priceTier: "custom", customPct: "12.5" }), SETTINGS), 12.5);
  assert.equal(tierPct(proj({ priceTier: "employee" }), SETTINGS), 0);
});

test("tierPct clamps custom to 0-100 and tolerates missing settings.pricing", () => {
  assert.equal(tierPct(proj({ priceTier: "custom", customPct: "150" }), SETTINGS), 100);
  assert.equal(tierPct(proj({ priceTier: "custom", customPct: "-3" }), SETTINGS), 0);
  assert.equal(tierPct(proj({ priceTier: "builder" }), {}), 8);
  assert.equal(tierPct(proj({ priceTier: "sale" }), {}), 10);
});

// --- tierUnitPrice / employeeNoCost --------------------------------------------

test("discount tiers round2 off retail; null when unpriced or 0%", () => {
  assert.equal(tierUnitPrice(row({ priceSqft: "4.99" }), "builder", 8), 4.59);
  assert.equal(tierUnitPrice(row({ priceSqft: "4.99" }), "sale", 10), 4.49);
  assert.equal(tierUnitPrice(row({ priceSqft: "" }), "builder", 8), null);
  assert.equal(tierUnitPrice(row(), "custom", 0), null);
  assert.equal(tierUnitPrice(row(), "retail", 0), null);
});

test("employee = cost x 1.06 on priced rows with a cost, else null", () => {
  assert.equal(tierUnitPrice(row({ costSqft: "3.50" }), "employee", 0), 3.71);
  assert.equal(tierUnitPrice(row({ costSqft: "" }), "employee", 0), null);
  // an unpriced row is invisible in totals — employee must not invent a price
  assert.equal(tierUnitPrice(row({ priceSqft: "", costSqft: "3.50" }), "employee", 0), null);
});

test("employeeNoCost flags priced rows without a snapshotted cost", () => {
  assert.equal(employeeNoCost(row()), true);
  assert.equal(employeeNoCost(row({ costSqft: "3.50" })), false);
  assert.equal(employeeNoCost(row({ priceSqft: "" })), false);
});

// --- tierView ------------------------------------------------------------------

test("retail view is identity (same references)", () => {
  const p = proj();
  const tv = tierView(p, SETTINGS);
  assert.equal(tv.proj, p);
  assert.equal(tv.settings, SETTINGS);
  assert.equal(tv.tier, "retail");
});

test("custom at 0% is identity too", () => {
  const p = proj({ priceTier: "custom", customPct: "" });
  const tv = tierView(p, SETTINGS);
  assert.equal(tv.proj, p);
  assert.equal(tv.settings, SETTINGS);
});

test("builder view scales product prices, caulk snapshot, and material maps", () => {
  const p = proj({ priceTier: "builder" }, [
    row({ priceSqft: "5.00", grout: { checked: true, product: "PermaColor Select", caulkPrice: "10.00" } }),
    row({ id: "p2", priceSqft: "" }),
  ]);
  const tv = tierView(p, SETTINGS);
  const [r1, r2] = tv.proj.categories[0].products;
  assert.equal(r1.priceSqft, "4.6");
  assert.equal(r1.grout.caulkPrice, "9.2");
  assert.equal(r2.priceSqft, "");
  assert.equal(tv.settings.grouts["PermaColor Select"].price, 18.4);
  assert.equal(tv.settings.grouts["PermaColor Select"].base.price, 46);
  assert.equal(tv.settings.mortars["ProLite"].price, 27.6);
  assert.equal(tv.settings.underlayments["Ditra"].price, 368);
  assert.equal(tv.settings.underlayments["Ditra"].install[0].price, 23);
  assert.equal(tv.settings.attached.cat1["Transition strip"].price, 11.04);
  assert.equal(tv.pct, 8);
});

test("builder view leaves the inputs unmutated and structure intact", () => {
  const p = proj({ priceTier: "builder" });
  const tv = tierView(p, SETTINGS);
  assert.equal(p.categories[0].products[0].priceSqft, "5.00");
  assert.equal(SETTINGS.grouts["PermaColor Select"].price, 20);
  assert.equal(tv.proj.categories[0].products[0].id, "p1");
  assert.equal(tv.proj.categories[0].id, "a1");
});

test("employee view reprices only costed rows, settings untouched", () => {
  const p = proj({ priceTier: "employee" }, [
    row({ costSqft: "3.50" }),
    row({ id: "p2", priceSqft: "2.00", costSqft: "" }),
  ]);
  const tv = tierView(p, SETTINGS);
  const [r1, r2] = tv.proj.categories[0].products;
  assert.equal(r1.priceSqft, "3.71");
  assert.equal(r2.priceSqft, "2.00");
  assert.equal(tv.settings, SETTINGS);
});

test("a null/absent project passes through as retail", () => {
  const tv = tierView(null, SETTINGS);
  assert.equal(tv.tier, "retail");
  assert.equal(tv.pct, 0);
});

// --- tierTag --------------------------------------------------------------------

test("tierTag labels non-retail tiers", () => {
  assert.equal(tierTag("retail", 0), "");
  assert.equal(tierTag("builder", 8), "Builder pricing — 8% off retail");
  assert.equal(tierTag("sale", 10), "Sale pricing — 10% off retail");
  assert.equal(tierTag("custom", 12.5), "Custom pricing — 12.5% off retail");
  assert.equal(tierTag("custom", 0), "");
  assert.equal(tierTag("employee", 0), "Employee pricing");
});
