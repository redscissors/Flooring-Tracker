import { test } from "node:test";
import assert from "node:assert/strict";
import { baseKey, groutBases, resolveGroutBase, rowBaseKey, normGroutMemory, rememberGroutProduct, rememberGroutBase, memoryBaseFor } from "./groutbase.js";

const FULL = { sku: "SLP-FULL", name: "SpectraLock Pro Full Unit", unit: "units", price: 62, cost: 40, per: 1 };
const COMM = { sku: "SLP-COMM", name: "SpectraLock Pro Commercial Unit", unit: "units", price: 218, cost: 150, per: 4 };
const slp = { base: FULL, altBases: [COMM] };

test("baseKey is the sku, else the name", () => {
  assert.equal(baseKey(FULL), "SLP-FULL");
  assert.equal(baseKey({ sku: "", name: "Hand base" }), "Hand base");
  assert.equal(baseKey(null), "");
});

test("groutBases lists the ★ first, then the alternates", () => {
  assert.deepEqual(groutBases(slp).map(baseKey), ["SLP-FULL", "SLP-COMM"]);
  assert.deepEqual(groutBases({ base: null, altBases: [] }), []);
  assert.deepEqual(groutBases(undefined), []);
});

test("resolveGroutBase picks the row's key, falling back to the ★", () => {
  assert.equal(resolveGroutBase(slp, "SLP-COMM"), COMM);
  assert.equal(resolveGroutBase(slp, ""), FULL);
  assert.equal(resolveGroutBase(slp, "GONE"), FULL);
  assert.equal(resolveGroutBase({ base: null, altBases: [] }, "SLP-COMM"), null);
  assert.equal(resolveGroutBase(undefined, ""), null);
});

test("rowBaseKey stores blank for the ★ and the key for an alternate", () => {
  assert.equal(rowBaseKey(slp, "SLP-FULL"), "");
  assert.equal(rowBaseKey(slp, "SLP-COMM"), "SLP-COMM");
  assert.equal(rowBaseKey(slp, "GONE"), "");
});

test("normGroutMemory keeps strings only", () => {
  assert.deepEqual(normGroutMemory(undefined), { product: "", bases: {} });
  assert.deepEqual(normGroutMemory({ product: "SpectraLock Pro", bases: { "SpectraLock Pro": "SLP-COMM", bad: 3 } }), { product: "SpectraLock Pro", bases: { "SpectraLock Pro": "SLP-COMM" } });
  assert.deepEqual(normGroutMemory({ product: 7, bases: "x" }), { product: "", bases: {} });
});

test("remembering a grout type and a base returns a new memory", () => {
  const m0 = normGroutMemory(undefined);
  const m1 = rememberGroutProduct(m0, "SpectraLock Pro");
  assert.equal(m1.product, "SpectraLock Pro");
  assert.equal(m0.product, "");
  const m2 = rememberGroutBase(m1, "SpectraLock Pro", "SLP-COMM");
  assert.deepEqual(m2.bases, { "SpectraLock Pro": "SLP-COMM" });
  // Picking the ★ back is remembered as blank.
  assert.deepEqual(rememberGroutBase(m2, "SpectraLock Pro", "").bases, { "SpectraLock Pro": "" });
});

test("memoryBaseFor returns the remembered key only while it still resolves", () => {
  const m = { product: "SpectraLock Pro", bases: { "SpectraLock Pro": "SLP-COMM", Old: "X" } };
  assert.equal(memoryBaseFor(m, "SpectraLock Pro", slp), "SLP-COMM");
  assert.equal(memoryBaseFor(m, "SpectraLock Pro", { base: FULL, altBases: [] }), "");
  assert.equal(memoryBaseFor(m, "PermaColor Select", slp), "");
  assert.equal(memoryBaseFor(undefined, "SpectraLock Pro", slp), "");
});

import { tickGroutChoice, pickGroutProductChoice, pickGroutBaseChoice } from "./groutbase.js";

const grouts = { "SpectraLock Pro": slp, "PermaColor Select": { base: { sku: "PCS-SND", name: "Sanded", per: 1 }, altBases: [{ sku: "PCS-UNS", name: "Unsanded", per: 1 }] }, Prism: { base: null, altBases: [] } };
const offered = ["Prism", "PermaColor Select", "SpectraLock Pro"];

test("tickGroutChoice starts a fresh row from the project memory, else the catalog default", () => {
  const empty = normGroutMemory(undefined);
  assert.deepEqual(tickGroutChoice({ product: "", base: "" }, offered, empty, "PermaColor Select", grouts), { product: "PermaColor Select", base: "" });
  const mem = { product: "SpectraLock Pro", bases: { "SpectraLock Pro": "SLP-COMM" } };
  assert.deepEqual(tickGroutChoice({ product: "", base: "" }, offered, mem, "PermaColor Select", grouts), { product: "SpectraLock Pro", base: "SLP-COMM" });
  // A remembered grout the catalog no longer offers falls back to the default.
  assert.deepEqual(tickGroutChoice({ product: "", base: "" }, offered, { product: "Gone", bases: {} }, "Prism", grouts), { product: "Prism", base: "" });
  // A row that already names an offered grout keeps it, and its own base.
  assert.deepEqual(tickGroutChoice({ product: "PermaColor Select", base: "PCS-UNS" }, offered, mem, "Prism", grouts), { product: "PermaColor Select", base: "PCS-UNS" });
  assert.deepEqual(tickGroutChoice({ product: "PermaColor Select", base: "" }, offered, { product: "", bases: { "PermaColor Select": "PCS-UNS" } }, "Prism", grouts), { product: "PermaColor Select", base: "PCS-UNS" });
});

test("pickGroutProductChoice takes the base remembered for the new grout and remembers the grout", () => {
  const mem = { product: "SpectraLock Pro", bases: { "PermaColor Select": "PCS-UNS" } };
  const r = pickGroutProductChoice("PermaColor Select", mem, grouts);
  assert.equal(r.base, "PCS-UNS");
  assert.deepEqual(r.memory, { product: "PermaColor Select", bases: { "PermaColor Select": "PCS-UNS" } });
  assert.equal(pickGroutProductChoice("Prism", mem, grouts).base, "");
});

test("pickGroutBaseChoice stores blank for the ★ and remembers the pick per grout", () => {
  const r = pickGroutBaseChoice("SpectraLock Pro", "SLP-COMM", normGroutMemory(undefined), grouts);
  assert.equal(r.base, "SLP-COMM");
  assert.deepEqual(r.memory.bases, { "SpectraLock Pro": "SLP-COMM" });
  const back = pickGroutBaseChoice("SpectraLock Pro", "SLP-FULL", r.memory, grouts);
  assert.equal(back.base, "");
  assert.deepEqual(back.memory.bases, { "SpectraLock Pro": "" });
});

import { baseLabel, baseOptionLabel } from "./groutbase.js";

test("baseLabel reads the kind of base out of a long price-book name", () => {
  assert.equal(baseLabel({ name: "0.8 GAL SPECTRALOCK PRO EPOXY GROUT FULL UNIT PART A&B" }), "Full unit");
  assert.equal(baseLabel({ name: "SpectraLock Comm. Unit" }), "Commercial unit");
  assert.equal(baseLabel({ name: "3.2 GAL SPECTRALOCK PRO COMMERCIAL UNIT" }), "Commercial unit");
  assert.equal(baseLabel({ name: "PermaColor Select Unsanded Base" }), "Unsanded");
  assert.equal(baseLabel({ name: "PermaColor Select Sanded Base" }), "Sanded");
  assert.equal(baseLabel({ name: "Epoxy Part A", sku: "X1" }), "Epoxy Part A");
  assert.equal(baseLabel({ name: "", sku: "X1" }), "X1");
});

test("baseOptionLabel adds the kit ratio and the ★", () => {
  assert.equal(baseOptionLabel({ name: "SpectraLock Comm. Unit", per: 4 }, false), "Commercial unit (1 per 4 kits)");
  assert.equal(baseOptionLabel({ name: "Full Unit", per: 1 }, true), "Full unit ★");
});

import { editBaseAt, starBaseAt, removeBaseAt, addBaseTo } from "./groutbase.js";

test("base list edits: add, edit, star, remove keep a ★ first", () => {
  let g = { base: null, altBases: [] };
  g = { ...g, ...addBaseTo(g, FULL) };
  assert.equal(g.base, FULL);
  g = { ...g, ...addBaseTo(g, COMM) };
  assert.deepEqual(g.altBases, [COMM]);
  g = { ...g, ...editBaseAt(g, 1, { price: 200 }) };
  assert.equal(g.altBases[0].price, 200);
  assert.equal(g.base, FULL);
  g = { ...g, ...editBaseAt(g, 0, { price: 70 }) };
  assert.equal(g.base.price, 70);
  g = { ...g, ...starBaseAt(g, 1) };
  assert.equal(g.base.sku, "SLP-COMM");
  assert.deepEqual(g.altBases.map(baseKey), ["SLP-FULL"]);
  g = { ...g, ...removeBaseAt(g, 0) };
  assert.equal(g.base.sku, "SLP-FULL");
  assert.deepEqual(g.altBases, []);
  g = { ...g, ...removeBaseAt(g, 0) };
  assert.deepEqual(g, { base: null, altBases: [] });
});
