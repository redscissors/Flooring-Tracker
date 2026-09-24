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
   *Amendment (owner 2026-09-24):* a search field focuses in that same thin
   ink line instead of the moss focus ring (`.ft-search`), and the box
   morphs out of it the way `MorphSelect` does: it mounts exactly over the
   field, then widens and grows its results (240ms), and folds back into
   the field on close (200ms) instead of vanishing. The moss ring stays the
   focus mark everywhere else.
   *Amendment (owner 2026-09-24):* the price cell's cost & markup popup
   grows out of the cell the same way: the price cell stays the one price
   field inside the box's top row, cost sits to its left, and the markup
   presets sit two by two below, so the box is the cell plus ~78px, not a
   268px card. No margin line, close button or key hints; Tab goes cost →
   price → out, Enter closes. Mockup: `.scratch/mockups/price-pop-grow-2026-09-24.html`.
   *Amendment (owner 2026-09-24):* the grid's type picker, waste popup and
   ⋯ line menu grow out of what opened them the same way: the type chip
   (its name beside it), the order cell (a "Waste" label beside it) and the
   row-end ⋯ cell (the line's name beside it). Panels with nothing to grow
   from, such as the right-click line menu or waste opened from that menu,
   stay at the pointer and fold away on close (`PointPop`). The sidebar
   customer menu grows out of the right-clicked customer row, and the area
   menu out of its option chip ("This area is in" beside it); a right-click
   on the area band opens it at the pointer (`PopMenu`). Neither keeps the
   old full-screen click-catcher: an outside press closes it like any other
   dropdown. The header popovers follow: Save a version is one row beside
   the Save button (name field + ✓), Files grows from the paperclip with its
   label beside it, and Salesperson grows from the whole salesperson card
   (its Done button and heading dropped; Enter, Esc or a click away close).
   `growBox` picks the side with room; a mini button's hover card hides
   while its box is open. In the wedi and Schluter configurators the ⇄
   swap list grows out of its whole part line (the line names the part, so
   the list's heading goes) and the add-on / bench / niche pickers grow out
   of their chip (Schluter's pickers keep their ? heading); the right-click
   wall and bench menus stay at the pointer and fold away on close.

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
