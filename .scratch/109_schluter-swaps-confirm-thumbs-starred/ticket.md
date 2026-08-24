Status: done

# Schluter round 9 — swaps, overwrite confirm, thumbnails, starred (E3/B4/C17/D4)

The last four rows on the issue-105 parity ledger.

## What landed

- **⇄ line swaps (E3)** — `cfg.swaps` (engine): a hand-picked part wins its
  role over the recipe's pick — the grate finish, the curb (qty re-figured
  for the chosen length), and the One-size wall board (the Fit plan keeps
  choosing sheets itself, the wedi rule — the board line swaps only in One
  size). A stale sku falls back to the recipe rather than landing the wrong
  part. Persisted in the marker so Reconfigure reopens with the picks;
  restored by seedState; any swap flips mode to custom. Popup: the wedi
  anchored popover (stock tinted, standing pick highlighted, Stock-only
  narrowed), Esc + click-away dismissal.
- **Overwrite confirm (B4)** — a kit row clicked over customized work
  (manual lines, benches, walls, corners, pins, overrides, swaps, tile, a
  picked option card) raises the wedi confirm modal before wiping it; an
  untouched kit-to-kit hop stays one click.
- **Option-card thumbnails (C17)** — every tray card carries the mini
  TopDown plan (schluterDiag per candidate), the wedi card idiom, so twin
  sizes tell apart at a glance.
- **★ Starred (D4)** — per-device pin list (localStorage
  ft-schluter-starred, never the shared record), the ☆ on every Browse row,
  a "★ Starred" filter chip with its count, and the empty-state hint.

## Proof

`shoot.mjs` (vite on :5199 + schluter-preview.html):
- `p1-optcard-thumbnails.png` — mini plans on the ranked cards
- `p2-grate-swap-popover.png` — the grate line's ⇄ open: stainless /
  tileable / floral with stock dots and prices
- `p3-grate-swapped.png` — the tileable grate landed on the bill
- `p4-overwrite-confirm.png` — a kit row over the swapped build asks first
  ("Keep the custom shower | Overwrite — start the kit")
- `p5-starred-filter.png` — two rows starred, the ★ filter showing just them

Tests: 1121 pass (cfg.swaps: grate/curb/board honored, curb qty re-figured,
stale-sku fallback). `npm run build` clean.
