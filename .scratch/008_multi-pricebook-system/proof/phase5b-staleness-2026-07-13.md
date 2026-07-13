# Phase 5b — book staleness chip: preview proof

**Date:** 2026-07-13 · **Branch:** `claude/pricebook-phase5b-staleness`

Screenshot capture timed out in this environment (a known intermittent issue —
see the Phase 5 handoff), so proof is the sanctioned observed-run fallback:
`read_page` accessibility tree + `get_page_text` against the real
`PriceBookLibrary` component rendered with synthetic data via a throwaway
`?p5=1` harness (deleted before commit). Tablet viewport (768×1024), light mode,
no console errors.

## Synthetic books

| Book | Last import | Threshold 120 | Threshold 5 |
|---|---|---|---|
| Shop workbook (stock) | 210 days ago | **Stale** | Stale |
| Emser (fresh) | 6 days ago | clean | **Stale** |
| Virginia Tile | 213 days ago | **Stale** | Stale |
| Schluter | never imported | clean | clean |

## Observed (threshold = default 120)

Left-nav accessibility tree:

```
button  "Shop workbook"              generic "Stale — imported 210 days ago"
button  "Emser (fresh)"              (no stale indicator)
button  "Virginia Tile"              generic "Stale — imported 213 days ago"
button  "Schluter (never imported)"  (no stale indicator)
textbox "120" placeholder="120"      ← "Flag stale after N days" control
```

Stock detail header:
```
"Last imported 12/15/2025 by Dave · 312 SKUs"
generic "Last imported 210 days ago — vendors re-issue cost lists roughly quarterly…"  ← StaleChip
```

## Observed (threshold set to 5 via the control — reactivity)

Emser (6 days) flips to `Stale — imported 6 days ago`; Schluter (never
imported) stays clean regardless of threshold, confirming the "absent ≠ stale"
rule. The threshold input writes `settings.ops.staleDays` through `setSettings`.

## BookDetail header (Virginia Tile selected)

```
"0 active items · imported 12/12/2025 by Dave"
generic "Last imported 213 days ago — vendors re-issue cost lists roughly quarterly…"  ← StaleChip
```

## Verdict

All four surfaces render as designed; a never-imported book is never flagged;
the threshold setting drives the chips live. Pure predicate `bookStaleness` and
the `staleDays` normalizer are unit-tested (orderbook.test.js, catalog.test.js;
suite 170 → 175).
