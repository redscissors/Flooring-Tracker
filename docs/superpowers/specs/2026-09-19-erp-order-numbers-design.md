# ERP 1 order numbers — design

**Date:** 2026-09-19 · **Status:** picks made by owner in chat; spec awaiting owner review
**Mockup:** `.scratch/mockups/erp-order-2026-09-19.html` (sections 1B, 2A, 3B, 4A, 4C picked)

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

The order-entry panel gains the number field in its header (left of the view
switch), collapses it to chips once a number is in, gates every line copy on
having an order, stamps each copied line with the active order, and shows the
stamp as the number under the line's green check. **Copy remaining** replaces
Copy all. The project header wears an `ERP 48213` chip beside the N-number,
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
  ride the jsonb.
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

### Patch builders (`src/erporders.js`)

Each returns `{ erpOrders, erpKeyed }` for ONE `updateProject(id, patch)` call
(usedirectory's setter closes over stale state — two calls in one tick clobber
each other, the options.js lesson).

- `addErpOrder(proj, no, who)` — appends `{ no, addedBy: who, addedAt }`;
  a duplicate returns the project unchanged (the panel selects that chip).
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
  header note and the chip counts (counted over `erpKeyed` for the chips,
  over the visible rows for the note).
- `who` = `profile.name || user.email || ""` (the samples doctrine).

### The panel (`src/orderentry.jsx`) — option 1B + 2A + 3B

`OrderEntryPanel` stays pure presentation. New props:
`erpOrders`, `erpKeyed`, `onAddOrder(no)`, `onRemoveOrder(no)`,
`onStamp(ids, no)`, `onClearStamp(ids)`. App.jsx wires each to one
`updateProject` through the builders above. The preview harness passes
fixtures and no-op handlers.

**Header, third row** (left of the Compact / Area + vendor / Sheet order
switch):

- No order: an amber-outlined field `ERP # [required] Add`. Digits only
  (`inputMode="numeric"`, non-digits stripped on input, max 10). Enter or
  Add calls `onAddOrder`. Under the row, one amber line: "Enter the ERP 1
  order number to unlock the line copies. Deliver to works now."
- One or more orders: one chip per order in added order, `ERP 48213 · 4 ×`
  (the count = stamps on that order across the whole job; omitted at 0), the
  active one filled moss, then a dashed `+`. Click a chip → it becomes
  active. `+` opens the same field inline after the chips; Esc or an empty
  Add closes it; a number already present selects that chip. Under the row,
  one quiet line: "Copies stamp order 48260 · 5 of 7 keyed · 2 still to key"
  (the tail only while something is unkeyed; "Every line is keyed" at zero).
- The row wraps at the panel's 560px: two chips, `+` and the switch fit one
  line; a third order pushes the switch down a line. The lists don't move.
- **Active order** is panel state: initialised to the last entry of
  `erpOrders`, reset on every open. Not stored.

**Gate.** With `erpOrders` empty: every special-line copy button and Ext
button, Copy remaining, Copy selected, and every stock checkbox are disabled
(`disabled:opacity-30`, title "Enter the ERP 1 order number first"). The
Deliver to block is never gated — it fills the ERP header that produces the
number.

**Stamping.** A copy that succeeds calls `onStamp(lineIds(row), active)`:
- a special line's copy button (the description); the Ext button does NOT
  stamp (it's the second half of the same line);
- **Copy remaining** — `remainingRows` of the visible view, one `onStamp` with
  every id (merged rows contribute all their sources), label
  `Copy remaining (N)`; at N = 0 disabled with title "Everything is keyed";
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
stamps it confirms: "Remove order 48213? Its 4 stamped lines go back to
unkeyed." The last remaining chip (or none) becomes active.

**Quote-option scope.** The panel may be scoped to an option (orderScope).
Stamps are by line id and ignore scope; the header note counts the visible
rows, the chip counts the whole job.

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

### Not in this round

- Print: the order sheet and estimate don't show the ERP number. Its own ask.
- No per-line ERP line numbers, no sync from ERP 1, no "partly keyed" amber
  header state (option 4B, declined 2026-09-19).
- Server-side search by ERP number (see Boot light rows).

## Files

| File | Change |
|---|---|
| `src/erporders.js` + `.test.js` | new: normalizers, patch builders, `lineIds`, `keyedNo`, `remainingRows`, `erpCounts`, `erpNos`, `erpNosOf`, `erpHit` |
| `src/model.js` | `normC` → `erpOrders`, `erpKeyed` |
| `src/orderentry.jsx` | header field/chips row, gate, stamping, 3B check, `KeyedPop`, Copy remaining, footers, tips |
| `src/App.jsx` | stable stock-material ids; pass `erpOrders`/`erpKeyed` + the four handlers (one `updateProject` each); header chip → open panel |
| `src/bootload.js` + `.test.js` | `erp:data->erpOrders` on both selects; `lightRow.erpNos` |
| `src/custbrowser.js` + `.test.js`, `src/CustomerBrowser.jsx` | `erp` column, `erpNos`, `erpHit` in both filters, lines-panel tags |
| `src/projectheader.jsx`, `src/mobile.jsx` | the ERP chip |
| `src/orderentrypreview.jsx` | fixture with two orders and a mix of stamps — the preview proof |
| `.claude/skills/floortrack-data-model/SKILL.md`, `src/CLAUDE.md` | the two fields, the id table, the write contract |
| `docs/adr/0044-erp-order-stamps-on-the-project.md` + README index | why on the project (not a table), why per-line, why the gate |
| `.scratch/146_erp-order-numbers/ticket.md` | the issue, preview shots |

## Testing

- `erporders.test.js`: normalize old records; digits-only `normErpNo`;
  dedupe on add; remove drops stamps; stamp/re-stamp/clear; `keyedNo` on
  plain, fully keyed, mixed and partly keyed merged rows; `remainingRows`
  excludes no-SKU rows but includes `byDesc` specials; `erpNos` ordering and
  dedupe; `erpHit` digit-run matching.
- `bootload.test.js`: `lightRow` maps `erp` → `erpNos`, tolerates null.
- `custbrowser.test.js`: `filterRows` hits on an ERP number; `BROWSER_COLS`
  order; `normColOrder` appends `erp` for an old saved order.
- Preview proof (non-negotiable 3): `order-entry-preview.html` shots of the
  locked header, one order with stamps, and the two-order split; the customer
  browser column via the existing preview harness or a screenshot of the dev
  app.
- `npm test` green; `npm run build` clean.
