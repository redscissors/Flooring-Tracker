# 084 — Settings workspace shrinks to the screen instead of squashing

Status: done

Request (2026-08-09): "When opening the settings tab in mobile, it doesn't
really scale to the size of the screen well. Instead, it just either squashes
or cuts off. I would like it to just scale down similar to the wedi
configurator. Let's start with not really worrying about if the text gets too
small — if that is the case, we can kind of revert from there."

## What was wrong

The Settings workspace is drawn as fixed columns — the 224px section sidebar,
plus (in Materials & add-ons) a 176px category column and a 288px master list —
with only the detail pane flexible. Issue 074's shrink-don't-squeeze pass
scaled the desktop shell but deliberately left modals unscaled, and Settings is
a modal: on a phone the fixed columns ate the whole viewport, the detail pane
collapsed to nothing, and everything past the second column was cut off
(`shots/before-materials-390.png` — the reported state, reproduced).

## What changed

**Shrink-to-fit** (`src/SettingsWorkspace.jsx`) — the wedi popup's rig. The
workspace is DRAWN at one width (`SETTINGS_DESIGN_W = 1240`: sidebar + the
materials section's two list columns + a detail pane wide enough for its
`max-w-xl` content) and zoomed to the frame it's given: a ResizeObserver on the
overlay measures its usable width (padding steps 8→20px at `md`, read off
computed style) and the card carries `zoom = clamp(floor, w / 1240, 1)`.

- `zoom`, not `transform` — it is a real layout scale: the card's `w-full
  h-full` still fill the frame, and the DotMenu/popover portals to
  `document.body` keep anchoring in viewport pixels (they render unscaled,
  exactly like the desktop shell's portals per 074).
- The zoom is FLOORED to 3 decimals, never rounded — `w / zoom` must stay ≥ the
  design width or the under-floor `minWidth` would add a 1px scrollbar.
- `SETTINGS_ZOOM_FLOOR = 0.24` is a backstop for sub-phone windows, not a
  readability floor — the owner asked to scale all the way first and revert if
  the type gets too small. Below it the overlay scrolls (`overflow-auto` +
  `minWidth` on the card). Every real phone (≥320px) stays above it.
- At ≥1240px usable width the zoom is exactly 1 — `shots/*-1440.png` are
  byte-identical before/after.

The Modal/FamilyConfirm/LinkMigration dialogs render inside the card, so they
scale with it — consistent, though their `max-h-[88vh]` caps render shorter
than 88% of the screen under zoom (viewport units aren't rescaled inside a
zoomed box; they scroll internally, acceptable for now). Known cosmetic quirk:
the native `<select>` dropdown arrow doesn't scale with zoom, so it reads
oversized at phone scale (`after-materials-390.png`).

## Proof

`shots/` — `before-*` / `after-*` for the Materials and General sections at
390 (phone), 768, 1024, 1440. 922 unit tests pass; lint clean apart from six
pre-existing errors in files this change doesn't touch.

## Running the harness

Mounts the REAL `SettingsWorkspace` with fixture settings (no Supabase, no
network, no writes) — `?section=<id>` picks the open section. Reuses 074's
`fake-supabase.js` alias so the `lib/supabase.js` import chain stays inert.

```
npm i --no-save playwright                                   # not a repo dep
npx vite --config .scratch/084_settings-mobile-shrink/vite.preview.config.js
node .scratch/084_settings-mobile-shrink/shoot.mjs <label> [section]
```
