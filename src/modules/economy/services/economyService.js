import { supabase } from "../../../supabaseClient";

/**
 * Servicio de Economía - Capa de acceso a datos de economía del hogar
 * Todos los métodos filtran automáticamente por house_id
 */

export const economyService = {
  /**
   * Obtiene el balance total del mes actual
   * @param {string} houseId - ID de la casa
   * @returns {Promise<number>}
   */
  async getMonthBalance(houseId) {
    const income = await this.getMonthIncome(houseId);
    const expenses = await this.getMonthExpenses(houseId);
    return income - expenses;
  },

  /**
   * Obtiene ingresos totales del mes actual
   * @param {string} houseId
   * @returns {Promise<number>}
   */
  async getMonthIncome(houseId) {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const { data, error } = await supabase
      .from("economy_income")
      .select("amount")
      .eq("house_id", houseId)
      .gte("date", monthStart.toISOString().split("T")[0])
      .lte("date", monthEnd.toISOString().split("T")[0]);

    if (error) console.error("Error fetching income:", error);
    return data?.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) || 0;
  },

  /**
   * Obtiene gastos totales de un mes (el actual por defecto)
   * @param {string} houseId
   * @param {number} monthOffset - 0 = mes actual, -1 = mes anterior, etc.
   * @returns {Promise<number>}
   */
  async getMonthExpenses(houseId, monthOffset = 0) {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + monthOffset + 1, 0);

    const { data, error } = await supabase
      .from("economy_expenses")
      .select("amount")
      .eq("house_id", houseId)
      .gte("date", monthStart.toISOString().split("T")[0])
      .lte("date", monthEnd.toISOString().split("T")[0]);

    if (error) console.error("Error fetching expenses:", error);
    return data?.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0) || 0;
  },

  /**
   * Obtiene gastos agrupados por categoría
   * @param {string} houseId
   * @returns {Promise<Array>}
   */
  async getExpensesByCategory(houseId) {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const { data, error } = await supabase
      .from("economy_expenses")
      .select("amount, category")
      .eq("house_id", houseId)
      .gte("date", monthStart.toISOString().split("T")[0])
      .lte("date", monthEnd.toISOString().split("T")[0]);

    if (error) console.error("Error fetching expenses by category:", error);

    const categoryMap = {};
    data?.forEach((expense) => {
      const cat = expense.category || "Otros";
      categoryMap[cat] = (categoryMap[cat] || 0) + parseFloat(expense.amount || 0);
    });

    return Object.entries(categoryMap)
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  },

  /**
   * Obtiene facturas pendientes ordenadas por fecha de vencimiento
   * @param {string} houseId
   * @returns {Promise<Array>}
   */
  async getPendingBills(houseId) {
    const { data, error } = await supabase
      .from("economy_bills")
      .select("*")
      .eq("house_id", houseId)
      .eq("status", "pending")
      .order("due_date", { ascending: true });

    if (error) console.error("Error fetching pending bills:", error);
    return data || [];
  },

  /**
   * Obtiene la factura más próxima a vencer
   * @param {string} houseId
   * @returns {Promise<Object|null>}
   */
  async getNextBill(houseId) {
    const bills = await this.getPendingBills(houseId);
    return bills?.[0] || null;
  },

  /**
   * Obtiene todas las facturas de una casa
   * @param {string} houseId
   * @returns {Promise<Array>}
   */
  async getAllBills(houseId) {
    const { data, error } = await supabase
      .from("economy_bills")
      .select("*")
      .eq("house_id", houseId)
      .order("due_date", { ascending: true });

    if (error) console.error("Error fetching all bills:", error);
    return data || [];
  },

  /**
   * Obtiene todos los gastos de una casa
   * @param {string} houseId
   * @param {number} limit - Número máximo de resultados
   * @returns {Promise<Array>}
   */
  async getAllExpenses(houseId, limit = 50) {
    const { data, error } = await supabase
      .from("economy_expenses")
      .select("*")
      .eq("house_id", houseId)
      .order("date", { ascending: false })
      .limit(limit);

    if (error) console.error("Error fetching expenses:", error);
    return data || [];
  },

  /**
   * Obtiene todos los ingresos de una casa
   * @param {string} houseId
   * @param {number} limit - Número máximo de resultados
   * @returns {Promise<Array>}
   */
  async getAllIncome(houseId, limit = 50) {
    const { data, error } = await supabase
      .from("economy_income")
      .select("*")
      .eq("house_id", houseId)
      .order("date", { ascending: false })
      .limit(limit);

    if (error) console.error("Error fetching income:", error);
    return data || [];
  },

  /**
   * Crea una nueva factura
   * @param {Object} bill - Datos de la factura
   * @returns {Promise<Object>}
   */
  async createBill(bill) {
    const { data, error } = await supabase
      .from("economy_bills")
      .insert([bill])
      .select();

    if (error) console.error("Error creating bill:", error);
    return data?.[0] || null;
  },

  /**
   * Actualiza una factura
   * @param {string} billId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateBill(billId, updates) {
    const { data, error } = await supabase
      .from("economy_bills")
      .update(updates)
      .eq("id", billId)
      .select();

    if (error) console.error("Error updating bill:", error);
    return data?.[0] || null;
  },

  /**
   * Marca una factura como pagada
   * @param {string} billId
   * @returns {Promise<Object>}
   */
  async markBillAsPaid(billId) {
    return this.updateBill(billId, {
      status: "paid",
      paid_date: new Date().toISOString().split("T")[0],
    });
  },

  /**
   * Elimina una factura
   * @param {string} billId
   * @returns {Promise<boolean>}
   */
  async deleteBill(billId) {
    const { error } = await supabase
      .from("economy_bills")
      .delete()
      .eq("id", billId);

    if (error) console.error("Error deleting bill:", error);
    return !error;
  },

  /**
   * Crea un nuevo gasto
   * @param {Object} expense - Datos del gasto
   * @returns {Promise<Object>}
   */
  async createExpense(expense) {
    const { data, error } = await supabase
      .from("economy_expenses")
      .insert([expense])
      .select();

    if (error) console.error("Error creating expense:", error);
    return data?.[0] || null;
  },

  /**
   * Actualiza un gasto
   * @param {string} expenseId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateExpense(expenseId, updates) {
    const { data, error } = await supabase
      .from("economy_expenses")
      .update(updates)
      .eq("id", expenseId)
      .select();

    if (error) console.error("Error updating expense:", error);
    return data?.[0] || null;
  },

  /**
   * Elimina un gasto
   * @param {string} expenseId
   * @returns {Promise<boolean>}
   */
  async deleteExpense(expenseId) {
    const { error } = await supabase
      .from("economy_expenses")
      .delete()
      .eq("id", expenseId);

    if (error) console.error("Error deleting expense:", error);
    return !error;
  },

  /**
   * Crea un nuevo ingreso
   * @param {Object} income - Datos del ingreso
   * @returns {Promise<Object>}
   */
  async createIncome(income) {
    const { data, error } = await supabase
      .from("economy_income")
      .insert([income])
      .select();

    if (error) console.error("Error creating income:", error);
    return data?.[0] || null;
  },

  /**
   * Actualiza un ingreso
   * @param {string} incomeId
   * @param {Object} updates
   * @returns {Promise<Object>}
   */
  async updateIncome(incomeId, updates) {
    const { data, error } = await supabase
      .from("economy_income")
      .update(updates)
      .eq("id", incomeId)
      .select();

    if (error) console.error("Error updating income:", error);
    return data?.[0] || null;
  },

  /**
   * Elimina un ingreso
   * @param {string} incomeId
   * @returns {Promise<boolean>}
   */
  async deleteIncome(incomeId) {
    const { error } = await supabase
      .from("economy_income")
      .delete()
      .eq("id", incomeId);

    if (error) console.error("Error deleting income:", error);
    return !error;
  },
};
