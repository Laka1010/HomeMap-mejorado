import { supabase } from "../../../supabaseClient";

/**
 * Servicio de economy_goals. Hoy la única UI que lo usa es el Presupuesto
 * del mes (BudgetSection), siempre con type='spending_limit' — una fila por
 * categoría de gasto con su importe máximo. El nombre de la tabla y del
 * servicio viene del objetivo original ("Objetivos": límite de gasto o
 * ahorro); se conserva para no forzar una migración solo por el nombre.
 * Sin periodo que gestionar: el progreso siempre se calcula sobre el mes
 * actual, en el cliente (ver EconomyOverview.jsx), a partir de datos que la
 * pantalla ya tiene cargados — este servicio solo hace CRUD de la fila, no
 * calcula nada.
 */
export const economyGoalsService = {
  async listGoals(houseId) {
    const { data, error } = await supabase
      .from("economy_goals")
      .select("*")
      .eq("house_id", houseId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /** `goal`: { type: 'spending_limit', name, targetAmount } */
  async createGoal(houseId, userId, goal) {
    const { data, error } = await supabase
      .from("economy_goals")
      .insert({
        house_id: houseId,
        created_by: userId,
        type: goal.type,
        name: goal.name,
        target_amount: goal.targetAmount,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async updateGoal(goalId, targetAmount) {
    const { data, error } = await supabase
      .from("economy_goals")
      .update({ target_amount: targetAmount })
      .eq("id", goalId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async deleteGoal(goalId) {
    const { error } = await supabase.from("economy_goals").delete().eq("id", goalId);
    if (error) throw error;
  },
};
