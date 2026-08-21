# 0034 — Cross-vendor compare: one dual-engine module, host build vs derived kit, options A/B in one patch

Date: 2026-08-21 · Status: accepted

## Decision

The **Compare** tab (issue 097 phase 5, prototype P3) prices one room in both
shower systems side by side and can land both bills on the job as quote
options. Five decisions were made building it, each of them the kind a later
change could quietly undo.

### 1. `comparekit.js` is the one dual-engine module, and it never boots

`src/comparekit.js` is the first module to import `wedi.js` and `schluter.js`
together, and outside the compare chunk it should stay the only one —
`CompareTab.jsx` imports both engines too, for each side's `lineItems`, but
that file is the compare chunk. It owns the mapping and nothing
else: neither engine learns about the other, and neither engine's pinned
totals can move because a compare feature changed (no edits to either engine
landed this phase).

That import is expensive: wedi carries ~2,000 rows of transcribed tables and
Schluter pulls its adapter and grammar. So the whole thing stays off every
boot path (ADR 0026). The chain is `popup (React.lazy) → CompareTab.jsx
(React.lazy) → comparekit.js → both engines`. Concretely:

- `App.jsx` may import `options.js` (for `compareOptionsPatch`, model-only)
  but **never** `comparekit.js` or `CompareTab.jsx`.
- **The popups never import `comparekit.js` either.** Each one hands its raw
  live cfg over as `hostCfg` and the neutral room is derived *inside*
  `CompareTab`. This is why `roomFromWedi`/`roomFromSchluter` take a cfg
  rather than the popups passing a room: it keeps the two engines meeting in
  exactly one lazy chunk.
- `useschlutercatalog.js` (the registry→catalog assembly, extracted so the
  wedi popup can build the Schluter catalog too) imports
  `schluteradapter.js`, so it is lazy-chunk-only for the same reason.

Verified per build: the boot chunk contains no `KERDI`, no `Fundo`, no
`comparekit`; `CompareTab-*.js` is its own chunk.

### 2. Categories align by semantic map, not by string join

The seven compare rows (`Base/Drain/Walls/Seams/Curb/Setting/Extras`) are a
**neutral vocabulary**, not either engine's own. Schluter lines already carry
a group token in `l.g`; wedi lines are mapped from the catalog `item.group`
through an explicit `WEDI_CAT` table, and anything unmapped falls to
`Extras`. No line is matched to its counterpart by name, SKU, or description.

The alternative — joining the two bills on text — was rejected outright: a
live Schluter row's name is `normOrderItem`'s cleaned, title-cased vendor
description (ADR 0032), so a name match is a silent-miss machine, and the two
systems genuinely do not have counterpart parts (wedi extends pans; Schluter
only cuts trays). A semantic map degrades honestly: a part with no opposite
number leaves the other column's cell empty, which is the comparison.

`noteOnly` rows are **kept** as $0 rows (wedi's "thin-set for pan bed — by
others", Schluter's "cement board / drywall substrate — by others") and
excluded from the totals. Together they *are* the walls difference, which the
delta line's caveat then names in words.

### 3. Host column = the live build; the other column = that engine's house kit

The popup you opened shows what you have on screen — add-ons, swaps, the
solver option you picked. The other column is that engine's **default house
kit for the same room**, derived fresh.

This is deliberately asymmetric, and the asymmetry is visible in the proof:
the same 60″×38″ room reads $1,480.94 for wedi in the wedi popup (the
solver's own panel plan) and $1,360.65 in the Schluter popup (the derived
kit). Two symmetric alternatives were rejected: deriving *both* sides would
throw away the salesman's actual build and answer a question nobody asked,
and letting the guest side be customized would mean building a second
configurator inside a comparison. The guest column is a quote-grade estimate
of the other road, not a build.

### 4. Delivery "A + C": fresh sibling option areas, one patch, deliberately not `duplicateInto`

The owner's recommendation was A (compare in the popup) plus C (land both
bills as quote options). `compareOptionsPatch` (in boot-side `options.js`,
model imports only) inserts **two fresh sibling areas** right after the host
area — `{...newArea(), ...}` tagged option A and B, each side's lines mapped
through `newProduct` — and fills `{A:"wedi", B:"Schluter"}` into option name
slots only where they are still empty.

It does **not** go through ADR 0031's `duplicateInto`. That function retags a
copy of shared work, and these areas are not copies of anything: they are two
new bills for the same room, with no shared source to retag. Reusing it would
have carried retag semantics that are wrong here and coupled the compare
surface to the duplication path.

It returns **one patch object** for the caller's single `updateProject` call.
`useDirectory`'s setter is built off a stale closure, so two `updateProject`
calls in one tick clobber each other — hence one patch, and `null` when
either side is empty. Because the areas are ordinary ADR 0031 option areas,
the estimate prints them side by side with no new print work.

### 5. Prices are always computed at open time, from the same sources as the popups

Nothing in the compare surface is cached, snapshotted, or stored. Every
figure comes back out of the engine that produced the line — wedi's own
`tierPrice` off its transcribed tables, Schluter's off the live registry rows
— through the same `useSchluterCatalog` assembly the Schluter popup uses,
gated on `bookStockReady` and re-fetching its order books on open (ADR 0026).
The two builder lenses stay separate knobs (`wedi ×0.82`, `schluter −8%`);
neither moves the other.

This is a consequence of ADR 0032, not a new rule: with pricing registry-
driven, a re-import reprices the compare surface with no code change, and
there is no stale copy to invalidate. Its cost is the flip side, also from
0032 — with no Schluter rows in the books the Schluter column is inert, and
says so in one faint cell naming the import path rather than crashing or
showing zeros. Every column that cannot be built (no wedi pan solves the
room, no room typed, books still loading) renders that same single
explanatory cell, and the delta line hides itself.

## Open — owner calls this phase surfaced, not decided

- **No like-for-like KERDI-BOARD toggle on the compare surface.** The derived
  Schluter side is always membrane walls, so the walls row compares a
  structural wedi panel against a membrane that still needs backer by others.
  Today that is carried by *words* — the caveat sentence in the delta line
  and the Walls diffnote. A toggle that re-derived the Schluter side on
  KERDI-BOARD would make the comparison structural instead of textual. The
  popup already has the fork; the compare tab does not expose it.
- **Landing options A/B gives no feedback in the popup.** The confirm modal
  closes and the two areas appear behind it; there is no toast, no
  auto-close, no navigation to the new areas. Deliberately left alone rather
  than guessed at — whether the popup should close, ping, or stay put is a
  workflow call.

## Consequences

- Anything that wants to compare a third vendor extends `comparekit.js`'s
  neutral room and category map — it does not add a second dual-engine
  module. A future engine also needs a `*CompareRows` mapper, not a name
  match.
- A new wedi catalog `item.group` that isn't in `WEDI_CAT` silently lands in
  `Extras`. That is the intended failure mode (visible, not lost), but it
  means adding a group is a two-file change.
- The compare surface reads the source switch but owns no engine rules: under
  Stock only the columns re-rank because `pickFrom`/`stockPool` did it inside
  the engine, not because the compare layer filtered anything.
- Preview proof for all of the above lives in
  `.scratch/097_schluter-configurator/phase5-proof/` (shots c1–c5 + the
  `shoot-compare.mjs` rig).
