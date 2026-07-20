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

// Two-variant labels (v3 port): one tile sold in two sizes shares a single
// label — these fields get a second column (`fields2`) when `twoVariant` is on.
// Label-level only; presets don't carry it.
export const VARIANT_KEYS = ["sku", "size", "price"];
const blankFields2 = () => Object.fromEntries(VARIANT_KEYS.map((k) => [k, ""]));

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
  const fields2 = { ...blankFields2() };
  for (const k of VARIANT_KEYS) if (raw?.fields2?.[k] != null) fields2[k] = String(raw.fields2[k]);
  return {
    id: str(raw?.id) || uid(),
    position: num(raw?.position, 0),
    presetId: str(raw?.presetId) || "sample-tag",
    w: Math.max(0.25, num(raw?.w, 1.5)),
    h: Math.max(0.25, num(raw?.h, 2.5)),
    header: raw?.header != null ? str(raw.header) : "Keim",
    lines: normLines(raw?.lines),
    fields,
    twoVariant: raw?.twoVariant === true,
    fields2,
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
  twoVariant: false,
  fields2: blankFields2(),
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

// Pull a "12x24"-style face size out of the price book's size text (mirrors
// App.jsx faceSize; duplicated here to keep labels.js dependency-free).
export const faceSizeText = (size) => {
  const s = str(size);
  const m = s.match(/^\s*(\d+(?:\.\d+)?\s*["']?\s*[x×]\s*\d+(?:\.\d+)?\s*["']?)/i);
  return (m ? m[1] : s).trim();
};

const money = (n) => `$${(Math.round(n * 100) / 100).toFixed(2)}`;

// Map a normalized StockItem (see stock.js normStockItem) to editable label
// fields. A prefill only — the user edits freely afterward, nothing re-reads.
export const stockToLabelFields = (item) => {
  if (!item) return {};
  const psf = item.priceSqft != null ? item.priceSqft
    : (item.price != null && item.sfPerUnit > 0 ? item.price / item.sfPerUnit : null);
  return {
    name: str(item.description) || str(item.product),
    sku: str(item.sku),
    size: faceSizeText(item.size) || str(item.sheetSize),
    price: psf != null ? `${money(psf)}/sq ft` : (item.price != null ? money(item.price) : ""),
    brand: str(item.brand),
    thickness: str(item.thickness),
  };
};

export const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// The default "Keim" header renders as the logo wordmark; any other typed
// header stays plain text.
export const isKeimHeader = (h) => str(h || "Keim").toLowerCase() === "keim";

const surfaceColor = (s) => (s === "Wall" ? "#B5654A" : s === "Floor & Wall" ? "#7d6a8a" : "#5C6B73");

const LABEL_OF = Object.fromEntries(LABEL_FIELDS.map((f) => [f.key, f.label]));

// One card as a standalone HTML string (used by the print window). Kept as a
// string — not React — so printing runs in a clean popup free of app CSS.
// `logoSrc` is passed in (not imported) so this module stays asset-free and
// unit-testable; without it the header always falls back to text.
export const labelCardHTML = (label, { logoSrc } = {}) => {
  const val = (k) => escapeHtml(label.fields?.[k] || "");
  const val2 = (k) => escapeHtml(label.fields2?.[k] || "");
  const header = logoSrc && isKeimHeader(label.header)
    ? `<img src="${escapeHtml(logoSrc)}" alt="Keim" style="height:14px;width:auto;align-self:flex-start;filter:brightness(0) invert(1);">`
    : `<div style="font-family:'Oswald',sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:.3em;color:#fff;">${escapeHtml(label.header || "Keim")}</div>`;
  // Two-variant: the shown variant lines render once, as a two-column block at
  // the first variant line's spot; the other variant lines emit nothing.
  const variantLines = label.twoVariant ? (label.lines || []).filter((l) => l.show && VARIANT_KEYS.includes(l.key)) : [];
  const firstVariant = variantLines[0]?.key;
  const variantCol = (get) => variantLines.map((l) => {
    const mono = l.key === "sku" ? "font-family:ui-monospace,monospace;" : "";
    return `<div style="margin-top:6px;"><div style="font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#9a9a9a;font-weight:700;line-height:1;">${escapeHtml(LABEL_OF[l.key])}</div><div style="color:#fff;line-height:1.3;font-size:${l.size}px;${mono}word-break:break-word;">${get(l.key) || "—"}</div></div>`;
  }).join("");
  const variantBlock = `<div style="display:flex;gap:8px;"><div style="flex:1;min-width:0;">${variantCol(val)}</div><div style="width:1px;background:rgba(255,255,255,.18);align-self:stretch;margin-top:6px;"></div><div style="flex:1;min-width:0;">${variantCol(val2)}</div></div>`;
  const body = (label.lines || []).filter((l) => l.show).map((l) => {
    if (l.key === "name") return `<div style="font-family:'Oswald',sans-serif;font-size:${l.size}px;text-transform:uppercase;letter-spacing:.03em;line-height:1.12;color:#fff;word-break:break-word;">${val("name") || "Tile Name"}</div>`;
    if (l.key === "surface") return `<span style="align-self:flex-start;margin-top:6px;font-size:8px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;padding:2px 7px;border-radius:4px;color:#fff;background:${surfaceColor(label.fields?.surface)};">${val("surface")}</span>`;
    if (label.twoVariant && VARIANT_KEYS.includes(l.key)) return l.key === firstVariant ? variantBlock : "";
    const mono = l.key === "sku" ? "font-family:ui-monospace,monospace;" : "";
    return `<div style="margin-top:6px;"><div style="font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#9a9a9a;font-weight:700;line-height:1;">${escapeHtml(LABEL_OF[l.key])}</div><div style="color:#fff;line-height:1.3;font-size:${l.size}px;${mono}">${val(l.key) || "—"}</div></div>`;
  }).join("");
  return `<div style="width:${label.w}in;height:${label.h}in;background:#1A1A1A;color:#fff;border-radius:3px;padding:.12in;font-family:'Inter',sans-serif;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;">
    ${header}
    <div style="border-top:1px solid rgba(255,255,255,.2);margin:6px 0 2px;"></div>
    ${body}
  </div>`;
};
