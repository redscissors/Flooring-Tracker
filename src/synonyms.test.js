import { test } from "node:test";
import assert from "node:assert/strict";
import { expand, SYNONYMS } from "./synonyms.js";

test("expand always includes the original word first", () => {
  assert.deepEqual(expand("oak"), ["oak"]);
  assert.equal(expand("transition")[0], "transition");
});

test("expand is case-insensitive and null-safe", () => {
  assert.deepEqual(expand("OAK"), ["oak"]);
  assert.deepEqual(expand(null), [""]);
  assert.deepEqual(expand(undefined), [""]);
});

test("umbrella word expands to trim profiles", () => {
  const alts = expand("transition");
  for (const p of ["reducer", "stairnose", "threshold", "end cap"]) {
    assert.ok(alts.includes(p), `expected "${p}" in transition synonyms`);
  }
});

test("acronyms reach their full trade term", () => {
  assert.ok(expand("sbn").includes("bullnose"));
  assert.ok(expand("lvp").includes("vinyl plank"));
});

test("every synonym list contains its own key so lookups are stable", () => {
  for (const [key, alts] of Object.entries(SYNONYMS)) {
    assert.ok(Array.isArray(alts) && alts.length > 0, `${key} has no synonyms`);
  }
});
