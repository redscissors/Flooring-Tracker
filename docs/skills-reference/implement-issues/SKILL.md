---
name: implement-issues
description: Autonomously implement one or more issues end-to-end by orchestrating subagents — an implementer (/code), a reviewer (/agent-code-review), and a correctness-and-scope verifier — looping until each issue passes a clean review, then committing it.
disable-model-invocation: true
---

# Implement Issues

You are the **orchestrator**. You drive the implementation of one or more issues; you do **not** write code or review diffs yourself. All implementation, review, and verification happens in fresh subagents you spawn. Your job is to drive the loop, thread state between agents, enforce the guards, commit finished work, and escalate genuine blockers.

The subagents cannot see each other's context. The **working tree + git** is their shared medium: the implementer edits files, the reviewer and verifier read `git diff HEAD`. You pass everything else through the prompts you write for each agent.

<what-to-do>

## Input

`/implement-issues` accepts the same input shapes as `/code`:

- **Explicit issue-file path** — `/implement-issues .scratch/002_add-csv-export/01-add-endpoint.md`.
- **Issue references** — `/implement-issues implement issues 1, 2, 3 of add-csv-export`. Match the group by the slug part of its `NNN_<slug>` directory name, then resolve `NN-*.md` files within it.
- **Group only** — `/implement-issues implement add-csv-export`. Every issue file in the matching group directory.
- **Prose task** — `/implement-issues add a logout button`. No issue files; treat the prompt as a single chunk of work.

When the input resolves to issue files:

1. Read each resolved file. Skip any already at `Status: done`.
2. Check `## Blocked by` on each. If a selected issue is blocked by one not in the set (and not already `done`), surface that and ask how to proceed before starting.
3. Order: the order the dev specified, then by `Blocked by` dependencies, then numerically.
4. If the group directory doesn't exist or is empty, bail out and tell the dev to run `/to-issues <slug>` first.

## Setup (once, before the first issue)

- Determine the review base. Prior issues you finish are committed, so each issue's review scope is the **uncommitted** working tree: `git diff HEAD`. Confirm the working tree is clean before starting; if it has unrelated uncommitted changes, stop and tell the dev — you can't cleanly scope per-issue reviews otherwise.
- If the current branch is `master`, create a feature branch first (you commit per issue).
- Record the run's **starting commit** (`git rev-parse HEAD`) before any work. The final review hand-off scopes to this commit so it covers only the commits this run produced, not the whole branch.
- Create the run-log directory `.scratch/<group>/.implement-issues/` lazily on first write.

## The per-issue loop

Process issues **sequentially** on the current branch. For each issue, run the round loop below until it passes clean or a guard trips, then commit it and move to the next.

```
round = 1
fixList = []            # surviving findings to fix; empty on round 1
history = []            # findings seen in prior rounds, for resurfacing detection

loop:
  implementer  → edits working tree
  reviewer     → findings (severity + confidence)
  verifier     → surviving findings (drop only breakage/scaffolding)  ← the next fixList

  if surviving == empty:        → issue PASSES, break
  if round >= 4:                → guard trip, escalate to dev, break
  if surviving ⊆ history:       → resurfacing guard, escalate to dev, break
  history += surviving
  fixList = surviving
  round += 1
```

### Step 1 — Implementer (fresh subagent)

Spawn a `general-purpose` agent (it needs `Skill`, `Bash`, `Edit`, `Read`, `Write`).

- **Round 1** — instruct it to run `/code <issue-file-path>` (or the prose task) to completion. It implements, verifies acceptance criteria, and stages changes per `/code`'s contract. It must **not** commit and must **not** set `Status: done` — you own those.
- **Fix rounds (round > 1)** — do _not_ re-run `/code`. Instruct it to make exactly the changes in the fix list and nothing more: "Apply these N review fixes to the working tree. Stay surgical — change only what each finding requires; do not refactor or implement anything outside this list." Pass each surviving finding with its `file:line` and required change.

Tell every implementer agent:

- Resolve **defaultable** assumptions yourself using existing code and `./docs/` — do not stop to ask. Record each assumption you made in your final summary so it can be scrutinized in review.
- If you hit a **true blocker** — an open product/design decision that cannot be defaulted from code or docs — do **not** guess. Stop, leave the working tree as-is, and return `BLOCKED: <the decision needed, with the options you see>`.

Its final message back to you should be: files touched, a one-paragraph summary of what changed, and the list of assumptions made (or a `BLOCKED:` line).

**If the implementer returns `BLOCKED:`** — park this issue. Record the blocker in the run log, surface it to the dev, and move on to the next issue. Return to parked issues at the end.

### Step 2 — Reviewer (fresh subagent)

Spawn a `general-purpose` agent. Instruct it to run `/agent-code-review` scoped to the **uncommitted** changes only (`git diff HEAD`), not the whole branch. Have it return its Stage 2 findings as a structured list, each with: `id`, `file:line`, `category`, `severity` (high/med/low), `confidence` (high/med/low), and a one-line description of the problem + suggested remedy.

If it returns no findings, treat the surviving list as empty and pass the issue.

### Step 3 — Verifier (fresh subagent)

Spawn a `general-purpose` agent. Give it the reviewer's findings list **and** tell it the diff is at `git diff HEAD`. Its job is to guard two things only — correctness and scope — not to second-guess whether a cleanup is "worth it":

> For each finding, read the actual code. **Keep** it — promote it to the fix list — if applying the suggested change would fix a real bug, improve correctness, or make the code cleaner, simpler, or more maintainable. **Drop** it only when one of these is true: (a) the suggested fix would break working behavior, introduce a bug, or regress correctness; or (b) the change is scaffolding for a later issue in this set — code that's intentionally incomplete now because a subsequent issue builds on it. Do not drop a finding just because it's low-severity, minor, or you're unsure it's worth the churn — when in doubt, keep it. Only your two drop criteria remove a finding.

When evaluating criterion (b), use the list of remaining issues in this set (pass it the slugs/titles of the not-yet-implemented issues so it can recognize scaffolding).

It returns the **surviving** findings (everything kept), each with `file:line` and the concrete change required — this becomes the next round's fix list.

### Termination

- **Surviving list empty** → the issue passed. Proceed to commit.
- **Round cap (4)** → stop looping, record the still-open findings in the run log, surface them to the dev as "needs human attention", and do **not** commit this issue. Move on.
- **Resurfacing** → if every surviving finding this round already appeared in a prior round (the implementer isn't converging on them), stop, record it, surface to the dev, do not commit, move on.

### Commit (only on a clean pass)

1. Set the issue file's `Status:` line to `done`.
2. Stage the implementation + the `Status` change.
3. Commit this issue **alone**, with a message describing the issue. End the message with the `Co-Authored-By` trailer per the repo's git rules.
4. Append the round-by-round outcome to the run log, then move to the next issue.

## Run log

For each issue, append to `.scratch/<group>/.implement-issues/<NN>-<slug>.log.md`: each round's implementer summary + assumptions, the reviewer's findings, the verifier's verdicts (kept/dropped + why), and the final outcome (committed / parked-blocked / needs-human). This is the audit trail and makes a paused run resumable.

## Final hand-off and summary

When all issues are processed, do the review hand-off first (only if everything landed), then give the dev the summary.

### Review hand-off (only when every issue committed cleanly)

If — and only if — every selected issue passed and was committed (none parked as `BLOCKED:`, none stopped at the round cap or the resurfacing guard), run `/human-review` as the last step, scoped to **only the commits this run made**:

- Spawn a `general-purpose` agent and tell it to run `/human-review` using the run's **starting commit** (recorded in setup) as the diff base — i.e. diff `<start-sha>...HEAD`, not against `master` — so the checklist covers exactly the commits this run produced.
- Relay the review-file path it reports back to the dev **verbatim**, so they can open it and start reviewing right away.

If any issue did not land cleanly, skip the automatic review. Say so in the summary, and note the dev can ask for a checklist over just the successful commits.

### Summary

Give the dev a compact report covering:

- **Outcome table** — one row per issue: rounds taken, outcome (committed / blocked / needs-human), and the commit SHA for the ones that landed.
- **Autonomous decisions** — the assumptions the implementer agents resolved on their own, pulled from the run log and grouped by issue. This is the part the dev most needs: it's every choice they _weren't_ asked about, so it's what they should sanity-check first.
- **Blockers and unfinished work** — any parked `BLOCKED:` decisions (with the options the agent saw) and any issue that hit the round cap or resurfacing guard, with the still-open findings.
- **Review hand-off** — the `/human-review` file path if one was generated, or why it was skipped.
- A pointer to each issue's run log under `.scratch/<group>/.implement-issues/` for full detail.

Be honest — if an issue hit the round cap with open findings, say so plainly; don't imply it's done.

## Guardrails

- You never edit code or run the review skills yourself — always through a subagent. Your only direct writes are the `Status` line, commits, and the run log.
- One issue at a time, one commit per issue. Never batch issues into a commit.
- Never commit an issue that didn't pass a clean verifier round.
- Spawn agents for independent issues sequentially, not in parallel — they share one working tree.

</what-to-do>
