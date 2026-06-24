Status: done
Type: AFK

## What to build

Add the **enable/disable (show-hide)** checkboxes to the catalog tree and make the
job dropdowns respect them. This is the core user-facing control.

- A checkbox on every company and every product in the Settings tree.
- A product's numbers are shown beneath it only when the product is **enabled**;
  when disabled the numbers are hidden but still stored.
- A product appears in a Selection's dropdown only when **both** its company and
  the product itself are enabled. Unchecking a company hides all its products at
  once.
- Disabling never touches saved jobs: the math still resolves a selected product by
  name regardless of its enabled state (a job using a now-hidden grout still
  calculates and displays — see slice 03's injection).

## Acceptance criteria

- [ ] Companies and products each have a working enabled checkbox in Settings.
- [ ] A product's numbers show only when it is enabled (hidden-but-stored when off).
- [ ] A product is offered in a job dropdown iff its company AND itself are enabled;
      disabling a company removes all of its products from dropdowns.
- [ ] A job that already selected a now-disabled product still shows it and still
      calculates correctly.

## Unit testing

Cover the dropdown-eligibility predicate as a pure function: product is offered iff
`company.enabled && product.enabled`; a disabled company suppresses all children;
and — critically — the resolve-by-name path (slice 03) **ignores** enabled, so a
disabled product still resolves for an existing job. These are pure and the heart
of the "old jobs never break" guarantee. Reuse vitest from slice 01.

## Blocked by

- 03-job-dropdowns-from-catalog.md
