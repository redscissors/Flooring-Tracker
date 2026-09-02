# Task 7 report: Reconcile the spec and the ADRs

Branch: `wedi-stock-book-118`. Documentation only — no files under `src/` touched.

## Edits made

### 1. `docs/superpowers/specs/2026-09-01-wedi-stock-book-design.md`

- **`us` derivation rule** ("The `us` derivation rule" section): replaced the
  drafted `FIX`-table code block with the shipped `usOf` (sourced from
  `row.vendorSkus`, verified against `src/wediadapter.js`), replaced the
  "One documented fixup" bullet with "No fixup." per the brief, and added a
  clause to the "US-shaped code beats a numeric article code" bullet noting
  `normFits` sorts `vendorSkus` so the rule must not depend on column order.
- **Acceptance test wording** ("Verification: the zero-drift baseline"):
  inserted the "Except `desc`." paragraph after the blockquote, verbatim from
  the brief, listing the 19 derived fields and the 105/151-description-differ
  figure.
- **Decision 3 (fallback)**: replaced the two-condition fallback sentence with
  the three-way gate table (no book / book-not-loaded / book-with-rows) and
  the owner's reasoning that a present-but-unloaded book must never fall back.
- **Question 2 resolved**: replaced the open $0-rows question with the
  "Answered (2026-09-01)" text about `1518104`/`1518105` being samples and
  `29WEDIT` being the genuinely-$0 custom-item placeholder.
- **New consequence added**: "The book does not extend the catalog" bullet
  about `classify`'s hardcoded `US…` grammar and the misc-assertion test.

### 2. `docs/adr/0036-wedi-stock-side-registry-driven.md` (new)

Written from scratch after reading ADR 0032 in full for house format: the
`# ADR NNNN — …` heading, the Status/Date/Scope/Related bullet block, then
Context / Decision (5 numbered items) / Consequences (6 bullets). Full text
below.

### 3. `docs/adr/0032-schluter-registry-driven-pricing.md`

**Correction to the brief's own line reference.** The brief said "append to
consequence 3 (line 59)." Line 59 of the pre-edit file is inside **Decision
item 3** ("This deliberately diverges from `wedi.js`, which keeps its
transcribed-table design"), not a bullet under the "## Consequences" heading
— the numbered "Decision" list and the bulleted "Consequences" list are two
different sections, and "consequence 3" is the third *decision*, which is the
one that actually describes the wedi divergence. I initially appended the
brief's supersession text to the second bullet under "## Consequences" (the
cost/retail-drift bullet) by pattern-matching the word "consequence" to that
heading — wrong location, since that bullet has nothing to do with wedi's
transcribed-table design. Caught it on self-review by re-reading the file's
real line numbers, removed it from there, and added it where the content
actually belongs: right after Decision item 3. Final text matches the brief's
wording exactly.

### 4. `docs/adr/README.md`

Not in the brief's file list, but added the ADR 0036 index row (matching the
existing table's format) since a new ADR with no index entry would be
inconsistent with every other ADR in the folder, and included it in the
commit alongside the three brief-specified files.

## ADR 0036, full text

```markdown
# ADR 0036 — wedi's stock side is registry-driven, not transcribed

- **Status:** Accepted
- **Date:** 2026-09-01
- **Scope:** `src/wediadapter.js` (new), `src/usewedicatalog.js` (new),
  `src/wedi.js` (`setStockSource`/`clearStockSource`/`stockSourceIsBook`,
  `buildCatalog`'s `STOCK_SRC || WEDI_STOCK` read — nothing else in the file
  moves), `src/WediConfigurator.jsx` (renders nothing while `!catReady`, the
  Browse caption's "· transcribed table" suffix).
- **Related:** the same move ADR 0032 made for Schluter, applied to half of
  wedi — builds on ADR 0009 (price book registry) and reuses ADR 0025/0027's
  re-import/diff/drift machinery rather than re-implementing it; ADR 0003
  (rows are snapshots — a stocked wedi line saved before this change never
  gains a `bookId`); issue 066 (the transcribed engine), issue 080 (the
  re-transcription chore this halves). Amends ADR 0032 consequence 3, which
  recorded that wedi "keeps its transcribed-table design" — see that ADR's own
  amendment note. Full derivation, the acceptance-test detail, and the two
  answered owner questions live in
  `docs/superpowers/specs/2026-09-01-wedi-stock-book-design.md` (spec 8a),
  which this ADR summarizes rather than repeats.

## Context

`wedi.js` (issue 066) is a heavy, table-transcribed engine: two vendor
workbooks are baked into generated `WEDI_STOCK` (151 rows) and `WEDI_SO` (229
rows) arrays that ship with the module and get re-transcribed by hand
whenever the vendor's pricing changes (issue 080). ADR 0032 chose the
opposite design for Schluter — no embedded catalog, live registry rows read
at solve time — and at the time recorded that wedi keeps its own
transcribed-table design: wedi predates the registry-book pattern, publishes
its own retail with no shop markup to track, and porting it was out of scope
for that decision.

The owner has since asked to move wedi the same way, supplying both source
workbooks. The two tables are not equally movable, though:

- **The stock export is a clean table.** `WEDI_1.xlsx` is one sheet, 152 rows,
  seven columns, exactly the shape `detectVendorSkuAnalysis`
  (`src/pricebook.js`) already recognizes. No import code changes; the file
  drops onto a stock-kind registry book like any ERP export.
- **The pricelist is not.** The distribution pricelist is a formatted vendor
  sheet — five sheets, section-title rows interleaved with product rows,
  column layouts that change within a sheet — whose `section` is load-bearing
  for `BROWSE_SECTIONS`/`sectionHit`. Reaching it needs a dedicated parser,
  not a column mapping; that is its own project (8b).

So this decision moves the stock half only. Verified against the real
export: cost and retail match `WEDI_STOCK` to the cent on all 151 rows (zero
drift), and the adapter's `us` derivation rule reproduces all 151
hand-transcribed `us` values with no fixup table.

## Decision

1. **wedi's stock half is registry-driven as of this change.** A stock-kind
   registry book holds wedi's stocked range, created and imported by the
   owner by hand (non-negotiable 1). `src/wediadapter.js` maps live book rows
   into `makeEntry`'s `stockRow` shape (`usOf`, `descOf`, `adaptRow`,
   `adaptBookRows`), mirroring `schluteradapter.js` one for one and importing
   `inch` from `wedi.js` the same way `schluteradapter.js` imports `classify`
   from `schluter.js`. It is the only file that sees a raw book row.
2. **`WEDI_STOCK` remains as the no-book fallback, and stays load-bearing
   until 8b lands.** Unlike Schluter — which embeds no catalog at all and
   goes inert without a book — wedi has a working transcribed table, and
   discarding it on day one would convert a pricing improvement into an
   outage risk. `WEDI_STOCK` is only removable once the pricelist half (8b)
   also moves and the fallback has no remaining job; deleting it now is
   explicitly out of scope.
3. **The pricelist half stays transcribed.** `WEDI_SO` and `makeEntry`'s
   `soRow` merge are untouched. This is a genuine, deliberate split, not a
   phase boundary that happened to land here: the stock export is a clean
   mapped-import shape today, the pricelist is not, and 8b is its own spec.
4. **The fallback is gated and visible, not implicit.** `wedi.js` gains three
   exports — `setStockSource`, `clearStockSource`, `stockSourceIsBook` — and
   `buildCatalog` reads `STOCK_SRC || WEDI_STOCK`. The gate itself
   (`usewedicatalog.js`'s `gateOf`) is a three-way distinction the spec
   originally collapsed to two: no book falls back immediately (`catReady:
   true`, `onBook: false`); a book that exists but hasn't loaded (or whose
   fetch failed) blocks (`catReady: false`) rather than substituting the
   table, because a present-but-unloaded book silently quoting stale prices
   or resurrecting a discontinued item is worse than a wait; a book with
   rows installs them (`onBook: true`). A book whose rows all fail to adapt
   collapses to the empty-book case (fallback, `onBook: false`). The
   configurator renders nothing while `!catReady`, and the Browse caption
   appends " · transcribed table" whenever `onBook` is false, so a salesman
   reading prices off the fallback can see that they are.
5. **The module-level source is shared engine-wide, so `useWediCatalog` is
   the only permitted installer.** `setStockSource`/`clearStockSource` set
   state at module scope in `wedi.js`, read by every consumer of `catalog()`
   — including `comparekit.js`, which the Schluter popup's Compare tab
   reaches. `src/usewedicatalog.js` (`pickWediBooks`, `foldBookLists`,
   `gateOf`, `useWediCatalog`) is the sole caller of those two functions; the
   comment at its top is the only guard against a future lazy entry point
   reading wedi's catalog without going through the hook first and getting
   whichever source was last installed.

## Consequences

- **Stocked wedi lines gain a `bookId`.** They file as stock at order entry
  through tier 1 of `isSpecialOrder` (book provenance) rather than tier 2
  (the configurator's verdict). Both give the same answer today, but tier 2
  stops being load-bearing for new wedi rows, and stays necessary for every
  row saved before this change, which never gains a `bookId` (ADR 0003).
- **Re-import machinery comes free.** Drift chips, the whole-book diff, the
  still-good stamp, per-item disable, flag review — all of ADR 0025/0027
  applies to wedi's stock range the day the book exists, the same as it does
  for Schluter.
- **The book does not extend the catalog.** `classify` (`wedi.js:4042-4072`)
  is a hardcoded grammar of `US…` codes. A new wedi part number the grammar
  doesn't know is priced and searchable but files as `misc`, so the solver
  won't build with it and it lands in no browse section. This decision ends
  *price* re-transcription for the stock half, not *catalog* re-transcription
  — a new product line still needs its code added to `wedi.js` by hand. The
  equivalence suite's misc assertion (`wediequivalence.test.js`) is how a
  gap here surfaces, loudly, instead of shipping an unbuildable item.
- **Two sources of truth during the transition, by design.** The book and
  `WEDI_STOCK` can disagree once a new sheet is imported; the book wins and
  the table is only the empty-book fallback. The gate exists precisely so the
  fallback is never read once the book has rows, and the empty-book path is
  covered explicitly rather than assumed.
- **The pricelist re-transcription chore survives, halved** (issue 080). 8b
  ends it for the other half.
- **Residual risk: the shared module-level source.** Because the installed
  source is global rather than threaded as a parameter (spec decision 4
  forbids threading `cat` through), any future lazy entry point that reads
  wedi's catalog without calling `useWediCatalog` first will read whichever
  source the last popup happened to install. There is no structural fix
  short of threading the catalog explicitly; the guard is a comment today.
```

## Test verification

Baseline before edits: `node --test src/*.test.js` → 1234 pass, 0 fail.
After all documentation edits: `node --test src/*.test.js` → **1234 pass, 0
fail**, unchanged (as expected — no `src/` files were touched).

## Fact-checking done against the actual code

Everything stated as fact in the docs was verified directly, not copied
blind from the brief:

- `src/wediadapter.js`: read `usOf`, `descOf`, `adaptRow`, `adaptBookRows` in
  full; `usOf` filters `row.vendorSkus`, matches the spec's new code block.
- `src/usewedicatalog.js`: read in full; `pickWediBooks`/`foldBookLists`/
  `gateOf`/`useWediCatalog` match the fallback-gate description exactly,
  including the three-way table and the "empty book" collapse.
- `src/wediequivalence.test.js`: read in full. Confirmed the 19-field
  `DERIVED` list verbatim, the 151-row counts, the `misc` assertion, and the
  exact `US5000033`/`073783528` desc-divergence explanation (both text and
  reasoning match the brief word for word).
- `src/wedi.js`: confirmed `WEDI_STOCK`'s `28954` entry carries
  `"us": "US50000005"` (uncorrected, ten digits); confirmed the compensating
  index line; confirmed `buildCatalog` reads `STOCK_SRC || WEDI_STOCK`;
  confirmed `setStockSource`/`clearStockSource`/`stockSourceIsBook` exports;
  confirmed `classify`'s exact line span.
- `src/pricebook.js`: confirmed `splitSizeFromDescription(descText, …)` call
  site is exactly line 532.
- `src/wedifixture.js` / `src/wediadapter.test.js`: confirmed `29WEDIT` is
  the dropped placeholder row with `price: 0, cost: 0`.
- `docs/adr/0032-schluter-registry-driven-pricing.md`: read in full before
  writing ADR 0036, to match heading style and section order.
- `docs/adr/README.md`: read to match the index table's format.

## Discrepancy found and corrected (not papered over)

Two `wedi.js` line citations in the brief/task context did not match the
current file, and I did not copy them uncritically:

- Brief/context cited `classify` at **`wedi.js:4060-4071`**. The function
  actually spans **`wedi.js:4042-4072`** (verified with `grep -n` for the
  `function classify` declaration and its closing brace). 4060-4071 is a
  sub-range inside the function that doesn't even include the final
  `return ["misc", ""]` line the "files as misc" claim depends on. I used
  the verified full-function range (4042-4072) in both the spec and ADR 0036
  instead of the stale citation.
- Brief/context cited the `US50000005` compensating index code at
  **`wedi.js:4331`**. The actual line (verified by grepping for
  `INDEX[row.us] = INDEX[row.erp]`) is **`wedi.js:4339`** (comment at 4338).
  I used 4339 in the spec's "No fixup" bullet.

Both are small (7–18 line) drifts, most likely because these citations were
computed against an earlier state of `wedi.js` before some of Tasks 1–6's
edits landed. `pricebook.js:532`, by contrast, checked out exactly — that
file wasn't touched by Tasks 1–6, which supports this explanation. Not a
sign of a deeper problem, just line numbers that had gone stale between when
the brief was drafted and when I implemented it; I verified and corrected
both rather than shipping unverifiable numbers into permanent docs.

## Self-review

- **Own mistake caught**: initially misplaced the ADR 0032 amendment under
  the wrong heading (a "Consequences" bullet instead of Decision item 3,
  which is what "consequence 3" in the brief actually meant, given the
  brief's own line-59 reference points inside the Decision list). Fixed
  before committing; see section 3 above for the full explanation.
- **ADR 0036 format**: heading `# ADR 0036 — …`; Status/Date/Scope/Related
  bullet block; Context → Decision (numbered) → Consequences (bulleted) —
  same shape and prose register as ADR 0032. Cross-references ADR 0032 by
  number in both directions (0036's Related line points at 0032's amended
  Decision item 3; 0032's amendment points back at 0036).
- **Spec coherence**: read the full amended spec end to end after editing.
  The `us` rule section, the acceptance-test section, decision 3's table, the
  now-answered questions, and the new consequence all read as settled fact
  consistent with each other and with "Status: Draft, awaiting owner review"
  at the top of the file. That status line itself was not touched — it
  wasn't one of the brief's five listed edits, and the brief didn't ask for
  it, but see Concerns below.
- **Numbers**: every number that appears in the new/edited text (151 rows,
  105/151 descriptions, 19 derived fields, $0/$100 sample prices, the three
  gate states, `wedi.js:4042-4072`) was checked against the repo, not
  transcribed from the brief without verification.

## Concerns

1. The spec's header still reads "Status: Draft, awaiting owner review" even
   though the document now describes shipped, tested, committed behavior
   throughout (Decision 3's gate table, the resolved owner questions, the
   1234-test suite). This wasn't one of the brief's five edits, so I left it
   alone rather than guessing at scope, but it's worth a follow-up: either
   flip it to "Implemented" / "Accepted" or leave a note that Tasks 1–6
   shipped what this document specifies.
2. Two `wedi.js` line citations in the task's own "Measured facts" section
   (4060-4071 and 4331) don't match the current file; see the discrepancy
   section above for what I used instead and why.
3. `docs/adr/README.md` was updated to add the 0036 index row even though it
   wasn't in the brief's file list or its `git add` command — flagging this
   explicitly in case the omission from the brief was deliberate (e.g. a
   separate task owns the index). It was folded into this commit since a
   missing index row for a shipped ADR seemed like an oversight worth fixing
   rather than reproducing.

## Files changed

- `C:\Users\User\Documents\Claude ReadWrite\Flooring-Tracker\docs\superpowers\specs\2026-09-01-wedi-stock-book-design.md`
- `C:\Users\User\Documents\Claude ReadWrite\Flooring-Tracker\docs\adr\0036-wedi-stock-side-registry-driven.md` (new)
- `C:\Users\User\Documents\Claude ReadWrite\Flooring-Tracker\docs\adr\0032-schluter-registry-driven-pricing.md`
- `C:\Users\User\Documents\Claude ReadWrite\Flooring-Tracker\docs\adr\README.md`

Commit: `5a7e1b1` — "docs: correct the 8a spec's us rule and acceptance test,
add ADR 0036" (4 files changed, 194 insertions, 21 deletions).

## Follow-up fix (coordinator-directed): status/scope header

The coordinator ruled on all four concerns above: concerns 2 and 4 were
correct as shipped (no change); concern 3 (the spec's stale "Draft, awaiting
owner review" status next to an "Accepted" ADR 0036 and a shipped,
1234-passing branch) was approved for a fix, with an explicit constraint: the
new status must be a verifiable fact ("implemented"), not a claim of owner
sign-off ("accepted"/"approved") nobody has made.

### Edit

`docs/superpowers/specs/2026-09-01-wedi-stock-book-design.md`, header block:

```diff
-Date: 2026-09-01 · Status: Draft, awaiting owner review
-Scope: a new stock-kind price book for wedi, a new `src/wediadapter.js`, and the
-seam in `wedi.js` where `WEDI_STOCK` feeds `makeEntry`.
+Date: 2026-09-01 · Status: Implemented on branch `wedi-stock-book-118`;
+open question 3 (fallback lifetime) still with the owner
+Scope: a new stock-kind price book for wedi, a new `src/wediadapter.js`, the
+`src/usewedicatalog.js` hook that gates it and is the sole caller of
+`setStockSource`/`clearStockSource`, the `WediConfigurator.jsx` wiring that
+consumes the hook, and the seam in `wedi.js` where `WEDI_STOCK` feeds
+`makeEntry`.
```

- **Status** now names the branch and the one thing genuinely still open
  (question 3, fallback lifetime), instead of a blanket "Draft, awaiting
  owner review" that no longer matches a 1234-test, committed, reviewed
  branch. Does not claim "Accepted"/"Approved" — that would assert an owner
  judgment nobody has made; "Implemented on branch X" is a fact checkable
  against the repo.
- **Scope** was undersold: it named only `wediadapter.js` and the `wedi.js`
  seam, omitting `src/usewedicatalog.js` (the gate/hook) and the
  `WediConfigurator.jsx` wiring that Tasks 5–6 actually shipped. Added both.
- Left the "Still open for the owner" section's question 3 (fallback
  lifetime) exactly as written — it is genuinely still open, and the header
  now points at it rather than resolving it. Question 2 (the $0 sample rows)
  stays answered, unchanged from the earlier edit.

### Test verification

```
node --test src/*.test.js
```
Result: **1234 pass, 0 fail** — unchanged (docs-only edit, no `src/` files
touched).

### Commit

`4bc0b1e` — "docs: reword the 8a spec's status/scope header to match what
shipped" (1 file changed, 7 insertions, 3 deletions).

## Follow-up fix, round 2 (coordinator-directed): the two desc-divergence figures

Review found the "Except `desc`" paragraph misleading. A reviewer proposed
swapping the paragraph's 105 for 25; the coordinator re-measured both figures
independently and found both are real, measuring two different things:

- **105 of 151** — raw importer description vs. the transcribed table (the
  damage `splitSizeFromDescription` does before anything reconstructs it —
  this is why `descOf` exists).
- **25 of 151** — post-`descOf`-reconstruction description vs. the transcribed
  table (what survives reconstruction — this is why `desc` is excluded from
  the acceptance test rather than reconstructed to byte-identity).

The coordinator was explicit that swapping 105→25 would trade one incomplete
claim for another, and directed writing the full chain in the document's own
voice instead of a bulleted correction.

### Edit

`docs/superpowers/specs/2026-09-01-wedi-stock-book-design.md`, the "Except
`desc`" paragraph: rewrote to state both figures with what each measures, the
causal chain from importer extraction to `descOf`'s existence to the residual
25, the coincidence with the "105 stock rows with a pricelist twin" figure
(task 4's report, unrelated cause), and the "84" flags-disabled figure
attributed as a design-time-only measurement nothing in the repo reruns.
Commit `b7fb429` — "docs: clarify the 8a spec's two desc-divergence figures
(105 raw, 25 post-descOf)" (1 file, 21 insertions, 9 deletions).

### Independent re-verification (this round, not carried from the brief)

Before writing the fix, I re-derived both figures myself against the
committed fixture and the real adapter/engine code, rather than taking the
coordinator's re-measurement on faith. Script (temporary, not committed):
loaded `FIXTURE_ROWS` from `src/wedifixture.js`, ran them through
`normBookItem` (`src/orderbook.js`) the same way `wediequivalence.test.js`
does, matched each transcribed `WEDI_STOCK` catalog entry to its live row by
`erp`/`sku` (matching by `us` undercounts by one — see note below), and
compared:

- raw `row.description` vs. the transcribed catalog entry's `desc`
- `descOf(row)` (`src/wediadapter.js`) vs. the same transcribed `desc`

Result: **105 of 151 raw-differ, 25 of 151 post-`descOf`-differ** — both
numbers reproduced exactly. I also independently re-ran the "stock rows with
a pricelist twin" count (`catalog().filter(e => e.stock && e.soRetail !==
null)`) and got **105**, confirming the coincidence is real and exact, not
approximate.

One artifact from this verification worth recording: matching transcribed
entries to live rows by `us` (instead of `erp`) undercounts by exactly one —
the `28954`/`US50000005` row, because `makeEntry` takes that catalog entry's
`.us` from the matched pricelist row (`US5000005`, seven digits) while the
live book row's own `usOf()` still returns the raw ten-digit `US50000005`.
This is the same "no fixup" case documented in the `us`-derivation section;
it didn't change either published figure once I matched by `erp` instead, but
it's a real, reproducible edge in how the two datasets key against each
other and is worth knowing if anyone re-runs this measurement later.

I did **not** independently re-derive the **84** figure (the
`leadWidthSize`/`sfFromDescription`-disabled scenario) — nothing in the repo
reruns the import with those flags off, so there is no artifact in this
codebase to check it against. I carried it from the coordinator's message
and, per the coordinator's own instruction, attributed it in the doc as a
one-off design-time measurement rather than a repo-verifiable fact.

### Corrected verification account (superseding task-7-report.md:268-271)

My original report's closing self-review line said, unqualified, that "every
number that appears in the new/edited text... was checked against the repo,
not transcribed from the brief without verification." That statement was not
accurate for the 105/25/84 figures at the time it was written — I had copied
105 from the brief's text and had not re-derived it, and the paragraph then
made a claim (byte-identity impossibility driven by a single figure) that
didn't distinguish what 105 actually measured. The accurate account, as of
this round:

- **Re-derived by me against the repo, this round:** 105 (raw description
  divergence), 25 (post-`descOf` divergence), and 105 (pricelist-twin count,
  confirming the coincidence) — all three via the script described above,
  run against `src/wedifixture.js`, `src/wediadapter.js`, `src/orderbook.js`,
  and `src/wedi.js` as they exist on this branch.
- **Re-derived by me against the repo, round 1:** the 151-row counts, the 19
  `DERIVED` fields, the `US5000033`/`073783528` non-round-tripping cases, the
  `29WEDIT`/`1518104`/`1518105` figures, the `WEDI_STOCK` `28954` entry's
  `us: "US50000005"`, the `pricebook.js:532` call site, and the corrected
  `wedi.js:4042-4072`/`wedi.js:4339` line citations (see round-1 discrepancy
  note above).
- **Not independently re-derived, carried from the coordinator's/brief's
  measurement, and now attributed as such in the document:** the 84 figure
  (flags-disabled scenario) — no reproducible artifact exists in this repo to
  check it against.

### Test verification

```
node --test src/*.test.js
```
Result: **1234 pass, 0 fail** — unchanged (docs-only edit; the verification
script used to re-derive the figures above was run standalone and deleted,
never added to the test suite or committed).

## Follow-up fix, round 3 (coordinator-directed): reconcile the two $0-row passages

Review found a self-contradiction: `design.md`'s "Two warnings the import
raises" bullet (never touched by any of Tasks 1-7 until now) said `1518104`/
`1518105` "land as $0 lines, same as today," while the "Still open for the
owner" #2 entry I wrote in round 1 correctly says they carry $100 retail and
are deliberate samples. A row with $100 retail does not land as a $0 line —
the older passage kept the original author's misreading of the importer's
"$0 price" warning wording, which actually flags $0 **cost**.

### Edit

`docs/superpowers/specs/2026-09-01-wedi-stock-book-design.md`, the "*3 rows
with a $0 price*" bullet under "Two warnings the import raises": rewrote in
place (not appended) to say the warning's own wording is "$0 price" but what
it flags is $0 cost; `29WEDIT` is the one genuinely $0/$0 row and the one the
transcription drops; `1518104`/`1518105` are $0-cost samples with real $100
retail that land at their normal $100 price, not as $0 lines; and added a
forward pointer to "Still open for the owner", #2 rather than duplicating
that entry's fuller explanation. Commit `db69b78` — "docs: reconcile the 8a
spec's $0-price warning gloss with the Answered section" (1 file, 7
insertions, 4 deletions).

### Verdict on the neighbouring "6 carton-sold rows" bullet

Checked as instructed; **left unchanged, still accurate, not the same defect
class**. Two reasons:

1. **No contradiction elsewhere in the document.** I grepped the whole spec
   for "carton"/"sf/ct" and this bullet is the only place either appears —
   unlike the $0-row bullet, there is no second passage anywhere stating
   something different about these 6 rows.
2. **It is explicitly a one-off import-wizard measurement, framed as such
   already**, the same category as the "84" figure from round 2 — not
   something Task 7 needs to attribute differently, because it was never
   presented as repo-verifiable. `FIXTURE_ROWS` in `src/wedifixture.js` is
   the already-normalized `price_book_items` snapshot (post-`parseMapped`),
   not the raw XLSX rows the warning is computed from
   (`src/pricebook.js:429`'s `bare.length` check runs during import, before
   normalization), so there is no artifact in this repo to re-run the count
   against — same situation as 84, and the surrounding prose ("Two warnings
   the import raises... both worth knowing") already reads as a report of
   what one import run produced, not a claim the suite checks.
3. **The qualitative claim is independently verifiable and true.** "The
   configurator is unaffected: it prices per EA/BX off its own catalog,
   never per sf" — checked against `src/wediadapter.js`'s `adaptRow`, which
   takes `cost`/`retail` straight off the row (`+row.cost || 0`, `+row.price
   || 0`) with no per-sf computation anywhere in the adapter. The warning
   describes a hazard for "ordinary row search," a different code path this
   spec's adapter doesn't touch.

No edit made to that bullet.

### Test verification

```
node --test src/*.test.js
```
Result: **1234 pass, 0 fail** — unchanged (docs-only edit).

## Follow-up fix, round 4 (coordinator-directed): reattribute the $0-sample conclusion away from the owner

Review found that round 2's reconciliation, while correct in substance,
introduced a false attribution: it said "Confirmed with the owner," and the
pre-existing "Still open for the owner" #2 entry (which I wrote in round 1)
was headed "**Answered (2026-09-01).**" Neither is true — the coordinator
audited every owner attribution on this branch and found the
`1518104`/`1518105` samples conclusion ($0 cost, $100 retail, deliberate not
a sheet artifact) came from measuring the workbook against `WEDI_STOCK`, not
from an owner ruling; the owner was shown the finding and never responded to
it. Three other owner attributions on the branch were audited and confirmed
accurate and left untouched: `29WEDIT` being out of scope, "the owner has
since asked to move wedi the same way," and ADR 0036's `Accepted` status.

The fix is reattribution, not retraction — the question is factual and the
data answers it, so it stays resolved; only who/what resolved it changes.

### Edits

`docs/superpowers/specs/2026-09-01-wedi-stock-book-design.md`, two spots:

1. The "*3 rows with a $0 price*" bullet: replaced "Confirmed with the owner;
   see..." with "Measured against the workbook and `WEDI_STOCK`, which agree;
   see..." — same cross-reference, accurate provenance.
2. The "Still open for the owner" #2 entry: retitled from "**Answered
   (2026-09-01).**" to "**Resolved by measurement (2026-09-01).**", and added
   one clause ("The export and `WEDI_STOCK` agree on both rows, so this reads
   as deliberate...") making explicit how the "deliberate, not a sheet
   artifact" conclusion was reached. Substance otherwise unchanged: still
   states the two SKUs, both prices, the warning's true meaning, and that
   `29WEDIT` is the one genuinely $0/$0 row.

Left untouched, as instructed: question 3 (fallback lifetime — still
genuinely open with the owner), the "Book name" entry (owner, 2026-09-01),
`29WEDIT`'s out-of-scope attribution, and ADR 0036's `Accepted` status.

Commit `9af8095` — "docs: attribute the $0-sample resolution to measurement,
not the owner" (1 file, 8 insertions, 6 deletions).

### Test verification

```
node --test src/*.test.js
```
Result: **1234 pass, 0 fail** — unchanged (docs-only edit).
