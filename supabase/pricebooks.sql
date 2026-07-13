-- Price book library (ADR 0009)
-- Run once in your Supabase project: Dashboard -> SQL Editor -> paste -> Run.
-- Safe to run before the feature ships; the app hides registry affordances
-- while these tables are empty.
--
-- The registry holds every price book beyond the original stock workbook
-- (which stays in stock_items as the reserved book id 'stock'): more shop
-- stock sheets (kind = 'stock') and special-order vendor lists
-- (kind = 'order', items store the vendor COST; markups live on the book and
-- selling prices are computed at pick time, never stored on items).
--
-- Trust model matches stock_items / shared_settings: every signed-in user
-- reads and writes. Items are only ever upserted; a SKU that drops out of a
-- re-import is marked active = false, never deleted, so selections that
-- reference it keep resolving.

create table if not exists public.price_books (
  id         text primary key,
  kind       text not null check (kind in ('stock', 'order')),
  name       text not null default '',
  active     boolean not null default true,
  -- { vendor, note, mapping, markups: { groupBy, default, byGroup },
  --   freight (reserved), skuPattern, lastImport: { at, by, count } }
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.price_book_items (
  book_id    text not null references public.price_books(id),
  sku        text not null,
  active     boolean not null default true,
  -- Same item shape as stock_items.data plus, for order books: cost, mfg,
  -- leadTime, msrp, freightFlag, tierPrices.
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  -- Vendor SKU spaces overlap across books; the pair is the identity.
  primary key (book_id, sku)
);

create table if not exists public.pricebook_versions (
  id          text primary key,
  -- A price_books id, or the reserved 'stock' for the stock workbook.
  book_id     text not null,
  label       text not null default '',
  -- Keeper: excluded from the newest-3 pruning the app runs after each apply.
  pinned      boolean not null default false,
  imported_at timestamptz not null default now(),
  imported_by text not null default '',
  item_count  integer not null default 0,
  -- The parsed items exactly as applied (costs for order books, never sell
  -- prices — markups are settings and are not versioned). Rollback replays
  -- this through the normal import diff preview; it never writes directly.
  snapshot    jsonb not null default '[]'::jsonb
);

alter table public.price_books enable row level security;
alter table public.price_book_items enable row level security;
alter table public.pricebook_versions enable row level security;

drop policy if exists "price_books select" on public.price_books;
create policy "price_books select" on public.price_books
  for select using (auth.uid() is not null);

drop policy if exists "price_books insert" on public.price_books;
create policy "price_books insert" on public.price_books
  for insert with check (auth.uid() is not null);

drop policy if exists "price_books update" on public.price_books;
create policy "price_books update" on public.price_books
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

-- Delete is allowed (ADR 0009 delete amendment): a book can be removed outright, not just
-- retired via active = false. Selections snapshot item values at pick time, so
-- a delete never changes a saved estimate — only the live drift chip stops.
drop policy if exists "price_books delete" on public.price_books;
create policy "price_books delete" on public.price_books
  for delete using (auth.uid() is not null);

drop policy if exists "price_book_items select" on public.price_book_items;
create policy "price_book_items select" on public.price_book_items
  for select using (auth.uid() is not null);

drop policy if exists "price_book_items insert" on public.price_book_items;
create policy "price_book_items insert" on public.price_book_items
  for insert with check (auth.uid() is not null);

drop policy if exists "price_book_items update" on public.price_book_items;
create policy "price_book_items update" on public.price_book_items
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

-- Delete is allowed (ADR 0009 delete amendment) so a book's items can be removed when the book
-- itself is deleted. Imports still only ever upsert / mark inactive — they never
-- delete; the delBook path is the sole deleter.
drop policy if exists "price_book_items delete" on public.price_book_items;
create policy "price_book_items delete" on public.price_book_items
  for delete using (auth.uid() is not null);

drop policy if exists "pricebook_versions select" on public.pricebook_versions;
create policy "pricebook_versions select" on public.pricebook_versions
  for select using (auth.uid() is not null);

drop policy if exists "pricebook_versions insert" on public.pricebook_versions;
create policy "pricebook_versions insert" on public.pricebook_versions
  for insert with check (auth.uid() is not null);

-- Unlike the customers' versions table, version rows here allow UPDATE — but
-- only so the app can toggle pinned/label; the client never rewrites a
-- snapshot.
drop policy if exists "pricebook_versions update" on public.pricebook_versions;
create policy "pricebook_versions update" on public.pricebook_versions
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

-- Delete is allowed: the app prunes unpinned versions to the newest 3 per
-- book after each import (pinned rows are never pruned).
drop policy if exists "pricebook_versions delete" on public.pricebook_versions;
create policy "pricebook_versions delete" on public.pricebook_versions
  for delete using (auth.uid() is not null);

-- Reuses set_updated_at() from schema.sql.
drop trigger if exists price_books_updated_at on public.price_books;
create trigger price_books_updated_at
  before update on public.price_books
  for each row execute function public.set_updated_at();

drop trigger if exists price_book_items_updated_at on public.price_book_items;
create trigger price_book_items_updated_at
  before update on public.price_book_items
  for each row execute function public.set_updated_at();
