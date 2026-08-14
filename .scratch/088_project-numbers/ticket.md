# 088 — Project numbers (N100)

Status: done
Labels: ready-for-human

Every real-named project gets a permanent N-number (N100, N101…), claimed
atomically from a Postgres sequence the first time a person types a name —
the "New Project" default and quick auto-names never claim. Shown as a quiet
corner label in the header's Project box (both layouts) and in the printed
sheet's top-right corner, which also picked up its approved restyle: the title
**Selection Sheet** became **Flooring & Tile** stacked over **Selections** (one
size up), with the number and date beneath, and the salesperson column's phone
and email on their own lines. The order sheet's header line leads with the
number.

Decided in `docs/superpowers/specs/2026-08-14-project-numbers-design.md` off
the prototype `.scratch/mockups/project-numbers-2026-08-14.html`; plan at
`docs/superpowers/plans/2026-08-14-project-numbers.md`.

**Owner action required:** run `supabase/project-numbers.sql` once in the
dashboard (column + backfill of existing named projects oldest-first from
N100 + claim RPC). Until then the app runs numberless, by design.

Preview proof — `preview.html`/`preview.jsx` render the REAL `EstimatePaper`
over fixture jobs through the real math (085's harness pattern); `shot.mjs`
shoots them off `npx vite --port 5199` in screen and print media:

- `numbered-print.png` / `numbered-screen.png` — N214 corner, stacked title,
  stacked salesperson (name / phone / email)
- `unnumbered-print.png` / `unnumbered-screen.png` — no number: title + date
  alone, exactly like today minus the rename
- `header-n214.png` — the REAL ProjectHeaderBar (header-preview.html harness),
  N214 right of PROJECT in the same box
