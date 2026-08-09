import { supabase } from "../../supabaseClient";

/**
 * Envoltorio fino sobre security_admin_list_users() — mismo patrón que
 * securityAdminService.js/platformStatsService.js: la autorización real
 * vive en el servidor (is_security_admin() dentro de la RPC), este
 * archivo no decide nada ni filtra nada por su cuenta.
 */
export const usersService = {
  async listUsers({ status = null, query = null, limit = 25, offset = 0 } = {}) {
    const { data, error } = await supabase.rpc("security_admin_list_users", {
      p_status: status || null,
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
};
