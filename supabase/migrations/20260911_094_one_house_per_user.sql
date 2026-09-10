-- Migration: una sola casa por usuario
-- Date: 2026-09-11
--
-- Regla nueva: cada usuario pertenece como mucho a UNA casa. Antes el tope
-- eran 2 casas CREADAS (create_house) y unirse por código no contaba para
-- nada, así que un usuario podía acumular casas sin límite uniéndose.
--
-- IMPORTANTE — no es retroactivo: a quien hoy ya está en 2+ casas NO se le
-- quita ninguna. El chequeo solo impide AÑADIR una casa más (crear o unirse)
-- cuando ya perteneces al menos a una. Cuando esos usuarios bajen a 1 casa,
-- el límite ya les aplica como a todos.
--
-- create_house(text,text) y join_house_by_code(text) son las dos únicas vías
-- de alta en home_members desde el cliente (no hay policy de INSERT), así que
-- el límite vive aquí y no se puede saltar desde fuera de la app. Ambas
-- definiciones se copian de 20260828_071_harden_invite_codes.sql (última
-- versión vigente) cambiando solo la comprobación de límite.

-- ============================================================================
-- create_house: bloquear si ya perteneces a alguna casa
-- ============================================================================
create or replace function public.create_house(p_name text, p_photo text default null)
returns public.houses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house public.houses;
  v_code text;
  v_space_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'El nombre de la casa no puede estar vacío';
  end if;

  if exists (select 1 from public.home_members where user_id = auth.uid()) then
    raise exception 'Ya perteneces a una casa. Cada usuario solo puede estar en una casa.';
  end if;

  v_code := public._gen_invite_code();

  insert into public.houses (name, invite_code, created_by, photo)
  values (trim(p_name), v_code, auth.uid(), p_photo)
  returning * into v_house;

  insert into public.home_members (house_id, user_id, role)
  values (v_house.id, auth.uid(), 'admin');

  insert into public.financial_spaces (type, visibility, name, icon, owner_id, house_id, created_by)
  values ('household', 'house', 'Hogar', '🏠', auth.uid(), v_house.id, auth.uid())
  returning id into v_space_id;

  insert into public.financial_accounts (financial_space_id, name, icon, color, type, currency_code, is_default, created_by)
  values (v_space_id, 'Cuenta Común', '🏦', '#6366F1', 'bank', v_house.currency_code, true, auth.uid());

  return v_house;
end;
$$;

revoke execute on function public.create_house(text, text) from public, anon;
grant execute on function public.create_house(text, text) to authenticated;

-- ============================================================================
-- join_house_by_code: sigue siendo idempotente para la casa a la que ya
-- perteneces, pero bloquea unirse a una SEGUNDA casa distinta
-- ============================================================================
create or replace function public.join_house_by_code(p_code text)
returns public.houses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house public.houses;
begin
  if not public._house_join_rate_ok() then
    raise exception 'Demasiados intentos de unirte a una casa. Espera un rato y vuelve a probar.';
  end if;

  select * into v_house from public.houses where invite_code = upper(trim(p_code));
  if not found then
    raise exception 'Código de invitación no válido';
  end if;

  -- Ya eres miembro de ESTA casa: no-op (como antes).
  if exists (
    select 1 from public.home_members
    where house_id = v_house.id and user_id = auth.uid()
  ) then
    return v_house;
  end if;

  -- Ya perteneces a OTRA casa: una sola casa por usuario.
  if exists (select 1 from public.home_members where user_id = auth.uid()) then
    raise exception 'Ya perteneces a una casa. Cada usuario solo puede estar en una casa.';
  end if;

  insert into public.home_members (house_id, user_id, role)
  values (v_house.id, auth.uid(), 'adult');

  return v_house;
end;
$$;

revoke execute on function public.join_house_by_code(text) from public, anon;
grant execute on function public.join_house_by_code(text) to authenticated;

-- EOF
