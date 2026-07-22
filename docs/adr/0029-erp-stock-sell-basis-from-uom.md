# ADR 0029 — ERP stock exports: Unit of Stock names the sell basis; flooring type and width read from the description

- **Status:** Accepted
- **Date:** 2026-07-22
- **Scope:** area-scoped (Vendor SKU Analysis import parsing, `src/pricebook.js`)
- **Related:** extends ADR 0027 (ERP stock books replace the shop workbook);
  applies the ADR 0013 unit semantics to the single-U/M ERP exports;
  the description size-split rules build on ADR 0009 §3 / ADR 0014.

## Context

The retired shop workbook carried a flooring type per sheet (`Hardwood`,
`Vinyl`, `Tile` tabs), so its items filled real sqft lines ordering whole
cartons. The ERP "Vendor SKU Analysis" exports that replaced it (ADR 0027)
carry no type anywhere — every item imported with `type: null`, failed
`fillsFlooring`, and a pick landed as a per-piece misc count line quoting the
**carton** price per piece. SKU 28920 (`6" Mann AduraMax Plank … 27.39 sf/ct`,
Unit of Stock CT, retail $131.20/CT) quoted $131.20 per plank. The exports
also lead flooring descriptions with a bare plank width (`6"`, `2-1/4"`) that
stayed glued to the name — and the `1/4"` of a leading `2-1/4"` width was
misread as a thickness, leaving `2- Sheoga…` litter.

## Decision

1. **The Unit of Stock column names the sell basis.** A row sold by a
   coverage-bundling unit (CT/CTN/BX/CS/BL/BDL…) whose description carries
   real coverage (`… 27.39 sf/ct`, the ADR 0027 `sfFromDescription` pull) is
   flooring: it gets a type, so a pick fills a sqft line ordering whole
   cartons at the derived $/sqft (carton price ÷ SF/CT). EA/RL/GL/LF rows are
   never typed — accessories and trim sticks stay count lines.
2. **The flooring type is read from the description's wording** (mapping flag
   `typeFromDescription`, `floorTypeFromDescription`): vinyl words first
   (LVP names carry wood species — "AduraMax Noble Oak"), then laminate /
   carpet / tile / hardwood words. When no word decides, the size does: an
   L×W is tile-shaped unless plank-long (≥36"), and a bare width is how these
   sheets spell wood (Mirage, Sheoga, Riverwalk). A wrong guess between the
   wood-look types is cosmetic (same sqft math, no grout); the carve-outs
   keep the tile guess — the only one with material-math consequences — off
   plank-shaped rows.
3. **A leading bare width becomes the size** (mapping flag `leadWidthSize`):
   `6" Mann AduraMax Plank` → size `6"`, name `Mann AduraMax Plank…`. Gated to
   the ERP mapping because the vendor-sheet rule is the opposite (a bare `6"`
   with no shape word stays in the name — `SLATE 6" LEDGER`). A lookahead
   leaves a leading L×W (`1/4"x1/2"`, `3/16" x 1/4" x…`) to the L×W split, and
   consuming the whole mixed fraction stops the thickness regex from eating
   the `1/4"` of a `2-1/4"` width.
4. **A carton-sold row with no coverage in its text is named in the import
   warnings** ("N carton-sold rows carry no sf/ct in the description…") — it
   stays a count line quoting the carton price each, and the fix is editing
   the ERP description, not guessing coverage.

## Consequences

- Typing happens at parse time, so already-imported books keep `type: null`
  until their sheet is re-dropped (the normal refresh flow; re-import upserts
  changed rows).
- The keyword ladder is a heuristic over shop-known wording. It classified all
  66 carton rows across the five current exports correctly, but a new
  collection with no recognizable word and no size falls to untyped (count
  line) — visible, never mispriced.
- Saved estimates never change: rows snapshot at pick time (ADR 0003).
