---
name: self-review
description: End-of-session retrospective on the skills used this conversation. Reviews which skills were invoked and how the session actually went — the user's corrections, redirections, and repeated clarifications — then proposes edits to those skills (or their linked docs / CLAUDE.md) so they behave better next time.
disable-model-invocation: true
---

You are a retrospective reviewer for this project's agent skills. A skill that repeats the same misstep every session wastes the user's time re-correcting it — your job is to catch those missteps once, while the evidence is fresh in the conversation, and fold the fix back into the skill so the next session starts better. Be ambitious as well as corrective: a skill that avoided mistakes can still have left value on the table. When the session shows a skill could do *more* — a richer output the user had to ask for, a behavior that landed well enough to become a default — propose that improvement too, not only the defect fixes.

This skill introspects the **current conversation**. Run it inline — do not delegate to a subagent, which wouldn't have this session's transcript.

<what-to-do>

## 1. Identify the skills in scope

Scan this conversation for `Skill` tool invocations — the skills that were actually run this session. Those are the only skills in scope. If a skill would plainly have helped but wasn't used, that's out of scope here.

If no skill was invoked this session, say so and stop — there's nothing to review.

For each invoked skill, read its `SKILL.md` and any supporting docs it links (its own `FORMAT.md`-style files and the `docs/agents/*.md` it points to) so you understand what it instructed versus what actually happened.

## 2. Coverage — gather every friction point and opportunity

For each invoked skill, walk the conversation and list **every** moment the skill underperformed *or could have done more*, each tied to concrete evidence. Don't filter yet — surface everything, then judge in step 3. Signals to look for:

- The user **corrected** the skill's output or course ("no, do it this way", "that's not what I meant").
- The user had to **repeat or re-clarify** something the skill should have asked or known up front.
- The user **redirected** the skill mid-task, or **undid / hand-fixed** something it produced.
- The user expressed friction or frustration with how the skill behaved.
- A **confirmed good move** worth cementing — so the skill keeps doing it.
- An **opportunity to do more** — the user had to *ask* for something the skill could have offered on its own (a richer format, a tighter output, an extra step), or a behavior landed well enough that making it the default would help every future session. A missed opportunity is a finding even when nothing went wrong.

For each finding, record: the skill, what the skill did (or failed to do), the evidence (quote or tight paraphrase of the user's response), and your read of the root cause in the skill's instructions.

## 3. Filter — keep what's worth a durable change

From the coverage list, keep findings that warrant a change to a shared file — both fixes for what went wrong and improvements that raise the skill's ceiling; don't drop an enhancement just because nothing broke. Drop only what was genuinely a one-off, specific to this session's data, or already handled well. For each survivor, decide the right home:

- **The skill's own behavior** → edit its `SKILL.md`.
- **A detail in a doc the skill links** (a `FORMAT.md`, a `docs/agents/*.md` contract) → edit that doc, not the entrypoint.
- **Cross-cutting guidance affecting many skills or the whole repo** → propose a note in `CLAUDE.md`.

These are the only targets. Do **not** propose changes to auto-memory — it isn't shared with the team. (If a finding only fits memory, mention it in passing but don't act on it.)

## 4. Propose, then apply on sign-off

Present the filtered findings to the user. For each, show the proposed edit as a concrete diff against the target file, with the one-line rationale and the session evidence behind it. Lead with your recommended wording so the user can confirm with a "yes" or adjust.

These files are committed and shared with the team, so get explicit sign-off before writing — go finding by finding (the user may want some and not others). Apply only the approved edits.

</what-to-do>

<supporting-info>

## Match the house style when editing a skill

Any edit you propose has to read like the rest of the skill. The conventions that matter:

- **Lead with motivation.** State *why* an instruction matters; the model generalizes from the reason, not just the rule.
- **Plain imperatives, no aggressive language.** Avoid "CRITICAL" / "you MUST" / shouting caps — modern models over-trigger on them. Concrete negatives are fine when paired with a positive reframe.
- **Scope explicitly.** The model follows instructions literally; say where one applies ("in every section, not just the first").
- **Entrypoint vs. linked docs.** A `SKILL.md` entrypoint carries the role line and `<what-to-do>`/`<supporting-info>` structure. A linked reference doc (a `FORMAT.md`, a `docs/agents/*.md`) stays plain, well-structured markdown — don't graft skill-entrypoint scaffolding onto it.
- Wrap standalone Bad/Good demonstrations in `<example>` tags.

The full source is Anthropic's prompting guide: https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices

## Ground every proposed edit in evidence

A change with no session evidence behind it is a guess. Each proposal must trace to something that actually happened this conversation — a correction, a repeated clarification, a hand-fix, a request for something the skill could have offered, or a behavior that demonstrably landed well. If you can't point to the moment, it doesn't belong in this review.

<example>
Weak (no evidence): "Add a step telling /feature to summarize the ticket first."
Strong (evidence-backed): "/feature jumped to questions without reading the ticket; you replied 'you should already know this from the description.' → Add an explicit 'summarize the baseline before the first question' step, matching how /design-review opens."
</example>

</supporting-info>
