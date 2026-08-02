import { supabase } from "../../../supabaseClient";

/**
 * Servicio de transferencias y contribuciones (financial_transfers).
 * Transferir entre cuentas del mismo Space y contribuir a otro Space son la
 * misma operación de saldo en la base de datos (ver
 * `_execute_financial_transfer` en la migración) — aquí se exponen como dos
 * métodos porque la UI los presenta como acciones distintas ("Transferir"
 * vs. "Contribute to Household/Shared Space"). Contrato `throw` en error.
 */
export const transfersService = {
  /** Entre dos cuentas cualesquiera a las que el usuario tenga acceso (mismo Space o no). */
  async transferBetweenAccounts(fromAccountId, toAccountId, amount, note) {
    const { data, error } = await supabase.rpc("transfer_between_accounts", {
      p_from_account_id: fromAccountId,
      p_to_account_id: toAccountId,
      p_amount: amount,
      p_note: note || null,
    });
    if (error) throw error;
    return data;
  },

  /** Aporta desde una cuenta propia a la cuenta por defecto de otro Space (Household o Shared). */
  async contributeToSpace(fromAccountId, toSpaceId, amount, note) {
    const { data, error } = await supabase.rpc("contribute_to_financial_space", {
      p_from_account_id: fromAccountId,
      p_to_space_id: toSpaceId,
      p_amount: amount,
      p_note: note || null,
    });
    if (error) throw error;
    return data;
  },

  /** Ledger de transferencias/contribuciones que entran o salen de las cuentas de este Space. */
  async listTransfersForSpace(spaceId) {
    const { data: accounts, error: accountsError } = await supabase
      .from("financial_accounts")
      .select("id")
      .eq("financial_space_id", spaceId);
    if (accountsError) throw accountsError;

    const ids = (accounts || []).map((a) => a.id);
    if (ids.length === 0) return [];

    const { data, error } = await supabase
      .from("financial_transfers")
      .select("*")
      .or(`from_account_id.in.(${ids.join(",")}),to_account_id.in.(${ids.join(",")})`)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },
};
