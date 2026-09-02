---
issue_type: Feature
summary: "The kit-card confirm in the wedi and Schluter popups grows Keep what I
  added and New shower beside Overwrite/Cancel (one shared component); New shower
  detaches the popup from the kit it reopened so a second shower appends instead
  of replacing; both popups open Stock only by default and the wedi marker now
  carries the source so a saved kit reopens under the catalog it was built from."
status: done
labels: [ready-for-human]
---

# Kit-card confirm: three ways forward · Stock only default (owner 2026-09-02)

Started as "wedi can't add a second shower" — which the owner then traced to
the Reconfigure flow: opened on a placed kit, every Basket stage is an UPDATE of
that kit (issue 118), so a second shower built there replaced the first. The
first-class route to a second shower is now on the kit-card confirm itself.

## What changed

- **`KitOverwriteConfirm`** (widgets.jsx) replaces each popup's two-button
  modal: Overwrite · Keep what I added · New shower · Cancel. Shared so the two
  popups can't drift (the SourceSwitch / KitBasketPanel doctrine).
- **Keep what I added** — wedi `keepAdded`, Schluter `keepAdded`: the room's
  work rides onto the kit (walls, extra walls, corners, wall height, benches,
  add-ons, hand-added lines; Schluter also drain position, mortar, ramp, tile);
  stepped quantities and part swaps reset. A typed wall length that only
  tracked the old kit's auto geometry clears (retuneWalls / the Schluter
  mirror). The dialog says so in one line.
- **New shower** — `newShower`: stages the standing build (targeted if the
  popup was reconfiguring, else fresh) WITHOUT opening the drawer, then hard-
  resets to the chosen kit and sets `detached`; `edit`/`commitLines` route the
  rest of the session through the new-kit paths (Add to product lines →
  `onAddNew`, Basket → untargeted). Hidden where there is no basket.
- **Stock only by default** in both popups (the Apps hub included — same
  component). wedi's marker cfg gains `source` (build memo), its seedState
  reads it back (absent → "all"); Schluter already did both.
- ADR 0035 amendment 2026-09-02 and the data-model skill's wedi marker note.

## Preview shots (real popups over the real engines, driven end to end)

`shot-wedi.mjs` / `shot-schluter.mjs` against `npx vite --port 5199`; every
step asserts before it shoots.

| shot | what it proves |
|---|---|
| `*-1-stock-default.png` | a fresh popup opens on Stock only |
| `*-2-confirm-four-way.png` | the four-way confirm over a customized build |
| `*-3-keep-added.png` | Keep what I added: the second kit is the build AND the added extra (wedi sealant gun / Schluter KERDI-FIX) is still on |
| `*-4-reconfigure-update.png` | a placed kit reopened from the drawer reads "Update this kit" and reopens on Stock only |
| `*-5-new-shower-detached.png` | after New shower: basket badge 1, primary reads "Add to product lines" |
| `*-6-drawer-update-plus-new.png` | Basket then holds 2 staged — one wearing UPDATE (kit A's edit), one plain (kit B) |
| `*-7-two-placed-kits.png` | Move both → TWO placed kits (A replaced in place, B appended), not one |
| `wedi-8-source-roundtrip.png` | kit A updated under Full catalog reopens on Full catalog |

## Verification

- 1334 tests pass, 0 fail (no new .js logic — the changes are popup state and
  a shared dialog; the drives above are the behavioral proof)
- `vite build` exit 0 (with the two VITE_SUPABASE_* env vars the HTML needs);
  lint unchanged at the pre-existing 2 errors in WediConfigurator.jsx (`useId`,
  `CORNER_CUT` unused — not this change's lines)
