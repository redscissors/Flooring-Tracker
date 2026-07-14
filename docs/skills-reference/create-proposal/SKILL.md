---
name: create-proposal
description: Turn a /brainstorm session summary into a polished, self-contained HTML proposal for review — leading with a plain-language overview for project sponsors, then full design detail for system architects, with diagrams and light interactivity where they aid understanding. Use when a developer wants to package a brainstormed direction into a document sponsors and architects can review and approve or reject.
disable-model-invocation: true
---

You turn the output of a `/brainstorm` session into a single self-contained HTML document
that two audiences review and approve or reject: **project sponsors** (who need the
plain-language case and the decision being asked) and **system architects** (who need the
design detail and trade-offs). The document leads with the sponsor overview, then dives into
the architect-level detail. The proposal frames _what's being asked_ — the actual approval
sign-off happens through other channels, so the document itself carries no sign-off block.

The brainstorm summary is **source material, not a template to mirror.** Your job is to build
the document that helps these two audiences make a decision — and to include only what serves
that. Select, synthesize, reorder, and compress; lead with what matters to the decision and
leave out the rest. If a strong proposal happens to carry much of the brainstorm, fine — but
that's an outcome, not the goal. You are not re-running the brainstorm or inventing new design;
you are deciding what a reviewer actually needs to see and saying it well.

The test for every piece of content: **does this help a sponsor or an architect decide?** If
not, cut it — however good it was in the brainstorm.

<what-to-do>

## 1. Resolve the input

The starting point is a `/brainstorm` summary — almost always `.scratch/<slug>/brainstorm.md`.
Detect, in order:

1. **A path** to a markdown file → read it.
2. **A slug** (e.g. `api-contract-layer`) → read `.scratch/<slug>/brainstorm.md`.
3. **No argument** → look for the most recent `.scratch/*/brainstorm.md`; if more than one
   plausibly applies, list them and ask which. If the brainstorm happened in the _current
   conversation_ and was never written to disk, offer to proceed from the conversation
   context — but suggest the user run `/brainstorm`'s capture step first so there's a
   durable source.

If the file isn't a recognizable brainstorm summary, say so and ask the user to point you at
the right file rather than guessing.

A `/brainstorm` summary typically carries: what the area does today, the directions explored
and why they were rejected, the most promising direction, a benefits-vs-lighter-alternatives
table, a downsides-&-mitigations table, a "reality check" of feasibility risks, and open
questions. Read all of it as raw material — then choose what each audience needs (next step).
Don't expect a 1:1 mapping from these headings to document sections.

## 2. Ground yourself in the domain vocabulary

Before writing, load the domain language so the sponsor sections read in the product's own
terms, not dev-speak. Follow [`docs/agents/domain.md`](../../../docs/agents/domain.md) — the
`docs/CONTEXT.md` glossary for the area the brainstorm
covers. Proceed silently if a file is absent. You need the words, not a re-derivation of the
design — the one exception is verifying current-state claims before you assert them
(step 3).

## 3. Decide what each audience needs, then write it in their voice

Two audiences, two decisions. Build each part around the decision it serves — not around the
brainstorm's headings. The template offers sections for each part; treat them as a menu, not a
checklist. Use the ones that carry decision-relevant information, reorder them to suit the
material, and drop the rest. Add one only if the material genuinely calls for it.

**Part 1 — Project sponsors. Lead with this.** Sponsors decide _whether the change is worth
doing_. They are not necessarily technical.

- **Plain language only.** No file names, class names, framework names, table names, or
  ticket numbers. If a concept only exists as a code artifact, describe its _effect_ on the
  product instead. (Same bar as `/feature`'s good/bad example.)
- They need enough to weigh value against cost and risk: what would change for the product,
  why it's worth doing, the rough size of the commitment, and the honest risks — no more.
  A tight executive summary up front earns the rest of their attention.
- Pull only the **strongest, most business-legible** benefits and risks forward. A sponsor
  doesn't need every row of an analysis table; they need the few that move the decision.

**Part 2 — System architects.** Architects decide _whether the design is sound and worth
building this way_.

- Give them the architectural substance that bears on that judgment: the core concepts and
  seams, where authority and state live, the data model and invariants, and the _why-this-one_
  reasoning over the alternatives. Use the project's glossary vocabulary.
- Include the brainstorm's analysis tables (benefits-vs-alternatives, downsides-&-mitigations)
  **when they sharpen the architect's evaluation** — trimmed to the rows that matter. Don't
  paste them in wholesale out of obligation; don't strip out a trade-off that genuinely bears
  on the decision either.
- Carry the feasibility / migration risks through honestly — that's often what an architect
  weighs hardest.

Honesty rules that override "include only what helps decide": don't invent benefits, risks, or
design claims that aren't supported by the source, and don't quietly drop a real risk or
trade-off because it weakens the case. Cutting _noise_ is the goal; hiding _cost_ is not. When
the source is thin, the proposal is short — never pad. And verify any bold claim
about how the system works _today_ against the code before it goes in, surfacing any
conflict to the user rather than silently picking a side.

## 4. Render to self-contained HTML

Copy [`template.html`](template.html) to the output path and adapt it to the content you chose
in step 3 — the template is a starting layout, not a fixed mold:

- Replace every `{{TOKEN}}` and every region marked `REPLACE:` with your content. **Delete any
  section you didn't fill, and reorder sections** to match how you decided to tell the story.
- **Keep the `<style>` block verbatim** — it's what makes proposals presentable, consistent,
  and print-friendly.
- The document must be **fully self-contained**: no external CSS, JS, fonts, or CDN links. It
  has to open and look right from a `file://` path or as an email attachment.

Lean on the template's dynamic building blocks **wherever they convey something better than a
paragraph would** — don't force them where plain prose is clearer:

- **Diagrams.** When a relationship, data/event flow, or before→after is clearer drawn,
  build one: compose the `.flow` node/arrow blocks for simple box-and-arrow pictures, or paste
  hand-authored inline `<svg>` for anything richer. The architecture overview and the
  phased-migration story are the usual places a diagram earns its place. (Inline SVG only — no
  diagramming-library scripts.)
- **Today vs Proposed tabs** for the "what's changing" contrast.
- **Collapsible `<details>`** to let sponsors fold away architect-level depth (e.g. the
  rejected directions) while keeping it one click away.
- Convert any markdown tables you keep to HTML `<table>`.

Use today's date for `{{DATE}}` and set `{{SOURCE_REF}}` to the source path.

**Output path:** `.scratch/<source-slug>/<proposal-slug>.html`, alongside the source
`brainstorm.md`. The filename must be a **descriptive kebab-case slug of the proposal itself**
(e.g. `typed-api-contract-layer.html`, `branch-context-redesign.html`) — never a generic
`proposal.html` — so that when several proposals land in someone's inbox they're told apart by
filename alone. Auto-propose the slug from the title and confirm it in step 5. If that file
already exists, ask whether to overwrite or write to a different name.

## 5. Write it, then surface the framing

This is a reversible local file, so write the HTML straight away — no pre-render approval gate,
per [Write local artifacts without a pre-write
gate](../../../docs/agents/skill-orientation.md#write-local-artifacts-without-a-pre-write-gate).
After writing, tell the user the path and walk them through the **framing decisions** you made,
so they can catch anything off without having to re-read the whole document:

- the **title** and **filename slug**,
- the **executive summary** and how you stated **the ask** (the two pieces that set the
  sponsor's tone), and
- the **outline** — which sections you included, in what order, and what you left out, so they
  can catch anything decision-relevant you cut.

Invite tweaks, and note they can open it in a browser or print/share it as a PDF for the
review. Don't commit it or send it anywhere — it's theirs to circulate.

</what-to-do>
