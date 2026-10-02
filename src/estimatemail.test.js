import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateMail } from "./estimatemail.js";

test("subject reads Selections - Customer - Project, body empty, PDF Customer - Project", () => {
  const m = estimateMail({ cust: { name: "Tom Bates", email: " tom@example.com " }, project: { name: "Kitchen remodel" } });
  assert.equal(m.subject, "Selections - Tom Bates - Kitchen remodel");
  assert.equal(m.body, "");
  assert.equal(m.filename, "Tom Bates - Kitchen remodel.pdf");
  assert.equal(m.to, "tom@example.com");
});

test("no customer: subject and PDF carry the project name alone, blank To", () => {
  const m = estimateMail({ cust: null, project: { name: "Quick price" } });
  assert.equal(m.subject, "Selections - Quick price");
  assert.equal(m.filename, "Quick price.pdf");
  assert.equal(m.to, "");
});

test("characters a file name can't hold are dropped from the PDF name only", () => {
  const m = estimateMail({ cust: { name: "Dan & Ruth Hartzler" }, project: { name: 'Kitchen / Bath 12"x24"' } });
  assert.equal(m.filename, "Dan & Ruth Hartzler - Kitchen Bath 12x24.pdf");
  assert.equal(m.subject, 'Selections - Dan & Ruth Hartzler - Kitchen / Bath 12"x24"');
});

test("nothing named falls back to Selections", () => {
  const m = estimateMail({ cust: { name: " " }, project: { name: "" } });
  assert.equal(m.filename, "Selections.pdf");
  assert.equal(m.subject, "Selections");
});
