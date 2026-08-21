import test from "node:test";
import assert from "node:assert/strict";
import { newArea, newProduct } from "./model.js";
import { OPTION_SLOTS, OPTION_COLOR, optionsUsed, hasOptions, bucketCats, scopedCats, optionTitle, optionShort, normOptionNames, duplicateInto, compareOptionsPatch } from "./options.js";

const area = (option, id = "x") => ({ id, name: "n" + id, option, products: [{ id: "p" + id, sku: "S" + id }] });

test("slots and colors are fixed", () => {
  assert.deepEqual(OPTION_SLOTS, ["A", "B", "C", "D", "E", "F"]);
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
  assert.deepEqual(normOptionNames({ D: "Marble", F: " LVP " }), { D: "Marble", F: "LVP" });
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

// --- compareOptionsPatch (phase 5 task 2) -----------------------------------

const wediLine = { sku: "US2000032", brandColor: "wedi pan", priceSqft: "120", wedi: { mode: "kit", cfg: { pan: "US2000032" } } };
const schluterLine = { sku: "KST965/1525", brandColor: "Schluter tray", priceSqft: "140", schluter: { mode: "kit", cfg: { w: 60, d: 38 } } };

const hostProject = (extra = {}) => {
  const before = newArea();
  const host = { ...newArea(), name: "Master Bath" };
  const after = newArea();
  return { categories: [before, host, after], optionNames: {}, ...extra };
};

test("compareOptionsPatch returns { categories, optionNames } for a real host", () => {
  const proj = hostProject();
  const host = proj.categories[1];
  const patch = compareOptionsPatch(proj, host.id, { wediLines: [wediLine], schluterLines: [schluterLine], label: "" });
  assert.deepEqual(Object.keys(patch).sort(), ["categories", "optionNames"]);
});

test("inserts the wedi/Schluter areas immediately after the host area", () => {
  const proj = hostProject();
  const [before, host, after] = proj.categories;
  const patch = compareOptionsPatch(proj, host.id, { wediLines: [wediLine], schluterLines: [schluterLine] });
  assert.equal(patch.categories.length, 5);
  assert.equal(patch.categories[0].id, before.id);
  assert.equal(patch.categories[1].id, host.id);
  assert.equal(patch.categories[2].name, "Master Bath — wedi");
  assert.equal(patch.categories[2].option, "A");
  assert.equal(patch.categories[3].name, "Master Bath — Schluter");
  assert.equal(patch.categories[3].option, "B");
  assert.equal(patch.categories[4].id, after.id);
});

test("appends both areas at the end when the host id is gone", () => {
  const proj = hostProject();
  const patch = compareOptionsPatch(proj, "not-a-real-id", { wediLines: [wediLine], schluterLines: [schluterLine], label: "Hall Bath" });
  assert.equal(patch.categories.length, 5);
  const [wedi, sch] = patch.categories.slice(-2);
  assert.equal(wedi.name, "Hall Bath — wedi");
  assert.equal(sch.name, "Hall Bath — Schluter");
});

test("uses the label when given, else the host area's name, else Shower", () => {
  const proj = hostProject();
  const host = proj.categories[1];
  const labeled = compareOptionsPatch(proj, host.id, { wediLines: [wediLine], schluterLines: [schluterLine], label: "Guest Shower" });
  assert.equal(labeled.categories[2].name, "Guest Shower — wedi");

  const unlabeled = compareOptionsPatch(proj, host.id, { wediLines: [wediLine], schluterLines: [schluterLine] });
  assert.equal(unlabeled.categories[2].name, "Master Bath — wedi");

  const namelessHost = { ...newArea(), name: "" };
  const proj2 = { categories: [namelessHost], optionNames: {} };
  const noName = compareOptionsPatch(proj2, namelessHost.id, { wediLines: [wediLine], schluterLines: [schluterLine] });
  assert.equal(noName.categories[1].name, "Shower — wedi");
});

test("each area's products are the mapped lines plus one trailing blank adder row", () => {
  const proj = hostProject();
  const host = proj.categories[1];
  const patch = compareOptionsPatch(proj, host.id, { wediLines: [wediLine, { sku: "extra" }], schluterLines: [schluterLine] });
  const wediArea = patch.categories[2];
  assert.equal(wediArea.products.length, 3);
  assert.equal(wediArea.products[0].sku, "US2000032");
  assert.equal(wediArea.products[1].sku, "extra");
  const blank = wediArea.products[2];
  assert.equal(blank.sku, "");
  assert.equal(blank.brandColor, "");
  assert.equal(blank.type, "tile");

  const schArea = patch.categories[3];
  assert.equal(schArea.products.length, 2);
  assert.equal(schArea.products[0].sku, "KST965/1525");
  assert.equal(schArea.products[1].sku, "");
});

test("row 0 of each area keeps its anchor marker", () => {
  const proj = hostProject();
  const host = proj.categories[1];
  const patch = compareOptionsPatch(proj, host.id, { wediLines: [wediLine], schluterLines: [schluterLine] });
  assert.deepEqual(patch.categories[2].products[0].wedi, { mode: "kit", cfg: { pan: "US2000032" } });
  assert.deepEqual(patch.categories[3].products[0].schluter, { mode: "kit", cfg: { w: 60, d: 38 } });
});

test("every mapped product still carries the full newProduct shape", () => {
  const proj = hostProject();
  const host = proj.categories[1];
  const patch = compareOptionsPatch(proj, host.id, { wediLines: [wediLine], schluterLines: [schluterLine] });
  const p = patch.categories[2].products[0];
  assert.equal(p.qtyType, "sqft");
  assert.deepEqual(p.grout.checked, false);
  assert.ok(p.id);
});

test("optionNames fills only empty A/B slots, never overwrites a custom name", () => {
  const proj = hostProject({ optionNames: { A: "Premium package" } });
  const host = proj.categories[1];
  const patch = compareOptionsPatch(proj, host.id, { wediLines: [wediLine], schluterLines: [schluterLine] });
  assert.deepEqual(patch.optionNames, { A: "Premium package", B: "Schluter" });
});

test("optionNames fills both slots when the project has none yet", () => {
  const proj = hostProject();
  const host = proj.categories[1];
  const patch = compareOptionsPatch(proj, host.id, { wediLines: [wediLine], schluterLines: [schluterLine] });
  assert.deepEqual(patch.optionNames, { A: "wedi", B: "Schluter" });
});

test("optionNames preserves other custom slot names untouched", () => {
  const proj = hostProject({ optionNames: { C: "Budget" } });
  const host = proj.categories[1];
  const patch = compareOptionsPatch(proj, host.id, { wediLines: [wediLine], schluterLines: [schluterLine] });
  assert.deepEqual(patch.optionNames, { A: "wedi", B: "Schluter", C: "Budget" });
});

test("returns null when wediLines is empty", () => {
  const proj = hostProject();
  const host = proj.categories[1];
  assert.equal(compareOptionsPatch(proj, host.id, { wediLines: [], schluterLines: [schluterLine] }), null);
});

test("returns null when schluterLines is empty", () => {
  const proj = hostProject();
  const host = proj.categories[1];
  assert.equal(compareOptionsPatch(proj, host.id, { wediLines: [wediLine], schluterLines: [] }), null);
});

test("returns null when both lines arrays are empty", () => {
  const proj = hostProject();
  const host = proj.categories[1];
  assert.equal(compareOptionsPatch(proj, host.id, { wediLines: [], schluterLines: [] }), null);
});
