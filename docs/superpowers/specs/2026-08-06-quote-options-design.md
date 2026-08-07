# Quote options — design

**Status: APPROVED (owner, 2026-08-06)** — E1 extras bundles, job-summary option
groups, preview-toolbar print switch, and the sheet flow all confirmed.
Prototypes: `2026-08-06-quote-options-prototypes.html` (same folder — open in a
browser; also published as a Claude artifact).

## The problem

A customer comparing two or three products — or the *same* product under two
installs (standard vs heated floor, different underlayments) — has no home in the
app: the job sheet reads as one order with one total. Area notes have meanwhile
earned their retirement.

## Decided (owner, 2026-08-06)

- **Model: shared base + options.** `Area.option` — `""` (default, shared: part of
  the job in every option) or an option slot. A project with no tagged areas is
  exactly today's app. An option's total is a **whole-job number**: shared areas +
  that option's areas, with materials and vendor freight consolidated per that
  combination — never job-wide across alternates.
- **Option identity & colors.** Fixed slots A/B/C with per-slot colors (proposed:
  A slate-blue `#3E5F8A`, B umber `#9A5B33`, C plum `#6E4E7E` — distinct from moss
  and the tier colors, quiet on paper) and optional custom names stored on the
  project; unnamed options print "Option A/B/C".
- **Order entry & order sheet.** When options exist, both open with a picker:
  Option A / B / C (each = shared + that option, with line counts and totals) or
  Everything. The choice scopes special-order lines, stock SKUs, consolidated
  material quantities, and vendor freight (charged per book over the chosen
  scope's rows only). No options → no picker.
- **Print direction: compact comparison** — one sheet, shared job printed as
  today, options as color-banded groups, comparison block replacing the single
  total, signature line gains "option chosen: A · B · C".
- **Area notes: removed, data too.** The input and both print lines go, and
  `normA` **drops** the `note` field — old notes disappear from a job the next
  time it's saved. No farewell UI. Product-row notes and project notes untouched.

## Round 2: where each option's extras live

The round-1 rolled-up line ("+ setting materials $56.85") is **retired** — it hid
exactly what matters when options differ by grout/underlayment/install.

### Print — the option as a bundle (E1)

Each option band is a self-contained mini-estimate:

1. The option's area(s) and product lines, as the cards layout prints them today.
2. **"Materials for this option"** — an itemized block, one line per material with
   quantity, unit price, and line total, **consolidated across all of that
   option's areas** (same aggregation the job-wide block does today, scoped to
   shared∪option minus what shared alone consumes — i.e. the option's own
   incremental materials). Tinted with the option's soft color.
3. A band footer: `flooring $X + materials $Y` → **Option N $Z · whole job $W**.

Shared areas' extras keep printing in the job-wide "Setting materials & sundries —
shared areas" block, which closes with a **Shared job subtotal**. Sheet order:
shared areas → shared extras block → option bands → comparison block. An option
with no materials skips the block.

Considered and passed over: **E2 — priced lines under each product** (indented
material lines directly beneath each product row). Tighter for one-product
options, but multi-area options either repeat shared materials under every row or
split them arbitrarily — consolidation lost.

### Screen — job summary groups

The totals card grows sections when options exist: **Shared areas** first
(flooring + materials + subtotal), then one group per option — flooring lines,
expandable itemized materials (the same lines the print shows), and the whole-job
number in that option's color. Area cards keep the round-1 treatment: colored
outline + option chip on the band; right-click or chip-tap opens the
switch / duplicate-into / rename menu.

### Printing one option by itself

A segmented control on the **Preview tab toolbar** — `Compare all · A · B · C` —
rendered only when the job has options; default always "Compare all". Picking an
option re-renders the preview as a normal single-total estimate scoped to
shared + that option (no bands, no comparison block; "Option B — Marble hex"
noted under the project name) and printing prints what's shown. Also reachable
from an area's right-click menu ("Print this option…"). This replaces the earlier
"one sheet per option" 3-page treatment.

## Compatibility

- `normA`: gains `option: a.option || ""`, drops `note`. Old records normalize to
  shared.
- Version snapshots are `Area[]` — option tags ride along; option names live on
  the project and survive restores.
- No SQL migration: everything lives in the customers row's `data` jsonb.

## Round-2 confirmations (owner, 2026-08-06)

1. E1 bundles over E2 lines — confirmed.
2. Job summary per-option groups as mocked — confirmed.
3. Preview-toolbar switch + right-click "Print this option…" — confirmed.
4. Compact sheet flow: shared areas → shared extras → options → comparison —
   confirmed.
