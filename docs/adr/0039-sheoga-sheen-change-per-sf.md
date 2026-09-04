# Sheoga sheen change is 25¢/sf off the color's standard sheen, on every tab; custom colors exempt

Date: 2026-09-03 · Status: Accepted

The Sheoga configurator charged a flat $250 "non-standard sheen" line on the
stocked tab and nothing on the custom/floor and herringbone tabs. That $250 has
no source: it is on none of the three vendor sheets (the 1/19/26 Distributor
Price List lists only the $300 / $600 small-order fees and the $750 color match
as flat fees), and the prototype README's transcription list never mentions it.

The vendor's actual rule (owner, 2026-09-03), which the price sheet does not
print:

- **Every prefinished color has a standard sheen** — the sheet's footnote: 30
  unless marked `*` (20: Caramel, Nutmeg) or `**` (5: Fresh Cut, Drift, Silk,
  Breeze, Frost, Camo, Dawn, Mist). It is a property of the color, identical
  on every species (`COLOR_SHEEN`, derived from `PREFIN_SHEET`).
- **A textured prefinish's standard is the lower of the color's sheen and 20**
  (the sheet's "Textured Prefinished Flooring (20-sheen)" heading): sawcut
  Cattail is 20, textured Fresh Cut stays 5.
- **Ordering any other sheen adds $0.25/sf** (`SHEEN_ADD`), a per-sf adder
  folded into the cost like texture and finishing, never a flat line. It
  applies on the custom/floor tab (solid and engineered), the legacy
  herringbone calculator, and the stocked tab alike. Prefinished Natural pays
  it (its standard is 30).
- **Custom colors (T-1/T-2/T-3) and a typed-in stain name have no standard**,
  so their sheen pick is free; unfinished has no sheen.
- **On the stocked tab a sheen change is a made-to-order run**: besides the
  25¢ it owes the same small-order fees as the custom tab's build of that
  color ($300 under 500 sf, $600 under 250 sf), pooled once on a multi-width
  bundle. ~~Natural keeps its small-order exemption (owner rule 2026-07-28) so
  the stocked price agrees with the white-cell hand-off to the custom tab.~~
  **Amended 2026-09-04 (owner):** a non-standard sheen owes the small-order
  fee on every color, Natural included, on every tab. The 2026-07-28
  exemption covers Natural's *standard* clear run only; at any other sheen it
  is a made-to-order run like a stain (`smallOrderFee(finish, sf, nonStdSheen)`).
  This supersedes ticket 065's "sheen change on a green cell = $250 flat, no
  small-order fee".

`calcStocked` therefore takes the job size (`calcStocked(k, sf)`); without it
the fee is unknown and not charged (the width chips and per-width bundle lines
pass none and only read the $/sf).
