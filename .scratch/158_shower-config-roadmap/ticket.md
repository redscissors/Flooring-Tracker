---
issue_type: Feature
summary: Schluter + wedi configurator roadmap — Phase 0 quick wins (linear
  drain side, full KERDI-LINE range, membrane coverage, tighter Browse, wedi
  PRO-SET), then a shared slot model, Board-vs-Membrane parity, and a 4-way
  compare.
status: open
labels: [needs-info]
---

# Shower configurators — the slot / parity / compare roadmap

Owner review, 2026-09-26, working from the VTC book (Keim account), Schluter's
USA MSRP list, the wedi distribution pricelist (Jan 1 2026) and Keim's wedi
price sheet. This ticket is the standing ledger, the way issue 105 was for
Schluter ⇄ wedi parity: each Phase 0 row lands in its own round (PR +
preview proof) and gets its status flipped here. Phases 1–3 each get a
design spec before any code — they are listed so the order is on record.

Legend: **OPEN** — ready to build · **NEEDS-INFO** — waiting on an owner
answer (listed under the row) · **DONE** — landed, round noted.

## Findings that shaped Phase 0 (verified in code, 2026-09-26)

- **Linear-tray drain side is wrong.** `trayDims` (schluter.js) stores every
  tray as `w = max, d = min`, and `trayCandidates` gives linear trays one
  orientation with the channel on `w`. Schluter's first dimension is the
  drain side: KSLT965/1930S is 38″×76″ drain on the 38″ side, KSLT1930/965S
  is 76″×38″ drain on the 76″ side (same price). Today both parse to the
  same `{w:76, d:38}` and both draw the drain on the 76″ wall.
- **Only Vario is recognized.** `classify` knows `KLVR…` (channel) and
  `KLVR2FLK` (flange). The VTC book carries ~500 KERDI-LINE rows, ~430 of
  them not Vario — fixed 20″–72″ in 4″ steps, frameless, sloping, offset,
  tileable-cover (FC) — and `adaptRow` drops every one of them because the
  grammar returns null. The gap is the grammar, not the data.
- **Membrane coverage is already parsed, just not shown.** `ROLL_SF`,
  `PLAIN_SF`, `BAND_LF` and the "= N sf" description read give each KERDI
  roll/band its coverage; the Browse rows and bill lines never print it.
- **ALL-SET:** the EFT carries only ALL-SET white (`SETA50W`). `/SETA/` classifies every ALL-SET row as `g:"set"`
  (55 sf/bag). Owner, 2026-09-26: **only ALL-SET white, the in-stock one** —
  grey and FAST-SET stay out.
- **wedi setting mortar** is **PRO-SET Tile Adhesive 25 lb, US5076012** —
  stocked (shop 1518109, $22). Already in both wedi books; nothing bills it.
- **wedi has two membrane systems, both stocked:** Subliner Dry (53 / 323 sf
  rolls, sealing tape, corners, seals — installed with Sealant 620) and the
  new **S-DRY** system (Mar 2026: 50″×25′ 104 sf and 80″×16′ XL 106 sf
  membrane, S-DRY tape, corners, collars, **S-DRY SEAL**, own bases/curbs/
  kits). Phase 2 has to pick which one is wedi's "Membrane".
- **wedi uploads, 2026-09-26:** the distribution pricelist parses through
  `parseWediPricelist` to 262 rows **identical** to the book's 2026-09-02
  build — it re-drops cleanly and changes nothing. Keim's "NEW Wedi Price
  Sheet 316" is **not recognized** (would fall to the generic column-mapping
  import); it matches the wedi stock book on 125/126 rows. Only differences:
  the niche glass shelf 1503638 reads $127.82 on the sheet (= the 4×5×2″
  panel's price, a sheet typo) vs $37.06 in the stock book, and the
  discontinued 10 oz Sealant 620 (28866) is on the sheet but not the book.

## Phase 0 — quick wins

| # | item | status | notes |
|---|---|---|---|
| P0-1 | Linear-tray drain follows the SKU | DONE | Landed 2026-09-26 (`p0-1/` — before/after shots). A KSLT tray's `w` is its channel edge; the Kits rows name it ("38″×76″ · drain on 38″"); the Walls ⇄ rotate lands the twin. Plan: Parse the drain side from the SKU's FIRST dimension (keep `w`/`d` as long/short, add the drain-side length). Draw the channel on that wall in TopDown/print; rank orientation by it. The orientation flip becomes a **swap** to the twin SKU (KSLT965/1930S ⇄ KSLT1930/965S), not a rotation of the same tray. Fixture rows for both twins; pin the drawing. |
| P0-2 | Full KERDI-LINE range | DONE | Landed 2026-09-26 (`p0-2/`): all 524 EFT KERDI-LINE rows adapt (was 82), as `g:"line"` — bodies/grates/FC grate connectors (the EFT's own name; not tileable covers)/profiles/acc; bills pinned unchanged; Vario grate guards + strainer no longer classify as channels. Plan: Data in hand (owner, 2026-09-26: VTC EFT `SLR_EFT_25_10_01.xls` — 523 KERDI-LINE rows, 82 recognized today, all Vario — and Schluter's USA list 2026-04-01). Families: channel bodies `KL1V60E<len>` / offset `KL1VO60E<len>` (len code = cm: 50…180 → 20″…72″); framed grates `KL1{AR19,B19,BL19,AR30,B30,IFE23,IFF23,IFG23}<finish><len>`; thin-frame tile grates `KLTFH{6,12,22}E<len>`; frameless tileable `KL1DRE` / offset `KL1DROE`; FC cover plates `V/KL<finish>35`; sloping/adjustable shower profiles `SPS…`/`SPR…`. **Trap:** the linear recipe's channel pick (`chansAll`, schluter.js ~822) takes ANY `part:"channel"` — tag every channel with its family and keep the recipe on Vario. Extend `classify` to fixed-length, frameless, sloping, offset and FC channels + their grates/frames (length, family, finish parsed from the SKU). The bill still picks Vario until Phase 1's slot swap; this row only makes the parts **exist** in Browse and the pool. |
| P0-3 | Show membrane / band coverage | DONE | Landed 2026-09-26 (`p0-34/` before/after): `coverageOf` in both engines; Browse line 2 leads "108 sf · $1.92/sf" (KERDI rolls, boards, bands in lf; wedi Subliner/S-DRY/panels, tapes in lf), build lines append the $/unit, `membraneSf` reads "(54 SF)". No new figurer — the existing "Figure thin-set & KERDI" already turns wall sf into rolls + ALL-SET (owner OK'd the design). Plan: Second line on Browse rows and bill lines: "323 sf · $1.09/sf", bands "98 lf · $x/lf". Optional "need N sf → qty" figurer on the row (the Underlayment row type, issue 144, is the precedent for the sf → rolls math). `membraneSf` reads only "= N sf"; teach it the "(54 SF)" form too rather than leaning on the `ROLL_SF` fallback. |
| P0-4 | Tighter Browse layout | DONE | Landed 2026-09-26, both popups (owner: "both"): star · price · +/− on the name's line, rows ~54 → ~40px; lead time only when it says IMPORT, in rust red (owner 2026-09-26); wedi's non-retail "retail $X" moved to line 2; Schluter names drop the "Schluter" lead (ADR 0041's `shown`). Reverses the wedi 2026-08-02 two-line split — the SKU stays on line 2, which is what truncated names then. Plan: Less padding between and within rows; price and +/− move up to the first line. Schluter Browse first; wedi Browse gets the same pass if the owner wants it (ask at proof time). |
| P0-5 | PRO-SET on wedi builds | DONE | Landed 2026-09-26 (`p0-5/`): `kitFor` bills 1 bag; Compare files it under Setting, the thin-set note retired (ADR 0034 amendment). Plan: Owner, 2026-09-26: **flat 1 bag.** Bill wedi PRO-SET (US5076012) on wedi pan/kit builds as the ALL-SET line does on Schluter's. |
| P0-6 | Keim wedi sheet drops in | DONE | Landed 2026-09-26 (`p0-6/`, ADR 0025 amendment) as a **price update**: `keim-wedi` format routed to the wedi stock book; only live rows' retail moves (ERP rounding: up to the cent), new SKUs add, nothing retires, fingerprint/mapping untouched. Today's sheet on the 2026-09-01 snapshot: 1 changed (the glass shelf typo, 37.06 → 127.83 — owner fixes the sheet), 1 added (28866), 151 unchanged. Also fixed: "Add a file…" no longer revives retired rows. Plan: Owner answers 2026-09-26: the drop **updates the wedi stock book**; the Contractor tabs land **nowhere** (Retail + S-Dry Retail only); the niche glass shelf 1503638 keeps the book's **$37.06** (the sheet's $127.82 is a copy error) — the design must keep that row's price through the re-import. Plan: Owner, 2026-09-26: "this should be able to be dropped in the wedi price book to update pricing and items like before." The distribution pricelist already does. The Keim sheet needs a detector + parser (Retail / Contractor / S-Dry Retail / S-Dry Contractor tabs, shop SKU + mfg SKU + price). |

### Open questions

- ~~P0-2 data~~ — answered 2026-09-26 (EFT + USA list uploaded).
- ~~P0-5 quantity~~ — answered 2026-09-26: flat 1 bag. The wedi configurator
  builds no S-DRY today, so S-DRY SEAL is a Phase 2 question.
- ~~P0-6 book / Contractor tab / glass shelf~~ — answered 2026-09-26 (see
  the P0-6 row).

## Phase 1 — shared slot model (design spec first)

Every build line belongs to a named slot, identical for both brands: Tray ·
Drain body · Grate/cover · Flange · Wall board · Wall membrane · Seam/band ·
Corners · Niche · Bench · Curb · Setting material.

- Swap lists everything valid for the slot, grouped family → size →
  finish, with the price difference shown (generalizes issue 109's
  `cfg.swaps`: grate / curb / One-size board today).
- Drain swaps at every level: family (Vario, fixed KERDI-LINE, frameless,
  point) → length (fixed lengths auto-size to the wall) → grate. Needs P0-2.
- Seam tape / KERDI-BAND swap by width and length; "swap" and "add another"
  are separate actions.
- "+" on each group header (Walls, Niches, Drains, …) opens an inline picker
  filtered to that slot — grab a different panel without leaving for
  Browse.
- Niches allow several lines of different sizes.

## Phase 2 — Board vs Membrane on both brands (design spec first)

Schluter: KERDI-BOARD | KERDI (exists). wedi: Building Panel | **Subliner
Dry or S-DRY** (owner picks — see findings). Rename "overbacker" to
**Membrane** everywhere.

## Phase 3 — 4-way compare (design spec first; needs 1 + 2)

The same room through wedi Board, wedi Membrane, Schluter Board, Schluter
Membrane without opening them — 2×2 grid or a slim always-on bar of four
live totals. Each cell: total, difference from the current build, and a
flag when something didn't map cleanly (no matching pan size, cut or
mortar-bed fallback, no drain match, an "inquire" price). Click a cell to
open that build; click a flag to jump to the line; check several and send
them to the space as quote options A–D (ADR 0031/0034 machinery).
