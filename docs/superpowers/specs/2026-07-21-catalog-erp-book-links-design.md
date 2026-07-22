# Catalog fed from ERP stock books — design

**Date:** 2026-07-21
**Status:** Approved by user (brainstorming session)
**Supersedes data sourcing in:** ADR 0006 (grout base companion), ADR 0007 (grout colors from book family) — mechanics preserved, data source moves from the hand-kept stock workbook to ERP vendor-sku books. A new ADR records the link/family-link decision when implemented.

## Context

The hand-maintained "NEW Stock Flooring Price Book.xlsx" is being replaced by per-supplier ERP "Vendor SKU Analysis" exports (DOIT, GLATI, GUNDL, MANMI, OHIVA, SHEOG, Sheet1) dropped into OneDrive. PR #219 already lands each export as its own **stock-kind registry book** (filename-stem routing, whole-book diff on re-drop, retired SKUs go inactive, explicit retail persisted).

What still depends on the old workbook:

- Catalog product prices refresh via `syncCatalogPrices` (name/SKU text match against `stock_items`).
- Grout color families / color dropdown (ADR 0007, `parseGroutMatrix` on the Grout & Caulk sheet).
- Color-matched caulk snapshot (ADR 0007).
- Laticrete pigment→base auto-add (ADR 0006, "Bulk & Base Units" columns).

The company/category/chip structure itself (Settings → Materials & add-ons, `settings.catalog` jsonb, ADR 0016) never came from the workbook and is unchanged by this design.

**Goal:** catalog products connect to ERP book rows through durable links so constant re-drops keep the catalog current — including the grout family features — letting the old workbook retire completely.

**Verified against the real exports (2026-07-21):** Sheet1.xlsx carries the full Laticrete structure — SpectraLock Pro Part A&B bases (Full 0.8 gal, Commercial 3.2 gal) + ~40 "9LB SPECTRALOCK PRO NN COLOR PART C" rows; PermaColor Select Sanded/Unsanded bases + ~40 "… NN COLOR COLOR KIT" rows; ~40 "10.3 OZ LATASIL NN COLOR - 100% SILICONE CAULK" rows. Laticrete color numbers match between grout and caulk (24 ↔ 24). Likewise TEC Power Grout ↔ TEC sanded caulk (910 ↔ 910) and Custom premixed grout (DOIT) ↔ Custom silicone caulk (OHIVA). 96 of 99 stock-book grout SKUs exist in the exports; the 3 missing are surfaced during migration.

## Non-goals

- Watching the OneDrive folder / auto-importing. The drop → review → apply rhythm is unchanged.
- Auto-deriving companies or products from book contents. The catalog stays curated by hand; only two of seven exports even carry Product Group codes and brands live in free text.
- Deleting the legacy workbook code paths (`parseGroutMatrix`, `syncCatalogPrices`, `detectStockWorkbook`). They go dormant after migration; removal is a later cleanup.
- The Virginia Tile EFT special-order lists (order-kind books) — untouched.

## Design

### 1. Data model — stock links

Catalog products (in companies' `grouts` / `mortars` / `underlayments` / `attached` arrays, `settings.catalog` jsonb) gain one optional field. Links are **IDs, never text matches**, and live only in the catalog — imports rewrite book contents but never touch catalog structure. Sync flows one direction: book → linked product.

**Item link** (everything except grout families):

```
link: { bookId, sku }
```

Product name, SKU, unit, cost, and retail are filled from the row at pick time and refreshed from it on every import of that book.

**Family link** (grout products):

```
familyLink: {
  bookId,
  rule,            // stored matching rule that selects the family's color rows
  baseSkus,        // explicit picks: { default, variant } (ADR 0006 pairing)
  caulk: { bookId, rule },   // the matched caulk series (may be a different book)
  cache            // last-resolved members, kept for the zero-match safety net
}
```

- **Colors are rule-based** so a new color in a re-drop joins the dropdown automatically. The rule is generated at pick time from the shared series stem of the selected rows (description with the color number/name token removed), user-adjustable at confirm time. The saved artifact is the rule, not the row list.
- **Bases are explicit SKU picks** (two stable rows per family); keep-and-warn applies if one disappears.
- **Caulk is rule-based** like colors; the color match is by **color number** parsed from the description (fallback: normalized color name). No match for a given color → no caulk snapshot, same as an empty matrix cell in the old workbook.

### 2. Import-time sync

Hook: immediately after `applyBookImport` upserts a book's items, refresh that book's linked catalog products:

- **Price/cost changed** → update automatically. Jobs are unaffected (they snapshot at pick time; existing drift chip already covers divergence).
- **Description/unit changed** → refresh the product's unit; the linked row's current description shows beside the link tag in Settings. The catalog product's **name is never auto-renamed**: jobs resolve materials by name at calc time (ADR 0002/0016), so a rename from an import would silently stop saved jobs calculating — the one thing imports must never do. Company/category assignment never changes from an import either.
- **Linked SKU inactive** (dropped from the file) → **keep + warn**: product stays selectable at last known price; Settings shows a warning chip ("no longer in MANMI stock") with relink / keep / disable actions.
- **Family links** → membership recomputed by rule: new colors appear, dropped colors keep-and-warn, price changes flow to colors, bases, and caulk.
- **Import summary** gains one line, e.g. "3 linked products updated, 1 link lost, 2 new colors in SpectraLock Pro."

### 3. Grout family behavior

**Setup (once per grout line):** in the picker, searching e.g. "SpectraLock" offers the family. Auto-grouping proposes members sorted into three buckets on a confirm screen — colors (parsed number + name, own SKU/price each), bases (default + variant), matched caulk line. The user adjusts and confirms; messy families (e.g. DOIT premixed grout's three different description wordings) are fixed here once, because the rule is what's saved.

**In a job — unchanged UX:** chip on → pick family → color dropdown lists live colors. Picking a color snapshots its SKU/price, auto-adds the base unit (same ratio math as today; Commercial = 4 kits per base, variant toggle preserved), and snapshots the color-number-matched caulk.

**On re-drop:** rule re-runs over the book (Section 2).

### 4. Picker UI (Settings → Materials & add-ons)

- **"Add from stock book"** button beside the existing "New product" input, per company/category. Opens a search over stock-kind books (all or filtered to one), matching descriptions and SKUs. Pick a row → linked product created prefilled under that company/category. Grout category → family mode.
- Linked products show a book tag ("MANMI · 07879") and a **relink** action.
- Hand-entry ("New product") remains for one-offs; unlinked products behave exactly as today. Linking is additive, never required.

### 5. Migration (one-time assisted pass)

- The app proposes an item link wherever an existing product's SKU appears in **exactly one** stock-kind book; a review list shows proposed matches to confirm plus unmatched leftovers (including the 3 grout SKUs absent from the exports) to relink by hand or leave unlinked.
- Grout families are set up via the family picker, once each, replacing their old-workbook `book` family field.
- Until a product is linked it behaves exactly as today — nothing breaks mid-migration. After migration the legacy workbook sync paths are dormant.

### 6. Safety nets

- **Zero-match family rule** (supplier rewrites every description): the family keeps serving its cached last-known colors, marked with a warning chip, until the rule is re-confirmed in the picker. No dropdown ever goes blank from a bad re-drop.
- Warning states derive at render time from current book items; the job grid keeps working off stored product data regardless.

### 7. Testing

`node --test` units covering:

- Family auto-grouping + rule generation against **real description samples from the seven exports**, including the messy DOIT wordings.
- Color number/name parsing (Laticrete 2-digit, TEC 9xx 3-digit, Custom caulk numbering).
- Caulk matching by number with name fallback; no-match → no snapshot.
- Import-time sync: price/name/unit refresh, keep-and-warn on inactive, family membership recompute (new + dropped color).
- Migration proposal logic (unique-SKU match, ambiguous SKU excluded).
- Zero-match cache fallback.

## Components touched

- `src/catalog.js` — link fields, family resolution helpers, sync entry point.
- `src/usebooks.js` — post-`applyBookImport` sync hook + summary line.
- `src/SettingsWorkspace.jsx` — picker, confirm screen, warning chips, migration review.
- `src/stock.js` — grout family/color/caulk resolution re-pointed at book items (successors to `groutFamilies` / `groutColorItem` / `groutCaulkItem`).
- `src/App.jsx` — color dropdown & base auto-add read the new resolvers; chip rendering otherwise unchanged.
- New ADR documenting stock links + family links.
