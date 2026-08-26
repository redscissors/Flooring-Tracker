---
issue_type: Feature
summary: Quote options extended to twelve slots (A–L) with the per-slot colors
  retired for one shared tint, and areas got back a drag handle — the ≡ grip
  right of each area's total, hold-and-pull to reorder areas.
status: done
labels: [ready-for-human]
---

# Twelve option slots, one option color, and an area-reorder grip (owner, 8/26)

Three asks in one message (2026-08-26): "lets bump it to 12", "lets just remove
the different colors for options", and "we lost the grab button to drag areas
around sometime. Lets add the three lines to the right of total in an area and
let us grab it to drag areas around."

## What changed

1. **`src/model.js`** — `OPTION_SLOTS` is now `A–L` (twelve). The letters stay
   here because `normA`/`normC` gate on them; `options.js` re-exports the list.
   ADR 0031 gained its second extension amendment, with the same rollout
   caveat as the A–F one: a stale pre-amendment tab normalizes a G–L tag back
   to shared on that job's next save.

2. **`src/options.js`** — the per-slot `OPTION_COLOR` palette is retired.
   Twelve tellable-apart hues don't exist, so every option wears the one
   slate-blue tint and the letter is the identity. The export keeps its
   per-slot map shape (`OPTION_COLOR[slot]` → the same `{main, deep, soft}`),
   so every consumer — header chips, area borders/badges, the compare seg and
   order-scope dots, the option print's bands — reads unchanged.

3. **`src/App.jsx`** — areas are draggable again, from a new ≡ grip
   (`AlignJustify`) in the area header immediately right of the SF · total
   readout, left of the trash. `startAreaDrag`/`beginAreaDrag` mirror the
   product-card drag exactly: a 220 ms hold arms it (slipping >6 px cancels),
   the card pops out and tracks the pointer vertically, the main pane
   auto-scrolls near its edges, Esc cancels, and the drop is ONE
   `updateProject` categories write. An indigo insertion bar (same as the
   product drag's) marks the landing slot; dropping back where it came from is
   a no-op.

Note: there never was an area drag handle in the shipped app (history has no
trace of one — the product-row hand icon is likely what's remembered); this
adds it in the product-drag idiom rather than restoring old code.

## Preview proof (change-control rule 3)

Shot with `proof/shoot-areas.mjs` — the REAL app (vite dev) over a stubbed
Supabase (fake session seeded in localStorage, every PostgREST call answered
with mock rows), so App.jsx boots and renders the real areas grid:

- `1-areas.png` — the job view: option chips A/B/G/H (G and H are new slots)
  all in the one tint, and the ≡ grip right of every area total.
- `2-drag.png` — mid-drag: the held area popped out with the drag shadow,
  tracking the pointer.
- `3-dropped.png` — the drop committed: Kitchen + Pantry landed between the
  two Master Bath areas, "Saved ✓" flashed.
- `4-area-menu.png` — the area right-click menu: used slots + "New option…",
  uniform dots.

## Tests

`options.test.js` pins the twelve letters and that every slot resolves to the
same tint object; `model.test.js` pins that "L" normalizes as a valid slot.
Full suite green (1131 passing).
