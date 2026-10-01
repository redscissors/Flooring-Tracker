---
issue_type: Question
summary: wedi/Schluter lines print differently depending on whether a part was
  searched in from the stock book or landed by the configurator — what would the
  sheet look like with the stock-book descriptions?
status: open
labels: [needs-info]
---

# Shower line descriptions — stock book vs configurator

Owner, 2026-10-01: wedi stock SKU 28862 picked from search prints the stock
book's description; the same part landed by the wedi configurator prints the
configurator's description. Curious what a print sheet looks like with the
stock-book descriptions instead. "Maybe Schluter as well."

## Where each name comes from (no bug — two designed write paths)

- **Search pick** → `stockPatch` (stock.js) → `label()`: the ERP stock-book
  description with the shop's own vendor codes dropped (`dropOwnCodes`), the
  size column as the row's size. A misc row keeps NO thickness — 28862
  (4'x5'x½") and 28864 (4'x5'x¼") both read "Wedi Building Panel · 4'x5'".
- **wedi configurator** → `lineItems` (wedi.js): the engine's own name. Pans
  and panels are DERIVED by the foot with the inches on the second line
  ("wedi — 4'x5'x1/2\" Building Panel · 48"×60"×½"", owner ask 2026-08-06);
  everything else is the wedi pricelist's marketing name ("wedi® Subliner Dry
  Mixing Valve Seal") where the stock book says "Wedi Mixing Valve Flexi Collar".
- **Schluter configurator** → `brandName` (schluter.js): the stock row's
  description as imported, vendor code still inline ("Kerdi Drain Flange Kit -
  KD3FLKE Stainless"); the search pick drops the code. Same source, so the
  Schluter gap is only the inline code.

## Mockup (harness, not product code)
`npx vite --port 5199` then `node .scratch/165_shower-line-descriptions/shot.mjs`
and `node .scratch/165_shower-line-descriptions/compare.mjs`. The REAL
EstimatePaper over the 090 fixture job plus a wedi 36×60 kit (registry
fixture through the live adapter) and a Schluter 60×38 membrane kit; `?names=stock`
swaps each line's name/size for what a search pick of the same SKU lands.
- `configurator.pdf/.png` — today
- `stock-book.pdf/.png` — stock-book descriptions on the same lines
- `compare.png` — the two shower areas side by side
