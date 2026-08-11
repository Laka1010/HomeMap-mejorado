import { supabase } from "../../supabaseClient";

/**
 * Envoltorio fino sobre security_admin_list_workspaces()/get_workspace_detail()
 * — mismo patrón que housesService.js/usersService.js: la autorización real
 * vive en el servidor, este archivo no decide ni filtra nada por su
 * cuenta. No reutiliza src/modules/economy/services/* porque esos
 * servicios dependen de RLS con alcance de usuario (un Security Admin no
 * es miembro/owner del Workspace ajeno que quiere consultar).
 */
export const workspacesService = {
  async listWorkspaces({ query = null, limit = 25, offset = 0 } = {}) {
    const { data, error } = await supabase.rpc("security_admin_list_workspaces", {
      p_query: query || null,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) throw error;
    return {
      rows: data || [],
      totalCount: data && data.length > 0 ? Number(data[0].total_count) : 0,
    };
  },

  async getWorkspaceDetail(workspaceId) {
    const { data, error } = await supabase.rpc("security_admin_get_workspace_detail", { p_workspace_id: workspaceId });
    if (error) throw error;
    return data;
  },
};
