Status: needs-triage
Type: AFK

## What to build

Let the team **add** companies and products to the catalog, with the unique-name
rule enforced.

- An "add company" action (name) and an "add product" action under a company,
  capturing the product's numbers (grout: coverage; mortar: tiers + price).
- Enforce **unique product names within grout and within mortar** (ADR 0002): a
  duplicate name is rejected with a clear message. The same name is allowed across
  grout vs mortar (they're separate namespaces).
- Newly added products default to **enabled** so they're immediately usable.
- A company may exist with no products yet.

## Acceptance criteria

- [ ] A new company can be added and appears in the tree.
- [ ] A new product can be added under a company with its numbers, defaults to
      enabled, and shows up in the matching job dropdown.
- [ ] Adding a product whose name duplicates an existing grout (resp. mortar)
      product is rejected; the same name across grout vs mortar is allowed.

## Unit testing

Cover the unique-name validator as a pure function: rejects a duplicate within the
grout namespace, rejects within mortar, allows a name shared across the two,
case/whitespace handling consistent with how names are matched at lookup. This
guards the resolve-by-name invariant the whole design rests on. Reuse vitest from
slice 01.

## Blocked by

- 04-show-hide-checkboxes.md
