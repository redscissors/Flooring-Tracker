# ADR 0048 — One dropdown look app-wide: the price-level menu's style replaces the browser's `<select>`, phones included

- **Status:** Accepted
- **Date:** 2026-09-24
- **Scope:** system-wide (every pick-one dropdown, action menu and floating panel; `MorphSelect` / `.ft-pop` in `src/widgets.jsx` / `src/index.css`)
- **Related:** design spec `docs/superpowers/specs/2026-09-24-dropdown-style-design.md`; mockup `dropdown-preview.html`; ADR 0028 (the Esc ladder); `PriceLevelMenu` (owner 2026-09-24, `app-header-options.html`).

## Context

The owner liked the configurators' price-level dropdown: it sits on its
surface's own color, grows into its list inside a darker outline, slides
open, and lists plain names with a check. The rest of the app's dropdowns
were a mix: about 42 browser `<select>`s (whose open list the browser draws
and the app cannot style) and a dozen hand-built popups with their own
borders and shadows. The owner asked for the one look everywhere and, after
comparing mockups side by side, chose it on phones too, giving up the
phone's own full-screen chooser.

## Decision

1. **Every pick-one dropdown is a `MorphSelect`**, never a browser
   `<select>`. The closed box sits on its surface's fill; opening grows the
   same box into the list inside an ink outline with a soft shadow. This
   includes phones and admin screens such as the import wizard's column
   mapping.
2. **Every action menu and floating panel wears `.ft-pop`**: the same fill,
   outline, shadow and slide-open, and plain rows, even where the trigger is
   an icon and the panel cannot grow out of it.
3. **The open list renders in a portal** at fixed coordinates, so no scroll
   container or modal clips it, and it takes the trigger's measured zoom so
   it matches the shrink-to-fit workspaces.
4. **It keeps a `<select>`'s keyboard contract**: arrows, Home/End,
   first-letter jump, Enter picks, Esc closes on its own Esc-ladder rung, and
   Tab moves on.
5. **A search field's results wear the same box** (`SearchPop`, owner
   2026-09-24): one ink outline wraps the field and its results, the field
   as the top row (bottom row when it opens upward). The top row is
   see-through and passes clicks, so the caret stays in the real field; the
   box widens past the field only where the results need the room. Full-
   screen search sheets and in-place list filters are not dropdowns and
   keep their own look.

## Consequences

- One component and one CSS class to maintain; a new dropdown gets the look
  by default, and a new `<select>` in `src/` is a review flag.
- Phones lose the OS picker (accepted by the owner). Rows grow to about
  36px on coarse pointers and narrow screens to stay tappable.
- The component owns behaviour the browser used to provide (keyboard,
  ARIA, off-screen flip), so it carries unit tests for that logic
  (`src/dropdown.test.js`).
- No dropdown sits inside a `<form>` (the only forms are the sign-in and
  set-password screens, which have none), so nothing depends on native form
  submission of a select's value.
