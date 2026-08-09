import { supabase } from "../../supabaseClient";

/**
 * Envoltorio fino sobre security_admin_platform_stats() — mismo patrón que
 * securityAdminService.js: toda la autorización real vive en el servidor
 * (is_security_admin() dentro de la RPC), este archivo no decide nada.
 */
export const platformStatsService = {
  async getPlatformStats() {
    const { data, error } = await supabase.rpc("security_admin_platform_stats");
    if (error) throw error;
    return data || {};
  },
};
