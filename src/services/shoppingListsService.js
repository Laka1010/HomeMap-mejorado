import { supabase } from "../supabaseClient";

/**
 * Servicio de listas de la compra — shopping_lists en Supabase. Cada lista
 * (ej. "Supermercado", "Ropa") agrupa productos de shopping_items via list_id.
 */

function listFromRow(row) {
  return { id: row.id, name: row.name };
}

export const shoppingListsService = {
  async fetchLists(houseId) {
    const { data, error } = await supabase
      .from("shopping_lists")
      .select("*")
      .eq("house_id", houseId)
      .order("position", { ascending: true });
    if (error) throw error;
    return (data || []).map(listFromRow);
  },

  async createList(houseId, name, position = 0) {
    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ house_id: houseId, name, position })
      .select()
      .single();
    if (error) throw error;
    return listFromRow(data);
  },

  async renameList(listId, name) {
    const { error } = await supabase.from("shopping_lists").update({ name }).eq("id", listId);
    if (error) throw error;
  },

  async deleteList(listId) {
    const { error } = await supabase.from("shopping_lists").delete().eq("id", listId);
    if (error) throw error;
  },
};
