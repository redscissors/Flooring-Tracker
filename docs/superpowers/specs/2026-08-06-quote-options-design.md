# Quote options — design draft

**Status: DRAFT — awaiting owner review.** Prototypes: `2026-08-06-quote-options-prototypes.html`
(same folder — open in a browser; also published as a Claude artifact). Nothing here is
implemented; this records the recommended design and the open questions from the
2026-08-06 exploration ("multiple quote options" session).

## The problem

A customer comparing two or three products for the same room has no home in the app:
the job sheet reads as one order with one total, so today the salesman builds parallel
projects or versions and does the comparison arithmetic by hand. Area notes (the small
input on the area band) have meanwhile earned their retirement.

## Recommended design

### Model: shared base + options

- `Area` gains one field: `option` — `""` (default, **shared**: the area is part of the
  job in every option) or an option id.
- A project with no tagged areas is exactly today's app — the "hidden Option 1" is the
  absence of tags, not a stored record.
- An **option's total is a whole-job number**: shared areas + that option's areas, with
  setting materials (grout/mortar/underlayment/add-ons), base units, and vendor freight
  consolidated per that combination — never job-wide, which would double-count
  alternates.
- Option identity: fixed slots A/B/C (color per slot) with an optional custom name
  stored on the project (e.g. `optionNames`). Names print; unnamed options print
  "Option A/B/C".
- Rejected alternative — "every area picks an option": simpler to state, but an
  option's subtotal is then only its own areas (one bathroom), not a signable number,
  and shared rooms would need re-adding by hand. Also rejected — whole-job copies per
  option: duplicates every shared area and every edit.

### Compare flow

Right-click the area band (or click the option chip — phones have no right-click, and
the chip makes the feature discoverable) →
- **This area is in**: Shared / Option A / B / C / New option…
- **Duplicate into another option…** — copies the area with all rows, tags the copy,
  tags the original if it was shared. This is the two-click "compare this room under
  another product" move.
- **Rename this option…**

### Project screen

- Option-tagged area cards wear the option color as their border plus an option chip on
  the band (where the area-note input used to sit). Shared areas look exactly as today.
- When options exist, the header's single grand total becomes one chip per option, each
  showing the whole-job number.
- Proposed option colors (new, quiet, paper-friendly, distinct from moss and from the
  tier colors): A slate-blue `#3E5F8A`, B umber `#9A5B33`, C plum `#6E4E7E`.

### Printed estimate

Treatment **A — compact comparison** (recommended default): shared areas print as
today; compared areas print inside color-banded option groups, each closing with its
own subtotal *and* the whole-job number; each option's own setting materials fold into
its band as one line (they cannot join the job-wide extras block without
double-counting); the single "Estimated total" becomes a three-up comparison block; the
signature line gains "option chosen: A · B · C".

Treatment **C — one full sheet per option** (cheap to build: the existing sheet run
once per option scope) could ship behind a print-time toggle. Treatment **B — matrix**
(compared area as a one-column-per-option table) only suits single-area single-product
options; parked unless A proves too busy.

### Order entry & order sheet

When the job has options, "Copy for order entry" and the printed order sheet open with
a picker first: Option A / B / C (each = shared + that option, with line counts and
totals) or Everything. The choice scopes all downstream lists — special-order lines,
stock SKUs, consolidated material quantities, and vendor freight (charged per book over
the chosen scope's rows only). No options → no picker, exactly today's behavior.

### Area notes removal

The area-note input leaves the area band and the note line leaves both print layouts.
The `note` field **stays in the stored shape and `normA`** so old jobs and version
snapshots keep parsing; it just no longer renders or accepts edits. Product-row notes
and project notes are untouched.

### Compatibility

- `normA` gains `option: a.option || ""` — old records normalize to shared.
- Version snapshots are `Area[]`, so option tags ride snapshots for free. Option
  *names* live on the project and survive version restores (names aren't priced data).
- No SQL migration: everything lives inside the customers row's `data` jsonb.

## Open questions (owner to confirm)

1. Model: shared base + options — right? (Everything below assumes yes.)
2. Option colors leaving the moss palette (like tier colors already do) — OK as shown?
3. Menu on right-click *and* the band chip — agreed?
4. Print: treatment A default, C behind a toggle — agreed? Is B wanted at all?
5. Optional option names — agreed?
6. Old saved area notes: keep data, hide UI — or surface a one-time chip so nothing
   silently disappears?
