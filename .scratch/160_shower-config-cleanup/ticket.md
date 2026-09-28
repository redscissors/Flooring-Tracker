---
issue_type: Feature
summary: Clean up the wedi and Schluter configurators — Schluter kit list to
  wedi's form, a size column in the build column and in Compare, brand words
  off item names inside the popups. Built 2026-09-28.
status: done
labels: []
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
2. Size leads the item name in bold (one phrase) in the build column and in
   every Compare cell (today CompareTab.jsx renders only qty + name + price);
   Compare's qty gets its own left column. No size on the sheet = name alone.
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
  its qty, 1 included).
- v8 (current): size and item MERGED into one cell in both views — bold size,
  one space, the name ("48 × 96 × ½″ Building panel"). Compare = Qty | Size +
  item | Price; the build column keeps its qty stepper on the right.
  v9: no spaces around × in any size (4×4″, 48×96×½″).
  Waiting on approval.

## Built (2026-09-28)

Owner: "build it" on mockup v9, plus "keep S-Dry" mid-build.
- `src/kitlabel.js` (+ tests): size + clean name for display.
- Build column (both popups): bold tight size, then the clean name; qty and
  price unchanged; the grey line drops the size text once it leads.
- Schluter Kits: wedi's rows (moss stock dot / hollow SO dot, bold feet +
  grey inches, DRAIN N″ SIDE tag, SKU on hover), families "Point drain /
  Curbless (thin, no lip) / Offset drain / Linear drain", Membrane | Board
  switch, help behind a ?. wedi Kits: sizes tight (3′×5′ 36×60).
- Compare: Qty | Size + item | Price per line with column headings;
  Schluter column labels read Board / Membrane; room chip 60×38″.
- Kept as-is: the wedi "Membrane (S-DRY)" switch; Schluter prose that names
  KERDI products (bench options, figure panel, cut list).

S-DRY sizes (owner: fix them): wedi.js `dims()` no longer reads the
SEAL's "2 x 16 oz" or the drain covers' "3/3/4" typo as dimensions — ADR
0038 amended, `GEOMETRY_GAINS` in wediequivalence.test.js loses those nine.

Proof: `shots/01…08` (preview harnesses, fixture catalog).

