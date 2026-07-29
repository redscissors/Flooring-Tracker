# wedi shower-system configurator — prototype

**Status:** prototype · 2026-07-29
**Open:** `prototype.html` in a browser (fully standalone, no build — it loads
its two sibling scripts `proto-data.js` + `proto-engine.js`).
**Design record:** `ticket.md` (domain rules, pricing rules, production path).

A configurator for wedi shower systems, deliberately not a Sheoga clone:
wedi has SKUs and published retail (MAP), so nothing is marked up — sell is
book retail, cost is distributor net (≡ the ERP's stocked cost, verified to
the penny), and the one wedi-specific pricing rule is **Builder = retail ×
0.82** instead of the app's flat 8% off.

## The three surfaces

| Tab | What it does |
|---|---|
| **Kits** | Every stocked pan as a card; one click assembles the house kit from shop stock (pan + drain cover + ½" wall panels + curb/curbless waterproofing + fasteners + sealant + collars + trowel), mirroring wedi's own boxed-kit recipe, with a compare chip against wedi's factory kit price. Every line swappable/steppable, add-on chips for niches/seats/benches/gun/recess. |
| **Custom** | Room inputs (pan W×D, curbed/curbless, drain preference, walls + heights) → the solver returns ranked options: exact pan · pan + extensions (corner-extension rule, cut list) · larger pan cut down · linear module + extension (drain at wall). To-scale top-down layout + isometric 3-D view, printable layout sheet. |
| **Browse** | Fast manual builder over the whole catalog (stock ranked first, special order behind), group chips + search + steppers, and a "Figure sealant & fasteners" card using wedi's own consumption numbers (1 screw+washer / ft² panel · 1.2 oz sealant / ft² panel). |

Shared: the build column (grouped lines, tier lens, totals + margin, factory-kit
compare), **Add to product lines** (payload preview incl. the `wedi:{mode,cfg}`
reconfigure marker), **Print layout**, and the SKU-search entry demo showing
the pinned "Vendor configurators" row carrying Sheoga and wedi side by side.

## Data

- `data/wedi-stock.json` — 151 stocked items from `WEDI_1.xlsx` (ERP Vendor
  SKU Analysis): ERP code, description, cost, retail, unit, wedi US-SKU.
- `data/wedi-so.json` — 229 rows + 6 factory-kit content notes from
  `USA_wedi_Distribution_Pricelist_JAN_1_2026.xlsx` ("wedi Fundo" sheet):
  US-SKU, name, size, details, suggested retail, distributor net, section,
  discount band, ERP link when stocked. Cross-check: every linked row's net
  equals the ERP cost exactly (0 drift).
- `proto-data.js` — the same two tables as script-tag consts (generated; a
  pricelist update is a re-generation, see `ticket.md`).
- Consumption/install rules transcribed from the Illustrated Price List 2026
  (pp. 11, 19, 21) and the wedi Technical Handbook (Feb 2025): fastener and
  sealant planning rates, 12"/6" fastener spacing, ½" min panel on 16" o.c.
  studs, extension slope/stack/corner rules, curbless recess options.

## Production path (proposed — see ticket.md for detail)

- `src/wedi.js` — data tables + engine (dependency-free, `node --test`);
  `src/wediquery.js` — the tiny boot-chunk search recognizer;
  `src/WediConfigurator.jsx` — lazy chunk (ADR 0026).
- `product.wedi = { mode, cfg }` on the anchor line (normP pass-through like
  `sheoga`), companion lines `wedi:{part:true}`; "wedi — reconfigure" chip.
- Builder ×0.82 rides `product.tierPrice` (the pre-cut slot from
  docs/pricebook/design.md Q5) + a `wediBuilderPct` knob in `normPricing`;
  `pricing.js` prefers `tierPrice` at its three hook points.
- `WEDI_1.xlsx` dropped into the Price book library is already recognized by
  `detectVendorSkuAnalysis` as a stock book — that alone makes wedi items
  searchable on every row (requirement 1, zero new code).

## Files

- `prototype.html` + `proto-engine.js` + `proto-data.js` — the prototype
- `P1`–`P9` `.png` — preview proof screenshots (`shoot.mjs` retakes them:
  serve the repo root on :5199, `node shoot.mjs`): P1 the 36×60 house kit ·
  P2 a curbless kit's waterproofing lines · P3 the 48×66 solver with both
  diagrams · P4 two-side curbless extensions + corner piece on the Builder
  lens · P5 the linear module + extension · P6 Browse with the consumables
  figurer · P7 the payload modal · P8 the search-entry row · P9 the printed
  layout sheet
- Mobbin pattern references: [IKEA kitchen planner](https://mobbin.com/screens/46855235-8a29-4755-bf50-a856787778b0),
  [Walmart ingredients list](https://mobbin.com/screens/fd11011b-cfa3-4552-9d6f-caf36a1a2456),
  [Uber Eats item customize](https://mobbin.com/screens/c86d6d66-cc95-4ec3-9889-a0ceadf1eaeb)
