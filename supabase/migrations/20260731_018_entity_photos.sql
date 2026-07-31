-- Migration: multi-photo gallery for objects, rooms, containers
-- Date: 2026-07-31
--
-- Hasta ahora rooms/containers/objects tenían una única columna `photo`
-- (base64 completo guardado directamente en Postgres, sin compresión — ver
-- 20260726_003_home_content.sql). Esta tabla la sustituye para nuevas
-- fotos: cada fila es UNA foto de UNA entidad, con la imagen ya comprimida
-- (ver compressImage en photoUtils.jsx) subida al bucket de Storage
-- 'entity-photos' — igual que 'receipts' en 20260728_006_receipt_scan.sql,
-- pero polimórfica (entity_type/entity_id) porque aquí son tres tablas en
-- vez de una, con el mismo patrón ya usado en house_activity
-- (20260730_015_house_activity_entity_ref.sql). La columna `photo` vieja de
-- cada tabla NO se toca ni se borra: el cliente la sigue mostrando como
-- primera foto de la galería para objetos ya existentes que la tuvieran.
--
-- entity_id es `text` porque los ids de rooms/containers/objects son
-- client-generated text (p. ej. "o-ab12cd"), no uuid.

create table if not exists public.entity_photos (
  id uuid primary key default gen_random_uuid(),
  house_id uuid not null references public.houses(id) on delete cascade,
  entity_type text not null check (entity_type in ('object', 'room', 'container')),
  entity_id text not null,
  storage_path text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists entity_photos_entity_idx on public.entity_photos(entity_type, entity_id);
create index if not exists entity_photos_house_id_idx on public.entity_photos(house_id);

alter table public.entity_photos enable row level security;

create policy "entity_photos_rw_members" on public.entity_photos
  for all to authenticated
  using (public.is_house_member(house_id))
  with check (public.is_house_member(house_id));

-- Bucket privado, mismo patrón de RLS que 'receipts': el primer segmento de
-- la ruta (house_id/entity_type/entity_id/archivo.jpg) es el house_id.
insert into storage.buckets (id, name, public)
values ('entity-photos', 'entity-photos', false)
on conflict (id) do nothing;

drop policy if exists "entity_photos_storage_rw_members" on storage.objects;
create policy "entity_photos_storage_rw_members" on storage.objects
  for all to authenticated
  using (bucket_id = 'entity-photos' and public.is_house_member((storage.foldername(name))[1]::uuid))
  with check (bucket_id = 'entity-photos' and public.is_house_member((storage.foldername(name))[1]::uuid));

-- EOF
