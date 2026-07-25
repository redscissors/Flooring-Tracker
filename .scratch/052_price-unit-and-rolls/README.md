# Price column names its unit · rolls are a real unit of measure (2026-07-25)

Status: done

Request (Marcus, 7/25):
1. "can you also make the price column show sf or ea or sh or rl"
2. "We also need to add a new way of measurement, and that is roll. For instance,
   the schluter sheet has rolls of stuff when it imports. And at the moment, it
   doesn't understand what RL stands for."

## What changed

**`src/units.js` (new)** — one table for the sell-unit vocabulary: `unitCode`
(`rl` / `RL` / `Rolls` / `roll` → `"RL"`), `unitNoun` (`3, "rl"` → `"rolls"`),
`isRollUnit`. Before this the app knew only CT and SH by name and hardcoded
"each" everywhere else, in six different places. A unit the table doesn't know
still prints — it falls through as the vendor's own code, uppercased — so an
unrecognized spelling shows the book's word rather than a confidently wrong
"EA".

**The price always names its unit.** The classic print layout's Price column
showed a bare number; it now reads `$9.84/sf`, `$18.80/sf`, `$84.20/rl`,
`$15.49/ea`. The cards layout (the one that prints today) had `/sf` and `/ea`
hardcoded and now uses the row's real unit. Quantities follow: `3 rolls`, not
`3 pcs`. Same unit on screen — the grid's and the mobile sheet's `EA` chips read
the row's own unit — so the screen and the paper can't disagree.

**RL is a first-class unit.**
- `COVERAGE_SOLD_RE` (`pricebook.js`) gains the roll spellings, so a roll joins
  carton/sheet/bundle as a coverage-bundling sell unit. Like every other unit it
  only types a row whose description also names a floor, so **a roll of membrane
  stays the count of rolls it should be** and a roll of sheet vinyl becomes a
  square-foot line ordering in whole rolls.
- A new `sellUnit` on the product row records what ONE of a **count** line is.
  Blank means each — the old default, so every existing row reads exactly as
  before — and a pick snapshots the vendor's own unit when it isn't. Label only:
  no math changed, and like every picked value it's a snapshot (ADR 0003), so a
  re-import never re-labels a saved row.
- `orderEntryRow` keys and tags a roll line in rolls. It used to hand the desk
  "3 EA" with no tag.

**A `/roll` coverage suffix is read.** The description-coverage regex knew
`sf/ct` and `sf/sh` but not `sf/roll`, so Schluter's
`"Ditra-Heat Uncoupling Membrane - 134.5sf/roll"` imported with the number
pulled and the suffix left behind, printing as
`"Ditra-Heat Uncoupling Membrane - /roll"`. The suffix list now covers the roll
spellings, and a separator left dangling at the end of a name once the coverage
is pulled is trimmed (interior punctuation is the vendor's own and stays). The
preview proof is what surfaced this — it wasn't in the request.

## Judgment call worth knowing about

A roll-sold item **with** coverage but no floor wording (Ditra-Heat, 134.5
sf/roll) stays a **count of rolls priced per roll** rather than becoming a
square-foot line. That's the existing carton/sheet doctrine applied unchanged —
`floorTypeFromDescription` explicitly refuses to type a membrane — and it's what
the desk wants, since Ditra is ordered by the roll. Say so if the shop would
rather quote membrane by the foot; it's a one-line change to how the row types,
not a rework.

## To pick this up on the live site

Nothing to re-import for the **display** half — the price column names its unit
for every existing row immediately, and rows already saved keep reading as
"each", which is what they are. Re-drop the Schluter sheet to have its RL rows
land as rolls and to clear the `- /roll` names; rows already on saved jobs keep
their snapshot (ADR 0003) until the item is re-picked.

## Proof

`proof-price-units-rolls.png` — section 1 is the **real `EstimatePaper`** with
an area line, a carton line, a sheet line, an each line and two roll lines, the
two Schluter rows carried through the **live ERP import**
(`parseMapped` → `stockPatch` → the product row) so the sheet's RL is what
reaches the paper. Section 2 is the same rows through the **live**
`orderEntryRow` — what the desk keys. Section 3 is the live `printProduct`
output before and after, per row, the "was" column computed from the old
expressions so the comparison is the real prior output.

Rebuild: `npx vite build --config .scratch/052_price-unit-and-rolls/proof-vite.config.mjs`,
serve `proof-dist`, screenshot. `proof-dist` is never committed.

Tests: `node --test src/*.test.js` — 754 pass, up from 741 (new: the whole of
`units.test.js`, roll snapshot/typing/coverage cases in `stock.test.js` and
`pricebook.test.js`, and price-unit + order-entry cases in `print.test.js`).
Production build clean.
