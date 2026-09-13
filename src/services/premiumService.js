import { supabase } from "../supabaseClient";

/**
 * Capa única de permisos Premium (Haven IA). Mismo patrón que
 * securityAdminService.amISecurityAdmin(): un envoltorio fino por RPC, gating
 * de UI en el cliente, aplicación real en el servidor (ver
 * supabase/migrations/20260913_100_premium_subscription_status.sql y
 * 20260913_105_premium_usage_limits.sql). Ningún sitio de la app debe
 * comprobar `subscription_status` a mano ni pasar un string suelto como
 * feature key: siempre a través de PREMIUM_FEATURES y de canUsePremiumFeature.
 */
export const PREMIUM_FEATURES = {
  AI_CHAT: "ai_chat",
  AI_CONSUMABLES: "ai_consumables",
  RECEIPT_SCANNER: "receipt_scanner",
  MULTIPLE_HOMES: "multiple_homes",
  PREMIUM_ICONS: "premium_icons",
};

/** Las únicas 3 features con límite mensual de uso (sistema de límites Premium). */
export const METERED_PREMIUM_FEATURES = [
  PREMIUM_FEATURES.AI_CHAT,
  PREMIUM_FEATURES.AI_CONSUMABLES,
  PREMIUM_FEATURES.RECEIPT_SCANNER,
];

export const premiumService = {
  async getMySubscriptionStatus() {
    const { data, error } = await supabase.rpc("get_my_subscription_status");
    if (error) throw error;
    return data || "free";
  },

  /**
   * Para las 3 features medidas, ya incluye el cupo del ciclo actual (no
   * solo el estado de suscripción) -- ver get_premium_usage en
   * 20260913_105_premium_usage_limits.sql.
   */
  async canUsePremiumFeature(featureKey) {
    const { data, error } = await supabase.rpc("can_use_premium_feature", { p_feature_key: featureKey });
    if (error) throw error;
    return !!data;
  },

  /**
   * Uso/límite/restante del ciclo actual para una feature medida. Devuelve
   * `null` si el RPC falla (fallar cerrado sería peor UX que simplemente no
   * mostrar la barra de uso; el bloqueo real de todos modos lo hace el
   * servidor en cada Edge Function, no esta lectura).
   */
  async getPremiumUsage(featureKey) {
    const { data, error } = await supabase.rpc("get_premium_usage", { p_feature_key: featureKey });
    if (error) throw error;
    return Array.isArray(data) ? data[0] ?? null : data ?? null;
  },

  async getPremiumLimit(featureKey) {
    const usage = await this.getPremiumUsage(featureKey);
    return usage?.limit_value ?? null;
  },

  /** Pasa de 'free' a 'trial'; no-op si ya está en trial/premium/expired. */
  async activatePremiumTrial() {
    const { error } = await supabase.rpc("activate_premium_trial");
    if (error) throw error;
  },

  /**
   * Registra un uso de una feature Premium medida. Hoy las 3 Edge Functions
   * (ai-assistant, vision-proxy) ya registran el uso ellas mismas tras una
   * respuesta correcta del proveedor de IA -- este método queda como parte
   * de la capa centralizada para cualquier feature futura que se mida solo
   * desde el cliente.
   */
  async recordPremiumUsage(featureKey, { requestId = null, success = true } = {}) {
    const { error } = await supabase.rpc("record_ai_usage_event", {
      p_feature_key: featureKey,
      p_request_id: requestId,
      p_success: success,
    });
    if (error) throw error;
  },
};
