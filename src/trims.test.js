import test from "node:test";
import assert from "node:assert/strict";
import { existingTrimRows, seedTrimPlan, applyTrimPlan, preferStockTrims, vendorCodeCandidates, vendorKeys, stockTrimOptions, mergeTrimOptions } from "./trims.js";

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

// --- the stock color-name tier + OneNose companion (2026-07-23) ---------------

const barkFloor = { sku: "1517410", bookId: "manmi", vendorSkus: ["MPB823"], type: "vinyl", active: true, description: "Mannington AduraMax MPB820 Noble Oak Bark" };
const shelf = [
  { sku: "1518224", bookId: "manmi", stockKind: true, active: true, vendorSkus: ["589579"], description: "Mann AduraMax Endcap - Noble Oak Bark EDM823" },
  { sku: "1518227", bookId: "manmi", stockKind: true, active: true, vendorSkus: ["589629"], description: "Mannington OneNose - Noble Oak Bark" },
  { sku: "1518220", bookId: "manmi", stockKind: true, active: true, vendorSkus: ["589575"], description: "Mann AduraMax Endcap - Noble Oak Branch EDM822" }, // sibling color
  { sku: "1519319", bookId: "manmi", stockKind: true, active: true, vendorSkus: ["439199"], description: "OneNose MDF Fill 47in RND001" },
  barkFloor, // the floor itself is never its own trim
];

test("stockTrimOptions: the floor's own book read by color name — sibling colors stay out", () => {
  const out = stockTrimOptions(barkFloor, shelf);
  assert.deepEqual(out.map((t) => t.sku), ["1518224", "1518227"]);
  assert.ok(out.every((t) => t.trim));
});

test("stockTrimOptions: a one-word color phrase is too weak to match on", () => {
  const dewFloor = { sku: "f", bookId: "b", active: true, description: "Mann Riverwalk - Dew" };
  const trim = { sku: "t", bookId: "b", active: true, description: "Mann Reducer - Dew" };
  assert.deepEqual(stockTrimOptions(dewFloor, [trim]), []);
});

test("mergeTrimOptions: fits trims lead, the color tier adds what fits missed, no duplicates", () => {
  // The vendor book lists the endcap (catalog 589579 → twin-swaps to the shelf
  // item) but not the OneNose; the color tier adds it, and the MDF fill rides
  // along as its companion.
  const fitsTrims = [{ sku: "589579", bookId: "mann-order", trim: true, fits: ["MPB823"], price: 41.5 }];
  const out = mergeTrimOptions(fitsTrims, barkFloor, shelf);
  assert.deepEqual(out.map((t) => t.sku), ["1518224", "1518227", "1519319"]);
  assert.equal(out[0].orderSku, "589579");                  // the twin swap
  assert.equal(out[2].pairNote, "installs with OneNose");   // the companion
});

test("mergeTrimOptions: a vendor book's hyphenated \"One-Nose\" still pulls the MDF fill", () => {
  const fitsTrims = [{ sku: "589629", bookId: "mann-order", trim: true, fits: ["MPB823"], description: 'Adura One-Nose Noble Oak Bark 94"' }];
  const fill = shelf.find((t) => t.sku === "1519319");
  const out = mergeTrimOptions(fitsTrims, null, [fill]);
  assert.deepEqual(out.map((t) => t.sku), ["589629", "1519319"]);
});

test("mergeTrimOptions: no OneNose on the list → no MDF fill", () => {
  const noNose = shelf.filter((t) => t.sku !== "1518227");
  const out = mergeTrimOptions([], barkFloor, noNose);
  assert.deepEqual(out.map((t) => t.sku), ["1518224"]);
});

test("mergeTrimOptions: works with no fits trims at all — the shelf alone carries the popup", () => {
  const out = mergeTrimOptions([], barkFloor, shelf);
  assert.deepEqual(out.map((t) => t.sku), ["1518224", "1518227", "1519319"]);
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
