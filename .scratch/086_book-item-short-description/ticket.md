---
issue_type: Feature
summary: Team-approved short descriptions for price-book lines, so arbitrary
  vendor text can use the ERP field's short rung the way Sheoga lines do —
  stored per item, human-approved, never auto-invented.
status: open
labels: [needs-triage]
---

# Per-item short descriptions for the order-entry fit ladder

Proposed 2026-08-13, out of the Sheoga Live Sawn description work (branch
`claude/sheoga-livesawn-overlap-u5x3nl`): after the descfit `promote` pass
landed, the owner asked whether abbreviation "could live in a right click menu
to abbreviate any description."

## Why abbreviation is Sheoga-only today

The fit ladder (`src/descfit.js`) is shared by every special-order line, but
its short rung only fires when a part carries a `short` form — and the Sheoga
configurator (`descParts` in `src/sheoga.js`) is the only producer of short
forms in the codebase. Its abbreviations are lossless because the vocabulary
is closed: hand-curated enum tables where no two values in a category share a
short form.

Everything else (price-book rows, wedi rows, fee lines) is arbitrary vendor
text via `textParts` — it fits or it splits, never abbreviates. That's
deliberate: no algorithm can invent abbreviations for open text that are
guaranteed not to read as a different product, and a partial spec that doesn't
announce itself is exactly the failure descfit exists to prevent.

## The proposal

Let a human close that gap per item: a team member approves a short form for a
specific book item once, and the fit ladder uses it automatically forever
after. The human is the gate — ambiguity risk collapses because someone who
knows the product signed off on the text.

Recommended shape (option 1 of 3 discussed):

- **Storage:** a `shortDesc` (name TBD) field on the price-book item, entered
  or approved by the team. Carried across re-imports exactly like `disabled`,
  `flagReview`, and `claudeIssue` — a team decision, not vendor data, so
  `applyBookImport` must carry it onto changed upserts and it needs its own
  sanctioned write path (data jsonb, no edited stamp — the flagReview
  contract).
- **Use:** `orderDescription` (src/orderentry.js) builds the line's parts with
  `{ full: vendorText, short: approvedShort, rank: 0 }` instead of bare
  `textParts` when the row's book item carries one. The existing ladder does
  the rest — including the new promote pass, which writes the full text back
  out whenever the field actually has room.
- **UI:** entry point TBD — right-click / ⋯ on an order-entry panel line
  ("Shorten…", pre-filled with the current text), and/or an edit affordance in
  the book detail's item table next to Edit / the ✳ issue button. The
  order-entry panel is where the pain is felt; the book detail is where item
  edits live today.

## Alternatives considered

- **Automatic abbreviation of open text** — rejected. This was the original
  "problem with doing everything": invented short forms can collide across
  books and read as a different product in an order description.
- **Curated trade-word dictionary + confirm** (word-level substitutions like
  Rectified → Rect proposed at copy time, human accepts). Less per-item setup,
  but output varies with the words present, the dictionary needs maintaining,
  and nothing is remembered per item. Could complement option 1 later as a
  way to pre-fill the suggestion.
- **Manual edit at copy time** — works today by editing the pasted text, but
  repeats on every order and nothing is remembered.

## Why the payoff is smaller than Sheoga's (honest sizing)

A price-book line has a SKU, and the SKU rides in the description field and
identifies the product regardless of how tight the prose gets. Sheoga lines
have no SKU — the description IS the order — which is why they got the
structured treatment first. The split rung's "+" marker + extended-text copy
already handles overflow safely for everyone. This feature buys more readable
identity in the main field before the "+", not correctness.

## Before implementation

- Stored-shape change on book items → load the `floortrack-data-model` skill,
  and record the decision as a short ADR (per-item team fields contract now
  covers a fourth field).
- Decide the UI entry point(s) with the owner; any UI change needs preview
  proof before merge.
- No live-Supabase writes from the agent; if a migration file is needed
  (likely not — book item `data` is jsonb), it ships as a file + instructions.
