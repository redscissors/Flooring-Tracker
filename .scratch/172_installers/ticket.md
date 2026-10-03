---
issue_type: Feature
summary: Installers — a team directory in Settings → General, a hammer picker
  in the project header, a box beside the areas, and a print block
status: done
labels: [ready-for-human]
---

# Installers

Owner, 2026-10-03. Design approved in chat from
`.scratch/mockups/installers-2026-10-03.html`; spec
`docs/superpowers/specs/2026-10-03-installers-design.md`; ADR 0057.

Proof: the real app over a stubbed Supabase (the .scratch/169 harness).
Needs Vite up:

    VITE_SUPABASE_URL=https://stub.supabase.co VITE_SUPABASE_ANON_KEY=stub npx vite --port 5199 --strictPort
    OUT_DIR=after node check.mjs

Cases: `box` (hammer badge, box level with the first area), `empty` (no box
until an installer is picked; the column re-centers), `picker` (order,
click-to-add), `narrow` (1280 — no box), `print` (block, stacked trades, no
priority), `settings` (Manage → General → Installers), `addnew` (add an
installer), `phone` (344px: the bar still fits, the hammer's sheet adds on
tap). `phonebar` prints the bar's child widths with and without the hammer.
All pass; shots in `after/`. The phone follow-up also re-ran
`.scratch/170_phone-clean-layout/check.mjs`: all pass.
