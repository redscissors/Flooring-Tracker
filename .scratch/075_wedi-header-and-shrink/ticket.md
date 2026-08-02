# 075 — wedi configurator: custom-shower header candidates + shrink to fit

Status: in-review (header candidates await an owner pick; the two layout
changes below are implemented and shot)
Opened: 2026-08-02 (owner)
Area: wedi configurator (issue 066), Apps hub

## The ask (owner)

> I would like to prototype a few more custom shower headers with the wedi
> integrator. Right now, I feel like those buttons are a mess. Hard to see.
> And you'd also like it to size appropriately to smaller screens. So when on
> a smaller screen it just makes everything smaller to make everything fit for
> now. I'm talking about the full configurator. […] you click the app button,
> and it opens like the apps. The app column could collapse too when you open
> an app on a small screen, with a small back button maybe to open up that
> column again.

Three things: (1) prototype header designs for the Custom shower tab, (2) the
whole configurator shrinks instead of scrolling sideways on a small screen,
(3) the Apps hub's nav column folds away once an app is open on a small screen.

---

## 1 · Custom shower header — four candidates (awaiting a pick)

`headerproto.html` (+ `headerproto.jsx`), served by vite; `shoot-header.mjs`
takes the shots. Every candidate drives the same state, so only layout and
treatment differ. Overview: `shots/header-all-900.png`.

### What is actually wrong with the shipped one

`shots/header-0-today-940.png`. Nine `.rf` groups in one `flex-wrap` row:

- **The selection doesn't read as a selection.** `.seg button.on` is a
  near-black fill (`--ft-text` on `--ft-cream`) — the loudest thing on the tab.
  Five of them across one bar read as five *headings*, not five answers. Every
  other segmented control in the app uses `--ft-seg-on-bg` (moss 16%) with ink
  text; wedi is the only near-black one.
- **Walls is a multi-select drawn as a radio.** Back / Left / Right are three
  independent toggles, and with all three on they merge into one unbroken black
  slab that reads as "this is a title".
- **Groups run into each other.** "PAN AGAINST · Left | Right" sits flush
  against "WALLS · Back | Left | Right" — five buttons in a row, two of them
  labelled *Left*, one selected and one not, with 9.5px labels above.
- **The wrap order changes with every width**, so it is never the same shape
  twice, and "Clear design" floats on `margin-left:auto` wherever the wrap
  leaves it.

### Shared by all four candidates

- Selection = moss tint + moss ring + `--ft-brand-deep` ink, matching the rest
  of the app. Nothing near-black.
- Walls become **tick chips** — separate, individually ticked — because that is
  what a multi-select looks like.
- Labels 9.5 → 10px, weight 800.
- "Clear design" gets a fixed home instead of floating.

| | Candidate | Trade |
|---|---|---|
| **A** | **Grouped board** — three named groups (Size & curb / Drain / Walls) in an auto-fit grid, wrapping 3 → 2 → 1 columns | Clearest grouping; **tallest** (~200px at full width, ~370px at two columns) |
| **B** | **Two-tier toolbar** — size / curb / drain large on top, the rest in a quiet sand band below | Roughly **half A's height**, clear hierarchy; the secondary band is small type |
| **C** | **Summary that opens** — one read-out line (`48″ × 66″ · Pan size · Curbed · Any drain · Pan left · Back · Left · Right @ 96″`) with **Edit shower**, opening board A | Gives the option cards + drawings back ~150px; every change costs a click to open |
| **D** | **Spec rows** — labels in a fixed right-aligned left gutter, one control per row, two columns | Nothing ever wraps mid-group and the labels scan as a column; widest of the four |

Shots per candidate at 940px (full width) and 660px (the solver column at the
shrink floor): `shots/header-{0-today,A-grouped,B-two-tier,C-summary,D-specrows}-{940,660}.png`,
plus `shots/header-C-summary-open-940.png` for C expanded.

### Owner pick (2026-08-02): "a but half the size"

Two slimmed rebuilds of A, both keeping its three groups and its order.
`shoot-slim.mjs` measures the board itself (not the panel caption):

| Board | 940px | 660px |
|---|---|---|
| Today (shipped) | 195px | 256px |
| **A** as first drawn | 270px | 432px |
| **A1** · A, compressed | 199px | 319px |
| **A2** · A as stacked bands | **122px** | **182px** |

- **A1** takes the height out of chrome — no board title row, smaller controls,
  fields flowing inside each group. It doesn't reach half: at 940 each of the
  three columns is only ~290px, so the fields stack anyway and the saving is
  the chrome alone (270 → 199, −26%).
- **A2** moves the group name into a **left gutter**, which is what actually
  costs A its height — a group no longer pays for a heading row, so each group
  is one band of controls with its labels inline. 270 → 122 (−55%), and
  **shorter than the header shipping today** (195). Same three groups, read top
  to bottom instead of left to right; at 660 a band wraps within itself and the
  grouping still holds.

Shots: `shots/slim-{0-today,A-grouped,A1-compressed,A2-bands}-{940,660}.png`.

### Ported: A1 (owner pick, 2026-08-02)

**The prototype's widths were wrong.** It was drawn at 940px; the solver column
never gets that. `measure.mjs` reads the header's own box in the real popup:

| Viewport | Header gets | Shipped | A1 | |
|---|---|---|---|---|
| 1920 | 868px | 195px | **172px** | −12% |
| 1680 | 628px | 256px | **249px** | −3% |
| 1440 | 388px | 439px | **321px** | −27% |
| 1280 | 370px | 388px | **283px** | −27% |
| 1024 | 370px | 370px | **279px** | −25% |
| 860 | 369px | 317px | **239px** | −25% |
| 720 | 345px | 274px | **205px** | −25% |

Only at a 1920 viewport does the three-column grid actually get three columns —
`minmax(248px, 1fr)` needs ~760px and the column is 370–630px nearly always. So
the "199px at 940" figure from the prototype is a best case that only the widest
monitors see; the real win is the 25% off the narrow half of the range, where
the shipped header was 370–439px and A1 is 205–321px.

Two tuning passes got it there, and both were measured rather than eyeballed:

- The absolutely-positioned "Clear design" was costing a 31px band of board
  padding at every width. It moved into the Walls group's **heading row**, which
  had slack — the whole button now costs zero rows.
- Field gaps, input widths and chip padding came down enough for "Shower size"
  and "Curb" to share a row in a 285px group instead of wrapping.

Before that the 1680 case was a *regression* (275px against the shipped 256px):
the grid drops to two columns there while the old `flex-wrap` row packed
tighter. It is now 249px — the narrowest margin of the seven, worth watching if
the groups gain a field.

Shots: `shots/ported-{1680,1280,1024,860,720}-{custom,header}.png`.

---

## 2 · The configurator shrinks instead of scrolling sideways

`src/WediConfigurator.jsx`. The body is drawn at a fixed `min-width:1120px` —
three columns (solver / build / drawings) that only work side by side. Below
that it used to scroll horizontally, which put the **drawings rail off screen
entirely** at 1024px and read as "the drawings are gone"
(`shots/before-1024-custom.png`).

Same call `App.jsx` made for the desktop shell in issue 074: the popup carries
`zoom: clamp(0.62, availableWidth / 1156, 1)`, measured off its own frame with a
`ResizeObserver` (not a window listener — embedded in the hub, the frame is the
hub's main column, not the viewport). Same layout, same order, just smaller.

- `zoom`, not `transform: scale()`, because it is a real layout scale: the
  popup keeps its own scrollbars and `getBoundingClientRect` still reports
  viewport pixels, so the swap / chip / wall-menu popovers that portal to
  `document.body` land on their anchors. They render at 100% while the popup is
  scaled — the same accepted trade as 074.
- The overlay's height was `min(940px, 94vh)`; a viewport unit inside a zoomed
  box is not the pixel it is outside one, so the height is measured on the frame
  and handed over in the popup's own pixels.
- 0.62 is where 9px type stops being readable. Below ~1160px of frame the
  configurator sits at the floor and scrolls the last few pixels.

At 1680 the render is **byte-identical** to before (zoom 1, `cmp` clean).

## 3 · The Apps hub's nav column folds on a small screen

`src/AppsWorkspace.jsx`. Under **1100px** the 224px rail is width the open app
needs more than the nav does. It becomes an overlay drawer (the `App.jsx`
mobile-sidebar pattern — scrim, `-translate-x-full`), and the main column gets a
slim bar: **‹ Apps** · the app's name · ✕. Picking an app closes the drawer.
At 1100px and up nothing changes.

Wiring the two together: at 1024px the rail folding gives the configurator back
224px, which lifts it from a 0.66 zoom to 0.85.

## Proof

`shots/` — `before-*` / `after-*` at 1680 / 1280 / 1024 / 860 / 720, each as the
Kits tab and the Custom shower tab, plus `after-*-rail-folded.png` and
`after-*-rail-drawer.png` under 1100.

- 1680: identical before/after.
- 1280: the drawings rail is fully on screen; it was cut off before.
- 1024: all three columns visible, no horizontal scroll (was: rail entirely off
  screen behind a scrollbar).
- 720: at the 0.62 floor, ~37px of horizontal scroll left over — deliberate,
  readability over fit.

Lint clean on both changed files apart from the pre-existing unused
`CORNER_CUT` import; 889 unit tests pass.

## Running the harness

```
npm i -D playwright                                   # not a repo dep
npx vite --port 5199
node .scratch/075_wedi-header-and-shrink/shoot.mjs before|after
node .scratch/075_wedi-header-and-shrink/shoot-header.mjs
node .scratch/075_wedi-header-and-shrink/shoot-slim.mjs      # + prints heights
```

`hub.html` mounts the real `AppsWorkspace` with mock commit handlers — no
credentials, no network, no writes to the live project.

---

## 4 · Kits tab — condensing (owner ask 2026-08-02, awaiting a pick)

> "in the kits, the box of text telling what it is does not need to be there.
> And I think we could condense the actual kit selection boxes as well… maybe we
> could aim for about half the size. Show me some prototype options."

`kitsproto.html` (+ `kitsproto.jsx`), `shoot-kits.mjs` shoots and measures.
These mount the **real** `WediConfigurator`, so every price on screen is the
real kit total through the real tier lens — invented prices would be worse than
no prototype here. Each variant is a stylesheet layered over the shipped markup
(`?k=<key>`), which is also honest about cost: anything reachable in CSS is a
CSS-only change to the component's own block.

> A note on the harness: `WediConfigurator` renders its `<style>` from inside
> its own tree, i.e. **after** the variant sheet, so a variant rule at equal
> specificity silently loses every property the base also sets. The first run
> looked plausible and was wrong — `display`, `padding` and
> `grid-template-columns` overrides were all no-ops while the `display:none`
> ones worked. `bump()` doubles the scope class to win the tie.

### What is actually taking the space

Almost none of it is the card; it is the same words repeated on every card:

- **"Fundo® Shower Base"** on all 18 curbed cards — the family heading directly
  above already says FUNDO — CURBED.
- **"full kit"** on every card — the whole tab is priced as full kits.
- **"CENTER DRAIN"** on 16 of 18 — the two OFFSET pans are the entire signal,
  and they are invisible in the noise.
- The 124px note box above the first family (which is what the owner opened on).

| | Variant | Card | 1st family | Whole tab |
|---|---|---|---|---|
| | **Today** | 120px | 655px | 1729px |
| **K1** | Two-line card — size + drain chip, then price | 68px | 312px | 851px |
| **K2** | One line — size and price only | 28px | 182px | 851px |
| **K3** | Rows, two columns, aligned price track | 24px | 238px | 834px |
| **K4** | Two-line, **drain chip only where it differs** | 49px | 236px | 834px |

All four land at roughly half the tab (−51 to −52%), because dropping the note
and the two repeated captions is most of the win regardless of card shape.

Two things the shots make obvious that the numbers don't:

- **K2 breaks a real distinction.** With the drain chip gone, the two 36×72
  pans both read `36×72 in · $1,624.17` and the two 60×72 both read
  `$2,272.81` — identical rows that are actually a centre-drain pan and an
  offset one. Densest, but it hides the thing a salesman needs.
- **K3's name column is dead weight** — "Fundo® Shower Base" eighteen times down
  a column, truncated to "Fundo® Curbless Shower B…" in the next family.
  Dropping it makes K3 essentially K2-as-rows.

**K4 is the recommendation.** It is the only one that removes the repetition
*and* keeps the exception legible — the two OFFSET pans jump straight out of an
otherwise plain grid of size + price. It is also the only variant needing more
than CSS: the rule is "show the chip when this pan's drain differs from the
family's most common", faked in the prototype by a post-paint pass
(`markCommonDrains`), and about six lines in `kitsTab` for real.

Shots: `shots/kits-{today,k1,k2,k3,k4}.png`, plus `shots/kits-before-{1680,1280,1024}.png`
for the tab in its full frame.

### K5 — K3 reworked to the owner's notes (2026-08-02)

> "let's take a look at k3. But instead of it going along the lines of 36×36 inch
> shower base, we can drop the shower pan… let's just do 36×36 inch, and then it
> could be blank unless it is an offset or the corner pan. I'm also thinking,
> could we do them by feet first in bold and then in lighter text in inches. And
> then the price on the right hand side. But then also do the pans in order to
> where it's 36×36 and then 36×48, so the smallest size is always first with the
> long size second. So it's easy to find all the three foots, all the four foots."

`?k=k5` — 25px rows, first family 247px, whole tab 834px (from 120 / 655 / 1729).

- **Feet lead in bold, inches follow in light.** `3′ × 4′` `36 × 48`. The two
  off-foot sizes read `3′6″` (42″) and `4′6″` (54″ module); a module shows its
  single length, `2′8″` `32″ module`.
- **The name column is gone.** A tag appears only where a pan breaks its
  family's pattern — the three offset pans read OFFSET DRAIN and the Primo
  reads CORNER PAN; everything else is blank.
- **Sorted smallest side, then longest**, so all the 3-footers sit together,
  then the 3′6″s, then the 4-footers. No pan in the catalog stores `w > d`
  (checked all 30), so leading with the smaller number never misstates an
  offset pan's drain position.
- **Flows down the first column, then over.** A grid's `auto-fill` runs
  *across*, which zig-zagged the size order and defeated the sort — so the
  cards are a flex column-wrap instead, which honours `order`. (CSS multi-column
  ignores `order`, and reordering the DOM is off the table while React owns
  those nodes.)

Two rules needed a second pass after the first shot, both visible in
`shots/kits-k5.png`'s earlier revision:

- Every module was tagged `FUNDO® LINEA…` — each module's name carries its own
  length, so no name is a majority. A "usual" now needs at least two pans
  agreeing, otherwise nothing is an exception.
- `CORNER PAN · OFFSET DRAIN` truncated at the column. The corner pan's own name
  already reads "Corner/Offset Drain", so it never appends the drain.

Shots: `shots/kits-k5.png` (the tab), `shots/kits-k5-inframe.png` (in the popup).

### K6 — K5 tightened again (owner ask 2026-08-02)

> "For the main categories, it can just say curbed, curbless, linear, and neo
> modules… none of them need any small text and their little headers. The offset
> drain and corner pan can just say offset or corner. and everything can be
> pulled together even a little bit more. another thirty percent less maybe."

`?k=k6`. Family headings cut to one word with the hint lines dropped, tags cut
to OFFSET / CORNER, `module` dropped off the module rows (the heading says it),
and every gap pulled in — row padding, heading spacing, the space between
families, and the tab's own padding.

Measured at three widths, because the tab's content height depends entirely on
how many columns of rows fit — the same trap the header prototype fell into:

| Solver column | Today | K5 | K6 | K7 (1 col) |
|---|---|---|---|---|
| 752px (1500 viewport) | 1540px | 629px | **352px** | 814px |
| 452px (1200) | 2605px | 1068px | **814px** | 814px |
| 408px (1000) | 2618px | 1078px | **817px** | 817px |

K6 against K5: −44% / −24% / −24%, ≈30% on average, which is the ask; against
the shipped tab it is −69 to −77%. At 752px the whole catalogue — all 30 pans
and 5 modules, four families — sits in the top 352px with nothing to scroll
(`shots/kits-k6-inframe.png`).

**K7 is K6 forced to a single column** (`shots/kits-k7-inframe.png`): one price
column for the whole tab instead of one per column of rows, and the same shape
at every width. It is identical to K6 at 452px and below — the solver column is
too narrow for a second column of rows there anyway — so the entire cost of
single-column is 462px on a wide monitor, where K6 fits the catalogue on one
screen and K7 scrolls. Its stock dot became a flex item rather than an absolutely
positioned one: at `left:-3px` the pane clipped it in half.

Two structural changes were needed to get there, neither of them cosmetic:

- **The tag column had to become `auto`.** A fixed track was empty air on 31 of
  the 35 rows and was the only reason a third column of rows wouldn't fit. With
  `1fr auto 60px` the tag costs nothing when absent, and the price stays a fixed
  track so prices still line up down each column.
- **Every row has to be exactly one line.** `3′6″ × 3′6″ 42 × 42` wrapped in a
  126px track, which made those rows double-height — ragged to look at, and it
  broke the flex column-wrap height calculation, silently holding the tab at two
  columns. `white-space: nowrap` fixed both at once.

The 452px column is the weak point: one column of rows, 814px. That is the same
shape of problem as the header's 1680 case — the middle widths are where the
column is narrowest relative to its content.

### K8 / K9 — the narrow list, width to the other two (owner ask 2026-08-02)

> "the kit column doesn't need to be that wide. I would rather the build column
> or the drawing column gain some of that width… the actual kit column should be
> narrow compared to the other two."

Today `.main` is `flex:1` while `.buildcol` (392px) and `.diagcol` (356px) are
fixed, so **every extra pixel goes to the selection list** — the one column that
needs it least, and now needs it least of all at K7's row height. These pin the
list at 300px and let the other two grow into what it gives up.

At a 1500 viewport, with a kit built so the build column and drawings have
something in them:

| | List | Build | Drawings | Drawing SVG |
|---|---|---|---|---|
| Today / K7 | 577px | 567px | 356px | 327px |
| **K8** — build and drawings share the gain | 300px | 618px | 582px | **553px** (+69%) |
| **K9** — drawings grow twice as fast | 300px | 567px | 633px | **604px** (+85%) |

`shots/cols-{today,k7,k8,k9}.png`. The difference is not subtle: in K9 the
top-down layout's callouts — `offset drain @ 13 3/4", 18"`, the fall arrows, the
part number — are legible at a glance where today they are 8px text in a 327px
box, and the build column's line descriptions stop truncating.

300px is the floor for the row: dot + `3′6″ × 3′6″ 42 × 42` + an OFFSET tag +
the price needs ~282px, so 300 leaves a little air and no more.

**This must be scoped to the Kits tab.** `.main` is shared by all three
surfaces, and at 300px the Custom shower tab loses its option cards past the
first (`shots/cols-k9-custom.png`) and Browse loses its catalogue rows. The real
change is a modifier on `.pop-body` keyed to `tab === "kits"`, not a bare rule.

> A measuring bug worth recording, because it made the first set of sub-1200
> numbers wrong: the harness sized the column-wrap container from
> `getBoundingClientRect().height`, which is **device** pixels, while the
> `height` it then set is read in the element's own pixels. Below ~1160px of
> frame the popup carries a `zoom`, so the two disagree, the container came out
> short, and rows silently wrapped into extra columns — reporting 624px where
> the real figure is 817px. `offsetHeight` is zoom-free and is what the pass
> uses now.

### The note box

Settled (owner, 2026-08-02): **the content just goes.** No disclosure, no move
to the build column — deleting the `.kitnote` div and its CSS rule is the whole
change.


## Open

- **The Browse tab still wears the old segment.** A1 brought its own classes
  (`.rseg`/`.rchip`/`.rinp`) so `.seg`/`.inp` could keep dressing Browse's
  sealant-form toggle and search box untouched. That leaves one near-black
  segment in the popup against the header's moss — a two-line change to
  `.seg button.on` would settle it, but it repaints Browse and Kits, so it
  wants its own preview pass rather than riding along here.
- **1680 is the tight one** at 249px against the shipped 256px. The grid falls
  to two columns there; a fourth field in any group would put it back over.
