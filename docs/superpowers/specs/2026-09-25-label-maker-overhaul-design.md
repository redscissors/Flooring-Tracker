# Label maker overhaul — design spec

**Date:** 2026-09-25
**Status:** Draft for owner review
**Area:** Apps → Label Generator (`src/AppsWorkspace.jsx`, `src/labels.js`, `src/uselabels.js`)
**Mockups:** `.scratch/157_label-maker-overhaul/`. `three-col.html` is the approved layout.
`takes-a1b.html` holds the approved form details and the template dropdown. `current.png` shows
today's screen.

Builds on the 2026-07-18 Apps hub + Label Generator spec. The dark card design itself does not change.

---

## 1. Why

Owner feedback 2026-09-25:

1. **Grout falls off the card.** A filler line holds a fixed gap, so a tile name that wraps pushes
   everything below it down, and grout slides off the bottom.
2. **The screen is cluttered.** The template settings sit in the everyday form: size, height,
   header, and every line's eye, grip and font stepper. That buries what you actually do each time:
   fill from the stock book, type, save.
3. **Save is at the bottom.** You search at the top, then scroll to save.
4. **The label set draws cards centred.** Each card is rendered inside a `<button>`, which centres
   text by default. The preview and the print are left-aligned.
5. **New:** keep a shelf's worth of labels current. Select a group, re-check their SKUs against the
   stock book, update prices, reprint the ones that moved, and clean out labels whose SKU is gone.
6. **New:** fill a two-size label in one pick from the stock search.

## 2. Layout: three columns, the configurator shape

The layout matches the wedi / Schluter / Sheoga configurators (mockup `three-col.html`).

| Left (340px): find & fill | Middle (~300px): template + preview | Right (flex): the label set |
|---|---|---|
| Stock search (full width) | Template dropdown | Search · template filter chips |
| Status · **New** · **Save label** | Live preview, drawn larger than life | Selection bar → Print · Update from stock book · Delete |
| Text form | "Name shrunk 13 → 11" note when it fires | Cards with a corner checkbox |

- The old preset strip, the Size & header block and the top-of-pane bar are removed.
- **Status line:** "● New label", or "● Editing 'Alpine Charcoal'" with an amber dot. It tells you
  what Save will do. The button reads **Save changes** while you're editing a saved label.
- Below the app's `md` breakpoint the columns stack in the same order.

### 2a. The everyday form (left)

- A strict three-column grid: **label | box | font size**. Every box starts and ends on the same
  line.
- **Surface** is one joined two-button control, Wall | Floor & Wall, exactly the box width. Its
  font-size cell is empty.
- **Font size** is plain **− 13 +** in quiet grey. There are no outlines, the signs sit tight to the
  number, and they turn to ink on hover. Changing it changes only this label.
- Rows follow the template: only lines the template shows appear, in the template's order.
- **Pinned lines** sit under a thin moss dashed **"Bottom of label"** divider. Each pinned line's box
  has a moss left edge (option 3). The divider appears once, however many lines are pinned, and not
  at all when the template pins nothing.
- **＋ Add a second size** replaces the old "Second SKU / size / price" checkbox. When it's on, the
  SKU, Size and Price rows each show two boxes side by side (1st | 2nd), with a **✕ Remove second
  size** link. The width behaviour is unchanged: the label widens to 2″ if narrower and goes back when
  removed.

### 2b. Stock search with multi-pick

- Clicking a result's name fills the form, as today.
- Each result also has a **checkbox**. Ticking results shows a footer:
  - **Exactly two ticked → "One label, 2 sizes"**, plus "Add 2 labels". It turns on the second size
    and fills it. The **bigger face size goes first**, measured by face area (24x48 before 12x24),
    whatever the tick order. The name comes from the bigger item with its size trimmed off the end
    ("Calacatta Gold Polished 24x48" → "Calacatta Gold Polished"). Brand and thickness also come from
    the bigger item. Ticked rows show "1st" / "2nd" badges so the order is visible before you choose.
  - **Two or more ticked → "Add N labels"**, one saved label per item on the current template. This
    replaces today's hidden shift-click bulk add.
- If both sizes are equal or can't be parsed, tick order decides and the footer says so.

### 2c. Template dropdown (middle, top)

There is no separate ⚙ button. The template chip opens one menu, drawn in the app's dropdown look
(`.ft-pop`, grown from the chip):

- **Templates:** each is drawn to its shape, with its size and "≈N/sheet". The current one is ticked.
  Picking one switches the label you're working on, keeping the typed text.
- **⚙ Edit "Sample Tag"…** opens the template editor.
- **＋ New template…** opens the editor on a copy of the current template.

### 2d. Template editor

The editor opens **in the right column, in place of the label set**. The preview stays in the middle
and the form stays on the left, so you can type a long name and watch the template handle it. The
chip reads **Editing "Sample Tag" ✕**. The ✕ closes without saving.

- **Size & header:** width, height, header ("Keim" or blank prints the logo, as today), ≈N/sheet.
- **Lines:** drag to reorder, eye to show or hide, and the template's default font size per line.
  The list includes one **"Pinned to bottom" divider row**: drag lines below it to pin them.
  ＋ Filler space stays.
- **Update "Sample Tag"** saves over the template. If any saved labels use it, it then asks: **"Also
  restyle the N saved Sample Tag labels?"**
  - **Yes:** each label takes the template's size, header, line order, show/hide and pins. Its text,
    prices, second size and SKU are kept. The label's own font nudges are reset to the template's.
  - **No:** saved labels keep the layout they were made with.
- **Save as new…** asks for a name and saves a new custom template.
- **Built-in templates become editable** (Sample Tag, Spec Card). Today, code-defined built-ins always
  win over anything saved (`normLabelPresets` drops saved entries with built-in ids). That rule
  changes: a saved entry with a built-in id **overrides** the code default. The editor then offers
  **Reset to default** on a built-in that has been overridden. *This reverses a recorded rule in
  labels.js, so it is flagged here for the owner's OK.*

### 2e. The label set (right)

- Cards render **left-aligned** (fix: `text-left` on the card button). What you see matches the
  preview and the print.
- Click a card to edit it, as today (amber outline while editing). A **round checkbox** in each card's
  corner selects it. Shift-click still toggles selection.
- **Selection bar** (dark, above the cards):
  - With nothing selected: "Select: click cards, or **Select all N shown**". Combined with the search
    box and template chips, that is how you pick a group.
  - With some selected: **"N selected · 🖨 Print N · N sheets · ↻ Update from stock book · Delete ·
    Clear"**.
- **Print all** moves into this bar as "Select all shown → Print", so there is one print path.
  **Delete** of several labels confirms first ("Delete 4 labels?").

## 3. Pin to bottom + name auto-shrink (the card)

### Data

`lines` gains one optional **divider entry**: `{ key: "pin", show: true, size: 0 }`. Lines after it
are pinned to the bottom.

- `normLines` keeps at most one divider and drops extras.
- A lines list with no divider pins nothing. **Every label saved today renders exactly as it does
  now.**
- The **built-in Sample Tag and Spec Card gain a divider above Grout Color.** Existing labels are
  snapshots, so they don't change. New labels on those templates get the pinned grout.

### Rendering

Both the screen `LabelCard` and the print `labelCardHTML` use the same structure:

```
card (flex column, fixed w×h, overflow hidden)
  header (logo / text) + rule
  body   — lines before the divider
  bottom — lines after the divider, margin-top:auto, flex-shrink:0
```

### Auto-shrink

If the card's content is taller than the card, the **tile name** steps down 0.5px at a time until it
fits, stopping at a 7px floor.

- **Screen:** `LabelCard` measures itself after layout (`useLayoutEffect`, re-run when the text,
  sizes or template change) and renders the fitted size. The preview shows "Name shrunk 13 → 11 to
  fit". If it still overflows at the floor, the note turns rust: "Still too long, shorten a line."
- **Print:** the print popup runs the same fit loop over every card after `document.fonts.ready`,
  then prints. The fitting rule lives in labels.js (`fitNameSize(measure, start)`, a pure step
  function) so both paths share it and it can be unit-tested with a fake measure.
- The stored font size never changes. The fit happens at draw time, so a later shorter name gets its
  full size back.

## 4. Update from stock book

Runs on the selected cards.

1. **Lookup.** For each card, take the printed SKU (`fields.sku`, falling back to the provenance
   `sku`), plus `fields2.sku` on a two-size label. Match it against the stock-book cache in any
   `skuKeys` spelling (orderbook.js, the same rule order entry uses). Inactive or disabled items count
   as not found.
2. **Gate.** Per CLAUDE.md, anything reading the stock cache waits for `bookStockReady`. Until then
   the button reads "Stock book loading…" and is disabled, so a cache that hasn't loaded can never
   flag the whole shelf "not found".
3. **Review** (opens in the right column, nothing written yet):
   - **Price changed (n):** name · SKU · <s>old</s> **new** (rust = up, moss = down). A two-size card
     lists each side.
   - **Up to date (n).**
   - **SKU not in the stock book (n):** each row has **Keep** (default) / **Delete label**.
   - A card with no SKU at all lists under "No SKU, skipped".
4. **Apply: update N · delete M.** **Only the price line changes**, using the same price text a fresh
   fill writes (`stockToLabelFields(item).price`). Name, size, brand, grout and hand edits stay put.
   All updates go in one bulk upsert and all deletes in one bulk delete.
5. **Afterwards** a bar reads "✓ Updated N labels", with **🖨 Print the N updated · K sheets** and
   **Done**.

## 5. Write paths (uselabels.js)

Existing: `addLabel`, `addLabelsBulk`, `updateLabel`, `delLabel`, `saveLabelPreset`. New:

- `updateLabelsBulk(patches)` — `[{id, patch}]` → one optimistic `setLabels` + one `upsert` of
  `{id, position, data}` rows. Used by Update from stock book and by template restyle.
- `delLabels(ids)` — one optimistic filter + one `.delete().in("id", ids)`.
- `saveLabelPreset` already replaces by id, so it covers both Update and Save as new.
  `serializeApps` persists overridden built-ins (see §2d).

No schema change. `labels` rows keep the same `{id, position, data}` shape, and `data.lines` simply
may contain the divider entry. **No SQL to run.**

## 6. Pure logic added to labels.js (unit-tested)

- `PIN_KEY`, and a `normLines` that keeps at most one divider; `splitPinned(lines)` →
  `{ body, bottom }`.
- `fitNameSize(overflowsAt, start, floor = 7)` — the shrink step loop over an injected measure.
- `faceArea(sizeText)` and `twoSizeDraft(itemA, itemB)` — bigger-first ordering, name with the
  size trimmed, second size fields.
- `restyleLabel(label, preset)` — template layout onto a saved label, keeping text, second size and
  SKU.
- `refreshPlan(labels, stock, skuKeysFn)` → `{ changed:[{id, patch, before, after}], same:[…],
  missing:[…], noSku:[…] }`. The review screen reads it directly and Apply writes `changed`.
- `labelCardHTML` renders the body/bottom split. The print popup's fit script calls the same
  step rule.

## 7. Out of scope

- Deleting or renaming custom templates. There's no delete today, so it can be a follow-up if the
  list grows.
- Refreshing anything other than the price (owner's choice).
- Named "collections" of labels. A group is whatever the search plus template chip shows.
- Avery peel-and-stick alignment (still phase 2 of the original spec).

## 8. Testing & proof

- `labels.test.js`: divider normalization and legacy lists (no divider = identical output),
  `splitPinned`, `fitNameSize` over a fake measure, `twoSizeDraft` ordering / name trim / equal
  sizes, `restyleLabel` keeps text, `refreshPlan` buckets (changed / same / missing / no SKU /
  two-size / skuKeys spelling / disabled item).
- `npm test`, `npm run lint`, `npm run build`.
- **Preview proof (non-negotiable 3):** a dev harness
  (`.scratch/157_label-maker-overhaul/preview.jsx`) mounts the REAL `AppsWorkspace` over in-memory
  labels and stock. Screenshots:
  - everyday view with a long name shrinking above pinned grout
  - the template dropdown
  - the editor + restyle prompt
  - multi-pick "One label, 2 sizes"
  - a selected group → the update review → the print-updated bar
  - the `labelCardHTML` print strip beside the screen cards, showing matching fit and pin
- `src/CLAUDE.md` entries for labels.js / uselabels.js / AppsWorkspace.jsx are updated.
