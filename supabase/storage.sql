-- FloorTrack attachment storage
-- Run this once in your Supabase project AFTER schema.sql:
--   Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- Creates a private "attachments" storage bucket. Files are stored at the path
--   <customer_id>/<attachment_id>
-- Customers are team-shared (ADR 0004), so any signed-in user may read and
-- write any attachment; the bucket only shuts out the outside world.
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
