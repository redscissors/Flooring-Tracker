# ERP 1 order numbers — design

**Date:** 2026-09-19 · **Status:** approved by owner in chat 2026-09-19; implemented (ADR 0044, issue 147) · **Plan:** `docs/superpowers/plans/2026-09-19-erp-order-numbers.md`
**Mockup:** `.scratch/mockups/erp-order-2026-09-19.html` (picked: 1D-A header bar, round 5; 3B; 4A; 4C)

## Problem

When the desk keys a NED project into ERP 1, nothing in NED records that it
happened. The order-entry panel's green "copied" checks are React state and
vanish when the panel closes; the customer browser can't answer "has this
job moved to ERP 1?" or "which job is ERP order 48213?"; and a project split
across two ERP orders has nowhere to say which lines went on which.

The owner's ask (2026-09-19): the ERP 1 order number goes into NED when order
entry is used; the copy buttons stay greyed out until it's entered; it is
remembered across close/reopen; a project may split across more than one
order; and the number is stored and searchable in the customer tab, as its
own column.

Answers that shaped the design: ERP 1 hands out the number **at the start**,
before any lines are keyed (so gating the line copies is safe); the number is
**plain digits** (e.g. 48213); and after a split the team wants to see
**which lines went on which order**.

## Decision

Two new fields on the project record, written through `updateProject` like
everything else, no SQL:

```
project.erpOrders : [ { no: "48213", addedBy: "Marcus Mast", addedAt: 1758283920000 }, … ]
                    // added order; the LAST entry is the active order when the panel opens
project.erpKeyed  : { "<line id>": { no: "48213", at: 1758284040000, by: "Marcus Mast" }, … }
                    // one stamp per order-entry line, keyed by the line's stable id
```

The order-entry panel's top is rebuilt as a **header bar** in the project
header's idiom (owner, rounds 3–5): a band of three bordered columns and
nothing above it — **Deliver to** (narrowed to a column), **ERP 1 order**
(the entry field on top, each added order a chip stacked under it, a
fine-print tally), and a third column stacking the **Project** box (the
N-number and the project name, both click-to-copy, the close ×) over a
shorter **View** box (the three views stacked). The old title row and the
body's Deliver to section go away. On a
**numbered** project (one with an N-number) every line copy is gated on
having an order; on an unnumbered one — a quick price, or a job not yet
named — the number is optional and nothing is gated. Each copied line is
stamped with the active order, and the stamp shows as the number under the
line's green check. A quick price's Deliver to column is empty.
**Copy remaining** replaces Copy all. The project header wears an `ERP 48213` chip beside the N-number,
and the customer browser gets a searchable **ERP order** column.

### Storage and normalizing

- `src/erporders.js` (new, pure, `node --test`): `normErpOrders`,
  `normErpKeyed`, and the patch builders below. `normC` (model.js) calls the
  two normalizers so old records load with `erpOrders: []`, `erpKeyed: {}`.
- An order number is a string of 1–10 digits (`normErpNo`: strip non-digits,
  empty → rejected). `erpOrders` dedupes by `no`, keeps first-added order.
- `erpKeyed` entries whose `no` is not in `erpOrders` are dropped on
  normalize (a removed order takes its stamps with it — see Remove).
- `custData` (usedirectory.js) strips nothing new: both fields are data and
  ride the jsonb. **Amended (final review, 2026-09-20):** it now ALSO strips
  `erpNos` and `sales` — not `erpOrders`/`erpKeyed` themselves, but the two
  boot-light-row projections (`bootload.js` `lightRow`) that `loadDetail`
  merges onto the in-memory record when a full row loads over the light one.
  Nothing reads `data.erpNos`/`data.sales` back; leaving them in would have
  written stale boot-time projections into the jsonb on every save.
- Versions are untouched: a version snapshots `Area[]` only. A restored
  version keeps whatever stamps still match its line ids.

### Line ids (what a stamp is keyed by)

The ids the panel already carries, made stable where they aren't:

| Line | id today | id after |
|---|---|---|
| product row (special or stock) | `p.id` | unchanged |
| special material (`matOrderRow`) | `mat\|<kind>\|<product>` | unchanged |
| stock material (App.jsx `mats`) | `"mat" + i` (index) | `mat\|<kind>\|<product>` — same rule as the special side |
| freight | `freight\|<bookId>` | unchanged |
| merged line (Compact / Area + vendor) | `merged\|…` | never stamped itself; `r.from[].id` are the stamps |

Renaming a material product orphans its stamp: the line simply reads unkeyed
again. Accepted (rare, self-explaining) rather than inventing a material id.

**Amended (final review, 2026-09-20):** "same rule as the special side" is
almost true — the stock side (App.jsx `mats`) carries a collision guard the
special side does not: when a `mat|<kind>|<product>` id would collide with
another stock material's, App.jsx appends a `#` per duplicate so ids (and
therefore stamps) stay distinct. `matOrderRow` (print.js, the special
side) has no such guard; two special materials whose kind+product happen to
match would share a stamp. Not fixed in this wave — collision is rare on the
special side (kind+product is closer to a real key there) — but the
asymmetry is worth knowing about before trusting a special-material stamp on
an edge case.

### Patch builders (`src/erporders.js`)

Each returns `{ erpOrders, erpKeyed }` for ONE `updateProject(id, patch)` call
(usedirectory's setter closes over stale state — two calls in one tick clobber
each other, the options.js lesson).

- `addErpOrder(proj, no, who)` — appends `{ no, addedBy: who, addedAt }`;
  a duplicate returns the project unchanged (the panel selects that order).
- `removeErpOrder(proj, no)` — drops the order and every stamp on it.
- `stampErpLines(proj, ids, no, who)` — sets `erpKeyed[id] = { no, at, by }`
  for each id (a re-stamp overwrites: the line moves to that order).
- `clearErpStamps(proj, ids)` — deletes the keys.
- `lineIds(row)` — `row.from ? row.from.map(f => f.id) : [row.id]`.
- `keyedNo(row, erpKeyed)` — the order a line is keyed on: for a plain row its
  stamp's `no` or null; for a merged row, the shared `no` when EVERY source
  is stamped on the same order, `"mixed"` when all are stamped but on
  different orders, null when any source is unstamped.
- `remainingRows(rows, erpKeyed)` — rows with a SKU (or `byDesc`) and
  `keyedNo === null`.
- `erpCounts(rows, erpKeyed)` — `{ keyed, total, byNo: { no: n } }` for the
  fine print and the chips' per-order counts (counted over `erpKeyed` for the
  per-order counts, over the visible rows for "N of M keyed").
- `gated(proj)` — `!!proj.projectNo && erpOrders.length === 0`.
- `who` = `profile.name || user.email || ""` (the samples doctrine).

### The panel (`src/orderentry.jsx`) — option 1D-A + 3B

`OrderEntryPanel` stays pure presentation. New props:
`erpOrders`, `erpKeyed`, `projectNo` (the gate switch and the Project box's
copy chip), `quick` (empties Deliver to), `onAddOrder(no)`, `onRemoveOrder(no)`, `onStamp(ids, no)`,
`onClearStamp(ids)`. App.jsx wires each to one
`updateProject` through the builders above. The preview harness passes
fixtures and no-op handlers.

**The header bar** (owner, round 3 — "similar to how the project header
works, columns of things that fit nice and neat"; round 5 — "the View box
has wasted space vertically", the strip folds into that column). Replaces
the panel's title row (`Copy for order entry` + project name + view switch)
AND the body's Deliver to section; nothing sits above the band. Chrome
borrowed from `ProjectHeaderBar`: the band tint (`--ft-band`) on the bar,
1px `--ft-border-strong` boxes with 6px radius, 8px eyebrows, 7px bar
padding, 6px gaps. Widths at the panel's 560px: Deliver to takes what's
left (~210px), ERP 152px, the third column 150px.

- **Deliver to** column (flex 1): eyebrow
  "Deliver to" with the latching copy-all button (20px) at its right — the
  same `LatchCopy` over `deliverToSequence` — then the label lines at 11.5px:
  customer name bold, street, apt if any, "City, ST ZIP", phone, each piece
  the click-to-copy `Seg` it is today. The unsplittable-address warning stays
  as a one-line amber note under the lines. With nothing to show, the column
  reads "No customer name, address or phone on this project."
- **ERP 1 order** column (152px): eyebrow "ERP 1 order"; the entry field on
  top — `ERP #` label, digits-only input (`inputMode="numeric"`, non-digits
  stripped, max 10), an ink `+` button (18px) at its right; Enter or `+`
  calls `onAddOrder`. With no order the field is amber-outlined with
  placeholder "required" and the fine print under it reads, in amber, "Enter
  the order number to unlock the line copies." (numbered projects; on an
  unnumbered one the field is neutral with placeholder "optional" — see
  Gate). With orders the placeholder
  reads "another…" and each order is a full-width **chip** stacked under the
  field, newest on top: the number, its stamp count at the right (`3 lines`,
  omitted at 0), a `×`. The active chip is filled moss; clicking another
  makes it active; × removes (see Remove an order). A number already present
  selects that chip. Fine print under the chips: `5 of 7 keyed · 2 to go`
  (or `Every line is keyed`).
- **Third column** (150px, two boxes stacked with the bar's 6px gap):
  - **Project box** — the eyebrow row holds the N-number as a small copy
    chip (`N214`, 10px bold, ONLY when the project has one — `sel.projectNo`;
    unnumbered projects and installs that haven't run project-numbers.sql
    show nothing there, the project header's own rule) and the close × at
    the right; under it the project name in 12px bold, clamped to two lines
    with the full name in `title` (with the option short name when scoped,
    as today's `name` prop). Both the N-number and the name are
    **click-to-copy** — a `Seg`-style latch: click writes the text
    (`N214` / the name) to the clipboard and the piece turns moss-soft with
    moss-deep ink, like the Deliver to pieces — so either can be pasted into
    ERP 1. A quick price's box is the auto-name and the × alone.
  - **View box** — no eyebrow (the three names explain themselves); Compact
    / Area + vendor / Sheet order as three stacked 17px rows, 11px semibold,
    the current one filled moss — the same `aria-pressed` switch, vertical.
- Heights: about 120px for the bar at one order (the third column sets it:
  Project box ~46px + View ~62px); each further order adds a 22px chip to
  the ERP column, which overtakes the third column at three orders. Old title
  row + Deliver to section was about 250px.
- **Below `lg`** (the phone's full-screen panel) the columns wrap: Deliver to
  full width, then ERP and the third column side by side — the project
  header's fold.
- The body opens straight on Special order; its section gap tightens to 12px
  with 10/12 padding, special rows 6/10, stock rows 5/10.
- **Active order** is panel state: initialised to the last entry of
  `erpOrders`, reset on every open. Not stored.

**Gate — numbered projects only** (owner, round 4). The gate applies when
the project carries an N-number (`projectNo`). No N-number means no saved
customer and no real project name — a quick price or an unnamed draft — and
blocking the copies there "doesn't really make sense": the desk keys quick
prices without an ERP order. So:

- `projectNo` present and `erpOrders` empty: every special-line copy button
  and Ext button, Copy remaining, Copy selected, and every stock checkbox are
  disabled (`disabled:opacity-30`, title "Enter the ERP 1 order number
  first"). The ERP field is amber-outlined, placeholder "required", fine
  print in amber "Enter the order number to unlock the line copies."
- `projectNo` absent: nothing is gated. The ERP field stays, neutral, with
  placeholder "optional" and fine print "Optional — so the job can be found
  by its order number later." Adding a number works exactly as on a numbered
  job (chips, active order, stamps); without one, copies simply don't stamp
  (there is no order to stamp on) and the green checks stay session-only as
  today. A project that later earns its N-number (first real name) becomes
  gated from then on — the panel reads `projectNo` live.
- The Deliver to column is never gated on either kind.

**Deliver to on a quick price** (owner, round 4): a quick price (`sel.quick`)
shows the Deliver to column **empty** — eyebrow only, no name, no address, no
phone, no copy-all latch. Today's fallback would print the draft's auto-name
(`Q-<item>-<m/d>`) as the delivery name, which is not a deliver-to. A
customer-less but named (non-quick) project keeps today's behaviour: whatever
name / address / phone the project carries, the empty-state line when it has
none.

**Stamping.** A copy that succeeds calls `onStamp(lineIds(row), active)`:
- a special line's copy button (the description); the Ext button does NOT
  stamp (it's the second half of the same line);
- **Copy remaining** — `remainingRows` of the visible view, one `onStamp` with
  every id (merged rows contribute all their sources), label
  `Copy remaining (N)`; at N = 0 disabled with title "Everything is keyed".
  **Amended (final review, 2026-09-20):** the label reads **"Copy all"**
  instead whenever there's no active order (`active` falsy) — an unnumbered
  project with no order yet has nothing to stamp, so "remaining" would be
  misleading; the moment an order exists the label switches to
  `Copy remaining (N)` even on that same unnumbered project;
- **Copy selected** — the checked rows. A keyed stock row has no checkbox
  (its badge replaces it), so a re-copy on purpose goes through the badge's
  **Copy again**, which moves the line to the active order.
The copies follow the visible view as today; selection still resets on a
view switch.

**A keyed line — option 3B.** The copy button latches to the green check
(`DONE_MOSS`) with the order number under it in 7.5px moss type, tabular
numerals (`keyedNo`; "mixed" reads as `mixed`). Title: "Keyed on ERP 48213 —
Sep 19, 9:14 AM by Marcus Mast." A keyed **stock** row shows, in place of its
checkbox, a moss check badge with the number under it — same size, same
column, so the row's shape doesn't change.

**Clearing / re-copying.** Clicking a green check or a stock badge opens one
small anchored popover (`KeyedPop`, widgets-style): "Keyed on ERP 48213 ·
today 9:14 AM · Marcus Mast" with **Copy again** (copies the line and
re-stamps it on the active order), **Clear** (`onClearStamp`, "NED only — the
ERP order is untouched"), **Keep**. No silent clear: today's latch is one-way
and resets on reopen; a persisted one needs a way back that can't be
mis-clicked.

**Remove an order.** A chip's × with no stamps removes it outright; with
stamps it confirms: "Remove order 48260? Its 1 stamped line goes back to
unkeyed." The last-added remaining order (or none) becomes active.

**Quote-option scope.** The panel may be scoped to an option (orderScope).
Stamps are by line id and ignore scope; the fine print's "N of M keyed"
counts the visible rows, the per-order counts the whole job.

**Footers.** Special and Stock footers keep the state-only rule; each adds
"3 of 4 keyed · 2 on 48213, 1 on 48260" when any line in that list is keyed.
Standing rules go behind the heading's `?`: "Copies stamp the active ERP
order. Copy remaining takes only lines not yet keyed; check a keyed line's
badge to copy it again or clear it."

### Boot light rows (`src/bootload.js`)

`LIST_SELECT_LEGACY` and `LIST_SELECT` both gain `, erp:data->erpOrders` (a
jsonb path projection never fails, so it belongs on both selects).
`lightRow` maps `erpNos: (Array.isArray(r.erp) ? r.erp : []).map(o => String(o?.no || "")).filter(Boolean)`.
A full record derives the same list from `erpOrders` (`erpNosOf(p)` in
erporders.js reads either shape, like `salesNameOf`).

The server-side sidebar search (`.or(ors)` in App.jsx) is not extended: the
customer browser's search runs client-side over the boot's light rows, which
carry every project.

### Customer browser — option 4C (`src/custbrowser.js`, `CustomerBrowser.jsx`)

- `BROWSER_COLS` gains `"erp"` right after `"projno"`. Existing saved column
  orders append it at the end (normColOrder's rule); fresh ones get it after
  Project #. Head label **ERP order**.
- `erpNos(projs)` — the customer's numbers, projects newest-edit first, each
  project's orders newest-added first, deduped. Cell: quiet mono like the
  Project # cell, at most three numbers then `+N`, full list in `title`.
- `erpHit(p, q)` — `q` is already trimmed + lowercased; a hit when any of the
  project's numbers contains the digit run of `q` (so `48213`, `482` and
  `#48213` all hit; a query with no digits never hits). Wired into
  `filterRows` and `unfiledRows` beside `projNoHit`.
- The project lines panel shows each project's numbers after its name as
  small moss tags (`✓ 48213`).
- No new filter chip: the column answers both "find by ERP number" and
  "which jobs have moved"; a blank cell is the not-moved signal.

### Project header — option 4A (`src/projectheader.jsx`, `mobile.jsx`)

Beside the `N214` eyebrow in both desktop layouts and the mobile band: a moss
chip `ERP 48213`; two or more orders → `ERP 48213 +1`, the full list in the
title. Rendered only when `erpOrders` is non-empty. The chip is a button that
opens the order-entry panel (`setShowOrderCopy(true)`), where the numbers are
managed — the header never edits them.

**Amended (final review, 2026-09-20):** "in both desktop layouts and the
mobile band" overstates the mobile chip — it renders (via the shared
`ErpChip` export from `projectheader.jsx`) but is **static** there, with no
click handler, because the mobile shell has no order-entry surface to open
(order entry, print and file actions all live only in the mobile ⋯ sheet).
Wiring a mobile order-entry surface is a desk-scoped task of its own, not
done in this wave.

### Not in this round

- Print: the order sheet and estimate don't show the ERP number. Its own ask.
- No per-line ERP line numbers, no sync from ERP 1, no "partly keyed" amber
  header state (option 4B, declined 2026-09-19). Rounds 1 (chips in the
  title row), 2 (a dropdown + fine print) and 3 (a strip above the bar) were
  superseded the same day by the round-5 bar; the mockup keeps them for the
  record.
- Server-side search by ERP number (see Boot light rows).

## Files

| File | Change |
|---|---|
| `src/erporders.js` + `.test.js` | new: normalizers, patch builders, `lineIds`, `keyedNo`, `remainingRows`, `erpCounts`, `erpNos`, `erpNosOf`, `erpHit` |
| `src/model.js` | `normC` → `erpOrders`, `erpKeyed` |
| `src/orderentry.jsx` | header bar (Deliver to / ERP order / Project + View columns, copyable N-number and name) replacing the title row and the Deliver to section; gate; stamping; 3B check; `KeyedPop`; Copy remaining; footers; tips |
| `src/App.jsx` | stable stock-material ids; pass `erpOrders`/`erpKeyed` + the four handlers (one `updateProject` each); header chip → open panel |
| `src/bootload.js` + `.test.js` | `erp:data->erpOrders` on both selects; `lightRow.erpNos` |
| `src/custbrowser.js` + `.test.js`, `src/CustomerBrowser.jsx` | `erp` column, `erpNos`, `erpHit` in both filters, lines-panel tags |
| `src/projectheader.jsx`, `src/mobile.jsx` | the ERP chip |
| `src/orderentrypreview.jsx` | fixture with two orders and a mix of stamps — the preview proof |
| `.claude/skills/floortrack-data-model/SKILL.md`, `src/CLAUDE.md` | the two fields, the id table, the write contract |
| `docs/adr/0044-erp-order-stamps-on-the-project.md` + README index | why on the project (not a table), why per-line, why the gate |
| `.scratch/147_erp-order-numbers/ticket.md` | the issue, preview shots |

## Testing

- `erporders.test.js`: `gated(proj)` — true only with a projectNo and no
  orders; normalize old records; digits-only `normErpNo`;
  dedupe on add; remove drops stamps; stamp/re-stamp/clear; `keyedNo` on
  plain, fully keyed, mixed and partly keyed merged rows; `remainingRows`
  excludes no-SKU rows but includes `byDesc` specials; `erpNos` ordering and
  dedupe; `erpHit` digit-run matching.
- `bootload.test.js`: `lightRow` maps `erp` → `erpNos`, tolerates null.
- `custbrowser.test.js`: `filterRows` hits on an ERP number; `BROWSER_COLS`
  order; `normColOrder` appends `erp` for an old saved order.
- Preview proof (non-negotiable 3): `order-entry-preview.html` shots of the
  bar locked (numbered, no order), one order with stamps, the two-order
  split, a quick price (ungated, empty Deliver to), and the phone-width fold; the customer
  browser column via the existing preview harness or a screenshot of the dev
  app.
- `npm test` green; `npm run build` clean.
