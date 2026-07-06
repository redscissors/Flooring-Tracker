-- FloorTrack migration: every customer is team-shared (ADR 0004)
-- Run this ONCE in your Supabase project if it was set up before ADR 0004:
--   Dashboard -> SQL Editor -> New query -> paste -> Run
-- (Fresh installs skip this file — schema.sql and storage.sql already create
-- the shared-only shape.)
--
-- What it does:
--   * every signed-in user can now see, edit, and delete every customer —
--     formerly-private customers become visible to the whole team
--   * the private/public split and the archive flag are removed
--   * owner_id stays as a "created by" record but grants no special rights,
--     and deleting a user account no longer deletes the customers they created

-- New policies first: they must stop referencing visibility/archived before
-- those columns can be dropped.

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

drop policy if exists "version select" on public.versions;
create policy "version select" on public.versions
  for select to authenticated using (true);

drop policy if exists "version insert" on public.versions;
create policy "version insert" on public.versions
  for insert to authenticated with check (true);

drop policy if exists "version delete" on public.versions;
create policy "version delete" on public.versions
  for delete to authenticated using (true);

drop policy if exists "att read" on storage.objects;
create policy "att read" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments');

drop policy if exists "att insert" on storage.objects;
create policy "att insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments');

drop policy if exists "att update" on storage.objects;
create policy "att update" on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments');

drop policy if exists "att delete" on storage.objects;
create policy "att delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments');

-- The guard trigger only protected owner_id/visibility; with visibility gone
-- and ownership meaningless there is nothing left to guard.
drop trigger if exists customers_guard on public.customers;
drop function if exists public.customers_guard();

-- owner_id becomes a plain "created by" note: nullable, and deleting a user
-- account no longer cascades into the team's shared customers.
alter table public.customers alter column owner_id drop not null;
alter table public.customers drop constraint if exists customers_owner_id_fkey;
alter table public.customers add constraint customers_owner_id_fkey
  foreign key (owner_id) references auth.users (id) on delete set null;

-- Dropping the columns also drops their indexes.
alter table public.customers drop column if exists visibility;
alter table public.customers drop column if exists archived;
