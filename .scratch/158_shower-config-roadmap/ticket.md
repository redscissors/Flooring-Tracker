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
- **ALL-SET:** `/SETA/` classifies every ALL-SET row as `g:"set"`
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
| P0-1 | Linear-tray drain follows the SKU | OPEN | Parse the drain side from the SKU's FIRST dimension (keep `w`/`d` as long/short, add the drain-side length). Draw the channel on that wall in TopDown/print; rank orientation by it. The orientation flip becomes a **swap** to the twin SKU (KSLT965/1930S ⇄ KSLT1930/965S), not a rotation of the same tray. Fixture rows for both twins; pin the drawing. |
| P0-2 | Full KERDI-LINE range | NEEDS-INFO | Extend `classify` to fixed-length, frameless, sloping, offset and FC channels + their grates/frames (length, family, finish parsed from the SKU). The bill still picks Vario until Phase 1's slot swap; this row only makes the parts **exist** in Browse and the pool. |
| P0-3 | Show membrane / band coverage | OPEN | Second line on Browse rows and bill lines: "323 sf · $1.09/sf", bands "98 lf · $x/lf". Optional "need N sf → qty" figurer on the row (the Underlayment row type, issue 144, is the precedent for the sf → rolls math). `membraneSf` reads only "= N sf"; teach it the "(54 SF)" form too rather than leaning on the `ROLL_SF` fallback. |
| P0-4 | Tighter Browse layout | OPEN | Less padding between and within rows; price and +/− move up to the first line. Schluter Browse first; wedi Browse gets the same pass if the owner wants it (ask at proof time). |
| P0-5 | PRO-SET on wedi builds | NEEDS-INFO | Bill wedi PRO-SET (US5076012) on wedi pan/kit builds as the ALL-SET line does on Schluter's. |
| P0-6 | Keim wedi sheet drops in | NEEDS-INFO | Owner, 2026-09-26: "this should be able to be dropped in the wedi price book to update pricing and items like before." The distribution pricelist already does. The Keim sheet needs a detector + parser (Retail / Contractor / S-Dry Retail / S-Dry Contractor tabs, shop SKU + mfg SKU + price). |

### Open questions

- **P0-2:** the VTC book's KERDI-LINE rows are needed as a test fixture —
  the SKU grammar can't be written blind. Either the VTC book export file,
  or an OK to pin a fixture from the owner's copy.
- **P0-5:** quantity. Schluter figures ALL-SET as `ceil(sf / 55)`, not one
  bag. Mirror that (needs PRO-SET's sf-per-25-lb coverage — not on either
  sheet), or a flat 1 bag per pan/kit? Does it ride every wedi build or only
  pan/kit builds? Does S-DRY get S-DRY SEAL instead (its kit notes say
  "S-DRY SEAL needs purchased separately")?
- **P0-6:** which book should the Keim sheet update — the wedi **stock**
  book (today fed by the ERP Vendor SKU Analysis export; the two agree on
  125/126 rows), or a new book? Should its Contractor tab land anywhere
  (the ERP export has cost, the Keim sheet has contractor = retail × 0.82)?
  And the glass shelf: fix the sheet, or keep the stock book's $37.06?

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
