# 072 — wedi configurator: cover-frame add-on for linear drains

Status: done
Opened: 2026-07-31 (owner)
Area: wedi configurator (issue 066)

## The ask (owner)

> the wedi linear drains should have an add on of the matching frame for the
> drain cover
> im talking about the wedi configurator in the building column

## What shipped

A **Cover frame** add-on chip in the build column, offered only while the
build's drain cover is a **linear** one — a 4×4 point drain has no frame, so
the chip stays hidden there.

- `coverFrames(cover)` (wedi.js) — the frames that match a linear cover:
  same nominal length, same metal. wedi lists no *perforated* frame, so a
  perforated cover (SSP/MBP/BP/CP) wears the plain frame of its own metal; a
  **tileable** cover has no metal of its own and can take any of the four, so
  the chip opens the standard picker there instead of auto-adding.
- `coverFrameFor(cover, finish)` — what the build resolves. The stored value
  is a **finish, not a part number**: the length always follows the cover, so
  re-sizing the drain re-sizes the frame. A finish picked by hand is honored
  even when it isn't the cover's own metal (the frame is a design choice) and
  falls back to the matching one only when that length lacks it.
- `kitFor(pan, { coverFrame })` pushes the frame into the **Drain & finish**
  group right under the cover, and `cfg.coverFrame` round-trips the finish so
  Reconfigure reopens with it. The frame is never part of the house kit —
  like the curbless recess kit, it is an opt-in that arms the kit-overwrite
  confirm but does not move the build to the Custom shower tab.
- The frame line carries the normal ⇄ swap: every frame in that length plus
  **No frame**.

Riolito neo modules ride along — a module is family `linear`, so its 27″/43″
cover matches the stocked SS channel frames (676800061 / 676800064).

## Preview proof

`npx vite --port 5199` then `node .scratch/072_wedi-cover-frame/shot.mjs`
(harness: the real `AppsWorkspace` wedi tab, as issue 068).

| Shot | What it proves |
|---|---|
| `preview-1-point-drain-no-chip` | A point-drain Fundo kit — no Cover frame chip in the add-ons row (chips: Niche · Seat · Bench · Glass shelf · Sealant gun). |
| `preview-2-linear-frame-chip-off` | The 36×60 Fundo Linear base — "+ Cover frame" is there, off; Drain & finish holds the SS43 cover alone. |
| `preview-3-frame-added` | One click: the SS43 cover matches exactly one frame, so the stocked 43″ SS channel frame (28874, $166.77) lands under the cover reading "trim ring around the cover". Chip flips ✓. |
| `preview-4-frame-swap-menu` | The frame's ⇄ — "Cover frame — 43″ channel": No frame, the two stocked SS/MB frames, then brass and chrome special-order. |
| `preview-5-brass-frame-swapped` | Brass B43 picked, $273.74. |
| `preview-6-tileable-cover-brass-frame` | The **cover** swapped to tileable T43 — the hand-picked brass frame stays put. |
| `preview-7-frame-off` | Chip toggled off — the frame line goes, cover stands alone. |
| `preview-8-tileable-frame-picker` | Chip on again over a tileable cover: four possible metals, so the picker opens (stock first — SS 28874, MB 1509467 — then B/C special-order). |
| `preview-9-picked-from-picker` | The pick lands; chip ✓. |

Engine coverage: `src/wedi.test.js` → "wedi cover frames: the linear drain's
matching trim ring, opt-in".
