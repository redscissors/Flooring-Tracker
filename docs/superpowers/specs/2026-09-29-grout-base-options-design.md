# Grout base options — several bases per grout, picked on the row — design

**Date:** 2026-09-29 · **Status:** approved by owner in chat
· **Mockup:** `.scratch/mockups/grout-base-picker-2026-09-29.html` (layout
"Base chip after joint width", owner pick)
· **Builds on:** ADR 0006 (grout base companion), ADR 0002 (materials resolve
by name), ADR 0031 (quote options)

## Problem

- A two-part grout carries exactly **one** base (`catalog grout.base`, ADR
  0006). SpectraLock Pro also sells a **Commercial unit** (one covers 4 color
  kits) and PermaColor Select an **Unsanded** base, and there is no way to
  quote either from the grout box.
- The team usually uses the same grout — and the same base — across a whole
  project, but every row starts over from the team default.

## Owner decisions (2026-09-29)

1. A catalog grout can hold **several base units**. One is the ★ standard
   default; the rest are alternates.
2. The row's grout pop-up gets a **Base** chip right after the joint width —
   only when the chosen grout has two or more bases. Nowhere else on the row
   shows the base (the collapsed extras pill stays as it is).
3. **The project remembers** the grout type last picked and, per grout type,
   the base last picked. Ticking Grout on a row starts from that memory. Color
   is never remembered. A new project starts on the standard defaults.
4. **Always ★ default** until a person picks otherwise — the app never
   auto-switches a base (no cheapest-mix, no joint-width rule).
5. The job's **Extras** totals kits per base across the whole job and orders
   `ceil(kits / per)` — so four colors' kits on Commercial share one unit.
   Because the row only records *which* base it uses, quantities entered later
   simply re-figure. The earlier "swap/split in Extras" idea is dropped.
6. The Settings reshuffle (General → Price books, Sheoga card) is on hold.

## Data

### Catalog grout (settings, shared)

```
grout: { …, base: Base | null,          // ★ the standard default (ADR 0006, unchanged)
            altBases: Base[] }          // NEW — the alternates, in display order
Base:  { sku, name, unit, price, cost, per }
```

- `altBases` normalizes through the same `baseCompanion` as `base`: entries
  with neither name nor SKU drop, duplicates of the ★ (same key) drop.
- A grout with no `base` but some `altBases` promotes the first alternate to
  `base` — there is always a ★ when there are bases.
- A base's identity is `baseKey(b) = b.sku || b.name`.
- Old records have no `altBases` → `[]`; they read exactly as today.

### Product row

```
grout: { …, base: "" | <baseKey> }      // NEW
```

- `""` = the grout's ★ base, resolved live (ADR 0002's by-name rule: a team
  change of the ★ moves rows that follow it, as the single base does today).
- A key that no longer resolves among the grout's bases falls back to the ★.
- A grout with no bases ignores the field.

### Project

```
groutMemory: { product: "", bases: { [groutName]: <baseKey> } }   // NEW
```

- Normalized in `normC` (absent → empty memory). Not versioned (versions
  snapshot categories only). No SQL: it rides in the project's jsonb.
- Written in the **same** `updateProject` call as the row edit that set it.

## Behavior

- **Tick Grout** (desktop drawer + mobile row sheet): product =
  `resolveMaterialDefault(offered, row.product, memory.product || catalog
  default)`; base = `memory.bases[product]` if it still resolves, else `""`.
- **Pick a grout type** on a row: row base = `memory.bases[newProduct]` (if it
  resolves) else `""`; memory.product = newProduct.
- **Pick a base** on a row: row base = the key (`""` when it is the ★);
  memory.bases[product] = that key.
- Rows that already have grout are never touched by a memory change.

## Totals

- A new shared helper aggregates the job's grout kits per
  `(grout, color, base)` — `ceil` of the summed exact kits, pending when no
  row can compute yet — and `groutBaseList` resolves each entry's base
  (row key → base, fallback ★) and groups by base identity:
  `order = ceil(total kits / per)`.
- For a job with no alternates picked this gives the same numbers as today.
- `jobTotals` (on-screen Extras, order summary, order-entry panel, each quote
  option's scope) and `printMatList` (printed estimate) both call it, so they
  can't disagree.
- Price tiers (Builder/Sale scaling, Employee cost + 6%) and the price-book
  re-import price/cost refresh cover `altBases` the same way they cover `base`.

## Settings

- The grout detail's "Base unit" block becomes **Base units**: one row per
  base — ★ toggle, name, SKU, per (kits one unit covers), unit, $/unit, cost,
  remove. ★ on an alternate swaps it with the current default.
  "+ Base unit" / the stock search add an alternate (the first becomes ★).
- Adding a Laticrete pigment from the price book attaches the default base as
  today **and** its variant (`stockBaseVariant`) as an alternate
  (per 4 when the description says Commercial).
- The color-family confirm's "variant" radio also lands as an alternate.

## Not changing

- The SKU-box pigment path (a picked pigment auto-adds a base product row
  with its Comm./Unsanded toggle chip).
- The collapsed row extras pill; the Settings section layout.

## Testing

- `catalog.test.js`: `altBases` normalization (drop empty/duplicate, promote),
  row base resolution + fallback, per-base aggregation (mixed colors on
  Commercial → one unit; split colors across bases), unchanged numbers with
  no alternates.
- `model.test.js`: `grout.base` and `groutMemory` normalization.
- Pure memory helpers (tick / pick product / pick base patches).
- `pricing.test.js`, `booklink` sync, `print` breakdown with a split job.
- Preview screenshots of the pop-up chip and the Extras card before merge.
