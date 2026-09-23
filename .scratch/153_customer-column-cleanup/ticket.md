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

## Proof

Real app over a stubbed Supabase with Manrope served locally (`shot.mjs`):
`rail-*-before.png` vs `rail-*-after.png`, `rail-hover-after.png`,
`phone-drawer-after.png`. `npm run build` ok; `npm test` 1563/1563.
