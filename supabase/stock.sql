-- Stock price book (ADR 0003)
-- Run once in your Supabase project: Dashboard -> SQL Editor -> paste -> Run.
--
-- One row per SKU from the shop's stock price book workbook, shared by the
-- whole team (same trust model as shared_settings / public customers: every
-- signed-in user reads and writes). The app fills product rows by SNAPSHOT —
-- picking a SKU copies the item's values onto the row — so nothing here is
-- read at calculation time and re-importing the book never rewrites an
-- existing estimate.
--
-- Imports only ever upsert; an item that drops out of the book is marked
-- active = false, never deleted, so old rows keep resolving their SKU.

create table if not exists public.stock_items (
  sku        text primary key,
  active     boolean not null default true,
  -- Team-controlled "don't offer in search" switch — a column, not a data
  -- field, so import upserts can never overwrite the team's choice
  -- (pricebook-disabled.sql adds it on pre-2026-07 installs).
  disabled   boolean not null default false,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.stock_items enable row level security;

drop policy if exists "stock select" on public.stock_items;
create policy "stock select" on public.stock_items
  for select using (auth.uid() is not null);

drop policy if exists "stock insert" on public.stock_items;
create policy "stock insert" on public.stock_items
  for insert with check (auth.uid() is not null);

drop policy if exists "stock update" on public.stock_items;
create policy "stock update" on public.stock_items
  for update using (auth.uid() is not null) with check (auth.uid() is not null);

-- No delete policy: the client never deletes stock rows.

-- Reuses set_updated_at() from schema.sql.
drop trigger if exists stock_items_updated_at on public.stock_items;
create trigger stock_items_updated_at
  before update on public.stock_items
  for each row execute function public.set_updated_at();
