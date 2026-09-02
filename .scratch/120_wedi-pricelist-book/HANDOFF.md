---
issue_type: Feature
summary: "8b — wedi's pricelist half (WEDI_SO) from a registry book, ending the
  re-transcription chore 8a halved. Groundwork only: this directory holds the
  raw pricelist snapshot so the parser can be built without the owner's OneDrive."
status: ready-for-agent
labels: [ready-for-agent]
---

# 8b — the wedi pricelist book

Groundwork for the second half of the wedi migration. **No engine code has been
written yet** — this directory exists so a session with no access to the owner's
OneDrive can still build the parser against the real sheet.

## Start here

1. Read `docs/superpowers/specs/2026-09-01-wedi-stock-book-design.md` — 8a's
   spec. Its "Out of scope" section defines 8b, and its Context section already
   diagnoses why the pricelist is hard.
2. Read `docs/adr/0037-wedi-stock-side-registry-driven.md` — what 8a decided and
   why `WEDI_STOCK` is still in the tree.
3. Read `.scratch/119_wedi-stock-book/sdd/ledger.md` — every ruling made during
   8a, and the residual open items. Several are 8b's inheritance (below).
4. Branch: this sits on top of `wedi-stock-book-118` (PR #354). Rebase onto
   `main` once that merges.

## Why 8a's approach does not transfer directly

8a committed a **fixture** — parser *output* — because the stock export is a
clean table the existing `detectVendorSkuAnalysis` recognizer already handles
with no new code. 8b is the parser itself, so a fixture of its output would be
begging the question.

What is committed here instead is the **raw sheet grid**:
`pricelist-sheets.json`, 5 sheets / 602 non-blank rows, exactly what
`readXlsxSheets` hands the import wizard and nothing interpreted. Regenerate
with `tools/dump-pricelist.mjs` if the owner supplies a newer sheet.

## What makes this workbook hard (measured, from the 8a spec)

- Five sheets at 11–18 columns.
- Section-title rows interleaved with product rows, plus note rows
  ("Minimum Quantity is 75…").
- **Column layouts change *within* a sheet** — "wedi S-Dry" carries one header
  at row 4 and a different one at row 8. A single column mapping cannot do it.
- 338 part numbers are extractable, covering 117 of the engine's 118
  special-order-only entries. The data is all there; reaching it needs a
  dedicated parser.

## The target shape

`makeEntry(stockRow, soRow)` in `src/wedi.js` already takes both halves. 8a fed
`stockRow`; 8b feeds `soRow`. The transcribed `WEDI_SO` rows are the contract:

```js
{ us, name, size, details, retail, net, section, discount, erp }
```

`section` is **load-bearing** — the engine reads it for `BROWSE_SECTIONS` and
`sectionHit`, so every entry must land in a browse section. `WEDI_SO` currently
holds 229 rows (223 priced + 6 `kitNote`).

## Reuse 8a's shape, not its code

The seam already exists and is reviewed:

- `src/wediadapter.js` — the adapter pattern (the only file seeing raw rows).
- `src/wedi.js` — `setStockSource`/`clearStockSource`/`stockSourceIsBook`, and
  `buildCatalog` reading an installable source. An `SO_SRC` twin is the obvious
  move; **note that `buildCatalog` writes the module-level `INDEX` as a side
  effect**, so both memos must clear together.
- `src/usewedicatalog.js` — the three-way gate, and the *only* permitted caller
  of the installers. Its `gateOf`/`foldBookLists` are pure and unit-tested; two
  stale-pricing bugs hid in that arithmetic during 8a and reading the hook did
  not catch either.

## Inherited open items 8b should resolve

From the 8a ledger and the final review:

- **Spec open question 3 — fallback lifetime.** Still with the owner. 8b is when
  deleting `WEDI_STOCK` becomes sensible, so this needs an answer.
- **The plausibility floor.** A book missing hardcoded `SKU.*` constants
  currently installs and reports `onBook`. Deliberately left to the owner.
- **`wedi.js:5039` (panel) and `:5148` (cover → `coverFrameFor`)** dereference
  `item(SKU.*)` with only a `WEDI_SO` backstop. **8b retiring `WEDI_SO` is
  exactly what makes them reachable** — 22 of the 24 `SKU.*` constants survive a
  thinned stock book today *only* because the pricelist carries them.
- **The re-assert effect** in `usewedicatalog.js` reads a boolean, so it cannot
  tell book A from book B.
- **Losing readiness mid-session unmounts the popup body**, discarding tab, pan,
  basket and room state — a trade-off the 8a Critical fix introduced.

## Non-negotiables that still apply

- Never mutate the live Supabase project. Ship the code and the instructions.
- Never push to `main`; every change lands through a PR.
- No UI or print change merges without preview proof.
- The pinned tests in `src/wedi.test.js` are the sheet's own numbers — changing
  one means a sheet was re-transcribed, not a bug fixed.
