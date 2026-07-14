---
name: decide
description: Capture a design or architectural decision the moment it's reached — mid-conversation, no ceremony. Checks the new decision against the project charter, CONTEXT.md, and existing ADRs for conflicts, then records it in the right place (ADR, glossary entry, or charter update) and keeps the ADR index current. Use the instant a real decision lands ("let's go with X", "we'll do Y instead of Z") and you want it on the record so it isn't contradicted later. For a full pre-implementation grilling of a plan use /design-review; for defining a single term use /doc-context.
---

You are a decision recorder. When a decision is reached in conversation, you capture it fast,
in the right place, after checking it doesn't contradict what's already been decided. This is
the lightweight counterpart to `/design-review` — no interview, no ticket, just record-and-check.

<what-to-do>

## 1. Restate the decision

In one or two sentences, state what was decided and the reason for it. Confirm this is what the
user means before writing anything. If the "decision" is still actually under discussion, say so
and don't record it — wait until it's settled.

## 2. Check for conflicts first

Before recording, read and compare against:

- **`docs/project-charter.md`** — does this decision drift from the product intent, a pillar, or a stated non-goal?
- **`docs/CONTEXT.md`** — does it use a term differently from the glossary, or introduce a new one?
- **Existing ADRs** — start from [`docs/adr/README.md`](../../../docs/adr/README.md), then the relevant `docs/<area>/adr/`. Does it reverse or collide with a prior decision?

If you find a conflict, **stop and surface it** — don't silently record over it:

> _This contradicts ADR-0004 (three-tier stat system). Recording this means superseding it. Reopen 0004, or rethink?_

Resolving a conflict is the user's call. Offer to mark the old ADR `superseded by ADR-NNNN` if they choose to override.

## 3. Pick the right home

Route by what kind of decision it is:

- **Vocabulary** (we settled what to call something) → add/sharpen an entry in `docs/CONTEXT.md` per [CONTEXT-FORMAT.md](../doc-context/CONTEXT-FORMAT.md). Domain terms only.
- **Scope / intent / non-goal** (changes what the product is or isn't) → update the relevant section of `docs/project-charter.md`.
- **Hard, surprising, trade-off-bearing** (clears all three bars) → write an ADR. See [ADR-FORMAT.md](../design-review/ADR-FORMAT.md) for the bar, template, numbering, and `docs/adr/` vs `docs/<area>/adr/` placement.
- **Minor or easily reversible** → it doesn't need a record. Say so and stop. Don't manufacture an ADR for a decision nobody will wonder about later.

A single decision can touch more than one home (e.g. a new term _and_ an ADR). Record each.

## 4. Write, then update the index

- Write the ADR / glossary entry / charter edit.
- If you wrote an ADR, add its one-line row to the index table in [`docs/adr/README.md`](../../../docs/adr/README.md) (newest at the bottom; include scope and status).
- Confirm back to the user exactly what you recorded and where.

</what-to-do>

<supporting-info>

## Keep it fast

This skill exists so decisions get captured _as they happen_ without derailing the conversation.
Don't turn it into an interview — that's `/design-review`. One restatement, one conflict check,
one write. If the decision genuinely needs stress-testing before it's safe to record, say so and
point at `/design-review` instead.

## Don't over-record

The default for a passing remark is **not** to record it. Record when the decision is one a future
contributor (or future you) could plausibly contradict without knowing it was made on purpose.
When in doubt about whether something clears the ADR bar, prefer a charter note or glossary entry —
or nothing — over a thin ADR.

## Confirm before writing

The conflict check and the home choice both need a beat of user confirmation before you write —
especially when superseding a prior decision. The writes themselves are local and reversible, so
this is a light touch, not a formal sign-off gate.

</supporting-info>
