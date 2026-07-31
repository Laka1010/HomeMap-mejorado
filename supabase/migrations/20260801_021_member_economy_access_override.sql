-- Migration: member_economy_access_override
-- Date: 2026-08-01
--
-- Acceso a Economía era puramente por rol (admin/adult sí, child no).
-- Esto añade una excepción por miembro, sin tocar el rol: el admin puede
-- conceder Economía a un 'child' concreto o revocársela a un 'adult'
-- concreto, sin cambiar nada más de sus permisos. NULL = sigue la regla
-- del rol de siempre; true/false = anula esa regla para ese miembro.
-- can_manage_economy ya gatea las 4 tablas de economía (bills, expenses,
-- income, goals), así que basta con actualizar esa única función.

alter table public.home_members
  add column if not exists economy_override boolean;

create or replace function public.can_manage_economy(p_house_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select economy_override from public.home_members
     where house_id = p_house_id and user_id = auth.uid()),
    exists (
      select 1 from public.home_members
      where house_id = p_house_id and user_id = auth.uid() and role in ('admin', 'adult')
    )
  );
$$;

/** Concede (true), revoca (false) o vuelve a la regla por rol (null) el acceso a Economía de un miembro. Solo el admin puede llamarlo. */
create or replace function public.set_member_economy_access(p_house_id uuid, p_user_id uuid, p_access boolean)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_house_admin(p_house_id) then
    raise exception 'Solo el administrador puede cambiar el acceso a Economía';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'No puedes cambiar tu propio acceso a Economía';
  end if;

  update public.home_members
  set economy_override = p_access
  where house_id = p_house_id and user_id = p_user_id;

  if not found then
    raise exception 'Miembro no encontrado';
  end if;
end;
$$;

grant execute on function public.set_member_economy_access(uuid, uuid, boolean) to authenticated;

-- EOF
