# Boot & Data Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make app load time flat as data and features grow — first paint after one parallel round trip, unbounded datasets never eagerly loaded, and the boot bundle no longer growing with every feature — with the loading policy recorded as an ADR so future work stays on it.

**Architecture:** A **two-stage boot** (stage 1: only what the first screen draws, in one parallel round trip → paint; stage 2: bounded shared caches in the background; everything unbounded stays on-demand), the boot loaders extracted into a small injected-client module so they are unit-testable and stop accreting inside `App.jsx`, and the two heavy secondary surfaces (`SheogaConfigurator`, `AppsWorkspace`) split into lazy chunks so feature work stops inflating the first-paint download.

**Tech Stack:** Existing only — React 18, Vite 5, `@supabase/supabase-js`, `node --test`. **No new dependencies, no schema changes, no SQL to run.**

## Global Constraints

Copied from `CLAUDE.md` (non-negotiables) and the ADRs this plan must not contradict:

- **Never mutate the live Supabase project** — this plan requires **zero SQL and zero data writes**; every task is client code + docs. (`npm run dev` talks to the live project: reads are normal app usage, but never write data while proving changes.)
- **Never push straight to `main`** — each task below lands as its own PR.
- **No UI or print change merges without preview proof** — Tasks 3 and 4 list their required proof artifact.
- **Snapshot doctrine (ADR 0003 / ADR 0009):** nothing may start reading price books at calc time; all changes here affect *when* caches load, never what a saved selection computes from.
- **Normalization invariant:** new persisted fields need `normC`/`normA`/`normP`/`mergeSettings` defaults — this plan adds **no** persisted fields.
- **`fetchAllRows`** for any select that can exceed PostgREST's 1000-row page (`src/fetchall.js`).
- **`stock_items` reads keep `select("*")`** — a named select of the `disabled` column errors on installs that haven't run `pricebook-disabled.sql` (comment at `src/App.jsx:2120`).
- **Sanctioned write paths stay as documented in CLAUDE.md** — this plan moves *read* paths only; every write path stays in `App.jsx` untouched.
- **Tests:** `npm test` runs `node --test src/*.test.js` — new modules and their tests go **flat in `src/`** (a subdirectory would silently fall outside the glob).

---

## Part 1 — Diagnosis (why it gets slower)

Verified against the code on 2026-07-20 (line numbers from current `main`):

**1. The boot waterfall.** One mount effect (`src/App.jsx:1982-2035`) runs ~7 serial awaits before `setLoading(false)` at line 2032:

```
app_data (:1987) → shared_settings (:1997) → [projects ∥ people ∥ builders] (:2007)
  → stock_items, full table (:2021) → todos (:2024) → labels (:2027) → price_books (:2030)
```

Only the middle trio is parallel. On a ~100–200 ms round trip, that is 0.7–1.5 s of pure latency before any data size is counted — and the loading screen holds until **all** of it lands, though the first screen (project list + sidebar) needs none of stock/todos/labels/books.

**2. Unbounded data loaded eagerly.** `loadStock` (`src/App.jsx:2119-2125`) pages the **entire** `stock_items` table (`select("*")`, full `data` jsonb per row) through `fetchAllRows`. Imports upsert and never delete (ADR 0003 §3) — retired SKUs stay as `active=false` rows forever — so this download grows monotonically with every import ever run. `labels` (`:2027`) is a second, smaller instance — and it is *redundant*: `openApps` (`src/App.jsx:3104`) re-fetches labels every time the Apps hub opens.

**3. The bundle grows with every feature.** One ~970 KB chunk (~266 KB gzip). `xlsx` and `pdfjs` are already lazy (`src/App.jsx:33-40` — good), but `SheogaConfigurator` and `AppsWorkspace` are statically imported (`src/App.jsx:23-24`) and every new surface lands in the same chunk. This is the part that gets slower *per release* regardless of data.

**What is already right** (and must not regress): projects load as **light rows** (`LIST_SELECT`, `src/App.jsx:1712` — scalars projected out of jsonb server-side), full blobs lazy per open (`loadDetail:2067`); version snapshots fetched one at a time on restore (`:2996`); `price_book_items` (6,800+ rows) never eagerly loaded — server-side trigram search (RPC `search_price_book_items`) with an ILIKE fallback, plus the `orderItems` per-SKU lazy drift cache (`:2768`). ADR 0009 §6 already states the principle: *"Registry items are not eagerly loaded; their search is a server-side query… eager loading dies around book three."* This plan extends that principle to the boot sequence, rather than inventing a new one.

## Part 2 — Target architecture (the dataset loading policy)

What a seasoned reviewer should find when they ask "how is data stored and when does it move": one aggregate-per-row jsonb model (a Project's whole working set in one row — single-writer, last-write-wins by ADR 0004, versioned by explicit snapshot), append-only price books with pick-time snapshots so shared data can change without rewriting quotes, and a **written policy** for what may load when:

| Dataset | Table | Size class | Loads |
|---|---|---|---|
| Profile blob | `app_data` | 1 row/user | Stage 1 |
| Shared settings | `shared_settings` | 1 row | Stage 1 |
| Project list (light rows) | `projects` | grows with business (bounded-ish; see triggers) | Stage 1 |
| People / builders | `customers`, `builders` | small | Stage 1 |
| Stock price book | `stock_items` | grows with every import (never shrinks) | **Stage 2** (background) |
| Book registry metadata | `price_books` | ~dozens | Stage 2 |
| Team to-dos | `todos` | small | Stage 2 (sidebar badge); re-fetched on open |
| Project detail + version metadata | `projects.data`, `versions` | unbounded | On demand (open) |
| Version snapshots | `versions.snapshot` | unbounded | On demand (restore) |
| Vendor book items | `price_book_items` | unbounded | **Never in memory** — server search + per-SKU cache |
| Labels | `labels` | grows | On demand (`openApps` already re-fetches — **drop from boot**) |
| Import inputs/history | `pricebook_versions`, files | unbounded | On demand (import/history UI) |
| Attachments | Storage | unbounded | On demand |

One caveat the table's "1 row" hides: `shared_settings` is a **growing blob on the paint-blocking path** — the catalog, vendor sign-in groups (ADR 0020), label size presets (ADR 0023), and ops state all live in it. Bounded today, but the ADR must say plainly: no new *per-item grow-forever list* may be parked in `shared_settings` "because it's stage 1 anyway" — that's what the shared tables are for.

**Rules** (these become ADR 0026, Task 5):

1. **Stage 1 blocks paint and is one parallel round trip** — only what the opening screen draws.
2. **Stage 2 never blocks paint** — bounded, team-shared caches, loaded in parallel in the background, each best-effort.
3. **Unbounded data is never eagerly loaded** (ADR 0009 §6 generalized). It is server-searched, key-fetched, or fetched by the surface that shows it.
4. **A dataset that a surface re-fetches on open does not also load at boot.**
5. **New full-screen surfaces ship as lazy chunks** — the boot chunk is for the estimate grid and sidebar.
6. **Escape hatches are pre-planned, trigger-based** (recorded in the ADR, not built now):
   - `stock_items` > ~5,000 active rows (checkable any time in the Supabase dashboard — the primary trigger) *or* last-boot stage 2 > ~3 s on the shop connection (readable in production from the `ft-boot-trace` localStorage entry Task 3 writes — the dev-only console table alone would make this trigger unobservable) → move stock SKU search server-side by reusing the existing `pg_trgm` + RPC machinery (a `search_text` generated column + trigram index on `stock_items`, mirroring `supabase/pricebook-search.sql` / `pricebook-fuzzy.sql`) and resolve drift per-SKU like `orderItems`. Grout families and Laticrete base pairing then load as a filtered slice at boot; import diffs fetch the full table only at import time.
   - `projects` > ~5,000 rows → age the initial list (recent projects at stage 1; "Older" bucket fetches on expand — the server-side search at `App.jsx:2461` already backfills misses).

Accepted trade-offs this plan deliberately does **not** reopen: whole-blob `updateProject` writes with last-write-wins (ADR 0004), no realtime sync (manual re-fetch on open), no offline/IndexedDB cache (a stale price book quoting a real customer is worse than a slower load).

---

## Part 3 — Tasks

Each task is one PR. Task order is the dependency order; Tasks 4 and 5 are independent of each other.

### Task 1: Boot trace module

Timing evidence for every later PR — and the instrument that tells us if/when the Part 2 escape-hatch triggers fire.

**Files:**
- Create: `src/boottrace.js`
- Test: `src/boottrace.test.js`

**Interfaces:**
- Produces: `bootTrace(now?) → { span(name, fn), paint(), done(), report() }`; `traceRows(report) → Array<{load, "started at (ms)", "took (ms)"}>` (consumed by Task 3's dev-only `console.table`).

- [ ] **Step 1: Write the failing test**

```js
// src/boottrace.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { bootTrace, traceRows } from "./boottrace.js";

const ticker = (step = 10) => { let t = 0; return () => (t += step); };

test("span passes the result through and records a duration", async () => {
  const tr = bootTrace(ticker());
  const out = await tr.span("stock", async () => "rows");
  assert.equal(out, "rows");
  const r = tr.report();
  assert.equal(r.spans.length, 1);
  assert.equal(r.spans[0].name, "stock");
  assert.ok(r.spans[0].ms > 0);
});

test("span records the load even when it throws, and rethrows", async () => {
  const tr = bootTrace(ticker());
  await assert.rejects(() => tr.span("todos", async () => { throw new Error("boom"); }), /boom/);
  assert.equal(tr.report().spans[0].name, "todos");
});

test("paint and done stamp offsets from construction", async () => {
  const tr = bootTrace(ticker());
  tr.paint();
  tr.done();
  const r = tr.report();
  assert.ok(r.paintAt > 0);
  assert.ok(r.doneAt > r.paintAt);
});

test("traceRows renders spans plus paint/done marker rows", async () => {
  const tr = bootTrace(ticker());
  await tr.span("projects", async () => []);
  tr.paint();
  const rows = traceRows(tr.report());
  assert.equal(rows[0].load, "projects");
  assert.equal(rows.at(-1).load, "first paint");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/boottrace.test.js`
Expected: FAIL — `Cannot find module './boottrace.js'`

- [ ] **Step 3: Write the implementation**

```js
// src/boottrace.js
// Boot timing. Pure and clock-injected so node --test can drive it; the
// console output lives at the call site (App.jsx), not here.
export function bootTrace(now = () => performance.now()) {
  const t0 = now();
  const spans = [];
  let paintAt = null, doneAt = null;
  return {
    async span(name, fn) {
      const start = now();
      try { return await fn(); }
      finally { spans.push({ name, start: start - t0, ms: now() - start }); }
    },
    paint() { paintAt = now() - t0; },
    done() { doneAt = now() - t0; },
    report() { return { spans: [...spans], paintAt, doneAt }; },
  };
}

export function traceRows({ spans, paintAt, doneAt }) {
  const rows = spans.map((s) => ({ load: s.name, "started at (ms)": Math.round(s.start), "took (ms)": Math.round(s.ms) }));
  if (paintAt != null) rows.push({ load: "first paint", "started at (ms)": Math.round(paintAt), "took (ms)": 0 });
  if (doneAt != null) rows.push({ load: "background done", "started at (ms)": Math.round(doneAt), "took (ms)": 0 });
  return rows;
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test src/boottrace.test.js` → PASS (4 tests). Then `npm test` → all existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/boottrace.js src/boottrace.test.js
git commit -m "Add boot trace module: per-load spans, paint/done marks, table rows"
```

### Task 2: Extract the boot loaders into `src/bootload.js`

Pure movement — no behavior change. This creates the tested seam so boot code stops accreting in `App.jsx`, and gives Task 3 loaders it can call from either stage.

**Design constraint (review finding, blocker):** `bootload.js` must **NOT** import `./lib/supabase.js`. That module reads `import.meta.env.VITE_SUPABASE_URL` at evaluation time (`src/lib/supabase.js:3`), which throws under plain Node — importing it transitively would kill `node --test` at module load. It would also drag `@supabase/supabase-js` into the test import graph: today the entire suite runs without `node_modules` installed, and it must stay that way. So every loader takes the client as a **required first parameter** `db`, and `App.jsx` passes `supabase` at each call site. Tests inject a fake builder, like `src/fetchall.test.js` does — the difference from that file's pattern is exactly that `fetchall.js` imports no client, and neither may this module.

**Files:**
- Create: `src/bootload.js`
- Test: `src/bootload.test.js`
- Modify: `src/App.jsx` (delete the moved definitions; import them instead)

**Interfaces:**
- Produces (all `async`, all with the client as the **required first param** — see the design constraint above):
  `loadProjects(db)`, `loadPeople(db)`, `loadBuilders(db)`, `loadStock(db)`, `loadTodos(db)`, `loadLabels(db)`, `loadBooks(db)`, `loadSettingsRow(db)`, `resolveSharedSettings(db, row, fallbackRaw)`;
  row mappers `lightRow`, `personRow`, `builderRow`, `todoFromRow`, `normBook`; constants `LIST_SELECT`, `PERSON_SELECT`, `SHARED_SETTINGS_ID`.
- Consumes: `fetchAllRows` (`./fetchall.js`), `normStockItem` (`./stock.js`), `normLabel` (`./labels.js`), `normalizeSettings`/`serializeSettings`/`catalogHasSeedUnderlayments` (`./catalog.js`) — all already Node-safe, test-covered pure modules. **Never** `./lib/supabase.js`.

- [ ] **Step 1: Write the failing test**

```js
// src/bootload.test.js
import test from "node:test";
import assert from "node:assert/strict";
import { loadProjects, loadStock, loadTodos, resolveSharedSettings, loadSettingsRow } from "./bootload.js";

// Chainable thenable standing in for the supabase query builder (same idea as
// fetchall.test.js): select/eq/order return the builder; awaiting it resolves
// {data, error}; range slices for fetchAllRows; upsert records seed writes.
function fakeTable(rows, calls = []) {
  const res = { data: rows, error: null };
  const q = {
    select: (...a) => { calls.push(["select", ...a]); return q; },
    eq: () => q,
    order: () => q,
    maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
    range: async (from, to) => ({ data: rows.slice(from, to + 1), error: null }),
    upsert: async (row) => { calls.push(["upsert", row]); return { error: null }; },
    then: (ok, err) => Promise.resolve(res).then(ok, err),
  };
  return q;
}
const fakeDb = (tables, calls = []) => ({ from: (t) => fakeTable(tables[t] || [], calls) });

test("loadProjects maps light rows and coerces the projected quick flag", async () => {
  const db = fakeDb({ projects: [{ id: "p1", customer_id: null, created_at: "2026-01-01", updated_at: "2026-01-02", name: "Smith", quick: "true" }] });
  const rows = await loadProjects(db);
  assert.equal(rows[0].id, "p1");
  assert.equal(rows[0].quick, true);
  assert.equal(rows[0]._full, false);
});

test("loadStock pages past the 1000-row cap and normalizes items", async () => {
  const many = Array.from({ length: 1001 }, (_, i) => ({ sku: `S${String(i).padStart(4, "0")}`, active: true, data: {} }));
  const rows = await loadStock(fakeDb({ stock_items: many }));
  assert.equal(rows.length, 1001);
  assert.equal(typeof rows[0].sku, "string");
});

test("loadTodos maps row shape", async () => {
  const rows = await loadTodos(fakeDb({ todos: [{ id: "t1", position: 2, data: { text: "fix", done: false } }] }));
  assert.deepEqual({ id: rows[0].id, position: rows[0].position, text: rows[0].text }, { id: "t1", position: 2, text: "fix" });
});

test("resolveSharedSettings seeds when the shared row is missing and not when present", async () => {
  const calls = [];
  const settings = await resolveSharedSettings(fakeDb({}, calls), null, undefined);
  assert.ok(settings);
  assert.ok(calls.some(([op]) => op === "upsert"), "missing row must seed");

  const row = await loadSettingsRow(fakeDb({ shared_settings: [{ data: { catalog: null } }] }));
  assert.ok(row);
});
```

> The seed-vs-no-seed branch also depends on `catalogHasSeedUnderlayments`; the moved code is used as-is, so the second half of the last test only asserts the row read path. Deeper seed-branch cases already live where that logic is tested via `catalog.test.js`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test src/bootload.test.js`
Expected: FAIL — `Cannot find module './bootload.js'`

- [ ] **Step 3: Create `src/bootload.js` by MOVING code, not rewriting it**

Cut these from `src/App.jsx` verbatim, then add `db` as the required first parameter and swap `supabase.` → `db.` — no other edits. Leave `personData` (`:624`) and `todoData` (`:3042`) behind: they sit inside the "adjacent" ranges but are write-path helpers and stay in `App.jsx`.

| Move from `App.jsx` | What |
|---|---|
| `:429` | `SHARED_SETTINGS_ID` |
| `:622` and adjacent | `PERSON_SELECT` + `personRow` |
| `:1712-1722` | `LIST_SELECT` + `lightRow` |
| `:2041-2062` | `loadProjects`, `loadPeople`, `loadBuilders` |
| `:2105-2117` | `loadSharedSettings` — **split** into `loadSettingsRow` + `resolveSharedSettings` (below) |
| `:2119-2125` | `loadStock` (keep the `select("*")` comment — it is a constraint) |
| `:2207-2217` | `normBook` + `loadBooks` |
| `:3041, 3043-3047` | `todoFromRow` + `loadTodos` |
| `:3100-3103` | `loadLabels` |

The only rewritten function — the old `loadSharedSettings(fallbackRaw)` both read and seeded; Task 3 needs the read to run in parallel with `app_data` while the seed decision waits for both:

```js
export const loadSettingsRow = async (db) => {
  const { data: row, error } = await db.from("shared_settings").select("data").eq("id", SHARED_SETTINGS_ID).maybeSingle();
  if (error) throw error;
  return row;
};

// Unchanged seeding logic from the old loadSharedSettings (ADR 0002): persist
// when the stored record is missing, pre-catalog, or lacks seed underlayments.
export const resolveSharedSettings = async (db, row, fallbackRaw) => {
  const hasRow = row?.data && Object.keys(row.data).length;
  const settings = normalizeSettings(hasRow ? row.data : fallbackRaw);
  if (!hasRow || !row.data.catalog || !catalogHasSeedUnderlayments(row.data.catalog)) {
    try { await db.from("shared_settings").upsert({ id: SHARED_SETTINGS_ID, data: serializeSettings(settings) }, { onConflict: "id" }); } catch (x) { /* best-effort seed */ }
  }
  return settings;
};
```

In `App.jsx`, import everything moved (`import { LIST_SELECT, lightRow, personRow, builderRow, todoFromRow, normBook, SHARED_SETTINGS_ID, loadProjects, loadPeople, loadBuilders, loadStock, loadTodos, loadLabels, loadBooks, loadSettingsRow, resolveSharedSettings } from "./bootload.js";`) and fix the call sites:

- **Every loader call gains the `supabase` argument** — grep them all: `grep -n "loadProjects(\|loadPeople(\|loadBuilders(\|loadStock(\|loadTodos(\|loadLabels(\|loadBooks(" src/App.jsx`. That includes the mount effect, the post-import/rollback `loadStock(supabase)` refreshes (`:2177`, `:2196`, `:2413`), `openTodos` (`:3051`), `openApps` (`:3104`), and any book-refresh call of `loadBooks`.
- Mount effect line 1997: `const settings = await loadSharedSettings(row?.data?.settings);` → `const settings = await resolveSharedSettings(supabase, await loadSettingsRow(supabase), row?.data?.settings);` (still sequential here — Task 3 makes it parallel).
- Every other use of the moved names (`lightRow` in the search effect `:2461`, `todoFromRow` in `openTodos`, `normBook` in `addBook`/`updateBook`, `SHARED_SETTINGS_ID` in `setSettings` `:2489`) now resolves via the import — grep each moved name to catch stragglers: `grep -n "lightRow\|personRow\|builderRow\|todoFromRow\|normBook\|SHARED_SETTINGS_ID\|LIST_SELECT\|PERSON_SELECT" src/App.jsx`.

- [ ] **Step 4: Run tests and build**

Run: `node --test src/bootload.test.js` → PASS. `npm test` → PASS. `npm run build` → builds clean (catches any missed reference).

- [ ] **Step 5: Commit**

```bash
git add src/bootload.js src/bootload.test.js src/App.jsx
git commit -m "Extract boot loaders into bootload.js with an injectable client + tests"
```

### Task 3: Two-stage boot

The payoff PR: paint after one parallel round trip; stock/todos/books in the background; labels off boot entirely.

**Files:**
- Modify: `src/App.jsx` — mount effect (`:1982-2035`), stock state (`:1827`) and its stale comments (`:1824-1842`), `SkuPicker` (`:293-365`), the SKU-cell ternary (`:4363`) and mobile `canSearch` (`:1031`), `importStockFile` (`:2134`), `rollbackStock` (`:2189`), grout pick helpers (`:4155-4165`, `:1048-1052`)

**Interfaces:**
- Consumes: Task 1 `bootTrace`/`traceRows`; Task 2 loaders.
- Produces: `stockReady` boolean state (false until the stage-2 stock load settles — success **or** failure).

- [ ] **Step 1: Rewrite the mount effect**

Replace the body of the effect at `src/App.jsx:1982-2035` with:

```jsx
useEffect(() => {
  (async () => {
    const trace = bootTrace();
    try {
      // Stage 1 — everything the first screen draws, one parallel round trip.
      // The legacy per-user blob is still read: to pick up any customers
      // awaiting migration, and as the seed fallback for the shared settings.
      const [blobRes, settingsRow, projectRows, people, builders] = await Promise.all([
        trace.span("app_data", () => supabase.from("app_data").select("data").eq("user_id", user.id).maybeSingle()),
        trace.span("shared_settings", () => loadSettingsRow(supabase)),
        trace.span("projects", () => loadProjects(supabase)),
        trace.span("people", () => loadPeople(supabase)),
        trace.span("builders", () => loadBuilders(supabase)),
      ]);
      const { data: row, error } = blobRes;
      if (error) throw error;
      appBlobRef.current = (({ customers, settings, ...rest }) => rest)(row?.data || {});
      setProfile(normProfile(row?.data?.profile));
      const settings = await resolveSharedSettings(supabase, settingsRow, row?.data?.settings);

      // One-time migration: move any customers still embedded in the blob into
      // the customers table (idempotent). It inserts projects rows, and the
      // parallel list load above ran before those existed — so re-fetch.
      let projects = projectRows;
      const legacy = row?.data?.customers;
      if (Array.isArray(legacy) && legacy.length) {
        await migrateLegacyCustomers(legacy.map(normC));
        projects = await trace.span("projects (post-migration)", () => loadProjects(supabase));
      }

      const sweepMs = QUICK_SWEEP_DAYS * 86400000;
      const now = Date.now();
      const swept = projects.filter((p) => p.quick && p.customerId == null && now - (p.updatedAt || p.createdAt || now) > sweepMs);
      const kept = swept.length ? projects.filter((p) => !swept.some((s) => s.id === p.id)) : projects;
      setData({ projects: kept, people, builders, settings });
      for (const p of swept) supabase.from("projects").delete().eq("id", p.id).then(() => {}, () => {});
    } catch (e) { ping("Could not load your data — check connection"); }
    setLoading(false);
    trace.paint();

    // Stage 2 — bounded shared caches; nothing here blocks first paint.
    // Each is best-effort: an install that hasn't run that table's SQL file
    // just doesn't get the feature (same contract as before).
    const [stockRows, todoRows, bookRows] = await Promise.all([
      trace.span("stock", () => loadStock(supabase)).catch(() => null),
      trace.span("todos", () => loadTodos(supabase)).catch(() => null),
      trace.span("books", () => loadBooks(supabase)).catch(() => null),
    ]);
    if (stockRows) setStock(stockRows);
    setStockReady(true);
    if (todoRows) setTodos(todoRows);
    if (bookRows) setBooks(bookRows);
    trace.done();
    // Production-readable trace so the ADR 0026 stage-2 trigger is observable
    // without a dev build; the console table stays dev-only.
    try { localStorage.setItem("ft-boot-trace", JSON.stringify(trace.report())); } catch (x) { }
    if (import.meta.env.DEV) console.table(traceRows(trace.report()));
  })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [user.id]);
```

Notes locked in by this code:
- `labels` no longer loads at boot (policy rule 4): `openApps` (`:3104`) already re-fetches on every open, so the boot copy was dead weight. The Apps hub's saved list fills on open exactly as it refreshes today.
- Stage 2 now runs even when stage 1 failed — a **deliberate change** from today, where a stage-1 throw skips the stock/todos/labels/books loads entirely (they sit in the same `try`, `:2019-2030`). Each cache is independently guarded, so the new worst case is default settings alongside a live stock cache; that's strictly more useful than today's nothing-at-all, and each affordance still hides when its load fails.
- The migration path (rare, one-time) is the only thing that adds a round trip, and only for the user who still has an unmigrated blob.
- Add `import { bootTrace, traceRows } from "./boottrace.js";` alongside the Task 2 import.
- `src/main.jsx` wraps the app in `StrictMode`, so in dev the effect — and therefore the trace table — runs and prints **twice**. That's StrictMode's double-invoke, not a bug; read either copy.
- The state comments at `:1824-1842` ("loaded once on mount", stock "loaded once… searched in memory") describe the old boot and must be updated in this PR, or they become lies.

- [ ] **Step 2: Add the `stockReady` state**

Next to `const [stock, setStock] = useState([])` (`:1827`):

```jsx
const [stockReady, setStockReady] = useState(false);
```

`stock` stays `[]` while loading, so pure **read** consumers (`searchStock`, `findStock`, drift chips — `stockDrift(null, p)` returns null, `src/stock.js:262`, so no false chips) simply see results appear when the background load lands — they recompute from state. But that is **not** true of the paths that *write* from the cache or *diff* against it: those get explicit guards in Steps 3b and 3c below. `stockReady` exists to tell "still loading" apart from "this install has no stock book", and it must flip to `true` on stage-2 **failure** as well (the code in Step 1 does — `.catch(() => null)` then an unconditional `setStockReady(true)`), so a broken install degrades to today's behavior instead of guarding forever.

- [ ] **Step 3: Keep the SKU picker mounted through the load, with a loading line**

Two review findings live here. First, the grid's SKU cell renders SkuPicker only when `stock.length > 0 || searchOrder` (`:4363`) — with both empty until stage 2 lands, a hint *inside* SkuPicker could never display, because the component wouldn't be mounted. Second, that same ternary now flips a few seconds into every cold load, swapping the plain `<input>` for SkuPicker mid-session and dropping the caret of anyone already typing (the value survives on `p.sku`; focus does not). One change fixes both — render the picker from first paint while the load is undecided:

At `:4363`:

```jsx
{stock.length > 0 || searchOrder || !stockReady ? (
  <SkuPicker value={p.sku || ""} stock={stock} stockReady={stockReady}
    ...
) : (
  <input value={p.sku} ... />
)}
```

Apply the same `|| !stockReady` term to the mobile search gate (`canSearch`, `:1031`). On installs that turn out to have no stock book and no order books, the picker downgrades to the plain input once — early, when `stockReady` flips — which matches today's semantics for those installs (they never get a picker at all).

Then in `SkuPicker` (`:293`), accept `stockReady` and make the loading state visible. Signature and portal condition (`:338`):

```jsx
function SkuPicker({ value, stock, stockReady, onChange, onPick, onPickMany, searchOrder, bookName, wrapClass, wrapStyle, inputClass }) {
```

```jsx
{open && pos && (results.length > 0 || picked.length > 0 || (!stockReady && value)) && createPortal(
```

Inside the panel, above the scrolling results `div` (`:341`), and — review nit — suppress the footer in that state so it doesn't read "0 matches" under a loading message (`matchSummary`, `:173`):

```jsx
{!stockReady && results.length === 0 && (
  <div className="px-2.5 py-1.5 text-[11px] text-slate-400">Price book still loading…</div>
)}
```

```jsx
{(stockReady || results.length > 0) && (
  <div className="shrink-0 flex items-center gap-2 px-2.5 py-1.5 border-t border-slate-200 text-[11px] text-slate-400 bg-slate-50/60">
    ...existing footer contents unchanged...
  </div>
)}
```

The remaining stock-searching surfaces (`StockSearch` in Settings, `GridOmniSearch` — which *is* in the estimate grid, but read-only search — and `MobileSearchSheet` beyond the `canSearch` gate above) self-heal on re-render as pure reads; they don't get the hint (keep this PR small).

- [ ] **Step 3b: Guard the stock import AND rollback against a not-yet-loaded cache**

Everything that **diffs against the in-memory `stock`** must refuse to run against a cache that isn't there yet — a diff against `[]` doesn't error, it lies. Two write paths do this:

1. `importStockFile` (`:2134`) diffs the parsed workbook via `diffStock` — against `[]` the preview falsely presents every row as "new". Guard the entry point, failing loud:

```jsx
const importStockFile = async (file, onDone) => {
  if (!file) return;
  if (!stockReady) { ping("Price book still loading — try again in a moment"); onDone?.(false); return; }
  ...
```

2. **Rollback (review finding — the quiet one):** `ImportHistory` for the stock book gets `currentItems={stock}` (`:6518-6521`) and `openRollback` computes `computeDiff(currentItems || [], snapshot)` at click time (`:6580-6583`). Against `[]` the confirm modal shows every snapshot row as "restored" and **zero retiring rows**, and confirming runs `rollbackStock` (`:2189`) → live `upsertStock` writes that fail to mark post-snapshot SKUs `active=false` — a silently incomplete rollback of shared production data. Guard the choke point:

```jsx
const rollbackStock = async (diff) => {
  if (!stockReady) { ping("Price book still loading — try again in a moment"); return; }
  try {
    ...
```

Note the distinction the guard rides on: `!stockReady` = not loaded yet (block); `stockReady && stock.length === 0` = genuinely empty install (safe — it has no versions to roll back). A stage-2 *failure* also flips `stockReady` and leaves `stock=[]` — that failure mode exists today too and stays out of scope here.

Apply the same `stockReady` guard where the multi-file drop router routes a shop-workbook file into `importStockFile`, so a queued drop fails loudly instead of mis-diffing. Registry-book imports are unaffected (their diffs fetch current items from the server on demand). One accepted, documented gap (review finding, MINOR): the drop router also matches *registry* files against `books` (`:5327-5342`), which is `[]` for the first seconds — a file dropped in that window routes unmatched and the user reassigns it in the normal review flow. No data is written wrongly; the window is seconds; not worth a second readiness flag. Record this acceptance in the ADR.

- [ ] **Step 3c: Don't let grout picks blank ADR-0007 snapshots during the window**

Review finding (MAJOR): the grout pick helpers snapshot from the stock cache **at click time** and write `""` on a miss — `pickGroutColor` / `pickGroutProduct` / `addGrout` in the grid (`:4155`, `:4156`, `:4165`) and their MobileRowSheet twins (`:1048-1052`) all end in `sku: it ? it.sku : "", caulkSku: ck ? ck.sku : "", caulkPrice: ...: ""`. During the stage-2 window a book-linked grout resolves `null` from `stock=[]`, so a pick would **silently overwrite an existing `grout.sku` snapshot with `""` and erase the color-matched caulk SKU/price** that prices tubes into the estimate (ADR 0007). Meanwhile `gFamilies` is empty, so the dropdown falls back to the standard color list — inviting exactly this pick.

Refuse loudly instead of writing wrong data. In each helper, when the grout is book-linked and stock isn't ready, ping and skip the update:

```jsx
const pickGroutColor = (color) => {
  if (gBook && !stockReady) { ping("Price book still loading — try that color again in a moment"); return; }
  const it = gBook ? groutColorItem(stock, gBook, color) : null;
  ...
```

Same one-line guard at the top of `pickGroutProduct` and `addGrout` (guarding on the *target* product's `book`), and in the two MobileRowSheet handlers. Unlinked grouts (no `book`) are untouched — they never snapshot SKUs. This state cannot persist: `stockReady` flips within seconds, and on load-failure it flips anyway (degrading to today's behavior, where these helpers already write `""` when a family is missing from the book).

- [ ] **Step 4: Verify**

Run: `npm test` → PASS. `npm run build` → clean.

- [ ] **Step 5: Preview proof (required to merge — non-negotiable 3)**

On the PR's Netlify deploy preview, signed in as a real account:
1. Screenshot the DevTools **Network waterfall** for a cold load — stage 1 requests fired together, paint before `stock_items` finishes.
2. Screenshot the dev-mode `console.table` boot trace (run `npm run dev` locally for this one — it prints twice under StrictMode, read either).
3. Screenshot the SKU picker's "Price book still loading…" line (throttle to Slow 3G to catch it).
4. Still throttled: click a book-linked grout's color during the window and screenshot the "Price book still loading" ping (Step 3c's guard firing instead of a blanked snapshot).
5. Confirm by hand: grout color dropdown fills after load; to-do badge appears; Apps hub label list fills on open.

Heads-up for whoever runs this: signing into the preview is normal app usage against the **live** data — a cold load can fire the ADR-0022 quick-draft sweep (deleting stale unpromoted quick drafts, as any login would) and, on an unseeded install, the settings seed-upsert. Expected behavior, not artifacts of this PR — just don't be surprised by sweep deletes in the network log.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "Two-stage boot: paint after one parallel round trip, caches load in background"
```

### Task 4: Lazy chunks for the two heavy secondary surfaces

Stops the per-release bundle growth for surfaces the first paint never shows. Both are conditionally rendered overlays, so `React.lazy` is a natural fit and the fallback can be nothing.

**Files:**
- Modify: `src/App.jsx` — imports (`:1, :23-24`), render sites (`:4828`, `:4862`)

- [ ] **Step 1: Swap the static imports for lazy ones**

Add `lazy` and `Suspense` to the React import on line 1, then replace lines 23-24:

```jsx
const SheogaConfigurator = lazy(() => import("./SheogaConfigurator.jsx"));
const AppsWorkspace = lazy(() => import("./AppsWorkspace.jsx").then((m) => ({ default: m.AppsWorkspace })));
```

- [ ] **Step 2: Wrap the two render sites in Suspense**

At `:4828` and `:4862`, wrap each conditional render:

```jsx
<Suspense fallback={null}>
  <AppsWorkspace ... />
</Suspense>
```

```jsx
<Suspense fallback={null}>
  <SheogaConfigurator seed={sheogaPop.seed} ... />
</Suspense>
```

`fallback={null}` is correct here: both are overlays that appear on a click; a sub-second blank beat before the overlay mounts reads as normal open latency. (If the chunk fetch fails offline, Suspense surfaces an error — same failure mode as today's lazy `xlsx` import.)

- [ ] **Step 3: Preconnect to the Supabase origin**

Review finding: `index.html` preconnects to Google Fonts but not to the origin every stage-1 request hits — so the first data round trip still pays DNS + TCP + TLS *after* the JS has booted. The URL is env-specific, so inject it in `src/main.jsx` before the React render:

```jsx
const supaUrl = import.meta.env.VITE_SUPABASE_URL;
if (supaUrl) {
  const l = document.createElement("link");
  l.rel = "preconnect"; l.href = supaUrl; l.crossOrigin = "anonymous";
  document.head.appendChild(l);
}
```

Named follow-ups this plan leaves on the table (worth their own small PRs, not blocking): the render-blocking Google Fonts stylesheet, and Netlify cache headers for hashed assets.

- [ ] **Step 4: Verify the split**

Run: `npm run build`
Expected: separate chunks for `SheogaConfigurator` and `AppsWorkspace` in the output table; the main chunk drops accordingly. Record the before/after chunk table in the PR description. **Expected wrinkle** (review finding): `AppsWorkspace.jsx` statically imports `SheogaConfigurator` (`AppsWorkspace.jsx:5`), so the Apps chunk will list the Sheoga chunk as a dependency and opening the Apps hub loads both — that is the split working, not failing; Sheoga still stays out of the boot chunk.

- [ ] **Step 5: Preview proof (required — UI change)**

On the deploy preview: open the Sheoga configurator from a row search and the Apps hub from the sidebar; screenshot both open and working (the label preview rendering, a Sheoga price computing). Confirm the Network tab shows each chunk loading on first open only, and the waterfall shows the Supabase preconnect ahead of the first data request.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx src/main.jsx
git commit -m "Lazy-load secondary surfaces as own chunks; preconnect to Supabase"
```

### Task 5: Record the policy — ADR 0026 + doc updates

**Files:**
- Create: `docs/adr/0026-two-stage-boot-and-loading-policy.md`
- Modify: `docs/adr/README.md` (add the index row), `CLAUDE.md` (source layout + conventions)

- [ ] **Step 1: Write the ADR**

`docs/adr/0026-two-stage-boot-and-loading-policy.md` — carry over from this plan: the Part 1 diagnosis (condensed), the Part 2 table and six rules verbatim (including the `shared_settings` growing-blob caveat), the escape-hatch triggers with their thresholds **and how each is observed** (row count in the dashboard; stage-2 time in the `ft-boot-trace` localStorage entry), and the accepted trade-offs paragraph. Also record the two consciously-accepted windows from Task 3: registry files dropped on the library in the first seconds route unmatched and are reassigned by hand (Step 3b), and the Apps hub's first open computes label positions from a still-loading list, risking only a sort tie (pre-existing clobber race unchanged). Status **Accepted**, date the merge date, Scope "system-wide (boot sequence + dataset loading policy)", Related: ADR 0003, ADR 0009 §6, this plan file.

- [ ] **Step 2: Index it**

Add to `docs/adr/README.md`:

```markdown
| [0026](0026-two-stage-boot-and-loading-policy.md) | Two-stage boot; unbounded data is never eagerly loaded; new surfaces ship as lazy chunks | Accepted | 2026-07-XX |
```

- [ ] **Step 3: Update CLAUDE.md**

- Source layout: add `boottrace.js` ("boot timing spans, dev console table") and `bootload.js` ("boot loaders, injectable client (ADR 0026); row mappers + shared-settings seed") entries.
- Conventions: add one bullet — *"Boot follows ADR 0026's two-stage policy: stage 1 is one parallel round trip of what the first screen draws; bounded caches load in the background; unbounded data is never eagerly loaded; new full-screen surfaces ship as `React.lazy` chunks."*

- [ ] **Step 4: Commit**

```bash
git add docs/adr/0026-two-stage-boot-and-loading-policy.md docs/adr/README.md CLAUDE.md
git commit -m "ADR 0026: two-stage boot and the dataset loading policy"
```

---

## Part 4 — What this plan deliberately does not do

- **No server-side stock search yet.** At the stock book's current scale, an in-memory cache loaded in the background is simpler and faster than a network search per keystroke; ADR 0026 records the exact trigger and the pre-designed mechanism (reuse the `pricebook-search.sql`/`pricebook-fuzzy.sql` machinery) for when the table earns it. Building it now would be speculative complexity with real regression risk to grout families, Laticrete pairing, drift chips, and import diffs.
- **No realtime subscriptions, no offline cache, no schema changes.** Staleness is handled by re-fetch-on-open today and that is the right cost/benefit for a small team quoting from live data.
- **No restructuring of the jsonb aggregate model.** One-row-per-Project with projected light lists, snapshot-on-pick pricing, and append-only books is a deliberate, recorded architecture (ADRs 0002-0009) that fits the team's trust model and write patterns. This plan makes *when data moves* as disciplined as *how it's stored*.

## Part 5 — Success criteria

- Cold load reaches the project list after **one** data round trip (network waterfall proof), instead of ~7 serial ones.
- `stock_items` growth affects only background time, never time-to-first-paint; labels affect boot not at all.
- `npm run build` shows the two secondary surfaces as separate chunks; the main chunk shrinks and future surface work lands in lazy chunks by convention.
- `npm test` covers the boot loaders and trace with fake clients/clocks.
- ADR 0026 is in the index, so the next feature that wants an eager table load has a written rule to answer to.

## Part 6 — Adversarial review record

Reviewed 2026-07-20 by an independent agent instructed to sink the plan (verify every line reference, trace every consumer of `labels`/`stock`/`books`, audit loader closures, test the Node/test-glob assumptions, check ADRs 0002–0025 and CLAUDE.md). **Verdict: SHIP WITH FIXES** — all mandatory fixes are folded into the task text above:

1. **BLOCKER — folded into Task 2:** `bootload.js` importing `./lib/supabase.js` would crash `node --test` (`import.meta.env` is undefined under Node; `src/lib/supabase.js:3`) and drag `@supabase/supabase-js` into a test suite that today runs without `node_modules`. Fixed: `db` is a required parameter; the module never imports the client.
2. **BLOCKER — folded into Task 3 Step 3:** the SKU-cell ternary (`App.jsx:4363`) unmounts SkuPicker whenever `stock` is empty, so the in-picker loading hint was unreachable and the required preview proof unproducible; the same ternary flip also dropped a typing user's caret. Fixed: the gate gains `|| !stockReady` (grid and mobile `canSearch:1031`), plus footer suppression.
3. **MAJOR — new Task 3 Step 3c:** grout color/product picks during the stage-2 window would blank ADR-0007 `grout.sku`/caulk snapshots with `""`, silently mispricing estimates. Fixed: book-linked picks refuse loudly while `!stockReady`.
4. **MAJOR — folded into Task 3 Step 3b:** stock ImportHistory rollback diffs against the in-memory cache at click time (`App.jsx:6580-6583`) and would apply a silently incomplete rollback. Fixed: guard in `rollbackStock`.

Recommended findings also folded: Supabase preconnect (Task 4 Step 3), production-readable boot trace so the ADR trigger is observable (Task 3 / Part 2), stage-2-after-stage-1-failure described as the deliberate change it is, drop-router registry-window acceptance recorded in the ADR, stale App.jsx state comments updated in Task 3's PR, StrictMode double-print note, `shared_settings` growing-blob caveat, AppsWorkspace→Sheoga chunk dependency note, and the corrected characterizations the reviewer caught (GridOmniSearch location, `lightRow` not used by backup import, `personData`/`todoData` stay behind).

Findings verified against the code by the plan author before folding (all four mandatory ones reproduced at the cited lines). The reviewer confirmed the rest of the plan's line references, the loader closure audit ("mechanically safe"), the `labels`-has-no-other-consumer claim, the lazy-export forms, the test-glob pickup, and found no conflict with any recorded ADR — no ADR pins load timing; ADR 0009 §6 is extended, not contradicted.
