-- Migration: fix NULL-propagation authorization bypass in workspace role checks
-- Date: 2026-08-08
--
-- CRITICAL security audit finding (second independent audit round): when the
-- caller has NO relationship at all to a financial space, get_workspace_role()
-- correctly returns NULL. But is_workspace_owner/can_manage_financial_space/
-- can_contribute_financial_space compared that NULL with `= 'owner'` / `IN
-- (...)`, which in SQL's three-valued logic evaluates to NULL, not false.
-- Every SECURITY DEFINER function that gates a dangerous action with
-- `if not public.is_workspace_owner(...) then raise exception ... end if`
-- silently skipped the exception, because PL/pgSQL treats an IF condition
-- of NULL the same as false -- so "not NULL" (also NULL) never took the
-- RAISE branch, and the action proceeded as if authorized.
--
-- Confirmed empirically exploitable (a user with zero relationship to the
-- target space could, without error) via: delete_shared_financial_space,
-- rename_financial_space, archive_financial_space, add_financial_space_member,
-- remove_financial_space_member, transfer_between_accounts,
-- contribute_to_financial_space, and pay_bill_from_account (all of which
-- call these four helpers and inherit the fix below without needing their
-- own changes).
--
-- Fix: wrap each boolean result in coalesce(..., false), so these functions
-- categorically never return anything other than true/false. This is safe
-- for every existing caller: RLS policies already treated NULL as "deny"
-- (same behavior as false), and PL/pgSQL "IF NOT x" guards now correctly
-- fire on an explicit false instead of silently skipping on NULL.
--
-- can_access_financial_space is NOT changed -- it already used
-- `get_workspace_role(...) IS NOT NULL`, which is always true/false by
-- construction and was never affected by this bug.
-- can_manage_economy is NOT changed directly -- it delegates to
-- can_contribute_financial_space, so it is fixed transitively.

create or replace function public.is_workspace_owner(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_workspace_role(p_space_id, auth.uid()) = 'owner', false);
$$;

create or replace function public.can_manage_financial_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_workspace_role(p_space_id, auth.uid()) in ('manager', 'owner'), false);
$$;

create or replace function public.can_contribute_financial_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_workspace_role(p_space_id, auth.uid()) in ('contributor', 'manager', 'owner'), false);
$$;

create or replace function public.user_can_manage_economy(p_house_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.get_workspace_role(
      (select id from public.financial_spaces where type = 'household' and house_id = p_house_id),
      p_user_id
    ) in ('contributor', 'manager', 'owner'),
    false
  );
$$;

-- EOF
