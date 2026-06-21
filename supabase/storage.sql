-- FloorTrack attachment storage
-- Run this once in your Supabase project AFTER schema.sql:
--   Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- Creates a private "attachments" storage bucket. Files are stored at the path
--   <customer_id>/<attachment_id>
-- so that access can follow the customer's sharing rules: a file is readable
-- and writable by the customer's owner, and by everyone if the customer is
-- public (public customers are view-and-edit for all signed-in users).
--
-- NOTE: earlier versions stored files at <user_id>/<attachment_id>. The app
-- migrates existing files to the new <customer_id>/<attachment_id> layout on
-- first load, so no manual file move is required.

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- Replace the old owner-folder policies if they exist.
drop policy if exists "att read own" on storage.objects;
drop policy if exists "att insert own" on storage.objects;
drop policy if exists "att update own" on storage.objects;
drop policy if exists "att delete own" on storage.objects;

-- Helper predicate (inlined per policy): the customer whose id is the first path
-- segment is one the current user may access / edit.
drop policy if exists "att read" on storage.objects;
create policy "att read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'attachments' and exists (
      select 1 from public.customers c
      where c.id = (storage.foldername(name))[1]
        and (c.owner_id = auth.uid() or c.visibility = 'public')
    )
  );

drop policy if exists "att insert" on storage.objects;
create policy "att insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'attachments' and exists (
      select 1 from public.customers c
      where c.id = (storage.foldername(name))[1]
        and (c.owner_id = auth.uid() or c.visibility = 'public')
    )
  );

drop policy if exists "att update" on storage.objects;
create policy "att update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'attachments' and exists (
      select 1 from public.customers c
      where c.id = (storage.foldername(name))[1]
        and (c.owner_id = auth.uid() or c.visibility = 'public')
    )
  );

drop policy if exists "att delete" on storage.objects;
create policy "att delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'attachments' and exists (
      select 1 from public.customers c
      where c.id = (storage.foldername(name))[1]
        and (c.owner_id = auth.uid() or c.visibility = 'public')
    )
  );
