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

-- ---------------------------------------------------------------------------
-- Customers
--
-- Each customer is its own row so that customers can be shared. A customer is
-- either "private" (only the owner can see it) or "public" (every signed-in
-- user can see AND edit it). app_data now holds only per-user settings; the
-- customers array was migrated out of that blob into this table.
--
-- `id` is text (not uuid) because customer ids are generated client-side by the
-- app's uid() helper, and the migration reuses those existing ids unchanged.
-- The whole Customer object lives in `data` jsonb, exactly as before.
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id         text primary key,
  owner_id   uuid not null references auth.users (id) on delete cascade,
  visibility text not null default 'public' check (visibility in ('private', 'public')),
  archived   boolean not null default false,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- For installs created before the archive feature.
alter table public.customers add column if not exists archived boolean not null default false;

create index if not exists customers_owner_id_idx on public.customers (owner_id);
create index if not exists customers_visibility_idx on public.customers (visibility);
create index if not exists customers_archived_idx on public.customers (archived);

alter table public.customers enable row level security;

-- Read: your own customers, plus every public one.
drop policy if exists "customer select" on public.customers;
create policy "customer select" on public.customers
  for select using (owner_id = auth.uid() or visibility = 'public');

-- Insert: you may only create customers you own.
drop policy if exists "customer insert" on public.customers;
create policy "customer insert" on public.customers
  for insert with check (owner_id = auth.uid());

-- Update: owners always; anyone may edit a public customer's content. The guard
-- trigger below stops non-owners from changing owner_id or visibility.
drop policy if exists "customer update" on public.customers;
create policy "customer update" on public.customers
  for update using (owner_id = auth.uid() or visibility = 'public')
  with check (owner_id = auth.uid() or visibility = 'public');

-- Delete: the owner anytime; anyone else may delete a public customer anytime too.
drop policy if exists "customer delete" on public.customers;
create policy "customer delete" on public.customers
  for delete using (
    owner_id = auth.uid()
    or visibility = 'public'
  );

-- Only the owner may reassign ownership or flip visibility. Everyone else can
-- still edit the data of a public customer (handled by the update policy).
-- NOTE: `archived` is deliberately NOT guarded here. Archiving must be open to
-- anyone who can edit a public job (not just the owner), so it rides the update
-- policy like ordinary content edits. See docs/adr/0001-archived-as-ungated-column.md.
create or replace function public.customers_guard()
returns trigger language plpgsql as $$
begin
  if (new.owner_id is distinct from old.owner_id
      or new.visibility is distinct from old.visibility)
     and auth.uid() <> old.owner_id then
    raise exception 'Only the owner can change ownership or visibility';
  end if;
  return new;
end;
$$;

drop trigger if exists customers_guard on public.customers;
create trigger customers_guard
  before update on public.customers
  for each row execute function public.customers_guard();

drop trigger if exists customers_updated_at on public.customers;
create trigger customers_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Shared settings (ADR 0002)
--
-- Shop-wide configuration shared by the whole team: the waste factor plus the
-- grout/mortar catalog. ONE singleton row, read and written by every signed-in
-- user (mirroring the "public customer" sharing rule, not the per-user app_data
-- rule). Saved whole; last-write-wins is accepted deliberately (settings edits
-- are rare). The former per-user app_data settings path is retired.
-- ---------------------------------------------------------------------------
create table if not exists public.shared_settings (
  id         text primary key default 'singleton',
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.shared_settings enable row level security;

-- Any authenticated user may read and write the shared settings.
drop policy if exists "shared settings select" on public.shared_settings;
create policy "shared settings select" on public.shared_settings
  for select to authenticated using (true);

drop policy if exists "shared settings insert" on public.shared_settings;
create policy "shared settings insert" on public.shared_settings
  for insert to authenticated with check (true);

drop policy if exists "shared settings update" on public.shared_settings;
create policy "shared settings update" on public.shared_settings
  for update to authenticated using (true) with check (true);

drop trigger if exists shared_settings_updated_at on public.shared_settings;
create trigger shared_settings_updated_at
  before update on public.shared_settings
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Versions (issue 003)
--
-- Saved snapshots used to live inside each customer's data jsonb, so every
-- customer save re-uploaded the whole history. Each snapshot is now its own
-- row; the customer blob no longer carries a versions array. `snapshot` holds
-- the customer's categories (areas/products) at save time — nothing else.
-- `auto` marks automatic end-of-session snapshots (the app keeps the newest 5
-- per customer); named versions are unlimited and never auto-pruned.
-- ---------------------------------------------------------------------------
create table if not exists public.versions (
  id          text primary key,
  customer_id text not null references public.customers (id) on delete cascade,
  label       text not null default '',
  auto        boolean not null default false,
  saved_at    timestamptz not null default now(),
  snapshot    jsonb not null default '[]'::jsonb
);

create index if not exists versions_customer_idx on public.versions (customer_id, saved_at desc);

alter table public.versions enable row level security;

-- Access follows the customer row: see the customer -> see its versions;
-- edit the customer -> save/delete its versions. Rows are immutable (no
-- rename/edit feature), so there is deliberately no update policy.
drop policy if exists "version select" on public.versions;
create policy "version select" on public.versions
  for select to authenticated using (
    exists (select 1 from public.customers c
            where c.id = customer_id
              and (c.owner_id = auth.uid() or c.visibility = 'public')));

drop policy if exists "version insert" on public.versions;
create policy "version insert" on public.versions
  for insert to authenticated with check (
    exists (select 1 from public.customers c
            where c.id = customer_id
              and (c.owner_id = auth.uid() or c.visibility = 'public')));

drop policy if exists "version delete" on public.versions;
create policy "version delete" on public.versions
  for delete to authenticated using (
    exists (select 1 from public.customers c
            where c.id = customer_id
              and (c.owner_id = auth.uid() or c.visibility = 'public')));

-- One-time migration: lift every customer's embedded versions array into rows
-- (original ids, labels, and timestamps preserved; all hand-saved, so
-- auto=false), then strip the array from the blob. Runs as the table owner in
-- the SQL editor, so it reaches private customers of every user. Idempotent:
-- `on conflict do nothing` skips already-migrated snapshots.
insert into public.versions (id, customer_id, label, auto, saved_at, snapshot)
select v->>'id',
       c.id,
       coalesce(nullif(v->>'label', ''), 'Version'),
       false,
       coalesce(to_timestamp((v->>'savedAt')::numeric / 1000.0), c.created_at),
       coalesce(v->'snapshot', '[]'::jsonb)
from public.customers c,
     jsonb_array_elements(c.data->'versions') v
where jsonb_typeof(c.data->'versions') = 'array'
  and v->>'id' is not null
on conflict (id) do nothing;

-- Strip without bumping updated_at — the trigger would stamp every customer
-- "just touched" and scramble the recency-first list on day one.
alter table public.customers disable trigger customers_updated_at;
update public.customers set data = data - 'versions' where data ? 'versions';
alter table public.customers enable trigger customers_updated_at;

-- One-time HITL seed (issue 002, slice 01): collapse per-user settings into the
-- single shared record using the designated canonical user's current settings.
-- `on conflict do nothing` makes this safe to re-run — it never clobbers an
-- already-seeded record. Change the email to re-point the canonical source.
insert into public.shared_settings (id, data)
select 'singleton', ad.data->'settings'
from public.app_data ad
join auth.users u on u.id = ad.user_id
where u.email = 'redscissors5@yahoo.com'
  and ad.data ? 'settings'
on conflict (id) do nothing;
