---
issue_type: Feature
summary: Clean up the wedi and Schluter configurators — Schluter kit list to
  wedi's form, a size column in the build column and in Compare, brand words
  off item names inside the popups. Mockups out for owner review.
status: needs-info
labels: [needs-info]
---

# Shower configurator cleanup

Owner ask (2026-09-28): wedi reads cleaner at a glance than Schluter; on
Schluter some item sizes are hard to see; on Compare no sizes show at all;
inside a configurator the item names don't need "wedi", "Schluter" or
"KERDI". Use the Clean editor (.scratch/159) as the design direction.

Mockups: `mockups/cleanup-2026-09-28.html` (published privately at
https://claude.ai/artifact/AjTkBo1YpHkRhMxrceoWk8). Befores in
`mockups/shots/` are crops of wedi-preview / schluter-preview /
compare-set-preview.html; afters are static HTML over the same fixture numbers.

## Proposed rules (display only — no pricing, solver or stored-shape change)

1. Brand words stripped from item names inside the popups: wedi®, ™,
   Schluter, KERDI-, S-DRY, Subliner Dry. Distinguishing product names stay
   (ALL-SET, PRO-SET, Building panel). Compare column heads keep a brand chip.
2. Size is its own bold column in the build column and in every Compare cell
   (today CompareTab.jsx renders only qty + name + price). Blank when the
   sheet states none.
3. One kit-list size format: bold nominal feet, inches in grey, smallest first.
4. Standing help paragraphs move behind a HelpTip ? (ADR 0045).
5. Same stock signal on both lists (moss dot / hollow dot + grey for SO).

## Open (owner)

- Does the name cleanup stop at the popups (job lines, print, order entry
  keep full names)? Mocked as yes.
- Kit sizes in feet (wedi's form) or inches only?
- SKU on the Schluter kit list: hidden (hover) or faint column?
