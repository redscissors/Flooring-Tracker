---
issue_type: Feature
summary: Miscellaneous lines had no way to get a note — the per-line note box
  only appears once a note exists, and the only place that creates one is the
  extras drawer, which misc lines don't have.
status: done
labels: [ready-for-human]
---

# Add note from the line menu (misc lines too)

Reported 2026-09-09 (Josiah Yoder): "Can't add notes by miscellaneous items.
I am thinking we could add a 'add note' option in the three dot button on the
right of the line? It would add a note that looks like the notes that are
added in the extras. also could normal lines also modify and add notes that
are in the extras note area?"

## Decision (owner, 2026-09-09 — brainstorm option A)

One note per line, not two: the menu's note and the extras-strip note are the
same `product.note`. "Add note" in the ⋯ menu reveals and focuses that same
box on any line; once text exists the item reads "Edit note".

## What shipped

- `src/linemenu.jsx` — `Add note` / `Edit note` item (StickyNote icon) after
  Duplicate line, driven by new `hasNote` / `onNote` props.
- `src/App.jsx` — `noteOpen` view state (one row id, never persisted) plus a
  focus effect. The three note-box render conditions now read
  `showNote = !!p.note || noteOpen === p.id`, so the box shows before any text
  exists; a box blurred empty clears `noteOpen` and hides again. Misc lines
  land in the existing "no wrap" cream note row; normal lines land under the
  extras strip exactly where a drawer-typed note already lives.
- No data-model change: `note` already existed on every product and already
  prints (EstimatePrint) and shows on the phone row sheet (which has always
  had a plain Note field).

## Proof (real App over a fake Supabase client — `shot.mjs`)

`npx vite --config .scratch/131_line-note-menu/vite.config.mjs` then
`node .scratch/131_line-note-menu/shot.mjs`. The harness aliases
`src/lib/supabase.js` to `fakesupabase.js` (seeded one-area job: a tile line
with grout + a misc "Delivery / haul-away" line) and mounts the REAL App.jsx.

- `1-job-sheet.png` — before: the misc line has no note affordance.
- `2-misc-menu-add-note.png` — ⋯ on the misc line → "Add note".
- `3-misc-note-typed.png` — the note box, focused and typed into, in the
  cream note row under the misc line.
- `4-misc-menu-edit-note.png` — reopening the menu reads "Edit note".
- `5-tile-note-in-extras.png` — same item on the tile line; the note sits
  under the Grout extras strip.
- `6-misc-note-cleared-hidden.png` — clearing the note and tabbing away
  hides the box (probe: 0 note inputs on the row).
- `7-print-preview-misc-note.png` — the misc note on the printed sheet.

`npm test`: 1377 pass, 0 fail. `npm run lint`: 7 errors, pre-existing.
