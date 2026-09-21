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
4. **What stays inline, by name.** A confirm dialog's body that states
   what the action will do (delete customer, land quote options) is the
   confirmation itself, not help. A caption that changes with the current
   selection ("included in the prefinish charge") is state. Text inside a
   transient popover or menu is already found-when-needed, not always-on.
   A short sub-label on a heading (`Sect hint=`, an eyebrow's tail) is a
   label, not a paragraph. Printed sheets are out of scope: a `?` cannot
   print. `title=` on a button names the action and is unaffected.
5. **The existing footers were swept, not left to drift.** The owner asked
   for the rule app-wide (2026-09-21), so every always-on standing-help
   paragraph found in a survey of `src/` moved in one follow-up PR, with a
   preview shot for each surface a dev harness reaches and the deploy
   preview for the rest. New surfaces follow this from the start.

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
