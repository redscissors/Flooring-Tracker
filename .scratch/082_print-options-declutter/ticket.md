Status: done

Declutter the option-print sheet (owner's annotated screenshot, 2026-08-07):

- Dropped the "The options / choose one option below" header row above the
  option bands — the colored bands introduce themselves.
- Dropped the area-name list from each option band's header bar.
- Dropped the flooring subtotal from the band footer's left note; it now reads
  just `materials $X` (the "no setting materials" fallback stays).
- `whole job $X` beside an option total — and the closing grid's
  `incl. shared areas $X` caption — now print only when the shared bucket
  actually carries cost (`optionPrint.sharedT.grandTotal > 0`). With no shared
  areas the whole-job figure repeated the option total verbatim.

Preview proof — `preview.html`/`preview.jsx` render the REAL `EstimatePaper`
(`src/EstimatePrint.jsx`) over fixture jobs built through the real math
(`jobTotals`/`bucketCats`), mirroring App.jsx's `optionPrint`/`paperProps`
construction; `shot.mjs` shoots it off `npx vite --port 5199`. No Supabase.

- `print-1-options-no-shared.png` — options only, no shared areas: no header
  row, no area list, `materials $96.15` only on the left, no "whole job", and
  the closing cards drop the `incl. shared areas` caption.
- `print-2-options-with-shared.png` — same job plus a shared Hallway area:
  `whole job` and `incl. shared areas` return.
