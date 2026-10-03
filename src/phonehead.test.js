import { test } from "node:test";
import assert from "node:assert/strict";
import { phoneTotal, shownAddress } from "./phonehead.js";

test("phoneTotal shows the job total as money", () => {
  assert.deepEqual(phoneTotal(1412.85, 0), { text: "$1,412.85", options: false });
  assert.equal(phoneTotal(12345.67, 0).text, "$12,345.67");
  assert.equal(phoneTotal(0, 0).text, "$0.00");
});

test("phoneTotal counts quote options instead of one total", () => {
  assert.deepEqual(phoneTotal(999, 3), { text: "3 options", options: true });
  assert.equal(phoneTotal(999, 1).text, "1 option");
});

test("shownAddress prefers the project's own address", () => {
  assert.deepEqual(shownAddress({ address: "44 Beech Ln" }, { address: "9 Elm" }), { text: "44 Beech Ln", own: true });
});

test("shownAddress falls back to the customer's when the project has none", () => {
  assert.deepEqual(shownAddress({ address: "  " }, { address: "9 Elm" }), { text: "9 Elm", own: false });
  assert.deepEqual(shownAddress({ address: "" }, null), { text: "", own: false });
});
