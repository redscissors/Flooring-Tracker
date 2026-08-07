Status: done

Preview proof for the multiple quote-options feature (ADR 0031, `docs/adr/0031-quote-options-shared-base.md`) — Task 9 of the SDD plan (docs + full verification + preview proof).

Print surfaces (`print_*.png`) — a throwaway vite harness rendered the real `EstimatePaper` component (`src/EstimatePrint.jsx`) with fixture data built through `normC` (`src/model.js`) and `jobTotals`/`bucketCats`/`scopedCats` (`src/jobtotals.js`, `src/options.js`), mirroring App.jsx's `optionPrint`/`paperProps` construction exactly. Real print component, real math engine, no live Supabase involved.
- `print_01_compare_all_banded.png` — banded compare-all sheet (optionPrint set): shared areas, E1 materials bundles per option, comparison block.
- `print_02_scoped_single_option.png` — scoped single-option flat sheet with `scopeNote` ("Option B · Marble hex").
- `print_03_no_options_plain.png` — optionPrint null, a plain job with no A/B/C tags.

Interactive surfaces (`live_*.png`) — the real app (Root.jsx → App.jsx) booted against a Playwright-driven headless Chromium with Supabase entirely mocked: a fake auth session seeded into `localStorage["sb-stub-auth-token"]` and every PostgREST/auth call under `https://stub.supabase.co/**` intercepted and answered with canned JSON matching bootload.js's select shapes (app_data, shared_settings, projects light+detail, customers, builders, todos, price_books, versions). No live Supabase project touched.
- `live_01_project_chips_badges.png` — project screen: area band outlines/chips (SHARED / OPTION A / B · MARBLE HEX / OPTION C) and header job-total badges.
- `live_02_summary_groups.png` — scrolled to the Order Summary card: per-option groups (Shared areas / Option A / B · Marble hex / Option C), each with its own subtotal and "with shared areas" whole-job total.
- `live_03_area_right_click_menu.png` — an area's right-click menu: "This area is in" retag list, Duplicate into A/B/C, Rename, Print this option.
- `live_04_print_preview_compare_all.png` — the Preview tab's scope switch (Compare all / Option A / B · Marble hex / Option C) over the banded sheet.
- `live_05_order_scope_picker.png` — "Copy for order entry" scope picker (also fixes the empty-title-header nit — see below).
- `live_06_mobile_option_chips.png` — mobile top bar + area cards at a 390px viewport, option chips visible.

Nit-fixes made in the browser pass (each its own commit):
- Scope-picker Modal rendered an empty title header row above a hand-written heading `<div>`; now passes `title` to `Modal` and drops the duplicate.
- Mobile top-bar option chips were 11px vs 12px everywhere else (the project sheet's mobile footer badges); matched to 12px.

Deferred: none — both the print-surfaces and interactive-surfaces proofs from the amended Step 3 are included.
