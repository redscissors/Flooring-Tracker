---
issue_type: Bug
summary: Glazzio freight priced 12x24 as large format. Glazzio's large format is
  what is LARGER than 12x24, so the rule is now a size (over 12 × 24 on either
  axis) plus the sheet's named exceptions, not a single 15" side.
status: done
labels: [ready-for-human]
---

# Glazzio's large format starts above 12x24, not at 15"

Reported 2026-07-28: "running into a problem where glazzio is pricing freight
differently then glazzio prices it. It normally would make sense to say any size
over 15 is large tile but for glazzio it only means larger then 12x24."

ADR 0030 decision 6 shipped the trade's line — a side at or over 15" is large
format — and that quotes Glazzio wrong. Their large-format table is what
**outgrows a 12x24**; a 12x24 itself ships on the per-foot table with the
mosaics.

One threshold cannot express that. Any number low enough to catch a 24x24 also
catches the 24" side of a 12x24. So the rule is now the size the vendor actually
names:

| | |
|---|---|
| `largeOverShort` | 12" — a piece wider than this on its **short** side is large format |
| `largeOverLong` | 24" — a piece longer than this is large format |
| `largeSeries` | `Harmonic, Arvora` — series the sheet ships by the pallet whatever their size |

Either number at 0 switches that half of the test off. Both are per book and
editable on the freight card, since 12 × 24 is Glazzio's line, not the trade's.

**Why `largeSeries`.** Glazzio's sheet has a second pallet table, "Harmonic 12x24
& Arvora LVT" — a size that is otherwise small format, listed by name. The 15"
rule swept those onto the large table by accident; correcting the size rule
alone would have lost them. The exception is neither a size nor a SKU pattern, so
it is matched as text against the row's description.

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
| 84 sf of mosaic | $83.16 | **$83.16** (unchanged) |

Rates read live (ADR 0030 decision 2), so open and saved quotes carrying Glazzio
12x24 reprice on their next open.

## What changed

- **`src/freight.js`** — `normFreight` (the two size fields + `largeSeries`,
  legacy `largeFormatIn` deliberately unread), `rowSides` (replaces
  `rowLongestSide`), `matchesLargeSeries`, and `freightBasis`. `FREIGHT_SEED`
  carries Glazzio's 12 × 24 and its two named series.
- **`src/pricebooklib.jsx`** — the freight card: one "Large over `12` × `24`"
  cell in the rate grid, an "Always large format" text field beside Ships to,
  and a third worked example so the 12x24 / 24x24 boundary is visible while
  typing.
- **`src/freight.test.js`** — the size rule on either axis, the named-series
  exception, the no-migration case, and the reported job (620 sf of 12x24 →
  $298, Harmonic → $158). 808 tests pass, lint clean.

## Preview proof

| | |
|---|---|
| `preview-freight.png` | the drawer rows, the corrected freight card, and the printed estimate's extras band — one Glazzio job now billing all three tables ($391.85) |
| `preview-order-entry.png` | the three freight lines as special orders: 1 large pallet, 2 flat-rate pallets, 24 trim pieces |

Reproduce: `npm run dev`, open `/preview.html` (`#order` for the panel). The
harness job is 620 sf of 12×24 + 180 sf of 24×24 + 84 sf of mosaic + 24 chair
rails; every figure is computed by `freight.js`.
