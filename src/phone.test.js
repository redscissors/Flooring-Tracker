import test from "node:test";
import assert from "node:assert/strict";
import { fmtPhone } from "./phone.js";

test("formats as digits are typed", () => {
  assert.equal(fmtPhone(""), "");
  assert.equal(fmtPhone("5"), "5");
  assert.equal(fmtPhone("555"), "555");
  assert.equal(fmtPhone("5552"), "555-2");
  assert.equal(fmtPhone("555210"), "555-210");
  assert.equal(fmtPhone("5552100"), "555-210-0");
  assert.equal(fmtPhone("5552100114"), "555-210-0114");
});

test("reformats pasted or legacy values", () => {
  assert.equal(fmtPhone("(555) 210-0114"), "555-210-0114");
  assert.equal(fmtPhone("555.210.0114"), "555-210-0114");
  assert.equal(fmtPhone("+1 555 210 0114"), "555-210-0114");
  assert.equal(fmtPhone("1-555-210-0114"), "555-210-0114");
});

test("keeps digits past ten as an extension", () => {
  assert.equal(fmtPhone("5552100114 x22"), "555-210-0114 x22");
  assert.equal(fmtPhone("555210011422"), "555-210-0114 x22");
});

test("deleting through a dash removes the digit before it", () => {
  assert.equal(fmtPhone("555-210-", { deleting: true }), "555-21");
  assert.equal(fmtPhone("555-", { deleting: true }), "55");
  assert.equal(fmtPhone("555-21", { deleting: true }), "555-21");
});

test("non-string input", () => {
  assert.equal(fmtPhone(null), "");
  assert.equal(fmtPhone(undefined), "");
});
