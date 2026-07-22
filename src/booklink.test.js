// src/booklink.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { matchRule, parseColorToken, deriveSeriesRule, normLink } from "./booklink.js";

const SPECTRA = [
  "0.8 GAL SPECTRALOCK PRO EPOXY GROUT FULL UNIT PART A&B",
  "3.2 GAL SPECTRALOCK PRO EPOXY GROUT COMMERCIAL UNIT PART A&B",
  "9LB SPECTRALOCK PRO 85 ALMOND PART C",
  "9LB SPECTRALOCK PRO 24 NATURAL GREY PART C",
  "9LB SPECTRALOCK PRO 53 TWILIGHT BLUE PART C",
];
const LATASIL = [
  "10.3 OZ LATASIL 85 ALMOND - 100% SILICONE CAULK",
  "10.3 OZ LATASIL  44 BRIGHT WHITE - 100% SILICONE CAULK",   // double space in the export
  "10.3 OZ LATASIL CLEAR - 100% SILICONE CAULK",              // no color number
  "10.3 OZ LATASIL 53 TWILIGHT BLUE 10.3 OZ- 100% SILICONE CAULK", // messy real row
];

test("matchRule slices the color token between prefix and suffix", () => {
  const r = { prefix: "9LB SPECTRALOCK PRO", suffix: "PART C" };
  assert.equal(matchRule(r, "9LB SPECTRALOCK PRO 24 NATURAL GREY PART C"), "24 NATURAL GREY");
  assert.equal(matchRule(r, "0.8 GAL SPECTRALOCK PRO EPOXY GROUT FULL UNIT PART A&B"), null); // base row: wrong frame
  assert.equal(matchRule(r, "10# Tec Power Grout - 910 Bright White"), null);
  // whitespace-insensitive and case-insensitive on the frame
  assert.equal(matchRule({ prefix: "10.3 OZ LATASIL", suffix: "- 100% SILICONE CAULK" }, LATASIL[1]), "44 BRIGHT WHITE");
  // a row that is ONLY the frame yields no color
  assert.equal(matchRule({ prefix: "9LB SPECTRALOCK PRO", suffix: "" }, "9LB SPECTRALOCK PRO"), null);
  // an empty rule matches nothing
  assert.equal(matchRule({ prefix: "", suffix: "" }, "anything"), null);
});

test("matchRule handles a suffix-only frame and leading separators", () => {
  const r = { prefix: "10# Tec Power Grout -", suffix: "" };
  assert.equal(matchRule(r, "10# Tec Power Grout - 910 Bright White"), "910 Bright White");
  assert.equal(matchRule(r, "10# Tec Power Grout - 934 Slate Gray/Del Gray"), "934 Slate Gray/Del Gray");
});

test("parseColorToken extracts the color number and name", () => {
  assert.deepEqual(parseColorToken("24 NATURAL GREY"), { num: "24", name: "Natural Grey" });
  assert.deepEqual(parseColorToken("910 Bright White"), { num: "910", name: "Bright White" });
  assert.deepEqual(parseColorToken("CLEAR"), { num: "", name: "Clear" });
  // the messy Latasil row still keys on its number
  assert.equal(parseColorToken("53 TWILIGHT BLUE 10.3 OZ").num, "53");
  // "93FOSSIL" (PermaColor's typo row) — glued number still splits
  assert.deepEqual(parseColorToken("93FOSSIL"), { num: "93", name: "Fossil" });
  assert.deepEqual(parseColorToken("545 Bleached Wood"), { num: "545", name: "Bleached Wood" });
});

test("deriveSeriesRule proposes the shared frame from a picked row", () => {
  const r = deriveSeriesRule("9LB SPECTRALOCK PRO 24 NATURAL GREY PART C", SPECTRA);
  assert.equal(r.prefix, "9LB SPECTRALOCK PRO");
  assert.equal(r.suffix, "PART C");
  const c = deriveSeriesRule(LATASIL[0], LATASIL);
  assert.equal(c.prefix, "10.3 OZ LATASIL");
  assert.equal(c.suffix, "- 100% SILICONE CAULK");
  // under 3 siblings: fall back to the whole description as prefix (user edits in the confirm UI)
  const d = deriveSeriesRule("Gal Custom Premixed Grout - Delorean Gray Sanded",
    ["Gal Custom Premixed Grout - Delorean Gray Sanded", "Gal Custom Premixed Grout - Natural Gray Sanded"]);
  assert.equal(d.prefix, "Gal Custom Premixed Grout - Delorean Gray Sanded");
});

test("normLink keeps only a complete bookId+sku pair", () => {
  assert.deepEqual(normLink({ bookId: "b1", sku: "07879" }), { bookId: "b1", sku: "07879" });
  assert.equal(normLink({ bookId: "", sku: "07879" }), null);
  assert.equal(normLink(null), null);
});
