# ADR 0045 — Standing help lives behind a `?` HelpTip on the heading, never as inline paragraphs; state and warnings stay inline

- **Status:** Accepted
- **Date:** 2026-09-21
- **Scope:** system-wide (every panel, workspace and popover; `HelpTip` in `src/widgets.jsx`)
- **Related:** the order-entry panel's per-section `?` (owner 2026-09-15, the first surface to follow this); the Samples panel (this ADR's trigger); `src/CLAUDE.md` `widgets.jsx` entry.

## Context

Surfaces had grown a habit of ending in a paragraph of fine print — how the
feature works, what to do after, what the team can see. The Samples panel
closed with "Samples ship straight to the customer - the email carries their
name and the project address. After sending, Mark all ordered; statuses are
shared…". True every day, read once, then in the way forever. The screen
already carries more real information than fits; the desk knows the tool
after the first week and keeps paying for the explanation anyway. The owner
asked for the samples footer to go and for the same treatment everywhere:
help you can find when you need it, not help you have to look past.

## Decision

1. **Standing help goes behind a `?`.** Text that is true every day and
   needs reading once — how a surface works, what happens after an action,
   who sees what — lives in a `HelpTip` (`src/widgets.jsx`: hover, keyboard
   focus and tap, so it works on the shop iPads) beside the surface's
   heading, or the section's heading when a surface has several. It is
   never an always-on paragraph, footer, or caption.
2. **State and warnings stay inline.** Text that reports what is true *right
   now* — an empty state, a missing address, no contact on file, ASSUMED
   quantities, price drift, an import hazard, a count of hidden rows — stays
   where it is. Hiding it hides the problem. The test: if the sentence would
   be identical on every project and every day, it is standing help; if it
   can disappear by fixing something, it is state.
3. **One `?` per heading, not per sentence.** The tip carries the whole
   rule set for that surface or section; a surface does not sprout a trail
   of question marks.
4. **Existing footers migrate as their surfaces are touched.** No sweep on
   its own: a standing-help paragraph moves into a `?` the next time a
   change already lands on that surface (with the usual preview proof). New
   surfaces follow this from the start.

## Consequences

- Less text on every screen; the sales desk sees data, not instructions.
- A first-time user has to notice the `?`. Accepted: it sits on the heading
  they read first, and the pattern repeats on every surface so it is
  learned once.
- `title=` tooltips on buttons (one-line labels for an action) are not
  affected — they name the action, they don't explain the feature.
- Reviewers can reject an always-on explanatory paragraph by citing this
  ADR; an author who believes a line is state, not help, argues it against
  rule 2's test.
