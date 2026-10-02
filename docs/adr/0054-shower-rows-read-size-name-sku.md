# wedi and Schluter rows read size · name · SKU; the engine derives the name from the part

- **Status:** Accepted
- **Date:** 2026-10-01
- **Scope:** the wedi and Schluter engines (what a landed row carries), the
  selection-sheet print, the popups' titles
- **Related:** spec `docs/superpowers/specs/2026-10-01-shower-line-descriptions-design.md`;
  ADR 0035 (kit landing), ADR 0037/0038 (wedi registry-driven), ADR 0041
  (Schluter EFT import), ADR 0049 (`.scratch/160` popup label). Supersedes the
  2026-08-06 naming ask that lived in `wedi.js` (bases and panels "by the foot,
  SKU and inches on the second line").

A line a shower configurator lands carries its measure in the **Size** field and
a clean name in the **Product** field: `wedi <Part>[, qualifier]` for wedi,
`<PRODUCT-LINE> <Part>[, qualifier]` with no brand word for Schluter ("KERDI-SHOWER-T
Tray", "ALL-SET Thin-set" say whose they are). No dash separators, no ® or ™, no
"Fundo", no repeated "Wedi"; a qualifier (finish, drain placement, pack count,
coverage) follows a comma. Each engine derives both texts from the classified part
in one place (wedi `makeEntry` → `entryText`, Schluter `catalogOf` → `partText`), so
the popup, Compare, the basket, the landed row and the order copy all read the same
words, and the same tray reads the same whichever book it came from. The printed
sheet shows such a row (one carrying a `wedi` or `schluter` marker) as one dark
`size name` line and a muted `SKU n` tail that never splits across lines (the
vendor part number for a special-order line); the standard product line (name
bold, size · coverage · SKU muted) is unchanged for every other row, and `SKU n`
no longer splits there either.

Size spelling: pans and panels read by the foot when both sides are whole feet
(`3'x5'x1/2"`), everything else in inches (`24"x48"`, `38"x60"`), rolls as width
by length in feet (`39"x16'`, `3'3"x33'`), thickness always inches and last,
mixed numbers hyphenated (`1-37/64"`). Bases show their thickness; extensions
show both dimensions; a counted part's quantity is its size (`100 ct`, `20 oz`,
`25 lb`).

## Considered options

- **Bake the size into the name**, Size field empty. Rejected: the grid's Size
  column goes unused on these rows, and order entry would carry the size twice.
- **Land the stock book's description** (what a search pick lands). Rejected: the
  ERP text loses the panel thickness (28862 ½" and 28864 ¼" both read "Wedi
  Building Panel · 4'x5'") and the cover finish — `.scratch/165_shower-line-descriptions/compare.png`.
- **Rename rows already on saved projects on load.** Rejected: quotes change text
  under people, and a hand-edited name could be overwritten.
- **Feet on any whole-foot side** (the spec's first wording). Narrowed to pans
  and panels: it put `24"x4'` extensions beside `3'x5'` panels.

## Consequences

- The 2026-08-06 names (feet in the name, inches on the muted second line) are
  gone for new lands; saved rows keep their text until their kit is landed or
  reconfigured again (`landKitLines`), never rewritten on read.
- A search pick from the stock book still lands the stock description — making it
  borrow the configurator's name needs a lookup the boot path can afford (the
  engines are lazy chunks) and is its own change.
- The popups' option-card and basket titles compose size + name (`panTitle`,
  tray `[size, name]`) since the entry name no longer carries a size; the popup
  row label (`kitLabel`) reads the size from the Size field.
- A wedi niche keeps its interior on the entry (`interior`), read by the tile
  sq ft math and Compare's mirror; the Size field holds the outer size.
- Schluter's grammar now reads a point drain's pipe size and material, a corner
  pack's count and a niche's millimetre pair; the EFT's slash-less roll codes
  (`SLRKERDI2007M`) classify as their real roll.
