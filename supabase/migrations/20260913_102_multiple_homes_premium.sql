-- Migration: varias casas para usuarios Premium (Haven IA, sección 7)
-- Date: 2026-09-13
--
-- 20260911_094_one_house_per_user.sql limitó a 1 sola casa por usuario, sin
-- excepción. El pedido de Haven IA quiere justo lo contrario para usuarios
-- Premium/prueba: el usuario ha confirmado mantener el límite de 1 casa
-- para free, pero permitir más para quien tenga `can_use_premium_feature
-- ('multiple_homes')` (ver 20260913_100_premium_subscription_status.sql).
--
-- Mismo patrón que esa migración: `create or replace` de las dos únicas
-- vías de alta en home_members desde el cliente (create_house,
-- join_house_by_code), cambiando SOLO el chequeo de límite -- el resto del
-- cuerpo se copia tal cual de la definición vigente en producción
-- (verificado con pg_get_functiondef antes de escribir esto).
--
-- Los `raise exception` de este chequeo pasan a llevar
-- `using errcode = '42501'` (igual que los rechazos de permisos de
-- 20260808_045_security_events.sql) para que houseService.js pueda
-- registrar el intento vía logIfPermissionDenied: alguien free chocando
-- aquí después de que el cliente ya oculta el botón es un indicio real de
-- bypass, no un simple error de validación.

-- ============================================================================
-- create_house: bloquear una 2ª+ casa solo si el usuario NO tiene premium
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

  if exists (select 1 from public.home_members where user_id = auth.uid())
     and not public.can_use_premium_feature('multiple_homes') then
    raise exception 'Ya perteneces a una casa. Hazte Premium para tener más de una.' using errcode = '42501';
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
-- join_house_by_code: mismo cambio en el segundo chequeo (unirse a OTRA casa)
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

  -- Ya perteneces a OTRA casa: solo bloquea si no tiene premium.
  if exists (select 1 from public.home_members where user_id = auth.uid())
     and not public.can_use_premium_feature('multiple_homes') then
    raise exception 'Ya perteneces a una casa. Hazte Premium para tener más de una.' using errcode = '42501';
  end if;

  insert into public.home_members (house_id, user_id, role)
  values (v_house.id, auth.uid(), 'adult');

  return v_house;
end;
$$;

revoke execute on function public.join_house_by_code(text) from public, anon;
grant execute on function public.join_house_by_code(text) to authenticated;

-- EOF
