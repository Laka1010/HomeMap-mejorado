import { supabase } from "../supabaseClient";

/**
 * Servicio de categorías del hogar — categories en Supabase. A diferencia de
 * tasks/notes/shopping_items, la UI trabaja con la lista completa como un
 * array de nombres (sin ids propios), así que cada cambio reemplaza el
 * conjunto entero en vez de hacer CRUD por elemento.
 */

export const categoriesService = {
  async fetchCategories(houseId) {
    const { data, error } = await supabase
      .from("categories")
      .select("name")
      .eq("house_id", houseId)
      .order("position", { ascending: true });
    if (error) throw error;
    return (data || []).map((row) => row.name);
  },

  async replaceCategories(houseId, categories) {
    const { error: deleteError } = await supabase.from("categories").delete().eq("house_id", houseId);
    if (deleteError) throw deleteError;

    const rows = (categories || []).map((name, index) => ({ house_id: houseId, name, position: index }));
    if (rows.length === 0) return;

    const { error: insertError } = await supabase.from("categories").insert(rows);
    if (insertError) throw insertError;
  },
};
