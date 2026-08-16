-- Bucket limits are a second boundary; API validation and image decoding remain authoritative.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-images', 'profile-images', true, 5242880, array['image/webp']),
  ('listing-images', 'listing-images', false, 5242880, array['image/webp']),
  ('dispute-evidence', 'dispute-evidence', false, 5242880, array['image/webp'])
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- All writes, private reads, and deletes flow through the NestJS API's secret-key adapter.
drop policy if exists thriftage_direct_object_insert on storage.objects;
drop policy if exists thriftage_direct_object_update on storage.objects;
drop policy if exists thriftage_direct_object_delete on storage.objects;
drop policy if exists thriftage_direct_private_object_read on storage.objects;
