# Materials & add-ons PR 1 — Settings reorg Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the "Grout & colors" and "Mortar & underlayment" Settings sections into one "Materials & add-ons" library section (built-ins presented as locked categories, Price-book-tab pattern) and give underlayment a team-set chip default like grout/mortar.

**Architecture:** Pure UI reorg inside `SettingsWorkspace` (App.jsx) plus one small data extension in catalog.js: `catalog.defaults` grows an `underlay` key (seeded blank = "first offered", today's exact behavior). No new tables, no job-data shape changes, no custom categories yet (that's PR 2 — see the spec, `docs/superpowers/specs/2026-07-15-materials-add-ons-design.md`).

**Tech Stack:** React 18 (hooks, one big App.jsx — follow its patterns), Tailwind utility classes (slate/indigo, re-themed by `src/index.css`), lucide-react icons, `node --test` for pure logic in catalog.js.

## Global Constraints

- **Never touch the live Supabase project** — this PR needs no SQL and must add none.
- **Never push to `main`** — work lands on branch `claude/epic-ride-sdnjud`, merged by PR.
- **No UI change merges without preview proof** — screenshots (light + dark) are the merge gate (Task 5).
- All catalog writes go through `setSettings({ catalog })` via existing helpers (`setCatalogDefault`, `addProduct`, …) — no ad-hoc write paths.
- Comments: rare, only for non-obvious business rules (CLAUDE.md convention).
- Old records must stay valid: `normDefaults` is the only normalizer touched; it must default the new key, never require it.
- Tests: `npm test` (runs `node --test src/*.test.js`) must pass at every commit.

---

### Task 1: `defaults.underlay` in catalog.js (TDD)

**Files:**
- Modify: `src/catalog.js` (`normDefaults` ~line 355, `setCatalogDefault` ~line 361)
- Test: `src/catalog.test.js` (defaults block, ~lines 264–284)

**Interfaces:**
- Consumes: existing `normDefaults`, `setCatalogDefault`, `normalizeSettings`, `serializeSettings`.
- Produces: `normDefaults(raw)` returns `{ grout, mortar, underlay }` (underlay seeded `""`); `setCatalogDefault(catalog, "underlayments", name)` writes `defaults.underlay`. Tasks 2 and 4 rely on exactly these names.

- [ ] **Step 1: Update the existing `normDefaults` test and add the new cases**

In `src/catalog.test.js`, the existing test at ~line 264 does a `deepEqual` that will break when the key is added — update it in place and add two tests after the round-trip test (~line 284):

```js
test("normDefaults seeds ProLite / PermaColor Select and keeps stored names verbatim", () => {
  assert.deepEqual(normDefaults(undefined), { grout: "PermaColor Select", mortar: "ProLite", underlay: "" });
  assert.deepEqual(normDefaults({ grout: "CEG-Lite", mortar: "AcrylPro" }), { grout: "CEG-Lite", mortar: "AcrylPro", underlay: "" });
  assert.equal(normDefaults({ underlay: "HardieBacker" }).underlay, "HardieBacker");
});

test("setCatalogDefault 'underlayments' sets defaults.underlay and leaves grout/mortar", () => {
  const s = normalizeSettings(undefined);
  const c = setCatalogDefault(s.catalog, "underlayments", "HardieBacker");
  assert.equal(c.defaults.underlay, "HardieBacker");
  assert.equal(c.defaults.grout, "PermaColor Select");
  assert.equal(c.defaults.mortar, "ProLite");
});

test("underlay default survives a serialize round-trip", () => {
  const s = normalizeSettings(undefined);
  const c = setCatalogDefault(s.catalog, "underlayments", "HardieBacker");
  const round = normalizeSettings(serializeSettings({ ...s, catalog: c }));
  assert.equal(round.catalog.defaults.underlay, "HardieBacker");
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test 2>&1 | tail -20`
Expected: the updated `normDefaults` test FAILS (`underlay` key missing) and the `setCatalogDefault 'underlayments'` test FAILS (`defaults.underlay` is `undefined` — today's code maps every non-grout kind to `mortar`, so it would also clobber `defaults.mortar`).

- [ ] **Step 3: Implement**

In `src/catalog.js`, replace `normDefaults` (the seed stays "no stored default" — `resolveMaterialDefault` then falls to the first offered product, which is exactly today's `underlayNames[0]` behavior):

```js
export const normDefaults = (raw) => ({
  grout: String(raw?.grout ?? DEFAULT_GROUT),
  mortar: String(raw?.mortar ?? DEFAULT_MORTAR),
  underlay: String(raw?.underlay ?? ""),
});
```

And in `setCatalogDefault`, replace the key line:

```js
const key = kind === "grouts" ? "grout" : kind === "mortars" ? "mortar" : "underlay";
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npm test 2>&1 | tail -5`
Expected: all tests PASS (the whole suite — no other test asserts the exact defaults shape, but confirm).

- [ ] **Step 5: Commit**

```bash
git add src/catalog.js src/catalog.test.js
git commit -m "catalog: add defaults.underlay chip default (blank = first offered)"
```

---

### Task 2: Job rows consume the underlayment default

**Files:**
- Modify: `src/App.jsx:2646-2649` (row-scope derivations) and `src/App.jsx:2980` (unchecked-chip ghost label)

**Interfaces:**
- Consumes: `resolveMaterialDefault` (already imported in App.jsx line 6) and `settings.catalog.defaults?.underlay` from Task 1.
- Produces: nothing new — behavior only. With no default stored the row behaves byte-for-byte as before (`resolveMaterialDefault(names, "", "")` → `names[0] || ""`).

- [ ] **Step 1: Derive the default once per row**

At `src/App.jsx:2646`, after the `underlayOpts` line, the current code reads:

```jsx
const underlayNames = offeredUnderlayments(settings.catalog, p.type);
const underlayOpts = p.underlay.product && !underlayNames.includes(p.underlay.product) ? [p.underlay.product, ...underlayNames] : underlayNames;

const toggleUnderlay = () => updProduct(a.id, p.id, { underlay: { ...p.underlay, checked: !p.underlay.checked, product: p.underlay.checked ? p.underlay.product : (p.underlay.product || underlayNames[0] || "") } });
```

Replace the `toggleUnderlay` line (keep the two lines above unchanged) with:

```jsx
const underlayDefault = resolveMaterialDefault(underlayNames, "", settings.catalog.defaults?.underlay);
const toggleUnderlay = () => updProduct(a.id, p.id, { underlay: { ...p.underlay, checked: !p.underlay.checked, product: p.underlay.checked ? p.underlay.product : (p.underlay.product || underlayDefault) } });
```

(Note: `resolveMaterialDefault` gets `""` as the current pick, not `p.underlay.product` — the row's own stored pick must keep winning verbatim even if no longer offered, which the explicit `p.underlay.product || …` preserves.)

- [ ] **Step 2: Fix the ghost label**

At `src/App.jsx:2980` replace:

```jsx
<span className="text-xs text-slate-400 truncate">{p.underlay.product || underlayNames[0] || ""}</span>
```

with:

```jsx
<span className="text-xs text-slate-400 truncate">{p.underlay.product || underlayDefault}</span>
```

- [ ] **Step 3: Build check**

Run: `npm run build 2>&1 | tail -3`
Expected: `✓ built in …` with no errors. Run `npm test 2>&1 | tail -3` — still all pass.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "job rows: underlayment chip starts from the team default"
```

---

### Task 3: Merge the two catalog sections into "Materials & add-ons"

**Files:**
- Modify: `src/App.jsx` — lucide import (line 3), a new module-level const (just above `function SettingsWorkspace`, ~line 4463), and inside `SettingsWorkspace`: state (~4467), `kindsFor` (~4560), `kindTag` removal (~4561), `SECTIONS` (~4573), the section-branch condition + a new category column (~4848–4880), master-list hint (~4859), "Companies with no …" copy (~4870)

**Interfaces:**
- Consumes: existing `SettingsWorkspace` state helpers (`setSel`, `setAdding`, …), `kindLabel`.
- Produces: module-level `MATERIAL_CATEGORIES` — `[{ id: "grout"|"mortar"|"underlay", label, kind: "grouts"|"mortars"|"underlayments", icon, applies: string, math: string }]` — and component state `const [cat, setCat] = useState("grout")`. Task 4 reads both.

- [ ] **Step 1: Add the `Package` icon to the lucide import**

In `src/App.jsx:3`, change `Percent, BookOpen, Paintbrush,` to `Percent, BookOpen, Package, Paintbrush,`.

- [ ] **Step 2: Add `MATERIAL_CATEGORIES` above `SettingsWorkspace`**

Immediately before `function SettingsWorkspace(…)` (~line 4464):

```jsx
// The Materials & add-ons library's built-in categories (spec 2026-07-15,
// PR 1). Locked: math and floor scope live in code; only their catalog
// content and chip default are team-editable. Custom add-on categories
// join this list in a later PR.
const MATERIAL_CATEGORIES = [
  { id: "grout", label: "Grout", kind: "grouts", icon: Paintbrush, applies: "Tile", math: "Volumetric — scales with tile size, joint & thickness" },
  { id: "mortar", label: "Mortar", kind: "mortars", icon: Package, applies: "Tile", math: "Tiered coverage by the tile's longest side" },
  { id: "underlay", label: "Underlayment", kind: "underlayments", icon: Layers, applies: "Per product — the flooring-type chips on each product", math: "Flat sq ft coverage · optional install materials" },
];
```

- [ ] **Step 3: Section + category state**

At `src/App.jsx:4467` replace:

```jsx
const [section, setSection] = useState("grout");
```

with:

```jsx
const [section, setSection] = useState("materials");
const [cat, setCat] = useState("grout"); // which Materials & add-ons category is open
```

- [ ] **Step 4: `kindsFor` follows the category; drop `kindTag`**

At `src/App.jsx:4560-4561` replace:

```jsx
const kindsFor = section === "grout" ? ["grouts"] : ["mortars", "underlayments"];
const kindTag = { grouts: "Grout", mortars: "Mortar", underlayments: "Underlayment" };
```

with:

```jsx
const kindsFor = [{ grout: "grouts", mortar: "mortars", underlay: "underlayments" }[cat]];
```

- [ ] **Step 5: One nav entry replaces two**

At `src/App.jsx:~4577-4578` replace the two entries:

```jsx
{ id: "grout", label: "Grout & colors", icon: Paintbrush, hint: String(catalog.companies.reduce((n, c) => n + c.grouts.length, 0)) },
{ id: "matunder", label: "Mortar & underlayment", icon: Layers, hint: String(catalog.companies.reduce((n, c) => n + c.mortars.length + (c.underlayments?.length || 0), 0)) },
```

with:

```jsx
{ id: "materials", label: "Materials & add-ons", icon: Layers, hint: String(catalog.companies.reduce((n, c) => n + c.grouts.length + c.mortars.length + (c.underlayments?.length || 0), 0)) },
```

- [ ] **Step 6: Branch condition + category column**

At `src/App.jsx:4848` replace the branch opener:

```jsx
{(section === "grout" || section === "matunder") ? (
  <>
```

with (the category column mirrors the Price book tab's inner book list — see App.jsx:3651 for the pattern being copied):

```jsx
{section === "materials" ? (
  <>
    <div className="w-44 shrink-0 border-r border-slate-200 overflow-y-auto py-3 px-2 space-y-0.5">
      <div className="ft-eyebrow text-[10px] text-slate-400 px-1.5 mb-1">Materials</div>
      {MATERIAL_CATEGORIES.map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => { setCat(id); setSel(null); setAdding(null); setConfirmDel(null); setMenuFor(null); setShowOthers(false); setRename(null); setCoRename(null); }}
          className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left ${cat === id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
          <Icon size={14} className={cat === id ? "" : "text-slate-400"} />
          <span className="flex-1 truncate">{label}</span>
          <Lock size={10} className={cat === id ? "text-white/60" : "text-slate-300"} />
        </button>
      ))}
      <div className="ft-eyebrow text-[10px] text-slate-400 px-1.5 pt-3 mb-1">Add-ons</div>
      <p className="px-1.5 text-[11px] text-slate-400">None yet.</p>
    </div>
```

- [ ] **Step 7: Single-kind master list copy**

At `src/App.jsx:~4859` the sub-line no longer needs a kind prefix (each category is one kind). Replace:

```jsx
<span className="block text-[10px] text-slate-400 truncate">{section === "matunder" ? `${kindTag[kind]} · ${masterHint(kind, p)}` : masterHint(kind, p)}</span>
```

with:

```jsx
<span className="block text-[10px] text-slate-400 truncate">{masterHint(kind, p)}</span>
```

And at `src/App.jsx:~4870` replace:

```jsx
<span className="flex-1 text-left">Companies with no {section === "grout" ? "grouts" : "mortars or underlayments"}</span>
```

with:

```jsx
<span className="flex-1 text-left">Companies with no {kindLabel(kindsFor[0])}s</span>
```

- [ ] **Step 8: Build + smoke**

Run: `npm run build 2>&1 | tail -3` — expect `✓ built`. Run `npm test 2>&1 | tail -3` — all pass. If a stray `section === "grout"` / `"matunder"` reference remains, `grep -n '"matunder"\|section === "grout"' src/App.jsx` must return nothing.

- [ ] **Step 9: Commit**

```bash
git add src/App.jsx
git commit -m "settings: merge catalog sections into a Materials & add-ons library"
```

---

### Task 4: Category-settings pane + underlayment default UI

**Files:**
- Modify: `src/App.jsx` — catalog.js import (line 6), `isDefaultMaterial` (~4496), master-list star (~4858), `detailHeader` default control (~4637-4639), empty-detail placeholder (~4886), new `renderCategoryPane` (define next to `renderGroutDetail`, ~4647)

**Interfaces:**
- Consumes: `MATERIAL_CATEGORIES` + `cat` from Task 3; `setCatalogDefault("underlayments", …)` from Task 1; `isOffered`, `offeredGrouts`, `offeredMortars` from catalog.js.
- Produces: `renderCategoryPane()` — the detail pane shown while no product is selected.

- [ ] **Step 1: Import `isOffered`**

In `src/App.jsx:6`, add `isOffered` to the catalog.js import list (e.g. after `resolveMaterialDefault,`).

- [ ] **Step 2: Generalize `isDefaultMaterial`**

At `src/App.jsx:4496` replace:

```jsx
const isDefaultMaterial = (kind, name) => String(catalog.defaults?.[kind === "grouts" ? "grout" : "mortar"] || "").trim().toLowerCase() === String(name || "").trim().toLowerCase();
```

with:

```jsx
const isDefaultMaterial = (kind, name) => String(catalog.defaults?.[{ grouts: "grout", mortars: "mortar", underlayments: "underlay" }[kind]] || "").trim().toLowerCase() === String(name || "").trim().toLowerCase();
```

- [ ] **Step 3: Default star/button for underlayments in `detailHeader`**

At `src/App.jsx:~4637-4639` replace:

```jsx
{(kind === "grouts" || kind === "mortars") && (isDefaultMaterial(kind, p.name)
  ? <span title="New tile rows start with this material" className="flex items-center gap-1 text-xs font-medium text-indigo-600"><Star size={12} className="fill-current" /> Default</span>
  : <button onClick={() => onChange(setCatalogDefault(catalog, kind, p.name))} title="Make this the default new tile rows start with" className="text-xs text-slate-400 hover:text-indigo-600">Set as default</button>)}
```

with:

```jsx
{(isDefaultMaterial(kind, p.name)
  ? <span title={kind === "underlayments" ? "Rows turning on the underlayment chip start with this product" : "New tile rows start with this material"} className="flex items-center gap-1 text-xs font-medium text-indigo-600"><Star size={12} className="fill-current" /> Default</span>
  : <button onClick={() => onChange(setCatalogDefault(catalog, kind, p.name))} title={kind === "underlayments" ? "Make this the product the underlayment chip starts with" : "Make this the default new tile rows start with"} className="text-xs text-slate-400 hover:text-indigo-600">Set as default</button>)}
```

- [ ] **Step 4: Master-list star for all kinds**

At `src/App.jsx:~4858` replace:

```jsx
{(kind === "grouts" || kind === "mortars") && isDefaultMaterial(kind, p.name) && <Star size={10} className="fill-current text-indigo-500 shrink-0" title="Default for new tile rows" />}
```

with:

```jsx
{isDefaultMaterial(kind, p.name) && <Star size={10} className="fill-current text-indigo-500 shrink-0" title="Chip default" />}
```

- [ ] **Step 5: Add `renderCategoryPane` and wire the placeholder**

Define directly above `renderGroutDetail` (~line 4647):

```jsx
// Shown while no product is selected: the built-in category's locked
// identity plus its one team-editable knob, the chip default. Underlay's
// blank option = "first offered", today's pre-default behavior.
const renderCategoryPane = () => {
  const meta = MATERIAL_CATEGORIES.find((c) => c.id === cat);
  const offered = cat === "grout" ? offeredGrouts(catalog)
    : cat === "mortar" ? offeredMortars(catalog)
      : catalog.companies.flatMap((co) => (co.underlayments || []).filter((u) => isOffered(co, u)).map((u) => u.name));
  const current = String(catalog.defaults?.[cat === "underlay" ? "underlay" : cat] || "");
  const Icon = meta.icon;
  return (
    <div className="max-w-xl">
      <p className="ft-eyebrow text-[10px] text-slate-400">Materials &amp; add-ons · built-in</p>
      <h2 className="ft-serif text-3xl leading-tight mt-1 flex items-center gap-2.5"><Icon size={22} className="text-slate-400" /> {meta.label} <Lock size={14} className="text-slate-300" /></h2>
      <div className="mt-5 space-y-2 text-sm">
        <div className="flex gap-2"><span className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-slate-400 pt-0.5">Applies to</span><span className="text-slate-500">{meta.applies}</span></div>
        <div className="flex gap-2"><span className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-slate-400 pt-0.5">Quantity</span><span className="text-slate-500">{meta.math}</span></div>
      </div>
      <div className="mt-6 max-w-xs">
        <label className={lbl}>Default product</label>
        <select value={offered.includes(current) ? current : ""} onChange={(e) => onChange(setCatalogDefault(catalog, meta.kind, e.target.value))} className={inp}>
          {cat === "underlay" ? <option value="">— first offered —</option> : !offered.includes(current) && <option value="">Select…</option>}
          {offered.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <p className="text-[11px] text-slate-400 mt-1.5">{cat === "underlay" ? "Pre-selected when a row's underlayment chip is turned on." : "New tile rows start with this product."}</p>
      </div>
      <p className="text-xs text-slate-400 mt-8">Pick a product on the left to edit its numbers — or add one under its company.</p>
    </div>
  );
};
```

Then at `src/App.jsx:~4886` replace the placeholder:

```jsx
: <div className="h-full flex items-center justify-center text-sm text-slate-400">Select a product on the left — or add one under its company.</div>}
```

with:

```jsx
: renderCategoryPane()}
```

- [ ] **Step 6: Build + tests**

Run: `npm run build 2>&1 | tail -3` — `✓ built`. `npm test 2>&1 | tail -3` — all pass.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git commit -m "settings: category pane with locked built-in info + underlayment chip default"
```

---

### Task 5: Docs, verification, preview proof

**Files:**
- Modify: `CLAUDE.md` (ADR 0007 paragraph — the left-nav sections list)

**Interfaces:** none — documentation and the merge gate.

- [ ] **Step 1: Update CLAUDE.md's section list**

In the "**Grout colors from the book & the Settings workspace**" paragraph, replace the sentence fragment `left-nav sections (General · Price book · Grout & colors · Mortar & underlayment · Backup & restore)` with `left-nav sections (General · Price book · Materials & add-ons · Backup & restore; the built-in Grout / Mortar / Underlayment categories present as a locked library, spec 2026-07-15)` — keep the rest of the paragraph as is.

- [ ] **Step 2: Full check**

Run: `npm test 2>&1 | tail -3` and `npm run build 2>&1 | tail -3` — all pass, build clean.

- [ ] **Step 3: Manual verification (real app)**

`npm run dev` needs the live Supabase env (`VITE_` vars) and a sign-in — there is no staging. Verify by driving the UI, **read-only plus settings-default writes only** (the underlay default is team-shared state; set it back to blank when done if it wasn't set before):
1. Settings opens on **Materials & add-ons**; nav shows one entry where two were.
2. Category column: Grout / Mortar / Underlayment with lock marks; "Add-ons — None yet".
3. Clicking each category swaps the company/product master list; detail pane shows the locked category info + Default dropdown.
4. Set an underlayment default; the master row and product detail show the star; a job row's underlayment chip now pre-fills that product; blank default behaves as before (first offered).
5. Grout color families, base units, install materials, add-product, rename, delete all still reachable and unchanged.

- [ ] **Step 4: Preview screenshots (merge gate)**

Capture light + dark screenshots of: the Materials & add-ons section (each category), the category pane with the default picker, and a job row with the pre-filled underlayment chip. Attach to the PR — **no merge without them** (non-negotiable 3).

- [ ] **Step 5: Commit + push**

```bash
git add CLAUDE.md
git commit -m "docs: Settings sections list reflects the Materials & add-ons library"
git push -u origin claude/epic-ride-sdnjud
```

---

## Self-review notes

- **Spec coverage (PR 1 scope only):** library layout with locked built-ins → Tasks 3–4; underlayment chip default → Tasks 1–2; preview proof → Task 5; "no new data shapes beyond `defaults.underlay`" → holds (only `normDefaults`/`setCatalogDefault` touched). New-category modal, `catalog.categories`, `company.attached`, job chips = PRs 2–3, deliberately absent.
- **Type consistency:** `MATERIAL_CATEGORIES.kind` values are the exact catalog kinds (`"grouts"|"mortars"|"underlayments"`) consumed by `setCatalogDefault` and `kindsFor`; `defaults` keys are `grout|mortar|underlay` everywhere.
- **Line numbers are anchors, not gospel** — every step quotes the exact code string to find; match on the string.
