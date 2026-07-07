import { test } from "node:test";
import assert from "node:assert/strict";
import { normName, editDist, matchName } from "./names.js";

test("normName collapses case, spaces, and punctuation", () => {
  assert.equal(normName("P & L"), "pl");
  assert.equal(normName("P&L"), "pl");
  assert.equal(normName("p&l."), "pl");
  assert.equal(normName("  Sarah  Jones  "), "sarahjones");
  assert.equal(normName(null), "");
});

test("editDist is symmetric and zero for equal keys", () => {
  assert.equal(editDist("Sarah Jones", "sarah jones"), 0);
  assert.equal(editDist("Sara Jones", "Sarah Jones"), 1);
  assert.equal(editDist("abc", ""), 3);
});

test("matchName flags an exact duplicate ignoring case and spacing", () => {
  const people = [{ id: "1", name: "Sarah Jones" }];
  const m = matchName(people, "  sarah   jones ");
  assert.equal(m?.kind, "exact");
  assert.equal(m.item.id, "1");
});

test("the P&L problem: 'P & L' matches existing 'P&L Construction'", () => {
  const builders = [{ id: "b1", name: "P&L Construction" }, { id: "b2", name: "Horizon Homes" }];
  const m = matchName(builders, "P & L");
  assert.ok(m, "expected a match");
  assert.equal(m.item.id, "b1");
});

test("matchName suggests a near-miss as 'similar' (Sara vs Sarah)", () => {
  const people = [{ id: "1", name: "Sarah Jones" }];
  const m = matchName(people, "Sara Jones");
  assert.equal(m?.kind, "similar");
  assert.equal(m.item.id, "1");
});

test("matchName returns null for a genuinely different name", () => {
  const people = [{ id: "1", name: "Sarah Jones" }, { id: "2", name: "Mike Chen" }];
  assert.equal(matchName(people, "Aisha Okafor"), null);
});

test("matchName ignores one-character noise (too little signal)", () => {
  assert.equal(matchName([{ id: "1", name: "A" }], "B"), null);
});

test("matchName is safe on an empty list", () => {
  assert.equal(matchName([], "Anyone"), null);
  assert.equal(matchName(undefined, "Anyone"), null);
});
