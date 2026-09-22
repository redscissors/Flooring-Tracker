---
issue_type: Bug
summary: Glazzio Renaissance rows imported without their finish — the sheet
  prints "Polished" / "Matte" as a sub-heading above a run of rows, and the PDF
  parser discarded that line.
status: done
labels: [ready-for-human]
---

# Glazzio: Renaissance rows lose their Polished / Matte finish

Owner, 2026-09-22: "Glazzio price book, the Renaissance collection does not
say whether it is matte or polished. Looks like information is getting dropped
somewhere."

## Root cause

The 2026-09 Glazzio sheets print the finish as a lone word at the left margin
above a run of rows ("Polished", then "Matte"), not as a column. `parsePdfPages`
(`src/pdfbook.js`) reads only header rows, product rows and the collection title
above the header; the sub-heading line is none of those, so it was dropped and
nothing carried the finish onto the rows beneath it. Xenia (issue 145) looked
right only because its color names repeat the finish ("Neige Glossy");
Renaissance's names don't, so its polished and matte rows of one color imported
as identical rows.

## Fix

`src/pdfbook.js`: within a table section, a row whose whole text is a lone
finish word (`FINISH_RE`: polished / matte / glossy / honed / satin / textured /
brushed / lappato / natural …) is a finish sub-heading; each product row takes
the nearest one above it and appends it to the name — unless the name (or
description cell) already says that word, so Xenia's "Neige Glossy" does not
become "Neige Glossy Glossy" (owner's doubling concern, answered in the design
question). Takes effect on the next re-import of the Glazzio PDF; the changed
descriptions show in the wizard's diff review.

Tests (`src/pdfbook.test.js`): a Renaissance-shaped page yields "Renaissance
Calacatta Polished" / "… Calacatta Matte" for the two same-color rows; the Xenia
page's descriptions are unchanged.
