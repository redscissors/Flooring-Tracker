import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LABEL_FIELDS, BUILTIN_PRESETS, BUILTIN_IDS, clampSize,
  normPreset, normLabelPresets, customLabelPresets, normLabel, newDraftFromPreset,
  perLetterSheet, sheetsForLabels,
  faceSizeText, stockToLabelFields, escapeHtml, labelCardHTML, normLabel as _normLabel,
  isSpacer, clampSpace, newSpacerLine, SPACE_MIN, SPACE_MAX, SPACE_DEFAULT,
} from "./labels.js";

// --- presets ------------------------------------------------------------------

test("BUILTIN_PRESETS has the two shipped sizes with real dimensions", () => {
  const ids = BUILTIN_PRESETS.map((p) => p.id);
  assert.deepEqual(ids, ["sample-tag", "spec-card"]);
  const tag = BUILTIN_PRESETS.find((p) => p.id === "sample-tag");
  assert.equal(tag.w, 1.5);
  assert.equal(tag.h, 2.5);
  assert.equal(tag.header, "Keim");
});

test("normPreset fills every field as a line and clamps sizes", () => {
  const p = normPreset({ id: "x", name: "X", w: 3, h: 4, header: "Keim", lines: [{ key: "name", show: true, size: 999 }] });
  // every LABEL_FIELDS key is present exactly once
  assert.deepEqual(new Set(p.lines.map((l) => l.key)), new Set(LABEL_FIELDS.map((f) => f.key)));
  assert.equal(p.lines.find((l) => l.key === "name").size, 40); // clamped to MAX
  // a field absent from raw is appended hidden
  assert.equal(p.lines.find((l) => l.key === "note").show, false);
});

test("normLabelPresets always includes built-ins plus normalized customs", () => {
  const out = normLabelPresets([{ id: "custom1", name: "Wood", w: 4, h: 2.75, header: "Keim", lines: [] }]);
  assert.ok(out.some((p) => p.id === "sample-tag"));
  assert.ok(out.some((p) => p.id === "spec-card"));
  const custom = out.find((p) => p.id === "custom1");
  assert.equal(custom.w, 4);
  assert.equal(custom.lines.length, LABEL_FIELDS.length);
});

test("customLabelPresets drops the built-ins (what we persist)", () => {
  const all = normLabelPresets([{ id: "custom1", name: "Wood", w: 4, h: 2.75, header: "Keim", lines: [] }]);
  const customs = customLabelPresets(all);
  assert.deepEqual(customs.map((p) => p.id), ["custom1"]);
  assert.ok(!customs.some((p) => BUILTIN_IDS.has(p.id)));
});

test("clampSize keeps sizes in the 6..40 range", () => {
  assert.equal(clampSize(2), 6);
  assert.equal(clampSize(100), 40);
  assert.equal(clampSize(12), 12);
});

// --- labels -------------------------------------------------------------------

test("normLabel coerces all fields to strings; surface stays blank (no pill) unless picked", () => {
  const l = normLabel({ id: "l1", position: 3, presetId: "sample-tag", fields: { name: 12, price: null } });
  assert.equal(l.fields.name, "12");
  assert.equal(l.fields.price, "");
  assert.equal(l.fields.surface, "");
  assert.equal(l.position, 3);
  // old records that saved a surface keep it
  const old = normLabel({ id: "l2", fields: { surface: "Floor" } });
  assert.equal(old.fields.surface, "Floor");
});

test("newDraftFromPreset clones the preset layout and blanks the fields", () => {
  const d = newDraftFromPreset(BUILTIN_PRESETS[0]);
  assert.equal(d.presetId, "sample-tag");
  assert.equal(d.w, 1.5);
  assert.equal(d.fields.name, "");
  assert.equal(d.fields.surface, "");
  // mutating the draft's lines must not touch the built-in
  d.lines[0].show = false;
  assert.notEqual(BUILTIN_PRESETS[0].lines[0].show, false);
});

// --- sheet math ---------------------------------------------------------------

test("perLetterSheet matches the cut-apart letter layout", () => {
  assert.equal(perLetterSheet({ w: 1.5, h: 2.5 }), 12); // Sample Tag
  assert.equal(perLetterSheet({ w: 3, h: 4 }), 4);      // Spec Card
});

test("perLetterSheet is 0 for a label too big for a sheet", () => {
  assert.equal(perLetterSheet({ w: 12, h: 12 }), 0);
});

test("sheetsForLabels sums fractional coverage across mixed sizes", () => {
  const tag = { w: 1.5, h: 2.5 }, card = { w: 3, h: 4 };
  assert.equal(sheetsForLabels([tag, tag, tag]), 1);            // 3/12 -> 1
  assert.equal(sheetsForLabels(Array(13).fill(tag)), 2);        // 13/12 -> 2
  assert.equal(sheetsForLabels([card, card, card, card, card]), 2); // 5/4 -> 2
  assert.equal(sheetsForLabels([]), 0);
});

// --- stock mapping ------------------------------------------------------------

test("faceSizeText pulls a clean LxW out of vendor size text", () => {
  assert.equal(faceSizeText('12" x 24" Nominal'), '12" x 24"');
  assert.equal(faceSizeText("12x24"), "12x24");
  assert.equal(faceSizeText('2" Hex'), '2" Hex'); // no LxW -> returned as-is
});

test("stockToLabelFields maps a normalized stock item to label fields", () => {
  const f = stockToLabelFields({ sku: "CM-2046", description: "Carrara Marble Polished", size: '12" x 24"', priceSqft: 8.99, brand: "Anatolia", thickness: '3/8"' });
  assert.equal(f.name, "Carrara Marble Polished");
  assert.equal(f.sku, "CM-2046");
  assert.equal(f.size, '12" x 24"');
  assert.equal(f.price, "$8.99/sq ft");
  assert.equal(f.brand, "Anatolia");
  assert.equal(f.thickness, '3/8"');
});

test("stockToLabelFields derives $/sf from carton price when priceSqft is absent", () => {
  const f = stockToLabelFields({ sku: "X", product: "Tile X", price: 50, sfPerUnit: 10 });
  assert.equal(f.name, "Tile X");
  assert.equal(f.price, "$5.00/sq ft");
});

test("escapeHtml neutralizes markup", () => {
  assert.equal(escapeHtml('<b>&"'), "&lt;b&gt;&amp;&quot;");
});

// --- two-variant labels -------------------------------------------------------

test("normLabel defaults twoVariant off with blank fields2, keeps old records valid", () => {
  const old = normLabel({ id: "l1", presetId: "sample-tag", fields: { name: "Carrara" } });
  assert.equal(old.twoVariant, false);
  assert.deepEqual(old.fields2, { sku: "", size: "", price: "" });
  const two = normLabel({ id: "l2", twoVariant: true, fields2: { sku: "CM-2048", size: 12, junk: "x" } });
  assert.equal(two.twoVariant, true);
  assert.equal(two.fields2.sku, "CM-2048");
  assert.equal(two.fields2.size, "12"); // coerced to string
  assert.equal(two.fields2.junk, undefined); // only VARIANT_KEYS survive
});

test("newDraftFromPreset starts single-variant", () => {
  const d = newDraftFromPreset(BUILTIN_PRESETS[0]);
  assert.equal(d.twoVariant, false);
  assert.deepEqual(d.fields2, { sku: "", size: "", price: "" });
});

test("labelCardHTML renders a two-variant label as one split block", () => {
  const l = _normLabel({ id: "l1", presetId: "sample-tag", w: 2, h: 2.5, header: "Keim", twoVariant: true,
    lines: [
      { key: "name", show: true, size: 13 }, { key: "sku", show: true, size: 10 },
      { key: "size", show: true, size: 10 }, { key: "price", show: false, size: 10 },
    ],
    fields: { name: "Carrara", sku: "CM-2046", size: '12" x 24"' },
    fields2: { sku: "CM-2048", size: '12" x 48"', price: "$9.99/sq ft" } });
  const html = labelCardHTML(l);
  assert.match(html, /CM-2046/);
  assert.match(html, /CM-2048/);
  assert.match(html, /12&quot; x 48&quot;/);
  assert.doesNotMatch(html, /\$9\.99/); // price line hidden -> hidden in both columns
  // each shown variant field's caption appears exactly twice (once per column)
  assert.equal(html.split(">SKU<").length - 1, 2);
  assert.equal(html.split(">Size<").length - 1, 2);
});

test("labelCardHTML ignores fields2 when twoVariant is off", () => {
  const l = _normLabel({ id: "l1", presetId: "sample-tag",
    lines: [{ key: "name", show: true, size: 13 }, { key: "sku", show: true, size: 10 }],
    fields: { name: "Carrara", sku: "CM-2046" }, fields2: { sku: "CM-2048" } });
  const html = labelCardHTML(l);
  assert.match(html, /CM-2046/);
  assert.doesNotMatch(html, /CM-2048/);
  assert.equal(html.split(">SKU<").length - 1, 1);
});

test("labelCardHTML skips the surface pill when no surface is picked", () => {
  const lines = [{ key: "name", show: true, size: 13 }, { key: "surface", show: true, size: 9 }];
  const none = labelCardHTML(_normLabel({ id: "l1", lines, fields: { name: "Carrara" } }));
  assert.doesNotMatch(none, /border-radius:4px/); // the pill's telltale style
  const wall = labelCardHTML(_normLabel({ id: "l2", lines, fields: { name: "Carrara", surface: "Wall" } }));
  assert.match(wall, /Wall/);
  assert.match(wall, /border-radius:4px/);
});

test("custom lines print as caption-less free text and vanish when blank", () => {
  const lines = [
    { key: "name", show: true, size: 13 },
    { key: "custom1", show: true, size: 10 }, { key: "custom2", show: true, size: 10 },
  ];
  const l = _normLabel({ id: "l1", lines, fields: { name: "Carrara", custom1: "Grout: Silverado" } });
  const html = labelCardHTML(l);
  assert.match(html, /Grout: Silverado/);
  assert.doesNotMatch(html, /Custom line/); // no caption printed
  // the blank shown custom2 emits nothing — no dangling "—"
  assert.doesNotMatch(html, /—/);
});

test("custom lines are part of every normalized preset (appended hidden)", () => {
  const p = normPreset({ id: "x", name: "X", lines: [{ key: "name", show: true, size: 13 }] });
  for (const k of ["custom1", "custom2", "custom3"]) {
    const line = p.lines.find((l) => l.key === k);
    assert.ok(line);
    assert.equal(line.show, false);
  }
});

// --- filler spacer lines ------------------------------------------------------

test("newSpacerLine makes unique sp_ keys at the default height", () => {
  const a = newSpacerLine(), b = newSpacerLine();
  assert.ok(isSpacer(a.key));
  assert.notEqual(a.key, b.key);
  assert.equal(a.size, SPACE_DEFAULT);
  assert.equal(a.show, true);
  assert.ok(!isSpacer("sku"));
  assert.ok(!isSpacer("surface")); // "s" prefixes of real fields never collide
});

test("clampSpace keeps filler heights in the spacer range, not the font range", () => {
  assert.equal(clampSpace(0), SPACE_MIN);
  assert.equal(clampSpace(500), SPACE_MAX);
  assert.equal(clampSpace(24), 24);
  assert.equal(clampSpace("junk"), SPACE_DEFAULT);
});

test("spacer lines survive preset and label normalization in place", () => {
  const lines = [
    { key: "name", show: true, size: 13 },
    { key: "sp_gap1", show: true, size: 200 }, // clamped to SPACE_MAX
    { key: "sku", show: true, size: 10 },
    { key: "sp_gap2", show: false, size: 8 },
  ];
  for (const norm of [(ls) => normPreset({ id: "x", name: "X", lines: ls }), (ls) => normLabel({ id: "l1", lines: ls })]) {
    const out = norm(lines).lines;
    assert.deepEqual(out.slice(0, 4).map((l) => l.key), ["name", "sp_gap1", "sku", "sp_gap2"]);
    assert.equal(out[1].size, SPACE_MAX);
    assert.equal(out[3].show, false);
    // every fixed field still appended exactly once
    assert.deepEqual(new Set(out.filter((l) => !isSpacer(l.key)).map((l) => l.key)), new Set(LABEL_FIELDS.map((f) => f.key)));
  }
});

test("labelCardHTML prints a shown filler as blank height and skips a hidden one", () => {
  const l = _normLabel({ id: "l1", lines: [
    { key: "name", show: true, size: 13 },
    { key: "sp_gap1", show: true, size: 14 },
    { key: "sku", show: true, size: 10 },
    { key: "sp_gap2", show: false, size: 22 },
  ], fields: { name: "Carrara", sku: "CM-2046" } });
  const html = labelCardHTML(l);
  assert.match(html, /height:14px/);
  assert.doesNotMatch(html, /height:22px/);
  // blank space only — no caption, no dash placeholder
  assert.doesNotMatch(html, /Filler/);
});

test("labelCardHTML renders visible fields and skips hidden ones", () => {
  const l = _normLabel({ id: "l1", presetId: "sample-tag", w: 1.5, h: 2.5, header: "Keim",
    lines: [{ key: "name", show: true, size: 13 }, { key: "sku", show: true, size: 10 }, { key: "note", show: false, size: 9 }],
    fields: { name: "Carrara", sku: "CM-2046", note: "hidden note" } });
  const html = labelCardHTML(l);
  assert.match(html, /Carrara/);
  assert.match(html, /CM-2046/);
  assert.doesNotMatch(html, /hidden note/);
  assert.match(html, /width:1\.5in/);
});
