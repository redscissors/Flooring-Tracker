// Tile-sample Label Generator — pure logic (issue: label-generator-integration).
// No imports from app code so it stays acyclic and unit-testable, like stock.js.
//
// A Preset is a reusable template (size + which lines show + font sizes). A saved
// Label snapshots its own copy of that layout, so editing/removing a preset never
// changes an existing label (snapshot convention, as everywhere else in the app).

const str = (v) => (v == null ? "" : String(v).trim());
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

export const MIN_SIZE = 6;
export const MAX_SIZE = 40;
export const clampSize = (n) => Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(num(n, MIN_SIZE))));

// The fields a label can carry. `kind` drives how the card renders the line:
// title = the big name, surface = the Floor/Wall pill, text = a labelled row.
export const LABEL_FIELDS = [
  { key: "name", label: "Tile Name", kind: "title" },
  { key: "surface", label: "Floor or Wall", kind: "surface" },
  { key: "sku", label: "SKU", kind: "text" },
  { key: "size", label: "Size", kind: "text" },
  { key: "price", label: "Price", kind: "text" },
  { key: "grout", label: "Grout Color", kind: "text" },
  { key: "brand", label: "Brand", kind: "text" },
  { key: "thickness", label: "Thickness", kind: "text" },
  { key: "note", label: "Note", kind: "text" },
];
const FIELD_KEYS = LABEL_FIELDS.map((f) => f.key);
const isField = (k) => FIELD_KEYS.includes(k);

export const DEFAULT_SIZES = { name: 16, surface: 9, sku: 11, size: 11, price: 11, grout: 10, brand: 10, thickness: 10, note: 10 };

const line = (key, show, size) => ({ key, show, size });

export const BUILTIN_PRESETS = [
  {
    id: "sample-tag", name: "Sample Tag", w: 1.5, h: 2.5, header: "Keim",
    lines: [
      line("name", true, 13), line("surface", true, 8), line("sku", true, 10),
      line("size", true, 10), line("price", true, 10), line("grout", true, 9),
      line("brand", false, 9), line("thickness", false, 9), line("note", false, 9),
    ],
  },
  {
    id: "spec-card", name: "Spec Card", w: 3, h: 4, header: "Keim",
    lines: [
      line("name", true, 22), line("surface", true, 10), line("sku", true, 12),
      line("size", true, 12), line("price", true, 12), line("brand", true, 11),
      line("thickness", true, 11), line("grout", true, 11), line("note", false, 11),
    ],
  },
];
export const BUILTIN_IDS = new Set(BUILTIN_PRESETS.map((p) => p.id));

// Normalize a preset's lines: keep valid keys in their given order, drop unknowns
// and dupes, then append any missing fields as hidden — so every field is present.
const normLines = (raw) => {
  const seen = new Set();
  const out = [];
  for (const l of Array.isArray(raw) ? raw : []) {
    const key = str(l?.key);
    if (!isField(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(line(key, l?.show !== false, clampSize(l?.size ?? DEFAULT_SIZES[key])));
  }
  for (const key of FIELD_KEYS) if (!seen.has(key)) out.push(line(key, false, DEFAULT_SIZES[key]));
  return out;
};

export const normPreset = (raw) => ({
  id: str(raw?.id) || uid(),
  name: str(raw?.name) || "Untitled size",
  w: Math.max(0.25, num(raw?.w, 1.5)),
  h: Math.max(0.25, num(raw?.h, 2.5)),
  header: raw?.header != null ? str(raw.header) : "Keim",
  lines: normLines(raw?.lines),
});

// Built-ins are code-defined and always present; customs (anything whose id is
// not a built-in) are layered on top. Built-in ids in raw are ignored so code
// changes to the built-ins always win.
export const normLabelPresets = (raw) => {
  const customs = (Array.isArray(raw) ? raw : []).filter((p) => !BUILTIN_IDS.has(str(p?.id))).map(normPreset);
  return [...BUILTIN_PRESETS.map(normPreset), ...customs];
};
export const customLabelPresets = (presets) => (presets || []).filter((p) => !BUILTIN_IDS.has(p.id));

const blankFields = () => Object.fromEntries(LABEL_FIELDS.map((f) => [f.key, f.key === "surface" ? "Floor" : ""]));

export const normLabel = (raw) => {
  const fields = { ...blankFields() };
  for (const k of FIELD_KEYS) if (raw?.fields?.[k] != null) fields[k] = String(raw.fields[k]);
  if (!fields.surface) fields.surface = "Floor";
  return {
    id: str(raw?.id) || uid(),
    position: num(raw?.position, 0),
    presetId: str(raw?.presetId) || "sample-tag",
    w: Math.max(0.25, num(raw?.w, 1.5)),
    h: Math.max(0.25, num(raw?.h, 2.5)),
    header: raw?.header != null ? str(raw.header) : "Keim",
    lines: normLines(raw?.lines),
    fields,
    sku: raw?.sku ? str(raw.sku) : null,
    createdBy: str(raw?.createdBy),
    createdAt: num(raw?.createdAt, 0) || null,
  };
};

export const newDraftFromPreset = (preset) => ({
  presetId: preset.id,
  w: preset.w, h: preset.h, header: preset.header,
  lines: preset.lines.map((l) => ({ ...l })),
  fields: blankFields(),
  sku: null,
});

// Local id generator (crypto.randomUUID isn't available under `node --test`
// without a global; Math.random is fine for element ids).
function uid() { return "l" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }

// Cut-apart print geometry. Must match the print layout in AppsWorkspace:
// letter sheet, 0.3" page margin, 0.15" gutter, upright labels (no rotation) —
// so the "≈N per sheet" count equals what actually prints.
const SHEET_W = 8.5, SHEET_H = 11, MARGIN = 0.3, GAP = 0.15;

export const perLetterSheet = ({ w, h }) => {
  if (!(w > 0) || !(h > 0)) return 0;
  const usableW = SHEET_W - 2 * MARGIN, usableH = SHEET_H - 2 * MARGIN;
  const cols = Math.floor((usableW + GAP) / (w + GAP));
  const rows = Math.floor((usableH + GAP) / (h + GAP));
  return Math.max(0, cols) * Math.max(0, rows);
};

export const sheetsForLabels = (labels) => {
  let sheets = 0;
  for (const l of labels || []) {
    const per = perLetterSheet(l);
    sheets += per > 0 ? 1 / per : 1;
  }
  return Math.ceil(sheets);
};
