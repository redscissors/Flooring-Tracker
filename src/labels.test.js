import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LABEL_FIELDS, BUILTIN_PRESETS, BUILTIN_IDS, clampSize,
  normPreset, normLabelPresets, customLabelPresets, normLabel, newDraftFromPreset,
  perLetterSheet, sheetsForLabels,
  faceSizeText, stockToLabelFields, cleanLabelName, escapeHtml, labelCardHTML, normLabel as _normLabel,
  isSpacer, clampSpace, newSpacerLine, SPACE_MIN, SPACE_MAX, SPACE_DEFAULT,
  PIN_KEY, splitPinned, builtinDefault, isBuiltinOverridden,
  NAME_FLOOR, fitNameSize, faceArea, trimSize, twoSizeDraft, restyleLabel, refreshPlan,
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
  const f = stockToLabelFields({ sku: "X", product: "Glacier X", price: 50, sfPerUnit: 10 });
  assert.equal(f.name, "Glacier X");
  assert.equal(f.price, "$5.00/sq ft");
});

test("cleanLabelName drops the word Tile, dashes and manufacturer codes", () => {
  assert.equal(cleanLabelName("Marazzi Rice Tile - RC03 Natural"), "Marazzi Rice Natural");
  assert.equal(cleanLabelName("Daltile Tiles – ULRA1224 Ash"), "Daltile Ash");
  assert.equal(cleanLabelName("Tilework Glossy"), "Tilework Glossy");
  assert.equal(cleanLabelName("Meadow Hex 2in - 12x24 3/8\" 8mm"), "Meadow Hex 2in 12x24 3/8\" 8mm");
  assert.equal(cleanLabelName("Oak-Grey Plank"), "Oak-Grey Plank");
});

test("cleanLabelName drops the item's own mfg code even when it is all letters or digits", () => {
  assert.equal(cleanLabelName("Marazzi Rice Tile - MZRC Natural", "MZRC"), "Marazzi Rice Natural");
  assert.equal(cleanLabelName("Rice 44120 Natural", "44120"), "Rice Natural");
});

test("cleanLabelName keeps the raw name when cleaning would empty it", () => {
  assert.equal(cleanLabelName("Tile - RC03"), "Tile - RC03");
  assert.equal(cleanLabelName(""), "");
});

test("stockToLabelFields cleans the stock-book name", () => {
  const f = stockToLabelFields({ sku: "15042.07", description: "Marazzi Rice Tile - RC03 Natural", mfg: "RC03" });
  assert.equal(f.name, "Marazzi Rice Natural");
  assert.equal(f.sku, "15042.07");
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

// --- pin to bottom -------------------------------------------------------------

test("normLines keeps one pin divider where it was given and drops extras", () => {
  const p = normPreset({ id: "x", lines: [{ key: "name", show: true, size: 13 }, { key: "pin" }, { key: "grout", show: true, size: 9 }, { key: "pin" }] });
  const keys = p.lines.map((l) => l.key);
  assert.equal(keys.filter((k) => k === PIN_KEY).length, 1);
  assert.deepEqual(keys.slice(0, 3), ["name", "pin", "grout"]);
});

test("splitPinned: shown lines after the divider are the bottom group; none without a divider", () => {
  const withPin = normPreset({ lines: [{ key: "name", show: true }, { key: "pin" }, { key: "grout", show: true }, { key: "brand", show: false }] });
  const s = splitPinned(withPin.lines);
  assert.deepEqual(s.body.map((l) => l.key), ["name"]);
  assert.deepEqual(s.bottom.map((l) => l.key), ["grout"]);
  const legacy = normPreset({ lines: [{ key: "name", show: true }, { key: "grout", show: true }] });
  assert.deepEqual(splitPinned(legacy.lines).bottom, []);
  assert.deepEqual(splitPinned(legacy.lines).body.map((l) => l.key), ["name", "grout"]);
});

test("built-in templates pin Grout Color to the bottom", () => {
  for (const p of BUILTIN_PRESETS) {
    const keys = p.lines.map((l) => l.key);
    assert.equal(keys.indexOf("pin") + 1, keys.indexOf("grout"));
  }
});

test("a saved built-in id overrides the code default; an unchanged one isn't persisted", () => {
  const edited = { ...normPreset(BUILTIN_PRESETS[0]), h: 3 };
  const presets = normLabelPresets([edited]);
  assert.equal(presets.find((p) => p.id === "sample-tag").h, 3);
  assert.equal(isBuiltinOverridden(presets[0]), true);
  assert.deepEqual(customLabelPresets(presets).map((p) => p.id), ["sample-tag"]);
  const reset = normLabelPresets([builtinDefault("sample-tag")]);
  assert.equal(isBuiltinOverridden(reset[0]), false);
  assert.deepEqual(customLabelPresets(reset), []);
});

test("labelCardHTML puts pinned lines in a bottom group and tags the name", () => {
  const l = normLabel({ lines: [{ key: "name", show: true, size: 13 }, { key: "pin" }, { key: "grout", show: true, size: 9 }], fields: { name: "N", grout: "Bright White" } });
  const html = labelCardHTML(l);
  assert.match(html, /class="lc-name"/);
  assert.match(html, /margin-top:auto[^>]*>.*Grout Color.*Bright White/s);
});

test("labelCardHTML without a divider has no bottom group", () => {
  const l = normLabel({ lines: [{ key: "name", show: true, size: 13 }, { key: "grout", show: true, size: 9 }], fields: { name: "N" } });
  assert.doesNotMatch(labelCardHTML(l), /margin-top:auto/);
});

// --- name auto-fit + two sizes -------------------------------------------------

test("fitNameSize steps down by 0.5 until nothing overflows, stopping at the floor", () => {
  assert.equal(fitNameSize(() => false, 13), 13);
  assert.equal(fitNameSize((px) => px > 11, 13), 11);
  assert.equal(fitNameSize((px) => px > 10.5, 13), 10.5);
  assert.equal(fitNameSize(() => true, 13), NAME_FLOOR);
});

test("faceArea / trimSize", () => {
  assert.equal(faceArea("24x48"), 1152);
  assert.equal(faceArea('12" x 24"'), 288);
  assert.equal(faceArea("Hex 2in"), null);
  assert.equal(trimSize("Calacatta Gold Polished 24x48"), "Calacatta Gold Polished");
  assert.equal(trimSize('Alpine 12" x 24"'), "Alpine");
  assert.equal(trimSize("Meadow Hex 2in"), "Meadow Hex 2in");
});

test("twoSizeDraft puts the bigger face first whatever the pick order", () => {
  const small = { sku: "CG-1224", description: "Calacatta Gold Polished 12x24", size: "12x24", priceSqft: 6.4, brand: "Emser" };
  const big = { sku: "CG-2448", description: "Calacatta Gold Polished 24x48", size: "24x48", priceSqft: 7.25, brand: "Emser" };
  const d = twoSizeDraft(small, big);
  assert.equal(d.swapped, true);
  assert.equal(d.fields.sku, "CG-2448");
  assert.equal(d.fields.name, "Calacatta Gold Polished");
  assert.deepEqual(d.fields2, { sku: "CG-1224", size: "12x24", price: "$6.40/sq ft" });
  assert.equal(d.sku, "CG-2448");
  assert.equal(twoSizeDraft(big, small).swapped, false);
});

test("twoSizeDraft keeps the pick order when sizes tie or can't be read", () => {
  const a = { sku: "A", description: "Hex A", size: "Hex 2in", priceSqft: 1 };
  const b = { sku: "B", description: "Hex B", size: "Hex 3in", priceSqft: 2 };
  const d = twoSizeDraft(a, b);
  assert.equal(d.swapped, false);
  assert.equal(d.fields.sku, "A");
});

// --- restyle + stock-book refresh ----------------------------------------------

const keysOf = (c) => [String(c || "").trim(), String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "")].filter(Boolean);
const live = (o) => ({ active: true, ...o });

test("refreshPlan buckets changed / same / missing / noSku, price only", () => {
  const L = (id, f, extra = {}) => normLabel({ id, fields: f, ...extra });
  const labels = [
    L("a", { name: "Alpine", sku: "AL-1224", price: "$4.85/sq ft", grout: "Smoke" }),
    L("b", { name: "Oak", sku: "OP-848", price: "$3.95/sq ft" }),
    L("c", { name: "Terra", sku: "TR-66", price: "$2.95/sq ft" }),
    L("d", { name: "No sku" }),
  ];
  const stock = [live({ sku: "AL-1224", description: "Renamed", priceSqft: 5.15 }), live({ sku: "OP-848", priceSqft: 3.95 }), live({ sku: "TR-66", priceSqft: 1, disabled: true })];
  const plan = refreshPlan(labels, stock, keysOf);
  assert.deepEqual(plan.changed.map((c) => c.id), ["a"]);
  assert.equal(plan.changed[0].patch.fields.price, "$5.15/sq ft");
  assert.equal(plan.changed[0].patch.fields.name, "Alpine");
  assert.equal(plan.changed[0].patch.fields.grout, "Smoke");
  assert.deepEqual(plan.changed[0].before, { price: "$4.85/sq ft", price2: null });
  assert.deepEqual(plan.same.map((x) => x.id), ["b"]);
  assert.deepEqual(plan.missing.map((x) => x.id), ["c"]);
  assert.deepEqual(plan.missing[0].missingSkus, ["TR-66"]);
  assert.deepEqual(plan.noSku.map((x) => x.id), ["d"]);
});

test("refreshPlan falls back to the provenance sku and checks the second size in any spelling", () => {
  const l = normLabel({ id: "t", twoVariant: true, fields: { sku: "cg-2448", price: "$7.25/sq ft" }, fields2: { sku: "CG1224", price: "$6.40/sq ft" } });
  const stock = [live({ sku: "CG-2448", priceSqft: 6.95 }), live({ sku: "CG-1224", priceSqft: 6.4 })];
  const plan = refreshPlan([l], stock, keysOf);
  assert.equal(plan.changed.length, 1);
  assert.deepEqual(plan.changed[0].after, { price: "$6.95/sq ft", price2: "$6.40/sq ft" });
  const prov = normLabel({ id: "p", sku: "OP-848", fields: { price: "$1.00/sq ft" } });
  assert.equal(refreshPlan([prov], [live({ sku: "OP-848", priceSqft: 3.95 })], keysOf).changed[0].after.price, "$3.95/sq ft");
});

test("refreshPlan: a second SKU the book lost makes the label missing", () => {
  const l = normLabel({ id: "t", twoVariant: true, fields: { sku: "A", price: "$1.00/sq ft" }, fields2: { sku: "GONE", price: "$2.00/sq ft" } });
  const plan = refreshPlan([l], [live({ sku: "A", priceSqft: 1 })], keysOf);
  assert.deepEqual(plan.missing[0].missingSkus, ["GONE"]);
});

test("restyleLabel takes the template layout and keeps the text", () => {
  const tpl = normPreset({ id: "sample-tag", w: 1.5, h: 3, header: "Keim", lines: [{ key: "name", show: true, size: 20 }] });
  const l = normLabel({ id: "x", twoVariant: true, w: 2, fields: { name: "Keep me" }, lines: [{ key: "name", show: true, size: 9 }] });
  const p = restyleLabel(l, tpl);
  assert.equal(p.h, 3);
  assert.equal(p.w, 2);
  assert.equal(p.presetId, "sample-tag");
  assert.equal(p.lines.find((x) => x.key === "name").size, 20);
  assert.equal(p.fields, undefined);
  assert.equal(restyleLabel({ ...l, twoVariant: false }, tpl).w, 1.5);
});
