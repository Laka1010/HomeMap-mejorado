-- Migration: create_house(text, text) must provision the Household financial space
-- Date: 2026-08-08
--
-- Functional bug found while black-box testing the second security audit:
-- src/services/houseService.js:22 always calls create_house with both
-- p_name and p_photo (even when photo is null), so the app only ever hits
-- the 2-argument overload. That overload was last redefined by
-- 20260731_016_max_houses_per_user.sql (to add the 2-house cap) -- which
-- predates Financial Spaces (20260803_022/023) -- and was never updated
-- afterwards. Only the unused 1-argument overload (redefined by 023) got
-- the financial_spaces + financial_accounts provisioning that
-- 20260803_022's migration comment describes as automatic for every new
-- house. Net effect: every house created via the real app has no Household
-- Economy space and no default "Cuenta Común" account.
--
-- Fix: bring the 2-arg overload in line with the 1-arg one, keeping the
-- 2-house cap and photo handling this overload is specifically for.

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
  v_space_id uuid;
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

  insert into public.financial_spaces (type, visibility, name, icon, owner_id, house_id, created_by)
  values ('household', 'house', 'Hogar', '🏠', auth.uid(), v_house.id, auth.uid())
  returning id into v_space_id;

  insert into public.financial_accounts (financial_space_id, name, icon, color, type, currency_code, is_default, created_by)
  values (v_space_id, 'Cuenta Común', '🏦', '#6366F1', 'bank', v_house.currency_code, true, auth.uid());

  return v_house;
end;
$$;

-- EOF
