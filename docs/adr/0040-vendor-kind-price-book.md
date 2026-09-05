# A configurator-priced vendor gets an item-less `vendor`-kind price book

Date: 2026-09-05 · Status: Accepted · Spec: docs/superpowers/specs/2026-09-05-sheoga-vendor-book-design.md

## Context

Sample requests are placed per vendor from the Samples panel, which emails the
contact saved on that vendor's price book (Contacts tab, 2026-09-01). Sheoga
Hardwood sells by description through the configurator and has no book, so its
requests grouped under a bare name with no contact and no email button, and
its two default markups lived alone in Settings while every other vendor's
lived on a book.

## Decision

- A third registry kind, **`vendor`**: a `price_books` row that never holds
  items and never imports. `data.engine` names the configurator that prices
  it (`"sheoga"` today); one vendor book per engine. `supabase/pricebook-vendor.sql`
  widens the kind check on existing installs.
- The book carries the ordinary slots — `rep` (now with `phone`),
  `sampleContact`, `brandLabel`, `freight` — plus `markups: { flooring, vents }`.
  **The book's markups win over Settings when the book exists**
  (`sheogaMarkups`, vendorbook.js); Settings keeps the fields as the fallback
  and shows a link to the book while one exists. Creating the book seeds its
  markups from Settings, so nothing reprices on creation.
- A configurator row has no `bookId`. `requestFrom` and `freightBookFor`
  resolve a `sheoga`-marked row to the vendor book instead (`vendorBookForRow`),
  never by stamping a `bookId` on the row: a bookId would put the row on the
  order-book drift path, which needs a SKU the row does not have.
- Requests saved before the book existed carry the name only. The panel's
  contact resolver (`sampleBookFor`) matches them to the book by brand label
  or name, and the existing same-email group merge folds them in with the
  id-keyed rows. No data migration.

## Consequences

- The book page (`VendorBookPage`) is a separate, small component reusing the
  order book's cards, not a branch inside `BookDetail` — the item-centric page
  would have to hide most of itself.
- Import routing, the stock cache, and `bookNoMarkup` all key on `order`/`stock`
  and ignore a vendor book by construction.
- Deleting the book returns the configurator to the Settings markups and the
  Samples panel to a contact-less Sheoga group; nothing else references it.
