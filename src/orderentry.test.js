import test from "node:test";
import assert from "node:assert/strict";
import { isSpecialOrder, orderCopyText, orderDescription } from "./orderentry.js";
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

const book = { tag: "CT", sizePlain: '12" × 24"', name: "Anatolia Carrara Bianco", sku: "ANA-CAR-1224", coverage: "15.5 SF/CT" };
const sheogaRow = (cfg) => ({ tag: "CT", sizePlain: '5¼"', name: "Sheoga — ignored, parts win", sku: "", sheoga: { mode: "floor", cfg } });
const floorCfg = { ...defaultConfig("floor"), sp: "White Oak", w: 5.25, grade: "char", cons: "solid", finish: "t1" };

test("orderDescription: with no limit the description is the plain full text", () => {
  const d = orderDescription(book, 0);
  assert.equal(d.tier, "full");
  assert.equal(d.main, '12" × 24" Anatolia Carrara Bianco ANA-CAR-1224');
  assert.equal(d.ext, null);
});

test("orderDescription: the copy button carries the description field, nothing else", () => {
  const r = { ...book, desc: orderDescription(book, 0), qty: 20, qtyText: "20 CT" };
  const copied = orderCopyText(r);
  assert.equal(copied, r.desc.main);
  assert.ok(!copied.includes("20 CT"), "quantity is its own ERP field");
  assert.ok(!copied.includes("15.5 SF/CT"), "coverage is not part of a description");
});

test("orderDescription: a Sheoga row abbreviates from its configuration, dropping the vendor prefix", () => {
  const d = orderDescription(sheogaRow(floorCfg), 30);
  assert.equal(d.tier, "short");
  assert.equal(d.main, '5¼" WO Char Sol T-1 30sh');
  assert.ok(!d.main.includes("Sheoga"), "the PO already names the vendor");
  assert.ok(!d.main.includes("ignored"), "structured parts beat the row's name text");
  assert.equal(d.ext, null);
});

test("orderDescription: a long Sheoga build splits, and ext holds every category", () => {
  const cfg = { ...floorCfg, tex: "bandsawn", edge: "pillow", len: "3-10", finish: "est", stain: "Toasted Acorn" };
  const d = orderDescription(sheogaRow(cfg), 30);
  assert.equal(d.tier, "split");
  assert.ok(d.main.endsWith("+"));
  assert.ok(d.main.length <= 30);
  for (const category of ["Band Sawn", "Hand pillowed", "3'–10' lengths", "Toasted Acorn", "30 sheen"]) {
    assert.ok(d.ext.includes(category), `ext lost "${category}"`);
  }
});

test("orderDescription: a SKU trails but is the first thing dropped when tight", () => {
  assert.ok(orderDescription(book, 60).main.endsWith("ANA-CAR-1224"));
  const tight = orderDescription(book, 24);
  assert.equal(tight.tier, "split");
  assert.ok(!tight.main.includes("ANA-CAR-1224"), "a SKU is an item code, not a description");
  assert.ok(tight.ext.includes("ANA-CAR-1224"), "but it is never lost");
});

test("orderDescription: a fee line has no structured parts and falls back to its text", () => {
  const fee = { tag: "", sizePlain: "", name: "Sheoga — Small-order fee — prefinished job under 250 sf", sku: "", sheoga: { fee: true } };
  assert.equal(orderDescription(fee, 0).main, "Small-order fee — prefinished job under 250 sf");
  const d = orderDescription(fee, 30);
  assert.equal(d.tier, "split");
  assert.ok(d.main.endsWith("+"));
});
