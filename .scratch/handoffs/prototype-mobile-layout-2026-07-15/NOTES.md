# Prototype — mobile layout options (2026-07-15)

**Question:** the app is strong on desktop but collapses on phones — fields crush,
numbers and dropdowns become unreadable. What structure should the estimate
builder take below 768px without losing the desktop's usability?

**Status:** PROTOTYPE — throwaway. `mobile-layout-options.html` is a standalone
page (open it directly in a browser, or on a phone for full-bleed mode). It uses
the real Moss kit tokens from `src/index.css` and mirrors the real product-row
fields. No app code touched.

## Why the app breaks on mobile today

- The shell already adapts (JS `isWide` at 768px: drawer sidebar, mobile top
  bar, stacked header card, order summary stacks via `md:grid-cols-4`).
- The **product row grid does not**: `GRID_COLS = "0.85fr 2.75fr 1fr 0.55fr
  0.5fr 0.55fr 0.7fr 0.8fr 44px"` (App.jsx:627) renders 9 fixed columns at any
  width, with no horizontal-scroll wrapper. That grid is what turns to mush on
  a phone. Settings' `w-56` + `w-72` rails and some fixed-width popovers have
  the same problem, but the row grid is the core.

## The five options

| | Option | Idea | Build cost |
|---|---|---|---|
| A | Stacked cards | each row becomes a card: identity line, labeled field grid, materials behind a chip | low–medium |
| B | Drill-down editor | one-line summary rows; tap opens a full-screen editor with big fields + sticky total | medium (**recommended**) |
| C | Ledger + bottom sheet | screen reads like the printed estimate; tap a line to edit in a bottom sheet; pinned total bar | medium |
| E | Two-line grid (owner's sketch) | keep today's grid, but each row wraps to two decks: Size + Product/Color on line 1; each field carries its own name above it (SKU · Cov. · SF · Price · Order · Total) and fields wrap to another line when space runs out | low |
| D | Sticky-rail spreadsheet | keep the grid; product column sticks left, numbers pan horizontally, chips jump to column groups | low |

Likely real answer is a **hybrid**: C's ledger as the phone's read view with
B's full-screen editor for input.

## Decision

_Pending — owner to flip through the variants and pick (or combine)._

Once a direction is picked: prototype it in-app per
`docs/skills-reference/prototype/UI.md` (variants behind `?variant=` under the
existing `isWide` flag), then implement properly with preview proof before any
merge (non-negotiable #3). Then delete this folder.
