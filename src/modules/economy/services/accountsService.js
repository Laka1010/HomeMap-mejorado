import { supabase } from "../../../supabaseClient";

/**
 * Servicio de cuentas (financial_accounts) — cada Financial Space puede
 * tener varias cuentas (Banco/Tarjeta/Efectivo/Ahorros...). El saldo lo
 * mantiene la base de datos (triggers sobre economy_expenses/income y sobre
 * financial_transfers), nunca se escribe `balance` a mano desde aquí salvo
 * al crear la cuenta (`initial_balance`). Contrato `throw` en error, igual
 * que `economyGoalsService`/`financialSpacesService`.
 */
export const accountsService = {
  async listAccounts(spaceId) {
    const { data, error } = await supabase
      .from("financial_accounts")
      .select("*")
      .eq("financial_space_id", spaceId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data || [];
  },

  /** `account`: { name, icon, color, type: 'bank'|'card'|'cash'|'savings'|'other', currencyCode, initialBalance } */
  async createAccount(spaceId, userId, account) {
    const { data, error } = await supabase
      .from("financial_accounts")
      .insert({
        financial_space_id: spaceId,
        created_by: userId,
        name: account.name,
        icon: account.icon,
        color: account.color,
        type: account.type,
        currency_code: account.currencyCode,
        initial_balance: account.initialBalance || 0,
        balance: account.initialBalance || 0,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  /** No permite tocar `balance` directamente — solo nombre/icono/color/estado. */
  async updateAccount(accountId, updates) {
    const { data, error } = await supabase
      .from("financial_accounts")
      .update(updates)
      .eq("id", accountId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async archiveAccount(accountId) {
    return this.updateAccount(accountId, { status: "archived" });
  },

  async reactivateAccount(accountId) {
    return this.updateAccount(accountId, { status: "active" });
  },
};
