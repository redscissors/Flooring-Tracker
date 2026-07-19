---
issue_type: Feature
summary: Onboard four new OVF (Ohio Valley Flooring) vendor price books into the
  ned — Sika (DriTac adhesives), Stauf (primers/adhesives), Hallmark (engineered
  wood), and Tarkett Home LVT. Two are flat tables that go in through the existing
  no-code mapped-import wizard; two are Mannington-style banded grids that each
  need a dedicated parser module. Classification + plan below, no code yet.
status: needs-triage
labels: [needs-triage]
---

# Onboard four OVF vendor price books

## Context (2026-07-18)

Owner supplied four `.xls` files, all from **Ohio Valley Flooring (OVF)**, each
"Prepared especially for KEIM LUMBER CO" and each carrying a throwaway
"Terms of Sale" sheet to ignore. These are **distributor cost sheets** (OVF's
price to Keim), so they onboard as `kind='order'` books — the number is *cost*,
the ned applies markup (ADR 0009 §3). *(Confirm with owner: none of the four are
already sell/retail prices. Tarkett prints "Sq Ft Price" + "Sq Ft Pallet Price",
still read as Keim's cost.)*

Source files (owner's Downloads, not committed):
`OVF-Hallmark-Wood.xls`, `OVF-Sika.xls`, `OVF-Stauf.xls`,
`ovf-tarkett-home-lvt.xls`.

## The two sanctioned onboarding doors (ADR 0009 §4)

1. **No-code mapped import.** A *flat* table (one header row, one product per
   row). Team maps columns once in the wizard; mapping saves on the book
   (`price_books.data.mapping`). Parsed by `parseMapped` (`src/pricebook.js:718`)
   — a single linear scan: `headerRow`, then every row whose SKU cell matches the
   book's `skuPattern` becomes one item. Section-banner rows are silently skipped
   (their grouping is NOT captured). No deploy.
2. **Dedicated parser module.** A *banded* grid (price printed once in a header
   row, colors/SKUs stacked beneath, headers shifting per section, one row
   fanning out to floor + trims). `parseMapped` cannot express banding, so that
   vendor gets a parser that flattens the grid into the canonical
   `{ name, rows, mapping, warnings }` and feeds the same wizard — the sanctioned
   exception, modeled on `src/manningtonbook.js` (ADR 0012). Costs code + tests +
   a routing branch in `App.jsx` `ingest` (~`App.jsx:6481`) + preview proof.

The four files split two-and-two across these doors.

---

## ✅ Group 1 — flat tables, no-code wizard (no parser)

### Sika (DriTac adhesives) — works as-is
Sheet `DriTac`. Repeating header: `Product · Size · SF Coverage · Weight ·
Item # · Price` (header row ~6, repeats per section banner).

- Map: col0 `description`, col1 `size` (or `note`), col2 `coverage`,
  col4 `sku`, col5 `cost`. (col1 "1 GA" is a pack size, not tile size — safe as
  `note`; leave `coverage` unmapped if "1,000 per pail" text confuses the number
  parse.)
- SKUs `SIK831394`, `DRI708882` pass the **default** pattern.
- Prices written `"$131.39 / EA"` parse correctly — `numOrNull`
  (`src/pricebook.js:29`) does `parseFloat` after stripping `$`, so it reads
  `131.39` and stops at the space; `"N/A / EA"` → null (imports with no cost,
  the raw text is preserved in the item note via `mappedItem`).
- Section banners (Resilient / Commercial / Wood / Acoustic / Self-Leveling…)
  are skipped; their grouping is lost. Acceptable for adhesives (no
  markup-by-section need). If grouping is wanted later, a `detectSikaOvf`
  template recognizer (like `detectVtcEft`, `src/pricebook.js:965`) is optional
  polish, not required.
- **Verdict: import today through the wizard.** Zero code.

### Stauf (primers / adhesives) — works with a custom SKU pattern
Sheet `Stauf`. Header row 1: `<name> · Price/EA · OVF Item # · Size/EA ·
Weight · Packaging · Transport/Storage` (col0 headerless product name).

- Map: col0 `description`, col1 `cost`, col2 `sku`, col3 `size` (or `note`).
- **Catch 1 — SKU pattern.** SKUs carry hyphens/dots: `AQP-200-2.5G`,
  `CCF-40-A`, `SMP9603G`, `ERP-270-2.5G45`. The default pattern
  `^(?=.*\d)[A-Za-z0-9]{1,20}$` (`DEFAULT_SKU_PATTERN`, `src/pricebook.js:545`)
  **rejects hyphens/dots**, so nearly every row would be skipped. Set a custom
  `skuPattern`, e.g. `^(?=.*\d)[A-Za-z0-9.\-]{3,}$`, in the mapping step.
- **Catch 2 — prices.** Most rows are `N/A/EA` (only a few real, e.g.
  `$207.79`). Imports largely as a reference/lookup book until OVF gives numbers.
- Section banners (REPAIRS, GENERAL PURPOSE ADHESIVES…) skipped as above.
- **Verdict: import today through the wizard**, remembering to set the SKU
  pattern. Zero code.

---

## ⚠️ Group 2 — banded grids, dedicated parser (code + PR)

### Hallmark (engineered wood) — Mannington-shaped, cleanest of the two grids
Sheet `Hallmark`, 341 rows. Per-collection blocks:

```
row: "Alta Vista Collection"                     <- collection banner
row: 5/8" x 7 1/2" x RL- 74 3/4" ...             <- dims/construction prose
row: NEW: 27 SF/CT ~ 30 CT/PA ~ 59 LB/CT ...     <- coverage prose
row: SPECIES/COLOR | NEW ITEM # | | OLD ITEM # | STAIR NOSING 82" | T-MOLD 82" | REDUCER 82" | THRESHOLD 82"   <- header (SHIFTS per collection)
row: EUROPEAN WHITE OAK | $7.29 | | $7.29 | $111.49 | $73.59 | $73.59 | $73.59   <- SHARED price row (floor + all trim prices)
row: Balboa | AV75OBALC | | AV75OBAL | AV75OBALSN | AV75OBALTM | AV75OBALRD | AV75OBALTH   <- color row: floor SKU (new+old) + 4 trim SKUs
row: Big Sur | ...
```

Why it needs a parser (mirrors `manningtonbook.js:1-32`):
- The floor **price lives in a header/species row**, not on the color rows —
  `parseMapped` reads price per data row, so it can't attach it.
- **Header columns shift per collection** (block 1 has NEW/OLD ITEM #; the
  "American Traditional" block at row 26 has a single ITEM # + a "Touch Up Kits"
  column). Fixed header-name mapping can't track that.
- **One color row fans out to 5 orderable items** — the floor plus stair-nose /
  T-mold / reducer / threshold, each its own SKU at its own trim price. The
  Mannington parser already does exactly this floor+trim fan-out with a shared
  section price; reuse that shape.

Deliverable: `src/hallmarkbook.js` (~150–250 lines) that walks the block
state-machine, emits canonical rows (floor keyed by new item #, trims flagged
`trim:true` so the book can mark them up separately — ADR 0012 pattern) + a
passthrough `CANON_MAPPING`; an `isHallmarkWood(sheets)` detector; a routing
branch in `App.jsx` `ingest`; `node --test` coverage (pure, plain-array input).
Open Q: keep both NEW and OLD item # (old as a search alias?) — decide with owner.

### Tarkett Home LVT — ONE sheet needed, same OVF template as Hallmark
**Re-scoped 2026-07-18 after owner flagged only seeing one sheet.** The file has
8 tabs but **6 are hidden in Excel** (`Hidden=1`): `All`, `Premier`, `PermaStone`,
`Origins`, `Specifi 2`, `Vista` — OVF's reference tabs for *other* Tarkett lines.
Only two are visible: **`Tarkett LVT`** (its first row reads *Tarkett EverGen™*)
and `Terms of Sale`. **The hidden sheets are OUT OF SCOPE** — the parser reads
only the `Tarkett LVT` sheet (drop the earlier `All`/`Premier`/`Specifi 2`
analysis).

The `Tarkett LVT` sheet (195 rows) is one clean, regular banded grid holding the
whole EverGen family stacked vertically: EverGen, FlexGen, InStudio (12mil &
20mil), NuGen, NuGen XL, ProGen, ProGen PLUS. Block grammar (same shape as
Hallmark):

```
row: "Tarkett EverGen™" | ... | <warranty prose in far col>              <- collection banner
row: "20 mil Wear Layer  •  Pressed Bevel  •  Click"                     <- construction prose
row: "Plank Size 7\" x 60\"  •  9 PC/CT  •  26.25 SF/CT  •  35 CT/PA ..." <- size/coverage prose (SF/CT here)
row: Design | Item # | Quarter Round (94") | Slim Trim | VersaEdge | RSN | Slim Cap   <- header
row: $3.97/SF | $104.15/CT | $15.18/EA | $41.67/EA | $56.01/EA | $69.16/EA | $47.65/EA <- SHARED price row (floor $/SF + $/CT, then 5 trim $/EA)
row: Endless Maple Bourbon | 270311021 | 335013221 | 335015221 | ...     <- design row: floor Item# + 5 trim Item#s
```

- A collection has one or more **size blocks**; each block repeats the
  header + price + coverage, so coverage/price bind per block (floor SKUs are
  9-digit numerics that pass the default pattern, but the **price is in a
  separate row and coverage is in prose** — the wizard can't attach either, so a
  parser is required, not optional).
- **Fan-out:** each design row → 1 floor + up to 5 trims (flag `trim:true`).
- **Variations to handle:** `FlexGen` block has `N/A/EA` trim prices and design
  rows with only the floor Item# (no trims) — emit floor only. `ProGen` blocks
  label the header `Design/Color` / `Item#` and put the size prose in the banner
  row's far column. A few SKUs are short/typo'd (`33503311`) — import verbatim.
- **Accessory tail (rows ~176-188):** three small FLAT tables — Residential
  Underlayment (SureStart, `Price/SF` + `Price/RL`), Floor Care (Sure Shine
  cleaner, `/EA`), Adhesives (959, QBond, `/EA`). Prose after row 188 is
  application notes — ignore.

Because Hallmark and this sheet share the OVF banded block grammar
(banner → prose → header → price row → item rows w/ floor+trims), **build them
together**: one parser strategy, two per-book column maps (Hallmark: NEW/OLD
item # + 82" moldings; Tarkett: SF/CT-in-prose + 5 × 94" trims). Could be one
`src/ovfbook.js` with two config objects, or two thin modules sharing a helper —
decide when building. Detector keys off the "Prepared especially for KEIM" +
block grammar.

Deliverable: parser + detector + ingest branch + `node --test`, PLUS small
decisions from owner:
- Fan out all 5 Tarkett trims, or floor + a subset (which moldings do you sell)?
- Import the accessory tail (underlayment/cleaner/adhesive), or floors only?

---

## Floor → trim association + a "Trim" material section (proposed 2026-07-18)

Owner wants the Mannington "pick a floor, its trims come with it" behavior for
Hallmark, Tarkett, and ultimately **all** flooring — but reworked to fit the NED
"neat, easy, done" philosophy rather than search-surfacing.

**Now (in the parser, cheap):** the OVF sheets carry each floor and its trims on
the SAME row per color (Hallmark: `AV75OBALC` + its SN/TM/RD/TH; Tarkett: floor
Item# + its Quarter Round / Slim Trim / VersaEdge / RSN / Slim Cap). So the
parser knows the **exact** parent floor for every trim — a cleaner link than
Mannington's multi-code inference. Emit trims with a `fits {floor SKU}` note (as
Mannington does) so at minimum a floor-code search surfaces its trims, floor
first (`orderFloorFirst`). This makes the data available; UI comes next.

**The feature owner actually wants (floated, NOT committed):** a **Trim** section
in a flooring row's expandable box, alongside Underlayment / Mortar / Grout
(built-in material categories, ADR 0016 pattern). Opening it lists **that floor's
associated trims** (from the parser's per-color linkage); the salesperson checks
the ones they want and sets a **quantity per trim**; it then **adds a line**
(owner's leaning) — ideally tucked directly beneath the parent flooring row —
or collapses into the row like the other material sections. Result: any flooring
product pulls its own trims **without searching** — check, set qty, done.

Design notes / open questions when it's picked up:
- Leans entirely on the per-color floor→trim data the OVF/Mannington parsers
  already produce — **data side is free; this is a UI layer.** No new plumbing.
- Where does the association live on a picked selection? A floor pick would need
  to snapshot its trim SKUs+prices (or their book+SKU) so the Trim box can list
  them offline (snapshot doctrine, ADR 0003) — decide the shape.
- Add-a-line vs. collapse-into-row: owner leans add-a-line, placed under the
  hardwood. Confirm against how Underlayment/Mortar/Grout render today.
- Generalization: works for any book whose parser carries floor→trim links
  (banded vendor books). Flat wizard books have no link unless the sheet encodes
  one — same limitation as the search-surfacing path.
- This is its own issue/ADR when greenlit; recorded here so it isn't lost.

## Proposed phasing

| PR | Delivers | Door |
|---|---|---|
| A (now, no code) | Import **Sika** + **Stauf** through the wizard; document the Stauf SKU pattern. Produces book rows only, no source files. | Wizard |
| B | OVF banded parser (`src/ovfbook.js` or a shared helper) + detector + ingest branch + tests + preview proof, covering **Hallmark** first | Parser |
| C | **Tarkett EverGen** (`Tarkett LVT` sheet only) reusing PR B's parser with a Tarkett column map, after the two scope decisions above | Parser |

PR C is cheap once PR B lands because the two OVF books share the block grammar
(see Tarkett section). If preferred, B and C can ship as one PR.

PR A is owner-run in the live app (no deploy). PRs B/C are UI-touching (the
import wizard renders the parse) → **preview proof required before merge**
(non-negotiable #3). No SQL runs — the registry tables from ADR 0009 already
exist; these are just new book rows through the existing import flow.

## Decisions needed from owner

1. Confirm all four are **cost** sheets (order books), not retail.
2. Hallmark: keep OLD item # as a search alias, or drop it?
3. Tarkett (`Tarkett LVT` sheet only — hidden sheets out of scope): fan out all 5
   trims or floor + a subset? Import the accessory tail (underlayment / cleaner /
   adhesive) or floors only?

## Out of scope / follow-ups

- Auto-fetching these from an OVF portal (ADR 0019 territory, separate).
- Capturing section grouping from banner rows on the flat books (only matters if
  markup-by-section is wanted; a `detectXxx` recognizer could add it later).
- Reference for raw structure: this ticket is self-contained; re-dump with
  `xlsx.readFile` + `sheet_to_json({header:1})` if the files change.
