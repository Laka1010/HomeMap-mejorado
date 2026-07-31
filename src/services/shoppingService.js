import { supabase } from "../supabaseClient";

/**
 * Servicio de lista de la compra — shopping_items en Supabase. Mismo patrón
 * de mapeo snake_case (DB) <-> camelCase (JS) que taskService.js.
 */

function itemFromRow(row) {
  return {
    id: row.id,
    listId: row.list_id,
    name: row.name,
    category: row.category,
    price: row.price,
    link: row.link,
    notes: row.notes,
    photo: row.photo,
    quantity: row.quantity,
    priority: row.priority,
    completed: row.completed,
    sourceTaskId: row.source_task_id,
    favorite: row.favorite ?? false,
  };
}

export const shoppingService = {
  async fetchItems(houseId) {
    const { data, error } = await supabase.from("shopping_items").select("*").eq("house_id", houseId);
    if (error) throw error;
    return (data || []).map(itemFromRow);
  },

  async createItem(houseId, item) {
    const { error } = await supabase.from("shopping_items").insert({
      id: item.id,
      house_id: houseId,
      list_id: item.listId || null,
      name: item.name,
      category: item.category || null,
      price: item.price === "" || item.price === undefined ? null : item.price,
      link: item.link || null,
      notes: item.notes || null,
      photo: item.photo || null,
      quantity: item.quantity ?? 1,
      priority: item.priority || null,
      completed: item.completed ?? false,
      source_task_id: item.sourceTaskId || null,
      favorite: item.favorite ?? false,
    });
    if (error) throw error;
  },

  async updateItem(itemId, patch) {
    const row = {};
    if ("listId" in patch) row.list_id = patch.listId;
    if ("name" in patch) row.name = patch.name;
    if ("category" in patch) row.category = patch.category;
    if ("price" in patch) row.price = patch.price === "" ? null : patch.price;
    if ("link" in patch) row.link = patch.link;
    if ("notes" in patch) row.notes = patch.notes;
    if ("photo" in patch) row.photo = patch.photo;
    if ("quantity" in patch) row.quantity = patch.quantity;
    if ("priority" in patch) row.priority = patch.priority;
    if ("completed" in patch) row.completed = patch.completed;
    if ("sourceTaskId" in patch) row.source_task_id = patch.sourceTaskId;
    if ("favorite" in patch) row.favorite = patch.favorite;

    const { error } = await supabase.from("shopping_items").update(row).eq("id", itemId);
    if (error) throw error;
  },

  async deleteItem(itemId) {
    const { error } = await supabase.from("shopping_items").delete().eq("id", itemId);
    if (error) throw error;
  },
};
