---
issue_type: Feature
summary: Quote options were capped at three slots (A/B/C); the team needs more
  alternatives on one job.
status: done
labels: [ready-for-human]
---

# More than three quote options

Reported 2026-08-14: "need to be able to make more then three options."

## Change

`OPTION_SLOTS` extended A–F (six). Slots stay fixed positional tags on areas —
ADR 0031's model is unchanged (amendment recorded in the ADR). The slot
letters moved into `model.js` (single source: `normA`'s slot gate and `normC`'s
`optionNames` filter read the same list; `options.js` re-exports it), and
D/E/F got their own compare colors (teal / berry / ochre — outside the moss
palette like A–C). The area menu, compare tabs, print sections, and scoped
order entry all already mapped over `OPTION_SLOTS`, so they pick the new slots
up unchanged; the area context menu additionally scrolls now instead of
clipping when a job carries many options.

## Rollout caveat

No migration — old records only carry A–C, which stay valid. But a browser tab
still running a pre-change build will normalize an area tagged D–F back to
"shared" on its next save of that job, so stale tabs should refresh before the
team leans on the new slots.
