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

## Out of scope (1b)

- "Add another" / "+" per group, several niches in wedi (1c).
- Shared group headings on screen, Compare row alignment (1d).
- A shared `picks` map (declined, decision 4).
- Setting-material swaps.
- Schluter kit-card thumbnails under a fixed drain pick; note-wording items
  from 1a's list.
