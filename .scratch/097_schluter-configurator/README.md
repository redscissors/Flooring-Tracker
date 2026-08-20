# Schluter shower-system configurator — prototypes

**Status:** prototype, real data · 2026-08-20
**Open:** `prototype.html` in a browser (fully standalone, no build).
**Ask (owner):** a Schluter configurator like wedi; a stock-only / full-catalog
mode; a way to compare wedi and Schluter.

Three surfaces on one page:

| # | Surface | What it shows |
|---|---|---|
| P1 | **Schluter configurator** | The wedi popup's sibling: Kits / Custom shower / Browse over a shared build column. Schluter-specific: the **wall-system fork** (KERDI membrane over backer vs KERDI-BOARD), and **trays cut, they don't extend** (exact tray → cut down → deep cut → mortar-bed fallback; wedi's 6″ soft rule kept). |
| P2 | **Stock only / Full catalog** | A source switch in the popup header. Full catalog ranks freely and tags non-stock lines *special order*; Stock only removes non-stocked parts from the candidate pool and swaps stocked substitutes in (curb 60″ → 2× 48″ cut to length, 323 sf KERDI roll → 108 sf rolls). Lands in the shared shell, so wedi gets it for free. |
| P3 | **wedi ⇄ Schluter compare** | One room, both engines, lined up by category (Base / Drain / Walls / Seams / Curb / Setting) with totals per tier, stock coverage, and the differences that matter (walls, fit strategy, pricing model). |

## Data status — REAL (owner uploads, 2026-08-20)

- **wedi side:** real numbers from `src/wedi.js` (Jan-2026 pricelist / ERP
  export). Two allowance lines are marked `est.`
- **Schluter side:** generated from the owner-uploaded **ERP Vendor SKU
  Analysis** (`Sheet1.xlsx`, 525 rows, 226 Schluter — cost / retail / on-shelf
  counts) joined with **`SLR_EFT_25_10_01_2.xls`** (7,083 rows, dealer cost,
  lead times). 54 curated shower-system items + 5 boxed kits drive the page.
  Raw sheets NOT committed (shop pricing) — same rule as issue 008/066.

## Findings from the sheets

- **Pricing rule:** the Schluter stock book prices every row at
  **retail = 1.5 × cost** (mean ratio 1.502 over 226 rows). Schluter is a
  plain markup book — the wedi 0.82 publish-retail model does not apply. The
  EFT is cost-only: its "consumer" column equals dealer cost because the
  account markup cell is 0.
- **Drift:** stock-book costs trail the 10/01/2025 EFT ~6% on trays/boards
  (48"×60" tray $121.03 book vs $128.59 EFT; KERDI-BOARD 4'×8' $74.36 vs
  $79.01). A registry re-import would surface these through the existing
  drift machinery.
- **Range:** the shop shelves the whole KST/LTS tray lineup, all five KERDI
  roll sizes, band, corners, seals, KERDI-BOARD ½" panels + fasteners,
  KBSC curbs 38/48/60, Kerdi-Line-Vario 4'/8' + flange, drain kits in four
  finishes, niches (incl. lighted), benches, All-Set, Kerdi-Fix. The factory
  KERDI-SHOWER-KIT boxes are all special order — the shop-built kit from
  shelf stock is the natural play, which the Kits tab says out loud.
- **Price-list pages received (2026-08-20):** a 16-page split covering
  KERDI-BOARD / benches / niches / fasteners / KERDI-BAND / membranes — see
  `pricelist-notes.md` (kit-contents facts, MSRP-vs-shop table). Still
  wanted: the KERDI-SHOWER tray/kit chapter and the KERDI-LINE / KERDI-DRAIN
  chapter (`assets.schluter.com` itself stays egress-blocked).
- **Drawing (owner ask 2026-08-20):** the popup now carries a to-scale
  top-down plan like wedi's — wall bands, ghost of the uncut tray with rust
  cut lines, drain placement (an off-centre drain after a cut is called out),
  curb/ramp, niche + bench markers. The isometric is production work — the
  wedi drawing machinery generalizes once the shell is shared.

## Owner decisions (2026-08-20, on the parity review)

1. **wedi gets the wall fork too**: S-Dry is wedi's membrane-over-backer
   analog — design the same "wall system" choice INTO the wedi configurator
   (companion issue for the wedi config, not this build).
2. **Mortar-bed fallback carries a real mortar**: the fallback card lands a
   mortar line whose product is a Settings → Materials pick (e.g. 60 lb deck
   mud), quantity from the picked product's own rate — plus KERDI over the
   cured bed. Engine takes `cfg.mortarItem`; never a $0 by-installer line.
3. Two-part drains + cuttable Vario — accepted as prototyped.
4. **Benches match wedi's doctrine**: premade KERDI-BOARD-SB on the tray,
   **installer-framed + ½" board wrap** (interrupts the envelope, wedi rule),
   or **2" KERDI-BOARD build-up on the finished tray**.
5. **Factory boxed kits show ONLY in Browse** (→ Factory kits filter) — the
   Kits tab is the shelf trays alone.
6. Curbless: Schluter TT thin trays + ramp/recess vs wedi's dedicated
   curbless pans — see the note in the session log; solver prefers TT when
   curbless.
7. Registry-driven pricing plumbing — approved.
8. **Geometry convention carries over**: "Sizes are Pan | Max — curb inside"
   + tile-thickness insets apply to Schluter exactly as wedi.

**Drawing engine**: production reuses wedi's — extract `TopDown`/isometric/
`railSplit` out of WediConfigurator.jsx into a shared drawing module both
configurators feed with the same build-geometry shape (walls + heights/faces,
base rect + cuts, curbs, benches, drain). Schluter feeds no extension seams,
panel-course ticks only on board walls, and the Vario channel as a length.
The 2"-board stock row (KB506252440: shop cost $166.73 vs EFT $59.06) looks
like a pack row — flag-for-Claude candidate on the next import.

## Open owner questions

- **Builder tier:** retail is settled (1.5×); is Schluter's builder price the
  app's flat −8%, or its own rule? Prototype shows −8% with an asterisk.
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
