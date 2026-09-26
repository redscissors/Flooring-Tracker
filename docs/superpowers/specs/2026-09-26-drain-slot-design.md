# Drain slot — shared slot model, sub-project 1a — design

**Date:** 2026-09-26 · **Status:** approved by owner in chat, section by section
· **Ticket:** `.scratch/158_shower-config-roadmap/ticket.md` (Phase 1)
· **Mockup:** `.scratch/mockups/drain-swap-2026-09-26.html` (layout A chosen)

## Problem

The shower configurators can only swap a few lines, and each brand does it its
own way:

- **Schluter.** `cfg.swaps` holds a part number for three roles: grate, curb
  and One-size board. A linear build has no grate line and no swap at all: it
  is always a Vario channel plus the Vario flange kit. The 524 KERDI-LINE rows
  that P0-2 made classifiable (fixed bodies, framed/thin-frame/frameless grates)
  are in the catalog, but no build can use them.
- **wedi.** The popup swaps more lines, but the saved marker stores the
  *resolved* pick (`coverKey`, `curbKey`, `panelKey` are always written).
  Two things follow. A reopened kit looks swapped on every role. And a linear
  cover is pinned to its old SKU, so it no longer follows the channel length
  when the room changes.

The owner's priority for Phase 1 (2026-09-26) is **drain swaps at every level**.
That means family (Vario / fixed KERDI-LINE / frameless / point), then length,
then grate. Fixed lengths size themselves to the wall.

Phase 1 is split into four sub-projects, each with its own spec, plan and PR:

| # | Sub-project | Status |
|---|---|---|
| 1a | Drain slot, plus the shared slot vocabulary | **this spec** |
| 1b | ⇄ on every other line (board, membrane, band, curb, corners, setting); fixes wedi's resolved-pick markers for curb and panel | later |
| 1c | "+" on each group header; several niches in wedi | later |
| 1d | Both bills read the same group names; Compare lines up row for row | later |

## Owner decisions (2026-09-26)

1. **Approach A: a swap remembers the choice, never the part.** A saved swap
   holds the family, style, frame and finish. The engine resolves it to part
   numbers on every build, so lengths follow the room. B (store parts and look
   for a sibling on re-fit) and C (one shared recipe engine) were rejected.
2. **Default stays Vario.** Today's bills don't change; the other families are
   reached through ⇄.
3. **Vario sizing** (already shipped in PR #436): take the shortest channel at
   least as wide as the pan, and cut it to the pan's installed width.
4. **Fixed KERDI-LINE** bills a **channel body + grate** and nothing else. The
   length is the **longest 4″ step that fits** the pan width.
5. **Frameless:** a fixed body plus the frameless tileable grate. The **offset
   body (KL1VO60E) takes only the offset frameless grate (KL1DROE)**.
6. **Room change after a swap:** keep the choice and re-fit the length.
7. **Popover layout A:** stepped, family → grate → frame → finish, with a
   summary strip.

## Design

### 1. The shared slot vocabulary — `src/slots.js` (new)

A pure, import-free module that both engines and Compare read:

```js
export const SLOTS = ["tray", "drainBody", "grate", "flange", "wallBoard", "wallMembrane",
  "seam", "corners", "niche", "bench", "curb", "setting", "extra"];
export const SLOT_LABEL = { tray: "Tray", drainBody: "Drain body", grate: "Grate / cover",
  flange: "Flange", wallBoard: "Wall board", wallMembrane: "Wall membrane", seam: "Seam / band",
  corners: "Corners", niche: "Niche", bench: "Bench", curb: "Curb", setting: "Setting material",
  extra: "Extras" };
```

In 1a, every bill line in both engines gets a `slot` field:

- Schluter `buildKit` sets it at each `add(…)` call site.
- wedi `kitFor` sets it at each `push(…)` call site, as a new sixth argument.

Only the drain slots (`drainBody`, `grate`, `flange`) change behaviour in 1a.
The other tags are data for 1b to 1d. Nothing renders them yet, and no bill
changes.

### 2. What a drain choice saves

**Schluter.** A new optional marker field is written only when someone swaps:

```js
cfg.drain = {
  family: "vario" | "fixed" | "frameless",
  // vario: the channel's grate design + finish (KLVRID<design><finish><len>)
  design?: "3" | "5" | "13" | "14",          // square / floral / herringbone / slant
  // fixed: grate style + frame height (KL1<style><frame><finish><len>, KLTFH<frame>E<len>)
  style?: "solid" | "perforated" | "lock" | "floral" | "curve" | "pure" | "tile",
  frame?: '3/4"' | '1-1/8"' | '29/32"' | '1/4"' | '1/2"' | '7/8"',
  // every finish code the 2025-10-01 EFT carries on KERDI-LINE / Vario grates
  finish?: "EB" | "EP" | "MBW" | "MGS" | "TSBG" | "TSC" | "TSDA" | "TSG" | "TSI" | "TSOB" | "TSSG",
  offset?: boolean,                           // fixed / frameless: KL1VO body
}
```

The point-drain grate keeps `cfg.swaps.grate` (a part number). Point grates have
no length, so pinning the part is already the choice.

**wedi.** The marker gains `coverPick`, written only when someone picks a cover:

- **Linear pan:** `{ style, finish }`. It resolves through `linearCoverFor` at
  the channel's length.
- **Point pan:** `{ key }`. No length applies.

`coverFrame` stays as it is, because it already saves a finish.

**Old markers.** No saved kit's bill moves. Reading an old marker:

- No `cfg.drain` → Vario, exactly as today.
- An old wedi `coverKey` on a **linear** pan → read as
  `coverPick { style, finish }` of that key, so the cover follows the channel
  length.
- An old wedi `coverKey` on a **point** pan → read as `{ key }`.

A reopened wedi kit whose cover nobody picked starts following the channel
length. That is the fix. A picked cover stays picked. `normP` passes markers
through unchanged, and the read side does the translating (`seedState`,
`buildFromMarker`).

### 3. Resolving a choice into parts

**Schluter: `resolveDrain(choice, panW, cat, { source })`** in `schluter.js`.
It replaces the inline linear branch of `buildKit` and returns the drain lines,
each tagged with its slot and carrying a note. `panW` is the pan's installed
width (`benchTrayRoom(benches, cfg).w`).

- **Vario.**
  - **Channel:** the channels in the chosen design and finish (default: any),
    stocked first; the shortest with `len ≥ panW`. Note: `cut to {panW}"`.
  - **No channel in the chosen design is long enough:** take the shortest that
    is, in any design. Note: `"<design> not made at this length — <design used>"`.
  - **Nothing is long enough:** the longest channel, with the existing
    "runs short" note.
  - **Flange:** the Vario flange kit, as today.
- **Fixed.**
  - **Body:** from `g:"line", part:"body"` rows with the chosen `offset`.
  - **Grate:** from `g:"line", part:"grate"` rows matching style, frame and
    finish. Offset bodies pair only with the frameless offset grate.
  - **Length:** take `L` = the longest length **≤ panW** at which **both** the
    body and a matching grate exist. If that is shorter than the longest body
    that fits, the note says `"stepped down from {longest}"` (floral, curve and
    pure top out at 48″).
  - **Bill:** body + grate, both at `L`. Note: `fill {panW − L}" at the ends`.
- **Frameless:** the fixed rule with the grate `frameless: true`, matching
  `offset`.
- **Stock only:** a stocked match wins at every step (the `pickFrom`/`stockPool`
  rule). A combination with no stocked match still lands, flagged `so`, so the
  role never vanishes.
- **Fallback.** If a fixed or frameless choice can't be built at all (the pan is
  under 20″, or no length has both a body and a grate), the drain falls back to
  Vario. The first drain line's note names the reason. Nothing is silently
  dropped.
- **Drawing (`schluterdraw.js`).** A fixed or frameless channel is drawn at its
  real length `L`, centred on the back wall. Vario stays full pan width. The cut
  list adds `"KERDI-LINE {L}\" — fill {gap}\" at the ends"`.

**wedi: in `kitFor`.** The resolution order for the cover is:

1. `opts.coverPick`
2. the old `opts.coverKey`
3. the recipe default

A linear `coverPick` resolves through `linearCoverFor(len, finish, style)`. That
function gains the `style` argument: perforated / tileable / solid (the
catalog's `sub`). A point `coverPick.key` resolves as today. The frame is
unchanged.

### 4. The popover (layout A)

**Opening and closing.** ⇄ on any drain line opens one popover. That means the
channel, body, grate or flange line in Schluter, and the cover line in wedi. It
anchors to the line like today's swap popovers and closes with Esc or a click
outside, on the existing swap step of the Esc ladder.

**Schluter linear rows.**

- **Family:** Vario · Fixed · Frameless.
- **Grate:** the styles made in the family. A style whose longest length is
  below the resolved `L` carries `to 48″`.
- **Frame:** fixed only. The frames that style comes in.
- **Finish:** a swatch chip per finish. A finish not made in that
  style/frame/length is dashed and can't be clicked; its title says why.

The popover computes availability by running `resolveDrain` for each candidate.
It never re-implements the rule.

**Summary strip.** It shows:

- what will land (`"52″ body + 52″ solid grate, ¾″, brushed"`)
- why (`"longest step that fits the 55″ pan · fill 3″ at the ends"` /
  `"stepped down from 52″"`)
- the change against the current drain total, at the current price level, and
  the new total
- **Use this**

**Use this** does four things:

- sets `cfg.drain`
- rebuilds the bill and the drawings
- flips the build to Custom (`mode: "custom"`, as any swap does)
- clears the drain lines' hand-set quantities

**Stock only.** Stocked options come first. The popover is never empty, and a
special-order pick lands tagged.

**Schluter point drain.** The same shape with only the Grate row (today's point
grates). The tray fixes the drain family.

**wedi.**

- **Cover rows:** style and finish at the channel's length.
- **Point pans:** finishes only.
- **Frame:** keeps its own chip.
- **Use this:** sets `coverPick`.

### 5. Where the change reaches

The basket, `buildFromMarker`, Compare, order entry and print already take their
lines from the engines, so a swap reaches all of them with no change there.
Compare carries each row's `slot`, which 1d uses.

## Testing

- **Unchanged defaults.** Every existing pinned bill stays unchanged: default
  builds don't move, and the P0 pins still hold.
- **`resolveDrain` cases.**
  - Each family at 36″, 55″ and 72″ pans.
  - Fixed length = the longest ≤ panW that has both a body and a grate.
  - Floral steps down to 48″ with the note.
  - Offset takes only DROE.
  - Frameless.
  - Vario design fallback with its note.
  - A pan under 20″ falls back to Vario with the reason.
  - Stock only.
- **Popover logic.** Availability and dashed finishes come from `resolveDrain`.
  The Δ is computed at the tier price.
- **Saved kits.**
  - Swap → marker → `buildFromMarker` gives the same bill.
  - An old Schluter marker (no `drain`) reopens with an identical bill.
  - An old wedi marker with `coverKey` on a linear pan reads as `coverPick` and
    follows a new channel length.
  - A point `coverKey` is unchanged.
- **Slot tags.** Every line in both engines carries a `slot` from `SLOTS`.
- **Preview proof** (`.scratch/158…/p1a/`):
  - the popover on each family
  - a step-down summary
  - a fixed channel drawn with its fill gap
  - a wedi linear cover swap, then a room change re-fitting the cover length

## Records

- **New ADR:** "Configurator swaps remember the choice, not the part (slots)".
  It covers the vocabulary, choice records, resolution per build and the
  old-marker translation. 1b to 1d build on it.
- **Updates:** the `src/CLAUDE.md` entries for `schluter.js`, `wedi.js`,
  `schluterdraw.js`, both popups and the new `slots.js`.
- **Ticket 158:** the Phase 1 section tracks 1a.

## Out of scope (1a)

- Swaps on non-drain lines, and wedi's curb/panel marker fix (1b).
- "+" per group and several niches in wedi (1c).
- Shared group headings on screen, and Compare row alignment (1d).
- Changing the default drain (the owner kept Vario).
- Mortar-bed linear builds beyond using `resolveDrain` with the room width.
- KERDI-LINE-FC grate connectors and the sloping/adjustable profiles as bill
  lines. They stay Browse-only.
