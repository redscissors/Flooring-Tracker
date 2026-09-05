# Sheoga vendor book — design

**Date:** 2026-09-05 · **Status:** approved by owner in chat (mockup reviewed)

## Problem

Sample requests are placed per vendor from the Samples panel, which emails the
vendor's contact off its price book (Contacts tab). Sheoga Hardwood has no
price book — it sells by description through the configurator, not by SKU —
so Sheoga sample requests group under "Sheoga Hardwood" with nowhere to hang a
contact, and no email button. Its two markups live in Settings, apart from
every other vendor's.

## Decision

A third registry book kind, **`vendor`**: a `price_books` row with no items and
no import. It gives a configurator-priced vendor the same Markup, Freight,
Brand and Contacts tabs an order book has. No Source tab, no items table, no
import buttons, no versions.

- `kind: "vendor"`, `data.engine: "sheoga"` names which configurator prices
  it. One vendor book per engine; only `sheoga` exists today.
- `data.markups: { flooring, vents }` — the configurator's two default markups.
  When a Sheoga vendor book exists, the configurator reads them from the book
  (`sheogaMarkups(books, settings)`); otherwise it keeps reading
  `settings.pricing.sheogaMarkupPct` / `sheogaVentMarkupPct` as today. Creating
  the book seeds its markups from the current Settings values, so nothing
  changes on day one. Settings' Sheoga markup card becomes a link to the book
  while the book exists.
- `data.brandLabel` seeds "Sheoga Hardwood"; `data.rep`, `data.sampleContact`
  and `data.freight` are the existing slots, unchanged in shape.
- `data.rep` gains `phone` (Contacts card, every book kind). Display only.

## Sample requests

`requestFrom` resolves a `p.sheoga` line with no `bookId` to the Sheoga vendor
book: the request carries that book's id and brand label, so the Samples panel
groups it under the book and `sampleContactFor` finds its contact. Requests
saved before the book existed carry no `bookId` and the name "Sheoga Hardwood";
the panel's contact resolver falls back to the book whose brand label or name
matches the group name, and `sampleGroups`' existing same-email merge folds the
old name-keyed group into the new id-keyed one.

## Freight

`freightBookFor` resolves a `p.sheoga` row without a `bookId` to the Sheoga
vendor book, so a program switched on there charges the job once like any
vendor's. Default off.

## UI

- **New book dialog:** third type "Vendor", described "Priced by a configurator
  — contacts, markup, freight and brand, no items". Hidden once a Sheoga vendor
  book exists. Name defaults "Sheoga Hardwood".
- **Book page:** `VendorBookPage` (new `src/vendorbook.jsx`): name, "Vendor"
  badge, "Priced by the Sheoga configurator · tables from sheets Jan ’26 /
  Feb ’22" meta, Active toggle, delete. Tabs Markup · Freight · Brand · Contacts
  reuse `FreightCard`, `BrandCard`, `ContactsCard`; `VendorMarkupCard` is new
  (two percent fields with a worked cost→sell example each).
- **Library board:** the In-house column labels the row "vendor · configurator".
- **Settings → Price book:** the Sheoga markup card shows "Sheoga markups now
  live on the Sheoga Hardwood book →" (opens the book) while the book exists.

## Data & migration

`supabase/pricebook-vendor.sql` (run once by the owner): widen the
`price_books.kind` check to `('stock','order','vendor')`. Folded into
`pricebooks.sql` for fresh installs. Until it is run, creating the book pings
the existing "Couldn't create book" toast.

## Testing

- `vendorbook.test.js`: `vendorBookFor`, `sheogaMarkups` (book wins, settings
  fallback, seeded values), `vendorBookSeed`.
- `samples.test.js`: Sheoga line resolves to the vendor book; old name-keyed
  requests merge with new ones through the contact fallback.
- `freight.test.js`: Sheoga row resolves to the vendor book's program.
- Preview proof: `vendor-book-preview.html` mounts the real `VendorBookPage`
  and `SamplesPanel` over mock state; screenshot attached to the PR.

## Out of scope

Account number, lead time, sheet-date editing, a Source tab, generating Sheoga
items, moving the configurator's transcribed tables into the book.
