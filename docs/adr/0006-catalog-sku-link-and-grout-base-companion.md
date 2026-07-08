# ADR 0006 — Catalog products carry a price-book SKU; grout products carry a "base unit" companion

- **Status:** Accepted
- **Date:** 2026-07-08
- **Scope:** system-wide (catalog data model + material math + totals/print + import)
- **Related:** ADR 0002 (link by name), ADR 0003 (snapshot, no live stock read at calc time), branch `claude/stock-price-sheet-import-xuk2e8`

## Context

Some grouts are sold in two parts. A Laticrete SpectraLock Part C or PermaColor
Color Kit is only the **pigment**; it is unusable without a **base unit** (the
SpectraLock Full/Comm. unit, the PermaColor Sanded/Unsanded base), each on its
own price-book SKU. A quote that lists the color but not the base is wrong.

Today two selection worlds don't meet:

- **Materials** (grout/mortar/underlayment) are picked from the associated-
  materials dropdowns and resolved **live by name** from the shared catalog
  (ADR 0002). The catalog knows nothing about price-book SKUs — the Settings
  add-product form can *pre-fill* name/price/coverage from a price-book search
  but throws the SKU away.
- **Flooring** rows snapshot price-book values by SKU and never read stock at
  calc time (ADR 0003).

So picking a Laticrete grout from the grout dropdown pulls in no base, and the
grouts aren't even offered there unless hand-added to the catalog. The team
wants: define the grout once, and have its base flow into the consolidated
materials totals no matter how the grout is chosen.

## Decision

1. **`sku` becomes an optional attribute of every catalog product**
   (grout/mortar/underlayment). The Settings add-product pre-fill stops
   discarding it. **Jobs still link a material by name** (ADR 0002 unchanged) —
   the SKU is a property of the *catalog product*, never the key a Selection
   stores. The stock table is read only at **catalog-edit time** (pre-fill,
   refresh, defining companions), **never at calc time** (ADR 0003's snapshot
   guarantee unchanged).

2. **Grout products gain a `base` companion**, shaped like the existing
   underlayment install-materials: `{ sku, name, unit, price, per }`. It is
   resolved live from the catalog by name, exactly like the grout's own
   coverage number.

3. **The base is counted 1:1 against grout kits, by ratio — not by an
   independent area calc.** `base order = ceil(grout order / per)`, with
   `per = 1` for a Full/Sanded/Unsanded base and `per = 4` for a Commercial
   unit ("4 Fulls at a lower price"). One grout coverage math, then a ratio.

4. **The base consolidates into the bottom materials summary**, aggregated
   across every Selection that uses it — the same aggregation underlayment
   install-mortar already merges into the job's mortar totals.

5. **SKUs surface in the order totals and print.** Each material line in the
   consolidated summary shows its catalog SKU, so a grout and its base read as
   linked SKUs on the estimate.

6. **The base link is defined once, from the price book**, not hardcoded. The
   parser already reads the workbook's "Bulk & Base Units" section and pairs a
   pigment to its default base (`stockCompanionBase`); the catalog grout's
   `base` is populated from that pairing via the SKU. No SKUs live in code.

## Why

- **SKU as a catalog attribute, name as the job link:** keeps every saved
  Selection resolving untouched (ADR 0002's whole point) while giving the
  catalog a stable, exact key for refresh-on-reimport and companion definition.
  A job that stored the SKU as its link would force migrating every old job —
  the same rejection ADR 0002 made for id-based links.
- **Read stock only at edit time:** preserves ADR 0003 — estimates never
  silently move when the book moves. The base's numbers live in the catalog and
  re-flow by name like any other coverage/price (ADR 0002 consequence #3),
  which is the behavior the team already understands.
- **Companion on the grout, not a standalone line:** the base scales with the
  job and consolidates, which a flat standalone misc line cannot. It reuses the
  proven underlayment-install shape rather than inventing a new mechanism.
- **Ratio, not area coverage, for the base:** one pigment kit needs one base;
  the price book publishes no sqft-per-kit for the base, so a ratio off the
  grout's own kit count is both simpler and correct.

## Consequences

- Catalog grout/mortar/underlayment products gain `sku`; grout products gain
  `base`. `groutFields`/`mortarFields`/`underlayFields` and the normalizers must
  carry them so old records stay valid (empty = no SKU / no base, current
  behavior).
- A new pure resolver (e.g. `getGroutBase`) computes the base order from the
  grout order and `per`; the totals assembly grows a base bucket in the
  consolidated summary, keyed by SKU/name.
- The catalog price-sync on import gains an exact-SKU path (falls back to the
  existing conservative name match when no SKU is stored).
- The grout coverage number (sqft per kit) is still a **calibrated Settings
  value** — the price book does not publish one for the two-part grouts.
- The standalone auto-add-a-base behavior already on the branch (a pigment
  picked from the price-book SKU box adds a base as its own line) is superseded
  for the grout workflow by this catalog-based path; whether to keep it for
  standalone material lines is an implementation choice, not a data-model one.

## Alternatives considered

- **Resolve materials against the live stock table by SKU at calc time.**
  Rejected: silently rewrites saved estimates on re-import — exactly ADR 0003's
  forbidden failure.
- **Store the SKU as the Selection's link key.** Rejected: would migrate every
  saved job, the same reason ADR 0002 rejected id-based links.
- **Model the base as an independent area-coverage material** (like grout bags).
  Rejected: the base is 1:1 with kits; a second coverage number would be a
  fiction with no source and could disagree with the kit count.
- **Keep the standalone-line auto-add as the only mechanism** (branch behavior).
  Rejected as the primary path: a flat count line doesn't scale with the job or
  consolidate, which is the point of Option B.
