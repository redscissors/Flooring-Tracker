# Task 5 report — `src/usewedicatalog.js`, the three-way gate

## What was implemented

Two new files, exactly per the brief:

- `src/usewedicatalog.js` — exports `pickWediBooks(books)` (pure) and
  `useWediCatalog({ stockRows, bookStockReady, books, loadBookItems })` (the
  hook). Header comment states the LAZY-CHUNK-ONLY constraint and that this
  is the only file allowed to call `setStockSource`/`clearStockSource`.
- `src/usewedicatalog.test.js` — the `pickWediBooks` unit test from the brief.

Both files were written verbatim from `task-5-brief.md` — no deviation from
the plan's code. `src/wedi.js`, `src/wediadapter.js`, `src/wedifixture.js`,
`src/pricebook.js`, `src/orderbook.js`, and `src/WediConfigurator.jsx` were
not touched.

## TDD evidence

**RED** — before the module existed:

```
$ node --test src/usewedicatalog.test.js
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
'.../src/usewedicatalog.js' imported from '.../src/usewedicatalog.test.js'
...
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

Expected failure — the hook module didn't exist yet.

**GREEN** — after writing `src/usewedicatalog.js`:

```
$ node --test src/usewedicatalog.test.js
✔ pickWediBooks: stock-kind, active, matching /wedi/i on name or brandLabel (0.74ms)
ℹ tests 1
ℹ pass 1
ℹ fail 0
```

The brief's flagged risk (React import under `node --test`, untried
elsewhere in this repo) did not materialize — no ESM/interop error, the
import of `react`/`wediadapter.js`/`wedi.js` resolved cleanly and the pure
`pickWediBooks` export ran fine without needing a DOM or a renderer.

**Full suite**, run once before committing:

```
$ npm test
ℹ tests 1232
ℹ pass 1232
ℹ fail 0
```

Matches the brief's stated post-task baseline (1231 → 1232) exactly, no
regressions.

## Walkthrough: the three gate states

- **No wedi book exists.** `pickWediBooks(books)` returns `[]`, so
  `targetIds === ""`. The effect's `ids.length` is 0 → `setBookRows([])`
  (a legitimate, non-null empty state). `hasBook = false` →
  `catReady = true` unconditionally, `onBook = false`. In the `cat` memo,
  `catReady` is true and `onBook` is false → `clearStockSource()` then
  `catalog()`, which returns the transcribed `WEDI_STOCK` table. The hook
  reports `{ catReady: true, onBook: false }` so the UI can say "on the
  transcribed table."

- **A wedi book exists, rows not in yet (or the fetch failed).**
  `targetIds` is non-empty → `hasBook = true`. `bookRows` starts at its
  initial `null` and stays `null` until the effect resolves. If
  `loadBookItems` is missing, or any per-id fetch rejects (`.catch(() =>
  null)` then `lists.some(l => l === null)`), `bookRows` is explicitly set
  back to `null` — never `[]`. `catReady = hasBook ? (bookStockReady &&
  bookRows !== null) : true` evaluates to `false` while `bookRows` is
  `null`, so the `cat` memo short-circuits to `[]` before ever calling
  `setStockSource` or `clearStockSource`. The engine's installed source is
  left untouched — the gate stays closed rather than substituting anything.

- **A wedi book exists with rows.** The fetch resolves with at least one
  active, non-disabled row, so `bookRows` is a non-null array with
  `.length > 0`. Once `bookStockReady` is also true, `catReady = true` and
  `onBook = hasBook && catReady && !!(bookRows && bookRows.length)` is
  `true`. The `cat` memo calls `setStockSource(adaptBookRows(bookRows))`
  then `catalog()` — the live book is installed and `onBook: true` is
  reported.

  A fourth reachable sub-state worth naming explicitly (it's the point of
  the "carried finding" in the task context): a wedi book exists, the fetch
  *succeeds*, but returns zero active rows. Here `bookRows` is `[]` (not
  `null`, since no fetch failed), so `catReady` becomes `true` once
  `bookStockReady` flips, but `onBook = hasBook && catReady && !!(bookRows
  && bookRows.length)` is `false` because `bookRows.length` is falsy. The
  `cat` memo falls back to `WEDI_STOCK` (`clearStockSource()`), while
  `onBook: false` still tells the UI it isn't running on the book — this is
  the "empty book" case from the spec, distinguished from "no book"
  entirely by the hook's own `hasBook`/`onBook` pair, not by anything
  `setStockSource`/`clearStockSource` can report.

## Files changed

- `C:\Users\User\Documents\Claude ReadWrite\Flooring-Tracker\src\usewedicatalog.js` (new)
- `C:\Users\User\Documents\Claude ReadWrite\Flooring-Tracker\src\usewedicatalog.test.js` (new)

## Self-review findings

- `git status`/`git diff --stat` confirm only these two files changed under
  `src/`; nothing else in the working tree was touched.
- Naming and shape mirror `src/useschlutercatalog.js` closely, as directed
  — same `targetIds`-keyed effect pattern, same `alive` guard, same
  `eslint-disable-next-line react-hooks/exhaustive-deps` placement. The
  three deliberate differences from the Schluter file are present: matches
  `kind === "stock"` (not `"order"`), no `dropStockTwins` step (single
  source, no stock/order merge to dedupe), and the fallback-to-`WEDI_STOCK`
  branch that Schluter's hook has no equivalent for.
  header comment states both required things: LAZY-CHUNK-ONLY, and this
  file's exclusive ownership of `setStockSource`/`clearStockSource`.
- No YAGNI additions — implemented exactly what the brief specified, no
  extra options, no speculative generalization.
- The empty-book/no-book distinction (the carried finding from Task 3's
  review) is made entirely upstream in this hook via `hasBook` (from
  `targetIds`, independent of row count) and `onBook` (which additionally
  requires `bookRows.length`) — `setStockSource`/`wedi.js` are never asked
  to make that distinction, matching the constraint.

## Concerns

None. The flagged risk (React module import failing under `node --test`)
did not occur — no restructuring was needed and none was attempted. All
three gate states, plus the empty-book sub-state, are reachable and
covered by reasoning above; no additional test beyond the brief's
`pickWediBooks` unit test was written for the hook's effect/async
branches, since the brief specified only that one test and this file has
no `.jsx`, so a hook-level async test would need a React test renderer this
repo doesn't currently use for hooks — out of scope for this task as
briefed.

---

## Fix round 1 (2026-09-01) — review found two Critical defects

The round-1 review (`docs/superpowers/plans/2026-09-01-wedi-stock-book.md`,
Task 5, amended in commit `0f5b2cb`) found two Critical defects in the
plan's original hook code, which I had transcribed faithfully. Both are
fixed by rewriting `src/usewedicatalog.js` and `src/usewedicatalog.test.js`
to match the amended plan text verbatim (read directly from the plan
document, not from a cached brief).

### What changed

**CRITICAL 1 — stale rows from a previous id-set (including the no-book
`[]`) could satisfy the gate for a new book.** The old `bookRows` state
(`useState(null)`) had no memory of which id-set it was fetched for. When
`targetIds` went `"" -> "a"` (books metadata hydrating after mount — an
ordinary path, not a rare race), the leftover `bookRows = []` from the
no-book branch still satisfied `bookRows !== null`, so `catReady` read
`true` and the hook served `WEDI_STOCK` while the real book's rows were
still in flight. The same hole reopened on any book switch: nothing reset
`bookRows` when `targetIds` changed, so a previous book's rows kept
serving under an affirmative `onBook: true`.

Fix: state became `{ ids, rows }` (renamed `loaded`) so fetched rows carry
the id-set they were fetched for. The new pure `gateOf({ targetIds,
bookStockReady, loadedIds, rows, adapted })` requires `loadedIds ===
targetIds` (the `fresh` check) before `catReady` can be `true`.

**CRITICAL 2 — `onBook` was decided on pre-adapter row count, but
`setStockSource` installs post-adapter rows.** `adaptRow` returns `null`
for any row with no derivable wedi part number, so a mis-mapped import
whose rows carry no vendor SKU adapts to `[]`. `setStockSource([])`
collapses to the fallback (`wedi.js:4360`), yet the old hook still
reported `onBook: true` because it gated on the raw `bookRows.length`
before adapting — a false-positive "on the live book" marker over the
transcribed table.

Fix: `adapted = useMemo(() => (loaded.rows ? adaptBookRows(loaded.rows) :
null), [loaded.rows])` is computed once; `gateOf` gates `onBook` on
`adapted.length`, not `rows.length`; the `cat` memo installs the same
`adapted` value it gated on (`setStockSource(adapted)`), so there is no
window where the gated value and the installed value can diverge.

**IMPORTANT 3 — unanchored `/wedi/i` matched "Swedish".** A "Swedish oak"
stock book would be selected by `pickWediBooks`, then adapt to zero rows,
compounding with Critical 2. Fixed to `/\bwedi\b/i`. The test fixture now
includes `{ id: "f", kind: "stock", name: "Swedish oak" }` as a negative
case (must NOT be picked) and `{ id: "g", kind: "stock", name: "wedi
extras" }` with `active` left `undefined` (must be picked — `active !==
false` treats undefined as active).

**Folded in per the amended plan:**
- `stockRows` removed from the `cat` memo's dependency array (kept in the
  hook's signature only for parameter symmetry with `useSchluterCatalog`)
  — the wedi catalog is built from the book's rows, not the boot cache, so
  depending on it forced a full `buildCatalog()` on every unrelated
  boot-cache change.
- `loadBookItems` added to the effect's dependency array, so a
  late-arriving prop re-triggers the fetch instead of wedging the hook at
  `catReady: false` forever.
- A terminal `.catch(() => { if (alive) setLoaded({ ids: targetIds, rows:
  null }); })` added after the `.then` in the promise chain — the
  per-fetch `.catch(() => null)` only covers a rejected `loadBookItems(id)`
  promise, not a synchronous throw or a downstream `.then`/`.flat`/`.filter`
  error (e.g. a loader resolving `undefined` past the `l === null` check
  and then throwing inside `.filter`).
- `foldBookLists(lists)` and `gateOf({...})` extracted as exported pure
  functions, each independently unit-tested, with the gate's full
  transition table pinned including a named regression case for each
  Critical above.

**Parked, not fixed (per instruction):** the `setStockSource`-inside-
`useMemo` finding (an abandoned concurrent render mutating module state).
Recorded for the final whole-branch review; the install stays in the memo
as directed.

### Covering tests

`src/usewedicatalog.test.js` now has three tests (up from one):
1. `pickWediBooks` — extended with the `/\bwedi\b/i` negative case
   ("Swedish oak") and the `active: undefined` positive case.
2. `foldBookLists` — folds multiple successful lists, nulls on any failed
   fetch (including an `undefined` list), folds an empty book to `[]` (not
   `null`), and drops inactive/disabled rows.
3. `gateOf` — the three gate states plus the `bookStockReady: false` wait
   case, plus two named regression cases (stale rows from the no-book
   branch, and from a previous book id) and one for a book that adapts to
   nothing.

### Step 2 check: do the regression cases actually fail under the OLD gate?

Per the fix instructions, before finishing I reconstructed the OLD (round
1) gate arithmetic — no `loadedIds`/`targetIds` freshness check, `onBook`
gated on pre-adapter `rows.length` — as a standalone script and ran the
three pinned regression assertions from the amended test against it:

```
$ node scratchpad/oldgate_check.mjs
CONFIRMED FAILS under old code (good — it pins something real): REGRESSION A.1 (stale [] from no-book branch)
  old gate returned: { catReady: true, onBook: false }  new test expects: { catReady: false, onBook: false }
CONFIRMED FAILS under old code (good — it pins something real): REGRESSION A.2 (stale rows from previous book id)
  old gate returned: { catReady: true, onBook: true }  new test expects: { catReady: false, onBook: false }
CONFIRMED FAILS under old code (good — it pins something real): REGRESSION B (rows present, adapted to [])
  old gate returned: { catReady: true, onBook: true }  new test expects: { catReady: true, onBook: false }

3 of 3 regression assertions genuinely fail under the OLD gate arithmetic.
```

All three regression assertions mismatch the old code's output, confirming
they pin real behavior changes rather than passing vacuously under both
old and new arithmetic. (Script written to the session scratchpad, not
committed to the repo.)

### Commands and output

RED/GREEN cycle was not re-run from scratch (the module already existed
from round 1) — instead the amended test file was run directly against
the amended hook:

```
$ node --test src/usewedicatalog.test.js
✔ pickWediBooks: stock-kind, active, word-matching wedi on name or brandLabel (0.77ms)
✔ foldBookLists: any failed fetch nulls the whole result (0.15ms)
✔ gateOf: the three states, and the two ways a stale fallback used to slip through (0.15ms)
ℹ tests 3
ℹ pass 3
ℹ fail 0
```

Full suite:

```
$ npm test
ℹ tests 1234
ℹ pass 1234
ℹ fail 0
```

1234 = 1232 (round-1 baseline) − 1 (the old single `pickWediBooks` test,
replaced) + 3 (the new `pickWediBooks`, `foldBookLists`, `gateOf` tests) —
matches the coordinator's expected count exactly.

### Files changed (fix round 1)

- `C:\Users\User\Documents\Claude ReadWrite\Flooring-Tracker\src\usewedicatalog.js` (rewritten)
- `C:\Users\User\Documents\Claude ReadWrite\Flooring-Tracker\src\usewedicatalog.test.js` (rewritten)

No other files touched — `wedi.js`, `wediadapter.js`, `wedifixture.js`,
`pricebook.js`, `orderbook.js`, and `WediConfigurator.jsx` remain
untouched, confirmed via `git status --porcelain -- src/` showing only
these two files modified.

Commit: `703a8bd` — "fix: close two stale-pricing holes in useWediCatalog's gate"
