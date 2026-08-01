# 074 — Half-screen shrinks instead of squishing · Quick Price in the rail · Extras

Status: done

Request (2026-08-01): "When ned is in half screen or smaller it gets squished.
I think I would prefer it to just shrink everything… Also let's replace the
filter in the customer column with a new Quick Price button… I think we could
narrow the Customer Column by 20%… Also let's change the materials estimate to
Extras to match better with the print version. Let's also just have the chips on
the item line when blank show '+ Extras' for all chips in that location."

## What was wrong

The desktop project header is a single row of fixed-width cards — identity,
project, Estimate shows + Freight, Price level, Waste + minis, actions — with
only the project column flexible. That furniture needs ~690px; the edit view is
capped at `max-w-4xl` (896px). In a half-screen window the flexible column got
the difference, which went to zero: at 960px the project name and address
disappeared entirely and the card labels clipped ("ESTIMATE SHOWS", "Custom %").
`shots/before-960.png` is the reported state, reproduced.

## What changed

**Shrink, don't squeeze** (`src/App.jsx`). `<aside>` and `<main>` carry
`zoom: clamp(0.7, innerWidth / (205 + 896), 1)` on desktop. The design width is
the rail plus the edit view's own `max-w-4xl` cap, so the scale is exactly the
factor that keeps the layout at its drawn proportions — same bar, same order,
just smaller. The floor lands within a few px of the 768px mobile breakpoint, so
the desktop shell never has to squeeze on its way out.

Portals (row search, popovers, dot menus) render to `document.body`, **outside**
the scaled subtree, so `useAnchoredPanel`'s viewport-pixel math is untouched —
`shots/panel-search-960.png` shows the search panel still landing on its anchor.
They do render at 100% while the shell is scaled. `probe-rootzoom.mjs` shows why
the alternative (zoom on `<html>`, which would scale them too) is not on the
table: a fixed panel written at `left: 360.8` renders at 288.6 — the coordinates
get scaled a second time and every popover drifts.

Modals live after `</main>` in the tree, so they are unscaled — deliberately.

**Rail** (`src/App.jsx`). `w-64` → 205px (−20%). The Newest/A–Z sort segment is
gone — the rail is a recents list, and A–Z lives in the customer browser where
the whole list is. Its slot is now a **Quick Price** button under New Customer,
calling the same `startQuickPrice` the landing screen uses. The footer's three
labelled buttons plus sign-out no longer fit on one line at 205px, so it is two
rows of two.

**Header card widths** (`src/projectheader.jsx`). Estimate shows 108 → 120 and
Price level 108 → 116 — both were clipping their own labels at *every* width,
including 1440. Paid for by the identity column (150 → 138) and the card gap
(8 → 7) so the project column keeps the room it had.

**Extras** (`src/App.jsx`, `src/mobile.jsx`). The on-screen "Materials estimate"
section is now **Extras**, matching the printed estimate's Extras block, and a
blank row's dashed chip line reads "＋ Extras" instead of listing every addable
("＋ Grout · Mortar · Backer…"). The list moved to the button's tooltip; the
drawer still names each one.

## Proof

`shots/` — `before-*` / `after-*` at 1440 / 1150 / 960 / 820, plus `rail-*` and
the anchored-panel shots. 887 unit tests pass; lint is clean apart from three
pre-existing errors in `WediConfigurator.jsx` / `wedi.test.js`.

## Running the harness

`vite.preview.config.js` boots the **real** `App.jsx` against `fake-supabase.js`
(a stub client serving `seed.js`, swapped in by a `resolveId` plugin) — no
credentials, no network, no writes to the live project.

```
npm i -D playwright                                          # not a repo dep
npx vite --config .scratch/074_responsive-shrink-quickprice/vite.preview.config.js
node .scratch/074_responsive-shrink-quickprice/shoot.mjs <label>
```
