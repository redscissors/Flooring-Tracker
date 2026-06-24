Status: done
Type: HITL

## What to build

Move the whole Settings object (waste factor + the existing grout/mortar numbers)
out of the per-user `app_data` store and into a **single shared store** that every
signed-in user can read and write, per
[ADR 0002](../../docs/adr/0002-shared-grout-mortar-catalog.md). This slice does
**not** restructure Settings into the Company→Product catalog yet — it relocates
the existing Settings shape as-is, proving the shared-store path end-to-end.

- New shared settings table + RLS: read/write for any authenticated user (mirror
  the "public customer" sharing rule, not the per-user `app_data` rule).
- Migrate today's Settings into the single shared record. **Seed source is a human
  decision** (see HITL note) — default per ADR is the built-in defaults.
- Switch the settings load (`mergeSettings` on startup) and `setSettings` write
  from `app_data` to the shared store. The per-user `app_data` settings path is
  retired.

**HITL:** this is a one-way migration that collapses every user's private Settings
into one shared record. A human must confirm the seed source — discard per-user
coverage/price customizations in favor of the built-in defaults, or promote one
designated user's settings as canonical — before the migration runs.

## Acceptance criteria

- [ ] A new shared settings store exists with RLS allowing any signed-in user to
      read and write it.
- [ ] On load, the app reads Settings from the shared store; on edit, it writes
      there. `app_data` is no longer read or written for settings.
- [ ] Two different signed-in users see the same Settings; an edit by one is
      visible to the other after reload.
- [ ] Existing jobs still calculate grout/mortar exactly as before (numbers
      unchanged by the move).
- [ ] The seed source decision is recorded and applied as confirmed by the human.

## Unit testing

The app has **no test harness today** (no runner in `package.json`, no `src`
tests). The migration/seed helper (choose canonical settings → produce the single
shared record, idempotent on re-run) is pure and worth covering — recommend
standing up **vitest** in this slice and testing: (1) seed produces the agreed
canonical numbers, (2) re-running the migration is idempotent (doesn't duplicate or
overwrite an already-migrated shared record). The cross-user RLS behavior is an
integration concern (Supabase policies), out of scope for unit tests — verify it
manually per the acceptance criteria.

## Blocked by

None - can start immediately.
