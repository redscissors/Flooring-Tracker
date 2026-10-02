import test from "node:test";
import assert from "node:assert/strict";
import { vendorBookFor, vendorBookForRow, vendorBookSeed, sheogaMarkups, normVendorMarkups, trimBookOf, sheetMonth, sheetDateMDY } from "./vendorbook.js";
import * as vb from "./vendorbook.js";

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
  assert.deepEqual(s.data, { engine: "sheoga", brandLabel: "Sheoga Hardwood", markups: { flooring: 35, vents: 60, trim: 100 } });
  assert.deepEqual(vendorBookSeed("sheoga", {}).data.markups, { flooring: 40, vents: 50, trim: 100 });
  assert.equal(vendorBookSeed("sheoga", {}).data.markups.trim, 100);
  assert.equal(vendorBookSeed("nope", SETTINGS), null);
});

test("sheogaMarkups: the book wins when it exists, Settings is the fallback", () => {
  assert.deepEqual(sheogaMarkups(BOOKS, SETTINGS), { markupPct: 45, ventMarkupPct: 55, trimMarkupPct: 100, book: SHEOGA });
  assert.deepEqual(sheogaMarkups([BOOKS[0]], SETTINGS), { markupPct: 35, ventMarkupPct: 60, trimMarkupPct: 100, book: null });
  const blank = { ...SHEOGA, data: { engine: "sheoga", markups: { flooring: "", vents: "abc" } } };
  assert.deepEqual(sheogaMarkups([blank], SETTINGS), { markupPct: 40, ventMarkupPct: 50, trimMarkupPct: 100, book: blank });
});

test("normVendorMarkups fills defaults and rejects negatives", () => {
  assert.deepEqual(normVendorMarkups(undefined), { flooring: 40, vents: 50, trim: 100 });
  assert.deepEqual(normVendorMarkups({ flooring: "30", vents: -5 }), { flooring: 30, vents: 50, trim: 100 });
  assert.equal(normVendorMarkups({ flooring: 40, vents: 50 }).trim, 100);
  assert.equal(normVendorMarkups({ trim: 80 }).trim, 80);
});

test("sheogaMarkups carries the trim markup: 100 by default, the book's when set", () => {
  assert.equal(sheogaMarkups([], {}).trimMarkupPct, 100);
  const withTrim = { ...SHEOGA, data: { ...SHEOGA.data, markups: { ...SHEOGA.data.markups, trim: 120 } } };
  assert.equal(sheogaMarkups([withTrim], {}).trimMarkupPct, 120);
});

test("trimBookOf is null without a book or a usable sheet, else the sheet", () => {
  assert.equal(trimBookOf([]), null);
  assert.equal(trimBookOf([BOOKS[0]]), null);
  assert.equal(trimBookOf([SHEOGA]), null);
  const S = { sheetDate: "2026-10-01", species: {}, prefin: {}, tex: {}, slip: { perLf: 0.4, bundleLf: 50 } };
  const withSheet = (sheet) => [{ ...SHEOGA, data: { ...SHEOGA.data, sheets: { accessories: sheet } } }];
  assert.deepEqual(trimBookOf(withSheet(S)), { sheet: S });
  for (const k of ["species", "prefin", "slip"]) {
    const { [k]: _, ...missing } = S;
    assert.equal(trimBookOf(withSheet(missing)), null, `no ${k}`);
    assert.equal(trimBookOf(withSheet({ ...S, [k]: "junk" })), null, `${k} not an object`);
  }
  assert.equal(trimBookOf(withSheet("junk")), null);
});

test("normTrimTexture is gone: texture comes only from the sheet", () => {
  assert.equal(typeof vb.normTrimTexture, "undefined");
});

test("sheetMonth / sheetDateMDY format an accessory sheetDate", () => {
  assert.equal(sheetMonth("2026-10-01"), "Oct ’26");
  assert.equal(sheetMonth("2025-01-15"), "Jan ’25");
  assert.equal(sheetDateMDY("2026-10-01"), "10/1/26");
  assert.equal(sheetDateMDY("2026-07-22"), "7/22/26");
  for (const bad of ["", null, undefined, "10/01/2026"]) {
    assert.equal(sheetMonth(bad), "");
    assert.equal(sheetDateMDY(bad), "");
  }
});
