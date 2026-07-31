import { supabase } from "../supabaseClient";

/**
 * Servicio de historial de compras — shopping_purchases en Supabase. Cada
 * fila es una instantánea inmutable de los productos comprados en una
 * sesión de "modo compra" o de un ticket escaneado (para Historial y
 * "Repetir compra"). Mismo patrón de mapeo snake_case (DB) <-> camelCase
 * (JS) que shoppingService.js.
 */

function purchaseFromRow(row) {
  return {
    id: row.id,
    listId: row.list_id,
    store: row.store,
    amount: row.amount,
    items: Array.isArray(row.items) ? row.items : [],
    completedAt: row.completed_at,
    receiptImagePath: row.receipt_image_url,
    taxAmount: row.tax_amount,
    discountAmount: row.discount_amount,
    rawScan: row.raw_scan,
  };
}

export const shoppingPurchasesService = {
  async fetchHistory(houseId, limit = 50) {
    const { data, error } = await supabase
      .from("shopping_purchases")
      .select("*")
      .eq("house_id", houseId)
      .order("completed_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data || []).map(purchaseFromRow);
  },

  async createPurchase(houseId, purchase) {
    const { data, error } = await supabase
      .from("shopping_purchases")
      .insert({
        house_id: houseId,
        list_id: purchase.listId || null,
        store: purchase.store || null,
        amount: purchase.amount === "" || purchase.amount === undefined ? null : purchase.amount,
        items: purchase.items || [],
        created_by: purchase.createdBy || null,
        receipt_image_url: purchase.receiptImagePath || null,
        tax_amount: purchase.taxAmount === "" || purchase.taxAmount === undefined ? null : purchase.taxAmount,
        discount_amount: purchase.discountAmount === "" || purchase.discountAmount === undefined ? null : purchase.discountAmount,
        raw_scan: purchase.rawScan || null,
        ...(purchase.completedAt ? { completed_at: purchase.completedAt } : {}),
      })
      .select()
      .single();
    if (error) throw error;
    return purchaseFromRow(data);
  },

  async updatePurchase(purchaseId, patch) {
    const row = {};
    if ("receiptImagePath" in patch) row.receipt_image_url = patch.receiptImagePath;
    const { data, error } = await supabase.from("shopping_purchases").update(row).eq("id", purchaseId).select().single();
    if (error) throw error;
    return purchaseFromRow(data);
  },

  async deletePurchase(purchaseId) {
    const { error } = await supabase.from("shopping_purchases").delete().eq("id", purchaseId);
    if (error) throw error;
  },
};
