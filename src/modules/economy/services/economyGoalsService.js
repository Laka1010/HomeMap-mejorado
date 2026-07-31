import { supabase } from "../../../supabaseClient";

/**
 * Servicio de objetivos económicos (economy_goals). Sin periodo que
 * gestionar: el progreso siempre se calcula sobre el mes actual, en el
 * cliente (ver EconomyOverview.jsx), a partir de datos que la pantalla ya
 * tiene cargados — este servicio solo hace CRUD de la definición del
 * objetivo, no calcula nada.
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

  /** `goal`: { type: 'spending_limit'|'savings_target', name, target_amount } */
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

  async deleteGoal(goalId) {
    const { error } = await supabase.from("economy_goals").delete().eq("id", goalId);
    if (error) throw error;
  },
};
