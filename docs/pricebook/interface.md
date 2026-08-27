# Interface carpet tile — pricing, formats, and the missing color book

How Interface's dealer pricing works and how ned imports it
(`src/interfacebook.js`), written 2026-08-27 from the Keim dealer price list
(8.19.25 edition, `.scratch/114_interface-carpet-tile/`) and the rep's own
explanation (Jeff Krejci, Interface — "Pricing and Package Sizes",
2026-07-03).

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

## The missing "color book"

The price list has no colorways — the colors live in Interface's physical
sample deck and on interface.com. Each style runs 8–24 colorways, and each
style+color pair has its own Interface item number (style code + color
number, e.g. Open Air 401 = style 9628, "9628009 Linen").

**The real fix:** ask Jeff Krejci for Interface's **item/color list export**
(the specifier data Interface publishes per style — item numbers, colorway
names, carton specs, and which styles are the 4.78 sy heavy packs). With
that file in hand, the importer can grow a second joined source (the Mirage
chart pattern, ADR 0025 rule 7) and the book becomes one row per orderable
style+color with real item numbers.

Until then, colors are picked off the sample deck and typed onto the
selection line — the book prices the style, which is what the estimate needs
(every colorway of a style shares its price).

Colorways verified from Interface's site (2026-08-27), for the collections
the shop quotes:

- **Open Air Neutrals** (shared 24-color palette): Amber, Barley, Black,
  Brown, Buckwheat, Burlap, Charcoal, Concrete, Ebony, Flannel, Granite,
  Gypsum, Iron, Linen, Mist, Natural, Navy, Nickel, Oat, Raffia, Sawgrass,
  Shell, Stone, Travertine. Open Air Stria layers three accent stripes from
  the Open Ended range onto the same neutrals.
- **Open Road** (Come & Go, Free Reign — shared palette): Amber, Amethyst,
  Black, Bordeaux, Brick, Cayenne, Charcoal, Ebony, Flannel, Granite,
  Hickory, Indigo, Iron, Linen, Mist, Natural, Navy, Nickel, Oat, Pine,
  Shell, Spruce, Stone, Turquoise.
- **Harmonize & Ground Waves** (shared neutrals; Ground Waves adds accent
  bands, Verse a second accent set): Cobalt, Driftwood, Flax, Gravel, Gull,
  Iceberg, Iron, Laurel, Mesquite, Midnight, Pewter, Prairie.
- **Shiver Me Timbers** (24 wood-name colors): Ash, Balsam, Beech, Birch,
  Buckeye, Cedar, Cyprus, Dogwood, Eucalyptus, Ginkgo, Hawthorn, Hickory,
  Ironwood, Juniper, Laurel, Magnolia, Maple, Mimosa, Poplar, Sequoia,
  Spruce, Sycamore, Walnut, Willow.
- **WW860 (World Woven)**: Linen Tweed, Flannel Tweed, Brown Tweed, Natural
  Tweed, Charcoal Tweed, Black Tweed, Raffia Tweed, Sisal Tweed, plus
  quick-ship and extended colorways (Navy, Nickel, Riverbed, Shell, Umber,
  Volcanic Tweed).

Colorway ranges shift seasonally — treat this list as orientation, the
sample deck and the rep's export as the record.

## Open questions for the rep

1. Which styles on the list are the **4.78 sy / 16-tile** heavy packs?
2. Carton packs for the **1m × 1m** and **50cm × 1m** formats.
3. The **item/color list export** (see above).
4. The list's footnote asterisks (Shishu Stitch*, Open Air 442 * …) — what do
   they mark? (The importer drops them from names.)
