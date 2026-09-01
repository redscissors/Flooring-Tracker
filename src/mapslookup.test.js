import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSuggestions, parseDetails, parseDistance, formatDist, normDistance, distStale, shouldSuggest } from "./mapslookup.js";

// Places Autocomplete (New) wraps the prediction text in a LocalizedText
// object; older/alternate shapes hand back a bare string. Accept both.
// Note the predictions carry NO postal code: Autocomplete omits them by design,
// which is why a picked suggestion is resolved through Place Details by placeId
// (ADR 0036 amendment). The fixture reflects what Google actually returns.
const AUTOCOMPLETE = {
  suggestions: [
    { placePrediction: { placeId: "ChIJharris", text: { text: "4905 Harris Rd, Broadview Heights, OH, USA" } } },
    { placePrediction: { placeId: "ChIJcounty", text: "5063 County Road 314, Millersburg, OH, USA" } },
  ],
};

test("parseSuggestions reads both the LocalizedText and bare-string shapes, keeping each placeId", () => {
  // The country tail is dropped here too — see the dropCountry tests below.
  assert.deepEqual(parseSuggestions(AUTOCOMPLETE), [
    { text: "4905 Harris Rd, Broadview Heights, OH", placeId: "ChIJharris" },
    { text: "5063 County Road 314, Millersburg, OH", placeId: "ChIJcounty" },
  ]);
});

test("parseSuggestions keeps a prediction that carries no placeId — the text is still usable", () => {
  assert.deepEqual(parseSuggestions({ suggestions: [{ placePrediction: { text: { text: "A Rd" } } }] }), [{ text: "A Rd", placeId: "" }]);
});

test("parseSuggestions returns an empty list rather than throwing on junk", () => {
  assert.deepEqual(parseSuggestions(null), []);
  assert.deepEqual(parseSuggestions({}), []);
  assert.deepEqual(parseSuggestions({ suggestions: "nope" }), []);
  assert.deepEqual(parseSuggestions({ suggestions: [{}, { placePrediction: {} }] }), []);
});

test("parseSuggestions drops duplicates and blanks", () => {
  const dup = { suggestions: [{ placePrediction: { placeId: "p1", text: { text: "A" } } }, { placePrediction: { placeId: "p2", text: { text: " A " } } }, { placePrediction: { text: { text: "  " } } }] };
  assert.deepEqual(parseSuggestions(dup), [{ text: "A", placeId: "p1" }]);
});

// Place Details is what supplies the postal code the predictions leave out.
test("parseDetails returns the complete formatted address, ending at the ZIP", () => {
  assert.equal(parseDetails({ formattedAddress: "4905 Harris Rd, Broadview Heights, OH 44147, USA" }), "4905 Harris Rd, Broadview Heights, OH 44147");
});

test("parseDetails gives an empty string when the shape is not what we expect", () => {
  assert.equal(parseDetails(null), "");
  assert.equal(parseDetails({}), "");
  assert.equal(parseDetails({ formattedAddress: 42 }), "");
  assert.equal(parseDetails({ formattedAddress: "   " }), "");
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

// Google appends the country to every result. The shop quotes US jobs only, so
// it is noise on an estimate — an address should end at the ZIP (owner,
// 2026-09-01). Stripped in BOTH parsers so the dropdown matches what a pick lands.
test("parseDetails drops a trailing USA so the address ends at the ZIP", () => {
  assert.equal(parseDetails({ formattedAddress: "4905 Harris Rd, Broadview Heights, OH 44147, USA" }), "4905 Harris Rd, Broadview Heights, OH 44147");
  assert.equal(parseDetails({ formattedAddress: "4905 Harris Rd, Broadview Heights, OH 44147, United States" }), "4905 Harris Rd, Broadview Heights, OH 44147");
  assert.equal(parseDetails({ formattedAddress: "1 Shop St, Akron, OH 44301, usa" }), "1 Shop St, Akron, OH 44301");
});

test("parseSuggestions drops it too, so the list reads like what gets stored", () => {
  const j = { suggestions: [{ placePrediction: { placeId: "p", text: { text: "4905 Harris Rd, Broadview Heights, OH, USA" } } }] };
  assert.deepEqual(parseSuggestions(j), [{ text: "4905 Harris Rd, Broadview Heights, OH", placeId: "p" }]);
});

// Only a comma-separated country tail goes. A street or place whose name merely
// contains those letters is left alone, and a genuinely foreign address keeps
// its country because there the country is information, not noise.
test("dropping the country is conservative", () => {
  assert.equal(parseDetails({ formattedAddress: "12 Usa Ridge Rd, Akron, OH 44301" }), "12 Usa Ridge Rd, Akron, OH 44301");
  assert.equal(parseDetails({ formattedAddress: "100 Main St USA" }), "100 Main St USA");
  assert.equal(parseDetails({ formattedAddress: "55 King St W, Toronto, ON M5X 1A9, Canada" }), "55 King St W, Toronto, ON M5X 1A9, Canada");
});
