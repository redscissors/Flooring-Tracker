# Price Book Enable/Disable Switch (PR A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A per-item, team-controlled `disabled` flag on price-book items that hides them from every add-a-product search, survives reimports, and is toggled (per row and in bulk) from the book table in Settings.

**Architecture:** `disabled` is a real DB **column** (not a jsonb field) on `price_book_items` and `stock_items`, because imports rewrite the whole `data` jsonb but never mention the column — so the team's choice survives every reimport. Enforcement is client-side in the search helpers (works even before the SQL migration runs), with a server-side predicate added to the fuzzy RPC for efficiency. One new sanctioned write path (`setBookItemsDisabled`) flips only that column.

**Tech Stack:** React 18 (single App.jsx), Supabase JS v2 (PostgREST), node:test.

**Spec:** `docs/superpowers/specs/2026-07-14-pricebook-importer-upgrades-design.md` (PR A section).

## Global Constraints

- **Never mutate the live Supabase project** — ship `supabase/*.sql` files + instructions; the owner runs them by hand. `npm run dev` talks to the LIVE project: during preview, look but never click writes.
- **Never push to `main`** — work lands via PR from branch `claude/pricebook-importer-upgrades` (already exists, holds the spec).
- **No UI change merges without preview proof** — screenshot the new book-table UI before merge.
- Deploy-order safety: the app must not break if the code deploys before the owner runs the SQL (that's why reads use `select("*")` and filtering is client-side; only the checkbox WRITE requires the column, and it pings a run-the-SQL message on failure).
- Extend `normStockItem`/`normOrderItem`/`normBookItem` for the new field (CLAUDE.md norm convention). Do NOT add `disabled` to `FIELDS`/`BOOK_FIELDS` diff lists — it is not vendor data and must never make a row "changed".
- Comments: rare, only for non-obvious rules (house style). Reuse existing Tailwind/slate/indigo utility classes — no new colors.
- Tests: `npm test` (runs `node --test src/*.test.js`). All existing tests must stay green.

---

### Task 1: SQL migration file + schema files + docs

**Files:**
- Create: `supabase/pricebook-disabled.sql`
- Modify: `supabase/pricebooks.sql` (items create table), `supabase/stock.sql` (create table), `supabase/pricebook-fuzzy.sql` (RPC predicate)
- Modify: `CLAUDE.md` (source layout entry)

**Interfaces:**
- Produces: `disabled boolean not null default false` column on `public.price_book_items` and `public.stock_items`; `search_price_book_items` RPC additionally filters `and not i.disabled`. Later tasks read `row.disabled` from PostgREST responses and write it via `.update({ disabled })`.

- [ ] **Step 1: Write `supabase/pricebook-disabled.sql`**

```sql
-- Per-item enable/disable switch (PR A of the 2026-07-14 importer-upgrades
-- spec). Run once on existing installs, BEFORE the PR merges — additive,
-- default false (= enabled), safe to re-run. Dashboard -> SQL Editor -> Run.
-- Fresh installs get the columns from pricebooks.sql / stock.sql and the
-- filtered function from pricebook-fuzzy.sql; this file is the catch-up.
--
-- `disabled` is a COLUMN, not a field in the data jsonb, on purpose: imports
-- rewrite the whole data jsonb but never mention this column, so the team's
-- choice survives every reimport. Three flags now coexist on an item:
--   active        was in the last import file   (import-controlled)
--   discontinued  vendor says it's dead         (vendor file / hand edit)
--   disabled      don't offer it in search      (team-controlled)

alter table public.price_book_items
  add column if not exists disabled boolean not null default false;
alter table public.stock_items
  add column if not exists disabled boolean not null default false;

-- Re-create the fuzzy selection-row search with the disabled filter (new-pick
-- path only — snapshot-resolve queries elsewhere keep resolving disabled SKUs).
create or replace function public.search_price_book_items(
  p_book_ids  text[],
  p_groups    jsonb,
  p_threshold real default 0.3,
  p_limit     int  default 40
)
returns setof public.price_book_items
language sql
stable
as $$
  select i.*
  from public.price_book_items i
  where i.book_id = any(p_book_ids)
    and i.active
    and not i.disabled
    and (
      -- every group must be satisfied by at least one of its alternates
      select bool_and(
        exists (
          select 1
          from jsonb_array_elements_text(grp) alt
          where word_similarity(
                  alt,
                  i.search_text || ' ' || coalesce(i.data->>'size', '')
                ) >= p_threshold
        )
      )
      from jsonb_array_elements(p_groups) grp
    )
  order by (
    -- rank by the summed best-per-group similarity (exact hits float up)
    select coalesce(sum(g.best), 0)
    from (
      select (
        select max(word_similarity(
                     alt,
                     i.search_text || ' ' || coalesce(i.data->>'size', '')))
        from jsonb_array_elements_text(grp) alt
      ) as best
      from jsonb_array_elements(p_groups) grp
    ) g
  ) desc
  limit p_limit;
$$;

grant execute on function public.search_price_book_items(text[], jsonb, real, int)
  to authenticated;
```

- [ ] **Step 2: Fold the column into the fresh-install schema files**

In `supabase/pricebooks.sql`, inside `create table … price_book_items` add after the `active` column line:

```sql
  disabled boolean not null default false,  -- team-controlled "don't offer in search" (pricebook-disabled.sql on older installs)
```

In `supabase/stock.sql`, inside `create table … stock_items` add after the `active` column line:

```sql
  disabled boolean not null default false,  -- team-controlled "don't offer in search" (pricebook-disabled.sql on older installs)
```

(Read each file first and match its exact column-list formatting/commas.)

In `supabase/pricebook-fuzzy.sql`, change the function's WHERE clause line

```sql
    and i.active
```

to

```sql
    and i.active
    and not i.disabled
```

and add one header-comment line noting it now needs the `disabled` column (pricebooks.sql fresh, or pricebook-disabled.sql on older installs).

- [ ] **Step 3: Document in CLAUDE.md source layout**

Under the `supabase/` entries, after the `pricebook-fuzzy.sql` entry, add:

```
  pricebook-disabled.sql  # run once on pre-2026-07 installs: per-item disabled
                    # column on price_book_items + stock_items + the fuzzy RPC's
                    # disabled filter (team-controlled hide-from-search switch;
                    # folded into pricebooks.sql/stock.sql for fresh installs)
```

- [ ] **Step 4: Commit**

```bash
git add supabase/pricebook-disabled.sql supabase/pricebooks.sql supabase/stock.sql supabase/pricebook-fuzzy.sql CLAUDE.md
git commit -m "Add disabled column migration for price book items (PR A schema)"
```

---

### Task 2: stock.js — norm, strip, and every stock-side search filter

**Files:**
- Modify: `src/stock.js`
- Test: `src/stock.test.js`

**Interfaces:**
- Consumes: `row.disabled` (boolean column) on `stock_items` rows.
- Produces: `normStockItem(row).disabled: boolean` (default false); `stockData(item)` payload WITHOUT `disabled`; `searchStock`, `groutFamilies`, `groutCaulkItem`, Laticrete `familyBases`, `syncCatalogPrices` all skip disabled items. `findStock` and `diffStock` deliberately unchanged (snapshot-resolve / diff paths).

- [ ] **Step 1: Write the failing tests** (append to `src/stock.test.js`)

```js
// --- disabled switch (importer-upgrades spec, PR A) ----------------------------

test("normStockItem maps the disabled column legacy-safe; stockData strips it", () => {
  const off = normStockItem({ sku: "22222", disabled: true, data: { description: "Blue tile" } });
  const legacy = normStockItem({ sku: "11111", data: { description: "Blue tile" } });
  assert.equal(off.disabled, true);
  assert.equal(legacy.disabled, false);
  assert.equal("disabled" in stockData(off), false); // never lands in the jsonb payload
});

test("searchStock skips disabled items", () => {
  const on = normStockItem({ sku: "11111", data: { description: "Blue glass tile" } });
  const off = normStockItem({ sku: "22222", disabled: true, data: { description: "Blue glass tile" } });
  assert.deepEqual(searchStock([on, off], "blue glass").map((i) => i.sku), ["11111"]);
});

test("grout family colors and their caulk skip disabled SKUs", () => {
  const g = (sku, color, disabled = false) =>
    normStockItem({ sku, disabled, data: { sheet: "Grout & Caulk", section: "TEC", product: "TEC Power Grout", color, price: 21 } });
  const caulk = (sku, color, disabled = false) =>
    normStockItem({ sku, disabled, data: { sheet: "Grout & Caulk", section: "TEC", product: "TEC Caulk", color, price: 9 } });
  const stock = [g("70001", "Charcoal"), g("70002", "Bone", true), caulk("70003", "Charcoal", true)];
  const fams = groutFamilies(stock);
  const powerGrout = fams.find((f) => f.product === "TEC Power Grout");
  assert.deepEqual(powerGrout.colors.map((c) => c.color), ["Charcoal"]); // Bone is disabled
  assert.equal(groutCaulkItem(stock, "TEC Power Grout", "Charcoal"), null); // its caulk is disabled
});

test("syncCatalogPrices ignores disabled items", () => {
  const items = [normStockItem({ sku: "50001", disabled: true, data: { description: "ProLite Mortar", price: 44 } })];
  const catalog = { companies: [{ id: "c1", name: "TEC", grouts: [], mortars: [{ id: "m1", name: "ProLite Mortar", price: "30" }], underlayments: [] }] };
  const { changes } = syncCatalogPrices(catalog, items);
  assert.equal(changes.length, 0);
});
```

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `npm test`
Expected: the four new tests FAIL (e.g. `off.disabled` is `undefined`, search still returns "22222"); every pre-existing test PASSES.

- [ ] **Step 3: Implement in `src/stock.js`**

In `normStockItem` (line ~16), after the `active:` line add:

```js
  disabled: row.disabled === true,
```

Change `stockData` (line ~40) to also strip it:

```js
export const stockData = ({ sku, active, updatedAt, disabled, ...data }) => data;
```

In `searchStock` (line ~62) change the skip line to:

```js
    if (!it.active || it.discontinued || it.disabled) continue;
```

In `familyBases` (line ~259) change the filter to:

```js
  stock.filter((it) => it.active && !it.discontinued && !it.disabled && isBaseUnit(it) && baseFamily(it) === family);
```

In `groutFamilies` (line ~308) change the skip line to:

```js
    if (!it.active || it.discontinued || it.disabled || !isGroutColorItem(it)) continue;
```

In `groutCaulkItem` (line ~335) change the find predicate's guard from `it.active && !it.discontinued &&` to:

```js
  return stock.find((it) => it.active && !it.discontinued && !it.disabled && isGroutColorItem(it) && /caulk/i.test(it.product) && it.section === g.section && it.color.toLowerCase() === g.color.toLowerCase()) || null;
```

In `syncCatalogPrices` (line ~381) change the `priced` filter to:

```js
  const priced = items.filter((it) => it.active !== false && !it.discontinued && !it.disabled && it.price != null);
```

Do NOT touch `findStock`, `diffStock`, `FIELDS`, `groutColorItem` (resolve paths / diff — disabled SKUs must keep resolving for rows that already hold them).

- [ ] **Step 4: Run tests to verify all pass**

Run: `npm test`
Expected: PASS (all files, no failures).

- [ ] **Step 5: Commit**

```bash
git add src/stock.js src/stock.test.js
git commit -m "Filter user-disabled stock items from every new-pick search path"
```

---

### Task 3: orderbook.js — norm and strip for registry-book items

**Files:**
- Modify: `src/orderbook.js`
- Test: `src/orderbook.test.js`

**Interfaces:**
- Consumes: `row.disabled` (boolean column) on `price_book_items` rows.
- Produces: `normOrderItem(f).disabled: boolean` (default false), `normBookItem(row, bookId).disabled` from the column, `bookItemData(item)` payload WITHOUT `disabled`. Task 4's `searchOrder` filters on `item.disabled`.

- [ ] **Step 1: Write the failing test** (append to `src/orderbook.test.js`, matching its existing `import { … } from "./orderbook.js"` — add `bookItemData` and `normBookItem` to that import if not already there)

```js
// --- disabled switch (importer-upgrades spec, PR A) ----------------------------

test("normBookItem maps the disabled column legacy-safe; bookItemData strips it", () => {
  const off = normBookItem({ sku: "ABC123", active: true, disabled: true, data: { description: "Trim" } }, "book1");
  const legacy = normBookItem({ sku: "ABC124", active: true, data: { description: "Trim" } }, "book1");
  assert.equal(off.disabled, true);
  assert.equal(legacy.disabled, false);
  assert.equal("disabled" in bookItemData(off), false); // the import upsert's jsonb must never carry it
});
```

- [ ] **Step 2: Run tests to verify it fails**

Run: `npm test`
Expected: the new test FAILS (`off.disabled` is `false` — jsonb spread doesn't see the column); everything else PASSES.

- [ ] **Step 3: Implement in `src/orderbook.js`**

In `normOrderItem` (line ~33), after the `updatedAt:` line add:

```js
    disabled: !!f.disabled,
```

In `normBookItem` (line ~86), after the `it.active = …` line add:

```js
  it.disabled = row.disabled === true;
```

Change `bookItemData` (line ~95) to also strip it:

```js
export const bookItemData = ({ sku, bookId, active, updatedAt, disabled, ...data }) => data;
```

Do NOT add `disabled` to `BOOK_FIELDS` (line ~255) — a team toggle must never make a row read as vendor-"changed" on the next import.

- [ ] **Step 4: Run tests to verify all pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/orderbook.js src/orderbook.test.js
git commit -m "Carry the disabled column on registry book items, strip it from import payloads"
```

---

### Task 4: App.jsx — reads carry the column, searches filter it, one new write path

**Files:**
- Modify: `src/App.jsx` (four reads, one search filter, one new function, prop threading)
- Modify: `CLAUDE.md` (conventions bullet)

**Interfaces:**
- Consumes: Task 2/3 norms (`.disabled` on items), the `disabled` column.
- Produces: `setBookItemsDisabled(bookId: string, skus: string[], disabled: boolean): Promise<void>` — passed as a prop `setBookItemsDisabled` through `PriceBookLibrary` into `BookDetail` (Task 5 consumes it). `searchOrder` results never contain disabled items.

No unit tests (App.jsx has none — hooks + Supabase calls); verified by Task 6's preview.

- [ ] **Step 1: Make the reads deploy-order-safe and column-carrying**

`loadStock` (App.jsx ~1169): change the select to `"*"` so the app works whether or not the column exists yet:

```js
    const rows = await fetchAllRows(() => supabase.from("stock_items").select("*").order("sku"));
```

`loadBookItems` (~1267): same change:

```js
    const rows = await fetchAllRows(() => supabase.from("price_book_items").select("*").eq("book_id", bookId).order("sku"));
```

`searchOrder`'s `base()` (~1607): same change, keeping the filters:

```js
    const base = () => supabase.from("price_book_items").select("*").in("book_id", ids).eq("active", true).limit(SKU_SHOW * 2);
```

Leave the drift-resolve fetch (~1665) untouched — it resolves snapshots and must keep finding disabled SKUs.

- [ ] **Step 2: Filter disabled from order search results (both RPC and fallback paths)**

In `searchOrder` (~1614), the returned async function has two `return orderFloorFirst(price(rows), q);` lines (RPC path ~1620, ILIKE path ~1629). Change BOTH to:

```js
        return orderFloorFirst(price(rows).filter((it) => !it.disabled), q);
```

(The updated RPC already excludes them server-side; this client guard also covers installs where the SQL hasn't been re-run.)

- [ ] **Step 3: Add the sanctioned write path**

After `updateBookItem` (~1385), add:

```js
  // Enable/disable book items (importer-upgrades spec, PR A): flips ONLY the
  // disabled column, keyed (book_id, sku). Import upserts never mention the
  // column, so the choice survives every reimport. Chunked like the imports.
  const setBookItemsDisabled = async (bookId, skus, disabled) => {
    for (let i = 0; i < skus.length; i += 200) {
      const { error } = await supabase.from("price_book_items").update({ disabled }).eq("book_id", bookId).in("sku", skus.slice(i, i + 200));
      if (error) { ping("Save failed — has supabase/pricebook-disabled.sql been run?"); throw error; }
    }
    flashSaved();
  };
```

- [ ] **Step 4: Thread the prop**

Find where `<PriceBookLibrary` is rendered (App.jsx ~4576, the Settings `section === "book"` branch) and add `setBookItemsDisabled={setBookItemsDisabled}` to its props. Add `setBookItemsDisabled` to the `PriceBookLibrary` destructured props (~3402) and pass it on the `<BookDetail` element (~3497): `setBookItemsDisabled={setBookItemsDisabled}`. Add it to `BookDetail`'s destructured props (~3598).

- [ ] **Step 5: Document the write path in CLAUDE.md**

In the Conventions bullet listing write paths, extend the stock-rows sentence: after the text about `importPriceBook -> preview -> applyImport`, add to that bullet:

```
  Registry-item enable/disable flips only the `disabled` column via
  `setBookItemsDisabled` — never through the import upserts.
```

- [ ] **Step 6: Verify the app still builds and tests pass**

Run: `npm test` — Expected: PASS.
Run: `npm run build` — Expected: builds with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx CLAUDE.md
git commit -m "Load, filter, and write the per-item disabled flag (setBookItemsDisabled path)"
```

---

### Task 5: BookDetail UI — checkbox column, status filter, bulk enable/disable

**Files:**
- Modify: `src/App.jsx` (`BookDetail`, ~3598–3737)

**Interfaces:**
- Consumes: `setBookItemsDisabled` prop (Task 4), `it.disabled` on loaded items (Tasks 3+4).
- Produces: user-facing UI only.

- [ ] **Step 1: Add state and derived rows**

In `BookDetail`, next to `const [q, setQ] = useState("");` add:

```js
  const [show, setShow] = useState("all"); // all | enabled | disabled
  const [confirmBulk, setConfirmBulk] = useState(null); // null | { disabled: boolean }
```

Replace the current `shown` computation (~3617–3619) with a `filtered` set (bulk acts on ALL matches, not the 300-row display slice):

```js
  const filtered = (items || [])
    .filter((it) => (show === "disabled" ? it.disabled : show === "enabled" ? !it.disabled : true))
    .filter((it) => !query || `${it.sku} ${it.description} ${it.mfg} ${it.color}`.toLowerCase().includes(query));
  const shown = filtered.slice(0, 300);
  const disabledCount = (items || []).filter((it) => it.disabled).length;
```

- [ ] **Step 2: Add the toggle helper (optimistic, rolls back on failure)**

Next to `saveItemEdit`:

```js
  const setDisabled = async (skus, disabled) => {
    const set = new Set(skus);
    const prev = items;
    setItems((its) => (its || []).map((x) => (set.has(x.sku) ? { ...x, disabled } : x)));
    try { await setBookItemsDisabled(book.id, skus, disabled); }
    catch (x) { setItems(prev); }
  };
```

- [ ] **Step 3: Replace the search input row with search + filter + bulk controls**

Replace `<input className={`${inp} mt-4 max-w-sm`} placeholder="Search this book…" … />` (~3679) with:

```jsx
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            <input className={`${inp} max-w-sm`} placeholder="Search this book…" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="flex rounded-md border border-slate-200 overflow-hidden text-xs">
              {[["all", "All"], ["enabled", "Enabled"], ["disabled", disabledCount ? `Disabled (${disabledCount})` : "Disabled"]].map(([v, label]) => (
                <button key={v} onClick={() => setShow(v)} className={`px-2.5 py-1.5 ${show === v ? "bg-indigo-600 text-white" : "ft-field text-slate-500 hover:bg-slate-50"}`}>{label}</button>
              ))}
            </div>
            {(query || show !== "all") && filtered.length > 0 && (
              <>
                <button onClick={() => setConfirmBulk({ disabled: true })} className="text-xs rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50">Disable all {filtered.length}</button>
                <button onClick={() => setConfirmBulk({ disabled: false })} className="text-xs rounded-md border border-slate-200 px-2.5 py-1.5 text-slate-600 hover:bg-slate-50">Enable all {filtered.length}</button>
              </>
            )}
          </div>
          {confirmBulk && (
            <div className="mt-2 flex items-center gap-2 flex-wrap rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs">
              <span className="text-amber-700 flex-1">
                {confirmBulk.disabled ? "Disable" : "Enable"} {filtered.length} item{filtered.length === 1 ? "" : "s"}{query ? ` matching “${q.trim()}”` : ""}? Disabled items stop showing in SKU search for everyone; estimates that already picked them keep their prices.
              </span>
              <button onClick={() => { setDisabled(filtered.map((it) => it.sku), confirmBulk.disabled); setConfirmBulk(null); }} className="rounded-md bg-indigo-600 text-white px-2.5 py-1 font-medium shrink-0">{confirmBulk.disabled ? "Disable" : "Enable"} {filtered.length}</button>
              <button onClick={() => setConfirmBulk(null)} className="rounded-md border border-slate-200 px-2.5 py-1 hover:bg-slate-50 shrink-0">Cancel</button>
            </div>
          )}
```

(The bulk buttons only appear once the list is narrowed — a filter or search term — so "disable everything by accident" isn't one stray click; the amber confirm strip mirrors the delete-book confirm pattern.)

- [ ] **Step 4: Add the checkbox column and disabled styling to the table**

In `<thead>` (~3683) add as the FIRST `<th>`:

```jsx
                  <th className="px-2 py-1.5 w-8"></th>
```

In the row render (~3698–3713): change the `<tr>` class to include disabled —

```jsx
                    <tr key={it.sku} className={`border-t border-slate-100 ${!it.active || it.discontinued || it.disabled ? "text-slate-300" : ""}`}>
```

Add as the FIRST `<td>`:

```jsx
                      <td className="px-2 py-1.5"><input type="checkbox" checked={!it.disabled} onChange={(e) => setDisabled([it.sku], !e.target.checked)} title={it.disabled ? "Enable — offer this SKU in search again" : "Disable — hide this SKU from search (estimates that already picked it keep their prices)"} /></td>
```

After the `disc` chip (~3704) add an `off` chip:

```jsx
                        {it.disabled && <span className="ml-1.5 text-[9px] uppercase rounded bg-slate-100 text-slate-500 px-1 py-0.5">off</span>}
```

Update the truncation footnote (~3719) to count the filtered set:

```jsx
          {(filtered.length > shown.length) && <p className="text-[11px] text-slate-400 mt-1">Showing {shown.length} of {filtered.length}.</p>}
```

- [ ] **Step 5: Verify build + tests**

Run: `npm test` — Expected: PASS.
Run: `npm run build` — Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "Book table: per-item enable/disable checkboxes, status filter, bulk toggle"
```

---

### Task 6: Preview proof, PR, and owner instructions

**Files:** none (verification + PR).

- [ ] **Step 1: Preview the UI (READ-ONLY — dev talks to the live project)**

Start the dev server via the Browser pane (`preview_start` with the launch.json config; create `.claude/launch.json` with `npm run dev` on port 5173 if absent). Sign-in is required — if no session is available, ask the owner to sign in in the preview. Navigate: Settings → Price book → select a registry book (the VTC book has ~6,800 items). Verify visually, WITHOUT clicking any checkbox or bulk button (writes to production data; the column may not exist yet):

- Checkbox column renders, all checked (nothing disabled yet).
- All · Enabled · Disabled filter renders; "Disabled" view shows an empty table.
- Typing a collection name in search shows the "Disable all N" / "Enable all N" buttons; clicking "Disable all N" shows the amber confirm strip — then **Cancel** it.
- Screenshot the table with the filter + bulk confirm visible.

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin claude/pricebook-importer-upgrades
gh pr create --title "Per-item enable/disable switch for price book items (importer upgrades PR A)" --body "<body per below>"
```

PR body must include: what/why (link the spec file), the preview screenshot, and an **owner checklist**: run `supabase/pricebook-disabled.sql` in the dashboard BEFORE merging (additive, safe to re-run; the app tolerates it missing for reads, but checkbox writes need it), then after merge verify a toggled-off SKU disappears from a selection-row search while an estimate that already uses it still shows its price.

- [ ] **Step 3: Report back to the owner**

Hand over: PR link, the run-the-SQL-first instruction, and note that the stock workbook's items got the column + search filtering but no toggle UI yet (no stock item table exists in Settings today; PR B's import review will set the flag there, and a stock toggle UI can follow if wanted).

---

## Self-review notes

- Spec coverage: column on both tables ✔ (Task 1), search filtering on every new-pick path ✔ (Tasks 2+4: searchStock, fuzzy RPC, ILIKE fallback via client guard, grout helpers, Laticrete bases, catalog sync), snapshot paths untouched ✔ (explicit do-not-touch lists), norms extended ✔, sanctioned write path ✔, checkbox + All/Enabled/Disabled filter + bulk ✔ (Task 5), SQL-first run order ✔ (Task 6). Deviation from spec, flagged to owner: stock-workbook toggle UI deferred (no stock item table exists; spec's UI section only covered BookDetail).
- `disabled` intentionally NOT in `FIELDS`/`BOOK_FIELDS`: otherwise every disabled item would read as "changed" on each reimport.
- `bookItemData`/`stockData` strip `disabled` so a `diff.missing` upsert (built from existing in-memory items) can't smuggle it into the jsonb.
