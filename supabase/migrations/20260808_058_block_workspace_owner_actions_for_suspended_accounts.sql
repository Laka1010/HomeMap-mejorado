-- Migration: cerrar el hueco de is_workspace_owner() para cuentas
-- suspended/banned — encontrado durante la verificación de consistencia
-- posterior a los 5 hallazgos de la Fase 7 (H-1/H-2/H-3/M-1/M-2), fuera del
-- alcance original de esos cinco.
-- Date: 2026-08-08
--
-- ============================================================================
-- ANÁLISIS PREVIO (hecho antes de tocar nada, mismo método que H-2)
-- ============================================================================
--
-- Grafo de llamantes de is_workspace_owner(p_space_id), confirmado en pg_proc
-- (no hay ninguno más):
--   - rename_financial_space      -- ÚNICO gate, sin otra comprobación
--   - archive_financial_space     -- ÚNICO gate (tras comprobar type='shared')
--   - delete_shared_financial_space -- ÚNICO gate (tras comprobar type='shared')
--   - add_financial_space_member   -- solo en la rama "asignar manager/owner";
--       la función YA sale antes por can_manage_financial_space (corregida
--       en 20260808_054), así que ese sub-chequeo es código inalcanzable
--       para una cuenta bloqueada. Sin cambio de comportamiento aquí.
--   - remove_financial_space_member -- misma situación que la anterior.
--
-- RLS: 0 políticas lo referencian, directa ni indirectamente (can_access/
-- can_contribute/can_manage_financial_space llaman a get_workspace_role
-- directamente, nunca a is_workspace_owner).
--
-- Triggers: cleanup_financial_space_membership_on_leave no lo consulta --
-- borra membership directamente al abandonar una casa, sin comprobar
-- ownership. Ningún flujo de sistema depende de que is_workspace_owner siga
-- devolviendo true para una cuenta bloqueada.
--
-- Por qué aquí y no en get_workspace_role (el punto más central del que
-- derivan las 4 funciones can_*/is_workspace_owner): tocar get_workspace_
-- role bloquearía también can_access_financial_space (lectura de espacios
-- financieros), algo que ni M-1 ni M-2 tocaron nunca -- ampliaría el
-- alcance sin habérselo pedido al usuario, rompiendo la separación
-- deliberada "lectura financiera abierta / escritura financiera cerrada"
-- ya en producción desde la Fase 5. is_workspace_owner es el punto mínimo
-- correcto: solo lo usan las 3 funciones realmente afectadas.
--
-- Sin problema de NULL/three-valued logic: mismo argumento que las 5
-- correcciones anteriores (coalesce ya envolvía la condición original,
-- _is_account_blocked() nunca es NULL).
--
-- Alcance: exactamente esta función. Ninguna RLS, tabla, trigger, otra
-- función ni el comportamiento de 'restricted' se modifican.

create or replace function public.is_workspace_owner(p_space_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_workspace_role(p_space_id, auth.uid()) = 'owner', false)
    and not public._is_account_blocked();
$$;

-- EOF
