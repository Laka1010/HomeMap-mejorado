import { supabase } from "../supabaseClient";

/**
 * Feed de actividad reciente compartido por toda la casa (house_activity).
 * Cada fila la inserta el propio autor de la acción (RLS exige
 * user_id = auth.uid()); cualquier miembro de la casa puede leer todas.
 */
export const activityService = {
  async fetchRecent(houseId, limit = 20) {
    const { data, error } = await supabase
      .from("house_activity")
      .select("id, user_id, actor_name, title, category, entity_type, entity_id, created_at")
      .eq("house_id", houseId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map((row) => ({
      id: row.id,
      title: row.title,
      when: row.created_at,
      userId: row.user_id,
      actorName: row.actor_name,
      category: row.category,
      entityType: row.entity_type,
      entityId: row.entity_id,
    }));
  },

  /** `meta` opcional: { category, entityType, entityId } — entityType/entityId permiten
   *  que una notificación relacionada (notifications.entity_ref) enlace a esta entrada. */
  async logActivity(houseId, userId, actorName, title, meta = {}) {
    const { category = null, entityType = null, entityId = null } = meta;
    const { error } = await supabase
      .from("house_activity")
      .insert({ house_id: houseId, user_id: userId, actor_name: actorName, title, category, entity_type: entityType, entity_id: entityId });
    if (error) throw error;
  },
};
