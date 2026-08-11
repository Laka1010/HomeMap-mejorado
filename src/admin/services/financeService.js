import { supabase } from "../../supabaseClient";

/**
 * Envoltorio fino sobre la única RPC nueva de Fase 6 — mismo patrón que
 * el resto de servicios de src/admin/services/. El listado/búsqueda/
 * paginación/metadatos/miembros de Finance NO viven aquí: se reutiliza
 * workspacesService.js (Fase 5) tal cual, sin modificarlo. Este archivo
 * solo añade los 6 recuentos agregados (sin importes, sin saldos, sin
 * movimientos individuales) que Fase 5 no tenía.
 */
export const financeService = {
  async getWorkspaceFinanceCounts(workspaceId) {
    const { data, error } = await supabase.rpc("security_admin_get_workspace_finance_counts", {
      p_workspace_id: workspaceId,
    });
    if (error) throw error;
    return data;
  },
};
