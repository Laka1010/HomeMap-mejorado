-- La feature "varias casas" (can_use_premium_feature('multiple_homes'))
-- hasta ahora dejaba a un usuario Premium crear/unirse a casas SIN límite
-- una vez pasado el tope de 1 de los usuarios FREE. El producto es: FREE
-- se queda en 1 casa, Premium sube a un máximo de 3 (la "gratis" + 2 más),
-- nunca ilimitado. Mismo patrón en las dos funciones: contar cuántas casas
-- tiene ya el usuario en vez de solo comprobar si tiene alguna.
create or replace function public.create_house(p_name text, p_photo text default null::text)
returns houses
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_house public.houses;
  v_code text;
  v_space_id uuid;
  v_home_count int;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'El nombre de la casa no puede estar vacío';
  end if;

  select count(*) into v_home_count from public.home_members where user_id = auth.uid();

  if v_home_count >= 1 and not public.can_use_premium_feature('multiple_homes') then
    raise exception 'Ya perteneces a una casa. Hazte Premium para tener más de una.' using errcode = '42501';
  end if;

  if v_home_count >= 3 then
    raise exception 'Ya perteneces al máximo de 3 casas.';
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
$function$;

create or replace function public.join_house_by_code(p_code text)
returns houses
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_house public.houses;
  v_member_count int;
  v_home_count int;
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

  select count(*) into v_home_count from public.home_members where user_id = auth.uid();

  if v_home_count >= 1 and not public.can_use_premium_feature('multiple_homes') then
    raise exception 'Ya perteneces a una casa. Hazte Premium para tener más de una.' using errcode = '42501';
  end if;

  if v_home_count >= 3 then
    raise exception 'Ya perteneces al máximo de 3 casas.';
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
