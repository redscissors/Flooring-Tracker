---
name: mentor-end
description: The single owner of the end-of-session assessor spawn for the mentor program. Gathers the three artifacts (evidence-log path, git diff, session id) and spawns the independent assessor as a fresh subagent — artifacts only, never live context. Delegated to by /mentor at wrap-up and by /mentor-report after a resolution session; also standalone-runnable when an assessor pass is owed (a session that ended without wrap-up, or resolved escalations carrying a pending model consequence).
---

# /mentor-end — spawn the independent assessor

`/mentor-end` owns the **end-of-session assessor spawn** — the one place it
happens. `/mentor` delegates here at task wrap-up; `/mentor-report` delegates
here after a resolution session; and it runs standalone when a pass is owed
(a mentored session that ended without wrap-up, or resolved escalations
carrying a `consequence_pending` that hasn't been applied yet).

The spawn **is the firewall** (item 14): the assessor did none of the teaching
and must not inherit the mentor's live conversation context, so it runs as a
fresh subagent handed only artifacts. Owning the spawn in one skill keeps that
structural no matter which flow triggers it.

## When to skip

A **pure-read `/mentor-report` session** — the report rendered, no escalations
were ruled on — owes no assessor pass: nothing new was logged and no
consequence is pending. When delegated to from such a session, do **not**
spawn; say nothing beyond confirming the report session is closed. (The
delegating skill should not call `/mentor-end` in that case at all; this is
the backstop.)

## Gather the three artifacts

1. **The evidence-log path** — the dev-model-store's per-project
   `evidence-log.md` (the assessor reads it via
   `mcp__dev-model-store__read_evidence_log`; the path is orientation, not a
   file you parse).
2. **The git diff** — the session's resulting code. A pure design or
   reasoning session produces **no** diff; spawn anyway with an empty diff and
   let the assessor verdict from the evidence log and transcript spans.
3. **The mentor session's `session_id`** — so the assessor can dereference
   `raw_ref` transcript spans where a risk flag warrants it. When invoked from
   `/mentor`, that's the current session's id. Standalone, ask the dev for it
   or pull it off the latest evidence-log records' `raw_ref`s; if it can't be
   recovered, say so — the assessor will under-credit flagged exchanges it
   cannot verify.

Hand the assessor **nothing else**. No summary of how the session went, no
opinion on what the dev owned, no conversation excerpts — those are exactly
the contamination the firewall exists to block.

## Spawn

Spawn the assessor as a fresh subagent whose instructions are
`.claude/skills/mentor/assessor.md`, passing the three artifacts above. The
assessor:

- applies any deferred consequences from resolved escalations
  (`consequence_pending`) and clears them — this runs even when the session's
  own log is thin, which is why a post-resolution `/mentor-report` session
  routes through here;
- re-derives `did_verdict`s, audits correctness, and writes the developer
  model (private, ungated) via `update_model`;
- raises anything it cannot settle as **escalations**
  (`create_escalation`) — they surface only in `/mentor-report`, never on a
  PR.

## Surface the wrap-up

Relay the assessor's terse wrap-up to the dev: what was written to the model,
what was flagged unresolved, any promotions/demotions, any deferred
consequences applied, and any new escalations now waiting in
`/mentor-report`. Plain language about what changed and what needs a human's
eye — no internal mechanics.
