# Schluter shower-system configurator — prototypes

**Status:** prototype · 2026-08-20
**Open:** `prototype.html` in a browser (fully standalone, no build).
**Ask (owner):** a Schluter configurator like wedi; a stock-only / full-catalog
mode; a way to compare wedi and Schluter.

Three surfaces on one page:

| # | Surface | What it shows |
|---|---|---|
| P1 | **Schluter configurator** | The wedi popup's sibling: Kits / Custom shower / Browse over a shared build column. Schluter-specific: the **wall-system fork** (KERDI membrane over backer vs KERDI-BOARD), and **trays cut, they don't extend** (exact tray → cut down → deep cut → mortar-bed fallback; wedi's 6″ soft rule kept). |
| P2 | **Stock only / Full catalog** | A source switch in the popup header. Full catalog ranks freely and tags non-stock lines *special order*; Stock only removes non-stocked parts from the candidate pool and swaps stocked substitutes in (curb 60″ → 2× 48″ cut to length, 323 sf KERDI roll → 108 sf rolls). Lands in the shared shell, so wedi gets it for free. |
| P3 | **wedi ⇄ Schluter compare** | One room, both engines, lined up by category (Base / Drain / Walls / Seams / Curb / Setting) with totals per tier, stock coverage, and the differences that matter (walls, fit strategy, pricing model). |

## Data status

- **wedi side: real numbers** pulled from `src/wedi.js` (pan/panel/curb/sealant
  retail = the Jan-2026 pricelist / ERP export). Two allowance lines are
  marked `est.`
- **Schluter side: placeholders** at plausible MAP with realistic SKUs. Good
  enough to judge the UI; **not quotable**. The production engine would be
  generated from real sheets like wedi's was.

## What the owner needs to upload

1. Current **Virginia Tile Schluter EFT** (`SLR_EFT_*.xls`) — catalog + net
   cost. The import pipeline already parses every Schluter size spelling
   (issue 083).
2. The shop's **Schluter stock sheet** / ERP Vendor SKU Analysis for Schluter —
   stock flags + shop retail (the 107-item sheet from
   `.scratch/008_multi-pricebook-system/sheets/` is dated 4.30.2024).
3. The **Schluter Illustrated Price List / shower-system brochure** — kit
   contents and coverage rules to transcribe, the way wedi's handbook rules
   were.

## Open owner questions

- **Pricing rule:** wedi is retail/0.82-builder with no markup knob. Schluter
  has no equivalent published program in the repo — prototype shows the app's
  flat −8% builder with an asterisk. Real rule TBD.
- **Compare delivery:** A) compare tab in the popup (this prototype) ·
  B) cross-price chip in the build column · C) quote options (ADR 0031) — wedi
  in Option A, Schluter in Option B, printed side by side. Recommended: A + C.

## Production path (proposed, mirrors wedi issue 066)

- `src/schluter.js` — generated tables + engine (`node --test`, dependency-free);
- `src/schluterquery.js` — tiny boot-chunk search recognizer (never imports the tables);
- `src/SchluterConfigurator.jsx` — lazy chunk (ADR 0026), sharing the popup
  shell/TierBar/build-column idioms with wedi;
- `product.schluter = { mode, cfg }` reconfigure marker (normP pass-through like `wedi`);
- the **source switch** as a shared shell control both configurators read
  (`solve(cfg, {source})`), plus the same switch as a hard filter in Browse;
- the **compare tab** calls both engines' `kitFor()`/`lineItems()` on one cfg.
