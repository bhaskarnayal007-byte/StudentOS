-- Files attached to notes (PDFs, photos, slides, documents, spreadsheets).
--
-- The note itself already syncs through user_state. Its file lives in the
-- private `note-files` bucket at <user id>/<note id>, so every device signed
-- in to the account can fetch it. Private: only the owner can read or write
-- their own folder; nothing is served by public URL.
--
-- 50MB per file is the free plan's per-file ceiling.

insert into storage.buckets (id, name, public, file_size_limit)
values ('note-files', 'note-files', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = 52428800;

create policy "note-files: read own" on storage.objects for select to authenticated
  using (bucket_id = 'note-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "note-files: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'note-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "note-files: replace own" on storage.objects for update to authenticated
  using (bucket_id = 'note-files' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "note-files: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'note-files' and (storage.foldername(name))[1] = auth.uid()::text);
