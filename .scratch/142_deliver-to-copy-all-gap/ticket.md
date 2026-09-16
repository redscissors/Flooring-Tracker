---
issue_type: Bug
summary: "Order entry → Deliver to copy-all: Win+V showed only one or two of the eight entries. The 80 ms gap between clipboard writes outran Windows clipboard history."
status: done
labels: [ready-for-human]
---

# Deliver to copy-all outran Windows clipboard history (owner 2026-09-16)

## What was wrong

Owner: "The Customer copy in erp seems to not quite grab all the info, maybe
it too fast or too slow?" Asked which entries survive: "most of them [go
missing], only 1 or 2 show"; ERP 1 and the browser are on the same PC.

Copy-all (`LatchCopy texts=`, shipped 2026-09-15) wrote the seven fields and
the label to the clipboard 80 ms apart. Windows clipboard history is a
background listener: it gets a change notification and reads the clipboard
some time later, and a write that lands before it has read the previous one
is skipped ("if you copy something else before Clipboard History has time to
register the first copy signal, it will get skipped" — the mechanism Microsoft
describes; no figure is published). On the desk's PC that lag is longer than
80 ms, so the burst lost nearly everything but the last entries. `writeClipboard`
swallows errors, so the button latched green regardless.

## Fix

- `src/clipseq.js` — `writeSequence(texts, { write, wait, gapMs, onProgress })`,
  the sequencing pulled out of the React button so it is testable under node;
  `CLIP_GAP_MS = 400` (eight entries ≈ 2.8 s, still inside Firefox's 5 s
  user-activation window; Chrome/Edge need none for writes).
- `LatchCopy` counts up on the button (`3/8`) while it runs and is disabled
  meanwhile, so the desk waits for the check before Win+V or Ctrl+V. The help
  tip says it takes a few seconds.
- Tests: `src/clipseq.test.js` (order, gap placement, progress, default gap).

## Preview proof

`copy-all-states.png` — the button idle, mid-run (`3/8`), and latched;
`proof.html` is the mock (headless Chromium, the app itself needs a live login).

## If it still drops

400 ms is a judgement call on an undocumented lag. If Win+V still misses
entries on the desk's PC, the next move the owner already weighed is a step
button (each click copies the next field in form order), which does not depend
on the history's timing at all.
