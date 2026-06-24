Status: needs-triage
Type: AFK

## What to build

Drive a Selection's grout/mortar dropdowns and the material math from the
**catalog** instead of the hardcoded `GROUTS`/`MORTARS` arrays. At this slice all
seeded products are enabled (show/hide arrives in slice 04); the point here is to
prove the job side reads the catalog end-to-end.

- The grout and mortar dropdowns on a tile Selection list products from the
  catalog.
- `groutExact`/`mortarExact` (and anything reading `settings.grouts`/`.mortars`)
  resolve a product's numbers **by name** from the catalog.
- A Selection whose saved grout/mortar name is no longer in the offered list still
  **displays** it: inject the stored value back as an option, exactly as the tile
  **thickness** dropdown already does (`!thickKnown && <option…>`).

## Acceptance criteria

- [ ] Grout/mortar dropdowns on a job are populated from the catalog, not the
      hardcoded arrays.
- [ ] An estimate calculates using the catalog's coverage/tier/price numbers,
      matching pre-slice results for the seeded products.
- [ ] A job referencing a product name absent from the current offered list still
      shows that selection and still calculates.

## Unit testing

Cover the resolve-by-name path in the math: (1) `groutExact`/`mortarExact` return
the same results sourcing numbers from the catalog as they did from the flat
settings, (2) a name with no matching catalog entry degrades gracefully (no crash;
same "can't compute" path as a missing rate today). The missing-option injection is
presentation — verify manually unless a component harness is stood up. Reuse the
vitest setup from slice 01; these math functions are pure and already isolated.

## Blocked by

- 02-catalog-shape-and-seed.md
