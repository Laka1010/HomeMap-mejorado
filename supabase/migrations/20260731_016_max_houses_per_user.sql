-- Migration: cap houses created per user at 2
-- Date: 2026-07-31
--
-- create_house es la única vía de escritura sobre houses (ver
-- 20260726_001_houses_members_roles.sql: no hay policies de INSERT en el
-- cliente), así que el límite vive aquí y no puede saltarse desde fuera de
-- la app. Cuenta solo las casas creadas por el usuario (created_by), no las
-- que se han unido por código.

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

  loop
    v_code := 'HM-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4));
    exit when not exists (select 1 from public.houses where invite_code = v_code);
  end loop;

  insert into public.houses (name, invite_code, created_by, photo)
  values (trim(p_name), v_code, auth.uid(), p_photo)
  returning * into v_house;

  insert into public.home_members (house_id, user_id, role)
  values (v_house.id, auth.uid(), 'admin');

  return v_house;
end;
$$;

grant execute on function public.create_house(text, text) to authenticated;

-- EOF
