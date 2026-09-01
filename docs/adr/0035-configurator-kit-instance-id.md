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

## Amendment 2026-08-31 — a staged entry carries its session

Step 3 adds a `session` sibling to every staged basket entry — `{ qtyOv, manual,
panelFit }` on wedi, `{ qtyOv, panelFit }` on Schluter, whose `markCfg` already
holds manual/source/pick. The reconfigure marker itself is unchanged and still
deliberately carries no session state: it is what Reconfigure reopens on, and a
stepped quantity is a decision about one emission, not about the configuration.
But a staged entry is not a marker — it is a build waiting to be placed, and the
salesperson has already seen its number. Without the sibling, staging a kit and
then moving it silently bills something other than what "Add to product lines"
would have landed a click earlier, which is exactly the drift the basket exists
to avoid. Each popup applies the sibling through the build column's own tail
(wedi `applySession`, Schluter `applyQtyOv`), one helper shared by the build memo
and the drawer so the two cannot disagree.

The scope boundary is staged entries only. Once a kit is PLACED its landed rows
are the truth — this ADR's derive-live rule — so the "In this project" figure
stays a marker-derived recipe price and reads the popup's live settings, not a
frozen session.

## Amendment 2026-09-01 — a staged entry can target the kit it updates

Step 3 left one gap the owner hit immediately: reconfiguring a placed kit and then
staging the edit produced a SECOND kit. "Add to product lines" replaced in place
(`landKitLines`), but the basket lane never could — `addToBasket` stamped a fresh
entry with no memory of where it came from, and Move always appended. Updating a
placed kit therefore meant building a new one and hand-deleting the old, which is
exactly the stranded-companion chore this ADR was written to end.

Two changes close it, both confined to the landing seams:

1. **The commit button says which it does.** A popup opened on an anchor already
   carrying that vendor's cfg is in EDITING mode — derived in App.jsx from the live
   row, never a flag the caller has to keep in sync — and its primary button reads
   "Update this kit" over "Add to product lines", with the payload modal retitled to
   match and an "Add as a new kit" escape hatch beside the confirm. The behavior was
   already replacement; only the label was lying.
2. **A staged entry carries an optional `target` `{areaId, rowId, kitId}`**, stamped
   when it is staged from a reconfigure. `moveKitEntries` (model.js) then routes each
   entry — targeted ones through `landKitLines`, the rest through `appendKitLines` —
   in ONE pass over the accumulating categories, so the caller still writes a single
   patch.

The target is honoured only while it still points at the kit that was staged. A row
that is gone, or that now belongs to a different kit, falls back to appending and is
counted as `stranded` for the caller to report: landing on whatever took the row's
place would silently clobber a kit nobody asked to touch, which is worse than a
duplicate the salesperson can see and delete. `kitId` is the staleness check and is
optional, since a legacy anchor has none.

Staging a second edit of the same kit REPLACES the first pending entry rather than
queueing both — two entries targeting one row would land one on top of the other,
and "the pending update to this kit" is the only thing that reading makes sense of.

The scope boundary is unchanged: only staged entries persist, placed kits are still
derived live from the rows.

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
