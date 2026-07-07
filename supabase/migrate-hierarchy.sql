-- FloorTrack — Builder ▸ Customer ▸ Project hierarchy (ADR 0005)
-- Run this ONCE in your Supabase project:
--   Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- ⚠️  COORDINATED / BREAKING MIGRATION — read before running.
--   This renames the live `customers` table to `projects`. The currently
--   deployed app queries `customers` for jobs, so the moment you run this the
--   OLD site stops working until the NEW app version (the PR that adds this
--   feature) is deployed. Do both in one short window, when nobody is
--   mid-estimate:
--     1) merge/deploy the matching app version (Netlify build ~1-2 min), and
--     2) run this SQL — right around the same time.
--   Take a JSON backup first (Settings -> Backup) so you can roll back.
--
-- What it does:
--   • renames `customers` (the job table) -> `projects`, keeping every row id,
--     so the versions FK and attachment storage paths keep working untouched;
--   • adds a canonical `builders` name-list table;
--   • adds a first-class `customers` (person/account) table that owns projects;
--   • adds `projects.customer_id`;
--   • backfills one Customer per distinct project name and links each project.
--
-- All steps are idempotent and guarded — safe to re-run.

-- ---------------------------------------------------------------------------
-- Step 1 — rename the job table `customers` -> `projects`
--
-- Discriminate the OLD job table (no `builder_id` column) from the NEW person
-- table this migration creates (has `builder_id`), so a re-run is a no-op.
-- The versions FK, RLS policies, trigger, and indexes all follow the rename.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (
        select 1 from information_schema.tables
        where table_schema = 'public' and table_name = 'customers')
     and not exists (
        select 1 from information_schema.columns
        where table_schema = 'public' and table_name = 'customers'
          and column_name = 'builder_id')
  then
    alter table public.customers rename to projects;
  end if;
end $$;

-- Re-point the inherited policies/trigger to project-y names (idempotent).
drop policy if exists "customer select" on public.projects;
drop policy if exists "customer insert" on public.projects;
drop policy if exists "customer update" on public.projects;
drop policy if exists "customer delete" on public.projects;
drop policy if exists "project select" on public.projects;
drop policy if exists "project insert" on public.projects;
drop policy if exists "project update" on public.projects;
drop policy if exists "project delete" on public.projects;

create policy "project select" on public.projects
  for select to authenticated using (true);
create policy "project insert" on public.projects
  for insert to authenticated with check (owner_id = auth.uid());
create policy "project update" on public.projects
  for update to authenticated using (true) with check (true);
create policy "project delete" on public.projects
  for delete to authenticated using (true);

drop trigger if exists customers_updated_at on public.projects;
drop trigger if exists projects_updated_at on public.projects;
create trigger projects_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Step 2 — builders (canonical name-list, ADR 0005)
--
-- Customers link to a builder by id so "P&L" and "P & L" can't split into two.
-- Name-only for now; `data` reserves room to grow builders into full accounts
-- later without another migration. Team-shared like everything else (ADR 0004).
-- ---------------------------------------------------------------------------
create table if not exists public.builders (
  id         text primary key,
  name       text not null default '',
  data       jsonb not null default '{}'::jsonb,
  owner_id   uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.builders enable row level security;

drop policy if exists "builder select" on public.builders;
create policy "builder select" on public.builders
  for select to authenticated using (true);

drop policy if exists "builder insert" on public.builders;
create policy "builder insert" on public.builders
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "builder update" on public.builders;
create policy "builder update" on public.builders
  for update to authenticated using (true) with check (true);

drop policy if exists "builder delete" on public.builders;
create policy "builder delete" on public.builders
  for delete to authenticated using (true);

drop trigger if exists builders_updated_at on public.builders;
create trigger builders_updated_at
  before update on public.builders
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Step 3 — customers (the person/account, ADR 0005)
--
-- Holds the person's contact info once (in `data`: name/phone/email/address/
-- notes) and owns many projects. Optionally under a builder. `id` is text like
-- every other client-generated id. Team-shared.
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id         text primary key,
  builder_id text references public.builders (id) on delete set null,
  data       jsonb not null default '{}'::jsonb,
  owner_id   uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customers_builder_idx on public.customers (builder_id);

alter table public.customers enable row level security;

drop policy if exists "customer select" on public.customers;
create policy "customer select" on public.customers
  for select to authenticated using (true);

drop policy if exists "customer insert" on public.customers;
create policy "customer insert" on public.customers
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists "customer update" on public.customers;
create policy "customer update" on public.customers
  for update to authenticated using (true) with check (true);

drop policy if exists "customer delete" on public.customers;
create policy "customer delete" on public.customers
  for delete to authenticated using (true);

drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Step 4 — link projects to customers
-- ---------------------------------------------------------------------------
alter table public.projects
  add column if not exists customer_id text references public.customers (id) on delete set null;

create index if not exists projects_customer_idx on public.projects (customer_id);

-- ---------------------------------------------------------------------------
-- Step 5 — backfill: one Customer per distinct project name, then link
--
-- Normalized name key = lowercased, letters+digits only ("P&L" = "P & L").
-- Projects with a blank name are left unassigned (customer_id stays null); the
-- app groups those under "Unassigned" so they can be linked by hand. Idempotent
-- via `not exists` (no duplicate customers on re-run) and `customer_id is null`
-- (never re-links an already-linked project). Runs as table owner, so it reaches
-- every project regardless of RLS.
-- ---------------------------------------------------------------------------
insert into public.customers (id, builder_id, data, owner_id, created_at)
select gen_random_uuid()::text,
       null,
       jsonb_build_object(
         'name',    coalesce(rep.data->>'name', ''),
         'phone',   coalesce(rep.data->>'phone', ''),
         'email',   coalesce(rep.data->>'email', ''),
         'address', coalesce(rep.data->>'address', ''),
         'notes',   ''
       ),
       rep.owner_id,
       rep.created_at
from (
  select distinct on (nkey) nkey, data, owner_id, created_at
  from (
    select lower(regexp_replace(coalesce(p.data->>'name', ''), '[^a-zA-Z0-9]', '', 'g')) as nkey,
           p.data, p.owner_id, p.created_at
    from public.projects p
  ) s
  where nkey <> ''
  order by nkey, created_at asc
) rep
where not exists (
  select 1 from public.customers c
  where lower(regexp_replace(coalesce(c.data->>'name', ''), '[^a-zA-Z0-9]', '', 'g')) = rep.nkey
);

update public.projects p
set customer_id = c.id
from public.customers c
where p.customer_id is null
  and lower(regexp_replace(coalesce(p.data->>'name', ''),  '[^a-zA-Z0-9]', '', 'g')) <> ''
  and lower(regexp_replace(coalesce(p.data->>'name', ''),  '[^a-zA-Z0-9]', '', 'g'))
    = lower(regexp_replace(coalesce(c.data->>'name', ''),  '[^a-zA-Z0-9]', '', 'g'));
