---
issue_type: Bug
summary: The OVF TrueTouch price sheet (PDF) imported nothing — its prices live
  in a per-collection band and its rows lead with the color name, so the generic
  PDF reader found no product rows. A dedicated parser now reads the grid.
status: done
labels: [ready-for-human]
---

# OVF TrueTouch PDF price sheet imports nothing

Reported 2026-07-28 with `ovftruetouch.pdf` (Aspose export, "Prepared
especially for KEIM LUMBER CO", pricing effective 07/13/2026): "New Price
sheet that the import does not find."

## Why the generic path failed

The sheet is the PDF twin of OVF's banded .xls flooring lists (issue 025):
per collection a warranty banner, a construction/size prose line, a coverage
line, a stacked trim-column header, then **one price band** — the floor's
$/SF + $/CT plus a single per-piece price per trim column — and finally color
rows carrying only SKUs. `parsePdfPages` (ADR 0010) is header-driven and
expects prices *on* the rows with an item code in the leftmost column; here
the leftmost cell is the color **name** and no row carries a price, so it
found no product rows at all and the drop router tagged the file `generic`.

## The fix

`src/truetouchbook.js` — a dedicated fixed-grid parser (the sanctioned
ADR 0009 §4 / ADR 0012 exception), recognized by `isTrueTouch` (the OVF
account line + the "Item Name | Item #" header) and wired into the drop
router (`ovf-truetouch`) and the wizard's PDF fork. The price band's own
x-positions define the trim columns; every SKU on a color row is matched to
its column by x. Section state carries across pages (Hawaii 4.5mm banners on
page 1, its grid opens page 2). Floors emit carton cost + SF/CT coverage so
whole-carton ordering works (REAL WOOD lines → hardwood, waterproof lines →
vinyl); trims emit per-piece from the band, `trim`-flagged, `fits`-stamped,
with the tread columns' "3 ctn min" note kept on the description. Hawaii's
letters-only stair-nose codes (HWHOSTN) forced the SKU pattern to drop its
digit requirement — a letter is still required.

## Parse proof (the real sheet, all 3 pages)

46 floors + 166 trims, 212/212 rows through `parseMapped`, zero warnings:

| Collection | Floors | $/CT | SF/CT | Type |
|---|---|---|---|---|
| Evolv | 10 | $94.96 | 25.68 | hardwood |
| Momentum | 6 | $57.60 | 20.8 | hardwood |
| Hawaii 4.5mm | 8 | $65.68 | 28.68 | vinyl |
| Hawaii 5.0 mm | 8 | $80.75 | 30.02 | vinyl |
| Tsunami (7" x 60") | 11 | $111.41 | 36.12 | vinyl |
| Tsunami (9" x 72") | 3 | $139.24 | 45.06 | vinyl |

Sample rows as the picker will show them:

```
EM815CEP  floor  $94.96/BX  25.68 sf/ct  Evolv Canopy Elegance
EM815TMD  trim   $21.49/EA  Evolv Canopy Elegance — T-Molding · fits EM815CEP
408TTF295R trim  $84.99/EA  Evolv Canopy Elegance — Round Stair Tread (3 ctn min) · fits EM815CEP
HWHOSTN   trim   $42.89/EA  Hawaii 4.5mm Honolulu — Overlap Stair Nose · fits HW45HO409 HW50HO509
W88711STN trim   (no price — the sheet prints "N/A /PC") · fits W88711
```

Tsunami's Overlap Stair Nose column is priced "N/A /PC" on the sheet — those
trims import with no cost (missing beats wrong; the import review flags them).

To use: drop `ovftruetouch.pdf` on the Price book library and create/pick its
book — the first import stamps the `ovf-truetouch` fingerprint so every later
drop routes to that book automatically.
