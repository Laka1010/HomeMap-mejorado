import { supabase } from "../supabaseClient";

/**
 * Capa única de permisos Premium (Haven IA). Mismo patrón que
 * securityAdminService.amISecurityAdmin(): un envoltorio fino por RPC, gating
 * de UI en el cliente, aplicación real en el servidor (ver
 * supabase/migrations/20260913_100_premium_subscription_status.sql). Ningún
 * sitio de la app debe comprobar `subscription_status` a mano ni pasar un
 * string suelto como feature key: siempre a través de PREMIUM_FEATURES y de
 * canUsePremiumFeature.
 */
export const PREMIUM_FEATURES = {
  AI_CONSUMABLES: "ai_consumables",
  RECEIPT_SCANNER: "receipt_scanner",
  MULTIPLE_HOMES: "multiple_homes",
  PREMIUM_ICONS: "premium_icons",
  AI_ASSISTANT: "ai_assistant",
};

export const premiumService = {
  async getMySubscriptionStatus() {
    const { data, error } = await supabase.rpc("get_my_subscription_status");
    if (error) throw error;
    return data || "free";
  },

  async canUsePremiumFeature(featureKey) {
    const { data, error } = await supabase.rpc("can_use_premium_feature", { p_feature_key: featureKey });
    if (error) throw error;
    return !!data;
  },

  /** Pasa de 'free' a 'trial'; no-op si ya está en trial/premium/expired. */
  async activatePremiumTrial() {
    const { error } = await supabase.rpc("activate_premium_trial");
    if (error) throw error;
  },

  /** Registra un uso de IA (sección 11: base para límites mensuales futuros). */
  async recordAiUsage(featureKey) {
    const { error } = await supabase.rpc("record_ai_usage_event", { p_feature_key: featureKey });
    if (error) throw error;
  },
};
