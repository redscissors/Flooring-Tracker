---
issue_type: Feature
summary: Phone Clean layout — header A pinned above the job, areas as a flat
  list with thin sticky titles, product lines with a type dot
status: open
labels: [ready-for-agent]
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
