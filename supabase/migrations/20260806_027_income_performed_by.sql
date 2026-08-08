-- economy_income was missing the performed_by column that economy_expenses has.
-- The movement form sends performed_by for both income and expenses, so inserting
-- an income row was failing silently (unknown column) and nothing appeared in the list.
alter table public.economy_income
  add column if not exists performed_by uuid references auth.users(id) on delete set null;
