-- Migration: expose houses.currency_code through the my_houses view
-- Date: 2026-07-29
--
-- 20260729_011_add_currency.sql añadió houses.currency_code pero no actualizó
-- la vista my_houses, que es de donde el cliente lee las casas
-- (houseService.listMyHouses). Resultado: set_house_currency() guardaba bien el
-- código pero el front nunca lo recibía y se quedaba siempre en el default EUR.
--
-- La 011 ya incluye esta vista corregida para instalaciones nuevas. Esta
-- migración existe para los proyectos donde la 011 ya se aplicó, de forma que
-- ambos casos acaben en el mismo estado. Es idempotente.

-- NOTA: currency_code va al final de la lista de columnas — CREATE OR REPLACE
-- VIEW no permite insertar una columna en medio de las existentes (error 42P16).
create or replace view public.my_houses
with (security_invoker = true)
as
select
  h.id,
  h.name,
  h.invite_code,
  h.created_by,
  h.created_at,
  hm.role as my_role,
  (select count(*) from public.home_members hm2 where hm2.house_id = h.id) as member_count,
  h.photo,
  h.currency_code
from public.houses h
join public.home_members hm on hm.house_id = h.id and hm.user_id = auth.uid();

grant select on public.my_houses to authenticated;

-- EOF
