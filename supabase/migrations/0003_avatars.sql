-- Profile pictures.
--
-- Each picture lives in the public `avatars` bucket at <user id>/avatar.webp,
-- and profiles.avatar_url points at it. Public-read is fine: it's the same
-- picture anyone who sees your tag sees anyway, and it keeps <img src> simple.

alter table public.profiles add column if not exists avatar_url text;

-- Tags are already unique and forced lowercase by 0002, so @Maya and @maya
-- can't both exist. Nothing more is needed for that here.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 524288, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do update
  set public = true, file_size_limit = 524288,
      allowed_mime_types = array['image/webp', 'image/png', 'image/jpeg'];

-- Writes only inside your own folder. Reading goes through the public URL.
create policy "avatars: upload own" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: replace own" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
-- An upsert reads the existing object first, so own-folder select is needed too.
create policy "avatars: read own" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
