import { test } from "node:test";
import assert from "node:assert/strict";
import { estimateMail } from "./estimatemail.js";

test("names the PDF Customer - Project Name and addresses the customer", () => {
  const m = estimateMail({ cust: { name: "Kathy Marsh", email: " kathy@example.com " }, project: { name: "Whole first floor" }, salesperson: { name: "Danny", phone: "(555) 210-0114" } });
  assert.equal(m.filename, "Kathy Marsh - Whole first floor.pdf");
  assert.equal(m.to, "kathy@example.com");
  assert.equal(m.subject, "Estimate – Whole first floor");
  assert.equal(m.body, "Hi Kathy,\n\nAttached is your estimate for Whole first floor. Let me know if you have any questions.\n\nThanks,\nDanny\n(555) 210-0114");
});

test("no customer: project name alone, blank To, no first name", () => {
  const m = estimateMail({ cust: null, project: { name: "Quick price" }, salesperson: { name: "Sam" } });
  assert.equal(m.filename, "Quick price.pdf");
  assert.equal(m.to, "");
  assert.ok(m.body.startsWith("Hi,\n"));
  assert.ok(m.body.endsWith("Thanks,\nSam"));
});

test("characters a file name can't hold are dropped", () => {
  const m = estimateMail({ cust: { name: "Dan & Ruth Hartzler" }, project: { name: 'Kitchen / Bath 12"x24"' } });
  assert.equal(m.filename, "Dan & Ruth Hartzler - Kitchen Bath 12x24.pdf");
});

test("nothing named falls back to Estimate", () => {
  assert.equal(estimateMail({ cust: { name: " " }, project: { name: "" } }).filename, "Estimate.pdf");
});
