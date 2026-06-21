-- FloorTrack attachment storage
-- Run this once in your Supabase project AFTER schema.sql:
--   Dashboard -> SQL Editor -> New query -> paste -> Run
--
-- Creates a private "attachments" storage bucket and policies so each user can
-- only read/write files under their own folder (named after their user id).
-- The app uploads files to the path: <user_id>/<attachment_id>.

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

create policy "att read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "att insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "att update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "att delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'attachments' and (storage.foldername(name))[1] = auth.uid()::text);
