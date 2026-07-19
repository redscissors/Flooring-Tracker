# Apps hub + Label Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sidebar "Apps" hub whose first app is a Tile Sample Label Generator — shared team-wide, able to fill labels from stock SKUs, with savable size presets and per-sheet print counts.

**Architecture:** Pure label logic (presets, sheet math, stock→field mapping) lives in a new dependency-free `src/labels.js` (Node-test unit tested, like `stock.js`). Saved labels are their own shared Supabase table (`labels`, modeled on `todos`). Presets live in the shared `settings` record (normalized in `catalog.js`). The UI is a new fullscreen `src/AppsWorkspace.jsx` overlay modeled on `SettingsWorkspace`, wired into `App.jsx` with a sidebar button and a `showApps` flag. **Refinement over the spec:** each saved label snapshots its own layout (size + which lines show + font sizes), so presets are just starting templates and a label never breaks if a preset is later edited — consistent with the app's snapshot convention.

**Tech Stack:** React 18 (hooks only, no router), Vite, Tailwind (slate/indigo classes overridden by the theme), lucide-react icons, Supabase (Postgres + RLS), Node built-in test runner.

## Global Constraints

- **No router / no context.** Overlays are local `useState` booleans + trailing conditional JSX in `App.jsx`. Match this.
- **Never mutate the live Supabase project.** `supabase/labels.sql` is written here and run BY HAND by the owner. Code must degrade gracefully (empty set, no crash) until the table exists.
- **Never push to `main`.** All work lands on the current branch via PR.
- **No UI/print change merges without preview proof** (screenshot of the working screen + a print preview).
- **Snapshot convention:** picking a SKU pre-fills editable fields; nothing re-reads stock after. Saved labels carry their own layout snapshot.
- **Test runner:** `npm test` → `node --test src/*.test.js`. Tests use `import { test } from "node:test"` + `import assert from "node:assert/strict"`. Single file: `node --test src/labels.test.js`.
- **Normalization discipline:** extend the `norm*` helpers so old records stay valid; never read raw jsonb directly in the UI.
- **Sanctioned write paths only:** all `labels` table writes go through the `addLabel`/`addLabelsBulk`/`updateLabel`/`delLabel` helpers added in Task 6 — never ad hoc.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/labels.js` | **New.** Pure: `LABEL_FIELDS`, `DEFAULT_SIZES`, `BUILTIN_PRESETS`, preset/label normalization, `newDraftFromPreset`, `stockToLabelFields`, `perLetterSheet`, `sheetsForLabels`, `labelCardHTML`, `escapeHtml`. No imports from app code (keeps it acyclic + unit-testable). |
| `src/labels.test.js` | **New.** Node-test unit tests for the above. |
| `src/catalog.js` | **Modify.** Wire `settings.apps.labels.presets` into `normalizeSettings` + `serializeSettings` via `labels.js` helpers. |
| `supabase/labels.sql` | **New.** `labels` table + RLS (owner runs once). |
| `src/App.jsx` | **Modify.** `labels` state, `loadLabels`, CRUD helpers, `saveLabelPreset`, initial load, sidebar **Apps** button, `showApps` state + `<AppsWorkspace>` render. |
| `src/AppsWorkspace.jsx` | **New.** Fullscreen hub shell + Label Generator UI (preset strip, form with SKU fill, live preview, label set with search/filter/sort/delete, print). |

---

## Task 1: `src/labels.js` — fields, presets, normalization

**Files:**
- Create: `src/labels.js`
- Test: `src/labels.test.js`

**Interfaces:**
- Produces: `LABEL_FIELDS: {key,label,kind}[]`, `DEFAULT_SIZES: Record<string,number>`, `BUILTIN_PRESETS: Preset[]`, `BUILTIN_IDS: Set<string>`, `MIN_SIZE`, `MAX_SIZE`, `clampSize(n)`, `normPreset(raw): Preset`, `normLabelPresets(raw): Preset[]`, `customLabelPresets(presets): Preset[]`, `normLabel(raw): Label`, `newDraftFromPreset(preset): Draft`.
  - `Preset = { id, name, w, h, header, lines: {key,show,size}[] }`
  - `Label = { id, position, presetId, w, h, header, lines, fields: Record<key,string>, sku, createdBy, createdAt }`
  - `Draft = Label-without-{id,position,createdBy,createdAt}`

- [ ] **Step 1: Write the failing test**

Create `src/labels.test.js`:

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/labels.test.js`
Expected: FAIL — `Cannot find module './labels.js'`.

- [ ] **Step 3: Write the implementation**

Create `src/labels.js`:

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test src/labels.test.js`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/labels.js src/labels.test.js
git commit -m "feat(labels): fields, built-in presets, and normalization"
```

---

## Task 2: `src/labels.js` — sheet-fit math

**Files:**
- Modify: `src/labels.js`
- Test: `src/labels.test.js`

**Interfaces:**
- Produces: `perLetterSheet({w,h}): number` (how many upright labels fit one letter sheet), `sheetsForLabels(labels): number` (sheets a mixed-size print job needs).

- [ ] **Step 1: Write the failing test**

Append to `src/labels.test.js`:

```js
import { perLetterSheet, sheetsForLabels } from "./labels.js";

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/labels.test.js`
Expected: FAIL — `perLetterSheet is not a function` (or export missing).

- [ ] **Step 3: Write the implementation**

Append to `src/labels.js`:

```js
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test src/labels.test.js`
Expected: PASS (all tests incl. the 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/labels.js src/labels.test.js
git commit -m "feat(labels): per-letter-sheet fit math"
```

---

## Task 3: `src/labels.js` — stock→field mapping + print HTML

**Files:**
- Modify: `src/labels.js`
- Test: `src/labels.test.js`

**Interfaces:**
- Produces: `faceSizeText(size): string`, `stockToLabelFields(item): Partial<fields>`, `escapeHtml(s): string`, `labelCardHTML(label): string` (one card as an HTML string for printing).

- [ ] **Step 1: Write the failing test**

Append to `src/labels.test.js`:

```js
import { faceSizeText, stockToLabelFields, escapeHtml, labelCardHTML, normLabel as _normLabel } from "./labels.js";

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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/labels.test.js`
Expected: FAIL — `stockToLabelFields is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/labels.js`:

```js
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

const surfaceColor = (s) => (s === "Wall" ? "#B5654A" : s === "Floor & Wall" ? "#7d6a8a" : "#5C6B73");

const LABEL_OF = Object.fromEntries(LABEL_FIELDS.map((f) => [f.key, f.label]));

// One card as a standalone HTML string (used by the print window). Kept as a
// string — not React — so printing runs in a clean popup free of app CSS.
export const labelCardHTML = (label) => {
  const val = (k) => escapeHtml(label.fields?.[k] || "");
  const body = (label.lines || []).filter((l) => l.show).map((l) => {
    if (l.key === "name") return `<div style="font-family:'Oswald',sans-serif;font-size:${l.size}px;text-transform:uppercase;letter-spacing:.03em;line-height:1.12;color:#fff;word-break:break-word;">${val("name") || "Tile Name"}</div>`;
    if (l.key === "surface") return `<span style="align-self:flex-start;margin-top:6px;font-size:8px;text-transform:uppercase;letter-spacing:.1em;font-weight:700;padding:2px 7px;border-radius:4px;color:#fff;background:${surfaceColor(label.fields?.surface)};">${val("surface")}</span>`;
    const mono = l.key === "sku" ? "font-family:ui-monospace,monospace;" : "";
    return `<div style="margin-top:6px;"><div style="font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#9a9a9a;font-weight:700;line-height:1;">${escapeHtml(LABEL_OF[l.key])}</div><div style="color:#fff;line-height:1.3;font-size:${l.size}px;${mono}">${val(l.key) || "—"}</div></div>`;
  }).join("");
  return `<div style="width:${label.w}in;height:${label.h}in;background:#1A1A1A;color:#fff;border-radius:3px;padding:.12in;font-family:'Inter',sans-serif;display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;">
    <div style="font-family:'Oswald',sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:.3em;color:#fff;">${escapeHtml(label.header || "Keim")}</div>
    <div style="border-top:1px solid rgba(255,255,255,.2);margin:6px 0 2px;"></div>
    ${body}
  </div>`;
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test src/labels.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/labels.js src/labels.test.js
git commit -m "feat(labels): stock->field mapping and print-card HTML"
```

---

## Task 4: Wire presets into settings normalization

**Files:**
- Modify: `src/catalog.js` (`normalizeSettings` ~line 715, `serializeSettings` ~line 709)
- Test: `src/catalog.test.js`

**Interfaces:**
- Consumes: `normLabelPresets`, `customLabelPresets` from `labels.js`.
- Produces: `settings.apps.labels.presets` present (built-ins seeded) after `normalizeSettings`; only customs kept by `serializeSettings`.

- [ ] **Step 1: Write the failing test**

Append to `src/catalog.test.js` (match its existing import + test style):

```js
import { normalizeSettings as _normSettings, serializeSettings as _serSettings } from "./catalog.js";
import { BUILTIN_IDS as _BUILTIN_IDS } from "./labels.js";

test("normalizeSettings seeds the built-in label presets", () => {
  const s = _normSettings({});
  const ids = s.apps.labels.presets.map((p) => p.id);
  assert.ok(ids.includes("sample-tag"));
  assert.ok(ids.includes("spec-card"));
});

test("serializeSettings persists only custom label presets", () => {
  const s = _normSettings({ apps: { labels: { presets: [{ id: "c1", name: "Wood", w: 4, h: 2.75, header: "Keim", lines: [] }] } } });
  const saved = _serSettings(s);
  const ids = saved.apps.labels.presets.map((p) => p.id);
  assert.deepEqual(ids, ["c1"]);
  assert.ok(!ids.some((id) => _BUILTIN_IDS.has(id)));
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/catalog.test.js`
Expected: FAIL — `Cannot read properties of undefined (reading 'labels')`.

- [ ] **Step 3: Write the implementation**

At the top of `src/catalog.js`, add to the imports:

```js
import { normLabelPresets, customLabelPresets } from "./labels.js";
```

Add this helper just above `serializeSettings` (near line 708):

```js
// Apps hub configuration. Currently just the Label Generator's size presets:
// built-ins are code-defined and always seeded; only customs are persisted.
const normApps = (raw) => ({ labels: { presets: normLabelPresets(raw?.labels?.presets) } });
const serializeApps = (apps) => ({ labels: { presets: customLabelPresets(apps?.labels?.presets) } });
```

In `serializeSettings`, add `apps` to the returned object:

```js
export const serializeSettings = (s) => {
  const ops = normOps(s.ops);
  return { waste: s.waste, catalog: s.catalog, pricing: normPricing(s.pricing), apps: serializeApps(s.apps), ...(ops ? { ops } : {}) };
};
```

In `normalizeSettings`, add `apps` to the object passed to `withDerived`:

```js
export function normalizeSettings(raw) {
  const waste = normWaste(raw);
  const catalog = (raw?.catalog && Array.isArray(raw.catalog.companies))
    ? normalizeCatalog(raw.catalog)
    : seedCatalog(mergeSettings(raw));
  const ops = normOps(raw?.ops);
  return withDerived({ waste, catalog, pricing: normPricing(raw?.pricing), apps: normApps(raw?.apps), ...(ops ? { ops } : {}) });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test src/catalog.test.js src/labels.test.js`
Expected: PASS (existing catalog tests still green + 2 new).

- [ ] **Step 5: Commit**

```bash
git add src/catalog.js src/catalog.test.js
git commit -m "feat(labels): persist label presets in shared settings"
```

---

## Task 5: `supabase/labels.sql` — shared labels table

**Files:**
- Create: `supabase/labels.sql`

**Interfaces:**
- Produces: `public.labels` table (`id text pk`, `position double precision`, `data jsonb`, timestamps) with authenticated-user RLS for select/insert/update/delete, and an `updated_at` trigger reusing `set_updated_at()`.

*(No unit test — SQL is verified by the owner running it and by the Task 8 preview. This is a plan step, not a TDD cycle.)*

- [ ] **Step 1: Create the file**

Create `supabase/labels.sql`:

```sql
-- Tile-sample labels (Apps hub → Label Generator).
-- Run once in your Supabase project: Dashboard -> SQL Editor -> paste -> Run.
--
-- One row per saved showroom label, shared team-wide with the same trust model
-- as customers / todos: every signed-in user can add, edit, and delete any label.
--
-- `position` gives a stable insertion order; everything else lives in `data`:
--   { presetId, w, h, header, lines:[{key,show,size}], fields:{...}, sku,
--     createdBy, createdAt }

create table if not exists public.labels (
  id         text primary key,
  position   double precision not null default 0,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.labels enable row level security;

drop policy if exists "label select" on public.labels;
create policy "label select" on public.labels
  for select to authenticated using (true);

drop policy if exists "label insert" on public.labels;
create policy "label insert" on public.labels
  for insert to authenticated with check (true);

drop policy if exists "label update" on public.labels;
create policy "label update" on public.labels
  for update to authenticated using (true) with check (true);

drop policy if exists "label delete" on public.labels;
create policy "label delete" on public.labels
  for delete to authenticated using (true);

-- Reuses set_updated_at() from schema.sql.
drop trigger if exists labels_updated_at on public.labels;
create trigger labels_updated_at
  before update on public.labels
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Commit**

```bash
git add supabase/labels.sql
git commit -m "feat(labels): labels table + RLS (run by hand)"
```

*(Deployment: the owner runs this in the Supabase SQL editor before saving labels works. Until then, Task 6's writes fail softly with a ping.)*

---

## Task 6: `App.jsx` — labels data layer (state, load, CRUD)

**Files:**
- Modify: `src/App.jsx` (state near line 1727; helpers near the todos helpers ~line 2953; initial load near line 1913)

**Interfaces:**
- Consumes: `normLabel`, `customLabelPresets`(no) — imports `normLabel` from `labels.js`; `fetchAllRows`, `supabase`, existing `profile`, `user`, `flashSaved`, `ping`, `uid`, `settings`, `setSettings`.
- Produces (used by Task 7/8): state `labels`; helpers `loadLabels()`, `addLabel(draft)`, `addLabelsBulk(drafts)`, `updateLabel(id, patch)`, `delLabel(id)`, `saveLabelPreset(preset)`.

- [ ] **Step 1: Add the import**

At the top of `src/App.jsx`, alongside the other module imports (e.g. after the `stock.js` import), add:

```jsx
import { normLabel } from "./labels.js";
```

- [ ] **Step 2: Add labels state**

Near the todos state (`src/App.jsx:1727`), add:

```jsx
  // Apps → Label Generator: saved showroom labels, shared team-wide (issue
  // label-generator-integration). Own table, loaded once on mount.
  const [labels, setLabels] = useState([]);
  const [showApps, setShowApps] = useState(false);
```

- [ ] **Step 3: Add the loader + CRUD helpers**

After the todos helpers block (`src/App.jsx` ~line 2953, right after `reorderTodos`), add:

```jsx
  // Labels write path (Apps → Label Generator). Mirrors the todos helpers but
  // pages with fetchAllRows since the shared set can exceed the 1000-row cap.
  const labelData = (l) => ({ presetId: l.presetId, w: l.w, h: l.h, header: l.header, lines: l.lines, fields: l.fields, sku: l.sku, createdBy: l.createdBy, createdAt: l.createdAt });
  const loadLabels = async () => {
    const rows = await fetchAllRows(() => supabase.from("labels").select("id, position, data").order("position"));
    return rows.map((r) => normLabel({ id: r.id, position: r.position ?? 0, ...(r.data || {}) }));
  };
  const openApps = () => { setShowApps(true); setSidebarOpen(false); loadLabels().then(setLabels).catch(() => { }); };
  const nextPos = () => (labels.length ? Math.max(...labels.map((l) => l.position)) + 1 : 0);
  const addLabel = (draft) => {
    const l = normLabel({ ...draft, id: uid(), position: nextPos(), createdBy: profile.name || user.email || "", createdAt: Date.now() });
    setLabels((prev) => [...prev, l]);
    (async () => { try { const { error } = await supabase.from("labels").insert({ id: l.id, position: l.position, data: labelData(l) }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — run supabase/labels.sql?"); } })();
    return l;
  };
  const addLabelsBulk = (drafts) => {
    let pos = nextPos();
    const made = drafts.map((d) => normLabel({ ...d, id: uid(), position: pos++, createdBy: profile.name || user.email || "", createdAt: Date.now() }));
    setLabels((prev) => [...prev, ...made]);
    (async () => { try { const { error } = await supabase.from("labels").insert(made.map((l) => ({ id: l.id, position: l.position, data: labelData(l) }))); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — run supabase/labels.sql?"); } })();
  };
  const updateLabel = (id, patch) => {
    const next = labels.map((l) => l.id === id ? normLabel({ ...l, ...patch }) : l);
    setLabels(next);
    const l = next.find((x) => x.id === id);
    (async () => { try { const { error } = await supabase.from("labels").update({ position: l.position, data: labelData(l) }).eq("id", id); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — check connection"); } })();
  };
  const delLabel = (id) => {
    setLabels((prev) => prev.filter((l) => l.id !== id));
    (async () => { try { const { error } = await supabase.from("labels").delete().eq("id", id); if (error) throw error; } catch (e) { ping("Delete failed"); } })();
  };
  // Custom size presets live in shared settings; setSettings persists them
  // (serializeSettings keeps only non-built-in presets).
  const saveLabelPreset = (preset) => {
    const cur = settings.apps?.labels?.presets || [];
    const presets = [...cur.filter((p) => p.id !== preset.id), preset];
    setSettings({ ...settings, apps: { ...settings.apps, labels: { presets } } });
  };
```

- [ ] **Step 4: Load labels on mount**

Near the todos initial load (`src/App.jsx:1913`), add on the next line:

```jsx
        try { setLabels(await loadLabels()); } catch (x) { }
```

- [ ] **Step 5: Verify the app still builds**

Run: `npm run build`
Expected: build succeeds with no errors (helpers compile; they're not yet referenced by JSX, which is fine — `openApps`/`addLabel` etc. are used in Task 7/8).

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat(labels): App state + load + CRUD write paths"
```

---

## Task 7: `App.jsx` — sidebar Apps button + workspace mount

**Files:**
- Modify: `src/App.jsx` (lucide import line 3; footer bar ~line 3569; render block ~line 4615; top import)

**Interfaces:**
- Consumes: `showApps`/`setShowApps`, `openApps`, `labels`, `addLabel`, `addLabelsBulk`, `updateLabel`, `delLabel`, `saveLabelPreset`, `stock`, `settings` (Task 6); `AppsWorkspace` (Task 8).
- Produces: a working **Apps** button that opens the workspace.

- [ ] **Step 1: Import the component + icon**

Add `LayoutGrid` to the lucide-react import on `src/App.jsx:3` (append before the closing `}`):

```jsx
, LayoutGrid } from "lucide-react";
```

Add the workspace import near the other component/module imports at the top:

```jsx
import { AppsWorkspace } from "./AppsWorkspace.jsx";
```

- [ ] **Step 2: Add the sidebar button**

In the footer bar (`src/App.jsx:3569`), insert a new full-width row **above** the existing `<div className="flex gap-2">` row:

```jsx
            <div className="flex mb-2">
              <button onClick={openApps} title="Apps — shop tools" className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-slate-200 hover:bg-slate-50 text-sm py-1.5 text-slate-600"><LayoutGrid size={15} /> Apps</button>
            </div>
```

- [ ] **Step 3: Mount the workspace**

Immediately after the `{showSettings && (...)}` block (`src/App.jsx` ~line 4615), add:

```jsx
      {showApps && (
        <AppsWorkspace
          onClose={() => setShowApps(false)}
          stock={stock}
          labels={labels}
          presets={settings.apps?.labels?.presets || []}
          onAddLabel={addLabel}
          onAddLabelsBulk={addLabelsBulk}
          onUpdateLabel={updateLabel}
          onDeleteLabel={delLabel}
          onSavePreset={saveLabelPreset}
        />
      )}
```

- [ ] **Step 4: Create a minimal placeholder so the app compiles**

*(Task 8 replaces this with the real component; a stub here keeps Task 7 independently reviewable — the button opens a real overlay.)* Create `src/AppsWorkspace.jsx`:

```jsx
import { X } from "lucide-react";

export function AppsWorkspace({ onClose }) {
  return (
    <div className="print:hidden fixed inset-0 z-50 p-2 md:p-5" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl border border-slate-200 w-full h-full flex overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-50/50 flex flex-col">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <h3 className="ft-serif text-2xl">Apps</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
          <nav className="px-2 space-y-0.5">
            <div className="w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm bg-indigo-600 text-white">Label Generator</div>
          </nav>
        </aside>
        <div className="flex-1 overflow-y-auto p-6"><h2 className="ft-serif text-3xl">Label Generator</h2><p className="text-slate-500 mt-2">Coming together…</p></div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify in the preview (preview proof #1)**

Run the dev server (preview_start with the project's dev config), open the app, sign in, and click the new **Apps** button in the sidebar footer. Confirm the fullscreen overlay opens with an "Apps → Label Generator" rail and closes on backdrop/✕. Capture a screenshot.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/AppsWorkspace.jsx
git commit -m "feat(labels): Apps sidebar button + workspace shell"
```

---

## Task 8: `src/AppsWorkspace.jsx` — the Label Generator

**Files:**
- Modify (replace): `src/AppsWorkspace.jsx`

**Interfaces:**
- Consumes: props `{ onClose, stock, labels, presets, onAddLabel, onAddLabelsBulk, onUpdateLabel, onDeleteLabel, onSavePreset }`; `labels.js` (`LABEL_FIELDS`, `newDraftFromPreset`, `normPreset`, `stockToLabelFields`, `perLetterSheet`, `sheetsForLabels`, `labelCardHTML`); `stock.js` (`searchStock`); lucide icons.

- [ ] **Step 1: Write the full component**

Replace `src/AppsWorkspace.jsx` with:

```jsx
import { useMemo, useRef, useState } from "react";
import { X, Search, Plus, Trash2, Printer, Eye, EyeOff, ChevronUp, ChevronDown } from "lucide-react";
import { LABEL_FIELDS, newDraftFromPreset, normPreset, stockToLabelFields, perLetterSheet, sheetsForLabels, labelCardHTML } from "./labels.js";
import { searchStock } from "./stock.js";

const uid = () => "l" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const surfaceColor = (s) => (s === "Wall" ? "#B5654A" : s === "Floor & Wall" ? "#7d6a8a" : "#5C6B73");
const LABEL_OF = Object.fromEntries(LABEL_FIELDS.map((f) => [f.key, f.label]));
const inp = "w-full border border-slate-200 rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-400";

// ── The dark label card, data-driven over `lines` (screen render) ──────────────
function LabelCard({ label, scale = 1 }) {
  const px = 96; // 1in ≈ 96 CSS px on screen
  return (
    <div style={{ width: label.w * px * scale, height: label.h * px * scale }}>
      <div style={{ width: `${label.w}in`, height: `${label.h}in`, transform: `scale(${scale})`, transformOrigin: "top left", background: "#1A1A1A", color: "#fff", borderRadius: 3, padding: "0.12in", fontFamily: "'Inter',sans-serif", display: "flex", flexDirection: "column", boxSizing: "border-box", overflow: "hidden" }}>
        <div style={{ fontFamily: "'Oswald',sans-serif", fontSize: 11, textTransform: "uppercase", letterSpacing: ".3em" }}>{label.header || "Keim"}</div>
        <div style={{ borderTop: "1px solid rgba(255,255,255,.2)", margin: "6px 0 2px" }} />
        {label.lines.filter((l) => l.show).map((l) => {
          const v = label.fields?.[l.key] || "";
          if (l.key === "name") return <div key={l.key} style={{ fontFamily: "'Oswald',sans-serif", fontSize: l.size, textTransform: "uppercase", letterSpacing: ".03em", lineHeight: 1.12, wordBreak: "break-word" }}>{v || "Tile Name"}</div>;
          if (l.key === "surface") return <span key={l.key} style={{ alignSelf: "flex-start", marginTop: 6, fontSize: 8, textTransform: "uppercase", letterSpacing: ".1em", fontWeight: 700, padding: "2px 7px", borderRadius: 4, background: surfaceColor(v) }}>{v}</span>;
          return (
            <div key={l.key} style={{ marginTop: 6 }}>
              <div style={{ fontSize: 8, textTransform: "uppercase", letterSpacing: ".08em", color: "#9a9a9a", fontWeight: 700, lineHeight: 1 }}>{LABEL_OF[l.key]}</div>
              <div style={{ lineHeight: 1.3, fontSize: l.size, fontFamily: l.key === "sku" ? "ui-monospace,monospace" : "inherit" }}>{v || "—"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SKU lookup: single-pick fills the form, shift-click bulk-adds ──────────────
function SkuLookup({ stock, onPick, onBulk }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(() => (open ? searchStock(stock, q).slice(0, 30) : []), [open, q, stock]);
  const choose = (it, shift) => {
    if (shift) { onBulk(it); }
    else { onPick(it); setQ(""); setOpen(false); }
  };
  return (
    <div className="relative mb-1">
      <Search size={15} className="absolute left-2.5 top-2.5 text-slate-400" />
      <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        className={inp + " pl-8"} placeholder="Search SKU or name to fill…" />
      {open && results.length > 0 && (
        <div className="absolute z-10 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-64 overflow-y-auto">
          {results.map((it) => (
            <button key={it.sku} onMouseDown={(e) => { e.preventDefault(); choose(it, e.shiftKey); }} className="w-full text-left px-2.5 py-1.5 hover:bg-slate-50 border-b border-slate-100 last:border-0">
              <div className="flex items-baseline gap-2">
                <span className="ft-mono text-[11px] text-slate-400 shrink-0">{it.sku}</span>
                <span className="text-xs font-medium truncate flex-1">{it.description || it.product}</span>
                <span className="ft-mono text-[11px] text-slate-400 shrink-0">{it.priceSqft != null ? `$${it.priceSqft.toFixed(2)}/sf` : it.price != null ? `$${it.price.toFixed(2)}` : ""}</span>
              </div>
            </button>
          ))}
          <div className="px-2.5 py-1.5 text-[11px] text-slate-400 bg-slate-50/60 border-t border-slate-100">Pick to fill · Shift-click to add as its own label</div>
        </div>
      )}
    </div>
  );
}

export function AppsWorkspace({ onClose, stock, labels, presets, onAddLabel, onAddLabelsBulk, onUpdateLabel, onDeleteLabel, onSavePreset }) {
  const first = presets[0] || normPreset({ id: "sample-tag" });
  const [draft, setDraft] = useState(() => newDraftFromPreset(first));
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [setSearch, setSetSearch] = useState("");
  const [sizeFilter, setSizeFilter] = useState("all");
  const [sortBy, setSortBy] = useState("recent");

  const perSheet = perLetterSheet(draft);

  // ── draft editing ──
  const patchDraft = (p) => setDraft((d) => ({ ...d, ...p }));
  const setField = (k, v) => setDraft((d) => ({ ...d, fields: { ...d.fields, [k]: v } }));
  const setLine = (key, p) => setDraft((d) => ({ ...d, lines: d.lines.map((l) => l.key === key ? { ...l, ...p } : l) }));
  const bumpSize = (key, dir) => setDraft((d) => ({ ...d, lines: d.lines.map((l) => l.key === key ? { ...l, size: Math.min(40, Math.max(6, l.size + dir)) } : l) }));
  const moveLine = (idx, dir) => setDraft((d) => {
    const lines = [...d.lines]; const j = idx + dir;
    if (j < 0 || j >= lines.length) return d;
    [lines[idx], lines[j]] = [lines[j], lines[idx]];
    return { ...d, lines };
  });

  const applyPreset = (p) => { setDraft(newDraftFromPreset(p)); setEditingId(null); };
  const fillFrom = (item) => setDraft((d) => ({ ...d, sku: item.sku || null, fields: { ...d.fields, ...stockToLabelFields(item) } }));
  const bulkFrom = (item) => onAddLabelsBulk([{ ...draft, sku: item.sku || null, fields: { ...draft.fields, ...stockToLabelFields(item) } }]);

  const save = () => {
    if (!draft.fields.name.trim() && !draft.sku) return;
    if (editingId) onUpdateLabel(editingId, draft); else onAddLabel(draft);
    setDraft(newDraftFromPreset(presets.find((p) => p.id === draft.presetId) || first));
    setEditingId(null);
  };
  const startNew = () => { setDraft(newDraftFromPreset(presets.find((p) => p.id === draft.presetId) || first)); setEditingId(null); };
  const editLabel = (l) => { setDraft({ presetId: l.presetId, w: l.w, h: l.h, header: l.header, lines: l.lines.map((x) => ({ ...x })), fields: { ...l.fields }, sku: l.sku }); setEditingId(l.id); };
  const saveAsPreset = () => {
    const name = window.prompt("Name this size preset:", "");
    if (!name) return;
    onSavePreset(normPreset({ id: uid(), name, w: draft.w, h: draft.h, header: draft.header, lines: draft.lines }));
  };

  // ── set: filter + sort ──
  const view = useMemo(() => {
    const q = setSearch.trim().toLowerCase();
    let out = labels.filter((l) => sizeFilter === "all" || l.presetId === sizeFilter);
    if (q) out = out.filter((l) => [l.fields.name, l.fields.sku, l.fields.grout].join(" ").toLowerCase().includes(q));
    out = [...out].sort(sortBy === "az"
      ? (a, b) => (a.fields.name || "").localeCompare(b.fields.name || "")
      : (a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    return out;
  }, [labels, setSearch, sizeFilter, sortBy]);

  const toggleSel = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectedLabels = labels.filter((l) => selected.has(l.id));

  const print = (list) => {
    if (!list.length) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Labels</title>
      <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>@page{margin:0.3in;size:letter}body{margin:0;display:flex;flex-wrap:wrap;gap:0.15in}</style></head>
      <body>${list.map(labelCardHTML).join("")}</body></html>`);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  };

  const previewLabel = { ...draft, id: "preview" };

  return (
    <div className="print:hidden fixed inset-0 z-50 p-2 md:p-5" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="bg-white rounded-2xl border border-slate-200 w-full h-full flex overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* nav rail */}
        <aside className="w-56 shrink-0 border-r border-slate-200 bg-slate-50/50 flex flex-col">
          <div className="px-4 pt-4 pb-3 flex items-center justify-between">
            <h3 className="ft-serif text-2xl">Apps</h3>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={18} /></button>
          </div>
          <nav className="px-2 space-y-0.5">
            <div className="w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm bg-indigo-600 text-white">Label Generator</div>
            <div className="w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-slate-400">More coming soon</div>
          </nav>
          <div className="mt-auto p-4 text-[11px] text-slate-400 border-t border-slate-100">A home for shop tools.</div>
        </aside>

        {/* main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* preset strip */}
          <div className="flex items-end gap-3 px-5 py-3 border-b border-slate-100 overflow-x-auto">
            {presets.map((p) => {
              const active = draft.presetId === p.id;
              return (
                <button key={p.id} onClick={() => applyPreset(p)} className={`shrink-0 flex flex-col items-center gap-1.5 rounded-lg border px-3 py-2 ${active ? "border-indigo-500 ring-2 ring-indigo-100" : "border-slate-200 hover:border-slate-300"}`}>
                  <div style={{ width: p.w * 24, height: p.h * 24, background: "#1A1A1A", borderRadius: 2 }} />
                  <div className="text-xs font-semibold">{p.name}</div>
                  <div className="text-[10px] text-slate-400">{p.w} × {p.h}″ · ≈{perLetterSheet(p)}/sheet</div>
                </button>
              );
            })}
            <button onClick={saveAsPreset} className="shrink-0 flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 px-4 py-2 text-slate-500 hover:border-slate-400">
              <Plus size={20} className="text-indigo-500" /><span className="text-xs font-semibold">Save size</span>
            </button>
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-[380px_1fr] min-h-0">
            {/* form */}
            <div className="border-r border-slate-100 p-5 overflow-y-auto">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mb-2">Fill from stock book</div>
              <SkuLookup stock={stock} onPick={fillFrom} onBulk={bulkFrom} />

              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold mt-5 mb-1">Label lines</div>
              <div className="text-[11px] text-slate-400 mb-2">Toggle, reorder, resize — then Save Label.</div>
              {draft.lines.map((l, idx) => {
                const meta = LABEL_FIELDS.find((f) => f.key === l.key);
                return (
                  <div key={l.key} className={`flex items-center gap-2 py-1.5 border-b border-slate-50 ${l.show ? "" : "opacity-50"}`}>
                    <div className="flex flex-col">
                      <button onClick={() => moveLine(idx, -1)} className="text-slate-300 hover:text-slate-600 leading-none"><ChevronUp size={13} /></button>
                      <button onClick={() => moveLine(idx, 1)} className="text-slate-300 hover:text-slate-600 leading-none"><ChevronDown size={13} /></button>
                    </div>
                    <button onClick={() => setLine(l.key, { show: !l.show })} className="w-7 h-7 shrink-0 flex items-center justify-center border border-slate-200 rounded-md text-indigo-600">
                      {l.show ? <Eye size={14} /> : <EyeOff size={14} className="text-slate-300" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] uppercase tracking-wide text-slate-400 font-semibold">{meta.label}</div>
                      {meta.kind === "surface" ? (
                        <div className="flex gap-1.5 mt-0.5">
                          {["Floor", "Wall", "Floor & Wall"].map((s) => (
                            <button key={s} onClick={() => setField("surface", s)} className={`flex-1 text-xs font-semibold py-1 rounded-md border ${draft.fields.surface === s ? "bg-slate-800 text-white border-slate-800" : "border-slate-200"}`}>{s}</button>
                          ))}
                        </div>
                      ) : (
                        <input value={draft.fields[l.key]} onChange={(e) => setField(l.key, e.target.value)} className="w-full border border-slate-200 rounded-md px-2 py-1 text-sm mt-0.5" />
                      )}
                    </div>
                    {meta.kind !== "surface" && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button onClick={() => bumpSize(l.key, -1)} className="w-5 h-5 border border-slate-200 rounded text-slate-500 text-xs leading-none">−</button>
                        <span className="text-[10px] text-slate-400 w-4 text-center">{l.size}</span>
                        <button onClick={() => bumpSize(l.key, 1)} className="w-5 h-5 border border-slate-200 rounded text-slate-500 text-xs leading-none">+</button>
                      </div>
                    )}
                  </div>
                );
              })}

              <button onClick={saveAsPreset} className="mt-3 text-xs text-indigo-600 font-semibold underline">＋ Save these lines &amp; size as a preset</button>

              <div className="flex gap-2 mt-4">
                <button onClick={save} className="flex-1 bg-indigo-600 text-white rounded-md py-2 text-sm font-semibold hover:bg-indigo-700">{editingId ? "Save Changes" : "Save Label"}</button>
                <button onClick={startNew} className="border border-slate-200 rounded-md px-4 text-sm font-semibold hover:bg-slate-50">New</button>
              </div>
            </div>

            {/* preview + set */}
            <div className="p-5 overflow-y-auto bg-slate-50/40">
              <div className="flex items-center justify-between mb-3">
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">Live preview</div>
                <div className="flex gap-2">
                  {selected.size > 0 && <button onClick={() => print(selectedLabels)} className="text-xs font-semibold px-3 py-1.5 rounded-md border border-slate-200 bg-white flex items-center gap-1.5"><Printer size={13} /> Print Selected ({selected.size}) · {sheetsForLabels(selectedLabels)} sheet{sheetsForLabels(selectedLabels) === 1 ? "" : "s"}</button>}
                  {labels.length > 0 && <button onClick={() => print(view)} className="text-xs font-semibold px-3 py-1.5 rounded-md bg-slate-800 text-white flex items-center gap-1.5"><Printer size={13} /> Print All ({view.length}) · {sheetsForLabels(view)} sheet{sheetsForLabels(view) === 1 ? "" : "s"}</button>}
                </div>
              </div>

              <div className="mb-5"><LabelCard label={previewLabel} scale={Math.min(1, 210 / (draft.w * 96))} /></div>

              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="text-[13px] font-bold">Label Set ({labels.length})</div>
                <div className="relative flex-1 min-w-[140px]">
                  <Search size={13} className="absolute left-2 top-2 text-slate-400" />
                  <input value={setSearch} onChange={(e) => setSetSearch(e.target.value)} placeholder="Search name / SKU / grout" className="w-full border border-slate-200 rounded-md pl-7 pr-2 py-1 text-xs" />
                </div>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="border border-slate-200 rounded-md px-2 py-1 text-xs">
                  <option value="recent">Recent</option><option value="az">A–Z</option>
                </select>
              </div>
              <div className="flex gap-1.5 mb-3 flex-wrap">
                <button onClick={() => setSizeFilter("all")} className={`text-xs px-2.5 py-1 rounded-full border ${sizeFilter === "all" ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200"}`}>All</button>
                {presets.map((p) => <button key={p.id} onClick={() => setSizeFilter(p.id)} className={`text-xs px-2.5 py-1 rounded-full border ${sizeFilter === p.id ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200"}`}>{p.name}</button>)}
              </div>

              {view.length === 0 ? (
                <div className="border border-dashed border-slate-200 rounded-md p-8 text-center text-sm text-slate-400">{labels.length === 0 ? "No labels yet. Fill out the form and Save Label." : "No labels match."}</div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {view.map((l) => (
                    <div key={l.id} className="relative group">
                      <button onClick={(e) => e.shiftKey ? toggleSel(l.id) : editLabel(l)} className={`block rounded ${selected.has(l.id) ? "ring-2 ring-offset-2 ring-indigo-500" : editingId === l.id ? "ring-2 ring-offset-2 ring-amber-500" : ""}`} title="Click to edit · Shift-click to select for printing">
                        <LabelCard label={l} scale={Math.min(0.6, 120 / (l.w * 96))} />
                      </button>
                      {selected.has(l.id) && <div className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-indigo-600 text-white text-[11px] font-bold flex items-center justify-center">✓</div>}
                      <button onClick={() => onDeleteLabel(l.id)} className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-white border border-slate-200 text-red-500 opacity-0 group-hover:opacity-100 flex items-center justify-center" title="Delete"><Trash2 size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build**

Run: `npm run build`
Expected: build succeeds.

- [ ] **Step 3: Verify in the preview (preview proof #2)**

Run the dev server and, in the app:
1. Open **Apps → Label Generator**.
2. Type in the "Search SKU or name" box (requires stock to be imported); pick a hit → confirm Name/SKU/Size/Price fill and the live preview updates.
3. Toggle a line's 👁, reorder with ▲▼, bump a font size → preview reflects each.
4. Click **Save Label** → it appears in the Label Set.
5. Switch the preset to **Spec Card** → preview resizes; the "≈4/sheet" count shows.
6. Shift-click two set cards → **Print Selected (2) · 1 sheet** appears; click it → a print window opens with the cards laid out.
7. Search/filter/sort the set; delete a card via the hover ✕.

Capture: a screenshot of the editor with a filled label + preview, and the print-window layout.

- [ ] **Step 4: Commit**

```bash
git add src/AppsWorkspace.jsx
git commit -m "feat(labels): Label Generator UI — presets, SKU fill, preview, print"
```

---

## Task 9: Docs + ADR

**Files:**
- Modify: `CLAUDE.md` (source layout table — add `src/labels.js` and `src/AppsWorkspace.jsx`; supabase list — add `labels.sql`)
- Create: `docs/adr/NNNN-apps-hub-label-generator.md` (use the next number; follow `docs/adr/README.md` + `docs/skills-reference/decide/SKILL.md`)

- [ ] **Step 1: Update CLAUDE.md**

Add to the `src/` source-layout list:
```
  labels.js         # Label Generator pure logic (Apps hub): LABEL_FIELDS,
                    # built-in size presets, preset/label normalization,
                    # stock->field mapping, per-letter-sheet math, print HTML
  AppsWorkspace.jsx # the Apps hub overlay (SettingsWorkspace-style shell) +
                    # the Label Generator UI (preset strip, SKU fill, preview,
                    # label set, print)
```
Add to the `supabase/` list:
```
  labels.sql        # run once: labels table + RLS (Apps hub label set)
```

- [ ] **Step 2: Write the ADR**

Record the two decisions: (a) labels in a new shared table + presets in settings; (b) structured savable presets with each label snapshotting its own layout, instead of a free-drag designer. Reference this plan and the spec.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md docs/adr/
git commit -m "docs(labels): source map + ADR for the Apps hub label generator"
```

---

## Task 10: Open the PR

- [ ] **Step 1: Push the branch and open a PR** to `main` summarizing the feature, and **include in the PR body the manual deploy step**: *"Run `supabase/labels.sql` once in the Supabase SQL editor before saving labels will work."* Attach the preview screenshots (proof) from Tasks 7 and 8.

---

## Self-Review

**Spec coverage:**
- Apps hub button + fullscreen workspace → Tasks 7, 8. ✅
- Standalone (not customer-tied) → labels table has no customer_id; Task 5/6. ✅
- Shared via new table → Task 5 (sql) + Task 6 (CRUD via fetchAllRows). ✅
- SKU single-fill + shift-click bulk → Task 8 `SkuLookup` (`onPick`/`onBulk`), Task 6 `addLabelsBulk`. ✅
- Fields editable after fill → Task 8 form inputs bound to `draft.fields`. ✅
- Presets: Sample Tag + Spec Card built-in, custom sizes, save preset → Tasks 1, 4, 8. ✅
- Structured customize (toggle/reorder/font) → Task 8 line controls. ✅
- Find/organize: search + size chips + sort; delete only → Task 8 `view` memo + set UI (no undo/dup/archive). ✅
- Per-sheet counts on presets + print buttons → Tasks 2, 8. ✅
- Card design unchanged, header editable per preset → Task 1 (`header`), Task 3 (`labelCardHTML`), Task 8 (`LabelCard`). ✅
- Files/write-paths as specified → Tasks 1–8. ✅
- Graceful pre-SQL degradation → Task 6 ping-on-error; empty set renders. ✅
- Sticker sheets / free-drag out of scope → not built. ✅

**Placeholder scan:** No TBD/TODO; every code step has complete code. ✅

**Type consistency:** `newDraftFromPreset`, `normPreset`, `stockToLabelFields`, `perLetterSheet`, `sheetsForLabels`, `labelCardHTML` names match across Tasks 1–8. `labelData`/`normLabel` round-trip uses the same field set (`presetId,w,h,header,lines,fields,sku,createdBy,createdAt`) in Tasks 1 and 6. Props passed in Task 7 (`onAddLabel`,`onAddLabelsBulk`,`onUpdateLabel`,`onDeleteLabel`,`onSavePreset`,`presets`,`labels`,`stock`) match the Task 8 signature. ✅

**Note on `uid`:** defined locally in both `labels.js` and `AppsWorkspace.jsx` (the app's `uid` in App.jsx isn't exported); intentional, keeps both modules self-contained.
