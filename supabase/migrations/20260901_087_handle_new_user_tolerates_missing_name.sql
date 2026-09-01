-- Migration: handle_new_user deja de inventar nombres a partir del correo,
-- y se añade set_display_name para poder fijarlo después
-- Date: 2026-09-01
--
-- CONTEXTO
-- Hoy el registro por email exige nombre y apellido (campos `required` en
-- AuthView y botón deshabilitado sin ellos), así que en la práctica siempre
-- llegan. Esta migración es preparación para el día que se active un proveedor
-- social, donde eso deja de ser cierto.
--
-- PROBLEMA
-- handle_new_user derivaba el nombre así:
--
--   v_display_name := coalesce(
--     nullif(trim(concat_ws(' ', meta->>'name', meta->>'surname')), ''),
--     split_part(new.email, '@', 1)          -- <-- el problema
--   );
--
-- Con Sign in with Apple eso se rompe por dos sitios a la vez:
--
--   * Apple entrega el nombre SOLO la primera vez que el usuario autoriza, y
--     nunca más. Si el alta falla a medias, no hay segunda oportunidad.
--   * Con "Ocultar mi correo", el email es a1b2c3d4@privaterelay.appleid.com.
--
-- Combinado, el display_name acababa siendo "a1b2c3d4": una cadena aleatoria
-- que es lo que verían sus convivientes en la casa, lo que saldría en el
-- Security Center, y lo que quedaría grabado dentro de financial_spaces.name
-- como "Personal (a1b2c3d4)".
--
-- QUÉ SE HACE
--   1. El respaldo al correo se mantiene SOLO para correos reales. Para los
--      alias de privacidad conocidos -- que generan una parte local aleatoria y
--      por tanto no informan de nada -- se deja display_name en NULL, que es
--      honesto: no sabemos cómo se llama. La columna ya admite nulos.
--   2. El nombre del espacio personal deja de tener un paréntesis vacío o con
--      basura: es "Personal (Lucas Mesas)" si hay nombre, y "Personal" si no.
--      Se conserva así la intención de 20260812_067.
--   3. Nueva RPC set_display_name(text) para que el usuario pueda ponerlo
--      después. Hacía falta porque `profiles` solo tiene políticas de SELECT:
--      el cliente no puede actualizar la fila directamente.
--      Además mantiene sincronizado el nombre del espacio personal, que hasta
--      ahora quedaba congelado con el valor del alta aunque el usuario
--      cambiara de nombre.
--
-- LO QUE NO SE HACE
-- No se toca el registro por email, que sigue exigiendo nombre. Y no se añade
-- el paso de onboarding que pediría el nombre a quien entre sin él: hoy no
-- existe ese caso, y construir esa pantalla antes de decidir si se activa el
-- login social sería trabajo especulativo. La RPC queda lista para cuando toque.
--
-- set_display_name no comprueba _is_account_blocked(), igual que set_last_home:
-- son campos del perfil propio, no acciones sobre la casa ni sobre dinero.
--
-- REVERSIBLE: reaplicar handle_new_user de 20260812_067_personal_space_name_includes_user.sql
-- y hacer drop de set_display_name.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_display_name text;
  v_space_name text;
begin
  v_display_name := nullif(
    trim(concat_ws(' ', new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'surname')),
    ''
  );

  -- Respaldo al correo solo si es un correo de verdad. Los alias de privacidad
  -- producen una parte local aleatoria: derivar de ahí da un nombre peor que
  -- no tener ninguno.
  if v_display_name is null
     and new.email is not null
     and new.email not ilike '%@privaterelay.appleid.com'
     and new.email not ilike '%@mozmail.com'
     and new.email not ilike '%@duck.com'
  then
    v_display_name := nullif(split_part(new.email, '@', 1), '');
  end if;

  insert into public.profiles (id, display_name, email)
  values (new.id, v_display_name, new.email)
  on conflict (id) do nothing;

  v_space_name := case
    when v_display_name is null then 'Personal'
    else 'Personal (' || v_display_name || ')'
  end;

  insert into public.financial_spaces (type, visibility, name, icon, owner_id, house_id, created_by)
  values ('personal', 'private', v_space_name, '👤', new.id, null, new.id)
  on conflict (owner_id) where type = 'personal' do nothing;

  return new;
end;
$fn$;

-- Permite fijar o corregir el nombre visible después del alta. Necesaria porque
-- `profiles` no tiene política de UPDATE: el cliente no puede tocar la fila.
create or replace function public.set_display_name(p_display_name text)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_uid uuid := auth.uid();
  v_clean text;
begin
  if v_uid is null then
    raise exception 'No autenticado' using errcode = '42501';
  end if;

  v_clean := nullif(trim(coalesce(p_display_name, '')), '');
  if v_clean is null then
    raise exception 'El nombre no puede estar vacío';
  end if;
  if length(v_clean) > 60 then
    raise exception 'El nombre no puede superar los 60 caracteres';
  end if;

  update public.profiles
  set display_name = v_clean
  where id = v_uid;

  if not found then
    raise exception 'Perfil no encontrado';
  end if;

  -- Mantener el espacio personal en sintonía. Hasta ahora su nombre quedaba
  -- congelado con el valor del alta.
  update public.financial_spaces
  set name = 'Personal (' || v_clean || ')'
  where owner_id = v_uid and type = 'personal';

  return v_clean;
end;
$fn$;

revoke execute on function public.set_display_name(text) from public, anon;
grant execute on function public.set_display_name(text) to authenticated;

-- EOF
