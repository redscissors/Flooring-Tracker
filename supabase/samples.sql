-- Sample requests (sample-ordering workflow, spec 2026-08-28)
-- Run once in your Supabase project: Dashboard -> SQL Editor -> paste -> Run.
--
-- One row per "Request sample" on a project line. Same trust model as todos:
-- every signed-in user can add, edit, and delete every request.
--
-- Everything lives in `data` jsonb (see src/samples.js normSampleRequest):
--   { status: "need"|"ordered", createdBy, createdAt, orderedBy, orderedAt,
--     custId, custName, areaName, productId, bookId, bookName,
--     item: { name, sku, size, type } }
-- `item`/`custName`/`areaName`/`bookName` freeze the line at request time so
-- the customer browser's column and the ordered log stay meaningful after the
-- row is edited or deleted; custId/productId are the live ids surfaces match on.

create table if not exists public.sample_requests (
  id         text primary key,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sample_requests enable row level security;

drop policy if exists "sample request select" on public.sample_requests;
create policy "sample request select" on public.sample_requests
  for select to authenticated using (true);

drop policy if exists "sample request insert" on public.sample_requests;
create policy "sample request insert" on public.sample_requests
  for insert to authenticated with check (true);

drop policy if exists "sample request update" on public.sample_requests;
create policy "sample request update" on public.sample_requests
  for update to authenticated using (true) with check (true);

drop policy if exists "sample request delete" on public.sample_requests;
create policy "sample request delete" on public.sample_requests
  for delete to authenticated using (true);

-- Reuses set_updated_at() from schema.sql.
drop trigger if exists sample_requests_updated_at on public.sample_requests;
create trigger sample_requests_updated_at
  before update on public.sample_requests
  for each row execute function public.set_updated_at();
