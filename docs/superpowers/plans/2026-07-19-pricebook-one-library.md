# Price-Book One-Library (Variant C) + Review-When-Ready Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the Vendor sheets board and the price-book library into one page — sign-in columns hold *book* rows (the source sheet lives inside its book), an In-house column holds portal-less books — and decouple fetching from import review: a refresh only downloads; each book then waits with a "Review" pill, and a floating "Review all" bar chains the pending reviews.

**Architecture:** Three stacked PRs, each shippable. PR 1 adds the review-when-ready pool (pure helpers in `src/vendorfetch.js`, pool state in `PriceBookLibrary`, pills on the existing sheet rows) without touching layout. PR 2 flips the vendor board's linked-sheet rows into book-first rows (variant B look) while the sidebar still exists. PR 3 retires the sidebar list and the separate "Vendor sheets" tab: a `useVendorFetch` hook hoists the fetch machinery out of `VendorFetchPage`, the board (plus a new In-house column) becomes the Price book section's landing view, and `BookDetail` gains a back button and a "source sheet" strip.

**Tech Stack:** React 18 (hooks, no router), Tailwind 3 utility classes (slate/indigo are theme-overridden in `src/index.css` — reuse them, never invent colors), lucide-react icons, `node --test` for pure helpers. No Supabase schema changes; all persistence rides existing paths (`settings.ops.vendorGroups` jsonb + the existing book import write paths).

**Design references:**
- Clickable mockup: `.scratch/mockups/vendor-books-library-v2-2026-07-19.html` (board, book detail w/ source strip, review pills, Review-all bar, paste popover)
- Variant comparison: `.scratch/mockups/vendor-books-cohesion-2026-07-19.html`

## Global Constraints

- **Never push to `main`** — every PR lands via `gh pr create`; `main` auto-deploys production.
- **Never write to live Supabase outside the app's sanctioned UI paths.** Local `npm run dev` talks to the LIVE project. During preview verification: browse and screenshot; do not batch-download real vendor sheets, apply imports, or delete anything. Simulate fetch states with temporary seeded state (shown per task), then revert the seed before committing.
- **No UI change merges without preview proof** (screenshot from the running dev app in the PR).
- Keep the existing write paths: groups persist only through `setSettings({ ops: { ...ops, vendorGroups } })`; imports only through `ImportRouter`/`BookImportWizard` → `applyBookImport` / `importStockFile`. No new persistence.
- Pending reviews are **session-state only** (a `File`'s bytes can't go in jsonb). A page reload clears the pool — that's accepted; downloads are cheap. Never try to persist them.
- The fetch security model is untouched: a sheet fetches only with a live session matching its own `{host, user}` (ADR 0019/0020/0021). `portal` stays nominal.
- Comments: only for non-obvious business rules; match the file's existing density.
- Tests: `npm test` (runs `node --test src/*.test.js`). UI has no unit tests — UI tasks verify in the browser preview instead.
- Copy style: sentence case, em-dash asides, no exclamation marks (match existing strings).

## Current-Code Map (orientation for every task)

| Piece | Where | Role |
|---|---|---|
| `VendorFetchPage` | `src/App.jsx:5548-5775` | Vendor sheets tab: paste box, session pool, `run()` fetch loop, board of `VendorGroupCard`s, batch bar |
| `VendorSheetRow` | `src/App.jsx:5415-5477` | One sheet row: checkbox, filename, redownload, ⋯ menu (create/unlink book, move, forget) |
| `VendorGroupCard` | `src/App.jsx:5483-5546` | One sign-in column: header (name, download-all, ⋯), sheet rows |
| `SignInPaste` | `src/App.jsx:5351-5413` | The paste-a-sign-in input + buttons |
| `VendorBookmarklet` | `src/App.jsx:5326-5349` | Drag-to-bookmarks setup block |
| `runFetch` | `src/App.jsx:5301` | One sheet fetch via relay; returns `{file}` or `{error}` |
| `PriceBookLibrary` | `src/App.jsx:5777-5960` | Sidebar (drop zone, Vendor sheets button, Stock/Special-order lists, New book) + main pane (`VendorFetchPage` \| stock panel \| `BookDetail`), `dropped` state → `ImportRouter` |
| `ImportRouter` | `src/App.jsx:5046-5149` | Multi-file route modal → sequential `BookImportWizard` / stock preview |
| `BookDetail` | `src/App.jsx:6034+` | One registry book's page (items table, wizard, history) |
| Group helpers | `src/vendorfetch.js` | `recordKey`, `sheetRecord`, `rememberIntoGroups`, `setSheetBook`, `moveSheetInGroups`, `poolSession`, … |
| Staleness | `src/orderbook.js:603-611` | `DEFAULT_STALE_DAYS`, `bookStaleness(lastImportAt, thresholdDays)` |

---

# PR 1 — Review-when-ready (fetch ≠ review)

Branch: `claude/pr1-review-when-ready` off `main`.

### Task 1: Pending-review pool helpers

**Files:**
- Modify: `src/vendorfetch.js` (append after the `poolSession` function, before the `HANDOFF_KEY` const)
- Test: `src/vendorfetch.test.js` (append at end)

**Interfaces:**
- Produces: `poolPendingReview(prev, add) -> next` where `add = { sheet, file, at? }`; `removePendingReview(prev, sheet) -> next`; `pendingForSheet(pending, sheet) -> entry | null`. A pool entry is `{ sheet: <sheetRecord>, file: File, at: number }`, keyed by `recordKey(sheet)` — re-pooling the same sheet replaces its entry.

- [ ] **Step 1: Write the failing tests**

Append to `src/vendorfetch.test.js` (add `poolPendingReview, removePendingReview, pendingForSheet` to the existing import list at the top):

```js
test("pending-review pool keys by recordKey and replaces on re-pool", () => {
  const sheetA = { vendor: "dancik", host: "connect24.virginiatile.com", uid: "1071", filename: "AOT EFT", user: "C00000XX", bookId: "bk1" };
  const sheetB = { ...sheetA, uid: "2088", filename: "MSI EFT", bookId: undefined };
  const f1 = { name: "a.xls" }, f2 = { name: "a2.xls" }, f3 = { name: "b.xls" };

  let pool = poolPendingReview([], { sheet: sheetA, file: f1, at: 111 });
  pool = poolPendingReview(pool, { sheet: sheetB, file: f3, at: 222 });
  assert.equal(pool.length, 2);
  assert.equal(pool[0].file, f1);
  assert.equal(pool[0].sheet.bookId, "bk1"); // bookId survives sheetRecord
  assert.equal(pool[0].at, 111);

  // Re-fetching the same sheet replaces the parked file (and keeps one entry).
  pool = poolPendingReview(pool, { sheet: sheetA, file: f2, at: 333 });
  assert.equal(pool.length, 2);
  assert.equal(pendingForSheet(pool, sheetA).file, f2);
  assert.equal(pendingForSheet(pool, sheetA).at, 333);

  pool = removePendingReview(pool, sheetA);
  assert.equal(pool.length, 1);
  assert.equal(pendingForSheet(pool, sheetA), null);
  assert.equal(pendingForSheet(pool, sheetB).file, f3);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `poolPendingReview is not a function` (import error).

- [ ] **Step 3: Implement the helpers**

Append to `src/vendorfetch.js` after `poolSession` (before `const HANDOFF_KEY`):

```js
// ---- pending reviews (review-when-ready) ---------------------------------
// A fetched sheet parks its File here instead of opening import review — the
// user reviews at their own pace (one pill at a time, or "Review all").
// Session-state only: File bytes can't persist, so a reload clears the pool
// and the user just re-fetches. Keyed by recordKey; a re-fetch replaces the
// parked file.
export function poolPendingReview(prev, add) {
  const k = recordKey(add.sheet);
  return [
    ...(prev || []).filter((p) => recordKey(p.sheet) !== k),
    { sheet: sheetRecord(add.sheet), file: add.file, at: add.at ?? Date.now() },
  ];
}

export function removePendingReview(prev, sheet) {
  const k = recordKey(sheet);
  return (prev || []).filter((p) => recordKey(p.sheet) !== k);
}

export function pendingForSheet(pending, sheet) {
  const k = recordKey(sheet);
  return (pending || []).find((p) => recordKey(p.sheet) === k) || null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS (all existing tests still green).

- [ ] **Step 5: Commit**

```bash
git add src/vendorfetch.js src/vendorfetch.test.js
git commit -m "feat: pending-review pool helpers for review-when-ready fetches"
```

### Task 2: ImportRouter learns per-file targets and reports outcomes

**Files:**
- Modify: `src/App.jsx:5051` (`ImportRouter` signature), `src/App.jsx:5060-5078` (routing effect), `src/App.jsx:5087-5096` (queue effect), `src/App.jsx:5138-5148` (wizard wiring)

**Interfaces:**
- Consumes: nothing new.
- Produces: `ImportRouter` accepts two optional props — `targets: Map<File, string>` (file → bookId; wins over fingerprint routing, same precedence as `preferTarget`) and `onFileDone(file: File, applied: boolean)` (called once per finished file: `true` after its diff was applied, `false` when its wizard was closed/skipped). Cancelling the route modal calls it for no one.

No unit tests exist for App.jsx — verification is the preview check in Task 4 (a review that gets applied disappears from the pool; a cancelled one stays).

- [ ] **Step 1: Extend the signature**

Change `src/App.jsx:5051` to:

```jsx
function ImportRouter({ files, preferTarget, targets, onFileDone, books, applyBookImport, updateBook, loadBookItems, importStockFile, onClose, types, typeLabels, inp, lbl, hideCosts }) {
```

- [ ] **Step 2: Honor per-file targets in the routing effect**

In the routing effect (`src/App.jsx:5060-5078`), replace the `preferTarget` block:

```jsx
        // A file fetched via "Create price book from this sheet" always lands in
        // the book we just made for it — the user's explicit intent outranks any
        // fingerprint match to another book.
        if (preferTarget && registryBooks.some((b) => b.id === preferTarget)) {
          r = { ...r, target: preferTarget, reason: "new book from this sheet" };
        }
```

with:

```jsx
        // Explicit intent outranks any fingerprint match to another book:
        // preferTarget = "Create price book from this sheet"; targets = files
        // fetched for a known linked book (review-when-ready pool).
        const forced = (preferTarget && registryBooks.some((b) => b.id === preferTarget)) ? preferTarget
          : (targets && targets.get(file));
        if (forced && registryBooks.some((b) => b.id === forced)) {
          r = { ...r, target: forced, reason: forced === preferTarget ? "new book from this sheet" : "fetched for this book" };
        }
```

- [ ] **Step 3: Report outcomes from the run phase**

In the queue effect (`src/App.jsx:5087-5096`), change the stock line:

```jsx
    if (row.target === "stock") { setActive(null); importStockFile(row.file, advance); return; }
```

to:

```jsx
    if (row.target === "stock") { setActive(null); importStockFile(row.file, () => { onFileDone && onFileDone(row.file, true); advance(); }); return; }
```

In the wizard render (`src/App.jsx:5138-5148`), change `onClose` and `onApply`:

```jsx
      onClose={() => { onFileDone && onFileDone(active.row.file, false); advance(); }}
      onApply={async (diff, opts) => { try { await applyBookImport(active.book.id, diff, opts); } catch (x) { /* surfaced by applyBookImport */ } onFileDone && onFileDone(active.row.file, true); advance(); }}
```

- [ ] **Step 4: Sanity build**

Run: `npm run build`
Expected: builds clean (no reference errors).

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx
git commit -m "feat: ImportRouter per-file forced targets + onFileDone outcome callback"
```

### Task 3: Pool state + floating "Review all" bar in PriceBookLibrary

**Files:**
- Modify: `src/App.jsx:5777-5798` (`PriceBookLibrary` state), `src/App.jsx:5872-5874` (VendorFetchPage render), `src/App.jsx:5937` (ImportRouter render + bar)

**Interfaces:**
- Consumes: Task 1 helpers, Task 2 props.
- Produces (props handed to `VendorFetchPage`, replacing `onFiles`/`onFilesToBook`): `pending` (the pool array), `onPool(adds: Array<{sheet, file}>)`, `onReview(entry)` (entry = one pool item). Plus the fixed bar markup other tasks reference as "the review bar".

- [ ] **Step 1: Add imports**

In the `./vendorfetch.js` import block at the top of `src/App.jsx` (it already imports `captureHandoff`, `recordKey`, etc.), add `poolPendingReview, removePendingReview, pendingForSheet`.

- [ ] **Step 2: Add the pool state and handlers**

In `PriceBookLibrary` after the `dropped`/`dragOver` state (`src/App.jsx:5787-5789`), add:

```jsx
  // Review-when-ready (mockup 2026-07-19): fetched sheets park here instead of
  // opening import review. Session-only — File bytes can't persist, a reload
  // clears the pool and re-fetching is cheap.
  const [pendingReviews, setPendingReviews] = useState([]);
  const poolFetched = (adds) => setPendingReviews((prev) => (adds || []).reduce((acc, a) => poolPendingReview(acc, a), prev));
  const reviewOne = (p) => setDropped({ files: [p.file], prefer: p.sheet.bookId && books.some((b) => b.id === p.sheet.bookId) ? p.sheet.bookId : undefined });
  const reviewAll = () => setDropped({
    files: pendingReviews.map((p) => p.file),
    targets: new Map(pendingReviews.filter((p) => p.sheet.bookId).map((p) => [p.file, p.sheet.bookId])),
  });
  // Applied files leave the pool; a wizard closed with "X" (= later) stays.
  const fileDone = (file, applied) => { if (applied) setPendingReviews((prev) => prev.filter((p) => p.file !== file)); };
```

- [ ] **Step 3: Rewire the VendorFetchPage render**

Change the `sel === "vendor"` branch (`src/App.jsx:5873-5874`) from passing `onFiles`/`onFilesToBook` to:

```jsx
          <VendorFetchPage settings={settings} setSettings={setSettings} pending={pendingReviews} onPool={poolFetched} onReview={reviewOne} vendorPending={vendorPending} vendorSession={vendorSession} onSessionUsed={() => { setVendorSession(null); clearHandoffSession(); }} books={books} staleDays={staleDays} addBook={addBook} inp={inp} lbl={lbl} />
```

- [ ] **Step 4: Render the bar and thread ImportRouter**

Change the `dropped &&` line (`src/App.jsx:5937`) to also pass the new props, and render the bar next to it:

```jsx
      {dropped && <ImportRouter files={dropped.files} preferTarget={dropped.prefer} targets={dropped.targets} onFileDone={fileDone} books={books} applyBookImport={applyBookImport} updateBook={updateBook} loadBookItems={loadBookItems} importStockFile={importStockFile} onClose={() => setDropped(null)} types={types} typeLabels={typeLabels} inp={inp} lbl={lbl} hideCosts={hideCosts} />}

      {pendingReviews.length > 0 && !dropped && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-xl border border-slate-200 bg-white shadow-xl pl-4 pr-2 py-2">
          <span className="text-sm font-semibold whitespace-nowrap">{pendingReviews.length} downloaded — ready to review</span>
          <button onClick={reviewAll} className="rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-sm font-medium hover:bg-indigo-700 whitespace-nowrap">Review all</button>
          <button onClick={() => setPendingReviews([])} title="Discard the downloaded files without reviewing" className="p-1.5 text-slate-400 hover:text-slate-600"><X size={14} /></button>
        </div>
      )}
```

- [ ] **Step 5: Sanity build, commit**

Run: `npm run build` — expected clean.

```bash
git add src/App.jsx
git commit -m "feat: pending-review pool + floating Review-all bar in PriceBookLibrary"
```

### Task 4: VendorFetchPage pools fetches; sheet rows grow Review pills

**Files:**
- Modify: `src/App.jsx:5548` (signature), `5654-5679` (`run`), `5688-5704` (`createBookFromSheet`), `5743-5749` (remove partial-success banner), `5415-5477` (`VendorSheetRow`), `5483-5546` (`VendorGroupCard` threading), `5766-5772` (batch bar position)

**Interfaces:**
- Consumes: `pending`, `onPool(adds)`, `onReview(entry)` from Task 3; `pendingForSheet` from Task 1.
- Produces: `VendorSheetRow` gains props `pending` (pool entry | null) and `onReview(entry)`; `VendorGroupCard` gains and threads the same (`pendingFor(sheet)` accessor).

- [ ] **Step 1: Swap the fetch hand-off for pooling**

Signature `src/App.jsx:5548`: replace `onFiles, onFilesToBook,` with `pending, onPool, onReview,`.

In `run` (`src/App.jsx:5654-5679`):
- Change `const files = [], ok = [];` to `const fetched = [], ok = [];`
- In the success branch replace `files.push(res.file);` with `fetched.push({ sheet: sheetRecord(e), file: res.file });`
- Replace the tail

```jsx
    setRunning(false);
    if (files.length && !failures) onFiles(files);
    else if (files.length) setFetchedFiles(files);
```

with:

```jsx
    setRunning(false);
    if (fetched.length) onPool(fetched);
```

- Delete the `fetchedFiles` state (`src/App.jsx:5554`), its `setFetchedFiles(null)` calls in `run`/`createBookFromSheet`, and the whole `{fetchedFiles && (...)}` amber banner block (`src/App.jsx:5743-5749`). Partial failures still show per-row error notes; successes now just pool.

- [ ] **Step 2: createBookFromSheet parks the file too**

Replace the end of `createBookFromSheet` (`src/App.jsx:5700-5703`):

```jsx
    const id = await addBook({ kind: "order", name: entryFileName(sheet).replace(/\.xls$/i, "") });
    let next = rememberIntoGroups(groupsRef.current, [{ ...sheetRecord(sheet), lastFetched: Date.now() }]);
    writeGroups(setSheetBook(next, sheet, id));
    (onFilesToBook || onFiles)([res.file], id);
```

with:

```jsx
    const id = await addBook({ kind: "order", name: entryFileName(sheet).replace(/\.xls$/i, "") });
    let next = rememberIntoGroups(groupsRef.current, [{ ...sheetRecord(sheet), lastFetched: Date.now() }]);
    writeGroups(setSheetBook(next, sheet, id));
    onPool([{ sheet: { ...sheetRecord(sheet), bookId: id }, file: res.file }]);
```

- [ ] **Step 3: The Review pill on VendorSheetRow**

Add `pending, onReview` to the `VendorSheetRow` props (`src/App.jsx:5415`). In the row's control cluster, directly before the redownload button (`src/App.jsx:5430`), insert:

```jsx
        {pending && !fetching && (
          <button onClick={() => onReview(pending)} title={`${entryFileName(sheet)} is downloaded — open its import review`} className="shrink-0 rounded-full bg-indigo-600 text-white text-[10px] font-semibold px-2 py-px hover:bg-indigo-700">Review</button>
        )}
```

and suppress the stale/done marks while parked — change the two indicators (`src/App.jsx:5427-5428`):

```jsx
        {stale?.stale && !pending && <span className="shrink-0 leading-none" title={`${bookName || "Its price book"} was last imported ${stale.days} days ago — re-download this sheet to refresh it.`}><AlertTriangle size={12} className="text-amber-500" /></span>}
        {prog?.state === "done" && !pending && <Check size={13} className="text-emerald-600 shrink-0" />}
```

(The mismatch triangle at 5426 stays as-is.)

- [ ] **Step 4: Thread through VendorGroupCard and the page**

`VendorGroupCard` (`src/App.jsx:5483`): add props `pendingFor, onReview`; in the sheet map (`src/App.jsx:5539-5541`) pass `pending={pendingFor(s)} onReview={onReview}` to each `VendorSheetRow`.

In `VendorFetchPage`'s board render (`src/App.jsx:5760-5762`) pass `pendingFor={(s) => pendingForSheet(pending, s)} onReview={onReview}` to each `VendorGroupCard`. Add `pendingForSheet` to the App.jsx vendorfetch import if Task 3 didn't already.

Batch-select bar (`src/App.jsx:5766-5772`): it and the new review bar both sit `bottom-5` center — shift the selection bar up when both are visible. Change its wrapper class to:

```jsx
        <div className={`fixed ${pending.length ? "bottom-[4.25rem]" : "bottom-5"} left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-xl border border-slate-200 bg-white shadow-xl pl-4 pr-2 py-2`}>
```

- [ ] **Step 5: Preview verification (simulated fetch)**

Real fetches need a live portal session, and dev talks to live data — so simulate: temporarily change Task 3's state init to

```jsx
  const [pendingReviews, setPendingReviews] = useState(() => [{ sheet: { vendor: "dancik", host: "connect24.virginiatile.com", uid: "999", filename: "TEST SHEET", user: "TESTUSER" }, file: new File(["x"], "test.xls"), at: Date.now() }]);
```

Run the dev server (`.claude/launch.json` name if present, else `npm run dev`), sign in, open Settings → Price book → Vendor sheets. Verify: the floating bar shows "1 downloaded — ready to review" with Review all + discard ✕; clicking ✕ clears it. If a real group contains a sheet with `uid: "999"` semantics it would show a pill — instead verify the pill by pointing the seeded record at an EXISTING remembered sheet's `{vendor,host,uid,user}` (read them from the rendered board's title tooltips) so its row shows the indigo Review pill in place of the ✓/stale marks. Screenshot both states. **Do not click Review all with the fake file** (the router would error parsing it — acceptable to try once to confirm the route modal opens, then Cancel). Revert the seeded init to `useState([])` before committing.

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: fetches pool for review-when-ready; Review pills on sheet rows"
```

### Task 5: ADR 0024 + docs

**Files:**
- Create: `docs/adr/0024-pricebook-one-library.md`
- Modify: `docs/adr/README.md` (append index row), `CLAUDE.md` (vendorfetch.js line in the source-layout block)

- [ ] **Step 1: Write the ADR**

`docs/adr/0024-pricebook-one-library.md` — follow the house format (Status/Context/Decision/Consequences, ~1 page). Content requirements:
- **Status:** accepted (2026-07-19). Amends ADR 0020/0021; supersedes ADR 0021's *sheet-row* board presentation (the sign-in/board concept and never-pre-locked downloads stay).
- **Context:** vendor sheets and price books were two disconnected surfaces; with many books coming, the sidebar list doesn't scale, and a batch fetch popping N sequential review wizards ambushes the user.
- **Decision:** (1) One library page — the Settings "Price book" section's landing view is the sign-in board; a linked sheet is *absorbed into its book* (book-first rows; source-sheet strip inside `BookDetail`); an In-house column holds the shop workbook and portal-less books; the separate Vendor sheets tab and sidebar book list are retired. (2) Review-when-ready — fetching only downloads; files park in a session-only pending pool (keyed by `recordKey`, re-fetch replaces); each parked book shows a Review pill and a floating bar reviews all sequentially; only an applied import leaves the pool. (3) Refresh-on-a-book means fetch *and then* review — one intent, two user-paced steps.
- **Consequences:** pool dies with the tab (accepted — refetch is cheap); `ImportRouter` gains forced per-file targets + outcome callback; fetch machinery moves to a hook so the book page can refresh its own source sheet; sesid/authorization mechanics unchanged.

- [ ] **Step 2: Index + CLAUDE.md**

Append the ADR to `docs/adr/README.md`'s table matching its existing row format. In `CLAUDE.md`'s `vendorfetch.js` source-layout entry, append a clause: `+ review-when-ready pending pool (ADR 0024): poolPendingReview/removePendingReview/pendingForSheet — fetched Files park session-side until reviewed`.

- [ ] **Step 3: Commit**

```bash
git add docs/adr/0024-pricebook-one-library.md docs/adr/README.md CLAUDE.md
git commit -m "docs: ADR 0024 — one price-book library + review-when-ready"
```

### Task 6: PR 1

- [ ] **Step 1:** `npm test` and `npm run build` — both green.
- [ ] **Step 2:** Push and open the PR with the Task 4 screenshots embedded:

```bash
git push -u origin claude/pr1-review-when-ready
gh pr create --title "Vendor sheets: review-when-ready — fetches park until reviewed" --body "$(cat <<'EOF'
Refresh now only downloads. Fetched sheets park in a session-side pool; their rows show an indigo Review pill, and a floating bar reviews everything sequentially (ImportRouter). Only an applied import leaves the pool — closing a wizard keeps the file parked. Create-book-from-sheet parks too. ADR 0024.

[preview screenshots here]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

# PR 2 — Book-first rows on the vendor board

Branch: `claude/pr2-board-book-rows` off PR 1's branch (rebase onto `main` once PR 1 merges).

### Task 7: VendorBookRow component

**Files:**
- Modify: `src/App.jsx` — add the new component directly above `VendorSheetRow` (`src/App.jsx:5415`)

**Interfaces:**
- Consumes: `pendingForSheet` pill pattern from Task 4; `bookStaleness` info via the existing `sheetInfo(s)` (`{ book, stale }`).
- Produces: `VendorBookRow({ sheet, book, group, groups, prog, locked, mismatch, running, stale, pending, checked, onToggle, onRedownload, onReview, onRemove, onMove, onUnlinkBook, onOpenBook })` — the book-first row for a sheet with a resolvable `bookId`. `onOpenBook(bookId)` navigates to the book.

- [ ] **Step 1: Write the component**

```jsx
// A linked sheet presents as its BOOK (ADR 0024): name + meta up front, the
// filename demoted to the ⋯ menu. Row click opens the book; the refresh
// control fetches the sheet and parks it for review (the pill).
function VendorBookRow({ sheet, book, group, groups, prog, locked, mismatch, running, stale, pending, checked, onToggle, onRedownload, onReview, onRemove, onMove, onUnlinkBook, onOpenBook }) {
  const [menu, setMenu] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const others = groups.filter((g) => g.id !== group.id);
  const fetching = prog?.state === "fetching";
  const openMenu = (v) => { setMenu(v); if (!v) setMoveOpen(false); };
  const meta = pending ? "downloaded — changes waiting"
    : fetching ? `downloading ${entryFileName(sheet)}…`
    : `${book.data?.lastImport?.skus ? `${book.data.lastImport.skus} items · ` : ""}${sheet.lastFetched ? `fetched ${new Date(sheet.lastFetched).toLocaleDateString()}` : "not fetched yet"}`;
  return (
    <div className={"px-2.5 py-1.5 " + (checked ? "bg-indigo-50" : pending ? "bg-indigo-50/40" : stale?.stale ? "bg-amber-50" : "")}>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={checked} onChange={onToggle} className="shrink-0" title="Select for batch download" />
        <BookOpen size={14} className="text-slate-400 shrink-0" />
        <button onClick={() => onOpenBook(book.id)} className="min-w-0 flex-1 text-left" title={`${book.name || "Untitled"} — open this price book (source sheet: ${entryFileName(sheet)})`}>
          <div className="text-[12.5px] font-medium truncate">{book.name || "Untitled"}</div>
          <div className="text-[10px] text-slate-400 truncate">{meta}</div>
        </button>
        {mismatch && <span className="shrink-0 leading-none" title="This sheet is from a different portal account — it needs its own sign-in link to download."><AlertTriangle size={12} className="text-amber-500" /></span>}
        {stale?.stale && !pending && <span className="shrink-0 leading-none" title={`Last imported ${stale.days} days ago — refresh to update.`}><AlertTriangle size={12} className="text-amber-500" /></span>}
        {prog?.state === "done" && !pending && <Check size={13} className="text-emerald-600 shrink-0" />}
        {prog?.state === "error" && <AlertTriangle size={12} className="text-red-500 shrink-0" />}
        {pending && !fetching && (
          <button onClick={() => onReview(pending)} title={`${entryFileName(sheet)} is downloaded — open this book's import review`} className="shrink-0 rounded-full bg-indigo-600 text-white text-[10px] font-semibold px-2 py-px hover:bg-indigo-700">Review</button>
        )}
        {!fetching && !pending && <button onClick={() => onRedownload(sheet)} disabled={running} title={locked ? "Refresh this book's sheet (no live sign-in yet — a failed try says how to unlock)" : "Ready — refresh this book's sheet"} className={"p-0.5 disabled:opacity-40 shrink-0 " + (locked || prog?.state === "done" ? "text-slate-400 hover:text-indigo-600" : "ft-live")}><RotateCcw size={12} /></button>}
        <div className="relative shrink-0">
          <button onClick={() => openMenu(!menu)} title="More" className="p-0.5 text-slate-400 hover:text-slate-600"><MoreHorizontal size={14} /></button>
          {menu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => openMenu(false)} />
              <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-sm">
                <div className="px-3 py-1 text-[11px] text-slate-400 truncate" title={entryFileName(sheet)}>Source sheet: <span className="text-slate-600">{entryFileName(sheet)}</span></div>
                <button onClick={() => { onOpenBook(book.id); openMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50"><BookOpen size={13} className="text-slate-400" /> Open price book</button>
                <button onClick={() => { onUnlinkBook(sheet); openMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50"><Link2Off size={13} className="text-slate-400" /> Unlink price book</button>
                {others.length > 0 && (
                  <>
                    <div className="my-1 border-t border-slate-100" />
                    <button onClick={() => setMoveOpen((v) => !v)} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 hover:bg-slate-50">
                      <ChevronRight size={13} className={"text-slate-400 transition-transform " + (moveOpen ? "rotate-90" : "")} /> Move to another sign-in
                    </button>
                    {moveOpen && (
                      <div className="max-h-40 overflow-y-auto bg-slate-50">
                        {others.map((g) => (
                          <button key={g.id} onClick={() => { onMove(sheet, group.id, g.id); openMenu(false); }} className="w-full text-left pl-8 pr-3 py-1.5 text-[13px] hover:bg-slate-100 truncate">{g.name}</button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <div className="my-1 border-t border-slate-100" />
                <button onClick={() => { onRemove(group.id, sheet); openMenu(false); }} className="w-full flex items-center gap-1.5 text-left px-3 py-1.5 text-red-600 hover:bg-red-50"><X size={13} /> Forget this sheet</button>
              </div>
            </>
          )}
        </div>
      </div>
      {fetching && (
        <div className="pl-6 pr-1 pt-1">
          <div className={"ft-progress h-1" + (prog.value == null ? " ft-progress-indeterminate" : "")}>
            {prog.value != null && <div className="ft-progress-fill" style={{ width: `${Math.round(prog.value * 100)}%` }} />}
          </div>
        </div>
      )}
      {prog?.state === "error" && <div className="pl-6 pt-0.5 text-[10px] text-red-600" title={prog.note}>{prog.note}</div>}
    </div>
  );
}
```

Note: "Forget this sheet" on a book row forgets the *sheet* only — the book keeps existing (it just falls back to loose/manual import). The confirm copy already says saved estimates are unaffected at the group level; no extra confirm here (matches today's sheet row).

- [ ] **Step 2: Sanity build, commit**

`npm run build` — clean.

```bash
git add src/App.jsx
git commit -m "feat: VendorBookRow — a linked sheet presents as its book"
```

### Task 8: VendorGroupCard splits linked/loose; open-book navigation

**Files:**
- Modify: `src/App.jsx` — `VendorGroupCard` body (sheet list render, currently `5535-5543`), `VendorFetchPage` signature/threading (`5548`, `5760-5762`), `PriceBookLibrary` vendor render (`5873-5874`)

**Interfaces:**
- Consumes: `VendorBookRow` (Task 7); `sheetInfo(s)` already returns `{ book, stale }`.
- Produces: `VendorGroupCard` gains `onOpenBook(bookId)`; `VendorFetchPage` gains `onOpenBook` and passes it down; `PriceBookLibrary` supplies `onOpenBook={setSel}` (a bookId is already a valid `sel` value).

- [ ] **Step 1: Split the rows**

Replace `VendorGroupCard`'s sheet list block (`src/App.jsx:5535-5543`):

```jsx
      {group.sheets.length === 0 ? (
        <p className="px-2.5 py-2 text-[11px] text-slate-400">No sheets yet — paste a link above, or move one here from a row's ⋯ menu.</p>
      ) : (() => {
        const linked = group.sheets.filter((s) => sheetInfo(s).book);
        const loose = group.sheets.filter((s) => !sheetInfo(s).book);
        const rowProps = (s) => ({ sheet: s, group, groups, prog: progress[recordKey(s)], locked: !sheetSesid(s), mismatch: !sheetMatchesGroup(s, group), running, pending: pendingFor(s), checked: selected.has(recordKey(s)), onToggle: () => onToggleSheet(s), onRedownload: onRedownloadSheet, onReview, onRemove: onRemoveSheet, onMove: onMoveSheet });
        return (
          <div className="divide-y divide-slate-100">
            {linked.map((s) => { const info = sheetInfo(s); return (
              <VendorBookRow key={recordKey(s)} {...rowProps(s)} book={info.book} stale={info.stale} onUnlinkBook={onUnlinkBook} onOpenBook={onOpenBook} />
            ); })}
            {loose.length > 0 && linked.length > 0 && <div className="px-2.5 pt-1.5 pb-0.5 text-[9px] font-semibold uppercase tracking-widest text-slate-400">Loose sheets</div>}
            {loose.map((s) => { const info = sheetInfo(s); return (
              <VendorSheetRow key={recordKey(s)} {...rowProps(s)} stale={info.stale} bookName={null} onCreateBook={onCreateBook} onUnlinkBook={onUnlinkBook} />
            ); })}
          </div>
        );
      })()}
```

Note `sheetInfo` must move from `VendorFetchPage` scope into a prop the card already receives — it does (`sheetInfo` is already passed at `src/App.jsx:5761`). A sheet whose `bookId` points at a deleted book resolves `book: null` → renders as loose (its ⋯ still offers Create/Unlink via `VendorSheetRow`, unchanged).

- [ ] **Step 2: Thread `onOpenBook`**

- `VendorGroupCard` signature: add `onOpenBook`.
- `VendorFetchPage` signature (`5548`): add `onOpenBook`; pass it to each `VendorGroupCard` (`5760-5762`).
- `PriceBookLibrary` vendor render (`5873`): add `onOpenBook={setSel}`.

- [ ] **Step 3: Preview verification**

Dev server → Settings → Price book → Vendor sheets. With the owner's real data (read-only browsing): linked sheets now read as book names with meta lines; loose sheets sit under the "Loose sheets" eyebrow; clicking a book row jumps to that book's page in the sidebar layout; ⋯ shows "Source sheet: <filename>" + Open/Unlink/Move/Forget. Screenshot the board and one open ⋯ menu. Re-run the Task 4 seeded-pool trick to screenshot a book row wearing the Review pill; revert the seed.

- [ ] **Step 4: Commit + PR**

```bash
npm test && npm run build
git add src/App.jsx
git commit -m "feat: vendor board shows linked sheets as book rows"
git push -u origin claude/pr2-board-book-rows
gh pr create --base claude/pr1-review-when-ready --title "Vendor board: linked sheets present as their price books" --body "$(cat <<'EOF'
Variant-B rows from the 2026-07-19 mockup: a sheet linked to a book renders book-first (name, items, fetched-ago, stale flag, refresh/Review pill); the filename moves into the ⋯ menu; unlinked sheets sit under a Loose sheets eyebrow; clicking a book row opens the book. ADR 0024.

[preview screenshots here]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

(Retarget the PR base to `main` after PR 1 merges.)

### Task 9: (folded into Task 8's Step 3–4 — no separate work)

Intentionally empty; kept so later references to "PR 2 verification" have an anchor. Skip.

---

# PR 3 — One library page

Branch: `claude/pr3-one-library` off PR 2's branch.

### Task 10: `sheetForBook` helper

**Files:**
- Modify: `src/vendorfetch.js` (append after `pendingForSheet`)
- Test: `src/vendorfetch.test.js`

**Interfaces:**
- Produces: `sheetForBook(groups, bookId) -> { group, sheet } | null` — the first sheet whose `bookId` matches; used by the In-house split and BookDetail's source strip.

- [ ] **Step 1: Failing test**

```js
test("sheetForBook finds a linked sheet and its group", () => {
  const s1 = { vendor: "dancik", host: "connect24.virginiatile.com", uid: "1", filename: "A", user: "U1", bookId: "bkA" };
  const s2 = { vendor: "dancik", host: "connect24.virginiatile.com", uid: "2", filename: "B", user: "U1" };
  const groups = [{ id: "g1", name: "G", loginUrl: "", portal: null, sheets: [s2, s1] }];
  assert.equal(sheetForBook(groups, "bkA").sheet.uid, "1");
  assert.equal(sheetForBook(groups, "bkA").group.id, "g1");
  assert.equal(sheetForBook(groups, "bkNope"), null);
  assert.equal(sheetForBook([], "bkA"), null);
});
```

Run: `npm test` → FAIL (not exported).

- [ ] **Step 2: Implement**

```js
// The sheet feeding a book, with its group — for the book page's source-sheet
// strip and the library's linked/in-house split.
export function sheetForBook(groups, bookId) {
  if (!bookId) return null;
  for (const g of groups || []) {
    const sheet = (g.sheets || []).find((s) => s.bookId === bookId);
    if (sheet) return { group: g, sheet };
  }
  return null;
}
```

Run: `npm test` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/vendorfetch.js src/vendorfetch.test.js
git commit -m "feat: sheetForBook — resolve a book's source sheet + group"
```

### Task 11: Extract `useVendorFetch` (hoist fetch machinery)

**Files:**
- Modify: `src/App.jsx` — new hook directly above `VendorFetchPage`; `VendorFetchPage` (`5548-5775`) consumes it via props instead of owning the state; `PriceBookLibrary` calls the hook.

**Interfaces:**
- Consumes: everything `VendorFetchPage` currently owns (`src/App.jsx:5549-5705`).
- Produces:

```jsx
function useVendorFetch({ settings, setSettings, books, vendorPending, vendorSession, onSessionUsed, onPool, addBook }) -> {
  groups,                    // settings.ops.vendorGroups (normalized upstream)
  writeGroups(next),         // persists via setSettings
  sheetSesid(sheet),         // live token for the sheet's {host,user} or undefined
  sheetInfo(sheet),          // { book, stale }
  progress,                  // { [recordKey]: {state, value, note} }
  running,                   // bool
  run(picks),                // fetch sheet records -> onPool successes
  createBookFromSheet(sheet),// fetch + addBook + link + onPool
  unlinkSheetBook(sheet),
  patchGroup(id, patch), delGroup(id), addGroup(),
  removeSheet(groupId, sheet), moveSheet(sheet, fromId, toId),
  pasteSignIn(text), unlockPasted(text), addPasted(text),
  sessionNote, setSessionNote,   // the "sign-in captured" banner payload
}
```

The hook is a **verbatim move** of `VendorFetchPage`'s state and callbacks from `src/App.jsx:5549-5705` — `pending`(sessions pool)/`sessions`/`sessionNote`/`progress`/`running` state, the two hand-off effects, `liveSesid`/`sheetSesid`, `bookById`/`sheetInfo` (takes `staleDays` from `settings.ops?.staleDays || DEFAULT_STALE_DAYS` internally), `parseLinks`, `pasteSignIn`, `unlockPasted`, `addPasted`, group mutators, `NO_SESSION`, `run` (already pooling after Task 4), `createBookFromSheet`, `unlinkSheetBook`. Nothing about their bodies changes except: `selSheets` stays behind in the page component (it's presentation), so `run`'s two `setSelSheets` calls move out — `run` instead returns the ok `recordKey`s: after the loop add `return ok.map((e) => recordKey(e));` and the page component clears its own selection with the returned keys.

- [ ] **Step 1: Move the code into the hook** (as specified above — cut from `VendorFetchPage`, paste into `useVendorFetch`, adjust the two `setSelSheets` calls into a returned key list).

- [ ] **Step 2: Slim VendorFetchPage**

`VendorFetchPage` keeps only presentation state (`selSheets`, `setupOpen`) and receives the hook's return as a single `vf` prop plus the existing `pending`(pool)/`onReview`/`onOpenBook`/`inp`/`lbl`. Its handlers become wrappers:

```jsx
function VendorFetchPage({ vf, pending, onReview, onOpenBook, inp, lbl }) {
  const [setupOpen, setSetupOpen] = useState(false);
  const [selSheets, setSelSheets] = useState(() => new Set());
  const { groups, sheetSesid, sheetInfo, progress, running, sessionNote, setSessionNote } = vf;
  const clearKeys = (keys) => setSelSheets((prev) => { const n = new Set(prev); for (const k of keys || []) n.delete(k); return n; });
  const runAnd = async (picks) => clearKeys(await vf.run(picks));
  const toggleSheet = (sheet) => setSelSheets((prev) => { const n = new Set(prev); const k = recordKey(sheet); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const removeSheet = (groupId, sheet) => { vf.removeSheet(groupId, sheet); setSelSheets((prev) => { const n = new Set(prev); n.delete(recordKey(sheet)); return n; }); };
  const redownloadAll = (g) => runAnd(g.sheets);
  const redownloadSheet = (s) => runAnd([s]);
  const downloadSelected = () => runAnd(groups.flatMap((g) => g.sheets.filter((s) => selSheets.has(recordKey(s)))));
  // …existing JSX unchanged apart from these renamed handlers…
}
```

`PriceBookLibrary` calls `const vf = useVendorFetch({ settings, setSettings, books, vendorPending, vendorSession, onSessionUsed: () => { setVendorSession(null); clearHandoffSession(); }, onPool: poolFetched, addBook });` and renders `<VendorFetchPage vf={vf} pending={pendingReviews} onReview={reviewOne} onOpenBook={setSel} inp={inp} lbl={lbl} />`.

- [ ] **Step 3: Verify no behavior change**

`npm run build` clean; dev server: vendor board renders identically (screenshot-compare against Task 8's), paste box still accepts text, session banner still appears/dismisses.

- [ ] **Step 4: Commit**

```bash
git add src/App.jsx
git commit -m "refactor: hoist vendor fetch machinery into useVendorFetch"
```

### Task 12: The library board replaces the sidebar

**Files:**
- Modify: `src/App.jsx` — `PriceBookLibrary` (`5777-5960`) restructure; `VendorFetchPage` board render gains an In-house column slot.

**Interfaces:**
- Consumes: `sheetForBook` (Task 10), `vf` (Task 11).
- Produces: `sel` values become `"library" | "stock" | <bookId>` (default `"library"`; hand-off arrival selects `"library"`). New component `InHouseColumn({ books, stock, stockStale, bookStale, onOpen, onImportFile })`. `VendorFetchPage` gains a `leadColumn` prop (rendered as the board's first column).

- [ ] **Step 1: Rework PriceBookLibrary's frame**

- `sel` init: `useState(() => (vendorPending || vendorSession) ? "library" : "library")` → simply `useState("library")`; the hash-change effect (`5793-5797`) sets `setSel("library")`.
- Delete the whole sidebar `<div>` (`5823-5870`): drop zone, Vendor sheets button, Stock group, Special order group, New book button. Keep the `isWide` hook only if still referenced; otherwise remove it too.
- The outer frame becomes a single scroll pane:

```jsx
  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      {/* header row: title + stale-days + hide-costs + New book + Paste sign-in (Task 12 Step 2) */}
      {/* pricing-tiers strip: keep the existing block (5890-5909) verbatim below the header */}
      {/* drop strip (Step 3) */}
      {sel === "library" ? (
        <VendorFetchPage vf={vf} pending={pendingReviews} onReview={reviewOne} onOpenBook={setSel} leadColumn={inHouseCol} inp={inp} lbl={lbl} />
      ) : sel === "stock" ? (
        <>{backBtn}{/* existing stock panel block 5911-5928 verbatim */}</>
      ) : selBook ? (
        <>{backBtn}<BookDetail key={selBook.id} … existing props … source={sheetForBook(vf.groups, selBook.id)} sourcePending={sourcePendingFor(selBook.id)} sourceLive={sourceLiveFor(selBook.id)} onRefreshSheet={(s) => vf.run([s])} onReviewSheet={reviewOne} /></>
      ) : (
        <>{backBtn}<p className="text-xs text-slate-400 mt-3">This book is gone.</p></>
      )}
      {/* dropped ImportRouter + review bar + adding modal — unchanged from PR 1 */}
    </div>
  );
```

with:

```jsx
  const backBtn = (
    <button onClick={() => setSel("library")} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 -ml-1 mb-2">
      <ChevronRight size={13} className="rotate-180" /> All price books
    </button>
  );
  const sourcePendingFor = (bookId) => { const hit = sheetForBook(vf.groups, bookId); return hit ? pendingForSheet(pendingReviews, hit.sheet) : null; };
  const sourceLiveFor = (bookId) => { const hit = sheetForBook(vf.groups, bookId); return !!(hit && vf.sheetSesid(hit.sheet)); };
```

- [ ] **Step 2: Header row**

Replace the current header (`5876-5888`) with one that also carries New book + Paste sign-in (the h2 reads "Price books"):

```jsx
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2 min-w-0">
            <h2 className="ft-serif text-3xl">Price books</h2>
            <p className="text-xs text-slate-400 truncate hidden sm:block">Every book in one place — grouped by portal sign-in.</p>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <label className="flex items-center gap-1.5 text-xs text-slate-500" title="Books not re-imported within this many days get an amber ‘stale’ flag. Vendors re-issue cost lists roughly quarterly.">
              Flag stale after
              <input type="number" min="1" value={settings.ops?.staleDays || ""} placeholder={String(DEFAULT_STALE_DAYS)} onChange={(e) => setStaleDays(e.target.value)} className={inp + " w-16 text-center"} />
              days
            </label>
            <button onClick={() => setHideCosts((v) => !v)} title="Mask cost & margin figures on screen" className={`flex items-center gap-1.5 text-xs rounded-md border px-2.5 py-1.5 ${hideCosts ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              {hideCosts ? <Lock size={13} /> : <Percent size={13} />} {hideCosts ? "Costs hidden" : "Hide costs"}
            </button>
            <PasteSignInPopover vf={vf} setupOpen={setupOpen} setSetupOpen={setSetupOpen} inp={inp} lbl={lbl} />
            <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 text-xs rounded-md border border-dashed border-slate-300 px-2.5 py-1.5 text-slate-500 hover:bg-slate-50"><Plus size={13} /> New book</button>
          </div>
        </div>
```

`PasteSignInPopover` is a new small component: a "Paste sign-in" button toggling an absolutely-positioned card (anchor `relative` wrapper, `absolute right-0 mt-1 w-80 z-30 rounded-xl border border-slate-200 bg-white shadow-xl p-3`) containing exactly the current add-a-sign-in box content (`5717-5731`): the `SignInPaste` row, the "Set up bookmark" toggle, and `VendorBookmarklet` when open — moved, not rewritten (`setupOpen` state hoists to `PriceBookLibrary`). Delete the old in-page box from `VendorFetchPage` (its header also loses the "New sign-in" button — moved into the board's trailing "＋ New sign-in" ghost column, Step 4). The `sessionNote` and hand-off banners (`5733-5741`) stay in `VendorFetchPage` above the board.

- [ ] **Step 3: Drop strip**

Move the sidebar drop-zone's logic (`5824-5834`) into a full-width slim strip rendered under the header only when `sel === "library"` (drops during a detail view are rarer; the book page keeps its own wizard button):

```jsx
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); takeFiles(e.dataTransfer?.files); }}
          onClick={() => dropRef.current?.click()}
          className={`mt-3 rounded-lg border border-dashed px-3 py-2 text-xs cursor-pointer flex items-center gap-2 ${dragOver ? "border-indigo-400 bg-indigo-50/60 text-indigo-700" : "border-slate-200 text-slate-400 hover:bg-slate-50"}`}
        >
          <Upload size={14} className="shrink-0" />
          <span>Drop vendor sheets or the shop workbook — each file routes to its book · <span className="underline text-indigo-600">browse…</span></span>
          <input ref={dropRef} type="file" multiple accept=".xlsx,.xls,.pdf,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onClick={(e) => e.stopPropagation()} onChange={(e) => { takeFiles(e.target.files); e.target.value = ""; }} />
        </div>
```

- [ ] **Step 4: InHouseColumn + board slot**

New component above `PriceBookLibrary`:

```jsx
// Books with no portal sheet — the shop workbook plus hand-kept/unlinked
// registry books. First column of the library board (ADR 0024).
function InHouseColumn({ books, groups, stockCount, stockStale, bookStale, onOpen }) {
  const linkedIds = new Set();
  for (const g of groups) for (const s of g.sheets || []) if (s.bookId) linkedIds.add(s.bookId);
  const inHouse = books.filter((b) => !linkedIds.has(b.id));
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="px-2.5 py-2 border-b border-slate-100 bg-slate-50 rounded-t-xl">
        <h3 className="text-[13px] font-semibold">In-house</h3>
        <div className="text-[11px] text-slate-400 mt-0.5">no portal — imported by hand</div>
      </div>
      <div className="divide-y divide-slate-100">
        <button onClick={() => onOpen("stock")} className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-slate-50">
          <BookOpen size={14} className="text-slate-400 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-medium truncate">Shop workbook</span>
            <span className="block text-[10px] text-slate-400">{stockCount || "—"} items</span>
          </span>
          {stockStale.stale && <AlertTriangle size={12} className="text-amber-500 shrink-0" aria-label={`Stale — imported ${stockStale.days} days ago`} />}
        </button>
        {inHouse.map((b) => (
          <button key={b.id} onClick={() => onOpen(b.id)} className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-slate-50">
            <Database size={14} className="text-slate-400 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] font-medium truncate">{b.name || "Untitled"}</span>
              <span className="block text-[10px] text-slate-400">{b.kind === "stock" ? "stock" : "special order"}{b.active ? "" : " · off"}</span>
            </span>
            {bookStale(b).stale && <AlertTriangle size={12} className="text-amber-500 shrink-0" aria-label={`Stale — imported ${bookStale(b).days} days ago`} />}
          </button>
        ))}
      </div>
    </div>
  );
}
```

In `PriceBookLibrary`: `const inHouseCol = <InHouseColumn books={books} groups={vf.groups} stockCount={stockCount} stockStale={stockStale} bookStale={bookStale} onOpen={setSel} />;`

In `VendorFetchPage`: add prop `leadColumn`; render it as the first child of the board grid (`5759-5763`), and append a trailing ghost column replacing the header "New sign-in" button:

```jsx
        <div className="mt-3 grid gap-3 items-start grid-cols-[repeat(auto-fill,minmax(240px,1fr))]">
          {leadColumn}
          {groups.map((g) => ( /* …VendorGroupCard as before… */ ))}
          <button onClick={vf.addGroup} className="rounded-xl border border-dashed border-slate-300 min-h-[5.5rem] flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:bg-slate-50"><Plus size={14} /> New sign-in</button>
        </div>
```

The `groups.length === 0` empty state (`5751-5757`) now renders *after* `leadColumn` inside the grid area instead of replacing it (the In-house column must always show): change the condition to render the empty-state card as a grid item next to `leadColumn` when `groups.length === 0`.

- [ ] **Step 5: Sanity build + commit**

`npm run build` clean.

```bash
git add src/App.jsx
git commit -m "feat: one library page — board with In-house column replaces the sidebar"
```

### Task 13: BookDetail source-sheet strip + stock back nav

**Files:**
- Modify: `src/App.jsx` — `BookDetail` (`6034+`, header area right after the name/rename row), signature per Task 12's call site.

**Interfaces:**
- Consumes: `source` (`{group, sheet} | null`), `sourcePending` (pool entry | null), `sourceLive` (bool), `onRefreshSheet(sheet)`, `onReviewSheet(entry)` — passed by Task 12.
- Produces: the strip UI; no new exports.

- [ ] **Step 1: Add the props and strip**

Extend `BookDetail`'s signature with `source, sourcePending, sourceLive, onRefreshSheet, onReviewSheet`. Directly below the book's header row (name / kind chip / actions — locate the first block after the `confirmDel` UI inside `BookDetail`'s return), insert:

```jsx
      {source && (
        <div className={`mt-3 flex items-center gap-2.5 flex-wrap rounded-lg border px-3 py-2 max-w-xl ${st.stale ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50/60"}`}>
          <FileText size={15} className={st.stale ? "text-amber-500 shrink-0" : "text-slate-400 shrink-0"} />
          <div className="min-w-0 flex-1">
            <div className="text-[12.5px] font-medium truncate">{entryFileName(source.sheet)}</div>
            <div className="text-[10.5px] text-slate-400 truncate">
              from {source.group.name}
              {source.sheet.lastFetched ? ` · fetched ${new Date(source.sheet.lastFetched).toLocaleDateString()}` : ""}
              {li?.at ? ` · imported ${new Date(li.at).toLocaleDateString()}` : ""}
              {st.stale ? ` · ${st.days} days ago — stale` : ""}
            </div>
          </div>
          {sourcePending ? (
            <button onClick={() => onReviewSheet(sourcePending)} className="shrink-0 rounded-lg bg-indigo-600 text-white px-3 py-1.5 text-xs font-medium hover:bg-indigo-700">Review changes</button>
          ) : (
            <button onClick={() => onRefreshSheet(source.sheet)} title={sourceLive ? "Ready — fetch the latest sheet, then review at your pace" : "Fetch the latest sheet (needs a live sign-in — the board says how to unlock)"} className={"shrink-0 flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-white " + (sourceLive ? "ft-live" : "text-slate-600")}><RotateCcw size={12} /> Refresh</button>
          )}
        </div>
      )}
```

(`st` and `li` already exist in `BookDetail` — `src/App.jsx:6053-6054`.)

- [ ] **Step 2: Preview verification**

Dev server: open a linked book from the board → strip shows filename, sign-in name, dates; open an in-house book → no strip; "All price books" back link returns to the board; stock page also carries the back link. Seed the pool (Task 4 trick, sheet keyed to the linked book's sheet) → strip shows "Review changes". Screenshots of all three; revert seed.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat: BookDetail source-sheet strip with refresh/review"
```

### Task 14: Retire the vendor-tab remnants + mobile pass

**Files:**
- Modify: `src/App.jsx` — `VendorFetchPage` header (`5709-5715`), anything still branching on `sel === "vendor"`; `PriceBookLibrary` narrow-mode leftovers.

- [ ] **Step 1: Sweep**

- `VendorFetchPage`'s own h2 header block (`5709-5715`) is now redundant under the page header — delete it (the board starts at the session/hand-off banners).
- Grep `sel === "vendor"` and `"stock" | "vendor" | bookId` comments — none may remain; the hand-off effect and initial state say `"library"`.
- Grep `vendorPending &&` badge usage from the deleted sidebar — remove dead references.
- Remove `isWide` from `PriceBookLibrary` if now unused.

Run: `npm run build` — clean; `grep -n '"vendor"' src/App.jsx` returns no `sel`-related hits.

- [ ] **Step 2: Mobile pass**

Dev server at 375px width (browser device toolbar): the board grid stacks to one column (auto-fill minmax handles it); header controls wrap; the paste popover stays on-screen (`right-0` anchored — if it overflows left on 375px, add `max-w-[calc(100vw-2rem)]`); review bar and batch bar don't overlap the bottom nav. Screenshot.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "chore: retire vendor-tab remnants; mobile pass on the library board"
```

### Task 15: Docs

**Files:**
- Modify: `CLAUDE.md` (source-layout notes for the retired tab + one-library board), `docs/adr/0024-pricebook-one-library.md` (flip any "planned" phrasing to shipped), memory of the repo stays accurate.

- [ ] **Step 1:** Update `CLAUDE.md`'s `vendorfetch.js` entry's tail: the tab is gone — "…the library board renders groups as columns of book rows next to an In-house column; the sheet lives inside its book (source strip on the book page). ADR 0024." Also update the ADR-0021 reference sentence if it describes the old tab as current.
- [ ] **Step 2:** Commit:

```bash
git add CLAUDE.md docs/adr/0024-pricebook-one-library.md
git commit -m "docs: one-library board shipped — CLAUDE.md source notes"
```

### Task 16: PR 3

- [ ] **Step 1:** `npm test && npm run build` — green.
- [ ] **Step 2:** Full preview walkthrough, screenshots: library board (In-house + sign-in columns + ghost column), paste popover open, book detail with source strip (fresh + stale + Review-changes states via seeded pool), stock page with back link, mobile board. Revert any seeds.
- [ ] **Step 3:**

```bash
git push -u origin claude/pr3-one-library
gh pr create --base claude/pr2-board-book-rows --title "Price books: one library page — board replaces the sidebar" --body "$(cat <<'EOF'
Variant C (ADR 0024): the Price book section lands on the board — an In-house column (shop workbook + portal-less books) beside the sign-in columns of book rows; the sidebar list and the separate Vendor sheets tab are gone. Book pages open with a back link and carry a source-sheet strip (refresh → parks for review; Review-changes when parked). Paste sign-in + bookmarklet setup live in a header popover; the drop strip sits under the header. Fetch machinery hoisted into useVendorFetch so the book page can refresh its own sheet.

[preview screenshots here]

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

(Retarget base to `main` as the stack merges.)

---

## Self-review notes (already applied)

- Spec coverage: review-when-ready (pills, per-row pace, Review all, "Later" keeps parked) → Tasks 1-4; book-first rows → Tasks 7-8; one page with In-house column, source strip, back nav, popover, drop strip → Tasks 10-14; ADR + docs → Tasks 5, 15.
- Deliberate scope cuts (YAGNI, revisit only if asked): no per-column batch checkboxes beyond the existing selection bar; no persisted pending pool; no drag-and-drop between columns (⋯ Move stays, per ADR 0021); the pricing-tiers strip stays on the library page unchanged.
- Type consistency: pool entries are `{sheet, file, at}` everywhere; `onReview`/`reviewOne` take a pool entry; `run` takes sheet records and (from Task 11) returns cleared record keys; `sel` ∈ `"library" | "stock" | bookId` after Task 12.
- Known judgment calls an implementer may hit: exact insertion point of the source strip inside `BookDetail`'s return (below the name header, above the wizard/history controls — match the mockup); the empty-groups state as a grid item (Task 12 Step 4). Both are cosmetic; match the mockup file when unsure.
