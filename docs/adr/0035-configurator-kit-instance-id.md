# Configurator kits carry a shared `kitId`; reconfigure replaces the kit group; the basket derives placed kits from the rows

Date: 2026-08-28 · Status: Accepted

Every configurator emission (Sheoga, wedi, Schluter) lands its lines — anchor plus
companions — stamped with one shared top-level `kitId` (a fresh uid per emission,
stamped at landing time, passed through `normP`). Reconfigure-and-Add then replaces
the whole kit group instead of today's replace-the-anchor-and-append, which stranded
every previous companion row in the area (a reconfigured 12-line wedi kit left 11
stale rows to hand-delete) — the data model always *documented* the wedi marker as
"replaces the kit's lines"; this makes the code do it. The id also disambiguates two
kits of the same vendor in one area and is the link the later basket work needs.

The follow-on decision this records for steps 2–3: the basket never becomes a second
persisted registry of placed kits. Saved versions snapshot `categories` only, so a
basket that owned placed lines would desync on every version restore; and the anchor
row already carries the complete config. The basket's "in this project" list is
**derived live from the anchor markers**; only unplaced (staged) entries persist, and
delete-on-move (the 2026-07-18 basket spec) stands — a moved entry changes state from
staged to placed rather than being lost. The one true information loss on move today
is the Sheoga multi-width bundle (each width line keeps only its own single-width
cfg); step 2 stamps the bundle snap onto the first line's marker.

## Consequences

- **Replacement rules.** With a `kitId` on the reconfigured anchor, every row sharing
  it (any area) is replaced — *unless* the group holds another cfg-bearing row (a
  Sheoga bundle sibling, or a duplicated anchor), in which case replacement is refused
  and the old append behavior stands, so a sibling width is never deleted by editing
  its neighbor — with one exception (step 2): an anchor whose marker carries the
  bundle snap owns its whole group, so re-emitting the bundle, or editing it down to
  a single, replaces every width and pooled fee. A legacy anchor (saved before
  `kitId`) falls back to consuming the
  contiguous run of same-vendor, `kitId`-less companion rows directly below it —
  rows carrying a different `kitId` are never consumed, so a stamped kit sitting
  below a legacy one is safe. A fresh add (anchor without a same-vendor cfg marker)
  never removes anything.
- **Duplicate strips `kitId`.** LineMenu's Duplicate inserts the copy directly above
  the original's companions; a copied `kitId` would make reconfiguring the duplicate
  delete the original's rows. The copy lands `kitId`-less (legacy-style). An AREA copy
  (`duplicateInto`, quote options) instead REMAPS kitIds per copy — the copy keeps kit
  semantics but is its own group.
- **Replacement re-lands snapshots.** Re-emitting reprices every line of the kit from
  the current tables/registry (ADR 0003/0018 are unchanged — the rows are still
  snapshots; the *user* chose to re-land them). Hand edits to companion rows are
  replaced with the kit: a kit's companions belong to the kit's config, unlike a
  standalone row's manual override (the qtyDrift doctrine). A confirm showing the
  price delta before clobbering is follow-up UI, not part of this change.
- Stamping happens at the landing seams (`stampKit`, idempotent — lines already
  carrying a `kitId` keep it, so per-entry basket stamps survive the shared landing
  helpers), never inside the engines: `lineItems` outputs stay deterministic and
  the pinned engine tests untouched.
