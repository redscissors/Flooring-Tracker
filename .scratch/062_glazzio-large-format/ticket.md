---
issue_type: Bug
summary: Glazzio freight used the trade's 15"-side rule for large format. Glazzio
  calls a piece large at 144 sq in (a 12x12) and up — but a 12x12 MOSAIC is not,
  because a mounted sheet is priced by its chip.
status: done
labels: [ready-for-human]
---

# Glazzio's large format starts at 144 sq in — except for sheet goods

Reported 2026-07-28: "running into a problem where glazzio is pricing freight
differently then glazzio prices it. It normally would make sense to say any size
over 15 is large tile but for glazzio it only means larger then 12x24." Corrected
in the same conversation: "I said it wrong… any tile that is 144 square inches or
more is a large tile. a 12x12 in mosaic is not because a mosaic is made up of
small pcs."

ADR 0030 decision 6 shipped the trade's line — a side at or over 15" — and that
is not how Glazzio bills. Their line is **144 square inches**, the face area of a
12x12, and up.

## Why area, and why a mosaic is exempt

**A side measurement can't express it.** An 8x16 is 128 in² — a smaller piece
than the 12x12 that pallets — but has the longer side. A side rule gets that pair
backwards whichever number it picks. Area is the only measure that orders pieces
the way the vendor stacks them. Inclusive at 144, because 144 *is* the 12x12.

**A mosaic breaks the tie between size and piece.** A 12x12 mosaic sheet measures
exactly the threshold, but it is a foot of backing carrying a hundred 1" chips —
the vendor prices it by the chip, so it ships small format beside the 12x12 field
tile that ships large. The app already knows this in the common case: a mosaic
picked from a book lands with **L×W blank** and prompts for the *chip* size
(ADR 0014, `stock.js:300`), which is 1–4 in² and small at any threshold. The hole
is the hand-typed row, where someone puts the **sheet** size in L×W — and "12 ×
12" cannot be read as anything but a foot of tile.

So the exemption is by the row's own words, in a list beside the existing
always-large one:

| | |
|---|---|
| `largeAtSqin` | 144 — a piece of this area or more is large format (0 = never large by size) |
| `largeSeries` | `Harmonic, Arvora` — the sheet's own always-large tables. Beats everything |
| `smallSeries` | `mosaic, mesh, penny round, sheet` — mounted sheet goods, small whatever the sheet measures. Beats the area rule |

Whole-word matched, so "Meshach Grey" isn't mesh. All three are per book and
editable on the freight card, since 144 is Glazzio's line and not the trade's;
the card labels the threshold with the tile it is (`144 in² (12x12)`).

**Why the exemption matters more than the threshold:** mosaics are ordered in
accent quantities, and that is exactly where large format is *dearer* — its
one-pallet floor is $79 against $29.70 by the foot on 30 sf, nearly 3×. Above
~80 sf the error flips and undercharges instead. The small end is wrong by more,
which is why the guard is seeded on rather than left for someone to notice.

**No migration.** A stored `largeFormatIn` is ignored rather than converted: the
only programs carrying one hold the 15" seed, which is the rule being corrected.
The live Glazzio book picks up the new rule with no data edit.

## What it costs

Freight **drops** on the sizes the 15" rule mis-shipped, because Glazzio's
large-format pallet ($79) is cheaper than its small-format one ($149):

| Job | Before (15" side) | After |
|---|---|---|
| 300 sf of 12x12 | $149 — per-foot, over the pallet threshold | **$79** — 1 large pallet |
| 620 sf of 12x12 | $298 | **$158** |
| 30 sf of 12x12 mosaic | $29.70 | **$29.70** (guarded — would be $79 without it) |
| 620 sf of 12x24, 180 sf of 24x24 | large | **large** (unchanged) |
| 8x16, 4x16, 6x6 | 8x16 was large (16 > 15) | **by the foot** — 128 in² |

Rates read live (ADR 0030 decision 2), so open and saved Glazzio quotes reprice
on their next open.

## What changed

- **`src/freight.js`** — `normFreight` (`largeAtSqin` 144 + `smallSeries`, seeded
  `SHEET_GOODS_WORDS`; legacy `largeFormatIn` deliberately unread), `rowSqin`
  (replaces `rowLongestSide`), `matchesSeries` (whole-word, both lists), and
  `freightBasis`, whose four rules are now ordered by which one the vendor gets
  to override: pieces → named large → sheet goods → area.
- **`src/pricebooklib.jsx`** — the freight card: "Large at `144` in² (12x12)"
  naming the tile as you type it, a "Never large format" list beside "Always
  large format", and four worked examples that put the 12x12 field tile and the
  12x12 mosaic side by side.
- **`src/freight.test.js`** — the threshold at and either side of 144, the 8x16
  inversion, sheet goods picked-from-book and hand-typed, the "Meshach Grey"
  non-match, the emptied list, precedence between the two lists, and the reported
  job. 809 tests pass, lint clean.

## Preview proof

| | |
|---|---|
| `preview-freight.png` | the drawer rows, the corrected card, and the printed estimate's extras band — one Glazzio job billing all three tables ($256.01) |
| `preview-order-entry.png` | the freight lines as special orders: 2 large pallets, 84 sf small format, 24 trim pieces |

The card's worked-example strip is the rule in one line: `120 sf of 12×12 →
1 pallet · $79.00 · 120 sf of 12×12 mosaic → 120 sf · $118.80`.

Reproduce: `npm run dev`, open `/preview.html` (`#order` for the panel). The
harness job is 620 sf of 12×24 + 180 sf of 24×24 + 84 sf of 12×12 mosaic + 24
chair rails; every figure is computed by `freight.js`.
