# Label Maker Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Apps → Label Generator into the approved three-column layout. Add pin-to-bottom
lines with name auto-shrink, a template dropdown and editor (built-ins editable, restyle prompt), a
stock-search multi-pick for two-size labels, and "Update from stock book" for a selected group.

**Architecture:** All new rules are pure, tested functions in `src/labels.js`, which stays
dependency-free; `skuKeys` is injected. The label UI moves out of `AppsWorkspace.jsx` into its own
`src/LabelMaker.jsx`, which AppsWorkspace mounts. Two new bulk write paths go into `uselabels.js`.
There is no schema change: a pinned group is one divider entry inside the existing `data.lines`.

**Tech Stack:** React 18 hooks, Tailwind + `--ft-*` theme vars, lucide-react, Supabase JS, `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-25-label-maker-overhaul-design.md` (owner-approved
2026-09-25, including the built-in override).

## Global Constraints

- No Supabase mutation from the agent. No SQL is needed (spec §5).
- Never push to `main`. The work lands via a PR from `claude/eloquent-rubin-n8wsg7`.
- UI change: preview screenshots before merge (non-negotiable 3).
- `labels.js` keeps "No imports from app code".
- Anything reading the stock cache checks `bookStockReady` first (CLAUDE.md conventions).
- Standing help goes behind `HelpTip` `?`. State and warnings stay inline (ADR 0045).
- Conservative comments. Reuse existing utility classes and `--ft-*` vars, and invent no colors
  beyond the card's own dark palette and the rust already used for Wall (`#B5654A`).
- Every label saved before this change renders identically (a lines list with no divider pins
  nothing).

---

## File Structure

| File | Change |
|---|---|
| `src/labels.js` | + `PIN_KEY`, divider-aware `normLines`, `splitPinned`, built-ins get a divider above Grout, built-in override in `normLabelPresets`/`customLabelPresets` + `isBuiltinOverridden`/`builtinDefault`, `fitNameSize`, `faceArea`, `trimSize`, `twoSizeDraft`, `restyleLabel`, `refreshPlan`, and `labelCardHTML` with body/bottom + name hook class |
| `src/labels.test.js` | tests for all of the above |
| `src/uselabels.js` | + `updateLabelsBulk(patches)`, `delLabels(ids)` |
| `src/LabelMaker.jsx` | **new**: the Label Generator UI (LabelCard, SkuLookup, TemplateMenu, TemplateEditor, UpdateReview, the three columns) |
| `src/AppsWorkspace.jsx` | label UI removed. It mounts `<LabelMaker …/>` for `app === "labels"` |
| `src/App.jsx` | passes `bookStockReady`, `onUpdateLabelsBulk`, `onDeleteLabels` to AppsWorkspace |
| `src/railpreview.jsx` | new no-op props |
| `index.html` | adds Oswald + Inter to the existing Google Fonts link so the screen preview measures in the print fonts (one request, as today) |
| `src/CLAUDE.md` | entries for labels.js / uselabels.js / LabelMaker.jsx / AppsWorkspace.jsx |
| `.scratch/157_label-maker-overhaul/preview.html` + `preview.jsx` | dev harness over the REAL LabelMaker |

---

### Task 1: Pin divider + built-in override (labels.js)

**Files:** Modify `src/labels.js`, test `src/labels.test.js`

**Interfaces — Produces:**
- `PIN_KEY = "pin"`
- `isPin(k): boolean`
- `normLines(raw)`: keeps at most one `{key:"pin", show:true, size:0}` entry where it was given
- `splitPinned(lines) → { body: Line[], bottom: Line[] }` over shown lines. With no divider, bottom is `[]`
- `BUILTIN_PRESETS` Sample Tag / Spec Card have a divider right before `grout`
- `normLabelPresets(raw)`: a raw entry with a built-in id **replaces** that built-in (normalized)
- `customLabelPresets(presets)`: non-built-ins **plus** built-ins that differ from their code default
- `builtinDefault(id) → Preset | null`, `isBuiltinOverridden(preset) → boolean`

- [ ] **Step 1: failing tests**

```js
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
```

- [ ] **Step 2:** `npm test` → FAIL (`PIN_KEY` not exported)
- [ ] **Step 3: implement**
  - `normLines` gets a branch: `if (key === PIN_KEY) { if (!seen.has(key)) { seen.add(key); out.push(line(PIN_KEY, true, 0)); } continue; }` placed before the `isField` check.
  - Built-ins insert `line("pin", true, 0)` before `grout`.
  - `normLabelPresets`: `const saved = new Map(list.map(p => [str(p?.id), p]))`; built-ins map to `saved.has(id) ? normPreset({ ...saved.get(id), id }) : normPreset(b)`; customs are the non-built-ins.
  - `builtinDefault(id)` = `normPreset(BUILTIN_PRESETS.find(...))`.
  - `isBuiltinOverridden(p)` = built-in id && `JSON.stringify(p) !== JSON.stringify(builtinDefault(p.id))`.
  - `customLabelPresets` keeps `!BUILTIN_IDS.has(id) || isBuiltinOverridden(p)`.
  - `labelCardHTML`: render `body` lines, then `<div style="margin-top:auto;flex-shrink:0;display:flex;flex-direction:column;">` + bottom lines + `</div>`. The name div gets `class="lc-name"` and the card div gets `class="lc"`. A spacer line in bottom works unchanged.
  - Update the header comment that says code built-ins always win.
- [ ] **Step 4:** `npm test` → PASS, and all old label tests still pass
- [ ] **Step 5:** commit `labels: pin-to-bottom divider + editable built-in templates`

### Task 2: Name auto-fit rule + two-size helpers (labels.js)

**Interfaces — Produces:**
- `NAME_FLOOR = 7`
- `fitNameSize(overflowsAt: (px)=>boolean, start: number, floor = NAME_FLOOR) → number`: the largest size ≤ start, stepping 0.5, that doesn't overflow; `floor` if none does. `overflowsAt` sets the size and measures
- `faceArea(sizeText) → number | null` (`"24x48"` → 1152, `"2x2"` → 4, `"Hex 2in"` → null)
- `trimSize(name) → string`: drops a trailing `24x48` / `12" x 24"`-style token
- `twoSizeDraft(a, b) → { fields, fields2, sku, swapped }`: `a` and `b` are stock items. The bigger `faceArea` goes first (ties or unparseable keep the given order, `swapped:false`). `fields` = `stockToLabelFields(first)` with `name: trimSize(...)`. `fields2` = `{sku,size,price}` of the second

- [ ] **Step 1: failing tests**

```js
test("fitNameSize steps down by 0.5 until nothing overflows, stopping at the floor", () => {
  assert.equal(fitNameSize(() => false, 13), 13);
  assert.equal(fitNameSize((px) => px > 11, 13), 11);
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
```

- [ ] **Step 2:** FAIL. **Step 3:** implement, where `SIZE_RE = /(\d+(?:\.\d+)?)\s*["']?\s*[x×]\s*(\d+(?:\.\d+)?)/i` feeds `faceArea` and the trailing `\s+…\s*["']?\s*$` feeds `trimSize`. **Step 4:** PASS. **Step 5:** commit `labels: name auto-fit rule + two-size fill helpers`

### Task 3: restyleLabel + refreshPlan (labels.js)

**Interfaces — Produces:**
- `restyleLabel(label, preset) → patch {presetId, w, h, header, lines}`. `w` = `label.twoVariant ? max(preset.w, 2) : preset.w`. Lines are the preset's (font nudges reset). Text, `fields2`, `sku` and `twoVariant` are untouched
- `refreshPlan(labels, stock, keysOf) → { changed, same, missing, noSku }`
  - For each label, the SKUs are `fields.sku || label.sku`, plus `fields2.sku` when `twoVariant`
  - The index is built from live stock only (`active && !discontinued && !disabled`) over every `keysOf(it.sku)` spelling
  - A label with no SKU at all → `noSku`
  - Any SKU unmatched → `missing` (`{ id, label, missingSkus }`)
  - Otherwise new prices come from `stockToLabelFields(item).price`, falling back to the old when empty
  - Differs → `changed` with `{ id, label, patch:{fields, fields2}, before:{price, price2}, after:{price, price2} }`, else `same`

- [ ] **Step 1: failing tests**

```js
const keys = (c) => [String(c || "").trim(), String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "")].filter(Boolean);
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
  const plan = refreshPlan(labels, stock, keys);
  assert.deepEqual(plan.changed.map((c) => c.id), ["a"]);
  assert.equal(plan.changed[0].patch.fields.price, "$5.15/sq ft");
  assert.equal(plan.changed[0].patch.fields.name, "Alpine");
  assert.deepEqual(plan.same.map((x) => x.id), ["b"]);
  assert.deepEqual(plan.missing.map((x) => x.id), ["c"]);
  assert.deepEqual(plan.noSku.map((x) => x.id), ["d"]);
});

test("refreshPlan matches any skuKeys spelling and checks the second size", () => {
  const l = normLabel({ id: "t", twoVariant: true, fields: { sku: "cg-2448", price: "$7.25/sq ft" }, fields2: { sku: "CG1224", price: "$6.40/sq ft" } });
  const stock = [live({ sku: "CG-2448", priceSqft: 6.95 }), live({ sku: "CG-1224", priceSqft: 6.4 })];
  const plan = refreshPlan([l], stock, keys);
  assert.equal(plan.changed.length, 1);
  assert.deepEqual(plan.changed[0].after, { price: "$6.95/sq ft", price2: "$6.40/sq ft" });
});

test("restyleLabel takes the template layout and keeps the text", () => {
  const tpl = normPreset({ id: "sample-tag", w: 1.5, h: 3, header: "Keim", lines: [{ key: "name", show: true, size: 20 }] });
  const l = normLabel({ id: "x", twoVariant: true, w: 2, fields: { name: "Keep me" }, lines: [{ key: "name", show: true, size: 9 }] });
  const p = restyleLabel(l, tpl);
  assert.equal(p.h, 3);
  assert.equal(p.w, 2);
  assert.equal(p.lines.find((x) => x.key === "name").size, 20);
  assert.equal(p.fields, undefined);
});
```

- [ ] Steps 2–5 as in Task 1. Commit `labels: restyle + stock-book refresh plan`

### Task 4: Bulk write paths (uselabels.js) + App wiring

**Interfaces — Produces:**
- `updateLabelsBulk(patches: {id, patch}[])` — one optimistic `setLabels`, one `supabase.from("labels").upsert(rows)` of `{id, position, data: labelData(l)}`, then `flashSaved()`; on failure `ping("Save failed — check connection")`
- `delLabels(ids: string[])` — one optimistic filter, one `.delete().in("id", ids)`; on failure `ping("Delete failed")`
- AppsWorkspace props `bookStockReady`, `onUpdateLabelsBulk`, `onDeleteLabels`, passed through to LabelMaker

- [ ] Implement both functions next to `updateLabel`/`delLabel`, following their exact shape, and return them from the hook.
- [ ] `App.jsx`: destructure them from `useLabels` and pass `bookStockReady={bookStockReady} onUpdateLabelsBulk={updateLabelsBulk} onDeleteLabels={delLabels}` on `<AppsWorkspace>`.
- [ ] `railpreview.jsx`: add the three props (`bookStockReady` true, the others `noop`).
- [ ] `npm run lint && npm test`. Commit `labels: bulk update/delete write paths`

### Task 5: LabelMaker.jsx — three-column shell + everyday form

Move the label UI out of AppsWorkspace into `src/LabelMaker.jsx` (`export function LabelMaker({ stock, bookStockReady, labels, presets, onAddLabel, onAddLabelsBulk, onUpdateLabel, onUpdateLabelsBulk, onDeleteLabel, onDeleteLabels, onSavePreset })`). AppsWorkspace keeps only `{app === "labels" && <LabelMaker …/>}` and drops label imports/state.

Everyday layout (spec §2):
- Grid `md:grid-cols-[340px_300px_minmax(0,1fr)]`, stacking below md; each column scrolls on its own.
- **Left:** `SkuLookup` (full width) → row: status (`● New label` moss / `● Editing "<name>"` amber `#C8912E`), `New`, `Save label`/`Save changes` (ink fill) → form grid.
- **Form grid:** `grid-cols-[62px_1fr_50px]`. `Nudge` = `−`/`+` as plain text buttons (`text-slate-400 hover:text-slate-800`, 14px wide) around a tabular-nums number. Surface is a joined 2-button seg. The shown lines follow `splitPinned(draft.lines)`: body rows, then (if bottom is non-empty) a dashed moss "Bottom of label" divider and the bottom rows with `border-l-[3px]` in `var(--ft-brand)` on the box. Spacers never show on the everyday form (they belong to the template). With `twoVariant`, the SKU/Size/Price rows show two inputs side by side, plus a `✕ Remove second size` link. The "＋ Add a second size" link turns it on (existing widen logic).
- **Middle:** `TemplateMenu` trigger (Task 6), "Live preview" eyebrow, `LabelCard` scaled `min(1.3, 250/(w*96))`, fit note from `onFit`.
- **Right:** the label set (Task 8), or the template editor while it's open (Task 6).
- **`LabelCard`:** a structure change only. Body lines, then a bottom wrapper `{ marginTop: "auto", flexShrink: 0, display: "flex", flexDirection: "column" }`. `useLayoutEffect` over `[label, scale]`: set the name node's fontSize through `fitNameSize((px) => { nameEl.style.fontSize = px + "px"; return card.scrollHeight > card.clientHeight + 1; }, nameLine.size)`, store the result in state, and report `onFit?.({ from, to, stuck })` (stuck = floor still overflows). Re-run on `document.fonts.ready`.
- The label set's card `<button>` gets `text-left` (the centering fix).
- `index.html`: add `&family=Oswald:wght@500;600&family=Inter:wght@400;600;700` to the existing Google Fonts URL.
- [ ] Build it, `npm run lint && npm run build`, and check it in the harness (Task 9 harness is created first, in this task, to see work). Commit `label maker: three-column layout, clean form, pinned divider, auto-fit card`

### Task 6: Template menu + editor + restyle prompt

- **`TemplateMenu`**: the trigger chip (swatch drawn to shape, name, `w × h″ · ≈N/sheet`, caret). While editing it reads `Editing "<name>" ✕`. It opens `PopMenu at={{anchor}} width={280}` with:
  - a "Templates" eyebrow and one row per preset (✓ current), picking `applyPreset(p)`, which now **keeps typed fields** (`{...newDraftFromPreset(p), fields: draft.fields, fields2: draft.fields2, twoVariant: draft.twoVariant, sku: draft.sku}` + the widen rule)
  - a separator, `⚙ Edit "<name>"…` and `＋ New template…`
- **Editing model:** opening the editor snapshots `{w,h,header,lines}` of the draft (for ✕ cancel) and sets `tplEdit = { id, name, isNew }`. The editor edits the **draft's** layout directly, so the form and preview follow live.
- **`TemplateEditor`** (right column): Size & header (W, H, header + `HelpTip` about Keim/logo, ≈N/sheet); a lines list with grip drag (existing `rowDnD`), eye, `Nudge`, filler remove, and the `pin` row drawn as a draggable "Pinned to bottom" divider (no eye/nudge); `＋ Filler space`. Actions:
  - `Update "<name>"` (hidden for `isNew`) → `onSavePreset(normPreset({...tpl, w,h,header,lines}))`. Then, if `labels.filter(l => l.presetId === id).length > 0`, an inline prompt: "Also restyle the N saved <name> labels? Their text and prices stay." with **Restyle N** → `onUpdateLabelsBulk(list.map(l => ({ id: l.id, patch: restyleLabel(l, preset) })))`, and **Leave them** closes.
  - `Save as new…` → `window.prompt` for a name → `onSavePreset(normPreset({ id: uid(), name, …layout }))`, then switch the draft's `presetId` to it.
  - `Reset to default` (built-in and `isBuiltinOverridden`) → `onSavePreset(builtinDefault(id))` and re-apply it to the draft.
  - `Close without saving` restores the snapshot.
- [ ] Build, lint, harness check. Commit `label maker: template dropdown + editor with restyle prompt`

### Task 7: Stock search multi-pick

`SkuLookup({ stock, onPick, onTwo, onAddMany })` for the main search, and `SkuLookup({ stock, onPick: fillFrom2, single: true })` for the second-size search, which keeps today's single pick.
- Each result row has a checkbox (`accent-[var(--ft-brand)]`) and a name button. Clicking the name → `onPick(it)` and close. Toggling the box adds or removes it in `picked` (tick order), and the panel stays open (`onMouseDown` preventDefault on the whole panel).
- With `picked.length ≥ 1`, a sticky footer: `N picked` · (**One label, 2 sizes** when exactly 2) · **Add N labels** · the order line from `twoSizeDraft(...)` ("Bigger first: 24x48, then 12x24", or "Same size — kept in the order picked"). Ticked rows show `1st`/`2nd` badges when exactly 2.
- `onTwo(a,b)` in LabelMaker: `const d = twoSizeDraft(a,b)` → the draft gets `twoVariant: true`, the widen rule, `fields: {...draft.fields, ...d.fields}`, `fields2: {...draft.fields2, ...d.fields2}`, `sku: d.sku`.
- `onAddMany(items)` → `onAddLabelsBulk(items.map(it => ({...draft, sku: it.sku||null, fields: {...draft.fields, ...stockToLabelFields(it)}})))`.
- Shift-click on a row name toggles its checkbox (the old gesture still does something sensible).
- [ ] Build, lint, harness check. Commit `label maker: multi-pick stock search (two sizes, bigger first; add many)`

### Task 8: Label set — selection bar, print, bulk delete, update review

- Header: `Label set (n)`, search box, sort, template chips (unchanged filters). Each card has a round corner checkbox (moss when on). Click the card to edit; click the checkbox or shift-click to toggle selection.
- **Selection bar** (ink fill, `rounded-lg`):
  - None selected: `Select` · `Select all N shown`.
  - Some selected: `N selected` · `Print N · K sheets` · `↻ Update from stock book` (disabled "Stock book loading…" until `bookStockReady`) · `Delete` (inline confirm "Delete N labels? Yes / No" → `onDeleteLabels(ids)`, clearing an edit if it hit the edited label) · `Clear`.
- **Update review** replaces the grid while open: `refreshPlan(selectedLabels, stock, skuKeys)` computed on open (`skuKeys` imported from `orderbook.js` in LabelMaker, not labels.js). Sections: Price changed (old struck, new in rust when up, moss when down; the second size is listed too), Up to date, SKU not in the stock book (per-row Keep/Delete radio, Keep default), No SKU (skipped). The button reads **Apply: update N · delete M** → `onUpdateLabelsBulk(changed.map(c => ({id: c.id, patch: c.patch})))`, plus `onDeleteLabels(chosen)`. Then a done bar: `✓ Updated N labels.` · `Print the N updated · K sheets` · `Done`. `Cancel` closes the review.
- **Print:** `print(list)` as today, plus the fit. After images load, `await w.document.fonts.ready`, then for each `.lc` card: `const nm = card.querySelector(".lc-name"); if (nm) fitNameSize((px) => { nm.style.fontSize = px + "px"; return card.scrollHeight > card.clientHeight + 1; }, parseFloat(nm.style.fontSize))`, then `w.print()`.
- [ ] Build, lint, harness check. Commit `label maker: select group, print/delete, update from stock book`

### Task 9: Harness, screenshots, docs, PR

- [ ] `.scratch/157_label-maker-overhaul/preview.html` + `preview.jsx`: the REAL `LabelMaker` over stateful in-memory labels, presets (with `saveLabelPreset`-equivalent merging through `normLabelPresets`) and stock. The stock includes the Calacatta 12x24/24x48 pair, a repriced Alpine, and a missing Terra. Below it, a strip of real `labelCardHTML` output run through the same fit.
- [ ] Playwright screenshots into `.scratch/157_label-maker-overhaul/shots/`:
  1. everyday view (long name shrunk above pinned grout)
  2. template menu open
  3. editor + restyle prompt
  4. multi-pick footer
  5. group selected
  6. update review
  7. print-updated bar
  8. print strip
- [ ] `src/CLAUDE.md`: update the `labels.js`, `AppsWorkspace.jsx` and `uselabels.js` entries, and add `LabelMaker.jsx`.
- [ ] `npm test && npm run lint && npm run build`, all green.
- [ ] Commit, push, open a PR (template check first) with the screenshots referenced, and subscribe to PR activity.
