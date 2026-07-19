import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LABEL_FIELDS, BUILTIN_PRESETS, BUILTIN_IDS, clampSize,
  normPreset, normLabelPresets, customLabelPresets, normLabel, newDraftFromPreset,
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

test("normLabel coerces all fields to strings and defaults surface to Floor", () => {
  const l = normLabel({ id: "l1", position: 3, presetId: "sample-tag", fields: { name: 12, price: null } });
  assert.equal(l.fields.name, "12");
  assert.equal(l.fields.price, "");
  assert.equal(l.fields.surface, "Floor");
  assert.equal(l.position, 3);
});

test("newDraftFromPreset clones the preset layout and blanks the fields", () => {
  const d = newDraftFromPreset(BUILTIN_PRESETS[0]);
  assert.equal(d.presetId, "sample-tag");
  assert.equal(d.w, 1.5);
  assert.equal(d.fields.name, "");
  assert.equal(d.fields.surface, "Floor");
  // mutating the draft's lines must not touch the built-in
  d.lines[0].show = false;
  assert.notEqual(BUILTIN_PRESETS[0].lines[0].show, false);
});
