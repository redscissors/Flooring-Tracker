# Shared group names and Compare alignment, sub-project 1d — design

**Date:** 2026-09-27 · **Status:** approved by owner in chat, section by section
· **Ticket:** `.scratch/158_shower-config-roadmap/ticket.md` (Phase 1)
· **Builds on:** 1a (`docs/superpowers/specs/2026-09-26-drain-slot-design.md`),
1b (`docs/superpowers/specs/2026-09-26-swap-every-line-design.md`),
1c (`docs/superpowers/specs/2026-09-27-add-another-design.md`), ADR 0049,
ADR 0034 (Compare / quote options)

## Problem

After 1c every line on both bills carries a shared `slot` (`src/slots.js`), but
nothing on screen uses it:

- **The two bills group differently.** Schluter draws seven groups (Base · Drain
  · Walls · Seams · Curb · Setting · Extras). wedi draws six buckets (Floor ·
  Walls · Bench · Drain & finish · Install · Add-ons). A salesperson switching
  popups has to relearn where things are. Niches and benches hide in Extras /
  Add-ons.
- **Compare lines up by Schluter's groups.** wedi lines are forced into them by
  a separate table (`WEDI_CAT` in `comparekit.js`), so they land oddly. On a
  38×60 room the wedi valve and pipe seals sit under **Drain**, beside
  Schluter's flange kit. Inside a group nothing lines up: the wedi panel and
  the KERDI roll sit side by side under Walls, although they fill different
  slots.
- **The slot tags disagree in one place.** wedi's fastener kit is tagged `seam`;
  Schluter's board fasteners are `wallBoard`.
- **Added lines vanish from the comparison.** A line added by hand (1c) shows
  in the host column, but the other brand's house kit has nothing for it. The
  totals then compare a build with a second niche against one without.

## Owner decisions (2026-09-27)

1. **Shared groups of slots.** Both bills and Compare use one group list,
   defined in `slots.js`. Each group holds one or more slots. wedi's Install
   and Add-ons buckets go away; Schluter gains Niches and Bench.
2. **Group order (owner):** Base · Drain · Curb · Walls · Seams · Niches ·
   Bench · Setting · Extras.
3. **Compare: group bands with slot rows.** Each group is a heading band.
   Under it, one row per slot that either side fills.
4. **Added lines stay in their slot row in Compare**, tagged "added", as on the
   bill.
5. **Mirror added lines onto the other brand** (owner's ask). When the host
   build has an added line, Compare looks for a comparable part in the other
   brand's catalog and shows it there as an added line. Where nothing is
   comparable, the other column shows a **"+"** that opens that brand's picker
   for the group.
6. **One 1d, all of it.** The shared groups, the Compare alignment and the
   mirror ship together (owner declined splitting the mirror into 1e).
7. **Matching: same slot, nearest size.** Rule-based, stock before special
   order. Qty matches coverage where both parts have it, else the same count.
   Slots with no readable size never auto-match; they get the "+".
8. **Mirrored lines live for the popup session.** They survive tab switches,
   are recomputed as the host build changes, and land in option B's marker
   through "Quote options". No new saved field.
9. **The picker is a nearest-first list** built inside Compare with the shared
   `SwapPop`. The popups' own "+" popovers are not extracted.

## Design

### 1. The shared groups

`src/slots.js` gains the group list, in the owner's order:

```js
export const GROUPS = [
  { key: "base",    label: "Base",    slots: ["tray"] },
  { key: "drain",   label: "Drain",   slots: ["drainBody", "grate", "flange"] },
  { key: "curb",    label: "Curb",    slots: ["curb"] },
  { key: "walls",   label: "Walls",   slots: ["wallBoard", "wallMembrane"] },
  { key: "seams",   label: "Seams",   slots: ["seam", "corners"] },
  { key: "niches",  label: "Niches",  slots: ["niche"] },
  { key: "bench",   label: "Bench",   slots: ["bench"] },
  { key: "setting", label: "Setting", slots: ["setting"] },
  { key: "extras",  label: "Extras",  slots: ["extra"] },
];
export const groupOf = (slot) => …; // the group key holding the slot; "extras" for an unknown slot
```

Every slot in `SLOTS` belongs to exactly one group, and the slots appear in
the group list in `SLOTS` order within each group.

**The display group comes from the slot.** Both bills, both print layouts and
Compare draw a line under `groupOf(line.slot)`.

**The engines' own groups stay as they are.** Schluter's `l.g` ("Walls",
"Extras"…) and wedi's `l.group` ("floor", "install"…) remain internal keys.
They are already saved in markers:

- Schluter's stepped-line qty overrides are keyed `"<g>|<sku>"` (`ovKey`).
- Added rows store `g` (Schluter) / `group` (wedi).
- About thirty branches in the Schluter popup read `l.g === "Walls"` and the
  like.

So nothing is renamed, no saved shape changes, and there is nothing to
translate on read. The handoff's question "what happens to a saved added row's
`g` / `group`?" has the answer "nothing": it stays the engine key, and the
display group is derived from the line's slot, which `slotOf(g, item)` /
`wediSlotOf` already compute from that key.

**One slot re-tag.** wedi's `fastener` catalog group moves from slot `seam` to
`wallBoard` (`WEDI_SLOT` in `wedi.js`). Fasteners then sit with the panels
under Walls on both bills and line up with Schluter's board fasteners in
Compare. No other slot mapping changes.

### 2. The bills

**Where lines move.** Only placement changes. No quantity, price or total
moves.

- wedi:
  - **Floor** splits. Pan, module, extensions, kit and recess kit go to Base.
    Curb and ramp go to Curb.
  - **Drain & finish** becomes Drain.
  - **Install** dissolves:
    - sealant, Subliner Dry and S-DRY go to Seams (slot `seam`);
    - collars and valve/pipe seals go to Seams (slot `corners`);
    - tools go to Setting;
    - fasteners go to Walls (the re-tag above).
  - PRO-SET stays under Setting.
  - **Add-ons** splits. Niches and the glass shelf go to Niches, seats and
    benches go to Bench, everything else goes to Extras.
  - A panel added under the wedi Bench group keeps slot `bench`
    (`wediSlotOf`), so it stays under Bench.
- Schluter:
  - **Extras** splits. Niches go to Niches, bench lines, premade benches, the
    bench kit and bench boards go to Bench, and everything else stays in
    Extras.
  - A mortar-bed build's KERDI membrane under Base keeps slot `tray`, so it
    stays under Base.

**What goes with the lines.** The add-on chips and menus that live in a group
today go with their lines:

- The Schluter niche chips move into Niches, and the bench menu into Bench.
- The wedi niche, shelf, seat and bench chips move into Niches and Bench.

**Headers and "+".** All nine group headers show on both bills, empty ones
included, each with its "+", as 1c does today for the old groups.

`ADD_PARTS` (schluter.js) and `WEDI_ADD_PARTS` (wedi.js) are re-keyed by the
shared group key. Each part entry keeps its `hit` rule and gains the engine
group an add stores (`g` / `group`), so a "+ Niches" on Schluter still writes
`g: "Extras"` and the engine reads it exactly as it does today. The parts
offered don't change, apart from where they sit:

| Group | Schluter "+" parts (stores `g`) | wedi "+" parts (stores `group`) |
|---|---|---|
| Base | Tray, Membrane (`Base`) | Pan, Extension, Recess kit (`floor`; recess `install`) |
| Drain | Drain, Grate, Body, Flange (`Drain`) | Cover, Frame, Drain kit (`drain`) |
| Curb | Curb (`Curb`) | Curb, Ramp (`floor`) |
| Walls | Board, Membrane, Fasteners (`Walls`) | Panel (`walls`), Fasteners (`install`) |
| Seams | Band, Corners & seals (`Seams`) | Sealant, Membrane & tape, Collars & seals (`install`) |
| Niches | Niche (`Extras`) | Niche, Glass shelf (`addon`) |
| Bench | Bench (`Extras`) | Seat & bench (`addon`), Panel (`bench`) |
| Setting | Setting (`Setting`) | Tools (`install`), PRO-SET (`install`) |
| Extras | Other (`Extras`) | Other (`addon`) |

The PRO-SET part is new: the wedi Setting "+" can add another bag. It stores
`group: "install"`, and `wediSlotOf` already reads PRO-SET as `setting`
wherever it sits.

**Who reads the table.** `addParts` / `wediAddParts` and `addPartOf` /
`wediAddPartOf` take the shared group key. An added line's ⇄ finds its part by
`groupOf(line.slot)`.

The row identity from 1c doesn't change: an added row is still keyed by engine
group + part (`addedGroup` / `addedBucket`). So `addQty` / `setAddedQty` /
`setAddedRow` take the part entry's stored engine group, never the display
group.

**Print.** Both popups' print layouts draw the nine groups in the same order.
Empty groups don't print. The job-sheet rows that land in the project
(`lineItems`) are unchanged.

### 3. Compare layout

`COMPARE_CATS` and `WEDI_CAT` retire. `wediCompareRows` / `schluterCompareRows`
stamp each row with `slot` (already there), `group: groupOf(slot)`,
`added: !!(line.manual || line.added)` and the line's engine key, which the
mirror uses.

The grid:

- **One heading band per group**, in `GROUPS` order.
- **Under each band, one row per slot that either column fills.** The slot's
  `SLOT_LABEL` sits in the left column.
  - A slot neither column fills is hidden.
  - A slot only one column fills shows "—" in the other.
  - A group with no rows is hidden, unless a mirror "+" needs its row
    (Section 4).
- **Within a cell**, kit lines come first in bill order, then added lines, each
  tagged **added**. Special-order, note-only and "est." styling are unchanged.
- **Unchanged:** the totals row, the "less on material" line, the Retail /
  Builder lens and the quote-options footer. Totals include every added line
  on both sides.
- **Column messages.** A column with no build yet (no room, book loading, no
  solve) shows its message once in the first visible row, as today.

### 4. The mirror onto the other brand

In the Compare tab, the popup's own build is the **host** column and the other
brand's house kit is the **other** column. A **host added line** is a line in
the host build flagged `manual` (Schluter) / `added` (wedi).

**Auto-match.** For each host added line:

1. **Candidates.** Candidates are the other brand's catalog parts that its own
   "+" table offers for `groupOf(slot)`, and that fill the same slot.
   - A candidate's slot is read the way the other engine reads it when that
     part is added under the part entry's stored group: `slotOf(g, item)` /
     `wediSlotOf({ item, group })`.
   - Under the popup's Stock-only toggle (`source`), only stocked parts count.
2. **Nearest size.** Only in sized slots, on the measure below.

   | Slot | Measure | Reads |
   |---|---|---|
   | niche | interior opening W×H, distance \|ΔW\|+\|ΔH\| | wedi: the "interior W″ x H″" size text; Schluter: the `KB12SN<W mm><H mm>` SKU (305508 → 12″×20″). A lighted or odd SKU with no readable size is not a candidate for auto-match. |
   | bench | the seat's footprint, \|ΔW\|+\|ΔD\| (a corner seat's leg as both) | wedi seat/bench `w`/`d`; Schluter `item.bench` |
   | curb | length, \|Δlen\| | `len` on both |
   | wallBoard | thickness first (exact match beats any other), then sheet sf, \|Δsf\| | wedi panel `t`/`sf`; Schluter board thickness/`sf` |
   | wallMembrane | coverage sf, \|Δsf\| | `coverageOf` on both (P0-3) |
   | seam | width first, then lf, \|Δlf\| | band width / `coverageOf` lf |
   | tray | W×D, \|ΔW\|+\|ΔD\| | tray / pan dims |

3. **Ties.** Stock beats special order, then the lower retail price wins, then
   the SKU/key sorts.
4. **No readable size gives no match.** If the host line's own size can't be
   read, or no candidate's can, there is no match. So drainBody, grate, flange,
   corners, setting and extra never auto-match: their size isn't comparable
   across brands.
5. **Qty.**
   - Coverage parts (sf / lf on both sides, via `coverageOf`):
     `ceil(hostQty × hostCoverage ÷ matchCoverage)`.
   - Otherwise the host qty.

**The other column.**

- **A matched line** sits in its slot row, tagged **added · matched**. Its
  sub-line names the host line it answers ("for 16×16″ wedi niche").
- **An unmatched host line** gives a row in its slot:
  "Nothing comparable in the Schluter book" with a **+**.
- **Mirrored lines carry ⇄ and ×.** Auto and hand-picked alike:
  - **⇄** re-picks.
  - **×** drops the line. A dropped line puts the "+" back in its place.
- **No mirror "+" for gaps between kit lines.** When the kits differ (wedi
  bills corners, Schluter doesn't), no "+" is offered. That is Phase 3's
  territory.

**The picker** ("+" and ⇄). It is built in `CompareTab` on the shared
`SwapPop` (add mode), so the popups are untouched.

- **Title:** "Add to Schluter · Niches — for 16×16″ wedi niche".
- **A Part row** of chips lists the other brand's "+" parts for the group, the
  same entries as §2's table. It opens on the part entry that fills the host
  line's slot. A group with one part shows no Part row.
- **A one-click list** of that part's candidates (the same function the
  auto-match uses), nearest size first, stock before special order, then price.
  Each row shows name, size, price and the special-order dot. The current pick
  is marked.
- **A qty stepper**, pre-set to the auto qty for the chosen candidate.
- **Use this** stores the pick. Esc or a click outside closes the picker and
  changes nothing.

**State.**

- It lives in the host popup (`useState` in `SchluterConfigurator` /
  `WediConfigurator`), passed to `CompareTab`, so it survives tab switches and
  is lost when the popup closes:

  ```js
  mirror = { [hostLineId]: { pick: { part, qty } } | { dropped: true } }
  // hostLineId = "<engine group>|<sku or key>", the 1c row identity
  ```

- **Auto-matches are never stored.** They are recomputed from the host build
  every render.
- **An entry whose host line no longer exists is ignored**, and pruned the
  next time the state is written.
- A hand pick keeps its qty when the host qty changes. The auto qty follows the
  host.

**Pricing and quote options.**

- **The other engine prices the mirror.** The other column's build is re-run
  with the mirrored lines as its own added rows:
  - Schluter: `cfg.manual` rows `{ sku, qty, g }`, via `schluterBuildFor`'s
    cfg;
  - wedi: `manual` rows `{ key, qty, group }`, via `wediBuildFor` → `kitFor`
    opts.

  The engine that owns the part prices it, and it counts in the total.
  `comparekit`'s "every price comes back out of the engine that made the
  line" rule holds.
- **Option B carries the mirror.** "Quote options" lands option B from that
  build, so its marker carries the mirrored rows as ordinary added lines.
  Reconfiguring option B opens them tagged "added". The confirm modal's line
  counts and totals include them.

**Where the code lives.** A new `src/comparemirror.js` holds the pure
functions:

- the per-slot size readers;
- `mirrorCandidates(hostLine, otherBrand, { source })`;
- `autoMatch(hostLine, …)`;
- `mirrorRows(hostBuild, mirrorState, …)`, which returns the other brand's
  added rows plus the "+" placeholders.

It is imported only by `comparekit.js` / `CompareTab.jsx`, so it stays inside
the lazy Compare chunk (ADR 0026). comparekit remains the only module that
imports both engines.

## Testing

- **Both goldens stay green and untouched:** `src/wedimarkergolden.test.js`
  (1b) and `src/addedgolden.test.js` (1c). No bill quantity moves.
- **Unit tests:**
  - `GROUPS` covers every slot exactly once. `groupOf` works for every slot
    and falls back to "extras".
  - Every kit line and added line in both engines' fixture builds (a point, a
    linear, a curbless and a bench build per brand) lands in the expected
    group. The wedi fastener lands in Walls, a wedi bench panel in Bench, and a
    Schluter mortar-bed membrane in Base.
  - Every `ADD_PARTS` / `WEDI_ADD_PARTS` entry, added under its stored engine
    group, lands in the group whose "+" offered it. This is the round trip that
    keeps "+" and display in step.
  - Compare rows:
    - group bands in order;
    - a slot filled on one side shows "—";
    - empty slots and groups are hidden;
    - added lines come after kit lines in their cell.
  - The mirror:
    - nearest size per sized slot, the stock tie-break and the Stock-only pool;
    - coverage qty (panel sf ⇄ board sf, band lf);
    - unsized slots and unreadable sizes give "+";
    - a pick or drop is keyed by engine group + part, and a same-part line in
      another group isn't hijacked;
    - an orphaned state entry is ignored;
    - a Browse-only or manual host build doesn't throw.
  - The picker's list and the auto-match come from the same candidate
    function (one test asserts they agree).
  - Quote options: option B's `lineItems` carry the mirrored rows. Its marker
    reopens them as added lines (`buildFromMarker` / Schluter `seedState`).
- **Up-front checks** for what 1a–1c reviews kept catching:
  - the picker never decides availability with its own rule;
  - no lookup is keyed on part alone;
  - kit vs added lines are never touched by the other's stepper or reset.

## Proof

New `.scratch/158_shower-config-roadmap/p1d/` scripts (`shoot-schluter.mjs`,
`shoot-wedi.mjs`, `shoot-compare.mjs`), each ending "— all checks passed":

- **Both bills**, before (from `main`) and after: the nine headers in order,
  "+" on each, the wedi fastener under Walls, and niches and benches in their
  own groups.
- **Print** on both brands.
- **Compare, Schluter host:**
  - an added niche auto-matched on the wedi side, tagged "added · matched";
  - an added grate giving "+";
  - the picker;
  - × dropping a mirrored line.
- **Compare, wedi host:** an added panel matched by sf on the Schluter side.
- **Quote options:** the confirm modal counts the mirrored lines, and option B
  reopens with them.
- **Re-run** the p1a, p1b and p1c scripts. Restore any PNG that re-renders
  with no real change.

## Records

- **ADR 0049 amendment (1d):**
  - the display group derives from the slot, and engine groups stay internal
    keys;
  - the wedi fastener re-tag;
  - Compare's other column holds session state (mirrored added lines);
  - cross-referenced from ADR 0034.
- **`src/CLAUDE.md` entries:** `slots.js`, `comparekit.js`, `comparemirror.js`
  (new), `CompareTab.jsx`, both popups, `schluter.js` / `wedi.js` (`ADD_PARTS`
  re-key).
- **The ticket's 1d row**, and a Phase 2 handoff.

### Amendments during planning and build (2026-09-27)

Calls the plan author made while prototyping (the plan's "Rulings made while
prototyping", `docs/superpowers/plans/2026-09-27-shared-groups-compare.md`) and
the controller ruled on during execution (ledger:
`.superpowers/sdd/2026-09-27-shared-groups-compare/progress.md`, session
ledger, not committed).

From the plan:

- **The add-on chips stay a block of their own**, titled "Add-ons", below the
  nine groups, on both bills. Schluter already drew them that way; wedi's
  chips moved out of the retired Add-ons bucket into the same kind of block.
  This amends §2's "the niche chips move into Niches, and the bench menu into
  Bench". What a chip adds still lands in its own group.
- **`comparemirror.js` is engine-free.** comparekit hands it parts
  (`{ brand, item, slot, g, id, cov, retail }`). The brand-specific mirror —
  `hostAddedLines`, `mirrorParts`, `mirrorCandidates`, `mirrorPlan`,
  `mirrorRow`, `pruneMirror` and `compareLayout` — lives in `comparekit.js`.
  This amends §4's "Where the code lives".
- **A Schluter niche's size is read from the SKU only** (`KB..SN<mm><mm>`).
  The lighted niche (`KB12SNLT…`) has none, so it never auto-matches. It is
  still in the picker's list.
- **`data-add-group` carries the group label** ("Niches"), for the proof
  scripts.
- **`schluterBuildFor` bills `cfg.manual`.** `buildKit` bills the recipe only;
  every other caller (`buildFromMarker`, the popup) pushes `addedLines`
  itself.
- **wedi Browse-only lines get `slot`.** They had none and would have filed
  under Extras.
- **wedi's Walls Fit / One-size control** shows only when the Walls group
  holds a kit panel, since fasteners now share the group.
- **A "+" part only offers parts that land back in its group.** Without this,
  wedi's "Other" caught S-DRY parts that `wediSlotOf` files under Seams, and
  PRO-SET (catalog group `sdry`) showed under "Membrane & tape".
- **The mirror "+" is shown only when the brand has parts for that group.**
  Otherwise the row reads "No Schluter flange in the book" (the slot's label),
  with no "+". A dropped line's row reads "Not mirrored", with the "+".
- **The picker's price is retail**, whatever the Compare lens. It is a list of
  parts, not a quote.
- **A pick whose part left the book reads as "none"** (a "+"). It never falls
  back to an auto-match silently.
- **Two host lines landing on one part sum into one engine row.** The Compare
  column still draws one mirrored line per host line; the totals agree.
- **Kit-line group coverage** is pinned by the Compare-row tests (the 60×38
  point build on both brands, every row a known group and slot) and by the
  "+" round-trip tests. There is no separate per-build-type fixture sweep, as
  the Testing section had asked for.

From the build:

- **Schluter board thickness comes from the KB code.** comparemirror reads
  `item.thickMm`, else the SKU's `KB<mm>` code, through an mm → inch table
  that mirrors schluter.js `THICK_IN`. The name's inch figure is only the last
  fallback: live names aren't a stable key, and a name listing the sides first
  would read 48″.
- **A Schluter bench with no length is unsized.** `bench: { d }` without
  `len` never auto-matches: no readable size, no match.
- **Esc over the mirror picker closes only the picker.** CompareTab registers
  the picker on the ADR 0028 Esc ladder (`useEscClose`), as the confirm modal
  already did. Before, Esc closed the whole configurator.
- **The mirror picker searches.** Past 12 candidates a search box shows
  (name + part number), the first 60 matches list, then "N more — narrow the
  search". This is the popups' own "+" list idiom, so every candidate is
  reachable.
- **A standing pick opens marked.** A pick made under Full catalog, with the
  popup now on Stock only, still opens the picker on that part, at the top of
  the list with its qty. (A hand pick also keeps billing under Stock only: it
  was chosen, not figured.)
- **A group with nothing to show and nothing to add stays hidden.** §2's "all
  nine headers, empty ones included" means empty but addable. The wedi fixture
  book has no Extras "Other" parts, so the wedi bill draws eight headers. A
  "+" that opens an empty list helps nobody; 1c hid such groups too.
- **Print proof renders the print sheet.** The sheet shows only under
  `@media print`, so the p1d print shots emulate print media. The p1d proof is
  two scripts, `shoot-bills.mjs` (both bills and both prints) and
  `shoot-compare.mjs`, not the three the Proof section names.
- **"comparekit remains the only module that imports both engines" is scoped
  to the Compare code.** CompareTab.jsx (both engines' `lineItems`),
  showersf.js and orderlines.js already imported both before 1d. The mirror's
  engine reads live in comparekit; comparemirror imports no engine.
- **The mirror pools Stock only the way the popups do.** Each part narrows to
  its stocked items when it has any, else keeps all of them (Schluter `pool`,
  wedi `bySource`). A group with nothing stocked still offers its parts, so
  under Stock only it never reads "No … in the book" and loses its "+". The
  auto-match and the picker share the one pool. (Final review.)

## Out of scope (1d)

- A "+" for gaps between the two kits' own lines (Phase 3).
- Saving mirrored lines in the host's marker (declined, decision 8).
- Extracting the popups' own "+" popovers into shared modules (declined,
  decision 9).
- Renaming the engines' internal groups (approach B, declined).
- The 1c deferred items not named above: row order after an added line's ⇄,
  per-part netting in `sessionFromRows`, the Reconfigure-lowered-qty owner
  call, Browse-only wedi `group` drop, the point-drain grate list, the sealant
  gun's bucket, and bench boards sharing a sku.
- Board vs Membrane (Phase 2) and the 4-way compare (Phase 3).
