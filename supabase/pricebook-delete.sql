-- Price book deletion (ADR 0009 delete amendment)
-- Run once in your Supabase project: Dashboard -> SQL Editor -> paste -> Run.
-- Requires pricebooks.sql to have been run first.
--
-- ADR 0009 originally shipped registry books with NO delete policy — a book was
-- only ever retired via active = false, on the theory that a selection might
-- still reference it. In practice a selection row snapshots the item's values
-- when it is picked (like the stock workbook), and the only thing that reads the
-- live book afterward is the advisory drift/freight chip, which already tolerates
-- a missing SKU. So a hard delete is safe: saved estimates keep their prices;
-- only the live "price changed" chip for that book stops resolving.
--
-- This adds DELETE policies to the two registry tables so the app's delBook path
-- can remove a book's items, then the book row. (pricebook_versions already
-- allows delete — it is pruned after every import.) Same trust model as the
-- rest of the price book: every signed-in user may delete.
--
-- The reserved 'stock' workbook is NOT a price_books row (its items live in
-- stock_items) and is never deletable from the UI.

drop policy if exists "price_book_items delete" on public.price_book_items;
create policy "price_book_items delete" on public.price_book_items
  for delete using (auth.uid() is not null);

drop policy if exists "price_books delete" on public.price_books;
create policy "price_books delete" on public.price_books
  for delete using (auth.uid() is not null);
