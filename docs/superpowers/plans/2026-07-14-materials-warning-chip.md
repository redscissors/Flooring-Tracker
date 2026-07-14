# Materials-Not-Calculating Warning Chip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Orange per-material warnings in a product row's collapsed materials strip whenever a checked material can't compute a quantity.

**Architecture:** One pure helper `materialWarnings(p, settings)` in src/catalog.js (returns kind tokens), rendered by App.jsx inside the existing collapsed materials strip; a `.ft-warn-orange` utility in src/index.css carries the light/dark orange. No print/CSV/data-model changes.

**Tech Stack:** React 18 (App.jsx), node:test, Tailwind + `--ft-*` CSS vars.

**Spec:** docs/superpowers/specs/2026-07-14-materials-warning-chip-design.md

## Global Constraints

- Suppress ALL warnings when `p.qtyType === "sqft"` and `num(p.qty)` is falsy (fresh rows must not warn; the SF cell's amber ring owns that state).
- Misc rows never warn.
- Warnings are screen-only: rendered inside `ft-noprint`-safe strip markup, never in `printProduct`'s mats, CSV, or totals.
- Orange is distinct from amber: `.ft-warn-orange` = `#C2410C` light, `#FB923C` under `.ned-dark`.
- Every change lands through this feature branch (`claude/materials-warning-chip`) and a PR — never push main.

---

### Task 1: `materialWarnings` helper (catalog.js) — TDD

**Files:**
- Modify: `src/catalog.js` (add export after `getUnderlayInstall`, ~line 204)
- Test: `src/catalog.test.js` (append)

**Interfaces:**
- Consumes: `getGrout(p, s)`, `getMortar(p, s)`, `getUnderlay(p, s)`, `getUnderlayInstall(p, s)`, `num()` — all already in catalog.js.
- Produces: `materialWarnings(p, s) → string[]` of kind tokens, subset of `["grout", "mortar", "underlay", "install"]`, in that order. Task 2 renders these.

- [ ] **Step 1: Write the failing tests** — append to `src/catalog.test.js` (it already imports from catalog.js; extend that import with `materialWarnings`):

```js
test("materialWarnings: checked materials that can't compute, SF-missing suppression (spec 2026-07-14)", () => {
  const s = normalizeSettings(undefined);
  const mk = (over = {}, grout = {}, mortar = {}, underlay = {}) => ({
    type: "tile", qtyType: "sqft", qty: "100", L: "12", W: "12", thickness: "0.375",
    grout: { checked: true, product: "PermaColor Select", joint: 0.125, manual: "", ...grout },
    mortar: { checked: true, product: "ProLite", manual: "", ...mortar },
    underlay: { checked: false, product: "", manual: "", install: false, installMortars: {}, installSkip: {}, ...underlay },
    ...over,
  });
  // Everything computes → no warnings.
  assert.deepEqual(materialWarnings(mk(), s), []);
  // The mosaic case: SF entered but no L/W → grout AND mortar can't compute.
  assert.deepEqual(materialWarnings(mk({ L: "", W: "" }), s), ["grout", "mortar"]);
  // A typed manual total silences that material's warning.
  assert.deepEqual(materialWarnings(mk({ L: "", W: "" }, { manual: "3" }), s), ["mortar"]);
  // SF missing suppresses everything — the SF cell's amber ring owns that state.
  assert.deepEqual(materialWarnings(mk({ L: "", W: "", qty: "" }), s), []);
  // Unchecked materials never warn.
  assert.deepEqual(materialWarnings(mk({ L: "", W: "" }, { checked: false }, { checked: false }), s), []);
  // Misc rows never warn.
  assert.deepEqual(materialWarnings(mk({ type: "misc", L: "", W: "" }), s), []);
});

test("materialWarnings: underlayment and install-material failures", () => {
  const s = normalizeSettings(undefined);
  const mk = (underlay) => ({
    type: "vinyl", qtyType: "sqft", qty: "100", L: "", W: "", thickness: "",
    grout: { checked: false, product: "", joint: 0.125, manual: "" },
    mortar: { checked: false, product: "", manual: "" },
    underlay: { checked: true, product: "", manual: "", install: false, installMortars: {}, installSkip: {}, ...underlay },
  });
  // Unknown product → no coverage to compute from.
  assert.deepEqual(materialWarnings(mk({ product: "No Such Underlayment" }), s), ["underlay"]);
  // A known product computes.
  const known = Object.keys(s.underlayments).find((n) => s.underlayments[n].coverage > 0);
  assert.deepEqual(materialWarnings(mk({ product: known }), s), []);
  // Install materials included but none computable (all defs' coverage zeroed).
  const s2 = normalizeSettings(undefined);
  const hardie = s2.catalog.companies.find((c) => c.name === "James Hardie")?.underlayments.find((u) => u.name === "HardieBacker");
  hardie.install = hardie.install.map((m) => ({ ...m, coverage: 0 }));
  const s3 = { ...s2, ...resolveCatalog(s2.catalog) };
  assert.deepEqual(materialWarnings(mk({ product: "HardieBacker", install: true }), s3), ["install"]);
});
```

- [ ] **Step 2: Run to verify both fail** — `node --test src/catalog.test.js` → FAIL: `materialWarnings is not a function` (or not exported).

- [ ] **Step 3: Implement** — in `src/catalog.js`, directly after `getUnderlayInstall`:

```js
// The row-level "not calculating" warnings (spec 2026-07-14). A checked
// material whose getter yields nothing is silently missing from the estimate;
// this names them so the UI can warn. Suppressed entirely while the row has
// no square footage — every fresh row starts that way, and the SF input's own
// highlight covers it — so a warning always means "SF is entered but this
// material still can't compute" (dims, thickness, or coverage).
export function materialWarnings(p, s) {
  if (p.type === "misc") return [];
  if (p.qtyType === "sqft" && !num(p.qty)) return [];
  const out = [];
  if (p.type === "tile" && p.grout?.checked && !getGrout(p, s)) out.push("grout");
  if (p.type === "tile" && p.mortar?.checked && !getMortar(p, s)) out.push("mortar");
  const U = getUnderlay(p, s);
  if (p.underlay?.checked && (!U || !U.product)) out.push("underlay");
  if (U && U.product && p.underlay?.install) {
    const defs = (s.underlayments?.[p.underlay.product]?.install || []).filter((d) => !p.underlay.installSkip?.[d.id]);
    if (defs.length && !getUnderlayInstall(p, s)) out.push("install");
  }
  return out;
}
```

- [ ] **Step 4: Run to verify pass** — `node --test src/catalog.test.js` → all pass. Then the full suite: `npm test` → all pass.

- [ ] **Step 5: Commit**

```bash
git add src/catalog.js src/catalog.test.js
git commit -m "Add materialWarnings: name a row's checked materials that can't compute"
```

---

### Task 2: Render the warnings in the collapsed materials strip (App.jsx + index.css)

**Files:**
- Modify: `src/App.jsx` — import block (add `materialWarnings` to the catalog.js import); row-scope constants (~line 2539); strip render (~lines 2733, 2868–2894)
- Modify: `src/index.css` — add `.ft-warn-orange`

**Interfaces:**
- Consumes: `materialWarnings(p, settings) → ["grout"|"mortar"|"underlay"|"install", ...]` from Task 1; existing `underlayLabel(type)`, `AlertTriangle` (lucide, already imported), `openMats`, `rowTint`, `pInline`, `hasMats`, `noteInput`.
- Produces: n/a (leaf task).

- [ ] **Step 1: CSS** — in `src/index.css`, next to the other `ft-` utilities:

```css
.ft-warn-orange { color: #C2410C; }
.ned-dark .ft-warn-orange { color: #FB923C; }
```

- [ ] **Step 2: Row-scope wiring** — in App.jsx by `pInline` (~2539), add:

```jsx
const warns = materialWarnings(p, settings);
const WLBL = { grout: "Grout", mortar: "Mortar", underlay: underlayLabel(p.type), install: "Install materials" };
// The strip shows uncomputed grout as a name with no number; when it's being
// warned about, the warning replaces that ghost entry.
const stripMats = pInline.filter((m) => !(m.kind === "Grout" && m.order <= 0 && warns.includes("grout")));
```

Replace the strip's uses of `pInline` in the render cases below with `stripMats` (the `matsCost` reduce stays on `pInline` — uncomputed mats cost 0 anyway).

- [ ] **Step 3: Warning spans** — inside the strip button (~2871), after the `stripMats.map(...)` spans and before `<span className="flex-1" />`:

```jsx
{warns.map((w) => (
  <span key={w} className="ft-warn-orange inline-flex items-center font-semibold" style={{ gap: 4 }}>
    <AlertTriangle size={10} /> {WLBL[w]} — not calculating
  </span>
))}
```

- [ ] **Step 4: Render the strip when only warnings exist** — the three collapsed cases (~2868, 2882, 2890) branch on `pInline.length`; switch them to `stripMats.length || warns.length` so a row whose checked materials ALL fail still gets the strip (with only warnings), and the outer gate (~2733) includes `warns.length > 0`:

```jsx
{(stripMats.length > 0 || warns.length > 0) && ( /* the existing 2868 strip, mapping stripMats + warns */ )}
{stripMats.length === 0 && warns.length === 0 && !hasMats && addables.length > 0 && ( /* unchanged 2882 dashed button */ )}
{stripMats.length === 0 && warns.length === 0 && (hasMats || addables.length === 0) && p.note && ( /* unchanged 2890 note row */ )}
```

Outer gate 2733 becomes:

```jsx
{(pInline.length > 0 || warns.length > 0 || (!hasMats && addables.length > 0) || p.note || (matExpanded && p.type !== "misc")) && (
```

- [ ] **Step 5: Run tests** — `npm test` → all pass (UI-only change; no test deltas expected).

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/index.css
git commit -m "Show orange not-calculating warnings in the collapsed materials strip"
```

---

### Task 3: Preview proof + PR

**Files:**
- Create: `.scratch/handoffs/materials-warning-chip-preview.md` (screenshot notes, optional)

- [ ] **Step 1: Preview** — the live app needs Supabase sign-in (owner-only), so proof comes from a static harness: render the row strip states (all computing / one failing / all failing, light and `.ned-dark`) with the real markup+CSS, screenshot via the browser pane. Alternatively the owner supplies an app screenshot on the PR.

- [ ] **Step 2: Push + PR**

```bash
git push -u origin claude/materials-warning-chip
gh pr create --title "Orange row warnings when checked materials can't calculate" --body-file <prbody>
```

PR body: spec link, behavior summary (trigger/suppression/click), the preview screenshots, and the change-control note that merge waits on preview proof.
