---
issue_type: Enhancement
summary: "Owner 8/26 (follow-up to 110/112): an order description whose only
  losses are the deliberately-droppable words — the book brand, 'Collection' —
  is not a cut spec, so it pastes WITHOUT the '+' marker; the '+' now appears
  only when identifying text was actually cut. descfit soft parts + `cut`
  flag; panel's amber note counts only real cuts."
status: done
labels: [ready-for-human]
---

# Soft drops paste clean — the "+" only marks a real cut (owner, 8/26)

Follow-up to issues 110/112 on the Q-Glazzio CLNL289 line. The owner asked to
drop the "+" since "it is only showing because it dropped collection". That's
true at a wide field and false at a tight one, so the rule splits:

- **Only "Collection"/the brand lost → no "+"** (owner 2026-08-26). Those
  words were already ruled series typography, not identity (110 #4 / 092), so
  losing them doesn't make the field a partial spec. The marker's own two
  characters go back into the body, sometimes keeping one more word.
- **Identity text cut → the "+" stays** — Marcus's standing rule (the whole
  point of descfit): a partial spec that doesn't announce itself reads as a
  whole one. At a 30-char field the CLNL289 line still splits
  (`12x12" + CLNL289 1.06 SF/SH`) because the entire name is cut, not just
  Collection.

## What changed

1. **`src/descfit.js`** — parts take `soft: true`; the split rung first tries
   a marker-less fit that may drop only soft parts (least important first,
   the marked loop's order), rendering unmarked when the rest fits whole.
   The result now reports `cut` — true only on the marked split — beside
   tier/main/ext/full/over.
2. **`src/orderentry.js`** — the book-brand part (rank 3) and the
   "Collection" part (rank 4) are `soft`; everything else (Sheoga categories,
   vendor text, size) is identity as before.
3. **`src/orderentry.jsx`** — the footer's amber "the '+' means the rest is
   in Ext" note counts `desc.cut` lines only, so an unmarked soft-drop line
   (which still shows its paste chip + Ext button) no longer triggers it.
4. **`src/orderentrypreview.jsx`** — harness gains `?wide=1` (68-char field)
   so the preview shows both faces of the rule.

The CLNL289 line at the team's field width:

| Desc. field | pasted description |
|---|---|
| 30 | `12x12" + CLNL289 1.06 SF/SH` — name cut, marker stays |
| 68 | `12x12" Glazzio Colonial Long Hex Village Square CLNL289 1.06 SF/SH` — only Collection lost, **no +** |

## Verification

- `npm test` — 1134/1134 passing (new: soft-only drop renders unmarked with
  `cut:false`, identity cut keeps the marker with `cut:true`, softs drop
  least-important first; the 110 Collection pin updated to the new rule and
  extended with the marker-returns-at-56 case).
- `npx eslint` clean on every touched file.
- Preview proof (real OrderEntryPanel over real orderEntryRow):
  `preview-soft-drop-68.png` — CLNL289 pastes 66/68 with no "+", while the
  hand-entered Uptown line (a real cut at 68) keeps its "+" and is the one
  line the amber footer note counts; `preview-order-entry.png` — the 30-char
  panel unchanged, every genuinely cut line still marked.
