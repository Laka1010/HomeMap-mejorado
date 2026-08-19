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
    // title/body siguen llegando (respaldo en español, y lo único que tienen
    // las filas creadas antes de la migración 20260819_069); el texto que se
    // pinta sale de *Key + *Vars cuando existen — ver notificationText().
    title: row.title,
    titleKey: row.title_key,
    titleVars: row.title_vars,
    body: row.body,
    bodyKey: row.body_key,
    bodyVars: row.body_vars,
    action: row.action,
    actionLabelKey: row.action_label_key,
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
      title_key: c.titleKey || null,
      title_vars: c.titleVars || null,
      body: c.body || null,
      body_key: c.bodyKey || null,
      body_vars: c.bodyVars || null,
      action: c.action || null,
      action_label_key: c.action?.labelKey || null,
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

  /**
   * Marca de golpe todo lo no leído que ve este usuario — lo usa el centro de
   * actividad al abrirse, para que el punto rojo del icono desaparezca sin que
   * haya que ir notificación por notificación.
   *
   * Se repite el mismo filtro de destinatario que `fetchActive`
   * (user_id nulo = para toda la casa, o dirigida a este usuario) en vez de
   * confiar solo en RLS: así este UPDATE nunca puede tocar una fila que el
   * usuario no está viendo en pantalla.
   *
   * OJO con las de user_id nulo: son de la casa entera y tienen un único
   * `status`, así que al leerlas también se apagan para el resto de miembros.
   * No es nuevo (el botón "Leída" de antes hacía exactamente lo mismo);
   * marcar por usuario exigiría una tabla de lecturas aparte.
   */
  async markAllRead(houseId, userId) {
    const { error } = await supabase
      .from("notifications")
      .update({ status: "read", read_at: new Date().toISOString() })
      .eq("house_id", houseId)
      .eq("status", "unread")
      .or(`user_id.is.null,user_id.eq.${userId}`);
    if (error) throw error;
  },

  /**
   * Archivado/posponer manuales: ya no hay ningún botón que los dispare (el
   * centro de actividad se dejó en dos acciones, ver NotificationCenter),
   * pero el estado 'archived' sigue siendo parte del modelo — es lo que usa
   * `resolveStale` cuando la condición de una regla deja de cumplirse.
   */
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
