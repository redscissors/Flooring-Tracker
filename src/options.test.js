import test from "node:test";
import assert from "node:assert/strict";
import { OPTION_SLOTS, OPTION_COLOR, optionsUsed, hasOptions, bucketCats, scopedCats, optionTitle, optionShort, normOptionNames, duplicateInto } from "./options.js";

const area = (option, id = "x") => ({ id, name: "n" + id, option, products: [{ id: "p" + id, sku: "S" + id }] });

test("slots and colors are fixed", () => {
  assert.deepEqual(OPTION_SLOTS, ["A", "B", "C"]);
  for (const s of OPTION_SLOTS) { assert.ok(OPTION_COLOR[s].main); assert.ok(OPTION_COLOR[s].soft); }
});

test("optionsUsed lists slots present, in slot order", () => {
  const cats = [area(""), area("C", "1"), area("A", "2"), area("C", "3")];
  assert.deepEqual(optionsUsed(cats), ["A", "C"]);
  assert.equal(hasOptions(cats), true);
  assert.equal(hasOptions([area(""), area("")]), false);
  assert.deepEqual(optionsUsed([]), []);
});

test("bucketCats: shared is untagged only, a slot is that slot only", () => {
  const cats = [area("", "s1"), area("A", "a1"), area("B", "b1")];
  assert.deepEqual(bucketCats(cats, "shared").map((a) => a.id), ["s1"]);
  assert.deepEqual(bucketCats(cats, "A").map((a) => a.id), ["a1"]);
});

test("scopedCats: slot scope is the union shared + slot; all is everything", () => {
  const cats = [area("", "s1"), area("A", "a1"), area("B", "b1")];
  assert.deepEqual(scopedCats(cats, "A").map((a) => a.id), ["s1", "a1"]);
  assert.deepEqual(scopedCats(cats, "shared").map((a) => a.id), ["s1"]);
  assert.deepEqual(scopedCats(cats, "all").map((a) => a.id), ["s1", "a1", "b1"]);
});

test("titles: custom name or Option letter; short form leads with the letter", () => {
  const proj = { optionNames: { B: "Marble hex" } };
  assert.equal(optionTitle(proj, "B"), "Marble hex");
  assert.equal(optionTitle(proj, "A"), "Option A");
  assert.equal(optionShort(proj, "B"), "B · Marble hex");
  assert.equal(optionShort(proj, "A"), "Option A");
});

test("normOptionNames keeps trimmed non-empty strings on valid slots", () => {
  assert.deepEqual(normOptionNames({ A: " Porcelain ", B: "", Z: "no", C: 3 }), { A: "Porcelain" });
  assert.deepEqual(normOptionNames(null), {});
});

test("duplicateInto: fresh ids top to bottom, tagged slot, source untouched", () => {
  const src = area("", "orig");
  const copy = duplicateInto(src, "B");
  assert.equal(copy.option, "B");
  assert.notEqual(copy.id, src.id);
  assert.notEqual(copy.products[0].id, src.products[0].id);
  assert.equal(copy.products[0].sku, "Sorig");
  assert.equal(src.option, "");
});
