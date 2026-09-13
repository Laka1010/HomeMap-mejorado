import { Capacitor } from "@capacitor/core";
import { Purchases, LOG_LEVEL } from "@revenuecat/purchases-capacitor";

/**
 * Envoltorio fino sobre el SDK de RevenueCat -- único punto de la app que lo
 * toca, mismo espíritu que aiService.invokeEdgeFunction. El SDK NUNCA es la
 * fuente de verdad de si alguien es Premium (eso lo decide siempre
 * profiles.subscription_status en Supabase, actualizado por el webhook de
 * RevenueCat -- ver supabase/functions/revenuecat-webhook): aquí solo se usa
 * para iniciar la compra y enseñar el resultado al momento.
 *
 * No-op en web (la app también corre en navegador para pruebas por túnel) --
 * Capacitor.isNativePlatform() es el mismo guard que ya usa App.jsx para
 * otras integraciones nativas.
 */

const ANDROID_API_KEY = import.meta.env.VITE_REVENUECAT_ANDROID_API_KEY;

let configured = false;

export const revenuecatService = {
  /** Se llama una vez por sesión de usuario logueado, con su id de Supabase como appUserID. */
  async configure(userId) {
    if (!Capacitor.isNativePlatform() || configured || !userId) return;
    if (!ANDROID_API_KEY) {
      console.warn("RevenueCat: falta VITE_REVENUECAT_ANDROID_API_KEY, no se configura el SDK.");
      return;
    }
    if (import.meta.env.DEV) Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
    await Purchases.configure({ apiKey: ANDROID_API_KEY, appUserID: userId });
    configured = true;
  },

  async getOfferings() {
    if (!Capacitor.isNativePlatform()) return null;
    const { current } = await Purchases.getOfferings();
    return current;
  },

  /** @param {import("@revenuecat/purchases-capacitor").PurchasesPackage} pkg */
  async purchasePackage(pkg) {
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return customerInfo;
  },

  async restorePurchases() {
    const { customerInfo } = await Purchases.restorePurchases();
    return customerInfo;
  },

  async getCustomerInfo() {
    if (!Capacitor.isNativePlatform()) return null;
    const { customerInfo } = await Purchases.getCustomerInfo();
    return customerInfo;
  },
};
