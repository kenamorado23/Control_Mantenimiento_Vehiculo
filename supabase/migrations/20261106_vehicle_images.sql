-- Migración: fotografías de vehículos en Supabase Storage.
-- Ejecutar una sola vez en Supabase > SQL Editor.
alter table public.vehicles add column if not exists image_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('vehicle-images', 'vehicle-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Public can view vehicle images" on storage.objects;
create policy "Public can view vehicle images"
on storage.objects for select
using (bucket_id = 'vehicle-images');

drop policy if exists "Owners upload vehicle images" on storage.objects;
create policy "Owners upload vehicle images"
on storage.objects for insert to authenticated
with check (bucket_id = 'vehicle-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Owners update vehicle images" on storage.objects;
create policy "Owners update vehicle images"
on storage.objects for update to authenticated
using (bucket_id = 'vehicle-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'vehicle-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "Owners delete vehicle images" on storage.objects;
create policy "Owners delete vehicle images"
on storage.objects for delete to authenticated
using (bucket_id = 'vehicle-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
