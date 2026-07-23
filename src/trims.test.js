import test from "node:test";
import assert from "node:assert/strict";
import { existingTrimRows, seedTrimPlan, applyTrimPlan, preferStockTrims, vendorCodeCandidates, vendorKeys } from "./trims.js";

const trim = (sku, over = {}) => ({ sku, bookId: "b1", trim: true, ...over });
const row = (id, over = {}) => ({ id, sku: "", bookId: "", qty: "", ...over });

const floor = row("f", { sku: "APX020", bookId: "b1", type: "vinyl", qty: "200" });
const trims = [trim("384421"), trim("384469")];

test("existingTrimRows: matches by SKU, skips the floor, first match wins", () => {
  const dup = row("t1b", { sku: "384421", bookId: "b1", qty: "9" });
  const t1 = row("t1", { sku: "384421", bookId: "b1", qty: "2" });
  const rows = existingTrimRows([floor, t1, dup], "f", trims);
  assert.equal(rows.get("384421").id, "t1");
  assert.equal(rows.has("384469"), false);
});

test("existingTrimRows: a line added from the other space still seeds (SKU, not bookId)", () => {
  // The trim went on as a stock line; the popup lists its special-order twin
  // (or vice versa) — same vendor SKU is the same product (mergeSearch rule).
  const stockLine = row("s1", { sku: "384421", bookId: "stock1", qty: "3" });
  const rows = existingTrimRows([floor, stockLine], "f", trims);
  assert.equal(rows.get("384421").id, "s1");
});

test("existingTrimRows: bookId-less rows never match — a hand-typed row isn't a book line", () => {
  const hand = row("h1", { sku: "384421", qty: "3" });
  assert.equal(existingTrimRows([floor, hand], "f", trims).size, 0);
});

test("existingTrimRows: a swapped stock trim seeds lines added under either code", () => {
  const swapped = { sku: "RSKU0417", orderSku: "384421", bookId: "stock-manmi", trim: true };
  const asOrder = row("o1", { sku: "384421", bookId: "order1", qty: "2" });
  const asStock = row("s1", { sku: "RSKU0417", bookId: "stock-manmi", qty: "4" });
  assert.equal(existingTrimRows([floor, asOrder], "f", [swapped]).get("RSKU0417").id, "o1");
  assert.equal(existingTrimRows([floor, asStock], "f", [swapped]).get("RSKU0417").id, "s1");
});

test("seedTrimPlan: on-job quantities seed, the rest start at 0", () => {
  const t1 = row("t1", { sku: "384421", bookId: "b1", qty: "3" });
  assert.deepEqual(seedTrimPlan([floor, t1], floor, trims), [
    { sku: "384421", rowId: "t1", qty: 3 },
    { sku: "384469", rowId: null, qty: 0 },
  ]);
});

test("applyTrimPlan: new picks land directly below the floor, in order", () => {
  const tail = row("z");
  const out = applyTrimPlan([floor, tail], "f", [
    { rowId: null, qty: 2, row: row("n1", { sku: "384421", qty: "2" }) },
    { rowId: null, qty: 1, row: row("n2", { sku: "384469", qty: "1" }) },
  ]);
  assert.deepEqual(out.map((p) => p.id), ["f", "n1", "n2", "z"]);
});

test("applyTrimPlan: new picks group after the floor's existing trim rows", () => {
  const t1 = row("t1", { sku: "384421", bookId: "b1", qty: "2" });
  const tail = row("z");
  const out = applyTrimPlan([floor, t1, tail], "f", [
    { rowId: "t1", qty: 2, row: null },
    { rowId: null, qty: 1, row: row("n2", { sku: "384469", qty: "1" }) },
  ]);
  assert.deepEqual(out.map((p) => p.id), ["f", "t1", "n2", "z"]);
});

test("applyTrimPlan: a quantity change touches qty only — hand edits survive", () => {
  const t1 = row("t1", { sku: "384421", bookId: "b1", qty: "2", priceSqft: "19.99", note: "hand-set" });
  const out = applyTrimPlan([floor, t1], "f", [{ rowId: "t1", qty: 5, row: null }]);
  assert.deepEqual(out[1], { ...t1, qty: "5" });
});

test("applyTrimPlan: an unchanged quantity keeps the identical row object", () => {
  const t1 = row("t1", { sku: "384421", bookId: "b1", qty: "2" });
  const out = applyTrimPlan([floor, t1], "f", [{ rowId: "t1", qty: 2, row: null }]);
  assert.equal(out[1], t1);
});

test("applyTrimPlan: clearing a seeded line to 0 removes it", () => {
  const t1 = row("t1", { sku: "384421", bookId: "b1", qty: "2" });
  const tail = row("z");
  const out = applyTrimPlan([floor, t1, tail], "f", [{ rowId: "t1", qty: 0, row: null }]);
  assert.deepEqual(out.map((p) => p.id), ["f", "z"]);
});

test("applyTrimPlan: a 0-qty new pick never inserts; a missing floor is a no-op", () => {
  const list = [floor];
  assert.equal(applyTrimPlan(list, "f", [{ rowId: null, qty: 0, row: row("n1") }]).length, 1);
  assert.equal(applyTrimPlan(list, "gone", [{ rowId: null, qty: 2, row: row("n1") }]), list);
});

test("vendorCodeCandidates: the manufacturer's code at the tail of an ERP description", () => {
  assert.deepEqual(vendorCodeCandidates("MANN ADURA NOBLE OAK ACORN REDUCER 384421"), ["384421"]);
  assert.deepEqual(vendorCodeCandidates("Adura Max Noble Oak Acorn APX020"), ["APX020"]);
  // A trailing size or wordy tail is not a code; punctuation is shed.
  assert.deepEqual(vendorCodeCandidates("NOBLE OAK PLANK 6X48"), []);
  // Punctuation is shed either side of the code.
  assert.deepEqual(vendorCodeCandidates("QUARTER ROUND (384533)"), ["384533"]);
  assert.deepEqual(vendorCodeCandidates("QUARTER ROUND 384533."), ["384533"]);
  assert.deepEqual(vendorCodeCandidates(""), []);
});

test("preferStockTrims: an exact-SKU live stock item outranks the special-order twin", () => {
  const order = { sku: "384421", bookId: "order1", trim: true, fits: ["APX020"], price: 42.16 };
  const stock = { sku: "384421", bookId: "stock1", stockKind: true, price: 39.99, active: true };
  const out = preferStockTrims([order, trim("384469")], [stock]);
  assert.deepEqual(out[0], { ...stock, trim: true, fits: ["APX020"] });
  assert.equal(out[1].sku, "384469"); // no twin — the special-order item stays
});

test("preferStockTrims: a stock item matches by its sheet's manufacturer-code column", () => {
  // The ERP keys the trim under the shop's own code (1518216); the Mannington
  // catalog # rides in the Supplier/Mfg Product Code columns → vendorSkus.
  const order = { sku: "589571", bookId: "order1", trim: true, fits: ["MPB821"], price: 42.16 };
  const stock = { sku: "1518216", bookId: "stock-manmi", stockKind: true, active: true, price: 46.8, vendorSkus: ["589571"], description: "94\" Mann AduraMax Endcap - Noble Oak Acorn EDM821" };
  const out = preferStockTrims([order], [stock]);
  assert.equal(out[0].sku, "1518216");
  assert.equal(out[0].orderSku, "589571"); // the vendor code, kept for seeding
  assert.equal(out[0].trim, true);
});

test("preferStockTrims: a shop-suffixed code matches its manufacturer base", () => {
  // The team marks an internal variant by suffixing a letter ("589571E") —
  // either side of the pair may carry the suffix.
  const order = { sku: "589571", bookId: "order1", trim: true, fits: [] };
  const suffixed = { sku: "1518216", bookId: "s1", stockKind: true, active: true, vendorSkus: ["589571E"] };
  assert.equal(preferStockTrims([order], [suffixed])[0].sku, "1518216");
  const orderSuffixed = { sku: "589571E", bookId: "order1", trim: true, fits: [] };
  const plain = { sku: "1518216", bookId: "s1", stockKind: true, active: true, vendorSkus: ["589571"] };
  assert.equal(preferStockTrims([orderSuffixed], [plain])[0].sku, "1518216");
});

test("preferStockTrims: description fallback still pairs items imported before the code columns", () => {
  const order = { sku: "384421", bookId: "order1", trim: true, fits: ["APX020"], price: 42.16 };
  const stock = { sku: "RSKU0417", bookId: "stock-manmi", stockKind: true, active: true, price: 39.99, description: "MANN ADURA NOBLE OAK ACORN REDUCER 384421" };
  const out = preferStockTrims([order], [stock]);
  assert.equal(out[0].sku, "RSKU0417");
  assert.equal(out[0].orderSku, "384421");
});

test("vendorKeys: the code columns are authoritative — the description is ignored when they exist", () => {
  // A real MANMI floor: the description carries a sibling color's code
  // (MPB820 = Dry Leaf) while the column has the right one (MPB823 = Bark).
  const bark = { sku: "1517410", vendorSkus: ["MPB823"], description: "7x60 Mannington AduraMax MPB820 Noble Oak Bark 29.53 SF/CT" };
  assert.deepEqual(vendorKeys(bark), ["1517410", "MPB823"]);
  // No columns captured yet (pre-re-import) → the tail fallback.
  const legacy = { sku: "RSKU0417", description: "MANN ADURA NOBLE OAK ACORN REDUCER 384421" };
  assert.deepEqual(vendorKeys(legacy), ["RSKU0417", "384421"]);
  // A suffixed code expands to its base alongside itself.
  const suffixed = { sku: "1518216", vendorSkus: ["589571E"] };
  assert.deepEqual(vendorKeys(suffixed), ["1518216", "589571E", "589571"]);
  assert.deepEqual(vendorKeys(null), []);
});

test("preferStockTrims: retired/disabled/discontinued stock never swaps in", () => {
  const order = { sku: "384421", bookId: "order1", trim: true, fits: [] };
  for (const dead of [{ active: false }, { disabled: true }, { discontinued: true }]) {
    const out = preferStockTrims([order], [{ sku: "384421", bookId: "stock1", ...dead }]);
    assert.equal(out[0].bookId, "order1");
  }
});

test("preferStockTrims: no stock cache yet → the list passes through untouched", () => {
  const list = [trim("384421")];
  assert.equal(preferStockTrims(list, []), list);
});
