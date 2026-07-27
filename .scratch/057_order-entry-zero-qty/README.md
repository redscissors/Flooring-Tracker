# A quantity-less order line keys as 1 (2026-07-27)

Status: done

Request:

> "When trying to copy from order entry and there is no qtys and you want to be
> able to copy the information to erp one it will not let you copy stock items.
> or show special order pricing. it needs to default to one in order entry for
> both special order and stock if there is zero qty. I would also like the
> background to tun amber if this is the case so the salesperson knows the qty
> was ajusted, unless you can think of a better color."

## What was wrong

`orderEntryRow` (print.js) took the row's own quantity and stopped there, so a
line the field measure hasn't come back for yet reached the panel at qty 0.
Two things break at zero, and they compound:

| | at qty 0 | why |
|---|---|---|
| **Stock** | copies as `SKU⇥0` | the copy line is `` `${r.sku}\t${r.qty}` ``, and the ERP won't take a zero-quantity line |
| **Special order** | `—`, `$0.00/CT`, `$0.00/CT` | per-unit cost/sell are the **extended** totals ÷ qty, and the extended totals are themselves `qty × price` → 0 |

So the one screen built for keying an order gave neither a keyable quantity nor
the pricing the salesperson opened it to read.

## The fix

`orderQty` (orderentry.js) is the rule: a line with no quantity is keyed as
**one of its sell unit** and reports `qtyAssumed`.

`orderEntryRow` doesn't just swap the 0 — it re-runs the row's own math at
qty 1 (`printProduct({...p, qty: "1"})`, and the same row through
`orderLineCost`). That is what makes the per-unit column right: a carton-sold
line's "one" is a whole carton, so it reads **$100.75/CT**, exactly what it will
read once the footage is entered. A per-sf line reads per sf, a Schluter roll
reads per roll.

Nothing else moves. The estimate, the print, and the totals never see this — it
is built inside the order-entry row only, and a row that HAS a quantity takes
the untouched path (`qtyAssumed: false`).

## Amber

Amber, as asked — and it is already this app's "we changed this, look at it"
signal, so nothing new had to be invented: the grid rings a missing Sq Ft cell
in `amber-400`, and the split-description **Ext** button in this same panel is
amber. Red is spoken for here (a line with no SKU, which is *not copied at all*)
and moss/green is the app's positive accent, so amber was also the only one of
the three left that means "keyed, but check me".

Each flagged line gets a warm tint, a 3px amber edge bar (a tint alone is easy
to skim past down a long order), an amber quantity with an `ASSUMED` label, and
a count in the section footer: *"2 amber lines have no quantity on the estimate
— priced and keyed as 1."*

Estimated material lines (grout, mortar, underlayment) are untouched: they are
already filtered to `order > 0` before the panel sees them — a zero there means
the math couldn't run, not that someone forgot to type a number.

## Proof

`before-after.png` — the harness (`preview.html` + `preview.jsx`, served by
`npm run dev`, shot by `shoot.mjs`) renders the REAL `OrderEntryPanel` over the
REAL `orderEntryRow` output. "After" is literally what the panel does now;
"before" is the same rows with the old outcome restored (qty 0 → `—`, $0.00).

Four of the six lines have no quantity: two special-order (one carton-sold, one
per-sf) and two stock (one roll, one carton-sold).

Tests: four `orderEntryRow` cases in `print.test.js` — the per-sf line, the
carton line keying as one whole carton, the count line in its own sell unit, and
a measured line proving it is never flagged (782 pass). `npm run lint` clean,
`npm run build` clean.
