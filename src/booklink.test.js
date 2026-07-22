// src/booklink.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchRule, parseColorToken, deriveSeriesRule, normLink,
  normBookFamily, resolveFamily, projectFamilies, familyWarnings,
} from "./booklink.js";
import {
  groutFamilies, groutColorItem, groutCaulkItem, groutSnapshotPatch,
  stockCompanionBase, stockBaseVariant,
} from "./stock.js";

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
  // sibling order never changes the derived rule (exports have no guaranteed order)
  const shuffled = [LATASIL[3], LATASIL[0], LATASIL[1], LATASIL[2]];
  const c2 = deriveSeriesRule(LATASIL[0], shuffled);
  assert.equal(c2.prefix, "10.3 OZ LATASIL");
  assert.equal(c2.suffix, "- 100% SILICONE CAULK");
});

test("normLink keeps only a complete bookId+sku pair", () => {
  assert.deepEqual(normLink({ bookId: "b1", sku: "07879" }), { bookId: "b1", sku: "07879" });
  assert.equal(normLink({ bookId: "", sku: "07879" }), null);
  assert.equal(normLink(null), null);
});

// --- Task 2: family definitions, resolution & stock-shaped projection ------------

// Fake Sheet1 book (grout SKUs): SpectraLock Pro Part C colors + its two base
// units, plus a TEC-style no-suffix family sharing the same book. Shaped like
// normOrderItem output, per the brief.
const SHEET1_ITEMS = [
  { sku: "PC85", active: true, disabled: false, description: "9LB SPECTRALOCK PRO 85 ALMOND PART C", price: 42.5, unit: "EA" },
  { sku: "PC24", active: true, disabled: false, description: "9LB SPECTRALOCK PRO 24 NATURAL GREY PART C", price: 42.5, unit: "EA" },
  { sku: "PC53", active: true, disabled: false, description: "9LB SPECTRALOCK PRO 53 TWILIGHT BLUE PART C", price: 44, unit: "EA" },
  { sku: "PC-CLR", active: true, disabled: false, description: "9LB SPECTRALOCK PRO CLEAR PART C", price: 40, unit: "EA" },
  { sku: "SL-FULL", active: true, disabled: false, description: "0.8 GAL SPECTRALOCK PRO EPOXY GROUT FULL UNIT PART A&B", price: 210, unit: "EA" },
  { sku: "SL-COMM", active: true, disabled: false, description: "3.2 GAL SPECTRALOCK PRO EPOXY GROUT COMMERCIAL UNIT PART A&B", price: 640, unit: "EA" },
  { sku: "TEC910", active: true, disabled: false, description: "10# Tec Power Grout - 910 Bright White", price: 18, unit: "EA" },
  { sku: "TEC934", active: true, disabled: false, description: "10# Tec Power Grout - 934 Slate Gray/Del Gray", price: 18, unit: "EA" },
];

// Fake caulk book. LAT44 is an orphan (no matching grout color) — real
// exports carry caulk colors a family never uses. LAT53 is the messy real
// row (glued "10.3 OZ" before the frame's own "10.3 OZ" suffix repeats).
const CAULK1_ITEMS = [
  { sku: "LAT85", active: true, disabled: false, description: "10.3 OZ LATASIL 85 ALMOND - 100% SILICONE CAULK", price: 12.25, unit: "EA" },
  { sku: "LAT44", active: true, disabled: false, description: "10.3 OZ LATASIL  44 BRIGHT WHITE - 100% SILICONE CAULK", price: 12.25, unit: "EA" },
  { sku: "LATCLR", active: true, disabled: false, description: "10.3 OZ LATASIL CLEAR - 100% SILICONE CAULK", price: 12.25, unit: "EA" },
  { sku: "LAT53", active: true, disabled: false, description: "10.3 OZ LATASIL 53 TWILIGHT BLUE 10.3 OZ- 100% SILICONE CAULK", price: 12.75, unit: "EA" },
  { sku: "LAT24", active: true, disabled: false, description: "10.3 OZ LATASIL 24 NATURAL GREY - 100% SILICONE CAULK", price: 12.25, unit: "EA" },
];

const ITEMS_BY_BOOK = { sheet1: SHEET1_ITEMS, caulk1: CAULK1_ITEMS };

const SPECTRA_FAMILY = {
  id: "spectralock-pro",
  name: "SpectraLock Pro",
  bookId: "sheet1",
  rule: { prefix: "9LB SPECTRALOCK PRO", suffix: "PART C" },
  baseSkus: { default: "SL-FULL", variant: "SL-COMM" },
  caulk: { bookId: "caulk1", prefix: "10.3 OZ LATASIL", suffix: "- 100% SILICONE CAULK" },
  cache: [],
};

const TEC_FAMILY = {
  id: "tec-power-grout",
  name: "TEC Power Grout",
  bookId: "sheet1",
  rule: { prefix: "10# Tec Power Grout -", suffix: "" },
  baseSkus: { default: "", variant: "" },
  caulk: null,
  cache: [],
};

// Same rule as TEC_FAMILY but points at a base SKU no row in the book carries.
const TEC_MISSING_BASE_FAMILY = {
  id: "tec-missing-base",
  name: "TEC Missing Base",
  bookId: "sheet1",
  rule: { prefix: "10# Tec Power Grout -", suffix: "" },
  baseSkus: { default: "TEC-BASE-GHOST", variant: "" },
  caulk: null,
  cache: [],
};

// A rule that matches nothing in the book, with cached colors from a prior
// resolve — the re-drop-broke-the-rule case (spec §6).
const GHOST_FAMILY = {
  id: "ghost-family",
  name: "Ghost Family",
  bookId: "sheet1",
  rule: { prefix: "NOPE NOPE NOPE", suffix: "" },
  baseSkus: { default: "", variant: "" },
  caulk: null,
  cache: [{ color: "Old Cached Color", num: "", sku: "OLD-1", price: 4.5, unit: "EA" }],
};

test("normBookFamily normalizes shape, defaults, and cache", () => {
  const fam = normBookFamily({
    name: "X", bookId: "b1",
    rule: { prefix: "P", suffix: "S" },
    baseSkus: { default: "D" },
    caulk: { prefix: "CP" },
    cache: [{ color: "Red", num: "1", sku: "S1", price: 5, unit: "EA" }],
  });
  assert.equal(typeof fam.id, "string");
  assert.ok(fam.id.length > 0);
  assert.equal(fam.name, "X");
  assert.equal(fam.bookId, "b1");
  assert.deepEqual(fam.rule, { prefix: "P", suffix: "S" });
  assert.deepEqual(fam.baseSkus, { default: "D", variant: "" });
  // caulk.bookId falls back to the family's own bookId when unset
  assert.deepEqual(fam.caulk, { bookId: "b1", prefix: "CP", suffix: "" });
  assert.deepEqual(fam.cache, [{ color: "Red", num: "1", sku: "S1", price: 5, unit: "EA" }]);

  // an id already present is kept, not regenerated
  assert.equal(normBookFamily({ id: "keep-me" }).id, "keep-me");
  // a caulk object with neither prefix nor suffix normalizes to null (no caulk match)
  assert.equal(normBookFamily({ caulk: {} }).caulk, null);
  assert.equal(normBookFamily({}).caulk, null);
});

test("resolveFamily resolves colors by rule and excludes base rows", () => {
  const fam = normBookFamily(SPECTRA_FAMILY);
  const r = resolveFamily(fam, ITEMS_BY_BOOK);
  assert.equal(r.usedCache, false);
  const bySku = Object.fromEntries(r.colors.map((c) => [c.sku, c]));
  assert.deepEqual(Object.keys(bySku).sort(), ["PC-CLR", "PC24", "PC53", "PC85"]);
  assert.equal(bySku.PC24.color, "Natural Grey");
  assert.equal(bySku.PC24.num, "24");
  assert.equal(bySku.PC85.color, "Almond");
  // base rows never show up as colors
  assert.ok(!r.colors.some((c) => c.sku === "SL-FULL" || c.sku === "SL-COMM"));
  assert.deepEqual(r.bases.map((b) => b.sku).sort(), ["SL-COMM", "SL-FULL"]);
});

test("resolveFamily matches caulk by number, by name fallback, and off a messy real row", () => {
  const fam = normBookFamily(SPECTRA_FAMILY);
  const r = resolveFamily(fam, ITEMS_BY_BOOK);
  assert.equal(r.caulkByColor.get("almond").sku, "LAT85"); // matched by number
  assert.equal(r.caulkByColor.get("natural grey").sku, "LAT24"); // matched by number
  assert.equal(r.caulkByColor.get("clear").sku, "LATCLR"); // no number on either side: name fallback
  // the messy Latasil "53" row (glued extra "10.3 OZ") still keys Twilight Blue by number
  assert.equal(r.caulkByColor.get("twilight blue").sku, "LAT53");
  assert.equal(r.caulkByColor.get("twilight blue").price, 12.75);
});

test("resolveFamily supports a TEC-style no-suffix rule", () => {
  const fam = normBookFamily(TEC_FAMILY);
  const r = resolveFamily(fam, ITEMS_BY_BOOK);
  assert.equal(r.usedCache, false);
  assert.deepEqual(r.colors.map((c) => c.sku).sort(), ["TEC910", "TEC934"]);
  const bySku = Object.fromEntries(r.colors.map((c) => [c.sku, c]));
  assert.equal(bySku.TEC910.color, "Bright White");
  assert.equal(bySku.TEC910.num, "910");
  assert.equal(r.caulkByColor.size, 0); // no caulk rule defined for this family
  assert.deepEqual(r.bases, []); // no baseSkus defined
});

test("resolveFamily falls back to cached colors on zero live matches", () => {
  const fam = normBookFamily(GHOST_FAMILY);
  const r = resolveFamily(fam, ITEMS_BY_BOOK);
  assert.equal(r.usedCache, true);
  assert.deepEqual(r.colors, GHOST_FAMILY.cache);
});

test("resolveFamily reports empty bases when the defined base SKU is absent", () => {
  const fam = normBookFamily(TEC_MISSING_BASE_FAMILY);
  const r = resolveFamily(fam, ITEMS_BY_BOOK);
  assert.equal(r.colors.length, 2); // the rule still matches fine
  assert.equal(r.usedCache, false);
  assert.deepEqual(r.bases, []); // TEC-BASE-GHOST isn't in the book
});

test("familyWarnings flags zero-match and base-missing families, and stays quiet for healthy ones", () => {
  assert.deepEqual(familyWarnings([GHOST_FAMILY], ITEMS_BY_BOOK),
    [{ familyId: "ghost-family", name: "Ghost Family", kind: "zero-match" }]);
  assert.deepEqual(familyWarnings([TEC_MISSING_BASE_FAMILY], ITEMS_BY_BOOK),
    [{ familyId: "tec-missing-base", name: "TEC Missing Base", kind: "base-missing" }]);
  assert.deepEqual(familyWarnings([SPECTRA_FAMILY, TEC_FAMILY], ITEMS_BY_BOOK), []);
});

test("projectFamilies emits the three stock-shaped item forms", () => {
  const projected = projectFamilies([SPECTRA_FAMILY, TEC_FAMILY], ITEMS_BY_BOOK);
  const bySku = Object.fromEntries(projected.map((it) => [it.sku, it]));

  const flagCheck = (it) => {
    assert.equal(it.active, true);
    assert.equal(it.disabled, false);
    assert.equal(it.discontinued, false);
    assert.equal(it.sheet, "Grout & Caulk");
  };

  // a grout color row
  flagCheck(bySku.PC24);
  assert.equal(bySku.PC24.section, "bookfam:spectralock-pro");
  assert.equal(bySku.PC24.product, "SpectraLock Pro");
  assert.equal(bySku.PC24.color, "Natural Grey");
  assert.equal(bySku.PC24.price, 42.5);
  assert.equal(bySku.PC24.unit, "EA");
  assert.equal(bySku.PC24.description, "");

  // the matched caulk row rides under the GROUT's color, same section, "<name> Caulk" product
  flagCheck(bySku.LAT24);
  assert.equal(bySku.LAT24.section, bySku.PC24.section);
  assert.equal(bySku.LAT24.product, "SpectraLock Pro Caulk");
  assert.equal(bySku.LAT24.color, "Natural Grey");
  assert.equal(bySku.LAT24.price, 12.25);

  // a base-unit row
  flagCheck(bySku["SL-FULL"]);
  assert.equal(bySku["SL-FULL"].section, "Bulk & Base Units");
  assert.equal(bySku["SL-FULL"].product, "SpectraLock Pro");
  assert.equal(bySku["SL-FULL"].description, "0.8 GAL SPECTRALOCK PRO EPOXY GROUT FULL UNIT PART A&B");
  assert.equal(bySku["SL-FULL"].price, 210);

  // TEC family: colors project fine, no caulk rows, no base rows (none defined)
  assert.equal(bySku.TEC910.product, "TEC Power Grout");
  assert.equal(bySku.TEC910.section, "bookfam:tec-power-grout");
  assert.ok(!Object.values(bySku).some((it) => it.product === "TEC Power Grout Caulk"));
});

test("projectFamilies output works unchanged through stock.js's grout & base-unit helpers", () => {
  const projected = projectFamilies([SPECTRA_FAMILY, TEC_FAMILY], ITEMS_BY_BOOK);

  const fams = groutFamilies(projected);
  const spectra = fams.find((f) => f.product === "SpectraLock Pro");
  assert.ok(spectra);
  assert.deepEqual(spectra.colors.map((c) => c.color).sort(),
    ["Almond", "Clear", "Natural Grey", "Twilight Blue"]);

  assert.equal(groutColorItem(projected, "SpectraLock Pro", "Natural Grey").sku, "PC24");
  assert.equal(groutCaulkItem(projected, "SpectraLock Pro", "Natural Grey").sku, "LAT24");

  assert.deepEqual(groutSnapshotPatch(projected, "SpectraLock Pro", "Natural Grey"), {
    sku: "PC24", caulkSku: "LAT24", caulkPrice: "12.25",
  });

  // A pigment-shaped item (any raw book row mentioning "SpectraLock ... Part C")
  // pulls its default base — the FULL unit — out of the projection.
  const partCRow = SHEET1_ITEMS.find((it) => it.sku === "PC85");
  const full = stockCompanionBase(partCRow, projected);
  assert.ok(full);
  assert.equal(full.sku, "SL-FULL");
  assert.match(full.description, /full/i);

  // ...and the base row itself can swap to its Commercial sibling.
  const commercial = stockBaseVariant(full, projected);
  assert.ok(commercial);
  assert.equal(commercial.sku, "SL-COMM");
  assert.match(commercial.description, /commercial/i);
});
