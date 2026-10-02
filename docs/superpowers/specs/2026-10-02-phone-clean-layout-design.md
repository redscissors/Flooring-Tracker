# Phone Clean layout: header A, flat area list, thin titles (design)

**Date:** 2026-10-02 · **Status:** draft for owner review
· **Mockup:** `.scratch/mockups/mobile-clean-options-2026-10-02.html`
(published as https://claude.ai/artifact/55ENTLaESCFCpGkE8oUHum; the
"Your pick" section is the agreed look)
· **Related:** `.scratch/159_clean-editor` (desktop Clean), ticket 169 (the
Price book double-tap fix, PR #479, which ships separately)

## Problem

Desktop moved to the Clean header (customer as the headline, settings as plain
text with carets, the extra controls behind ⋯). The phone still uses the
2026-09-15 Fold 5 band: a title bar plus a boxed grid of Customer, Salesperson,
Project, price level, Total and three mini buttons. Under that, each area is a
tan band with a serif name, a grip and a trash can. On the Fold 5 cover screen
(344px wide) all of this is busy, and it takes room away from the lines.

## Owner decisions (2026-10-02)

1. **The whole R3 phone:** header A on top, the R3 flat list, and today's
   three-button bottom bar (+ Area · + Product · Price book), unchanged.
2. **Thin area titles:** about half the first R3 height (~16px instead of
   ~30px).
3. **The job total stays visible:** a small total in the header, in the
   price-level colour.
4. **Everyone on a phone gets it.** It doesn't follow Settings → Project
   header. Today's phone band (`MobileProjectBand`) is removed.

Desktop (≥768px) doesn't change at all.

## Design

### 1. Header (replaces the phone top bar and the band while a project is open)

The header is pinned above the scrolling `<main>`. It doesn't scroll away.
It's three rows, about 118px:

- **Row 1:** ☰ (opens the sidebar, as today) · the **customer name**,
  20px/800, truncating · on the right, "Saved ✓" stacked over the
  **salesperson's name**.
  - Tapping the customer opens the customer (`onOpenCustomer`).
  - On an unassigned job or a quick price, the name reads "Unassigned" or
    "Quick price" in amber, and tapping it opens File under customer
    (`onPromote`).
  - Tapping the salesperson opens the existing `SalespersonPop`.
  - The ned mark leaves this bar. Home is reachable from the sidebar.
- **Row 2, the project line (11.5px):** **project name** · `N214` ·
  `ErpChip` · address. The address is the project's when set, otherwise the
  customer's, the desktop Clean rule. The whole line opens the ⋯ sheet, where
  the name and address are already edited.
- **Row 3, the bar (38px, a hairline above):**
  - Left: **Retail ▾**, the existing `TierDrop` MorphSelect restyled as caret
    text. **All $ ▾**, the existing `PrintDrop`.
  - Right: **truck** (freight toggle; quiet when on, amber and struck through
    when off, the Clean rule) · **samples** (icon with an amber count badge;
    opens the Samples panel) · **⋯** (the existing project sheet) · the
    **total**.
  - The total is 12.5px/800 in the tier colour. With quote options it reads
    "N options" and opens the ⋯ sheet, whose footer already lists each
    option's total.
  - **Waste comes off the bar** (the mockup showed it) so the total fits at
    344px. It's already in the ⋯ sheet.

Everything else stays in the ⋯ sheet, unchanged: name, address, price tier,
printed pricing, waste, freight, notes, salesperson, files, versions, order
sheet, delete, Email, Print.

When no project is open, or a Settings/Apps pane is showing, the phone keeps
today's top bar.

### 2. Areas: R3 flat list with thin sticky titles

- **No area cards on the phone.** Each area is a thin title line, then its
  lines full-bleed on white with hairline dividers.
- **Title line (~16px):**
  - The area name in small caps, 9px/800, moss-deep.
  - The option chip ("OPTION A" / "SHARED", 8px, only when the job uses
    options).
  - The subtotal, 10px/800.
  - ⋯ with a full-size (32×32) tap area that overflows the thin row.
- **The name is still edited in place.** It's the same input, shown in caps by
  CSS only; the stored name keeps its case.
- **The title is `position: sticky; top: 0`** inside `<main>`, so the area
  you're scrolling stays named under the header. The area the Price book
  button targets (`activeAreaId`) keeps today's 3px moss mark on its title.
- **⋯ opens the existing area menu** (`setAreaMenu` with `clean: true`, so it
  carries "Delete area…"). The always-on grip and trash leave the phone title.
  Holding the title starts the area drag (`startAreaDrag`), the same hold the
  product lines use.
- An empty area reads "No products yet. Tap Price book below."
- The delete confirm strip and the drift chips render where they do today.

### 3. Product lines (`MobileProductRow`)

- The 19px type chip becomes an 8px type-coloured dot. A blank row keeps its
  dashed "+" chip and "New product…".
- Line 1: name · total (tier-coloured as today). Line 2: SKU · size · qty ·
  waste · price.
- The material letter tags, the warning "!", and the note icon stay at the
  right of line 2. They carry information, so they aren't dropped as the
  mockup did.
- Tap still opens `MobileRowSheet`, and hold still drags.

### 4. Unchanged

The bottom bar, `MobileRowSheet`, `MobileSearchSheet`, the sidebar, and every
write path. Header controls call the same `updateProject` patches the band
calls today. No stored shape changes and no SQL.

## Files

- `src/mobile.jsx`:
  - New `MobileProjectHeader`, which replaces `MobileProjectBand`. It reuses
    `TierDrop`/`PrintDrop` restyled, `ErpChip`, and `SalespersonPop`.
  - `MobileProductRow` gets the dot.
- `src/App.jsx`:
  - The phone top bar renders `MobileProjectHeader` while a full project is
    open with no pane.
  - The band mount goes away.
  - The phone branch of the area title becomes the thin sticky line, and the
    phone area wrapper drops its card border and radius.
- `src/headerpreview.jsx`: its 344px frame mounts the new header.
- `src/CLAUDE.md`: update the `mobile.jsx` entry.

## Proof (change control: UI, so preview proof before merge)

Extend ticket 169's harness (the real App.jsx at 344×820 over a stubbed
Supabase). Shots to take:

- The top of a job.
- Scrolled, with a sticky title.
- The ⋯ sheet.
- The area menu.
- Options.
- Unassigned and quick-price jobs.
- A long customer and project name.
- Freight off.
- A $12,345.67 total (bar fit).

Plus 768px+ shots showing desktop unchanged. `npm test`, lint and build stay
green.

## Out of scope

- Header B/C/D and bottom-bar P2 from the mockup.
- Any desktop change.
- Changes to the row sheet or the search.
