---
name: floortrack-research-methodology
description: The discipline that turns a hunch into an accepted change in FloorTrack — the observed idea lifecycle (field feedback → .scratch ticket → ADR/design review → sliced implementation → PR → docs + status flip), the house prototype protocol (throwaway multi-variant components behind a URL param, folded in same day, deleted, outcome recorded in .scratch/handoffs/), the evidence bar for accepting a result (predict first, one mechanism explains everything, adversarial refutation, measure never eyeball), and how ideas are retired (superseding ADRs, wontfix, recorded rejections). Load this when starting work on a new idea, feature request, or field-feedback report and unsure what process it should flow through; when asked "how do ideas become changes here", "should this be a ticket / ADR / prototype", "how do I run an experiment in this repo", "is this result trustworthy / done", or "how do I kill/retire an idea or decision". Not for the open-questions list itself (floortrack-research-frontier), merge gates for ordinary changes (floortrack-change-control, floortrack-validation-and-qa), or the analysis math (floortrack-proof-and-analysis-toolkit).
---

# FloorTrack research methodology

How an idea becomes an accepted change in this repo — extracted from what the repo
actually did (six shipped issues, four ADRs, two prototype rounds, one root-caused
production bug), not generic advice. FloorTrack is a live production tool
(`main` auto-deploys, real customers get quoted off it daily), so the method is
conservative: every idea leaves a written trail, experiments never touch `main` or
live data, and rejected ideas are recorded so nobody re-explores them.

Jargon, defined once:
- **Ticket** — a markdown issue file at `.scratch/NNN_<slug>/ticket.md` with YAML
  frontmatter (`issue_type`, `summary`, `status`, `labels`).
- **ADR** — Architecture Decision Record under `docs/adr/`, indexed in
  `docs/adr/README.md`. Records decisions that are hard to reverse or look wrong
  without context.
- **Handoff** — a short outcome memo in `.scratch/handoffs/`, the surviving record
  of a prototype or experiment after its code is deleted.
- **Slice** — one independently-shippable vertical piece of an issue, one commit each.

## 1. The idea lifecycle

Every shipped feature in this repo followed this pipeline. Route new ideas through
the same stages; skip a stage only when the table says it's optional.

| Stage | Artifact | Who/what produces it | Receipt in this repo |
|---|---|---|---|
| 1. Hunch / field feedback / request | verbatim words, captured | user or owner | issue 005 "Problem / Why" quotes the misreading; issue 006 quotes the owner |
| 2. Ticket | `.scratch/NNN_<slug>/ticket.md` | `/feature` interview (or `/to-issues` from a plan) | `.scratch/001_…` through `.scratch/006_…` |
| 3. Triage | `labels:` in ticket frontmatter | human/agent triage | canonical set (CLAUDE.md): `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix` |
| 4. Design decision | ADR via `/decide`, or full `/design-review` grilling | conversation with owner | tickets 001 & 002 carry `[Resolved in design review]` blocks; ADRs 0001–0004 |
| 5. Sliced implementation | numbered slice files, one commit per slice | `/to-issues` slicing, then implementation | issue 002: `01-…md`–`06-…md` → commits `7581ed2, e192f2e, 4a5ddba, 8bce5a6, e6bf9f3, 6eae9e9` |
| 6. PR | GitHub pull request | change control (never push to `main`) | e.g. PR #25 (`4398001`) merged issue 006 |
| 7. Close out | docs updated + ticket `status: done` | same session as the merge | issue 006 ticket: "CLAUDE.md updated (source layout, data model, feature note, conventions)" |
| 8. (Sometimes) Supersession | a NEW ADR retiring the old one | `/decide` | ADR 0001 → "Status: Superseded by ADR 0004" |

Stage-by-stage rules:

**Stage 1 → 2: capture the verbatim words.** The user's exact phrasing carries the
requirement. Issue 006 embeds the owner's request word-for-word ("hide the backup
and restore buttons inside the settings and replace them with an Issues/to do
button… drag them around to move the most important one to the top") — the shipped
feature is checkable against that sentence. Issue 005 preserves the user's
*misreading* ("the user read it as 'only 4 stairnose colors exist'"), which is what
revealed the real bug (a display cap + missing synonym, not missing data).
Paraphrase loses this. Quote.

**Stage 2: the ticket is a requirements document, not a code plan.** Look at
`.scratch/001_customer-scale-and-archive/ticket.md` for the house shape: Problem /
Why, Goals, Non-goals, Who uses this & how, Requirements, Scope edges & rules, Open
business questions, Out of scope / future, Notes for engineering. Decisions made
during review are folded back in as `[Resolved in design review]` / `(Decided.)`
annotations — the ticket stays the single source of truth for the feature.

**Stage 4: decide before building.** If the idea touches the data model, sharing,
write paths, or anything in an existing ADR, it needs a recorded decision first —
`/decide` for a single settled decision, `/design-review` for a full plan grilling
against `docs/CONTEXT.md` and existing ADRs. ADR 0002's name-linking rule and ADR
0003's snapshot rule were both decided this way *before* implementation. Check
`floortrack-architecture-contract` for what an idea must not break; check
`floortrack-failure-archaeology` before proposing anything — private customers,
archive flags, id-based links, optimistic locking were all already tried or
rejected.

**Stage 5: slice, one commit each.** Issue 002 is the worked example: six numbered
slice files under `.scratch/002_manage-grout-mortar-options/`, each with its own
acceptance criteria and a `Type: HITL` marker where a human decision gates the
slice (slice 01's one-way settings migration required the owner to confirm the seed
source). Each slice landed as exactly one commit, in order, each leaving the app
working. Issue 004 lists its 5 slices inside the ticket body instead of separate
files — either form is fine; the invariant is *numbered vertical slices, one commit
each, app never broken between them*.

**Stage 6–7: PR, then close the loop the same session.** Merge only via PR (see
`floortrack-change-control` for the gates). Then update CLAUDE.md / docs the change
invalidated and flip the ticket's `status:` to `done`. **Known trap:** the status
flip is the step that gets forgotten — as of 2026-07-06,
`.scratch/002_manage-grout-mortar-options/ticket.md` still says
`status: needs-triage` even though all six slices shipped weeks ago. Don't add to
that pile.

**Stage 8: retire by superseding, never by deleting** — see section 6.

## 2. The house prototype method

This repo's signature move for UX/design questions. Two rounds are on record; the
generic mechanics live in the `/prototype` skill (its UI branch) — this section is
the FloorTrack-specific protocol those rounds followed.

**Protocol — "multi-variant, real data, same-day fold-in, delete, record":**

1. **One question per prototype.** "What layout is easier to read at a glance?"
   (print round, 2026-07-03); "How should the salesperson block appear on the
   printed estimate?" (2026-07-05). If you can't state the question in one
   sentence, it's not ready to prototype.
2. **Build a THROWAWAY component rendering several radically different variants**,
   switchable by a URL search param — both FloorTrack rounds used `?pv=` (the
   generic `/prototype` skill calls it `?variant=`; the name doesn't matter, the
   switchability does). The print round rendered 5 variants plus the old layout.
   Radically different, not three shades of the same idea — the salesperson round
   explored header byline vs letterhead strip vs footer block vs a card beside the
   total, then iterated the winning *direction* into three versions (C1–C3).
3. **Use REAL data**, never lorem ipsum. The print round previewed with a real
   customer row. Layout decisions made on fake data don't survive contact with a
   12-product real estimate.
4. **The owner picks.** The output is usually a *blend* — the print round's answer
   took pieces of three rejected variants ("pieces of each survived in the blend").
5. **Fold the winner into the app the same day.** Both rounds landed in
   `src/App.jsx` on the day the pick was made.
6. **DELETE the prototype file the same day.** `src/PrintPrototype.jsx` and
   `src/PreparedByPrototype.jsx` are gone — neither ever reached `main`'s history
   (`git log --all` finds no trace). Prototype code that lingers becomes load-bearing;
   this repo has never let that happen.
7. **Record the outcome — including every rejected variant and WHY — in
   `.scratch/handoffs/`.** The two files
   (`prototype-print-layouts-2026-07-03.md`,
   `prototype-prepared-by-print-2026-07-05.md`) each state the question, method,
   winning answer in implementable detail, and the rejections ("Rejected: flat spec
   tables without boxes (A), customer-summary page without per-product math (B),
   label-over-value cards (C)"). The rejection record is what stops a future
   session from re-exploring a dead variant — it feeds
   `floortrack-failure-archaeology`.

The handoff file is the deliverable. The code is scaffolding.

## 3. The evidence bar for accepting a result

A result (a fix works, a measurement means X, a feature is done) is accepted in
this repo only when it clears four bars:

**(a) Predict before you run.** State the numbers or observations you expect
*before* running the test, measurement, or import — then compare. This is the gate
style `floortrack-estimate-correctness-campaign` enforces for estimate math; apply
it to any measurement. Repo example: the issue-005 investigation claimed "34
stairnose matches in the current book", then verified against the real workbook
(697 items, 155 Mannington Aduramax trims parsing) before concluding the parser was
fine and the bug was a display cap. A prediction made after seeing the output is
a rationalization, not evidence.

**(b) One mechanism must explain ALL observations — including the negatives.**
The worked example is the legacy-grout "—" bug (full incident, commits, and fix:
floortrack-failure-archaeology entry 4). The three observations one mechanism had
to cover:

- legacy rows showed "—" for grout and it vanished from the summary and print,
- *mortar on the same rows computed fine*, and
- *typing a quantity by hand worked*.

The single mechanism: legacy rows carry empty/0 tile `thickness` or grout `joint`;
the grout calc needs both, mortar needs *neither* (why mortar was fine), and a
typed value is a manual override that bypasses the calc (why typing worked). The
fix was the normalization gap — `normP` now defaults empty thickness/joint like a
fresh row.

The accepted fix wasn't "patch the summary display" — it was the one mechanism
(normalization gap on legacy data) that explained every symptom *and* every
non-symptom. If your explanation doesn't cover why mortar was fine, you haven't
found the cause. Corollary, now a house rule (CLAUDE.md): when adding fields,
extend `normP`/`normA`/`normC` and `mergeSettings` so old records stay valid.

**(c) Adversarial refutation before claiming done.** Actively try to break your own
result: feed it legacy-shaped data, empty fields, the concurrent-editor case,
the disabled-catalog-product case. Route to the repo's reviewers —
`/agent-code-review` for a rigorous diff review, `/self-review` for an
end-of-session retrospective on the process itself. A result nobody tried to
refute is a hypothesis.

**(d) Measured, never judged by eye.** Every acceptance in the record is a number:
`npm test` → 77 passing (as of 2026-07-06); the price-book import shows
new/changed/missing *counts* and price deltas in a mandatory diff preview before
anything is written; issue 004's parser was accepted against "697 items, all
sheets" of the real workbook; commit messages cite line counts. "Looks right" is
not evidence — for UI the measurement is a preview screenshot the owner approves
(see `floortrack-validation-and-qa` for what proof each change type needs).

## 4. Where good ideas historically came from

Four sources, with receipts — know them so you recognize (and correctly capture)
the next one:

| Source | Receipt | Lesson |
|---|---|---|
| **Field feedback** | Issue 005: SKU results silently capped at 8, so a user "read it as 'only 4 stairnose colors exist'" (34 existed); "transition" found nothing because the book labels trims by profile | The user's raw words located two real bugs a spec never would have. Capture verbatim. |
| **Direct owner request** | Issue 006 quotes the owner: "hide the backup and restore buttons inside the settings and replace them with an Issues/to do button… drag them around to move the most important one to the top" | The quote *is* the acceptance criteria. |
| **Growth-ahead planning** | Issue 001: "There is no pain today… This ticket is planning ahead"; issue 003: "Three related pressures, all downstream of growth" | Pre-pain tickets are legitimate — but they state the trigger to revisit ("many hundreds / thousands") instead of building infrastructure early. |
| **Past failures** | The `normP` normalization rule came out of the legacy-grout bug (`33982cf`); the `catalog.removedSeeds` tombstone (issue 005 follow-up) exists because the seed backfill would silently resurrect deleted underlayments | A root-caused failure should leave behind a *rule*, not just a patch. |

Implication for every ticket you write: put the originating words in the
"Problem / Why" section, unedited.

## 5. Experiment hygiene in a production repo

`main` auto-deploys to the live site. Non-negotiables (owner-confirmed) shape how
experiments run here:

- **Experiments live on branches and throwaway prototypes, never on `main`.**
  Even the abandoned Organic/Natural redesign was preserved on a branch
  (`backup/main-organic-design`) rather than merged or lost.
- **Anything touching live data is owner-run.** Never execute SQL against, or
  mutate data/storage in, the live Supabase project. If an experiment needs a
  schema change, deliver the SQL file under `supabase/` and hand it off — the
  owner runs it in the dashboard by hand (issue 003 shipped this way: "run
  `schema.sql` in the SQL editor when shipping this").
- **Time-box.** Both prototype rounds went question → variants → pick → fold-in →
  delete inside one day. An experiment that runs longer than that should be
  re-scoped into a ticket.
- **A failed or abandoned experiment still produces a written outcome** — a
  handoff in `.scratch/handoffs/` or a ticket update. "No silent abandonment": the
  failure record IS the deliverable, because it's what saves the next session from
  repeating the attempt. The rejected print variants A/B/C exist nowhere except
  the handoff — and that's exactly enough.

## 6. Retirement protocol

Ideas and decisions die in the open here. Three retirement paths, all observed:

1. **A decision retires via a NEW superseding ADR — never silent deletion.**
   Worked example: ADR 0001 (archive as an ungated column) was built, shipped, and
   ~2 weeks later ADR 0004 removed archive and visibility entirely. ADR 0001 was
   not deleted or rewritten; its status line now reads "Superseded by ADR 0004 —
   archive and visibility removed entirely", and `docs/adr/README.md`'s index shows
   both. The superseded ADR keeps its full rationale so the *reason it once looked
   right* survives. To retire a decision: write the new ADR (`/decide`), edit the
   old one's `Status:` to point at it, update the index.
2. **A ticket retires via the `wontfix` label** (in the canonical label set per
   CLAUDE.md) plus a note in the ticket saying why. Never delete the ticket file.
3. **A rejected design variant retires via the handoff record** — named, with the
   reason, as in section 2 rule 7.

Related-but-different: tickets also record *scoped-out* ideas under "Out of scope /
future" (issue 002 documents why rename and colors were cut; issue 003 lists
version attribution as deliberately deferred). And when a new ticket overrides an
old ticket's non-goal, it says so explicitly — issue 003: "**Conflict surfaced
deliberately:** issue 001 listed 'no server-side search'… The product owner has
since chosen to plan past that." Surface supersessions; never silently contradict.

## When NOT to use this skill

- **"What are the open research questions / what should we investigate next?"** →
  `floortrack-research-frontier` (this skill is the *how*, that one is the *what*).
- **Gates and evidence for an ordinary change** (does this need a PR, a preview
  screenshot, an ADR?) → `floortrack-change-control`; what counts as test/proof
  evidence → `floortrack-validation-and-qa`.
- **The measurement/analysis math itself** (how to compute or verify a number) →
  `floortrack-proof-and-analysis-toolkit`; estimate-math correctness work →
  `floortrack-estimate-correctness-campaign`.
- **"Was this tried before / why is it like this?"** → `floortrack-failure-archaeology`.
- **Actually running a stage** — `/feature` (interview → ticket), `/to-issues`
  (plan → slices), `/decide` / `/design-review` (decisions), `/prototype`
  (throwaway builds), `/agent-code-review` + `/self-review` (refutation),
  `/handoff` (session compaction). This skill routes to them; it doesn't replace
  them.

## Provenance and maintenance

All facts verified against the repo on 2026-07-06. Known doc gap: CLAUDE.md and
some process skills reference `docs/agents/issue-tracker.md`,
`docs/agents/triage-labels.md`, and `docs/project-charter.md`, which do not exist
in the repo as of this date — the canonical label list above comes from CLAUDE.md
itself, and the ticket/slice conventions were extracted from the six real tickets.

| Fact | Source | Re-verify with |
|---|---|---|
| Lifecycle stages & ticket shape | `.scratch/001…006/ticket.md` frontmatter + bodies | `ls .scratch` and read any `ticket.md` |
| Canonical triage labels incl. `wontfix` | CLAUDE.md "Triage labels" | `grep -n "wontfix" CLAUDE.md` |
| Issue 002 = 6 slices, one commit each | `.scratch/002_manage-grout-mortar-options/0*.md`; commits | `git log --oneline --grep="feat(002)"` |
| Ticket 002 status never flipped to done | its frontmatter | `head -6 ".scratch/002_manage-grout-mortar-options/ticket.md"` |
| Prototype protocol & rejected variants | `.scratch/handoffs/prototype-print-layouts-2026-07-03.md`, `prototype-prepared-by-print-2026-07-05.md` | read both files |
| Prototype files never reached git history | — | `git log --all --oneline -- src/PrintPrototype.jsx src/PreparedByPrototype.jsx` (empty) |
| Legacy-grout mechanism story | commits `2f3b74d`, `33982cf` | `git show 33982cf --stat` |
| ADR 0001 superseded by 0004 | `docs/adr/0001-…md` status line; `docs/adr/README.md` | `grep -n "Superseded" docs/adr/0001-archived-as-ungated-column.md` |
| Issue 005 / 006 verbatim quotes | their `ticket.md` files | `grep -n "stairnose colors" .scratch/005_sku-search-dropdown/ticket.md` |
| 77 passing tests (2026-07-06) | `npm test` | `npm test 2>&1 \| tail -8` |
| Organic redesign parked on a branch | branch list | `git branch -a \| grep organic` |
