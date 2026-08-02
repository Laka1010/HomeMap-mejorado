-- Migration: financial_spaces — unified container for Personal / Shared / Household economy
-- Date: 2026-08-03
--
-- Rediseño de Economía alrededor de "Financial Spaces". Un único sistema para
-- los tres tipos (no tres implementaciones distintas):
--
--   - personal  → visibility 'private',      solo el owner (ni el Owner de la casa)
--   - shared    → visibility 'invite_only',   solo los miembros invitados
--   - household → visibility 'house',         igual que hoy (can_manage_economy)
--
-- Todos los movimientos (economy_bills/expenses/income/goals) pasan a
-- apuntar a un financial_space_id en vez de depender directamente de
-- house_id. house_id se conserva en esas 4 tablas como columna derivada
-- (sincronizada por trigger desde financial_spaces.house_id, nunca escrita
-- a mano) para que las queries y pantallas actuales (`.eq("house_id", ...)`)
-- sigan funcionando sin cambios — este migration es puramente aditivo a
-- nivel de UI/servicio, el cambio real de arquitectura ocurre en RLS, que
-- ahora gatea por financial_space_id en vez de house_id directamente.
--
-- Personal y Household se auto-provisionan (uno por usuario / uno por
-- casa, igual que profiles/home_members hoy). Shared se crea a demanda con
-- create_shared_financial_space. No hay policies de INSERT/UPDATE/DELETE
-- directas sobre financial_spaces/financial_space_members — todas las
-- mutaciones pasan por funciones SECURITY DEFINER, mismo patrón que
-- houses/home_members en 20260726_001.

-- ============================================================================
-- TABLES
-- ============================================================================

create table if not exists public.financial_spaces (
  id uuid primary key default gen_random_uuid(),

  type text not null check (type in ('personal', 'shared', 'household')),
  visibility text not null check (visibility in ('private', 'invite_only', 'house')),

  name text not null,
  icon text,

  owner_id uuid not null references auth.users(id) on delete cascade,
  house_id uuid references public.houses(id) on delete cascade,

  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,

  -- visibility es una función de type, pero se guarda aparte (a petición de
  -- diseño) para que RLS/lecturas futuras puedan leerla sin un CASE; este
  -- constraint impide que ambas columnas diverjan.
  constraint financial_spaces_type_visibility_match check (
    (type = 'personal' and visibility = 'private') or
    (type = 'shared' and visibility = 'invite_only') or
    (type = 'household' and visibility = 'house')
  ),
  constraint financial_spaces_household_requires_house check (
    type <> 'household' or house_id is not null
  ),
  constraint financial_spaces_personal_has_no_house check (
    type <> 'personal' or house_id is null
  )
);

-- Un espacio personal por usuario, un espacio household por casa. Shared no
-- tiene límite (varios espacios compartidos pueden convivir en la misma casa).
create unique index if not exists financial_spaces_one_personal_per_owner
  on public.financial_spaces (owner_id) where type = 'personal';
create unique index if not exists financial_spaces_one_household_per_house
  on public.financial_spaces (house_id) where type = 'household';

create index if not exists financial_spaces_house_id_idx on public.financial_spaces(house_id);
create index if not exists financial_spaces_owner_id_idx on public.financial_spaces(owner_id);

drop trigger if exists financial_spaces_set_updated_at on public.financial_spaces;
create trigger financial_spaces_set_updated_at
  before update on public.financial_spaces
  for each row execute function public.economy_set_updated_at();

-- Membership explícita, solo tiene sentido (y solo se usa) para type='shared'.
-- Household deriva su acceso de home_members (ya existente y auditado);
-- Personal no tiene miembros, solo owner_id. Duplicar filas de membership
-- para household sería un segundo sistema a mantener sincronizado con
-- home_members — justo lo que este rediseño busca evitar.
create table if not exists public.financial_space_members (
  space_id uuid not null references public.financial_spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (space_id, user_id)
);

create index if not exists financial_space_members_user_id_idx on public.financial_space_members(user_id);

create or replace function public.financial_space_members_only_shared()
returns trigger
language plpgsql
as $$
declare
  v_type text;
begin
  select type into v_type from public.financial_spaces where id = new.space_id;
  if v_type is distinct from 'shared' then
    raise exception 'Solo los espacios compartidos tienen miembros';
  end if;
  return new;
end;
$$;

drop trigger if exists financial_space_members_only_shared_trg on public.financial_space_members;
create trigger financial_space_members_only_shared_trg
  before insert on public.financial_space_members
  for each row execute function public.financial_space_members_only_shared();

-- ============================================================================
-- PERMISSIONS
-- ============================================================================

-- true si p_user_id puede operar Economía en esa casa: mismo criterio que
-- can_manage_economy (rol admin/adult, con el override por miembro), pero
-- parametrizado por usuario en vez de auth.uid() — lo necesita
-- add_financial_space_member para validar al invitado, no al invitador.
create or replace function public.user_can_manage_economy(p_house_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select economy_override from public.home_members
     where house_id = p_house_id and user_id = p_user_id),
    exists (
      select 1 from public.home_members
      where house_id = p_house_id and user_id = p_user_id and role in ('admin', 'adult')
    )
  );
$$;

-- Regla de acceso (lectura/escritura de movimientos) por tipo de espacio.
-- Este es el único punto donde "Personal / Shared / Household" divergen en
-- permisos — el resto del sistema (tablas, columnas, RLS de movimientos) es
-- idéntico para los tres tipos.
create or replace function public.can_access_financial_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        case s.type
          when 'personal' then s.owner_id = auth.uid()
          when 'shared' then exists (
            select 1 from public.financial_space_members m
            where m.space_id = s.id and m.user_id = auth.uid()
          )
          when 'household' then public.can_manage_economy(s.house_id)
          else false
        end
      from public.financial_spaces s
      where s.id = p_space_id and s.archived_at is null
    ),
    false
  );
$$;

-- Quién puede administrar el espacio en sí (renombrar, invitar/expulsar,
-- archivar): el owner para personal/shared, el admin de la casa para
-- household — igual que hoy gestiona houses/home_members.
create or replace function public.can_manage_financial_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select
        case s.type
          when 'household' then public.is_house_admin(s.house_id)
          else s.owner_id = auth.uid()
        end
      from public.financial_spaces s
      where s.id = p_space_id
    ),
    false
  );
$$;

-- ============================================================================
-- AUTO-PROVISIONING: un Personal space por usuario, un Household space por casa
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    coalesce(
      nullif(trim(concat_ws(' ', new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'surname')), ''),
      split_part(new.email, '@', 1)
    ),
    new.email
  )
  on conflict (id) do nothing;

  insert into public.financial_spaces (type, visibility, name, icon, owner_id, house_id, created_by)
  values ('personal', 'private', 'Personal', '👤', new.id, null, new.id)
  on conflict (owner_id) where type = 'personal' do nothing;

  return new;
end;
$$;

create or replace function public.create_house(p_name text)
returns public.houses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house public.houses;
  v_code text;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'El nombre de la casa no puede estar vacío';
  end if;

  loop
    v_code := 'HM-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    exit when not exists (select 1 from public.houses where invite_code = v_code);
  end loop;

  insert into public.houses (name, invite_code, created_by)
  values (trim(p_name), v_code, auth.uid())
  returning * into v_house;

  insert into public.home_members (house_id, user_id, role)
  values (v_house.id, auth.uid(), 'admin');

  insert into public.financial_spaces (type, visibility, name, icon, owner_id, house_id, created_by)
  values ('household', 'house', 'Hogar', '🏠', auth.uid(), v_house.id, auth.uid());

  return v_house;
end;
$$;

-- Backfill: usuarios y casas creados antes de este migration.
insert into public.financial_spaces (type, visibility, name, icon, owner_id, house_id, created_by)
select 'personal', 'private', 'Personal', '👤', p.id, null, p.id
from public.profiles p
where not exists (
  select 1 from public.financial_spaces s where s.type = 'personal' and s.owner_id = p.id
);

insert into public.financial_spaces (type, visibility, name, icon, owner_id, house_id, created_by)
select 'household', 'house', 'Hogar', '🏠', h.created_by, h.id, h.created_by
from public.houses h
where not exists (
  select 1 from public.financial_spaces s where s.type = 'household' and s.house_id = h.id
);

-- Si un miembro deja la casa (remove_member o expulsión), pierde también su
-- acceso a los shared spaces atados a esa casa — de lo contrario quedaría
-- una fila huérfana en financial_space_members que can_access_financial_space
-- seguiría honrando indefinidamente.
create or replace function public.cleanup_financial_space_membership_on_leave()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.financial_space_members m
  using public.financial_spaces s
  where m.space_id = s.id
    and s.type = 'shared'
    and s.house_id = old.house_id
    and m.user_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists home_members_cleanup_financial_spaces on public.home_members;
create trigger home_members_cleanup_financial_spaces
  after delete on public.home_members
  for each row execute function public.cleanup_financial_space_membership_on_leave();

-- ============================================================================
-- MUTATIONS (shared spaces) — SECURITY DEFINER, mismo patrón que houses
-- ============================================================================

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

  insert into public.financial_space_members (space_id, user_id, added_by)
  values (v_space.id, auth.uid(), auth.uid());

  return v_space;
end;
$$;

create or replace function public.add_financial_space_member(p_space_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.financial_spaces;
begin
  select * into v_space from public.financial_spaces where id = p_space_id;
  if not found then
    raise exception 'Espacio no encontrado';
  end if;
  if v_space.type <> 'shared' then
    raise exception 'Solo se pueden añadir miembros a espacios compartidos';
  end if;
  if not public.can_manage_financial_space(p_space_id) then
    raise exception 'Solo el creador del espacio puede invitar miembros';
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

  insert into public.financial_space_members (space_id, user_id, added_by)
  values (p_space_id, p_user_id, auth.uid())
  on conflict (space_id, user_id) do nothing;
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
    raise exception 'Solo el creador del espacio puede eliminar miembros';
  end if;

  delete from public.financial_space_members where space_id = p_space_id and user_id = p_user_id;
  if not found then
    raise exception 'Miembro no encontrado en el espacio';
  end if;
end;
$$;

create or replace function public.leave_financial_space(p_space_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.financial_spaces;
begin
  select * into v_space from public.financial_spaces where id = p_space_id;
  if not found then
    raise exception 'Espacio no encontrado';
  end if;
  if v_space.type <> 'shared' then
    raise exception 'Solo se puede abandonar un espacio compartido';
  end if;
  if auth.uid() = v_space.owner_id then
    raise exception 'El propietario no puede abandonar el espacio; archívalo en su lugar';
  end if;

  delete from public.financial_space_members where space_id = p_space_id and user_id = auth.uid();
  if not found then
    raise exception 'No perteneces a este espacio';
  end if;
end;
$$;

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
  if not public.can_manage_financial_space(p_space_id) then
    raise exception 'No tienes permiso para renombrar este espacio';
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
  if not public.can_manage_financial_space(p_space_id) then
    raise exception 'No tienes permiso para archivar este espacio';
  end if;

  update public.financial_spaces set archived_at = now() where id = p_space_id;
end;
$$;

-- ============================================================================
-- READ VIEW — todos los espacios accesibles por el usuario, de un vistazo
-- ============================================================================

create or replace view public.my_financial_spaces
with (security_invoker = true)
as
select
  s.id, s.type, s.visibility, s.name, s.icon,
  s.owner_id, s.house_id, s.created_by, s.created_at, s.updated_at,
  (s.owner_id = auth.uid()) as is_owner
from public.financial_spaces s
where s.archived_at is null
  and (
    (s.type = 'personal' and s.owner_id = auth.uid())
    or (s.type = 'shared' and exists (
      select 1 from public.financial_space_members m
      where m.space_id = s.id and m.user_id = auth.uid()
    ))
    or (s.type = 'household' and public.can_manage_economy(s.house_id))
  );

-- ============================================================================
-- MOVEMENTS: economy_bills / economy_expenses / economy_income / economy_goals
-- pasan a apuntar a un financial_space_id. house_id se conserva pero se
-- convierte en una columna derivada (sincronizada por trigger), nunca
-- fuente de verdad de permisos — RLS ahora gatea por financial_space_id.
-- ============================================================================

alter table public.economy_bills add column if not exists financial_space_id uuid references public.financial_spaces(id) on delete cascade;
alter table public.economy_expenses add column if not exists financial_space_id uuid references public.financial_spaces(id) on delete cascade;
alter table public.economy_income add column if not exists financial_space_id uuid references public.financial_spaces(id) on delete cascade;
alter table public.economy_goals add column if not exists financial_space_id uuid references public.financial_spaces(id) on delete cascade;

update public.economy_bills b set financial_space_id = s.id
from public.financial_spaces s
where s.type = 'household' and s.house_id = b.house_id and b.financial_space_id is null;

update public.economy_expenses e set financial_space_id = s.id
from public.financial_spaces s
where s.type = 'household' and s.house_id = e.house_id and e.financial_space_id is null;

update public.economy_income i set financial_space_id = s.id
from public.financial_spaces s
where s.type = 'household' and s.house_id = i.house_id and i.financial_space_id is null;

update public.economy_goals g set financial_space_id = s.id
from public.financial_spaces s
where s.type = 'household' and s.house_id = g.house_id and g.financial_space_id is null;

alter table public.economy_bills alter column financial_space_id set not null;
alter table public.economy_expenses alter column financial_space_id set not null;
alter table public.economy_income alter column financial_space_id set not null;
alter table public.economy_goals alter column financial_space_id set not null;

-- house_id deja de ser obligatorio: los movimientos de un espacio personal o
-- compartido sin casa asociada no tienen uno.
alter table public.economy_bills alter column house_id drop not null;
alter table public.economy_expenses alter column house_id drop not null;
alter table public.economy_income alter column house_id drop not null;
alter table public.economy_goals alter column house_id drop not null;

create index if not exists economy_bills_financial_space_id_idx on public.economy_bills(financial_space_id);
create index if not exists economy_expenses_financial_space_id_idx on public.economy_expenses(financial_space_id);
create index if not exists economy_income_financial_space_id_idx on public.economy_income(financial_space_id);
create index if not exists economy_goals_financial_space_id_idx on public.economy_goals(financial_space_id);

create or replace function public.economy_sync_house_id()
returns trigger
language plpgsql
as $$
begin
  select house_id into new.house_id
  from public.financial_spaces
  where id = new.financial_space_id;
  return new;
end;
$$;

drop trigger if exists economy_bills_sync_house_id on public.economy_bills;
create trigger economy_bills_sync_house_id
  before insert or update of financial_space_id on public.economy_bills
  for each row execute function public.economy_sync_house_id();

drop trigger if exists economy_expenses_sync_house_id on public.economy_expenses;
create trigger economy_expenses_sync_house_id
  before insert or update of financial_space_id on public.economy_expenses
  for each row execute function public.economy_sync_house_id();

drop trigger if exists economy_income_sync_house_id on public.economy_income;
create trigger economy_income_sync_house_id
  before insert or update of financial_space_id on public.economy_income
  for each row execute function public.economy_sync_house_id();

drop trigger if exists economy_goals_sync_house_id on public.economy_goals;
create trigger economy_goals_sync_house_id
  before insert or update of financial_space_id on public.economy_goals
  for each row execute function public.economy_sync_house_id();

-- RLS: gatea por financial_space_id (can_access_financial_space), no ya
-- directamente por house_id. can_manage_economy sigue viva y sigue siendo
-- la regla para spaces type='household' (incluyendo economy_override).
drop policy if exists "economy_bills_rw" on public.economy_bills;
create policy "economy_bills_rw" on public.economy_bills
  for all
  to authenticated
  using (public.can_access_financial_space(financial_space_id))
  with check (public.can_access_financial_space(financial_space_id));

drop policy if exists "economy_expenses_rw" on public.economy_expenses;
create policy "economy_expenses_rw" on public.economy_expenses
  for all
  to authenticated
  using (public.can_access_financial_space(financial_space_id))
  with check (public.can_access_financial_space(financial_space_id));

drop policy if exists "economy_income_rw" on public.economy_income;
create policy "economy_income_rw" on public.economy_income
  for all
  to authenticated
  using (public.can_access_financial_space(financial_space_id))
  with check (public.can_access_financial_space(financial_space_id));

drop policy if exists "economy_goals_rw" on public.economy_goals;
create policy "economy_goals_rw" on public.economy_goals
  for all
  to authenticated
  using (public.can_access_financial_space(financial_space_id))
  with check (public.can_access_financial_space(financial_space_id));

-- ============================================================================
-- RLS + GRANTS — financial_spaces / financial_space_members
-- ============================================================================

alter table public.financial_spaces enable row level security;
alter table public.financial_space_members enable row level security;

create policy "financial_spaces_select" on public.financial_spaces
  for select
  to authenticated
  using (public.can_access_financial_space(id));

create policy "financial_space_members_select" on public.financial_space_members
  for select
  to authenticated
  using (public.can_access_financial_space(space_id));

grant select on public.financial_spaces to authenticated;
grant select on public.financial_space_members to authenticated;
grant select on public.my_financial_spaces to authenticated;

grant execute on function public.user_can_manage_economy(uuid, uuid) to authenticated;
grant execute on function public.can_access_financial_space(uuid) to authenticated;
grant execute on function public.can_manage_financial_space(uuid) to authenticated;
grant execute on function public.create_shared_financial_space(text, uuid, text) to authenticated;
grant execute on function public.add_financial_space_member(uuid, uuid) to authenticated;
grant execute on function public.remove_financial_space_member(uuid, uuid) to authenticated;
grant execute on function public.leave_financial_space(uuid) to authenticated;
grant execute on function public.rename_financial_space(uuid, text) to authenticated;
grant execute on function public.archive_financial_space(uuid) to authenticated;

-- EOF
