---
issue_type: Feature
summary: A cleaner estimate editor, on trial behind a per-user Settings switch —
  round 1 (header + preview toggle) shipped, header amended 2026-09-27;
  round 2a (area-card frame + headings) built; product rows next.
status: open
labels: [ready-for-agent]
---

# Clean editor (header shipped as a trial layout; area cards next)

Started 2026-09-27 from the owner's ask: redesign the project editor to feel as
clean as the sidebar, keeping every function but hiding rarely-used ones behind
icons or menus. Explored on a design canvas with Mobbin references, then built.

- Canvas (private, owner's claude.ai account):
  https://claude.ai/artifact/BqoJogPNrpSj5CMau88DhT
- Canvas sources, copied here: `mockups/` (Design-canvas `.dc.html` boards +
  `canvas.json`; they render inside the canvas, not standalone).
- Preview proof of the real component: `shots/` (from `header-preview.html`).

## Directions explored (mockups/)

| Board | Idea | Mobbin reference |
|---|---|---|
| `Main` (A) | Quiet sheet — everything visible, boxes removed | — |
| `ChipRow` (B) | Big title + Linear-style property chips | Linear project page |
| `SidePanel` (C) | Document + collapsible job-settings panel | Squarespace / HoneyBook invoice editors |
| `Dock` (D) | Header is only the title; a floating bottom dock | Chronicle |
| `TopBar` (E) | **Picked** — B's header + D's compact bar, docked at the top | — |
| `ErpStates` | The Order entry button's four ERP states | — |

## Round 1 — shipped: `ProjectHeaderClean` (src/projectheader.jsx)

Owner decisions, in the order they were made:

1. Customer is the headline; the project is a small line under it.
2. Salesperson shows the name only (the picker still edits phone/email).
3. Edit / Print preview tabs are gone in Clean — a small page icon toggles the
   preview, and the header stays on screen in both modes.
4. The bar's settings (price level, estimate shows, waste) are plain text with
   carets, no pills, no icons, no divider lines — the carets separate them.
   Dropdowns/popovers use the shared MorphSelect / `.ft-pop` look (ADR 0048).
5. Freight is a truck icon: quiet when on (nearly always), amber + struck
   through + the words "No freight" when off. (Claude suggested the words;
   owner approved.)
6. Order sheet button dropped from Clean (kept in One-bar/Classic). Save moved
   into ⋯ as "Save a named version…" (the job itself auto-saves; this makes a
   snapshot), Versions and Delete live in ⋯ too.
7. ERP 1 order: the number shows beside the N-number (neutral while lines are
   still to paste, green once all are) AND on the Order entry button, which
   turns green with a check once every line is pasted, "N left" before that.
   Green means ALL lines pasted, not just "a number was added" (owner: option 1).
8. The bar sits on the header's own cream, separated by faint hairlines only.
9. The whole thing is a third choice in Settings → General → Project header
   (One-bar / Classic / Clean), and that choice is now PER USER (ui.header),
   not per device. Functions are hidden, never removed; the old layouts are
   untouched so anyone can flip back.

Known gap: the button's "N left" counts unmerged lines (`erpLines` in App.jsx);
the order-entry panel's own counts can merge a SKU repeated across areas, so the
two numbers can differ on such a job.

## Round 1 amendment — header top right + address (2026-09-27, owner)

10. The top right drops the job total, the tier discount badge and the
    Option A/B total chips — no money in the header at all (the editor's
    Order summary still carries every total). The salesperson's NAME ONLY
    sits there instead (bold, right-aligned; click opens the same picker);
    "Saved ✓" stays above it. The salesperson leaves the project line.
11. The address shown is the project address when one is set, otherwise the
    customer's. The customer's shows fainter and opens the customer (it's
    edited there); with neither, "Add address" opens the customer — or, on an
    unassigned / quick-price job, the project-address box.
12. The project address is added / changed through ⋯ → "Add project
    address…" (or by clicking it on the line): a popover holding the real
    AddressField (Maps suggestions + drive distance) and "Use customer's
    address", which clears it.
13. Print follows the same rule — project address first, then the customer's
    (it used to prefer the customer's). This one is shared by every header
    layout. Order entry already worked this way.

Proof: `shots/13-r2-*` … `shots/20-r2-*` (header-preview.html). The Maps
suggestion pick inside the popover wasn't exercised (no Maps key in the
preview) — check it once on the live site.

## Round 2a — built: area-card frame + column headings (2026-09-27)

Owner decisions: frame + headings only this round (product rows, materials
drawer, line menu, drift chips and notes untouched); rides the SAME Clean
switch — `cleanCards = isWide && headerLayout === "clean"` in App.jsx, so
One-bar / Classic / phone keep today's cards. Built straight into the app
(owner: "whatever is more efficient") and shown as real-app screenshots.

- Each area is a white card, hairline border, 12px radius, 12px gap between
  cards (they used to butt together). No grey band.
- Area row: hover-only drag grip · name (15px bold sans, was 20px serif) ·
  option chip (when the job has options) · "N items · N SF" or "Empty" ·
  subtotal right, bold · ⋯. The ⋯ opens the existing area menu (right-click
  still works) with "Delete area…" added at the bottom — it opens the same
  red confirm strip. The always-on trash and grip are gone from the row.
- Column headings once above all cards, small faint caps, no bar.
- Add area: same dashed button, 12px radius, 44px tall.

Proof (real App.jsx over stubbed Supabase, the ticket-111 harness):
`shots/21-r2-cards.png`, `21-r2-hover-grip`, `21-r2-area-menu`,
`21-r2-delete-confirm`, and `25-r2-onebar-unchanged-cards` (One-bar as before).

## Round 2b — prototypes for the owner to pick from (2026-09-27)

Owner, after seeing 2a: Clean only helps if it also COMPACTS; 2a read as
taller. Happy with how readable today's lines are, but open to seeing other
product-line ideas. Asked for several prototypes instead of one build.

Area frames — real App.jsx behind a throwaway `?pv=a…e` switch (`cardPv`,
remove once one is picked). Product rows untouched. Same 6-area job, 1440×940:

| pv | Idea | Areas started on screen |
|---|---|---|
| a | 2a as built (46px row, 12px gaps) | 5 |
| b | Tight cards (32px row, 6px gaps) | 5 |
| c | One sheet, tinted slim name rows, no gaps | 5 |
| d | Name + column labels + subtotal in ONE 30px bar per area | 5 (most room) |
| e | b + a fold chevron per area (2 folded in the shot) | 6 |
| — | One-bar today | 4 |

Shots `30-pv-a` … `34-pv-e`, `29-onebar-today`. Finding: the frame is not
where the height is — the per-row "+ Extras"/materials strip, the notes
line and the per-area search row are.

Product lines — static mockups (`mockups/rows.html`, same two areas; shots
`40-rows-today` crop of the real app, `41…44-rows-r1…r4`). Card heights for
those two areas: today ≈405px · R1 ≈265 · R2 ≈295 · R3 ≈175 · R4 ≈337.
- R1 same columns, no strips — grout/mortar as tags in the product cell.
- R2 two-line product — SKU/cov/extras on a quiet 2nd line; SKU + Cov.
  columns dropped.
- R3 ledger — one 26px line each; G/M letters; search moves into the bar.
- R4 extras as their own indented lines with order + price (clearest).
The mockups' grout/mortar quantities are illustrative, not computed.

## Round 2c — owner picks D + R1 (2026-09-27)

Built: frame D is now THE Clean frame (the ?pv= switch is gone). Changes the
owner asked for on top of D:
- No item count / square footage in the area bar.
- No option chip. An option area's bar is tinted in its option color with the
  slot letter (A, B…) in a small filled square at the far left; shared areas
  stay plain. Right-click / ⋯ / the letter open the area menu to change it.
  The card itself keeps a neutral border (no colored outline).
Shot: `50-D-option-tint.png`.

Next — R1 product lines in the real app. Open question for the owner: how an
empty line offers extras — `45-extras-hover.png` shows H1 (dashed "+ Extras"
after the name on hover), H2 (a + beside the line's ⋯ on hover), H3 (a very
faint + always there, "+ Extras" on hover). Whatever is picked, "Add extras"
also goes in the line ⋯ menu for the shop iPads (no hover). Warnings
("Mortar — not calculating") must stay visible inline as an amber tag (ADR 0045).

## Round 2d — line front exploration (2026-09-27)

Owner: drop the T/V/M type chip at the front of a filled line (you set type
when starting a line by hand, rarely after) — move "change type" into the
line's ⋯ menu; put a + for extras either between size and product or IN the
old type slot ("maybe that's the play"). Keep extras as today's info strip
under the line when there are any; no strip at all when there are none.

Mockups (`mockups/lines.html`): `51-line-L1-plus-in-type-slot` (the type slot
becomes a + — faint on a line without extras, green on one with extras or on
hover; a blank new line keeps the type picker), `52-line-L2-plus-before-name`
(no front slot; a small + just before the product name), `53-line-type-in-menu`
("Type  Tile ›" at the top of the line menu, opening the list in place like
Move to area). Waiting on the owner's pick.

## Round 2e — L1 built; option colors proposed (2026-09-27)

Owner picked L1. Built (Clean only): a line with content (`!rowBlank`) shows a
+ in the old type slot — faint with no extras, moss with extras, opens the
extras drawer; a misc line has an empty slot; a blank manual line keeps the
type picker. Type moved into the line ⋯ menu ("Type · Tile ›", expands in
place). The empty "＋ Extras" strip is gone in Clean. Shots `55-L1-real`,
`56-L1-plus-hover`, `57-L1-type-menu`.

Owner: area bars go back to the ORIGINAL tan (`--ft-area-head`) — the bar and
the white search rows must differ. Done; option bars mix their color into
the tan.

Owner: options get their OWN colors again — this reverses the 2026-08-26
"one slate-blue tint, the letter is the identity" call in `src/options.js`.
Proposed palette `54-option-palette.png` (`mockups/palette.html`), A–L:
slate blue, berry, teal, violet, ochre, magenta, sky, brick, graphite,
mauve, navy, walnut. Waiting on approval before touching OPTION_COLOR (it
is shared by every layout, the Order summary and the phone).

## Round 2f — per-option colors applied everywhere (2026-09-27)

Owner approved the palette with the stronger bar tint. `OPTION_COLOR`
(src/options.js) now maps A–L to their own colors; ADR 0031 amended. Clean's
option bars mix 24% of the color into the tan. Reaches every layout: header
option chips, compare tabs, Order summary, the option print bands. Shots
`60-option-colors-clean`, `61-option-colors-print-preview`,
`62-option-colors-onebar`.

## Round 2g — card outline = the dropdown line (2026-09-27)

Owner: cards should be easier to tell apart at a glance — use the same line
the dropdowns draw. Clean cards now carry a 1.5px `var(--ft-text)` border
(SearchPop's box line; flips with dark mode). Shots `63-card-ink-line`,
`64-card-line-vs-dropdown`.

## Round 2h — card border back to regular; header-in-one-band prototypes (2026-09-27)

Owner: the ink card outline (2g) goes back to the regular card border the
non-Clean layouts use (`border-slate-200`, 1px).

Owner: can the whole header fit in the rail logo block's height, so the
line under "the ned" runs straight across the top? Prototypes behind a
throwaway `?hv=` switch (App.jsx `headBand`; ProjectHeaderClean `band`
prop). The band is sticky at the top of the scroll area, measured to the
rail logo block's height (ResizeObserver), same slate-100 bottom line.
- h1 — two rows in the card column: customer · project · N · address ·
  notes … salesperson / settings · icons … Order entry · Print.
- h2 — two rows: customer · project · N … Order entry · Print / settings ·
  icons · address · notes … salesperson.
- h3 — one row across the full width: customer over a tiny project line,
  controls and actions to the right. Cramped at 1280 (name/address clip).
Shots `71/72/73-band-h*.png`, `-scrolled` (the band stays pinned),
`-1280` (laptop width).

## Round 2i — owner picks h1 (2026-09-27)

h1 is now THE Clean header; h2, h3, the old tall stacked layout and the
`?hv=` switch are gone. App always pins Clean's header in the sticky band
measured to the rail logo block (desktop only — the phone keeps its band).
`header-preview.html` wraps the demo in a 73px box with the same line.

## Round 2 — open: product rows

What the mockups show (every board uses the same card treatment; the frame
and headings items are done in 2a):

- No grey band per area and no grey column-header bar; each area is a white
  card with a hairline border and 12px radius.
- Column headings shown ONCE above all areas (small faint caps), not per card.
- Area row: name, item count ("3 items"), the area subtotal right-aligned, ⋯.
- Product rows: hairline dividers, type chip + size, name bold, SKU/cov muted,
  the un-rounded exact beside the order qty ("13.4 14 ctn"), total bold.
- The empty adder row: "+ Search SKU or product…" in faint text.
- "Add area" as a dashed full-width button.

Not yet decided — ask the owner:

- How much of the grid's per-row chrome (materials drawer, line menu, drift
  chips, notes) changes vs only the area frame and column header.
- Whether Clean's area cards are part of the same Settings switch or a second one.

## Also open

- Printed estimate still shows the salesperson's phone under "Your
  salesperson" — header-only change so far; owner to say if print drops it too.
- Order sheet: retire it (and One-bar/Classic) once Clean is the only layout.
