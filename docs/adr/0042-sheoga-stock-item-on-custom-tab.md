# Sheoga: a stock item is stock on either tab, and prefinishing takes micro bevel as its minimum edge

Date: 2026-09-15 · Status: Accepted

The Sheoga configurator's stocked tab and its Unfinished & custom tab could
quote the same item — 4¼" Character Hickory Toasted Acorn at its standard
30 sheen — two ways: no fee from the stocked tab, and the $300 / $600
small-order fee from the custom tab, because `calcFloor` charged the fee from
the finish alone and never asked whether the build was one of the stocked
program's own items. Owner (2026-09-15): a stock color "should never have a
small order charge … even though it was put together in the unfinished, it is
really a stock."

Decisions:

- **A custom-tab build that IS the stocked program's item is that item.** The
  match (`stockedForFloor`) is the reverse of the white-cell hand-off
  (`floorSeedFromPrefin`, ADR-less owner decision 2026-07-29): solid, standard
  1'–8' lengths, no sap, micro bevel, a sheet color as the finish (Natural or
  an established stain, the two textured rows by their scrape) at its standard
  sheen, on a green STOCK / FAST TRACK cell. Such a build owes no small-order
  fee, carries "Stocked item — ships from Sheoga stock", and quotes the sheet's
  own transcribed cell so both tabs show one number for one item. One step off
  the program — a white width, a sheen change, engineered, a length run,
  no-sap, a pillowed edge, a scrape the row doesn't stock — is the
  made-to-order run it always was. The optional color-match sample still
  charges when asked for.
- **A multi-width bundle is a stock order only when every shipping width is a
  green cell**; one made-to-order width makes the whole run owe the pooled
  fee.
- **Prefinishing takes micro bevel as its minimum edge** (owner, same
  conversation: "anytime when something gets prefinished, it gets a micro
  bevel as a minimum for the edge"). Square edge on a prefinished build reads
  and orders as Micro bevel on the floor and herringbone calculators
  (`floorEdge`) — $0 either way, only the order text changes — and the Edge
  picker greys Square while a finish is chosen, lifting it to Micro bevel when
  one is picked. Saved rows are untouched (the description is a snapshot);
  Reconfigure re-reads them under the new rule.

Not decided here: the stocked tab still offers only stock items (owner
decision 1, 2026-07-29), and the fee rules of ADR 0039 (sheen change) stand —
a stock color off its standard sheen is made to order on both tabs.
