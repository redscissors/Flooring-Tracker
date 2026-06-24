# Cold-start calibration (loaded by `/mentor` on first run)

`/mentor` loads this file **only** when no developer model exists yet (first
invocation) or on an explicit dev-requested **re-calibration**. It is kept out
of `SKILL.md` so the base skill stays lean. When you finish calibration, return
to the base skill (triage, or — task-free — stand by for work or a quiz).

This runs **task-free or task-grounded**. A task, when present, is an optional
grounding overlay for which probes to prioritize; it is never required.

> **The one firewall this whole procedure holds: self-report targets the probe;
> verified reasoning sets the scores.** Steps **a** and **b** are pure
> self-report — code-free, non-scoring — and write **only** the
> `developer-profile`. Step **c** is the *only* step that scores anything, and
> it scores from *demonstrated reasoning*, never from what the dev claimed. The
> firewall sits cleanly between **b** and **c**. Honesty is welcome; it is never
> load-bearing (an honest dev is still miscalibrated — novices over-rate,
> experts under-rate; a conservative evidence-based baseline is robust to both).

The `developer-profile` is owned by the **dev-model-store** MCP server
(`read_profile`, `update_profile`; once registered, `mcp__dev-model-store__read_profile`
and `mcp__dev-model-store__update_profile`). **`update_profile` never writes a
competency level** — it rejects any level/score field. Scores are written to the
developer *model* by the independent assessor, never here, never by the mentor.

---

## Step a — broad claim-gather (self-report, code-free)

Conversational and biographical. Read no repo code. The whole calibration
(steps a–c) follows skill-orientation's interview discipline: **one
substantive question per turn, wait for the answer** — each claim heard shapes
the next probe, and a bundled questionnaire collapses that contingency.

**Open with a short orientation, then one open question.** Tell the dev what
this is and what's worth including before they answer — a bare "tell me about
yourself" makes people guess at what you're after and tends to surface only
the highlights. Adapt the wording, but cover: *why* you're asking (so you can
pitch help at the right level), that *nothing here is a test or a score* and
the profile is their own private record, and that *candor about the rough
edges helps more than a polished résumé*. Something like:

> "Before we dig into any code, I'd like a quick picture of your background so
> I can pitch help at the right level — stay out of your way where you're
> strong, and slow down where something's new. This part is just a
> conversation; nothing you say here scores you, and what I jot down stays
> your private record. It helps me most if you're candid about the shaky bits,
> not just the highlights.
>
> So to start: **walk me through your background as an engineer.** The most
> useful things to hear are **how long** you've been at it overall; the
> **languages and frameworks** you've worked in, and for each roughly **how
> long, how recently, and how deeply** (shipped-and-owned vs. touched-once);
> the **domains** you've built in (ERP, fintech, manufacturing, …); the
> **roles** you've played; and an honest read of where you feel **strong**
> versus **shaky**."

That is **one** open invitation with suggested dimensions — not five separate
questions. Let them tell it their way, then drill into specifics one at a time
from there. As they talk, map the landscape:

- **years** of experience overall.
- **frameworks / languages** — for each, its **duration**, **recency** (current,
  2 years ago, …), and a one-line **depth** note.
- **domains** worked in (ERP, fintech, manufacturing, …).
- **roles** (IC, senior, lead, …).
- self-identified **strengths** and **gaps**.

As they talk, also note **analogy hooks** — prior tech that maps onto this
system's concepts ("you've used NestJS guards → we have request interceptors").
Hooks are *targeting aids* for later teaching, not credit.

Then `update_profile` with what you gathered (`years`, `frameworks`, `domains`,
`roles`, `strengths`, `gaps`, `analogy_hooks`). The profile is dev-owned, dated,
and **editable later**.

**Limits for step a:**
- **Level stays unscored here.** The profile carries no scores; `update_profile`
  rejects any attempt to write one.
- **The project axis stays uncredited.** "I know NestJS" doesn't become "knows our
  conventions" — knowing the framework ≠ knowing *our* system (the central
  cold-start trap). Framework experience is judgment-axis context and an analogy
  hook; it never touches the project axis.

## Step b — targeted claim-refinement (self-report, code-free)

Still pure self-report, still no repo code. Drill each claim from step a to
sharpen its **scope / depth / recency** — **solely so you can author better
step-c probes.** Example: "You said NestJS — did you *build* the guard/
interceptor layer, or *consume* one someone else set up?" "When did you last
write a migration by hand?"

- This step **never verifies** and **never reads the repo**. It only sharpens
  claims into **probe targets**.
- Write the sharpened claims back to the profile as `probe_targets` (status
  `unseen` until discharged). These are **lazily-verified** — discharged by the
  next relevant task or an on-demand quiz, never auto-credited.
- **Surface, here, any prior exposure to *this* project.** Whether step c
  includes a project section (c2) is decided entirely by what b surfaces. Record
  it (e.g. in `roles` / `gaps` / a probe target) so the decision is explicit.

> **The firewall closes here.** Everything above is self-report and has scored
> nothing. Everything below scores only from reasoning the dev demonstrates.

## Step c — verification quiz (the only scoring step)

A reasoning-eliciting spot-check pitched off the refined claims. **Start at the
claimed altitude — never the floor** — and step *down* to find footing (don't
make a 10-year dev prove they know an `if` statement). Run as **two
code-separated sections** so *ordering* reinforces the is/ought firewall:
**c1 (judgment, code-free) → read the code → c2 (project, repo-grounded).**

**The quiz characterizes the dev's *altitude*, not their claim list.** Its job
is to read *how high and how reliably the dev reasons*, not to tick off every
concept they named. Probes ride on the claimed concepts (you stay grounded in
a+b — you don't probe at random), but you choose a **representative, diagnostic
sample** that reveals *level*, and you deliberately vary difficulty to find
where reasoning holds and where it breaks — that boundary *is* the altitude
signal. You do **not** need one probe per claim; the concept a probe rides on
is incidental to what it tells you about level. Concepts you don't probe aren't
lost — triage infers an entry pitch for them from the rows you *do* seed (see
the mentor skill's triage).

### Seeding rule (applies to everything c writes)

Whatever c demonstrates seeds the developer model **conservatively**:

- **`provisional`** confidence — within-task evidence only.
- **`level ≤ competent`** — a cold-start answer can never seed `proficient` /
  `advanced` (those need `confirmed` + breadth-of-transfer evidence).
- tagged **`cold-start`** (record it on the model row's `Gap`/`Next` or refs so
  the provenance is visible).
- A cold-start answer is **not** a confirmation-eligible demonstration — it never
  `confirms` and it never clears staleness.
- **Underrate rather than overrate** when an answer is ambiguous.

The mentor *administers* the quiz; the **independent assessor verdicts and
writes the model** via `update_model` at wrap-up — the mentor does not call
`update_model`. (For a standalone calibration with no task to wrap up, you may
seed the model directly via `update_model` *only after* establishing reasoning,
still under the seeding rule above; prefer letting the assessor verdict when a
session has a diff to read.) Capture each probe exchange with `append_exchange`
exactly as in the base skill (a quiz exchange is still a scaffolding exchange:
its `move`, `self_tag`, `claim`, `provenance`).

### c1 — judgment axis, *code-free* (runs first, always)

Authored fresh — **never from a pre-baked bank** — aimed at **two things at
once: depth on what they claimed, and breadth across the rest of the stack.**
The a+b claims set the *starting altitude*, not the *boundary* of what you
probe. By the end of c1 you want a **broad picture of the dev across the whole
stack** — UX/frontend, API and system design, data modeling, database/indexing,
performance, concurrency, testing, security, and the like — not just the corners
they volunteered. Those areas are an *illustrative span* to check yourself
against, **not a fixed checklist**: author each probe yourself, pitched and
sourced as below. Within each area, pitch at the claimed altitude and step down
to find footing. The probes' **answers are sourced from external references, never this
repo** (the is/ought firewall); write down what a sound answer contains
*before* you score it.

Two examples — these show the **shape**, the subject is incidental; do **not**
reach for these concepts, author your own across the areas you're sweeping:

> *(developing-band, judgment)* "You've got two functions that are 80%
> identical. Walk me through how you decide whether to extract the shared part
> or leave them separate." — *looking_for: reasons about coupling the shared
> abstraction introduces vs. the cost of divergence; resists reflexive DRY;
> names what would make the duplication worth keeping.*
>
> *(competent-band, correctness/safety)* "A request hands you a user id and a
> role string. Which do you trust, and how do you treat the rest?" —
> *looking_for: trusts neither from the client; authenticates identity and
> derives authorization server-side; validates/normalizes all input at the
> boundary.*

Each probe earns its place by what it reveals about *level* — pick the most
diagnostic samples across the dev's claimed range, not one per claim; the
*difficulty* steps to the claimed altitude and down to find footing.

- **Read no repo code in c1.** Judgment is transferable, so the repo's code is a
  confound here and a code-as-ought anchor — zero benefit, real risk.
- Before scoring, `read_concepts` and **reuse** an existing concept key when its
  `gloss` honestly covers the same skill; `register_concept` (kebab-case, with a
  short `gloss`) a concept your probes target that is genuinely distinct or isn't
  already present — when it's a toss-up, coin rather than force-fit, since a
  wrongly-merged key silently inflates the model. The gloss is what lets the next dev's
  calibration and the assessor reuse the key instead of coining a near-duplicate
  — `update_model`'s auto-registration coins a bare key, so register
  deliberately here. The keys you coin here are judgment-axis. This is how the
  registry seeds: from the claims in front of you, pitched at this dev (a
  junior's starting vocabulary and a senior's differ), never from a fixed list.
- Score from the **reasoning the dev produces**, under the seeding rule.
- **Breadth scales with claimed reach — and respects it.** A dev who claims
  broad or senior experience gets a *wider* sweep: span most of the stack,
  because breadth-of-transfer is what a senior claim *is*, and you're testing
  whether the altitude holds across domains, not just their favorites. A junior
  or narrowly-scoped dev gets a *narrower* one — probing advanced system design
  or index tuning on someone who's never touched it produces floundering, not
  signal.
- **Record unencountered territory as a gap, not a low row.** When a probe
  lands on something the dev has simply *never seen* — not weak reasoning, just
  no exposure — stop stepping down: record it as a **profile gap**
  (`update_profile`, e.g. `gaps`) and leave the model **`unseen`**. A
  never-encountered area is `unseen`, not `beginner`; only demonstrated *weak
  reasoning* seeds a low row.

### — read the code —

*Only now* read the repo to inform the project probes: conventions, the ADRs
(`docs/tools/adr/`), `docs/CONTEXT.md` and per-app `CONTEXT.md` files, and
representative code. This read is **descriptive only** — it selects and grounds
*what* to probe, **never** *what counts as correct*. The documented standard
(docs/ADRs/rules) is the answer key; **code that diverges is deficient, not the
answer.** You may delegate this read to a subagent to keep your context clean —
worth doing when the area is large or your context is already heavy — but the
ordering (c1 before any code read) is the load-bearing defense here, not the
delegation.

### c2 — project axis, *repo-grounded* (runs only if b surfaced prior exposure)

- **If step b surfaced no prior exposure to this project → skip c2 entirely.**
  The project axis stays **empty** (a zero here is *unseen*, not a gap — it fills
  from the dev's first scaffolded tasks). The genuinely-new dev's calibration is
  c1-only.
- **If b surfaced prior project exposure → run c2.** Probe this system's
  conventions / vocabulary / invariants **against the documented standard**.
  Score the project axis `provisional`, under the seeding rule. Same firewall:
  framework experience never credits the project axis — only demonstrated
  knowledge of *our* conventions does.

### Calibration notes

Record the **claimed-vs-demonstrated delta** in the profile's
`calibration_notes` via `update_profile` (e.g. "claimed advanced on testing;
demonstrated competent" — Dunning-Kruger / inflater / under-confidence signal).
This is profile data (targeting), not a score.

---

## Dev-controlled quiz length (the filtering invariant)

This governs **each section** (c1 and, when it runs, c2). Because c2's probes
exist only after the code-read, the preview/trim happens **per section** — a
genuinely-new dev (c1 only) gets **one** budget moment.

1. **You author as many candidate probes as you judge warranted — no generation
   cap — and lean generous: start with more, not fewer.** But each must earn its
   place as a **distinct sample** — pinning down the dev's competence at a
   *level* or in an *area* the others don't reach. More probes → a finer,
   broader read; a second probe on ground you've already mapped is padding, a
   probe at an untested altitude or in an unswept area is signal. Generous for
   resolution and breadth, never padded for length.
2. **State the count** to the dev: "I have N probes that would cover your claims;
   we can do all N, trim to fewer, or add more."
3. **The dev's only lever is the count.** They may say "trim to 20" or "give me
   more." They do **not** choose *which* questions and do **not** set difficulty.
4. **You always choose which probes are kept** — selecting to maximize
   diagnostic coverage across the claims — and **you own difficulty.**
5. **Trimming coarsens the altitude read → more conservative results.** Concepts
   a trimmed quiz never probes stay **`unseen`** in the model — but that's a
   thinner *sample*, not a permanent verdict: triage will pitch them from their
   neighbors, and real tasks will probe them directly. Tell the dev trimming
   costs resolution, not credit — cheaper than it sounds, because the gaps get
   filled later, not lost. **Neither lever can inflate a level** — that is what
   keeps self-report non-load-bearing even while the dev steers.

---

## Dev-requested quiz, anytime (same machinery) — D12 / D13 / UAT-12

A dev can request a quiz at **any** time, not just at cold-start, and it reuses
cold-start step c wholesale: the same probe authoring (off claims and profile
probe targets), the same dev-controlled length lever (the filtering invariant
above), the same capture (`append_exchange` per probe), and the same
mentor-administered / assessor-verdicted split — you run the probes, you do
**not** `update_model`; spawn the assessor (per
`.claude/skills/mentor/assessor.md`) over the evidence-log material to issue the
verdict. (The standalone-first-run seeding exception in step c does **not**
extend here — a model already exists, so let the assessor verdict.)

What's *different* from a real task: a quiz is **retrieval, not recurrence**, so
its evidence can only sharpen a `provisional` read (up or down), never
`confirm` it, never exceed the `competent` cap, and never clear staleness — only
recurrence on an independent, later real task does those. These are
`update_model`'s hard write-invariants (`provisional ⇒ level ≤ competent`;
`confirmed ⇒ ≥2 distinct task refs`), not yours to police; the quiz just
produces evidence, and a self-requested quiz is **valuable retrieval practice**
(doctrine rule 6) regardless of what it moves.

### Flagged concepts are pitched first — never imposed (D13)

When you pitch a dev-requested quiz, **prioritize concepts the assessor flagged
`owned-vs-assisted unresolved`** on the model's `Next` field (read them via
`read_model`). Flagging-and-deferring is how the non-interactive assessor
discharges an unresolved owned-vs-assisted concept (D13); pitching those first
means a flag is **not hostage to real-task recurrence alone** — the dev's next
quiz can resolve it.

But the dev initiates: you may **surface that flagged concepts exist** and that
a quiz would help, in plain language — you **never impose** a quiz. All quizzes
are dev-initiated. The dev decides whether and when; you administer when asked;
the assessor still issues the verdict on the evidence-log material.
