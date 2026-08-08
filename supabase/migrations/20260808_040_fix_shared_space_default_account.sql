-- Migration: create_shared_financial_space must provision a default account
-- Date: 2026-08-08
--
-- Functional bug found while black-box testing the second security audit:
-- 20260803_023_financial_accounts.sql's create_shared_financial_space did
-- create a default "Cuenta compartida" account for the new space, but
-- 20260803_024_workspace_roles.sql redefined the function again (to switch
-- the creator's membership row to role='owner' instead of the old implicit
-- ownership model) and dropped the account-creation step in the process.
-- Every shared Workspace created since then has zero accounts, breaking
-- contribute/transfer into it until someone manually adds one.
--
-- Fix: bring back the default account insert, keeping 024's role='owner'
-- membership logic.

create or replace function public.create_shared_financial_space(p_name text, p_house_id uuid, p_icon text default '❤️')
returns public.financial_spaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_space public.financial_spaces;
  v_currency text;
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

  select currency_code into v_currency from public.houses where id = p_house_id;

  insert into public.financial_accounts (financial_space_id, name, icon, color, type, currency_code, is_default, created_by)
  values (v_space.id, 'Cuenta compartida', '💳', '#EC4899', 'card', coalesce(v_currency, 'EUR'), true, auth.uid());

  return v_space;
end;
$$;

-- EOF
