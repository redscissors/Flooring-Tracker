import test from "node:test";
import assert from "node:assert/strict";
import { isSpecialOrder, orderCopyText, orderDescription, nameBudget, tightSize } from "./orderentry.js";
import { lineItems, multiWidthLineItems, defaultConfig } from "./sheoga.js";

const floor = (over = {}) => ({ ...defaultConfig("floor"), sp: "White Oak", w: 5.25, ...over });

test("isSpecialOrder: a price-book order item is special, a stock SKU is not", () => {
  assert.equal(isSpecialOrder({ bookId: "bkVTC", sku: "ANA-1224" }), true);
  assert.equal(isSpecialOrder({ bookId: "", sku: "SCH-DIL-8MM" }), false);
  assert.equal(isSpecialOrder({}), false);
});

test("isSpecialOrder: a stock-kind book's row files as stock despite its bookId", () => {
  const stockBookIds = new Set(["bkDOIT"]);
  assert.equal(isSpecialOrder({ bookId: "bkDOIT", sku: "05153" }, stockBookIds), false);
  assert.equal(isSpecialOrder({ bookId: "bkVTC", sku: "ANA-1224" }, stockBookIds), true);
  assert.equal(isSpecialOrder({ bookId: "bkDOIT", sku: "", sheoga: { mode: "floor" } }, stockBookIds), true);
});

test("isSpecialOrder: a wedi line splits on its SKU — stocked keys as stock, the rest by description", () => {
  const stockBookIds = new Set(["bkWEDI"]);
  // special order: wedi's pricelist item, no shop code — the description leads
  // with the US-SKU instead
  assert.equal(isSpecialOrder({ wedi: { part: true }, sku: "" }), true);
  assert.equal(isSpecialOrder({ wedi: { mode: "custom", cfg: {} }, sku: "" }), true);
  // stocked: the shop's own ERP code, so it keys SKU ⇥ qty like any stock line
  assert.equal(isSpecialOrder({ wedi: { part: true }, sku: "05153" }), false);
  assert.equal(isSpecialOrder({ wedi: { part: true }, sku: "05153", bookId: "bkWEDI" }, stockBookIds), false);
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

test("orderDescription: with no limit the line flows unit · size · product · SKU · coverage", () => {
  const d = orderDescription(book, 0);
  assert.equal(d.tier, "full");
  assert.equal(d.main, 'CT 12"x24" Anatolia Carrara Bianco ANA-CAR-1224 15.5 SF/CT');
  assert.equal(d.ext, null);
});

test("orderDescription: the unit tag leads and never drops — the ERP keys every line as each", () => {
  // A carton line whose text doesn't say CT is an order for 20 tiles.
  for (const limit of [0, 58, 50, 24, 12]) {
    assert.ok(orderDescription(book, limit).main.startsWith("CT "), `lost the tag at ${limit}`);
  }
  // Pieces need no tag, and a row without one gets no stray leading space.
  assert.equal(orderDescription({ ...book, tag: "" }, 0).main.startsWith("1"), true);
});

test("tightSize: a dimension is one token, and only between digits", () => {
  assert.equal(tightSize('12" × 24"'), '12"x24"');
  assert.equal(tightSize('2" x 18"'), '2"x18"');
  assert.equal(tightSize("6 X 36"), "6x36");
  assert.equal(tightSize("2 x 10 x 5/8"), "2x10x5/8");
  assert.equal(tightSize("Hex Tile"), "Hex Tile", "a word carrying an x keeps its spaces");
  assert.equal(tightSize(""), "");
});

test("orderDescription: the copy button carries the description field, nothing else", () => {
  const r = { ...book, desc: orderDescription(book, 0), qty: 20, qtyText: "20 CT" };
  const copied = orderCopyText(r);
  assert.equal(copied, r.desc.main);
  assert.ok(!copied.includes("20 CT"), "quantity is its own ERP field");
});

test("orderDescription: a Sheoga row abbreviates from its configuration, dropping the vendor prefix", () => {
  const d = orderDescription(sheogaRow(floorCfg), 30);
  assert.equal(d.tier, "short");
  // 3 spare chars after abbreviating: species and grade overrun, Solid fits.
  assert.equal(d.main, 'CT 5¼" WO Char Solid T-1 30sh');
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

test("orderDescription: SKU and coverage trail — coverage drops first, then the SKU", () => {
  assert.ok(orderDescription(book, 60).main.endsWith("ANA-CAR-1224 15.5 SF/CT"));
  const mid = orderDescription(book, 50);
  assert.equal(mid.tier, "split");
  assert.ok(mid.main.includes("ANA-CAR-1224"), "the SKU survives while there's room");
  assert.ok(!mid.main.includes("15.5 SF/CT"), "coverage is the least identifying, first to go");
  const tight = orderDescription(book, 24);
  assert.equal(tight.tier, "split");
  assert.ok(!tight.main.includes("ANA-CAR-1224"), "a SKU is an item code, not a description");
  assert.ok(tight.ext.includes("ANA-CAR-1224"), "but it is never lost");
  assert.ok(tight.ext.includes("15.5 SF/CT"), "and neither is coverage");
});

test("nameBudget: what the limit leaves the product text after the tag, size, SKU and coverage", () => {
  // tag 2 + size 7 + SKU 12 + coverage 10, each costing one joining space = 35
  assert.equal(nameBudget(book, 70), 35);
  // "Anatolia Carrara Bianco" is 23 chars: at limit 58 the whole flow fits exactly
  assert.equal(nameBudget(book, 58), "Anatolia Carrara Bianco".length);
  assert.equal(nameBudget(book, 0), Infinity, "no limit configured — nothing to trim against");
  assert.equal(nameBudget({ sizePlain: "", sku: "", coverage: "" }, 30), 30);
  assert.equal(nameBudget({ sizePlain: "0.5x10", sku: "WOWPOWIEDGEG", coverage: "10 PC/CT" }, 20), 0, "never negative");
});

test("orderDescription: a fee line has no structured parts and falls back to its text", () => {
  const fee = { tag: "", sizePlain: "", name: "Sheoga — Small-order fee — prefinished job under 250 sf", sku: "", sheoga: { fee: true } };
  assert.equal(orderDescription(fee, 0).main, "Small-order fee — prefinished job under 250 sf");
  const d = orderDescription(fee, 30);
  assert.equal(d.tier, "split");
  assert.ok(d.main.endsWith("+"));
});

// --- book brand label on the fit ladder (the Glazzio ask, 2026-08-18) ---------

const glazzio = { tag: "CT", sizePlain: "2x8", name: "Glazzio Crystal Ice Blue", brand: "Glazzio", sku: "GLZ-CI28", coverage: "5.4 SF/CT" };

test("orderDescription: the brand stays in place while there's room — paste matches screen", () => {
  const d = orderDescription(glazzio, 0);
  assert.equal(d.main, "CT 2x8 Glazzio Crystal Ice Blue GLZ-CI28 5.4 SF/CT");
  assert.equal(d.tier, "full");
});

test("orderDescription: the brand is the first thing dropped when the field runs tight", () => {
  const d = orderDescription(glazzio, 48); // full is 50 — over by just the brand
  assert.equal(d.tier, "split");
  assert.ok(!d.main.includes("Glazzio"), "the brand is the least identifying part");
  assert.ok(d.main.includes("GLZ-CI28"), "the SKU outlives the brand");
  assert.ok(d.main.includes("5.4 SF/CT"), "so does coverage");
  assert.ok(d.ext.includes("Glazzio"), "the extended text keeps the whole line");
});

test("orderDescription: a name that doesn't lead with the brand passes through untouched", () => {
  const edited = { ...glazzio, name: "Crystal Ice Blue" }; // salesperson dropped it by hand
  assert.equal(orderDescription(edited, 0).main, "CT 2x8 Crystal Ice Blue GLZ-CI28 5.4 SF/CT");
  const partial = { ...glazzio, name: "Glazzioish Crystal" }; // whole word only
  assert.ok(orderDescription(partial, 0).main.includes("Glazzioish Crystal"));
  assert.equal(orderDescription(partial, 30).ext, orderDescription(partial, 30).full);
});
