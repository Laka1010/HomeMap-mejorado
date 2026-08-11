-- Migration: security_admin_get_workspace_finance_counts()
-- Fase 6 de Admin Console (Finance) — SOLO recuentos agregados
-- Date: 2026-08-09
--
-- ============================================================================
-- CONTEXTO Y LÍMITES DELIBERADOS (decisión de producto confirmada)
-- ============================================================================
--
-- Esta RPC es la ÚNICA pieza nueva de Fase 6. El listado, la búsqueda, la
-- paginación y los metadatos/miembros del detalle NO se tocan -- se
-- reutilizan tal cual security_admin_list_workspaces()/
-- get_workspace_detail() de la Fase 5 (ya verificadas en producción), sin
-- modificarlas.
--
-- Alcance explícitamente excluido de esta función (no por omisión, por
-- decisión): ningún importe, saldo, SUM/AVG/MIN/MAX monetario, fila
-- individual de movimiento, ni ninguna columna de texto libre (name,
-- description, notes, provider, receipt_image_url, attachment_url). Solo
-- 6 COUNT(*).
--
-- También se decidió NO desglosar bills por status (pending/paid) ni
-- goals por type -- un desglose así ya empieza a insinuar información
-- financiera interpretable (p.ej. "cuántas facturas sin pagar tiene"),
-- más allá de un recuento de actividad puro. Tampoco se añade una fecha
-- de "última actividad financiera": a diferencia de last_activity_at en
-- Houses (que sale de house_activity, tabla no financiera), aquí saldría
-- de economy_expenses/income/bills, y cruzada con los recuentos dibuja un
-- patrón de uso más fino de lo aprobado.
--
-- ============================================================================
-- transfers_count: por qué no puede duplicar filas
-- ============================================================================
--
-- financial_transfers no tiene financial_space_id propio -- se resuelve
-- vía from_account_id/to_account_id -> financial_accounts.
-- financial_space_id (misma relación que ya usa la política RLS
-- financial_transfers_select). Cuando origen y destino pertenecen al
-- mismo workspace (transfer_between_accounts lo permite explícitamente:
-- kind='transfer' cuando v_from_space = v_to_space -- mover dinero entre
-- dos cuentas del mismo espacio), la condición
-- "from_account_id in (...) or to_account_id in (...)" sigue evaluándose
-- sobre UNA fila de financial_transfers por transferencia: es un WHERE
-- con OR sobre una única tabla en el FROM, no un JOIN/UNION que pudiera
-- producir más de una fila por transferencia. count(*) cuenta filas de
-- financial_transfers, no combinaciones -- no hay duplicación posible
-- estructuralmente. Verificado también en pruebas (ver informe de
-- cierre) comparando contra count(distinct id) sobre datos reales.
--
-- ============================================================================

create or replace function public.security_admin_get_workspace_finance_counts(p_workspace_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_result jsonb;
begin
  if not public.is_security_admin() then
    raise exception 'No autorizado: se requiere rol de Security Admin' using errcode = '42501';
  end if;

  if not exists (select 1 from public.financial_spaces where id = p_workspace_id) then
    raise exception 'Workspace no encontrado';
  end if;

  select jsonb_build_object(
    'accounts_count',  (select count(*) from public.financial_accounts fa where fa.financial_space_id = p_workspace_id),
    'expenses_count',  (select count(*) from public.economy_expenses e where e.financial_space_id = p_workspace_id),
    'income_count',    (select count(*) from public.economy_income i where i.financial_space_id = p_workspace_id),
    'bills_count',     (select count(*) from public.economy_bills b where b.financial_space_id = p_workspace_id),
    'goals_count',     (select count(*) from public.economy_goals g where g.financial_space_id = p_workspace_id),
    'transfers_count', (
      select count(*) from public.financial_transfers t
      where t.from_account_id in (select id from public.financial_accounts where financial_space_id = p_workspace_id)
         or t.to_account_id   in (select id from public.financial_accounts where financial_space_id = p_workspace_id)
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.security_admin_get_workspace_finance_counts(uuid) from public, anon;
grant execute on function public.security_admin_get_workspace_finance_counts(uuid) to authenticated;

-- EOF
