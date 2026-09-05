import test from "node:test";
import assert from "node:assert/strict";
import { vendorBookFor, vendorBookForRow, vendorBookSeed, sheogaMarkups, normVendorMarkups } from "./vendorbook.js";

const SHEOGA = { id: "vb1", kind: "vendor", name: "Sheoga Hardwood", data: { engine: "sheoga", markups: { flooring: 45, vents: 55 } } };
const BOOKS = [{ id: "b1", kind: "order", name: "Glazzio", data: {} }, SHEOGA];
const SETTINGS = { pricing: { sheogaMarkupPct: 35, sheogaVentMarkupPct: 60 } };

test("vendorBookFor finds the vendor book by engine, never an order book", () => {
  assert.equal(vendorBookFor(BOOKS, "sheoga"), SHEOGA);
  assert.equal(vendorBookFor(BOOKS, "wedi"), null);
  assert.equal(vendorBookFor([{ id: "x", kind: "order", data: { engine: "sheoga" } }], "sheoga"), null);
  assert.equal(vendorBookFor(undefined, "sheoga"), null);
});

test("vendorBookForRow: a sheoga-marked row resolves to the Sheoga book, others to nothing", () => {
  assert.equal(vendorBookForRow({ sheoga: { mode: "floor", cfg: {} } }, BOOKS), SHEOGA);
  assert.equal(vendorBookForRow({ sku: "ABC" }, BOOKS), null);
  assert.equal(vendorBookForRow({ sheoga: { mode: "floor" } }, [BOOKS[0]]), null);
});

test("vendorBookSeed copies the Settings markups so nothing reprices on creation", () => {
  const s = vendorBookSeed("sheoga", SETTINGS);
  assert.equal(s.name, "Sheoga Hardwood");
  assert.deepEqual(s.data, { engine: "sheoga", brandLabel: "Sheoga Hardwood", markups: { flooring: 35, vents: 60 } });
  assert.deepEqual(vendorBookSeed("sheoga", {}).data.markups, { flooring: 40, vents: 50 });
  assert.equal(vendorBookSeed("nope", SETTINGS), null);
});

test("sheogaMarkups: the book wins when it exists, Settings is the fallback", () => {
  assert.deepEqual(sheogaMarkups(BOOKS, SETTINGS), { markupPct: 45, ventMarkupPct: 55, book: SHEOGA });
  assert.deepEqual(sheogaMarkups([BOOKS[0]], SETTINGS), { markupPct: 35, ventMarkupPct: 60, book: null });
  const blank = { ...SHEOGA, data: { engine: "sheoga", markups: { flooring: "", vents: "abc" } } };
  assert.deepEqual(sheogaMarkups([blank], SETTINGS), { markupPct: 40, ventMarkupPct: 50, book: blank });
});

test("normVendorMarkups fills defaults and rejects negatives", () => {
  assert.deepEqual(normVendorMarkups(undefined), { flooring: 40, vents: 50 });
  assert.deepEqual(normVendorMarkups({ flooring: "30", vents: -5 }), { flooring: 30, vents: 50 });
});
