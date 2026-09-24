import test from "node:test";
import assert from "node:assert/strict";
import { flatten, moveIndex, edgeIndex, typeahead, placeMorph } from "./dropdown.js";

const it3 = [{ v: "a", label: "Alpha" }, { v: "b", label: "Beta", disabled: true }, { v: "c", label: "Charcoal" }];

test("flatten passes options through and indexes group headings", () => {
  assert.deepEqual(flatten({ options: it3 }), { items: it3, heads: [] });
  const g = flatten({ groups: [{ label: "In stock", items: [it3[0]] }, { label: "Empty", items: [] }, { label: "Special order", items: [it3[2]] }] });
  assert.deepEqual(g.items, [it3[0], it3[2]]);
  assert.deepEqual(g.heads, [{ label: "In stock", at: 0 }, { label: "Special order", at: 1 }]);
});

test("moveIndex skips disabled rows and wraps both ways", () => {
  assert.equal(moveIndex(it3, 0, 1), 2);
  assert.equal(moveIndex(it3, 2, 1), 0);
  assert.equal(moveIndex(it3, 0, -1), 2);
  assert.equal(moveIndex(it3, -1, 1), 0);
  assert.equal(moveIndex(it3, -1, -1), 2);
  assert.equal(moveIndex([], -1, 1), -1);
  assert.equal(moveIndex([{ v: 1, label: "x", disabled: true }], -1, 1), -1);
});

test("edgeIndex finds the first and last usable rows", () => {
  const rows = [{ v: 0, label: "z", disabled: true }, ...it3, { v: "d", label: "Dim", disabled: true }];
  assert.equal(edgeIndex(rows, "first"), 1);
  assert.equal(edgeIndex(rows, "last"), 3);
});

test("typeahead jumps to the next label starting with the letter, cycling", () => {
  const rows = [{ v: 1, label: "Frost" }, { v: 2, label: "Fawn" }, { v: 3, label: "Bone" }, { v: 4, label: "fresh cut", disabled: true }];
  assert.equal(typeahead(rows, -1, "f"), 0);
  assert.equal(typeahead(rows, 0, "F"), 1);
  assert.equal(typeahead(rows, 1, "f"), 0);
  assert.equal(typeahead(rows, 0, "b"), 2);
  assert.equal(typeahead(rows, 0, "q"), -1);
  assert.equal(typeahead(rows, 0, ""), -1);
});

const rect = (top, left, w = 120, h = 28) => ({ top, left, right: left + w, bottom: top + h, width: w, height: h });

test("placeMorph opens downward over the trigger when there is room", () => {
  const p = placeMorph({ rect: rect(100, 40), vw: 1200, vh: 800 });
  assert.equal(p.up, false);
  assert.equal(p.top, 100);
  assert.equal(p.left, 40);
  assert.equal(p.maxList, 800 - 100 - 8 - 28);
  assert.equal(p.maxW, 1200 - 40 - 8);
});

test("placeMorph flips upward near the bottom and anchors on the trigger's bottom", () => {
  const p = placeMorph({ rect: rect(740, 40), vw: 1200, vh: 800, want: 300 });
  assert.equal(p.up, true);
  assert.equal(p.bottom, 800 - 768);
  assert.equal(p.maxList, 768 - 8 - 28);
});

test("placeMorph right-aligns and converts screen px into the zoomed box's own px", () => {
  const p = placeMorph({ rect: rect(100, 900, 60, 21), vw: 1000, vh: 800, scale: 0.75, align: "right" });
  assert.equal(p.right, (1000 - 960) / 0.75);
  assert.equal(p.top, 100 / 0.75);
  assert.equal(p.left, undefined);
  assert.equal(p.maxW, Math.floor((960 - 8) / 0.75));
});

test("placeMorph never returns a list shorter than 96px", () => {
  assert.equal(placeMorph({ rect: rect(10, 0, 100, 28), vw: 400, vh: 60 }).maxList, 96);
});
