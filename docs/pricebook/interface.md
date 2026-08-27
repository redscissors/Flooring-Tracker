# Interface carpet tile — pricing, formats, and the color book

How Interface's dealer pricing works and how ned imports it
(`src/interfacebook.js` + the `src/interfacecolors.js` color book), written
2026-08-27 from the Keim dealer price list (8.19.25 edition,
`.scratch/114_interface-carpet-tile/`) and the rep's own explanation (Jeff
Krejci, Interface — "Pricing and Package Sizes", 2026-07-03); the color book
added the same day from shop.interface.com.

## How Interface prices carpet tile

- **Costs are per SQUARE YARD** (9 sq ft) — the trade convention for carpet.
  The whole carpet section of the price list is $/sy. ned prices everything
  per square foot, so the importer converts: **cost/sf = list ÷ 9**.
  The rep's own worked example checks out: Shiver Me Timbers $26.25/sy →
  $2.92/sf; WW860 $26.50/sy → $2.94/sf.
- **Cartons** (Jeff, 2026-07-03): most styles pack **5.98 sy/carton =
  53.82 sf, 20 tiles**. Higher face weight products pack **4.78 sy/carton =
  43.02 sf, 16 tiles**. The price list itself never says which styles are the
  heavy packs, so the importer assumes the standard pack and the import
  wizard warns — the assumption only affects whole-carton rounding, never the
  $/sf cost.
- **One row per style, no colors.** The orderable thing is style + colorway
  (e.g. "Open Air 401, Linen"); the sheet carries only styles. See "the color
  book" below.
- **Formats.** The size column is a coded letter, decoded off the sheet's own
  rotated legend:

  | Code | Size | Carton assumed |
  |---|---|---|
  | SP | 25cm × 1m skinny plank (9.84" × 39.4") | 53.82 sf / 20 tiles |
  | 50 | 50cm × 50cm square (19.7") | 53.82 sf / 20 tiles |
  | M | 1m × 1m | none stated — orders exact sq ft |
  | P | 50cm × 1m plank | none stated — orders exact sq ft |

- **i2** marks Interface's non-directional styles (install tiles any way —
  less cut waste, single-tile replacement). On the value collections' pages
  the same column is spelled Y/N. The importer stamps `i2 — non-directional
  install` into the item note.
- **The trailing LVT section** (its own "Product Name / Size / Collection /
  Thickness / Price" header) is priced **per square foot** as printed —
  imported as vinyl with the stated metric size and thickness. The 3.0 mm
  editions are separate rows on the sheet and separate SKUs in the book.

## What the shop actually quotes (from the email record)

- Open Air collection (401–442 + Stria variants) — $18.00/sy dealer =
  $2.00/sf; sold at $3.00/sf on the Marcus ↔ Leah Weisel quote.
- Harmonize / Ground Waves / Ground Waves Verse — $22.75/sy = $2.53/sf; also
  quoted at $3.00/sf.
- Jeff's examples: Shiver Me Timbers $26.25/sy, WW860 $26.50/sy.

Suggested markup shape for the book: a default plus a per-collection override
(the book's markup group is the collection), since the Open Air family is the
promo-priced line.

## The color book

The price list has no colorways — the colors live in Interface's physical
sample deck and on interface.com. Each style runs 8–25 colorways, and each
style+color pair has its own Interface identity: the style number plus a
color number (Open Air 401 = style 9628C; "9628C 107689" is its Amber).

That pairing is now in the repo as **`src/interfacecolors.js`** — the
transcribed color book, scraped from shop.interface.com's US product pages
(2026-08-27; the owner opened the environment's network access to
www.interface.com + shop.interface.com for it). One entry per price-list
style, keyed by the style name exactly as the sheet prints it: the style
number, and every colorway's `[colorNumber, name, quickShip?]` — the
QuickShip mark is the shop's own badge. 302 of the list's 305 styles are on
the shop site (3,400 colorways); HN830 and OVEREDGE are not sold there and
import style-only, and cross-format twins (Viva Colores) share one entry.

`parseInterfacePages` joins it at import time (the transcription sibling of
the Mirage joined-source idea, ADR 0025 rule 7 — but the second source is a
checked-in table, not a dropped file, since Interface publishes no color
export a browser import could read): the book lands **one row per orderable
style+color**, SKU `"<styleNo> <colorNo>"` (+ the format code on twins),
description "Style, Colorway", the style's cost/carton/collection on every
row, QuickShip joined onto the note beside i2. The wizard's warnings name
the join date and any style-only leftovers, so a stale color book is
visible at every re-import.

**Refreshing after a season shift or a new price list** (colorway ranges
move seasonally): from the repo root,

```
node .scratch/114_interface-carpet-tile/colorbook-styles.mjs <price-list.pdf> > styles.json
python3 .scratch/114_interface-carpet-tile/colorbook-scrape.py styles.json src/interfacecolors.js
```

then re-run the tests and re-import the price list in the app — the book
picks up the new colorways on the apply. Needs egress to shop.interface.com
(the Claude environment allowlist, or any machine that reaches it).

The rep's item/color **export** would still be better than the scrape —
it's the same data with carton specs and heavy-pack flags attached, and it
doesn't depend on the storefront's markup staying stable.

## Open questions for the rep

1. Which styles on the list are the **4.78 sy / 16-tile** heavy packs?
2. Carton packs for the **1m × 1m** and **50cm × 1m** formats.
3. The **item/color list export** — now mostly answered by the shop scrape
   (see the color book above), still wanted for carton specs and as the
   authoritative record.
4. The list's footnote asterisks (Shishu Stitch*, Open Air 442 * …) — what do
   they mark? (The importer drops them from names.)
5. HN830 and OVEREDGE are priced on the list but not sold on
   shop.interface.com — still orderable? Their colorways come off the sample
   deck until answered.
