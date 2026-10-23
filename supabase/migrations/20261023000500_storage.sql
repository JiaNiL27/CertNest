-- Private bucket for certificate files.
-- Path layout: {user_id}/{certificate_id}/{random uuid}.{ext}

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'certificate-files',
  'certificate-files',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Signed-in users may only touch objects under their own user_id folder.
create policy "certificate_files_storage_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'certificate-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "certificate_files_storage_insert_own" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'certificate-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "certificate_files_storage_update_own" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'certificate-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'certificate-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy "certificate_files_storage_delete_own" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'certificate-files'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
