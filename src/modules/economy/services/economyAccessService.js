import { supabase } from "../../../supabaseClient";

/**
 * Solicitudes de acceso de solo lectura a la economía Personal de otro
 * usuario — consentimiento explícito por pareja (nunca automático por
 * pertenecer a la misma casa). Capa de acceso a datos para
 * supabase/migrations/20260808_042_economy_access_requests.sql; toda
 * escritura pasa por RPCs `security definer` (la tabla no tiene políticas
 * de insert/update/delete). Sigue el contrato `throw` del resto de
 * servicios de economía (financialSpacesService, accountsService).
 */

/** Combina filas de economy_access_requests con el nombre del otro usuario (profiles no tiene FK directa, mismo patrón que financialSpacesService.listSpaceMembers). */
async function withProfileNames(rows, idKey) {
  if (!rows || rows.length === 0) return [];
  const ids = [...new Set(rows.map((r) => r[idKey]))];
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, display_name, email")
    .in("id", ids);
  if (error) throw error;
  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));
  return rows.map((r) => ({
    ...r,
    name: profileMap.get(r[idKey])?.display_name || profileMap.get(r[idKey])?.email || "",
  }));
}

export const economyAccessService = {
  /** Envía (o reenvía tras un rechazo/revocación) una solicitud para ver la economía Personal de `ownerUserId`. */
  async requestAccess(ownerUserId) {
    const { error } = await supabase.rpc("request_economy_access", { p_owner_user_id: ownerUserId });
    if (error) throw error;
  },

  /** Solo el owner de la solicitud puede responder. */
  async respondToRequest(requestId, accept) {
    const { error } = await supabase.rpc("respond_to_economy_access_request", {
      p_request_id: requestId,
      p_accept: accept,
    });
    if (error) throw error;
  },

  /** El owner retira un acceso ya concedido; no borra ningún dato económico. */
  async revokeAccess(requesterUserId) {
    const { error } = await supabase.rpc("revoke_economy_access", { p_requester_user_id: requesterUserId });
    if (error) throw error;
  },

  /**
   * El owner comparte su economía directamente con un compañero de casa,
   * sin esperar a que esa persona lo pida primero (sigue siendo una acción
   * explícita y deliberada del owner — no depende de compartir casa por
   * sí solo). Idempotente si ya estaba compartido.
   */
  async grantAccess(requesterUserId) {
    const { error } = await supabase.rpc("grant_economy_access", { p_requester_user_id: requesterUserId });
    if (error) throw error;
  },

  /** El propio requester retira una solicitud suya que sigue pendiente. */
  async cancelMyRequest(ownerUserId) {
    const { error } = await supabase.rpc("cancel_economy_access_request", { p_owner_user_id: ownerUserId });
    if (error) throw error;
  },

  /** Solicitudes pendientes que otros me han enviado a mí (owner), con el nombre del solicitante. */
  async listReceivedRequests() {
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from("economy_access_requests")
      .select("id, requester_user_id, status, created_at")
      .eq("owner_user_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw error;
    return withProfileNames(data, "requester_user_id");
  },

  /** A quién le he concedido acceso a mi economía (para poder revocarlo). */
  async listGrantedAccess() {
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user) return [];
    const { data, error } = await supabase
      .from("economy_access_requests")
      .select("id, requester_user_id, status, responded_at")
      .eq("owner_user_id", user.id)
      .eq("status", "accepted")
      .order("responded_at", { ascending: true });
    if (error) throw error;
    return withProfileNames(data, "requester_user_id");
  },

  /**
   * Todas mis solicitudes enviadas (a cualquier compañero de casa), sea cual
   * sea su estado — para pintar 🔒/⏳/✓/🚫 junto a cada miembro en la lista.
   * Devuelve un mapa `ownerUserId -> { id, status }`.
   */
  async listMySentStatuses() {
    const { data: { user } = {} } = await supabase.auth.getUser();
    if (!user) return {};
    const { data, error } = await supabase
      .from("economy_access_requests")
      .select("id, owner_user_id, status")
      .eq("requester_user_id", user.id);
    if (error) throw error;
    const map = {};
    (data || []).forEach((r) => { map[r.owner_user_id] = { id: r.id, status: r.status }; });
    return map;
  },
};
