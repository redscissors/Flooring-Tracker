---
issue_type: Bug
summary: Glazzio price-list PDF import skipped the Xenia page (250) outright and
  imported the Yosemite page (251) priced per sq ft with its box price dropped.
status: done
labels: [ready-for-human]
---

# Glazzio PDF import misses the 2026-09 pages

Owner, 2026-09-18, with pages 250–251 of the Glazzio Tiles price list attached:
"The glazzio price list does not see the attached pages when the pdf price sheet
gets imported."

## Root cause

The September 2026 sheets reach pdf.js with each header label as ONE text item
("$ per Box", even "Pieces per Box SQF per Box") where the validated 2026-07
book had one item per word, and they print a finish sub-heading ("Glossy" /
"Matte") at the left margin 10px under the header. Three defects in
`src/pdfbook.js` followed:

1. `findAllHeaders` merged the "Glossy" line into the header band as a wrapped
   label, `headerAnchors` fused it with "Item #" (2px apart) into "Glossy Item
   #", the sku anchor vanished, and the header — the whole page — was dropped.
2. `headerAnchors` typed a "$" anchor by a unit word in items to its RIGHT; the
   one-item "$ per Box" carries its unit in the same item, so both price columns
   typed as $/SQF, the two cells concatenated, and the box price was lost.
3. The fused "Pieces per Box SQF per Box" item became one anchor, so the SQF/Box
   column went unlabeled: no coverage, priced by the foot, no whole-box ordering.

## Fix

- A header's neighbor line joins the band only while the band still leads with
  the item-code anchor.
- `headerAnchors` re-reads each gap-group word by word (words placed
  proportionally along their item) and splits it wherever the words so far and
  the words after resolve to two different fields; a "$" label's unit is read
  from its own words.

Three tests in `src/pdfbook.test.js` carry the real pages' geometry. Both pages
now import all 18 rows priced by the box (Xenia $60.53/BX over 16.14 SF, Yosemite
$113.78/BX over 5.55 SF), reconciling with the printed $/sqft.

## Verification on a second excerpt (2026-09-18, "Price-List_2", 21 pages)

Owner sent 21 more pages (Random Brick → Skyline). Run through the fixed parser
+ `parseMapped` against the pre-fix parser on the same text items:

| | pre-fix | fixed |
|---|---|---|
| rows | 86 | 126 |
| priced by the box | 0 | 126 |
| priced per sq ft | 86 | 0 |
| rows lost | — | 0 |

The 40 rows the old parser never saw are the four Renaissance tables (pages
2–3): the same "Polished" / "Matte" sub-heading under the header as Xenia.
Every derived $/sqft on all 126 rows is within 1¢ of a printed $/sqft and every
cost is a printed value. Six rows carry no chip size (Random Brick, Riverbed
mosaics) because the page prints none — the ADR 0014 prompt case, not a miss.

Not addressed here (cosmetic, pre-existing): a heading with "Collection" in the
middle ("Renaissance Collection - 12x12", "Sarmento Collection: Plain") keeps
the word, since only a trailing "Collection" is stripped; and a color name plus
description that repeat a word read "Shell White Shell Shell Mosaics".
