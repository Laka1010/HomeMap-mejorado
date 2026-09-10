import { supabase } from "../supabaseClient";

/**
 * Categorías de Economía del hogar — economy_categories en Supabase. Mismo
 * enfoque que categoriesService (objetos): la UI trabaja con la lista completa
 * como array de nombres, así que cada cambio reemplaza el conjunto entero de
 * ese `kind` ('expense' | 'income') en vez de hacer CRUD por elemento.
 */
export const economyCategoriesService = {
  /** @returns {Promise<{ expense: string[], income: string[] }>} */
  async fetch(houseId) {
    const { data, error } = await supabase
      .from("economy_categories")
      .select("kind, name")
      .eq("house_id", houseId)
      .order("position", { ascending: true });
    if (error) throw error;
    const expense = [];
    const income = [];
    for (const row of data || []) {
      (row.kind === "income" ? income : expense).push(row.name);
    }
    return { expense, income };
  },

  /**
   * Siembra el catálogo por defecto solo si falta. Idempotente: `ON CONFLICT
   * DO NOTHING` sobre el índice único (house_id, kind, name), así que aunque
   * el efecto de carga se ejecute dos veces (StrictMode) no crea duplicados.
   */
  async seedDefaults(houseId, expenseNames, incomeNames) {
    const rows = [
      ...(expenseNames || []).map((name, i) => ({ house_id: houseId, kind: "expense", name, position: i })),
      ...(incomeNames || []).map((name, i) => ({ house_id: houseId, kind: "income", name, position: i })),
    ];
    if (rows.length === 0) return;
    const { error } = await supabase
      .from("economy_categories")
      .upsert(rows, { onConflict: "house_id,kind,name", ignoreDuplicates: true });
    if (error) throw error;
  },

  async replace(houseId, kind, names) {
    const { error: deleteError } = await supabase
      .from("economy_categories")
      .delete()
      .eq("house_id", houseId)
      .eq("kind", kind);
    if (deleteError) throw deleteError;

    const seen = new Set();
    const rows = (names || [])
      .map((name) => (name || "").trim())
      .filter(Boolean)
      .filter((name) => {
        const key = name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((name, index) => ({ house_id: houseId, kind, name, position: index }));
    if (rows.length === 0) return;

    const { error: insertError } = await supabase.from("economy_categories").insert(rows);
    if (insertError) throw insertError;
  },
};
