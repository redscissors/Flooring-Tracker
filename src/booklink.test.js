// src/booklink.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchRule, parseColorToken, deriveSeriesRule, normLink,
  normBookFamily, resolveFamily, projectFamilies, familyWarnings,
  syncLinkedCatalog, linkedItemState, proposeLinks, applyProposals,
  proposeFamilyName, suggestSeries,
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

// --- collection picker: proposeFamilyName / suggestSeries -------------------

test("proposeFamilyName drops size/unit lead-ins and trailing separators", () => {
  assert.equal(proposeFamilyName("9LB SPECTRALOCK PRO"), "Spectralock Pro");
  assert.equal(proposeFamilyName("10.3 OZ LATASIL"), "Latasil");
  assert.equal(proposeFamilyName("10# Tec Power Grout -"), "Tec Power Grout");
  assert.equal(proposeFamilyName("PERMACOLOR SELECT"), "Permacolor Select");
  // an all-junk prefix falls back to itself rather than an empty name
  assert.equal(proposeFamilyName("0.8 GAL"), "0.8 Gal");
});

test("suggestSeries clusters query hits into one entry per collection", () => {
  const hits = ["PC24", "PC85"].map((sku) => ({ ...SHEET1_ITEMS.find((it) => it.sku === sku), bookId: "sheet1" }));
  const series = suggestSeries(hits, ITEMS_BY_BOOK);
  assert.equal(series.length, 1); // two hits, one shared frame — deduped
  const s = series[0];
  assert.equal(s.bookId, "sheet1");
  assert.deepEqual(s.rule, { prefix: "9LB SPECTRALOCK PRO", suffix: "PART C" });
  assert.equal(s.name, "Spectralock Pro");
  assert.equal(s.count, 4); // 85/24/53 + Clear; base rows don't fit the frame
  assert.ok(s.sample.includes("Natural Grey"));
  assert.equal(s.seedDescription, hits[0].description);
});

test("suggestSeries drops under-clustered hits and never counts dead rows as colors", () => {
  // TEC has only 2 rows in the book — deriveSeriesRule can't find ≥3 siblings,
  // the whole-description fallback matches nothing, so no collection is
  // offered (the picker's single-row list covers it).
  const tec = { ...SHEET1_ITEMS.find((it) => it.sku === "TEC910"), bookId: "sheet1" };
  assert.deepEqual(suggestSeries([tec], ITEMS_BY_BOOK), []);
  // a hit without a bookId (a projected family row) proposes nothing
  assert.deepEqual(suggestSeries([{ sku: "X", description: "whatever" }], ITEMS_BY_BOOK), []);
  const withDead = {
    sheet1: [...SHEET1_ITEMS,
      { sku: "PC99", active: false, disabled: false, description: "9LB SPECTRALOCK PRO 99 GHOST PART C", price: 1, unit: "EA" }],
  };
  const seed = { ...SHEET1_ITEMS.find((it) => it.sku === "PC24"), bookId: "sheet1" };
  assert.equal(suggestSeries([seed], withDead)[0].count, 4);
});

test("suggestSeries drops a base-row-seeded loose superset of a more specific series", () => {
  // The NS base shares the "PERMACOLOR SELECT" lead-in, so seeding from it
  // derives a loose rule that swallows the color kits PLUS itself — the
  // specific COLOR KIT frame must win and the base must not read as a color.
  const rows = [
    ["PSC24", "PERMACOLOR SELECT COLOR KIT 24 NATURAL GREY"],
    ["PSC44", "PERMACOLOR SELECT COLOR KIT 44 BRIGHT WHITE"],
    ["PSC60", "PERMACOLOR SELECT COLOR KIT 60 DUSTY GREY"],
    ["PSC93", "PERMACOLOR SELECT COLOR KIT 93FOSSIL"],
    ["PSB-NS", "PERMACOLOR SELECT NS BASE UNSANDED"],
    ["PSB-S", "25LB PERMACOLOR SELECT BASE SANDED"],
  ].map(([sku, description]) => ({ sku, description, active: true, price: 20, unit: "EA" }));
  const series = suggestSeries(rows.map((it) => ({ ...it, bookId: "glati" })), { glati: rows });
  assert.equal(series.length, 1);
  assert.equal(series[0].rule.prefix, "PERMACOLOR SELECT COLOR KIT");
  assert.equal(series[0].count, 4);
  assert.ok(!series[0].sample.some((c) => /base/i.test(c)));
});

// CEG-Lite (field report 2026-07-22): the PART A&B kits form their OWN tight
// series (long shared prefix) while the colors only cluster under the short
// "CEG-LITE" frame — the superset filter must not let the kit series kill the
// color family, and the kits must never count as colors.
const CEG_ROWS = [
  ["CL09", "CEG-LITE 09 NATURAL GRAY"],
  ["CL10", "CEG-LITE 10 ANTIQUE WHITE"],
  ["CL45", "CEG-LITE 45 SUMMER WHEAT"],
  ["CL60", "CEG-LITE 60 CHARCOAL"],
  ["CLB1", "CEG-LITE PART A&B FULL UNIT 1G"],
  ["CLB2", "CEG-LITE PART A&B FULL UNIT 2G"],
  ["CLB3", "CEG-LITE PART A&B COMMERCIAL UNIT"],
].map(([sku, description]) => ({ sku, description, active: true, price: 30, unit: "EA" }));

test("suggestSeries finds the color family when the base rows form their own tighter series", () => {
  const series = suggestSeries(CEG_ROWS.map((it) => ({ ...it, bookId: "doit" })), { doit: CEG_ROWS });
  assert.equal(series.length, 1);
  assert.equal(series[0].rule.prefix, "CEG-LITE");
  assert.equal(series[0].count, 4);
  assert.ok(series[0].sample.includes("Natural Gray"));
  assert.ok(!series[0].sample.some((c) => /part|unit/i.test(c)));
});

test("resolveFamily never lists base-smelling rows as colors even when they match the rule", () => {
  const fam = normBookFamily({
    id: "ceg-lite", name: "CEG-Lite", bookId: "doit",
    rule: { prefix: "CEG-LITE", suffix: "" }, baseSkus: { default: "CLB1" }, cache: [],
  });
  const r = resolveFamily(fam, { doit: CEG_ROWS });
  assert.deepEqual(r.colors.map((c) => c.sku).sort(), ["CL09", "CL10", "CL45", "CL60"]);
  assert.equal(r.usedCache, false);
  assert.deepEqual(r.bases.map((b) => b.sku), ["CLB1"]); // marked bases still resolve
});

// --- Task 3: import-time sync + migration proposals ------------------------

// One book's (b1) live items covering every kind, plus a base companion, an
// epsilon pair, and two rows for the family cache-refresh case. GONE-SKU is
// deliberately absent (a linked SKU the ERP dropped).
const B1_ITEMS = [
  { sku: "GSKU", active: true, price: 12, unit: "BX", description: "Grout main" },
  { sku: "GSKU2", active: true, price: 20, unit: "EA", description: "Grout w/ base" },
  { sku: "BASE-SKU", active: true, price: 215, unit: "EA", description: "Base unit" },
  { sku: "EPSKU", active: true, price: 10.004, unit: "EA", description: "Epsilon grout" },
  { sku: "EPSKU2", active: true, price: 10.006, unit: "EA", description: "Epsilon grout 2" },
  { sku: "MSKU", active: true, price: 33, unit: "bg", description: "Mortar main" },
  { sku: "USKU", active: true, price: 15, unit: "roll", description: "Underlayment main" },
  { sku: "ASKU", active: true, price: 9.5, unit: "EA", description: "Attached main" },
  { sku: "TG10", active: true, price: 5, unit: "EA", description: "9LB TESTGROUT 10 RED PART C" },
  { sku: "TG20", active: true, price: 6, unit: "EA", description: "9LB TESTGROUT 20 BLUE PART C" },
  { sku: "INACTIVE-SKU", active: false, price: 99, unit: "EA", description: "Inactive item" },
];

function makeSyncCatalog() {
  return {
    companies: [
      {
        id: "co1", name: "Company One",
        grouts: [
          { id: "g-ok", name: "Ocean Grout", price: "10.00", unit: "EA", sku: "G-OLD", link: { bookId: "b1", sku: "GSKU" } },
          { id: "g-base", name: "Base Grout", price: "20.00", unit: "EA", sku: "", link: { bookId: "b1", sku: "GSKU2" },
            base: { sku: "BASE-SKU", name: "Full Unit", unit: "EA", price: "200.00", per: 1 } },
          { id: "g-lost", name: "Lost Grout", price: "5.00", unit: "EA", sku: "OLDSKU", link: { bookId: "b1", sku: "GONE-SKU" } },
          { id: "g-unlinked", name: "Unlinked Grout", price: "7.00", unit: "EA", sku: "", link: null },
          { id: "g-eps", name: "Epsilon Grout", price: "10.000", unit: "EA", sku: "EPSKU", link: { bookId: "b1", sku: "EPSKU" } },
          { id: "g-eps2", name: "Epsilon Grout 2", price: "10.000", unit: "EA", sku: "EPSKU2", link: { bookId: "b1", sku: "EPSKU2" } },
          { id: "g-base-unlinked", name: "Unlinked Base Grout", price: "9.00", unit: "EA", sku: "", link: null,
            base: { sku: "BASE-SKU", name: "Full Unit", unit: "EA", price: "150.00", per: 1 } },
          { id: "g-inactive-link", name: "Inactive Link Grout", price: "6.00", unit: "EA", sku: "OLDSKU2", link: { bookId: "b1", sku: "INACTIVE-SKU" } },
        ],
        mortars: [
          { id: "m-ok", name: "Mortar One", price: "30.00", unit: "bags", sku: "MOLD", link: { bookId: "b1", sku: "MSKU" } },
        ],
        underlayments: [
          { id: "u-ok", name: "Underlay One", price: "15.00", unit: "rolls", sku: "UOLD", link: { bookId: "b1", sku: "USKU" } },
        ],
        attached: [
          { id: "a-ok", name: "Attached One", price: "8.00", unit: "EA", sku: "AOLD", categoryId: "cat1", link: { bookId: "b1", sku: "ASKU" } },
        ],
      },
      {
        id: "co2", name: "Company Two",
        grouts: [
          { id: "g-other", name: "Other Book Grout", price: "50.00", unit: "EA", sku: "OSKU", link: { bookId: "b2", sku: "OSKU" } },
        ],
        mortars: [], underlayments: [], attached: [],
      },
    ],
    bookFamilies: [
      {
        id: "test-family", name: "Test Family", bookId: "b1",
        rule: { prefix: "9LB TESTGROUT", suffix: "PART C" },
        baseSkus: { default: "", variant: "" }, caulk: null,
        cache: [{ color: "Red", num: "10", sku: "TG10", price: 5, unit: "EA" }],
      },
      {
        id: "other-book-family", name: "Other Book Family", bookId: "b2",
        rule: { prefix: "X", suffix: "" },
        baseSkus: { default: "", variant: "" }, caulk: null,
        cache: [],
      },
      {
        id: "fresh-family", name: "Fresh Family", bookId: "b1",
        rule: { prefix: "9LB TESTGROUT", suffix: "PART C" },
        baseSkus: { default: "", variant: "" }, caulk: null,
        cache: [], // first population: never seeded before
      },
    ],
  };
}

test("syncLinkedCatalog refreshes a linked product's price+unit and logs a change entry", () => {
  const { catalog, changes } = syncLinkedCatalog(makeSyncCatalog(), "b1", B1_ITEMS);
  const g = catalog.companies[0].grouts.find((p) => p.id === "g-ok");
  assert.equal(g.price, 12);
  assert.equal(g.unit, "BX");
  assert.equal(g.sku, "GSKU");
  assert.equal(g.name, "Ocean Grout"); // name never changes
  assert.deepEqual(changes.find((c) => c.name === "Ocean Grout"), { name: "Ocean Grout", from: 10, to: 12, sku: "GSKU" });
});

test("syncLinkedCatalog leaves a product with an absent linked SKU untouched and reports it lost", () => {
  const { catalog, lost } = syncLinkedCatalog(makeSyncCatalog(), "b1", B1_ITEMS);
  const g = catalog.companies[0].grouts.find((p) => p.id === "g-lost");
  assert.equal(g.price, "5.00");
  assert.equal(g.unit, "EA");
  assert.equal(g.sku, "OLDSKU");
  assert.equal(g.name, "Lost Grout");
  assert.ok(lost.some((l) => l.name === "Lost Grout" && l.sku === "GONE-SKU"));
});

test("syncLinkedCatalog leaves an unlinked product completely untouched", () => {
  const before = makeSyncCatalog().companies[0].grouts.find((p) => p.id === "g-unlinked");
  const { catalog } = syncLinkedCatalog(makeSyncCatalog(), "b1", B1_ITEMS);
  const after = catalog.companies[0].grouts.find((p) => p.id === "g-unlinked");
  assert.deepEqual(after, before);
});

test("syncLinkedCatalog leaves a product linked into a DIFFERENT book untouched and doesn't mark it lost", () => {
  const before = makeSyncCatalog().companies[1].grouts.find((p) => p.id === "g-other");
  const { catalog, lost } = syncLinkedCatalog(makeSyncCatalog(), "b1", B1_ITEMS);
  const after = catalog.companies[1].grouts.find((p) => p.id === "g-other");
  assert.deepEqual(after, before);
  assert.ok(!lost.some((l) => l.name === "Other Book Grout"));
});

test("syncLinkedCatalog syncs mortars, underlayments, and attached products too", () => {
  const { catalog, changes } = syncLinkedCatalog(makeSyncCatalog(), "b1", B1_ITEMS);
  const m = catalog.companies[0].mortars.find((p) => p.id === "m-ok");
  assert.equal(m.price, 33);
  assert.equal(m.unit, "bg");
  assert.equal(m.sku, "MSKU");
  assert.ok(changes.some((c) => c.name === "Mortar One" && c.from === 30 && c.to === 33));

  // underlayment: price unchanged, unit differs — refreshes silently, no change entry
  const u = catalog.companies[0].underlayments.find((p) => p.id === "u-ok");
  assert.equal(u.price, 15);
  assert.equal(u.unit, "roll");
  assert.ok(!changes.some((c) => c.name === "Underlay One"));

  const a = catalog.companies[0].attached.find((p) => p.id === "a-ok");
  assert.equal(a.price, 9.5);
  assert.equal(a.unit, "EA");
  assert.equal(a.name, "Attached One");
  assert.ok(changes.some((c) => c.name === "Attached One" && c.from === 8 && c.to === 9.5 && c.sku === "ASKU"));
});

test("syncLinkedCatalog refreshes a grout's base companion price via base.sku", () => {
  const { catalog, changes } = syncLinkedCatalog(makeSyncCatalog(), "b1", B1_ITEMS);
  const g = catalog.companies[0].grouts.find((p) => p.id === "g-base");
  assert.equal(g.base.price, 215);
  assert.equal(g.base.sku, "BASE-SKU");
  assert.equal(g.base.name, "Full Unit"); // base identity fields untouched
  assert.ok(changes.some((c) => c.name === "Base Grout — base" && c.from === 200 && c.to === 215 && c.sku === "BASE-SKU"));
});

test("syncLinkedCatalog honors the 0.005 epsilon: a smaller diff is not a change and doesn't touch price", () => {
  const { catalog, changes } = syncLinkedCatalog(makeSyncCatalog(), "b1", B1_ITEMS);
  const g = catalog.companies[0].grouts.find((p) => p.id === "g-eps");
  assert.equal(g.price, "10.000"); // untouched: 10.004 - 10.000 = 0.004, not > epsilon
  assert.ok(!changes.some((c) => c.name === "Epsilon Grout"));

  const g2 = catalog.companies[0].grouts.find((p) => p.id === "g-eps2");
  assert.equal(g2.price, 10.006); // 10.006 - 10.000 = 0.006 > epsilon: refreshed
  assert.ok(changes.some((c) => c.name === "Epsilon Grout 2" && c.from === 10 && c.to === 10.006));
});

test("syncLinkedCatalog refreshes the matching family's cache and counts newColors", () => {
  const { catalog, newColors } = syncLinkedCatalog(makeSyncCatalog(), "b1", B1_ITEMS);
  const fam = catalog.bookFamilies.find((f) => f.id === "test-family");
  assert.deepEqual(fam.cache.map((c) => c.sku).sort(), ["TG10", "TG20"]);
  assert.deepEqual(newColors, [{ family: "Test Family", count: 1 }]);

  // a family bound to a different book is untouched by this sync call
  const other = catalog.bookFamilies.find((f) => f.id === "other-book-family");
  assert.deepEqual(other, makeSyncCatalog().bookFamilies[1]);
});

// Plan-mandated (adjudicated 2026-07-22): base.sku refresh is NOT gated on the
// product's own link — a book-family grout carries a base companion but no
// item link at all, and every stock book exports from the same ERP, so a SKU
// identifies one item globally. Pinned here so this stays explicit.
test("syncLinkedCatalog refreshes a base companion even when the product itself carries no link", () => {
  const { catalog, changes } = syncLinkedCatalog(makeSyncCatalog(), "b1", B1_ITEMS);
  const g = catalog.companies[0].grouts.find((p) => p.id === "g-base-unlinked");
  assert.equal(g.link, null);
  assert.equal(g.base.price, 215);
  assert.equal(g.base.sku, "BASE-SKU");
  assert.equal(g.name, "Unlinked Base Grout");
  assert.ok(changes.some((c) => c.name === "Unlinked Base Grout — base" && c.from === 150 && c.to === 215 && c.sku === "BASE-SKU"));
});

test("syncLinkedCatalog treats a linked SKU that exists but is inactive as lost (keep-and-warn), product untouched", () => {
  const { catalog, lost } = syncLinkedCatalog(makeSyncCatalog(), "b1", B1_ITEMS);
  const g = catalog.companies[0].grouts.find((p) => p.id === "g-inactive-link");
  assert.equal(g.price, "6.00");
  assert.equal(g.unit, "EA");
  assert.equal(g.sku, "OLDSKU2");
  assert.equal(g.name, "Inactive Link Grout");
  assert.ok(lost.some((l) => l.name === "Inactive Link Grout" && l.sku === "INACTIVE-SKU"));
});

test("syncLinkedCatalog does not report newColors on a family's first population (empty cache)", () => {
  const { catalog, newColors } = syncLinkedCatalog(makeSyncCatalog(), "b1", B1_ITEMS);
  const fam = catalog.bookFamilies.find((f) => f.id === "fresh-family");
  assert.deepEqual(fam.cache.map((c) => c.sku).sort(), ["TG10", "TG20"]); // colors DID fill in
  assert.ok(!newColors.some((n) => n.family === "Fresh Family")); // but none reported as "new"
});

// --- dirty flag (persistence gate) -------------------------------------------

test("syncLinkedCatalog reports dirty on a unit-only refresh even though it logs no changes entry", () => {
  const catalog = {
    companies: [{
      id: "co1", name: "Co",
      grouts: [{ id: "g1", name: "Unit Only Grout", price: "10.00", unit: "EA", sku: "OLD", link: { bookId: "b1", sku: "USKU" } }],
      mortars: [], underlayments: [], attached: [],
    }],
    bookFamilies: [],
  };
  const items = [{ sku: "USKU", active: true, price: 10, unit: "BX", description: "Unit only" }];
  const { catalog: next, changes, dirty } = syncLinkedCatalog(catalog, "b1", items);
  assert.equal(dirty, true);
  assert.equal(changes.length, 0);
  assert.equal(next.companies[0].grouts[0].unit, "BX");
});

test("syncLinkedCatalog reports dirty on a family cache rewrite with no newColors (first population)", () => {
  const catalog = {
    companies: [{ id: "co1", name: "Co", grouts: [], mortars: [], underlayments: [], attached: [] }],
    bookFamilies: [{
      id: "fam1", name: "Fresh Family", bookId: "b1",
      rule: { prefix: "9LB TESTGROUT", suffix: "PART C" },
      baseSkus: { default: "", variant: "" }, caulk: null,
      cache: [], // first population: never seeded before
    }],
  };
  const items = [
    { sku: "TG10", active: true, price: 5, unit: "EA", description: "9LB TESTGROUT 10 RED PART C" },
    { sku: "TG20", active: true, price: 6, unit: "EA", description: "9LB TESTGROUT 20 BLUE PART C" },
  ];
  const { catalog: next, newColors, dirty } = syncLinkedCatalog(catalog, "b1", items);
  assert.equal(dirty, true);
  assert.deepEqual(newColors, []);
  assert.deepEqual(next.bookFamilies[0].cache.map((c) => c.sku).sort(), ["TG10", "TG20"]);
});

test("syncLinkedCatalog reports dirty:false when there is nothing to sync", () => {
  const catalog = {
    companies: [{
      id: "co1", name: "Co",
      grouts: [{ id: "g1", name: "Untouched Grout", price: "10.00", unit: "EA", sku: "", link: null }],
      mortars: [], underlayments: [], attached: [],
    }],
    bookFamilies: [],
  };
  const items = [{ sku: "X", active: true, price: 1, unit: "EA", description: "irrelevant" }];
  const { dirty, changes, lost, newColors } = syncLinkedCatalog(catalog, "b1", items);
  assert.equal(dirty, false);
  assert.equal(changes.length, 0);
  assert.equal(lost.length, 0);
  assert.equal(newColors.length, 0);
});

test("linkedItemState covers null/ok/inactive/missing", () => {
  const itemsByBook = { b1: [{ sku: "OK1", active: true }, { sku: "INACT1", active: false }] };
  assert.equal(linkedItemState(null, itemsByBook), null);
  assert.equal(linkedItemState({ bookId: "", sku: "OK1" }, itemsByBook), null);
  assert.equal(linkedItemState({ bookId: "b1", sku: "OK1" }, itemsByBook), "ok");
  assert.equal(linkedItemState({ bookId: "b1", sku: "INACT1" }, itemsByBook), "inactive");
  assert.equal(linkedItemState({ bookId: "b1", sku: "MISSING1" }, itemsByBook), "missing");
  assert.equal(linkedItemState({ bookId: "b2", sku: "OK1" }, itemsByBook), "missing");
});

// --- proposeLinks / applyProposals ------------------------------------------

const PROPOSE_BOOKS = [
  { id: "b1", name: "Book One", kind: "stock" },
  { id: "b2", name: "Book Two", kind: "stock" },
  { id: "b3", name: "Order Book", kind: "order" },
  { id: "b4", name: "Inactive Stock Book", kind: "stock", active: false },
];
const PROPOSE_ITEMS_BY_BOOK = {
  b1: [{ sku: "U1", active: true }, { sku: "A1", active: true }],
  b2: [{ sku: "A1", active: true }],
  b3: [{ sku: "O1", active: true }],
  b4: [{ sku: "IN1", active: true }],
};

function makeProposeCatalog() {
  return {
    companies: [{
      id: "co1", name: "Company One",
      grouts: [
        { id: "p-unique", name: "Unique Product", price: "1.00", unit: "EA", sku: "U1", link: null },
        { id: "p-none", name: "No-match Product", price: "1.00", unit: "EA", sku: "N1", link: null },
        { id: "p-ambig", name: "Ambiguous Product", price: "1.00", unit: "EA", sku: "A1", link: null },
        { id: "p-order-only", name: "Order-book Product", price: "1.00", unit: "EA", sku: "O1", link: null },
        { id: "p-linked", name: "Already Linked Product", price: "1.00", unit: "EA", sku: "X1", link: { bookId: "b1", sku: "X1" } },
        { id: "p-nosku", name: "No SKU Product", price: "1.00", unit: "EA", sku: "", link: null },
        { id: "p-inactive-book", name: "Inactive-book Product", price: "1.00", unit: "EA", sku: "IN1", link: null },
      ],
      mortars: [], underlayments: [], attached: [],
    }],
  };
}

test("proposeLinks finds a unique stock-book match", () => {
  const { proposals } = proposeLinks(makeProposeCatalog(), PROPOSE_ITEMS_BY_BOOK, PROPOSE_BOOKS);
  const p = proposals.find((pr) => pr.productId === "p-unique");
  assert.ok(p);
  assert.deepEqual(p, {
    companyId: "co1", companyName: "Company One", kind: "grouts",
    productId: "p-unique", name: "Unique Product", sku: "U1",
    bookId: "b1", bookName: "Book One",
  });
});

test("proposeLinks reports 'none' when no stock book carries the SKU (order-book-only counts as none)", () => {
  const { unmatched } = proposeLinks(makeProposeCatalog(), PROPOSE_ITEMS_BY_BOOK, PROPOSE_BOOKS);
  assert.ok(unmatched.some((u) => u.name === "No-match Product" && u.sku === "N1" && u.reason === "none"));
  assert.ok(unmatched.some((u) => u.name === "Order-book Product" && u.sku === "O1" && u.reason === "none"));
});

test("proposeLinks reports 'ambiguous' when more than one stock book carries the SKU", () => {
  const { unmatched, proposals } = proposeLinks(makeProposeCatalog(), PROPOSE_ITEMS_BY_BOOK, PROPOSE_BOOKS);
  assert.ok(unmatched.some((u) => u.name === "Ambiguous Product" && u.sku === "A1" && u.reason === "ambiguous"));
  assert.ok(!proposals.some((p) => p.productId === "p-ambig"));
});

test("proposeLinks skips products that already carry a link or have no SKU", () => {
  const { proposals, unmatched } = proposeLinks(makeProposeCatalog(), PROPOSE_ITEMS_BY_BOOK, PROPOSE_BOOKS);
  assert.ok(!proposals.some((p) => p.productId === "p-linked"));
  assert.ok(!unmatched.some((u) => u.name === "Already Linked Product"));
  assert.ok(!proposals.some((p) => p.productId === "p-nosku"));
  assert.ok(!unmatched.some((u) => u.name === "No SKU Product"));
});

test("proposeLinks never proposes a match from a stock book flagged inactive", () => {
  const { proposals, unmatched } = proposeLinks(makeProposeCatalog(), PROPOSE_ITEMS_BY_BOOK, PROPOSE_BOOKS);
  assert.ok(!proposals.some((p) => p.productId === "p-inactive-book"));
  assert.ok(unmatched.some((u) => u.name === "Inactive-book Product" && u.sku === "IN1" && u.reason === "none"));
});

test("applyProposals stamps link on proposed products only, round-tripping through proposeLinks", () => {
  const catalog = makeProposeCatalog();
  const { proposals } = proposeLinks(catalog, PROPOSE_ITEMS_BY_BOOK, PROPOSE_BOOKS);
  const next = applyProposals(catalog, proposals);
  const unique = next.companies[0].grouts.find((p) => p.id === "p-unique");
  assert.deepEqual(unique.link, { bookId: "b1", sku: "U1" });
  assert.equal(unique.name, "Unique Product"); // name untouched

  // an untouched product (no proposal) keeps its original link value
  const none = next.companies[0].grouts.find((p) => p.id === "p-none");
  assert.equal(none.link, null);
  const alreadyLinked = next.companies[0].grouts.find((p) => p.id === "p-linked");
  assert.deepEqual(alreadyLinked.link, { bookId: "b1", sku: "X1" });
});
