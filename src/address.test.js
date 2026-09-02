import { test } from "node:test";
import assert from "node:assert/strict";
import { mapsUrl, cleanAddress } from "./address.js";

test("mapsUrl points Google Maps at the typed address", () => {
  assert.equal(mapsUrl("4905 Harris Rd, Broadview Heights OH"),
    "https://www.google.com/maps/search/?api=1&query=4905%20Harris%20Rd%2C%20Broadview%20Heights%20OH");
});

test("mapsUrl with nothing typed opens plain Maps to search from scratch", () => {
  assert.equal(mapsUrl(""), "https://www.google.com/maps");
  assert.equal(mapsUrl("   "), "https://www.google.com/maps");
  assert.equal(mapsUrl(null), "https://www.google.com/maps");
});

test("cleanAddress folds the two-line Maps copy into one line", () => {
  assert.equal(cleanAddress("Cleveland Clinic\n9500 Euclid Ave, Cleveland, OH 44195"),
    "Cleveland Clinic, 9500 Euclid Ave, Cleveland, OH 44195");
});

test("cleanAddress does not double a comma the copied line already ends with", () => {
  assert.equal(cleanAddress("9500 Euclid Ave,\nCleveland, OH 44195"), "9500 Euclid Ave, Cleveland, OH 44195");
});

test("cleanAddress squeezes stray whitespace and trims the ends", () => {
  assert.equal(cleanAddress("  5063   County Road 314\t\r\n  Millersburg OH  "), "5063 County Road 314, Millersburg OH");
});

test("cleanAddress drops a dangling separator", () => {
  assert.equal(cleanAddress("214 Old Mill Rd,\n\n"), "214 Old Mill Rd");
  assert.equal(cleanAddress("214 Old Mill Rd -"), "214 Old Mill Rd");
});

test("cleanAddress on an empty or non-string clipboard gives an empty string", () => {
  assert.equal(cleanAddress(""), "");
  assert.equal(cleanAddress("\n \n"), "");
  assert.equal(cleanAddress(null), "");
  assert.equal(cleanAddress(undefined), "");
});

test("cleanAddress caps a runaway paste so a whole copied page can't land in the field", () => {
  const out = cleanAddress("x".repeat(500));
  assert.equal(out.length, 200);
});
