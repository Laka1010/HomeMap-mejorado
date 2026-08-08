import { supabase } from "../../../supabaseClient";
import { securityEventsService } from "../../../services/securityEventsService";

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

  /**
   * No permite tocar `balance` directamente — solo nombre/icono/color/estado.
   * `.single()` lanza PGRST116 ("0 rows") si el USING de RLS filtra la fila
   * -- mismo mecanismo que getHouseholdSpace: no hay error de RLS "de
   * verdad" en un UPDATE cuya cláusula USING no ve la fila, pero 0 filas
   * devueltas por el RETURNING que sintetiza `.select()` sí lo es.
   */
  async updateAccount(accountId, updates) {
    const { data, error } = await supabase
      .from("financial_accounts")
      .update(updates)
      .eq("id", accountId)
      .select()
      .single();
    if (error) {
      if (error.code === "PGRST116") {
        securityEventsService.logSecurityEvent("authz_cross_account_access", { resourceType: "financial_account", resourceId: accountId });
      }
      throw error;
    }
    return data;
  },

  async archiveAccount(accountId) {
    return this.updateAccount(accountId, { status: "archived" });
  },

  async reactivateAccount(accountId) {
    return this.updateAccount(accountId, { status: "active" });
  },

  /**
   * Borrado real (no archivado): la cuenta desaparece y, por el
   * `on delete cascade` de la migración, también sus gastos/ingresos y
   * transferencias asociadas — es una acción destructiva e irreversible,
   * de ahí la confirmación explícita en `AccountModal`. La cuenta por
   * defecto de un Space no se puede borrar por aquí (ver comprobación en
   * `AccountModal`, que ni siquiera muestra el botón para ella).
   */
  async deleteAccount(accountId) {
    // `.select()` no cambia el borrado en sí -- solo hace observable cuántas
    // filas se borraron realmente. Sin él, un DELETE cuyo USING de RLS
    // filtra la fila no afecta ninguna y Postgres no lo trata como error
    // (a diferencia de un INSERT/UPDATE con WITH CHECK): sería silencioso.
    const { data, error } = await supabase.from("financial_accounts").delete().eq("id", accountId).select();
    if (error) throw error;
    if (!data || data.length === 0) {
      securityEventsService.logSecurityEvent("authz_cross_account_access", { resourceType: "financial_account", resourceId: accountId });
    }
  },
};
