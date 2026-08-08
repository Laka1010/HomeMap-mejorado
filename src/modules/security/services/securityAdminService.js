import { supabase } from "../../../supabaseClient";

/**
 * Cliente del Security Center (Fase 3). Cada método es un envoltorio fino
 * sobre una RPC — toda la aplicación real de permisos vive en el servidor
 * (is_security_admin() dentro de cada función, ver supabase/migrations/
 * 20260808_050_security_center.sql). Este archivo no decide nada por su
 * cuenta: si el servidor rechaza, `throw` propaga el error tal cual.
 */
export const securityAdminService = {
  /** Único punto pensado para gatear la UI: comprueba el PROPIO rol. */
  async amISecurityAdmin() {
    const { data, error } = await supabase.rpc("am_i_security_admin");
    if (error) throw error;
    return !!data;
  },

  async getDashboardStats() {
    const { data, error } = await supabase.rpc("security_admin_dashboard_stats");
    if (error) throw error;
    return data || {};
  },

  async listEvents(filters = {}, limit = 50, offset = 0) {
    const { data, error } = await supabase.rpc("security_admin_list_events", {
      p_severity: filters.severity || null,
      p_event_type: filters.eventType || null,
      p_result: filters.result || null,
      p_date_from: filters.dateFrom || null,
      p_date_to: filters.dateTo || null,
      p_user_id: filters.userId || null,
      p_limit: limit,
      p_offset: offset,
    });
    if (error) throw error;
    return {
      rows: data || [],
      totalCount: data && data.length > 0 ? Number(data[0].total_count) : 0,
    };
  },

  async getEvent(eventId) {
    const { data, error } = await supabase.rpc("security_admin_get_event", { p_event_id: eventId });
    if (error) throw error;
    return data;
  },

  async searchUsers(query) {
    const { data, error } = await supabase.rpc("security_admin_search_users", { p_query: query });
    if (error) throw error;
    return data || [];
  },

  async getUserDetail(userId) {
    const { data, error } = await supabase.rpc("security_admin_get_user_detail", { p_user_id: userId });
    if (error) throw error;
    return data;
  },

  async suspendAccount(userId, reason) {
    const { error } = await supabase.rpc("security_admin_suspend_account", { p_user_id: userId, p_reason: reason });
    if (error) throw error;
  },
  async unsuspendAccount(userId, reason) {
    const { error } = await supabase.rpc("security_admin_unsuspend_account", { p_user_id: userId, p_reason: reason || null });
    if (error) throw error;
  },
  async restrictAccount(userId, reason) {
    const { error } = await supabase.rpc("security_admin_restrict_account", { p_user_id: userId, p_reason: reason });
    if (error) throw error;
  },
  async unrestrictAccount(userId, reason) {
    const { error } = await supabase.rpc("security_admin_unrestrict_account", { p_user_id: userId, p_reason: reason || null });
    if (error) throw error;
  },
  async banAccount(userId, reason) {
    const { error } = await supabase.rpc("security_admin_ban_account", { p_user_id: userId, p_reason: reason });
    if (error) throw error;
  },
  async unbanAccount(userId, reason) {
    const { error } = await supabase.rpc("security_admin_unban_account", { p_user_id: userId, p_reason: reason || null });
    if (error) throw error;
  },

  async revokeSession(sessionId, reason) {
    const { error } = await supabase.rpc("security_admin_revoke_session", { p_session_id: sessionId, p_reason: reason || null });
    if (error) throw error;
  },
  async revokeAllSessions(userId, reason) {
    const { error } = await supabase.rpc("security_admin_revoke_all_sessions", { p_user_id: userId, p_reason: reason || null });
    if (error) throw error;
  },

  async listIpBlocks(activeOnly = false) {
    const { data, error } = await supabase.rpc("security_admin_list_ip_blocks", { p_active_only: activeOnly });
    if (error) throw error;
    return data || [];
  },
  async blockIp(ip, reason, severity, durationMinutes) {
    const { error } = await supabase.rpc("security_admin_block_ip", {
      p_ip: ip, p_reason: reason, p_severity: severity || "warning", p_duration_minutes: durationMinutes ?? null,
    });
    if (error) throw error;
  },
  async unblockIp(ip, reason) {
    const { error } = await supabase.rpc("security_admin_unblock_ip", { p_ip: ip, p_reason: reason || null });
    if (error) throw error;
  },

  async listAuditLog(limit = 50, offset = 0) {
    const { data, error } = await supabase.rpc("security_admin_list_audit_log", { p_limit: limit, p_offset: offset });
    if (error) throw error;
    return {
      rows: data || [],
      totalCount: data && data.length > 0 ? Number(data[0].total_count) : 0,
    };
  },
};
