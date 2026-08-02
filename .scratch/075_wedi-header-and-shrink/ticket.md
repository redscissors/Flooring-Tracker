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
```

`hub.html` mounts the real `AppsWorkspace` with mock commit handlers — no
credentials, no network, no writes to the live project.

## Open

- **Which header?** A / B / C / D, or a mix (e.g. B's two-tier layout with D's
  gutter labels). Nothing is ported into `WediConfigurator.jsx` yet — the
  candidates live only in the prototype.
