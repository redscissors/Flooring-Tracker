Status: done

Declutter the option-print sheet (owner's annotated screenshot, 2026-08-07):

- Dropped the "The options / choose one option below" header row above the
  option bands — the colored bands introduce themselves.
- The band header's area list now prints only areas someone actually NAMED
  (owner follow-up 2026-08-07): "Kitchen · Mudroom" earns the header,
  placeholder "Area 01 · Area 02" labels say nothing and stay off.
- Dropped the band footer's left breakdown entirely (first pass kept a
  `materials $X` note; the owner's follow-up removed that too) — the footer
  is just the option total now.
- `whole job $X` beside an option total — and the closing grid's
  `incl. shared areas $X` caption — now print only when the shared bucket
  actually carries cost (`optionPrint.sharedT.grandTotal > 0`). With no shared
  areas the whole-job figure repeated the option total verbatim.

Preview proof — `preview.html`/`preview.jsx` render the REAL `EstimatePaper`
(`src/EstimatePrint.jsx`) over fixture jobs built through the real math
(`jobTotals`/`bucketCats`), mirroring App.jsx's `optionPrint`/`paperProps`
construction; `shot.mjs` shoots it off `npx vite --port 5199`. No Supabase.

- `print-1-options-no-shared.png` — options only, unnamed areas, no shared
  areas: no header row, no area list, no footer breakdown, no "whole job",
  and the closing cards drop the `incl. shared areas` caption.
- `print-2-options-with-shared.png` — named areas plus a shared Hallway area:
  "Kitchen · Mudroom" prints in each band header; `whole job` and
  `incl. shared areas` return.
