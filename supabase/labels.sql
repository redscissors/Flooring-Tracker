-- Tile-sample labels (Apps hub → Label Generator).
-- Run once in your Supabase project: Dashboard -> SQL Editor -> paste -> Run.
--
-- One row per saved showroom label, shared team-wide with the same trust model
-- as customers / todos: every signed-in user can add, edit, and delete any label.
--
-- `position` gives a stable insertion order; everything else lives in `data`:
--   { presetId, w, h, header, lines:[{key,show,size}], fields:{...}, sku,
--     createdBy, createdAt }

create table if not exists public.labels (
  id         text primary key,
  position   double precision not null default 0,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.labels enable row level security;

drop policy if exists "label select" on public.labels;
create policy "label select" on public.labels
  for select to authenticated using (true);

drop policy if exists "label insert" on public.labels;
create policy "label insert" on public.labels
  for insert to authenticated with check (true);

drop policy if exists "label update" on public.labels;
create policy "label update" on public.labels
  for update to authenticated using (true) with check (true);

drop policy if exists "label delete" on public.labels;
create policy "label delete" on public.labels
  for delete to authenticated using (true);

-- Reuses set_updated_at() from schema.sql.
drop trigger if exists labels_updated_at on public.labels;
create trigger labels_updated_at
  before update on public.labels
  for each row execute function public.set_updated_at();
