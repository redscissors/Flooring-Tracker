import test from "node:test";
import assert from "node:assert/strict";
import { isSpecialOrder, orderCopyText } from "./orderentry.js";
import { lineItems, multiWidthLineItems, defaultConfig } from "./sheoga.js";

const floor = (over = {}) => ({ ...defaultConfig("floor"), sp: "White Oak", w: 5.25, ...over });

test("isSpecialOrder: a price-book order item is special, a stock SKU is not", () => {
  assert.equal(isSpecialOrder({ bookId: "bkVTC", sku: "ANA-1224" }), true);
  assert.equal(isSpecialOrder({ bookId: "", sku: "SCH-DIL-8MM" }), false);
  assert.equal(isSpecialOrder({}), false);
});

test("isSpecialOrder: every Sheoga line is special — the floor AND its fee lines", () => {
  // Custom colour on a small job drags two fees along; all three must file
  // together under Special order, or the fees strand in Stock as "no SKU".
  const lines = lineItems({ mode: "floor", cfg: floor({ finish: "t1", sample: true }) }, { sf: 200 });
  assert.equal(lines.length, 3);
  for (const l of lines) {
    assert.equal(l.sku, "", "Sheoga sells by description, never a SKU");
    assert.equal(isSpecialOrder(l), true);
  }
});

test("isSpecialOrder: vents, stocked floors and multi-width sets all file as special", () => {
  const vent = lineItems({ mode: "vent", cfg: { ...defaultConfig("vent"), size: "4×12", qty: 6 } }, { sf: 0 });
  assert.ok(vent.length > 0);
  assert.ok(vent.every(isSpecialOrder));

  const multi = multiWidthLineItems(
    { mode: "floor", cfg: floor({ finish: "t1" }) },
    [{ w: 3.25, share: 1 }, { w: 5.25, share: 1 }], 200,
  );
  assert.ok(multi.length > 2, "expected per-width lines plus a pooled fee");
  assert.ok(multi.every(isSpecialOrder));
});

test("a Sheoga fee line is Sheoga-sourced but carries no configuration to reopen", () => {
  const [, fee] = lineItems({ mode: "floor", cfg: floor({ finish: "t1" }) }, { sf: 200 });
  assert.equal(isSpecialOrder(fee), true);
  assert.equal(fee.sheoga.cfg, undefined, "a fee has nothing to reconfigure");
  assert.ok(lineItems({ mode: "floor", cfg: floor() }, { sf: 900 })[0].sheoga.cfg, "the floor does");
});

test("orderCopyText: a SKU line copies tag, size, name, SKU, coverage — no qty", () => {
  const r = {
    tag: "CT", sizePlain: '12" × 24"', name: "Anatolia Carrara Bianco", sku: "ANA-CAR-1224",
    coverage: "15.5 SF/CT", byDesc: false, qty: 20, qtyText: "20 CT",
  };
  assert.equal(orderCopyText(r), 'CT 12" × 24" Anatolia Carrara Bianco ANA-CAR-1224 15.5 SF/CT');
});

test("orderCopyText: a by-description line carries the qty in the SKU's place", () => {
  const r = {
    tag: "CT", sizePlain: '5¼"', name: "Sheoga — White Oak Character Solid", sku: "",
    coverage: "20.5 SF/CT", byDesc: true, qty: 12, qtyText: "12 CT",
  };
  assert.equal(orderCopyText(r), 'CT 5¼" Sheoga — White Oak Character Solid 12 CT 20.5 SF/CT');
});

test("orderCopyText: empty fields collapse, an unquantified line drops the qty", () => {
  const r = { tag: "", sizePlain: "", name: "Sheoga — Small-order fee", sku: "", coverage: "", byDesc: true, qty: 0, qtyText: "—" };
  assert.equal(orderCopyText(r), "Sheoga — Small-order fee");
});
