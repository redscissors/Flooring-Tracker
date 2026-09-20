# ERP 1 Order Numbers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record ERP 1 order numbers on a NED project, stamp each order-entry line with the order it was keyed on, gate the copies on numbered projects until a number is entered, and show/search the numbers in the project header and the customer browser.

**Architecture:** Two jsonb fields on the project (`erpOrders`, `erpKeyed`) normalized by a new pure module `src/erporders.js` and written through the existing `updateProject` path — no SQL. The order-entry panel (`src/orderentry.jsx`) stays pure presentation: it gets the fields plus four callbacks and renders a new header bar (Deliver to / ERP 1 order / Project + View columns). The boot's light-row select projects the numbers so the customer browser can show and search them without loading full projects.

**Tech Stack:** React 18 (hooks), Vite 5, Tailwind 3 + `--ft-*` tokens, lucide-react, `node --test` for pure modules, Playwright (pre-installed Chromium at `/opt/pw-browsers/chromium`) for preview proof.

**Spec:** `docs/superpowers/specs/2026-09-19-erp-order-numbers-design.md` — read it first; the mockup it cites (`.scratch/mockups/erp-order-2026-09-19.html`, section "1D · round 5") is the visual target for Task 8.

## Global Constraints

- **Never mutate the live Supabase project** (CLAUDE.md non-negotiable 1). This plan needs no SQL; do not add any.
- **Never push to `main`** (non-negotiable 2). Work on the designated branch `claude/relaxed-goldberg-8eml9n`; the change lands through a PR the owner opens or approves.
- **No UI change merges without preview proof** (non-negotiable 3) — Task 10 produces the screenshots.
- All project-content writes go through `updateProject(id, patch)`; ONE call per user action (usedirectory's setter closes over stale state).
- `src/erporders.js` must not import `model.js`, `lib/supabase.js`, or any `.jsx` (model.js imports it; node --test drives it). Imports always name the extension (`./x.js`).
- Order numbers are strings of 1–10 digits. `who` = `profile.name || user.email || ""`.
- Theme: reuse existing utility classes and `--ft-*` tokens; `DONE_MOSS` (copybtn.jsx) is the "done" fill; the "changed, look at it" tint is amber (`#fef6e2` / `#b45309` / `#f59e0b`).
- Comments: rare, only for non-obvious rules (CLAUDE.md "Code Comments").
- Tests: `npm test` (`node --test src/*.test.js`), lint: `npm run lint`, build: `npm run build`.
- Commit messages: describe the change; end with the attribution lines the session-start reminder gives (`Co-Authored-By:` + `Claude-Session:`); never a model identifier in code or docs.

---

## File map

| File | Responsibility |
|---|---|
| `src/erporders.js` (new) | Pure: normalizers, patch builders, line-id helpers, counts, search hit. No React, no imports from model.js. |
| `src/erporders.test.js` (new) | node --test coverage for the above. |
| `src/model.js` | `normC` gains `erpOrders` / `erpKeyed`. |
| `src/bootload.js` | Light-row select projects `erp:data->erpOrders`; `lightRow.erpNos`. |
| `src/custbrowser.js` | `erp` column key, `erpNos(projs)`, `erpHit` wired into both filters. |
| `src/CustomerBrowser.jsx` | The ERP order column + lines-panel tags. |
| `src/copybtn.jsx` | `CopyBtn` gains an `onCopied` callback. |
| `src/orderentry.jsx` | Header bar, gate, stamping, keyed rendering, `KeyedPop`, Copy remaining, footers. |
| `src/App.jsx` | Stable stock-material ids; passes fields + handlers to the panel. |
| `src/projectheader.jsx`, `src/mobile.jsx` | The `ERP 48213` chip beside the N-number. |
| `src/orderentrypreview.jsx` | Stateful harness with the ERP fixtures for the preview proof. |
| `.scratch/147_erp-order-numbers/` | Ticket + `shot.mjs` + PNGs. |
| `docs/adr/0044-erp-order-stamps-on-the-project.md`, `docs/adr/README.md`, `.claude/skills/floortrack-data-model/SKILL.md`, `src/CLAUDE.md` | Records. |

---

### Task 1: `erporders.js` — normalizers, gate, numbers, search hit

**Files:**
- Create: `src/erporders.js`
- Create: `src/erporders.test.js`

**Interfaces:**
- Produces:
  - `normErpNo(v): string` — digits only, max 10, `""` when none.
  - `normErpOrders(list): {no, addedBy, addedAt}[]` — deduped by `no`, first kept, invalid dropped.
  - `normErpKeyed(map, orders): { [lineId]: {no, at, by} }` — entries whose `no` is not in `orders` dropped.
  - `gated(proj): boolean` — `!!proj.projectNo && no orders`.
  - `erpNosOf(p): string[]` — a full row's `erpOrders[].no`, else a light row's `erpNos`.
  - `erpHit(p, q): boolean` — any of the project's numbers contains the digit run of `q`.
  - `orderCounts(erpKeyed): { [no]: n }` — stamps per order over the whole job.

- [ ] **Step 1: Write the failing tests**

```js
// src/erporders.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { normErpNo, normErpOrders, normErpKeyed, gated, erpNosOf, erpHit, orderCounts } from "./erporders.js";

test("normErpNo keeps digits only, at most 10", () => {
  assert.equal(normErpNo(" #48213 "), "48213");
  assert.equal(normErpNo("SO-48213"), "48213");
  assert.equal(normErpNo("123456789012"), "1234567890");
  assert.equal(normErpNo(""), "");
  assert.equal(normErpNo(null), "");
  assert.equal(normErpNo(48213), "48213");
});

test("normErpOrders drops invalid entries and dedupes by number, first kept", () => {
  const out = normErpOrders([
    { no: "48213", addedBy: "Marcus Mast", addedAt: 10 },
    { no: "48213", addedBy: "Later", addedAt: 20 },
    { no: "abc" },
    null,
    { no: 48260 },
  ]);
  assert.deepEqual(out, [
    { no: "48213", addedBy: "Marcus Mast", addedAt: 10 },
    { no: "48260", addedBy: "", addedAt: 0 },
  ]);
  assert.deepEqual(normErpOrders(undefined), []);
  assert.deepEqual(normErpOrders("nope"), []);
});

test("normErpKeyed keeps only stamps on a known order", () => {
  const orders = [{ no: "48213", addedBy: "", addedAt: 0 }];
  const out = normErpKeyed({ a: { no: "48213", at: 5, by: "M" }, b: { no: "99999", at: 6, by: "M" }, c: { no: "" }, "": { no: "48213" } }, orders);
  assert.deepEqual(out, { a: { no: "48213", at: 5, by: "M" } });
  assert.deepEqual(normErpKeyed(null, orders), {});
});

test("gated only when the project is numbered and has no order", () => {
  assert.equal(gated({ projectNo: 214, erpOrders: [] }), true);
  assert.equal(gated({ projectNo: 214, erpOrders: [{ no: "48213" }] }), false);
  assert.equal(gated({ projectNo: null, erpOrders: [] }), false);
  assert.equal(gated({ quick: true }), false);
});

test("erpNosOf reads a full row's orders or a light row's projection, live orders winning", () => {
  assert.deepEqual(erpNosOf({ erpOrders: [{ no: "48213" }, { no: "48260" }] }), ["48213", "48260"]);
  assert.deepEqual(erpNosOf({ erpNos: ["47901"] }), ["47901"]);
  assert.deepEqual(erpNosOf({ erpNos: ["47901"], erpOrders: [] }), []);
  assert.deepEqual(erpNosOf({}), []);
});

test("erpHit matches the digit run of the query against any order number", () => {
  const p = { erpNos: ["48213", "48260"] };
  assert.equal(erpHit(p, "48213"), true);
  assert.equal(erpHit(p, "482"), true);
  assert.equal(erpHit(p, "#48260"), true);
  assert.equal(erpHit(p, "hendricks"), false);
  assert.equal(erpHit(p, ""), false);
  assert.equal(erpHit({}, "482"), false);
});

test("orderCounts tallies stamps per order over the whole job", () => {
  assert.deepEqual(orderCounts({ a: { no: "48213" }, b: { no: "48213" }, c: { no: "48260" } }), { 48213: 2, 48260: 1 });
  assert.deepEqual(orderCounts({}), {});
  assert.deepEqual(orderCounts(undefined), {});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test src/erporders.test.js`
Expected: FAIL — `Cannot find module './erporders.js'`.

- [ ] **Step 3: Write the implementation**

```js
// src/erporders.js
// ERP 1 order numbers on a project (spec 2026-09-19): `erpOrders` (the
// numbers the desk keyed the job under) and `erpKeyed` (one stamp per
// order-entry line, keyed by the line's stable id). Pure — model.js imports
// the normalizers, so this file must never import model.js.

export const normErpNo = (v) => String(v ?? "").replace(/\D/g, "").slice(0, 10);

export const normErpOrders = (list) => {
  const out = [];
  const seen = new Set();
  for (const o of Array.isArray(list) ? list : []) {
    const no = normErpNo(o?.no);
    if (!no || seen.has(no)) continue;
    seen.add(no);
    out.push({ no, addedBy: String(o?.addedBy || ""), addedAt: Number(o?.addedAt) || 0 });
  }
  return out;
};

export const normErpKeyed = (map, orders) => {
  const nos = new Set((orders || []).map((o) => o.no));
  const out = {};
  if (map && typeof map === "object") {
    for (const [id, k] of Object.entries(map)) {
      const no = normErpNo(k?.no);
      if (!id || !no || !nos.has(no)) continue;
      out[id] = { no, at: Number(k?.at) || 0, by: String(k?.by || "") };
    }
  }
  return out;
};

// The copy gate applies to NUMBERED projects only (owner, round 4): no
// N-number means no customer and no real project name — a quick price or an
// unnamed draft — and the desk keys those without an ERP order.
export const gated = (proj) => !!proj?.projectNo && !(Array.isArray(proj?.erpOrders) && proj.erpOrders.length);

// A full record carries erpOrders; a boot light row carries the projected
// erpNos (bootload LIST_SELECT). The live orders win when both are present.
export const erpNosOf = (p) => (Array.isArray(p?.erpOrders) ? p.erpOrders.map((o) => o.no) : Array.isArray(p?.erpNos) ? p.erpNos : []);

export const erpHit = (p, q) => {
  const d = String(q || "").replace(/\D/g, "");
  return !!d && erpNosOf(p).some((no) => no.includes(d));
};

export const orderCounts = (erpKeyed) => {
  const out = {};
  for (const k of Object.values(erpKeyed || {})) if (k?.no) out[k.no] = (out[k.no] || 0) + 1;
  return out;
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test src/erporders.test.js`
Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add src/erporders.js src/erporders.test.js
git commit -m "erporders: normalizers, gate, number projection and search hit for ERP 1 orders"
```

---

### Task 2: `erporders.js` — patch builders and line helpers

**Files:**
- Modify: `src/erporders.js`
- Modify: `src/erporders.test.js`

**Interfaces:**
- Consumes: Task 1's `normErpNo`, `normErpOrders`, `normErpKeyed`.
- Produces (each builder returns `{ erpOrders, erpKeyed }` for one `updateProject` call, or `null` when there is nothing to write):
  - `addErpOrder(proj, no, who, at = Date.now())`
  - `removeErpOrder(proj, no)`
  - `stampErpLines(proj, ids, no, who, at = Date.now())`
  - `clearErpStamps(proj, ids)`
  - `lineIds(row): string[]` — a merged row's sources, else `[row.id]`.
  - `lineStamp(row, erpKeyed): {no, at, by} | null` — the first source's stamp (for the title / popover).
  - `keyedNo(row, erpKeyed): string | "mixed" | null`
  - `copyable(row): boolean` — `row.special || !!row.sku`.
  - `remainingRows(rows, erpKeyed): row[]`
  - `erpCounts(rows, erpKeyed): { keyed, total, byNo }` — over the given rows.
  - `keyedNote(rows, erpKeyed): string` — `"3 of 4 keyed · 2 on 48213, 1 on 48260"` or `""`.

- [ ] **Step 1: Write the failing tests** (append to `src/erporders.test.js`; extend the import line)

```js
import { addErpOrder, removeErpOrder, stampErpLines, clearErpStamps, lineIds, lineStamp, keyedNo, copyable, remainingRows, erpCounts, keyedNote } from "./erporders.js";

const proj = () => ({
  projectNo: 214,
  erpOrders: [{ no: "48213", addedBy: "Marcus Mast", addedAt: 10 }],
  erpKeyed: { p1: { no: "48213", at: 11, by: "Marcus Mast" } },
});

test("addErpOrder appends a new number and returns null for a duplicate or blank", () => {
  const patch = addErpOrder(proj(), "48260", "Gina", 50);
  assert.deepEqual(patch.erpOrders, [
    { no: "48213", addedBy: "Marcus Mast", addedAt: 10 },
    { no: "48260", addedBy: "Gina", addedAt: 50 },
  ]);
  assert.deepEqual(patch.erpKeyed, { p1: { no: "48213", at: 11, by: "Marcus Mast" } });
  assert.equal(addErpOrder(proj(), "48213", "Gina"), null);
  assert.equal(addErpOrder(proj(), "abc", "Gina"), null);
});

test("removeErpOrder drops the order and every stamp on it", () => {
  const p = { ...proj(), erpOrders: [...proj().erpOrders, { no: "48260", addedBy: "", addedAt: 20 }], erpKeyed: { ...proj().erpKeyed, p2: { no: "48260", at: 21, by: "" } } };
  const patch = removeErpOrder(p, "48213");
  assert.deepEqual(patch.erpOrders, [{ no: "48260", addedBy: "", addedAt: 20 }]);
  assert.deepEqual(patch.erpKeyed, { p2: { no: "48260", at: 21, by: "" } });
});

test("stampErpLines stamps every id on a known order, a re-stamp moving the line", () => {
  const patch = stampErpLines(proj(), ["p1", "p2", ""], "48213", "Gina", 99);
  assert.deepEqual(patch.erpKeyed, { p1: { no: "48213", at: 99, by: "Gina" }, p2: { no: "48213", at: 99, by: "Gina" } });
  assert.equal(stampErpLines(proj(), ["p2"], "77777", "Gina"), null);
});

test("clearErpStamps deletes the given keys only", () => {
  const p = { ...proj(), erpKeyed: { ...proj().erpKeyed, p2: { no: "48213", at: 12, by: "" } } };
  assert.deepEqual(clearErpStamps(p, ["p1", "zz"]).erpKeyed, { p2: { no: "48213", at: 12, by: "" } });
});

test("lineIds and lineStamp read a plain row or a merged row's sources", () => {
  const merged = { id: "merged|x", from: [{ id: "a" }, { id: "b" }] };
  assert.deepEqual(lineIds({ id: "p1" }), ["p1"]);
  assert.deepEqual(lineIds(merged), ["a", "b"]);
  const keyed = { a: { no: "48213", at: 1, by: "M" } };
  assert.deepEqual(lineStamp(merged, keyed), { no: "48213", at: 1, by: "M" });
  assert.equal(lineStamp({ id: "zz" }, keyed), null);
});

test("keyedNo: plain, fully keyed, mixed and partly keyed merged rows", () => {
  const keyed = { a: { no: "48213" }, b: { no: "48213" }, c: { no: "48260" } };
  assert.equal(keyedNo({ id: "a" }, keyed), "48213");
  assert.equal(keyedNo({ id: "zz" }, keyed), null);
  assert.equal(keyedNo({ id: "m", from: [{ id: "a" }, { id: "b" }] }, keyed), "48213");
  assert.equal(keyedNo({ id: "m", from: [{ id: "a" }, { id: "c" }] }, keyed), "mixed");
  assert.equal(keyedNo({ id: "m", from: [{ id: "a" }, { id: "zz" }] }, keyed), null);
  assert.equal(keyedNo({ id: "a" }, undefined), null);
});

test("copyable / remainingRows: a stock row needs a SKU, a special row never does", () => {
  const rows = [
    { id: "s1", special: true, sku: "", byDesc: true },
    { id: "s2", special: true, sku: "EW03" },
    { id: "k1", sku: "1517410" },
    { id: "k2", sku: "" },
  ];
  assert.deepEqual(rows.map(copyable), [true, true, true, false]);
  assert.deepEqual(remainingRows(rows, { s2: { no: "48213" } }).map((r) => r.id), ["s1", "k1"]);
  assert.deepEqual(remainingRows(rows, undefined).map((r) => r.id), ["s1", "s2", "k1"]);
});

test("erpCounts and keyedNote describe the visible list", () => {
  const rows = [{ id: "a", sku: "1" }, { id: "b", sku: "2" }, { id: "c", sku: "3" }, { id: "d", sku: "4" }, { id: "e", sku: "" }];
  const keyed = { a: { no: "48213" }, b: { no: "48213" }, c: { no: "48260" } };
  assert.deepEqual(erpCounts(rows, keyed), { keyed: 3, total: 4, byNo: { 48213: 2, 48260: 1 } });
  assert.equal(keyedNote(rows, keyed), "3 of 4 keyed · 2 on 48213, 1 on 48260");
  assert.equal(keyedNote(rows, {}), "");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test src/erporders.test.js`
Expected: FAIL — the new names are not exported.

- [ ] **Step 3: Write the implementation** (append to `src/erporders.js`)

```js
// --- patch builders: each returns { erpOrders, erpKeyed } for ONE
// updateProject call, or null when there is nothing to write ----------------

export const addErpOrder = (proj, no, who, at = Date.now()) => {
  const n = normErpNo(no);
  const orders = normErpOrders(proj?.erpOrders);
  if (!n || orders.some((o) => o.no === n)) return null;
  const erpOrders = [...orders, { no: n, addedBy: String(who || ""), addedAt: at }];
  return { erpOrders, erpKeyed: normErpKeyed(proj?.erpKeyed, erpOrders) };
};

export const removeErpOrder = (proj, no) => {
  const n = normErpNo(no);
  const erpOrders = normErpOrders(proj?.erpOrders).filter((o) => o.no !== n);
  return { erpOrders, erpKeyed: normErpKeyed(proj?.erpKeyed, erpOrders) };
};

export const stampErpLines = (proj, ids, no, who, at = Date.now()) => {
  const n = normErpNo(no);
  const erpOrders = normErpOrders(proj?.erpOrders);
  if (!n || !erpOrders.some((o) => o.no === n)) return null;
  const erpKeyed = { ...normErpKeyed(proj?.erpKeyed, erpOrders) };
  for (const id of ids || []) if (id) erpKeyed[id] = { no: n, at, by: String(who || "") };
  return { erpOrders, erpKeyed };
};

export const clearErpStamps = (proj, ids) => {
  const erpOrders = normErpOrders(proj?.erpOrders);
  const erpKeyed = { ...normErpKeyed(proj?.erpKeyed, erpOrders) };
  for (const id of ids || []) delete erpKeyed[id];
  return { erpOrders, erpKeyed };
};

// --- line helpers over the panel's row objects ------------------------------

export const lineIds = (row) => (row?.from ? row.from.map((f) => f.id) : [row?.id]);

export const lineStamp = (row, erpKeyed) => (erpKeyed && erpKeyed[lineIds(row)[0]]) || null;

// A merged line is keyed only when EVERY source is; "mixed" when the sources
// sit on different orders.
export const keyedNo = (row, erpKeyed) => {
  if (!erpKeyed) return null;
  const nos = lineIds(row).map((id) => erpKeyed[id]?.no || null);
  if (!nos.length || nos.some((n) => !n)) return null;
  return nos.every((n) => n === nos[0]) ? nos[0] : "mixed";
};

export const copyable = (row) => !!row?.special || !!row?.sku;

export const remainingRows = (rows, erpKeyed) => (rows || []).filter((r) => copyable(r) && keyedNo(r, erpKeyed) === null);

export const erpCounts = (rows, erpKeyed) => {
  const list = (rows || []).filter(copyable);
  const byNo = {};
  let keyed = 0;
  for (const r of list) {
    const no = keyedNo(r, erpKeyed);
    if (!no) continue;
    keyed++;
    byNo[no] = (byNo[no] || 0) + 1;
  }
  return { keyed, total: list.length, byNo };
};

export const keyedNote = (rows, erpKeyed) => {
  const { keyed, total, byNo } = erpCounts(rows, erpKeyed);
  if (!keyed) return "";
  const parts = Object.entries(byNo).map(([no, n]) => `${n} on ${no}`);
  return `${keyed} of ${total} keyed · ${parts.join(", ")}`;
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test src/erporders.test.js`
Expected: 15 passing.

- [ ] **Step 5: Commit**

```bash
git add src/erporders.js src/erporders.test.js
git commit -m "erporders: patch builders, line stamps, remaining rows and keyed counts"
```

---

### Task 3: `normC` carries the two fields

**Files:**
- Modify: `src/model.js:169` (the `normC` arrow)
- Modify: `src/model.test.js` (add one test)

**Interfaces:**
- Consumes: `normErpOrders`, `normErpKeyed` from `./erporders.js`.
- Produces: every loaded/imported project has `erpOrders: []`-or-list and `erpKeyed: {}`-or-map.

- [ ] **Step 1: Write the failing test** (append to `src/model.test.js`)

```js
test("normC: erpOrders and erpKeyed normalize, stamps on unknown orders dropped", () => {
  const c = normC({ id: "c1", categories: [], erpOrders: [{ no: "48213", addedAt: 5 }, { no: "x" }], erpKeyed: { a: { no: "48213", at: 6, by: "M" }, b: { no: "99999" } } });
  assert.deepEqual(c.erpOrders, [{ no: "48213", addedBy: "", addedAt: 5 }]);
  assert.deepEqual(c.erpKeyed, { a: { no: "48213", at: 6, by: "M" } });
  const old = normC({ id: "c2", categories: [] });
  assert.deepEqual(old.erpOrders, []);
  assert.deepEqual(old.erpKeyed, {});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/model.test.js`
Expected: FAIL — `c.erpOrders` is undefined.

- [ ] **Step 3: Implement**

Add the import near the top of `src/model.js` (with the other imports):

```js
import { normErpOrders, normErpKeyed } from "./erporders.js";
```

In `normC` (line 169), add two members right after `distance: normDistance(c.distance)`:

```js
, erpOrders: normErpOrders(c.erpOrders), erpKeyed: normErpKeyed(c.erpKeyed, normErpOrders(c.erpOrders))
```

so the object literal ends `…distance: normDistance(c.distance), erpOrders: normErpOrders(c.erpOrders), erpKeyed: normErpKeyed(c.erpKeyed, normErpOrders(c.erpOrders)) });`.

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all passing (model.test.js included).

- [ ] **Step 5: Commit**

```bash
git add src/model.js src/model.test.js
git commit -m "normC: carry erpOrders and erpKeyed on every project"
```

---

### Task 4: Boot light rows project the order numbers

**Files:**
- Modify: `src/bootload.js:22-40` (`LIST_SELECT_LEGACY`, `lightRow`)
- Modify: `src/bootload.test.js` (add one test)

**Interfaces:**
- Produces: light rows carry `erpNos: string[]` (what `erpNosOf` reads on a light row).

- [ ] **Step 1: Write the failing test** (append to `src/bootload.test.js`)

```js
test("loadProjects projects the ERP order numbers onto the light row", async () => {
  const db = fakeDb({ projects: [
    { id: "p1", customer_id: null, created_at: "2026-01-01", updated_at: "2026-01-02", name: "Smith", erp: [{ no: "48213", addedBy: "M", addedAt: 1 }, { no: "48260" }, { no: "" }] },
    { id: "p2", customer_id: null, created_at: "2026-01-01", updated_at: "2026-01-02", name: "Jones", erp: null },
  ] });
  const rows = await loadProjects(db);
  assert.deepEqual(rows[0].erpNos, ["48213", "48260"]);
  assert.deepEqual(rows[1].erpNos, []);
  assert.match(listSelect(), /erp:data->erpOrders/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/bootload.test.js`
Expected: FAIL — `rows[0].erpNos` is undefined.

- [ ] **Step 3: Implement**

In `src/bootload.js` change the legacy select (line 22) to end with the ERP projection (a jsonb path never fails, so it belongs on both selects):

```js
const LIST_SELECT_LEGACY = "id, created_at, updated_at, customer_id, name:data->>name, address:data->>address, phone:data->>phone, email:data->>email, quick:data->>quick, sales:data->salesperson->>name, erp:data->erpOrders";
```

In `lightRow` add, after the `sales:` member:

```js
  // The ERP 1 order numbers (spec 2026-09-19) — the customer browser's column
  // and search read these without loading full projects.
  erpNos: (Array.isArray(r.erp) ? r.erp : []).map((o) => String(o?.no || "")).filter(Boolean),
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/bootload.js src/bootload.test.js
git commit -m "bootload: project ERP order numbers onto the light rows"
```

---

### Task 5: Customer browser logic — column key, numbers, search

**Files:**
- Modify: `src/custbrowser.js` (`projNoHit` area, `unfiledRows`, `filterRows`, `BROWSER_COLS`)
- Modify: `src/custbrowser.test.js`

**Interfaces:**
- Consumes: `erpHit`, `erpNosOf` from `./erporders.js`.
- Produces: `erpNos(projs): string[]` (customer's numbers, newest project first, each project's newest order first, deduped); `BROWSER_COLS` with `"erp"` after `"projno"`; `filterRows` / `quickRows` / `draftRows` hit on an ERP number.

- [ ] **Step 1: Write the failing tests** (append to `src/custbrowser.test.js`; add `erpNos` to the import line)

```js
test("erpNos lists a customer's order numbers newest project first, newest order first, deduped", () => {
  const projs = [
    { id: "a", updatedAt: 900, erpNos: ["48213", "48260"] },
    { id: "b", updatedAt: 500, erpOrders: [{ no: "47901" }, { no: "48213" }], _full: true },
    { id: "c", updatedAt: 100 },
  ];
  assert.deepEqual(erpNos(projs), ["48260", "48213", "47901"]);
  assert.deepEqual(erpNos([]), []);
});

test("BROWSER_COLS carries the ERP order column right after Project #, and old saved orders append it", () => {
  assert.equal(BROWSER_COLS[BROWSER_COLS.indexOf("projno") + 1], "erp");
  const saved = ["sales", "projno", "builder", "phone", "address", "email", "jobs", "samples", "created", "modified"];
  const order = normColOrder(saved);
  assert.equal(order[order.length - 1], "erp");
});

test("filterRows and the unfiled lists hit on an ERP order number", () => {
  const ppl = [{ id: "c9", name: "Dana Hendricks", createdAt: 1, updatedAt: 1 }];
  const prj = [
    { id: "p9", customerId: "c9", name: "Master bath", updatedAt: 5, erpNos: ["48213"] },
    { id: "q9", customerId: null, name: "Quick price", quick: true, updatedAt: 6, erpNos: ["48260"] },
    { id: "d9", customerId: null, name: "Draft", updatedAt: 7, erpNos: ["47901"] },
  ];
  const r = browserRows({ people: ppl, projects: prj, builders: [] });
  assert.equal(filterRows(r, "48213").length, 1);
  assert.equal(filterRows(r, "482").length, 1);
  assert.equal(filterRows(r, "99999").length, 0);
  assert.equal(quickRows(prj, "48260").length, 1);
  assert.equal(quickRows(prj, "48213").length, 0);
  assert.equal(draftRows(prj, "47901").length, 1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test src/custbrowser.test.js`
Expected: FAIL — `erpNos` not exported; `BROWSER_COLS` index check fails.

- [ ] **Step 3: Implement**

At the top of `src/custbrowser.js` add:

```js
import { erpHit, erpNosOf } from "./erporders.js";
```

After `projNos` add:

```js
// The customer's ERP 1 order numbers (spec 2026-09-19) — the grid's ERP order
// column. Newest job first (the caller's order), each job's newest order
// first, deduped: the number on the phone is the latest one.
export const erpNos = (projs = []) => {
  const out = [];
  for (const p of projs) for (const no of [...erpNosOf(p)].reverse()) if (!out.includes(no)) out.push(no);
  return out;
};
```

In `unfiledRows` change the search filter line to:

```js
    .filter((p) => !s || (p.name || "").toLowerCase().includes(s) || salesNameOf(p).toLowerCase().includes(s) || projNoHit(p, s) || erpHit(p, s))
```

In `filterRows` change the projects clause to:

```js
    r.projs.some((p) => has(p.name) || projNoHit(p, s) || erpHit(p, s)));
```

Change `BROWSER_COLS` to:

```js
export const BROWSER_COLS = ["projno", "erp", "sales", "builder", "phone", "address", "email", "jobs", "samples", "created", "modified"];
```

- [ ] **Step 4: Run the tests**

Run: `npm test`
Expected: all passing.

- [ ] **Step 5: Commit**

```bash
git add src/custbrowser.js src/custbrowser.test.js
git commit -m "custbrowser: ERP order column key, customer order numbers, search by ERP number"
```

---

### Task 6: Customer browser UI — the ERP order column and lines-panel tags

**Files:**
- Modify: `src/CustomerBrowser.jsx` (imports line 3; `HEAD` / `CELL` around lines 111-136; the lines panel around line 314)

**Interfaces:**
- Consumes: `erpNos` from `./custbrowser.js`; `erpNosOf` from `./erporders.js`.

- [ ] **Step 1: Add the imports**

Extend the `./custbrowser.js` import with `erpNos`, and add:

```js
import { erpNosOf } from "./erporders.js";
```

- [ ] **Step 2: Add the head and cell**

In `HEAD`, after `projno: { label: "Project #" },` add:

```js
    erp: { label: "ERP order" },
```

In `CELL`, after the `projno` renderer add (at most three numbers then `+N`, the full list in the title):

```js
    erp: (r) => {
      const nos = erpNos(r.projs);
      const shown = nos.slice(0, 3).join(" ") + (nos.length > 3 ? ` +${nos.length - 3}` : "");
      return <td key="erp" className={`${td} ft-mono max-w-[150px] text-slate-500`} title={nos.length ? nos.join(" · ") : undefined}>{shown}</td>;
    },
```

- [ ] **Step 3: Tag each project line with its numbers**

In the selected customer's project lines (the `sel.projs.map((p) => …)` button), right after the `{p.name || "Untitled project"}` span, add:

```jsx
                  {erpNosOf(p).map((no) => (
                    <span key={no} className="text-[10px] font-bold rounded-full px-1.5 leading-4 whitespace-nowrap" style={{ background: "var(--ft-brand-soft)", color: "var(--ft-brand-deep)" }}>✓ {no}</span>
                  ))}
```

- [ ] **Step 4: Lint and build**

Run: `npm run lint && npm run build`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/CustomerBrowser.jsx
git commit -m "Customer browser: ERP order column and per-project order tags"
```

---

### Task 7: `CopyBtn` reports a copy; App builds stable material ids and passes the ERP fields

**Files:**
- Modify: `src/copybtn.jsx:25-35`
- Modify: `src/App.jsx:2972-2990` (the order-entry mount)

**Interfaces:**
- Produces: `CopyBtn({ …, onCopied })` — called after a successful write. `OrderEntryPanel` receives `projectNo`, `quick`, `erpOrders`, `erpKeyed`, `onAddOrder(no)`, `onRemoveOrder(no)`, `onStamp(ids, no)`, `onClearStamp(ids)` (Task 8 consumes them).

- [ ] **Step 1: `CopyBtn` gains `onCopied`**

In `src/copybtn.jsx` change the component to:

```jsx
export function CopyBtn({ text, label = "Copy", disabled = false, className = "", title, onCopied }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    await writeClipboard(text);
    setDone(true); setTimeout(() => setDone(false), 1400);
    if (onCopied) onCopied();
  };
  return (
    <button onClick={copy} disabled={disabled || !text} title={title} style={done ? DONE_MOSS : undefined}
      className={"inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold border transition-colors disabled:opacity-40 disabled:cursor-default " + (done ? "" : "border-slate-200 hover:bg-slate-50 ") + className}>
      {done ? <><Check size={13} /> Copied</> : <><Copy size={13} /> {label}</>}
    </button>
  );
}
```

- [ ] **Step 2: Stable stock-material ids in App.jsx**

Add the import (with the other `./…` imports near the top of `src/App.jsx`):

```js
import { addErpOrder, removeErpOrder, stampErpLines, clearErpStamps } from "./erporders.js";
```

In the order-entry mount (line ~2974) replace the `mats` map so the id is the same `mat|<kind>|<product>` rule `matOrderRow` uses (a stamp keyed by an index would drift), with a guard against two materials sharing a name:

```js
        const matIds = new Set();
        const mats = oeT.matAll.filter((m) => !isSpecialMat(m, stockBookIds)).map((m) => {
          const { qty, qtyAssumed } = orderQty(m.order);
          let id = `mat|${m.kind}|${m.product}`;
          while (matIds.has(id)) id += "#";
          matIds.add(id);
          return { id, sku: m.sku || "", qty, qtyAssumed, unitCode: unitCode(m.unit), qtyText: `${qty} ${u1(qty, m.unit)}`, name: m.product, kind: m.kind, area: "" };
        });
```

- [ ] **Step 3: Pass the fields and the four handlers**

Replace the `<OrderEntryPanel …/>` element in that mount with:

```jsx
            <OrderEntryPanel name={name} projectNo={sel.projectNo || null} quick={!!sel.quick} custInfo={custInfo}
              special={[...rows.filter((r) => r.special), ...specialMats, ...freightRows]} stock={[...rows.filter((r) => !r.special), ...mats]} descLimit={descLimit}
              erpOrders={sel.erpOrders || []} erpKeyed={sel.erpKeyed || {}}
              onAddOrder={(no) => erpPatch(addErpOrder(sel, no, erpWho))}
              onRemoveOrder={(no) => erpPatch(removeErpOrder(sel, no))}
              onStamp={(ids, no) => erpPatch(stampErpLines(sel, ids, no, erpWho))}
              onClearStamp={(ids) => erpPatch(clearErpStamps(sel, ids))}
              onClose={() => { setShowOrderCopy(false); setOrderScope(null); }} />
```

and define, just above `const name = optsUsed.length …` inside the same IIFE:

```js
        const erpWho = profile.name || user.email || "";
        // Every ERP write is ONE updateProject with the builder's whole patch;
        // null means nothing to write (a duplicate number, an unknown order).
        const erpPatch = (patch) => { if (patch) updateProject(sel.id, patch); };
```

- [ ] **Step 4: Lint and build**

Run: `npm run lint && npm run build`
Expected: clean (the panel ignores the new props until Task 8).

- [ ] **Step 5: Commit**

```bash
git add src/copybtn.jsx src/App.jsx
git commit -m "App: stable order-entry material ids, ERP fields and handlers into the panel; CopyBtn onCopied"
```

---

### Task 8: The panel — header bar, gate, stamping, keyed rows, Copy remaining

**Files:**
- Modify: `src/orderentry.jsx` (whole file; the component set below replaces the header, the `DeliverTo` section, `SpecialRow`, `StockRow`, `CopySection`, `OrderEntryPanel`)

**Interfaces:**
- Consumes: Task 2's helpers; `CopyBtn` `onCopied`; widgets' `useAnchoredPanel`, `vPos`, `useEscClose`, `HelpTip`.
- Produces: `OrderEntryPanel({ name, projectNo, quick, custInfo, special, stock, descLimit, erpOrders, erpKeyed, onAddOrder, onRemoveOrder, onStamp, onClearStamp, onClose })`.

Visual target: mockup section "1D · round 5", panel "1D-A — the whole panel, two orders".

- [ ] **Step 1: Imports and constants**

Replace the import block with:

```js
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Check, X, Plus } from "lucide-react";
import { CopyBtn, DONE_MOSS, writeClipboard } from "./copybtn.jsx";
import { HelpTip, useAnchoredPanel, vPos, useEscClose } from "./widgets.jsx";
import { compactBands, areaVendorBands, sheetBands } from "./orderlines.js";
import { deliverToRows, deliverToSequence, splitAddress } from "./deliverto.js";
import { writeSequence } from "./clipseq.js";
import { gated, normErpNo, orderCounts, lineIds, lineStamp, keyedNo, remainingRows, keyedNote } from "./erporders.js";
```

Add these constants after `perUnit`:

```js
const LOCK_TITLE = "Enter the ERP 1 order number first";
const BOX = { border: "1px solid var(--ft-border-strong)", borderRadius: 6, padding: "4px 8px 6px", minWidth: 0 };
const EYE = "ft-eyebrow text-[8px] flex items-center justify-between gap-1.5 min-h-[18px]";
const STAMP_NO = { fontSize: 7.5, fontWeight: 800, letterSpacing: ".02em", lineHeight: 1, marginTop: 2, color: "var(--ft-brand-deep)", fontVariantNumeric: "tabular-nums" };
const when = (ms) => (ms ? new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");
const stampTitle = (st) => (st ? `Keyed on ERP ${st.no}${st.at ? ` — ${when(st.at)}` : ""}${st.by ? ` by ${st.by}` : ""}. Click for options.` : undefined);
```

Update the `GRID` row padding for the tighter body: `padding` on `SpecialRow` becomes `"6px 10px"` (Step 4), `StockRow` becomes `px-2.5 py-[5px]` (Step 5).

- [ ] **Step 2: `Seg` gains className/style passthrough; `KeyedPop`**

Replace `Seg` with:

```jsx
function Seg({ value, label, bold, className = "", style }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button type="button" title={`Copy ${label}`} onClick={async () => { await writeClipboard(value); setCopied(true); }}
      className={"rounded px-0.5 -mx-0.5 text-left transition-colors hover:bg-slate-100 " + (bold ? "font-bold " : "") + (copied ? "font-semibold " : "") + className}
      style={{ ...(copied ? { color: "var(--ft-brand-deep)", background: "var(--ft-brand-soft)" } : null), ...style }}>
      {value}
    </button>
  );
}
```

Add `KeyedPop` after `Seg` — the one popover a green check or stock badge opens (`render` receives the trigger's `ref` + `onClick`):

```jsx
// The options behind a persisted stamp: today's latch was one-way and reset
// on reopen; a stored one needs a way back that a mis-click can't take.
function KeyedPop({ stamp, active, onCopyAgain, onClear, render }) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const pos = useAnchoredPanel(open, anchorRef, panelRef, () => setOpen(false));
  useEscClose(open, () => setOpen(false));
  const W = 252;
  const btn = "rounded-md px-2 py-1 text-[11.5px] font-semibold border transition-colors disabled:opacity-40";
  return (
    <>
      {render({ ref: anchorRef, onClick: () => setOpen((o) => !o) })}
      {open && pos && stamp && createPortal(
        <div ref={panelRef} style={{ ...vPos(pos), left: Math.max(8, Math.min(pos.left, window.innerWidth - W - 8)), width: W }}
          className="fixed z-50 rounded-lg border border-slate-200 bg-white shadow-lg p-3 text-[12px]">
          <div className="font-semibold">Keyed on ERP {stamp.no}</div>
          <div className="text-slate-500">{[when(stamp.at), stamp.by].filter(Boolean).join(" · ")}</div>
          <div className="mt-2 flex items-center gap-1.5 flex-wrap">
            <button onClick={() => { onCopyAgain(); setOpen(false); }} disabled={!active} title={active ? `Copies the line again and moves it to ERP ${active}` : "No active order"} className={btn + " border-slate-200 hover:bg-slate-50"}>Copy again</button>
            <button onClick={() => { onClear(); setOpen(false); }} className={btn} style={{ background: "var(--ft-accent)", color: "var(--ft-accent-ink)", borderColor: "var(--ft-accent)" }}>Clear</button>
            <button onClick={() => setOpen(false)} className={btn + " border-transparent text-slate-500 hover:bg-slate-50"}>Keep</button>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-400">Clearing changes NED only — the ERP order is untouched.</div>
        </div>, document.body)}
    </>
  );
}
```

- [ ] **Step 3: The header bar boxes**

Replace `DeliverTo` (the section) with the column box. Keep `DELIVER_TIP` but shorten it to fit the eyebrow tip: it stays as is, rendered via `HelpTip` in the eyebrow.

```jsx
// The Deliver to COLUMN of the header bar (owner, rounds 3–5): the same label
// and click-to-copy pieces, the copy-all latch in the eyebrow row. A quick
// price shows the eyebrow alone — its auto-name is no deliver-to.
function DeliverBox({ custInfo, quick }) {
  const rows = useMemo(() => deliverToRows(custInfo), [custInfo]);
  const f = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const split = splitAddress(custInfo?.address);
  const any = !quick && rows.some((r) => r.value);
  return (
    <div style={BOX} className="basis-full lg:basis-auto lg:flex-1">
      <div className={EYE}>
        <span className="inline-flex items-center gap-1">Deliver to{!quick && <HelpTip className="align-middle" w={280} tip={DELIVER_TIP} />}</span>
        {any && <LatchCopy small texts={deliverToSequence(rows)} title={"Copy every field, then the whole label.\nCtrl+V pastes the label; Win+V lists each field for the delivery form."} />}
      </div>
      {any && (
        <div className="text-[11.5px] leading-[1.35]">
          <div><Seg value={f.name} label="delivery name" bold /></div>
          <div><Seg value={f.street} label="street" /></div>
          {f.apt && <div><Seg value={f.apt} label="apt/suite" /></div>}
          {(f.city || f.state || f.zip) && <div><Seg value={f.city} label="city" />{f.city && f.state && ","} <Seg value={f.state} label="state" /> <Seg value={f.zip} label="ZIP code" /></div>}
          <div><Seg value={f.phone} label="phone number" /></div>
          {!split.ok && <div className="mt-1 text-[10.5px] leading-tight" style={{ color: ASSUMED_INK }}>Address couldn't be split into fields — shown as one line.</div>}
        </div>
      )}
      {!quick && !any && <div className="text-[11px] text-slate-400">No customer name, address or phone on this project.</div>}
    </div>
  );
}
```

`LatchCopy` gains a `small` prop (20px): change its button className to `"grid place-items-center rounded-md border transition-colors disabled:opacity-30 disabled:cursor-default " + (small ? "w-5 h-5 " : "w-[26px] h-[26px] ") + (copied ? "" : "border-transparent text-slate-400 hover:border-slate-200 hover:bg-white")` and the icon sizes to `small ? 12 : 15/14`.

The ERP column — field on top, chips stacked under, inline remove-confirm, fine print:

```jsx
// The ERP 1 order column: the entry field on top, each order a chip stacked
// under it (newest on top, the active one filled), fine print for state.
function ErpBox({ erpOrders, erpKeyed, active, setActive, locked, optional, onAdd, onRemove, note }) {
  const [draft, setDraft] = useState("");
  const [confirmNo, setConfirmNo] = useState(null);
  const per = orderCounts(erpKeyed);
  const submit = () => { const n = normErpNo(draft); if (!n) return; onAdd(n); setDraft(""); };
  const askRemove = (no) => { if (per[no]) setConfirmNo(no); else onRemove(no); };
  const chips = [...erpOrders].reverse();
  const field = "flex items-center gap-1 rounded-[5px] border bg-white h-6 pl-1.5 pr-[3px] " + (locked ? "" : "border-slate-300");
  return (
    <div style={BOX} className="w-[152px] shrink-0 flex flex-col gap-[3px]">
      <div className={EYE}><span>ERP 1 order</span></div>
      <div className={field} style={locked ? { borderColor: "#f59e0b", background: ASSUMED_BG } : undefined}>
        <span className="ft-eyebrow text-[9px] shrink-0" style={{ letterSpacing: ".06em" }}>ERP #</span>
        <input value={draft} inputMode="numeric" aria-label="ERP 1 order number" placeholder={erpOrders.length ? "another…" : optional ? "optional" : "required"}
          onChange={(e) => setDraft(normErpNo(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          className="min-w-0 w-full bg-transparent text-[12.5px] font-bold outline-none ft-mono placeholder:font-medium placeholder:text-slate-400" />
        <button onClick={submit} title="Add this order number" className="grid place-items-center w-[18px] h-[18px] rounded shrink-0" style={{ background: "var(--ft-accent)", color: "var(--ft-accent-ink)" }}><Plus size={13} /></button>
      </div>
      {chips.map((o) => o.no === confirmNo ? (
        <div key={o.no} className="rounded-[5px] border border-slate-300 bg-white px-1.5 py-1 text-[10.5px] leading-tight">
          Remove order {o.no}? Its {per[o.no]} stamped {per[o.no] === 1 ? "line goes" : "lines go"} back to unkeyed.
          <div className="mt-1 flex gap-1">
            <button onClick={() => { setConfirmNo(null); onRemove(o.no); }} className="rounded px-1.5 py-px font-semibold" style={{ background: "var(--ft-accent)", color: "var(--ft-accent-ink)" }}>Remove</button>
            <button onClick={() => setConfirmNo(null)} className="rounded px-1.5 py-px font-semibold text-slate-500 hover:bg-slate-100">Keep</button>
          </div>
        </div>
      ) : (
        <div key={o.no} role="button" tabIndex={0} aria-pressed={o.no === active} onClick={() => setActive(o.no)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActive(o.no); } }}
          title={(o.no === active ? "Active — copies stamp this order. " : "Click to make this the active order. ") + (o.addedBy ? `Added by ${o.addedBy}` : "Added") + (o.addedAt ? ` ${when(o.addedAt)}` : "")}
          className="flex items-center gap-1 rounded-[5px] border px-1.5 py-[2px] text-[12px] font-bold ft-mono cursor-pointer"
          style={o.no === active ? DONE_MOSS : { borderColor: "var(--ft-border-strong)", background: "#fff" }}>
          <span>{o.no}</span>
          {per[o.no] > 0 && <span className="ml-auto text-[10px] font-semibold" style={{ opacity: .8 }}>{per[o.no]} {per[o.no] === 1 ? "line" : "lines"}</span>}
          <button onClick={(e) => { e.stopPropagation(); askRemove(o.no); }} title={`Remove order ${o.no}`} className={"text-[11px] leading-none " + (per[o.no] > 0 ? "" : "ml-auto")} style={{ opacity: .8 }}>×</button>
        </div>
      ))}
      <div className="text-[9.5px] leading-[1.3] ft-mono" style={{ color: locked ? ASSUMED_INK : "var(--ft-faint)" }}>{note}</div>
    </div>
  );
}
```

The Project + View column:

```jsx
function ProjectBox({ name, projectNo, onClose }) {
  return (
    <div style={BOX}>
      <div className={EYE}>
        {projectNo ? <Seg value={`N${projectNo}`} label="project number" className="ft-mono text-[10px] font-extrabold" style={{ letterSpacing: ".06em" }} /> : <span />}
        <button onClick={onClose} title="Close" className="text-slate-400 hover:text-slate-600 -mr-1"><X size={14} /></button>
      </div>
      <Seg value={name} label="project name" bold className="block w-full text-[12px] leading-[1.2]" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }} />
    </div>
  );
}

const VIEWS = [["compact", "Compact"], ["area", "Area + vendor"], ["sheet", "Sheet order"]];
function ViewBox({ view, setView }) {
  return (
    <div style={{ ...BOX, padding: "3px 4px 4px" }} role="group" aria-label="List view" className="flex flex-col gap-px"
      title="Compact combines every line that shares a SKU into one, tile before trims. Area + vendor keeps each area together and pulls the wedi and Schluter shower lines into vendor groups below. Sheet order is the list exactly as the estimate reads.">
      {VIEWS.map(([v, l]) => (
        <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
          className={"block w-full text-left rounded px-1.5 py-[2px] text-[11px] font-semibold leading-[1.25] transition-colors " + (view === v ? "" : "text-slate-500 hover:bg-white/60")}
          style={view === v ? DONE_MOSS : undefined}>{l}</button>
      ))}
    </div>
  );
}
```

Give `ProjectBox`'s name `Seg` a `title` of the full name: `Seg` already sets `title={\`Copy ${label}\`}`; change `Seg` so `title` prefers a passed `title` prop — add `title` to its props and use `title={title || \`Copy ${label}\`}`; pass `title={\`Copy the project name\n${name}\`}` from `ProjectBox`.

- [ ] **Step 4: `SpecialRow` with the gate, the stamp and the popover**

Replace `SpecialRow` with:

```jsx
function SpecialRow({ r, alt, descLimit, locked, active, erpKeyed, onStamp, onClear }) {
  const [copied, setCopied] = useState(false);
  const [copiedExt, setCopiedExt] = useState(false);
  const [showFrom, setShowFrom] = useState(false);
  const no = keyedNo(r, erpKeyed);
  const stamp = lineStamp(r, erpKeyed);
  const done = !!no || copied;
  const copy = async () => { await writeClipboard(r.copy); setCopied(true); onStamp(r); };
  const copyExt = async () => { await writeClipboard(r.desc.ext); setCopiedExt(true); };
  const d = r.desc;
  const check = (extra) => (
    <div className="flex flex-col items-center">
      <button {...extra} style={done ? DONE_MOSS : undefined}
        className={"grid place-items-center w-[26px] h-[26px] rounded-md border transition-colors disabled:opacity-30 disabled:cursor-default " +
          (done ? "" : "border-transparent text-slate-400 hover:border-slate-200 hover:bg-white")}>
        {done ? <Check size={15} /> : <Copy size={14} />}
      </button>
      {no && <div style={STAMP_NO}>{no}</div>}
    </div>
  );
  return (
    <div style={{ ...GRID, padding: "6px 10px", background: alt ? "var(--ft-prod)" : "transparent", ...(r.qtyAssumed ? ASSUMED_ROW : null) }}
      title={r.qtyAssumed ? ASSUMED_TITLE : undefined}
      className="border-t border-slate-100">
      {no
        ? <KeyedPop stamp={stamp} active={active} onCopyAgain={copy} onClear={() => onClear(r)} render={(p) => check({ ...p, title: stampTitle(stamp) })} />
        : check({ onClick: copy, disabled: locked, title: locked ? LOCK_TITLE : "Copy the description field" })}

      {/* the item column — unchanged from today except the Ext button honours the gate */}
      <div className="min-w-0">
        …(keep today's item column exactly; on the Ext button add `disabled={locked}` and `title={locked ? LOCK_TITLE : "Copy the full description for the extended-text field:\n\n" + d.ext}` and add `disabled:opacity-30` to its className)…
      </div>

      {/* qty / cost / sell cells — unchanged */}
      …
    </div>
  );
}
```

(Copy the item and money cells verbatim from the current file; only the two edits above change.)

- [ ] **Step 5: `StockRow` with the badge, and `CopySection` with Copy remaining**

Replace `StockRow` with:

```jsx
function StockRow({ r, sel, onToggle, unit, locked, active, erpKeyed, onStamp, onClear }) {
  const [showFrom, setShowFrom] = useState(false);
  const no = keyedNo(r, erpKeyed);
  const stamp = lineStamp(r, erpKeyed);
  const copyAgain = async () => { await writeClipboard(`${r.sku}\t${r.qty}`); onStamp(r); };
  const badge = (extra) => (
    <div className="flex flex-col items-center shrink-0">
      <button {...extra} className="grid place-items-center w-[17px] h-[17px] rounded-[3px]" style={DONE_MOSS}><Check size={12} /></button>
      <div style={STAMP_NO}>{no}</div>
    </div>
  );
  return (
    <label title={r.qtyAssumed ? ASSUMED_TITLE : undefined}
      style={r.qtyAssumed ? ASSUMED_ROW : undefined}
      className={"flex items-center gap-2 px-2.5 py-[5px] text-[12.5px] border-t border-slate-100 " + (r.sku && !no ? "cursor-pointer hover:bg-slate-50" : "cursor-default")}>
      …(SKU, qty and name spans exactly as today)…
      {no
        ? <KeyedPop stamp={stamp} active={active} onCopyAgain={copyAgain} onClear={() => onClear(r)} render={(p) => badge({ ...p, title: stampTitle(stamp), onClick: (e) => { e.preventDefault(); p.onClick(); } })} />
        : <input type="checkbox" checked={sel} onChange={onToggle} disabled={!r.sku || locked} title={locked ? LOCK_TITLE : undefined}
            className="w-[17px] h-[17px] shrink-0 cursor-pointer disabled:opacity-30 disabled:cursor-default" style={{ accentColor: "var(--ft-brand)" }} />}
    </label>
  );
}
```

Replace `CopySection` with:

```jsx
function CopySection({ title, bands, count, emptyText, tip, note, locked, active, erpKeyed, onStampRows, onClear }) {
  const [sel, setSel] = useState(() => new Set());
  const toggle = (id) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const rows = bands.flatMap((b) => b.rows);
  const line = (r) => `${r.sku}\t${r.qty}`;
  const copyableRows = rows.filter((r) => r.sku);
  const remaining = remainingRows(rows, erpKeyed).filter((r) => r.sku);
  const assumed = rows.filter((r) => r.qtyAssumed).length;
  const picked = copyableRows.filter((r) => sel.has(r.id) && !keyedNo(r, erpKeyed));
  const keyed = keyedNote(rows, erpKeyed);
  return (
    <section>
      <div className="flex items-center justify-between mb-2 gap-2">
        <Heading tip={tip}>{title} · {count}</Heading>
        {rows.length > 0 && (
          <div className="flex items-center gap-2">
            <CopyBtn text={remaining.map(line).join("\n")} disabled={locked || remaining.length === 0} onCopied={() => onStampRows(remaining)}
              title={locked ? LOCK_TITLE : remaining.length === 0 ? "Everything is keyed" : undefined}
              label={active ? `Copy remaining (${remaining.length})` : "Copy all"} />
            <CopyBtn text={picked.map(line).join("\n")} disabled={locked || picked.length === 0} onCopied={() => onStampRows(picked)}
              title={locked ? LOCK_TITLE : undefined} label={picked.length ? `Copy selected (${picked.length})` : "Copy selected"} />
          </div>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-[13px] text-slate-400 rounded-lg border border-dashed border-slate-200 px-3 py-3">{emptyText}</p>
      ) : (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          {bands.map((b, bi) => (
            <div key={b.label} className="contents">
              <Band label={b.label} area={b.area} first={bi === 0} />
              {b.rows.map((r) => <StockRow key={r.id} r={r} sel={sel.has(r.id)} onToggle={() => toggle(r.id)} unit={r.unitCode || ""} locked={locked} active={active} erpKeyed={erpKeyed} onStamp={(row) => onStampRows([row])} onClear={onClear} />)}
            </div>
          ))}
          {(note || keyed || assumed > 0 || copyableRows.length < rows.length) && (
            <div className="px-3 py-1.5 text-[11px] text-slate-400 border-t border-slate-100 space-x-1">
              {keyed && <span className="font-semibold" style={{ color: "var(--ft-brand-deep)" }}>{keyed}.</span>}
              {note}
              {assumed > 0 && <span className="text-amber-700">{assumed === 1 ? "One amber line has" : `${assumed} amber lines have`} no quantity on the estimate — copied as 1.</span>}
              {copyableRows.length < rows.length && <span className="text-red-600">Red lines have no SKU and are not copied.</span>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 6: `OrderEntryPanel`**

Replace the component with:

```jsx
export function OrderEntryPanel({ name, projectNo = null, quick = false, custInfo, special = [], stock = [], descLimit = 0, erpOrders = [], erpKeyed = {}, onAddOrder = () => {}, onRemoveOrder = () => {}, onStamp = () => {}, onClearStamp = () => {}, onClose }) {
  const [view, setView] = useState("area");
  const [active, setActive] = useState(() => erpOrders[erpOrders.length - 1]?.no || "");
  // A removed order can't stay active; a freshly added one becomes active.
  useEffect(() => { if (!erpOrders.some((o) => o.no === active)) setActive(erpOrders[erpOrders.length - 1]?.no || ""); }, [erpOrders]);
  const locked = gated({ projectNo, erpOrders });
  const sp = useViews(special), st = useViews(stock);
  const spv = sp[view], stv = st[view];
  const specialRows = spv.bands.flatMap((b) => b.rows);
  const splits = specialRows.filter((r) => r.desc && r.desc.cut).length;
  const assumed = specialRows.filter((r) => r.qtyAssumed).length;
  const isMerged = view !== "sheet";
  const specialNote = isMerged ? mergeNote(specialRows) : null;
  const specialKeyed = keyedNote(specialRows, erpKeyed);
  const stamp = (rows) => { if (active) onStamp(rows.flatMap(lineIds), active); };
  const clear = (row) => onClearStamp(lineIds(row));
  const addOrder = (no) => { onAddOrder(no); setActive(no); };
  const allRows = [...specialRows, ...stv.rows];
  const left = remainingRows(allRows, erpKeyed).length;
  const total = allRows.filter((r) => r.special || r.sku).length;
  const note = locked ? "Enter the order number to unlock the line copies."
    : !erpOrders.length ? "Optional — so this job can be found by its order number later."
    : left === 0 ? `Copies stamp ${active} · every line is keyed`
    : `Copies stamp ${active} · ${total - left} of ${total} keyed · ${left} to go`;
  return (
    <div className="print:hidden fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="flex flex-col bg-white border-l border-slate-200 shadow-2xl w-full lg:w-[560px] max-w-full h-full" onClick={(e) => e.stopPropagation()}>
        {/* The header bar (owner, rounds 3–5): the project header's idiom — a
            band of bordered columns, nothing above it. */}
        <div className="shrink-0 m-2 mb-0 rounded-lg border flex flex-wrap lg:flex-nowrap gap-1.5 p-[7px]" style={{ background: "var(--ft-band)", borderColor: "var(--ft-border)" }}>
          <DeliverBox custInfo={custInfo} quick={quick} />
          <ErpBox erpOrders={erpOrders} erpKeyed={erpKeyed} active={active} setActive={setActive} locked={locked} optional={!projectNo} onAdd={addOrder} onRemove={onRemoveOrder} note={note} />
          <div className="w-[150px] shrink-0 flex flex-col gap-1.5">
            <ProjectBox name={name} projectNo={projectNo} onClose={onClose} />
            <ViewBox view={view} setView={setView} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          <section>
            <div className="flex items-baseline justify-between mb-2">
              <Heading tip={<>A copied line stays a green check with the ERP order it was keyed on under it; click the check to copy it again or clear it. Copies stamp the active order. Cost &amp; Sell are per the buy/sell unit.{descLimit > 0 && <> Descriptions are fitted to {descLimit} characters; a “+” means the rest goes in the extended-text field.</>}</>}>
                Special order · {specialRows.length}
              </Heading>
            </div>
            {specialRows.length === 0 ? (
              <p className="text-[13px] text-slate-400 rounded-lg border border-dashed border-slate-200 px-3 py-3">No special-order items in this project.</p>
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <div style={{ ...GRID, padding: "5px 10px" }} className="bg-slate-100">
                  <span />
                  <span className="ft-eyebrow text-[9px] tracking-[.09em] text-slate-500">Item</span>
                  <span className="ft-eyebrow text-[9px] tracking-[.09em] text-slate-500 text-right">Qty</span>
                  <span className="ft-eyebrow text-[9px] tracking-[.09em] text-slate-500 text-right">Cost</span>
                  <span className="ft-eyebrow text-[9px] tracking-[.09em] text-slate-500 text-right">Sell</span>
                </div>
                {(() => { let i = 0; return spv.bands.map((b) => (
                  <div key={b.label} className="contents">
                    <Band label={b.label} area={b.area} />
                    {b.rows.map((r) => <SpecialRow key={r.id} r={r} alt={i++ % 2 === 1} descLimit={descLimit} locked={locked} active={active} erpKeyed={erpKeyed} onStamp={(row) => stamp([row])} onClear={clear} />)}
                  </div>
                )); })()}
                {(specialKeyed || specialNote || assumed > 0 || splits > 0) && (
                  <div className="px-3 py-1.5 text-[11px] text-slate-400 border-t border-slate-100 space-x-1">
                    {specialKeyed && <span className="font-semibold" style={{ color: "var(--ft-brand-deep)" }}>{specialKeyed}.</span>}
                    {specialNote}
                    {assumed > 0 && <span className="text-amber-700">{assumed === 1 ? "One amber line has" : `${assumed} amber lines have`} no quantity on the estimate — priced and keyed as <b>1</b>.</span>}
                    {splits > 0 && <span className="text-amber-700">{splits === 1 ? "One line is" : `${splits} lines are`} too long to fit — the “+” means the rest is in <b>Ext</b>.</span>}
                  </div>
                )}
              </div>
            )}
          </section>

          <CopySection key={view} title="Stock" bands={stv.bands} count={stv.rows.length}
            emptyText="No stock items in this project."
            tip="Each line copies as SKU + tab + quantity, ready to paste. Copy remaining takes every unkeyed line with a SKU and stamps it on the active ERP order; check lines for Copy selected. Click a keyed line's badge to copy it again or clear it."
            note={isMerged ? mergeNote(stv.rows) : null}
            locked={locked} active={active} erpKeyed={erpKeyed} onStampRows={stamp} onClear={clear} />
        </div>
      </div>
    </div>
  );
}
```

Delete the old `DeliverTo` component, the old header `<div className="flex items-start justify-between px-4 py-3 …">`, and the `{custInfo && <DeliverTo …/>}` line — the bar replaces all three. Update the file's top comment: the header bar replaces the title row and the Deliver to section; stamps persist through `erpKeyed` (App.jsx writes; the panel only calls back).

- [ ] **Step 7: Lint, build, and run the existing suite**

Run: `npm run lint && npm test && npm run build`
Expected: clean. (No unit tests cover the JSX; Task 10 is the proof.)

- [ ] **Step 8: Commit**

```bash
git add src/orderentry.jsx
git commit -m "Order entry: header bar with ERP 1 orders, gated copies, persisted stamps, Copy remaining"
```

---

### Task 9: The `ERP 48213` chip in the project header and the mobile band

**Files:**
- Modify: `src/projectheader.jsx:195` (bar layout) and `:308` (classic layout)
- Modify: `src/mobile.jsx:775`

**Interfaces:**
- Consumes: `sel.erpOrders`; the header's existing `setShowOrderCopy` prop (already wrapped in App.jsx to route through the scope picker).

- [ ] **Step 1: A shared chip helper in `projectheader.jsx`** (export it so mobile.jsx can import it)

```jsx
// The ERP 1 order chip beside the N-number (spec 2026-09-19): shows once the
// job has an order; two or more read "+N" with the full list on hover. A
// button where order entry exists (desktop), a static chip on mobile.
export function ErpChip({ erpOrders = [], onOpen }) {
  if (!erpOrders.length) return null;
  const nos = erpOrders.map((o) => o.no);
  const label = `ERP ${nos[nos.length - 1]}${nos.length > 1 ? ` +${nos.length - 1}` : ""}`;
  const cls = "ft-mono rounded px-1.5 font-extrabold whitespace-nowrap";
  const style = { fontSize: 9, letterSpacing: ".05em", lineHeight: "15px", background: "var(--ft-brand-soft)", color: "var(--ft-brand-deep)" };
  const title = `ERP 1 order${nos.length > 1 ? "s" : ""}: ${[...nos].reverse().join(", ")}${onOpen ? " — open order entry" : ""}`;
  return onOpen ? <button type="button" onClick={onOpen} title={title} className={cls + " hover:opacity-80"} style={style}>{label}</button>
    : <span title={title} className={cls} style={style}>{label}</span>;
}
```

- [ ] **Step 2: Bar layout** (line 195) — replace the N-number line with a right-aligned group:

```jsx
              <div className="flex items-center gap-1.5">
                {sel.projectNo && <div className="ft-eyebrow text-[8px]" style={{ color: "var(--ft-faint)", letterSpacing: ".08em" }}>N{sel.projectNo}</div>}
                <ErpChip erpOrders={sel.erpOrders} onOpen={() => setShowOrderCopy(true)} />
              </div>
```

- [ ] **Step 3: Classic layout** (line 308) — after the `Project · N214` eyebrow div add:

```jsx
          {sel.erpOrders?.length > 0 && <div className="flex justify-center mb-1"><ErpChip erpOrders={sel.erpOrders} onOpen={() => setShowOrderCopy(true)} /></div>}
```

- [ ] **Step 4: Mobile band** (line 775) — import `ErpChip` from `./projectheader.jsx` and replace the N-number line with:

```jsx
            <div className="flex items-center gap-1.5">
              {sel.projectNo && <div className="ft-eyebrow text-[8px]" style={{ ...eyebrow, letterSpacing: ".08em" }}>N{sel.projectNo}</div>}
              <ErpChip erpOrders={sel.erpOrders} />
            </div>
```

Check `src/CLAUDE.md`'s boot-chunk rule first: `mobile.jsx` importing `projectheader.jsx` is fine only if `projectheader.jsx` is already in the boot chunk (it is — App.jsx imports it statically). If lint flags a cycle, move `ErpChip` to `src/widgets.jsx` instead and import it in both.

- [ ] **Step 5: Lint and build**

Run: `npm run lint && npm run build`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/projectheader.jsx src/mobile.jsx
git commit -m "Project header: ERP order chip beside the N-number, opens order entry"
```

---

### Task 10: Preview harness fixtures and the preview proof

**Files:**
- Modify: `src/orderentrypreview.jsx` (the mount at the bottom)
- Create: `.scratch/147_erp-order-numbers/ticket.md`, `.scratch/147_erp-order-numbers/shot.mjs`, PNGs

**Interfaces:**
- Consumes: the builders from `./erporders.js`; `OrderEntryPanel`'s new props.

- [ ] **Step 1: A stateful harness with URL-picked fixtures**

Replace the `createRoot(...).render(...)` call at the bottom of `src/orderentrypreview.jsx` with:

```jsx
import { useState } from "react";
import { addErpOrder, removeErpOrder, stampErpLines, clearErpStamps } from "./erporders.js";

// ?state=none | one | two | quick picks the ERP fixture (spec 2026-09-19);
// the handlers run the real builders so the harness is fully interactive.
const STATE = new URLSearchParams(location.search).get("state") || "two";
const specialRows = built.filter((r) => r.special);
const stockRows = built.filter((r) => !r.special);
const seeded = () => {
  if (STATE === "none" || STATE === "quick") return { erpOrders: [], erpKeyed: {} };
  const a = { no: "48213", addedBy: "Marcus Mast", addedAt: Date.now() - 6 * 3600e3 };
  const b = { no: "48260", addedBy: "Marcus Mast", addedAt: Date.now() - 20 * 60e3 };
  const on = (ids, no, minsAgo) => Object.fromEntries(ids.map((id) => [id, { no, at: Date.now() - minsAgo * 60e3, by: "Marcus Mast" }]));
  const keyed = { ...on([specialRows[0].id, specialRows[1].id, stockRows[0].id, mats[0].id], "48213", 355) };
  if (STATE === "one") return { erpOrders: [a], erpKeyed: keyed };
  return { erpOrders: [a, b], erpKeyed: { ...keyed, ...on([freight[0].id], "48260", 18) } };
};

function Harness() {
  const [proj, setProj] = useState(() => ({ projectNo: STATE === "quick" ? null : 142, quick: STATE === "quick", ...seeded() }));
  const apply = (patch) => { if (patch) setProj((p) => ({ ...p, ...patch })); };
  return (
    <OrderEntryPanel
      name={STATE === "quick" ? "Q-Ragno Bianco Subway Matte-9/19" : "Hendricks Residence"}
      projectNo={proj.projectNo} quick={proj.quick}
      custInfo={{ custName: "Pat Hendricks", address: "224 Hammersley Dr, PO Box 288, Tuscarawas, OH 44682", phone: "330-432-7374" }}
      special={[...specialRows, ...freight]}
      stock={[...stockRows, ...mats]}
      descLimit={DESC_LIMIT}
      erpOrders={proj.erpOrders} erpKeyed={proj.erpKeyed}
      onAddOrder={(no) => apply(addErpOrder(proj, no, "Preview"))}
      onRemoveOrder={(no) => apply(removeErpOrder(proj, no))}
      onStamp={(ids, no) => apply(stampErpLines(proj, ids, no, "Preview"))}
      onClearStamp={(ids) => apply(clearErpStamps(proj, ids))}
      onClose={() => {}}
    />
  );
}
createRoot(document.getElementById("preview")).render(<Harness />);
```

Also change the `mats` fixture ids to the stable rule (`id: "mat|Mortar|Mapei Ultraflex 2 Gray 50lb"` etc.) so the seed above keys them the way App.jsx now does.

- [ ] **Step 2: The ticket**

Create `.scratch/147_erp-order-numbers/ticket.md`:

```markdown
---
issue_type: Feature
summary: ERP 1 order numbers on the project — the order-entry panel's header
  bar (Deliver to · ERP 1 order · Project + View), copies gated on numbered
  projects until a number is entered, each copied line stamped with its order
  and remembered across reopen, Copy remaining, the header chip and a
  searchable customer-browser column.
status: in-progress
labels: [ready-for-human]
---

# ERP 1 order numbers

Owner, 2026-09-19. Spec: `docs/superpowers/specs/2026-09-19-erp-order-numbers-design.md`;
mockup `.scratch/mockups/erp-order-2026-09-19.html` (five rounds, 1D-A picked);
ADR 0044.

## Preview proof

`shot.mjs` over `order-entry-preview.html` (Vite on :5199):
`locked.png` (numbered, no order), `one.png` (one order, stamps),
`two.png` (the split, popover open on a keyed line), `quick.png` (ungated,
empty Deliver to), `fold.png` (phone width), `browser.png` (the ERP order
column and search, samples-preview harness).
```

- [ ] **Step 3: The shot script**

Create `.scratch/147_erp-order-numbers/shot.mjs` (same rig as `.scratch/143_order-entry-area-views/shot.mjs`):

```js
// Preview proof (issue 147): the REAL OrderEntryPanel over the harness's ERP
// fixtures. Vite on :5199 (npx vite --port 5199), then
//   node .scratch/147_erp-order-numbers/shot.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PW || "/opt/node22/lib/node_modules/playwright/node_modules/playwright-core");
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const dir = dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const shot = async (state, file, { width = 1280, act } = {}) => {
  const page = await browser.newPage({ viewport: { width, height: 1400 }, deviceScaleFactor: 2 });
  page.on("pageerror", (e) => console.log("[pageerror]", state, e.message));
  await page.goto(`http://localhost:5199/order-entry-preview.html?state=${state}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.fonts.ready);
  if (act) await act(page);
  await page.screenshot({ path: join(dir, file), fullPage: false });
  console.log("shot", file);
  await page.close();
};
await shot("none", "locked.png");
await shot("one", "one.png");
await shot("two", "two.png", { act: async (p) => { await p.click("button[title^='Keyed on ERP 48213']"); await p.waitForTimeout(200); } });
await shot("quick", "quick.png");
await shot("two", "fold.png", { width: 420 });
await browser.close();
```

- [ ] **Step 4: Take the shots and look at them**

Run: `npx vite --port 5199 &` then `node .scratch/147_erp-order-numbers/shot.mjs`, then `kill %1`.
Open each PNG (Read tool). Check against the mockup's "1D-A — the whole panel" panel: three columns level, chips stacked newest-first with the active one filled, the number under each keyed check, the popover on the Master bath line, the quick price's empty Deliver to and neutral field, the fold at 420px (Deliver to full width, ERP and Project/View side by side). Fix anything off in `orderentry.jsx`, re-shoot.

For the browser column: in `src/samplespreview.jsx` give two of `BROWSER_PROJECTS` an `erpNos` (`["48213", "48260"]` and `["48102"]`), run `samples-preview.html`, type `48213` in the browser's search, screenshot `browser.png`. Revert nothing — the seed stays as harness data.

- [ ] **Step 5: Commit**

```bash
git add src/orderentrypreview.jsx src/samplespreview.jsx .scratch/147_erp-order-numbers
git commit -m "Preview proof: order-entry header bar, gate, stamps, quick price, fold; browser ERP column"
```

---

### Task 11: Records — ADR 0044, data model, file map, ticket, spec status

**Files:**
- Create: `docs/adr/0044-erp-order-stamps-on-the-project.md`
- Modify: `docs/adr/README.md` (append a row)
- Modify: `.claude/skills/floortrack-data-model/SKILL.md` (the `Customer { … }` block, line ~81)
- Modify: `src/CLAUDE.md` (entries for `erporders.js` (new, after `orderlines.js`), `orderentry.jsx`, `custbrowser.js`, `CustomerBrowser.jsx`, `bootload.js`, `model.js`, `projectheader.jsx`, `copybtn.jsx`)
- Modify: `.scratch/147_erp-order-numbers/ticket.md` (`status: done`)
- Modify: `docs/superpowers/specs/2026-09-19-erp-order-numbers-design.md` (status line)

- [ ] **Step 1: The ADR**

```markdown
# ADR 0044 — ERP 1 order stamps live on the project, per line, gating copies on numbered jobs

- **Status:** Accepted
- **Date:** 2026-09-19
- **Scope:** system-wide (`Project.erpOrders` / `Project.erpKeyed`; `src/erporders.js`; the order-entry panel; boot light rows; customer browser)
- **Related:** ADR 0005 (customer ▸ project hierarchy — the number sits on the project); ADR 0026 (light rows carry only what the first screen draws — the numbers ride the jsonb projection, no new table); the samples spec 2026-08-28 (whose "snapshot + live ids" shape was considered and not used here).
- **Spec:** `docs/superpowers/specs/2026-09-19-erp-order-numbers-design.md`

## Context

Keying a NED project into ERP 1 left no trace in NED: the panel's copied
checks were session state, the customer browser couldn't find a job by its
ERP order number, and a job split across two orders had nowhere to say
which lines went on which. The owner wanted the number entered first, the
copies greyed until then, the stamps remembered, and the number searchable.

## Decision

1. **On the project, not a table.** `erpOrders` (the numbers) and `erpKeyed`
   (one stamp per line, keyed by the line's stable id) are jsonb fields on
   the project, normalized by `src/erporders.js` and written only through
   `updateProject` with ONE patch per action. No SQL, no new boot load: the
   light-row select projects `erpOrders` so the browser column and search
   cost nothing. A separate table (the samples shape) was rejected: it needs
   an owner-run migration and another boot load for what is one job's
   bookkeeping.
2. **Per line.** A split order is common enough that "which lines went on
   which order" has to be answerable; the stamp carries `no`, `at`, `by`. A
   merged panel line stamps its sources; it reads keyed only when every
   source is. A material line's id is `mat|<kind>|<product>` (the special
   side's rule, now the stock side's too) — a rename orphans the stamp,
   which then just reads unkeyed.
3. **The gate applies to numbered projects only.** No N-number means no
   customer and no real name — a quick price — and the desk keys those
   without an ERP order, so there the number is optional and nothing is
   gated. A quick price's Deliver to is empty: its auto-name is not a
   deliver-to.
4. **Copy remaining replaces Copy all.** With stamps, "all" would re-key
   what's already in; remaining is what the split needs.
5. **No silent clear.** A persisted stamp clears only through the keyed
   line's popover (Copy again / Clear / Keep).

## Consequences

- Versions don't snapshot stamps; a restored version keeps the stamps that
  still match its line ids.
- Print doesn't show the number (its own ask). Server-side search doesn't
  match it (the browser searches the light rows client-side).
- The panel's top is a header bar (Deliver to · ERP 1 order · Project +
  View) in the project header's idiom; the title row and the body's Deliver
  to section are gone.
```

Append to `docs/adr/README.md`:

```markdown
| [0044](0044-erp-order-stamps-on-the-project.md) | ERP 1 order numbers and per-line stamps live on the project (jsonb, one patch per action, no table); copies gate on numbered jobs only; Copy remaining replaces Copy all; stamps clear only through the keyed line's popover | Accepted | 2026-09-19 |
```

- [ ] **Step 2: Data model skill** — in the `Customer { … }` block add, after `sheogaBasket: [], wediBasket: [], schluterBasket: [] }`:

```
           erpOrders: [{ no, addedBy, addedAt }],          // ERP 1 orders the job was keyed
           erpKeyed: { [lineId]: { no, at, by } } }        // under + one stamp per order-entry
           // line (ADR 0044, spec 2026-09-19). Normalized by src/erporders.js
           // (normErpOrders / normErpKeyed — a stamp on an unknown order is
           // dropped); written ONLY through updateProject with a builder's
           // whole patch (addErpOrder / removeErpOrder / stampErpLines /
           // clearErpStamps). Line ids: the product row's id; a material's
           // `mat|<kind>|<product>`; freight's `freight|<bookId>`. The boot
           // light row projects `erpNos` (bootload LIST_SELECT) so the
           // customer browser shows/searches them without full rows.
```

(Close the object's brace correctly: move the `}` that ends the block to after `erpKeyed`.)

- [ ] **Step 3: File map** — add to `src/CLAUDE.md`, after the `orderlines.js` entry:

```
  erporders.js      # ERP 1 order numbers on a project (ADR 0044): normalizers
                    # (normErpNo digits-only ≤10; normErpOrders dedupes; normErpKeyed
                    # drops stamps on unknown orders), the ONE-PATCH builders
                    # (addErpOrder / removeErpOrder / stampErpLines / clearErpStamps
                    # — null = nothing to write), `gated` (numbered + no order),
                    # line helpers over the panel's rows (lineIds — a merged
                    # row's sources; keyedNo — "mixed" across orders, null
                    # when any source is unstamped; remainingRows; keyedNote),
                    # erpNosOf/erpHit for the browser's column + search over
                    # light or full rows. Never imports model.js (erporders.test.js)
```

And amend the existing entries in one or two lines each: `orderentry.jsx` (the header bar replaces the title row + Deliver to section; props `projectNo`/`quick`/`erpOrders`/`erpKeyed` + four callbacks; `KeyedPop`; Copy remaining), `custbrowser.js` (`erpNos`, `erpHit` in both filters, `erp` column key), `CustomerBrowser.jsx` (ERP order column, lines-panel tags), `bootload.js` (`erp:data->erpOrders` on both selects → `erpNos`), `model.js` (`normC` → `erpOrders`/`erpKeyed`), `projectheader.jsx` (`ErpChip`, also mounted by mobile.jsx), `copybtn.jsx` (`onCopied`).

- [ ] **Step 4: Ticket and spec status**

Set `status: done` in `.scratch/147_erp-order-numbers/ticket.md`. Change the spec's status line to `**Status:** approved by owner in chat 2026-09-19; implemented (ADR 0044, issue 147)`.

- [ ] **Step 5: Full verification**

Run: `npm run lint && npm test && npm run build`
Expected: all clean. Paste the test summary line into the ticket under a `## Verification` heading.

- [ ] **Step 6: Commit and push**

```bash
git add docs/adr/0044-erp-order-stamps-on-the-project.md docs/adr/README.md .claude/skills/floortrack-data-model/SKILL.md src/CLAUDE.md .scratch/147_erp-order-numbers/ticket.md docs/superpowers/specs/2026-09-19-erp-order-numbers-design.md
git commit -m "Record ADR 0044 (ERP order stamps on the project), data model, file map, issue 147"
git push -u origin claude/relaxed-goldberg-8eml9n
```

Then tell the owner the branch is pushed with the preview PNGs, and ask before opening the PR (CLAUDE.md: every change lands through a PR; the owner decides when).

---

## Self-review

**Spec coverage.** Storage + normalizing → Tasks 1–3. Line ids (stable material ids) → Task 7. Patch builders → Task 2. Panel: header bar (Deliver to / ERP / Project + View), gate on numbered only, quick-price empty Deliver to, stamping, 3B keyed rendering, `KeyedPop`, Copy remaining, Copy selected, remove-order confirm, active order state, footers, tips, fold below `lg` → Task 8. Boot light rows → Task 4. Customer browser column, `erpNos`, `erpHit` in both filters, lines-panel tags → Tasks 5–6. Project header chip (both layouts + mobile) → Task 9. Preview proof → Task 10. ADR, data model, file map, ticket → Task 11. Not in scope (print, server search, 4B) — nothing to build.

**Type consistency.** `erpOrders` entries are `{no, addedBy, addedAt}` everywhere; stamps `{no, at, by}`; builders return `{erpOrders, erpKeyed}` or `null`, and App's `erpPatch` skips `null`; `onStamp(ids, no)` takes ids (the panel flattens rows through `lineIds`), `onClearStamp(ids)` likewise; `CopyBtn`'s callback is `onCopied` in Task 7 and Task 8.

**Placeholders.** Task 8 Steps 4–5 say "keep today's item / SKU cells verbatim" for the unchanged JSX — the current file is the source; every changed line is shown.
