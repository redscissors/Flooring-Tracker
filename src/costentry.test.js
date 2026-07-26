import test from "node:test";
import assert from "node:assert/strict";
import { priceFromCost, markupFromPrice, unitMargin, editCost, editMarkup, editPrice, normQuickMarkups, MARKUP_PRESETS, MAX_QUICK_MARKUPS } from "./costentry.js";
import { normPricing } from "./catalog.js";
import { sellPrice } from "./orderbook.js";

const row = (over = {}) => ({ priceSqft: "", costSqft: "", markupPct: "", ...over });

test("markup is on cost, the same frame the price books mark up in", () => {
  assert.equal(priceFromCost("3.40", 50), 5.1);
  assert.equal(priceFromCost(4, 100), 8);
  assert.equal(priceFromCost("2.99", 30), 3.89);
  for (const pct of MARKUP_PRESETS) assert.equal(priceFromCost("7.25", pct), sellPrice(7.25, pct));
});

test("no cost, no derived price — the popup never invents one", () => {
  assert.equal(priceFromCost("", 50), null);
  assert.equal(priceFromCost("0", 50), null);
  assert.equal(priceFromCost("3.40", ""), null);
});

test("markupFromPrice reads a hand-typed price back as its markup", () => {
  assert.equal(markupFromPrice("4.00", "6.00"), 50);
  assert.equal(markupFromPrice("3.40", "5.10"), 50);
  assert.equal(markupFromPrice("3.33", "5.00"), 50.2);
  assert.equal(markupFromPrice("", "5.00"), null);
  assert.equal(markupFromPrice("4.00", ""), null);
});

// 50% markup is 33.3% margin — the popup says margin because that is what the
// job's margin line says.
test("unitMargin is margin OF SELL, matching the job margin line", () => {
  assert.deepEqual(unitMargin("4.00", "6.00"), { amount: 2, pct: 33.3 });
  assert.deepEqual(unitMargin("5.00", "4.00"), { amount: -1, pct: -25 });
  assert.equal(unitMargin("0", "6.00"), null);
});

test("editCost with a markup chosen drives the price live", () => {
  assert.deepEqual(editCost(row({ markupPct: "50" }), "3.40"), { costSqft: "3.40", priceSqft: "5.10" });
});

test("editCost with no markup records the cost and leaves a typed price alone", () => {
  assert.deepEqual(editCost(row({ priceSqft: "9.99" }), "3.40"), { costSqft: "3.40" });
});

test("clearing the cost clears the field without wiping the price", () => {
  assert.deepEqual(editCost(row({ priceSqft: "9.99", markupPct: "50" }), ""), { costSqft: "" });
});

test("editMarkup prices the row off the cost it already has", () => {
  assert.deepEqual(editMarkup(row({ costSqft: "3.40" }), 100), { markupPct: "100", priceSqft: "6.80" });
  assert.deepEqual(editMarkup(row(), 100), { markupPct: "100" });
});

test("editPrice re-derives the markup — the price moves the margin, not the cost", () => {
  assert.deepEqual(editPrice(row({ costSqft: "4.00", markupPct: "50" }), "7.00"), { priceSqft: "7.00", markupPct: "75" });
});

// A book row whose item had no per-unit cost (a flat/count line) keeps the
// book's snapshotted markup — there is nothing to re-derive from.
test("editPrice leaves a snapshotted markup alone when there is no per-unit cost", () => {
  assert.deepEqual(editPrice(row({ markupPct: "40" }), "7.00"), { priceSqft: "7.00" });
});

// --- the team-tunable preset list (Settings -> Price book) -------------------

test("an unset list seeds the shop's defaults", () => {
  assert.deepEqual(normQuickMarkups(undefined), MARKUP_PRESETS);
  assert.deepEqual(normQuickMarkups(null), MARKUP_PRESETS);
  assert.deepEqual(normQuickMarkups("30,50"), MARKUP_PRESETS);   // not a list
});

// Clearing every button is a decision, not a reset — the popup's % box still
// takes any markup, so an empty row is usable.
test("an explicitly empty list stays empty", () => {
  assert.deepEqual(normQuickMarkups([]), []);
});

test("what the Settings card can type is filtered on the way out", () => {
  assert.deepEqual(normQuickMarkups(["35", "", "60", "abc", "35", -5, 700, 42.55]), [35, 60, 42.6]);
});

test("the list is capped at what the popup's button row can show", () => {
  assert.equal(normQuickMarkups([10, 20, 30, 40, 50, 60, 70, 80]).length, MAX_QUICK_MARKUPS);
});

test("the defaults survive a round trip through the settings normalizer", () => {
  assert.deepEqual(normPricing({}).quickMarkups, MARKUP_PRESETS);
  assert.deepEqual(normPricing({ quickMarkups: ["25", "45"] }).quickMarkups, [25, 45]);
  // A saved list must not disturb the percentages beside it.
  assert.equal(normPricing({ quickMarkups: [25], builderPct: 12 }).builderPct, 12);
});
