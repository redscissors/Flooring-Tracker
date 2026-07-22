# ADR 0028 — Refresh restores the open overlay; Escape closes a layer in one press from inside a text field

- **Status:** Accepted
- **Date:** 2026-07-22
- **Scope:** system-wide (Escape ladder + overlay lifecycle)
- **Related:** extends the `ft-last-open` spot restore and the escstack.js
  ladder; respects [ADR 0011](0011-margin-visibility-ephemeral.md)'s
  ephemeral toggles (margin/order-copy are deliberately NOT restored);
  [ADR 0026](0026-two-stage-boot-and-loading-policy.md) governs when the
  restored surfaces may mount (post-boot, lazy chunks).

## Context

Two owner requests (2026-07-22): a page refresh should reopen the popup that
was on screen — the Sheoga configurator mid-build, Settings on the Price book
section — instead of dropping to the underlying screen; and Escape pressed
while the cursor sits in a text box should leave the popup/screen directly,
not spend the first press "stepping out of the text box".

The Escape ladder (escstack.js) deliberately blurred-first: field-local Escape
semantics (dismissing a search panel, cancelling a rename) lived on the
element with no way to tell the ladder "handled", so the blur step kept a
panel dismiss from also closing the surrounding modal. That made *every*
popup a two-press exit whenever focus was in a field — the common case, since
popups autofocus their inputs.

## Decision

1. **One press.** `handleEscKey` blurs a text-entry target AND fires the top
   ladder entry in the same press. Field-local Escape handlers keep precedence
   by calling `ev.preventDefault()` — the ladder already skips
   `defaultPrevented` events. The contract for any new field-local Escape
   handler: **claim the press with `preventDefault()` only when it actually
   dismissed something** (search widgets condition on their panel being
   visible), otherwise let it fall through to the ladder.
2. **SELECT stays blur-only.** A native dropdown's Escape close is
   indistinguishable from a plain press, and closing a layer underneath it
   would eat the dismiss.
3. **The open overlay persists per device** in localStorage `ft-open-layer`
   (beside `ft-last-open`, same restore pass): Settings (with its left-nav
   section, so the Price book reopens on Price book), the Apps hub, the
   customer browser, the issues list, and the Sheoga configurator. The
   configurator additionally streams its live `{ mode, cfg }` into the stored
   layer (`onConfigChange`), so a refresh reopens it mid-configuration, not on
   its opening seed. Manual opens are unchanged (Settings still opens on its
   default section); only the refresh path reads the key.
4. **Restore is best-effort and self-clearing.** The layer restores once,
   after boot and after the `ft-last-open` spot restore; the Sheoga layer
   waits for the restored project's full record and is dropped silently if
   its project or row no longer exists. Ephemeral-by-design state (ADR 0011's
   margin reveal, the order-copy panel, transient confirms/menus) is never
   stored.

## Why

- **preventDefault over blur-first** keeps both behaviors without a registry
  of "field panels": the element that owns local Escape semantics is the only
  thing that knows whether it consumed the press.
- **A device-local key over Supabase state**: which popup is open is view
  state for one person on one machine — the shared data model (ADR 0004) is
  the wrong home, and localStorage is the established pattern
  (`ft-theme`, `ft-header`, `ft-last-open`).
- **Storing the Sheoga config in the layer key, not on the row**: the row's
  `sheoga` field is an ADR 0003-style snapshot written only on Add; a
  half-built configuration must not touch job data.

## Consequences

- Escape in a plain text box on the main screen now navigates (project →
  customer → home) immediately — the old first-press-blurs step is gone
  everywhere, per the owner's request.
- New field-local Escape handlers MUST follow the preventDefault contract or
  their press will also close the surrounding layer.
- The stored layer can go stale (project deleted on another machine); restore
  drops it rather than erroring.
- `ft-open-layer` adds one more device-local key to the ft-* family; signing
  out does not clear it, so the next sign-in on that device restores the same
  surface.
