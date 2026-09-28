---
issue_type: Feature
summary: Clean up the wedi and Schluter configurators — Schluter kit list to
  wedi's form, a size column in the build column and in Compare, brand words
  off item names inside the popups. Mockups out for owner review.
status: open
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

## Decided (owner, 2026-09-28)

- Name cleanup stops at the popups; job lines, print and order entry keep
  full names.
- Kit sizes in wedi's form (bold feet, grey inches).
- SKU hidden on the Schluter kit list (hover shows it).
- Before building: show Compare with a true, aligned Size column — mockup v2
  gives each brand column Size | Item | Price headings (owner: size LEFT of
  item, also in the build column — v3; size right-aligned against the item —
  v5; top-aligned with the name line, one space apart, no divider — v6).
  Compare gets its own Qty column at the far left — v7 (every row shows
  its qty, 1 included). Waiting on approval.
