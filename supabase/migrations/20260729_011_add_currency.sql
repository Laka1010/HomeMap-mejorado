-- Migration: Add currency_code to houses
-- Date: 2026-07-29
--
-- Adds multi-currency support: each house selects a currency code (ISO 4217).
-- Stores only the code, not symbol or name — retrieved dynamically from frontend.
-- Defaults to EUR. Only admin/owner can change it.

-- ============================================================================
-- SCHEMA
-- ============================================================================

alter table public.houses
add column if not exists currency_code text not null default 'EUR'
check (currency_code ~ '^[A-Z]{3}$');  -- ISO 4217 format (e.g. EUR, USD, GBP)

-- ============================================================================
-- READ VIEW
-- ============================================================================

-- my_houses es la única fuente de lectura de casas del cliente
-- (houseService.listMyHouses). Si currency_code no se añade aquí, la moneda se
-- guarda pero nunca vuelve al front y la app se queda siempre en el default.
--
-- NOTA: la columna nueva va al final de la lista (ver la misma nota en
-- 20260728_008_house_photo.sql): CREATE OR REPLACE VIEW no permite insertar una
-- columna en medio de las existentes sin renombrar las siguientes (error 42P16).
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

-- ============================================================================
-- MUTATION
-- ============================================================================

create or replace function public.set_house_currency(p_house_id uuid, p_currency_code text)
returns public.houses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house public.houses;
begin
  -- Only admin can change currency
  if not public.is_house_admin(p_house_id) then
    raise exception 'Solo el administrador puede cambiar la moneda';
  end if;

  -- Validate ISO 4217 format
  if p_currency_code is null or p_currency_code !~ '^[A-Z]{3}$' then
    raise exception 'Código de moneda inválido: %', p_currency_code;
  end if;

  update public.houses
  set currency_code = p_currency_code
  where id = p_house_id
  returning * into v_house;

  if not found then
    raise exception 'Casa no encontrada';
  end if;

  return v_house;
end;
$$;

-- ============================================================================
-- GRANTS
-- ============================================================================

grant execute on function public.set_house_currency(uuid, text) to authenticated;

-- EOF
