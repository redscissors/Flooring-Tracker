# Sample Ordering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the sample-ordering branch to the approved design: requests in their own shared `sample_requests` table, a vendor-grouped project panel that emails each vendor's rep, and a samples column + filter in the customer browser.

**Architecture:** Sample requests are shared rows (claude-issues doctrine: snapshot + live ids) loaded as a bounded stage-2 cache; product rows carry nothing. One write-path hook (`useSamples`). All surfaces — row icon, header badge, project panel, customer-browser column/filter — derive from the same loaded rows.

**Tech Stack:** React 18 (hooks only), Supabase Postgres (jsonb rows + RLS), `node --test` for pure logic, Vite dev server + Playwright for preview proof.

**Spec:** `docs/superpowers/specs/2026-08-28-sample-ordering-design.md`

## Global Constraints

- **Never touch the live Supabase project** — `supabase/samples.sql` is shipped, never executed (non-negotiable #1). Until the owner runs it, writes fail with the todos-style ping `"Save failed — run supabase/samples.sql?"` and surfaces render empty states.
- **Never push to `main`** — all work lands on `claude/sample-ordering-workflow-fvsdzp`.
- **No UI change merges without preview proof** — Task 9 produces screenshots before the PR is reviewed.
- Statuses are exactly two: `"need"` (label **To order**) and `"ordered"` (label **Ordered**).
- The rep email carries **no salesperson info** (owner call 2026-08-28).
- Boot policy (ADR 0026): requests load in background stage 2; nothing blocks first paint; surfaces refresh on open.
- Reuse the theme's slate/indigo utility classes; status colors are inline (amber `#b45309` for To order, `var(--ft-brand)` moss for Ordered) because the theme's emerald/amber utilities don't all render.
- `npx vite build` fails on `index.html` ("URI malformed") on the clean tree — pre-existing, NOT caused by this work, not to be fixed here. Verify via `node --test` and loading pages in the Vite dev server instead.
- Comments follow the repo rule: only non-obvious constraints, no narration.
- This branch already carries a v1 of this feature; tasks below rework it in place. Where a task says Modify, the v1 code is present.

---

### Task 1: `supabase/samples.sql` + data-model skill doc

**Files:**
- Create: `supabase/samples.sql`
- Modify: `.claude/skills/floortrack-data-model/SKILL.md` (replace the v1 `product.sample` notes with the table)
- Modify: `CLAUDE.md` (source-layout table: add the samples.sql line)

**Interfaces:**
- Consumes: nothing.
- Produces: the `sample_requests` table contract every later task reads/writes: `{ id text pk, data jsonb, created_at, updated_at }` with `data = { status: "need"|"ordered", createdBy, createdAt, orderedBy, orderedAt, custId, custName, areaName, productId, bookId, bookName, item: { name, sku, size, type } }`.

- [ ] **Step 1: Write the SQL file** (modeled on `supabase/claude-issues.sql`, which reuses `set_updated_at()` from schema.sql):

```sql
-- Sample requests (sample-ordering workflow, spec 2026-08-28)
-- Run once in your Supabase project: Dashboard -> SQL Editor -> paste -> Run.
--
-- One row per "Request sample" on a project line. Same trust model as todos:
-- every signed-in user can add, edit, and delete every request.
--
-- Everything lives in `data` jsonb (see src/samples.js normSampleRequest):
--   { status: "need"|"ordered", createdBy, createdAt, orderedBy, orderedAt,
--     custId, custName, areaName, productId, bookId, bookName,
--     item: { name, sku, size, type } }
-- `item`/`custName`/`areaName`/`bookName` freeze the line at request time so
-- the customer browser's column and the ordered log stay meaningful after the
-- row is edited or deleted; custId/productId are the live ids surfaces match on.

create table if not exists public.sample_requests (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sample_requests enable row level security;

drop policy if exists "sample request select" on public.sample_requests;
create policy "sample request select" on public.sample_requests
  for select to authenticated using (true);

drop policy if exists "sample request insert" on public.sample_requests;
create policy "sample request insert" on public.sample_requests
  for insert to authenticated with check (true);

drop policy if exists "sample request update" on public.sample_requests;
create policy "sample request update" on public.sample_requests
  for update to authenticated using (true) with check (true);

drop policy if exists "sample request delete" on public.sample_requests;
create policy "sample request delete" on public.sample_requests
  for delete to authenticated using (true);

-- Reuses set_updated_at() from schema.sql.
drop trigger if exists sample_requests_updated_at on public.sample_requests;
create trigger sample_requests_updated_at
  before update on public.sample_requests
  for each row execute function public.set_updated_at();
```

- [ ] **Step 2: Update the data-model skill.** In `.claude/skills/floortrack-data-model/SKILL.md`:
  - Delete the `sample: null | { status: "need"|"ordered"|"in", at },` line from the `Product` block and the whole `// sample = the line's sample request …` comment block (v1 leftovers).
  - Add a table entry after the `claude_issue row` block:

```
sample_request row : { id (text pk), data: { status: "need"|"ordered",
                  createdBy, createdAt, orderedBy, orderedAt,
                  custId, custName, areaName, productId, bookId, bookName,
                  item: { name, sku, size, type } } }
                  // sample-ordering workflow (spec 2026-08-28), shared like
                  // todos; snapshot + live ids (the claude_issues doctrine).
                  // Product rows carry NO sample field — these rows are the
                  // one source for the row icon, project panel, header badge,
                  // and the customer browser's samples column. Written only
                  // through useSamples (usesamples.js).
```

- [ ] **Step 3: Add the file to CLAUDE.md's source-layout table**, after the `claude-issues.sql` line:

```
  samples.sql       # run once: sample_requests table + RLS (sample-ordering
                    # workflow, spec 2026-08-28); until it is run the sample
                    # surfaces stay empty and writes ping "run samples.sql?"
```

- [ ] **Step 4: Commit**

```bash
git add supabase/samples.sql .claude/skills/floortrack-data-model/SKILL.md CLAUDE.md
git commit -m "Add sample_requests table SQL + data-model doc for the reworked design"
```

---

### Task 2: `samples.js` pure-logic rework + tests

**Files:**
- Modify: `src/samples.js` (full rewrite — v1 grouped product rows; v2 works on request rows)
- Modify: `src/samples.test.js` (full rewrite)

**Interfaces:**
- Consumes: `areaLabel` from `./model.js`, `TLBL` from `./uiconst.js`, `uid` from `./model.js`.
- Produces (exact exports later tasks import):
  - `SAMPLE_STATUSES = ["need", "ordered"]`, `SAMPLE_LABEL`, `SAMPLE_COLOR`, `SAMPLE_CHIP`
  - `normSampleRequest(raw) -> req | null`
  - `requestFrom({ project, custName, area, areaIndex, product, books, by }) -> req`
  - `sampleGroups(requests) -> [{ key, bookId, name, rows: req[] }]` (encounter order, Other last)
  - `sampleCounts(requests) -> { need, ordered, total }`
  - `custSampleTally(requests) -> Map<custId, { need, ordered }>`
  - `repEmail({ rows, custName, address, phone, repName }) -> { subject, body }`
  - `mailtoHref(email, subject, body) -> string`

- [ ] **Step 1: Rewrite the test file first.** Replace `src/samples.test.js` with:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { normA } from "./model.js";
import {
  normSampleRequest, requestFrom, sampleGroups, sampleCounts, custSampleTally,
  repEmail, mailtoHref, SAMPLE_STATUSES, SAMPLE_LABEL,
} from "./samples.js";

const BOOKS = [
  { id: "b1", kind: "order", name: "Glazzio EFT", data: { brandLabel: "Glazzio" } },
  { id: "b2", kind: "stock", name: "GLATI stock", data: {} },
];
const req = (over = {}) => normSampleRequest({
  id: "r1", status: "need", createdBy: "Dana", createdAt: 1000,
  custId: "c1", custName: "Kathy Marsh", areaName: "Kitchen", productId: "p1",
  bookId: "b1", bookName: "Glazzio", item: { name: "Calacatta Gold", sku: "CM1224", size: "12×24", type: "tile" },
  ...over,
});

test("normSampleRequest: fills the shape, drops junk, clamps status", () => {
  const r = req();
  assert.equal(r.status, "need");
  assert.equal(r.item.sku, "CM1224");
  assert.equal(normSampleRequest(null), null);
  assert.equal(normSampleRequest("x"), null);
  assert.equal(normSampleRequest({ id: "r2", status: "bogus" }).status, "need");
  assert.equal(normSampleRequest({ id: "r3", status: "ordered", orderedBy: "Sam", orderedAt: 5 }).orderedBy, "Sam");
});

test("requestFrom: snapshots the line, resolves the vendor, stamps the creator", () => {
  const area = normA({ id: "a1", name: "Kitchen", products: [{ id: "p1" }] });
  const product = { id: "p1", type: "tile", sku: "CM1224", brandColor: "Calacatta Gold", L: "12", W: "24", bookId: "b1" };
  const r = requestFrom({ project: { id: "c1" }, custName: "Kathy Marsh", area, areaIndex: 0, product, books: BOOKS, by: "Dana" });
  assert.equal(r.status, "need");
  assert.equal(r.custId, "c1");
  assert.equal(r.custName, "Kathy Marsh");
  assert.equal(r.areaName, "Kitchen");
  assert.equal(r.productId, "p1");
  assert.deepEqual([r.bookId, r.bookName], ["b1", "Glazzio"]);
  assert.deepEqual(r.item, { name: "Calacatta Gold", sku: "CM1224", size: "12×24", type: "tile" });
  assert.equal(r.createdBy, "Dana");
  assert.ok(r.id && r.createdAt > 0);
});

test("requestFrom: sheoga rows file under Sheoga, hand rows under Other, name falls back sku then type", () => {
  const area = normA({ id: "a1", name: "", products: [{ id: "p1" }] });
  const base = { project: { id: "c1" }, custName: "K", area, areaIndex: 0, books: BOOKS, by: "D" };
  const sheoga = requestFrom({ ...base, product: { id: "p1", type: "hardwood", sheoga: { mode: "floor", cfg: {} } } });
  assert.equal(sheoga.bookName, "Sheoga Hardwood");
  const hand = requestFrom({ ...base, product: { id: "p2", type: "tile", sku: "X1", bookId: "gone" } });
  assert.equal(hand.bookName, "Other / hand-entered");
  assert.equal(hand.item.name, "X1");
  assert.equal(requestFrom({ ...base, product: { id: "p3", type: "vinyl" } }).item.name, "Vinyl");
  assert.equal(sheoga.areaName, "Area 1");
});

test("sampleGroups: groups by vendor in encounter order, Other last", () => {
  const rows = [
    req({ id: "r1", bookId: "b1", bookName: "Glazzio" }),
    req({ id: "r2", bookId: "", bookName: "Other / hand-entered", productId: "p2" }),
    req({ id: "r3", bookId: "b2", bookName: "GLATI stock", productId: "p3" }),
    req({ id: "r4", bookId: "b1", bookName: "Glazzio", productId: "p4" }),
  ];
  const gs = sampleGroups(rows);
  assert.deepEqual(gs.map((g) => g.name), ["Glazzio", "GLATI stock", "Other / hand-entered"]);
  assert.deepEqual(gs[0].rows.map((r) => r.id), ["r1", "r4"]);
  assert.equal(gs[0].bookId, "b1");
});

test("sampleCounts + custSampleTally", () => {
  const rows = [
    req({ id: "r1", status: "need" }),
    req({ id: "r2", status: "ordered", custId: "c2" }),
    req({ id: "r3", status: "ordered" }),
  ];
  assert.deepEqual(sampleCounts(rows), { need: 1, ordered: 2, total: 3 });
  const tally = custSampleTally(rows);
  assert.deepEqual(tally.get("c1"), { need: 1, ordered: 1 });
  assert.deepEqual(tally.get("c2"), { need: 0, ordered: 1 });
  assert.deepEqual(sampleCounts([]), { need: 0, ordered: 0, total: 0 });
});

test("repEmail: item lines + ship-to, greeting by first name, NO salesperson info", () => {
  const rows = [req(), req({ id: "r2", item: { name: "Hand entered", sku: "", size: "", type: "tile" } })];
  const { subject, body } = repEmail({ rows, custName: "Kathy Marsh", address: "214 Old Mill Rd", phone: "(555) 210-0114", repName: "Jeff Krejci" });
  assert.equal(subject, "Sample request — Kathy Marsh");
  assert.ok(body.startsWith("Hi Jeff,"));
  assert.ok(body.includes("- 12×24 Calacatta Gold — CM1224"));
  assert.ok(body.includes("- Hand entered"));
  assert.ok(body.includes("Ship to:\nKathy Marsh\n214 Old Mill Rd\n(555) 210-0114"));
  assert.ok(!/sales/i.test(body));
  const bare = repEmail({ rows, custName: "", address: "", phone: "", repName: "" });
  assert.ok(bare.body.startsWith("Hi,"));
});

test("mailtoHref encodes subject and body", () => {
  const href = mailtoHref("rep@vendor.com", "Sample request — K & M", "line one\nline two");
  assert.ok(href.startsWith("mailto:rep%40vendor.com?subject=Sample%20request%20%E2%80%94%20K%20%26%20M&body=line%20one%0Aline%20two"));
});

test("status vocabulary is exactly two states, each labeled", () => {
  assert.deepEqual(SAMPLE_STATUSES, ["need", "ordered"]);
  for (const s of SAMPLE_STATUSES) assert.ok(SAMPLE_LABEL[s]);
});
```

- [ ] **Step 2: Run tests to verify they fail** — `node --test src/samples.test.js` — expected FAIL (`normSampleRequest` is not exported by v1).

- [ ] **Step 3: Rewrite `src/samples.js`:**

```js
// Sample-ordering pure logic (spec 2026-08-28): request rows are the ONE
// source — shared sample_requests rows (snapshot + live ids, the claude-issues
// doctrine), never a field on the product row. This file owns the request
// shape, the vendor grouping the panel and browser read, and the rep email.
// Split from samples.jsx so `node --test` can cover it.

import { areaLabel, uid } from "./model.js";
import { TLBL } from "./uiconst.js";

export const SAMPLE_STATUSES = ["need", "ordered"];
export const SAMPLE_LABEL = { need: "To order", ordered: "Ordered" };

// Status colors, shared by the panel chips, the grid's row indicator, and the
// browser column: amber = on you (order it), moss = in flight/done. Inline
// hexes like the order panel's ASSUMED palette — the theme's amber utilities
// don't all render in this build.
export const SAMPLE_COLOR = { need: "#b45309", ordered: "var(--ft-brand)" };
export const SAMPLE_CHIP = {
  need: { background: "#fef6e2", color: "#b45309", borderColor: "#f0c96f" },
  ordered: { background: "var(--ft-brand)", color: "#fff", borderColor: "var(--ft-brand)" },
};

const OTHER = "Other / hand-entered";
const str = (v) => (typeof v === "string" ? v : "");

export const normSampleRequest = (r) => {
  if (!r || typeof r !== "object" || !r.id) return null;
  return {
    id: r.id,
    status: SAMPLE_STATUSES.includes(r.status) ? r.status : "need",
    createdBy: str(r.createdBy), createdAt: r.createdAt || null,
    orderedBy: str(r.orderedBy), orderedAt: r.orderedAt || null,
    custId: str(r.custId), custName: str(r.custName),
    areaName: str(r.areaName), productId: str(r.productId),
    bookId: str(r.bookId), bookName: str(r.bookName) || OTHER,
    item: {
      name: str(r.item?.name), sku: str(r.item?.sku),
      size: str(r.item?.size), type: str(r.item?.type),
    },
  };
};

// A new request: the line frozen at request time. Vendor resolves once, here —
// the book's brand label over its name, Sheoga-configurator lines under
// Sheoga, everything else (hand rows, wedi's table-based lines) under Other.
export const requestFrom = ({ project, custName, area, areaIndex, product: p, books = [], by = "" }) => {
  const book = p.bookId ? books.find((b) => b.id === p.bookId) : null;
  const bookName = book ? ((book.data?.brandLabel || "").trim() || book.name || "Price book")
    : p.sheoga ? "Sheoga Hardwood" : OTHER;
  return normSampleRequest({
    id: uid(), status: "need", createdBy: by, createdAt: Date.now(),
    custId: project.id, custName: custName || project.name || "",
    areaName: areaLabel(area, areaIndex), productId: p.id,
    bookId: book ? book.id : "", bookName,
    item: {
      name: (p.brandColor || "").trim() || p.sku || TLBL[p.type] || "This line",
      sku: p.sku || "",
      size: p.sizeText || (p.L && p.W ? `${p.L}×${p.W}` : ""),
      type: p.type || "",
    },
  });
};

// Vendor groups in encounter order, Other always last — a sample order is
// placed per vendor, so that's the unit the panel and the email work in.
export const sampleGroups = (requests) => {
  const groups = new Map();
  for (const r of requests || []) {
    const key = r.bookId || r.bookName;
    if (!groups.has(key)) groups.set(key, { key, bookId: r.bookId, name: r.bookName, rows: [] });
    groups.get(key).rows.push(r);
  }
  const out = [...groups.values()];
  const oi = out.findIndex((g) => g.name === OTHER);
  if (oi >= 0) out.push(out.splice(oi, 1)[0]);
  return out;
};

export const sampleCounts = (requests) => {
  const c = { need: 0, ordered: 0, total: 0 };
  for (const r of requests || []) { c[r.status]++; c.total++; }
  return c;
};

// Per-project roll-up for the customer browser's samples column/filter.
export const custSampleTally = (requests) => {
  const m = new Map();
  for (const r of requests || []) {
    const t = m.get(r.custId) || { need: 0, ordered: 0 };
    t[r.status]++;
    m.set(r.custId, t);
  }
  return m;
};

// The rep email. Ship-to is the CUSTOMER (samples ship direct — owner call),
// read live from the project by the caller. No salesperson info (owner call
// 2026-08-28).
export const repEmail = ({ rows, custName, address, phone, repName }) => {
  const items = rows.map((r) =>
    "- " + [r.item.size, r.item.name].filter(Boolean).join(" ") + (r.item.sku ? ` — ${r.item.sku}` : ""));
  const ship = [custName, address, phone].filter(Boolean);
  const body = [
    repName ? `Hi ${repName.trim().split(/\s+/)[0]},` : "Hi,",
    "", "Could you send samples of the following?", "",
    ...items,
    "", "Ship to:", ...ship,
    "", "Thank you",
  ].join("\n");
  return { subject: `Sample request — ${custName || "our customer"}`, body };
};

export const mailtoHref = (email, subject, body) =>
  `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
```

- [ ] **Step 4: Run tests to verify they pass** — `node --test src/samples.test.js` — expected: all PASS. (`src/mobile.jsx` still imports `SAMPLE_LABEL, SAMPLE_CHIP` — both still exported, so nothing else breaks.)

- [ ] **Step 5: Commit**

```bash
git add src/samples.js src/samples.test.js
git commit -m "Rework samples.js to the request-row model: snapshot builder, vendor groups, rep email"
```

---

### Task 3: `loadSampleRequests` (bootload) + `useSamples` hook

**Files:**
- Modify: `src/bootload.js` (add loader after `loadClaudeIssues`, ~line 121)
- Modify: `src/bootload.test.js` (one loader test)
- Create: `src/usesamples.js`

**Interfaces:**
- Consumes: `normSampleRequest` from `./samples.js` (Task 2).
- Produces:
  - `loadSampleRequests(db) -> Promise<req[]>` (newest first)
  - `useSamples({ user, profile, ping, flashSaved })` returning `{ sampleRequests, hydrateSampleRequests, refreshSampleRequests, addSampleRequest(req), delSampleRequest(id), setSampleOrdered(ids, ordered) }`

- [ ] **Step 1: Write the failing loader test** in `src/bootload.test.js` (uses the file's existing `fakeDb`; add `loadSampleRequests` to the import at the top):

```js
test("loadSampleRequests maps and normalizes rows", async () => {
  const rows = await loadSampleRequests(fakeDb({ sample_requests: [
    { id: "r1", data: { status: "ordered", custId: "c1", item: { name: "Calacatta", sku: "CM1224" } } },
    { id: "r2", data: { status: "bogus" } },
  ] }));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].status, "ordered");
  assert.equal(rows[0].item.sku, "CM1224");
  assert.equal(rows[1].status, "need");
});
```

- [ ] **Step 2: Run** `node --test src/bootload.test.js` — expected FAIL (`loadSampleRequests` not exported).

- [ ] **Step 3: Add the loader** to `src/bootload.js` after `loadClaudeIssues` (import `normSampleRequest` from `./samples.js` beside the existing `normClaudeIssue` import):

```js
// Sample requests (spec 2026-08-28) — newest first; bounded like todos.
export const loadSampleRequests = async (db) => {
  const { data: rows, error } = await db.from("sample_requests").select("id, data").order("created_at", { ascending: false });
  if (error) throw error;
  return (rows || []).map((r) => normSampleRequest({ id: r.id, ...(r.data || {}) })).filter(Boolean);
};
```

- [ ] **Step 4: Run** `node --test src/bootload.test.js` — expected PASS.

- [ ] **Step 5: Create `src/usesamples.js`** (the ONE write path; shaped like useclaudeissues.js):

```js
import { useState } from "react";
import { supabase } from "./lib/supabase.js";
import { loadSampleRequests } from "./bootload.js";

// Sample-request state + write paths (spec 2026-08-28). Shaped like
// useClaudeIssues: shared rows, optimistic local update, one write per action.
// setSampleOrdered takes an ID LIST so "Mark all ordered" is one upsert, not a
// write per row.
export function useSamples({ user, profile, ping, flashSaved }) {
  const [sampleRequests, setSampleRequests] = useState([]);

  const reqData = ({ id, ...rest }) => rest;
  const refreshSampleRequests = () => { loadSampleRequests(supabase).then(setSampleRequests).catch(() => { }); };

  const addSampleRequest = (req) => {
    setSampleRequests((prev) => [req, ...prev]);
    (async () => { try { const { error } = await supabase.from("sample_requests").insert({ id: req.id, data: reqData(req) }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — run supabase/samples.sql?"); } })();
  };
  const delSampleRequest = (id) => {
    setSampleRequests((prev) => prev.filter((r) => r.id !== id));
    (async () => { try { const { error } = await supabase.from("sample_requests").delete().eq("id", id); if (error) throw error; } catch (e) { ping("Delete failed"); } })();
  };
  const setSampleOrdered = (ids, ordered) => {
    const set = new Set(ids);
    const stamp = ordered
      ? { status: "ordered", orderedBy: profile.name || user.email || "", orderedAt: Date.now() }
      : { status: "need", orderedBy: "", orderedAt: null };
    const next = sampleRequests.map((r) => set.has(r.id) ? { ...r, ...stamp } : r);
    setSampleRequests(next);
    const rows = next.filter((r) => set.has(r.id)).map((r) => ({ id: r.id, data: reqData(r) }));
    (async () => { try { const { error } = await supabase.from("sample_requests").upsert(rows, { onConflict: "id" }); if (error) throw error; flashSaved(); } catch (e) { ping("Save failed — check connection"); } })();
  };

  return {
    sampleRequests, hydrateSampleRequests: setSampleRequests, refreshSampleRequests,
    addSampleRequest, delSampleRequest, setSampleOrdered,
  };
}
```

- [ ] **Step 6: Sanity-parse** — `npx esbuild --loader:.jsx=jsx --jsx=automatic src/usesamples.js --outfile=/dev/null` and `node --test src/*.test.js` — expected: parse OK, suite green.

- [ ] **Step 7: Commit**

```bash
git add src/bootload.js src/bootload.test.js src/usesamples.js
git commit -m "Add sample_requests loader + useSamples write-path hook"
```

---

### Task 4: Remove the v1 `product.sample` field from the model

**Files:**
- Modify: `src/model.js` (delete `SAMPLE_STATUSES`/`normSample` and the `sample:` field in `normP`)
- Modify: `src/model.test.js` (delete the v1 sample test)

**Interfaces:**
- Consumes: nothing.
- Produces: `normP` output no longer contains `sample` (the table is the one source). `model.js` no longer exports `SAMPLE_STATUSES`/`normSample` — nothing may import them from there (Task 2 already made `samples.js` self-contained; verify with the grep in Step 3).

- [ ] **Step 1: Delete from `src/model.js`:** the block starting `// A sample request on a product line:` through the `normSample` const (added in v1 just above the `// thickness/joint use || not ??` comment), and in `normP` change `tierPrice: p.tierPrice ?? "", sample: normSample(p.sample), sheoga: …` back to `tierPrice: p.tierPrice ?? "", sheoga: …`.

- [ ] **Step 2: Delete from `src/model.test.js`:** the `test("normP normalizes the sample request and defaults it to null", …)` block.

- [ ] **Step 3: Verify nothing still reaches the removed names:**

Run: `grep -rn "normSample\b\|from \"./model.js\"" src/*.js src/*.jsx | grep -i sample`
Expected: only `samples.js` importing `areaLabel, uid` — no `normSample` hits outside `samples.js`'s own `normSampleRequest`.

- [ ] **Step 4: Run** `node --test src/model.test.js src/samples.test.js` — expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/model.js src/model.test.js
git commit -m "Drop the v1 product.sample field — sample_requests rows are the one source"
```

---

### Task 5: Rework the Samples panel + preview harness

**Files:**
- Modify: `src/samples.jsx` (full rewrite of the internals; same file)
- Modify: `src/samplespreview.jsx` (request-shaped mocks; add `?browser=1` later in Task 8)

**Interfaces:**
- Consumes: `sampleGroups, repEmail, mailtoHref, SAMPLE_LABEL, SAMPLE_CHIP, SAMPLE_COLOR, SAMPLE_STATUSES` (Task 2); `CopyBtn` from `./orderentry.jsx`.
- Produces: `SamplesPanel({ name, requests, custInfo, repFor, onOrdered, onRemove, onClose })` where:
  - `requests` = this project's request rows;
  - `custInfo` = `{ custName, address, phone }` (read live from the project by App);
  - `repFor(group) -> { name, email } | null` (App resolves `book.data.rep` by `group.bookId`);
  - `onOrdered(ids, ordered)` → `setSampleOrdered`; `onRemove(id)` → `delSampleRequest`.

- [ ] **Step 1: Rewrite `src/samples.jsx`:**

```jsx
// The Samples panel — this project's sample requests, grouped by vendor,
// ordered by EMAILING each vendor's rep (owner call: samples ship direct to
// the customer; the email body carries the item list + the customer ship-to
// and NO salesperson info). Presentation only: writes go back through
// onOrdered/onRemove into useSamples. Same right-dock shell as order entry.

import { X, Layers, Mail } from "lucide-react";
import { CopyBtn } from "./orderentry.jsx";
import { sampleGroups, repEmail, mailtoHref, SAMPLE_LABEL, SAMPLE_CHIP, SAMPLE_COLOR, SAMPLE_STATUSES } from "./samples.js";

const dateShort = (at) => (at ? new Date(at).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }) : "");

function StatusSeg({ status, onPick }) {
  return (
    <div className="flex rounded-md border border-slate-200 overflow-hidden shrink-0">
      {SAMPLE_STATUSES.map((s) => (
        <button key={s} onClick={() => onPick(s === "ordered")}
          className={"px-1.5 py-1 text-[10px] font-semibold border-r last:border-r-0 border-slate-200 " + (status === s ? "" : "text-slate-400 hover:bg-slate-50")}
          style={status === s ? SAMPLE_CHIP[s] : undefined}>
          {SAMPLE_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

function VendorGroup({ g, custInfo, rep, onOrdered, onRemove }) {
  const need = g.rows.filter((r) => r.status === "need");
  const mail = repEmail({ rows: g.rows, ...custInfo, repName: rep?.name || "" });
  return (
    <section>
      <div className="flex items-center justify-between mb-2 gap-2">
        <h4 className="ft-eyebrow text-[10px] tracking-[.12em] text-slate-500 truncate">{g.name} · {g.rows.length}</h4>
        <div className="flex items-center gap-2 shrink-0">
          {need.length > 0 && (
            <button onClick={() => onOrdered(need.map((r) => r.id), true)}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold border border-slate-200 hover:bg-slate-50"
              title="The order's placed — move every To-order line in this group to Ordered">
              Mark all ordered
            </button>
          )}
          {rep?.email ? (
            <a href={mailtoHref(rep.email, mail.subject, mail.body)}
              title={`Opens your mail program addressed to ${rep.email}:\n\n${mail.body}`}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-semibold bg-indigo-600 hover:bg-indigo-700 text-white">
              <Mail size={13} /> Email {rep.name ? rep.name.trim().split(/\s+/)[0] : "the rep"}
            </a>
          ) : (
            <CopyBtn text={mail.body} label="Copy email" />
          )}
        </div>
      </div>
      {!rep?.email && g.bookId && (
        <p className="text-[10.5px] text-slate-400 -mt-1 mb-1.5">No rep on file — add name &amp; email on this vendor's book page (Rep tab) to send with one click.</p>
      )}
      <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
        {g.rows.map((r, i) => (
          <div key={r.id} className="flex items-center gap-2.5 px-3 py-2" style={{ background: i % 2 === 1 ? "var(--ft-prod)" : "transparent" }}>
            <StatusSeg status={r.status} onPick={(ordered) => onOrdered([r.id], ordered)} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12.5px] leading-tight">
                {r.item.size && <span className="ft-mono text-slate-500">{r.item.size} </span>}
                <span className="font-bold">{r.item.name}</span>
              </div>
              <div className="truncate text-[11px] leading-tight text-slate-400">
                {r.item.sku && <span className="ft-mono font-semibold text-slate-500">{r.item.sku} · </span>}{r.areaName}
                {r.status === "ordered" && r.orderedAt && <span style={{ color: SAMPLE_COLOR.ordered }}> · ordered {dateShort(r.orderedAt)}{r.orderedBy ? ` · ${r.orderedBy}` : ""}</span>}
              </div>
            </div>
            <button onClick={() => onRemove(r.id)} title="Remove this sample request" className="shrink-0 text-slate-300 hover:text-red-500"><X size={14} /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SamplesPanel({ name, requests, custInfo, repFor, onOrdered, onRemove, onClose }) {
  const groups = sampleGroups(requests);
  return (
    <div className="print:hidden fixed inset-0 z-50 flex justify-end" style={{ background: "rgba(20,15,10,.4)" }} onClick={onClose}>
      <div className="flex flex-col bg-white border-l border-slate-200 shadow-2xl w-full lg:w-[560px] max-w-full h-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 shrink-0">
          <div className="min-w-0">
            <div className="ft-serif text-xl leading-tight flex items-center gap-2"><Layers size={17} className="text-slate-400" /> Samples</div>
            <div className="text-[12px] text-slate-400 truncate">{name}</div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 shrink-0"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {groups.length === 0 ? (
            <p className="text-[13px] text-slate-400 rounded-lg border border-dashed border-slate-200 px-3 py-3">
              No sample requests on this project yet. Mark a line from its ⋯ menu — <b>Request sample</b> — and it collects here, grouped by vendor and ready to email.
            </p>
          ) : (
            <>
              {groups.map((g) => <VendorGroup key={g.key} g={g} custInfo={custInfo} rep={repFor(g)} onOrdered={onOrdered} onRemove={onRemove} />)}
              <p className="text-[11px] text-slate-400">
                Samples ship straight to the customer — the email carries their name and the project address. After sending, <b>Mark all ordered</b>; statuses are shared, so the whole team sees what's in flight.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Rework `src/samplespreview.jsx`** to request-shaped, stateful mocks:

```jsx
// Preview harness for the Samples panel (spec 2026-08-28): the REAL
// SamplesPanel over request rows built through the REAL requestFrom/
// normSampleRequest — no Supabase, no App shell. Stateful, so status chips,
// Mark all ordered, the mailto button and remove all exercise the App
// contract (onOrdered takes an ID LIST). Dev-only entry (samples-preview.html).
// ?empty=1 shows the empty state; ?browser=1 mounts the customer browser with
// the samples column + filter instead (Task 8).
import { useState } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import { SamplesPanel } from "./samples.jsx";
import { requestFrom } from "./samples.js";
import { normA } from "./model.js";

const BOOKS = [
  { id: "bkGlz", kind: "order", name: "Glazzio EFT", data: { brandLabel: "Glazzio", rep: { name: "Jeff Krejci", email: "jeff@glazzio.example" } } },
  { id: "bkGlati", kind: "stock", name: "GLATI stock", data: {} },
];
const PROJECT = { id: "c1", name: "Marsh — whole first floor", address: "214 Old Mill Rd, Chagrin Falls", phone: "(555) 210-0114" };
const area = (id, name) => normA({ id, name, products: [{}] });
const mk = (a, p, over = {}) => ({ ...requestFrom({ project: PROJECT, custName: "Kathy Marsh", area: a, areaIndex: 0, product: p, books: BOOKS, by: "Dana" }), ...over });

const kitchen = area("a1", "Kitchen"), bath = area("a2", "Master bath");
const SEED = [
  mk(kitchen, { id: "p1", type: "tile", bookId: "bkGlz", sku: "KES6301", brandColor: "Kessel Collection Ovo Glossy", L: "3", W: "12" }),
  mk(kitchen, { id: "p2", type: "tile", bookId: "bkGlz", sku: "CLNL289", brandColor: "Colonial Long Hex Village Square", sizeText: "12x12 sheet" }, { status: "ordered", orderedBy: "Marcus", orderedAt: Date.now() - 4 * 86400000 }),
  mk(kitchen, { id: "p3", type: "tile", bookId: "bkGlati", sku: "05153", brandColor: "Hanoi White Matte", L: "12", W: "24" }),
  mk(bath, { id: "p4", type: "hardwood", brandColor: "White Oak 5\" Character", sheoga: { mode: "floor", cfg: {} } }),
  mk(bath, { id: "p5", type: "vinyl", sku: "STIPEHW1212PEBF", brandColor: "Uptown Pebbles Harmony Warm Blend", sizeText: "12x12" }),
];

function Harness() {
  const empty = new URLSearchParams(location.search).has("empty");
  const [reqs, setReqs] = useState(empty ? [] : SEED);
  return (
    <SamplesPanel name={PROJECT.name} requests={reqs}
      custInfo={{ custName: "Kathy Marsh", address: PROJECT.address, phone: PROJECT.phone }}
      repFor={(g) => BOOKS.find((b) => b.id === g.bookId)?.data?.rep || null}
      onOrdered={(ids, ordered) => setReqs((prev) => prev.map((r) => ids.includes(r.id) ? { ...r, status: ordered ? "ordered" : "need", orderedBy: ordered ? "Dana" : "", orderedAt: ordered ? Date.now() : null } : r))}
      onRemove={(id) => setReqs((prev) => prev.filter((r) => r.id !== id))}
      onClose={() => {}} />
  );
}
createRoot(document.getElementById("preview")).render(<Harness />);
```

- [ ] **Step 3: Verify in the dev server** — `PORT=5199 npx vite` in background, then load `http://localhost:5199/samples-preview.html` with Playwright (`/opt/pw-browsers/chromium`), confirm zero `pageerror`s, the Glazzio group shows the **Email Jeff** button, GLATI/Sheoga/Other groups show **Copy email**.

- [ ] **Step 4: Run the full suite** — `node --test src/*.test.js` — expected PASS.

- [ ] **Step 5: Commit**

```bash
git add src/samples.jsx src/samplespreview.jsx
git commit -m "Rework the Samples panel to request rows with per-vendor rep emails"
```

---

### Task 6: Rep contact on the book page

**Files:**
- Modify: `src/pricebooklib.jsx` (the folder-tab strip, ~lines 1098–1128, and a new `RepCard` beside `BrandCard` ~line 1580)

**Interfaces:**
- Consumes: `updateBook(book.id, { dataPatch: { rep } })` (existing useBooks write path — dataPatch merges into `book.data`).
- Produces: `book.data.rep = { name, email }`, which App reads in Task 7's `repFor`.

- [ ] **Step 1: Add the Rep tab.** In the tab strip (after the Brand tab line), add a tab shown for EVERY book kind (stock vendors have reps too — the one config tab stock books gain):

```jsx
<BookTab label="Rep" summary={repSummary} active={tab === "rep"} onClick={() => setTab(tab === "rep" ? null : "rep")} />
```

with, beside the other summary consts (~line 1061):

```jsx
const rep = book.data?.rep || {};
const repSummary = (rep.name || "").trim() || (rep.email || "").trim() || "none";
```

and in the drawer body (after the `tab === "brand"` block):

```jsx
{tab === "rep" && (
  <RepCard book={book} onSave={(v) => updateBook(book.id, { dataPatch: { rep: v } })} inp={inp} lbl={lbl} />
)}
```

- [ ] **Step 2: Add `RepCard`** next to `BrandCard` (same local-draft-then-save idiom):

```jsx
// The vendor's sample-order contact (spec 2026-08-28): who the Samples
// panel's "Email the rep" addresses. Read live at email time, never
// snapshotted into requests, so a rep change applies to every open request.
export function RepCard({ book, onSave, inp, lbl }) {   // exported for the preview harness
  const saved = book.data?.rep || {};
  const [name, setName] = useState(saved.name || "");
  const [email, setEmail] = useState(saved.email || "");
  const dirty = name.trim() !== (saved.name || "") || email.trim() !== (saved.email || "");
  return (
    <div className="pt-3 max-w-md">
      <div className="grid grid-cols-2 gap-3">
        <div><label className={lbl}>Rep name</label><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jeff Krejci" className={inp} /></div>
        <div><label className={lbl}>Rep email</label><input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="rep@vendor.com" className={inp} /></div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <button disabled={!dirty} onClick={() => onSave({ name: name.trim(), email: email.trim() })}
          className="rounded-md bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1 text-xs font-semibold disabled:opacity-40">Save</button>
        <span className="text-[11px] text-slate-400">The Samples panel's "Email the rep" addresses this contact — samples ship to the customer, so this is just who gets the request.</span>
      </div>
    </div>
  );
}
```

(`useState` is already imported in this file.)

- [ ] **Step 3: Verify** — `npx esbuild --loader:.jsx=jsx --jsx=automatic src/pricebooklib.jsx --outfile=/dev/null` parses; load `http://localhost:5199/header-preview.html` (its book page mounts the real detail) with Playwright, open a book, confirm the Rep tab renders on both a stock and an order book with zero pageerrors.

- [ ] **Step 4: Commit**

```bash
git add src/pricebooklib.jsx
git commit -m "Add the Rep tab to the book page — the sample email's contact"
```

---

### Task 7: Re-wire App.jsx to the request rows

**Files:**
- Modify: `src/App.jsx` (all v1 sample wiring)

**Interfaces:**
- Consumes: `useSamples` (Task 3), `requestFrom, sampleCounts, custSampleTally, SAMPLE_LABEL, SAMPLE_COLOR` (Task 2), `SamplesPanel` (Task 5).
- Produces: `sampleTally` prop for CustomerBrowser (Task 8 consumes `Map<custId, {need, ordered}>`).

- [ ] **Step 1: Swap the imports.** Replace the v1 lines

```js
import { SamplesPanel } from "./samples.jsx";
import { sampleGroups, sampleCounts, SAMPLE_LABEL, SAMPLE_COLOR } from "./samples.js";
```

with

```js
import { SamplesPanel } from "./samples.jsx";
import { requestFrom, sampleCounts, custSampleTally, SAMPLE_LABEL, SAMPLE_COLOR } from "./samples.js";
import { useSamples } from "./usesamples.js";
import { loadSampleRequests } from "./bootload.js";
```

(`loadSampleRequests` joins the existing bootload import line instead of a new one.)

- [ ] **Step 2: Mount the hook** beside `useClaudeIssues` (~line 560):

```js
const { sampleRequests, hydrateSampleRequests, refreshSampleRequests, addSampleRequest, delSampleRequest, setSampleOrdered } = useSamples({ user, profile, ping, flashSaved });
```

- [ ] **Step 3: Stage-2 load.** In the `Promise.allSettled` block (~line 431), add after the claude line:

```js
trace.span("samples", () => loadSampleRequests(supabase)).then(hydrateSampleRequests, () => { }),
```

- [ ] **Step 4: Project-scoped derivations.** Near the other `sel`-derived memos, add:

```js
// This project's sample requests + a productId lookup for the row icons.
const projSamples = useMemo(() => sampleRequests.filter((r) => r.custId === selId), [sampleRequests, selId]);
const sampleByProduct = useMemo(() => new Map(projSamples.map((r) => [r.productId, r])), [projSamples]);
```

- [ ] **Step 5: One shared toggle** (used by the line menu and the mobile sheet) beside `duplicateProduct`:

```js
// Request/unrequest a sample for a line — the ONE add/remove entry
// (usesamples.js owns the writes). Toggling off an ordered request is the
// user saying "never mind"; the row simply leaves the log.
const toggleSample = (a, ai, p) => {
  const existing = sampleByProduct.get(p.id);
  if (existing) { delSampleRequest(existing.id); ping("Sample request removed"); return; }
  const custName = data.people.find((c) => c.id === sel.customerId)?.name || sel.name || "";
  addSampleRequest(requestFrom({ project: sel, custName, area: a, areaIndex: ai, product: p, books, by: profile.name || user.email || "" }));
  ping("Sample requested — see Samples in the header");
};
```

- [ ] **Step 6: Re-point the v1 call sites.**
  - Line-menu mount: replace the v1 `sampleOn={!!p.sample}` / `onSample={…updProduct…}` pair with `sampleOn={sampleByProduct.has(p.id)}` and `onSample={() => toggleSample(a, ai, p)}`.
  - MobileRowSheet mount: replace the v1 `onSample={…updProduct…}` with `onSample={() => toggleSample(a, ai, p)}` — and in `src/mobile.jsx` change the button's two `p.sample` reads to a new `sample` prop (`sample={sampleByProduct.get(p.id) || null}` passed from App; `{ sample }` added to MobileRowSheet's props) since the row no longer carries the field.
  - Row icon (row-end action cell): replace the v1 `p.sample &&` block with:

```jsx
{(() => { const sr = sampleByProduct.get(p.id); return sr && (
  <button tabIndex={-1} onClick={() => setShowSamples(true)}
    title={`Sample — ${SAMPLE_LABEL[sr.status]}${sr.status === "ordered" && sr.orderedAt ? " " + new Date(sr.orderedAt).toLocaleDateString(undefined, { month: "numeric", day: "numeric" }) : ""}. Click for the Samples panel.`}
    className="p-0.5" style={{ color: SAMPLE_COLOR[sr.status] }}><Layers size={11} /></button>
); })()}
```

  - Header props bag: replace `samples: sampleCounts(sel.categories)` with `samples: sampleCounts(projSamples)` (the header badge reads `.need` — update `projectheader.jsx`'s two badge conditions from `samples?.open > 0` to `samples?.need > 0` and the count shown from `samples.open` to `samples.need`; the amber/moss fork collapses to always-amber since the badge now only counts To order).
  - `duplicateProduct`: remove the v1 `sample: null` and its comment (the copy is a different productId — no request follows it; nothing to strip).
  - Panel mount: replace the v1 `<SamplesPanel name={sel.name} groups={sampleGroups(sel.categories, books)} onSet={setSamples} …/>` block with:

```jsx
{showSamples && sel && sel._full && (
  <SamplesPanel name={sel.name} requests={projSamples}
    custInfo={{ custName: data.people.find((c) => c.id === sel.customerId)?.name || sel.name || "", address: sel.address || "", phone: sel.phone || "" }}
    repFor={(g) => books.find((b) => b.id === g.bookId)?.data?.rep || null}
    onOrdered={setSampleOrdered} onRemove={delSampleRequest}
    onClose={() => setShowSamples(false)} />
)}
```

  - Delete the v1 `setSamples` batch helper entirely (the hook replaced it). Opening the panel should also refresh: change the header's `onOpenSamples` to `() => { setShowSamples(true); refreshSampleRequests(); }`.

- [ ] **Step 7: Verify** — `node --test src/*.test.js` green; `npx esbuild --loader:.jsx=jsx --jsx=automatic src/App.jsx --outfile=/dev/null` and `src/mobile.jsx` parse; Playwright-load `http://localhost:5199/` (Supabase config screen renders, zero pageerrors — proves the whole module graph).

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx src/mobile.jsx src/projectheader.jsx
git commit -m "Re-wire the sample surfaces to request rows through useSamples"
```

---

### Task 8: Customer browser — samples column + filter

**Files:**
- Modify: `src/custbrowser.js` (pure helpers) and `src/custbrowser.test.js`
- Modify: `src/CustomerBrowser.jsx` (column, filter button, project-line counts)
- Modify: `src/App.jsx:2624` area (pass `sampleTally`)
- Modify: `src/samplespreview.jsx` (the `?browser=1` view for preview proof)

**Interfaces:**
- Consumes: `custSampleTally` output (Task 2's `Map<custId, { need, ordered }>`).
- Produces: `custSamples(tally, projs) -> { need, ordered }` and `filterBySamples(rows, tally) -> rows` in custbrowser.js; CustomerBrowser prop `sampleTally` (defaults to an empty Map).

- [ ] **Step 1: Write failing tests** in `src/custbrowser.test.js`:

```js
test("custSamples sums a customer's project tallies; filterBySamples keeps open-request customers", () => {
  const tally = new Map([["j1", { need: 2, ordered: 1 }], ["j2", { need: 0, ordered: 3 }]]);
  assert.deepEqual(custSamples(tally, [{ id: "j1" }, { id: "j2" }, { id: "j3" }]), { need: 2, ordered: 4 });
  assert.deepEqual(custSamples(tally, [{ id: "j3" }]), { need: 0, ordered: 0 });
  const rows = [
    { id: "c1", projs: [{ id: "j1" }] },          // open requests
    { id: "c2", projs: [{ id: "j2" }] },          // ordered only
    { id: "c3", projs: [{ id: "j3" }] },          // none
  ];
  assert.deepEqual(filterBySamples(rows, tally).map((r) => r.id), ["c1"]);
});
```

(add `custSamples, filterBySamples` to the file's import from `./custbrowser.js`.)

- [ ] **Step 2: Run** `node --test src/custbrowser.test.js` — expected FAIL.

- [ ] **Step 3: Implement in `src/custbrowser.js`** (after `filterBySales`), and add `"samples"` to `BROWSER_COLS` between `"jobs"` and `"created"` (`normColOrder` auto-appends it for users with a saved order):

```js
// Samples roll-up for the browser (spec 2026-08-28): tally is
// custSampleTally's Map keyed by project id. The filter keeps customers with
// OPEN (to-order) requests — one press answers "what still needs ordering";
// the column shows both counts so the ordered log reads at a glance.
export const custSamples = (tally, projs = []) => {
  const out = { need: 0, ordered: 0 };
  for (const p of projs) { const t = tally.get(p.id); if (t) { out.need += t.need; out.ordered += t.ordered; } }
  return out;
};
export const filterBySamples = (rows, tally) =>
  rows.filter((r) => custSamples(tally, r.projs).need > 0);
```

- [ ] **Step 4: Run** `node --test src/custbrowser.test.js` — expected PASS.

- [ ] **Step 5: Wire the UI in `src/CustomerBrowser.jsx`:**
  - Props: add `sampleTally = new Map()` to the destructured props; import `custSamples, filterBySamples` from `./custbrowser.js` and `Layers` from lucide.
  - State: `const [samplesOnly, setSamplesOnly] = useState(false);`
  - Narrow the grid: change the `shown` memo to `sortRows(filterBySales(filterRows(samplesOnly ? filterBySamples(rows, sampleTally) : rows, q), salesQ), sortKey)` (dep list gains `samplesOnly, sampleTally`). Narrow the strips the same way: after the `quick`/`drafts` memos, `const quickShown = samplesOnly ? quick.filter((p) => (sampleTally.get(p.id)?.need || 0) > 0) : quick;` (same for `draftsShown`) and render those.
  - Shared count chips (used by the column, the strips, and the lines panel):

```jsx
const sampleChips = (t) => (t.need || t.ordered) ? (
  <span className="inline-flex items-center gap-1 whitespace-nowrap">
    {t.need > 0 && <span className="text-[10px] font-semibold rounded-full px-1.5 leading-4" style={{ background: "#fef6e2", color: "#b45309" }}>{t.need} to order</span>}
    {t.ordered > 0 && <span className="text-[10px] font-semibold rounded-full px-1.5 leading-4" style={{ background: "var(--ft-brand-soft)", color: "var(--ft-brand-deep)" }}>{t.ordered} ordered</span>}
  </span>
) : null;
```

  - Column: `HEAD.samples = { label: "Samples" }` and

```jsx
samples: (r) => <td key="samples" className={td}>{sampleChips(custSamples(sampleTally, r.projs))}</td>,
```

  - Filter button, rendered beside the salesperson box (before the Estimates & drafts toggle):

```jsx
<button onClick={() => setSamplesOnly((s) => !s)}
  title={samplesOnly ? "Show every customer" : "Only customers with samples still to order"}
  className={`h-[26px] flex items-center gap-1 rounded-md border px-2 text-xs font-semibold shrink-0 ${samplesOnly ? "ft-seg-on border-slate-200" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
  <Layers size={13} /> Samples
</button>
```

  - Project-lines panel + unfiled rows: inside each project `<button>` row, after the salesperson span, add `{sampleChips(sampleTally.get(p.id) || { need: 0, ordered: 0 })}`.

- [ ] **Step 6: Pass the tally from App** (~line 2624): add `sampleTally={custSampleTally(sampleRequests)}` to the `<CustomerBrowser …>` mount, and refresh on open — where the browser is opened (`setShowBrowser(true)` handler, grep `CustomerBrowser` usages), also call `refreshSampleRequests()`.

- [ ] **Step 7: Extend the preview harness** (`src/samplespreview.jsx`): when `?browser=1`, render the REAL CustomerBrowser instead of the panel, with mock people/projects/builders + `sampleTally` built via `custSampleTally(SEED)` (import from `./samples.js`; use `people = [{ id: "k1", name: "Kathy Marsh" }]`, `projects = [{ id: "c1", customerId: "k1", name: "Marsh — whole first floor", quick: false, createdAt: Date.now(), updatedAt: Date.now(), salesperson: { name: "Dana" } }, { id: "c9", customerId: "k1", name: "Marsh — basement", quick: false, createdAt: Date.now(), updatedAt: Date.now() }]`, `builders = []`, no-op handlers, `initialCols` unset).

- [ ] **Step 8: Verify** — full `node --test src/*.test.js` green; Playwright-load `samples-preview.html?browser=1`: the grid shows the Samples column chips and the Samples filter button; toggling the filter keeps Kathy (open requests) and an added sample-less mock customer disappears.

- [ ] **Step 9: Commit**

```bash
git add src/custbrowser.js src/custbrowser.test.js src/CustomerBrowser.jsx src/App.jsx src/samplespreview.jsx
git commit -m "Add the samples column + filter to the customer browser"
```

---

### Task 9: Docs, preview proof, final verification, push

**Files:**
- Modify: `src/CLAUDE.md` (file-map entries for samples.js/samples.jsx/usesamples.js/samplespreview.jsx; touch the custbrowser/CustomerBrowser/linemenu/pricebooklib entries)
- Modify: `.scratch/115_sample-ordering/ticket.md` (describe the reworked design; keep `status: done`)
- Screenshots into `.scratch/115_sample-ordering/`

- [ ] **Step 1: Update `src/CLAUDE.md`.** Rewrite the three v1 sample entries to the request-row design (one source: `sample_requests` rows; requestFrom snapshot; repEmail/mailto; useSamples write paths; panel contract onOrdered(ids, ordered)) and add a `usesamples.js` entry beside `useclaudeissues.js`. Append one line each to the `custbrowser.js` / `CustomerBrowser.jsx` entries (samples column + filter, `sampleTally` prop) and the `pricebooklib.jsx` entry (Rep tab). Keep the `linemenu.jsx` entry's Request-sample note, dropping any "product.sample" wording.

- [ ] **Step 2: Update the ticket** — replace the v1 "What shipped" list with the reworked design (table + hook, panel + rep email, browser column/filter, SQL file pending the owner's run), note the spec + plan paths.

- [ ] **Step 3: Full verification** — `node --test src/*.test.js` (all green); Playwright-load `/`, `samples-preview.html`, `samples-preview.html?browser=1`, `header-preview.html`, `claude-issues-preview.html` — zero pageerrors on each.

- [ ] **Step 4: Preview proof** — Playwright screenshots: (a) the panel with the Email-rep button and mixed statuses, (b) the panel after "Mark all ordered", (c) the browser with the samples column + filter on, (d) the book page's Rep tab, (e) the line menu. Save to `.scratch/115_sample-ordering/` (replacing the v1 shots) and send to the owner with SendUserFile.

- [ ] **Step 5: Commit and push**

```bash
git add -A
git commit -m "Document the reworked sample-ordering feature + refresh preview proof"
git push -u origin claude/sample-ordering-workflow-fvsdzp
```

---

## Self-Review Notes

- **Spec coverage:** §1 table → Task 1; loading/write paths → Task 3; §3 project surfaces → Tasks 5+7; §4 rep email → Tasks 2+5+6; §5 browser → Task 8; §6 v1 rework map → Tasks 2 (samples.js), 4 (model), 5 (panel/harness), 7 (App wiring); §7 testing/preview → per-task steps + Task 9.
- **Type consistency:** `req` shape defined once (Task 2 `normSampleRequest`) and consumed verbatim by Tasks 3/5/7/8; `setSampleOrdered(ids, ordered)` matches the panel's `onOrdered(ids, ordered)`; `custSampleTally` Map feeds both `custSamples` and the browser prop.
- The v1 `SAMPLE_CHIP` keeps its `need`/`ordered` keys so `mobile.jsx`'s import keeps working through Tasks 2→7 (its `in` key simply disappears; mobile's `p.sample` read is re-pointed in Task 7).
