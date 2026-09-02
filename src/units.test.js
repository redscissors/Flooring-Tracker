import test from "node:test";
import assert from "node:assert/strict";
import { unitCode, unitNoun, isRollUnit, isMeasureUnit, bundleUnit } from "./units.js";

test("unitCode normalizes the spellings a book can use", () => {
  assert.equal(unitCode("rl"), "RL");
  assert.equal(unitCode("RL"), "RL");
  assert.equal(unitCode("Rolls"), "RL");
  assert.equal(unitCode(" roll "), "RL");
  assert.equal(unitCode("ctn"), "CT");
  assert.equal(unitCode("sheet"), "SH");
  assert.equal(unitCode("each"), "EA");
  assert.equal(unitCode("units"), "PC"); // the app's own word for a bare count
  assert.equal(unitCode("sq.ft."), "SF");
});

// The point of the fallback: an unrecognized unit shows the vendor's own word
// rather than a confidently wrong "EA".
test("an unknown unit passes through as the book's own code", () => {
  assert.equal(unitCode("pail"), "PAIL");
  assert.equal(unitCode(""), "");
  assert.equal(unitCode(null), "");
});

test("unitNoun reads a quantity in prose, singular at one", () => {
  assert.equal(unitNoun(3, "rl"), "rolls");
  assert.equal(unitNoun(1, "RL"), "roll");
  assert.equal(unitNoun(1, "ct"), "carton");
  assert.equal(unitNoun(2, "sh"), "sheets");
  assert.equal(unitNoun(2, "ea"), "pieces");
  // Unknown units keep the settings-unit behavior: the word, de-pluralized at 1.
  assert.equal(unitNoun(1, "pails"), "pail");
  assert.equal(unitNoun(4, "pails"), "pails");
});

// A roll bundles coverage like a carton but holds no countable pieces, so it is
// deliberately neither of stock.js's piece/carton classes.
test("isRollUnit recognizes the roll spellings only", () => {
  assert.equal(isRollUnit("RL"), true);
  assert.equal(isRollUnit("rolls"), true);
  assert.equal(isRollUnit("ct"), false);
  assert.equal(isRollUnit("sh"), false);
  assert.equal(isRollUnit(""), false);
});

// A measure names how much material there is, never what bundles it — the
// distinction a book with one U/M column ("SF", the price basis) erases.
test("isMeasureUnit separates measures from bundling units", () => {
  assert.equal(isMeasureUnit("SF"), true);
  assert.equal(isMeasureUnit("sq ft"), true);
  assert.equal(isMeasureUnit("LF"), true);
  assert.equal(isMeasureUnit("SY"), true);
  assert.equal(isMeasureUnit("CT"), false);
  assert.equal(isMeasureUnit("SH"), false);
  assert.equal(isMeasureUnit("RL"), false);
  assert.equal(isMeasureUnit("pail"), false);
  assert.equal(isMeasureUnit(""), false);
});

// The unit a coverage is counted in. "12.15 SF/SF" is not a spec, and 13 of
// them keyed as SF is 145 sq ft the desk never ordered (Marcus 2026-08-31).
test("bundleUnit refuses a measure as a bundle and keeps everything else", () => {
  assert.equal(bundleUnit("SF"), "CT");
  assert.equal(bundleUnit("sq ft"), "CT");
  assert.equal(bundleUnit("SF", "SH"), "SH");
  assert.equal(bundleUnit(""), "CT");
  assert.equal(bundleUnit(null), "CT");
  assert.equal(bundleUnit("CT"), "CT");
  assert.equal(bundleUnit("SH"), "SH");
  assert.equal(bundleUnit("RL"), "RL");
  assert.equal(bundleUnit(" Cartons "), "Cartons");
});
