import { supabase } from "../supabaseClient";

/**
 * Servicio del centro de actividad — notifications en Supabase. Las filas
 * las genera el motor de reglas (src/notifications/engine.js), nunca se
 * escriben "a mano" desde la UI salvo las acciones del propio usuario
 * (marcar leída, archivar, eliminar, posponer).
 */

function notificationFromRow(row) {
  return {
    id: row.id,
    category: row.category,
    type: row.type,
    priority: row.priority,
    dedupeKey: row.dedupe_key,
    title: row.title,
    body: row.body,
    action: row.action,
    entityRef: row.entity_ref,
    status: row.status,
    snoozedUntil: row.snoozed_until,
    createdAt: row.created_at,
    readAt: row.read_at,
    archivedAt: row.archived_at,
  };
}

export const notificationsService = {
  /** Notificaciones activas (no archivadas/eliminadas/pospuestas) visibles para el usuario actual. */
  async fetchActive(houseId, userId) {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("house_id", houseId)
      .in("status", ["unread", "read"])
      .or(`user_id.is.null,user_id.eq.${userId}`)
      .or(`snoozed_until.is.null,snoozed_until.lte.${new Date().toISOString()}`)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).map(notificationFromRow);
  },

  /**
   * Inserta o actualiza candidatas por dedupe_key (nunca duplica una misma
   * condición). El campo `status` se omite a propósito del payload de
   * actualización: si la notificación ya existía y el usuario la había
   * marcado leída, una reevaluación que solo actualiza el texto no debe
   * "reabrirla" — el motor decide aparte cuándo debe volver a unread
   * mediante `forceUnread`.
   */
  async upsertCandidates(houseId, candidates) {
    if (!candidates.length) return;
    const rows = candidates.map((c) => ({
      house_id: houseId,
      user_id: c.userId || null,
      category: c.category,
      type: c.type,
      priority: c.priority,
      dedupe_key: c.dedupeKey,
      title: c.title,
      body: c.body || null,
      action: c.action || null,
      entity_ref: c.entityRef || null,
      ...(c.forceUnread ? { status: "unread" } : {}),
    }));
    const { error } = await supabase.from("notifications").upsert(rows, { onConflict: "house_id,dedupe_key" });
    if (error) throw error;
  },

  /** Archiva las notificaciones de un tipo de regla cuya condición ya no se cumple. */
  async resolveStale(houseId, type, activeDedupeKeys) {
    let query = supabase
      .from("notifications")
      .update({ status: "archived", archived_at: new Date().toISOString() })
      .eq("house_id", houseId)
      .eq("type", type)
      .in("status", ["unread", "read"]);
    if (activeDedupeKeys.length > 0) {
      query = query.not("dedupe_key", "in", `(${activeDedupeKeys.map((k) => `"${k}"`).join(",")})`);
    }
    const { error } = await query;
    if (error) throw error;
  },

  async markRead(id) {
    const { error } = await supabase.from("notifications").update({ status: "read", read_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  },

  async archive(id) {
    const { error } = await supabase.from("notifications").update({ status: "archived", archived_at: new Date().toISOString() }).eq("id", id);
    if (error) throw error;
  },

  async remove(id) {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) throw error;
  },

  async snooze(id, untilIso) {
    const { error } = await supabase.from("notifications").update({ snoozed_until: untilIso }).eq("id", id);
    if (error) throw error;
  },
};
