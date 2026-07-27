# A typed quantity that the square footage has outgrown (2026-07-27)

Status: done

Request:

> "if you mess with the qtys it wont let you have it auto reprice. would it work
> to have a refresh or recaulclate option for a line. or maybe if you change the
> sf it just recalcutales on its own?"

Reported while testing issue 057 (the order-entry assumed "1"), but it is not
that change — it is a pre-existing trap that the new flow walks you into,
because an assumed row invites you to look at the carton count.

## What was wrong

Every quantity box in the app — carton count, grout, mortar, underlayment,
add-ons — **displays the calculated value but writes a permanent manual override
the moment you touch it**:

```js
value={String(C.order)}                                    // shows the calculation
onChange={(e) => updProduct(a.id, p.id, { cartonManual: e.target.value })}   // writes an override
```

The carton ▲▼ nudge buttons write it too, on a single click. After that
`getCarton` short-circuits on `cartonManual` forever, so changing the Sq Ft
never moves the count again — and because a carton row bills `ordered cartons ×
sf/carton × price`, **the price freezes with it**. That is the reported "won't
auto reprice". Same shape in `getGrout` / `getMortar` / `getUnderlay` /
`getAttached`.

Two things made it near-undiagnosable:

- Nothing distinguished an overridden number from a calculated one.
- The only way back to auto was to clear the box — which instantly redisplays
  the calculated value, so it looks like the clear did nothing.

Meanwhile the app was computing the right answer the whole time and throwing it
away: `cartonExact` / `groutExact` ignore the override and keep tracking the
footage, feeding nothing but a tooltip.

## The fix — the drift pattern, not auto-clear

Chosen from three options. **A typed quantity is a decision, not a cache** —
attic stock, one spare carton, "just order 12" — so recalculating on every Sq Ft
change (the other candidate) would silently discard it, and on a live quote
nobody would notice it was gone. Instead the row keeps the override and tells
you it has gone stale, offering the fresh figure in one click.

This is the pattern the app already uses for price-book drift ("Price book now
$X — this row has $Y" + **Use new price**), so it reads as familiar rather than
new. Both call sites render the same `QtyDriftChip`:

| where | how it renders |
|---|---|
| carton count | a chip in the row's existing drift strip, beside the price chip |
| grout / mortar / underlayment / add-ons | the same chip on its own full-width line under the materials row |

`qtyDrift(manual, autoOrder)` (catalog.js) is the whole rule: null unless an
override is standing, the auto quantity is computable and above zero, and the
two disagree. The `autoOrder` each call site passes is **the same getter re-run
with the override lifted**, so the number offered can never drift from the real
math.

A "manual"-math add-on category is excluded: its typed number *is* the quantity,
with nothing behind it to disagree with.

## Proof

`drift-chip.png` — the harness (`preview.html` + `preview.jsx`, served by
`npm run dev`, shot by `shoot.mjs`) renders the **real** `QtyDriftChip` /
`QtyDriftNote` over the **real** `qtyDrift` + `getGrout` / `getCarton` math. The
story is a 240 sf quote whose field measure comes back at 415 sf.

`verify.mjs` drives the buttons and proves the handler, not just the pixels:

```
BEFORE carton chip: true
AFTER  carton chip gone: true
AFTER  recalculated line: 30 | total: 3022.50     ← was 17 CT / $1712.75
BEFORE grout chip: true
AFTER  grout chip gone: true
AFTER  grout box value: 4                          ← was 9
```

That line total moving 1712.75 → 3022.50 is the reprice the report asked for.

Tests: four `qtyDrift` cases in `catalog.test.js` — agreement is silent, drift
in both directions reports, an uncomputable/zero auto is not an offer, and a
deliberate `0` override still drifts (785 pass). Lint and build clean.
