---
issue_type: Feature
summary: A cleaner estimate editor, on trial behind a per-user Settings switch —
  round 1 (header + preview toggle) shipped, header amended 2026-09-27;
  round 2 (area cards) open.
status: open
labels: [ready-for-agent]
---

# Clean editor (header shipped as a trial layout; area cards next)

Started 2026-09-27 from the owner's ask: redesign the project editor to feel as
clean as the sidebar, keeping every function but hiding rarely-used ones behind
icons or menus. Explored on a design canvas with Mobbin references, then built.

- Canvas (private, owner's claude.ai account):
  https://claude.ai/artifact/BqoJogPNrpSj5CMau88DhT
- Canvas sources, copied here: `mockups/` (Design-canvas `.dc.html` boards +
  `canvas.json`; they render inside the canvas, not standalone).
- Preview proof of the real component: `shots/` (from `header-preview.html`).

## Directions explored (mockups/)

| Board | Idea | Mobbin reference |
|---|---|---|
| `Main` (A) | Quiet sheet — everything visible, boxes removed | — |
| `ChipRow` (B) | Big title + Linear-style property chips | Linear project page |
| `SidePanel` (C) | Document + collapsible job-settings panel | Squarespace / HoneyBook invoice editors |
| `Dock` (D) | Header is only the title; a floating bottom dock | Chronicle |
| `TopBar` (E) | **Picked** — B's header + D's compact bar, docked at the top | — |
| `ErpStates` | The Order entry button's four ERP states | — |

## Round 1 — shipped: `ProjectHeaderClean` (src/projectheader.jsx)

Owner decisions, in the order they were made:

1. Customer is the headline; the project is a small line under it.
2. Salesperson shows the name only (the picker still edits phone/email).
3. Edit / Print preview tabs are gone in Clean — a small page icon toggles the
   preview, and the header stays on screen in both modes.
4. The bar's settings (price level, estimate shows, waste) are plain text with
   carets, no pills, no icons, no divider lines — the carets separate them.
   Dropdowns/popovers use the shared MorphSelect / `.ft-pop` look (ADR 0048).
5. Freight is a truck icon: quiet when on (nearly always), amber + struck
   through + the words "No freight" when off. (Claude suggested the words;
   owner approved.)
6. Order sheet button dropped from Clean (kept in One-bar/Classic). Save moved
   into ⋯ as "Save a named version…" (the job itself auto-saves; this makes a
   snapshot), Versions and Delete live in ⋯ too.
7. ERP 1 order: the number shows beside the N-number (neutral while lines are
   still to paste, green once all are) AND on the Order entry button, which
   turns green with a check once every line is pasted, "N left" before that.
   Green means ALL lines pasted, not just "a number was added" (owner: option 1).
8. The bar sits on the header's own cream, separated by faint hairlines only.
9. The whole thing is a third choice in Settings → General → Project header
   (One-bar / Classic / Clean), and that choice is now PER USER (ui.header),
   not per device. Functions are hidden, never removed; the old layouts are
   untouched so anyone can flip back.

Known gap: the button's "N left" counts unmerged lines (`erpLines` in App.jsx);
the order-entry panel's own counts can merge a SKU repeated across areas, so the
two numbers can differ on such a job.

## Round 1 amendment — header top right + address (2026-09-27, owner)

10. The top right drops the job total, the tier discount badge and the
    Option A/B total chips — no money in the header at all (the editor's
    Order summary still carries every total). The salesperson's NAME ONLY
    sits there instead (bold, right-aligned; click opens the same picker);
    "Saved ✓" stays above it. The salesperson leaves the project line.
11. The address shown is the project address when one is set, otherwise the
    customer's. The customer's shows fainter and opens the customer (it's
    edited there); with neither, "Add address" opens the customer — or, on an
    unassigned / quick-price job, the project-address box.
12. The project address is added / changed through ⋯ → "Add project
    address…" (or by clicking it on the line): a popover holding the real
    AddressField (Maps suggestions + drive distance) and "Use customer's
    address", which clears it.
13. Print follows the same rule — project address first, then the customer's
    (it used to prefer the customer's). This one is shared by every header
    layout. Order entry already worked this way.

Proof: `shots/13-r2-*` … `shots/20-r2-*` (header-preview.html). The Maps
suggestion pick inside the popover wasn't exercised (no Maps key in the
preview) — check it once on the live site.

## Round 2 — open: area cards (next session)

What the mockups show (every board uses the same card treatment):

- No grey band per area and no grey column-header bar; each area is a white
  card with a hairline border and 12px radius.
- Column headings shown ONCE above all areas (small faint caps), not per card.
- Area row: name, item count ("3 items"), the area subtotal right-aligned, ⋯.
- Product rows: hairline dividers, type chip + size, name bold, SKU/cov muted,
  the un-rounded exact beside the order qty ("13.4 14 ctn"), total bold.
- The empty adder row: "+ Search SKU or product…" in faint text.
- "Add area" as a dashed full-width button.

Not yet decided — ask the owner:

- How much of the grid's per-row chrome (materials drawer, line menu, drift
  chips, notes) changes vs only the area frame and column header.
- Whether Clean's area cards are part of the same Settings switch or a second one.

## Also open

- Printed estimate still shows the salesperson's phone under "Your
  salesperson" — header-only change so far; owner to say if print drops it too.
- Order sheet: retire it (and One-bar/Classic) once Clean is the only layout.
