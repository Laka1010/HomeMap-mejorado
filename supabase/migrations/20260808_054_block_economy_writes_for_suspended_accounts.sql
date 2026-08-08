-- Migration: cerrar H-1 y M-2 del análisis de la Fase 7 — escritura
-- económica directa (economy_income/expenses/goals/bills, financial_accounts)
-- seguía abierta para cuentas suspended/banned pese al arreglo de la Fase 5.
-- Date: 2026-08-08
--
-- ============================================================================
-- ANÁLISIS (ya hecho en la Fase 7, resumen aquí para que la migración se
-- entienda sin releer el informe completo)
-- ============================================================================
--
-- H-1: economy_income/economy_expenses/economy_goals no comprueban el
--      estado de la cuenta en ningún punto -- solo can_contribute_financial_
--      space(financial_space_id), en sus políticas INSERT/UPDATE/DELETE (ya
--      separadas por comando, confirmado en pg_policies). Como esa función
--      también decide si las 4 RPC financieras de la Fase 5 dejan actuar,
--      insertar/actualizar/borrar directamente en estas tablas evitaba por
--      completo la protección de esa fase -- incluyendo mover saldo real
--      vía los triggers economy_income_adjust_balance/economy_expenses_
--      adjust_balance (que no hace falta tocar: si el INSERT nunca pasa el
--      WITH CHECK, el trigger nunca llega a dispararse).
--
-- M-2: financial_accounts (crear/modificar/eliminar cuentas) usa el mismo
--      patrón con can_manage_financial_space en vez de can_contribute_
--      financial_space -- mismo problema, mismo arreglo.
--
-- Por qué este es el punto correcto para el arreglo, y no las tablas o los
-- triggers: ambas funciones ya son el ÚNICO lugar que las 12 políticas RLS
-- afectadas (economy_bills×3, economy_expenses×3, economy_income×3,
-- economy_goals×3, financial_accounts×3) y las RPC financieras existentes
-- consultan para decidir escritura. Cambiar aquí no toca ninguna política,
-- ninguna tabla, ningún trigger, ninguna RPC -- todas ellas ya llaman a
-- estas dos funciones tal cual.
--
-- Sin problema de NULL/three-valued logic: coalesce(..., false) ya envolvía
-- la condición original (los autores ya evitaban que get_workspace_role
-- devolviera NULL sin capturarlo); _is_account_blocked() usa exists(), que
-- nunca devuelve NULL. El AND añadido no reintroduce ningún camino NULL.
--
-- Alcance: exactamente estas dos funciones. Ninguna RLS, tabla, trigger,
-- RPC ni el comportamiento de 'restricted' se modifican.

create or replace function public.can_contribute_financial_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_workspace_role(p_space_id, auth.uid()) in ('contributor', 'manager', 'owner'), false)
    and not public._is_account_blocked();
$$;

create or replace function public.can_manage_financial_space(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_workspace_role(p_space_id, auth.uid()) in ('manager', 'owner'), false)
    and not public._is_account_blocked();
$$;

-- EOF
