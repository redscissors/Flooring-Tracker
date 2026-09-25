// Tile-sample Label Generator — pure logic (issue: label-generator-integration).
// No imports from app code so it stays acyclic and unit-testable, like stock.js.
//
// A Preset is a reusable template (size + which lines show + font sizes). A saved
// Label snapshots its own copy of that layout, so editing a preset changes an
// existing label only when the team says yes to restyling it (restyleLabel).

const str = (v) => (v == null ? "" : String(v).trim());
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };

export const MIN_SIZE = 6;
export const MAX_SIZE = 40;
// The Surface pill may go smaller than text lines: on a narrow tag its color
// does the talking and a small pill still fits beside the logo.
export const SURFACE_MIN_SIZE = 4;
export const clampSize = (n, key) => {
  const min = key === "surface" ? SURFACE_MIN_SIZE : MIN_SIZE;
  return Math.min(MAX_SIZE, Math.max(min, Math.round(num(n, min))));
};

// The fields a label can carry. `kind` drives how the card renders the line:
// title = the big name, surface = the optional Wall pill, text = a labelled
// row, custom = free text with no caption (whatever is typed prints as-is —
// blank lines the user can fill, e.g. a grout note at the bottom).
export const LABEL_FIELDS = [
  { key: "name", label: "Tile Name", kind: "title" },
  { key: "surface", label: "Surface", kind: "surface" },
  { key: "sku", label: "SKU", kind: "text" },
  { key: "size", label: "Size", kind: "text" },
  { key: "price", label: "Price", kind: "text" },
  { key: "grout", label: "Grout Color", kind: "text" },
  { key: "brand", label: "Brand", kind: "text" },
  { key: "thickness", label: "Thickness", kind: "text" },
  { key: "note", label: "Note", kind: "text" },
  { key: "custom1", label: "Custom line 1", kind: "custom" },
  { key: "custom2", label: "Custom line 2", kind: "custom" },
  { key: "custom3", label: "Custom line 3", kind: "custom" },
];
const FIELD_KEYS = LABEL_FIELDS.map((f) => f.key);
const isField = (k) => FIELD_KEYS.includes(k);
export const KIND_OF = Object.fromEntries(LABEL_FIELDS.map((f) => [f.key, f.kind]));

// Filler lines: user-added blank spacers that hold vertical space open on the
// card (their `size` is a height in px, not a font size). Keyed "sp_<id>" so
// any number of them ride through normLines alongside the fixed fields.
// Hiding a normal line always collapses the card — a filler is the explicit
// way to keep a gap.
export const isSpacer = (k) => typeof k === "string" && k.startsWith("sp_");
export const SPACE_MIN = 2;
export const SPACE_MAX = 80;
export const SPACE_DEFAULT = 12;
export const clampSpace = (n) => Math.min(SPACE_MAX, Math.max(SPACE_MIN, Math.round(num(n, SPACE_DEFAULT))));
export const newSpacerLine = () => ({ key: "sp_" + uid(), show: true, size: SPACE_DEFAULT });

// The pin divider: lines after it sit at the bottom of the card however much
// text is above. A list without one pins nothing, so labels saved before the
// divider existed render as they always did.
export const PIN_KEY = "pin";
export const isPin = (k) => k === PIN_KEY;

export const splitPinned = (lines) => {
  const all = lines || [];
  const at = all.findIndex((l) => isPin(l.key));
  const shown = (ls) => ls.filter((l) => l.show && !isPin(l.key));
  return at < 0 ? { body: shown(all), bottom: [] } : { body: shown(all.slice(0, at)), bottom: shown(all.slice(at + 1)) };
};

// Two-variant labels (v3 port): one tile sold in two sizes shares a single
// label — these fields get a second column (`fields2`) when `twoVariant` is on.
// Label-level only; presets don't carry it.
export const VARIANT_KEYS = ["sku", "size", "price"];
const blankFields2 = () => Object.fromEntries(VARIANT_KEYS.map((k) => [k, ""]));

export const DEFAULT_SIZES = { name: 16, surface: 9, sku: 11, size: 11, price: 11, grout: 10, brand: 10, thickness: 10, note: 10, custom1: 10, custom2: 10, custom3: 10 };

const line = (key, show, size) => ({ key, show, size });

export const BUILTIN_PRESETS = [
  {
    id: "sample-tag", name: "Sample Tag", w: 1.5, h: 2.5, header: "Keim",
    lines: [
      line("name", true, 13), line("surface", true, 8), line("sku", true, 10),
      line("size", true, 10), line("price", true, 10), line(PIN_KEY, true, 0), line("grout", true, 9),
      line("brand", false, 9), line("thickness", false, 9), line("note", false, 9),
    ],
  },
  {
    id: "spec-card", name: "Spec Card", w: 3, h: 4, header: "Keim",
    lines: [
      line("name", true, 22), line("surface", true, 10), line("sku", true, 12),
      line("size", true, 12), line("price", true, 12), line("brand", true, 11),
      line("thickness", true, 11), line(PIN_KEY, true, 0), line("grout", true, 11), line("note", false, 11),
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
    if (seen.has(key)) continue;
    if (isPin(key)) {
      seen.add(key);
      out.push(line(PIN_KEY, true, 0));
      continue;
    }
    if (isSpacer(key)) {
      seen.add(key);
      out.push(line(key, l?.show !== false, clampSpace(l?.size)));
      continue;
    }
    if (!isField(key)) continue;
    seen.add(key);
    out.push(line(key, l?.show !== false, clampSize(l?.size ?? DEFAULT_SIZES[key], key)));
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

// Built-ins are always present and lead the list. A saved entry with a built-in
// id is the team's edit of it and wins over the code default (owner 2026-09-25 —
// until then code always won); saving the default back un-overrides it, since
// only an entry that differs from the default is persisted.
export const builtinDefault = (id) => {
  const b = BUILTIN_PRESETS.find((p) => p.id === id);
  return b ? normPreset(b) : null;
};
export const isBuiltinOverridden = (p) => BUILTIN_IDS.has(p?.id) && JSON.stringify(normPreset(p)) !== JSON.stringify(builtinDefault(p.id));

export const normLabelPresets = (raw) => {
  const list = Array.isArray(raw) ? raw : [];
  const saved = new Map(list.filter((p) => BUILTIN_IDS.has(str(p?.id))).map((p) => [str(p.id), p]));
  const builtins = BUILTIN_PRESETS.map((b) => (saved.has(b.id) ? normPreset({ ...saved.get(b.id), id: b.id }) : normPreset(b)));
  const customs = list.filter((p) => !BUILTIN_IDS.has(str(p?.id))).map(normPreset);
  return [...builtins, ...customs];
};
export const customLabelPresets = (presets) => (presets || []).filter((p) => !BUILTIN_IDS.has(p.id) || isBuiltinOverridden(p));

const blankFields = () => Object.fromEntries(LABEL_FIELDS.map((f) => [f.key, ""]));

export const normLabel = (raw) => {
  const fields = { ...blankFields() };
  for (const k of FIELD_KEYS) if (raw?.fields?.[k] != null) fields[k] = String(raw.fields[k]);
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

// Stock-book names carry words a sample label doesn't want: "Tile", the
// vendor's code ("Marazzi Rice Tile - RC03 Natural"), and the dash that set it
// off (owner 2026-09-25). A code is any word mixing letters and digits, an
// all-digit word of 5+ digits ("Wow Skin Biscuit Matte 135296"), or the item's
// own mfg; sizes, measures (12x24, 2in, 8mm) and short numbers stay. Also
// Virginia Tile's "VT" prefix and dash-joined number codes of 5+ digits
// ("Anatolia Soho Hexagon 4501-0467-0").
const MEASURE_RE = /^\d+(?:[./]\d+)?["']?(?:[x×]\d+(?:[./]\d+)?["']?|in|mm|cm|ft|mil)?$/i;
const escRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const cleanLabelName = (name, mfg) => {
  const raw = str(name);
  let s = raw;
  const code = str(mfg);
  if (code) s = s.replace(new RegExp(`(^|\\s)${escRe(code)}(?=\\s|$)`, "gi"), " ");
  const out = s.split(/\s+/).filter((w) => w
    && !/^tiles?$/i.test(w)
    && !/^[-–—]+$/.test(w)
    && !/^\d{5,}$/.test(w)
    && w !== "VT"
    && !(/^\d+(?:-\d+)+$/.test(w) && w.replace(/-/g, "").length >= 5)
    && !(/[a-z]/i.test(w) && /\d/.test(w) && !MEASURE_RE.test(w))).join(" ");
  return out || raw;
};

// Map a normalized StockItem (see stock.js normStockItem) to editable label
// fields. A prefill only — the user edits freely afterward, nothing re-reads.
export const stockToLabelFields = (item) => {
  if (!item) return {};
  const psf = item.priceSqft != null ? item.priceSqft
    : (item.price != null && item.sfPerUnit > 0 ? item.price / item.sfPerUnit : null);
  return {
    name: cleanLabelName(str(item.description) || str(item.product), item.mfg),
    sku: str(item.sku),
    size: faceSizeText(item.size) || str(item.sheetSize),
    price: psf != null ? `${money(psf)}/sq ft` : (item.price != null ? money(item.price) : ""),
    brand: str(item.brand),
    thickness: str(item.thickness),
  };
};

// The tile name steps down until the card stops overflowing. `overflowsAt(px)`
// applies the size and measures — the screen card and the print popup each
// pass their own DOM check, so both shrink by the same rule.
export const NAME_FLOOR = 7;
export const fitNameSize = (overflowsAt, start, floor = NAME_FLOOR) => {
  for (let px = start; px >= floor; px -= 0.5) if (!overflowsAt(px)) return px;
  overflowsAt(floor);
  return floor;
};

const SIZE_RE = /(\d+(?:\.\d+)?)\s*["']?\s*[x×]\s*(\d+(?:\.\d+)?)\s*["']?/i;
export const faceArea = (size) => {
  const m = str(size).match(SIZE_RE);
  return m ? parseFloat(m[1]) * parseFloat(m[2]) : null;
};
export const trimSize = (name) => str(name).replace(/\s+\d+(?:\.\d+)?\s*["']?\s*[x×]\s*\d+(?:\.\d+)?\s*["']?\s*$/i, "").trim();

// One label, two sizes from two stock picks: the bigger face leads whatever
// order they were picked in (owner 2026-09-25); the name is the bigger item's
// with its size dropped, since each size prints in its own column.
export const twoSizeDraft = (a, b) => {
  const fa = stockToLabelFields(a), fb = stockToLabelFields(b);
  const aa = faceArea(fa.size), ab = faceArea(fb.size);
  const swapped = aa != null && ab != null && ab > aa;
  const [first, second, it] = swapped ? [fb, fa, b] : [fa, fb, a];
  return {
    fields: { ...first, name: trimSize(first.name) || first.name },
    fields2: { sku: second.sku || "", size: second.size || "", price: second.price || "" },
    sku: str(it.sku) || null,
    swapped,
  };
};

// A saved label restyled to its template: layout from the template (its own
// font nudges reset), text, second size and SKU untouched.
export const restyleLabel = (label, preset) => ({
  presetId: preset.id,
  w: label.twoVariant ? Math.max(preset.w, 2) : preset.w,
  h: preset.h,
  header: preset.header,
  lines: preset.lines.map((l) => ({ ...l })),
});

// Re-check labels against the stock book: price only (owner 2026-09-25) — the
// rest of a label may be hand-edited. `keysOf` is orderbook.js skuKeys, passed
// in so this module stays import-free. Retired or switched-off items count as
// gone, like everywhere the row search reads the cache.
export const refreshPlan = (labels, stock, keysOf) => {
  const index = new Map();
  for (const it of stock || []) {
    if (!it.active || it.discontinued || it.disabled) continue;
    for (const k of keysOf(it.sku)) if (!index.has(k)) index.set(k, it);
  }
  const find = (code) => { for (const k of keysOf(code)) if (index.has(k)) return index.get(k); return null; };
  const out = { changed: [], same: [], missing: [], noSku: [] };
  for (const label of labels || []) {
    const sku1 = str(label.fields?.sku) || str(label.sku);
    const sku2 = label.twoVariant ? str(label.fields2?.sku) : "";
    if (!sku1 && !sku2) { out.noSku.push({ id: label.id, label }); continue; }
    const it1 = sku1 ? find(sku1) : null, it2 = sku2 ? find(sku2) : null;
    const missingSkus = [sku1 && !it1 ? sku1 : null, sku2 && !it2 ? sku2 : null].filter(Boolean);
    if (missingSkus.length) { out.missing.push({ id: label.id, label, missingSkus }); continue; }
    const price = str(label.fields?.price), price2 = sku2 ? str(label.fields2?.price) : null;
    const next = it1 ? stockToLabelFields(it1).price || price : price;
    const next2 = it2 ? stockToLabelFields(it2).price || price2 : price2;
    const before = { price, price2 }, after = { price: next, price2: next2 };
    if (next === price && next2 === price2) { out.same.push({ id: label.id, label }); continue; }
    const patch = { fields: { ...label.fields, price: next } };
    if (sku2) patch.fields2 = { ...label.fields2, price: next2 };
    out.changed.push({ id: label.id, label, patch, before, after });
  }
  return out;
};

export const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// The default "Keim" header renders as the logo wordmark; any other typed
// header stays plain text.
export const isKeimHeader = (h) => str(h || "Keim").toLowerCase() === "keim";

export const surfaceColor = (s) => (s === "Wall" ? "#7d6a8a" : s === "Floor & Wall" ? "#B5654A" : "#5C6B73");
// The Surface pill rides the header row, right of the logo, whatever the
// Surface line's place in the list; its shown flag and size still come from
// that line. Null when hidden or unpicked.
export const surfacePill = (label) => {
  const l = (label.lines || []).find((x) => x.key === "surface");
  const v = str(label.fields?.surface);
  return l && l.show && v ? { text: v, size: l.size, color: surfaceColor(v) } : null;
};

const LABEL_OF = Object.fromEntries(LABEL_FIELDS.map((f) => [f.key, f.label]));

// The grout line prints caption and color on one line, both at the line's
// size; a color that doesn't fit drops to the next line whole (flex-wrap),
// the caption keeping its dash.
export const GROUT_CAPTION = "Grout –";

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
  const { body, bottom } = splitPinned(label.lines);
  const pill = surfacePill(label);
  const render = (l) => {
    if (isSpacer(l.key)) return `<div style="height:${l.size}px;flex:0 0 auto;"></div>`;
    if (l.key === "name") return `<div class="lc-name" style="font-family:'Oswald',sans-serif;font-size:${l.size}px;text-transform:uppercase;letter-spacing:.03em;line-height:1.12;color:#fff;word-break:break-word;">${val("name") || "Tile Name"}</div>`;
    if (l.key === "surface") return "";
    if (KIND_OF[l.key] === "custom") return val(l.key) ? `<div style="margin-top:6px;color:#fff;line-height:1.3;font-size:${l.size}px;word-break:break-word;">${val(l.key)}</div>` : "";
    if (label.twoVariant && VARIANT_KEYS.includes(l.key)) return l.key === firstVariant ? variantBlock : "";
    if (l.key === "grout") return `<div class="lc-grout" style="margin-top:6px;display:flex;flex-wrap:wrap;align-items:baseline;column-gap:.35em;font-size:${l.size}px;line-height:1.3;"><span style="color:#9a9a9a;text-transform:uppercase;letter-spacing:.08em;font-weight:700;white-space:nowrap;">${GROUT_CAPTION}</span><span style="color:#fff;">${val("grout") || "—"}</span></div>`;
    const mono = l.key === "sku" ? "font-family:ui-monospace,monospace;" : "";
    return `<div style="margin-top:6px;"><div style="font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#9a9a9a;font-weight:700;line-height:1;">${escapeHtml(LABEL_OF[l.key])}</div><div style="color:#fff;line-height:1.3;font-size:${l.size}px;${mono}">${val(l.key) || "—"}</div></div>`;
  };
  const pinned = bottom.length ? `<div style="margin-top:auto;flex-shrink:0;display:flex;flex-direction:column;">${bottom.map(render).join("")}</div>` : "";
  return `<div class="lc" style="width:${label.w}in;height:${label.h}in;background:#1A1A1A;color:#fff;border-radius:3px;padding:.12in;font-family:'Inter',sans-serif;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;">
    <div class="lc-head" style="display:flex;flex-wrap:wrap;align-items:center;column-gap:6px;row-gap:3px;">${header}${pill ? `<span class="lc-surface" style="margin-left:auto;font-size:${pill.size}px;line-height:1.2;text-transform:uppercase;letter-spacing:.1em;font-weight:700;padding:.25em .85em;border-radius:4px;max-width:100%;box-sizing:border-box;text-align:center;color:#fff;background:${pill.color};">${escapeHtml(pill.text)}</span>` : ""}</div>
    <div style="border-top:1px solid rgba(255,255,255,.2);margin:6px 0 2px;"></div>
    ${body.map(render).join("")}${pinned}
  </div>`;
};
