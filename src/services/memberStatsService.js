import { supabase } from "../supabaseClient";

/**
 * Conteos por miembro para la pantalla de información del miembro.
 *
 * economy_expenses/economy_bills/shopping_purchases tienen created_by real,
 * así que esos tres se cuentan directamente sobre la tabla. objects/rooms
 * no tienen ninguna columna de autor (solo house_id), y tasks no registra
 * quién la completó — para esos tres no hay dato histórico que contar, así
 * que se leen de house_activity (entity_type "object"/"room"/"taskCompleted",
 * ver App.jsx) y solo cuentan desde que esa etiqueta empezó a registrarse.
 * No se inventa un número para lo que pasó antes de eso.
 */
async function countTable(table, houseId, userId) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("house_id", houseId)
    .eq("created_by", userId);
  if (error) throw error;
  return count || 0;
}

async function countActivity(houseId, userId, entityType) {
  const { count, error } = await supabase
    .from("house_activity")
    .select("id", { count: "exact", head: true })
    .eq("house_id", houseId)
    .eq("user_id", userId)
    .eq("entity_type", entityType);
  if (error) throw error;
  return count || 0;
}

export const memberStatsService = {
  /** `includeEconomy`: false para miembros 'child', que no tienen acceso a Economía. */
  async getMemberStats(houseId, userId, { includeEconomy = true } = {}) {
    const [objectsAdded, roomsCreated, tasksCompleted, purchasesCreated, expensesRegistered, billsRegistered] = await Promise.all([
      countActivity(houseId, userId, "object"),
      countActivity(houseId, userId, "room"),
      countActivity(houseId, userId, "taskCompleted"),
      countTable("shopping_purchases", houseId, userId),
      includeEconomy ? countTable("economy_expenses", houseId, userId) : Promise.resolve(0),
      includeEconomy ? countTable("economy_bills", houseId, userId) : Promise.resolve(0),
    ]);
    return { objectsAdded, roomsCreated, tasksCompleted, purchasesCreated, expensesRegistered, billsRegistered };
  },
};
