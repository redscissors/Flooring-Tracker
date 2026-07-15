# Materials & add-ons PR 2 — Custom-category catalog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the team define unlimited custom "add-on" material categories (Trim, Sealer, …) in the Settings catalog — `catalog.categories` + per-company `attached` products with full price-book parity (search-first entry, SKU, import price refresh) — per PR 2 of `docs/superpowers/specs/2026-07-15-materials-add-ons-design.md`. Settings-only: shippable but inert on jobs (job chips/math are PR 3).

**Architecture:** Two pure-data extensions in `catalog.js` (category list + `attached` product arrays on companies, normalized so old records round-trip unchanged), a one-line reach into `stock.js`'s `syncCatalogPrices` so imports refresh attached products by exact SKU, and UI inside the existing `SettingsWorkspace` (App.jsx): the Add-ons nav group, a "New category" modal (mirrors "New book"), an editable category pane, and the company-grouped product list/editor reusing the grout/mortar/underlayment machinery via a fourth product kind, `"attached"`. An ADR records the category model.

**Tech Stack:** React 18 (hooks, one big App.jsx — follow its patterns), Tailwind utility classes (slate/indigo, re-themed by `src/index.css`), lucide-react icons, `node --test` for pure logic, Playwright + the pre-installed Chromium for preview proof.

## Global Constraints

- **Never touch the live Supabase project** — this PR needs no SQL and must add none. All new state is jsonb inside `settings.catalog`, written only through `setSettings({ catalog })`.
- **Never push to `main`** — work lands on branch `claude/custom-category-catalog-9e169d`, merged by PR.
- **No UI change merges without preview proof** — screenshots (light + dark) committed under `.scratch/015_materials-addons-pr2-preview/` are the merge gate (Task 7).
- Old records must stay valid: `normalizeCatalog` must default `categories: []` / `attached: []`, never require them; a pre-PR-2 catalog must serialize-round-trip byte-identically in meaning.
- Custom categories are **additive**: zero change to built-in grout/mortar/underlayment math, shapes, or how saved jobs resolve. `resolveCatalog` / `normP` / `materialWarnings` / print are untouched (PR 3).
- Category field vocabulary comes from the spec verbatim: `{ id, name, floorTypes: [], math: "coverage"|"manual", default, enabled }`; attached product `{ id, categoryId, name, enabled, sku, unit, price, coverage }`.
- Comments: rare, only for non-obvious business rules (CLAUDE.md convention).
- Tests: `npm test` (runs `node --test src/*.test.js`) must pass at every commit; test count never decreases.

---

### Task 1: Category model in catalog.js (TDD)

**Files:**
- Modify: `src/catalog.js` (new block after `offeredUnderlayments`, ~line 531; `normalizeCatalog` ~line 395; `seedCatalog` return ~line 349)
- Test: `src/catalog.test.js` (append a new `--- Custom material categories (ADR 0016)` block at the end)

**Interfaces:**
- Consumes: existing `cid`, `normName`, `FLOOR_TYPES`, `normalizeCatalog`, `seedCatalog`, `normalizeSettings`, `serializeSettings`.
- Produces (Tasks 2, 4, 5 rely on exactly these):
  - `CATEGORY_MATHS = ["coverage", "manual"]`
  - `addCategory(catalog, { name, floorTypes, math }) → catalog` (appends a normalized enabled category)
  - `updateCategory(catalog, categoryId, patch) → catalog` (re-normalizes, keeps id)
  - `isDuplicateCategoryName(catalog, name, exceptId?) → bool` (also true for the built-in labels grout/mortar/underlayment)
  - `normalizeCatalog(catalog).categories` — always an array of `{ id, name, floorTypes, math, default, enabled }`

- [ ] **Step 1: Write the failing tests**

Append to `src/catalog.test.js` (add `addCategory, updateCategory, isDuplicateCategoryName` to the import from `./catalog.js` on line 3):

```js
// --- Custom material categories (ADR 0016) ------------------------------------

test("normalizeCatalog defaults categories to [] and old catalogs round-trip unchanged", () => {
  const old = normalizeSettings(undefined); // pre-PR-2 shape has no categories
  assert.deepEqual(old.catalog.categories, []);
  const round = normalizeSettings(serializeSettings(old));
  assert.deepEqual(round.catalog.categories, []);
  assert.deepEqual(round.catalog.companies.map((c) => c.name), old.catalog.companies.map((c) => c.name));
});

test("addCategory appends a normalized, enabled category", () => {
  const s = normalizeSettings(undefined);
  const c = addCategory(s.catalog, { name: "  Trim ", floorTypes: ["tile", "misc", "vinyl"], math: "manual" });
  assert.equal(c.categories.length, 1);
  const cat = c.categories[0];
  assert.ok(cat.id);
  assert.equal(cat.enabled, true);
  assert.equal(cat.name, "Trim");
  assert.deepEqual(cat.floorTypes, ["tile", "vinyl"]); // misc is not a floor type
  assert.equal(cat.math, "manual");
  assert.equal(cat.default, "");
});

test("category math falls back to coverage on junk; floorTypes to []", () => {
  const s = normalizeSettings(undefined);
  const c = addCategory(s.catalog, { name: "Sealer", math: "volumetric" });
  assert.equal(c.categories[0].math, "coverage");
  assert.deepEqual(c.categories[0].floorTypes, []);
});

test("updateCategory patches fields, keeps the id, re-normalizes", () => {
  const s = normalizeSettings(undefined);
  const c1 = addCategory(s.catalog, { name: "Trim", math: "manual" });
  const id = c1.categories[0].id;
  const c2 = updateCategory(c1, id, { name: "Trim & transitions", math: "coverage", default: "RENO-U", enabled: false, floorTypes: ["tile"] });
  const cat = c2.categories[0];
  assert.equal(cat.id, id);
  assert.equal(cat.name, "Trim & transitions");
  assert.equal(cat.math, "coverage");
  assert.equal(cat.default, "RENO-U");
  assert.equal(cat.enabled, false);
  assert.deepEqual(cat.floorTypes, ["tile"]);
});

test("categories survive a serialize/normalize round-trip", () => {
  const s = normalizeSettings(undefined);
  const c = addCategory(s.catalog, { name: "Trim", floorTypes: ["tile"], math: "manual" });
  const round = normalizeSettings(serializeSettings({ ...s, catalog: c }));
  assert.equal(round.catalog.categories.length, 1);
  assert.equal(round.catalog.categories[0].name, "Trim");
  assert.equal(round.catalog.categories[0].math, "manual");
  assert.equal(round.catalog.categories[0].id, c.categories[0].id);
});

test("isDuplicateCategoryName matches case/space-insensitively and shadows built-ins", () => {
  const s = normalizeSettings(undefined);
  const c = addCategory(s.catalog, { name: "Trim" });
  assert.equal(isDuplicateCategoryName(c, " trim "), true);
  assert.equal(isDuplicateCategoryName(c, "Grout"), true);
  assert.equal(isDuplicateCategoryName(c, "Mortar"), true);
  assert.equal(isDuplicateCategoryName(c, "Underlayment"), true);
  assert.equal(isDuplicateCategoryName(c, "Sealer"), false);
  assert.equal(isDuplicateCategoryName(c, ""), false);
  // exceptId lets a category "rename" to its own name
  assert.equal(isDuplicateCategoryName(c, "TRIM", c.categories[0].id), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | tail -20`
Expected: FAIL — `addCategory is not a function` (and the round-trip test fails because `categories` is `undefined`, not `[]`).

- [ ] **Step 3: Implement in catalog.js**

Insert after `offeredUnderlayments` (~line 531):

```js
// --- Custom material categories (ADR 0016) -----------------------------------
// The built-ins (grout/mortar/underlayment) stay first-class code; `categories`
// holds only the team's custom add-on categories (Trim, Sealer, …). floorTypes
// empty = offered on all types (underlayment's `types` convention); `math`
// picks the quantity model: "coverage" = flat sq ft/unit like underlayment,
// "manual" = typed per-row quantity. `default` is the chip's pre-selected
// product name (resolveMaterialDefault semantics; "" = first offered).
export const CATEGORY_MATHS = ["coverage", "manual"];
const categoryFields = (c) => ({
  name: String(c?.name ?? "").trim(),
  floorTypes: (Array.isArray(c?.floorTypes) ? c.floorTypes : []).filter((t) => FLOOR_TYPES.includes(t)),
  math: CATEGORY_MATHS.includes(c?.math) ? c.math : "coverage",
  default: String(c?.default ?? ""),
});
const normCategory = (c) => ({ id: c?.id || cid(), enabled: c?.enabled !== false, ...categoryFields(c) });

// Custom names may not collide with each other or shadow a built-in label —
// the Materials & add-ons nav lists both groups side by side.
const BUILTIN_CATEGORY_NAMES = ["grout", "mortar", "underlayment"];
export function isDuplicateCategoryName(catalog, name, exceptId) {
  const target = normName(name);
  if (!target) return false;
  if (BUILTIN_CATEGORY_NAMES.includes(target)) return true;
  return (catalog?.categories || []).some((c) => c.id !== exceptId && normName(c.name) === target);
}

export function addCategory(catalog, fields) {
  return { ...catalog, categories: [...(catalog?.categories || []), normCategory({ ...fields, id: undefined, enabled: true })] };
}

export function updateCategory(catalog, categoryId, patch) {
  return { ...catalog, categories: (catalog?.categories || []).map((c) => c.id === categoryId ? normCategory({ ...c, ...patch, id: c.id }) : c) };
}
```

In `normalizeCatalog` (~line 405), extend the return object:

```js
  return { companies: backfillUnderlayments(companies, removedSeeds), removedSeeds, categories: (Array.isArray(catalog?.categories) ? catalog.categories : []).map(normCategory), defaults: normDefaults(catalog?.defaults) };
```

In `seedCatalog` (~line 349), extend the return:

```js
  return { companies, categories: [], defaults: normDefaults() };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | tail -5`
Expected: PASS, zero failures, test count ≥ previous + 6.

- [ ] **Step 5: Commit**

```bash
git add src/catalog.js src/catalog.test.js
git commit -m "catalog: custom material categories on the catalog (ADR 0016)"
```

---

### Task 2: Attached products (company.attached) in catalog.js (TDD)

**Files:**
- Modify: `src/catalog.js` (`normalizeCatalog` companies map ~line 397, `seedCatalog` ~lines 333–348, `addProduct` ~line 437, new helpers next to Task 1's block)
- Test: `src/catalog.test.js` (extend the new block)

**Interfaces:**
- Consumes: Task 1's `addCategory`/`updateCategory`; existing `addProduct`/`removeProduct`/`renameProduct`/`isOffered` (all already generic over `co[kind]`).
- Produces (Tasks 3, 4, 5 rely on exactly these):
  - `co.attached` — array of `{ id, categoryId, name, enabled, sku, unit, price, coverage }` on every normalized company
  - `addProduct(catalog, companyId, "attached", { name, categoryId, sku, unit, price, coverage })` works
  - `removeProduct(catalog, companyId, "attached", productId)` / `renameProduct(catalog, companyId, "attached", productId, name)` work (generic already — pinned by test)
  - `isDuplicateAttachedName(catalog, categoryId, name) → bool` (unique per category)
  - `offeredAttached(catalog, categoryId) → string[]`
  - `removeCategory(catalog, categoryId) → catalog` (drops the category AND every company's attached rows of that category)

- [ ] **Step 1: Write the failing tests**

Append to `src/catalog.test.js` (add `removeCategory, isDuplicateAttachedName, offeredAttached` — plus the already-imported `addProduct, removeProduct, renameProduct, isOffered` if missing — to the import on line 3):

```js
test("normalizeCatalog defaults attached to [] on every company; stored items keep their shape", () => {
  const s = normalizeSettings(undefined);
  assert.ok(s.catalog.companies.every((co) => Array.isArray(co.attached) && co.attached.length === 0));
  const raw = serializeSettings(s);
  raw.catalog.companies[0].attached = [{ name: "RENO-U", categoryId: "cat1", sku: " T-114 ", unit: "pieces", price: 18.4, coverage: 0 }];
  const round = normalizeSettings(raw);
  const p = round.catalog.companies[0].attached[0];
  assert.ok(p.id);
  assert.equal(p.enabled, true);
  assert.equal(p.categoryId, "cat1");
  assert.equal(p.sku, "T-114");
  assert.equal(p.unit, "pieces");
  assert.equal(p.price, 18.4);
});

const trimCatalog = () => {
  const s = normalizeSettings(undefined);
  const c1 = addCategory(s.catalog, { name: "Trim", math: "manual" });
  const catId = c1.categories[0].id;
  const coId = c1.companies[0].id;
  const c2 = addProduct(c1, coId, "attached", { name: "RENO-U", categoryId: catId, sku: "T-114", unit: "pieces", price: 18.4 });
  return { catalog: c2, catId, coId };
};

test("addProduct kind 'attached' appends under the company with the category link", () => {
  const { catalog, catId, coId } = trimCatalog();
  const co = catalog.companies.find((c) => c.id === coId);
  assert.equal(co.attached.length, 1);
  assert.equal(co.attached[0].name, "RENO-U");
  assert.equal(co.attached[0].categoryId, catId);
  assert.equal(co.attached[0].enabled, true);
});

test("attached names are unique per category, not globally", () => {
  const { catalog, catId, coId } = trimCatalog();
  assert.equal(isDuplicateAttachedName(catalog, catId, " reno-u "), true);
  assert.equal(isDuplicateAttachedName(catalog, "other-cat", "RENO-U"), false);
  assert.equal(isDuplicateAttachedName(catalog, catId, ""), false);
  const c2 = addProduct(catalog, coId, "attached", { name: "RENO-U", categoryId: "other-cat" });
  assert.equal(isDuplicateAttachedName(c2, "other-cat", "RENO-U"), true);
});

test("offeredAttached scopes to the category and honors company/product enabled", () => {
  const { catalog, catId, coId } = trimCatalog();
  assert.deepEqual(offeredAttached(catalog, catId), ["RENO-U"]);
  assert.deepEqual(offeredAttached(catalog, "other-cat"), []);
  const pid = catalog.companies.find((c) => c.id === coId).attached[0].id;
  const off = { ...catalog, companies: catalog.companies.map((co) => co.id === coId ? { ...co, attached: co.attached.map((p) => p.id === pid ? { ...p, enabled: false } : p) } : co) };
  assert.deepEqual(offeredAttached(off, catId), []);
  const coOff = { ...catalog, companies: catalog.companies.map((co) => co.id === coId ? { ...co, enabled: false } : co) };
  assert.deepEqual(offeredAttached(coOff, catId), []);
});

test("removeProduct and renameProduct work on kind 'attached'", () => {
  const { catalog, coId } = trimCatalog();
  const pid = catalog.companies.find((c) => c.id === coId).attached[0].id;
  const renamed = renameProduct(catalog, coId, "attached", pid, "RENO-U 1/4\"");
  assert.equal(renamed.companies.find((c) => c.id === coId).attached[0].name, "RENO-U 1/4\"");
  const removed = removeProduct(catalog, coId, "attached", pid);
  assert.equal(removed.companies.find((c) => c.id === coId).attached.length, 0);
});

test("removeCategory drops the category and prunes its products from every company", () => {
  const { catalog, catId, coId } = trimCatalog();
  const c2 = addProduct(catalog, coId, "attached", { name: "Other cat item", categoryId: "keep-me" });
  const c3 = removeCategory(c2, catId);
  assert.deepEqual(c3.categories, []);
  const co = c3.companies.find((c) => c.id === coId);
  assert.deepEqual(co.attached.map((p) => p.name), ["Other cat item"]);
});

test("attached products survive a serialize/normalize round-trip", () => {
  const { catalog, catId, coId } = trimCatalog();
  const s = normalizeSettings(undefined);
  const round = normalizeSettings(serializeSettings({ ...s, catalog }));
  const co = round.catalog.companies.find((c) => c.id === coId);
  assert.equal(co.attached.length, 1);
  assert.equal(co.attached[0].categoryId, catId);
  assert.equal(co.attached[0].sku, "T-114");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | tail -20`
Expected: FAIL — `removeCategory is not a function`; the normalize test fails because `co.attached` is `undefined`.

- [ ] **Step 3: Implement in catalog.js**

Add next to Task 1's block:

```js
const attachedFields = (p) => ({ categoryId: String(p?.categoryId ?? ""), coverage: p?.coverage ?? 0, unit: p?.unit ?? "units", price: p?.price ?? 0, sku: skuField(p) });
const normAttachedProduct = (p) => ({ id: p?.id || cid(), name: p?.name || "", enabled: p?.enabled !== false, ...attachedFields(p) });

// Attached names are unique within their category (a "RENO-U" trim and a
// "RENO-U" threshold can coexist) — the per-kind convention, category-scoped.
export function isDuplicateAttachedName(catalog, categoryId, name) {
  const target = normName(name);
  if (!target) return false;
  for (const co of (catalog?.companies || [])) for (const p of (co.attached || [])) if (p.categoryId === categoryId && normName(p.name) === target) return true;
  return false;
}

export const offeredAttached = (catalog, categoryId) => {
  const names = [];
  for (const co of (catalog?.companies || [])) for (const p of (co.attached || [])) if (isOffered(co, p) && p.categoryId === categoryId) names.push(p.name);
  return names;
};

// Deleting a category is permanent and sharper than disabling: its products
// are pruned from every company, and (once jobs wire in, PR 3) saved jobs
// keep the stored name but stop calculating — same consequence as deleting a
// product.
export function removeCategory(catalog, categoryId) {
  return {
    ...catalog,
    categories: (catalog?.categories || []).filter((c) => c.id !== categoryId),
    companies: (catalog?.companies || []).map((co) => (co.attached || []).some((p) => p.categoryId === categoryId) ? { ...co, attached: co.attached.filter((p) => p.categoryId !== categoryId) } : co),
  };
}
```

In `normalizeCatalog`'s companies map (~line 397), add after `underlayments:`:

```js
    attached: (co?.attached || []).map(normAttachedProduct),
```

In `seedCatalog`, add `attached: []` to both company literals (the `SEED_COMPANIES.map` object ~line 334 and the "Unassigned" object ~line 343). In `addCompany` (~line 431), add `attached: []` to the new-company literal.

In `addProduct` (~line 439), extend the shape chain:

```js
  const shape = kind === "grouts" ? groutFields(fields) : kind === "mortars" ? mortarFields(fields) : kind === "attached" ? attachedFields(fields) : underlayFields(fields);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | tail -5`
Expected: PASS, zero failures.

- [ ] **Step 5: Commit**

```bash
git add src/catalog.js src/catalog.test.js
git commit -m "catalog: company-grouped attached products for custom categories"
```

---

### Task 3: Import price refresh covers attached products (TDD)

**Files:**
- Modify: `src/stock.js` (`syncCatalogPrices` ~line 409)
- Test: `src/stock.test.js` (append to its `syncCatalogPrices` tests)

**Interfaces:**
- Consumes: `syncKind` (internal to `syncCatalogPrices`), Task 2's `co.attached` shape.
- Produces: `syncCatalogPrices(catalog, items)` refreshes `attached` product prices by exact SKU (and the conservative unique-name fallback), reporting them in `changes` like every other kind.

- [ ] **Step 1: Write the failing test**

Append to `src/stock.test.js` (near its existing `syncCatalogPrices` tests — search the file for `syncCatalogPrices` and match the local item-literal style used there):

```js
test("syncCatalogPrices refreshes attached (custom category) products by exact SKU", () => {
  const catalog = {
    companies: [{ id: "co1", name: "Schluter", enabled: true, grouts: [], mortars: [], underlayments: [], attached: [
      { id: "p1", categoryId: "cat1", name: "RENO-U", enabled: true, sku: "T-114", unit: "pieces", price: 15, coverage: 0 },
    ] }],
    categories: [{ id: "cat1", name: "Trim", floorTypes: [], math: "manual", default: "", enabled: true }],
  };
  const items = [{ sku: "T-114", active: true, description: "RENO-U transition", price: 18.4 }];
  const { catalog: next, changes } = syncCatalogPrices(catalog, items);
  assert.equal(next.companies[0].attached[0].price, 18.4);
  assert.deepEqual(changes, [{ name: "RENO-U", from: 15, to: 18.4, sku: "T-114" }]);
  // untouched fields survive
  assert.equal(next.companies[0].attached[0].categoryId, "cat1");
  assert.deepEqual(next.categories, catalog.categories);
});

test("syncCatalogPrices leaves companies without an attached key alone", () => {
  const catalog = { companies: [{ id: "co1", name: "Tec", enabled: true, grouts: [], mortars: [], underlayments: [] }] };
  const { catalog: next } = syncCatalogPrices(catalog, []);
  assert.equal("attached" in next.companies[0], false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test 2>&1 | tail -15`
Expected: the first test FAILS — `next.companies[0].attached[0].price` is still `15`.

- [ ] **Step 3: Implement**

In `src/stock.js` `syncCatalogPrices` (~line 409), change the per-company return to:

```js
    return { ...co, grouts: syncKind(co.grouts), mortars: syncKind(co.mortars), underlayments: syncKind(co.underlayments), ...(co.attached ? { attached: syncKind(co.attached) } : {}) };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test 2>&1 | tail -5`
Expected: PASS, zero failures.

- [ ] **Step 5: Commit**

```bash
git add src/stock.js src/stock.test.js
git commit -m "stock: price-book import refreshes attached products by SKU"
```

---

### Task 4: Settings UI — Add-ons nav, New-category modal, category editor pane

**Files:**
- Modify: `src/App.jsx` — lucide import (line 3), catalog.js import (line 6), `SettingsWorkspace` (~lines 4475–4989)

**Interfaces:**
- Consumes: Task 1/2's `addCategory`, `updateCategory`, `removeCategory`, `isDuplicateCategoryName`, `offeredAttached`; existing `Modal`, `typeChips`, `box`, `inp`/`lbl` props.
- Produces (Task 5 relies on these): `cat` state may hold a custom category id; `customCat` (the resolved category or undefined); `kindsFor === ["attached"]` and `prodsOf(co, kind)` (category-filtered product list) when a custom category is open.

No unit tests — App.jsx has zero automated coverage by standing decision; proof is Task 7's preview screenshots. After each step: `npm run build` must succeed.

- [ ] **Step 1: Imports**

Line 3, add `Tag` to the lucide-react import list (after `Star`). Line 6, extend the catalog.js import with `addCategory, updateCategory, removeCategory, isDuplicateCategoryName, isDuplicateAttachedName, offeredAttached`.

- [ ] **Step 2: State + derived values for custom categories**

Inside `SettingsWorkspace`, after the existing `const [coRename, setCoRename] = useState(null);` (~line 4491), add:

```jsx
  const [addingCat, setAddingCat] = useState(false); // New-category modal
  const [catDraft, setCatDraft] = useState({ name: "", floorTypes: [], math: "coverage" });
  const [catError, setCatError] = useState("");
  const [catRename, setCatRename] = useState(null); // { value, error } — renaming the open custom category
  const [confirmDelCat, setConfirmDelCat] = useState(false);
```

Replace `const kindsFor = [{ grout: "grouts", mortar: "mortars", underlay: "underlayments" }[cat]];` (~line 4572) with:

```jsx
  const customCat = (catalog.categories || []).find((c) => c.id === cat);
  const kindsFor = customCat ? ["attached"] : [{ grout: "grouts", mortar: "mortars", underlay: "underlayments" }[cat]];
  // The products a company shows in the current section — attached rows are
  // additionally scoped to the open custom category.
  const prodsOf = (co, kind) => kind === "attached" ? (co.attached || []).filter((p) => p.categoryId === cat) : (co[kind] || []);
```

Update `countAll` (~line 4573) to include attached (this also keeps "Delete company" gated until its add-on products are gone):

```jsx
  const countAll = (co) => co.grouts.length + co.mortars.length + (co.underlayments?.length || 0) + (co.attached?.length || 0);
```

Update `inSection` (~line 4578) to use `prodsOf`:

```jsx
  const inSection = (co) => kindsFor.some((k) => prodsOf(co, k).length > 0);
```

Update the `materials` SECTIONS hint (~line 4588) to count attached too:

```jsx
    { id: "materials", label: "Materials & add-ons", icon: Layers, hint: String(catalog.companies.reduce((n, c) => n + c.grouts.length + c.mortars.length + (c.underlayments?.length || 0) + (c.attached?.length || 0), 0)) },
```

In the middle column's product list (~line 4909), replace `(co[kind] || []).map((p) => …)` with `prodsOf(co, kind).map((p) => …)`.

Give `typeChips` (~line 4560) an optional list so category scoping can exclude misc (misc lines never carry materials):

```jsx
  const typeChips = (selected, onVal, list = types) => {
    const sel = selected || [];
    const toggle = (t) => onVal(sel.includes(t) ? sel.filter((x) => x !== t) : [...sel, t]);
    return (
      <div><label className={lbl}>Offered for {sel.length === 0 && <span className="text-slate-400 font-normal normal-case tracking-normal">(all types)</span>}</label>
        <div className="flex flex-wrap gap-1">{list.map((t) => <button key={t} onClick={() => toggle(t)} className={`text-xs rounded-md px-2 py-1 border ${sel.includes(t) ? "bg-indigo-600 text-white border-indigo-600" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>{typeLabels[t]}</button>)}</div>
      </div>
    );
  };
  const floorTypeList = types.filter((t) => t !== "misc");
```

- [ ] **Step 3: New-category modal handlers + Add-ons nav group**

Add handlers near `submitCompany` (~line 4522):

```jsx
  const openNewCategory = () => { setAddingCat(true); setCatDraft({ name: "", floorTypes: [], math: "coverage" }); setCatError(""); };
  const submitCategory = () => {
    const name = catDraft.name.trim();
    if (!name) { setCatError("Category name is required."); return; }
    if (isDuplicateCategoryName(catalog, name)) { setCatError(`A category named "${name}" already exists.`); return; }
    const next = addCategory(catalog, { ...catDraft, name });
    onChange(next);
    setAddingCat(false); setSel(null); setAdding(null); setConfirmDelCat(false); setCatRename(null);
    setCat(next.categories[next.categories.length - 1].id);
  };
```

Extract the inner-nav button's reset list into one helper (the built-in buttons at ~line 4894 currently inline it) and reuse it:

```jsx
  const openCat = (id) => { setCat(id); setSel(null); setAdding(null); setConfirmDel(null); setMenuFor(null); setShowOthers(false); setRename(null); setCoRename(null); setCatRename(null); setConfirmDelCat(false); };
```

Replace the built-in buttons' onClick with `() => openCat(id)`, and replace the Add-ons placeholder (~lines 4901–4902):

```jsx
              <div className="ft-eyebrow text-[10px] text-slate-400 px-1.5 pt-3 mb-1">Add-ons</div>
              {(catalog.categories || []).length === 0 && <p className="px-1.5 text-[11px] text-slate-400">None yet.</p>}
              {(catalog.categories || []).map((c) => (
                <button key={c.id} onClick={() => openCat(c.id)}
                  className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-left ${cat === c.id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                  <Tag size={14} className={cat === c.id ? "" : "text-slate-400"} />
                  <span className="flex-1 truncate">{c.name}</span>
                  {!c.enabled && <span className={`text-[10px] ${cat === c.id ? "text-white/70" : "text-slate-400"}`}>off</span>}
                </button>
              ))}
              <button onClick={openNewCategory} className="w-full flex items-center gap-1.5 text-xs rounded-md border border-dashed border-slate-300 px-2 py-1.5 text-slate-500 hover:bg-slate-50 mt-1"><Plus size={12} /> New category</button>
```

Add the modal just before `SettingsWorkspace`'s closing `</div></div>` (after the section ternary, same level as the Price book library's modal pattern at ~line 3736):

```jsx
      {addingCat && (
        <Modal title="New category" onClose={() => setAddingCat(false)}>
          <label className={lbl}>Name</label>
          <input className={inp} value={catDraft.name} autoFocus placeholder="e.g. Trim, Sealer, Thresholds" onChange={(e) => setCatDraft({ ...catDraft, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && submitCategory()} />
          <div className="mt-3">{typeChips(catDraft.floorTypes, (v) => setCatDraft({ ...catDraft, floorTypes: v }), floorTypeList)}</div>
          <label className={lbl + " mt-3"}>Quantity</label>
          <div className="flex gap-2">
            {[["coverage", "Coverage", "Sq ft per unit — scales off the row's area plus waste"], ["manual", "Manual", "Typed per-row quantity — no area math"]].map(([k, t, d]) => (
              <button key={k} onClick={() => setCatDraft({ ...catDraft, math: k })} className={`flex-1 text-left rounded-lg border px-3 py-2 ${catDraft.math === k ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"}`}>
                <div className="text-sm font-medium">{t}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">{d}</div>
              </button>
            ))}
          </div>
          {catError && <div className="text-xs text-red-500 mt-2">{catError}</div>}
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setAddingCat(false)} className="text-sm rounded-lg border border-slate-200 px-4 py-2 hover:bg-slate-50">Cancel</button>
            <button onClick={submitCategory} className="text-sm rounded-lg bg-indigo-600 text-white px-4 py-2 hover:bg-indigo-700">Create category</button>
          </div>
        </Modal>
      )}
```

(Note: `Modal` renders inside the workspace's overlay div, whose `onClick={onClose}` closes Settings — `Modal` stops propagation itself, matching the Price book library's usage.)

- [ ] **Step 4: Editable category pane for custom categories**

Add `renderCustomCategoryPane` after `renderCategoryPane` (~line 4686):

```jsx
  const renderCustomCategoryPane = () => {
    const c = customCat;
    const offered = offeredAttached(catalog, c.id);
    const productCount = catalog.companies.reduce((n, co) => n + (co.attached || []).filter((p) => p.categoryId === c.id).length, 0);
    const submitCatRename = () => {
      const name = (catRename?.value || "").trim();
      if (!name) { setCatRename({ ...catRename, error: "Name is required." }); return; }
      if (isDuplicateCategoryName(catalog, name, c.id)) { setCatRename({ ...catRename, error: `A category named "${name}" already exists.` }); return; }
      onChange(updateCategory(catalog, c.id, { name }));
      setCatRename(null);
    };
    return (
      <div className="max-w-xl">
        <p className="ft-eyebrow text-[10px] text-slate-400">Materials &amp; add-ons · add-on</p>
        {catRename ? (
          <div className="max-w-md mt-1">
            <div className="flex items-center gap-2">
              <input autoFocus value={catRename.value} onChange={(e) => setCatRename({ value: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") submitCatRename(); if (e.key === "Escape") setCatRename(null); }} className={inp + " font-medium"} />
              <button onClick={submitCatRename} className="text-sm rounded-md bg-indigo-600 text-white px-3 py-1.5 hover:bg-indigo-700 shrink-0">Save</button>
              <button onClick={() => setCatRename(null)} className="text-sm rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50 shrink-0">Cancel</button>
            </div>
            {catRename.error && <div className="text-xs text-red-500 mt-1">{catRename.error}</div>}
          </div>
        ) : (
          <h2 className="ft-serif text-3xl leading-tight mt-1 flex items-center gap-2.5"><Tag size={22} className="text-slate-400" /> {c.name}
            <button onClick={() => setCatRename({ value: c.name })} title={`Rename ${c.name}`} className="text-slate-300 hover:text-slate-600"><Pencil size={15} /></button>
          </h2>
        )}
        <div className="mt-5 space-y-5 max-w-md">
          <div>
            {typeChips(c.floorTypes, (v) => onChange(updateCategory(catalog, c.id, { floorTypes: v })), floorTypeList)}
            <p className="text-[11px] text-slate-400 mt-1">Which product rows offer this add-on's chip. None selected = every type.</p>
          </div>
          <div>
            <label className={lbl}>Quantity</label>
            <div className="inline-flex rounded-md border border-slate-200 overflow-hidden text-sm">
              {[["coverage", "Coverage"], ["manual", "Manual"]].map(([k, t]) => (
                <button key={k} onClick={() => onChange(updateCategory(catalog, c.id, { math: k }))} className={`px-3.5 py-2 font-medium ${c.math === k ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}>{t}</button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400 mt-1">{c.math === "coverage" ? "One unit covers a set sq ft — quantities scale off the row's area plus waste, with a per-row manual override." : "A typed per-row quantity (starts at 1) — no area math."}</p>
          </div>
          <div className="max-w-xs">
            <label className={lbl}>Default product</label>
            <select value={offered.includes(c.default) ? c.default : ""} onChange={(e) => onChange(updateCategory(catalog, c.id, { default: e.target.value }))} className={inp}>
              <option value="">— first offered —</option>
              {offered.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
            <p className="text-[11px] text-slate-400 mt-1.5">Pre-selected when a row's {c.name} chip is turned on.</p>
          </div>
          <label className="flex items-center gap-1.5 text-xs text-slate-500">{box(c.enabled, () => onChange(updateCategory(catalog, c.id, { enabled: !c.enabled })), c.enabled ? "Hide this add-on's chip from job rows" : "Offer this add-on's chip on job rows")} offered on jobs</label>
        </div>
        <p className="text-xs text-slate-400 mt-6">Job rows pick these up in an upcoming update — for now this builds the catalog.</p>
        <div className="mt-8 pt-5 border-t border-slate-100">
          {confirmDelCat ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-red-600 flex-1">Delete "{c.name}"{productCount ? ` and its ${productCount} product${productCount === 1 ? "" : "s"}` : ""} from every company? Jobs that use them keep the name but stop calculating. To just hide the chip, uncheck "offered on jobs" instead.</span>
              <button onClick={() => { onChange(removeCategory(catalog, c.id)); setConfirmDelCat(false); setSel(null); setCat("grout"); }} className="rounded-md bg-red-600 text-white px-2.5 py-1 font-medium hover:bg-red-700 shrink-0">Delete</button>
              <button onClick={() => setConfirmDelCat(false)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setConfirmDelCat(true)} className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"><Trash2 size={12} /> Delete category</button>
          )}
        </div>
      </div>
    );
  };
```

Route it in the detail pane (~line 4940): change the final fallback from `: renderCategoryPane()` to `: customCat ? renderCustomCategoryPane() : renderCategoryPane()`.

- [ ] **Step 5: Build check + commit**

Run: `npm run build 2>&1 | tail -3` — Expected: `✓ built`.
Run: `npm test 2>&1 | tail -3` — Expected: PASS.

```bash
git add src/App.jsx
git commit -m "settings: add-on categories — nav group, New-category modal, category editor"
```

---

### Task 5: Settings UI — attached product add form + detail editor

**Files:**
- Modify: `src/App.jsx` — `SettingsWorkspace` internals (`kindLabel` ~4506, `startAdd` ~4509, `submitAdd` ~4512, `detailHeader` ~4618, `masterHint` ~4580, `renderAddForm` ~4809, detail-pane router ~4936)

**Interfaces:**
- Consumes: Task 4's `customCat`/`prodsOf`; Task 2's `addProduct("attached", …)`, `isDuplicateAttachedName`, `updateCategory`.
- Produces: full add/edit/rename/delete/enable/set-default lifecycle for attached products, price-book-search-first (SKU parity with grout/mortar/underlayment).

- [ ] **Step 1: kind plumbing**

`kindLabel` (~line 4506):

```jsx
  const kindLabel = (kind) => kind === "grouts" ? "grout" : kind === "mortars" ? "mortar" : kind === "attached" ? (customCat?.name || "add-on") : "underlayment";
```

`startAdd` (~line 4509) — add the attached draft as the first branch of the ternary chain:

```jsx
  const startAdd = (companyId, kind) => { setAdding({ companyId, kind }); setSel(null); setConfirmDel(null); setRename(null); setDraft(kind === "attached" ? { name: "", coverage: "", unit: "units", price: "", sku: "", categoryId: cat } : kind === "grouts" ? { name: "", coverage: "", unit: "units", price: "", sku: "", book: "", base: null } : kind === "mortars" ? { name: "", tier1: "", tier2: "", tier3: "", unit: "units", price: "", sku: "" } : { name: "", coverage: "", unit: "rolls", price: "", sku: "", types: [] }); setError(""); };
```

`submitAdd` (~line 4512) — category-scoped duplicate check:

```jsx
  const submitAdd = () => {
    const name = (draft.name || "").trim();
    if (!name) { setError("Product name is required."); return; }
    const dup = adding.kind === "attached" ? isDuplicateAttachedName(catalog, draft.categoryId, name) : isDuplicateName(catalog, adding.kind, name);
    if (dup) { setError(`A ${kindLabel(adding.kind)} named "${name}" already exists.`); return; }
    onChange(addProduct(catalog, adding.companyId, adding.kind, { ...draft, name }));
    setAdding(null); setError("");
  };
```

`masterHint` (~line 4580) — attached rows read like mortars:

```jsx
  const masterHint = (kind, p) => kind === "grouts"
    ? (p.book ? (famFor(p) ? `${famFor(p).colors.length} colors · book` : "book link missing") : "standard colors")
    : kind === "mortars" || kind === "attached" ? [p.unit, p.sku ? `SKU ${p.sku}` : ""].filter(Boolean).join(" · ")
      : ((p.types || []).length ? p.types.map((t) => typeLabels[t]).join(", ") : "all types") + ((p.install || []).length ? ` · ${p.install.length} install` : "");
```

The "Companies with no …" collapsed-group label (~line 4924) reads awkwardly for a category name ("no Trims") — make it kind-aware:

```jsx
                    <span className="flex-1 text-left">Companies with no {kindsFor[0] === "attached" ? `${kindLabel("attached")} products` : `${kindLabel(kindsFor[0])}s`}</span>
```

- [ ] **Step 2: detailHeader — attached default + rename duplicate check**

In `detailHeader` (~line 4618), the rename duplicate check becomes kind-aware:

```jsx
      if (name.toLowerCase() !== p.name.trim().toLowerCase() && (kind === "attached" ? isDuplicateAttachedName(catalog, p.categoryId, name) : isDuplicateName(catalog, kind, name))) { setRename({ ...rename, error: `A ${kindLabel(kind)} named "${name}" already exists.` }); return; }
```

And the default star/set-as-default block (~lines 4647–4649) routes attached defaults to the CATEGORY's `default` field (`isDefaultMaterial` only knows the three built-in kinds):

```jsx
          {((kind === "attached" ? String(customCat?.default || "").trim().toLowerCase() === String(p.name || "").trim().toLowerCase() : isDefaultMaterial(kind, p.name))
            ? <span title={kind === "attached" ? `Rows turning on the ${customCat?.name} chip start with this product` : kind === "underlayments" ? "Rows turning on the underlayment chip start with this product" : "New tile rows start with this material"} className="flex items-center gap-1 text-xs font-medium text-indigo-600"><Star size={12} className="fill-current" /> Default</span>
            : <button onClick={() => onChange(kind === "attached" ? updateCategory(catalog, p.categoryId, { default: p.name }) : setCatalogDefault(catalog, kind, p.name))} title={kind === "attached" ? `Make this the product the ${customCat?.name} chip starts with` : kind === "underlayments" ? "Make this the product the underlayment chip starts with" : "Make this the default new tile rows start with"} className="text-xs text-slate-400 hover:text-indigo-600">Set as default</button>)}
```

Also add the default star to the middle-column row (~line 4912) for attached rows — the existing `isDefaultMaterial(kind, p.name)` call there becomes:

```jsx
{(kind === "attached" ? String(customCat?.default || "").trim().toLowerCase() === String(p.name || "").trim().toLowerCase() : isDefaultMaterial(kind, p.name)) && <Star size={10} className="fill-current text-indigo-500 shrink-0" title="Chip default" />}
```

- [ ] **Step 3: renderAttachedDetail + add-form branch + router**

Add after `renderUnderlayDetail` (~line 4808):

```jsx
  const renderAttachedDetail = (co, p) => (
    <div key={p.id}>
      {detailHeader(co, "attached", p, customCat?.name || "Add-on")}
      {delConfirm(co, "attached", p)}
      <div className="flex flex-wrap items-end gap-2.5 mt-4">
        {customCat?.math === "coverage" && <div className="w-36">{numField("Cov. sq ft/unit", p.coverage, (v) => setProduct(co.id, "attached", p.id, { coverage: v }))}</div>}
        <div className="w-24">{txtField("Unit", p.unit, (v) => setProduct(co.id, "attached", p.id, { unit: v }))}</div>
        <div className="w-28">{numField("$/unit", p.price, (v) => setProduct(co.id, "attached", p.id, { price: v }))}</div>
        <div className="w-36">{txtField("SKU", p.sku || "", (v) => setProduct(co.id, "attached", p.id, { sku: v }))}</div>
      </div>
      <p className="text-[11px] text-slate-400 mt-1.5">{customCat?.math === "coverage" ? "One unit covers this many sq ft — quantities scale off the row's area plus waste." : "Ordered by a typed per-row quantity — no coverage math."} A SKU lets price-book imports refresh the price.</p>
    </div>
  );
```

In `renderAddForm`'s kind ternary (~line 4816), insert an `attached` branch before the grout branch:

```jsx
        {adding.kind === "attached" ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {customCat?.math === "coverage" && numField("Cov. sq ft/unit", draft.coverage, (v) => setDraft({ ...draft, coverage: v }))}
            {txtField("Unit", draft.unit, (v) => setDraft({ ...draft, unit: v }))}
            {numField("$/unit", draft.price, (v) => setDraft({ ...draft, price: v }))}
            {txtField("SKU", draft.sku, (v) => setDraft({ ...draft, sku: v }))}
          </div>
        ) : adding.kind === "grouts" ? (
```

(`fillFromStock` already handles the pick correctly for attached: `adding.kind !== "mortars"` copies the book's coverage when present, and the grout-only base/book extras are keyed to `adding.kind === "grouts"` — no change needed.)

Route the detail pane (~line 4936):

```jsx
              {adding ? renderAddForm()
                : selProd && sel.kind === "grouts" ? renderGroutDetail(selCo, selProd)
                  : selProd && sel.kind === "mortars" ? renderMortarDetail(selCo, selProd)
                    : selProd && sel.kind === "attached" ? renderAttachedDetail(selCo, selProd)
                      : selProd ? renderUnderlayDetail(selCo, selProd)
                        : customCat ? renderCustomCategoryPane() : renderCategoryPane()}
```

- [ ] **Step 4: Build check + commit**

Run: `npm run build 2>&1 | tail -3` — Expected: `✓ built`.
Run: `npm test 2>&1 | tail -3` — Expected: PASS.

```bash
git add src/App.jsx
git commit -m "settings: add-on product list, add form, and detail editor with price-book parity"
```

---

### Task 6: ADR 0016 + docs

**Files:**
- Create: `docs/adr/0016-custom-material-categories.md`
- Modify: `docs/adr/README.md` (index table), `CLAUDE.md` (data-model block + Settings workspace paragraph)

**Interfaces:** none (documentation).

- [ ] **Step 1: Write the ADR**

Create `docs/adr/0016-custom-material-categories.md` (match ADR 0015's header layout):

```markdown
# ADR 0016 — Custom material categories: present-only unification over three locked built-ins

- **Status:** Accepted
- **Date:** 2026-07-15
- **Scope:** system-wide (Settings catalog, price-book import sync; job wiring lands in PR 3)
- **Related:** builds on the ADR 0002 catalog and the ADR 0006 SKU link; spec at
  `docs/superpowers/specs/2026-07-15-materials-add-ons-design.md`.

## Context

The catalog knew exactly three material kinds — grout, mortar, underlayment —
each hard-coded through Settings, the product-row chips, the math, and the
print. The team wants to attach other materials to a job's flooring lines
(trim, transitions, sealer, thresholds, …) without a code change per category.
The three built-ins carry proven, materially different math (volumetric /
tiered / flat coverage + install kits) that real quotes depend on.

## Decision

1. **The catalog holds a list of material categories, but only custom ones are
   data.** `catalog.categories` stores the team's add-on categories
   (`{ id, name, floorTypes, math: "coverage"|"manual", default, enabled }`).
   Grout, Mortar, and Underlayment are *presented* as the first three
   categories in the same Settings library UI, but stay first-class code:
   their math, shapes, and job resolution are untouched, and they cannot be
   deleted, renamed as categories, re-scoped, or have their math changed —
   **present-only unification**. Only their per-product content and chip
   default are editable, as before.
2. **Custom-category products live per company in one flat `attached` array**
   (`{ id, categoryId, name, enabled, sku, unit, price, coverage }`),
   `categoryId` tying each to its category — not one array per category, so
   companies don't grow a dynamic set of keys. They get full price-book
   parity: search-first entry, optional SKU, and exact-SKU price refresh on
   import (`syncCatalogPrices`).
3. **Two quantity models only.** `"coverage"` (flat sq ft per unit, scaled off
   the row's area × waste, manual override — underlayment's model) or
   `"manual"` (typed per-row quantity). No custom category gets volumetric or
   tiered math; anything needing that belongs in a built-in.
4. **Everything is jsonb inside the shared settings record** — no SQL, no
   schema change, written only through `setSettings({ catalog })`.
5. **Jobs will resolve add-on products by name at calc time** (the
   mortar/underlayment convention, no snapshot), so renames/deletes have the
   same saved-job consequence as today, covered by the materialWarnings chip.
   Deleting a category prunes its products from every company; names are
   unique per category; category names may not shadow a built-in's.

## Consequences

- New material kinds are a Settings action, not a deploy.
- Old records normalize with `categories: []` / `attached: []` — nothing
  re-shapes existing data, and pre-0016 clients simply ignore the new keys.
- PR 2 ships this Settings-only (inert on jobs); PR 3 wires `Product.attached`
  chips, `getAttached` math, totals, print, and warnings per the spec.
- The category `default` lives on the category row itself, not in
  `catalog.defaults` (that map stays exactly `{ grout, mortar, underlay }`).

## Alternatives considered

- **Fully generic categories (built-ins become data):** rejected — zero
  appetite for re-expressing proven volumetric/tiered math as config, and the
  migration risk lands on live quotes.
- **Per-category product arrays keyed on the company** (`co[categoryId]`):
  rejected — dynamic keys complicate normalization and the generic
  add/rename/remove helpers; one flat `attached` array keeps kind `"attached"`
  a fourth ordinary kind.
```

- [ ] **Step 2: Index it and update CLAUDE.md**

Append to the `docs/adr/README.md` table:

```markdown
| [0016](0016-custom-material-categories.md) | Custom material categories: present-only unification over three locked built-ins | Accepted | 2026-07-15 |
```

In `CLAUDE.md`, inside the `Settings { wastePct, mortars{...}, grouts{...} }` data-model line, no change (legacy flat shape) — instead extend the **Settings workspace paragraph** (the ADR 0007 block describing `SettingsWorkspace`): after the sentence about the locked library, add:

```
The Add-ons group below the built-ins holds team-defined custom material
categories (ADR 0016): `catalog.categories` (name · floorTypes · coverage-or-
manual math · chip default · enabled) with company-grouped products in each
company's flat `attached` array (`categoryId` ties product → category), full
price-book parity including exact-SKU price refresh on import. Settings-only
until the PR-3 job wiring; jobs will resolve these by name like mortar.
```

- [ ] **Step 3: Commit**

```bash
git add docs/adr/0016-custom-material-categories.md docs/adr/README.md CLAUDE.md
git commit -m "docs: ADR 0016 — custom material categories (present-only unification)"
```

---

### Task 7: Preview proof (screenshots, light + dark)

**Files:**
- Create (temporary, never committed): `preview.html` (repo root), `src/preview-main.jsx`, plus a one-line temporary `export { SettingsWorkspace };` at the end of `src/App.jsx`
- Create (committed): `.scratch/015_materials-addons-pr2-preview/*.png`
- Script: `<scratchpad>/shot.mjs` (Playwright, outside the repo)

**Interfaces:** consumes everything above; produces the merge-gate screenshots.

- [ ] **Step 1: Temporary harness**

Append to `src/App.jsx` (TEMPORARY — removed in Step 4): `export { SettingsWorkspace };`

Create `preview.html` at repo root:

```html
<!doctype html>
<html><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>FloorTrack preview</title></head>
<body><div id="root"></div><script type="module" src="/src/preview-main.jsx"></script></body></html>
```

Create `src/preview-main.jsx` — renders `SettingsWorkspace` with stub props, a seeded custom category, and a tiny fake stock list so the price-book search renders (`supabase` is `null` without env vars, and nothing here calls it):

```jsx
import { useState, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { normalizeSettings, withDerived, addCategory, addProduct } from "./catalog.js";
import { normStockItem } from "./stock.js";
import { SettingsWorkspace } from "./App.jsx";

const seed = () => {
  const s = normalizeSettings(undefined);
  let c = addCategory(s.catalog, { name: "Trim & transitions", floorTypes: ["tile", "vinyl"], math: "manual" });
  const catId = c.categories[0].id;
  const schluter = c.companies.find((co) => co.name === "Schluter");
  c = addProduct(c, schluter.id, "attached", { name: 'RENO-U 1/4" transition', categoryId: catId, sku: "TRIM-114", unit: "pieces", price: 18.4 });
  c = addProduct(c, schluter.id, "attached", { name: "SCHIENE edge profile", categoryId: catId, sku: "TRIM-201", unit: "pieces", price: 12.1 });
  c = { ...c, categories: c.categories.map((x) => ({ ...x, default: 'RENO-U 1/4" transition' })) };
  return withDerived({ ...s, catalog: c });
};

const stock = [
  { sku: "TRIM-114", data: { description: 'SCHLUTER RENO-U 1/4" TRANSITION', brand: "Schluter", unit: "pieces", price: 18.4 } },
  { sku: "SEAL-511", data: { description: "MIRACLE 511 IMPREGNATOR SEALER QT", brand: "Miracle Sealants", unit: "quarts", price: 32.95, coverage: 250 } },
].map((r) => normStockItem({ ...r, active: true }));

function Preview() {
  const [settings, setS] = useState(seed);
  const setSettings = (patch) => setS((s) => withDerived({ ...s, ...patch }));
  const noop = () => {};
  const anoop = async () => {};
  const ref1 = useRef(null), ref2 = useRef(null);
  return <SettingsWorkspace onClose={noop} settings={settings} setSettings={setSettings} stock={stock} gFamilies={[]}
    importing={false} importPriceBook={noop} importStockFile={anoop} pbRef={ref1} exportBackup={noop} importBackup={noop} fileRef={ref2}
    inp="ft-field w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
    lbl="ft-eyebrow text-[10px] mb-1 block"
    types={["tile", "hardwood", "vinyl", "laminate", "carpet", "misc"]}
    typeLabels={{ tile: "Tile", hardwood: "Hardwood", vinyl: "Vinyl", laminate: "Laminate", carpet: "Carpet", misc: "Miscellaneous" }}
    theme="light" setTheme={noop} profile={{ name: "", phone: "", email: "" }} saveProfile={noop} user={{ email: "preview@example.com" }}
    books={[]} addBook={anoop} updateBook={anoop} delBook={anoop} loadBookItems={async () => []} applyBookImport={anoop}
    loadBookVersions={async () => []} loadBookVersionSnapshot={async () => []} pinBookVersion={anoop} updateBookItem={anoop}
    setBookItemsDisabled={anoop} rollbackStock={anoop} />;
}

createRoot(document.getElementById("root")).render(<Preview />);
```

- [ ] **Step 2: Playwright script**

`npm run dev` in the background (default port 5173). In the scratchpad dir: `npm init -y && npm i playwright` (Chromium is pre-installed at `/opt/pw-browsers`; do NOT run `playwright install`). Write `shot.mjs`:

```js
import { chromium } from "playwright";
import { mkdirSync } from "fs";

const OUT = process.env.OUT_DIR; // .scratch/015_materials-addons-pr2-preview
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto("http://localhost:5173/preview.html");
await page.waitForSelector("text=Materials & add-ons");

const shot = async (name) => { await page.screenshot({ path: `${OUT}/${name}.png` }); };
const setDark = (on) => page.evaluate((d) => {
  document.documentElement.classList.toggle("ned-dark", d);
  document.documentElement.classList.toggle("ned-light", !d);
}, on);

// 1 — Add-ons category pane (the seeded "Trim & transitions" category)
await page.click("text=Trim & transitions");
await shot("01-addon-category-pane-light");
await setDark(true); await shot("01-addon-category-pane-dark"); await setDark(false);

// 2 — attached product detail editor
await page.click('text=RENO-U 1/4" transition');
await shot("02-attached-product-detail-light");
await setDark(true); await shot("02-attached-product-detail-dark"); await setDark(false);

// 3 — add form with the price-book search open
await page.click('button[title="Company options"] >> nth=0');
await page.click("text=Add Trim & transitions");
await page.fill('input[placeholder^="Search the price book"]', "sealer");
await shot("03-attached-add-form-book-search-light");
await page.keyboard.press("Escape");

// 4 — New category modal
await page.click("text=New category");
await page.fill('input[placeholder^="e.g. Trim"]', "Sealer");
await page.click("text=Coverage");
await shot("04-new-category-modal-light");

await browser.close();
```

Run: `OUT_DIR=$PWD/.scratch/015_materials-addons-pr2-preview node <scratchpad>/shot.mjs` (from the repo root).
Expected: 6 PNGs. **Look at each one** (Read the files) — panes render, dark theme actually dark, no blank screens. Also check the dev-server terminal for errors.

- [ ] **Step 3: Commit the screenshots**

```bash
git add .scratch/015_materials-addons-pr2-preview
git commit -m "preview: custom-category catalog screenshots (light + dark) for PR proof"
```

- [ ] **Step 4: Remove the harness**

```bash
git checkout -- src/App.jsx        # drops the temporary export line
rm preview.html src/preview-main.jsx
git status                          # expect: clean
npm test 2>&1 | tail -3             # still green
```

---

### Task 8: Final verification, push, PR

- [ ] **Step 1: Full verification**

```bash
npm test 2>&1 | tail -5      # all green, count ≥ pre-PR count + ~15
npm run build 2>&1 | tail -3 # ✓ built
git log --oneline origin/main..HEAD
```

Self-check against the spec's PR 2 bullet: `catalog.categories` ✓, `company.attached` ✓, New-category modal ✓, custom-category editor with price-book search ✓, SKU import refresh ✓, ADR ✓, inert on jobs ✓ (no change to normP/resolveCatalog/getters/print).

- [ ] **Step 2: Push (retry w/ backoff on network failure)**

```bash
git push -u origin claude/custom-category-catalog-9e169d
```

- [ ] **Step 3: Open the PR** (base `main`), titled "Materials & add-ons PR 2 — custom-category catalog (Settings-only)". Body: what/why, spec + ADR links, embedded preview screenshots (reference the committed `.scratch/015_…` paths), test evidence, and an explicit "inert on jobs — PR 3 wires the chips" note. Check for a PR template first; none is known to exist.
