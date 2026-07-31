-- Migration: houses, home_members (role per membership), profiles, and access RPCs
-- Date: 2026-07-26
--
-- Replaces the archived 20260725_001_create_roles_permissions.sql (see
-- supabase/migrations/_archive/README.md for why). Roles are stored per
-- membership (home_members.role), not globally per user, so the same person
-- can be admin in one house and a regular member in another.
--
-- All writes to houses/home_members go through SECURITY DEFINER functions
-- below (create_house, join_house_by_code, set_member_role, remove_member).
-- There are intentionally no client-facing INSERT/UPDATE/DELETE policies on
-- those two tables, so every mutation is validated server-side in one place.

create extension if not exists pgcrypto;

-- ============================================================================
-- TABLES
-- ============================================================================

create table if not exists public.houses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.home_members (
  house_id uuid not null references public.houses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'adult' check (role in ('admin', 'adult', 'child')),
  joined_at timestamptz not null default now(),
  primary key (house_id, user_id)
);

create index if not exists home_members_user_id_idx on public.home_members(user_id);
create index if not exists home_members_house_id_idx on public.home_members(house_id);

-- Public, minimal profile info (display name) so members can see each
-- other's names. auth.users is not queryable from the client with the anon
-- key, so this table + trigger mirrors what's needed for the UI.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text,
  created_at timestamptz not null default now()
);

-- ============================================================================
-- PROFILE SYNC (new signups + backfill for existing users)
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
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill profiles for accounts created before this migration existed.
insert into public.profiles (id, display_name, email)
select
  u.id,
  coalesce(
    nullif(trim(concat_ws(' ', u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'surname')), ''),
    split_part(u.email, '@', 1)
  ),
  u.email
from auth.users u
on conflict (id) do nothing;

-- ============================================================================
-- HELPERS (SECURITY DEFINER to avoid RLS self-recursion on home_members)
-- ============================================================================

create or replace function public.is_house_member(p_house_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.home_members
    where house_id = p_house_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_house_admin(p_house_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.home_members
    where house_id = p_house_id and user_id = auth.uid() and role = 'admin'
  );
$$;

-- true if the caller's role in that house is 'admin' or 'adult' (i.e. can
-- see/manage the economy module). Used by economy tables RLS.
create or replace function public.can_manage_economy(p_house_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.home_members
    where house_id = p_house_id and user_id = auth.uid() and role in ('admin', 'adult')
  );
$$;

-- ============================================================================
-- MUTATIONS (the only way to write to houses / home_members)
-- ============================================================================

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

  return v_house;
end;
$$;

create or replace function public.join_house_by_code(p_code text)
returns public.houses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house public.houses;
begin
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

create or replace function public.set_member_role(p_house_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_house_admin(p_house_id) then
    raise exception 'Solo el administrador de la casa puede cambiar roles';
  end if;

  if p_role not in ('adult', 'child') then
    raise exception 'Rol no válido: %', p_role;
  end if;

  if p_user_id = auth.uid() then
    raise exception 'No puedes cambiar tu propio rol';
  end if;

  update public.home_members
  set role = p_role
  where house_id = p_house_id and user_id = p_user_id and role <> 'admin';

  if not found then
    raise exception 'Miembro no encontrado o no se puede modificar el rol del administrador';
  end if;
end;
$$;

create or replace function public.remove_member(p_house_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id <> auth.uid() and not public.is_house_admin(p_house_id) then
    raise exception 'Solo el administrador puede eliminar a otros miembros';
  end if;

  delete from public.home_members
  where house_id = p_house_id and user_id = p_user_id and role <> 'admin';

  if not found then
    raise exception 'No se pudo eliminar (miembro no encontrado o es el administrador)';
  end if;
end;
$$;

-- ============================================================================
-- READ VIEW
-- ============================================================================

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
  (select count(*) from public.home_members hm2 where hm2.house_id = h.id) as member_count
from public.houses h
join public.home_members hm on hm.house_id = h.id and hm.user_id = auth.uid();

-- ============================================================================
-- RLS
-- ============================================================================

alter table public.houses enable row level security;
alter table public.home_members enable row level security;
alter table public.profiles enable row level security;

create policy "houses_select_members" on public.houses
  for select
  to authenticated
  using (public.is_house_member(id));

create policy "home_members_select_same_house" on public.home_members
  for select
  to authenticated
  using (public.is_house_member(house_id));

create policy "profiles_select_authenticated" on public.profiles
  for select
  to authenticated
  using (true);

-- ============================================================================
-- GRANTS
-- ============================================================================

grant select on public.houses to authenticated;
grant select on public.home_members to authenticated;
grant select on public.profiles to authenticated;
grant select on public.my_houses to authenticated;

grant execute on function public.create_house(text) to authenticated;
grant execute on function public.join_house_by_code(text) to authenticated;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.is_house_member(uuid) to authenticated;
grant execute on function public.is_house_admin(uuid) to authenticated;
grant execute on function public.can_manage_economy(uuid) to authenticated;

-- EOF
