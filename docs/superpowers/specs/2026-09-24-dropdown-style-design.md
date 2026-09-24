# One dropdown look, app-wide — design

**Date:** 2026-09-24 · **Status:** approved design, not yet built

Mockup the owner reviewed: `dropdown-preview.html` (`src/dropdownpreview.jsx`),
today vs. new style for the materials drawer, Sheoga options, a ⋯ menu and the
phone. Decision record: ADR 0048.

## Problem

The configurators' price-level dropdown (`PriceLevelMenu`, `src/widgets.jsx`)
is the one dropdown the owner likes: it takes the color of what it sits on, a
darker outline wraps the button and the list together, it slides open, and the
rows are plain names with a check on the current one. Every other dropdown in
the app looks different. About 42 of them are the browser's own `<select>`,
whose open list the browser draws and the app cannot style. The rest are a
dozen hand-built popups, each with its own border, shadow and row style.

Owner's ask: the same look on most or all dropdowns, phones included (the
phone's built-in full-screen chooser is given up for one consistent look).

## What the salesperson sees

### A pick-one dropdown (was a `<select>`)

- **Closed.** The current value and a small chevron, on the surface's own
  fill (drawer tint, white card, cream header) with a faint outline. It is
  as wide as its value, as `FitSelect` is today, or full width where the old
  select was.
- **Open.** The same box grows into the list: it widens if the list needs
  more room, a thin line separates the value from the options, the outline
  darkens to ink around the whole piece, a soft shadow lifts it, the chevron
  turns, and it slides down (240 ms, the existing easing).
- **Rows.** Plain names, semi-bold; the current one bold with a check at the
  right. Optional per row: a colored dot (price levels), a quiet note at the
  right ("−10%", "cost +6%"), disabled (greyed, not clickable). Optional group
  headings as small caps eyebrows ("IN STOCK" / "SPECIAL ORDER").
- **Long lists** (grout colors, stain colors, wizard columns) scroll inside the
  open box, capped to the room on screen; the current row is scrolled into view
  on open.
- **No room below** (bottom of the grid, phone keyboard up): it opens upward
  instead, the list growing above the value.
- **Picking** a row sets the value and slides it shut. Clicking outside,
  tabbing away or Esc closes it without a change.

### An action menu (⋯, right-click, the line menu)

An icon can't grow into a list, so these keep opening beside their trigger,
but they take the same panel: surface fill, ink outline, soft shadow,
slide-open, plain rows with an optional leading icon; destructive rows red.

### Search suggestion lists and small popovers

Product/SKU search, price-book search, address and builder lookups, label SKU
lookup, and the small editors (price cell, salesperson, files, save version,
waste, sq ft parts, ERP keyed) keep their own contents and behaviour. Their
floating panel takes the same shell: fill, ink outline, shadow, slide-open.

### Phones

Same look everywhere. On a phone (coarse pointer or under 768px wide) rows
are taller (about 36px, 14px type) so they are easy to tap, and the list is
capped to the visible screen.

## Components

All in `src/widgets.jsx`, with the pure logic in a new `src/dropdown.js` so
`node --test` covers it.

1. **`MorphSelect`** — the pick-one dropdown. Props: `value`, `onChange(v)`,
   `options` (`{ v, label, note?, dot?, disabled? }[]`) or `groups`
   (`{ label, items }[]`), `placeholder`, `bg` (the surface fill; default
   white card), `size` (`sm` for grid/drawer chips, `md` default), `full`
   (full width), `title`, `renderRow` escape hatch for the one row that holds
   an input (price level's Custom %). Controlled only — it never stores the
   value.
2. **`PriceLevelMenu`** is rebuilt on `MorphSelect`, with no visible change.
   The mockup copy in `appheaderoptions.jsx` is left alone (dev page).
3. **`FitSelect`** keeps its name and call shape but renders `MorphSelect`,
   so its 12 call sites convert by passing `options` instead of `<option>`
   children. `GroutColorOptions` becomes a function returning `groups`.
4. **`.ft-pop`** (in `src/index.css`) — the shared panel shell: fill from a
   `--pop-bg` variable (default card), 1.5px ink border, the price menu's
   shadow, a slide-open keyframe, reduced-motion respected. `DotMenu` adopts
   it, so every ⋯ menu built on it converts at once; hand-built panels add
   the class.
5. **`dropdown.js`** — pure helpers: keyboard index moves (skip disabled and
   headings, wrap), first-letter type-ahead, the flat index of a grouped
   list, the open width. Unit-tested.

### Placement, clipping and zoom

The open box renders through a portal on `<body>` at fixed coordinates (the
existing `useAnchoredPanel` rig: it tracks scroll/resize, flips upward, and
dismisses on outside pointer-down or focus leaving). That is what lets a
dropdown inside the product grid, the materials drawer or a modal open fully
instead of being cut off at the container's edge. The closed box stays in the
page, so nothing beside it moves.

Settings and the wedi/Schluter popups are drawn zoomed (`zoom` shrink-to-fit).
The open box measures the trigger's on-screen scale and applies the same zoom,
so the list matches the size of the value it opened from.

### Keyboard

Matching what a `<select>` does today, so tab flows keep working:

- Tab reaches the closed dropdown; Enter, Space, Alt+↓ or ↓ opens it.
- ↑/↓ move the highlight (skipping disabled rows and headings), Home/End jump,
  a letter jumps to the next row starting with it (the `TypeSelect` habit).
- Enter picks and closes; Esc closes without a change and takes its own rung
  on the Esc ladder (`useEscClose`, ADR 0028), so it never also folds the
  materials drawer or closes a configurator; Tab closes and moves on.
- ARIA: the trigger is a `button` with `aria-haspopup="listbox"` and
  `aria-expanded`; the list is a `listbox`, rows are `option`s with
  `aria-selected`.

## Rollout: four PRs, each with preview shots

Each PR is independently shippable and reviewed with screenshots from the dev
harness pages (non-negotiable 3). Nothing touches stored data, so there is no
SQL and nothing to migrate.

1. **Foundation.** `dropdown.js` + tests, `MorphSelect`, `.ft-pop`, `DotMenu`
   restyled, `PriceLevelMenu` rebuilt on `MorphSelect`, and the phone's
   `TierDrop` / `PrintDrop` converted. `dropdown-preview.html` switches to
   mounting the real components as the gallery.
   *Proof:* the gallery page, `sheoga-preview.html` (price level unchanged),
   `header-preview.html` (phone band).
2. **Configurators.** Sheoga's `Dropdown` and its stain / sheen / vent selects,
   Schluter's mortar-bed select; the wedi and Schluter swap, add-on, wall and
   bench panels take `.ft-pop`.
   *Proof:* `sheoga-preview.html`, `wedi-preview.html`, `schluter-preview.html`.
3. **Job grid.** `FitSelect` in the materials drawer (grout, grout color,
   mortar, underlayment, install mortar, add-on — desktop and phone),
   `UnitPick`, `TypeSelect`'s panel, `LineMenu`, `LineWastePop`,
   `SfPartsMenu`, the price cell's cost → markup → price popup, the area
   option menu, the grid search suggestion lists.
   *Proof:* no existing harness mounts the product grid (its rows live inside
   `App.jsx`), so this PR adds `grid-preview.html`: the real `TypeSelect`,
   `UnitPick`, `FitSelect` (in a drawer-tinted strip), `LineMenu`,
   `LineWastePop` and `PriceCostPop` over local state, desktop and a phone
   frame; `sf-preview.html` covers `SfPartsMenu`. The whole row in place is
   shown on the Netlify deploy preview (viewing only, no edits to live jobs).
4. **Everything else.** Settings selects and search panels, price books
   (markup group-by, the import wizard's selects including column mapping,
   flag semantics, import-router target), vendor board ⋯ menus and the
   paste-sign-in popover, customer browser salesperson filter, builder and
   address lookups, header popovers (salesperson, files, save version),
   order entry's keyed popover, the label set sort and SKU lookup, the
   sidebar right-click menu.
   *Proof:* `import-preview.html`, `vendor-book-preview.html`,
   `samples-preview.html?browser=1`, `rail-preview.html`,
   `order-entry-preview.html`, deploy preview for the rest.

## Out of scope

Modals and full dialogs, `HelpTip` tooltips, the segmented bars (tier bars,
view switches, sort bars — not dropdowns), the rail drawers, and anything on
the printed sheet.

## Risks and how they are handled

- **Phones lose the built-in chooser.** Owner's call (2026-09-24). Taller rows
  and a screen-capped list keep it tappable.
- **Keyboard regressions in tab-heavy flows** (materials drawer, import
  wizard). The keyboard contract above is tested in `dropdown.test.js` for the
  index/type-ahead logic, and each PR's preview pass tabs through its surface.
- **Many dropdowns on one screen** (about 20 column-mapping selects). Each
  closed dropdown renders only its value; the list mounts on open.
- **Zoomed workspaces.** Handled by matching the trigger's measured scale;
  checked in the Settings and wedi/Schluter preview shots.
