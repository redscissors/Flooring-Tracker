# Quick markups move into Settings (2026-07-26)

Status: done

Request (Marcus, 7/26): "Let's move the markup numbers into settings so I can
tune them whenever I want without a deploy."

Follow-up to `.scratch/053_price-cost-popup` (PR #262), where the price cell's
cost popup shipped with 30 / 50 / 100 hardcoded.

## What changed

**`settings.pricing.quickMarkups`** — a list, saved with the other percentages
in the shared settings record. `normQuickMarkups` (`costentry.js`) is what
`normPricing` stores and the popup reads:

- an **absent** list seeds the shop's 30 / 50 / 100, so nothing changes for
  anyone who never opens the card;
- an **explicitly empty** list is a decision and stays empty — the popup shows
  no preset buttons and the `%` box still takes any markup;
- garbage, blanks, duplicates and out-of-range values are dropped on read, and
  the list is capped at **six** — what the popup's button row can show before it
  reads as a menu.

**Settings → Price book gains a "Quick markups" card**, beside Price tiers and
Sheoga markup where the other percentages already live. Each chip is a number
with an × to remove it; `+` appends one. Editing is drafted locally because the
stored list is normalized — a field cleared to `""` on the way to a new number
would otherwise be dropped mid-keystroke and collapse the row under the cursor.
What's saved is filtered on read, so a half-typed entry never reaches the popup.

**The popup takes the list as a prop** (`markups`), defaulting to the shop's
three so the component still stands alone in a harness. Its markup row now puts
the label above the buttons and wraps, so a fourth or fifth preset takes a
second line instead of squeezing the others; the same list drives the phone's
in-line markup chips.

No SQL: `pricing` is already inside the settings jsonb and `serializeSettings`
persists whatever `normPricing` returns.

## Two layout regressions the preview caught

Both were introduced by this change and fixed before merge — neither was in the
request, and neither would have been visible without rendering the real header:

1. A **sixth card** in the library header squeezed the row, clipping the tier
   labels to "Bui" / "Sal" / "Employe". The card row went 720px → 880px.
2. The chips first rendered **one per line**, so a five-markup list stretched
   every other card in the row (they're `items-stretch`). Compacting the chip
   fits two per line and keeps the header its original height.

## Files

- `src/costentry.js` — `normQuickMarkups`, `MAX_QUICK_MARKUPS`; `MARKUP_PRESETS`
  is now the seed rather than the source of truth.
- `src/catalog.js` — `normPricing` carries `quickMarkups`.
- `src/pricebooklib.jsx` — the `QuickMarkupsCard`, and the widened card row.
- `src/grid.jsx` / `src/mobile.jsx` — `markups` prop; the popup's wrapping row.
- `src/App.jsx` — reads it once beside `descLimit` and passes it to both.
- `src/catalog.test.js` / `src/pricing.test.js` — three existing assertions
  compare the whole pricing object and needed the new field.

## Proof

`proof.html` renders **both halves over one settings object** — the top is the
real `PriceBookLibrary` landing header, the bottom the real `GridPriceCell`.
Nothing is passed between them by hand, so a list edited in the card is the row
of buttons in the popup on the next render.

| Shot | What it shows |
|---|---|
| `01-defaults.png` | The shipped 30 / 50 / 100, in the card and in the popup |
| `02-retuned-card.png` | Retuned to 25 / 45 / 100 / 75 / 125 — five chips, two per line |
| `03-popup-follows.png` | The popup, unreloaded, offering exactly that list (wrapping at five); cost 4.00 + 125% → 9.00 |
| `04-empty-list-still-usable.png` | Every chip removed: no buttons, `%` box still prices the line at 62% |

`shot.mjs` asserts the hand-off rather than eyeballing it — it reads the popup's
button labels back and fails on a mismatch:

```
defaults in popup: +30% +50% +100%
after retune  : +25% +45% +100% +75% +125%
cleared       : (no preset buttons — % box only)
settings -> popup: wiring confirmed
```

Rebuild: `npx vite build --config .scratch/054_quick-markups-settings/proof-vite.config.mjs`,
serve `proof-dist` on :8392 (`python3 -m http.server 8392`), then
`node .scratch/054_quick-markups-settings/shot.mjs`. `proof-dist` is never committed.

Tests: `node --test src/*.test.js` — 769 pass, up from 764. Production build
clean; lint clean apart from the pre-existing unused import in
`orderbook.test.js`.

## Still open

The other follow-up from 053 is untouched: a **default markup for new manual
lines**, so typing a cost alone prices the row. Say the word.
