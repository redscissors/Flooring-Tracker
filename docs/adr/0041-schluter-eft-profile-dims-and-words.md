# ADR 0041 — Schluter EFT profiles: bare-fraction thickness, implied 8' stick, vendor shorthand spelled out

- **Status:** Accepted
- **Date:** 2026-09-14
- **Scope:** area-scoped (Schluter EFT import parsing, `src/pricebook.js`)
- **Related:** ADR 0009 §3 (the product line fronts the description — this ADR
  exempts the Schluter EFT); ADR 0029 (the ERP stock export's lead-width rule,
  whose `3/8"x8'` spelling this matches); the 2026-08-07 brand-aware EFT
  recognizer (`.scratch/083`).

## Context

Virginia Tile's Schluter EFT (7,033 rows, 5,800 of them profiles) prints a
profile like `RONDEC BULLNOSE TRIM 3/8 ALUM TEXTURED IVORY` under a product
line of "RONDEC CORNERS". Three things made those rows read badly against the
ERP stock book's own `3/8" Schluter Jolly Trendline - A100TSI Ivory`:

- The thickness is a bare fraction with no inch mark on ~5,000 rows. The
  shared description splitter deliberately ignores markless fractions (a
  DILEX-STF `22/40` is a joint spec), so `3/8` stayed in the name and the
  size and thickness fields were empty.
- Only 418 rows state a length; Schluter's standard 2.5 m (8'2-1/2") stick
  is implied everywhere else.
- The product line is a grouping label, not a series, so ADR 0009's
  "product line fronts the description" rule produced "Rondec Corners Rondec
  Bullnose Trim …" and "Ditra Heat Ditra-Heat Membrane Roll".

The owner asked (2026-09-14) for the size field to read thickness × length,
the way the stock book does, and for the redundancy and shorthand to go.

## Decision

All of it rides the EFT mapping's `schluter` flag (set by `detectVtcEft` from
the brand line), so no tile sheet is touched.

1. **Profile families read their dims from the text** (`schluterDescription`,
   gated on the product line: JOLLY, RONDEC, SCHIENE, QUADEC, DILEX, RENO,
   TREP, DECO, VINPRO, FINEC, ECK, DESIGNBASE, BARA, INDEC, DESIGNLINE). The
   thickness is the **last** tile-sized inch fraction (≤ 1-1/2", proper, over
   a power-of-two denominator — `22/40` is never a dimension) that isn't a
   width (`WIDE`, `W`/`H` suffix), a joint (`MVMT JNT`, `W/ … JNT`) or half
   of an L×W. BARA, DESIGNBASE and ECK print face heights, never a thickness.
   Two fractions around an `X` (a DILEX-HKS cove's legs) land as text,
   `5/16"x11/32"`, never a decimal tile size.
2. **The size field is thickness × stick.** A stated length is kept (`10'`,
   `4'11"`); a straight profile with a thickness and no stated length is
   assumed to be the standard 2.5 m stick and lands as **`3/8"x8'`** — the
   stock book's spelling, shortened at the owner's ask because the ERP
   description field is 70 characters. Corners, connectors, end caps, inserts
   and sets get the thickness alone. **This is invented data, accepted
   knowingly:** a family whose real stick differs reads wrong until its sheet
   says otherwise. Nothing else in the import invents a value (ADR 0029's
   rule stands everywhere else).
3. **Vendor shorthand spells out** (`schluterWords`, every Schluter row):
   CRN → Corner, JNT → Joint, MVMT → Movement, BRH/BRSH/BRUSH → Brushed,
   SS/STN → Stainless Steel, ANOD → Anodized, DK/LT/BRT/WHT/BLK…, `N DEG` →
   `N°` with a leading angle moved behind the type words ("Jolly Out Corner
   90°"), repeats collapsed ("SS STAINLESS STEEL"), hyphen model codes kept
   upper (Rondec-CT, Dilex-AHKA) while hyphenated words case (Jolly-Radius).
   Bare ALUM/ALU/ALUMINUM is dropped — aluminum is Schluter's default and says
   nothing on a row; PVC, stainless and brass stay because they change the
   product.
4. **Every Schluter row leads with "Schluter"** (owner's choice, matching the
   stock book), unless the text already says it. **The product line never
   fronts a Schluter name.**

## Consequences

- SLRRO100TSI imports as size `3/8"x8'`, thickness `3/8"`, description
  `Schluter Rondec Bullnose Trim Textured Ivory`; the order-entry line reads
  `3/8"x8' Schluter Rondec Bullnose Trim Textured Ivory SLRRO100TSI`.
- The SKU field is unchanged: the VTC item code (`SLRRO100TSI`), which order
  entry pins at the end of the line. The code never rides the description.
- A parser change only reaches an existing book on re-import: re-drop the
  EFT (the drop router recognizes it) and the rows rewrite.
- Setting the book's brand label to "Schluter" (Brand card) lets order
  entry's shortening ladder drop the lead first when a line runs past 70.
- Whole-sheet diff gate (sheetimport §6), 7,033 rows: 7,033 descriptions
  changed (lead, shorthand, no product-line prefix), 4,895 sizes landed,
  4,086 thicknesses changed (bogus BARA/DESIGNBASE height-as-thickness reads
  cleared, the rest new), 3 wizard warnings (all pre-existing honest hazards:
  79 no-price, 1 pallet unit, 8 PK boards), zero name-litter advisories. The
  ERP stock export is byte-identical.
- Left alone on purpose: the 92 KERDI/KERDI-LINE rows that spell "4 1/2 IN"
  (non-profile, generic path), and the ECK-E rows' W/H leg dims beyond
  spelling them out.
