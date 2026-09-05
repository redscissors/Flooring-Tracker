-- Vendor-kind price books (spec 2026-09-05, ADR 0040)
-- Run once on installs that ran pricebooks.sql before 2026-09-05:
-- Dashboard -> SQL Editor -> paste -> Run. Fresh installs get this from
-- pricebooks.sql directly.
--
-- A vendor book is a price_books row with no items and no import — the
-- contacts, markup, freight and brand slots for a vendor a configurator
-- prices by description (Sheoga). Until this runs, "New book -> Sheoga
-- (vendor)" fails the kind check and the app pings "Couldn't create book".

alter table public.price_books drop constraint if exists price_books_kind_check;
alter table public.price_books
  add constraint price_books_kind_check check (kind in ('stock', 'order', 'vendor'));
