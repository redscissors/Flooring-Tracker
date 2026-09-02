# Task 2 report — src/wediadapter.js row mapping

## What I implemented

Created `src/wediadapter.js` verbatim from the brief, exporting:

- `usOf(row)` — the wedi US-SKU: excludes the row's own `sku` from `vendorSkus`,
  prefers a `US\d+`-shaped code, falls back to whatever's left, `""` when nothing
  qualifies. No fixup table.
- `descOf(row)` — `[size, thickness].filter(Boolean).join("x")` joined with
  `description`, whitespace collapsed/trimmed.
- `adaptRow(row)` — maps to `{erp, desc, cost, retail, unit, us}`, returns `null`
  when `usOf` is empty.
- `adaptBookRows(rows)` — `rows.map(adaptRow).filter(Boolean)`.

Merged the new `import { usOf, descOf, adaptRow, adaptBookRows } from "./wediadapter.js";`
line into the existing import block at the top of `src/wediadapter.test.js` (not a
stray mid-file import), and reused the existing `live()` helper — did not
redeclare it. Appended the brief's 7 new test cases verbatim after the two
existing fixture tests.

## TDD evidence

**RED** — `node --test src/wediadapter.test.js` (before creating wediadapter.js):

```
Error [ERR_MODULE_NOT_FOUND]: Cannot find module
'C:\Users\User\Documents\Claude ReadWrite\Flooring-Tracker\src\wediadapter.js'
imported from ...\src\wediadapter.test.js
...
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

Expected failure — the module didn't exist yet, exactly as the brief predicted.

**GREEN** — `node --test src/wediadapter.test.js` (after creating wediadapter.js):

```
✔ fixture: 152 persisted rows, the whole export including the placeholder
✔ fixture: normBookItem rehydrates the shape the adapter will see
✔ usOf: a US-shaped code beats a numeric article number, whatever the sort order
✔ usOf: the shop's own Product Code is never the vendor's code
✔ usOf: the ten-digit Subliner code is preserved, NOT corrected
✔ usOf: the custom-item placeholder derives nothing and is dropped
✔ adaptRow: one live row to the six-field stockRow shape
✔ adaptBookRows: 152 in, 151 out — only the placeholder drops
✔ descOf: the dimensions the importer moved to size/thickness come back inline
ℹ tests 9
ℹ pass 9
ℹ fail 0
```

All 9 passed on the first implementation attempt — no `descOf` join adjustment
was needed (Step 4's escape hatch was not used).

## Full suite

`node --test src/*.test.js`:

```
ℹ tests 1220
ℹ pass 1220
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

Matches the expected 1220 pass, 0 fail (1213 from Task 1 + 7 new — the two
existing fixture tests were already counted in the 1213).

## Files changed

- Created: `C:\Users\User\Documents\Claude ReadWrite\Flooring-Tracker\src\wediadapter.js`
- Modified: `C:\Users\User\Documents\Claude ReadWrite\Flooring-Tracker\src\wediadapter.test.js`
  (merged import line + appended 7 tests)

Commit: `24b0639` — "feat: wediadapter maps live book rows into makeEntry's stockRow shape"

## Self-review

- `git diff` for the test file shows only the one merged import line plus the
  seven test blocks, verbatim from the brief — no stray mid-file import, no
  redeclared `live()`.
- `adaptRow` returns exactly the six keys `{cost, desc, erp, retail, unit, us}` —
  confirmed by the sorted-keys assertion; no convenience fields were added.
- No fixup table for `usOf` — confirmed by reading the diff; 28954 passes
  through as `"US50000005"` untouched.
- YAGNI: no extra exports, no defensive code beyond the brief's own null guards
  (`if (!row) return ...`), which the brief's own implementation already
  specifies. Didn't add anything beyond what's asked.
- Comments carried over from the brief are non-trivial (business rules about
  why the join order matters, why no fixup table, which two rows repeat their
  own SKU in a vendor column) — consistent with the project's comment
  discipline (CLAUDE.md: comments reserved for non-obvious business rules).
- Naming matches the brief and the consuming file (`wedi.js`'s `makeEntry`)
  exactly: `erp`, `desc`, `cost`, `retail`, `unit`, `us`.

## Concerns

**`descOf` reconstruction fidelity**: only exercised against 2 of 151 rows here
(47815 — a roll with a plain size, and 47700 — a panel with size AND
thickness). Both passed on the first attempt with the brief's straightforward
`[size, thickness].join("x") + " " + description` join, so I did not need to
tune it. However, per the brief, Task 4 is where this gets proven against all
151 entries through `makeEntry`'s real `dims()` parser — there may be edge
cases among the other 149 rows (e.g., a row with `size` but no `thickness` and
an oddly-formatted description, or a row where the coverage figure moved to
`sfPerUnit` needs to reappear in `desc` too, which `descOf` does NOT restore
since the brief's version only reassembles size+thickness, not sfPerUnit). I
did not investigate this further since the brief explicitly scopes that proof
to Task 4 and warns against over-fitting to these three assertions — flagging
it here as directed rather than acting on it.

---

## Fix round 1 — descOf drops sfPerUnit (Important, reviewer finding)

### What changed

`src/wediadapter.js`, `descOf`: the coverage figure (`row.sfPerUnit`) is now
re-appended to the returned description, after the size/thickness lead and
the base description, as `"<n> SF"`:

```js
export function descOf(row) {
  if (!row) return "";
  const lead = [row.size, row.thickness].filter(Boolean).join("x");
  const cov = row.sfPerUnit > 0 ? `${row.sfPerUnit} SF` : "";
  return [lead, row.description, cov].filter(Boolean).join(" ").replace(/\s{2,}/g, " ").trim();
}
```

Minimal re-append, not a rewrite — the size/thickness join logic is untouched.

### Why this position is safe

Reviewer's scope note named four fixture rows carrying `sfPerUnit` (28954,
1518096, 1518097, 29542). I confirmed with the real fixture data, via
`normBookItem`/`descOf`, that appending last does not create a false
dimension match:

- `makeEntry`'s coverage regex (`wedi.js:4296-4298`,
  `/(\d+)\s*(?:sft|sf|ft2)\b/i`) matches "SF" case-insensitively with no
  slash/unit required, so a bare trailing `"322 SF"` matches and captures
  `322`.
- `dims()` (`wedi.js:3903`) matches `DIM_RE` **without** the `g` flag, so
  `.match()` returns only the FIRST occurrence. Since the size (e.g.
  `39"x98'`) always leads the reconstructed string, `dims()` locks onto that
  pair before it ever reaches the trailing coverage token. The appended `"<n>
  SF"` has no `x`/`×` in it, so even if `dims()` scanned further it could not
  form a second dimension match.

Verified directly against the real fixture rows (temporary script, deleted
after use, run from the project root):

```
node src/_check_tmp.mjs   (temporary — removed immediately after)
```

Output — reconstructed `desc` next to `dims()`'s parse, before vs. after the
fix showed **identical** `dims()` output (only the string grew a trailing
coverage token that `dims()` ignores):

```
28954   => "39\"x98' Wedi Subliner Dry - US50000005 322 SF"          dims: [39,1176]
1518096 => "50\"x25' Wedi S-Dry Membrane US5076009 104 SF"           dims: [50,300]
1518097 => "80\"x16' Wedi S-Dry XL Membrane US5076008 106 SF"        dims: [80,192]
29542   => "39\"x16' Wedi Subliner Dry Mat - US5000001 53 SF"        dims: [39,192]
47815   => "5\"x82' Wedi Mesh Tape - Self-Adhesvie Fiberglass"       dims: [5,984]
47700   => "3'x5'x1/2\" Wedi Building Panel - US8000017"             dims: [36,60,0.5]
```

47815/47700 (no `sfPerUnit`) are unchanged from the original implementation —
included as a control to confirm the fix doesn't touch rows that don't carry
coverage. 28954/1518096/1518097/29542 all still parse to the same w/d pair
their `size` field encodes.

I also confirmed the coverage regex itself extracts the right figure off each
reconstructed string:

```
39"x98' Wedi Subliner Dry - US50000005 322 SF -> 322
50"x25' Wedi S-Dry Membrane US5076009 104 SF -> 104
80"x16' Wedi S-Dry XL Membrane US5076008 106 SF -> 106
39"x16' Wedi Subliner Dry Mat - US5000001 53 SF -> 53
```

### Covering test added

`src/wediadapter.test.js`:

```js
test("descOf: a row's sfPerUnit coverage comes back in a form makeEntry's sf regex matches", () => {
  // 28954 carries sfPerUnit 322 (the importer split it out of the
  // description); wedi.js:4296-4298 matches /(\d+)\s*(?:sft|sf|ft2)\b/i
  // against desc to derive e.sf, so the figure has to survive the round trip.
  const d = descOf(live().find((x) => x.sku === "28954"));
  assert.match(d, /(\d+)\s*(?:sft|sf|ft2)\b/i);
  assert.equal(d.match(/(\d+)\s*(?:sft|sf|ft2)\b/i)[1], "322");
});
```

Uses the real fixture row through the existing `live()` helper, not a
hand-built literal, per the coordinator's instruction.

### Test evidence

Focused file — `node --test src/wediadapter.test.js`:

```
✔ fixture: 152 persisted rows, the whole export including the placeholder
✔ fixture: normBookItem rehydrates the shape the adapter will see
✔ usOf: a US-shaped code beats a numeric article number, whatever the sort order
✔ usOf: the shop's own Product Code is never the vendor's code
✔ usOf: the ten-digit Subliner code is preserved, NOT corrected
✔ usOf: the custom-item placeholder derives nothing and is dropped
✔ adaptRow: one live row to the six-field stockRow shape
✔ adaptBookRows: 152 in, 151 out — only the placeholder drops
✔ descOf: the dimensions the importer moved to size/thickness come back inline
✔ descOf: a row's sfPerUnit coverage comes back in a form makeEntry's sf regex matches
ℹ tests 10
ℹ pass 10
ℹ fail 0
```

Full suite — `node --test src/*.test.js`:

```
ℹ tests 1221
ℹ pass 1221
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

1221 = 1220 (prior baseline) + 1 new test, as the coordinator expected.

### Scope discipline

Did not touch `src/wedi.js`, `src/pricebook.js`, or `src/orderbook.js`. Did
not add a fixup table for the 28954 US-SKU (`usOf` is unchanged). Did not
weaken any existing assertion — all prior assertions in
`wediadapter.test.js` still pass unmodified.

### Commit

`4e984c8` — "fix: wediadapter descOf restores coverage into desc for
makeEntry's sf parse"
