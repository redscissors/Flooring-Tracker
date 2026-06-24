Status: done
Type: AFK

## What to build

Make each company row in the Settings catalog tree **expand/collapse** so the list
stays tidy as products accumulate (the "keep Settings uncluttered" goal). Collapsed
by default is fine; the team opens the company they're working with.

- An expander control on each company row that shows/hides its products.
- Expand/collapse is a view-state convenience only — it does not change the
  enabled state, the catalog data, or anything jobs see.

## Acceptance criteria

- [ ] Each company row can be expanded and collapsed.
- [ ] Collapsing a company hides its product rows in Settings without changing
      their enabled state or the data.
- [ ] Expand/collapse has no effect on what appears in job dropdowns.

## Unit testing

None — pure presentation/view-state toggle with no business logic. (If a component
test harness is later stood up, a light render/toggle test would suffice, but it
isn't worth standing one up for this slice alone.)

## Blocked by

- 02-catalog-shape-and-seed.md
