# Grout base companion line when there's no footage yet (2026-07-25)

Status: done

Request (Marcus, 7/25):

> "if a grout is chosen in the extra materials, but there's no square footage
> for it to figure off of, it's not adding at least one base."
> … "what really just needs to happen is that if a grout is being shown in the
> extras, it also needs to show that it needs a base to go along with it. It
> doesn't actually need to add one. So that means it doesn't actually need to
> show towards the totals."

## The problem

A grout chosen on a row with no square footage to size it from — a count line,
or SF simply not typed yet — can't compute a kit count, so `getGrout` returns
nothing and the job's grout line aggregates as **pending**: the estimate names
the grout with a "—" quantity (on screen) / no quantity (printed). That part
already worked.

Its **base unit** did not. `groutBaseList` skipped every grout entry whose kit
count was 0 (`if (!g || !(g.order > 0)) continue`), so a two-part grout with no
footage listed the color kit alone and said nothing about the base it can't be
mixed without.

## What changed

`groutBaseList` (`src/catalog.js`) now keeps a base line for a grout with no
kits yet, flagged `pending: true`:

- `order` 0, `cost` 0 — **nothing joins any total**. `baseCost` (and through it
  `materialsCost` / `grandTotal`) is the sum of the list's costs, so a pending
  base contributes exactly $0, and the order sheet / "Copy for order entry"
  panel already filter on `order > 0`, so it never reaches an order either.
- If any grout sharing that base does have a kit count, the line is real again
  (`pending: false`) and quantifies as before — one color computing covers its
  pending twin.

Both call sites pick it up with no math change: the on-screen Materials
estimate (`App.jsx`, which was hardcoding `pending: false` on base lines and now
passes the flag through, rendering "—" plus the unit price like a pending
grout) and the printed breakdown (`print.js printMatList`, whose bases already
derive from the aggregated grout rows).

Also, one cosmetic fix in the same block: a pending grout's printed unit price
read `$32.89/` — `printProduct` left the unit blank when the quantity couldn't
compute. It now falls back to the catalog product's unit, so it reads
`$32.89/kit` beside the new `$374.99/unit` base line.

## Proof

`proof-grout-base-pending.png` — the **real `EstimatePaper`** rendered over a
two-area job (built via `proof-vite.config.mjs` + `proof-entry.jsx`,
screenshotted headless). Area 01 has 180 sf and computes: PermaColor Color Kit
2 kits / PermaColor Sanded Base 2 units. Area 02 has no SF typed: Spectralock
Part C and SpectraLock Comm. Unit both list with no quantity. Extras subtotal
stays $186.28 and the estimated total $1,088.38 — the pending pair adds
nothing. Section 2 mirrors App.jsx's on-screen Grout column markup over the
live `gList`/`groutBaseList` values; section 3 dumps the raw list and totals.

Tests: `node --test src/*.test.js` — 727 pass (new: pending/mixed cases in the
`groutBaseList` test, plus a `printMatList` test taking a footage-less grout
end to end through the print path). Lint and production build clean.
