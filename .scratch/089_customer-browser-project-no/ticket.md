# 089 — Project # column in the customer browser

Status: done
Labels: ready-for-human

The project-numbers spec (`docs/superpowers/specs/2026-08-14-project-numbers-design.md`)
deferred two follow-ups: number search (shipped, PR #311) and the **directory
column**. This is the column.

- `custbrowser.js` — `projNos(projs)` returns a row's numbers in project order
  (browserRows hands them over newest edit first), N-form, unnumbered projects
  skipped; `projno` joins `BROWSER_COLS` as the first draggable column, right of
  the pinned Customer name.
- `CustomerBrowser.jsx` — the **Project #** cell, mono in the number's usual
  faint uniform, truncating with a `title` of the full list for a customer
  carrying more than three jobs. The column drags anywhere like the others and
  saves with the rest of the arrangement (`ui.browserCols`); a saved order from
  before this change appends it (normColOrder).
- The number also leads each project line in the customer's lines panel and in
  the Estimates & drafts strip — a row found by "N214" has to say *which* of the
  customer's jobs that is.

No stored shape changes, no SQL: `projectNo` already rides the boot's light
rows (`bootload.js` mirrors `project_no`). Until the owner runs
`supabase/project-numbers.sql` the column is simply empty, like the rest of the
number surfaces.

Preview proof — `preview.html`/`preview.jsx` render the REAL `CustomerBrowser`
over mock light rows (no Supabase); `shot.mjs` shoots them off
`npx vite --port 5199`:

- `grid.png` — the column as the folder opens (Kathy Marsh's three numbers,
  Amy Adams' unnumbered "New Project" contributing nothing)
- `lines-and-drafts.png` — numbers on the project lines and on the unassigned
  job in the Estimates & drafts strip
- `search-n214.png` — searching "214" narrows to the customer, the column and
  the lines panel showing which job it is
