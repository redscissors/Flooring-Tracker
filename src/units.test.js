import test from "node:test";
import assert from "node:assert/strict";
import { unitCode, unitNoun, isRollUnit } from "./units.js";

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
