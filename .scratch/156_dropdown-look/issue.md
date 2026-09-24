# 156 — One dropdown look app-wide (the price-level menu's style)

Status: done
Labels: ready-for-agent

ADR: docs/adr/0048-one-dropdown-look.md
Spec: docs/superpowers/specs/2026-09-24-dropdown-style-design.md
Plan: docs/superpowers/plans/2026-09-24-dropdown-look.md
Proof: proof/*.png (sheoga-preview, wedi-preview, header-preview, dropdown-preview harnesses)

Every dropdown takes the configurators' price-level look: sits on its
surface's fill, grows into its list inside a dark outline, slides open,
plain rows with a check. Phones included (owner 2026-09-24). Four PRs:

- [x] PR 1 — MorphSelect + .ft-pop + DotMenu; PriceLevelMenu rebuilt on it; phone band price level + print
- [x] PR 2 — configurators (Sheoga selects, Schluter mortar bed, wedi/Schluter panels)
- [x] PR 3 — job grid (materials drawer, UnitPick, TypeSelect, line menus, grid harness)
- [x] PR 4 — everything else (Settings, price books, browser, header popovers, order entry, labels)

All four landed as commits on one branch; PR 1 is
redscissors/Flooring-Tracker#421, PRs 2-4 follow it. The escstack SELECT
blur-only case stays: dev harness pages still mount native selects, and it
stays correct if one ever returns.
