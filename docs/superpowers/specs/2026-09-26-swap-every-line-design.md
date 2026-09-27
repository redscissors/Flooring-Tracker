# ⇄ on every line — shared slot model, sub-project 1b — design

**Date:** 2026-09-26 · **Status:** approved by owner in chat, section by section
· **Ticket:** `.scratch/158_shower-config-roadmap/ticket.md` (Phase 1)
· **Builds on:** 1a (`docs/superpowers/specs/2026-09-26-drain-slot-design.md`,
ADR 0049 — swaps remember the choice, not the part)

## Problem

After 1a the drain can be swapped at every level. The other bill lines can't:

- **Schluter.** ⇄ exists only on the point grate, the curb and the one-size
  board (`cfg.swaps`, which stores a part number). The KERDI membrane rolls,
  KERDI-BAND, board fasteners and bench parts have no swap.
- **wedi.** Panel, cover, frame, curb, sealant form, curbless entry and the
  niche/seat/bench/shelf add-ons swap, but each is a flat list, and the fastener
  kit has none. The saved marker writes the *resolved* `curbKey` and
  `panelKey` even when nobody picked one. A kit saved with the default 60″ curb
  keeps (and doubles) it after the opening grows past 60″, instead of switching
  to 96″ the way a fresh build does.

## Owner decisions (2026-09-26)

1. **Lines in scope:** membrane + band, fasteners + seals, bench / build-up
   parts. Setting material is out (ALL-SET white only; PRO-SET has no
   alternative).
2. **Popover:** the stepped popover (1a layout A) only where the catalog has
   more than one facet. Single-facet lines keep today's one-click list, which
   applies immediately.
3. **"Add another"** (e.g. a second band width) lands in 1c with the "+" on
   each group header. 1b is swap only.
4. **Storage: option A.** Extend today's fields. No shared `picks` map (option
   B was weighed and declined: its payoff is cross-brand choice carry-over,
   which nobody has asked for, and 1d aligns Compare on the line `slot` tags
   1a already stamps).
5. **Carry-overs from 1a's reviews are folded in** where they touch the same
   code (see §5).

## Design

### 1. Which lines, which popover

| Line | Brand | Facets | Popover |
|---|---|---|---|
| KERDI membrane | Schluter | Width (standard 1 m / wide 2 m) → Roll (**Auto** / each roll length) | Stepped (new) |
| KERDI-BAND | Schluter | Width (each width the book carries) → Roll (**Auto** / each roll length) | Stepped (new) |
| Board fasteners (KBZS) | Schluter | pack | List (new) |
| Framed-bench wrap board, 2″ build-up board, premade bench | Schluter | size / part | List (new) |
| Curb | wedi | Style (Full / Lean / AT / Cap) → Length (**Auto** / 60″ / 96″) | Stepped (was a flat list) |
| Wall panel | wedi | Type (standard / Vapor 85) → Thickness → Size | Stepped (was a flat list) |
| Fastener kit | wedi | kit | List (new) |
| Curb, one-size board | Schluter | length / size | List (unchanged) |
| Cover frame, sealant form, curbless entry, niche/seat/bench/shelf | wedi | one facet | List (unchanged) |

- **⇄ shows only when the line has more than one valid part.** The wedi
  Subliner pipe and valve seals, ALL-SET and PRO-SET show none today; the ⇄
  appears on its own if the book adds an alternative.
- **Stepped popovers** behave like 1a's: chips edit a draft, the summary
  strip shows what lands, why, the Δ against the committed line at the tier
  price, and the new total; **Use this** commits; Esc / outside click discards.
  An **Auto** chip is the default on a length/roll row, so the part re-fits the
  room.
- **List popovers** stay one-click and apply immediately.
- **Stock only:** stocked chips first; a special-order pick lands flagged `so`;
  a popover is never empty.

### 2. What gets saved

A choice is written only when someone swaps, and it records the choice, not
the resolved part, wherever the room can change the answer.

**Schluter** — `cfg.swaps` gains keys; `grate`, `curb`, `board` are unchanged:

```js
cfg.swaps.membrane = { wide: boolean, roll?: string }  // roll = the roll's length code ("10M"); none = best-fit mix
cfg.swaps.band     = { width: string, roll?: string }  // width = the KEBA width code ("125", "185"); none = today's rule
cfg.swaps.fastener = "<sku>"                           // the pack; its count already re-fits
cfg.benches[i].board = "<sku>"                         // framed wrap / 2″ build-up board, per bench
cfg.benches[i].part  = "<sku>"                         // premade bench (field already exists)
```

- **Membrane, no `roll`:** `pickRolls` runs within the chosen width.
  **With `roll`:** that roll, qty = ⌈need ÷ roll sf⌉.
- **Band, no `roll`:** today's rule (the shortest roll that covers, else
  multiples) within the chosen width. **With `roll`:** that roll, qty =
  ⌈lf need ÷ roll lf⌉.
- The classifier learns the band width from the SKU (`KEBA100/125` → 5″,
  `KEBA100/185` → 7¼″; the code's width in mm).

**wedi:**

```js
cfg.curbPick   = { sub: "lean"|"full"|"at"|"cap", len?: 60|96 } | { none: true }
cfg.panelKey   = "<key>"   // written only when picked
cfg.fastenerKey = "<key>"  // written only when picked
```

- **Curb, `curbPick` with no `len` (Auto):** the family's default length rule
  within the chosen style: a fundo pan takes 60″ up to a 60″ open edge, else
  96″; a linear pan takes 60″, multiplied to cover; any other pan family uses
  the fundo rule. If the style isn't made at
  that length, the longest made length is multiplied. **With `len`:** that
  length, multiplied to cover.
- `curbKey` is no longer written (like `coverKey` in 1a).
- **Panel / fastener kit:** the part is the choice; the count re-fits.

**Old saved kits — no bill moves:**

- **Schluter:** nothing to translate. The new keys are absent, so defaults
  apply.
- **wedi curb:** an old `curbKey` read inside `kitFor`:
  - equal to the default that pan and open edge would pick → no pick (it
    re-fits from now on);
  - `null` → `{ none: true }`;
  - any other key → `{ sub, len }` of that curb, length kept, so the bill is
    identical.
- **wedi panel:** an old `panelKey` equal to the default panel → no pick.
- **wedi fastener:** no old field exists.

Any saved pick counts as a customization: Schluter flips to Custom, and both
arm the kit-card overwrite confirm (`kitDirty`), the same as today's swaps.

### 3. Engines and popovers

- **One engine rule per stepped line**, and the popover asks the engine instead
  of duplicating rules (the 1a `resolveDrain` / `drainOptions` pattern):
  - Schluter: `resolveMembrane(choice, sfNeed, cat, { source })`,
    `membraneOptions(…)`, `resolveBand(choice, lfNeed, cat, { source })`,
    `bandOptions(…)`. `buildKit` calls the resolvers.
  - wedi: `resolveCurb(pick, openLen, fam)`, `curbOptions(…)`, and
    `panelOptions(…)` for the Type → Thickness → Size rows. `kitFor` calls
    `resolveCurb`.
- **One popover component.** `DrainSwapPop` becomes the generic `SwapPop` in
  `src/swappop.jsx` (`drainswap.jsx` is removed). The Δ formatter duplicated in
  both popups moves into it. Both popups mount it for the drain and every
  stepped line. List popovers keep today's markup.
- Every new line already carries its `slot` (1a).

### 4. Where the change reaches

The basket, `buildFromMarker`, Compare, order entry and print take their lines
from the engines, so a swap reaches all of them with no change there.

### 5. Carry-overs folded in from 1a

- The shared Δ formatter lives in `swappop.jsx` (§3).
- **An inert saved pick doesn't mark the build Custom.** A Schluter
  `drainPick` on a point tray, or a wedi cover pick that can't apply to the pan
  type, is kept in the marker (it revives if the room returns to that type) but
  doesn't count toward `mode` / `kitDirty`.
- **Chip labels:**
  - the point grate reads "4″ floral, brushed", not "kit 4″ floral brushed SS";
  - frames read `¾″`, not `3/4″`;
  - special-order chips carry the SO dot.
- **Missing engine tests** from 1a:
  - drain families at 36″;
  - stocked vs special-order at the same length;
  - `fit === 0`;
  - a point `{ key }` cover through `kitFor`;
  - the wedi frame re-sizing with the cover length;
  - the wedi round trip asserting the SKU.

Out of the carry-over list and left for later: the Schluter kit-card
thumbnails under a fixed drain pick, and the note-wording items.

## Testing

- **Unchanged defaults.** Every existing pinned bill and test passes
  untouched. No new pick → the exact bill of today, both brands.
- **Engine cases:**
  - membrane: standard / wide / a pinned roll / Auto re-fits when the wall
    area grows;
  - band: each width / a pinned roll / multiples;
  - wedi curb: each style × Auto across the 60″ boundary on fundo and linear,
    a pinned length, none, a style not made at the rule length;
  - wedi panel options;
  - stock only prefers stocked and still lands special order.
- **Old wedi markers, exhaustively:** every pan × every curb key (plus `null`)
  × the default and a widened open edge, and every panel key. Each reopens
  through `buildFromMarker` to the same bill the pre-1b code gives. Any bill
  that moves fails the test, except an exception listed in this spec after the
  owner sees it.
- **Round trips:** swap → marker → `buildFromMarker` gives the same bill, for
  each new key.
- **Preview proof** (`.scratch/158_shower-config-roadmap/p1b/`):
  - the membrane, band and wedi curb stepped popovers, each with a draft and Δ;
  - the wedi panel popover;
  - a list swap (fasteners);
  - the wedi curb re-fitting after a room change;
  - a one-part line showing no ⇄.

## Records

- **ADR 0049 amendment** (not a new ADR): 1b's lines and the wedi
  `curbPick` / write-only-when-picked rule.
- **Updates:** `src/CLAUDE.md` entries for `swappop.jsx` (replacing
  `drainswap.jsx`), `schluter.js`, `wedi.js` and both popups.
- **Ticket 158:** 1b in the Phase 1 section; the carry-over list trimmed to
  what's left.

### Amendments during planning and build (2026-09-27)

Calls the plan author made while prototyping and the controller ruled on
during execution (ledger: `.superpowers/sdd/2026-09-27-swap-every-line/progress.md`).

- **AT curb profile.** wedi's AT style is two parts at 60″ (full-foam
  `US3000048`, lean `US3000049`), so `curbPick` gains an optional
  `profile: "full" | "lean"`, and the popover shows a Profile row for AT only.
  With no profile, the cheaper stocked piece (lean AT) lands. An old AT
  `curbKey` translates with its profile, so the bill is identical.
- **Tile sf follows the marker.** `showersf.js` read `cfg.curbKey` directly for
  the tile-sf pieces; it now resolves the billed curb through `markerCurbKey`,
  the same way `kitFor` does, so tile-sf and bill read the same curb. A stale
  `curbKey` (not in the book) falls through to the recipe curb on both sides
  (owner confirmed R2, 2026-09-27; it first shipped as "enter manually" on the
  tile-sf side).
- **Default band width (owner 2026-09-27).** With no width chosen,
  `resolveBand` uses the narrowest width carried (5″, Schluter's standard and
  the KERDI-SHOWER-KIT band), stock-first. It used to search every width, so
  the landed width could follow registry row order. A popover draft of 5″ with
  no roll pinned stores no pick.
- **Stale curb keys bill the recipe, not nothing.** A stale wedi `curbKey` —
  not in the book — used to read as no curb; it now bills the recipe default
  curb instead, the Schluter `swaps` precedent (a stale sku falls back to the
  recipe rather than vanishing the line). Owner confirmed 2026-09-27.
- **Stale fastener/panel keys fall back with a note.** A stale wedi
  `fastenerKey` or `panelKey` — not in the book — falls back to the house
  kit/default panel and says so on the line ("… not in the book — house kit /
  default panel used"), rather than silently vanishing or silently
  substituting. `fastenerKey` is honoured only for the two boxed kits
  (`US5000070`, `US5000086`) — master packs, the Vapor 85 patch kit and loose
  self-tapping screws are not offered as a fastener-kit pick; an explicit
  house-kit pick keeps the recipe's own count. Unlike the Schluter `swaps`
  fallback (which keeps a stale sku standing in the marker), wedi does not
  re-write a stale `fastenerKey`/`panelKey` back onto the marker — the next
  save drops the stale pick rather than restating it.
- **A stale Schluter `swaps.fastener` / bench `board` falls back silently.**
  Same rule as the existing grate/curb/board swaps (the `swapped` lookup): a
  sku the catalog no longer carries falls back to the recipe's own part with
  no note on the line — a real part still bills, nothing is dropped, and
  nothing here changes that established behavior.
- **Stock only: stepped rows still show SO chips.** The stepped ⇄ gate
  (`steppedKind`) counts the whole catalog, while the list ⇄ gate (`canSwap`)
  counts only the Stock-only pool — so under Stock only a stepped popover
  (membrane, band, curb, panel) can still show a special-order chip, tagged
  with the SO dot, when that's the only alternative; a list popover never
  offers one the pool doesn't carry. This is deliberate (spec: a popover is
  never empty, and an SO pick lands flagged), not an inconsistency to fix.
- **Membrane scope and roll/band codes.** The membrane choice is wall-only —
  the mortar-bed floor keeps the recipe's `pickRolls`. An unsuffixed KERDI (or
  KEBA) roll's code is `"30M"`, the full roll. Band width labels come from a
  table, not a formula: 125 → 5″, 185 → 7¼″, 250 → 10″; any other width is the
  mm figure rounded to the nearest ¼″.
- **Options chips ask the resolver, not their own rule.** `membraneOptions` /
  `bandOptions` / `curbOptions` / `panelOptions` chip `ok` comes from running
  the resolver, not a hand-written predicate — spec §3's "the popover asks the
  engine instead of duplicating rules" outranks a hard-coded check, so a stale
  choice's rows show what the resolver actually lands, not what a rule guesses
  it should.
- **wedi panel ⇄ is walls-only.** The panel swap lives on the wall panel line
  only; the bench's own sheet line doesn't open it (it used to silently
  rewrite the walls' panel). The Type row carries a third chip, "Panel kit"
  (`US4000001`/`US4000002`).
- **Re-solves keep `curbPick`.** A room re-solve keeps `curbPick`, exactly as
  it keeps `coverPick`; a kit-card reset wipes both. "Turn into a curb" on a
  curbless pan now SETS `curbPick` to `{ sub: "lean" }` (Auto) directly —
  committed on the click, riding straight into the marker, not a draft a
  popover holds — where it used to pin the 60″ lean piece; Auto is a UI
  default for a one-click action, not a considered choice, so it costs
  nothing if wrong.
- **A curb pick belongs to its curb type.** Changing the room's curb type
  (Curbed ⇄ Curbless) clears `curbPick`: a Full curb picked for a curbed room
  must not bill on the curbless pan the re-solve lands, and a `{ none: true }`
  must not leave a curbed pan with no curb. Curbed again bills the recipe curb.
- **Bench board picks are per-build.** A bench's `board` pick is cleared when
  that bench's build changes (framed ⇄ site); the bench-wrap list popover
  offers ½″ boards only (`halfBoardPool`), the same pool the Walls one-size
  list draws from, so a fatter board can't sneak into a wrap line.
- **Swap lookups key on group (+ bench) + sku.** A list popover finds its line
  by group + bench index + sku, so a bench board or a floor sheet sharing a
  sku with another line's part can't hijack that other line's ⇄.
- **Browse-only wedi builds hide opts-backed ⇄.** In a Browse-only wedi build
  (no `build.pan`), the ⇄ on every line that writes build-derived options —
  cover, cover frame, curb, wall panel, fastener kit, joint sealant form, and
  the curbless recess/ramp pick — is hidden, not just curb/panel. Only the
  curb ⇄ crashed the popup before the guard; the others are hidden because a
  Browse-only build ignores the settings they write.
- **A kit build's Browse-added lines get no opts-backed ⇄.** A manual
  (`auto: false`) line in a kit build doesn't show those ⇄ either: the pick
  would rewrite the kit's own part and leave the manual line standing (a
  curbless kit plus a Browse curb, picking Lean, billed two curbs). The curb
  popover's Δ and quantity-override clearing count only the kit's curb.
- **Popover plumbing.** `buildKit` returns `need: { wallSf, bandLf }`, and
  bench lines carry their `bench` index; `kitFor` returns
  `curbFit: { openLen, fam }`. Both popovers read these off the build/kit
  result instead of re-deriving the sizing rule themselves.
- **Selectors kept.** Both popovers keep 1a's `data-drain-*` DOM attributes, so
  the 1a proof scripts still run unmodified.

## Out of scope (1b)

- "Add another" / "+" per group, several niches in wedi (1c).
- Shared group headings on screen, Compare row alignment (1d).
- A shared `picks` map (declined, decision 4).
- Setting-material swaps.
- Schluter kit-card thumbnails under a fixed drain pick; note-wording items
  from 1a's list.
