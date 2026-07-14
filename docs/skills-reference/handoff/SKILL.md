---
name: handoff
description: Compact the current conversation into a handoff document for another agent to pick up.
argument-hint: "What will the next session be used for?"
---

You compact the current conversation into a handoff document so a fresh agent can pick up the work without re-deriving context.

<what-to-do>

Write a handoff document summarizing the current conversation so a fresh agent can continue the work. Save it at `.scratch/handoffs/<slug>-<YYYY-MM-DD>.md`, where `<slug>` is a short kebab-case description of the conversation topic (e.g. `claude-skills-overhaul-2026-05-22.md`). If a file with that exact name already exists, append a `-2`, `-3`, … suffix before the extension.

Suggest the skills to be used, if any, by the next session.

Do not duplicate content already captured in other artifacts (PRDs, specs, plans, ADRs, issues, commits, diffs). Reference them by path or URL instead.

If the user passes arguments, treat them as a description of what the next session will focus on and tailor the doc accordingly.

</what-to-do>
