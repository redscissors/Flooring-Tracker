# 080 — wedi: "Clear design" moves to the left of the price levels

Status: done
Labels: ready-for-agent

## Ask

> In the wedi configurator, move the Dlear Design button to the left of the
> price levels.

## Where it was

`WediConfigurator.jsx` — the Custom shower tab's **Walls** group header, sharing
that row with the ⇄ flip button (it landed there when the wall editor moved off
the build column, 2026-08-03). Two problems with that home:

- it only existed on the Custom shower tab, though it wipes the *whole* build —
  a kit loaded from the Kits tab had no clear button on screen;
- inside a group titled "Walls" it read as a wall control, not a build reset.

## Where it is

The popup head, immediately left of the TierBar (the price levels), right of the
"wedi shower systems" title. The head is above the tabs, so the button is on
every tab now.

- `.pop-head .rclear` takes the `margin-left:auto` and the tier bar drops its
  own, so the pair sits together at the right end of the head with the close
  button after it; slightly larger type/padding than the group-header original
  so it doesn't read as a stray chip beside an 18px title.
- The retired `.rfgrp .wallctl + .rclear` spacing rule went with it.
- Behaviour is untouched: same `hardReset(null)` + "Design cleared" toast, same
  `data-wedi-clear` hook the shoot scripts click.

## Proof

`node .scratch/080_wedi-clear-design-header/shoot.mjs` (dev server on :5199),
shots in `shots/`:

| shot | shows |
|---|---|
| `1-head-kits.png` | the head on the Kits tab — the button is there before any design exists |
| `2-custom-tab.png` | the whole popup on Custom shower |
| `3-head-custom.png` | Clear design ▸ Retail·Builder·Employee·Sale·Custom ▸ ✕ |
| `4-walls-group.png` | the Walls group, ⇄ alone in its header |
| `5-after-clear.png` | the build cleared — 10 lines → 0, "Design cleared" |
| `6-head-narrow.png` | 1180px window, still ordered and inside the frame |

Measured each time: clear `1136→1236`, tier bar `1250→1603` at 1680px;
`736→817` / `828→1115` at 1180px. `.rfgrp [data-wedi-clear]` count 0,
`.pop-head [data-wedi-clear]` count 1.

`npm test` 891/891. `npx vite build` clean (needs `VITE_SUPABASE_URL` set —
the index.html preconnect substitution fails without it, unrelated to this
change). The one eslint error in the file (`CORNER_CUT` unused, line 20)
pre-dates this branch.
