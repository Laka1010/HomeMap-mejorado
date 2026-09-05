-- Migration: child financial spaces — un espacio de Economía propio para un
-- miembro con rol 'child', creado y supervisado por el admin de la casa.
-- Date: 2026-09-05
--
-- CONTEXTO
-- Hoy un miembro 'child' no ve la pestaña Economía en absoluto (App.jsx:
-- `canSeeEconomy = !activeHome || activeHome.myRole !== "child"`). No hay
-- forma de que un niño lleve el control de su propio dinero.
--
-- QUÉ SE HACE
-- Un cuarto `type` de financial_spaces: 'child'. Un único punto de
-- divergencia nuevo en get_workspace_role (mismo patrón que personal /
-- shared / household):
--   - el niño (owner_id) resuelve a 'contributor' — gestiona SUS movimientos
--   - el admin de la casa resuelve a 'viewer' — supervisa en solo lectura
--   - cualquier otro: sin acceso
-- El resto del sistema (RLS de movimientos/cuentas/transferencias, la vista
-- my_financial_spaces, can_access/can_contribute/...) hereda el comportamiento
-- sin cambios porque todo deriva de get_workspace_role.
--
-- Mutaciones (crear / renombrar / archivar / enviar dinero) por RPC
-- SECURITY DEFINER gateada con is_house_admin(), mismo patrón que
-- create_shared_financial_space y las 7 RPC de administración de casa. El
-- guard de cuentas suspendidas ya vive dentro de is_house_admin() y de
-- can_contribute_financial_space() (20260808_054/055), así que estas RPC lo
-- heredan sin comprobarlo a mano.
--
-- REVERSIBLE: reaplicar get_workspace_role / my_financial_spaces de
-- 20260808_042, hacer drop de las 4 RPC nuevas + el trigger + los índices,
-- y restaurar los 3 constraints al set {personal, shared, household}.

-- ============================================================================
-- 1. ESQUEMA financial_spaces — admitir type = 'child'
-- ============================================================================

alter table public.financial_spaces drop constraint if exists financial_spaces_type_check;
alter table public.financial_spaces
  add constraint financial_spaces_type_check
  check (type in ('personal', 'shared', 'household', 'child'));

alter table public.financial_spaces drop constraint if exists financial_spaces_type_visibility_match;
alter table public.financial_spaces
  add constraint financial_spaces_type_visibility_match check (
    (type = 'personal' and visibility = 'private') or
    (type = 'shared' and visibility = 'invite_only') or
    (type = 'household' and visibility = 'house') or
    (type = 'child' and visibility = 'invite_only')
  );

alter table public.financial_spaces drop constraint if exists financial_spaces_household_requires_house;
alter table public.financial_spaces
  add constraint financial_spaces_household_requires_house check (
    type not in ('household', 'child') or house_id is not null
  );

-- financial_spaces_personal_has_no_house se mantiene sin cambios (child != personal).

-- Un espacio child ACTIVO por (casa, niño). Se excluyen los archivados para
-- que, si el admin archiva el espacio de un niño, pueda crearle otro después.
-- El duplicado se traduce a un mensaje legible en create_child_financial_space.
create unique index if not exists financial_spaces_one_child_per_member
  on public.financial_spaces (house_id, owner_id)
  where type = 'child' and archived_at is null;

-- Los espacios child NO usan financial_space_members (igual que personal):
-- el rol se deriva de owner_id + rol de casa. No se toca el trigger
-- financial_space_members_only_shared.

-- ============================================================================
-- 2. get_workspace_role — rama 'child' (basada en la versión de 20260808_042)
-- ============================================================================

create or replace function public.get_workspace_role(p_space_id uuid, p_user_id uuid default auth.uid())
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_type text;
  v_house_id uuid;
  v_owner_id uuid;
  v_role_override text;
  v_house_role text;
begin
  select type, house_id, owner_id into v_type, v_house_id, v_owner_id
  from public.financial_spaces
  where id = p_space_id and archived_at is null;

  if v_type is null then
    return null;
  end if;

  if v_type = 'personal' then
    if v_owner_id = p_user_id then
      return 'owner';
    end if;
    if public.has_accepted_economy_access(v_owner_id, p_user_id) then
      return 'viewer';
    end if;
    return null;
  end if;

  if v_type = 'child' then
    -- El niño gestiona lo suyo; el admin de la casa lo supervisa en lectura.
    if v_owner_id = p_user_id then
      return 'contributor';
    end if;
    if exists (
      select 1 from public.home_members
      where house_id = v_house_id and user_id = p_user_id and role = 'admin'
    ) then
      return 'viewer';
    end if;
    return null;
  end if;

  if v_type = 'household' then
    select economy_role, role into v_role_override, v_house_role
    from public.home_members
    where house_id = v_house_id and user_id = p_user_id;

    if v_role_override is not null then
      return nullif(v_role_override, 'none');
    end if;

    return case v_house_role
      when 'admin' then 'manager'
      when 'adult' then 'contributor'
      else null
    end;
  end if;

  -- shared
  return (
    select role from public.financial_space_members
    where space_id = p_space_id and user_id = p_user_id
  );
end;
$$;

grant execute on function public.get_workspace_role(uuid, uuid) to authenticated;
revoke execute on function public.get_workspace_role(uuid, uuid) from public, anon;

-- ============================================================================
-- 3. my_financial_spaces — incluir los espacios child visibles + my_role
-- ============================================================================

drop view if exists public.my_financial_spaces;

create view public.my_financial_spaces
with (security_invoker = true)
as
select
  s.id, s.type, s.visibility, s.name, s.icon,
  s.owner_id, s.house_id, s.created_by, s.created_at, s.updated_at,
  (s.owner_id = auth.uid()) as is_owner,
  public.get_workspace_role(s.id, auth.uid()) as my_role
from public.financial_spaces s
where s.archived_at is null
  and (
    (s.type = 'personal' and (
      s.owner_id = auth.uid()
      or public.has_accepted_economy_access(s.owner_id, auth.uid())
    ))
    or (s.type = 'shared' and exists (
      select 1 from public.financial_space_members m
      where m.space_id = s.id and m.user_id = auth.uid()
    ))
    or (s.type = 'household' and public.can_manage_economy(s.house_id))
    or (s.type = 'child' and (
      s.owner_id = auth.uid()
      or exists (
        select 1 from public.home_members
        where house_id = s.house_id and user_id = auth.uid() and role = 'admin'
      )
    ))
  );

grant select on public.my_financial_spaces to authenticated;

-- ============================================================================
-- 4. RPCs — crear / renombrar / archivar / enviar dinero (solo admin de casa)
-- ============================================================================

-- Crea el espacio de economía de un niño de la casa, con su cuenta por
-- defecto (misma mecánica que create_shared_financial_space).
create or replace function public.create_child_financial_space(
  p_child_user_id uuid,
  p_house_id uuid,
  p_name text,
  p_icon text default '🧒'
)
returns public.financial_spaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.financial_spaces;
  v_currency text;
  v_child_role text;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'El nombre del espacio no puede estar vacío';
  end if;

  if not public.is_house_admin(p_house_id) then
    raise exception 'Solo el administrador de la casa puede crear un espacio de economía para un miembro';
  end if;

  if p_child_user_id = auth.uid() then
    raise exception 'No puedes crear un espacio de este tipo para ti mismo';
  end if;

  select role into v_child_role
  from public.home_members
  where house_id = p_house_id and user_id = p_child_user_id;

  if v_child_role is null then
    raise exception 'Ese usuario no es miembro de esta casa';
  end if;
  if v_child_role = 'admin' then
    raise exception 'No se puede crear un espacio supervisado para un administrador';
  end if;

  if exists (
    select 1 from public.financial_spaces
    where type = 'child' and house_id = p_house_id and owner_id = p_child_user_id
      and archived_at is null
  ) then
    raise exception 'Este miembro ya tiene un espacio de economía en esta casa';
  end if;

  insert into public.financial_spaces (type, visibility, name, icon, owner_id, house_id, created_by)
  values ('child', 'invite_only', trim(p_name), coalesce(p_icon, '🧒'), p_child_user_id, p_house_id, auth.uid())
  returning * into v_space;

  select currency_code into v_currency from public.houses where id = p_house_id;

  insert into public.financial_accounts (financial_space_id, name, icon, color, type, currency_code, is_default, created_by)
  values (v_space.id, 'Mi hucha', '🐷', '#F59E0B', 'cash', coalesce(v_currency, 'EUR'), true, auth.uid());

  return v_space;
end;
$$;

-- Envía dinero (paga) desde una cuenta del adulto a la cuenta por defecto
-- del espacio del niño. El admin de la casa es solo 'viewer' en ese espacio,
-- así que contribute_to_financial_space lo rechazaría — de ahí esta RPC
-- dedicada, gateada por is_house_admin del destino.
create or replace function public.fund_child_financial_space(
  p_from_account_id uuid,
  p_child_space_id uuid,
  p_amount numeric,
  p_note text default null
)
returns public.financial_transfers
language plpgsql
security definer
set search_path = public
as $$
declare
  v_from_space uuid;
  v_child public.financial_spaces;
  v_to_account_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'El importe debe ser mayor que 0';
  end if;

  select financial_space_id into v_from_space
  from public.financial_accounts where id = p_from_account_id;
  if v_from_space is null then
    raise exception 'Cuenta de origen no encontrada';
  end if;
  if not public.can_contribute_financial_space(v_from_space) then
    raise exception 'No tienes permiso para mover dinero desde esta cuenta';
  end if;

  select * into v_child from public.financial_spaces
  where id = p_child_space_id and archived_at is null;
  if not found or v_child.type <> 'child' then
    raise exception 'Espacio de destino no válido';
  end if;
  if not public.is_house_admin(v_child.house_id) then
    raise exception 'Solo el administrador de la casa puede enviar dinero a este espacio';
  end if;

  select id into v_to_account_id
  from public.financial_accounts
  where financial_space_id = p_child_space_id and is_default = true;
  if v_to_account_id is null then
    raise exception 'El espacio de destino no tiene una cuenta por defecto';
  end if;

  return public._execute_financial_transfer(
    p_from_account_id, v_to_account_id, p_amount, p_note, 'contribution'
  );
end;
$$;

create or replace function public.rename_child_financial_space(p_space_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.financial_spaces;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'El nombre no puede estar vacío';
  end if;

  select * into v_space from public.financial_spaces where id = p_space_id;
  if not found or v_space.type <> 'child' then
    raise exception 'Espacio no encontrado';
  end if;
  if not public.is_house_admin(v_space.house_id) then
    raise exception 'Solo el administrador de la casa puede renombrar este espacio';
  end if;

  update public.financial_spaces set name = trim(p_name) where id = p_space_id;
end;
$$;

create or replace function public.archive_child_financial_space(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.financial_spaces;
begin
  select * into v_space from public.financial_spaces where id = p_space_id;
  if not found or v_space.type <> 'child' then
    raise exception 'Espacio no encontrado';
  end if;
  if not public.is_house_admin(v_space.house_id) then
    raise exception 'Solo el administrador de la casa puede archivar este espacio';
  end if;

  update public.financial_spaces set archived_at = now()
  where id = p_space_id and archived_at is null;
end;
$$;

revoke execute on function public.create_child_financial_space(uuid, uuid, text, text) from public, anon;
revoke execute on function public.fund_child_financial_space(uuid, uuid, numeric, text) from public, anon;
revoke execute on function public.rename_child_financial_space(uuid, text) from public, anon;
revoke execute on function public.archive_child_financial_space(uuid) from public, anon;

grant execute on function public.create_child_financial_space(uuid, uuid, text, text) to authenticated;
grant execute on function public.fund_child_financial_space(uuid, uuid, numeric, text) to authenticated;
grant execute on function public.rename_child_financial_space(uuid, text) to authenticated;
grant execute on function public.archive_child_financial_space(uuid) to authenticated;

-- ============================================================================
-- 5. Limpieza al salir de la casa — mismo patrón que
--    cleanup_financial_space_membership_on_leave / economy_access_revoke_on_leave
-- ============================================================================

create or replace function public.archive_child_spaces_on_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.financial_spaces set archived_at = now()
  where type = 'child'
    and house_id = old.house_id
    and owner_id = old.user_id
    and archived_at is null;
  return old;
end;
$$;

revoke execute on function public.archive_child_spaces_on_leave() from public, anon;

drop trigger if exists home_members_archive_child_spaces on public.home_members;
create trigger home_members_archive_child_spaces
  after delete on public.home_members
  for each row execute function public.archive_child_spaces_on_leave();

-- EOF
