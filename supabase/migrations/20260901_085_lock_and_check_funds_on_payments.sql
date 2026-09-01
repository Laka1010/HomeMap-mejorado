-- Migration: bloqueo de fila y comprobación de fondos en operaciones de dinero
-- (hallazgo M-3 de la auditoría)
-- Date: 2026-09-01
--
-- 1. DOBLE PAGO POR CARRERA
--    pay_bill_from_account y pay_bill_via_contribution hacían
--    "select * into v_bill from economy_bills where id = ..." SIN "for update",
--    comprobaban status = 'paid' y luego actualizaban. En READ COMMITTED, dos
--    llamadas concurrentes superan las dos la comprobación: se insertan dos
--    gastos y se mueve el dinero dos veces por la misma factura. Los botones de
--    la UI tienen guarda "saving", pero la RPC es invocable directamente y basta
--    con lanzar dos peticiones a la vez.
--
-- 2. TRANSFERENCIAS SIN BLOQUEO NI SALDO
--    _execute_financial_transfer no bloqueaba las filas de cuenta, no comprobaba
--    saldo suficiente (los balances podían quedar negativos) y actualizaba
--    origen y destino en el orden en que llegaban los argumentos, de modo que
--    dos transferencias inversas simultáneas podían interbloquear.
--
-- QUÉ SE HACE
--    * "for update" sobre la factura antes de comprobar su estado.
--    * "for update" sobre ambas cuentas, SIEMPRE en orden de UUID, para que dos
--      transferencias cruzadas no puedan interbloquearse.
--    * Comprobación de saldo suficiente en el origen.
--
-- QUÉ NO SE HACE, A PROPÓSITO
--    No se impide que un GASTO deje una cuenta en negativo. Registrar un gasto
--    que ya has hecho en la vida real no puede estar prohibido por el sistema:
--    el libro tiene que poder reflejar la realidad. De hecho la única cuenta con
--    saldo negativo hoy ("Efectivo", -385) llegó ahí por gastos, no por
--    transferencias. Mover dinero que no tienes sí es una operación sin
--    sentido, y es la que se bloquea.
--
-- Verificado antes de aplicar: 0 transferencias existentes, así que la
-- comprobación de fondos no invalida ninguna operación pasada.
--
-- REVERSIBLE: reaplicar las definiciones de 20260803_023_financial_accounts.sql
-- (_execute_financial_transfer), 20260808_028 (pay_bill_from_account) y
-- 20260806_026 (pay_bill_via_contribution).

create or replace function public._execute_financial_transfer(
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_amount numeric,
  p_note text,
  p_kind text
)
returns public.financial_transfers
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_from public.financial_accounts;
  v_to public.financial_accounts;
  v_transfer public.financial_transfers;
begin
  if public._is_account_blocked(auth.uid()) then
    raise exception 'Tu cuenta está suspendida o bloqueada: no puedes realizar operaciones financieras' using errcode = '42501';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'El importe debe ser mayor que 0';
  end if;
  if p_from_account_id = p_to_account_id then
    raise exception 'La cuenta de origen y destino no pueden ser la misma';
  end if;

  -- M-3: se bloquean AMBAS filas y siempre en el mismo orden (por UUID), para
  -- que dos transferencias inversas simultáneas no se interbloqueen.
  if p_from_account_id < p_to_account_id then
    select * into v_from from public.financial_accounts where id = p_from_account_id for update;
    select * into v_to   from public.financial_accounts where id = p_to_account_id   for update;
  else
    select * into v_to   from public.financial_accounts where id = p_to_account_id   for update;
    select * into v_from from public.financial_accounts where id = p_from_account_id for update;
  end if;

  if v_from.id is null then raise exception 'Cuenta de origen no encontrada'; end if;
  if v_from.status <> 'active' then raise exception 'La cuenta de origen no está activa'; end if;
  if v_to.id is null then raise exception 'Cuenta de destino no encontrada'; end if;
  if v_to.status <> 'active' then raise exception 'La cuenta de destino no está activa'; end if;

  -- M-3: no se puede mover dinero que no hay.
  if v_from.balance < p_amount then
    raise exception 'Saldo insuficiente en la cuenta de origen';
  end if;

  update public.financial_accounts set balance = balance - p_amount where id = p_from_account_id;
  update public.financial_accounts set balance = balance + p_amount where id = p_to_account_id;

  insert into public.financial_transfers (from_account_id, to_account_id, amount, kind, note, created_by)
  values (p_from_account_id, p_to_account_id, p_amount, p_kind, p_note, auth.uid())
  returning * into v_transfer;

  return v_transfer;
end;
$fn$;

create or replace function public.pay_bill_from_account(p_bill_id uuid, p_account_id uuid)
returns public.economy_bills
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_bill public.economy_bills;
  v_account public.financial_accounts;
begin
  if public._is_account_blocked(auth.uid()) then
    raise exception 'Tu cuenta está suspendida o bloqueada: no puedes realizar operaciones financieras' using errcode = '42501';
  end if;

  -- M-3: "for update" cierra la ventana entre comprobar el estado y marcarla
  -- como pagada. Sin esto, dos llamadas concurrentes la pagaban dos veces.
  select * into v_bill from public.economy_bills where id = p_bill_id for update;
  if not found then raise exception 'Factura no encontrada'; end if;
  if v_bill.status = 'paid' then raise exception 'La factura ya está pagada'; end if;

  if not public.can_contribute_financial_space(v_bill.financial_space_id) then
    raise exception 'No tienes permiso para pagar facturas de este espacio' using errcode = '42501';
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
$fn$;

create or replace function public.pay_bill_via_contribution(p_bill_id uuid, p_from_account_id uuid)
returns public.economy_bills
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_bill public.economy_bills;
  v_household_account_id uuid;
begin
  -- M-3: mismo bloqueo, y siempre ANTES de tocar cuentas, para que el orden de
  -- adquisición de locks (factura -> cuentas) sea el mismo en las dos RPCs de
  -- pago y no puedan interbloquearse entre ellas.
  select * into v_bill from public.economy_bills where id = p_bill_id for update;
  if not found then raise exception 'Factura no encontrada'; end if;
  if v_bill.status = 'paid' then raise exception 'La factura ya está pagada'; end if;

  select id into v_household_account_id
  from public.financial_accounts
  where financial_space_id = v_bill.financial_space_id and is_default = true;

  if v_household_account_id is null then
    raise exception 'El hogar no tiene una cuenta por defecto';
  end if;

  perform public.contribute_to_financial_space(
    p_from_account_id, v_bill.financial_space_id, v_bill.amount, 'Pago de factura: ' || v_bill.name
  );

  insert into public.economy_expenses (financial_space_id, account_id, created_by, performed_by, name, amount, category, date, description)
  values (v_bill.financial_space_id, v_household_account_id, auth.uid(), auth.uid(), v_bill.name, v_bill.amount, v_bill.category, current_date, 'Factura: ' || v_bill.name);

  update public.economy_bills
  set status = 'paid', paid_date = current_date, paid_from_account_id = v_household_account_id
  where id = p_bill_id
  returning * into v_bill;

  return v_bill;
end;
$fn$;

-- EOF
