# Phone Clean Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the phone's top bar and boxed band with the Clean header A. Turn the phone's area cards into the R3 flat list with thin sticky titles. Give product lines a type dot. Desktop doesn't change.

**Architecture:**
- `src/phonehead.js` is a new pure module, so `node --test` can pin the header's two derived values (total label and shown address).
- `MobileProjectHeader` in `src/mobile.jsx` replaces `MobileProjectBand`. It is mounted in App.jsx's phone top-bar slot, pinned above the scrolling `<main>`.
- The phone branch of App.jsx's area render becomes a thin `position: sticky` title.
- UI proof is a Playwright check script over the real app at 344×820 (the ticket 169 harness) that asserts on the DOM and saves shots. It fails before each UI task and passes after.

**Tech Stack:** React 18, Tailwind 3 + `--ft-*` tokens, lucide-react, node --test, Playwright (`/opt/node-tools/node_modules/playwright`), Vite dev over a stubbed Supabase.

**Spec:** `docs/superpowers/specs/2026-10-02-phone-clean-layout-design.md`. Approved look: "Your pick" section of `.scratch/mockups/mobile-clean-options-2026-10-02.html` (https://claude.ai/artifact/55ENTLaESCFCpGkE8oUHum).

## Global Constraints

- Phone means `!isWide` (`(min-width: 768px)` false). Every desktop (`isWide`) render path stays byte-for-byte the same.
- No stored shape changes, no normalizer changes, no SQL. Every control writes through the existing `updateProject(sel.id, patch)` patches the band uses today.
- Everyone on a phone gets the new layout. It does not read `headerLayout`. `MobileProjectBand` is deleted.
- Use theme tokens and existing utility classes (`--ft-*`, slate/indigo overrides), not new literal colours. The two exceptions already in this file's idiom are amber `#b45309` and `TIER_COLOR`.
- Header: about 118px, three rows. The total is 12.5px/800 in `TIER_COLOR[tv.tier]?.main`, falling back to `var(--ft-brand-deep)`. With quote options the total reads `"N options"` and opens the ⋯ sheet.
- Area title: about 16px tall. Name in small caps, 9px/800, `var(--ft-brand-deep)`, `letter-spacing: .14em`. Subtotal 10px/800. ⋯ with a 32×32 tap area. Sticky `top: 0` inside `<main>`. Empty area copy: `No products yet. Tap Price book below.`
- Comments: only for non-obvious rules (CLAUDE.md). No "what" comments.
- Never push to `main`. Work on `claude/ned-mobile-header-redesign-arhse0` and open one PR at the end.

## Review Focus

1. **The pinned header plus the bottom bar on a short screen.** Landscape, or the keyboard up in the row sheet. The header must not cover the row sheet or the search, both portaled at `z-50`/`z-[60]`. Task 3's check opens the row sheet and asserts the sheet's top edge is above the header's bottom.
2. **The sticky title inside an `overflow-hidden` area wrapper.** Sticky silently stops working there. Task 4's check scrolls `<main>` and asserts the second area's title stays at `main`'s top edge.
3. **Hold-to-drag on the title versus tapping the name input or ⋯.** `startAreaDrag` calls `preventDefault`, which would stop the input from focusing. Task 4's check taps the name and asserts `document.activeElement` is that input.
4. **Big totals and long names at 344px.** A `$12,345.67` Builder total must not push ⋯ off the bar. Task 3's check asserts the bar's `scrollWidth <= clientWidth` with that total.
5. **A job with no customer.** Quick price or unassigned: the customer slot must read `Quick price`/`Unassigned` and open File under customer, never throw on `cust.name`. Task 3's check boots an unassigned job.

---

### Task 1: `phonehead.js`: total label and shown address

**Files:**
- Create: `src/phonehead.js`
- Test: `src/phonehead.test.js`

**Interfaces:**
- Produces: `phoneTotal(grandTotal: number, optionCount: number) -> { text: string, options: boolean }`. With `optionCount > 0`: `{ text: "3 options", options: true }`, or `"1 option"` for one. Otherwise `{ text: money(grandTotal), options: false }`, using `money` from `./model.js`.
- Produces: `shownAddress(sel, cust) -> { text: string, own: boolean }`. Uses `sel.address` (trimmed, non-empty) as `own: true`, else `cust?.address` as `own: false`, else `{ text: "", own: false }`.

- [ ] **Step 1: Write the failing tests** in `src/phonehead.test.js` (node:test + assert/strict, the repo's style):
  - `phoneTotal(1412.85, 0)` deepEquals `{ text: "$1,412.85", options: false }`
  - `phoneTotal(12345.67, 0).text === "$12,345.67"`
  - `phoneTotal(0, 0).text === "$0.00"`
  - `phoneTotal(999, 3)` deepEquals `{ text: "3 options", options: true }`
  - `phoneTotal(999, 1).text === "1 option"`
  - `shownAddress({ address: "44 Beech Ln" }, { address: "9 Elm" })` deepEquals `{ text: "44 Beech Ln", own: true }`
  - `shownAddress({ address: "  " }, { address: "9 Elm" })` deepEquals `{ text: "9 Elm", own: false }`
  - `shownAddress({ address: "" }, null)` deepEquals `{ text: "", own: false }`
- [ ] **Step 2:** Run `node --test src/phonehead.test.js`. Expected: FAIL, cannot find module `./phonehead.js`.
- [ ] **Step 3:** Implement both functions in `src/phonehead.js`. It imports only `money` from `./model.js`; never import a `.jsx` file.
- [ ] **Step 4:** Run `node --test src/phonehead.test.js`. Expected: 8 pass.
- [ ] **Step 5: Commit**: `git add src/phonehead.js src/phonehead.test.js && git commit -m "phonehead.js: the phone header's total label and shown address"`

### Task 2: The proof check script (red before the UI tasks)

**Files:**
- Create: `.scratch/170_phone-clean-layout/check.mjs` (copy the stub/boot half of `.scratch/169_mobile-pick-reopens-search/repro.mjs`)
- Create: `.scratch/170_phone-clean-layout/ticket.md` (frontmatter like ticket 169: `issue_type: Feature`, `status: open`)

**Interfaces:**
- Consumes: the DOM hooks Tasks 3–5 add: `[data-phone-head]`, `[data-phone-bar]`, `[data-phone-total]`, `[data-area-title]`, `[data-type-dot]`.
- Produces: `node check.mjs [--case=<name>]` prints `PASS <name>` / `FAIL <name>: <why>` per assertion, saves `<case>-*.png` into `OUT_DIR`, and exits 1 on any FAIL.

The script runs at viewport 344×820 (`hasTouch`, `isMobile`). Cases:

| Case | Data | Assertions |
|---|---|---|
| `top` | The 169 job (Tom Marsh, N214, `erpOrders: [{no:"48213"}]`, areas Kitchen + Hall bath with a product, Laundry empty, stock book) | `[data-phone-head]` exists; the text "Customer" eyebrow from the old band does NOT exist; header height ≤ 124px; `[data-phone-total]` text is `$…`; `[data-phone-bar]` `scrollWidth <= clientWidth`; first `[data-area-title]` height ≤ 18px; a `[data-type-dot]` exists; the text `No products yet. Tap Price book below.` exists; shot `top-1.png` |
| `scroll` | Same job with 6 areas × 3 products | Scroll `main` to the 2nd area's top + 40px; that area's `[data-area-title]` `getBoundingClientRect().top` is within 1px of `main`'s top; header still at y < 30; shot |
| `name` | `top` job | Tap the first `[data-area-title] input`; `document.activeElement` is it; then tap that title's ⋯ and assert the text `Delete area…` is visible (the area menu); shot |
| `sheet` | `top` job | Tap a product row; `.ft-sheet` top < header bottom (the sheet covers the header); shot |
| `options` | Areas tagged `option: "A"`/`"B"`, `freight: false` | `[data-phone-total]` text is `2 options`; tapping it opens the ⋯ sheet (title input `Project name` visible); the freight button has `aria-label="No freight"`; shot |
| `unassigned` | `customer_id: null`, project name 60 chars, `priceTier: "builder"`, enough lines for a `$12,345.67` total | header text contains `Unassigned`; `[data-phone-bar]` `scrollWidth <= clientWidth`; ⋯ visible inside the bar's box; shot |
| `desk` | Viewport 1440×940, `top` job | `[data-phone-head]` absent; shot (compare by eye with `main`'s desktop) |

- [ ] **Step 1:** Write `check.mjs` with all seven cases.
- [ ] **Step 2:** With Vite up (`VITE_SUPABASE_URL=https://stub.supabase.co VITE_SUPABASE_ANON_KEY=stub npx vite --port 5199 --strictPort`), run `OUT_DIR=before node check.mjs`. Expected: exit 1. FAIL lines for `[data-phone-head]` and `[data-area-title]`; `desk` PASS.
- [ ] **Step 3: Commit** `check.mjs`, `ticket.md` and `before/*.png`: `git commit -m "Ticket 170: phone Clean layout check script (red)"`

### Task 3: `MobileProjectHeader` replaces the band and the phone top bar

**Files:**
- Modify: `src/mobile.jsx`: delete `MobileProjectBand`, `TierDrop`, `PrintDrop`, `BAND_BOX`, `BAND_MINI`, `BAND_MINI_STYLE`; add `MobileProjectHeader`
- Modify: `src/projectheader.jsx`: export `FreightToggle` and give it a `compact` prop
- Modify: `src/App.jsx`:
  - top-bar block (~line 1551): render the new header there while a full project is open with no pane
  - band mount (~line 1767): remove `<MobileProjectBand …/>`, keep the `attRef` input and the ⋯ `MobileSheet` exactly as they are
  - import line 36
- Modify: `src/headerpreview.jsx`: its 344px frame mounts `MobileProjectHeader` with the same mock props
- Modify: `src/CLAUDE.md`: the `mobile.jsx` entry and the `headerpreview.jsx` entry

**Interfaces:**
- Consumes: `phoneTotal`, `shownAddress` (Task 1); `PriceLevelMenu`, `MorphSelect`, `SalespersonPop` (widgets.jsx); `ErpChip`, `FreightToggle` (projectheader.jsx).
- Produces: `MobileProjectHeader({ sel, cust, profile, tv, grandTotal, optionCount, freightCost, saveOk, updateProject, onOpenSidebar, onOpenCustomer, onPromote, onMore, samples, onOpenSamples })`. The root is a `<div data-phone-head>`.
- Produces: `FreightToggle({ on, amount, onSet, compact = false })`. With `compact` and `!on`, it renders the icon button only, coloured `#b45309`, with the strike and no words, keeping `aria-label="No freight"`.

Layout:

- **Row 1:**
  - Menu icon → `onOpenSidebar`.
  - The customer as a 20px/800 truncating button (`cust.name || "Customer"` → `onOpenCustomer`). With no `cust`, it reads `sel.quick ? "Quick price" : "Unassigned"` in amber `#b45309` → `onPromote`.
  - On the right, stacked: `saveOk && "Saved ✓"` (9.5px, `var(--ft-brand)`) over `<SalespersonPop plain alignRight …/>`.
- **Row 2:** one button → `onMore`, 11.5px:
  - **name**, bold: `sel.name || "Untitled project"`
  - `N{sel.projectNo}` when set
  - `<ErpChip erpOrders={sel.erpOrders} />`
  - `·` and `shownAddress(sel, cust).text`, faint when `!own`
- **Row 3** (`data-phone-bar`, 38px, hairline top, `gap: 6px`, `padding: 0 12px`):
  - `<PriceLevelMenu align="left" …/>` (the desktop Clean call).
  - `<MorphSelect flat bold …>` with options `All $` / `Unit $` / `No $` writing `printPricing`.
  - A spacer.
  - `<FreightToggle compact …/>`.
  - The samples button (Layers 16, amber count badge when `samples?.need > 0`, the desktop Clean badge style) → `onOpenSamples`.
  - ⋯ → `onMore`.
  - The total: a `<span data-phone-total>` coloured as Global Constraints say. When `phoneTotal(…).options` is true it's a `<button data-phone-total>` → `onMore`, coloured `var(--ft-text)`.
  - Icon buttons are 24px wide and `flex: none`.

App wiring:

- The top-bar condition becomes `!isWide && !railNav.pane && sel && sel._full ? <MobileProjectHeader …/> : <today's top bar>`.
- `optionCount={optionBadges?.length || 0}`.
- `onMore={() => setProjSheet(true)}`.
- `onOpenSidebar={() => setSidebarOpen(true)}`.
- `onOpenCustomer={() => cust && setCustModal(cust.id)}`.
- `onPromote={() => { setPromoteId(sel.id); setPromoteQ(""); }}`.
- `samples={sampleCounts(projSamples)}`.
- `onOpenSamples={() => { setShowSamples(true); refreshSampleRequests(); }}`.

The props are the band's current ones, moved. `cust` is `data.people.find((c) => c.id === sel.customerId)`.

- [ ] **Step 1:** Run `OUT_DIR=before node .scratch/170_phone-clean-layout/check.mjs --case=top`. Expected: FAIL `[data-phone-head]` (it's still red from Task 2).
- [ ] **Step 2:** Implement `FreightToggle`'s `compact` prop and its export. Desktop calls pass no `compact`, so they render unchanged.
- [ ] **Step 3:** Implement `MobileProjectHeader` and delete the band and its helpers in `mobile.jsx`.
- [ ] **Step 4:** Wire App.jsx as above. Update `headerpreview.jsx` and the `src/CLAUDE.md` entries. The `mobile.jsx` line now reads `MobileProjectHeader (phone Clean header A, spec 2026-10-02) — pinned above <main>; waste lives only in the ⋯ sheet; total or "N options" on the bar`.
- [ ] **Step 5:** Run `node check.mjs --case=top --case=options --case=unassigned --case=sheet --case=desk`. Expected: all header assertions PASS. The `[data-area-title]`/`[data-type-dot]` lines still FAIL; they belong to Tasks 4–5.
- [ ] **Step 6:** Run `npm test && npx eslint src/mobile.jsx src/App.jsx src/projectheader.jsx src/headerpreview.jsx`. Expected: all pass, lint clean.
- [ ] **Step 7: Commit**: `git commit -m "Phone: Clean header A replaces the top bar and band"`

### Task 4: Areas as a flat list with thin sticky titles

**Files:**
- Modify: `src/App.jsx`. Three places:
  - The area wrapper `div[data-area-drop]` (~line 1885) on the phone.
  - The phone branch of the area header (~line 1911).
  - The phone padding of the `max-w-4xl … p-2` column.

**Interfaces:**
- Consumes: `startAreaDrag(e, aid, ai, holdMs)`, `setAreaMenu({ aid, x, y, anchor, clean: true })`, `activeAreaId`, `printAreaFloor`, `optionShort`, `OPTION_COLOR`.
- Produces: `[data-area-title]` on the phone title row (Task 2's hook).

Phone-only changes (`!isWide`); the `isWide` branches are untouched:

- **The phone area wrapper:**
  - Drop `rounded-lg border bg-white` and `overflow-hidden`. `overflow-hidden` kills `position: sticky`.
  - The phone column loses its side padding (`p-2` → `py-2 px-0` on phone), so lines run full-bleed.
  - Product lines sit on `var(--ft-card)` with the existing `--ft-grid-line` hairlines.
- **The phone title row** (`data-area-title`, `position: sticky; top: 0; z-index: 5`, background `var(--ft-cream)`, padding `4px 12px 3px`, gap 6):
  - **Name input:** the existing input, unchanged write path, restyled to 9px/800 caps via CSS `text-transform: uppercase` and the Global Constraints tokens. The stored name keeps its case.
  - **Option chip:** when `a.option || optsUsed.length`, the existing chip button restyled to 8px.
  - **Subtotal:** 10px/800, only when > 0.
  - **⋯ button:** `MoreHorizontal` 14, `width: 32px; height: 32px; margin: -9px -8px` so the tap area overflows the thin row. It calls `setAreaMenu({ aid: a.id, x: r.left, y: r.bottom + 4, anchor: e.currentTarget, clean: true })`. `clean: true` adds "Delete area…".
  - The grip and trash buttons are removed on the phone.
  - **Active mark:** the active area keeps `boxShadow: inset 3px 0 0 var(--ft-brand)` on the title.
- **Hold-to-drag:** `onPointerDown` on the title row calls `startAreaDrag(e, a.id, ai, 350)` only when `!e.target.closest("input, button")`. Taps on the name or ⋯ never reach `preventDefault` (Review Focus 3).
- **Empty area:** when an area has no non-blank lines, the phone renders `No products yet. Tap Price book below.` (11.5px, `var(--ft-faint)`, padding `10px 12px`, on `var(--ft-card)`).

- [ ] **Step 1:** Run `node check.mjs --case=top --case=scroll --case=name`. Expected: FAIL on `[data-area-title]`.
- [ ] **Step 2:** Implement the wrapper, column padding, title row, drag guard and empty copy.
- [ ] **Step 3:** Run `node check.mjs --case=top --case=scroll --case=name --case=desk`. Expected: all PASS except the `[data-type-dot]` line.
- [ ] **Step 4:** Run `npm test && npx eslint src/App.jsx`. Expected: pass, clean.
- [ ] **Step 5: Commit**: `git commit -m "Phone: areas as a flat list with thin sticky titles"`

### Task 5: Product lines get the type dot; full proof and PR

**Files:**
- Modify: `src/mobile.jsx`: `MobileProductRow`
- Modify: `.scratch/170_phone-clean-layout/ticket.md`: status `done`, proof list
- Modify: `src/CLAUDE.md`: the `cleanCards`/phone note in the App.jsx entry gets one line: `phone (!isWide): flat area list, thin sticky titles (spec 2026-10-02)`

**Interfaces:**
- Produces: `[data-type-dot]` on a non-blank row's leading mark.

`MobileProductRow` changes:

- A non-blank row's 19px letter chip becomes an 8×8 round `<span data-type-dot>` in `TYPE_ACCENT[p.type]`, `margin-top: 5px`.
- A blank row keeps the dashed "+" chip and "New product…".
- Line 1, line 2, the tags, `!` and the note icon stay as they are.
- The row background becomes `var(--ft-card)`. The padding goes from `7px 10px` to `9px 12px` to match the title row's inset.

- [ ] **Step 1:** Run `node check.mjs --case=top`. Expected: FAIL on `[data-type-dot]` only.
- [ ] **Step 2:** Implement the dot and row padding.
- [ ] **Step 3:** Run `OUT_DIR=after node check.mjs` (all cases). Expected: every line PASS, exit 0.
- [ ] **Step 4:** Run `npm test`, `npx eslint src netlify/functions`, and `VITE_SUPABASE_URL=https://stub.supabase.co VITE_SUPABASE_ANON_KEY=stub npm run build`. Expected: tests pass, lint clean, `✓ built`.
- [ ] **Step 5:** Re-run `.scratch/169_mobile-pick-reopens-search/repro.mjs`. Expected: `search closed after the pick`. The new header must not regress the fix.
- [ ] **Step 6:** Write the ticket's proof list (before/after shot names per case). Commit: `git commit -m "Phone: type dot on product lines; ticket 170 proof"`
- [ ] **Step 7:** Push `claude/ned-mobile-header-redesign-arhse0` and open the PR with the after shots listed (Non-negotiable 3: preview proof before merge). Subscribe to its activity.
