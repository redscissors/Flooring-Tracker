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

**Owner picked E** (2026-07-15), refined across two rounds: no shared column
header on mobile — each field carries its own label directly above it, and the
second deck flex-wraps when width runs out (Total drops to its own line on a
390px phone).

**In-app prototype is live** per `docs/skills-reference/prototype/UI.md`:
`?variant=E` on any build renders mobile (<768px) product rows as the two
wrapping decks; a dev-only switcher pill (bottom of screen, `import.meta.env.DEV`)
flips between `current layout` and `E — two-line rows`. Desktop is untouched.
Code: `EField` + the `protoE` branch in the product-row render (marked
PROTOTYPE in App.jsx). Same state, same handlers — layout only.

Preview proof (real app, stubbed Supabase — no live data touched):
`app-E.png` / `app-E-scrolled.png` vs `app-current.png` in this folder. The
current grid crushes the same row that variant E renders fully legible.

Next: judge with a real job on a real phone (`npm run dev`, open with
`?variant=E`). If it holds up, promote: fold the E branch in as *the* mobile
rendering (delete the switcher + `?variant` gate), sweep the row-adjacent
mobile leftovers (materials drawer width, popover clamps), and PR with fresh
preview proof. Then delete this folder.

## Promoted (2026-07-15)

The `?variant=E` gate and the dev-only switcher pill are removed. Mobile
(<768px) now renders the two-line rows unconditionally — no URL param needed;
desktop (≥768px) is unchanged and still renders the 9-column grid.
`protoE`/`protoVariant`/`setVariant` are gone; the row branch now switches on
the existing `isWide` flag like every other responsive point in App.jsx.

Promotion proof (real app, stubbed Supabase, on PR #122's branch):
`promote-mobile.png` / `promote-mobile-scrolled.png` (two-line rows, no
`?variant`) and `promote-desktop.png` (grid header + `SIZE / TYPE` columns
intact) in this folder.

Still open (separate follow-up, not blocking this merge): the materials
drawer width and a few fixed-width popovers noted in the original design
doc — those weren't part of the row redesign the owner reviewed.

Folder stays until PR #122 merges, then delete.
