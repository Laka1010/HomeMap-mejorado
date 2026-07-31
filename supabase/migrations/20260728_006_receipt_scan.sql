-- Migration: escaneo de tickets (receipt scan)
-- Date: 2026-07-28
--
-- Añade a shopping_purchases los campos necesarios para guardar el
-- resultado del escaneo de un ticket con IA: la foto original, impuestos y
-- descuentos detectados, y el resultado crudo del análisis (raw_scan) para
-- poder comparar en el futuro lo que detectó la IA frente a lo que el
-- usuario corrigió — base para mejorar la detección con el tiempo sin
-- necesitar una tabla nueva.
--
-- receipt_image_url guarda la RUTA dentro del bucket de Storage (no una URL
-- pública), porque el bucket es privado; la URL de visualización se genera
-- bajo demanda con una signed URL (ver receiptService.js).
--
-- El bucket 'receipts' reusa exactamente el mismo patrón de RLS que el
-- resto de tablas por-casa (public.is_house_member), aplicado sobre
-- storage.objects filtrando por el primer segmento de la ruta
-- (house_id/archivo.jpg).

alter table public.shopping_purchases
  add column if not exists receipt_image_url text,
  add column if not exists tax_amount numeric(12, 2),
  add column if not exists discount_amount numeric(12, 2),
  add column if not exists raw_scan jsonb;

insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "receipts_rw_members" on storage.objects;
create policy "receipts_rw_members" on storage.objects
  for all to authenticated
  using (bucket_id = 'receipts' and public.is_house_member((storage.foldername(name))[1]::uuid))
  with check (bucket_id = 'receipts' and public.is_house_member((storage.foldername(name))[1]::uuid));

-- EOF
