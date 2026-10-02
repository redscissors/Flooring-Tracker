---
issue_type: Bug
summary: Phone — picking from the bottom bar's Price book reopened the search
  with the picked SKU typed in; the pick needed a second tap or Cancel
status: done
labels: [ready-for-human]
---

# Phone: a Price book pick reopened the search

Owner, 2026-10-02: on the phone, selecting an item "doesn't just directly add it
to the project — it almost re-searches and you have to click it again or hit
cancel."

## Root cause

The bottom bar's Price book button opens the area's blank adder row's sheet with
`rowSheet.search = true`, which `MobileRowSheet` reads as `initialSearch` to
start in the full-screen search. A pick fills the blank adder, and App.jsx renders
a blank adder (a bare Fragment holding only the sheet) and a filled row (the row
div holding the sheet) differently. The element type changes, so React remounts
`MobileRowSheet`, and the remounted sheet re-read the still-set `search` flag.
The search opened again, seeded with the new SKU.

Only the Price book entry set the flag. "+ Product" followed by the sheet's own
Price book button never did, so that path worked.

## Fix

`initialSearch` is now a one-shot flag. Every way the search closes (pick, multi-pick,
by hand, vendor configurator, Cancel) calls `onSearchDone`, and App clears
`rowSheet.search`. A remount after the pick lands on the filled row with
Square feet focused.

## Proof

`repro.mjs` drives the real app at 344×820 (the Fold 5 cover screen) over a
stubbed Supabase with one stock book: Price book → "keystones" → tap the hit.

- `before/3-after-pick.png`: the search is back, holding "DKEYWH"
  (`RESULT: search REOPENED`, exit 1).
- `after/3-after-pick.png`: the row sheet with the line filled and Square
  feet focused (`RESULT: search closed after the pick`, exit 0).

Run it with `VITE_SUPABASE_URL=https://stub.supabase.co VITE_SUPABASE_ANON_KEY=stub
npx vite --port 5199` up, then `node repro.mjs` here (`OUT_DIR` for shots).
