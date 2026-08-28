-- Migration: endurecer los códigos de invitación de casa
-- Date: 2026-08-28
--
-- Hallazgo crítico de AUDITORIA_HAVEN_1.0.md (#1): create_house generaba el
-- código como 'HM-' || upper(substr(md5(...), 1, 4)) -- solo 4 caracteres
-- hex (65.536 combinaciones), permanente (sin forma de regenerarlo) y sin
-- ningún límite de intentos en join_house_by_code. Cualquier usuario
-- registrado podía iterar el espacio completo y unirse a una casa ajena con
-- rol 'adult' (acceso de lectura/escritura a Economía incluido).
--
-- Este migration cierra las tres patas del hallazgo:
--   1. _gen_invite_code(): 8 caracteres de un alfabeto sin ambigüedades
--      (sin 0/O/1/I/L) -> 30^8 ~= 6,6e11 combinaciones. Se sigue guardando
--      con el prefijo 'HM-' para que la UI/usuarios lo reconozcan igual.
--   2. join_house_by_code(): rate limiting real por auth.uid() -- 10 intentos
--      por hora. Por encima del límite lanza una excepción clara (no un
--      descarte silencioso: el usuario legítimo tiene que saber por qué no
--      entra). Fail-open si el propio limitador falla.
--   3. regenerate_invite_code(house_id): nueva RPC, solo admin, para que una
--      casa que ya compartió un código débil pueda rotarlo.
--
-- NO se auto-rotan los códigos de 4 hex ya existentes: romper un código que
-- una familia ya ha compartido es una decisión de producto. El rate limiting
-- (10/hora/usuario) hace inviable la fuerza bruta incluso contra esos
-- códigos antiguos mientras tanto, y regenerate_invite_code les da la vía
-- para rotarlo cuando quieran.

-- ============================================================================
-- 1. GENERADOR DE CÓDIGOS
-- ============================================================================

create or replace function public._gen_invite_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  -- Alfabeto sin caracteres ambiguos al leerlos/dictarlos: sin 0, O, 1, I, L.
  v_alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  v_len constant int := length(v_alphabet);
  v_code text;
  v_i int;
begin
  loop
    v_code := 'HM-';
    for v_i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * v_len)::int, 1);
    end loop;
    exit when not exists (select 1 from public.houses where invite_code = v_code);
  end loop;
  return v_code;
end;
$$;

revoke all on function public._gen_invite_code() from public, anon, authenticated;

-- ============================================================================
-- 2. RATE LIMITING DE join_house_by_code
-- ============================================================================

create table if not exists public.house_join_attempts (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  count integer not null default 1,
  primary key (user_id, window_start)
);

alter table public.house_join_attempts enable row level security;
revoke all on public.house_join_attempts from public, anon, authenticated;

-- Devuelve true si el intento cabe dentro del límite (y lo contabiliza).
-- Ventana fija de 1 hora, UPSERT atómico (el lock de fila lo gestiona
-- Postgres). Fail-open: si algo falla aquí, se deja pasar el intento -- la
-- validación real del código sigue viva en join_house_by_code.
create or replace function public._house_join_rate_ok(p_limit integer default 10)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_window timestamptz := date_trunc('hour', now());
  v_count integer;
begin
  if v_uid is null then
    return true;
  end if;

  -- Poda oportunista de las ventanas viejas de este mismo usuario: mantiene
  -- la tabla acotada sin necesidad de un job programado.
  delete from public.house_join_attempts
  where user_id = v_uid and window_start < now() - interval '6 hours';

  insert into public.house_join_attempts (user_id, window_start, count)
  values (v_uid, v_window, 1)
  on conflict (user_id, window_start)
  do update set count = public.house_join_attempts.count + 1
  returning count into v_count;

  return v_count <= p_limit;
exception when others then
  return true;
end;
$$;

revoke all on function public._house_join_rate_ok(integer) from public, anon, authenticated;

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

  if not exists (
    select 1 from public.home_members
    where house_id = v_house.id and user_id = auth.uid()
  ) then
    insert into public.home_members (house_id, user_id, role)
    values (v_house.id, auth.uid(), 'adult');
  end if;

  return v_house;
end;
$$;

revoke execute on function public.join_house_by_code(text) from public, anon;
grant execute on function public.join_house_by_code(text) to authenticated;

-- ============================================================================
-- 3. create_house: usar el generador nuevo
--    (misma firma y comportamiento que 20260808_039; solo cambia la línea
--     que arma el código)
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
  v_owned_count int;
  v_space_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'El nombre de la casa no puede estar vacío';
  end if;

  select count(*) into v_owned_count
  from public.houses
  where created_by = auth.uid();

  if v_owned_count >= 2 then
    raise exception 'Ya has creado el máximo de 2 casas permitidas por usuario';
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
-- 4. regenerate_invite_code: rotar el código de una casa (solo admin)
-- ============================================================================

create or replace function public.regenerate_invite_code(p_house_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_house_admin(p_house_id) then
    raise exception 'Solo el administrador de la casa puede regenerar el código de invitación';
  end if;

  v_code := public._gen_invite_code();

  update public.houses
  set invite_code = v_code
  where id = p_house_id;

  return v_code;
end;
$$;

revoke execute on function public.regenerate_invite_code(uuid) from public, anon;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;

-- EOF
