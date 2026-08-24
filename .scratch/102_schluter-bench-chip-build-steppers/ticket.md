Status: done

# Schluter round 4 — benches under one Add-ons dropdown, build-line qty steppers

Owner asks (2026-08-24): "the benches should be in the add-ons area, underneath
one drop down for benches"; "in the build, I need to be able to adjust the
quantities up and down for each of the items, if I wanna add or subtract any."

## What landed

- **One "+ Bench" chip in the build column's Add-ons** (its picker is the
  dropdown): 2″ KERDI-BOARD build-up (wall or corner), framed + ½″ wrap, the
  premade SB pieces read live off the registry, and the KERS-B seal kits as
  accessory toggles — so the standalone "+ Bench corner kit" chip retired into
  it. A placement pick lands on the next open wall/corner zone; existing
  benches list at the top of the picker with click-to-remove. The drawing's
  bench zones stay the place a bench moves, resizes or changes build — the
  round-3 machinery is untouched, the chip is a second door to the same
  `benches` rows.
- **Every build line takes a wedi-style qty stepper** (`qtyOv`, the
  WediConfigurator idiom): −/+ on each non-note line, a hand-set quantity
  reads rust with the recipe's own figure in the title, stepped to 0 the line
  leaves the bill, and the extended price / totals / from-stock meter follow.
  A hand-added Extras line steps its own `manual` row (chip state follows).
  Session-only like wedi's — never written into the `product.schluter` marker,
  so no persisted-shape change; a kit hard-reset (`pickKit`) clears overrides.

## Proof

shoot.mjs (this dir): p1 the Bench dropdown open — build-up/corner/framed +
premade SB list + KERS-B accessories, only Bench + Niche chips left · p2 a
premade pick landed on the back wall (drawn, billed) · p3 second pick lands the
NEXT open zone (left wall), both listed with remove · p4 KERDI-BAND stepped to
3 and ALL-SET down to 1 — rust override quantities, totals follow · p5 the pipe
seal stepped to 0 leaves the bill. Tests: 1095 pass; lint clean on the changed
files (the 8 standing errors pre-exist on main).
