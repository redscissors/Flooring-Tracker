---
issue_type: Question
summary: "Marcus 8/26: why is the CLNL289 job line still showing a +? Answer:
  the + is the descfit split marker — the 30-character ERP description field
  can't hold the 51-character product name beside the pinned SKU + coverage
  tail, so the line splits by design (his own 8/26 issue-110 decision). Not the
  CT bug, not litter, no code change."
status: done
labels: [ready-for-human]
---

# Why the CLNL289 line still shows a "+" (Marcus, 8/26 follow-up)

Central Claude issue flagged from the job line Q-Glazzio Colonial Collection
Lo-8/26 · Area 1 · CLNL289 — the same line as issue 110. The row's snapshot
shows the 110 fixes took (`cartonUnit: "SH"`, no CT tag), so this is about the
one mark that remains: the order-entry description reads

```
12x12" + CLNL289 1.06 SF/SH        27/30   [Ext]
```

## Answer: the "+" is supposed to be there

The `+` is not the CT bug and not importer litter — it is descfit's **split
marker** (`src/descfit.js`), and it means: *this description was cut to fit
the ERP's description field; the full text goes in the extended-text field*
(the amber **Ext** button beside it copies that second half). A partial
description that doesn't announce itself reads as a whole one — that is the
failure the marker exists to prevent.

Why this line can never avoid it at the current settings:

- The ERP description field is fitted to **30 characters** (Settings → Price
  book → "Desc limit", `settings.pricing.descLimit`).
- Per Marcus's own 8/26 decision (issue 110 #4), **SKU + coverage are pinned**
  — they never drop and never clip. `CLNL289 1.06 SF/SH` is 18 characters;
  with the marker and spacing that leaves **9 characters** for everything
  else.
- The body is the nominal size + name: `12x12" Glazzio Colonial Collection
  Long Hex Village Square` — the name alone is 51 characters. "Collection"
  and the brand drop first (110 #4), but what remains still can't fit 9
  characters, so the body clips at a word boundary to `12x12"` and wears the
  `+`.

Issue 110 recorded this exact consequence: *"Visible consequence at the
30-char default: more lines split … the trade Marcus chose."* Verified by
running the row's snapshot through the real `orderEntryRow` at limit 30 —
output `12x12" + CLNL289 1.06 SF/SH` (27/30, `over: 0`), full text
`12x12" Glazzio Colonial Collection Long Hex Village Square CLNL289 1.06
SF/SH` in the ext field.

## If the team wants fewer "+" lines

None of these is a code change; all are team-side knobs:

1. **Raise the desc limit** if the ERP field is actually wider than 30 —
   Settings → Price book → "Desc limit" (up to 200). At ~80 this line pastes
   whole, no split.
2. **Shorten the item's description** on the Glazzio book page (or wait for
   issue 086's approved per-item short descriptions) — a shorter name fits
   more of itself before the pins.
3. Paste-and-go as designed: description field from the copy button, extended
   text from **Ext** — the two halves together are the whole order line.

## No change made

Working as designed — the design being Marcus's own 8/26 rules. The central
Claude issue can be checked off in Issues → Claude.
