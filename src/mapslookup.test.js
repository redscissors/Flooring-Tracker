import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSuggestions, parseDistance, formatDist, normDistance, distStale, shouldSuggest } from "./mapslookup.js";

// Places Autocomplete (New) wraps the prediction text in a LocalizedText
// object; older/alternate shapes hand back a bare string. Accept both.
const AUTOCOMPLETE = {
  suggestions: [
    { placePrediction: { text: { text: "4905 Harris Rd, Broadview Heights, OH 44147, USA" } } },
    { placePrediction: { text: "5063 County Road 314, Millersburg, OH 44654, USA" } },
  ],
};

test("parseSuggestions reads both the LocalizedText and bare-string shapes", () => {
  assert.deepEqual(parseSuggestions(AUTOCOMPLETE), [
    "4905 Harris Rd, Broadview Heights, OH 44147, USA",
    "5063 County Road 314, Millersburg, OH 44654, USA",
  ]);
});

test("parseSuggestions returns an empty list rather than throwing on junk", () => {
  assert.deepEqual(parseSuggestions(null), []);
  assert.deepEqual(parseSuggestions({}), []);
  assert.deepEqual(parseSuggestions({ suggestions: "nope" }), []);
  assert.deepEqual(parseSuggestions({ suggestions: [{}, { placePrediction: {} }] }), []);
});

test("parseSuggestions drops duplicates and blanks", () => {
  const dup = { suggestions: [{ placePrediction: { text: { text: "A" } } }, { placePrediction: { text: { text: " A " } } }, { placePrediction: { text: { text: "  " } } }] };
  assert.deepEqual(parseSuggestions(dup), ["A"]);
});

test("parseDistance converts meters to miles and the duration string to minutes", () => {
  assert.deepEqual(parseDistance({ routes: [{ distanceMeters: 29610, duration: "1620s" }] }), { miles: 18.4, minutes: 27 });
});

test("parseDistance keeps miles when the duration is missing or unparseable", () => {
  assert.deepEqual(parseDistance({ routes: [{ distanceMeters: 1609 }] }), { miles: 1, minutes: null });
  assert.deepEqual(parseDistance({ routes: [{ distanceMeters: 1609, duration: "soon" }] }), { miles: 1, minutes: null });
});

test("parseDistance returns null when there is no usable route", () => {
  assert.equal(parseDistance(null), null);
  assert.equal(parseDistance({}), null);
  assert.equal(parseDistance({ routes: [] }), null);
  assert.equal(parseDistance({ routes: [{}] }), null);
  assert.equal(parseDistance({ routes: [{ distanceMeters: -5 }] }), null);
});

test("formatDist reads as a trip, and degrades to miles alone", () => {
  assert.equal(formatDist({ miles: 18.4, minutes: 27 }), "18.4 mi · 27 min");
  assert.equal(formatDist({ miles: 18.4, minutes: null }), "18.4 mi");
  assert.equal(formatDist(null), "");
});

test("normDistance keeps a whole record and rejects one with no miles", () => {
  const rec = { miles: 18.4, minutes: 27, from: "shop", to: "job", at: 123 };
  assert.deepEqual(normDistance(rec), rec);
  assert.equal(normDistance(null), null);
  assert.equal(normDistance({ minutes: 27 }), null);
  assert.equal(normDistance("18.4"), null);
});

test("normDistance fills the ends it was saved without", () => {
  assert.deepEqual(normDistance({ miles: 3 }), { miles: 3, minutes: null, from: "", to: "", at: 0 });
});

test("distStale is false while both ends still match, ignoring case and padding", () => {
  const rec = { miles: 18.4, minutes: 27, from: "1 Shop St", to: "2 Job Rd", at: 1 };
  assert.equal(distStale(rec, "2 Job Rd", "1 Shop St"), false);
  assert.equal(distStale(rec, "  2 job rd ", "1 SHOP ST"), false);
});

test("distStale is true when either end moved", () => {
  const rec = { miles: 18.4, minutes: 27, from: "1 Shop St", to: "2 Job Rd", at: 1 };
  assert.equal(distStale(rec, "9 Other Rd", "1 Shop St"), true);
  assert.equal(distStale(rec, "2 Job Rd", "9 New Shop"), true);
});

test("distStale is false with nothing stored — there is no drift to report", () => {
  assert.equal(distStale(null, "2 Job Rd", "1 Shop St"), false);
});

test("shouldSuggest gates on length and on the input actually having changed", () => {
  assert.equal(shouldSuggest("490", ""), false);
  assert.equal(shouldSuggest("4905", ""), true);
  assert.equal(shouldSuggest("4905", "4905"), false);
  assert.equal(shouldSuggest(" 4905 ", "4905"), false);
  assert.equal(shouldSuggest("4905 H", "4905"), true);
});
test("shouldSuggest rejects input over 200 characters; accepts exactly 200", () => {
  const input200 = "a".repeat(200);
  const input201 = "a".repeat(201);
  assert.equal(shouldSuggest(input200, ""), true);
  assert.equal(shouldSuggest(input201, ""), false);
});
