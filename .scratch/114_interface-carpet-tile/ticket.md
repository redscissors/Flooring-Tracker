---
issue_type: Feature
summary: "Owner 8/27: add Interface carpet tile to ned. New vendor parser
  (interfacebook.js) for the Keim dealer price list PDF — $/sy ÷ 9 per sq ft,
  assumed 53.82 sf / 20-tile cartons per the rep, format letters decoded to
  sizes, i2 noted, trailing LVT section as vinyl. One row per style; the
  colorway 'color book' is a follow-up (docs/pricebook/interface.md)."
status: done
labels: [ready-for-human]
---

# Interface carpet tile price book (owner, 8/27)

The owner wants Interface carpet tile quotable in ned. Inputs: the Keim
dealer price list PDF (8.19.25, in this folder) and the rep's pricing
explanation from the email record (Jeff Krejci: costs per square yard;
5.98 sy/carton — 53.82 sf, 20 tiles — for most styles, 4.78 sy/43.02 sf for
higher face weights).

## What shipped

1. **`src/interfacebook.js`** — recognizer + parser for the Interface list
   (the same `{ name, rows, mapping, warnings, meta }` contract as
   manningtonbook.js, feeding the mapped-import wizard unchanged). On the
   real PDF: 275 carpet styles + 30 LVT rows, all 305 consumed.
   - Carpet: cost = $/sy ÷ 9, priced SF, ordered CT with the assumed
     standard carton (wizard warns; 1m×1m / 50cm×1m formats get no carton
     and order exact sq ft). Type carpet, size decoded from the SP/50/M/P
     format legend, i2 (or its Y/N spelling) → item note.
   - Collections ride the **MFG** column (markup group, search subtitle,
     searchable, diff-tracked) — NOT Product Line, whose fronting doubles
     words on styles like "Open Air 401 Stria" in "Open Air Stria".
   - Style-name casing is the parser's own: codes keep their capitals
     ("World Woven WW860", not "Ww860"); wrapped collection cells
     ("Dressed Lines" / "Coordinates") re-join; a style sold in two formats
     (Viva Colores) splits into per-format SKUs; footnote asterisks drop.
   - LVT section: per-sq-ft as printed, vinyl, metric size + thickness.
2. **Wiring** — `dropimport.js` fingerprints the layout as `interface`
   (routes re-drops to the book); the wizard dispatches the parser and now
   surfaces parser-level warnings for every PDF path (previously only
   Mirage's joined parse showed them).
3. **Tests** — `src/interfacebook.test.js`, 12 cases over a
   coordinate-faithful fixture, through the REAL parseMapped → pricedItem →
   stockPatch pick path.
4. **`docs/pricebook/interface.md`** — the pricing/format doctrine, the
   researched colorway lists, and the rep questions (which styles are heavy
   packs; the item/color export that becomes the real color book).

## Preview proof

`preview-import-wizard.png` — the REAL BookImportWizard ingesting the real
PDF (temp harness over import-preview's rig): columns auto-mapped, 305
items parsed, the square-yard conversion + carton-assumption warnings
showing, and the review table landing Carpet · SF → CT · $2.44/sf for the
$22/sy Aerial rows.

## Known nits / follow-ups

- The trim-as-area advisory flags 11 styles whose names carry design words
  ("Open Air 403 Transition", the Step Repeat SRs) — false positives on
  carpet; mark reviewed once in the book. (With the color book those 11
  styles read as 91 colorway rows in the advisory — same false positive,
  same one-time review.)
- "Touch Of Timber Emea" — EMEA loses its caps to the word-caser. Cosmetic.
- ~~The colorway "color book": blocked on Interface's item/color list
  export~~ — shipped, round 2 below (owner unblocked it 8/27 by opening
  network access to shop.interface.com instead of waiting on the rep).

## Round 2 — the color book (owner, 8/27)

The owner opened the Claude environment's egress to www.interface.com +
shop.interface.com and asked for the color book, scoped to the styles on
this price list (not the shop site's full 334-style range).

1. **`src/interfacecolors.js`** — the transcribed color book: every
   price-list style matched to its shop.interface.com US product page and
   its colorway swatches scraped (name + Interface color number + QuickShip
   badge). 302/305 styles, 3,400 colorways; HN830 and OVEREDGE aren't on
   the shop site and import style-only. Style numbers are the shop's own
   product ids (Open Air 401 = 9628C).
2. **`interfacebook.js` joins it at import** — one row per orderable
   style+color: SKU `"9628C 107689"` (real Interface item pair; twins keep
   the format code), description "Open Air 401, Amber", the style's
   cost/carton/collection on every row, QuickShip beside i2 in the note.
   Unknown styles keep their name-keyed row; the wizard warns with the
   scrape date and the style-only list. Re-importing the same PDF over the
   old style-keyed book shows 3,470 new · 303 retiring · 2 unchanged — the
   re-key is deliberate and visible.
3. **Refresh pipeline** — `colorbook-styles.mjs` + `colorbook-scrape.py`
   (this folder) regenerate interfacecolors.js wholesale; doctrine in
   docs/pricebook/interface.md.
4. **Tests** — interfacebook.test.js grew to 19 cases: the join (expansion,
   item-pair SKUs, twin suffixes, note merge, LVT thickness twins,
   style-only fallback + warnings, a color-row pick through the real
   pricedItem → stockPatch path) over a mini color book, plus spot checks
   pinning the shipped table (9628C, the WW860 tweeds, entry shape).
   Boot hygiene: the ~100 KB table rides interfacebook.js into the
   Settings/pricebook lazy chunk only — verified absent from the boot
   chunk in a production build.

Preview proof: `preview-color-book-import.png` — the REAL BookImportWizard
ingesting the real PDF through the production parse path over the
previous style-keyed book: the colorway rows in the mapping preview and
review table (Carpet · SF → CT · the ÷9 cost), the join + style-only
warnings, and Apply reading "3470 new · 0 changed · 303 retiring".
