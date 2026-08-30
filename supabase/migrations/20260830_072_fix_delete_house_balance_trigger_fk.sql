-- Migration: fix delete_house / delete_shared_financial_space crash
-- Date: 2026-08-30
--
-- Bug: al eliminar una casa (botón "Eliminar casa" -> RPC delete_house, que
-- hace `delete from houses` y deja que la cascada limpie todo) Postgres
-- aborta con:
--
--   insert or update on table "financial_accounts" violates foreign key
--   constraint "financial_accounts_financial_space_id_fkey"
--
-- Causa: la cascada borra las filas de `financial_spaces` ANTES que las de
-- `economy_expenses` / `economy_income` (orden de creación de los FKs:
-- economy_* -> financial_spaces es de 20260803_022, financial_accounts ->
-- financial_spaces es de 20260803_023, y houses -> financial_spaces también
-- corre antes). Cuando la cascada llega a borrar cada gasto/ingreso, el
-- trigger AFTER DELETE `economy_adjust_account_balance` lanza:
--
--   update public.financial_accounts set balance = balance - ... where id = old.account_id
--
-- Esa fila de `financial_accounts` todavía existe (su propia cascada aún no
-- ha corrido) pero su `financial_space_id` ya apunta a un espacio borrado,
-- así que el UPDATE dispara la revalidación del FK y falla. Resultado: la
-- casa no se puede eliminar nunca si tiene algún movimiento de economía.
--
-- Fix: en la rama DELETE del trigger, ajustar el saldo solo si el espacio
-- financiero de la cuenta sigue existiendo. Si se está borrando en cascada
-- (casa o espacio compartido), la cuenta y su saldo desaparecen de todas
-- formas, así que saltarse el ajuste es correcto. Un borrado normal de un
-- único gasto/ingreso no se ve afectado (su espacio sigue vivo).

create or replace function public.economy_adjust_account_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sign numeric := case TG_ARGV[0] when 'income' then 1 else -1 end;
begin
  if TG_OP = 'INSERT' then
    update public.financial_accounts set balance = balance + v_sign * new.amount where id = new.account_id;
    return new;
  elsif TG_OP = 'UPDATE' then
    if old.account_id is distinct from new.account_id then
      update public.financial_accounts set balance = balance - v_sign * old.amount where id = old.account_id;
      update public.financial_accounts set balance = balance + v_sign * new.amount where id = new.account_id;
    elsif old.amount is distinct from new.amount then
      update public.financial_accounts set balance = balance + v_sign * (new.amount - old.amount) where id = new.account_id;
    end if;
    return new;
  elsif TG_OP = 'DELETE' then
    update public.financial_accounts a
    set balance = balance - v_sign * old.amount
    where a.id = old.account_id
      and exists (select 1 from public.financial_spaces s where s.id = a.financial_space_id);
    return old;
  end if;
  return null;
end;
$$;

-- EOF
