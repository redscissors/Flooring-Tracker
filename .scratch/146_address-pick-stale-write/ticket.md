---
issue_type: Bug
summary: Picking an address suggestion sometimes saved only the half-typed text —
  the async follow-ups of the pick merged onto a stale render's data.
status: done
labels: [ready-for-human]
---

# Address pick saved the partial text, not the chosen address

Owner, 2026-09-19: "when a address is partialy typed and then selected from
the found options, it seems like sometimes it does not save it right away and
if the project is closed and reopened the only thing that was saved is the
partial address that was typed and not the address that was choosen."

## Root cause

`AddressField.pick` (widgets.jsx) fires three writes through the `onChange` /
`onDistance` props of the render the click landed in: the prediction text at
once, the full address after `fetchPlaceDetails` resolves, and the distance
after `fetchDistance` resolves. Those props close over that render's
`updateProject` / `updatePerson` (usedirectory.js), which merged the patch onto
the closure's `data` — the state as of the click, where the address was still
the half-typed text.

- `updateProject` built `next` from that stale `data` and both `setData(next)`
  and wrote it: the `{ distance }` patch put the typed fragment back into the
  row, on screen and in the DB.
- `updatePerson` updated state functionally (screen stayed right) but built the
  written row from the stale `data`, so only the DB carried the fragment — the
  reopen-shows-partial symptom.

"Sometimes" = whenever the shop address is set (so a distance is measured) or
the details call is slow enough to land after a re-render.

## Fix

Both mutators merge onto `dataRef.current`, which mirrors the latest state, and
`updateProject` advances the ref itself so back-to-back calls compose.
