---
issue_type: Feature
summary: Schluter EFT profile rows read like the ERP stock book's — thickness ×
  stick in the size field, thickness filled, vendor shorthand spelled out, no
  "Rondec Corners Rondec …" doubling, Schluter lead.
status: done
labels: [ready-for-human]
---

# Schluter EFT: profile SKUs read like the stock book's

Owner, 2026-09-14: SLRRO100TSI (Schluter EFT) should read more like stock SKU
23189 (`3/8" Schluter Jolly Trendline - A100TSI Ivory`) — the thickness
(5/16, 1/4, 3/8) in the size field, ideally with the length, and less
redundancy in the description. Owner supplied the real EFT
(SLR_EFT_25_10_01.xls, 7,033 rows) and the ERP Vendor SKU Analysis export.

## What the sheet does

- `RONDEC BULLNOSE TRIM 3/8 ALUM TEXTURED IVORY`, product line "RONDEC
  CORNERS" — the product-line fronting rule (ADR 0009 §3) produced "Rondec
  Corners Rondec Bullnose Trim 3/8 Alum Textured Ivory".
- Thickness is a bare fraction on ~5,000 of 5,827 profile rows; only 418
  rows state a length (10', 4'11", 8FT); the 2.5 m stick is implied.

## Decisions (owner, 2026-09-14)

- Assume the implied 8'2-1/2" stick on a straight profile with no stated
  length; show it as `8'`, size smooshed (`3/8"x8'`) to save space.
- Description style: the EFT's own words with abbreviations expanded, bare
  ALUM dropped, PVC/stainless/brass kept, no product-line prefix, "Textured"
  kept (not renamed Trendline), a leading angle moved behind the corner words
  ("Jolly Out Corner 90°"), and a "Schluter" lead like the stock book.
- The code stays in the SKU field only (SLRRO100TSI, the VTC item code);
  order entry pins it at the end of the line, so it is never in the name.

Recorded as ADR 0041.

## Diff gate (sheetimport §6), whole real files

- Schluter EFT, 7,033 rows: 7,033 descriptions changed; 4,895 sizes landed;
  4,086 thicknesses changed (BARA/DESIGNBASE face heights no longer read as a
  thickness; the rest new); 3 wizard warnings, all pre-existing honest hazards
  (79 no-price rows, 1 PA pallet row, 8 PK boards); 0 name-litter advisories
  (was 13 mid-development — the "1 X 7/16" cove legs and the "9/ 32" typo).
- ERP stock export, 525 rows: identical.

Sample (size · thickness · description):

| SKU | Size | Description |
|---|---|---|
| SLRRO100TSI | 3/8"x8' | Schluter Rondec Bullnose Trim Textured Ivory |
| SLRBH100 | 3/8"x8' | Schluter Jolly-P Edge Trim PVC Bahama |
| SLREVJ100TSOB | 3/8" | Schluter Jolly Out Corner 90° Bronze |
| SLRQ100TSBG300 | 3/8"x10' | Schluter Quadec Square Trim Greige |
| SLRBWA80SP | 5/16"x8' | Schluter Dilex-BWA 3/8" Movement Joint Sand Pebble |
| SLRFL90EB150 | 11/32"x4'11" | Schluter Trep-FL Stair Edge Brushed Stainless Steel |
| SLRHKSV2AU25O11G | 1"x7/16" | Schluter Dilex-HKS Cove Stainless Steel Grey |
| SLRRRW15PG | (none) | Schluter Bara-RW Radius Balcony Edge 9/16" Classic Grey |

Tests: pricebook.test.js (schluterDescription goldens from real rows, the
profile workbook end to end, the existing SLR fixture updated for the lead
and the un-doubled Ditra-Heat name). 1,410 pass.

No UI or print code changed; no SQL. Reaches the live book on the next
re-drop of the EFT. Follow-ups left alone: KERDI rows spelling "4 1/2 IN"
(generic path), ECK-E W/H leg dims.
