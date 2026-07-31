-- Migration: rename_house RPC
-- Date: 2026-07-29
--
-- There was no way to rename an existing house: houses/home_members have no
-- client-facing UPDATE policy (see 20260726_001_houses_members_roles.sql —
-- all writes go through SECURITY DEFINER functions), and no rename function
-- existed either. The Settings screen's "home name" field was silently
-- writing to profiles.language-sibling data instead, never touching
-- public.houses.name, so edits appeared to do nothing.

create or replace function public.rename_house(p_house_id uuid, p_name text)
returns public.houses
language plpgsql
security definer
set search_path = public
as $$
declare
  v_house public.houses;
begin
  if not public.is_house_admin(p_house_id) then
    raise exception 'Solo el administrador de la casa puede cambiar el nombre';
  end if;

  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'El nombre de la casa no puede estar vacío';
  end if;

  update public.houses
  set name = trim(p_name)
  where id = p_house_id
  returning * into v_house;

  if not found then
    raise exception 'Casa no encontrada';
  end if;

  return v_house;
end;
$$;

grant execute on function public.rename_house(uuid, text) to authenticated;

-- EOF
