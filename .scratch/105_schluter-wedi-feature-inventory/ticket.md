Status: open
Labels: ready-for-human

> **Round 6 (owner verdicts, 2026-08-24 — .scratch/106):** landed A4 (toasts),
> A5 (Esc cancels placing), B3 (rows price the FULL kit + a Kits-tab wall-
> system seg reprices Membrane vs Board in place), B7 (exception-only tags),
> C1 (shared NumIn — blur commit), C13 (per-wall faces seg — the owner
> overrode the recorded N/A), C14 (retuneWalls on room commits), C15
> (geometry edits bump Kits → Custom with a toast), D3 (figurer Add to
> build), E5 (ramp is an opt-in chip), F5 ("Turn into a curb" — the curb now
> runs EVERY open edge, billed and drawn from one openRuns). New owner
> decision the same day: KERDI-FIX left the standing recipe (tub-kit goods,
> now a chip; approved-bill pins re-pinned 11 lines / $734.09).
> **Round 7 (.scratch/107):** landed E12 + F4 — the KERDI-BOARD panel plan
> (boardPlan over the live board range, Fit | One size on the Walls group,
> the plan's courses drawn in both views, kit rows priced through the same
> plan).
> **Round 8 (.scratch/108):** landed E10 (the print layout sheet — both
> drawings, cut list, materials table) and E11 (Copy for order entry —
> orderCopyLines, stocked SKU ⇥ qty / SO by description).
> **Round 9 (.scratch/109):** landed the last four — E3 (⇄ swaps via
> cfg.swaps: grate/curb/One-size board), B4 (overwrite confirm), C17
> (option-card thumbnails), D4 (★ starred). **The MISSING column is empty:**
> every wedi behavior is now ported, blessed as different (D5), or recorded
> N/A. This ticket is the standing record; close it when the PR merges.

# Schluter ⇄ wedi feature inventory — the fine-toothed comb, done once

Owner ask (2026-08-24): parity gaps keep surfacing one owner-review at a
time ("not even basics like running the board horizontal instead of vertical
on the walls made it over"). This is the one-time audit that replaces that
loop: every behavior in the wedi configurator (`WediConfigurator.jsx` +
`wedi.js`'s UI-facing rules), classified against the Schluter popup as it
stands on `main` + rounds 1–5.

Sources read in full: WediConfigurator.jsx, SchluterConfigurator.jsx,
schluter.js (wall/board picks), showerdraw notes in src/CLAUDE.md, ADR
0032/0033, tickets 097–104.

Legend:
- **PORTED** — present and works the wedi way.
- **DIFFERENT** — present, but not done the way wedi does it; the owner
  decides whether the difference stands or aligns.
- **MISSING** — not in the Schluter popup at all.
- **N/A** — deliberately not ported, with the physical or recorded reason.

## A. Header & shell

| # | wedi behavior | status | notes |
|---|---|---|---|
| A1 | "Clear design" in the pop-head | PORTED | round 5 |
| A2 | Shared Source switch (Stock only / Full catalog), never-silently-dropped doctrine | PORTED | phase 4; pickFrom/stockPool |
| A3 | TierBar mirrors the job's tier both ways | PORTED | schluterBuilderPct knob |
| A4 | Toast narration (`say`) — wall added, design cleared, "modified kit — it's a custom shower now", clipboard result | MISSING | Schluter's only narration is the placing hint bar in the rail; every other action is silent |
| A5 | Esc ladder covers every layer incl. placing mode | DIFFERENT | Schluter's ladder is payload → picker → bench → wall → close; `placing` is not a rung (wedi Esc cancels placing first) |
| A6 | Shrink-to-fit rig, embedded hub mount, refresh-restore contract | PORTED | |

## B. Kits tab

| # | wedi behavior | status | notes |
|---|---|---|---|
| B1 | Families by type, smallest-side-first sort, size-led row labels | PORTED | issue 100 |
| B2 | Click fills the build and stays on the tab, row highlights | PORTED | issue 100 |
| B3 | The row's ONE price is the FULL KIT total through the tier lens, matching the build column (owner ask 2026-07-31) | DIFFERENT | Schluter rows show the TRAY's own price only — a $700 row builds a $1,400 kit. wedi computes kitTotals per row |
| B4 | A kit click over a customized build CONFIRMS before wiping it (overwrite modal, owner rule 2026-07-30) | MISSING | Schluter `pickKit` runs `clearDesign()` unconditionally — one stray click on the Kits tab silently destroys a tuned room |
| B5 | Kit pick seeds the custom form (size/curb/drain mirror the kit) | PORTED | TT lands curbless |
| B6 | Stock-only grays SO rows | PORTED | |
| B7 | Rows tagged only where they break the family pattern (majority/panTag) | DIFFERENT | Schluter tags every row stock/SO instead; arguably fine — flag is informational |

## C. Custom shower — room form

| # | wedi behavior | status | notes |
|---|---|---|---|
| C1 | Inputs commit on blur/Enter (NumIn — a half-typed "4" of "48" never solves) | DIFFERENT | Schluter inputs re-run cfg per keystroke; blank guarded (roomOk) but "4" of "48" re-ranks candidates mid-typing |
| C2 | Curbed / curbless entry | PORTED | |
| C3 | Tile thickness (fractions parse; disabled-with-reason when it can't bite) | PORTED | |
| C4 | "Sizes are — Pan size \| Max — curb inside" re-fits without wiping the build | PORTED | Schluter insets the entry depth only — correct for its one-curb domain (wedi insets every open edge because every open edge can carry curb) |
| C5 | Drain preference incl. **Any** (pool everything, the pick decides) | PORTED | round 2 |
| C6 | Drain pin "from left × back" | PORTED | + Schluter went further: Left\|Right datum toggle (round 3) — wedi doesn't have that |
| C7 | "Pan against Left/Right" anchor | N/A | recorded (ticket 100): a tray is cut to the whole room; the pin already decides which sides the saw takes |
| C8 | ⇄ flip — w↔d, pin follows, typed wall lengths re-auto | PORTED | round 2 |
| C9 | Wall rows: name on/off, len × h, sf, blank-follows-room, Default height | PORTED | round 2 |
| C10 | Added-wall rows: end-flip name button, ×-remove | PORTED | issue 100 |
| C11 | "+ Add wall" placing mode — which HALF of the edge picks the end | PORTED | issue 100 |
| C12 | "✂ Cut open corners" chip + corner clicks, openMap gating, stale cuts drop | PORTED | round 2 |
| C13 | Per-wall FACES (inside / both sides / in + exposed end) feeding the area | N/A per ADR-recorded design — the membrane/board fork is whole-shower, no faces seg | OPEN QUESTION for the owner: a freestanding added wall (both sides exposed) bills ONE face of board in Schluter. Is that ever wrong on a real job? |
| C14 | retuneWalls doctrine — a typed length that merely tracked the kit clears on room change | DIFFERENT | applied on flip and on marker reopen; wedi also applies it on every room/option change |
| C15 | Geometry edit on the Kits tab auto-moves to Custom with a toast saying why | DIFFERENT | bench add moves (round 5); wall/corner edits silently reset the kit flag and stay put |
| C16 | Option cards ranked, badges, warnings | PORTED | exact / cut down / deep cut / pin miss |
| C17 | Option-card mini TopDown thumbnail | MISSING | Schluter cards are text-only — wedi's little plan drawing is how you tell two 60×38 options apart at a glance |
| C18 | No-fit never dead-ends | PORTED | wedi: closest-fit ladder; Schluter: mortar-bed fallback card (decision 2) |
| C19 | Cut list / install notes | PORTED | lives in the drawings rail instead of under the cards — reasonable |

## D. Browse tab

| # | wedi behavior | status | notes |
|---|---|---|---|
| D1 | Search + filter-board sections/subs, counts | PORTED | |
| D2 | Stock tinted + ranked first; Stock-only hard filter | PORTED | |
| D3 | Consumables figurer | DIFFERENT | Schluter's "Figure thin-set & KERDI" shows the numbers but has NO "Add to build" button — wedi's adds the figured lines in one click |
| D4 | ★ Starred — per-device pin list + filter (owner sketch 2026-07-30) | MISSING | |
| D5 | Two-line rows, size-led display names, brand-stripped name layer | DIFFERENT | Schluter rows are simpler; its names are already terse — probably fine |
| D6 | Steppers on rows | PORTED | |

## E. Build column

| # | wedi behavior | status | notes |
|---|---|---|---|
| E1 | Grouped lines, SKU-led meta, notes | PORTED | |
| E2 | Qty steppers: override reads rust w/ auto figure in the title; 0 removes the line | PORTED | round 4 |
| E3 | **Swap popovers (⇄) on lines** — pick a different wall panel, curb ("No curb"), cover/grate finish, sealant form, curbless entry, with none-options | MISSING | Schluter has NO swaps anywhere: the recipe's pick is final. You cannot choose a different board size for the walls, a different grate finish, or drop the curb — only step quantities |
| E4 | Add-on chips at the column foot; multi-part chips open pickers | PORTED | rounds 3–4 |
| E5 | Curbless entry as an explicit choice (recess kit / ramp / recess-the-subfloor-no-part) | DIFFERENT | Schluter auto-bills the ramp; removing it means stepping the line to 0 — no stated choice |
| E6 | Benches: chip + drawing zones, premades live, framed fork | PORTED | rounds 3–5, incl. trayFit cut/smaller |
| E7 | Contextual hints (sausage-gun on the job, $500 SO minimum) | N/A | wedi-vendor rules. OPEN QUESTION: does Schluter special order carry any minimum worth surfacing? |
| E8 | Cost & margin behind a click | PORTED | |
| E9 | Payload preview modal | PORTED | |
| E10 | **Print layout** — print sheet with both drawings, cuts & notes, materials table, tier total | MISSING | Schluter's foot has ONE button (Add to product lines). No Print at all |
| E11 | **Copy for order entry** — stocked lines as SKU ⇥ qty, SO by description | MISSING | no Copy button either |
| E12 | **Fit \| One size panel plan** — level courses, mixed sheet sizes, a wall stood VERTICAL where it kills the seams, seam-count note, per-wall courses drawn in both views | MISSING | **the owner's board-orientation example.** Schluter wall pick is `largest ½″ panel × area ×1.05, whole panels` (schluter.js:663) — no course plan, no horizontal/vertical decision, no seam note, and the drawing ticks fixed 48″ joints on board walls regardless of any real layout |
| E13 | From-stock meter | — | Schluter-ahead: wedi doesn't have one (candidate to port BACK) |

## F. Drawings rail

| # | wedi behavior | status | notes |
|---|---|---|---|
| F1 | Shared TopDown/Iso, curb bands, slope marks, bench zones | PORTED | ADR 0033 |
| F2 | Right-click wall menus in both views | PORTED | round with issue 100 |
| F3 | Corner clicks toggle cuts, boxed corners refused | PORTED | wedi refuses with a toast explaining why; Schluter refuses silently (see A4) |
| F4 | Panel course ticks reflect the actual FIT PLAN per wall | MISSING | follows E12 — ticks are generic 48″ joints |
| F5 | "Turn into a curb" on a wall's menu (+ curb re-pick + narration) | DIFFERENT | Schluter has "Turn off"; the engine re-runs entryOpening correctly but nothing says what happened |
| F6 | wedi-branded strings + `wedi-hatch` SVG id in the shared module | — | recorded ADR 0033 phase-3 debt, still open: the hint text says "wedi faces" inside the Schluter popup, and the un-scoped pattern id can collide when both popups mount |

## G. Cross-cutting

| # | wedi behavior | status | notes |
|---|---|---|---|
| G1 | Compare tab + quote options A/B | PORTED | phase 5 |
| G2 | Boot-side search recognizer (pinned configurator row) | PORTED | schluterquery.js |
| G3 | Reconfigure marker round-trip (incl. source, manual, pick, drainRef) | PORTED | |
| G4 | Restore layer / mid-config refresh survival | PORTED | |

## The scoreboard

~30 PORTED · 9 DIFFERENT · 8 MISSING · 3 N/A (recorded) · 3 open questions.

The 8 MISSING, in the order they bite the sales floor:

1. **E12/F4 — board panel plan** (Fit | One size, course orientation, seam
   minimization, courses drawn). The owner's own example. Biggest single
   remaining port; wedi's `panelPlan` is board-generic in spirit but
   wedi-sheet-sized — a Schluter version keys off the classified board range.
2. **E10 — Print layout.** The wedi print sheet is how a layout gets handed
   to an installer; Schluter builds can't leave the screen.
3. **E11 — Copy for order entry.**
4. **E3 — line swaps.** Wall board size, grate/cover finish, curb choice,
   "No curb" — all locked to the recipe's first pick today.
5. **B4 — overwrite confirm** on a kit click over a customized build (data
   loss today).
6. **C17 — option-card thumbnails.**
7. **D4 — starred items.**
8. **A4 — toast narration** (fixing this also covers F3's silent refusal and
   C15's silent kit→custom flip).

The 9 DIFFERENT rows need an owner verdict each: align it, or bless the
difference and record it here so nobody re-litigates it. B3 (kit rows priced
as tray-only, not full kit) and E5 (ramp auto-billed with no stated choice)
look like accidents of porting; C1/C14/C15 are doctrine drift; B7/C4/D3/D5/F5
are judgment calls.

Open questions for the owner: C13 (both-sides board on a freestanding wall),
E7 (Schluter SO minimum?), F6 (wedi-branded strings showing inside the
Schluter popup — cosmetic but visible).
