import test from "node:test";
import assert from "node:assert/strict";
import {
  pickWediBooks, foldBookLists, gateOf, bookErrorOf,
  pickWediSoBooks, installSources, fallbackCaption,
} from "./usewedicatalog.js";
import { normBookItem, bookItemData } from "./orderbook.js";
import { parseMapped } from "./pricebook.js";
import { FIXTURE_ROWS } from "./wedifixture.js";
import { PRICELIST_SHEETS } from "./wedipricelistfixture.js";
import { parseWediPricelist } from "./wedibook.js";
import { adaptBookRows, adaptSoRows } from "./wediadapter.js";
import { catalog, clearStockSource, clearSoSource, stockSourceIsBook, soSourceIsBook, SKU } from "./wedi.js";

test("pickWediBooks: stock-kind, active, word-matching wedi on name or brandLabel", () => {
  const books = [
    { id: "a", kind: "stock", name: "wedi", active: true },
    { id: "b", kind: "stock", name: "Schluter", active: true },
    { id: "c", kind: "order", name: "wedi pricelist", active: true },
    { id: "d", kind: "stock", name: "retired wedi", active: false },
    { id: "e", kind: "stock", name: "", data: { brandLabel: "WEDI" }, active: true },
    { id: "f", kind: "stock", name: "Swedish oak" },              // substring, NOT a wedi book
    { id: "g", kind: "stock", name: "wedi extras" },               // active undefined = active
  ];
  assert.deepEqual(pickWediBooks(books), ["a", "e", "g"]);
  assert.deepEqual(pickWediBooks([]), []);
  assert.deepEqual(pickWediBooks(null), []);
});

test("foldBookLists: any failed fetch nulls the whole result", () => {
  const row = (sku, extra) => ({ sku, ...extra });
  assert.deepEqual(foldBookLists([[row("1")], [row("2")]]).map((r) => r.sku), ["1", "2"]);
  assert.equal(foldBookLists([[row("1")], null]), null, "one failure closes the gate");
  assert.equal(foldBookLists([undefined]), null, "an undefined list is a failure too");
  assert.equal(foldBookLists(null), null);
  assert.deepEqual(foldBookLists([[]]), [], "an empty book folds to [], not null");
  assert.deepEqual(
    foldBookLists([[row("1", { active: false }), row("2", { disabled: true }), row("3")]])
      .map((r) => r.sku), ["3"], "inactive and disabled rows drop out");
});

// The gate's transition table. Reading the hook was not enough to catch two
// stale-pricing bugs in an earlier draft, so the arithmetic is pinned here.
test("gateOf: the three states, and the two ways a stale fallback used to slip through", () => {
  const g = (o) => gateOf({ bookStockReady: true, ...o });

  // 1. no book at all — fallback is legitimate, and it is ready immediately
  assert.deepEqual(g({ targetIds: "", loadedIds: "", rows: [], adapted: null }),
    { catReady: true, onBook: false });

  // 2. book exists, rows not in yet — WAIT, never substitute the table
  assert.deepEqual(g({ targetIds: "a", loadedIds: "a", rows: null, adapted: null }),
    { catReady: false, onBook: false });
  // ...and the boot cache is not up yet
  assert.deepEqual(gateOf({ targetIds: "a", bookStockReady: false, loadedIds: "a", rows: [{}], adapted: [{}] }),
    { catReady: false, onBook: false });

  // 3. book with rows — install
  assert.deepEqual(g({ targetIds: "a", loadedIds: "a", rows: [{}], adapted: [{}] }),
    { catReady: true, onBook: true });

  // REGRESSION A: rows left over from a PREVIOUS id-set (including the [] written
  // when there was no book yet) must not satisfy the gate for a new book.
  assert.deepEqual(g({ targetIds: "a", loadedIds: "", rows: [], adapted: null }),
    { catReady: false, onBook: false });
  assert.deepEqual(g({ targetIds: "b", loadedIds: "a", rows: [{}], adapted: [{}] }),
    { catReady: false, onBook: false });

  // REGRESSION B: a book whose rows all fail to adapt is an EMPTY book — it must
  // fall back AND drop the marker, never fly onBook over the transcribed table.
  assert.deepEqual(g({ targetIds: "a", loadedIds: "a", rows: [{}, {}], adapted: [] }),
    { catReady: true, onBook: false });
});

// The failed-fetch signal. Before it existed, a failed fetch and a fetch still
// in flight were the same state, `catReady:false` — and the popup's answer to
// both was `return null`: nothing on screen, forever, with no diagnostic.
test("bookErrorOf: a settled failure is distinguishable from still waiting", () => {
  // a settled fetch that came back empty-handed — offer the retry
  assert.equal(bookErrorOf({ targetIds: "a", loadedIds: "a", err: true }), true);

  // still in flight: nothing loaded for this id-set yet
  assert.equal(bookErrorOf({ targetIds: "a", loadedIds: null, err: false }), false);
  // a book exists but no loader has arrived — ordinary waiting, NOT a failure,
  // even though the hook writes rows:null for it exactly as a failure does
  assert.equal(bookErrorOf({ targetIds: "a", loadedIds: "a", err: false }), false);
  // a failure recorded against a PREVIOUS book set says nothing about this one
  assert.equal(bookErrorOf({ targetIds: "b", loadedIds: "a", err: true }), false);
  // no book at all can't fail — the fallback is legitimate there
  assert.equal(bookErrorOf({ targetIds: "", loadedIds: "", err: true }), false);
});

test("pickWediSoBooks: ORDER-kind, active, word-matching wedi — the stock book named wedi is never a candidate", () => {
  const books = [
    { id: "a", kind: "stock", name: "wedi", active: true },
    { id: "b", kind: "order", name: "wedi", active: true },
    { id: "c", kind: "order", name: "wedi pricelist", active: true },
    { id: "d", kind: "order", name: "retired wedi", active: false },
    { id: "e", kind: "order", name: "", data: { brandLabel: "WEDI" }, active: true },
    { id: "f", kind: "order", name: "Swedish oak" },
    { id: "g", kind: "order", name: "Schluter" },
  ];
  assert.deepEqual(pickWediSoBooks(books), ["b", "c", "e"]);
  assert.deepEqual(pickWediBooks(books), ["a"], "and the stock picker still sees only the stock book");
  assert.deepEqual(pickWediSoBooks([]), []);
  assert.deepEqual(pickWediSoBooks(null), []);
});

const liveStock = () => adaptBookRows(FIXTURE_ROWS.map((r) => normBookItem(r, "bk_wedi")));
const liveSo = () => {
  const p = parseWediPricelist(PRICELIST_SHEETS);
  const { items } = parseMapped(p.rows, p.mapping);
  return adaptSoRows(items.map((it) => normBookItem({ sku: it.sku, active: true, data: bookItemData(it) }, "bk_wedi_so")));
};
const clearBoth = () => { clearStockSource(); clearSoSource(); };

test("installSources: both books with rows install both; the floor is satisfied", () => {
  clearBoth();
  const stock = liveStock(), so = liveSo();
  const plan = installSources({ stock, so });
  assert.deepEqual(plan.onBook, { stock: true, so: true });
  assert.deepEqual(plan.missing, { stock: [], so: [] });
  assert.equal(plan.stock, stock, "the decision carries the installed rows by identity");
  assert.equal(plan.so, so);
  assert.equal(stockSourceIsBook(), true);
  assert.equal(soSourceIsBook(), true);
  assert.equal(catalog().length, 273);
  clearBoth();
});

test("installSources: a pricelist book missing a required part is REFUSED — visibly — and the pricelist falls back to the table", () => {
  clearBoth();
  const stock = liveStock();
  const thin = liveSo().filter((r) => r.us !== SKU.sealant620Tube);   // the one SKU.* the stock table lacks
  const plan = installSources({ stock, so: thin });
  assert.deepEqual(plan.onBook, { stock: true, so: false });
  assert.deepEqual(plan.missing, { stock: [], so: [SKU.sealant620Tube] });
  assert.equal(plan.so, null);
  assert.equal(soSourceIsBook(), false, "WEDI_SO is back in");
  assert.equal(stockSourceIsBook(), true, "the stock book stays");
  assert.equal(catalog().length, 269);
  clearBoth();
});

test("installSources: no books at all — both tables, nothing missing; empty rows count as no book", () => {
  clearBoth();
  assert.deepEqual(installSources({ stock: null, so: null }).onBook, { stock: false, so: false });
  assert.deepEqual(installSources({ stock: [], so: [] }).onBook, { stock: false, so: false });
  assert.equal(catalog().length, 269);
  clearBoth();
});

test("fallbackCaption: the four states, and the floor's message", () => {
  assert.equal(fallbackCaption({ stock: true, so: true }, { stock: [], so: [] }), "");
  assert.equal(fallbackCaption({ stock: true, so: false }, { stock: [], so: [] }), " · transcribed pricelist");
  assert.equal(fallbackCaption({ stock: false, so: true }, { stock: [], so: [] }), " · transcribed stock table");
  assert.equal(fallbackCaption({ stock: false, so: false }, { stock: [], so: [] }), " · transcribed tables");
  assert.equal(fallbackCaption({ stock: true, so: false }, { stock: [], so: ["US5000088"] }),
    " · transcribed pricelist (book is missing 1 required part: US5000088)");
  assert.equal(fallbackCaption({ stock: false, so: false }, { stock: ["US8000017"], so: ["US8000017", "US5000088"] }),
    " · transcribed tables (book is missing 2 required parts: US8000017, US5000088)");
  assert.equal(fallbackCaption(null, null), " · transcribed tables");
});

test("two halves: catReady is the AND of the two gates — either half waiting holds the popup", () => {
  const ready = (o) => gateOf({ bookStockReady: true, ...o });
  const stockOn = ready({ targetIds: "s", loadedIds: "s", rows: [{}], adapted: [{}] });
  const soWaiting = ready({ targetIds: "o", loadedIds: "o", rows: null, adapted: null });
  const soNone = ready({ targetIds: "", loadedIds: "", rows: [], adapted: null });
  assert.equal(stockOn.catReady && soWaiting.catReady, false, "a present-but-unloaded pricelist book blocks");
  assert.equal(stockOn.catReady && soNone.catReady, true, "no pricelist book at all falls back");
});
