import test from "node:test";
import assert from "node:assert/strict";
import { pickWediBooks, foldBookLists, gateOf } from "./usewedicatalog.js";

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
