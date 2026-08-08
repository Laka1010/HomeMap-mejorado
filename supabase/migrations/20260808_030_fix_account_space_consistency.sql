-- Migration: enforce account_id belongs to the same financial_space_id
-- Date: 2026-08-08
--
-- CRITICAL security audit finding: economy_expenses/economy_income had no
-- constraint or trigger checking that account_id actually belongs to the
-- row's own financial_space_id. RLS on INSERT/UPDATE only validates
-- financial_space_id via can_contribute_financial_space(financial_space_id)
-- -- since every user always has at least their own Personal space (where
-- they're always owner/contributor), an attacker could insert a row with
-- financial_space_id = a space they legitimately control, but
-- account_id = an arbitrary financial_accounts.id belonging to someone
-- else's account (learned e.g. as a 'viewer' of a shared space, or from a
-- stale UUID). The unconditional AFTER trigger economy_adjust_account_balance
-- then mutates that victim account's balance with no space check at all --
-- a real cross-tenant financial write via ID manipulation.
--
-- Fix: a BEFORE INSERT/UPDATE trigger that rejects any row whose account_id
-- doesn't belong to its own financial_space_id. Runs after the existing
-- "10_resolve_space" (resolves financial_space_id) and "20_default_account"
-- (fills empty account_id) triggers thanks to the "30" name prefix, so it
-- always sees final values.
--
-- Also applied to economy_bills.paid_from_account_id for defense in depth:
-- it doesn't drive the balance trigger, but a raw client UPDATE could still
-- set it to an unrelated account's id, which is a data-integrity issue even
-- if not a balance-manipulation one.

create or replace function public.economy_validate_account_space()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.account_id is not null then
    if not exists (
      select 1 from public.financial_accounts
      where id = new.account_id and financial_space_id = new.financial_space_id
    ) then
      raise exception 'La cuenta no pertenece a este espacio financiero';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists economy_expenses_30_validate_account_space on public.economy_expenses;
create trigger economy_expenses_30_validate_account_space
  before insert or update of account_id, financial_space_id on public.economy_expenses
  for each row execute function public.economy_validate_account_space();

drop trigger if exists economy_income_30_validate_account_space on public.economy_income;
create trigger economy_income_30_validate_account_space
  before insert or update of account_id, financial_space_id on public.economy_income
  for each row execute function public.economy_validate_account_space();

-- economy_bills: same idea for paid_from_account_id, but that column is
-- nullable and not tied to financial_space_id in the function above (which
-- reads NEW.account_id) -- use a small dedicated function instead.
create or replace function public.economy_bills_validate_paid_from_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.paid_from_account_id is not null then
    if not exists (
      select 1 from public.financial_accounts
      where id = new.paid_from_account_id and financial_space_id = new.financial_space_id
    ) then
      raise exception 'La cuenta de pago no pertenece a este espacio financiero';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists economy_bills_30_validate_paid_from_account on public.economy_bills;
create trigger economy_bills_30_validate_paid_from_account
  before insert or update of paid_from_account_id, financial_space_id on public.economy_bills
  for each row execute function public.economy_bills_validate_paid_from_account();

-- EOF
