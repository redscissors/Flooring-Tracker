---
name: to-issues
description: Break a plan, spec, or PRD into independently-grabbable issues as local markdown files using tracer-bullet vertical slices. Use when user wants to convert a plan into issues, create implementation tickets, or break down work into issues.
disable-model-invocation: true
---

# To Issues

You are an issue slicer. You break a plan, spec, or PRD into independently-grabbable issues as local markdown files under `.scratch/` using tracer-bullet vertical slices.

<what-to-do>

Break a plan into independently-grabbable issues using vertical slices (tracer bullets).

Issue tracker conventions are in [`docs/agents/issue-tracker.md`](../../../docs/agents/issue-tracker.md). Triage label strings are in [`docs/agents/triage-labels.md`](../../../docs/agents/triage-labels.md).

## Process

### 1. Orient yourself

Follow [`docs/agents/skill-orientation.md`](../../../docs/agents/skill-orientation.md) to detect which input mode you're in. `/to-issues`-specific behaviour:

- **Output is always `.scratch/<group>/<NN>-<slug>.md` implementation-issue files.** `/to-issues` never writes a ticket body — only numbered implementation issues. The `<group>` segment is a kebab-case slug.
- **Mode 1 (markdown file path):** the file's contents are the source plan. If the file is a `.scratch/<group>/ticket.md`, use that group's directory for the issues; otherwise, derive a slug from the file's content and use it as the group.
- **Mode 2 (short description):** refuse with a nudge. A short description cannot be sliced into independently-implementable vertical issues — there has to be a baseline plan first. Tell the developer: "I can't slice a one-liner into implementation issues — run `/feature` or `/bug` first to get a proper plan, then come back to `/to-issues` against that ticket." Stop.

If the target directory already exists with files in it, surface that to the dev and ask whether to append (continue numbering from the next index) or pick a different group.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state of the code. Issue titles and descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

### 3. Draft vertical slices

Break the plan into **tracer bullet** issues. Each issue is a thin vertical slice that cuts through ALL integration layers end-to-end, NOT a horizontal slice of one layer.

Slices may be 'HITL' or 'AFK'. HITL slices require human interaction, such as an architectural decision or a design review. AFK slices can be implemented and merged without human interaction. Prefer AFK over HITL where possible.

<vertical-slice-rules>
- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Prefer many thin slices over few thick ones
</vertical-slice-rules>

<example>
Plan: "Add CSV export to the orders list."

Good — vertical tracer bullets, each demoable on its own:

- Slice 1: Export button on the orders page returns a hard-coded one-row CSV end-to-end (UI → endpoint → file download). Proves the whole path works.
- Slice 2: Real order data for the current filter flows into the CSV.
- Slice 3: Large exports stream instead of buffering in memory.

Bad — horizontal layers, none demoable alone and all must land before anything works:

- Slice 1: Add the CSV serializer.
- Slice 2: Add the export endpoint.
- Slice 3: Add the export button.
  </example>

### 4. Decide the breakdown

Make the calls yourself — don't interview the developer through every dimension. Per the [Decide what you can; only ask on genuine toss-ups](../../../docs/agents/skill-orientation.md#decide-what-you-can-only-ask-on-genuine-toss-ups) discipline, the granularity, the dependency relationships, the HITL/AFK marking, and the per-slice testing are all decisions you make from the spec and codebase. Settle each slice's:

- **Title**: short descriptive name
- **Type**: HITL / AFK
- **Blocked by**: which other slices (if any) must complete first
- **User stories covered**: which user stories this addresses (if the source material has them)
- **Unit tests**: what this slice needs and why (see **Unit-testing decisions** below)

Then write the issue files (step 5) — don't hold them behind a "does this slicing work?" approval gate. After they land, present the breakdown summary so the developer can review it against the files. Raise an explicit, focused question **only** where a call was a genuine toss-up: a slice that's defensibly one piece or two, a dependency that hinges on a sequencing preference only the developer holds. Don't re-ask the decisions the evidence already settled; the developer tweaks the written slices like any other local files.

#### Unit-testing decisions

Unit-testing decisions are made **here**, per slice — not in the ticket body (the spec deliberately doesn't carry them). For each slice that warrants tests, settle (from the spec and codebase — you decide, the developer reviews):

- **What makes a good test for this slice** — verify external behavior, not implementation details.
- **Which modules/units it covers** — favor the deep, isolated-testable modules the spec's Implementation Decisions sketched.
- **Prior art** — similar existing tests in the codebase to follow (framework, mocking, assertion style).

A slice may legitimately warrant no unit tests (pure config/glue) — record that and why. These decisions land in each issue's `## Unit testing` section (below), never in the parent ticket.

### 5. Publish the issues to the issue tracker

For each slice, write a new issue file using the template below at `.scratch/<group>/<NN>-<slug>.md` (e.g. `.scratch/002_add-csv-export/01-add-endpoint.md`). Number files from the next free index in the target directory. If `ticket.md` or earlier `NN-slug.md` files already live there, leave them alone — only this skill's new slices need writing.

Publish in dependency order (blockers first) so you can reference real filenames in the "Blocked by" field.

<issue-template>
Status: needs-triage

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation.

## Acceptance criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Unit testing

What to test for this slice and how. Good tests verify external behavior, not implementation details. Note which modules/units this slice should cover and any prior art in the codebase to follow (similar existing tests — framework, mocking, assertion style). Write "None — <reason>" only when the slice genuinely warrants no unit tests (e.g. pure config/glue).

## Blocked by

- A reference to the blocking issue filename (if any)

Or "None - can start immediately" if no blockers.

</issue-template>

Never modify the group's `ticket.md` — `/to-issues` only writes new implementation-issue files.

</what-to-do>
