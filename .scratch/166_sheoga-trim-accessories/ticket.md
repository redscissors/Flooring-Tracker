---
issue_type: Feature
summary: Quote Sheoga's matching trim (nosing, shoe mold, reducer, T-mold, slip
  tongue) from the Sheoga configurator, priced off the accessory sheet the team
  uploads to the Sheoga vendor book
status: done
labels: [ready-for-human]
---

# Sheoga trim & accessories tab

Owner, 2026-10-02: a Trim & accessories tab in the Sheoga configurator, priced
off Sheoga's distributor accessory sheet, uploaded to the Sheoga price book and
replaced when Sheoga sends a new edition; markup set on the book.

Spec `docs/superpowers/specs/2026-10-02-sheoga-trim-accessories-design.md`,
plan `docs/superpowers/plans/2026-10-02-sheoga-trim-accessories.md`,
ADR `docs/adr/0055-sheoga-book-holds-uploaded-accessory-sheet.md` (amends
0040's "a vendor book never imports").

## What landed

- **Parser/diff/pricing** (`sheogatrim.js`): reads the accessory .xlsx (40
  species × profile prices, prefinished charges, the Texture Charge row, slip
  tongue, UPDATED date); plugs skipped; any missing price is a named problem and
  blocks Save. Pricing, kit lines, Match floor mapping and the basket view.
- **Sheoga book**: Price sheets tab (upload/replace, review with highlighted
  changes, stored table with a read-only Textured row), `markups.trim`
  (default 100) on the Markup tab. No SQL — `price_books.data` is jsonb.
- **Library drop zone** routes the accessory sheet to the Sheoga book
  ("Sheoga accessory sheet → Sheoga Hardwood").
- **Trim & accessories tab**: Match floor (on by default, live inside one popup
  session only; a placed kit reopens unlinked), Pick my own, pieces as runs of
  N pcs × L' or random-length lf, reducer/T-mold 8' counts, slip tongue
  bundles, build card, basket, phone price bar/sheet, empty states (no sheet /
  no book). A build lands as one kit: anchor `{ mode: "trim", cfg }`,
  companions `{ mode: "trim", part: true }`.
- **Texture is priced from the sheet** (owner decision 6): nosing +$2.00/lf;
  shoe, reducer, T-mold "can't be textured" ship smooth, noted, never blocked.
  No hand-entered texture slot.

## Known behavior changes / follow-ups for the PR

- Basket **Move** now keeps entries that would land no lines (all entry kinds,
  e.g. a trim kit with no sheet) in the basket instead of dropping them.
- A sheet stored before the texture change has no `tex` and reads every piece
  as "can't be textured" until replaced. No real uploads exist yet, so nothing
  in production is affected.
- The production build in this sandbox needs placeholder env:
  `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npm run build`.
- Saved estimate lines never reprice on a new upload (ADR 0003).

## Proof (harnesses, not product code)

`npx vite --port 5195`, then `sheoga-preview.html?tab=trim` (`&nosheet=1`,
`&nobook=1`), `vendor-book-preview.html?book=1&sheet=1|replace|bad`,
`header-preview.html` (drop `src/testdata/sheoga-accessory-20261001.xlsx`).

1. `01-trim-match-sawcut.png`, `02-trim-match-sawcut-card-bottom.png` — tab
   matching a Saw Cut floor: nosing textured +$2.00 /lf; shoe, reducer, T-mold
   "Smooth — can't be textured"
2. `03-trim-match-unfinished-smooth.png` — matching an unfinished/smooth floor
3. `04-trim-pick-my-own.png` — Pick my own (Match floor available again)
4. `05-trim-phone-rail.png`, `05b-trim-phone-sheet.png` — 390×844 rail and
   build sheet
5. `06-trim-empty-no-sheet.png`, `07-trim-empty-no-book.png` — empty states
6. `08-book-first-upload-review.png` — Price sheets review on first upload
7. `09-book-replace-review.png` — replace review, highlighted changes (incl. a
   texture change)
8. `10-book-parse-failure.png` — parse failure, Save disabled
9. `11-book-stored-sheet.png` — stored sheet with the read-only Textured row
   (2.00 / 2.00 / — / — / —)
10. `12-book-markup-trim-100.png` — Markup tab, trim 100%
11. `13-library-drop-routing.png` — library drop routing row
