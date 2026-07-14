---
name: human-review
description: Turn the current branch's diff into a file-by-file Markdown checklist a human works through, then read the completed checklist, validate the notes, and propose next steps. Use for "prepare this branch for human review", "make me a review checklist", or "I'm done reviewing — read my notes".
argument-hint: "(optional) review-file path; otherwise derived from the current branch"
---

You prepare code Claude wrote or changed for a human to review, and then process what the human found. The point is to let a person check the work file-by-file without re-deriving the change themselves — so the checklist has to be ordered like a story and carry enough context to be useful, and their notes must survive untouched.

This skill has two phases. Pick the one the request calls for: phrasing like "prepare this branch" / "make a checklist" is Phase 1; "I'm done reviewing" / "read my notes" is Phase 2.

<what-to-do>

## Phase 1 — Prepare the review file

1. **Resolve the branch.** Get the current branch name. If HEAD is detached, stop and ask the user how to name the review file — the rest of this phase needs a name.

2. **Pick the base.** Use `master` if it exists, else `origin/master`. If neither resolves, ask the user for a base branch. All diffs use the three-dot form so the file covers only what this branch introduced since it diverged: `git diff --name-status <base>...HEAD`. Pull `--stat` (and `--numstat` if useful) to gauge size and risk.

3. **Read enough diff to write useful context — not a full review.** You need a factual branch summary, the high-risk areas, a suggested order, and a one-line review focus per file. Inspect individual diffs (`git diff <base>...HEAD -- <file>`) only as far as that requires. Do a deeper pass only if the user asks.

4. **Group and order for a human, not alphabetically.** Group by the reviewer's mental model — e.g. high-risk first, then app behavior, frontend UI, frontend services/state, backend API, shared types/models, DB/migrations, tests, config/build, docs, generated/lock files, deleted/renamed last. Adapt to what actually changed; skip empty groups. Within a group, order so the change reads as a story: entry points and containers first, then core logic, then supporting code, types, and tests. Keep an Angular component's `.ts/.html/.scss/.spec.ts` together, and a backend `module/controller/service/repository/spec` set together.

5. **Write the file** to `.scratch/human-reviews/<branch-slug>.md` (slug = the branch name lowercased with `/`, whitespace, and runs of punctuation collapsed to `-`, trimmed). It must list **every** path from `git diff --name-status` exactly once — added, modified, deleted, renamed, copied, generated, lock, config, test, and docs — each as a checkbox with a short review focus. Follow the structure and link rules in `<supporting-info>`.

6. **Never clobber human work.** If the target file already exists and contains checked boxes or notes, write a new file with a timestamp suffix (`<branch-slug>-<yyyymmdd-hhmm>.md`) instead and say which file you created. An untouched file may be regenerated in place.

7. **Report briefly:** the file path, base used, file count, the groups created, and any caveats (deleted files not linked, generated files, anything you couldn't link).

## Phase 2 — Process the completed review

1. **Find the file.** Use the path the user gives. Otherwise derive it from the current branch slug; if that exact file is missing, list `.scratch/human-reviews/` and take the most recently modified match. Ask only if still ambiguous.

2. **Read it fully** and extract: checked vs unchecked files, and every note the reviewer left under a file. A checked box with a note on it is not an approval; treat it as still open.

3. **Check for staleness.** Re-run `git diff --name-status <base>...HEAD` against the same base and compare to the files in the document. Call out, clearly, any files now unchanged, changed files missing from the review, or files added since it was generated.

4. **Lightly validate the findings.** For each note, correction, or question, judge whether it holds up against the current diff and code, note likely impact and any obvious risk, and group related ones. This is a first pass, note any comments that deserve more attention.

5. **Ask only what you must.** Pose a clarifying question only when answering it changes what you'd implement, and make it specific. Skip it otherwise.

6. **Offer concrete next steps and stop.** Summarize findings and any staleness warning, then offer options — draft a follow-up plan (step 7) or apply the corrections. Don't change code until the user picks implementation.

7. **When the follow-up-plan option is chosen, write it to `<review-file>-follow-up.md`** — the review file's path with a `-follow-up` suffix before the extension, alongside the review file. One entry per reviewer note (group only notes that share a fix). Each entry carries: the source file, the note verbatim, your validation verdict against the current code, and a planned action with a **Status** of `needs-review`, `planned`, or `no-op` (a no-op must give a rationale). Then **work the file iteratively with the user** — deepen the `needs-review` entries, fold in decisions, and re-save — until every entry resolves to `planned` or `no-op`. This file is the plan of record; don't change code until the user moves to implementation. Follow the structure in `<supporting-info>`.

</what-to-do>

<supporting-info>

## Be factual about intent

You're summarizing a diff, not narrating goals you can't see. Prefer "the diff adds…", "this appears to…" over asserting why the author did something. Keep per-file focus specific and short ("Review validation and error handling"), not generic filler.

## Review-file structure

```markdown
# Human Review: <branch-name>

Generated from diff against `<base>`.

- Base: `<base>` · Total changed files: <count> · This file: `.scratch/human-reviews/<branch-slug>.md`

## How to use this file

Check off each file as you review it (`[x]`). Add any notes under the file they relate to. When done, tell Claude **"I'm done reviewing."**

## Branch summary
<factual summary of what changed>

## Suggested review order
<one or two lines on why this order>

## High-risk areas
<list, or say none are obvious>

## Changed files

### <Group name>
<one line of group-level guidance if helpful>

- [ ] [`path/to/file.ts`](../../path/to/file.ts) — Modified. <review focus>

## Reviewer notes
<!-- general notes not tied to one file go below -->
```

## Follow-up-plan structure

Write to `<review-file>-follow-up.md`. Keep a status legend and a one-line progress count at the top so an at-a-glance read shows what's left. Order entries by theme, hardest/highest-blast-radius first.

```markdown
# Follow-up Plan: <branch-name>

Plan of record for the notes in [`<review-file-name>.md`](./<review-file-name>.md). Status: `needs-review` (still being worked) · `planned` (action agreed) · `no-op` (won't change, with reason).

- Progress: <n> planned · <n> no-op · <n> needs-review (of <total>)

## <Theme> 

### <short title> — `Status: needs-review`
- **File(s):** [`path`](../../path)
- **Note:** <reviewer note verbatim>
- **Verdict:** <does it hold up against current code; cite what you checked>
- **Action:** <concrete planned change, or why it's a no-op>
- **Open question:** <only if Status is needs-review>
```

## Linking and per-file lines

The file lives two directories deep (`.scratch/human-reviews/`), so links to repo files start with `../../`. Don't link a path that no longer exists.

<example>
- [ ] [`apps/.../app.routes.ts`](../../apps/.../app.routes.ts) — Modified. Review route changes and lazy-loading.
- [ ] `libs/old-feature/src/index.ts` — Deleted. Confirm this export is unused.
- [ ] [`new/path/file.ts`](../../new/path/file.ts) — Renamed from `old/path/file.ts`. Check imports were updated.

- [x] [`libs/.../pick-ticket.service.ts`](../../libs/.../pick-ticket.service.ts) — Modified. Review caching.

  Needs a test for undefined `customerId`.
</example>

</supporting-info>
