-- FloorTrack database schema
-- Run this once in your Supabase project:
--   Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- Model: one row per user holding the whole app state as JSON. This mirrors
-- how the app already serialized everything to a single object, and keeps the
-- client code simple. Row Level Security guarantees a user can only ever read
-- or write their own row.

create table if not exists public.app_data (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.app_data enable row level security;

-- Policies: a logged-in user may only touch the row whose user_id is their own.
drop policy if exists "own row select" on public.app_data;
create policy "own row select" on public.app_data
  for select using (auth.uid() = user_id);

drop policy if exists "own row insert" on public.app_data;
create policy "own row insert" on public.app_data
  for insert with check (auth.uid() = user_id);

drop policy if exists "own row update" on public.app_data;
create policy "own row update" on public.app_data
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "own row delete" on public.app_data;
create policy "own row delete" on public.app_data
  for delete using (auth.uid() = user_id);

-- Keep updated_at fresh on every write.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists app_data_updated_at on public.app_data;
create trigger app_data_updated_at
  before update on public.app_data
  for each row execute function public.set_updated_at();
