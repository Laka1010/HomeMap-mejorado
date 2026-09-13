-- Límite de 5 miembros por casa (independiente del límite de "varias
-- casas por usuario" de 20260913_102, que limita cuántas CASAS puede tener
-- un usuario, no cuánta gente cabe en una). Se aplica solo en
-- join_house_by_code: create_house siempre arranca con 1 miembro (el
-- creador), así que nunca puede chocar con este tope.
--
-- De momento el límite es fijo para todo el mundo, Premium incluido -- no
-- existe todavía ninguna feature key que lo levante. Si en el futuro se
-- pide que Premium permita más miembros, este es el único sitio a tocar
-- (mismo patrón que can_use_premium_feature('multiple_homes') en
-- create_house/join_house_by_code).
create or replace function public.join_house_by_code(p_code text)
returns houses
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_house public.houses;
  v_member_count int;
begin
  if not public._house_join_rate_ok() then
    raise exception 'Demasiados intentos de unirte a una casa. Espera un rato y vuelve a probar.';
  end if;

  select * into v_house from public.houses where invite_code = upper(trim(p_code));
  if not found then
    raise exception 'Código de invitación no válido';
  end if;

  if exists (
    select 1 from public.home_members
    where house_id = v_house.id and user_id = auth.uid()
  ) then
    return v_house;
  end if;

  if exists (select 1 from public.home_members where user_id = auth.uid())
     and not public.can_use_premium_feature('multiple_homes') then
    raise exception 'Ya perteneces a una casa. Hazte Premium para tener más de una.' using errcode = '42501';
  end if;

  select count(*) into v_member_count from public.home_members where house_id = v_house.id;
  if v_member_count >= 5 then
    raise exception 'Esta casa ya tiene el máximo de 5 miembros.';
  end if;

  insert into public.home_members (house_id, user_id, role)
  values (v_house.id, auth.uid(), 'adult');

  return v_house;
end;
$function$;
