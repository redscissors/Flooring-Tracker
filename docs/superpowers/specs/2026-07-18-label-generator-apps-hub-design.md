# Apps hub + Label Generator — design spec

**Date:** 2026-07-18
**Status:** Draft for review
**Area:** New feature — a general "Apps" hub in the sidebar, with the Tile Sample Label Generator as its first app.

---

## 1. What we're building and why

The shop has a standalone HTML label maker (the "Keim" tile-sample label tool) that prints small dark
sample tags for the showroom shelf. This brings it *into* FloorTrack as the first entry in a new **Apps
hub** — a home for shop utilities that can grow over time — and upgrades it in three ways the standalone
version can't do:

1. **Shared, not per-device.** The label set lives in Supabase and is the same for the whole team,
   instead of being stuck in one browser's localStorage.
2. **Reads from the stock price book.** A SKU/name lookup auto-fills a label's Name, SKU, Size, and Price
   from `stock_items`, so you're not retyping what the shop already knows.
3. **Multiple, self-serve label sizes.** Instead of one hardcoded 1.5×2.5 card, sizes are **presets** the
   team can create and save (choose a size, choose which lines show, save it) — no code change to add one.

### Scope boundaries (agreed)

- **Standalone tool.** Labels are NOT attached to any customer or job. This is a showroom/shelf utility
  under Apps, deliberately separate from the estimate flow.
- **Cut-apart printing only** for v1: labels tile onto a plain letter sheet you cut by hand, exactly like
  the current tool. Avery-style peel-and-stick sheet alignment is an explicit **phase 2** and the data
  model is designed so it can slot in without rework.
- **No free drag-and-drop label designer.** Customization is *structured* (below), not a free canvas.
  This was a deliberate call: free 2D positioning is a large, fragile build (saved x/y coordinates,
  collision, screen-vs-print scaling) for a card that is really just a stack of text lines.

---

## 2. The Apps hub (the container)

A new **Apps** button in the sidebar's bottom bar, alongside `Settings · Issues · Sign-out`
(`src/App.jsx`, the footer `flex gap-2` row). Clicking it opens a **near-fullscreen workspace** built on
the exact pattern `SettingsWorkspace` already uses: a left nav rail listing the apps + a panel area
showing the selected app.

- Today the rail has **one** entry: **Label Generator**. Adding "app #2" later means adding one entry to
  a `APPS` array and one panel component — no new plumbing (no router, no context; the app uses local
  `useState` + trailing conditional JSX, same as every other overlay).
- State: `const [showApps, setShowApps] = useState(false)` plus `const [appView, setAppView] = useState('labels')`,
  rendered as a trailing `{showApps && <AppsWorkspace .../>}` block near the existing `{showSettings && ...}`.

This keeps the "extensible platform" promise real while building exactly one app now (YAGNI).

---

## 3. Data model & storage

Two kinds of data, stored in the two places that match how the rest of the app already works:

### 3a. Saved labels → new shared `labels` table

Mirrors the `todos` table pattern (one row each, shared team-wide, open to any signed-in user,
last-write-wins). File: **`supabase/labels.sql`** — written by an agent, **run once by hand in the
Supabase dashboard by the owner** (per the project's non-negotiable: agents never mutate the live DB).

```
labels row : { id (text pk),
               position (float — set order, smaller = earlier),
               data: Label,
               created_at, updated_at }

Label { id, presetId,
        fields: { name, sku, size, price, surface, grout, brand, thickness, note },
        sizes:  { [fieldKey]: number },   // per-line font size overrides (optional)
        sku:    string | null,            // the stock SKU this was filled from, if any (provenance only)
        createdBy, createdAt, updatedAt }
```

- `fields` are all plain editable strings. A SKU pick *pre-fills* them; the user's edits are what get
  saved. Nothing re-reads the stock book after a pick (snapshot convention, like everywhere else in the app).
- `presetId` points at the preset (size + line layout) the label uses.
- RLS: same shape as `todos.sql` — every signed-in user can select/insert/update/delete.

### 3b. Presets → shared settings (no second table)

Presets are small configuration and there are only a handful, so they ride along in the existing shared
`settings` record (ADR 0002), normalized in `mergeSettings` (`src/catalog.js`) so old records stay valid.

```
settings.apps.labels.presets : Preset[]

Preset { id, name,
         w, h,                 // inches
         header,               // printed brand line, default "Keim", editable
         lines: [ { key, show, size } ]   // ordered; key ∈ the label field set; show=visible; size=font px
       }
```

Two **built-in presets** ship in code (always present, seeded by `mergeSettings`):

- **Sample Tag** — 1.5 × 2.5″. The current card, unchanged. Default visible lines: name, sku, size,
  price, surface, grout.
- **Spec Card** — 3 × 4″. Roomier; additionally shows brand + thickness by default.

Team-saved custom presets are appended to this list and shared with everyone.

---

## 4. The Label Generator UI

Layout validated against real-world editors (Mailchimp's postcard editor is the closest analog: content
fields left, live preview right). Left form / right preview, with a preset strip on top.

### 4a. Preset strip (top)

A horizontal row of **visual** size chips (borrowed from Kit's format picker): each preset drawn to its
real proportions with its name, dimensions, and an **"≈N per sheet"** count (see §5). Plus a **＋ New size**
chip to create a custom size. The active preset is highlighted.

### 4b. Form (left panel)

- **"Fill from stock book" search** at the top. Reuses `searchStock(stock, query)` (`src/stock.js`) and
  the existing pick-to-fill pattern (`StockSearch` in `App.jsx` is the closest model). Behavior:
  - **Single pick** → auto-fills the form's Name / SKU / Size / Price (and Brand / Thickness when the
    preset shows them) from the stock item, then the user edits freely.
  - **Shift-click several** → each picked item is saved as its own label immediately (bulk add), matching
    the product-row multi-select behavior.
  - The stock book does not know Grout Color or Floor/Wall — those stay manual.
- **Label lines**, rendered as a property-panel list. Each line row has:
  - a 👁 **show/hide toggle** (which lines appear on this label / preset),
  - a ⠿ **drag handle** to reorder (1-D list reorder only),
  - the editable field (text input, or a segmented control for Floor/Wall),
  - a **−/+ font size** stepper (the control from the current tool).
  - Field set: **name, sku, size, price, surface (Floor/Wall), grout, brand, thickness, note.**
- **"Save these lines & size as a new preset"** — names the current size + line layout as a shared preset.
- **Save Label / New** actions.

All fields remain editable at all times; the SKU lookup is a starting point, never a lock.

### 4c. Preview + label set (right panel)

- **Live preview** of the card at the chosen size (the unchanged dark "Keim" card design). Header text
  comes from the preset (`header`, default "Keim").
- **Find/organize bar** above the set:
  - **Search** — filters the set by name / SKU / grout.
  - **Size filter chips** — `All · Sample Tag · Spec Card · <customs>`.
  - **Sort** — Recent / A–Z.
- **Label Set grid** — each card click-to-edit, shift-click to select for printing. **Delete** is the only
  card management action (no undo, duplicate, or archive — new cards are cheap). A delete confirms if it
  removes a selected label.
- **Print controls** — **Print Selected (n) · N sheets** and **Print All (n) · N sheets**, printing the
  cut-apart letter layout (existing `@media print` approach). Import / Export JSON is retained.

---

## 5. "How many fit on a sheet" calculation

Pure helper in `src/labels.js`, e.g. `perLetterSheet({ w, h })`:

- Usable area = letter (8.5 × 11″) minus page margins and inter-label gutter (reuse the current tool's
  0.3″ margin / 0.15″ gap so printed output is unchanged).
- `cols = floor((usableW + gap) / (w + gap))`, `rows = floor((usableH + gap) / (h + gap))`,
  `perSheet = cols × rows` (also try the 90°-rotated fit and take the larger; portrait sheet).
- Rough results: Sample Tag (1.5×2.5) ≈ **12/sheet**; Spec Card (3×4) ≈ **4/sheet**. Custom sizes compute
  live as dimensions are typed.
- Sheet count for a print job = `ceil(labelCount / perSheet)`, shown on the print buttons.

---

## 6. File layout & write paths

Following the project's split (pure logic in its own module, UI separate; sanctioned write paths only):

| File | Role |
|---|---|
| `src/labels.js` | **New.** Pure JS: field definitions, built-in presets, `stockToLabelFields(item)` mapping, `perLetterSheet()`, label/preset normalization. React-free, unit-testable (like `stock.js`, `sheoga.js`). |
| `src/AppsWorkspace.jsx` | **New.** The hub frame (nav rail) + the Label Generator panel UI. Modeled on `SettingsWorkspace`'s shell. |
| `supabase/labels.sql` | **New.** `labels` table + RLS (owner runs once by hand). |
| `src/App.jsx` | Wiring: sidebar **Apps** button, `showApps`/`appView` state, `loadLabels()` on mount, and CRUD write paths `addLabel` / `updateLabel` / `delLabel` / `reorderLabels` (mirroring `addTodo`/`updateTodo`/`delTodo`/`reorderTodos`). Passes `stock` and `settings` down. |
| `src/catalog.js` | Extend `mergeSettings` to normalize `settings.apps.labels.presets` (seed the two built-ins) so old records stay valid. |

Deployment note: like every other `supabase/*.sql`, the table doesn't exist until the owner runs the SQL.
Until then the Apps → Label Generator screen should degrade gracefully (empty set, a one-line "run
labels.sql to enable saving" style note rather than a crash), the same way stock search is empty until
`stock.sql` + an import have been run.

---

## 7. Explicitly out of scope (clean future phases)

- **Avery / peel-and-stick sheet alignment** — needs pixel-perfect layout tied to a specific label
  product; revisit once the shop standardizes on one. Data model already supports adding it as a preset
  print-mode.
- **Free drag-and-drop positioning** of card elements.
- **Per-customer/per-job labels** (pulling a job's selected products in as labels) — possible later; the
  standalone hub doesn't preclude it.
- Restyling the card itself — kept identical to the current Keim card for now.

---

## 8. Testing

- **Unit (`src/labels.test.js`):** `perLetterSheet` math for the built-ins + a few custom sizes;
  `stockToLabelFields` mapping from a normalized StockItem; preset/label normalization defaults.
- **Preview proof (project non-negotiable #3):** a working preview screenshot of the Apps → Label
  Generator screen and a print preview before merge.
- **Manual:** SKU single-pick fill, shift-click bulk add, edit-after-fill, preset create/apply, set
  search/filter/sort, delete, print sheet-count correctness.

---

## 9. Open follow-ups

- Record an **ADR** for the two notable decisions here (labels in a new shared table + presets in
  settings; structured presets instead of a free-drag designer) once the approach is confirmed.
- Confirm the built-in Spec Card default line set (does brand + thickness earn their place, or keep it
  lean?) during build, against a real printed sample.
