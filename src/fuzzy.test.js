import { test } from "node:test";
import assert from "node:assert/strict";
import { trigrams, similarity, FUZZY_THRESHOLD } from "./fuzzy.js";

test("trigrams pad each word pg_trgm-style and split on non-alphanumerics", () => {
  assert.deepEqual([...trigrams("cat")], ["  c", " ca", "cat", "at "]);
  // two words -> union of both padded sets, punctuation is a boundary
  assert.ok(trigrams("t-mold").has("  t"));
  assert.ok(trigrams("t-mold").has("mol"));
  assert.equal(trigrams("").size, 0);
  assert.equal(trigrams(null).size, 0);
});

test("similarity is 1 for identical words and 0 for no shared trigrams", () => {
  assert.equal(similarity("reducer", "reducer"), 1);
  assert.equal(similarity("oak", "zzz"), 0);
});

test("a one-letter typo stays above the threshold", () => {
  assert.ok(similarity("reducar", "reducer") >= FUZZY_THRESHOLD);
  assert.ok(similarity("porcelian", "porcelain") >= FUZZY_THRESHOLD);
});

test("unrelated short words fall below the threshold", () => {
  assert.ok(similarity("oak", "acacia") < FUZZY_THRESHOLD);
});
