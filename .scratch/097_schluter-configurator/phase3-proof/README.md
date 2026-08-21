# Phase-3 preview proof (repo rule 3)

Screenshots of the REAL `SchluterConfigurator` mounted by the dev harness
(`schluter-preview.html` / `src/schluterpreview.jsx`) — no Supabase, but the
full production data path: the 2026-08-20 fixture pushed backwards through
`normOrderItem` into live registry shape, then through `schluteradapter.js`
into the engine. Compare against the approved prototype
(`prototype.html` on the `claude/schluter-configurator-catalog-e1v6o8`
branch, surfaces P1/P2).

| Shot | Scenario | What it proves |
|---|---|---|
| 01-kits | Kits tab, default room | 17-tray shelf list, stock/special tags, the default 60×38 build billing the pinned $759.75 / 12 lines |
| 02-custom-6038-kit | 38"×60" tray clicked | Kit → Custom flow, exact-tray card, plan+iso drawings, factory-kit corner recipe in Seams |
| 03-stockonly-4848-linear | 48×48 linear, Stock only | The P2 demo: exact LTS 48×48 is special order, Stock only re-ranks to the stocked 55×55 cut down, labeled Deep cut; Vario channel cut to 40" |
| 04-mortar-fallback | 95×95 room | Decision 2: a real Settings-mortar line (8 bags at its own rate) + KERDI over the cured bed, with the product select |
| 05-bench-addon | premade SB bench chip | Decision 4's third option as a UI add-on landing in Extras |
| 06-payload | Add to product lines | Shop ERP SKUs on stocked rows, schluter:{mode,cfg} anchor / part companions, the −8% Builder stamp |
| 07-browse | Browse + filter board | Classified sections with counts, stock tint, steppers |
| 08-factory-kits | Factory kits filter | Decision 5: the boxed kits live ONLY here |

Shot rig: `shoot.mjs` pattern from `.scratch/098_shower-drawing-extraction/`
(chromium via playwright-core, page errors fail the run; the only logged
errors are the sandbox-blocked Google Fonts fetch and the favicon 404).
