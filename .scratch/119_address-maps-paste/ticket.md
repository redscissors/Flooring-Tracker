---
issue_type: Feature
summary: "Owner 9/1: asked whether an address field could autocomplete as you
  type, pulling from Google Maps. Owner's own counter-proposal, chosen over a
  keyed autocomplete API: a button beside the field that opens Google Maps
  seeded with what's typed, plus a paste button that drops back what you
  copied there — no API key, no billing account, no server function. The paste
  folds the two-line Maps place copy into one line so estimates print clean."
status: done
labels: [ready-for-human]
---

# Address lookup: Maps button + paste button (owner, 9/1)

Addresses are typed by hand into five inputs today and nothing helps: no
validation, no completion, and a Maps copy pastes as two lines that print
badly on the estimate.

Real typeahead (Google Places / Mapbox) was offered and declined in favour of
the owner's cheaper shape — the round trip to a Maps tab is manual, but it
costs nothing to run and needs no key in the bundle or in Netlify. If the
round trip proves annoying in daily use, the autocomplete dropdown is a
follow-up that only needs a key wired through a Netlify function; nothing
here blocks it.

## What shipped

`src/address.js` (pure, tested):
- `mapsUrl(text)` — Maps search seeded with the typed address; an empty field
  opens plain Maps.
- `cleanAddress(raw)` — folds the multi-line clipboard into one line without
  doubling a comma the first line already carries, squeezes whitespace, drops
  a dangling separator, caps at 200 chars so a mis-aimed copy can't drop a
  page of text into a field that prints.

`AddressField` (src/widgets.jsx, beside `BuilderCombo`): the same `inp` input
plus two ghost icon buttons — MapPin opens Maps in a new tab, ClipboardPaste
reads the clipboard through `cleanAddress`. A browser that refuses the
clipboard read (Firefox/Safari prompts, any http origin) focuses the field and
pings "Press ⌘V/Ctrl+V to paste", so the button is never the only way in.

Wired at the three roomy address inputs: the project sheet's Project address,
the customer chip editor's Mailing address, and the customer modal's Mailing
address. The two `projectheader.jsx` inputs stay bare by owner's call — a 10px
borderless line with no room for controls, editing the same field the sheet
already covers.

## Scope decisions (owner, 9/1)

- Google Maps, not Bing, not both.
- Three fields, not five — headers excluded.
- No data-model change: `address` is already a free-text string on both
  `newPerson` and `newProject`. No normalizer change, no SQL, no Supabase
  touch, no new dependency.

## Proof

`npm test` — 1226 pass (8 new in `address.test.js`). Preview screenshots in
this folder: `fields.png` (at rest), `pasted.png` (two-line Maps copy folded
into one line), `blocked.png` (clipboard refused → focus + toast).
