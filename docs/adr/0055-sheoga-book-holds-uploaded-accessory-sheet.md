# The Sheoga vendor book holds an uploaded accessory sheet; trim prices off it, texture included

Date: 2026-10-02 · Status: Accepted · Spec: docs/superpowers/specs/2026-10-02-sheoga-trim-accessories-design.md · Amends: ADR 0040

## Context

The Sheoga configurator's other three price sheets (flooring, vents, dampers)
are hand-transcribed into `sheoga.js`. Matching trim (nosing, shoe mold,
reducer, T-mold, slip tongue) comes off a fourth sheet, Sheoga's distributor
"Accessory Pricing", which Sheoga reissues and which the team receives as an
.xlsx. ADR 0040 made the Sheoga book item-less ("a vendor book never imports").

## Decision

- **The accessory sheet is uploaded, not transcribed.** The team drops the
  .xlsx on the Sheoga vendor book (Price sheets tab, or the library's drop
  zone, which routes it there) and a replace is the same action. The parsed
  prices are stored on the book as `data.sheets.accessories`; the file itself
  is not kept. A sheet with any missing or non-numeric required price is a
  named problem and cannot be saved. Writes go only through `updateBook`'s
  `dataPatch`; no SQL (`price_books.data` is jsonb).
- **This amends ADR 0040's "never imports"** for exactly this case: a vendor
  book still holds no items and runs no item import, but it may hold parsed
  sheets that its configurator prices from. The other three sheets stay in
  `sheoga.js`.
- **Plugs are left out.** The parser skips the sheet's Plugs block.
- **Trim & accessories markup is its own field, default 100%**
  (`markups.trim`), beside flooring and vents on the book. No Settings
  fallback: trim needs the book for its prices anyway, so with no book the
  default is the constant.
- **Texture is priced from the sheet, never typed in** (owner, on the 10/01/26
  edition). The sheet's "Texture Charge" row is stored as `tex`: nosing 3½" and
  5½" +$2.00/lf; shoe mold, reducer and T-mold "Cannot Be Textured" stored as
  `null`. A textured build charges texturable pieces and ships the others
  smooth, each noted "smooth — can't be textured"; nothing blocks the add. A
  sheet with no Texture row parses and reads every piece as can't-be-textured.
  This supersedes the same-day first decision (a blank, hand-entered per-piece
  textured charge that blocked a textured add until filled); no such slot
  exists in the stored shape.
- **Nosing and shoe mold order as pieces of a chosen length** (3–10 and 12 ft,
  several runs per piece, or Random lengths in lf); reducer and T-mold are 8'
  only; slip tongue is sold in 50 lf bundles.
- **One build lands as one kit** (ADR 0035): the first line is the anchor
  carrying `sheoga: { mode: "trim", cfg }` (cfg stored with `match: false`, so a
  placed kit reopens unlinked and the floor tab can't silently re-species it);
  the rest are companions `{ mode: "trim", part: true }`.
- **Saved lines never reprice** (ADR 0003): a new upload changes only new picks.

## Consequences

- A price-sheet edition is now a file upload for trim, and a code
  re-transcription for the other three sheets. The asymmetry is deliberate
  (owner decision, 2026-10-02): trim prices refresh without a deploy.
- A trim kit priced with no sheet (book deleted, sheet absent) shows an
  "upload the sheet" state and lands nothing; the placed lines are untouched.
- A sheet stored before the texture change has no `tex` and reads "can't be
  textured" until replaced.
- The book page (`VendorBookPage`) gains a Price sheets tab; deleting the book
  still returns the configurator to Settings markups and drops the trim tab to
  its empty state.
