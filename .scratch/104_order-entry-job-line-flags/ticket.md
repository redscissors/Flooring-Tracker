---
issue_type: Bug
summary: The 2026-08 job-line flag batch — seven Claude issues from Marcus on
  order-entry descriptions and classification, worked as one set. Four code
  fixes, one code fix in the Mannington importer, two verdicts back to the team.
status: done
labels: [ready-for-human]
---

# Order-entry job-line flags (Marcus, 8/19–8/21)

Seven issues from the central Claude bucket, all about what "Copy for order
entry" produces. Preview proof: `preview-order-entry.png` (the real
`OrderEntryPanel` over the real `orderEntryRow`, mounted by the new dev
harness `order-entry-preview.html` / `src/orderentrypreview.jsx`).

## 1. Uptown Pebbles Harmony Warm Blend — "should be special order" — FIXED

The row was typed straight onto the sheet: no `bookId`, so `isSpecialOrder`
filed it as a stock line and the panel offered its vendor SKU as a SKU ⇥ qty
paste the ERP's stock side can't key.

`isSpecialOrder` now takes the stock cache (every stock SKU in every `skuKeys`
spelling, built in App.jsx once `bookStockReady`): a bookless row with a SKU
the shop doesn't stock files as a special order. Matching runs over `skuKeys`
spellings both ways, so a hand-typed manufacturer form of a stocked code still
files as stock. Until the cache is up the set is null and behavior is
unchanged. Rows with no SKU at all stay in Stock (the red "no SKU" case).

## 2. Sheoga stocked — "should not need to say stocked" — FIXED

`calcStocked`'s description (and `descParts`' mirrored part) now says
"Prefinished", not the program name "Stocked prefinished". Stock status stays
on the configurator's green warn line ("Stocked item — ships from Sheoga
stock"), where it's shop-side information, not part of the product identity
the vendor needs. Saved rows keep their old name text on screen, but order
entry re-derives from the configuration, so existing lines drop "Stocked" in
the paste immediately.

## 3. Sheoga brand must survive shortening — FIXED

`orderDescription` used to strip the "Sheoga — " lead ("the PO already names
the vendor"). Marcus overrode that: Sheoga sells by description, so the brand
is identity. The structured (configurator) path now prepends a rank-0
"Sheoga" part that never drops on any rung; the fallback path (vents,
dampers, fee lines) keeps the "Sheoga — " lead the configurator wrote into the
row name. Cost: an ordinary build that used to fit 30 characters on the short
rung now splits (see the screenshot) — the identity floor grew by 7
characters, so more lines carry an Ext half. That is the trade Marcus asked
for; book brands (rank 3, first dropped) are unchanged.

## 4. AO Profiles "002536MOD1P4 Ice Wh" — "description is off" — NO CODE CHANGE

The truncation ("Ice Wh" for Ice White) and the embedded manufacturer code are
in the vendor sheet's own description column — the import carried it
faithfully. There is no safe way to auto-expand vendor text (the descfit
doctrine: never invent words that could read as a different product). Options
for the team: edit the item's description on the book page (Edit), or approve
a per-item short description once issue 086 (open feature proposal) lands —
this row is a good motivating case for it.

## 5. Glazzio Kessel "Ovo Glossy" — "description is not ideal" — NO CODE CHANGE

Same verdict as #4: the text is the book item's own description. The brand
already rides as a droppable rank-3 part (issue 092), so the paste leads with
size + "Kessel Collection Ovo Glossy". If a specific wording is wanted, say
what the line should read and it can be edited on the book page — or wait for
issue 086's approved short forms.

## 6. "Only add CT to the start, drop other starts" — DONE, with the downside

The unit tag is now carton-only: `CT` still leads (a carton quantity misread
as pieces is the real mis-order hazard) and every other start — `PC`, `RL`,
`SH`, `GL`… — is dropped from the description and the copy.

The downside Marcus asked about: a sheet-, roll- or bag-keyed line no longer
announces its unit inside the pasted description, so if an ERP item for a
roll good is set up per square foot rather than per roll, a "3" keyed against
it won't carry the "RL" cue that used to flag the mismatch. Two mitigations
already in place: the coverage tail ("150 SF/RL") still names the unit when
the field has room, and the panel's Qty/Cost/Sell columns still read in the
sell unit. If that ever bites, the tag rule is one line
(`src/print.js`, `tag = code === "CT"`), easy to widen back to specific units.

## 7. Mannington 438602 "SimpleStart" → "SimpleStairs" — FIXED

`trimLabel` in `src/manningtonbook.js` normalized any stacked header starting
"SimpleSt…" to "SimpleStart"; the product is Mannington's SimpleStairs stair
tread. Now reads "SimpleStairs" (regression test pins it).

**Follow-up for the team:** already-imported Mannington books still hold the
"SimpleStart" description — re-drop the Cartons Detail PDF once this deploys
and the diff will retitle it. (Never edited live data from here —
non-negotiable #1.)

## Where things landed

- `src/orderentry.js` — stock-SKU special-order rule; Sheoga lead kept
- `src/print.js` — CT-only tag; `orderEntryRow` takes `stockSkus`
- `src/App.jsx` — builds `stockSkus` off the stock cache, passes it through
- `src/sheoga.js` — stocked description says "Prefinished"
- `src/manningtonbook.js` — SimpleStairs
- `src/orderentrypreview.jsx` + `order-entry-preview.html` — dev-only preview
  harness (house precedent: claude-issues-preview et al.)
- Tests updated/added in `orderentry.test.js`, `print.test.js`,
  `sheoga.test.js`, `manningtonbook.test.js` — 1102 passing.

Once merged, the seven bucket entries can be checked off in Issues → Claude
(they live in the `claude_issues` table; nothing here touches it).
