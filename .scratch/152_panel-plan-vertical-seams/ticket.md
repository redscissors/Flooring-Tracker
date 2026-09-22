---
issue_type: Bug
summary: The wedi Fit panel plan put vertical seams on walls a horizontal 4×8
  covers — a 72"×108" back wall came out as nine 3×5s with three butted seams.
status: done
labels: [ready-for-human]
---

# Wall panel plans: avoid vertical seams, share ripped top strips

Owner, 2026-09-22 (wedi custom shower, 72×54, walls 108"): "this should have
used two 4x5 horizontal for the left wall and 2 4x8 horizontal for the back
wall, and then 1 4x8 split in two to finish the top off … it should always
avoid [a vertical seam] if it can." Follow-up: "zero seams wins unless it's
way more"; apply the same fix to Schluter.

## Root cause

`panelPlan` picked course HEIGHTS first — fewest courses, then least
overshoot — and never weighed vertical seams. 108" = 3 × 36" exactly, so every
course became a 36" 3×5 course, and a 3×5 is only 60" long: each 72" course
was a 60" piece butted to a 12" sliver (billed as a whole new sheet). Nothing
could rip one sheet into top strips for two walls.

## Fix

`src/panelplan.js` — one planner both engines call (wedi `panelPlan`,
Schluter `boardPlan`):

- full courses at the widest sheet; shorter courses (36", the top-off) are
  strips ripped from sheets shared across every wall;
- a wall stands vertical only when one column covers it (optionally with a
  top strip);
- pick: fewest vertical seams unless > 25% dearer than the cheapest plan,
  then fewest pieces / rips unless > 20% dearer, then cost.

## Outcome — curbed kits (back = long side, both sides = short side)

wedi at 96": unchanged (already seamless). wedi at 108": every size 0 vertical
seams (was 3 on every pan ≥ 72" long, 9 on 72×72), none dearer than before —
e.g. 48×72 $655.92 → $588.75, 72×72 $983.88 → $824.25.

Schluter (48×96 / 48×64 boards) was already seamless at 84/96/108; at 84/96
unchanged, at 108 the shared top strips save $112–$223 per kit
(72×72 $1003.86 → $780.78).

## Proof

`proof/` — the REAL configurators in the preview harnesses (wedi-preview.html,
schluter-preview.html), before/after on the same inputs.
