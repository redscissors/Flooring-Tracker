# Phase 5 preview proof — the Compare tab (issue 097, prototype P3)

Change-control rule 3 ("no UI change merges without preview proof") for the
phase-5 branch `claude/phase-5-agent-driven-lmczv6`: the wedi ⇄ Schluter
**Compare** tab in both configurator popups, plus the quote-options A/B
landing.

**Rig:** `shoot-compare.mjs` in this folder — repo Playwright chromium
(`/opt/pw-browsers/chromium`) against `npx vite --port 5199`, viewport
1760×1120 @2×, one fresh page load per scenario, a settle guard on the
compare grid + both totals, and **any `pageerror` fails the run**. The two
dev harnesses (`schluter-preview.html`, `wedi-preview.html`) mount the REAL
popups over the 2026-08-20 Schluter fixture pushed backwards through
`normOrderItem` into live registry shape, so the Schluter column prices
through the production adapter path (ADR 0032), not a shortcut.

```
npx vite --port 5199
node .scratch/097_schluter-configurator/phase5-proof/shoot-compare.mjs
```

## The shots

| shot | page / state | what it proves |
|---|---|---|
| `c1-schluter-host-retail.png` | Schluter popup, Custom shower 60″×38″ curbed · point drain, Full catalog, **Retail** | The whole P3 surface in production: 4th tab, the live-room chip, the seven-category rail (P3's six + `Extras`), a wedi column and a Schluter column, totals with the stock-coverage line, the delta line with the walls caveat, the three diffnotes cards, and the quote-options footer. Host = Schluter, so the Schluter column reads **"this build"** ($759.75, 12/12 stocked) and the wedi column is the derived **"house kit"** ($1,360.65, 9/9). |
| `c2-schluter-host-builder.png` | same room, **Builder** lens | Both builder knobs are separate and both bite: wedi ×0.82 → $1,115.72, Schluter −8% → $698.96, the seg's sublabel spelling out `wedi ×0.82 · Schluter −8%`, and the delta re-figured at that lens ($416.76). Prices come back out of each engine's own `tierPrice`, nothing re-derived in the compare layer. |
| `c3-wedi-host-retail.png` | wedi popup, same 60″×38″ curbed room, top solver option picked | The tab is the same surface in the OTHER popup, and the host rule inverts: the wedi column now reads **"this build"** — $1,480.94, the solver's own panel plan (2× 4'x5' + 2× 4'x8' sheets, 11 sealant tubes) — while Schluter is the **"house kit"** ($759.75, identical to c1, because it is the same derived kit for the same room). Compare c1's wedi column ($1,360.65 house kit, 6× 3'x5' sheets) against this one: live build ≠ derived kit, exactly the ADR 0034 rule. Also proves the wedi harness's new registry bag — the Schluter column prices instead of showing "Loading the Schluter price books…". |
| `c4-schluter-stock-only.png` | Schluter popup, 48″×48″ curbed · **linear** drain, **Stock only** | The source switch is honoured through the compare surface. Under **Full catalog** the same room takes the special-order `KSLT1220S` tray ("exact fit", rust `.ln.so` row, $259.59 → total **$983.11, 7 of 8 stocked**); under **Stock only** it re-ranks to the stocked `KSLT1395S` cut down to 4'×4' ($307.85 → total **$1,031.37, 8 of 8 stocked**). Dearer, on the shelf, and nothing silently dropped — the engine's `pickFrom`/`stockPool` rule, visible in the compare column. (The full-catalog frame is measured by the rig and printed to the console; only the stock-only frame is shot.) |
| `c5-quote-options-modal.png` | wedi popup, c3's room, footer button clicked | The "A + C" delivery: the confirm modal lists `A wedi — 10 lines $1,480.94` and `B Schluter — 12 lines $759.75` with the RETAIL/ADR-0018 and reconfigure-marker note. Clicking **Add options A & B** fires `onQuoteOptions({wediLines, schluterLines, label:"Master bath"})` — the harness logs it, and the rig fails the run if it never fires. In the app that payload is App.jsx's `addCompareOptions` → `compareOptionsPatch` → ONE `updateProject`. |

## Against prototype P3

`prototype.html` §P3 (`renderCompare`, lines 781–817) is the approved spec.
Production matches it structurally — same header line, same category grid,
same totals row, the delta sentence and all three diffnotes cards carried
over near-verbatim. The deliberate departures, all from the plan:

- **Live room, not preset chips.** P3 cycled `CMP_PRESETS`; production reads
  the room off whichever popup is open (`60″ × 38″ · curbed · point drain`).
- **Seven categories.** `Extras` joins P3's six so add-ons (niches, premade
  benches) have somewhere to land.
- **Host column = the live build.** P3 showed two derived kits; production
  shows the host popup's build as it stands (c3 vs c1).
- **Totals read `N of M lines stocked`** rather than P3's "n special-order
  line(s)" — the same fact, stated as coverage.
- **Pricing-model card** names the two real Settings knobs instead of P3's
  "still an owner call" placeholder; the delta's closing sentence drops
  "in P1".
- **New in production:** the quote-options footer + confirm modal (delivery
  C), which the prototype had no job behind it to land on.

## Known gaps (recorded as open items in ADR 0034)

- No like-for-like KERDI-BOARD toggle on the compare surface — the derived
  Schluter side is always membrane walls, and the caveat text in the delta
  line is what carries that. Visible in every shot.
- Landing options A/B gives no toast or auto-close in the popup; the
  salesman sees the result only after closing it.

## Working shots from earlier tasks

`task4/` and `task5/` hold the render checks captured while the tab was being
built (including the null-column and books-not-ready states). They are kept
as history — the change-control set is c1–c5 above.
