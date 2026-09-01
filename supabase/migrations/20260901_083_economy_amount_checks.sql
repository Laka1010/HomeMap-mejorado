-- Migration: los importes de gastos, ingresos y facturas deben ser positivos
-- (hallazgo M-2 de la auditoría)
-- Date: 2026-09-01
--
-- financial_transfers.amount ya tenía `check (amount > 0)` y
-- economy_goals.target_amount también, pero economy_expenses.amount,
-- economy_income.amount y economy_bills.amount no tenían ninguna restricción.
--
-- Como los triggers economy_expenses_adjust_balance / economy_income_adjust_balance
-- aplican `balance ± amount` directamente, cualquier `contributor` -- que es el
-- rol por defecto de todo `adult` de la casa -- podía insertar por API un gasto
-- de importe negativo e INFLAR el saldo de la cuenta común, o un ingreso
-- arbitrario. La validación de importe vivía solo en los formularios de React.
--
-- Verificado antes de aplicar: 0 filas con importe negativo y 0 con importe
-- cero en las tres tablas, así que la restricción no invalida ningún dato
-- existente y se puede añadir sin NOT VALID.
--
-- REVERSIBLE: drop constraint en las tres tablas.

alter table public.economy_expenses
  add constraint economy_expenses_amount_positive check (amount > 0);

alter table public.economy_income
  add constraint economy_income_amount_positive check (amount > 0);

alter table public.economy_bills
  add constraint economy_bills_amount_positive check (amount > 0);

-- EOF
