---
issue_type: Bug
summary: The 8/26 Glazzio CLNL289 flags — a sheet mosaic keyed CT at the desk
  and its description lost the identifying tail. Sheet goods now default SH,
  order-entry sheet sizes read nominal (true size on hover), coverage is exact,
  "Collection" is the first word dropped, and SKU + coverage never leave a
  description.
status: done
labels: [ready-for-human]
---

# Glazzio sheet mosaics: CT vs SH + the order-description rules (Marcus, 8/26)

Two central Claude issues on the same job line (Q-Glazzio Colonial Collection
Lo-8/26 · CLNL289), talked through with Marcus 2026-08-26. Five decisions, all
implemented. Preview proof: `preview-order-entry.png` (the real
`OrderEntryPanel` over the real `orderEntryRow`, `order-entry-preview.html`).

## Why it said CT

The Glazzio PDF importer maps its money unit to `priceUnit` only; the items
carry no sell/order unit, and `stockPatch` defaulted the bundling unit to
`CT`. So a row whose coverage (1.06 sf) and size text ("12.375x12.375 sheet")
are per SHEET wore a carton label — in the Order column, the coverage column,
and (because of the CT-only tag rule from issue 104) at the very front of the
pasted description. The CT was our default, never Glazzio's data.

## What changed

1. **`src/stock.js`** — a sheet mosaic (`sheetSize`) with NO vendor-stated
   unit defaults its bundling unit to **SH**, never CT. A vendor-stated unit
   (SH, or the VTC PC-spelled-sheet rows) still passes through untouched, so
   ADR 0014's pins hold. Order column reads "37 SH", coverage "SF/SH", no CT
   tag (SH deliberately wears none, issue 104 #6).
2. **Saved rows** — per Marcus: NO load-time rewrite. The two flagged CLNL289
   lines keep their snapshot until the SKU is re-picked on the row after this
   deploys (seconds each). Snapshot doctrine untouched.
3. **`src/orderentry.js` `sheetNominal` + `src/print.js`** — a landed sheet
   size ("12.375x12.375 sheet") reads **nominal** at order entry (`12x12"`),
   with the vendor's exact dims on hover (`sizeTrue` → the size span's title).
   Generic sheet-goods rule, every book — not a Glazzio special. Only the
   exact landed shape converts; hand-edited size text passes through, and the
   grid/estimate keep showing the stored text.
4. **`src/orderentry.js` + `src/descfit.js`** — two description-rule changes:
   - **"Collection" is series typography, not identity**: it splits into its
     own rank-4 part, first dropped when the field runs tight (before even
     the brand), kept while there's room.
   - **SKU and coverage are PINNED**: they never drop and never clip,
     whatever the limit — the body abbreviates/splits around them and the "+"
     marker sits between the cut body and the surviving tail
     ("12x12\" Glazzio Colonial Long Hex Village Square + CLNL289 1.06 SF/SH").
     This reverses the ranked drop order recorded in the descfit header; a
     tail wider than the whole field now overruns and reports `over` (red
     count in the panel) instead of losing the tail. Visible consequence at
     the 30-char default: more lines split, and a very tight field can carry
     little more than "CT + SKU coverage" — the trade Marcus chose.
5. **`src/print.js`** — order-entry coverage is **exact** ("1.06 SF/SH"),
   never the one-decimal rounding that printed "1.1" — a 4% error the desk
   would multiply.

## Left as data / follow-ups for the team

- The name's trailing "2" ("…Village Square 2") and any other wording is the
  book item's own description — edit it on the Glazzio book page, or wait for
  issue 086 (approved per-item short descriptions), which Marcus's "Collection
  is redundant" reasoning further motivates. If the "2" turns out to be
  importer litter, drop the raw PDF row into a session and the importer can be
  fixed for the whole collection.
- Re-pick CLNL289 on the two flagged job lines once deployed (item 2 above).
- The AO Profiles (8/21) and Kessel Ovo (8/20) bucket entries were already
  verdicted in issue 104 (#4/#5: vendor's own text, no code change) — they can
  be checked off in Issues → Claude alongside the two 8/26 ones.

## Verification

- `npm test` — 1131/1131 passing (new: descfit pin rungs, sheetNominal,
  Collection drop order, never-drop tail, SH default, exact coverage,
  nominal + sizeTrue through orderEntryRow).
- `npx eslint` clean on every touched file.
- Preview: `preview-order-entry.png`; hover verified in the DOM
  (`<span title="12.375x12.375 sheet">12x12"</span>`).
