---
issue_type: Bug
summary: "Sheoga configurator: a non-standard sheen must owe the small-order fee under 500/250 sf on every color — Natural was still exempt. Also the Job size box could not be backspaced to blank/0 (it snapped to 1), so entering a new size meant highlighting the 1 first."
status: done
labels: [ready-for-human]
---

# Non-standard sheen owes the small-order fee on Natural too; Job size box types freely (owner 2026-09-04)

## What was wrong

- `smallOrderFee` exempted Prefinished Natural at every size (owner rule
  2026-07-28). ADR 0039 carried that exemption into the sheen-change rule, so a
  Natural order at a non-standard sheen got the 25¢/sf but never the $300/$600
  fee — on the custom/floor tab, herringbone, stocked, and multi-width bundles.
- The Job size input wrote `Math.max(1, …)` straight back on every keystroke,
  so backspacing the seed `1` produced `1` again.

## Rule

The Natural exemption covers Natural's *standard* run only. Off its standard
sheen it is made to order like a stain and owes the same small-order fee
(`smallOrderFee(finish, sf, nonStdSheen)`). ADR 0039 amended in place.

## Fix

- `src/sheoga.js`: third arg on `smallOrderFee`; `calcFloor`, `calcHerringbone`,
  `stockedSheenFees`, `multiWidthBuild` pass whether the sheen changed.
- `src/SheogaConfigurator.jsx`: sheen warnings mention the fee for Natural as
  well; Job size keeps a typing draft (`sfDraft`) so the box can sit blank or 0
  mid-edit while `sf` itself never drops below 1; blur re-syncs to `sf`.
- `src/sheoga.test.js`: Natural fee cases on floor, herringbone, stocked.
