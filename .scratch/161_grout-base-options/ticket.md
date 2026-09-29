---
issue_type: Feature
summary: A grout can carry several base units (★ default + alternates); the
  row's grout pop-up picks one after the joint width, the project remembers
  the grout type and base for the next row, and Extras orders each base
  across the whole job.
status: done
labels: [ready-for-human]
---

# Grout base options

Owner, 2026-09-29: SpectraLock Pro also sells a Commercial unit (base for four
color kits) and PermaColor Select an Unsanded base — add them in Materials and
pick them on the job. Spec:
`docs/superpowers/specs/2026-09-29-grout-base-options-design.md`; decision:
ADR 0006 amendment 2026-09-29; mockup:
`.scratch/mockups/grout-base-picker-2026-09-29.html`.

Preview proof: the REAL App over a fake Supabase client —
`npx vite --config .scratch/161_grout-base-options/vite.config.mjs`, then
`node .scratch/161_grout-base-options/shot.mjs`.
