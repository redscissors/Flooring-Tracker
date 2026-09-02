# wedi's pricelist side from a registry price book (8b)

- **Status:** Design approved by the owner 2026-09-02 (sections 1–6 in chat);
  spec awaiting the owner's read before a plan is written.
- **Date:** 2026-09-02
- **Builds on:** spec 8a (`2026-09-01-wedi-stock-book-design.md`) and ADR 0037,
  which moved wedi's stock half onto a registry book and left `WEDI_SO`
  transcribed. ADR 0009 (registry), ADR 0025/0027 (re-import, diff, drift,
  versions), ADR 0032 (the Schluter precedent). Issue 080 (the re-transcription
  chore this ends).
- **Groundwork:** `.scratch/120_wedi-pricelist-book/` — the raw sheet snapshot
  (`pricelist-sheets.json`, 5 sheets / 602 non-blank rows, exactly what
  `readXlsxSheets` hands the wizard), its generator, `HANDOFF.md`, and
  `tools/measure-vs-so.mjs`, the throwaway walk of the snapshot that produced
  every figure in this spec (a measurement, not the parser).
- **PR:** #355 (draft) on `wedi-pricelist-8b-prep`.

## Context

`wedi.js` still carries `WEDI_SO`, a hand-transcribed 229-row table (223 priced
rows + 6 `kitNote` rows) of wedi's distribution pricelist. It feeds
`makeEntry(stockRow, soRow)`'s second argument: the pricelist's own product
name, size wording, details, retail, distributor net and **section** — the
uppercase section-title text off the sheet ("WEDI BUILDING PANELS", "FUNDO®
LINEAR COVER PLATES"). 8a moved the stock half and deliberately left this half,
because the pricelist is a formatted vendor workbook, not a table: five sheets,
section-title rows interleaved with product rows, note rows, and **column
layouts that change within a sheet**. A column mapping cannot read it; a parser
can.

### Measured against the committed snapshot (2026-09-02)

Every figure below was measured by script against `pricelist-sheets.json` and
the `WEDI_SO` table in `src/wedi.js`; none is estimated.

- **The "wedi Fundo" sheet alone reproduces all 223 priced `WEDI_SO` rows with
  zero drift** on `name`, `retail` and `net` (2-dp). Two part numbers carry a
  trailing footnote asterisk in the sheet (`US3000042*`, `US3000043*`); once
  it is stripped the match is 223/223. The handoff's "117 of 118" figure was
  that asterisk.
- The Fundo sheet holds **225** part numbers: the 223 above plus two the
  transcription skipped — `676800061` / `676800064`, the SS27/SS43 linear
  cover frames (section "FUNDO® LINEAR CHANNEL FRAME"). Both are already stock
  entries (`WEDI_STOCK`) and both are in `classify`'s `LEGACY` table as
  `coverFrame/linear`; see decision 11 for what surfacing them changes.
- **"wedi S-Dry"** holds 37 part numbers: 36 the engine has never priced and
  one (`US5076012`, PRO-SET tile adhesive) that is also on the Fundo sheet at a
  different retail ($21.05 Fundo, $22.00 S-Dry; same net). Every S-Dry code
  matches `classify`'s existing `/^US\d\d76\d{3}$/` rule, so all 36 file into
  the S-Dry browse section with **no `classify` change**.
- **"wedi Builder Choice"** (15 parts) publishes **no retail price** at all —
  only a delivered distributor net with pallet minimums.
- **"Wellness and Spa"** (62 parts) reuses **one part number across several
  sizes at different prices** (`076400760` Floating Bench × 4, `073606098`
  Sanbath basin × 3), which breaks both the registry's `(book_id, sku)`
  identity and the engine's `INDEX[key]`.
- **"New Product Data"** (65 parts) carries no prices — UPC/GTIN/packaged
  dimensions only.
- **`discount` is the header's figure, not arithmetic.** `WEDI_SO` records
  the "(less N%)" from each section's "Distributor Net Price*" caption — 50 on
  building panels, where net ÷ retail is actually 39% off — and reading the
  governing caption reproduces all 223 values. (The suggested retail and the
  distributor net are on different bases; the percentage is wedi's, not a
  derivation.)
- **`details` was read by column position.** The transcription took Fundo
  column 4 on every row: the "Additional Details" column in most sections, an
  uncaptioned spill of the description in the shower-base accessories block,
  and an EMPTY cell in the two sections that caption "Additional Details" at
  column 5 ("1 Kit", "12 per case, full cases only" were dropped). Two seat rows
  carry a hand edit the sheet never had ("Suspended Corner Seat" for the
  sheet's "Suspended Seat"). One size cell carries a sheet typo the
  transcription fixed ("… x 3 1/8 in. in.").

### Owner decisions, 2026-09-02

1. **Scope — Fundo + S-Dry.** Builder Choice is out (no retail; a $0 retail is
   exactly the quote hazard 8a's spec warned about). Wellness is out (the
   part-number identity problem needs its own rule). New Product Data is out
   (no prices). All three are later steps with their own questions.
2. **Fallback lifetime (8a open question 3) — keep `WEDI_STOCK` and `WEDI_SO`
   through 8b; delete both in a later PR** once the team has run on both books
   for a while. 8b's acceptance test needs `WEDI_SO` as its oracle.
3. **The plausibility floor — refuse to install a book missing any `SKU.*`
   constant, AND guard the two call sites** (`wedi.js` `panelPlan`'s
   `item(SKU.panelDefault)` and `lineItems`' `item(SKU.coverSS)` →
   `coverFrameFor`). Belt and braces.
4. **Book name — "wedi"**, the same name the stock book got in 8a. The two
   books are told apart by `kind`, never by name (decision 4 below records the
   conflict check).
5. **Approach — a wizard vendor parser (Mirage/OVF/Emser style) feeding an
   order-kind book, read by a twinned 8a seam.**

## Decision

### 1. The parser — `src/wedibook.js`

A section-table state machine, the same shape as `parseSundries` in
`ovfbook.js`, returning the canonical `{ name, rows, mapping, warnings, meta }`
contract every dedicated vendor parser returns, so `parseMapped` and everything
downstream of it — diff preview, drift chips, the still-good stamp, versions
and rollback, per-item disable, Flag-for-Claude — run unchanged (ADR 0025/0027).

- **Sheet selection is by name:** `wedi Fundo` and `wedi S-Dry`, in that order.
  Every other sheet is skipped *by name*, deliberately: a renamed or
  re-formatted sheet parses to zero rows and says so in `warnings`, never to
  plausible garbage (the Mirage rule).
- **Section-title rows** set the current `section` and re-map the columns. A
  section row is a row whose first non-empty cell is prose and whose remaining
  non-empty cells are column captions ("Size", "Drain Location", "Product
  Information", "Additional Details", "Retail Unit Price*", "Distributor Net
  Price* (less 52%)", …). The parser reads *which caption sits in which
  column*, so a layout change mid-sheet is the ordinary path. Retail is the
  column captioned "Retail Unit Price"; net is the **rightmost** column
  captioned "Distributor Net". On Fundo the part number is column 1 and column
  0 ("Stock SkUS") carries the shop's ERP code where one exists; on S-Dry the
  part number is column 0. The part-number column is located by its own
  caption ("Part Number") when the sheet prints one, else by the first cell
  matching the part-number pattern.
- **Product rows** are any row whose part-number cell matches
  `/^(US\d{7,9}|\d{9})\*?$/` — a `US` code or a nine-digit article number,
  with an optional trailing footnote asterisk that is stripped. A product row
  emits `{ us, name, size, details, retail, net, section, discount, erp }`,
  `WEDI_SO`'s exact contract.
- **`discount`** is the integer in the governing section's "Distributor Net
  Price* (less N%)" caption — the figure `WEDI_SO` records on all 223 rows
  (measured), never computed from the prices, which sit on different bases
  (see Context). The parser emits it in the canonical sheet so the wizard's
  preview shows it; it is **not** mapped onto the book item, because nothing
  in the engine reads it (decision 2).
- **`size`** is the column captioned "Size", "Dimensions" or "Product
  Information", whichever the section prints (the accessories block prints only
  the last). A doubled unit at the end of a size cell (" in. in.") is collapsed
  — a sheet typo on one row that the transcription corrected by hand.
- **`details`** is the column captioned "Additional Details" or "Drain
  Location" — by caption, not position — and, where a section captions
  neither, the cell to the right of the size column (the accessories block,
  where the sheet spills the description across merged cells and the
  transcription kept the spill). This is a deliberate improvement over the
  transcription's position-4 rule: it recovers "1 Kit" and "12 per case, full
  cases only", which position 4 dropped. Decision 9 pins every row where the
  two disagree.
- **Everything else is skipped** without a warning: title lines, "Full
  Pallet/Box Quantities Only", the "*Contains Fundo® Shower Base…" kit notes,
  the Terms of Sale block. The six `kitNote` rows in `WEDI_SO` are **not**
  reproduced: `buildCatalog` filters them out on its first line and nothing
  else reads them.
- **A part number on both sheets — Fundo wins.** `US5076012` is the only case
  today. The S-Dry copy is dropped with a warning naming both prices, so a
  future disagreement is visible in the wizard rather than silently resolved.
- **Detector** `isWediPricelist(sheets)`: a sheet named `wedi Fundo` whose
  first three rows contain "wedi Distribution Pricelist". Registered in
  `dropimport.js`'s `fileFormat` as `"wedi-pricelist"`, tested before
  `detectVendorSkuAnalysis` like every vendor tag, and named in `FORMAT_NAMES`
  so routing reads "wedi pricelist → wedi". `bookKindFor` already makes every
  non-ERP format an order book. `computeFingerprint` needs no change: the tag
  alone routes a re-drop.
- **The canonical sheet** the parser emits has the columns
  `sku, description, size, note, price, cost, section, vendorSku` and a
  `WEDI_PRICELIST_MAPPING` with `headerRow: 0`, `skuPattern:
  "^(US\\d{7,9}|\\d{9})$"`, `defaultType: ""`, `groupBy: "section"`.

### 2. The book — an order-kind registry book named "wedi"

| `WEDI_SO` field | book item field | note |
|---|---|---|
| `us` | `sku` | the vendor's code is the identity, as in every order book |
| `name` | `description` | |
| `size` | `size` | the pricelist's own words ("36 in. x 60 in. x 2 in."); supplied by the mapping, so `splitSizeFromDescription` does not run on it |
| `details` | `note` | |
| `retail` | `price` | wedi publishes retail and the shop marks nothing up; `pricedItem` passes an item with its own `price` through, so row search shows it unchanged |
| `net` | `cost` | |
| `section` | `section` | also the book's `groupBy` axis, as OVF sundries does |
| `erp` | `vendorSkus[0]` | the shop's ERP code where the Fundo sheet prints one (column 0) |
| `discount` | — | **not carried.** Nothing reads it: `makeEntry` never copies it onto the entry, and `wedi.js`, the popup and the compare code contain zero reads (measured 2026-09-02). Dead data in `WEDI_SO`; the adapter emits `null` |

**The owner** creates nothing by hand beyond what the wizard does today: drop
the pricelist workbook, the router says "wedi pricelist — pick which book",
choose *new book*, name it **wedi**, apply the import. Nothing touches quoting
until that apply.

### 3. The adapter — `wediadapter.js` gains `adaptSoRow` / `adaptSoRows`

One live order-item row → the `soRow` contract: `us = row.sku`,
`name = row.description`, `size = row.size`, `details = row.note`,
`retail = row.price`, `net = row.cost`, `section = row.section`,
`erp = row.vendorSkus[0] || ""`, `discount = null` (decision 2: nothing reads it). A row
whose `sku` matches neither pattern drops, the way `adaptRow` drops `29WEDIT`.
`wediadapter.js` stays the only file that sees a raw book row.

This half is much simpler than 8a's `descOf` because the parser wrote `size`
and `description` as separate columns and nothing was split. Two things the
pipeline does touch, and the acceptance test (Verification) is what proves
they are harmless: `parseMapped` runs `cleanDescription` over `description`,
and `normOrderItem` rounds money to 2 dp. `WEDI_SO`'s names and prices are
already clean and 2-dp — the drift measurement passed on exactly those — so
the expected result is identity; if `cleanDescription` alters any of the 223
names the test names the row and the plan decides, as 8a did for `desc`.

### 4. The engine seam — `SO_SRC || WEDI_SO`, and the name conflict check

`wedi.js` gains `setSoSource(rows)` / `clearSoSource()` / `soSourceIsBook()`,
twins of the 8a installers, and `buildCatalog` reads
`const soRows = (SO_SRC || WEDI_SO).filter((r) => !r.kitNote)`. All four
installers null `CAT` and `INDEX` — `buildCatalog` writes the module-level
`INDEX` as a side effect, so the two memos must clear together and do. Nothing
else in `wedi.js` moves; the pinned tests stay pinned.

`usewedicatalog.js` gains `pickWediSoBooks(books)`: **order**-kind, active,
`/\bwedi\b/i` on name or `brandLabel` — the same test `pickWediBooks` applies
to **stock**-kind books. Two books named "wedi" therefore cannot claim each
other: the kind is the discriminator. Checked 2026-09-02: `price_books.name`
carries no uniqueness rule; drop routing keys on the fingerprint format
(`vendor-sku` vs `wedi-pricelist`), never the name; nothing else in `src/`
matches a *book* by the word "wedi" (the other hits are the configurator's
own UI, search-entry recognition, and basket fields). The one cost is
cosmetic — two rows reading "wedi" in the book library, one stock and one
order — and the picker accepts "wedi pricelist" just as well if the owner
prefers that label later.

### 5. The gate — one hook, two halves

`useWediCatalog` fetches both id-sets and runs `gateOf` once per half:

| stock half | pricelist half | `catReady` | `onBook` |
|---|---|---|---|
| no book | no book | true | `{stock:false, so:false}` — both transcribed tables, caption "· transcribed table" |
| book, rows | no book | true | `{stock:true, so:false}` — caption "· transcribed pricelist" |
| no book | book, rows | true | `{stock:false, so:true}` — caption "· transcribed stock table" |
| book, rows | book, rows | true | `{stock:true, so:true}` — no caption |
| either half: book exists, rows not loaded or fetch failed | | **false** | — the popup waits, never substitutes (ADR 0037 decision 4) |

`onBook` becomes an object; the Browse caption reads it. The install memo
calls the matching installer for each half and `clearSoSource`/
`clearStockSource` for the other; the re-assert effect covers both.
`foldBookLists`, `bookErrorOf` and `retryBook` are per half, and `bookError`
is true when either half's fetch settled empty-handed. `CompareTab` passes
through unchanged — it already calls this hook.

### 6. The plausibility floor, and the two guards

`requiredPartsMissing(stockRows, soRows)` (pure, in `wediadapter.js`) returns
the `SKU.*` values found in neither installed source. In the hook, a
**book-fed half** whose install would leave any required part missing
**refuses to install**: that half falls back to its transcribed table, its
`onBook` flag is false, and the caption says why — "· transcribed pricelist
(book is missing 3 required parts: US5000070, …)". This is the visible
fallback ADR 0037 requires, not a silent one, and it is the situation the
owner chose over blocking the popup. A book that adapts to *no* rows stays
the empty-book case, unchanged from 8a.

The two call sites also get null-guards, so no path — including one this
gate did not anticipate — can throw: `panelPlan` with no building panel in
the catalog emits a hint line ("no wedi building panel in the catalog") and
no panel lines; `lineItems` with no `SKU.coverSS` skips the cover and its
frame with the same kind of hint. `coverFrameFor` is already null-safe.

### 7. What does not change

- `classify`, `kitFor`, `solve`, `panelPlan`'s geometry, `lineItems`'
  pricing rules, the Builder × 0.82 rule, `makeEntry` — untouched.
- Saved wedi lines gain no `bookId` (ADR 0037 consequence 1 still holds).
- `WEDI_STOCK` and `WEDI_SO` stay in the tree as the visible fallbacks
  (owner decision 2).

### 8. The visible catalog change, pinned

Surfacing `676800061` / `676800064` from the pricelist gives two existing
stock entries a pricelist twin they never had. `makeEntry` names a twinned
entry from the pricelist (`soRow.name`), so those two frames' display names
move from the ERP wording ("28\" Wedi Linear Channel Frame - 676800061
-Stainless") to the pricelist's ("wedi Fundo® Linear Drain Cover Frame SS27"),
exactly the treatment every other twinned row already gets. They also gain
`section`, `size`, `details`, `soRetail`, `soNet`. The acceptance test pins
this: those two keys are the **only** stock entries allowed to differ, and
only in those fields. The owner sees the rename in the preview proof and can
veto it there.

### 9. Where the parser deliberately differs from `WEDI_SO`, pinned

The acceptance test compares the book-fed pricelist half to the transcribed
one field by field. These are the only permitted differences, each measured
against the snapshot, and none moves a derived field (`details` feeds only
`e.details` and the drain/channel/coverage text scans, which none of these
strings trips):

- `details` on the rows whose captioned "Additional Details" column the
  transcription skipped (`US5000085` → "1 Kit", `US5000013` → "12 per case,
  full cases only", and any sibling the test enumerates in the same two
  sections).
- `details` on `US3000001`/`US3000002`: the sheet says "Suspended Seat"; the
  transcription's "Suspended Corner Seat" was a hand edit and is not
  reproduced.
- `size` on `US3000000`: the sheet's "… x 3 1/8 in. in." collapses to one
  "in." (decision 1), matching the transcription.

Anything else that differs is a parser bug, not a judgement call.

## Verification

Baseline before any task: `node --test src/*.test.js` on `main` at `c8aa12b`
— **1302 pass, 0 fail**. Every claim below is a test the plan must write, or a
preview the plan must capture.

1. **Parser (`src/wedibook.test.js`)** over the committed snapshot, moved into
   the tree as `src/wedipricelistfixture.js` (the raw grid, regenerable by
   `.scratch/120_wedi-pricelist-book/tools/dump-pricelist.mjs` — NOT parser
   output, so the test is not circular): 261 rows out (225 Fundo + 36 S-Dry);
   every row carries a non-empty `section`; the two asterisk rows parse as
   `US3000042`/`US3000043`; `US5076012` appears once, from Fundo, with a
   warning; the parser's `discount` is read from the caption (50 on
   `US8000006`, whose prices compute to 39); a sheet renamed away yields 0
   rows and a warning; the detector is true for the snapshot and false for the
   8a stock export fixture.
2. **Zero drift (`src/wediequivalence.test.js`)** — the pricelist half, book-fed
   through the *real* pipeline (`parseWediPricelist` → `parseMapped` →
   `normBookItem` → `adaptSoRows` → `setSoSource` → `catalog()`), deep-equals
   the `WEDI_SO`-fed half on 8a's `DERIVED` field list **plus** `section`,
   `size`, `soRetail` and `soNet`, for all 223 transcribed keys, with
   `details` compared separately against decision 9's allow-list; the
   additions are exactly the 36 S-Dry codes and nothing else; the stock half is unchanged except the two frames of
   decision 8, in exactly the listed fields; **0 rows in `misc`** with both
   sources installed; the pinned `kitFor("US9100004")` and `solve(...)` trees
   are identical with both sources installed vs neither.
3. **Floor and guards** — a book-fed pricelist missing `SKU.panelDefault`
   refuses to install and reports the missing part; with the source forced
   in anyway, `panelPlan` and `lineItems` return hints, not throws.
4. **Gate (`src/usewedicatalog.test.js`)** — the five-row table of decision 5,
   plus: a stale id-set on either half never satisfies the gate; a failed
   fetch on either half nulls `catReady`.
5. **Preview proof (non-negotiable 3)** — screenshots in
   `.scratch/120_wedi-pricelist-book/`: the wizard recognising the dropped
   workbook ("wedi pricelist — pick which book") and its diff preview; the
   Browse caption in the four `onBook` states and the missing-parts state;
   the two renamed frames in Browse.
6. `npm run build` exit 0; `npm run lint` no worse than `main`'s 7 errors.

## Out of scope

- Builder Choice, Wellness and Spa, New Product Data — each a later step with
  its own owner question (retail rule; part-number identity; no prices).
- Deleting `WEDI_STOCK`/`WEDI_SO` — the follow-up PR of owner decision 2.
- Any change to how wedi prices.
- The re-assert effect's inability to tell book A from book B, and the
  popup-body unmount on lost readiness — 8a residuals, unchanged here.

## Open for the owner

1. The two frames' rename (decision 8): accept when it shows in the preview,
   or ask for the ERP wording to be kept on twinned rows — which would be a
   `makeEntry` rule change affecting every twinned row, not just these two.
