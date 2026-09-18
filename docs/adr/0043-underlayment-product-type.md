# ADR 0043 — Underlayment is a product type: sheet/roll membranes order like carton flooring

- **Status:** Accepted
- **Date:** 2026-09-18
- **Scope:** system-wide (`Product.type` enum; import typing in `src/pricebook.js`; carton math in `src/catalog.js`; totals in `src/jobtotals.js`)
- **Related:** amends ADR 0029 ("a membrane is no floor" → a membrane is underlayment); ADR 0013 (carton semantics the row inherits); ADR 0003 (the switch chip never heals silently); ADR 0041 (the Schluter EFT typing exception).
- **Spec:** `docs/superpowers/specs/2026-09-18-underlayment-row-type-design.md`

## Context

Marcus flagged the Ditra Heat membrane sheet (23031) on a 9/18 Quick Price:
the book reads 8.4 sf per sheet out of the description, but a membrane was
deliberately untyped at import, a typeless row fails `fillsFlooring`, and the
pick landed a per-piece count line with the coverage dropped. The owner
added the Kerdi roll (1509781, 323 sf/RL) and asked for carton behaviour —
"input how much sf I want and it figures the amount needed" — that also
"works together with Underlayments in the materials tab".

## Decision

1. **`"underlayment"` is a product type** beside the five flooring types and
   Misc. A sheet- or roll-sold row with real coverage whose description names
   a membrane, underlayment, uncoupling mat or backer imports with it — from
   the ERP stock export (ADR 0029's `typeFromDescription` gate) and, as the
   one typing exception, from the Schluter EFT (gated on any of the row's
   units bundling coverage — the EFT maps no plain unit column). EA
   accessories (the heat cable) stay untyped count lines.
2. **It lands and orders like carton flooring:** `qtyType: "sqft"`,
   `priceSqft` = per-unit price ÷ coverage, `cartonSf`/`cartonUnit` from the
   book, whole SH/RL out. Nothing new is stored.
3. **No waste** on the type (`wasteFor` = 1). The sheet count is already the
   rounding; the owner chose this over the floor rate.
4. **Not floor area:** `jobTotals` adds the row's money to `flooringPrice`
   and never its sq ft to `totalSqft`/`orderedSqft` — the floor was measured
   by the flooring row above it.
5. **The row is its own underlayment.** `getUnderlay` returns null on the
   type; the drawer's section reads "Install materials", the row names its
   Materials-tab entry (auto-linked by SKU at pick), and that entry's install
   items compute off the row's own sq ft through the unchanged
   `getUnderlayInstall`. Grout/mortar stay tile-only; add-on categories
   filter on `FLOOR_TYPES`, which excludes it.
6. **Existing count lines switch on a click**, never on their own: a chip
   reads "Book sells this by the SH — 8.4 sf · Switch to sq ft" and re-lands
   the row from the book, converting count × coverage to sq ft so the order
   holds until the real footage is typed.

## Alternatives rejected

- A sq ft mode on a Misc line — ten files of "misc means counted" gates to
  re-teach, and the print would still say Miscellaneous.
- Attaching the membrane as the tile row's underlayment — needs a catalog
  entry per product and is not the "search it in, type sq ft" flow.

## Consequences

- Already-imported books keep `type: null` on these rows until re-dropped
  (the normal refresh); saved rows keep their snapshot until switched.
- The keyword list is a heuristic like ADR 0029's; an unlisted wording lands
  a count line — visible, never mispriced.
- The row prices per sq ft like every carton row (per-unit price ÷ coverage,
  rounded to the cent), so the printed per-sheet price can sit a cent off
  the book's — $21.50/sh against the $21.49 sheet, $1.64/sf against the
  $528.10 roll's 1.635. The same drift every carton row already carries; a
  later change could round once.
- Trowels and other per-order tools are a follow-up (a fixed-quantity
  install item kind).
