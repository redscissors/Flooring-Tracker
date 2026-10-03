---
issue_type: Feature
summary: Phone Clean layout — header A pinned above the job, areas as a flat
  list with thin sticky titles, product lines with a type dot
status: done
labels: [ready-for-human]
---

# Phone Clean layout

Owner, 2026-10-02: bring the desktop Clean look to the phone, built for the
Galaxy Z Fold 5's narrow front screen (344px). Picked from
`.scratch/mockups/mobile-clean-options-2026-10-02.html` ("Your pick").

- Spec: `docs/superpowers/specs/2026-10-02-phone-clean-layout-design.md`
- Plan: `docs/superpowers/plans/2026-10-03-phone-clean-layout.md`

## Proof

`check.mjs` drives the real app at 344×820 over a stubbed Supabase, asserts
on the DOM per case, and saves a shot per case. `before/` is today's phone.

Run with Vite up (`VITE_SUPABASE_URL=https://stub.supabase.co
VITE_SUPABASE_ANON_KEY=stub npx vite --port 5199 --strictPort`), then
`OUT_DIR=after node check.mjs`. Result: 25 PASS, 0 FAIL (`before/` had 17
FAIL; desktop passed both times).

| Case | Shot | What it shows |
|---|---|---|
| top | `after/top.png` | Header A, thin area titles, type dots, empty-area copy |
| scroll | `after/scroll.png` | The area you're in stays pinned under the header |
| name | `after/name.png` | Tapping an area name edits it; ⋯ opens the area menu with its "This area is in" heading |
| hold | `after/hold.png` | A long-press (Android contextmenu) on a title opens no menu |
| sheet | `after/sheet.png` | The row sheet covers the header |
| options | `after/options.png` | "2 options" opens ⋯; freight off is the amber struck truck |
| unassigned | `after/unassigned.png` | Unassigned in amber, long names, $12,558.00 Builder total fits |
| desk | `after/desk.png` | Desktop unchanged |

`header-preview-344.png`: the header in header-preview.html's 344px frame.
Ticket 169's repro still passes (one tap fills the line).

## Follow-up: the review's minors (owner 2026-10-03)

Owner: fix the six deferred minors, but keep the builder name off the phone
header. Five fixed, each pinned by a check case that failed first:

| Minor | Fix | Check |
|---|---|---|
| Bar had no shrink path | Both bar menus may shrink (`min-w-0`), labels truncate before the total | `wide`: Employee + Unit $ + $127,200.00 |
| Empty copy above a stray blank row | Copy only when the area's one row is the trailing adder | `stray` |
| Name capped at 70% with no address | Cap only when an address shows | `noaddr` |
| Pinned title vs Price book area | The active area is the one whose title is pinned (anchor `main` top + 18px, was 30% down) | `scroll` |
| Stale "Mobile keeps its own band" comment | Reworded | n/a |

Builder name: stays off the phone header (owner). Result: 32 PASS, 0 FAIL.
