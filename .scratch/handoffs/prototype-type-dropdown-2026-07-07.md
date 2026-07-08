# Prototype outcome — product type selector as a dropdown (2026-07-07)

**Question:** the product flooring-type selector was a row of pills where the
selected type jumped to the front on each click (a FLIP-animated "moving bar")
— visually noisy and it shifted the other controls on the card's top row. What
dropdown form replaces it while keeping each type's colour?

**Method:** three variants were mocked in a throwaway `src/TypeDropdownPrototype.jsx`
(now deleted), switchable on the live app shell behind `?proto=typedrop&variant=A|B|C`
(dev-only, mounted before the auth gate so it needed no Supabase), with mock
tile/hardwood/misc cards for real density. Screenshotted at 1280×860.

- **A — Colored pill dropdown:** today's selected pill *is* a native `<select>`.
  Smallest change, phone-friendly, but only the closed pill shows colour.
- **B — Swatch menu dropdown (picked):** a colour-dot pill opens a custom menu
  of all six types, each with its swatch and a check on the current one.
- **C — In-bar color block:** the type becomes a solid-colour first segment of
  the field bar (white text). Boldest, frees the card's top row.

**Answer (Variant B, folded into `App.jsx` the same day — PR #33):**
- New internal **`TypeSelect`** component: a pill tinted in the type's
  `TYPE_ACCENT` (dot + label + chevron) that toggles a swatch menu (`fixed`
  inset overlay closes it on outside click). Each menu row shows the type's
  colour dot; the current type is bold + accent-coloured with a `Check`.
- The chosen type still colours the pill **and** the card's left border.
- Removed the per-pill FLIP animation entries and the `typeOrder` reshuffle
  (the source of the "moving around").

**Rejected:** A (colour only visible when closed), C (strong but changes the
field-bar rhythm more than wanted).

**Scope / safety:** presentation-only. No data-model change, no Supabase writes,
no SQL, no new deps — `updProduct(..., { type })` is still the only mutation.
Verified by `npm run build` (passes) and `npm test` (89/89). Preview proof: a
throwaway harness rendering the exact folded `TypeSelect` markup (real app is
behind the sign-in wall), screenshots shown to the owner in the authoring
session. Landed on branch `feat/type-dropdown-selector` (PR #33).
