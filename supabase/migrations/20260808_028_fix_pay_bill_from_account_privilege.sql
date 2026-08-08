-- Migration: fix privilege escalation in pay_bill_from_account
-- Date: 2026-08-08
--
-- Security audit finding: pay_bill_from_account (20260803_023_financial_accounts.sql)
-- was never updated when workspace_roles (20260803_024) split "can view" from
-- "can write" (can_access_financial_space vs can_contribute_financial_space).
-- Because this function is SECURITY DEFINER (bypasses RLS), a member with the
-- read-only 'viewer' role could call it directly to create a real expense and
-- mark a bill as paid, moving money out of an account they have no write
-- access to via any other path. Fixed by requiring can_contribute (same
-- threshold already used by pay_bill_via_contribution's underlying call to
-- contribute_to_financial_space).

create or replace function public.pay_bill_from_account(p_bill_id uuid, p_account_id uuid)
returns public.economy_bills
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill public.economy_bills;
  v_account public.financial_accounts;
begin
  select * into v_bill from public.economy_bills where id = p_bill_id;
  if not found then raise exception 'Factura no encontrada'; end if;
  if v_bill.status = 'paid' then raise exception 'La factura ya está pagada'; end if;

  if not public.can_contribute_financial_space(v_bill.financial_space_id) then
    raise exception 'No tienes permiso para pagar facturas de este espacio';
  end if;

  select * into v_account from public.financial_accounts where id = p_account_id;
  if not found then raise exception 'Cuenta no encontrada'; end if;
  if v_account.financial_space_id <> v_bill.financial_space_id then
    raise exception 'La cuenta debe pertenecer al mismo espacio que la factura';
  end if;

  insert into public.economy_expenses (financial_space_id, account_id, created_by, performed_by, name, amount, category, date, description)
  values (v_bill.financial_space_id, p_account_id, auth.uid(), auth.uid(), v_bill.name, v_bill.amount, v_bill.category, current_date, 'Factura: ' || v_bill.name);

  update public.economy_bills
  set status = 'paid', paid_date = current_date, paid_from_account_id = p_account_id
  where id = p_bill_id
  returning * into v_bill;

  return v_bill;
end;
$$;

-- EOF
