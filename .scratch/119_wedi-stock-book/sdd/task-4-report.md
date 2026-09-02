# Task 4 report — the equivalence acceptance test

**Status: DONE.** Full suite 1231 pass, 0 fail.

This report has three parts. Sections 1-6 are the record as written when I
escalated, ending in DONE_WITH_CONCERNS; they are left exactly as they were.
"Fix round 1" records the resolution after the coordinator verified
the escalation, ruled the gap a defect in the plan, and amended it. "Fix round 2"
records the review fixes: the dangling-hyphen rule now bails when it cannot tell
which site the fraction came from, and a correction to an over-broad claim I made
in fix round 1.

> **As escalated (superseded by Fix round 1):** Tests 1 and 2 — the property the
> plan exists for — pass on all 151 stock entries with zero drift. Test 3 as
> briefed cannot pass: it deep-equals whole catalog entry objects, which carry
> the raw `desc` string, and `desc` is the one field the plan itself established
> is not byte-reproducible. Two entries reachable from the kit/solve output
> differ on `desc` only, for reasons inherent to the importer, not bugs in
> `descOf`. I did **not** narrow the comparison — the test file is committed
> byte-identical to the brief.

---

## 1. The test file as written

`src/wediequivalence.test.js` is byte-identical to the brief's code block.
Verified mechanically:

```
$ sed -n '16,87p' .superpowers/sdd/2026-09-01-wedi-stock-book/task-4-brief.md | tr -d '\r' > brief-test.js
$ tr -d '\r' < src/wediequivalence.test.js > actual-test.js
$ diff brief-test.js actual-test.js
72d71
< (closing markdown fence)
```

The sole difference is the closing fence of the brief's code block.
`DERIVED` is unchanged: no field renamed, none removed, no assertion relaxed.

> *(Superseded in part: test 3's body was later replaced with the amended plan's
> version — see Fix round 1. Tests 1 and 2 remain byte-identical to the brief.)*

---

## 2. Iteration history

### First run (RED)

```
$ node --test src/wediequivalence.test.js
X book-fed catalog is identical to the transcribed catalog, entry for entry
v every stock entry still classifies - nothing falls into misc
X the pinned engine totals do not move when the book feeds the catalog
tests 3   pass 1   fail 2
```

`assert.deepEqual` on a 151-element array names offending entries but elides the
rest, so I drove the iteration off a scratch script that walks the two halves
pairwise and prints, per mismatched entry, the transcribed `desc`, the
reconstructed `desc`, the raw `size`/`thickness`/`sfPerUnit`/`description`, and
every differing `DERIVED` field.

**First run: 4 of 151 entries failed**, across 5 field classes
(`name` x4, `t` x1, `w` x1, `d` x1, `sizeText` x1).

A structural finding that explains why the number was 4 and not 105: `makeEntry`
takes `name` from the *pricelist* row when one matches
(`const name = soRow ? String(soRow.name || "") : cleanDesc(stockRow.desc, ...)`),
and `dims()` reads `soRow.size` / `soRow.name` **before** `stockRow.desc`. So for
the 105 stock rows with a pricelist twin, `desc` barely reaches a derived field.
**46 stock entries have no pricelist row** (`soRetail === null`) — that is the
real risk set, and all 4 failures were in it.

### Failure classes and the four `descOf` changes

**Class A — the coverage token's spelling (2 entries: `US5076008`, `US5076009`).**

```
US5076008  table desc: 80"x16' Wedi S-Dry XL Membrane 106sf US5076008
           book  desc: 80"x16' Wedi S-Dry XL Membrane US5076008 106 SF
           name:  table "...Membrane 106sf"   book "...Membrane 106 SF"
```

These two have no pricelist twin, so `name` is `cleanDesc(desc)` and the
coverage token is *part of the display name*. Position was already right
(`cleanDesc` strips the US code and collapses whitespace, so trailing vs.
pre-code is equivalent); only the spelling was wrong.

*Change 1:* emit the coverage as `${row.sfPerUnit}sf`, the workbook's own
spelling, instead of `${row.sfPerUnit} SF`. Still matches makeEntry's
`/(\d+)\s*(?:sft|sf|ft2)\b/i`, still carries no `x`, so the dims-safety argument
in the docstring is unchanged. **Fixed 2 entries.**

**Class B — a bare non-integer size read as feet (1 entry: `US5076010`).**

```
US5076010  table desc: 3/16"x5/32" Wedi S-Dry Seal Trowel US5076010
           raw:        size "0.1875x0.15625", thickness "", sfPerUnit null
           w:        table 0.1875  book 2.25
           d:        table 0.15625 book 1.875
           sizeText: table '3/16" x 5/32"'  book '2 1/4" x 1 7/8"'
           name:     table '3/16"x5/32" ...'  book '0.1875x0.15625 ...'
```

The importer's `dimVal` flattens the sheet's fraction to a decimal and drops the
inch marks. `dims()` then hits its unit-less heuristic — every value <= 12 reads
as **feet** — and inflates a 3/16" trowel edge to 2 1/4".

*Change 2:* a new private `sizeOf(size)`. An **all-integer** bare `AxB` is
returned untouched, because `dims()`'s heuristic is load-bearing there and
correct — verified directly:

```
dims("4x8 Wedi Vapor 85")     = [ 48, 96 ]     <- the vapor panel is a 4'x8' sheet
dims('4"x8" Wedi Vapor 85')   = [ 4, 8 ]       <- marking it would break this
dims("0.1875x0.15625 Trowel") = [ 2.25, 1.875 ]
dims('3/16"x5/32" Trowel')    = [ 0.1875, 0.15625 ]
```

A **non-integer** bare size is the one unambiguous lossy case — a fractional
dimension is never feet — so both the fraction and the inch mark are restored,
spelled with the engine's own `inch()` (imported from `wedi.js`; no cycle,
`wedi.js` does not import the adapter) and hyphenated the way both sheets print
a mixed number (`5-3/4`, `3/16`). **Fixed 1 entry**, and also corrected
`075100052`'s and `US9320001`/`US9320002`'s size spelling.

**Class C — a thickness lifted from mid-string, re-led as a dimension
(1 entry: `075100052`).**

```
075100052  table desc: 32"x5-3/4" Wedi Riolito Neo - Drain Channel 27-1/2"
           raw:        size "32x5.75", thickness '1/2"',
                       description "Wedi Riolito Neo - Drain Channel 27-"
           t:    table null  book 0.5
           name: table '32"x5-3/4" ... Drain Channel 27-1/2"'
                 book  '32x5.75x1/2" ... Drain Channel 27-'
```

`splitSizeFromDescription` takes the **first inch-marked fraction anywhere** in
the string as `thickness` (`THICK_FRAC_RE = /(\d+)\s*\/\s*(\d+)\s*"/`,
pricebook.js:220) — here that was the `1/2"` of the *channel length* `27-1/2"`,
not a board thickness. Re-leading with it handed `dims()` a third value and
filed a channel length as `t`. The residue's dangling hyphen is the tell.

*Change 3:* when the residue ends on a hyphen, the fraction goes back **there**
instead of into the lead. **Fixed 1 entry.**

### Second run

```
TOTAL MISMATCHED ENTRIES: 0 of 151
FIELD CLASSES: {}

$ node --test src/wediequivalence.test.js
v book-fed catalog is identical to the transcribed catalog, entry for entry
v every stock entry still classifies - nothing falls into misc
X the pinned engine totals do not move when the book feeds the catalog
tests 3   pass 2   fail 1
```

Test 3's failure was `kitFor`/`solve` deep-equal on **`desc` only**. A
leaf-by-leaf walk of both trees:

```
.kit.lines.7.item.desc         table 'Wedi Sealing Collar - For 1/2" to 3/4" Pipe'
                               book  '1/2" Wedi Sealing Collar - For to 3/4" Pipe'
.solve.2.pieces.1.item.desc    table '24"x 48" Wedi Pan Extension - 073783528 1-1/2" to 2" slope'
                               book  '24x48x1/2" Wedi Pan Extension - 073783528 1- to 2" slope'
.solve.2.floorLines.1.item.desc  (same entry as above)
TOTAL LEAF DIFFS: 3
```

The `073783528` line exposed a **real bug my Change 3 had missed**: its dangling
hyphen is mid-string (`... 073783528 1- to 2" slope`), not at the end, so the
`/-$/` test did not fire and the `1/2"` of the slope range `1-1/2" to 2"` was
still being re-led as a board thickness.

*Change 3b:* generalise the tell from "ends on a dangling hyphen" to "holds a
dangling hyphen anywhere" — `/\d-(?=\s|$)/`, replacing the first occurrence,
which is sound because `THICK_FRAC_RE` takes the *first* fraction. This
reconstructs `1-1/2" to 2" slope` correctly and drops the spurious `x1/2"` from
the lead.

### Third (final) run

```
TOTAL MISMATCHED ENTRIES: 0 of 151
FIELD CLASSES: {}

.kit.lines.7.item.desc         table 'Wedi Sealing Collar - For 1/2" to 3/4" Pipe'
                               book  '1/2" Wedi Sealing Collar - For to 3/4" Pipe'
.solve.2.pieces.1.item.desc    table '24"x 48" Wedi Pan Extension - 073783528 1-1/2" to 2" slope'
                               book  '24x48 Wedi Pan Extension - 073783528 1-1/2" to 2" slope'
.solve.2.floorLines.1.item.desc  (same entry)
TOTAL LEAF DIFFS: 3
```

**Summary: 4 entries failed on the first run; 4 `descOf` changes across 3
iterations (coverage spelling, `sizeOf`, hyphen re-attachment, hyphen
generalisation).**

---

## 3. TDD evidence

**RED** (before any `descOf` change):

```
$ node --test src/wediequivalence.test.js
tests 3   pass 1   fail 2
```

**GREEN on the property under test** (after the `descOf` changes):

```
$ node --test src/wediequivalence.test.js
v book-fed catalog is identical to the transcribed catalog, entry for entry
v every stock entry still classifies - nothing falls into misc
X the pinned engine totals do not move when the book feeds the catalog
tests 3   pass 2   fail 1
```

**Pinned wedi tests, untouched and green:**

```
$ node --test src/wedi.test.js src/wediadapter.test.js src/wediquery.test.js
tests 58   pass 58   fail 0
```

**Full suite:**

```
$ node --test src/*.test.js
tests 1226   pass 1225   fail 1
```

1223 baseline + 3 new = 1226. The single failure is test 3, characterised below.

---

## 4. Files changed

- **`src/wediequivalence.test.js`** (new) — the brief's three tests, verbatim.
- **`src/wediadapter.js`** — `descOf` only, plus two new private helpers
  (`spell`, `sizeOf`) and `import { inch } from "./wedi.js"`.
  `usOf`, `adaptRow` and `adaptBookRows` are untouched.

Not touched: `src/wedi.js`, `src/pricebook.js`, `src/orderbook.js`,
`src/wedifixture.js`, `src/wedi.test.js`, `src/wediadapter.test.js`.

---

## 5. Self-review of the diff

- **Did any assertion weaken?** No. `src/wediequivalence.test.js` is
  byte-identical to the brief (diff above). `DERIVED` keeps all 19 fields under
  their original names. `src/wedi.test.js` and `src/wediadapter.test.js` are
  unmodified (`git status` shows only `wediadapter.js` modified plus the new
  test file).
- **Did anything outside `descOf` change?** Only the two helpers `descOf` calls
  and the `inch` import. `git diff` confirms no other function body moved.
- **Is the new `wedi.js` import a cycle?** No — `wedi.js` imports only
  `wediquery.js` and `showerdraw.js`; it does not import the adapter.
- **Is any rule tuned to a single row?** `sizeOf` and the hyphen rule are both
  stated as properties of what `splitSizeFromDescription` does (decimal
  flattening; first-fraction-anywhere), and each is justified against the
  counter-case that would break if applied more broadly (the 4x8 vapor panel;
  re-leading a channel length as `t`). The coverage-token change is a spelling,
  and the regex it has to satisfy is asserted independently in
  `wediadapter.test.js:78`.

---

## 6. Concerns — test 3 cannot pass, and the reason is inherent

`assert.deepEqual(after, before)` on `kitFor`/`solve` compares whole catalog
entry objects, and `makeEntry` carries the raw stock description through as
`e.desc` (`desc: (stockRow && stockRow.desc) || ""`, wedi.js:4192). `desc` is
precisely the field the plan established is **not** byte-reproducible and
deliberately excluded from `DERIVED` in test 1. **25 of the 151 stock entries
have a literally different `desc`**; test 3 happens to reach 2 of them.

Both residual differences are information the importer destroys *before the row
is persisted* — they are not `descOf` bugs, and no rule can recover them:

**(a) `US5000033` / erp 26896 — the removed fraction's position is gone.**

```
table  : Wedi Sealing Collar - For 1/2" to 3/4" Pipe
book   : 1/2" Wedi Sealing Collar - For to 3/4" Pipe
persisted row: size "", thickness '1/2"',
               description 'Wedi Sealing Collar - For to 3/4" Pipe'
```

`splitSizeFromDescription` does `s = s.replace(fr[0], " ")` and then
`s.split(/\s+/).filter(...).join(" ")`, so the double space that marked the
removal site is collapsed away. The persisted row (verified by dumping
`FIXTURE_ROWS.find(r => r.sku === "26896")`) carries no raw description and no
offset. The `1/2"` could have sat in any of five word gaps before the surviving
`3/4"`; nothing in the row distinguishes them. The dangling-hyphen tell that
rescues `075100052` and `073783528` does not exist here.

**(b) `073783528` / erp 29244 — the inch marks and the spacing are normalised away.**

```
table  : 24"x 48" Wedi Pan Extension - 073783528 1-1/2" to 2" slope
book   : 24x48 Wedi Pan Extension - 073783528 1-1/2" to 2" slope
persisted row: size "24x48"
```

`dimVal` reduces `24"x 48"` to the canonical `24x48` — both the inch marks *and*
the space after the `x` are gone. Even restoring the marks (which `sizeOf`
deliberately does not do for an all-integer bare size, because that would break
the 4x8 vapor panel — see the `dims()` transcript above) would produce
`24"x48"`, not `24"x 48"`. The transcriber's spacing is unrecoverable.

**What I did not do:** per the brief's hard constraint, I did not narrow test 3's
comparison, did not touch `makeEntry`, and did not remove `desc` from anything.

**For the controller to decide.** Test 1 already asserts the real property —
every field a quote depends on — across all 151 rows with zero drift. Test 3's
own comment says its purpose is that *"the pinned engine totals do not move"*,
and no total moves: the only three differing leaves in the whole `kitFor`/`solve`
tree are display strings on two entries, and neither entry's price, quantity or
geometry changes. The consistent resolution is to apply test 1's
already-justified `desc` exclusion to test 3 as well — e.g. compare the kit and
solve trees through a serialiser that drops `desc`, or assert on
`lines`/`pieces` key+qty+price rather than whole entries. That is a change to the
brief's own test, so I have left it to the controller rather than making it
myself.

A secondary note: `desc` reaching a user-visible surface unchanged is itself
worth a look downstream — for a stock row with no pricelist twin, `descOf`'s
reconstruction *is* the display name, and 25 of 151 rows will read slightly
differently from today's catalog even though every derived field is identical.
Tests 1 and 2 prove that difference is cosmetic, but the owner may want to see
the 25 strings before this ships.

---

# Fix round 1 — test 3 amended per the coordinator's ruling (plan commit a8663af)

**Status after this round: DONE. 1226 pass, 0 fail.**

The coordinator independently reproduced the leaf-diff, confirmed all 3 differing
leaves were `desc` on 2 entries with no price/quantity/key/geometry movement,
ruled the omission a defect in the plan rather than in this task's work, and
amended the plan with the exact test 3 body to use. Sections 1-6 above are the
record as written at escalation time and are unchanged; this section records the
fix.

## What changed

**Only the body of test 3 in `src/wediequivalence.test.js`.** Lifted verbatim
from the amended plan, `docs/superpowers/plans/2026-09-01-wedi-stock-book.md`
lines 546-588. Verified byte-for-byte:

```
$ sed -n '50,$p' src/wediequivalence.test.js > mine.js
$ sed -n '546,588p' docs/superpowers/plans/2026-09-01-wedi-stock-book.md | tr -d '\r' > plan.js
$ diff plan.js mine.js
(no output)
```

The change adds a recursive `stripDesc` helper and applies it to both trees
before the deep-equal, so `desc` is removed at every depth and **everything else
is still compared deeply** — no field subset, no totals-only reduction. Both
guard assertions are retained verbatim:

- `assert.ok(before && before.lines && before.lines.length, "guard: kitFor really built a kit")`
- `assert.ok(beforeSolve.length && beforeSolve[0].pieces[0].item.key === "US9100004", "guard: solve really returned the exact pan")`

They still run against the **unstripped** `before`/`beforeSolve`, so the kit is
proven non-empty and the exact pan proven returned before any stripping happens.

**Not changed:** `descOf` and `src/wediadapter.js` were not touched in this round
(`git status` showed only `src/wediequivalence.test.js` modified). Tests 1 and 2
are byte-identical to the previous commit — the diff is confined to the test 3
hunk.

## Covering tests

```
$ node --test src/wediequivalence.test.js
v book-fed catalog is identical to the transcribed catalog, entry for entry (8.3214ms)
v every stock entry still classifies - nothing falls into misc (1.6839ms)
v the pinned engine totals do not move when the book feeds the catalog (6.4447ms)
tests 3   suites 0   pass 3   fail 0   cancelled 0   skipped 0   todo 0
```

```
$ node --test src/*.test.js
tests 1226   suites 0   pass 1226   fail 0   cancelled 0   skipped 0   todo 0
```

1223 baseline + 3 new = 1226, zero failures, matching the plan's expectation.

## Evidence the stripped comparison still has teeth

Because "strip a field and deep-equal the rest" is exactly the shape a hollow
test takes, I mutation-probed it rather than asserting it is fine. Each probe
perturbs one adapted row, rebuilds both trees, strips `desc`, and reports whether
the assertion fires:

```
MISSED  baseline, no mutation (must be MISSED = trees identical)
CAUGHT  one cent on the pan's cost (US9100004)
CAUGHT  one cent on a consumable's retail (US5000070 fastener kit)
CAUGHT  a panel's unit EA -> BX (US8000017)
CAUGHT  a curb row dropped from the book entirely (US3000038)
MISSED  the pan extension's size dropped from desc (073783528 geometry)
MISSED  the pan's us re-keyed (US9100004 -> US9100099)
MISSED  the pan's geometry: 3'x5' -> 3'x4' in desc
```

A one-cent cost move, a one-cent retail move, a unit change and a missing row are
all caught.

> **CORRECTION (fix round 2).** The paragraph that stood here read the three
> MISSES as proof that "a pricelist twin makes any stock-desc mutation a no-op".
> The reviewer is right that this is over-broad and it is withdrawn. Twin
> existence protects `dims` **precedence only**, and even that conditionally:
> `wedi.js:4197-4200` walks `soRow.size`, `soRow.name`, `stockRow.desc` and
> stops at the first source that *yields* dims, so a twinned row whose pricelist
> strings do not parse still falls through to `stockRow.desc`. And `desc` reaches
> derived fields by two further routes the argument skipped entirely: `text` at
> `wedi.js:4206` concatenates `stockRow.desc` and drives `drain`, linear
> `channel`, subliner `sf`, kit `family` and the niche naming; and `e.desc` is
> passed to `finishOf` at `wedi.js:4269`, which reads `len` off it.
>
> The honest, narrower statement: **test 3 has no coverage of any desc-derived
> field**, and it does not need any — that coverage lives in **test 1**, which
> pins `name`, `finish`, `len`, `drain`, `channel`, `sf`, `w`, `d`, `t` and
> `sizeText` across all 151 rows, including the 46 twin-less ones where `descOf`
> is load-bearing. What the probe above does establish is that test 3 still
> catches cost, retail, unit and row-availability movement after `desc` is
> stripped, which is what it is there for.

For the record, the three MISSES were: a `desc` size edit on `073783528` and on
the pan `US9100004` (both rows' dims resolve from their pricelist twin's `size`,
so neither edit moved the output), and a `us` re-key on `US9100004` (overridden
by `const us = (soRow && soRow.us) || stockRow.us`, wedi.js:4167, since the
pricelist row for ERP 1504156 supplies the key). None of the three is evidence
about `desc` in general.

## Files changed in this round

- `src/wediequivalence.test.js` — test 3 body only.

Nothing else in `src/` was modified.

---

# Fix round 2 — the dangling-hyphen rule bails when the site is ambiguous

**Status after this round: DONE. Full suite 1231 pass, 0 fail.**

Review returned spec-compliant and Approved, with one Important finding and two
related Minors. Two rulings recorded first: the `import { inch } from "./wedi.js"`
plus the private `spell`/`sizeOf` helpers are **ratified** (adapter→engine import
is this codebase's established pattern — `schluteradapter.js:8` already imports
`classify` from `schluter.js`), and my mutation-probe conclusion from fix round 1
is **corrected** — see the CORRECTION block in that section, which withdraws the
over-broad claim and restates it narrowly.

## The finding

`src/wediadapter.js`, the dangling-hyphen rule as it stood:

```js
if (thick && /\d-(?=\s|$)/.test(desc)) {
  desc = desc.replace(/(\d)-(?=\s|$)/, "$1-" + thick);
  thick = "";
}
```

My justification did not carry. `THICK_FRAC_RE` taking the first fraction of the
**original** string says nothing about which `\d-(?=\s|$)` token in the
**residue** it was cut from. The fire condition is purely shape-based, so a row
with a genuine leading board thickness plus any coincidental digit-hyphen at a
word end has its real `t` silently glued into the display string and dropped from
the lead — `t` becomes null and `sizeText` goes with it. `descOf` runs on every
future vendor export, so that is silent geometry corruption on a row nobody has
read. Only the 151-row pin says today's data contains no such row.

## What changed (src/wediadapter.js, `descOf` only)

**1. Bail when the site is ambiguous.** Candidates are now matched globally and
the rule fires **only when there is exactly one**. Two or more fall back to the
lead — the older, known behavior — instead of a coin flip. The invariant is
stated in the docstring.

**2. The latent `$` bug is fixed.** `"$1-" + thick` put `thick` — data off a
vendor row — in a `String.replace` replacement position, where a `$` in it is
read as a pattern reference. It now goes through a replace **function**.

**3. The duplicated pattern is hoisted.** `/\d-(?=\s|$)/` and `/(\d)-(?=\s|$)/`
had to be kept in sync by hand. There is now one source, `HYPHEN_SITE`, with the
global counter derived from it (`new RegExp(HYPHEN_SITE.source, "g")`).

```js
const sites = desc.match(HYPHEN_SITES);
if (thick && sites && sites.length === 1) {
  desc = desc.replace(HYPHEN_SITE, (m) => m + thick);
  thick = "";
}
```

Nothing outside `descOf` and the two hoisted constants changed. `wedi.js`,
`pricebook.js`, `orderbook.js` and `wedifixture.js` were not touched.

## Covering tests (src/wediadapter.test.js, +5)

All four contracts the review asked for, plus a regression test for the `$` bug.
Synthetic rows — these are contracts about the rules, not facts about the fixture.

```
v descOf/sizeOf: an all-integer bare size stays bare - dims() owns the feet-or-inches call
v descOf/sizeOf: a non-integer bare size gets its fraction and inch mark back
v descOf: a lone dangling hyphen takes the lifted fraction back, wherever it sits
v descOf: an AMBIGUOUS residue does not reattach - the thickness stays in the lead
v descOf: the reattached thickness is inserted literally, never as a replacement pattern
```

The tests assert the reconstructed string **and** what `dims()` then reads off
it, so they pin the consequence rather than the spelling: the 4x8 vapor sheet
still measures `[48, 96]`; the seal trowel becomes `[0.1875, 0.15625]` instead of
`[2.25, 1.875]`; the reattached channel length yields two dims, not three; and
the ambiguous row keeps `[48, 96, 0.5]`.

**RED first.** I reverted `descOf` to the old rule verbatim and re-ran, to
confirm the new tests fail for the stated reasons rather than passing vacuously:

```
$ node --test src/wediadapter.test.js        # with the OLD rule in place
X descOf: an AMBIGUOUS residue does not reattach - the thickness stays in the lead
  + actual   `4'x8' Wedi Building Panel - Type 3-1/2" and Type 7- runs`
  - expected `4'x8'x1/2" Wedi Building Panel - Type 3- and Type 7- runs`
X descOf: the reattached thickness is inserted literally, never as a replacement pattern
  + actual   'Widget 1-1-'
  - expected 'Widget 1-$&'
tests 15   pass 13   fail 2
```

That is the finding reproduced exactly: the genuine 1/2" board thickness is glued
onto a coincidental `3-` token and dropped from the lead (so `dims()` returns
`[48, 96]` and `t` is lost), and `$&` in the replacement expands to the match.
The two "lone dangling hyphen" cases pass under the old rule too — correctly, the
old rule handled the unambiguous case — so the new tests target the defects and
nothing else.

## Commands and output

```
$ node --test src/wediadapter.test.js
tests 15   pass 15   fail 0

$ node --test src/wediequivalence.test.js
v book-fed catalog is identical to the transcribed catalog, entry for entry (8.3509ms)
v every stock entry still classifies - nothing falls into misc (1.7154ms)
v the pinned engine totals do not move when the book feeds the catalog (6.469ms)
tests 3   pass 3   fail 0

$ node --test src/*.test.js
tests 1231   suites 0   pass 1231   fail 0
```

1226 + 5 new adapter tests = 1231.

## The bail changed none of the 151

Asked directly rather than inferred from the suite staying green — of the 151
adapted rows, tallied by how many dangling-hyphen candidates their residue holds:

```
adapted rows: 151 | carrying a thickness: 11
  0 candidates  (lead, unchanged):                  7
  1 candidate   (reattaches, unchanged by the bail): 4  073783528, 075100052, US9320001, US9320002
  2+ candidates (NEW: bails to the lead):            0
```

No fixture row reaches the new path, so the 151-row equivalence is untouched by
construction, not just by observation — which is precisely why the ambiguous case
needed a direct unit test rather than relying on the aggregate pin.

## Files changed in this round

- `src/wediadapter.js` — `descOf` plus the two hoisted `HYPHEN_SITE` constants.
- `src/wediadapter.test.js` — 5 new tests, one added `dims` import. No existing
  test modified.
- `.superpowers/sdd/2026-09-01-wedi-stock-book/task-4-report.md` — this section,
  and the CORRECTION block in fix round 1.
