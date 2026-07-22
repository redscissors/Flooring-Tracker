# Tab-flow cleanup — preview harness (2026-07-21)

Status: done

The desktop keyboard flow now runs in estimate-writing order and nothing else
steals a Tab stop:

1. **Project name** — focused on open while the project is still unnamed; a
   named project starts at the first **area name** instead.
2. **Area name** → per row: **Product/Color → SF → extras pill** (a book-filled
   row's type/size/SKU/Cov./price stay click targets; a manual row keeps
   size/coverage/price in the tab order since they must be typed there).
3. **Extras drawer** (Enter on the pill opens it): Tab walks the checked
   extras' dropdowns plus the **caulk tubes** box — the order-total overrides
   stay click-to-edit. **Enter (or Escape) closes the drawer** back to its
   pill; tabbing or clicking out folds it too.
4. **Adder search row → Add area → Order entry → Print.** Tab from anywhere
   else in the header hands focus to the first area name.

## Run it

From the repo root (no live Supabase touched — every query is answered by
`mock-supabase.js`, which also fakes the signed-in session and a 3-item stock
book):

```
npm install
VITE_SUPABASE_URL=https://preview.invalid VITE_SUPABASE_ANON_KEY=preview \
  npx vite --config .scratch/037_tab-flow-preview/vite.config.mjs
```

Then: New customer → New project, and drive the whole estimate by keyboard.

## Verified (Playwright over this harness, 2026-07-21)

```
project opened (new)                   → input ph="Project name"
Tab from project name                  → button "Add area"        (no areas yet)
Enter on Add area                      → input ph="Area 1"
Tab from area name                     → input ph="Search SKU or product…"
Enter picks Carrara (→ SF box)         → input title="Enter square footage"
Tab from SF                            → button "＋ Grout · Mortar · Backer…" [mats-pill]
Enter opens extras drawer              → div (drawer)
drawer still open after toggle clicks  → true
focus grout product select             → select "PermaColor Select …"
Tab                                    → select grout color
Tab                                    → input caulk tubes
Tab                                    → select mortar product
Enter closes drawer                    → button "Grout 1 · …" [mats-pill]
Tab from pill                          → input adder search
Tab from adder search                  → button "Add area"
Tab from Add area                      → button "Order entry" [flow-end]
Tab from Order entry                   → button "Print" [flow-end]
Tab from header notes                  → input ph="Area 1"
re-open named project                  → input ph="Area 1"
```
