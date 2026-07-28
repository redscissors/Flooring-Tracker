---
issue_type: Bug
summary: Glazzio freight priced 12x24 as large format. Glazzio's large format is
  what is LARGER than a 12x24, so the rule is now the piece's face area (over
  288 sq in) plus the sheet's named series, not a single 15" side.
status: done
labels: [ready-for-human]
---

# Glazzio's large format is what outgrows a 12x24, not a 15" side

Reported 2026-07-28: "running into a problem where glazzio is pricing freight
differently then glazzio prices it. It normally would make sense to say any size
over 15 is large tile but for glazzio it only means larger then 12x24."

ADR 0030 decision 6 shipped the trade's line — a side at or over 15" is large
format — and that quotes Glazzio wrong. Their large-format table is what is
**larger than a 12x24**; a 12x24 itself ships on the per-foot table with the
mosaics.

## Why area, and why 288

A side threshold can't express "larger than a 12x24": any number low enough to
catch a 24x24 also catches the 24" side of a 12x24. The first cut of this fix
tried a two-axis fit (over 12 on the short side **or** over 24 on the long side);
the follow-up asked for square inches instead, which is both simpler and better
evidenced:

- **288 in² is exactly a 12x24** (2 sq ft), so the threshold IS the size the
  vendor names.
- **Area is the literal reading of "larger."** A 16x16 is 256 in² — a smaller
  piece than a 12x24 even though it is wider — and ships by the foot. Under the
  fit rule it would have gone on the pallet.
- **The sheet corroborates it.** Glazzio's second pallet table is "Harmonic 12x24
  & Arvora LVT" — a 12x24 is 288 in² and a 6x48 LVT plank is *also* 288 in².
  Both sit exactly on the small side of the line, which is precisely why the
  vendor has to name them. Under the fit rule any 48" plank was already large by
  its long side, and naming Arvora would have been pointless.

120 in² (the number first floated) would have made the whole book large format:
a 12x12 mosaic is 144 in², and the 12x24 this ticket is about is 288.

| | |
|---|---|
| `largeOverSqin` | 288 — a piece with more face area than this is large format (0 = never large by size) |
| `largeSeries` | `Harmonic, Arvora` — series the sheet ships by the pallet whatever their size, matched against the row's description |

Both are per book and editable on the freight card, since 288 is Glazzio's line,
not the trade's. The card shows the tile the number is (`288 in² (12x24)`) so
nobody has to do the arithmetic.

**No migration.** A stored `largeFormatIn` is ignored rather than converted: the
only programs carrying one hold the 15" seed, which is the rule being corrected.
The live Glazzio book picks up the new rule with no data edit.

## What it costs

Freight on the commonest tile in the book goes **up**, because Glazzio's
small-format pallet ($149) is dearer than its large-format one ($79):

| Job | Before | After |
|---|---|---|
| 620 sf of plain 12x24 | 2 large pallets = **$158** | $613.80 by the foot → over the $149 threshold → 2 flat-rate pallets = **$298** |
| 620 sf of **Harmonic** 12x24 | $158 | **$158** (named exception, unchanged) |
| 180 sf of 24x24 | $79 | **$79** (unchanged) |
| 84 sf of 12x12 mosaic | $83.16 | **$83.16** (unchanged) |
| 16x16 / 18x18 | $79/pallet | 16x16 **by the foot** (256 in²); 18x18 stays on the pallet (324 in²) |

Rates read live (ADR 0030 decision 2), so open and saved quotes carrying Glazzio
12x24 reprice on their next open.

## What changed

- **`src/freight.js`** — `normFreight` (`largeOverSqin` + `largeSeries`; legacy
  `largeFormatIn` deliberately unread), `rowSqin` (replaces `rowLongestSide`),
  `matchesLargeSeries`, and `freightBasis`. `FREIGHT_SEED` carries Glazzio's 288
  and its two named series.
- **`src/pricebooklib.jsx`** — the freight card: a "Large over `288` in² (12x24)"
  field that names the tile as you type it, an "Always large format" text field
  beside Ships to, and a third worked example so the 12x24 / 24x24 boundary is
  visible on the card.
- **`src/freight.test.js`** — the area rule at and past the line, the 16x16 and
  6x48 cases, the named-series exception, the no-migration case, and the
  reported job (620 sf of 12x24 → $298, Harmonic → $158). 808 tests pass, lint
  clean.

## Preview proof

| | |
|---|---|
| `preview-freight.png` | the drawer rows, the corrected freight card, and the printed estimate's extras band — one Glazzio job now billing all three tables ($391.85) |
| `preview-order-entry.png` | the three freight lines as special orders: 1 large pallet, 2 flat-rate pallets, 24 trim pieces |

Reproduce: `npm run dev`, open `/preview.html` (`#order` for the panel). The
harness job is 620 sf of 12×24 + 180 sf of 24×24 + 84 sf of mosaic + 24 chair
rails; every figure is computed by `freight.js`.
