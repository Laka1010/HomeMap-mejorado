import { supabase } from "../../../supabaseClient";
import { toLocalDateString } from "../../../utils/dates";

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
      .gte("date", toLocalDateString(monthStart))
      .lte("date", toLocalDateString(monthEnd));

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
      .gte("date", toLocalDateString(monthStart))
      .lte("date", toLocalDateString(monthEnd));

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
      .gte("date", toLocalDateString(monthStart))
      .lte("date", toLocalDateString(monthEnd));

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

  // ==========================================================================
  // Variantes por Financial Space — usadas por StatisticsSection/MovementsSection
  // /BillsSection dentro del módulo Economía, donde el usuario puede estar
  // viendo Personal/Shared, no solo Household. Los métodos *ByHouseId de
  // arriba se mantienen intactos (con su mismo contrato house_id) porque los
  // consumen también useDashboardEconomy, CalendarModule, useGlobalSearch y
  // notifications/engine — esos sí deben seguir siendo siempre el Household,
  // nunca el Space que el usuario tenga seleccionado en el switcher.
  // ==========================================================================

  /** @param {string} spaceId @returns {Promise<Array>} */
  async getAllBillsBySpace(spaceId) {
    const { data, error } = await supabase
      .from("economy_bills")
      .select("*")
      .eq("financial_space_id", spaceId)
      .order("due_date", { ascending: true });

    if (error) console.error("Error fetching bills by space:", error);
    return data || [];
  },

  /** @param {string} spaceId @returns {Promise<Array>} */
  async getPendingBillsBySpace(spaceId) {
    const { data, error } = await supabase
      .from("economy_bills")
      .select("*")
      .eq("financial_space_id", spaceId)
      .eq("status", "pending")
      .order("due_date", { ascending: true });

    if (error) console.error("Error fetching pending bills by space:", error);
    return data || [];
  },

  /** @param {string} spaceId @param {number} limit @returns {Promise<Array>} */
  async getAllExpensesBySpace(spaceId, limit = 50) {
    const { data, error } = await supabase
      .from("economy_expenses")
      .select("*")
      .eq("financial_space_id", spaceId)
      .order("date", { ascending: false })
      .limit(limit);

    if (error) console.error("Error fetching expenses by space:", error);
    return data || [];
  },

  /** @param {string} spaceId @param {number} limit @returns {Promise<Array>} */
  async getAllIncomeBySpace(spaceId, limit = 50) {
    const { data, error } = await supabase
      .from("economy_income")
      .select("*")
      .eq("financial_space_id", spaceId)
      .order("date", { ascending: false })
      .limit(limit);

    if (error) console.error("Error fetching income by space:", error);
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
      paid_date: toLocalDateString(new Date()),
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

    if (error) {
      console.error("Error creating expense:", error);
      throw error;
    }
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

    if (error) {
      console.error("Error creating income:", error);
      throw error;
    }
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

  /**
   * Paga una factura desde una cuenta del propio Household (crea el gasto y
   * marca la factura pagada de forma atómica en la base de datos).
   * A diferencia del resto de este servicio, este método SÍ lanza en error
   * (contrato `throw`, no `console.error` + null) — es código nuevo, no se
   * arrastra el bug ya conocido del resto de `economyService`.
   * @param {string} billId
   * @param {string} accountId - Debe pertenecer al mismo Financial Space que la factura
   */
  async payBillFromAccount(billId, accountId) {
    const { data, error } = await supabase.rpc("pay_bill_from_account", {
      p_bill_id: billId,
      p_account_id: accountId,
    });
    if (error) throw error;
    return data;
  },

  /**
   * Paga una factura del Household mediante una contribución inmediata desde
   * cualquier cuenta accesible del usuario (Personal, Shared o del propio
   * Household). Contrato `throw`, ver nota de `payBillFromAccount`.
   * @param {string} billId
   * @param {string} fromAccountId
   */
  async payBillViaContribution(billId, fromAccountId) {
    const { data, error } = await supabase.rpc("pay_bill_via_contribution", {
      p_bill_id: billId,
      p_from_account_id: fromAccountId,
    });
    if (error) throw error;
    return data;
  },
};
