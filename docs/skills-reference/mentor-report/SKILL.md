---
name: mentor-report
description: Generate the dev-local growth report (a self-contained HTML page) from the developer model, evidence log, profile, and open escalations — then optionally walk a trusted-senior dev through resolving the open "worth a senior's eye" items one at a time. Report generation is pure read; resolution writes shared truth (rule/ADR edits, concept merges, recorded rulings) but never the dev's own competency model. Use when the dev asks for their growth report / mentor report, or wants to work the open-escalations queue.
---

# /mentor-report — the growth report, and the senior's resolution pass

Two halves, strictly ordered:

1. **Generate the report** — a pure read; nothing is written anywhere.
2. **Offer the resolution pass** — only if open escalations exist, only behind
   one trust-gate confirmation.

## The firewall (never cross it)

This skill **never calls `update_model`** — under any circumstances, in either
half. The dev never writes their own competency model. Writes this skill may
make, all shared-truth, all during the resolution pass only:

- `resolve_escalation` — record a ruling;
- `merge_concepts` — collapse two registry keys, on a `merged` ruling;
- direct repo edits to `docs/tools/rules/custom-rules.md` and its `ref`'d
  ADR/doc, on an `accepted` rule proposal (git-reversible).

A ruling whose consequence touches the dev's own model — revoking credit for a
lesson ruled wrong, demoting a level, setting a re-teach `Next` — is recorded
on the escalation as `consequence_pending` and applied later by the
**assessor** on the `/mentor-end` pass. If you find yourself reaching for
`update_model` here, stop: you're crossing the firewall.

The report is **dev-local**: no PM or senior read path exists. The dev shares
it themselves, or not at all. Never surface or forward it on anyone else's
behalf.

---

## Half 1 — generate the report

### Reads (all of them, nothing else persisted)

| Tool | What it feeds |
|---|---|
| `read_profile` | Hero chips: years, stack, roles, domain. **Descriptive context only — never scored**; no competency level may be derived from or displayed for profile data. Profile `probe_targets`/`gaps` feed the "still unprobed" follow-up item. |
| `did_vs_carried_report` | The per-concept owned/assisted/carried projection and verdict totals — the at-a-glance tiles, the verdict bar, and the under-credit flags. **Do not rebuild this rollup** from the raw log; the projection already lives in `did-vs-carried-report.js`. |
| `read_model` | Per-concept level, confidence, evidence ledger, gap, next — the in-focus cards and the board rows. |
| `read_concepts` | Glosses for card subtitles and board notes. |
| `read_escalations({ status: 'open' })` | The "worth a senior's eye" section. |

Verdicts shown are always the **assessor's `did_verdict`s** (via
`did_vs_carried_report`) — never the mentor's in-the-moment `self_tag`s.

### Rendering

Render one **self-contained HTML file** (inline CSS, no external assets) to
the dev-local data area **outside the repo** — `../.mentor-data/` relative to
the main checkout root, e.g. `../.mentor-data/growth-report-<date>.html` —
and tell the dev the path. Never write it inside the repo; it is a private
growth record, not a project artifact.

`template.html` (in this skill's directory) is the **approved visual spec**.
Read it before rendering, then reuse its CSS and section structure verbatim and
replace every piece of content with live store data. The list below is the
*content* each section must carry — the markup and styling come from
`template.html`, so follow the file for those. Its sections, in order:

1. **Hero** — title, the "this is a map, not a grade" framing, generated-date
   chip, profile chips.
2. **At a glance** — four stat tiles: concepts tracked (split by axis),
   confirmed count, in-active-growth count, carried count.
3. **Verdict bar** — owned/assisted/carried proportions from the report
   totals, with the legend.
4. **In focus** — one card per concept that has earned a close look
   (confirmed on real work, recently promoted/demoted, under-credited, or the
   clearest growth edge — spotlight that one). Each card: concept key, gloss,
   confidence + verdict pills, the 4-pip level ladder
   (developing → competent → proficient → advanced), the gap, the evidence
   ledger chips (`<task> <verdict> · <date>`), and the `Next` line.
5. **The rest of the board** — compact rows for the remaining concepts,
   grouped by axis, with level and a one-line note.
6. **The story behind the numbers** — at most two narrative spotlights (a
   standout win, where to invest next), only when the data genuinely supports
   them; omit the section rather than pad it.
7. **Worth a senior's eye** — one expandable `details` block per **open**
   escalation, from its stored fields: the type as the tag line, `summary` as
   the overview, `detail` as the body (it carries the adjudication content,
   both readings, and the question to rule on), `source`/`created` in the
   footer line. **Empty state:** when there are no open escalations, render
   the section with a single quiet line ("Nothing is waiting on a human —
   the assessor settled everything it raised.") — never leave stale or sample
   content.
8. **Flags & follow-ups** — under-credited/unresolved concepts (from the
   report's flags and `Next` fields), doc candidates, and still-unprobed
   profile areas.
9. **Footer** — the private-and-dev-local lock line and the
   assessor-verdicts-only provenance note.

Bind every number and every card to live data; nothing from the template's
sample content may survive into the output. No new projection tool may be
added to the MCP for this — rendering is this skill's job.

### If there are no open escalations

Present the report path, point out anything notable (a promotion, a new flag),
and stop there. A pure-read session makes no writes and doesn't invoke
`/mentor-end` — the assessor has nothing to consume.

---

## Half 2 — the resolution pass (open escalations only)

If open escalations exist, offer to work through them. The dev may decline —
the report stands alone, and unruled items stay `open` indefinitely.

### One trust gate, once

Before the **first** resolution — not per item — confirm, in plain language:
resolving writes **shared truth** (rules, ADRs, the concept registry) and
assumes a **senior's authority**. The dev must confirm they are a senior, or
are working with one looking over their shoulder. Record the answer and carry
it as the `by` marker on every ruling this session (e.g. `Eddie (senior)` or
`Jordan, supervised by Eddie`). Decline → no resolutions; the report session
ends as pure-read.

### One at a time

Walk the open items one at a time — present the escalation's `detail` (the
adjudication content the assessor prepared), take the ruling, apply the
action, confirm what was written, advance. One item, one decision, one
confirmation; never batch. The dev can stop at any point; whatever is unruled
stays `open` for a later session.

Per-type actions:

- **`rule_proposal`** —
  - *Accept*: apply the drafted change from the escalation's `detail` — the
    `custom-rules.md` entry **and** its `ref`'d ADR/doc — **together, in one
    combined change** (the combined-diff invariant: the rule owns the check,
    the ADR owns the why, they never drift apart). Then
    `resolve_escalation({ id, outcome: 'accepted', ruling, by })`.
  - *Reject*: `resolve_escalation({ id, outcome: 'rejected', ruling, by })`,
    with the ruling **naming the follow-on** (usually fix-the-code).
    Record-only: never create the fix issue, branch, or rule yourself — a
    human starts follow-on work deliberately.
- **`registry_candidate`** —
  - *Merge*: `merge_concepts({ from, into })` (the senior picks which key
    survives), then `resolve_escalation({ id, outcome: 'merged', ruling, by })`.
    The merged row is stale until the next assessor pass rebuilds it — say so.
  - *Keep*: `resolve_escalation({ id, outcome: 'kept', ruling, by })` with why
    the distinction is real.
- **`dispute`** —
  `resolve_escalation({ id, outcome: 'ruled', ruling: <the is-vs-ought call>, by, grounding })`.
  The ruling may **name** the winning position as a candidate convention, but
  never auto-codify it — a new rule starts its own deliberate path.
- **`correctness_residue`** —
  - *Sound*: `resolve_escalation({ id, outcome: 'sound', ruling, by, grounding })`.
  - *Wrong*: `resolve_escalation({ id, outcome: 'wrong', ruling, by, grounding,
    consequence_pending: <the owed model write — e.g. "revoke owned credit on
    <concept>; set re-teach Next"> })`. Tell the dev plainly: the lesson is
    recorded wrong now; the model consequence lands on the next assessor pass,
    not here.

### Exit

- **≥ 1 ruling made** → invoke `/mentor-end`: the assessor consumes the
  resolved escalations, applies and clears any `consequence_pending`, and
  rebuilds merged rows from the unified ledger.
- **No rulings** → no handoff.
- Either way, leave the report as-is; the dev re-runs
  `/mentor-report` when they want a fresh one.
