import { supabase } from "../supabaseClient";

/**
 * Servicio de consumibles — consumables en Supabase. Mismo patrón de mapeo
 * snake_case (DB) <-> camelCase (JS) que homeContentService.js.
 */

function toNumericOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = typeof value === "number" ? value : parseFloat(String(value).replace(/,/g, "."));
  return Number.isFinite(n) ? n : null;
}

function consumableFromRow(row) {
  return {
    id: row.id,
    name: row.name,
    roomId: row.room_id,
    zoneId: row.zone_id,
    containerId: row.container_id,
    currentQuantity: row.current_quantity,
    minQuantity: row.min_quantity,
    autoAddToShopping: row.auto_add_to_shopping,
    shoppingListId: row.shopping_list_id,
    linkedShoppingItemId: row.linked_shopping_item_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const consumablesService = {
  async fetchConsumables(houseId) {
    const { data, error } = await supabase.from("consumables").select("*").eq("house_id", houseId);
    if (error) throw error;
    return (data || []).map(consumableFromRow);
  },

  async createConsumable(houseId, consumable) {
    const { error } = await supabase.from("consumables").insert({
      id: consumable.id,
      house_id: houseId,
      room_id: consumable.roomId ?? null,
      zone_id: consumable.zoneId ?? null,
      container_id: consumable.containerId ?? null,
      name: consumable.name,
      current_quantity: toNumericOrNull(consumable.currentQuantity) ?? 1,
      min_quantity: toNumericOrNull(consumable.minQuantity),
      auto_add_to_shopping: consumable.autoAddToShopping ?? false,
      shopping_list_id: consumable.shoppingListId ?? null,
      linked_shopping_item_id: consumable.linkedShoppingItemId ?? null,
    });
    if (error) throw error;
  },

  async updateConsumable(consumableId, patch) {
    const row = {};
    if ("roomId" in patch) row.room_id = patch.roomId ?? null;
    if ("zoneId" in patch) row.zone_id = patch.zoneId ?? null;
    if ("containerId" in patch) row.container_id = patch.containerId ?? null;
    if ("name" in patch) row.name = patch.name;
    if ("currentQuantity" in patch) row.current_quantity = toNumericOrNull(patch.currentQuantity) ?? 0;
    if ("minQuantity" in patch) row.min_quantity = toNumericOrNull(patch.minQuantity);
    if ("autoAddToShopping" in patch) row.auto_add_to_shopping = patch.autoAddToShopping;
    if ("shoppingListId" in patch) row.shopping_list_id = patch.shoppingListId ?? null;
    if ("linkedShoppingItemId" in patch) row.linked_shopping_item_id = patch.linkedShoppingItemId;

    const { error } = await supabase.from("consumables").update(row).eq("id", consumableId);
    if (error) throw error;
  },

  async deleteConsumable(consumableId) {
    const { error } = await supabase.from("consumables").delete().eq("id", consumableId);
    if (error) throw error;
  },
};
