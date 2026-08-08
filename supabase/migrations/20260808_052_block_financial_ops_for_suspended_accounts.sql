-- Migration: bloquear operaciones financieras sensibles para cuentas
-- suspendidas/baneadas, cerrando el hallazgo HIGH de la auditoría Red Team
-- de la Fase 4 (JWT emitido antes de la suspensión seguía permitiendo
-- mover dinero mientras no caducara por sí solo).
-- Date: 2026-08-08
--
-- ============================================================================
-- ANÁLISIS PREVIO (hecho antes de tocar nada)
-- ============================================================================
--
-- Grafo de llamadas real de las 4 operaciones a proteger, confirmado leyendo
-- las definiciones EN VIVO con pg_get_functiondef (no de memoria):
--
--   transfer_between_accounts     ─┐
--   contribute_to_financial_space ─┼─→ _execute_financial_transfer
--                                  │     (aquí es donde de verdad se mueve el
--   pay_bill_via_contribution ─────┘      saldo: los dos UPDATE balance y el
--     (llama a contribute_to_financial_space   INSERT en financial_transfers)
--      y LUEGO, solo si no lanzó, hace su
--      propio insert en economy_expenses +
--      update en economy_bills)
--
--   pay_bill_from_account ─────────→ NO llama a _execute_financial_transfer
--     (insert en economy_expenses + update en economy_bills directos)
--
-- Consecuencia: proteger _execute_financial_transfer cubre transitivamente
-- transfer_between_accounts, contribute_to_financial_space Y
-- pay_bill_via_contribution -- si la comprobación lanza dentro de
-- _execute_financial_transfer, pay_bill_via_contribution nunca llega a sus
-- propios INSERT/UPDATE posteriores (la excepción aborta toda la función
-- que la contiene). pay_bill_from_account es la ÚNICA de las 4 que NO pasa
-- por ese punto compartido, así que necesita su propia comprobación
-- explícita. Se confirmó además, buscando en el histórico completo de
-- migraciones, que _execute_financial_transfer y contribute_to_financial_
-- space no tienen ningún otro llamante (ni un flujo de arranque de casa ni
-- ningún trigger) que pudiera romperse por añadir esta comprobación.
--
-- Resultado: solo hacen falta 2 funciones modificadas
-- (_execute_financial_transfer, pay_bill_from_account) + 1 función nueva
-- (_is_account_blocked). transfer_between_accounts, contribute_to_
-- financial_space y pay_bill_via_contribution NO se tocan -- ya quedan
-- cubiertas y modificarlas sin necesidad sería justo la duplicación de
-- lógica que se pidió evitar.
--
-- No existía ya un helper para esto: account_security_state (Fase 3) solo
-- se consultaba en línea, directamente, dentro de las RPCs del propio
-- Security Center -- de ahí _is_account_blocked como pieza nueva y
-- reutilizable.
--
-- Orden de migraciones: account_security_state se creó en
-- 20260808_050_security_center.sql, ya aplicada -- esta migración puede
-- asumir que la tabla existe sin ningún problema de orden.
--
-- 'restricted' NO se incluye en la comprobación a propósito: la Fase 4 pidió
-- explícitamente no mezclar restricted con suspended/banned en esta fase.
--
-- ============================================================================
-- 1. Helper reutilizable
-- ============================================================================

create or replace function public._is_account_blocked(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.account_security_state
    where user_id = p_user_id and status in ('suspended', 'banned')
  );
$$;

revoke all on function public._is_account_blocked(uuid) from public, anon, authenticated;

-- ============================================================================
-- 2. _execute_financial_transfer -- único cambio: comprobación al principio,
--    antes de cualquier otra validación. Resto de la función sin cambios.
-- ============================================================================

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
as $$
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

  select * into v_from from public.financial_accounts where id = p_from_account_id;
  if not found then raise exception 'Cuenta de origen no encontrada'; end if;
  if v_from.status <> 'active' then raise exception 'La cuenta de origen no está activa'; end if;

  select * into v_to from public.financial_accounts where id = p_to_account_id;
  if not found then raise exception 'Cuenta de destino no encontrada'; end if;
  if v_to.status <> 'active' then raise exception 'La cuenta de destino no está activa'; end if;

  update public.financial_accounts set balance = balance - p_amount where id = p_from_account_id;
  update public.financial_accounts set balance = balance + p_amount where id = p_to_account_id;

  insert into public.financial_transfers (from_account_id, to_account_id, amount, kind, note, created_by)
  values (p_from_account_id, p_to_account_id, p_amount, p_kind, p_note, auth.uid())
  returning * into v_transfer;

  return v_transfer;
end;
$$;

-- ============================================================================
-- 3. pay_bill_from_account -- única de las 4 que no pasa por
--    _execute_financial_transfer; necesita su propia comprobación. Mismo
--    punto de inserción (primera línea) y mismo mensaje/errcode que arriba,
--    resto de la función sin cambios.
-- ============================================================================

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
  if public._is_account_blocked(auth.uid()) then
    raise exception 'Tu cuenta está suspendida o bloqueada: no puedes realizar operaciones financieras' using errcode = '42501';
  end if;

  select * into v_bill from public.economy_bills where id = p_bill_id;
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
$$;

-- EOF
