# ADR 0030 — Vendor freight: a live rate program on the book, opted into per row, charged once per order

- **Status:** Accepted
- **Date:** 2026-07-27
- **Scope:** system-wide (price-book config + job model + estimate/print + order entry)
- **Related:** builds the freight slot ADR 0009 §3 reserved
  (`price_books.data.freight`, "highlight only, for now… a Phase-2-sized
  addition, not a redesign"); deliberately does NOT extend ADR 0003's snapshot
  doctrine (see decision 2); tier interaction per ADR 0018.

## Context

ADR 0009 shipped the price-book library with freight as **visibility only**: an
item the vendor flagged got an "extra freight" chip, and no amount was ever
added anywhere, because the shop had no real charge numbers. Two charge modes
(`perSqft`, flat `perJob`) were designed and left unbuilt.

The numbers arrived: Glazzio's 2026 shipping program. Read down the Ohio column
(the only destination the shop ships to), it is:

| Case | Ohio |
|---|---|
| Small format | $0.99/sqft, min **$14.85/order**; once that reaches **$149** the order ships flat-rate pallets at **$149/pallet** |
| Large format — incl. Harmonic 12x24 & Arvora LVT | **$79/pallet** |
| Tile trims (borders, chair rails, mouldings) | $0.33/piece, $14.85 min |
| Pallet size | **496 sq ft** (from the shop, not the sheet — see decision 5) |

Two facts about that sheet drove the design. First, **both** of Glazzio's pallet
tables charge $79 in Ohio, so the Harmonic/Arvora distinction — which matters in
other states — collapses to one large-format rate here. Second, and structurally:
every rule on the sheet is scoped to an **order**. The minimum, the $149
threshold, and the per-piece floor are all properties of a shipment, not of a
line item.

Neither reserved mode fits: `perSqft` has no minimum and no threshold, and flat
`perJob` can't price by the foot at all.

## Decision

1. **A freight program lives on the book, in the reserved `data.freight` slot**,
   as a rate table the team types off the vendor's sheet:
   `{ mode, destination, palletSf, perSqft, minCharge, palletAt, palletRate,
   largeRate, largeFormatIn, perPiece, pieceMin, effective }`. `mode: "none"` is
   every book that was never configured, so an absent program changes nothing.
   A rate left at 0 switches its rule **off** rather than charging zero — a
   program with no piece rate simply doesn't bill trims. Edited in the Price book
   library beside the markup editor.

   It is **not** an importable price book. There are no SKUs, there are nine
   numbers, and the vendor re-issues them about once a year: the import
   machinery would cost more to build than retyping the numbers ever will.

2. **Freight rates read LIVE at calc time, not snapshotted at pick time.** This
   is a deliberate exception to the ADR 0003 snapshot doctrine, and the reason
   is that they are different kinds of number. The snapshot doctrine guards
   against a *vendor re-import* silently rewriting a saved quote; a freight rate
   is a settings-grade figure the team restates by hand, like the waste percent
   or a grout coverage, and the charge depends on the job's square footage, which
   moves every time the salesperson edits it. A snapshotted freight amount would
   go stale in silence on the very next edit. The Price book card says so on its
   face: "changing one moves every open quote, saved estimates included."

3. **The row chip is an opt-IN, and the charge is computed once per book.**
   Because the minimum and the pallet threshold are order-scoped, a per-row
   calculation would bill three minimums for three rows off the same truck.
   `freightList` groups the opted-in rows by book and charges each book once —
   the `attachedList` shape. What the row's chip displays is therefore the JOB's
   charge from that vendor, not the row's share: that number does not exist, and
   manufacturing one by division would misstate what the sheet charges.

   Freight is **on by default** (only the explicit `"off"` is stored on a row),
   including on rows saved before the program existed — the shipping was always
   owed, and nothing changes until someone types the rates in, which is itself
   the deliberate act. A per-job master switch (`project.freight`, defaulting on)
   is the one press for "no shipping on this job."

4. **Freight is charged at cost, printed as its own line, and exempt from the
   price tiers.** It prints in the estimate's extras band as its own "Freight"
   group naming the vendor, the destination, and each part's unit and rate; the
   order-entry panel files it with the **special orders**, by description (there
   is no SKU to key), with cost and sell matching. Builder/Sale/Custom discount
   the shop's prices, not the trucking company's — ADR 0018 already excluded
   freight from Employee pricing, and this extends the same reading to the
   discount tiers. `freightList` accordingly reads the raw project, never the
   tier view.

5. **Pallet count is `ceil(sqft / palletSf)`, floored at one.** The vendor's
   sheet prices per pallet but never says what a pallet holds; the shop supplied
   496 sq ft. Since the sheet is silent, this is a shop-supplied constant living
   in the same editable card as the rates, not a derived value.

6. **Size decides the table: a side at or over `largeFormatIn` (default 15") is
   large format.** That is the trade's line and the one Glazzio's own sheet
   draws — its Harmonic 12x24 sits on the large table. A row whose size can't be
   read falls to small format, because guessing "large" invents a whole pallet.

## Consequences

- Any special-order book can now carry freight; VTC's 312 freight-flagged items
  become a data-entry job rather than another PR. The per-item `freightFlag`
  chip from ADR 0009 is untouched and still advisory.
- A freight rate correction moves saved estimates. That is the intent (decision
  2), and it is the one place in this app where a book edit reaches back into a
  quote — hence the on-card warning and the "rates dated" field.
- Deleting a book stops resolving its freight; jobs keep their material
  snapshots and simply lose the freight line, matching the drift-chip behavior
  already documented in `usebooks.js`.
- Not built, deliberately: Glazzio's residential ($3.50/box, $50/delivery LTL)
  and lift-gate ($50) accessorials — everything ships to the shop, a commercial
  address, so neither can trigger — and the Arvora LVT trim tube rate ($40/tube,
  17 pc T-mold/reducer, 13 pc stair nose), since the shop does not price Glazzio
  LVT. Both are additive to this shape if that changes.
- Two readings of the sheet were **confirmed by the owner (2026-07-27)** and are
  what `freightParts` implements: a **mixed order pays each table's minimum**
  (small format and trims can both floor), while an order that is *all* small
  format pays the $14.85 minimum **once** — one part, one floor; and a small
  large-format order really does pay a **full $79 pallet**, the one-pallet floor
  in decision 5.
