-- Migration: foto opcional de la casa (onboarding "crear casa")
-- Date: 2026-07-28
--
-- Añade houses.photo como data URL base64, siguiendo exactamente el mismo
-- patrón ya usado por rooms.photo / zones.photo / containers.photo /
-- objects.photo (ver src/services/homeContentService.js) — sin bucket de
-- Storage nuevo, sin URLs firmadas, consistente con cómo el resto de la app
-- guarda fotos pequeñas y opcionales.
--
-- create_house se recrea con un parámetro p_photo opcional. Como añadir un
-- parámetro con default a una función existente crea una sobrecarga en vez
-- de reemplazar la firma, primero se elimina la versión de un solo
-- argumento.

alter table public.houses
  add column if not exists photo text;

drop function if exists public.create_house(text);

create or replace function public.create_house(p_name text, p_photo text default null)
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

  insert into public.houses (name, invite_code, created_by, photo)
  values (trim(p_name), v_code, auth.uid(), p_photo)
  returning * into v_house;

  insert into public.home_members (house_id, user_id, role)
  values (v_house.id, auth.uid(), 'admin');

  return v_house;
end;
$$;

grant execute on function public.create_house(text, text) to authenticated;

-- NOTA: `photo` se añade al final de la lista de columnas de la vista (no
-- entre `invite_code` y `created_by`) porque CREATE OR REPLACE VIEW no
-- permite insertar una columna en medio de las existentes sin "renombrar"
-- las que le siguen (error 42P16).
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
  (select count(*) from public.home_members hm2 where hm2.house_id = h.id) as member_count,
  h.photo
from public.houses h
join public.home_members hm on hm.house_id = h.id and hm.user_id = auth.uid();

-- EOF
