-- Migration: workspace_roles — unifica permisos de Economía en un único
-- rol por Workspace (viewer/contributor/manager/owner), sin crear una
-- tabla nueva por tipo.
--
-- Antes de esto, "acceso a un financial_space" era un booleano resuelto de
-- tres formas distintas según type (owner-only / tabla de miembros / rol de
-- casa) — correcto para "¿puede ver esto?", insuficiente para "¿puede
-- editar cuentas o solo ver movimientos?". Este migration introduce
-- get_workspace_role(), que es la ÚNICA función que sabe que personal /
-- household / shared se resuelven distinto; todo lo demás (RLS, RPCs,
-- pantallas) solo pregunta can_access / can_contribute / can_manage /
-- is_workspace_owner.
--
-- household reutiliza el mecanismo ya en producción (home_members +
-- excepción por miembro) en vez de sincronizar una tabla de membership
-- aparte: home_members.economy_override (boolean) pasa a
-- home_members.economy_role (texto), backfillado 1:1. personal no necesita
-- fila de membership (siempre 1 solo miembro posible, el owner_id). shared
-- ya usaba financial_space_members — solo gana la columna role.

-- ============================================================================
-- COLUMNAS DE ROL
-- ============================================================================

alter table public.home_members
  add column if not exists economy_role text
  check (economy_role in ('none', 'viewer', 'contributor', 'manager', 'owner'));

update public.home_members
set economy_role = case economy_override
  when true then 'contributor'
  when false then 'none'
  else null
end
where economy_role is null and economy_override is not null;

-- economy_override se deja (deprecada, sin lectores nuevos tras este
-- migration) — retirarla es un cleanup aparte, no parte de este cambio.

alter table public.financial_space_members
  add column if not exists role text
  check (role in ('viewer', 'contributor', 'manager', 'owner'));

update public.financial_space_members m
set role = case when m.user_id = s.owner_id then 'owner' else 'manager' end
from public.financial_spaces s
where m.space_id = s.id and m.role is null;

alter table public.financial_space_members alter column role set not null;

-- ============================================================================
-- get_workspace_role — único punto donde personal/household/shared divergen
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

  -- shared: cualquier Workspace creado por un usuario (Lucas & Emma, Viaje...)
  return (
    select role from public.financial_space_members
    where space_id = p_space_id and user_id = p_user_id
  );
end;
$$;

create or replace function public.can_access_financial_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_workspace_role(p_space_id, auth.uid()) is not null;
$$;

create or replace function public.can_contribute_financial_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_workspace_role(p_space_id, auth.uid()) in ('contributor', 'manager', 'owner');
$$;

-- Antes decidía quién puede renombrar/invitar/archivar (owner o house-admin).
-- Ahora es únicamente el umbral de rol "manager+" para operar el día a día
-- del Workspace (cuentas, editar/borrar movimientos de otros); renombrar y
-- archivar pasan a exigir is_workspace_owner (más abajo).
create or replace function public.can_manage_financial_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_workspace_role(p_space_id, auth.uid()) in ('manager', 'owner');
$$;

create or replace function public.is_workspace_owner(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_workspace_role(p_space_id, auth.uid()) = 'owner';
$$;

-- Wrapper para el CALLER (auth.uid()); ahora hay que validar también al
-- invitado (add_financial_space_member) — versión parametrizada por usuario.
create or replace function public.user_can_manage_economy(p_house_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_workspace_role(
    (select id from public.financial_spaces where type = 'household' and house_id = p_house_id),
    p_user_id
  ) in ('contributor', 'manager', 'owner');
$$;

-- house_activity/notifications siguen llamando a esto para filtrar la
-- categoría "finanzas" — mismo nombre y contrato (boolean por house_id),
-- ahora resuelto vía rol en vez de la lógica antigua inline.
create or replace function public.can_manage_economy(p_house_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.can_contribute_financial_space(
    (select id from public.financial_spaces where type = 'household' and house_id = p_house_id)
  );
$$;

grant execute on function public.get_workspace_role(uuid, uuid) to authenticated;
grant execute on function public.can_contribute_financial_space(uuid) to authenticated;
grant execute on function public.is_workspace_owner(uuid) to authenticated;

-- ============================================================================
-- RLS: select (can_access) vs. escritura (can_contribute / can_manage)
-- ============================================================================

drop policy if exists "financial_accounts_rw" on public.financial_accounts;

create policy "financial_accounts_select" on public.financial_accounts
  for select to authenticated
  using (public.can_access_financial_space(financial_space_id));

create policy "financial_accounts_insert" on public.financial_accounts
  for insert to authenticated
  with check (public.can_manage_financial_space(financial_space_id));

create policy "financial_accounts_update" on public.financial_accounts
  for update to authenticated
  using (public.can_manage_financial_space(financial_space_id))
  with check (public.can_manage_financial_space(financial_space_id));

create policy "financial_accounts_delete" on public.financial_accounts
  for delete to authenticated
  using (public.can_manage_financial_space(financial_space_id));

drop policy if exists "economy_expenses_rw" on public.economy_expenses;
create policy "economy_expenses_select" on public.economy_expenses for select to authenticated using (public.can_access_financial_space(financial_space_id));
create policy "economy_expenses_insert" on public.economy_expenses for insert to authenticated with check (public.can_contribute_financial_space(financial_space_id));
create policy "economy_expenses_update" on public.economy_expenses for update to authenticated using (public.can_contribute_financial_space(financial_space_id)) with check (public.can_contribute_financial_space(financial_space_id));
create policy "economy_expenses_delete" on public.economy_expenses for delete to authenticated using (public.can_contribute_financial_space(financial_space_id));

drop policy if exists "economy_income_rw" on public.economy_income;
create policy "economy_income_select" on public.economy_income for select to authenticated using (public.can_access_financial_space(financial_space_id));
create policy "economy_income_insert" on public.economy_income for insert to authenticated with check (public.can_contribute_financial_space(financial_space_id));
create policy "economy_income_update" on public.economy_income for update to authenticated using (public.can_contribute_financial_space(financial_space_id)) with check (public.can_contribute_financial_space(financial_space_id));
create policy "economy_income_delete" on public.economy_income for delete to authenticated using (public.can_contribute_financial_space(financial_space_id));

drop policy if exists "economy_bills_rw" on public.economy_bills;
create policy "economy_bills_select" on public.economy_bills for select to authenticated using (public.can_access_financial_space(financial_space_id));
create policy "economy_bills_insert" on public.economy_bills for insert to authenticated with check (public.can_contribute_financial_space(financial_space_id));
create policy "economy_bills_update" on public.economy_bills for update to authenticated using (public.can_contribute_financial_space(financial_space_id)) with check (public.can_contribute_financial_space(financial_space_id));
create policy "economy_bills_delete" on public.economy_bills for delete to authenticated using (public.can_contribute_financial_space(financial_space_id));

drop policy if exists "economy_goals_rw" on public.economy_goals;
create policy "economy_goals_select" on public.economy_goals for select to authenticated using (public.can_access_financial_space(financial_space_id));
create policy "economy_goals_insert" on public.economy_goals for insert to authenticated with check (public.can_contribute_financial_space(financial_space_id));
create policy "economy_goals_update" on public.economy_goals for update to authenticated using (public.can_contribute_financial_space(financial_space_id)) with check (public.can_contribute_financial_space(financial_space_id));
create policy "economy_goals_delete" on public.economy_goals for delete to authenticated using (public.can_contribute_financial_space(financial_space_id));

-- ============================================================================
-- Transferencias: mover dinero exige poder contribuir, no solo poder ver
-- ============================================================================

create or replace function public.transfer_between_accounts(
  p_from_account_id uuid,
  p_to_account_id uuid,
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
  v_to_space uuid;
begin
  select financial_space_id into v_from_space from public.financial_accounts where id = p_from_account_id;
  select financial_space_id into v_to_space from public.financial_accounts where id = p_to_account_id;

  if v_from_space is null or v_to_space is null then
    raise exception 'Cuenta no encontrada';
  end if;
  if not public.can_contribute_financial_space(v_from_space) then
    raise exception 'No tienes permiso para mover dinero desde esta cuenta';
  end if;
  if not public.can_contribute_financial_space(v_to_space) then
    raise exception 'No tienes permiso para mover dinero a esta cuenta';
  end if;

  return public._execute_financial_transfer(
    p_from_account_id, p_to_account_id, p_amount, p_note,
    case when v_from_space = v_to_space then 'transfer' else 'contribution' end
  );
end;
$$;

create or replace function public.contribute_to_financial_space(
  p_from_account_id uuid,
  p_to_space_id uuid,
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
  v_to_account_id uuid;
begin
  select financial_space_id into v_from_space from public.financial_accounts where id = p_from_account_id;
  if v_from_space is null then
    raise exception 'Cuenta de origen no encontrada';
  end if;
  if not public.can_contribute_financial_space(v_from_space) then
    raise exception 'No tienes permiso para mover dinero desde esta cuenta';
  end if;
  if not public.can_contribute_financial_space(p_to_space_id) then
    raise exception 'No tienes permiso para contribuir a este espacio';
  end if;

  select id into v_to_account_id
  from public.financial_accounts
  where financial_space_id = p_to_space_id and is_default = true;

  if v_to_account_id is null then
    raise exception 'El espacio de destino no tiene una cuenta por defecto';
  end if;

  return public._execute_financial_transfer(
    p_from_account_id, v_to_account_id, p_amount, p_note,
    case when v_from_space = p_to_space_id then 'transfer' else 'contribution' end
  );
end;
$$;

-- ============================================================================
-- Gestión del Workspace: renombrar/archivar = solo Owner; invitar/expulsar =
-- Manager+, salvo que el objetivo sea manager/owner (eso ya exige Owner)
-- ============================================================================

create or replace function public.rename_financial_space(p_space_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'El nombre no puede estar vacío';
  end if;
  if not public.is_workspace_owner(p_space_id) then
    raise exception 'Solo el propietario puede renombrar este espacio';
  end if;

  update public.financial_spaces set name = trim(p_name) where id = p_space_id;
end;
$$;

create or replace function public.archive_financial_space(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_type text;
begin
  select type into v_type from public.financial_spaces where id = p_space_id;
  if not found then
    raise exception 'Espacio no encontrado';
  end if;
  if v_type <> 'shared' then
    raise exception 'Solo los espacios compartidos se pueden archivar (Personal y Household son permanentes)';
  end if;
  if not public.is_workspace_owner(p_space_id) then
    raise exception 'Solo el propietario puede archivar este espacio';
  end if;

  update public.financial_spaces set archived_at = now() where id = p_space_id;
end;
$$;

drop function if exists public.add_financial_space_member(uuid, uuid);
create or replace function public.add_financial_space_member(p_space_id uuid, p_user_id uuid, p_role text default 'contributor')
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.financial_spaces;
begin
  if p_role not in ('viewer', 'contributor', 'manager', 'owner') then
    raise exception 'Rol no válido';
  end if;

  select * into v_space from public.financial_spaces where id = p_space_id;
  if not found then
    raise exception 'Espacio no encontrado';
  end if;
  if v_space.type <> 'shared' then
    raise exception 'Solo se pueden añadir miembros a espacios compartidos';
  end if;
  if not public.can_manage_financial_space(p_space_id) then
    raise exception 'Solo un manager o el propietario puede invitar miembros';
  end if;
  if p_role in ('manager', 'owner') and not public.is_workspace_owner(p_space_id) then
    raise exception 'Solo el propietario puede asignar el rol de manager o owner';
  end if;

  if v_space.house_id is not null then
    if not exists (
      select 1 from public.home_members where house_id = v_space.house_id and user_id = p_user_id
    ) then
      raise exception 'Solo se puede invitar a miembros de la misma casa';
    end if;
    if not public.user_can_manage_economy(v_space.house_id, p_user_id) then
      raise exception 'Este miembro no tiene acceso a Economía en esta casa';
    end if;
  end if;

  insert into public.financial_space_members (space_id, user_id, added_by, role)
  values (p_space_id, p_user_id, auth.uid(), p_role)
  on conflict (space_id, user_id) do update set role = excluded.role;
end;
$$;

create or replace function public.remove_financial_space_member(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.financial_spaces;
  v_target_role text;
begin
  select * into v_space from public.financial_spaces where id = p_space_id;
  if not found then
    raise exception 'Espacio no encontrado';
  end if;
  if v_space.type <> 'shared' then
    raise exception 'Solo los espacios compartidos tienen miembros gestionables';
  end if;
  if p_user_id = v_space.owner_id then
    raise exception 'No se puede eliminar al propietario del espacio';
  end if;
  if not public.can_manage_financial_space(p_space_id) then
    raise exception 'Solo un manager o el propietario puede eliminar miembros';
  end if;

  select role into v_target_role from public.financial_space_members where space_id = p_space_id and user_id = p_user_id;
  if v_target_role in ('manager', 'owner') and not public.is_workspace_owner(p_space_id) then
    raise exception 'Solo el propietario puede eliminar a un manager';
  end if;

  delete from public.financial_space_members where space_id = p_space_id and user_id = p_user_id;
  if not found then
    raise exception 'Miembro no encontrado en el espacio';
  end if;
end;
$$;

create or replace function public.create_shared_financial_space(p_name text, p_house_id uuid, p_icon text default '❤️')
returns public.financial_spaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.financial_spaces;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'El nombre del espacio no puede estar vacío';
  end if;

  if not public.is_house_member(p_house_id) then
    raise exception 'Solo un miembro de la casa puede crear un espacio compartido en ella';
  end if;

  insert into public.financial_spaces (type, visibility, name, icon, owner_id, house_id, created_by)
  values ('shared', 'invite_only', trim(p_name), p_icon, auth.uid(), p_house_id, auth.uid())
  returning * into v_space;

  insert into public.financial_space_members (space_id, user_id, added_by, role)
  values (v_space.id, auth.uid(), auth.uid(), 'owner');

  return v_space;
end;
$$;

grant execute on function public.add_financial_space_member(uuid, uuid, text) to authenticated;

-- ============================================================================
-- set_member_economy_access: mismo RPC, ahora recibe un rol en vez de un booleano
-- ============================================================================

drop function if exists public.set_member_economy_access(uuid, uuid, boolean);

create or replace function public.set_member_economy_access(p_house_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_role is not null and p_role not in ('none', 'viewer', 'contributor', 'manager', 'owner') then
    raise exception 'Rol no válido';
  end if;

  if not public.is_house_admin(p_house_id) then
    raise exception 'Solo el administrador puede cambiar el acceso a Economía';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'No puedes cambiar tu propio acceso a Economía';
  end if;

  update public.home_members
  set economy_role = p_role
  where house_id = p_house_id and user_id = p_user_id;

  if not found then
    raise exception 'Miembro no encontrado';
  end if;
end;
$$;

grant execute on function public.set_member_economy_access(uuid, uuid, text) to authenticated;

-- EOF
