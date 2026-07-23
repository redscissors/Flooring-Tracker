# ADR 0025 — A price book declares the files it is made of; an import is checked for completeness before review, and gaps are filled or consciously dropped

- **Status:** Accepted
- **Date:** 2026-07-19
- **Scope:** system-wide — a `sources` manifest on the book (jsonb, no schema change), a completeness gate between download and review, a per-book file bundle in the import router, "add a file to this book" on the book page. Retire semantics are **unchanged**. No SQL to run; no new dependency.
- **Related:** ADR 0009 (price book library — the import contract), ADR 0024 (one price-book library — the review-when-ready pool and file→book targets), ADR 0021 (board batch download), ADR 0003 (snapshot doctrine)

## Context

ADR 0009 fixed the import contract as: parse a file, diff it against the book,
upsert what changed, and mark every active SKU **absent from that file**
`active = false` (0009:46). That rests on an invariant nobody wrote down:

> **the file being imported is the complete, authoritative contents of the book.**

True for every book shipped so far. Mirage breaks it. Ohio Valley Flooring
publishes it as four documents, and no three of them are a book:

| File | Supplies | Alone it is |
|---|---|---|
| `Mirage_Product_Chart.pdf` | floor SKUs at collection × grade × **color** × width | identity, no prices |
| `OVF-Mirage-Hardwood.xls` | prices at collection × grade × width (eff. Jul 13 2026) | prices, no colors |
| `OVF-Mirage-Value-Tower.xls` | same axes for the value tier (eff. Feb 3 2025) | prices, no colors |
| `OVF-Mirage-Trim.xls` | trim SKUs by (collection, color) + trim prices by type × species | self-contained |

The chart and the price sheets must be **joined, not concatenated**: the chart
gives a SKU and its identity with no price, the flooring sheets give a price keyed
by (collection, grade, width) with no color. Sequential import cannot do it
either, because the write path is a SKU-keyed upsert (`onConflict: book_id,sku`)
— there is no way to express "update every row matching this (collection, grade,
width)".

And the files do not all arrive the same way. Three of Mirage's four are fetchable
from the portal; the Product Chart is not practical to fetch and is supplied by
hand. So "the book's files" is a **mixed set**, part automatic and part manual.

### There is already a live bug here

`bookId` has always been a plain field on a sheet record, deliberately not part of
`recordKey`. The storage layer always permitted many sheets per book; only the
read path assumed 1:1 (fixed in #174).

So this is reachable **today**: link two sheets to one book, batch download, press
"Review all". The router forces both files at the same book and runs them
sequentially, one wizard each. Apply the first, the book holds its SKUs; apply the
second, all of the first's are absent from it and get retired. **Final state is
only the last sheet's contents active, with no warning.** Nothing has linked two
sheets to one book until Mirage, which is the only reason it has not bitten.

### The question this ADR originally got wrong

An earlier draft of this ADR proposed per-item provenance: each item recording
which file it came from, and an import retiring only the slice it owned. The
motivation was that Value Tower may not always be published, and it is the **only**
source for the Lakeside collection and the Escape *Traditional* colors (Blue
Ridge, Champlain, Chelan, Madison, Moosehead, Yellowstone) — so a quarter without
it would retire live inventory.

That solved the problem by making a partial import *quietly harmless*. The cost
was that nothing would ever be retired again unless a full set arrived: stale rows
would accumulate silently, and the machinery to achieve it (a `sources` array per
item, subset ownership rules, an adoption rule for legacy items) was substantial.

The owner's direction (2026-07-19) inverts it: **do not make partial imports
quietly safe — make them loudly visible, and let a human decide.** A missing file
should be named at review time, fillable on the spot, and if the user proceeds
without it, the absent file's items *should* be dropped, deliberately, so nothing
stale lingers. That is the design recorded below.

## Decision

**1. A book declares the files it is made of.**

`book.data.sources` — an ordered manifest of slots, in `data` jsonb, so **no
migration**:

```
{ id, label, kind: "fetch" | "manual", recordKey?, fingerprint?, lastSeen? }
```

- `kind: "fetch"` slots correspond to linked vendor sheets and are derived from
  `sheetsForBook` (#174); `recordKey` ties the slot to its sheet.
- `kind: "manual"` slots are files supplied by hand, matched by their **content
  fingerprint** (`computeFingerprint` — format + header signature + title
  signature), never their bytes, which cannot persist (ADR 0024).

**A filename is never an identity.** Vendors date their files, and those dates
change between releases (`AOT EFT 26 02 19` → `AOT EFT 26 05 20`). Both slot kinds
are already immune, for different reasons:

- `recordKey` is `vendor:host:uid:user` and deliberately excludes the filename —
  *"a sheet keeps its link and history across moves and re-pulls"*
  (`vendorfetch.js:126`). `mergeRecords` refreshes the stored filename on
  re-fetch while keeping the same record, and `vendorfetch.test.js:210` asserts
  exactly this (`// filename is not identity`).
- Manual slots key on the fingerprint, which is the same signal the drop router
  (ADR 0009 PR C) already uses to route a dropped file to its book.

`label` is display only — the filename as last seen, refreshed on every match, so
the gate can say "missing: `Mirage_Product_Chart.pdf`" using current wording
without ever matching on it.

The manifest is built by use, not configured up front: importing a bundle records
each file it contained as a slot. A book fed by one file has a one-slot manifest
and never sees any of the machinery below.

**2. A download is checked for completeness before review.**

Between "downloaded" and "review", a book whose manifest has more than one slot
gets a completeness gate. It names what is present and what is missing, by label:

> **Mirage — 3 of 4 files ready.**
> Missing: `Mirage_Product_Chart.pdf` (added by hand)
> [ drop it here ] [ Review with all 4 ] [ Use these 3 anyway ]

**3. The gate can be filled in place.**

The gate carries its own drop target. Dropping the missing file completes the
bundle and proceeds to a normal, whole-book review. This is what makes a
part-fetched, part-manual book workable: the automatic files arrive by batch
download, and the gate is exactly where the manual one is asked for.

It accepts any file the drop router understands, so a book can also gain a *new*
file this way — the manifest grows by one slot.

**4. Proceeding without a file is explicit, and it drops that file's items.**

"Use these 3 anyway" is a conscious choice, and it means what it says: the import
is treated as the book's complete contents and the absent file's SKUs are retired
by the normal ADR 0009 rule. The gate states the consequence with a count before
it is taken ("47 items will be retired").

**Retire semantics are therefore unchanged.** No per-item provenance, no ownership
rules, no adoption of legacy items. Every import remains a whole-book import; the
only new thing is that the user is told when it is about to be one *by omission*
rather than by intent.

**5. "Review all" batches by book, and a bundle is one wizard pass.**

The router groups pending files by target book and hands each book's file **set**
to a single wizard pass, instead of enqueuing them independently. This is what
fixes the live bug in Context, and it is what makes rule 4 coherent — there is one
diff and one apply per book, not one per file.

**6. A book page can add a file.**

The book page gains "Add a file", which drops a file into the book's manifest and
opens the same bundle review. This is how a manual slot is first created, and how
a book picks up a file that did not exist when it was set up.

Without it the manifest cannot bootstrap, which the owner hit in practice
(2026-07-19): slots are only recorded by importing, and the one file that must be
supplied by hand — Mirage's product chart — could never be imported on its own,
because a whole-book import of it would retire everything the other three files
supplied. So the gate could never learn the chart existed, and could never ask
for it. "Add" is the way in: the file's rows join the book, **nothing retires**,
and the slot is registered so every later import knows to expect it.

Adding a file the book already knows is almost certainly meant as a replacement,
so that case says so and points at Import… rather than quietly refreshing and
leaving dropped rows behind.

**Targeted replace is deliberately not built.** "Replace just this one file"
needs the book to know which rows came from which file — per-item provenance,
which this ADR rejected. A light version (one slot id per item, read only for
that action) would be enough, but the owner chose to ship "Add" alone and see
whether targeted replace is wanted (2026-07-19). Whole-book replacement stays
where it already works: the book page's existing Import…, and the library board's
drop area.

**7. A parser may consume several files, and must be able to tell them apart.**

`parseMirage(payloads)` follows the existing `parseOvf` / `parsePdfPages`
precedent — collapse N inputs into one canonical sheet plus a mapping — extended
from N sheets/pages to N files. Everything downstream (sheet picker, mapping
controls, diff, apply) is untouched.

A multi-file vendor must also ship **a detector per file kind**, so each of its
files earns a distinguishing `format` tag from `fileFormat` the way
`isManningtonCartons` does. Rule 1's manual slots depend on it: today
`computeFingerprint` gives PDFs **no header signature** ("their layout is
grid-driven, matched by format tag"), so an undetected PDF fingerprints as
`{format: "generic", headerSig: "", titleSig: ""}` — which matches *every* other
generic PDF. Mirage's Product Chart is exactly that case, and it is the one file
the owner supplies by hand, so this is not hypothetical: without
`isMirageChart(pages)` the gate could accept any unrelated PDF as the missing
file.

The parser needs these detectors for its own routing regardless, so this costs
nothing extra — it just has to be stated as a requirement rather than assumed.

## Alternatives considered

**Per-item provenance, retire only your own slice.** The earlier draft of this
ADR. Rejected: it trades a loud, answerable question for silent accumulation of
stale rows, and costs a per-item array, subset-ownership rules, and a legacy
adoption rule. The owner would rather be asked. Worth revisiting only if partial
refresh (below) becomes a real ergonomic problem.

**Require the complete file set, refuse otherwise.** Rejected: it makes a missing
vendor file a hard block rather than a decision, and the set genuinely varies.
Rule 4 is the same check with an escape hatch.

**Split Mirage into several books.** Rejected for the floors: the chart and the
price sheets describe *the same products* and must be joined, so they cannot be
separate books. It would work for the trim sheet alone, but a trim's `fits` would
then point across a book boundary while `trimsForFloor` filters one item list.

**A "merge, don't retire" flag on the import.** Rejected as a footgun: correctness
becomes a per-import human choice with no stated consequence. Rule 4 is a human
choice *with* the consequence counted.

## Consequences

- **The live sequential-retire bug is fixed** by rule 5, independent of Mirage.
- **Every import is a full bundle.** A book with a manual slot needs that file
  re-supplied on every import, because File bytes cannot persist. For Mirage that
  is one drag per import. Accepted deliberately; the alternative is per-item
  provenance, which was rejected above. If this chafes, the fix is a scoped
  "refresh just this sheet" path, and that is when provenance earns its cost.
- **Nothing changes for existing books.** A one-slot manifest never triggers the
  gate, and the retire rule is the one they already use.
- **A stale row is now a decision, not an accident.** Choosing "use these anyway"
  is how Lakeside would be retired if Mirage stopped publishing Value Tower —
  which is correct if the program really is discontinued, and visible if it is
  not.
- The gate is a **new blocking step** between download and review for multi-file
  books. For single-file books it must not appear at all; if it does, it is a
  regression in the common path.
- `book.data.sources` is written by the import flow only. It is descriptive (what
  this book has been made of), not a contract the user edits — though removing a
  slot needs to be possible for the case where a vendor genuinely drops a file.
- Manifest drift: a slot whose `recordKey` no longer matches any linked sheet (the
  sheet was unlinked or moved) should surface in the gate as missing rather than
  silently disappearing.
- **A dated filename must never be load-bearing.** Fetch slots are already immune
  (`recordKey` excludes the filename, with a test); manual slots are immune only
  because they match on fingerprint. If a future change reintroduces filename
  matching anywhere in this flow, a vendor re-dating a file silently turns into
  "missing 1 of 4" every quarter.
- PDF fingerprinting is weak by design (format tag only). Rule 7's per-kind
  detectors cover the vendors we parse, but a *generic* PDF dropped as a manual
  source still cannot be told from another generic PDF. If manual PDF slots become
  common, `computeFingerprint` should learn a title signature from page-1 text —
  out of scope here, noted so it is a known limit rather than a surprise.

## Amendment (2026-07-23) — forced full re-import

A whole-book import that happens to be a **no-op** (the sheet is byte-identical to
the book, so every row diffs as `unchanged`) had no way to run: the wizard's Apply
button was disabled, and `applyBookImport` early-returned without writing. That is
correct for an ordinary re-drop, but it left no way to *deliberately* re-run the
pipeline when the downstream effects need refreshing — the import-date/staleness
stamp, the drop-routing fingerprint, a version snapshot, and above all the ADR
0027 linked-catalog / family / link sync, which only fires after a successful
apply.

The wizard gains a **"Force full re-import"** toggle (last file of a bundle only —
earlier files still just bank their rows). When on, the apply's diff is passed
through `forceDiff` (`orderbook.js`), which recasts every `unchanged` row as a
`changed` write. Nothing else in the pipeline changes: the rows go through the
existing `changed` upsert path (which already preserves each row's `disabled` and
`flagReview`), and `missing` still retires by the rule above — so **retire
semantics remain unchanged** and the completeness gate still guards a
single-sheet-of-many drop. The forced pass is stamped `lastImport.forced` for the
book history. Guarded on `items.length > 0` so a mis-parsed empty sheet can never
force a mass-retire.

This is the whole-book "rewrite everything" counterpart to the still-unbuilt
targeted per-file replace (rule 6) — it does not need per-item provenance because
it rewrites the entire book, not one file's slice.
