import test from "node:test";
import assert from "node:assert/strict";
import { pickWediBooks } from "./usewedicatalog.js";

test("pickWediBooks: stock-kind, active, matching /wedi/i on name or brandLabel", () => {
  const books = [
    { id: "a", kind: "stock", name: "wedi", active: true },
    { id: "b", kind: "stock", name: "Schluter", active: true },
    { id: "c", kind: "order", name: "wedi pricelist", active: true },
    { id: "d", kind: "stock", name: "retired wedi", active: false },
    { id: "e", kind: "stock", name: "", data: { brandLabel: "WEDI" }, active: true },
  ];
  assert.deepEqual(pickWediBooks(books), ["a", "e"]);
  assert.deepEqual(pickWediBooks([]), []);
  assert.deepEqual(pickWediBooks(null), []);
});
