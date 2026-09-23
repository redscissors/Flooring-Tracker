---
issue_type: Enhancement
summary: Customer column tidy-up — borderless, left-aligned menu under Quick
  Price; smaller, cleaner Recent customer rows.
status: done
labels: [ready-for-human]
---

# Customer column: one left edge, no outlines

Owner, 2026-09-23: keep Quick Price as it is; the button labels below it
"don't have a hard edge or line up" — drop their outlines and keep them neat;
make the Recent customers text smaller and cleaner; drop the outline on the
`…` button. Picked the stacked-list layout (wedi and Sheoga on their own rows).

## Change (src/App.jsx, rail only)

- New Customer, Customers (count at the right), wedi and Sheoga are
  borderless menu rows (`railItem`): icons in a 16px slot on the Search
  icon's line, labels on the Search text's line, soft hover fill.
- RECENT / section eyebrows and customer names move onto the icon line.
- Customer name 13.5 → 12.5px, meta 11 → 10.5px, row padding tightened;
  `…` loses its border (hover fill instead) and stays always visible for
  touch. Nested project rows and "New project" drop half a size.

## Round 2 (owner, same day)

"More spacing between Sheoga and Recent … what if the three-dot menus turn
into a right click on the customer instead?" Picked a small menu (matching
the area-header right-click) over opening the details box directly.

- Top block gets 10px more bottom padding before RECENT.
- Right-click a customer row → menu at the cursor: Customer details…, New
  project, Delete customer… (the usual confirm). Esc / outside click /
  another right-click close it; the row stays washed while its menu is up.
- The `…` shows only where there is no mouse or trackpad at all
  (`(any-pointer: fine)` false — phones, keyboard-less tablets; iOS never
  fires contextmenu), lined up with the name instead of the row's middle.
  Row tooltip adds "· right-click for more" where right-click exists.

## Round 3 (owner, same day)

"Eliminate the number of projects underneath each name … move the recents
down just a little bit more." Owner chose to drop the whole meta line, the
builder name included (it stays in Customer details and the Customers chart).

- Customer rows are the name alone, one line, py-2 so they stay easy to hit.
- Top block bottom padding pb-5 → pb-8 (≈22px more than the original gap).
- The phone `…` centers on the now single-line row.

## Proof

Real app over a stubbed Supabase with Manrope served locally (`shot.mjs`):
`rail-*-before.png` vs `rail-*-after.png`, `rail-hover-after.png`,
`phone-drawer-after.png` (touch emulation: dots shown),
`rail-rightclick-after.png`, `delete-confirm-after.png`; the script also
asserts Esc / outside click close the menu and Customer details… opens. `npm run build` ok; `npm test` 1563/1563.
