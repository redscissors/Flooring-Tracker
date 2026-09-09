---
issue_type: Bug
summary: Mannington Cartons Detail import lumps every ADURA Pro floor into a
  bare "Adura" markup group with names that never say Rigid or Loose Lay;
  hyphenated hardwood headers take the previous section's collection, and
  hardwood pages import typed as laminate.
status: done
labels: [ready-for-human]
---

# Mannington: ADURA Pro sections read as just "Adura"

Reported 2026-09-09 (owner): "the mannington SO price book. In the mark up
there is an area that only shows as adura. I think that should have
categories like pro rigid and pro loose lay." And: "when searching there is
nothing in the description to tell the loose lay from the rigid."

## Cause

The 2026-09 sheet (`Mannington_Price_Update_CartonsDetail_Acct_89367.PDF`,
42 pages) prints trademark symbols as literal text, so the section headers
read `ADURA(R)PRO LOOSE LAY PLANK (APPD)` and `ADURA(R)PRO Rigid SPC Plank
(RSPD)`. `sectionOf` in `src/manningtonbook.js` took the FIRST parenthesized
all-caps token as the section code — `(R)` — and kept only the text before
it, "ADURA". The collection is both the markup group and the front of the
floor name, so both symptoms share that one root.

Running the parser over the real sheet surfaced two more header bugs on the
same line of code:

- Hardwood headers with a hyphen or an inch mark (`Maison Collection -
  Artisan Walnut (MSA)`, `Antigua Collection - Pacaya Mesquite (PMQ)`,
  `Bengal Bay 5" (BBP)`) failed the header pattern outright, so their floors
  silently kept the previous section's collection (Antigua rows imported as
  "Restoration Collection", Maison rows as "Lattitude Collection").
- The hardwood pages' banner reads "Wood", not "Hardwood", so those 85
  floors carried the laminate type over from the preceding pages.

## Fix

- `sectionOf` strips literal `(R)`/`(TM)`/®/™, reads the header from the
  cells left of the Warranty notice, takes the LAST all-caps parenthesized
  token as the code, and drops any format note after it (`(RSTV) - 6 3/8
  Width`). Nothing in the name is filtered any more.
- `collectionName` also drops the Long / Wide / SPC qualifiers in front of
  the format word, so `ADURA(R)PRO Rigid SPC Plank` and `… SPC TILE` both
  read "Adura Pro Rigid" (owner chose to drop SPC), `… LOOSE LAY PLANK` /
  `TILE` read "Adura Pro Loose Lay", and Restoration's 6 3/8 / Long Plank /
  Wide Plank stay one "Restoration Collection" group (same rule that merges
  Max Plank with Max Rectangles).
- Only one- or two-letter caps (XL, HB) survive title-casing; the sheet
  shouts three-letter words too ("PRO LOOSE LAY").
- `Wood` maps to the hardwood type.
- On the hardwood pages the Pattern column echoes the sub-line the header
  already names ("Maison Collection - Bastille" · "Bastille"), so the floor
  name keeps only what the collection doesn't say: "Maison Collection -
  Bastille Tawny", not "… Bastille Bastille Tawny".

Regression tests in `manningtonbook.test.js` cover the (R) headers, the
Tile/Plank merge, the two Pro groups as separate markup groups, the
hyphen/inch-mark headers, the width suffix, and the Wood banner.

## Proof (real sheet, after)

`parseManningtonPages` over the owner's 2026-09 PDF: 419 floors, 1509 trims,
no warnings. Markup groups (floors):

    Adura Apex (24) · Adura Flex (87) · Adura Max (70) · Adura Rigid (71)
    Adura Pro Loose Lay (12) · Adura Pro Rigid (12) · City Line (20)
    Restoration Collection (38)
    Antigua Collection - Pacaya Mesquite (5) · Bengal Bay - Random (2)
    Bengal Bay 5" (2) · Inferno (3) · Iberian Hazelwood (3) · Kodiak (4)
    Lattitude Collection Forest Park (4) · … Park City Herringbone (7)
    … Prospect Park and Park City (12)
    Maison Collection - Artisan Walnut (1) · - Artisan Walnut HB (1)
    - Bastille (1) · - Chateau (2) · - Normandy (3) · - Provence (4)
    - Provence HB (2) · - Versailles (1) · Maison Collection Triumph (5)
    Momentum (5) · Monogram (2) · Mountain View XL (5) · Riverwalk (4)
    Sanctuary (4) · Tandem (3)

Before: one "Adura" group (24), no Antigua / Bengal Bay / Maison sub-line
groups, types vinyl 296 / laminate 123. After: vinyl 296 / laminate 38 /
hardwood 85.

    APP102 → Adura Pro Loose Lay Scandinavian Oak Natural
    RSP102 → Adura Pro Rigid Scandinavian Oak Natural
    PMQ07ASH1 → Antigua Collection - Pacaya Mesquite Ash (hardwood)

`npm test`: 1377 pass, 0 fail. `npm run lint`: 7 errors, pre-existing.

## Follow-up for the team

Already-imported Mannington books still hold the old groups and names —
re-drop the Cartons Detail PDF once this deploys; the diff will retitle the
Pro floors and the hardwood rows. Any per-group markup set on the old
"Adura" key should be re-entered on "Adura Pro Rigid" / "Adura Pro Loose
Lay". The sheet's last two pages (Installation, Adhesives & Sundries) are a
different table and are still not imported — unchanged by this fix.
